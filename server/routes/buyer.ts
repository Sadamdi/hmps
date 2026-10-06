/**
 * API akun pembeli toko — /api/buyer/* (juga lewat /api/c/:slug/buyer/* di toko komunitas).
 *
 * Akun pembeli terpisah dari akun staf: lihat server/services/buyer-auth.ts. Semua data pesanan difilter
 * `buyerId` dari sesi server, tidak pernah dari input client.
 */
import crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Community, Customer, CustomerSession, OtpChallenge, StoreOrder, StoreSettings } from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';
import { authenticate, endStaffSession, hashPassword, verifyPassword } from '../auth';
import { getRealClientIp } from '../lib/geoip';
import { logLoginAttempt } from '../models/login-attempt';
import { accountLockRemaining, recordAccountLoginFailure, resetAccountLoginFailures } from '../middleware/account-login-throttle';
import { createPublicRateLimiter } from '../middleware/public-rate-limit';
import { createOtpChallenge, verifyOtpChallenge, OtpError, RateLimitError } from '../services/otp';
import {
	authenticateBuyer,
	BUYER_EMAIL_RE,
	claimOrdersForCustomer,
	currentBuyerSid,
	endBuyerSession,
	getBuyer,
	normalizeBuyerEmail,
	publicCustomer,
	startBuyerSession,
} from '../services/buyer-auth';

const router = Router();

const authLimiter = createPublicRateLimiter('buyer-auth', [
	{ windowMs: 10 * 60_000, maxPerIp: 30, maxPerDevice: 15, label: '10 menit' },
	{ windowMs: 24 * 60 * 60_000, maxPerIp: 300, maxPerDevice: 100, label: '1 hari' },
]);

const fail = (res: Response, status: number, message: string, code: string) =>
	res.status(status).json({ success: false, message, error: { code } });

function otpErrorResponse(res: Response, e: unknown) {
	if (e instanceof RateLimitError) return res.status(429).json({ success: false, message: e.message, retryAfterSeconds: e.retryAfterSeconds, error: { code: 'RATE_LIMITED' } });
	if (e instanceof OtpError) return fail(res, 400, e.message, 'OTP_INVALID');
	console.error('[buyer]', e);
	return fail(res, 500, 'Terjadi kesalahan. Coba lagi.', 'INTERNAL');
}

/**
 * Email pengurus tidak boleh didaftarkan/dikelola dari sisi pembeli: akun pembeli untuk pengurus hanya
 * lahir dari sesi pengurus (/from-staff) dengan password yang sama, dan password-nya diatur di Dashboard > Profil.
 */
// Satu pesan untuk semua kasus "email sudah dipakai" (pembeli, pengurus, diblokir) agar email tidak bisa ditebak
const STAFF_EMAIL_MSG = 'Email ini sudah terdaftar. Silakan masuk, atau gunakan "Lupa password" bila perlu.';
const STAFF_PASSWORD_MSG = 'Password akun pengurus diatur lewat Dashboard pengurus > Profil (dengan OTP), bukan dari akun pembeli.';
const GENERIC_OTP_MSG = 'Jika email terdaftar sebagai pembeli, kode OTP sudah dikirim. Akun pengurus: atur password lewat Dashboard > Profil.';
async function isStaffEmail(email: string): Promise<boolean> {
	const { staffExistsForEmail } = await import('../services/unified-login');
	return staffExistsForEmail(email);
}
/** Akun pembeli yang tertaut SAH ke pengurus (id + email sama). Bekas pengurus (email berganti) tidak lagi dianggap terikat. */
const isStaffBound = async (c: any) => {
	if (!c?.linkedStaff?.userId) return false;
	const { resolveLinkedStaff } = await import('../services/unified-login');
	return !!(await resolveLinkedStaff(c));
};

/** Hitung gagal login lintas IP untuk satu akun; kunci setelah 60 kegagalan dalam jendela yang sama. */
const globalFails = new Map<string, { n: number; at: number }>();
function recordGlobalBuyerFailure(key: string) {
	const now = Date.now();
	const r = globalFails.get(key);
	const cur = !r || now - r.at > 15 * 60_000 ? { n: 0, at: now } : r;
	cur.n++;
	globalFails.set(key, cur);
	if (cur.n >= 60) {
		// pakai penghitung kunci akun yang sama agar accountLockRemaining berlaku
		for (let i = 0; i < 10; i++) recordAccountLoginFailure(key);
	}
	if (globalFails.size > 2000) globalFails.clear();
}

const reqIp = (req: Request) => String((req as any).ip || '').slice(0, 64);
const PASSWORD_MIN = 8;
const cleanName = (v: unknown) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, 80);
const cleanPhone = (v: unknown) => String(v || '').replace(/[^\d+]/g, '').slice(0, 20);

