import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { getMiddlewareSettings } from '../models/middleware-settings';
import { getTrustedClientIp } from '../lib/client-ip';

// ==================== SETTINGS CACHE ====================
let settingsCache: any = null;
let settingsCacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export function clearPublicRateLimitSettingsCache() {
	settingsCache = null;
	settingsCacheTs = 0;
}

async function isRateLimitEnabled(): Promise<boolean> {
	const now = Date.now();
	if (!settingsCache || now - settingsCacheTs > CACHE_TTL) {
		try {
			// Avoid 10s mongoose buffering hang when DB is not connected (local scripts/tests)
			const mongoose = await import('mongoose');
			if (mongoose.default.connection.readyState !== 1) {
				settingsCache = { apiRateLimitEnabled: true, allEnabled: true };
			} else {
				settingsCache = await getMiddlewareSettings();
			}
			settingsCacheTs = now;
		} catch {
			settingsCache = { apiRateLimitEnabled: true, allEnabled: true };
		}
	}
	return settingsCache.allEnabled !== false && settingsCache.apiRateLimitEnabled !== false;
}

// ==================== HELPERS ====================
export function getClientIp(req: Request): string {
	return getTrustedClientIp(req);
}

/** Device fingerprint WITHOUT IP — IP rotation must not reset device bucket. */
export function getDeviceId(req: Request): string {
	const ua = req.get('User-Agent') || '';
	const lang = req.get('Accept-Language') || '';
	const enc = req.get('Accept-Encoding') || '';
	return crypto.createHash('sha256').update(`${ua}|${lang}|${enc}`).digest('hex').substring(0, 16);
}

/**
 * Kunci "perangkat" untuk limiter: cookie sesi toko bila ada (unik per pembeli), selain itu
 * fingerprint header. Tanpa cookie, fingerprint dipakai bersama semua pengguna browser/HP sejenis,
 * jadi jangan jadikan satu-satunya pembeda. Cookie baru tetap dibatasi bucket IP.
 */
function getLimiterDeviceKey(req: Request): string {
	const storeSession = (req as any).cookies?.hmps_store_session as string | undefined;
	if (storeSession && storeSession.length >= 16) {
		return 's' + crypto.createHash('sha256').update(storeSession).digest('hex').substring(0, 16);
	}
	return getDeviceId(req);
}

function getGuestKeyHash(req: Request): string | null {
	const raw = (req.headers['x-guest-key'] as string | undefined)?.trim();
	if (!raw) return null;
	const pepper = process.env.GUEST_KEY_PEPPER || 'hmps-comment-pepper';
	return crypto.createHmac('sha256', pepper).update(raw).digest('hex').substring(0, 24);
}

// ==================== IN-MEMORY COUNTER ====================
interface BucketEntry { count: number; resetTime: number }

const buckets = new Map<string, BucketEntry>();

/** @internal exported for local security verify */
export function _resetPublicRateLimitBucketsForTests() {
	buckets.clear();
}

function increment(key: string, windowMs: number): BucketEntry {
	const now = Date.now();
	let entry = buckets.get(key);
	if (!entry || now > entry.resetTime) {
		entry = { count: 1, resetTime: now + windowMs };
		buckets.set(key, entry);
	} else {
		entry.count++;
	}
	return entry;
}

// Cleanup stale entries every 2 minutes
const cleanupTimer = setInterval(() => {
	const now = Date.now();
	for (const [k, v] of Array.from(buckets.entries())) {
		if (now > v.resetTime) buckets.delete(k);
	}
}, 2 * 60 * 1000);
cleanupTimer.unref?.();

// ==================== 429 RESPONSE ====================
function send429(res: Response, retryAfterSec: number, windowLabel: string) {
	res.status(429).json({
		error: `Terlalu banyak request. Silakan coba lagi dalam ${windowLabel}.`,
		message: `Terlalu banyak request. Silakan coba lagi dalam ${windowLabel}.`,
		retryAfter: retryAfterSec,
	});
}

