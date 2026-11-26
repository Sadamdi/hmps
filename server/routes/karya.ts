/**
 * API Karya Mahasiswa TI — /api/karya/*
 *
 * Tiga pintu, tiga lapis izin:
 *  - /auth/* dan /me/*   : akun mahasiswa (cookie `studentToken`, lihat services/karya-auth.ts)
 *  - /public/*           : siapa saja; HANYA karya publik + disetujui milik akun aktif
 *  - /admin/*            : pengurus dengan permission `karya.view` / `karya.manage`
 *
 * Semua kepemilikan diambil dari sesi server (studentId), tidak pernah dari input client.
 * Fitur ini hanya untuk situs utama (bukan tenant komunitas).
 */
import crypto from 'crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { OtpChallenge } from '../../db/mongodb';
import { authenticate, hashPassword, requirePermission, verifyPassword } from '../auth';
import { getRealClientIp } from '../lib/geoip';
import { logLoginAttempt } from '../models/login-attempt';
import { logActivity } from '../models/activity';
import { accountLockRemaining, recordAccountLoginFailure, resetAccountLoginFailures } from '../middleware/account-login-throttle';
import { createPublicRateLimiter } from '../middleware/public-rate-limit';
import { createOtpChallenge, verifyOtpChallenge, OtpError, RateLimitError } from '../services/otp';
import { getKaryaSettings, KaryaProject, KaryaSettings, KaryaShortlink, KaryaStudent, KaryaStudentSession } from '../models/karya';
import {
	authenticateStudent,
	checkStudentEmail,
	currentStudentSid,
	endStudentSession,
	getStudent,
	normalizeStudentEmail,
	ownStudent,
	startStudentSession,
	studentAccessBlock,
	uniqueUsername,
	validUsername,
} from '../services/karya-auth';
import { fetchPublicRepo, isDrivePublic, RepoFetchError } from '../services/karya-repo';
import { deleteKaryaMediaFile, karyaMediaMiddleware, uploadKaryaMedia } from '../upload';
import {
	angkatanFromNim,
	classifyKaryaLink,
	cleanHttpsUrl,
	cleanKaryaTags,
	cleanSocialLinks,
	gdriveFileIdFromUrl,
	KARYA_CATEGORIES,
	KARYA_LIMITS,
	KARYA_NOT_ELIGIBLE_MESSAGE,
	karyaSlugify,
	parseRepoUrl,
	validShortlinkSlug,
	youtubeIdFromUrl,
	type KaryaProjectCard,
	type KaryaStudentPublic,
} from '../../shared/karya';

const router = Router();

const authLimiter = createPublicRateLimiter('karya-auth', [
	{ windowMs: 10 * 60_000, maxPerIp: 30, maxPerDevice: 15, label: '10 menit' },
	{ windowMs: 24 * 60 * 60_000, maxPerIp: 300, maxPerDevice: 100, label: '1 hari' },
]);
const writeLimiter = createPublicRateLimiter('karya-write', [
	{ windowMs: 10 * 60_000, maxPerIp: 120, maxPerDevice: 80, label: '10 menit' },
]);
const repoLimiter = createPublicRateLimiter('karya-repo', [
	{ windowMs: 10 * 60_000, maxPerIp: 30, maxPerDevice: 20, label: '10 menit' },
]);
const publicLimiter = createPublicRateLimiter('karya-public', [
	{ windowMs: 60_000, maxPerIp: 120, maxPerDevice: 120, label: '1 menit' },
]);

const PASSWORD_MIN = 8;
const fail = (res: Response, status: number, message: string, code: string, details?: unknown) =>
	res.status(status).json({ success: false, message, error: { code, ...(details ? { details } : {}) } });
const ok = (res: Response, data: unknown, message = 'OK', meta?: unknown) =>
	res.json({ success: true, message, data, ...(meta ? { meta } : {}) });
