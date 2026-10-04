/**
 * Autentikasi akun PEMBELI toko (koleksi Customer di DB utama).
 *
 * Sengaja terpisah total dari akun staf (User + cookie `authToken`):
 * - cookie sendiri `buyerToken`;
 * - JWT ditandatangani kunci turunan (JWT_SECRET + ":buyer") dengan `aud: "buyer"`, sehingga token pembeli
 *   tidak pernah lolos `authenticate` staf, dan token staf tidak pernah lolos `authenticateBuyer`;
 * - pembeli tidak punya role/permission staf → tidak bisa membuka endpoint dashboard/admin.
 *
 * Satu akun dipakai untuk semua toko (Encoder Store + toko komunitas). Pesanan di DB mana pun ditautkan
 * lewat `StoreOrder.buyerId`.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { Community, Customer, CustomerSession, StoreChat, StoreOrder } from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';

export const BUYER_COOKIE = 'buyerToken';
const BUYER_TOKEN_DAYS = 30;
const BUYER_AUD = 'buyer';

function buyerSecret(): string {
	return `${process.env.JWT_SECRET || 'hmti-secret-key-change-in-production'}::buyer`;
}

export function buyerCookieOptions() {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax' as const,
		path: '/',
		maxAge: BUYER_TOKEN_DAYS * 24 * 60 * 60 * 1000,
	};
}

export function normalizeBuyerEmail(v: unknown): string {
	return String(v || '').trim().toLowerCase().slice(0, 200);
}

export const BUYER_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Data akun yang aman dikirim ke pemiliknya (tanpa hash password / token). */
export function publicCustomer(c: any) {
	if (!c) return null;
	return {
		id: String(c._id),
		email: c.email,
		emailVerified: !!c.emailVerified,
		name: c.name || '',
		phone: c.phone || '',
		hasPassword: !!c.passwordHash,
		googleLinked: !!c.googleSub,
		addresses: c.addresses || [],
		notifyPrefs: c.notifyPrefs || { orderStatus: true, paymentReminders: true },
		createdAt: c.createdAt,
	};
}

function parseDevice(ua: string): string {
	if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile';
	if (/Tablet|iPad/i.test(ua)) return 'Tablet';
	return 'Desktop';
}

/** Buat sesi + set cookie. Dipakai setelah login/daftar/Google berhasil. */
export async function startBuyerSession(req: Request, res: Response, customer: any): Promise<void> {
	const sid = crypto.randomBytes(24).toString('hex');
	const ua = String(req.headers['user-agent'] || '').slice(0, 300);
	await CustomerSession.create({
		customerId: customer._id,
		sessionId: sid,
		userAgent: ua,
		ip: String((req as any).ip || '').slice(0, 64),
		device: parseDevice(ua),
	});
	await Customer.updateOne({ _id: customer._id }, { $set: { lastLoginAt: new Date() } });
	const token = jwt.sign({ id: String(customer._id), sid, tv: customer.tokenVersion || 0 }, buyerSecret(), {
		expiresIn: `${BUYER_TOKEN_DAYS}d`,
		audience: BUYER_AUD,
	});
	res.cookie(BUYER_COOKIE, token, buyerCookieOptions());
}

/** Akhiri sesi saat ini (logout). */
export async function endBuyerSession(req: Request, res: Response): Promise<void> {
	const payload = readBuyerToken(req);
	if (payload?.sid) await CustomerSession.updateOne({ sessionId: payload.sid }, { $set: { revokedAt: new Date() } });
	const { maxAge: _m, ...opts } = buyerCookieOptions();
	res.clearCookie(BUYER_COOKIE, opts);
}

function readBuyerToken(req: Request): { id: string; sid: string; tv: number } | null {
	const token = req.cookies?.[BUYER_COOKIE];
	if (!token || typeof token !== 'string') return null;
	try {
		const p = jwt.verify(token, buyerSecret(), { algorithms: ['HS256'], audience: BUYER_AUD }) as any;
		if (!p?.id || !p?.sid) return null;
		return { id: String(p.id), sid: String(p.sid), tv: Number(p.tv) || 0 };
	} catch {
		return null;
	}
}

