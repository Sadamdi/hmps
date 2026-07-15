import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { getMiddlewareSettings } from '../models/middleware-settings';

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
	const xfwd = (req.headers['x-forwarded-for'] as string) || '';
	const forwardedIp = xfwd.split(',')[0]?.trim();
	return forwardedIp || req.ip || (req.connection as any)?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

/** Device fingerprint WITHOUT IP — IP rotation must not reset device bucket. */
export function getDeviceId(req: Request): string {
	const ua = req.get('User-Agent') || '';
	const lang = req.get('Accept-Language') || '';
	const enc = req.get('Accept-Encoding') || '';
	return crypto.createHash('sha256').update(`${ua}|${lang}|${enc}`).digest('hex').substring(0, 16);
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
	label: string;
}

/**
 * Create an Express middleware that enforces multiple window rules
 * on IP, device fingerprint (no IP), and optional guest key.
 * Respects dashboard toggle `apiRateLimitEnabled`.
 */
export function createPublicRateLimiter(
	namespace: string,
	rules: WindowRule[],
) {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			const enabled = await isRateLimitEnabled();
			if (!enabled) return next();

			const ip = getClientIp(req);
			const device = getDeviceId(req);
			const guest = getGuestKeyHash(req);

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

/** Comment: IP 100/min + 1000/day, Device 10/min + 100/day */
export const commentRateLimiter = createPublicRateLimiter('comment', [
	{ windowMs: 60_000, maxPerIp: 100, maxPerDevice: 10, label: '1 menit' },
	{ windowMs: 24 * 60 * 60 * 1000, maxPerIp: 1000, maxPerDevice: 100, label: '1 hari' },
]);

/**
 * Feedback: balanced anti-flood.
 * ~20/IP/hour, ~15/device/hour, ~10/guestKey/hour — blocks same-key flood without blocking normal users.
 */
export const feedbackRateLimiter = createPublicRateLimiter('feedback', [
	{
		windowMs: 60 * 60 * 1000,
		maxPerIp: 20,
		maxPerDevice: 15,
		maxPerGuestKey: 10,
		label: '1 jam',
	},
]);

/** Chat message/upload */
export const chatUploadRateLimiter = createPublicRateLimiter('chat-upload', [
	{ windowMs: 60_000, maxPerIp: 100, maxPerDevice: 30, label: '1 menit' },
	{ windowMs: 24 * 60 * 60 * 1000, maxPerIp: 1000, maxPerDevice: 300, label: '1 hari' },
]);

/** Soft cap: store checkout / buy-link */
export const storeCheckoutRateLimiter = createPublicRateLimiter('store-checkout', [
	{ windowMs: 60 * 60 * 1000, maxPerIp: 30, maxPerDevice: 20, label: '1 jam' },
]);

/** Soft cap: GDrive proxy POSTs */
export const gdriveProxyRateLimiter = createPublicRateLimiter('gdrive-proxy', [
	{ windowMs: 60_000, maxPerIp: 60, maxPerDevice: 40, label: '1 menit' },
]);

/** Soft cap: chat create/delete */
export const chatSessionRateLimiter = createPublicRateLimiter('chat-session', [
	{ windowMs: 60_000, maxPerIp: 30, maxPerDevice: 20, label: '1 menit' },
]);