const reqIp = (req: Request) => String(getRealClientIp(req) || (req as any).ip || '').slice(0, 64);
const cleanText = (v: unknown, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const cleanName = (v: unknown) => cleanText(v, 80).replace(/\s+/g, ' ');
const isId = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{24}$/.test(v);

function otpErrorResponse(res: Response, e: unknown) {
	if (e instanceof RateLimitError) return res.status(429).json({ success: false, message: e.message, retryAfterSeconds: e.retryAfterSeconds, error: { code: 'RATE_LIMITED' } });
	if (e instanceof OtpError) return fail(res, 400, e.message, 'OTP_INVALID');
	console.error('[karya]', e);
	return fail(res, 500, 'Terjadi kesalahan. Coba lagi.', 'INTERNAL');
}

const notEligible = (res: Response) => fail(res, 403, KARYA_NOT_ELIGIBLE_MESSAGE, 'NOT_TI_STUDENT');

/** Fitur dimatikan admin → semua endpoint mahasiswa & publik ditutup (admin tetap bisa). */
async function requireEnabled(_req: Request, res: Response, next: NextFunction) {
	const s = await getKaryaSettings();
	if (!s.enabled) return fail(res, 503, 'Fitur Karya Mahasiswa sedang dinonaktifkan oleh administrator.', 'KARYA_DISABLED');
	next();
}

async function completeLogin(req: Request, res: Response, student: any, extra: Record<string, unknown> = {}) {
	await startStudentSession(req, res, student);
	const fresh = await KaryaStudent.findById(student._id).lean();
	return ok(res, { student: ownStudent(fresh), ...extra }, 'Berhasil masuk');
}

// ═════════════════════════════ AUTH ═════════════════════════════

router.get('/auth/config', async (_req, res) => {
	const s = await getKaryaSettings();
	const { googleLoginEnabled } = await import('../services/google-login');
	ok(res, {
		enabled: s.enabled,
		registrationOpen: s.registrationOpen,
		reviewMode: s.reviewMode,
		uploadsEnabled: s.uploadsEnabled,
		shortlinkReview: s.shortlinkReview,
		googleEnabled: googleLoginEnabled(),
		limits: KARYA_LIMITS,
		categories: KARYA_CATEGORIES,
	});
});

const registerSchema = z.object({
	name: z.string().min(1).max(80),
	email: z.string().min(5).max(200),
	password: z.string().min(PASSWORD_MIN).max(200),
});

router.post('/auth/register', requireEnabled, authLimiter, async (req, res) => {
	const parsed = registerSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, `Lengkapi nama, email, dan password (minimal ${PASSWORD_MIN} karakter)`, 'VALIDATION_ERROR');
	const settings = await getKaryaSettings();
	if (!settings.registrationOpen) return fail(res, 403, 'Pendaftaran akun mahasiswa sedang ditutup administrator.', 'REGISTRATION_CLOSED');
	const email = normalizeStudentEmail(parsed.data.email);
	const elig = checkStudentEmail(email);
	if (!elig.ok) return notEligible(res);
	try {
		let s: any = await KaryaStudent.findOne({ email });
		if (s && s.status !== 'pending') return fail(res, 409, 'Email ini sudah terdaftar. Silakan masuk, atau pakai "Lupa password".', 'EMAIL_REGISTERED');
		const fields = { name: cleanName(parsed.data.name), passwordHash: await hashPassword(parsed.data.password), nim: elig.nim, verifiedTi: true };
		if (s) await KaryaStudent.updateOne({ _id: s._id }, { $set: fields });
		else s = await KaryaStudent.create({ email, status: 'pending', emailVerified: false, username: await uniqueUsername(elig.nim), ...fields });
		const { challengeId } = await createOtpChallenge({ purpose: 'karya_register', email, userId: String(s._id), ttlMinutes: 10, requestIp: reqIp(req) });
		ok(res, { challengeId, email }, 'Kode verifikasi dikirim ke email kampusmu.');
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

const otpVerifySchema = z.object({ challengeId: z.string().min(10).max(64), code: z.string().regex(/^\d{6}$/) });

router.post('/auth/register/verify', requireEnabled, authLimiter, async (req, res) => {
	const parsed = otpVerifySchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Kode OTP 6 digit wajib diisi', 'VALIDATION_ERROR');
	try {
		const r = await verifyOtpChallenge({ challengeId: parsed.data.challengeId, code: parsed.data.code, purpose: 'karya_register' });
		const s: any = r.userId ? await KaryaStudent.findById(r.userId) : null;
		if (!s || s.email !== r.email) return fail(res, 400, 'Pendaftaran tidak ditemukan. Daftar ulang.', 'REGISTRATION_NOT_FOUND');
		const block = studentAccessBlock(s);
		if (block) return fail(res, block.status, block.message, block.code);
		s.emailVerified = true;
		if (s.status === 'pending') s.status = 'active';
		await s.save();
		return completeLogin(req, res, s.toObject(), { created: true });
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

const loginSchema = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) });

router.post('/auth/login', requireEnabled, authLimiter, async (req, res) => {
	const parsed = loginSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Email dan password wajib diisi', 'VALIDATION_ERROR');
	const email = normalizeStudentEmail(parsed.data.email);
	const ip = getRealClientIp(req);
	const throttleKey = `student:${email}:${ip}`;
	const globalKey = `student-all:${email}`;
	const lockedFor = Math.max(accountLockRemaining(throttleKey), accountLockRemaining(globalKey));
	if (lockedFor > 0) {
		void logLoginAttempt({ ip, email, success: false, reason: 'locked', scope: 'student' });
		return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan login. Coba lagi nanti.', retryAfter: lockedFor, error: { code: 'ACCOUNT_LOGIN_THROTTLED' } });
	}
	const s: any = await KaryaStudent.findOne({ email }).lean();
	const passOk = !!s?.passwordHash && (await verifyPassword(parsed.data.password, s.passwordHash));
	if (!s || !passOk) {
		recordAccountLoginFailure(throttleKey);
		recordAccountLoginFailure(globalKey);
		void logLoginAttempt({ ip, email, success: false, reason: s ? 'invalid_password' : 'not_found', scope: 'student' });
		// Email di luar UIN/TI dan belum punya akun → beri tahu aturan aksesnya (bukan rahasia)
		if (!s && !checkStudentEmail(email).ok) return notEligible(res);
		return fail(res, 401, 'Email atau password salah', 'INVALID_CREDENTIALS');
	}
	resetAccountLoginFailures(throttleKey);
	const block = studentAccessBlock(s);
	if (block) return fail(res, block.status, block.message, block.code);
	if (s.status !== 'active' || !s.emailVerified) return fail(res, 403, 'Email belum diverifikasi. Daftar ulang untuk menerima kode verifikasi.', 'EMAIL_UNVERIFIED');
	void logLoginAttempt({ ip, email, success: true, reason: 'success', userId: s._id, scope: 'student' });
	return completeLogin(req, res, s);
});

const googleSchema = z.object({ idToken: z.string().min(10).max(8192) });

async function verifyGoogle(res: Response, idToken: string) {
	const { verifyGoogleIdToken, GoogleLoginError } = await import('../services/google-login');
	try {
		return await verifyGoogleIdToken(idToken);
	} catch (err) {
		if (err instanceof GoogleLoginError) fail(res, err.code === 'GOOGLE_LOGIN_DISABLED' ? 503 : 401, err.message, err.code);
		else fail(res, 500, 'Gagal memverifikasi login Google', 'INTERNAL');
		return null;
	}
}

router.post('/auth/google', requireEnabled, authLimiter, async (req, res) => {
	const parsed = googleSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Permintaan login Google tidak valid', 'VALIDATION_ERROR');
	const g = await verifyGoogle(res, parsed.data.idToken);
	if (!g) return;
	try {
		const email = normalizeStudentEmail(g.email);
		const s: any = (await KaryaStudent.findOne({ googleSub: g.uid })) || (await KaryaStudent.findOne({ email }));
		if (s && s.status !== 'pending' && s.status !== 'deleted') {
			const block = studentAccessBlock(s);
			if (block) return fail(res, block.status, block.message, block.code);
			if (!s.googleSub) s.googleSub = g.uid;
			s.emailVerified = true;
			await s.save();
			void logLoginAttempt({ ip: getRealClientIp(req), email, success: true, reason: 'success', userId: s._id, scope: 'student' });
			return completeLogin(req, res, s.toObject());
		}
		// Belum punya akun: hanya email mahasiswa TI yang boleh lanjut onboarding
		if (!checkStudentEmail(email).ok) return notEligible(res);
		const settings = await getKaryaSettings();
		if (!settings.registrationOpen) return fail(res, 403, 'Pendaftaran akun mahasiswa sedang ditutup administrator.', 'REGISTRATION_CLOSED');
		return ok(res, { needsOnboarding: true, email, name: cleanName(g.name) });
	} catch (e) {
		console.error('[karya] google', e);
		return fail(res, 500, 'Login Google gagal. Coba lagi.', 'INTERNAL');
	}
});

const googleCompleteSchema = z.object({
	idToken: z.string().min(10).max(8192),
	name: z.string().min(1).max(80),
	password: z.string().min(PASSWORD_MIN).max(200),
	confirmPassword: z.string().min(1).max(200),
});

router.post('/auth/google/complete', requireEnabled, authLimiter, async (req, res) => {
	const parsed = googleCompleteSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, `Lengkapi nama dan password (minimal ${PASSWORD_MIN} karakter)`, 'VALIDATION_ERROR');
	if (parsed.data.password !== parsed.data.confirmPassword) return fail(res, 400, 'Konfirmasi password tidak sama', 'PASSWORD_MISMATCH');
	const g = await verifyGoogle(res, parsed.data.idToken);
	if (!g) return;
	try {
		const email = normalizeStudentEmail(g.email); // selalu dari Google, bukan dari client
		const elig = checkStudentEmail(email);
		if (!elig.ok) return notEligible(res);
		const settings = await getKaryaSettings();
		if (!settings.registrationOpen) return fail(res, 403, 'Pendaftaran akun mahasiswa sedang ditutup administrator.', 'REGISTRATION_CLOSED');
		const existing: any = (await KaryaStudent.findOne({ googleSub: g.uid })) || (await KaryaStudent.findOne({ email }));
		if (existing && existing.status !== 'pending' && existing.status !== 'deleted') return fail(res, 409, 'Akun sudah ada. Silakan masuk.', 'EMAIL_REGISTERED');
		const fields = {
			email,
			emailVerified: true,
			status: 'active' as const,
			googleSub: g.uid,
			nim: elig.nim,
			verifiedTi: true,
			name: cleanName(parsed.data.name),
			passwordHash: await hashPassword(parsed.data.password),
		};
		const s: any = existing
			? await KaryaStudent.findOneAndUpdate({ _id: existing._id }, { $set: fields }, { new: true })
			: await KaryaStudent.create({ ...fields, username: await uniqueUsername(elig.nim) });
		return completeLogin(req, res, s.toObject ? s.toObject() : s, { created: true });
	} catch (e) {
		console.error('[karya] google complete', e);
		return fail(res, 500, 'Gagal membuat akun. Coba lagi.', 'INTERNAL');
	}
});

router.post('/auth/logout', async (req, res) => {
	await endStudentSession(req, res);
	ok(res, null, 'Berhasil keluar');
});

router.get('/auth/me', async (req, res) => {
	const s = await getStudent(req);
	ok(res, { student: s ? ownStudent(s) : null });
});

// ── Password: lupa password (OTP) ──
const GENERIC_OTP_MSG = 'Jika email terdaftar, kode OTP sudah dikirim ke email tersebut.';

router.post('/auth/password/otp', requireEnabled, authLimiter, async (req, res) => {
	const me = await getStudent(req);
	const email = me ? me.email : normalizeStudentEmail(req.body?.email);
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(res, 400, 'Format email tidak valid', 'EMAIL_INVALID');
	try {
		const s: any = me || (await KaryaStudent.findOne({ email, status: 'active' }).lean());
		if (!s || s.status !== 'active' || studentAccessBlock(s)) return ok(res, { challengeId: null }, GENERIC_OTP_MSG);
		const { challengeId } = await createOtpChallenge({ purpose: 'karya_password', email: s.email, userId: String(s._id), ttlMinutes: 10, requestIp: reqIp(req) });
		ok(res, { challengeId }, GENERIC_OTP_MSG);
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

const resetSchema = otpVerifySchema.extend({ newPassword: z.string().min(PASSWORD_MIN).max(200) });

router.post('/auth/password/reset', requireEnabled, authLimiter, async (req, res) => {
	const parsed = resetSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, `Kode OTP dan password baru (minimal ${PASSWORD_MIN} karakter) wajib diisi`, 'VALIDATION_ERROR');
	try {
		const r = await verifyOtpChallenge({ challengeId: parsed.data.challengeId, code: parsed.data.code, purpose: 'karya_password' });
		const s: any = r.userId ? await KaryaStudent.findById(r.userId) : null;
		if (!s || s.email !== r.email || s.status !== 'active') return fail(res, 400, 'Akun tidak ditemukan', 'STUDENT_NOT_FOUND');
		const block = studentAccessBlock(s);
		if (block) return fail(res, block.status, block.message, block.code);
		s.passwordHash = await hashPassword(parsed.data.newPassword);
		s.emailVerified = true;
		s.tokenVersion = (s.tokenVersion || 0) + 1; // keluarkan semua sesi lama
		await s.save();
		await KaryaStudentSession.updateMany({ studentId: s._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
		return completeLogin(req, res, s.toObject());
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

// ── Ganti password saat login (pakai password lama) ──
const changePwSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(PASSWORD_MIN).max(200) });

router.post('/auth/password/change', authenticateStudent, authLimiter, async (req, res) => {
	const parsed = changePwSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, `Password baru minimal ${PASSWORD_MIN} karakter`, 'VALIDATION_ERROR');
	const me: any = await getStudent(req);
	const s: any = await KaryaStudent.findById(me._id);
	if (!s?.passwordHash || !(await verifyPassword(parsed.data.currentPassword, s.passwordHash))) {
		return fail(res, 400, 'Password lama salah. Belum punya password? Pakai "Atur password lewat email".', 'INVALID_PASSWORD');
	}
	s.passwordHash = await hashPassword(parsed.data.newPassword);
	s.tokenVersion = (s.tokenVersion || 0) + 1;
	await s.save();
	await KaryaStudentSession.updateMany({ studentId: s._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
	return completeLogin(req, res, s.toObject(), { passwordChanged: true });
});

// ── Sesi aktif ──
router.get('/auth/sessions', authenticateStudent, async (req, res) => {
	const me = await getStudent(req);
	const sid = currentStudentSid(req);
	const rows: any[] = await KaryaStudentSession.find({ studentId: me._id, revokedAt: null }).sort({ lastActive: -1 }).limit(20).lean();
	ok(
		res,
		rows.map((s) => ({ id: String(s._id), device: s.device, userAgent: s.userAgent, ip: s.ip || '', location: s.location || '', lastActive: s.lastActive, createdAt: s.createdAt, current: s.sessionId === sid })),
	);
});

router.delete('/auth/sessions/:id', authenticateStudent, async (req, res) => {
	const me = await getStudent(req);
	if (!isId(req.params.id)) return fail(res, 400, 'ID sesi tidak valid', 'VALIDATION_ERROR');
	await KaryaStudentSession.updateOne({ _id: req.params.id, studentId: me._id }, { $set: { revokedAt: new Date() } });
	ok(res, null, 'Sesi dicabut');
});

router.post('/auth/sessions/revoke-others', authenticateStudent, async (req, res) => {
	const me = await getStudent(req);
	await KaryaStudentSession.updateMany({ studentId: me._id, revokedAt: null, sessionId: { $ne: currentStudentSid(req) } }, { $set: { revokedAt: new Date() } });
	ok(res, null, 'Semua perangkat lain dikeluarkan');
});

// ── Hapus akun (OTP) ──
router.post('/auth/delete/otp', authenticateStudent, authLimiter, async (req, res) => {
	const me = await getStudent(req);
	try {
		const { challengeId } = await createOtpChallenge({ purpose: 'karya_delete', email: me.email, userId: String(me._id), ttlMinutes: 10, requestIp: reqIp(req) });
		ok(res, { challengeId }, 'Kode konfirmasi dikirim ke email akun.');
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

router.post('/auth/delete', authenticateStudent, authLimiter, async (req, res) => {
	const parsed = otpVerifySchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Kode OTP 6 digit wajib diisi', 'VALIDATION_ERROR');
	const me = await getStudent(req);
	try {
		const ch: any = await OtpChallenge.findById(parsed.data.challengeId).lean();
		if (!ch || String(ch.userId) !== String(me._id)) return fail(res, 400, 'Kode OTP tidak valid', 'OTP_INVALID');
		await verifyOtpChallenge({ challengeId: parsed.data.challengeId, code: parsed.data.code, purpose: 'karya_delete' });
		await purgeStudent(me._id);
		await endStudentSession(req, res);
		ok(res, null, 'Akun dan semua karya dihapus');
	} catch (e) {
		otpErrorResponse(res, e);
	}
});

/** Hapus semua karya + file + shortlink, anonimkan akun. */
async function purgeStudent(studentId: any): Promise<void> {
	const id = String(studentId);
	const projects: any[] = await KaryaProject.find({ studentId }).select('media').lean();
	for (const p of projects) for (const m of p.media || []) await deleteKaryaMediaFile(m.url, id);
	const s: any = await KaryaStudent.findById(studentId).select('avatarUrl').lean();
	if (s?.avatarUrl) await deleteKaryaMediaFile(s.avatarUrl, id);
	await KaryaProject.deleteMany({ studentId });
	await KaryaShortlink.deleteMany({ studentId });
	await KaryaStudent.updateOne(
		{ _id: studentId },
		{
			$set: {
				email: `deleted-${id}@deleted.invalid`,
				username: `deleted-${id}`,
				emailVerified: false,
				passwordHash: '',
				name: '',
				headline: '',
				bio: '',
				avatarUrl: '',
				skills: [],
				social: {},
				nim: '',
				status: 'deleted',
				storageUsedBytes: 0,
			},
			$unset: { googleSub: 1 },
			$inc: { tokenVersion: 1 },
		},
	);
	await KaryaStudentSession.updateMany({ studentId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

// ═════════════════════════════ PROFIL MAHASISWA ═════════════════════════════

const profileSchema = z.object({
	name: z.string().max(80).optional(),
	username: z.string().max(30).optional(),
	headline: z.string().max(120).optional(),
	bio: z.string().max(1200).optional(),
	skills: z.array(z.string().max(30)).max(KARYA_LIMITS.maxSkills).optional(),
	social: z.record(z.string(), z.string().max(500)).optional(),
	profilePublic: z.boolean().optional(),
});

router.patch('/me/profile', requireEnabled, authenticateStudent, writeLimiter, async (req, res) => {
	const parsed = profileSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Data profil tidak valid', 'VALIDATION_ERROR');
	const me = await getStudent(req);
	const d = parsed.data;
	const set: Record<string, unknown> = {};
	if (d.name !== undefined) {
		const n = cleanName(d.name);
		if (!n) return fail(res, 400, 'Nama wajib diisi', 'VALIDATION_ERROR');
		set.name = n;
	}
	if (d.username !== undefined) {
		const u = String(d.username).trim().toLowerCase();
		if (!validUsername(u)) return fail(res, 400, 'Username 3–30 karakter: huruf kecil, angka, dan tanda minus.', 'USERNAME_INVALID');
		if (u !== me.username && (await KaryaStudent.exists({ username: u, _id: { $ne: me._id } }))) return fail(res, 409, 'Username sudah dipakai', 'USERNAME_TAKEN');
		set.username = u;
	}
	if (d.headline !== undefined) set.headline = cleanText(d.headline, 120);
	if (d.bio !== undefined) set.bio = cleanText(d.bio, 1200);
	if (d.skills !== undefined) set.skills = cleanKaryaTags(d.skills, KARYA_LIMITS.maxSkills);
	if (d.social !== undefined) set.social = cleanSocialLinks(d.social);
	if (d.profilePublic !== undefined) set.profilePublic = d.profilePublic;
	const s = await KaryaStudent.findByIdAndUpdate(me._id, { $set: set }, { new: true }).lean();
	ok(res, { student: ownStudent(s) }, 'Profil disimpan');
});

/** Multer + tangkap error ukuran file dengan pesan yang jelas. */
function karyaUpload(req: Request, res: Response, next: NextFunction) {
	karyaMediaMiddleware.single('file')(req, res, (err: any) => {
		if (!err) return next();
		if (err?.code === 'LIMIT_FILE_SIZE') return fail(res, 413, 'File terlalu besar. Video maks 30 MB, gambar maks 5 MB.', 'FILE_TOO_LARGE');
		return fail(res, 400, 'Upload gagal', 'UPLOAD_FAILED');
	});
}

async function remainingQuota(studentId: any): Promise<number> {
	const s: any = await KaryaStudent.findById(studentId).select('storageUsedBytes').lean();
	return KARYA_LIMITS.quotaBytesPerStudent - (s?.storageUsedBytes || 0);
}

router.post('/me/avatar', requireEnabled, authenticateStudent, writeLimiter, karyaUpload, async (req, res) => {
	const me = await getStudent(req);
	const file = (req as any).file as Express.Multer.File | undefined;
	if (!file) return fail(res, 400, 'Pilih file gambar', 'VALIDATION_ERROR');
	if (file.size > KARYA_LIMITS.maxImageBytes) return fail(res, 413, 'Foto profil maks 5 MB', 'FILE_TOO_LARGE');
	try {
		const up = await uploadKaryaMedia(file, String(me._id), { avatar: true });
		const old = me.avatarUrl;
		const delta = up.size - (me.avatarSize || 0);
		await KaryaStudent.updateOne({ _id: me._id }, { $set: { avatarUrl: up.url, avatarSize: up.size }, $inc: { storageUsedBytes: delta } });
		if (old) await deleteKaryaMediaFile(old, String(me._id));
		const s = await KaryaStudent.findById(me._id).lean();
		ok(res, { student: ownStudent(s) }, 'Foto profil diperbarui');
	} catch (e) {
		fail(res, 400, (e as Error).message || 'Upload gagal', 'UPLOAD_FAILED');
	}
});

// ═════════════════════════════ KARYA MILIK SENDIRI ═════════════════════════════

function ownProject(p: any) {
	return {
		id: String(p._id),
		slug: p.slug,
		title: p.title,
		summary: p.summary || '',
		description: p.description || '',
		role: p.role || '',
		category: p.category || 'lainnya',
		tags: p.tags || [],
		year: p.year || null,
		repos: p.repos || [],
		links: p.links || [],
		media: p.media || [],
		coverMediaId: p.coverMediaId || '',
		related: p.related || [],
		visibility: p.visibility,
		status: p.status,
		reviewNote: p.reviewNote || '',
		featured: !!p.featured,
		viewCount: p.viewCount || 0,
		publishedAt: p.publishedAt,
		submittedAt: p.submittedAt,
		createdAt: p.createdAt,
		updatedAt: p.updatedAt,
	};
}

async function uniqueProjectSlug(title: string, excludeId?: unknown): Promise<string> {
	const base = karyaSlugify(title) || `karya-${crypto.randomBytes(3).toString('hex')}`;
	let slug = base;
	for (let i = 0; i < 20; i++) {
		const q: any = { slug };
		if (excludeId) q._id = { $ne: excludeId };
		if (!(await KaryaProject.exists(q))) return slug;
		slug = `${base}-${crypto.randomBytes(2).toString('hex')}`;
	}
	return `${base}-${Date.now().toString(36)}`;
}

const linkInput = z.object({ url: z.string().max(500), label: z.string().max(80).optional() });
const relatedInput = z.object({ projectSlug: z.string().max(100).optional(), url: z.string().max(500).optional(), label: z.string().max(100).optional() });
const projectSchema = z.object({
	title: z.string().min(3).max(120),
	summary: z.string().max(240).optional(),
	description: z.string().max(8000).optional(),
	role: z.string().max(300).optional(),
	category: z.string().max(30).optional(),
	tags: z.union([z.array(z.string().max(40)), z.string().max(400)]).optional(),
	year: z.number().int().min(2000).max(2100).nullable().optional(),
	repoUrls: z.array(z.string().max(300)).max(5).optional(),
	links: z.array(linkInput).max(KARYA_LIMITS.maxLinksPerProject).optional(),
	related: z.array(relatedInput).max(KARYA_LIMITS.maxRelatedPerProject).optional(),
	coverMediaId: z.string().max(40).optional(),
	mediaCaptions: z.record(z.string(), z.string().max(160)).optional(),
	visibility: z.enum(['public', 'private']).optional(),
	/** draft = simpan saja; submit = terbitkan (publik → review/otomatis) */
	action: z.enum(['draft', 'submit']).optional(),
});

/** Validasi + normalisasi isi karya. Mengembalikan error string bila gagal. */
async function buildProjectFields(d: z.infer<typeof projectSchema>, studentId: any, existing: any | null): Promise<{ fields: Record<string, unknown> } | { error: string; code: string }> {
	const f: Record<string, unknown> = {
		title: cleanText(d.title, 120),
		summary: cleanText(d.summary, 240),
		description: cleanText(d.description, 8000),
		role: cleanText(d.role, 300),
		category: KARYA_CATEGORIES.some((c) => c.id === d.category) ? d.category : 'lainnya',
		tags: cleanKaryaTags(d.tags),
		year: d.year ?? null,
	};
	// Repo: wajib publik; info diambil server
	if (d.repoUrls) {
		const repos = [];
		for (const raw of d.repoUrls.map((u) => u.trim()).filter(Boolean)) {
			try {
				repos.push(await fetchPublicRepo(raw));
			} catch (e) {
				if (e instanceof RepoFetchError) {
					// Gagal sementara: pakai data lama bila repo yang sama sudah tersimpan
					const prev = (existing?.repos || []).find((r: any) => r.url?.toLowerCase() === raw.toLowerCase().replace(/\.git$/, '').replace(/\/$/, ''));
					if (prev && (e.code === 'REPO_RATE_LIMITED' || e.code === 'REPO_FETCH_FAILED')) {
						repos.push(prev);
						continue;
					}
					return { error: `${raw}: ${e.message}`, code: e.code };
				}
				throw e;
			}
		}
		f.repos = repos;
	}
	if (d.links) {
		const links = [];
		for (const l of d.links) {
			const url = cleanHttpsUrl(l.url);
			if (!url) return { error: `Link tidak valid (wajib https): ${String(l.url).slice(0, 80)}`, code: 'LINK_INVALID' };
			const kind = classifyKaryaLink(url);
			if (kind === 'youtube' && !youtubeIdFromUrl(url)) return { error: 'Link YouTube tidak dikenali. Pakai link video (youtu.be/… atau youtube.com/watch?v=…).', code: 'LINK_INVALID' };
			if (kind === 'gdrive') {
				const fid = gdriveFileIdFromUrl(url);
				const sameAsBefore = (existing?.links || []).some((x: any) => x.url === url);
				if (fid && !sameAsBefore && !(await isDrivePublic(fid))) {
					return { error: 'Link Google Drive belum bisa dibuka publik. Ubah akses ke "Siapa saja yang memiliki link".', code: 'DRIVE_NOT_PUBLIC' };
				}
			}
			links.push({ kind, url, label: cleanText(l.label, 80) });
		}
		f.links = links;
	}
	if (d.related) {
		const out = [];
		for (const r of d.related) {
			const slug = karyaSlugify(r.projectSlug || '', 100);
			const url = cleanHttpsUrl(r.url);
			if (slug) {
				const p: any = await KaryaProject.findOne({ slug }).select('title studentId status visibility').lean();
				// Hanya karya milik sendiri, atau karya orang lain yang sudah publik
				if (!p) continue;
				const mine = String(p.studentId) === String(studentId);
				if (!mine && !(p.status === 'approved' && p.visibility === 'public')) continue;
				out.push({ projectSlug: slug, url: '', label: cleanText(r.label || p.title, 100) });
			} else if (url) {
				out.push({ projectSlug: '', url, label: cleanText(r.label || url, 100) });
			}
		}
		f.related = out;
	}
	if (existing && d.mediaCaptions) {
		f.media = (existing.media || []).map((m: any) => ({ ...m, caption: d.mediaCaptions?.[m.id] !== undefined ? cleanText(d.mediaCaptions[m.id], 160) : m.caption }));
	}
	if (d.coverMediaId !== undefined) f.coverMediaId = cleanText(d.coverMediaId, 40);
	return { fields: f };
}

/** Status baru setelah mahasiswa menyimpan. Karya yang disembunyikan admin tetap tersembunyi. */
function nextStatus(prevStatus: string, visibility: 'public' | 'private', action: 'draft' | 'submit', reviewMode: 'manual' | 'auto'): string {
	if (prevStatus === 'hidden') return 'hidden';
	if (action === 'draft' || visibility === 'private') return 'draft';
	return reviewMode === 'auto' ? 'approved' : 'pending';
}

router.get('/me/projects', requireEnabled, authenticateStudent, async (req, res) => {
	const me = await getStudent(req);
	const rows: any[] = await KaryaProject.find({ studentId: me._id }).sort({ updatedAt: -1 }).lean();
	ok(res, rows.map(ownProject));
});

router.get('/me/projects/:id', requireEnabled, authenticateStudent, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const me = await getStudent(req);
	const p = await KaryaProject.findOne({ _id: req.params.id, studentId: me._id }).lean();
	if (!p) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	ok(res, ownProject(p));
});

router.post('/me/projects', requireEnabled, authenticateStudent, writeLimiter, async (req, res) => {
	const parsed = projectSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Judul karya wajib (3–120 karakter) dan isian harus valid', 'VALIDATION_ERROR', parsed.error.issues.slice(0, 5));
	const me = await getStudent(req);
	if ((await KaryaProject.countDocuments({ studentId: me._id })) >= KARYA_LIMITS.maxProjectsPerStudent) {
		return fail(res, 400, `Maksimal ${KARYA_LIMITS.maxProjectsPerStudent} karya per mahasiswa.`, 'PROJECT_LIMIT');
	}
	try {
		const built = await buildProjectFields(parsed.data, me._id, null);
		if ('error' in built) return fail(res, 400, built.error, built.code);
		const settings = await getKaryaSettings();
		const visibility = parsed.data.visibility || 'private';
		const action = parsed.data.action || 'draft';
		const status = nextStatus('draft', visibility, action, settings.reviewMode);
		const now = new Date();
		const p = await KaryaProject.create({
			...built.fields,
			studentId: me._id,
			slug: await uniqueProjectSlug(String(built.fields.title)),
			visibility,
			status,
			submittedAt: status === 'pending' || status === 'approved' ? now : null,
			publishedAt: status === 'approved' ? now : null,
			reviewLog: status === 'approved' ? [{ action: 'auto-approve', note: 'Review otomatis aktif', at: now }] : [],
		});
		ok(res, ownProject(p.toObject()), status === 'pending' ? 'Karya dikirim untuk direview pengurus' : 'Karya disimpan');
	} catch (e) {
		console.error('[karya] create', e);
		fail(res, 500, 'Gagal menyimpan karya', 'INTERNAL');
	}
});

router.patch('/me/projects/:id', requireEnabled, authenticateStudent, writeLimiter, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const parsed = projectSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Isian karya tidak valid', 'VALIDATION_ERROR', parsed.error.issues.slice(0, 5));
	const me = await getStudent(req);
	const existing: any = await KaryaProject.findOne({ _id: req.params.id, studentId: me._id }).lean();
	if (!existing) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	try {
		const built = await buildProjectFields(parsed.data, me._id, existing);
		if ('error' in built) return fail(res, 400, built.error, built.code);
		const settings = await getKaryaSettings();
		const visibility = parsed.data.visibility || existing.visibility;
		const action = parsed.data.action || 'draft';
		const status = nextStatus(existing.status, visibility, action, settings.reviewMode);
		const now = new Date();
		const set: Record<string, unknown> = { ...built.fields, visibility, status };
		if (built.fields.title !== existing.title) set.slug = await uniqueProjectSlug(String(built.fields.title), existing._id);
		// Slug lama tetap dipakai bila sudah pernah tayang (link Google tidak putus)
		if (existing.publishedAt) delete set.slug;
		if (status === 'pending') set.submittedAt = now;
		if (status === 'approved' && existing.status !== 'approved') set.publishedAt = existing.publishedAt || now;
		if (status === 'pending' || status === 'approved') set.reviewNote = existing.status === 'revision' ? '' : existing.reviewNote;
		const p = await KaryaProject.findByIdAndUpdate(existing._id, { $set: set }, { new: true }).lean();
		const msg = status === 'pending' ? 'Karya dikirim untuk direview pengurus' : status === 'hidden' ? 'Disimpan. Karya ini sedang disembunyikan administrator.' : 'Karya disimpan';
		ok(res, ownProject(p), msg);
	} catch (e) {
		console.error('[karya] update', e);
		fail(res, 500, 'Gagal menyimpan karya', 'INTERNAL');
	}
});

router.delete('/me/projects/:id', requireEnabled, authenticateStudent, writeLimiter, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const me = await getStudent(req);
	const p: any = await KaryaProject.findOne({ _id: req.params.id, studentId: me._id }).lean();
	if (!p) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	await deleteProjectWithFiles(p);
	ok(res, null, 'Karya dihapus');
});

async function deleteProjectWithFiles(p: any): Promise<void> {
	const sid = String(p.studentId);
	let freed = 0;
	for (const m of p.media || []) {
		await deleteKaryaMediaFile(m.url, sid);
		freed += m.size || 0;
	}
	await KaryaProject.deleteOne({ _id: p._id });
	if (freed) await KaryaStudent.updateOne({ _id: p.studentId }, { $inc: { storageUsedBytes: -freed } });
	await KaryaProject.updateMany({ 'related.projectSlug': p.slug }, { $pull: { related: { projectSlug: p.slug } } });
}

router.post('/me/projects/:id/media', requireEnabled, authenticateStudent, writeLimiter, karyaUpload, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const settings = await getKaryaSettings();
	if (!settings.uploadsEnabled) return fail(res, 403, 'Upload file sedang dinonaktifkan. Pakai link YouTube / Google Drive.', 'UPLOADS_DISABLED');
	const me = await getStudent(req);
	const file = (req as any).file as Express.Multer.File | undefined;
	if (!file) return fail(res, 400, 'Pilih file', 'VALIDATION_ERROR');
	const p: any = await KaryaProject.findOne({ _id: req.params.id, studentId: me._id }).lean();
	if (!p) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const isVideo = /^video\//.test(file.mimetype);
	const media = p.media || [];
	if (isVideo) {
		if (media.filter((m: any) => m.type === 'video').length >= KARYA_LIMITS.maxVideosPerProject) return fail(res, 400, 'Maksimal 1 video per karya. Untuk video panjang pakai link YouTube.', 'MEDIA_LIMIT');
		if (file.size > KARYA_LIMITS.maxVideoBytes) return fail(res, 413, 'Video maks 30 MB. Untuk video lebih besar pakai link YouTube.', 'FILE_TOO_LARGE');
	} else {
		if (media.filter((m: any) => m.type === 'image').length >= KARYA_LIMITS.maxImagesPerProject) return fail(res, 400, `Maksimal ${KARYA_LIMITS.maxImagesPerProject} gambar per karya.`, 'MEDIA_LIMIT');
		if (file.size > KARYA_LIMITS.maxImageBytes) return fail(res, 413, 'Gambar maks 5 MB per file.', 'FILE_TOO_LARGE');
	}
	// Video disimpan apa adanya → cek ukuran asli; gambar dicek setelah dikompres ke WebP (di bawah)
	const left = await remainingQuota(me._id);
	if (left <= 0 || (isVideo && file.size > left)) {
		return fail(res, 413, 'Kuota penyimpanan 100 MB sudah habis. Hapus media lama atau pakai link YouTube/Drive.', 'QUOTA_EXCEEDED');
	}
	try {
		const up = await uploadKaryaMedia(file, String(me._id));
		if (up.size > (await remainingQuota(me._id))) {
			await deleteKaryaMediaFile(up.url, String(me._id));
			return fail(res, 413, 'Kuota penyimpanan 100 MB tidak cukup untuk file ini.', 'QUOTA_EXCEEDED');
		}
		const item = { id: crypto.randomBytes(6).toString('hex'), type: up.type, url: up.url, size: up.size, caption: '' };
		const set: Record<string, unknown> = {};
		if (!p.coverMediaId && up.type === 'image') set.coverMediaId = item.id;
		await KaryaProject.updateOne({ _id: p._id }, { $push: { media: item }, ...(Object.keys(set).length ? { $set: set } : {}) });
		await KaryaStudent.updateOne({ _id: me._id }, { $inc: { storageUsedBytes: up.size } });
		const fresh = await KaryaProject.findById(p._id).lean();
		ok(res, ownProject(fresh), 'Media diunggah');
	} catch (e) {
		fail(res, 400, (e as Error).message || 'Upload gagal', 'UPLOAD_FAILED');
	}
});

router.delete('/me/projects/:id/media/:mediaId', requireEnabled, authenticateStudent, writeLimiter, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const me = await getStudent(req);
	const p: any = await KaryaProject.findOne({ _id: req.params.id, studentId: me._id }).lean();
	if (!p) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const m = (p.media || []).find((x: any) => x.id === req.params.mediaId);
	if (!m) return fail(res, 404, 'Media tidak ditemukan', 'NOT_FOUND');
	await deleteKaryaMediaFile(m.url, String(me._id));
	const set: Record<string, unknown> = {};
	if (p.coverMediaId === m.id) set.coverMediaId = (p.media.find((x: any) => x.id !== m.id && x.type === 'image') || {}).id || '';
	await KaryaProject.updateOne({ _id: p._id }, { $pull: { media: { id: m.id } }, ...(Object.keys(set).length ? { $set: set } : {}) });
	await KaryaStudent.updateOne({ _id: me._id }, { $inc: { storageUsedBytes: -(m.size || 0) } });
	const fresh = await KaryaProject.findById(p._id).lean();
	ok(res, ownProject(fresh), 'Media dihapus');
});

router.post('/me/repo-preview', requireEnabled, authenticateStudent, repoLimiter, async (req, res) => {
	const url = String(req.body?.url || '').slice(0, 300);
	try {
		ok(res, await fetchPublicRepo(url));
	} catch (e) {
		if (e instanceof RepoFetchError) return fail(res, e.code === 'REPO_RATE_LIMITED' ? 429 : 400, e.message, e.code);
		fail(res, 500, 'Gagal mengambil info repo', 'INTERNAL');
	}
});

router.get('/me/stats', requireEnabled, authenticateStudent, async (req, res) => {
	const me = await getStudent(req);
	const [byStatus, views, links] = await Promise.all([
		KaryaProject.aggregate([{ $match: { studentId: me._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
		KaryaProject.aggregate([{ $match: { studentId: me._id } }, { $group: { _id: null, v: { $sum: '$viewCount' } } }]),
		KaryaShortlink.aggregate([{ $match: { studentId: me._id } }, { $group: { _id: null, c: { $sum: '$clicks' } } }]),
	]);
	const counts: Record<string, number> = {};
	for (const r of byStatus) counts[r._id] = r.n;
	ok(res, {
		counts,
		totalViews: views[0]?.v || 0,
		shortlinkClicks: links[0]?.c || 0,
		storageUsedBytes: me.storageUsedBytes || 0,
		quotaBytes: KARYA_LIMITS.quotaBytesPerStudent,
	});
});

// ── Shortlink pribadi ──
const shortlinkSchema = z.object({ slug: z.string().min(3).max(40), targetUrl: z.string().min(8).max(500) });

function ownShortlink(l: any) {
	return { id: String(l._id), slug: l.slug, targetUrl: l.targetUrl, status: l.status, clicks: l.clicks || 0, reviewNote: l.reviewNote || '', createdAt: l.createdAt };
}

function siteHosts(): string[] {
	return ['himatif-encoder.com', 'www.himatif-encoder.com'];
}

router.get('/me/shortlinks', requireEnabled, authenticateStudent, async (req, res) => {
	const me = await getStudent(req);
	const rows = await KaryaShortlink.find({ studentId: me._id }).sort({ createdAt: -1 }).lean();
	ok(res, rows.map(ownShortlink));
});

router.post('/me/shortlinks', requireEnabled, authenticateStudent, writeLimiter, async (req, res) => {
	const parsed = shortlinkSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Slug dan URL tujuan wajib diisi', 'VALIDATION_ERROR');
	const me = await getStudent(req);
	const slug = parsed.data.slug.trim().toLowerCase();
	if (!validShortlinkSlug(slug)) return fail(res, 400, 'Slug 3–40 karakter: huruf kecil, angka, tanda minus; bukan kata cadangan.', 'SLUG_INVALID');
	const targetUrl = cleanHttpsUrl(parsed.data.targetUrl);
	if (!targetUrl) return fail(res, 400, 'URL tujuan wajib https://', 'URL_INVALID');
	const host = new URL(targetUrl).hostname.toLowerCase();
	if (siteHosts().includes(host) && new URL(targetUrl).pathname.startsWith('/go/')) return fail(res, 400, 'Shortlink tidak boleh mengarah ke shortlink lain', 'URL_INVALID');
	if ((await KaryaShortlink.countDocuments({ studentId: me._id })) >= KARYA_LIMITS.maxShortlinksPerStudent) return fail(res, 400, `Maksimal ${KARYA_LIMITS.maxShortlinksPerStudent} shortlink.`, 'SHORTLINK_LIMIT');
	if (await KaryaShortlink.exists({ slug })) return fail(res, 409, 'Slug sudah dipakai', 'SLUG_TAKEN');
	const settings = await getKaryaSettings();
	const l = await KaryaShortlink.create({ studentId: me._id, slug, targetUrl, status: settings.shortlinkReview ? 'pending' : 'active' });
	ok(res, ownShortlink(l.toObject()), settings.shortlinkReview ? 'Shortlink dibuat, menunggu persetujuan pengurus' : 'Shortlink aktif');
});

router.delete('/me/shortlinks/:id', requireEnabled, authenticateStudent, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Shortlink tidak ditemukan', 'NOT_FOUND');
	const me = await getStudent(req);
	await KaryaShortlink.deleteOne({ _id: req.params.id, studentId: me._id });
	ok(res, null, 'Shortlink dihapus');
});

// ═════════════════════════════ PUBLIK ═════════════════════════════

/** ID mahasiswa yang boleh tampil publik: aktif, tidak disuspend. */
async function visibleStudentFilter(): Promise<any> {
	const hidden: any[] = await KaryaStudent.find({
		$or: [{ status: { $ne: 'active' } }, { suspendedUntil: { $gt: new Date() } }],
	})
		.select('_id')
		.lean();
	return hidden.length ? { studentId: { $nin: hidden.map((h) => h._id) } } : {};
}

const PUBLIC_PROJECT_BASE = { status: 'approved', visibility: 'public' } as const;

function coverOf(p: any): { url: string; label: string } {
	const media = p.media || [];
	const cover = media.find((m: any) => m.id === p.coverMediaId && m.type === 'image') || media.find((m: any) => m.type === 'image');
	const yt = (p.links || []).find((l: any) => l.kind === 'youtube');
	const ytId = yt ? youtubeIdFromUrl(yt.url) : null;
	const url = cover?.url || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '');
	let label = '';
	if (yt) label = 'Video YouTube';
	else if (media.some((m: any) => m.type === 'video')) label = 'Video';
	else if ((p.repos || []).length) label = 'Repo ' + (p.repos[0].host === 'github' ? 'GitHub' : p.repos[0].host === 'gitlab' ? 'GitLab' : 'Bitbucket');
	else if ((p.links || []).some((l: any) => l.kind === 'gdrive')) label = 'Google Drive';
	else if ((p.links || []).some((l: any) => l.kind === 'demo')) label = 'Demo live';
	else if (media.length) label = `${media.length} foto`;
	return { url, label };
}

function publicAuthor(s: any) {
	return { username: s?.username || '', name: s?.name || 'Mahasiswa TI', angkatan: angkatanFromNim(s?.nim), avatarUrl: s?.avatarUrl || '' };
}

async function toCards(rows: any[]): Promise<KaryaProjectCard[]> {
	const ids = Array.from(new Set(rows.map((r) => String(r.studentId))));
	const students: any[] = await KaryaStudent.find({ _id: { $in: ids } }).select('username name nim avatarUrl').lean();
	const byId = new Map(students.map((s) => [String(s._id), s]));
	return rows.map((p) => {
		const c = coverOf(p);
		return {
			slug: p.slug,
			title: p.title,
			summary: p.summary || '',
			category: p.category || 'lainnya',
			tags: p.tags || [],
			coverUrl: c.url,
			mediaLabel: c.label,
			featured: !!p.featured,
			author: publicAuthor(byId.get(String(p.studentId))),
			publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
		};
	});
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/public/projects', requireEnabled, publicLimiter, async (req, res) => {
	const q = cleanText(req.query.q, 80);
	const tag = cleanKaryaTags([String(req.query.tag || '')], 1)[0] || '';
	const category = String(req.query.category || '');
	const angkatan = Number(req.query.angkatan) || 0;
	const sort = req.query.sort === 'popular' ? 'popular' : 'latest';
	const page = Math.max(1, Math.min(200, Number(req.query.page) || 1));
	const limit = Math.max(1, Math.min(48, Number(req.query.limit) || 12));
	const filter: any = { ...PUBLIC_PROJECT_BASE, ...(await visibleStudentFilter()) };
	if (tag) filter.tags = tag;
	if (KARYA_CATEGORIES.some((c) => c.id === category)) filter.category = category;
	if (q) {
		const rx = new RegExp(escapeRegex(q), 'i');
		const authorIds = (await KaryaStudent.find({ $or: [{ name: rx }, { username: rx }] }).select('_id').limit(200).lean()).map((s: any) => s._id);
		filter.$or = [{ title: rx }, { summary: rx }, { tags: rx }, { 'repos.language': rx }, ...(authorIds.length ? [{ studentId: { $in: authorIds } }] : [])];
	}
	if (angkatan >= 2000 && angkatan <= 2100) {
		const yy = String(angkatan).slice(2);
		const ids = (await KaryaStudent.find({ nim: new RegExp(`^${yy}`) }).select('_id').lean()).map((s: any) => s._id);
		filter.studentId = filter.studentId ? { ...filter.studentId, $in: ids } : { $in: ids };
	}
	const sortSpec: any = sort === 'popular' ? { featured: -1, viewCount: -1, publishedAt: -1 } : { featured: -1, publishedAt: -1 };
	const [rows, total] = await Promise.all([
		KaryaProject.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).lean(),
		KaryaProject.countDocuments(filter),
	]);
	res.set('Cache-Control', 'public, max-age=30');
	ok(res, await toCards(rows), 'OK', { page, limit, total });
});

router.get('/public/tags', requireEnabled, publicLimiter, async (_req, res) => {
	const filter: any = { ...PUBLIC_PROJECT_BASE, ...(await visibleStudentFilter()) };
	const rows = await KaryaProject.aggregate([{ $match: filter }, { $unwind: '$tags' }, { $group: { _id: '$tags', n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 40 }]);
	res.set('Cache-Control', 'public, max-age=60');
	ok(res, rows.map((r) => ({ tag: r._id, count: r.n })));
});

const viewedRecently = new Map<string, number>();
router.get('/public/projects/:slug', requireEnabled, publicLimiter, async (req, res) => {
	const slug = karyaSlugify(req.params.slug, 100);
	const p: any = await KaryaProject.findOne({ slug, ...PUBLIC_PROJECT_BASE }).lean();
	if (!p) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const s: any = await KaryaStudent.findById(p.studentId).lean();
	if (!s || s.status !== 'active' || (s.suspendedUntil && new Date(s.suspendedUntil) > new Date())) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	// Hitung tayangan maks sekali per IP per karya per 6 jam
	const vk = `${reqIp(req)}:${p._id}`;
	if (!viewedRecently.has(vk) || Date.now() - (viewedRecently.get(vk) || 0) > 6 * 3600_000) {
		viewedRecently.set(vk, Date.now());
		if (viewedRecently.size > 20000) viewedRecently.clear();
		void KaryaProject.updateOne({ _id: p._id }, { $inc: { viewCount: 1 } }).catch(() => {});
	}
	// Karya terkait: hanya yang publik
	const relSlugs = (p.related || []).map((r: any) => r.projectSlug).filter(Boolean);
	const relPublic = relSlugs.length ? await KaryaProject.find({ slug: { $in: relSlugs }, ...PUBLIC_PROJECT_BASE }).lean() : [];
	const relCards = await toCards(relPublic);
	const more = await KaryaProject.find({ studentId: p.studentId, _id: { $ne: p._id }, ...PUBLIC_PROJECT_BASE }).sort({ publishedAt: -1 }).limit(4).lean();
	const c = coverOf(p);
	ok(res, {
		slug: p.slug,
		title: p.title,
		summary: p.summary || '',
		description: p.description || '',
		role: p.role || '',
		category: p.category,
		tags: p.tags || [],
		year: p.year || null,
		repos: p.repos || [],
		links: p.links || [],
		media: p.media || [],
		coverUrl: c.url,
		related: (p.related || [])
			.map((r: any) => (r.projectSlug ? relCards.find((x) => x.slug === r.projectSlug) ? { projectSlug: r.projectSlug, label: r.label } : null : { url: r.url, label: r.label }))
			.filter(Boolean),
		relatedCards: relCards,
		moreFromAuthor: await toCards(more),
		viewCount: p.viewCount || 0,
		publishedAt: p.publishedAt,
		updatedAt: p.updatedAt,
		author: publicStudent(s),
	});
});

function publicStudent(s: any): KaryaStudentPublic {
	return {
		username: s.username,
		name: s.name || 'Mahasiswa TI',
		angkatan: angkatanFromNim(s.nim),
		headline: s.headline || '',
		bio: s.bio || '',
		avatarUrl: s.avatarUrl || '',
		skills: s.skills || [],
		social: s.social || {},
		verifiedTi: !!s.verifiedTi,
	};
}

router.get('/public/students/:username', requireEnabled, publicLimiter, async (req, res) => {
	const username = String(req.params.username || '').toLowerCase().slice(0, 40);
	const s: any = await KaryaStudent.findOne({ username, status: 'active' }).lean();
	if (!s || s.profilePublic === false || (s.suspendedUntil && new Date(s.suspendedUntil) > new Date())) return fail(res, 404, 'Profil tidak ditemukan', 'NOT_FOUND');
	const rows = await KaryaProject.find({ studentId: s._id, ...PUBLIC_PROJECT_BASE }).sort({ featured: -1, publishedAt: -1 }).lean();
	// Profil hanya tampil publik bila punya minimal satu karya yang tayang
	if (!rows.length) return fail(res, 404, 'Profil tidak ditemukan', 'NOT_FOUND');
	const link: any = await KaryaShortlink.findOne({ studentId: s._id, status: 'active' }).sort({ createdAt: 1 }).lean();
	ok(res, { student: { ...publicStudent(s), shortlink: link ? `/go/${link.slug}` : undefined }, projects: await toCards(rows) });
});

// ═════════════════════════════ ADMIN ═════════════════════════════

const adminView = [authenticate, requirePermission('karya.view')];
const adminManage = [authenticate, requirePermission('karya.manage')];
const adminName = (req: Request) => String((req as any).user?.name || (req as any).user?.username || 'admin').slice(0, 80);
const adminId = (req: Request) => String((req as any).user?._id || '');

function logKarya(req: Request, action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish', title: string, entityId: string, metadata: Record<string, unknown> = {}) {
	const u: any = (req as any).user;
	if (!u?._id) return;
	void logActivity({ type: 'content', action, title, description: `Karya Mahasiswa: ${title}`, userId: u._id, userName: adminName(req), userRole: String(u.role || ''), entityId, entityTitle: title, metadata: { module: 'karya', ...metadata } }).catch(() => {});
}

function adminStudent(s: any) {
	return {
		...ownStudent(s),
		status: s.status,
		suspendedUntil: s.suspendedUntil || null,
		moderationReason: s.moderationReason || '',
		lastLoginAt: s.lastLoginAt || null,
	};
}

router.get('/admin/overview', ...adminView, async (_req, res) => {
	const [byStatus, students, shortPending, settings] = await Promise.all([
		KaryaProject.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
		KaryaStudent.aggregate([{ $match: { status: { $ne: 'deleted' } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
		KaryaShortlink.countDocuments({ status: 'pending' }),
		getKaryaSettings(),
	]);
	const suspended = await KaryaStudent.countDocuments({ suspendedUntil: { $gt: new Date() } });
	ok(res, {
		projects: Object.fromEntries(byStatus.map((r: any) => [r._id, r.n])),
		students: Object.fromEntries(students.map((r: any) => [r._id, r.n])),
		suspendedStudents: suspended,
		pendingShortlinks: shortPending,
		settings,
	});
});

router.get('/admin/projects', ...adminView, async (req, res) => {
	const status = String(req.query.status || '');
	const q = cleanText(req.query.q, 80);
	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
	const filter: any = {};
	if (['draft', 'pending', 'approved', 'revision', 'hidden'].includes(status)) filter.status = status;
	if (q) {
		const rx = new RegExp(escapeRegex(q), 'i');
		const ids = (await KaryaStudent.find({ $or: [{ name: rx }, { email: rx }, { nim: rx }, { username: rx }] }).select('_id').limit(200).lean()).map((s: any) => s._id);
		filter.$or = [{ title: rx }, { tags: rx }, ...(ids.length ? [{ studentId: { $in: ids } }] : [])];
	}
	// Draf privat bukan urusan admin kecuali dicari khusus
	if (!filter.status && !q) filter.status = { $ne: 'draft' };
	const [rows, total] = await Promise.all([
		KaryaProject.find(filter).sort({ submittedAt: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
		KaryaProject.countDocuments(filter),
	]);
	const students: any[] = await KaryaStudent.find({ _id: { $in: rows.map((r: any) => r.studentId) } }).lean();
	const byId = new Map(students.map((s) => [String(s._id), s]));
	ok(
		res,
		rows.map((p: any) => ({ ...ownProject(p), reviewLog: (p.reviewLog || []).slice(-10), student: byId.get(String(p.studentId)) ? adminStudent(byId.get(String(p.studentId))) : null })),
		'OK',
		{ page, limit, total },
	);
});

const reviewSchema = z.object({
	action: z.enum(['approve', 'revision', 'hide', 'unhide', 'feature', 'unfeature']),
	note: z.string().max(500).optional(),
});

router.post('/admin/projects/:id/review', ...adminManage, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const parsed = reviewSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Aksi tidak valid', 'VALIDATION_ERROR');
	const p: any = await KaryaProject.findById(req.params.id).lean();
	if (!p) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const { action } = parsed.data;
	const note = cleanText(parsed.data.note, 500);
	if ((action === 'revision' || action === 'hide') && !note) return fail(res, 400, 'Tulis catatan/alasan untuk mahasiswa', 'NOTE_REQUIRED');
	const set: Record<string, unknown> = {};
	const now = new Date();
	switch (action) {
		case 'approve':
			if (p.visibility !== 'public') return fail(res, 400, 'Karya privat tidak bisa disetujui untuk tayang', 'NOT_PUBLIC');
			set.status = 'approved';
			set.reviewNote = note;
			set.publishedAt = p.publishedAt || now;
			break;
		case 'revision':
			set.status = 'revision';
			set.reviewNote = note;
			break;
		case 'hide':
			set.status = 'hidden';
			set.reviewNote = note;
			set.featured = false;
			break;
		case 'unhide':
			if (p.status !== 'hidden') return fail(res, 400, 'Karya tidak sedang disembunyikan', 'NOT_HIDDEN');
			set.status = p.visibility === 'public' ? 'pending' : 'draft';
			set.reviewNote = note;
			break;
		case 'feature':
			if (p.status !== 'approved') return fail(res, 400, 'Hanya karya yang tayang yang bisa diunggulkan', 'NOT_APPROVED');
			set.featured = true;
			break;
		case 'unfeature':
			set.featured = false;
			break;
	}
	await KaryaProject.updateOne({ _id: p._id }, { $set: set, $push: { reviewLog: { $each: [{ action, note, byUserId: adminId(req), byName: adminName(req), at: now }], $slice: -50 } } });
	logKarya(req, action === 'approve' ? 'publish' : action === 'hide' ? 'unpublish' : 'update', p.title, String(p._id), { action, note });
	ok(res, ownProject(await KaryaProject.findById(p._id).lean()), 'Karya diperbarui');
});

router.delete('/admin/projects/:id', ...adminManage, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	const p: any = await KaryaProject.findById(req.params.id).lean();
	if (!p) return fail(res, 404, 'Karya tidak ditemukan', 'NOT_FOUND');
	await deleteProjectWithFiles(p);
	logKarya(req, 'delete', p.title, String(p._id), { reason: cleanText(req.body?.reason, 300) });
	ok(res, null, 'Karya dihapus permanen');
});

router.get('/admin/students', ...adminView, async (req, res) => {
	const q = cleanText(req.query.q, 80);
	const status = String(req.query.status || '');
	const page = Math.max(1, Number(req.query.page) || 1);
	const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
	const filter: any = { status: { $ne: 'deleted' } };
	if (status === 'suspended') filter.suspendedUntil = { $gt: new Date() };
	else if (['pending', 'active', 'blocked'].includes(status)) filter.status = status;
	if (q) {
		const rx = new RegExp(escapeRegex(q), 'i');
		filter.$or = [{ name: rx }, { email: rx }, { nim: rx }, { username: rx }];
	}
	const [rows, total] = await Promise.all([
		KaryaStudent.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
		KaryaStudent.countDocuments(filter),
	]);
	const counts = await KaryaProject.aggregate([{ $match: { studentId: { $in: rows.map((r: any) => r._id) } } }, { $group: { _id: '$studentId', n: { $sum: 1 } } }]);
	const byId = new Map(counts.map((c: any) => [String(c._id), c.n]));
	ok(res, rows.map((s: any) => ({ ...adminStudent(s), projectCount: byId.get(String(s._id)) || 0 })), 'OK', { page, limit, total });
});

const createStudentSchema = z.object({
	email: z.string().min(5).max(200),
	name: z.string().min(1).max(80),
	/** Izinkan email di luar aturan UIN TI (owner/admin, mis. alumni). */
	allowNonUin: z.boolean().optional(),
});

router.post('/admin/students', ...adminManage, async (req, res) => {
	const parsed = createStudentSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Nama dan email wajib diisi', 'VALIDATION_ERROR');
	const email = normalizeStudentEmail(parsed.data.email);
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(res, 400, 'Format email tidak valid', 'EMAIL_INVALID');
	const elig = checkStudentEmail(email);
	if (!elig.ok && !parsed.data.allowNonUin) {
		return fail(res, 400, 'Email bukan email mahasiswa TI (NIM@student.uin-malang.ac.id). Centang "Izinkan email non-UIN" bila memang disengaja.', 'NOT_TI_EMAIL');
	}
	const existing: any = await KaryaStudent.findOne({ email }).lean();
	if (existing && existing.status !== 'deleted') return fail(res, 409, 'Email sudah terdaftar', 'EMAIL_REGISTERED');
	const s = await KaryaStudent.create({
		email,
		name: cleanName(parsed.data.name),
		nim: elig.ok ? elig.nim : '',
		verifiedTi: elig.ok,
		username: await uniqueUsername(elig.ok ? elig.nim : parsed.data.name),
		status: 'active',
		// Belum terverifikasi: pemilik email mengatur password lewat "Lupa password" (OTP ke email itu) atau Google
		emailVerified: false,
		createdByAdmin: true,
		createdByUserId: adminId(req),
	});
	logKarya(req, 'create', `Akun mahasiswa ${email}`, String(s._id), { nonUin: !elig.ok });
	ok(res, adminStudent(s.toObject()), 'Akun dibuat. Minta mahasiswa masuk dengan Google atau pakai "Lupa password" untuk mengatur password.');
});

const moderateSchema = z.object({
	action: z.enum(['suspend', 'unsuspend', 'block', 'unblock', 'logout']),
	days: z.number().int().min(1).max(365).optional(),
	reason: z.string().max(300).optional(),
});

router.post('/admin/students/:id/moderate', ...adminManage, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Akun tidak ditemukan', 'NOT_FOUND');
	const parsed = moderateSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Aksi tidak valid', 'VALIDATION_ERROR');
	const s: any = await KaryaStudent.findById(req.params.id);
	if (!s || s.status === 'deleted') return fail(res, 404, 'Akun tidak ditemukan', 'NOT_FOUND');
	const { action } = parsed.data;
	const reason = cleanText(parsed.data.reason, 300);
	const revoke = async () => {
		s.tokenVersion = (s.tokenVersion || 0) + 1;
		await KaryaStudentSession.updateMany({ studentId: s._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
	};
	if (action === 'suspend') {
		if (!parsed.data.days) return fail(res, 400, 'Isi lama suspend (hari)', 'VALIDATION_ERROR');
		s.suspendedUntil = new Date(Date.now() + parsed.data.days * 86400_000);
		s.moderationReason = reason;
		await revoke();
	} else if (action === 'unsuspend') {
		s.suspendedUntil = null;
		s.moderationReason = '';
	} else if (action === 'block') {
		s.status = 'blocked';
		s.moderationReason = reason;
		await revoke();
	} else if (action === 'unblock') {
		if (s.status !== 'blocked') return fail(res, 400, 'Akun tidak sedang diblokir', 'NOT_BLOCKED');
		s.status = 'active';
		s.moderationReason = '';
	} else if (action === 'logout') {
		await revoke();
	}
	await s.save();
	logKarya(req, 'update', `Akun mahasiswa ${s.email}`, String(s._id), { action, days: parsed.data.days, reason });
	ok(res, adminStudent(s.toObject()), 'Akun diperbarui');
});

router.delete('/admin/students/:id', ...adminManage, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Akun tidak ditemukan', 'NOT_FOUND');
	const s: any = await KaryaStudent.findById(req.params.id).lean();
	if (!s || s.status === 'deleted') return fail(res, 404, 'Akun tidak ditemukan', 'NOT_FOUND');
	await purgeStudent(s._id);
	logKarya(req, 'delete', `Akun mahasiswa ${s.email}`, String(s._id));
	ok(res, null, 'Akun dan semua karyanya dihapus');
});

router.get('/admin/shortlinks', ...adminView, async (req, res) => {
	const status = String(req.query.status || '');
	const filter: any = {};
	if (['pending', 'active', 'disabled'].includes(status)) filter.status = status;
	const rows: any[] = await KaryaShortlink.find(filter).sort({ createdAt: -1 }).limit(200).lean();
	const students: any[] = await KaryaStudent.find({ _id: { $in: rows.map((r) => r.studentId) } }).select('name email username').lean();
	const byId = new Map(students.map((s) => [String(s._id), s]));
	ok(res, rows.map((l) => ({ ...ownShortlink(l), student: byId.get(String(l.studentId)) ? { name: byId.get(String(l.studentId)).name, email: byId.get(String(l.studentId)).email, username: byId.get(String(l.studentId)).username } : null })));
});

router.post('/admin/shortlinks/:id', ...adminManage, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Shortlink tidak ditemukan', 'NOT_FOUND');
	const action = String(req.body?.action || '');
	const map: Record<string, string> = { approve: 'active', enable: 'active', disable: 'disabled' };
	if (!map[action]) return fail(res, 400, 'Aksi tidak valid', 'VALIDATION_ERROR');
	const l: any = await KaryaShortlink.findByIdAndUpdate(req.params.id, { $set: { status: map[action], reviewNote: cleanText(req.body?.note, 300) } }, { new: true }).lean();
	if (!l) return fail(res, 404, 'Shortlink tidak ditemukan', 'NOT_FOUND');
	logKarya(req, 'update', `Shortlink /go/${l.slug}`, String(l._id), { action });
	ok(res, ownShortlink(l), 'Shortlink diperbarui');
});

router.delete('/admin/shortlinks/:id', ...adminManage, async (req, res) => {
	if (!isId(req.params.id)) return fail(res, 404, 'Shortlink tidak ditemukan', 'NOT_FOUND');
	const l: any = await KaryaShortlink.findByIdAndDelete(req.params.id).lean();
	if (l) logKarya(req, 'delete', `Shortlink /go/${l.slug}`, String(l._id));
	ok(res, null, 'Shortlink dihapus');
});

const settingsSchema = z.object({
	enabled: z.boolean().optional(),
	registrationOpen: z.boolean().optional(),
	reviewMode: z.enum(['manual', 'auto']).optional(),
	shortlinkReview: z.boolean().optional(),
	uploadsEnabled: z.boolean().optional(),
});

router.get('/admin/settings', ...adminView, async (_req, res) => ok(res, await getKaryaSettings()));

router.patch('/admin/settings', ...adminManage, async (req, res) => {
	const parsed = settingsSchema.safeParse(req.body || {});
	if (!parsed.success) return fail(res, 400, 'Pengaturan tidak valid', 'VALIDATION_ERROR');
	await KaryaSettings.updateOne({ key: 'main' }, { $set: { ...parsed.data, updatedBy: adminName(req) } }, { upsert: true });
	logKarya(req, 'update', 'Pengaturan Karya Mahasiswa', 'settings', parsed.data);
	ok(res, await getKaryaSettings(), 'Pengaturan disimpan');
});

/** Dipakai shortlink resolver & SEO di server/index.ts */
export async function resolveShortlink(slug: string): Promise<string | null> {
	const s = String(slug || '').toLowerCase();
	if (!/^[a-z0-9-]{3,40}$/.test(s)) return null;
	const l: any = await KaryaShortlink.findOne({ slug: s, status: 'active' }).lean();
	if (!l) return null;
	const owner: any = await KaryaStudent.findById(l.studentId).select('status suspendedUntil').lean();
	if (!owner || owner.status !== 'active' || (owner.suspendedUntil && new Date(owner.suspendedUntil) > new Date())) return null;
	const settings = await getKaryaSettings();
	if (!settings.enabled) return null;
	void KaryaShortlink.updateOne({ _id: l._id }, { $inc: { clicks: 1 } }).catch(() => {});
	return cleanHttpsUrl(l.targetUrl) || null;
}

/** Data SEO untuk prerender + sitemap. */
export async function karyaSeoProject(slug: string) {
	const settings = await getKaryaSettings();
	if (!settings.enabled) return null;
	const p: any = await KaryaProject.findOne({ slug: karyaSlugify(slug, 100), ...PUBLIC_PROJECT_BASE }).lean();
	if (!p) return null;
	const s: any = await KaryaStudent.findById(p.studentId).lean();
	if (!s || s.status !== 'active' || (s.suspendedUntil && new Date(s.suspendedUntil) > new Date())) return null;
	return { project: p, student: s, cover: coverOf(p).url };
}

export async function karyaSeoStudent(username: string) {
	const settings = await getKaryaSettings();
	if (!settings.enabled) return null;
	const s: any = await KaryaStudent.findOne({ username: String(username).toLowerCase().slice(0, 40), status: 'active' }).lean();
	if (!s || s.profilePublic === false || (s.suspendedUntil && new Date(s.suspendedUntil) > new Date())) return null;
	const count = await KaryaProject.countDocuments({ studentId: s._id, ...PUBLIC_PROJECT_BASE });
	if (!count) return null;
	return { student: s, count };
}

export async function karyaSitemapEntries(): Promise<{ loc: string; lastmod: Date }[]> {
	const settings = await getKaryaSettings();
	if (!settings.enabled) return [];
	const filter: any = { ...PUBLIC_PROJECT_BASE, ...(await visibleStudentFilter()) };
	const rows: any[] = await KaryaProject.find(filter).select('slug updatedAt studentId').lean();
	const studentIds = Array.from(new Set(rows.map((r) => String(r.studentId))));
	const students: any[] = await KaryaStudent.find({ _id: { $in: studentIds }, profilePublic: { $ne: false } }).select('username updatedAt').lean();
	return [
		...rows.map((r) => ({ loc: `/karya/${r.slug}`, lastmod: r.updatedAt })),
		...students.map((s) => ({ loc: `/karya/mahasiswa/${s.username}`, lastmod: s.updatedAt })),
	];
}

export default router;
void mongoose;