// ==================== LIMITER TYPES ====================
export interface WindowRule {
	windowMs: number;
	maxPerIp: number;
	maxPerDevice: number;
	/** Optional per guest-key cap (anti flood with same guest secret + rotating IPs) */
	maxPerGuestKey?: number;
	/** Optional cap per sesi login (cookie authToken/buyerToken di-hash): membatasi satu akun yang membanjiri. */
	maxPerSession?: number;
	label: string;
}

export interface LimiterOptions {
	/**
	 * true = limiter TIDAK ikut mati saat toggle dashboard `apiRateLimitEnabled/allEnabled` dimatikan.
	 * Dipakai untuk jalur tulis publik yang rawan banjir (komentar, saran, upload chat).
	 */
	alwaysOn?: boolean;
}

function getSessionKey(req: Request): string | null {
	const c = (req as any).cookies || {};
	const raw = (c.authToken || c.buyerToken) as string | undefined;
	if (!raw || typeof raw !== 'string' || raw.length < 16) return null;
	return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 24);
}

/**
 * Create an Express middleware that enforces multiple window rules
 * on IP, device fingerprint (no IP), and optional guest key.
 * Respects dashboard toggle `apiRateLimitEnabled`.
 */
export function createPublicRateLimiter(
	namespace: string,
	rules: WindowRule[],
	options: LimiterOptions = {},
) {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!options.alwaysOn) {
				const enabled = await isRateLimitEnabled();
				if (!enabled) return next();
			}

			const ip = getClientIp(req);
			const device = getLimiterDeviceKey(req);
			const guest = getGuestKeyHash(req);
			const session = getSessionKey(req);

			for (const rule of rules) {
				const ipKey = `prl:${namespace}:ip:${rule.windowMs}:${ip}`;
				const devKey = `prl:${namespace}:dev:${rule.windowMs}:${device}`;

				const ipEntry = increment(ipKey, rule.windowMs);
				const devEntry = increment(devKey, rule.windowMs);

				if (ipEntry.count > rule.maxPerIp) {
					const retry = Math.ceil((ipEntry.resetTime - Date.now()) / 1000);
					console.log(`🚨 PublicRateLimit [${namespace}] IP exceeded ${rule.maxPerIp}/${rule.label}`);
					return send429(res, retry, rule.label);
				}
				if (devEntry.count > rule.maxPerDevice) {
					const retry = Math.ceil((devEntry.resetTime - Date.now()) / 1000);
					console.log(`🚨 PublicRateLimit [${namespace}] Device exceeded ${rule.maxPerDevice}/${rule.label}`);
					return send429(res, retry, rule.label);
				}

				if (session && rule.maxPerSession != null) {
					const sessEntry = increment(`prl:${namespace}:sess:${rule.windowMs}:${session}`, rule.windowMs);
					if (sessEntry.count > rule.maxPerSession) {
						const retry = Math.ceil((sessEntry.resetTime - Date.now()) / 1000);
						console.log(`🚨 PublicRateLimit [${namespace}] Session exceeded ${rule.maxPerSession}/${rule.label}`);
						return send429(res, retry, rule.label);
					}
				}

				if (guest && rule.maxPerGuestKey != null) {
					const guestKey = `prl:${namespace}:guest:${rule.windowMs}:${guest}`;
					const guestEntry = increment(guestKey, rule.windowMs);
					if (guestEntry.count > rule.maxPerGuestKey) {
						const retry = Math.ceil((guestEntry.resetTime - Date.now()) / 1000);
						console.log(`🚨 PublicRateLimit [${namespace}] GuestKey exceeded ${rule.maxPerGuestKey}/${rule.label}`);
						return send429(res, retry, rule.label);
					}
				}
			}

			next();
		} catch (err) {
			console.error('PublicRateLimit error:', err);
			next();
		}
	};
}

// ==================== PRE-BUILT LIMITERS (balanced — not too strict) ====================

/**
 * Comment: IP 60/min + 600/day, Device 10/min + 100/day, sesi login 6/min + 60/day.
 * alwaysOn: tidak ikut mati bila toggle rate limit dashboard dimatikan (pada 3 Juli 2026 satu akun memposting
 * 382 komentar dalam 5 menit karena limiter sedang dimatikan).
 */