/** Setelah login berhasil: sesi + tautkan pesanan lama → kirim data akun. */
async function completeLogin(req: Request, res: Response, customer: any, extra: Record<string, unknown> = {}) {
	await startBuyerSession(req, res, customer);
	const claimed = await claimOrdersForCustomer(req, customer);
	const fresh = await Customer.findById(customer._id).lean();
	return res.json({ success: true, data: { customer: publicCustomer(fresh), claimedOrders: claimed, ...extra } });
}

// ── Daftar (email + password, verifikasi OTP email) ──
const registerSchema = z.object({
	name: z.string().min(1).max(80),
	email: z.string().min(5).max(200),
	password: z.string().min(PASSWORD_MIN).max(200),
	phone: z.string().max(30).optional(),
});

router.post('/register', authLimiter, async (req, res) => {
	const parsed = registerSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, `Lengkapi nama, email, dan password (minimal ${PASSWORD_MIN} karakter)`, 'VALIDATION_ERROR');
	const email = normalizeBuyerEmail(parsed.data.email);
	if (!BUYER_EMAIL_RE.test(email)) return fail(res, 400, 'Format email tidak valid', 'EMAIL_INVALID');
	try {
		if (await isStaffEmail(email)) return fail(res, 409, STAFF_EMAIL_MSG, 'EMAIL_REGISTERED');
		let c: any = await Customer.findOne({ email });
		if (c && (c.status === 'blocked' || c.status === 'active')) return fail(res, 409, STAFF_EMAIL_MSG, 'EMAIL_REGISTERED');
		const passwordHash = await hashPassword(parsed.data.password);
		const fields = { name: cleanName(parsed.data.name), phone: cleanPhone(parsed.data.phone), passwordHash };
		if (c) await Customer.updateOne({ _id: c._id }, { $set: fields });
		else c = await Customer.create({ email, status: 'pending', emailVerified: false, ...fields });
		const { challengeId } = await createOtpChallenge({ purpose: 'buyer_register', email, userId: String(c._id), ttlMinutes: 10, requestIp: reqIp(req) });
		res.json({ success: true, message: 'Kode verifikasi dikirim ke email.', data: { challengeId, email } });
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

const otpVerifySchema = z.object({ challengeId: z.string().min(10).max(64), code: z.string().regex(/^\d{6}$/) });

router.post('/register/verify', authLimiter, async (req, res) => {
	const parsed = otpVerifySchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Kode OTP 6 digit wajib diisi', 'VALIDATION_ERROR');
	try {
		const r = await verifyOtpChallenge({ challengeId: parsed.data.challengeId, code: parsed.data.code, purpose: 'buyer_register' });
		const c: any = r.userId ? await Customer.findById(r.userId) : null;
		if (!c || c.email !== r.email) return fail(res, 400, 'Pendaftaran tidak ditemukan. Daftar ulang.', 'REGISTRATION_NOT_FOUND');
		if (!(await isStaffBound(c)) && (await isStaffEmail(c.email))) return fail(res, 409, STAFF_EMAIL_MSG, 'EMAIL_REGISTERED');
		if (c.status === 'blocked') return fail(res, 403, 'Akun ini diblokir. Hubungi admin toko.', 'BUYER_BLOCKED');
		c.emailVerified = true;
		if (c.status === 'pending') c.status = 'active';
		await c.save();
		return completeLogin(req, res, c.toObject());
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

// ── Masuk ──
const loginSchema = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) });

router.post('/login', authLimiter, async (req, res) => {
	const parsed = loginSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Email dan password wajib diisi', 'VALIDATION_ERROR');
	const email = normalizeBuyerEmail(parsed.data.email);
	// Throttle per AKUN (sama seperti login pengurus): tahan tebak password terdistribusi lintas IP
	const ipKey = getRealClientIp(req);
	const throttleKey = `buyer:${email}:${ipKey}`; // percobaan dari satu IP ke satu akun: 10x
	const globalKey = `buyer-all:${email}`; // semua IP ke satu akun: 60x (tebak terdistribusi)
	const lockedFor = Math.max(accountLockRemaining(throttleKey), accountLockRemaining(globalKey));
	if (lockedFor > 0) {
		void logLoginAttempt({ ip: getRealClientIp(req), email, success: false, reason: 'locked', scope: 'buyer' });
		return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan login untuk akun ini. Coba lagi nanti.', retryAfter: lockedFor, error: { code: 'ACCOUNT_LOGIN_THROTTLED' } });
	}
	const c: any = await Customer.findOne({ email }).lean();
	const ok = !!c?.passwordHash && (await verifyPassword(parsed.data.password, c.passwordHash));
	if (!c || !ok) {
		recordAccountLoginFailure(throttleKey);
		for (let i = 0; i < 1; i++) recordGlobalBuyerFailure(globalKey);
		void logLoginAttempt({ ip: getRealClientIp(req), email, success: false, reason: c ? 'invalid_password' : 'not_found', scope: 'buyer' });
		return fail(res, 401, 'Email atau password salah', 'INVALID_CREDENTIALS');
	}
	resetAccountLoginFailures(throttleKey);
	void logLoginAttempt({ ip: getRealClientIp(req), email, success: true, reason: 'success', userId: c._id, scope: 'buyer' });
	if (c.status === 'blocked') return fail(res, 403, 'Akun ini diblokir. Hubungi admin toko.', 'BUYER_BLOCKED');
	if (c.status !== 'active' || !c.emailVerified) return fail(res, 403, 'Email belum diverifikasi. Daftar ulang untuk menerima kode verifikasi.', 'EMAIL_UNVERIFIED');
	// Email yang sama juga terdaftar sebagai pengurus? (hanya diberitahukan setelah password pembeli benar)
	const alsoStaff = await isStaffBound(c);
	return completeLogin(req, res, c, { alsoStaff });
});

// ── Masuk dengan Google (Firebase; verifikasi yang sama dengan login staf) ──
const googleSchema = z.object({ idToken: z.string().min(100).max(8192) });

router.post('/google', authLimiter, async (req, res) => {
	const parsed = googleSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Permintaan login Google tidak valid', 'VALIDATION_ERROR');
	const { verifyGoogleIdToken, GoogleLoginError } = await import('../services/google-login');
	let g: { email: string; uid: string; name: string };
	try {
		g = await verifyGoogleIdToken(parsed.data.idToken);
	} catch (err) {
		if (err instanceof GoogleLoginError) return fail(res, err.code === 'GOOGLE_LOGIN_DISABLED' ? 503 : 401, err.message, err.code);
		console.error('[buyer] google verify', err);
		return fail(res, 500, 'Gagal memverifikasi login Google', 'INTERNAL');
	}
	try {
		const email = normalizeBuyerEmail(g.email);
		let c: any = (await Customer.findOne({ googleSub: g.uid })) || (await Customer.findOne({ email }));
		if (c && c.status === 'blocked') return fail(res, 403, 'Akun ini diblokir. Hubungi admin toko.', 'BUYER_BLOCKED');
		let created = false;
		// Akun 'pending' (daftar belum diverifikasi, password bisa dipasang pihak lain) dianggap belum ada:
		// pemilik email lewat Google harus onboarding ulang dengan password sendiri.
		if (!c || c.status === 'deleted' || c.status === 'pending') {
			// Belum punya akun pembeli → onboarding dulu (nama, password); akun dibuat di /google/complete
			if (await isStaffEmail(email)) return fail(res, 409, STAFF_EMAIL_MSG, 'EMAIL_REGISTERED');
			return res.json({ success: true, data: { needsOnboarding: true, email, name: cleanName(g.name) } });
		} else {
			// Email Google terverifikasi = bukti kepemilikan → aktifkan & tautkan
			if (!c.googleSub) c.googleSub = g.uid;
			c.emailVerified = true;
			if (c.status === 'pending') c.status = 'active';
			if (!c.name && g.name) c.name = cleanName(g.name);
			await c.save();
		}
		return completeLogin(req, res, c.toObject(), { created });
	} catch (e) {
		console.error('[buyer] google login', e);
		return fail(res, 500, 'Login Google gagal. Coba lagi.', 'INTERNAL');
	}
});

// ── Onboarding akun baru lewat Google: nama (boleh diubah), email terkunci dari Google, password + konfirmasi ──
const googleCompleteSchema = z.object({
	idToken: z.string().min(100).max(8192),
	name: z.string().min(1).max(80),
	password: z.string().min(PASSWORD_MIN).max(200),
	confirmPassword: z.string().min(1).max(200),
	phone: z.string().max(30).optional(),
});

router.post('/google/complete', authLimiter, async (req, res) => {
	const parsed = googleCompleteSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, `Lengkapi nama dan password (minimal ${PASSWORD_MIN} karakter)`, 'VALIDATION_ERROR');
	if (parsed.data.password !== parsed.data.confirmPassword) return fail(res, 400, 'Konfirmasi password tidak sama', 'PASSWORD_MISMATCH');
	const { verifyGoogleIdToken, GoogleLoginError } = await import('../services/google-login');
	let g: { email: string; uid: string; name: string };
	try {
		g = await verifyGoogleIdToken(parsed.data.idToken);
	} catch (err) {
		if (err instanceof GoogleLoginError) return fail(res, err.code === 'GOOGLE_LOGIN_DISABLED' ? 503 : 401, err.message, err.code);
		return fail(res, 500, 'Gagal memverifikasi login Google', 'INTERNAL');
	}
	try {
		const email = normalizeBuyerEmail(g.email); // email selalu dari Google, bukan dari client
		const existing: any = (await Customer.findOne({ googleSub: g.uid })) || (await Customer.findOne({ email }));
		if (existing && (existing.status === 'active' || existing.status === 'blocked')) return fail(res, 409, 'Akun sudah ada. Silakan masuk.', 'EMAIL_REGISTERED');
		if (await isStaffEmail(email)) return fail(res, 409, STAFF_EMAIL_MSG, 'EMAIL_REGISTERED');
		const fields = {
			email,
			emailVerified: true,
			status: 'active' as const,
			googleSub: g.uid,
			name: cleanName(parsed.data.name),
			phone: cleanPhone(parsed.data.phone),
			passwordHash: await hashPassword(parsed.data.password),
		};
		const c: any = existing ? await Customer.findOneAndUpdate({ _id: existing._id }, { $set: fields }, { new: true }) : await Customer.create(fields);
		return completeLogin(req, res, c.toObject ? c.toObject() : c, { created: true });
	} catch (e) {
		console.error('[buyer] google complete', e);
		return fail(res, 500, 'Gagal membuat akun. Coba lagi.', 'INTERNAL');
	}
});

router.post('/logout', async (req, res) => {
	// Satu identitas: keluar sebagai pembeli juga mengeluarkan sesi pengurus
	await getBuyer(req);
	await endBuyerSession(req, res);
	await endStaffSession(req, res);
	res.json({ success: true });
});

// ── Profil ──
router.get('/me', async (req, res) => {
	const c = await getBuyer(req);
	if (!c) return res.json({ success: true, data: { customer: null } });
	// alsoStaff: email ini juga pengurus → navbar menawarkan "Masuk sebagai pengurus" (sesi pengurus tetap harus lolos login)
	const alsoStaff = c.emailVerified ? await isStaffBound(c) : false;
	res.json({ success: true, data: { customer: { ...publicCustomer(c), alsoStaff } } });
});

/**
 * Pengurus ↔ pembeli (4.48.0). Penautan PERTAMA wajib OTP ke email pengurus (email buatan admin tidak terverifikasi);
 * hasilnya ikatan ke SATU pengurus (`Customer.linkedStaff = {scope, userId}`). Setelah tertaut, masuk sebagai pembeli
 * dari sesi pengurus tanpa OTP lagi — selama User itu masih ada dan emailnya sama (lihat resolveLinkedStaff).
 */
function staffEmailOf(req: Request): { user: any; email: string } | { error: string } {
	const user: any = (req as any).user;
	const email = normalizeBuyerEmail(user?.email);
	if (!BUYER_EMAIL_RE.test(email)) return { error: 'Akun pengurus ini belum punya email yang valid. Lengkapi email di profil dulu.' };
	return { user, email };
}

/** Masuk sebagai pembeli dari sesi pengurus yang sudah tertaut (tanpa OTP). Belum tertaut → 409 LINK_REQUIRED. */
router.post('/from-staff', authLimiter, authenticate, async (req, res) => {
	const info = staffEmailOf(req);
	if ('error' in info) return fail(res, 400, info.error, 'STAFF_EMAIL_MISSING');
	try {
		const c: any = await Customer.findOne({ email: info.email, status: 'active' });
		const scope = (await (await import('../services/unified-login')).staffScopeFromReq(req)) || 'main';
		if (!c || c.linkedStaff?.userId !== String(info.user._id) || (c.linkedStaff?.scope || 'main') !== scope) {
			return fail(res, 409, 'Verifikasi email dulu untuk menautkan akun pembeli.', 'LINK_REQUIRED');
		}
		if (!(await isStaffBound(c))) return fail(res, 409, 'Verifikasi email dulu untuk menautkan akun pembeli.', 'LINK_REQUIRED');
		await endStaffSession(req, res);
		return completeLogin(req, res, c.toObject(), {});
	} catch (e) {
		console.error('[buyer/from-staff]', e);
		return fail(res, 500, 'Gagal membuka akun pembeli. Coba lagi.', 'INTERNAL');
	}
});

/** Langkah 1 tautan: kirim OTP ke email pengurus. */
router.post('/link-staff/otp', authLimiter, authenticate, async (req, res) => {
	const info = staffEmailOf(req);
	if ('error' in info) return fail(res, 400, info.error, 'STAFF_EMAIL_MISSING');
	try {
		const existing: any = await Customer.findOne({ email: info.email });
		if (existing?.status === 'blocked') return fail(res, 403, 'Akun pembeli dengan email ini diblokir. Hubungi admin toko.', 'BUYER_BLOCKED');
		// Sudah tertaut sah ke pengurus LAIN → tolak (satu akun pembeli = satu pengurus)
		if (existing?.linkedStaff?.userId && existing.linkedStaff.userId !== String(info.user._id) && (await isStaffBound(existing))) {
			return fail(res, 409, 'Akun pembeli dengan email ini sudah tertaut ke pengurus lain.', 'LINKED_ELSEWHERE');
		}
		const { challengeId } = await createOtpChallenge({ purpose: 'buyer_link_staff', email: info.email, userId: String(info.user._id), ttlMinutes: 10, requestIp: reqIp(req), username: info.user.username });
		res.json({ success: true, message: 'Kode verifikasi dikirim ke email pengurus.', data: { challengeId, email: info.email } });
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

/** Langkah 2 tautan: verifikasi OTP → buat/ambil akun pembeli, ikat ke pengurus ini, masuk sebagai pembeli. */
router.post('/link-staff/verify', authLimiter, authenticate, async (req, res) => {
	const parsed = otpVerifySchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Kode OTP 6 digit wajib diisi', 'VALIDATION_ERROR');
	const info = staffEmailOf(req);
	if ('error' in info) return fail(res, 400, info.error, 'STAFF_EMAIL_MISSING');
	try {
		const ch: any = await OtpChallenge.findById(parsed.data.challengeId).lean();
		if (!ch || String(ch.userId) !== String(info.user._id)) return fail(res, 400, 'Kode OTP tidak valid', 'OTP_INVALID');
		const r = await verifyOtpChallenge({ challengeId: parsed.data.challengeId, code: parsed.data.code, purpose: 'buyer_link_staff' });
		if (r.email !== info.email) return fail(res, 400, 'Kode OTP tidak valid', 'OTP_INVALID');
		const scope = (await (await import('../services/unified-login')).staffScopeFromReq(req)) || 'main';
		const link = { scope, userId: String(info.user._id), linkedAt: new Date() };
		const staffHash = typeof info.user.password === 'string' ? info.user.password : '';
		let c: any = await Customer.findOne({ email: info.email });
		if (c?.status === 'blocked') return fail(res, 403, 'Akun pembeli dengan email ini diblokir. Hubungi admin toko.', 'BUYER_BLOCKED');
		if (c?.linkedStaff?.userId && c.linkedStaff.userId !== link.userId && (await isStaffBound(c))) {
			return fail(res, 409, 'Akun pembeli dengan email ini sudah tertaut ke pengurus lain.', 'LINKED_ELSEWHERE');
		}
		if (!c) {
			c = await Customer.create({ email: info.email, name: cleanName(info.user.name || info.user.username), phone: cleanPhone(info.user.phone), passwordHash: staffHash, emailVerified: true, status: 'active', linkedStaff: link });
		} else {
			// Pemilik email terbukti (OTP): satukan password dengan pengurus, cabut sesi lama
			c.status = 'active';
			c.emailVerified = true;
			c.linkedStaff = link;
			c.passwordHash = staffHash;
			c.tokenVersion = (c.tokenVersion || 0) + 1;
			await c.save();
			await CustomerSession.updateMany({ customerId: c._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
		}
		await endStaffSession(req, res);
		return completeLogin(req, res, c.toObject ? c.toObject() : c, { linked: true });
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

const profileSchema = z.object({
	name: z.string().max(80).optional(),
	phone: z.string().max(30).optional(),
	notifyPrefs: z.object({ orderStatus: z.boolean().optional(), paymentReminders: z.boolean().optional() }).optional(),
});

router.patch('/me', authenticateBuyer, async (req, res) => {
	const parsed = profileSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Data profil tidak valid', 'VALIDATION_ERROR');
	const set: Record<string, unknown> = {};
	if (parsed.data.notifyPrefs?.orderStatus !== undefined) set['notifyPrefs.orderStatus'] = parsed.data.notifyPrefs.orderStatus;
	if (parsed.data.notifyPrefs?.paymentReminders !== undefined) set['notifyPrefs.paymentReminders'] = parsed.data.notifyPrefs.paymentReminders;
	if (parsed.data.name !== undefined) {
		const n = cleanName(parsed.data.name);
		if (!n) return fail(res, 400, 'Nama wajib diisi', 'VALIDATION_ERROR');
		set.name = n;
	}
	if (parsed.data.phone !== undefined) set.phone = cleanPhone(parsed.data.phone);
	const me = await getBuyer(req);
	const c = await Customer.findByIdAndUpdate(me._id, { $set: set }, { new: true }).lean();
	res.json({ success: true, data: { customer: publicCustomer(c) } });
});

// ── Password: minta OTP (lupa password / atur password saat login) lalu reset ──
router.post('/password/otp', authLimiter, async (req, res) => {
	const me = await getBuyer(req);
	const email = me ? me.email : normalizeBuyerEmail(req.body?.email);
	if (!BUYER_EMAIL_RE.test(email)) return fail(res, 400, 'Format email tidak valid', 'EMAIL_INVALID');
	try {
		const c: any = me || (await Customer.findOne({ email, status: 'active' }).lean());
		// Jawaban sama walau email tidak terdaftar (cegah tebak-tebakan email)
		if (!c || c.status !== 'active') return res.json({ success: true, message: GENERIC_OTP_MSG, data: { challengeId: null } });
		// Akun pengurus: password hanya bisa diatur dari dashboard pengurus
		if (await isStaffBound(c)) {
			if (me) return fail(res, 403, STAFF_PASSWORD_MSG, 'STAFF_PASSWORD');
			return res.json({ success: true, message: GENERIC_OTP_MSG, data: { challengeId: null } });
		}
		const { challengeId } = await createOtpChallenge({ purpose: 'buyer_password', email: c.email, userId: String(c._id), ttlMinutes: 10, requestIp: reqIp(req) });
		res.json({ success: true, message: GENERIC_OTP_MSG, data: { challengeId } });
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

const resetSchema = otpVerifySchema.extend({ newPassword: z.string().min(PASSWORD_MIN).max(200) });

router.post('/password/reset', authLimiter, async (req, res) => {
	const parsed = resetSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, `Kode OTP dan password baru (minimal ${PASSWORD_MIN} karakter) wajib diisi`, 'VALIDATION_ERROR');
	try {
		const r = await verifyOtpChallenge({ challengeId: parsed.data.challengeId, code: parsed.data.code, purpose: 'buyer_password' });
		const c: any = r.userId ? await Customer.findById(r.userId) : null;
		if (!c || c.email !== r.email || c.status !== 'active') return fail(res, 400, 'Akun tidak ditemukan', 'BUYER_NOT_FOUND');
		if (await isStaffBound(c)) return fail(res, 403, STAFF_PASSWORD_MSG, 'STAFF_PASSWORD');
		c.passwordHash = await hashPassword(parsed.data.newPassword);
		c.emailVerified = true;
		c.tokenVersion = (c.tokenVersion || 0) + 1; // keluarkan semua sesi lama
		await c.save();
		await CustomerSession.updateMany({ customerId: c._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
		return completeLogin(req, res, c.toObject());
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

// ── Ganti email (OTP ke email baru) ──
router.post('/email/change', authenticateBuyer, authLimiter, async (req, res) => {
	const email = normalizeBuyerEmail(req.body?.newEmail);
	if (!BUYER_EMAIL_RE.test(email)) return fail(res, 400, 'Format email tidak valid', 'EMAIL_INVALID');
	const me = await getBuyer(req);
	if (email === me.email) return fail(res, 400, 'Email baru sama dengan email sekarang', 'EMAIL_SAME');
	if (await isStaffBound(me)) return fail(res, 403, 'Email akun pembeli yang terhubung dengan pengurus mengikuti akun pengurus dan tidak bisa diganti dari sini.', 'STAFF_EMAIL_LOCKED');
	if (await isStaffEmail(email)) return fail(res, 409, STAFF_EMAIL_MSG, 'EMAIL_REGISTERED');
	if (await Customer.exists({ email })) return fail(res, 409, 'Email ini sudah dipakai akun lain', 'EMAIL_REGISTERED');
	try {
		const { challengeId } = await createOtpChallenge({ purpose: 'buyer_email_change', email, userId: String(me._id), ttlMinutes: 10, requestIp: reqIp(req) });
		res.json({ success: true, message: 'Kode verifikasi dikirim ke email baru.', data: { challengeId } });
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

router.post('/email/verify', authenticateBuyer, authLimiter, async (req, res) => {
	const parsed = otpVerifySchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Kode OTP 6 digit wajib diisi', 'VALIDATION_ERROR');
	const me = await getBuyer(req);
	try {
		const ch: any = await OtpChallenge.findById(parsed.data.challengeId).lean();
		if (!ch || String(ch.userId) !== String(me._id)) return fail(res, 400, 'Kode OTP tidak valid', 'OTP_INVALID');
		const r = await verifyOtpChallenge({ challengeId: parsed.data.challengeId, code: parsed.data.code, purpose: 'buyer_email_change' });
		if (await Customer.exists({ email: r.email, _id: { $ne: me._id } })) return fail(res, 409, 'Email ini sudah dipakai akun lain', 'EMAIL_REGISTERED');
		const c: any = await Customer.findByIdAndUpdate(me._id, { $set: { email: r.email, emailVerified: true } }, { new: true }).lean();
		const claimed = await claimOrdersForCustomer(req, c);
		res.json({ success: true, data: { customer: publicCustomer(c), claimedOrders: claimed } });
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

// ── Pesanan saya (semua toko: utama + komunitas aktif) ──
const ORDER_FIELDS =
	'orderNo invoiceAccessToken items subtotal total taxAmount shippingCost fulfillment customerName status createdAt paymentPlan dpAmount amountPaid balanceDue settleBy paymentStatus paymentChannelsSnapshot cancelRequestedAt';

type StoreCtx = { label: string; basePath: string; storePath: string; StoreOrder: any };

async function allStores(): Promise<StoreCtx[]> {
	const out: StoreCtx[] = [];
	const mainSettings: any = await StoreSettings.findOne({}).select('navbarLabel navbarPath').lean();
	out.push({ label: mainSettings?.navbarLabel || 'Encoder Store', basePath: '', storePath: mainSettings?.navbarPath || '/toko', StoreOrder });
	const communities: any[] = await Community.find({ status: 'active' }).select('slug name dbName').lean();
	for (const cm of communities) {
		try {
			const m = getTenantModels(cm.dbName);
			const st: any = await m.StoreSettings.findOne({}).select('navbarLabel navbarPath').lean();
			out.push({ label: st?.navbarLabel ? `${st.navbarLabel} · ${cm.name}` : `Toko ${cm.name}`, basePath: `/${cm.slug}`, storePath: st?.navbarPath || '/toko', StoreOrder: m.StoreOrder });
		} catch {
			/* toko komunitas tanpa DB valid dilewati */
		}
	}
	return out;
}

router.get('/orders', authenticateBuyer, async (req, res) => {
	try {
		const me = await getBuyer(req);
		const stores = await allStores();
		const lists = await Promise.all(
			stores.map(async (st) => {
				const rows: any[] = await st.StoreOrder.find({ buyerId: me._id }).sort({ createdAt: -1 }).limit(100).select(ORDER_FIELDS).lean();
				return rows.map(({ paymentChannelsSnapshot, ...o }) => ({
					...o,
					payOnWeb: Array.isArray(paymentChannelsSnapshot) && paymentChannelsSnapshot.length > 0,
					store: { label: st.label, basePath: st.basePath },
					invoicePath: `${st.basePath}${st.storePath}/order/${encodeURIComponent(o.orderNo)}?inv=${encodeURIComponent(o.invoiceAccessToken || '')}`,
				}));
			}),
		);
		const items = lists.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		res.json({ success: true, data: items });
	} catch (e) {
		console.error('[buyer] orders', e);
		fail(res, 500, 'Gagal memuat pesanan', 'INTERNAL');
	}
});

/** Tambah pesanan lama ke akun memakai link invoice (bukti kepemilikan: nomor pesanan + token inv). */
router.post('/orders/claim', authenticateBuyer, authLimiter, async (req, res) => {
	const raw = String(req.body?.link || '').trim().slice(0, 600);
	let orderNo = String(req.body?.orderNo || '').trim();
	let inv = String(req.body?.inv || '').trim();
	if (raw) {
		try {
			const u = new URL(raw, 'https://x.invalid');
			const m = u.pathname.match(/\/order\/([^/?#]+)/);
			if (m) orderNo = decodeURIComponent(m[1]);
			inv = u.searchParams.get('inv') || inv;
		} catch {
			/* format link salah → validasi di bawah */
		}
	}
	if (!orderNo || inv.length < 32) return fail(res, 400, 'Tempel link invoice lengkap (berisi ?inv=...)', 'VALIDATION_ERROR');
	const me = await getBuyer(req);
	for (const st of await allStores()) {
		const o: any = await st.StoreOrder.findOne({ orderNo, invoiceAccessToken: inv }).select('buyerId').lean();
		if (!o) continue;
		if (o.buyerId && String(o.buyerId) !== String(me._id)) return fail(res, 409, 'Pesanan ini sudah tersimpan di akun lain', 'ORDER_OWNED');
		await st.StoreOrder.updateOne({ _id: o._id, buyerId: null }, { $set: { buyerId: me._id } });
		return res.json({ success: true, message: 'Pesanan ditambahkan ke akun' });
	}
	return fail(res, 404, 'Pesanan tidak ditemukan. Pastikan link invoice benar.', 'ORDER_NOT_FOUND');
});

// ── Alamat tersimpan (maks 5, satu default) ──
const MAX_ADDRESSES = 5;
const addressSchema = z.object({
	id: z.string().max(40).optional(),
	label: z.string().max(40).optional(),
	recipient: z.string().max(80).optional(),
	phone: z.string().max(30).optional(),
	address: z.string().min(5).max(500),
	isDefault: z.boolean().optional(),
});

router.get('/addresses', authenticateBuyer, async (req, res) => {
	const me = await getBuyer(req);
	res.json({ success: true, data: me.addresses || [] });
});

router.put('/addresses', authenticateBuyer, async (req, res) => {
	const parsed = z.object({ addresses: z.array(addressSchema).max(MAX_ADDRESSES) }).safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, `Alamat tidak valid (maks ${MAX_ADDRESSES}, alamat minimal 5 karakter)`, 'VALIDATION_ERROR');
	const list = parsed.data.addresses.map((a) => ({
		id: a.id && /^[\w-]{4,40}$/.test(a.id) ? a.id : crypto.randomBytes(6).toString('hex'),
		label: String(a.label || '').trim().slice(0, 40),
		recipient: cleanName(a.recipient),
		phone: cleanPhone(a.phone),
		address: String(a.address).trim().slice(0, 500),
		isDefault: !!a.isDefault,
	}));
	// Tepat satu default bila ada alamat
	const firstDefault = list.findIndex((a) => a.isDefault);
	list.forEach((a, i) => (a.isDefault = i === (firstDefault >= 0 ? firstDefault : 0)));
	const me = await getBuyer(req);
	const c = await Customer.findByIdAndUpdate(me._id, { $set: { addresses: list } }, { new: true }).lean();
	res.json({ success: true, data: (c as any)?.addresses || [] });
});

// ── Favorit per toko (main / slug komunitas) ──
const storeKey = (v: unknown) => {
	const k = String(v || 'main').trim().toLowerCase();
	return /^[a-z0-9_-]{1,60}$/.test(k) ? k : 'main';
};

router.get('/favorites', authenticateBuyer, async (req, res) => {
	const me = await getBuyer(req);
	const key = storeKey(req.query.store);
	const row = (me.favorites || []).find((f: any) => f.store === key);
	res.json({ success: true, data: row?.productIds || [] });
});

router.put('/favorites', authenticateBuyer, async (req, res) => {
	const parsed = z.object({ store: z.string().max(60).optional(), productIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(200) }).safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Daftar favorit tidak valid', 'VALIDATION_ERROR');
	const key = storeKey(parsed.data.store);
	const ids = Array.from(new Set(parsed.data.productIds.map((x) => x.toLowerCase())));
	const me = await getBuyer(req);
	await Customer.updateOne({ _id: me._id }, { $pull: { favorites: { store: key } } });
	await Customer.updateOne({ _id: me._id }, { $push: { favorites: { store: key, productIds: ids } } });
	res.json({ success: true, data: ids });
});

// ── Hapus akun (konfirmasi OTP email) ──
// Data pribadi dianonimkan; pesanan tetap ada untuk pembukuan toko (data pemesan di pesanan tidak diubah).
router.post('/delete/otp', authenticateBuyer, authLimiter, async (req, res) => {
	const me = await getBuyer(req);
	try {
		const { challengeId } = await createOtpChallenge({ purpose: 'buyer_delete', email: me.email, userId: String(me._id), ttlMinutes: 10, requestIp: reqIp(req) });
		res.json({ success: true, message: 'Kode konfirmasi dikirim ke email akun.', data: { challengeId } });
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

router.post('/delete', authenticateBuyer, authLimiter, async (req, res) => {
	const parsed = otpVerifySchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Kode OTP 6 digit wajib diisi', 'VALIDATION_ERROR');
	const me = await getBuyer(req);
	try {
		const ch: any = await OtpChallenge.findById(parsed.data.challengeId).lean();
		if (!ch || String(ch.userId) !== String(me._id)) return fail(res, 400, 'Kode OTP tidak valid', 'OTP_INVALID');
		await verifyOtpChallenge({ challengeId: parsed.data.challengeId, code: parsed.data.code, purpose: 'buyer_delete' });
		await Customer.updateOne(
			{ _id: me._id },
			{
				$set: {
					email: `deleted-${String(me._id)}@deleted.invalid`,
					emailVerified: false,
					passwordHash: '',
					name: '',
					phone: '',
					addresses: [],
					favorites: [],
					status: 'deleted',
				},
				$unset: { googleSub: 1 },
				$inc: { tokenVersion: 1 },
			},
		);
		await CustomerSession.updateMany({ customerId: me._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
		await endBuyerSession(req, res);
		res.json({ success: true, message: 'Akun dihapus' });
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

// ── Sesi aktif ──
router.get('/sessions', authenticateBuyer, async (req, res) => {
	const me = await getBuyer(req);
	const sid = currentBuyerSid(req);
	const rows: any[] = await CustomerSession.find({ customerId: me._id, revokedAt: null }).sort({ lastActive: -1 }).limit(20).lean();
	res.json({
		success: true,
		data: rows.map((s) => ({
			id: String(s._id),
			device: s.device,
			userAgent: s.userAgent,
			ip: s.ip || '',
			location: s.location || '',
			lastActive: s.lastActive,
			createdAt: s.createdAt,
			current: s.sessionId === sid,
		})),
	});
});

router.delete('/sessions/:id', authenticateBuyer, async (req, res) => {
	const me = await getBuyer(req);
	await CustomerSession.updateOne({ _id: req.params.id, customerId: me._id }, { $set: { revokedAt: new Date() } }).catch(() => null);
	res.json({ success: true });
});

/** Keluar dari semua perangkat lain. */
router.post('/sessions/revoke-others', authenticateBuyer, async (req, res) => {
	const me = await getBuyer(req);
	const sid = currentBuyerSid(req);
	await CustomerSession.updateMany({ customerId: me._id, revokedAt: null, sessionId: { $ne: sid } }, { $set: { revokedAt: new Date() } });
	res.json({ success: true });
});

export default router;