/**
 * Pembeli yang sedang login (atau null). Hasil di-cache per request. Sesi dicabut, akun diblokir/dihapus,
 * atau tokenVersion berubah (mis. ganti password) → dianggap tidak login.
 */
export async function getBuyer(req: Request): Promise<any | null> {
	const anyReq = req as any;
	if (anyReq._buyerResolved) return anyReq._buyer || null;
	anyReq._buyerResolved = true;
	const p = readBuyerToken(req);
	if (!p) return null;
	try {
		const [c, sess]: any[] = await Promise.all([
			Customer.findById(p.id).lean(),
			CustomerSession.findOne({ sessionId: p.sid, customerId: p.id }).lean(),
		]);
		if (!c || c.status !== 'active' || (c.tokenVersion || 0) !== p.tv) return null;
		if (!sess || sess.revokedAt) return null;
		// Perbarui "aktif terakhir" paling sering tiap 10 menit
		if (Date.now() - new Date(sess.lastActive).getTime() > 600_000) {
			void CustomerSession.updateOne({ _id: sess._id }, { $set: { lastActive: new Date() } }).catch(() => {});
		}
		anyReq._buyer = c;
		anyReq._buyerSid = p.sid;
		return c;
	} catch {
		return null;
	}
}

export async function getBuyerId(req: Request): Promise<string | null> {
	const c = await getBuyer(req);
	return c ? String(c._id) : null;
}

export function currentBuyerSid(req: Request): string | null {
	return (req as any)._buyerSid || null;
}

/** Middleware: wajib login sebagai pembeli. */
export async function authenticateBuyer(req: Request, res: Response, next: NextFunction) {
	const c = await getBuyer(req);
	if (!c) return res.status(401).json({ success: false, message: 'Silakan masuk ke akun pembeli', error: { code: 'BUYER_AUTH_REQUIRED' } });
	next();
}

function storeSessionHashFromCookie(req: Request): string | null {
	const token = req.cookies?.hmps_store_session;
	if (!token || typeof token !== 'string' || token.length < 16) return null;
	const pepper = process.env.STORE_SESSION_PEPPER || 'hmps-store-session-pepper';
	return crypto.createHmac('sha256', pepper).update(token).digest('hex');
}

/**
 * Tautkan pesanan lama ke akun — HANYA dengan bukti kepemilikan:
 *  - pesanan dari perangkat ini (cookie sesi toko yang sama), dan/atau
 *  - pesanan dengan email = email akun yang SUDAH terverifikasi.
 * Tidak pernah berdasarkan nomor HP (belum terverifikasi). Pesanan milik akun lain tidak dipindah.
 * Berlaku di toko utama dan semua toko komunitas aktif.
 */
export async function claimOrdersForCustomer(req: Request, customer: any): Promise<number> {
	const or: any[] = [];
	const hash = storeSessionHashFromCookie(req);
	if (hash) or.push({ guestSessionKeyHash: hash });
	if (customer.emailVerified && BUYER_EMAIL_RE.test(customer.email)) or.push({ customerEmail: customer.email });
	if (!or.length) return 0;
	const filter = { buyerId: null, $or: or };
	const set = { $set: { buyerId: customer._id } };
	let n = 0;
	try {
		n += (await StoreOrder.updateMany(filter, set)).modifiedCount || 0;
		if (hash) await StoreChat.updateMany({ buyerId: null, guestSessionKeyHash: hash }, set);
		const communities: any[] = await Community.find({ status: 'active' }).select('dbName').lean();
		for (const c of communities) {
			try {
				const m = getTenantModels(c.dbName);
				n += (await m.StoreOrder.updateMany(filter, set)).modifiedCount || 0;
				if (hash) await m.StoreChat.updateMany({ buyerId: null, guestSessionKeyHash: hash }, set);
			} catch (e) {
				console.warn('[buyer-claim] tenant gagal:', c.dbName, (e as Error)?.message);
			}
		}
	} catch (e) {
		console.error('[buyer-claim]', (e as Error)?.message);
	}
	return n;
}