export const commentRateLimiter = createPublicRateLimiter(
	'comment',
	[
		{ windowMs: 60_000, maxPerIp: 60, maxPerDevice: 10, maxPerSession: 6, label: '1 menit' },
		{ windowMs: 24 * 60 * 60 * 1000, maxPerIp: 600, maxPerDevice: 100, maxPerSession: 60, label: '1 hari' },
	],
	{ alwaysOn: true },
);

/**
 * Feedback: balanced anti-flood.
 * ~20/IP/hour, ~15/device/hour, ~10/guestKey/hour — blocks same-key flood without blocking normal users.
 */
export const feedbackRateLimiter = createPublicRateLimiter(
	'feedback',
	[
		{
			windowMs: 60 * 60 * 1000,
			maxPerIp: 20,
			maxPerDevice: 15,
			maxPerGuestKey: 10,
			maxPerSession: 10,
			label: '1 jam',
		},
	],
	{ alwaysOn: true },
);

/** Chat message/upload */
export const chatUploadRateLimiter = createPublicRateLimiter(
	'chat-upload',
	[
		{ windowMs: 60_000, maxPerIp: 100, maxPerDevice: 30, label: '1 menit' },
		{ windowMs: 24 * 60 * 60 * 1000, maxPerIp: 1000, maxPerDevice: 300, label: '1 hari' },
	],
	{ alwaysOn: true },
);

/** Soft cap: store checkout / buy-link */
export const storeCheckoutRateLimiter = createPublicRateLimiter('store-checkout', [
	{ windowMs: 60 * 60 * 1000, maxPerIp: 30, maxPerDevice: 20, label: '1 jam' },
]);

/** Keranjang toko: tambah/ubah/hapus item & simpan draft (batas wajar klik cepat) */
export const storeCartRateLimiter = createPublicRateLimiter('store-cart', [
	{ windowMs: 60_000, maxPerIp: 90, maxPerDevice: 60, label: '1 menit' },
]);

/** Cek ongkir: memanggil API ongkir pihak ketiga */
export const storeShippingQuoteRateLimiter = createPublicRateLimiter('store-shipping-quote', [
	{ windowMs: 60_000, maxPerIp: 30, maxPerDevice: 20, label: '1 menit' },
]);

/** Chat penjual toko: kirim pesan / lanjut WA (terpisah dari kuota checkout) */
export const storeChatRateLimiter = createPublicRateLimiter('store-chat', [
	{ windowMs: 60_000, maxPerIp: 15, maxPerDevice: 10, label: '1 menit' },
	{ windowMs: 60 * 60 * 1000, maxPerIp: 120, maxPerDevice: 80, label: '1 jam' },
]);

/** Upload bukti bayar toko (per pesanan juga dibatasi di route: maks 5 bukti per jenis) */
export const storeProofUploadRateLimiter = createPublicRateLimiter('store-proof-upload', [
	{ windowMs: 10 * 60_000, maxPerIp: 15, maxPerDevice: 8, label: '10 menit' },
	{ windowMs: 60 * 60 * 1000, maxPerIp: 20, maxPerDevice: 10, label: '1 jam' },
]);

/** Pembatalan / permintaan batal pesanan oleh pembeli */
export const storeOrderActionRateLimiter = createPublicRateLimiter('store-order-action', [
	{ windowMs: 60 * 60 * 1000, maxPerIp: 20, maxPerDevice: 10, label: '1 jam' },
]);

/** Soft cap: GDrive proxy POSTs */
export const gdriveProxyRateLimiter = createPublicRateLimiter('gdrive-proxy', [
	{ windowMs: 60_000, maxPerIp: 60, maxPerDevice: 40, label: '1 menit' },
]);

/** Soft cap: chat create/delete */
export const chatSessionRateLimiter = createPublicRateLimiter('chat-session', [
	{ windowMs: 60_000, maxPerIp: 30, maxPerDevice: 20, label: '1 menit' },
]);
