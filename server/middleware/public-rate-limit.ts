import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { getMiddlewareSettings } from '../models/middleware-settings';

// ==================== SETTINGS CACHE ====================
let settingsCache: any = null;
let settingsCacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function isRateLimitEnabled(): Promise<boolean> {
	const now = Date.now();
	if (!settingsCache || now - settingsCacheTs > CACHE_TTL) {
		try {
			settingsCache = await getMiddlewareSettings();
			settingsCacheTs = now;
		} catch {
			settingsCache = { apiRateLimitEnabled: true };
		}
	}
	return settingsCache.apiRateLimitEnabled !== false;
}

// ==================== HELPERS ====================
function getClientIp(req: Request): string {
	const xfwd = (req.headers['x-forwarded-for'] as string) || '';
	const forwardedIp = xfwd.split(',')[0]?.trim();
	return forwardedIp || req.ip || (req.connection as any)?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

function getDeviceId(req: Request): string {
	const ua = req.get('User-Agent') || '';
	const lang = req.get('Accept-Language') || '';
	const enc = req.get('Accept-Encoding') || '';
	const ip = getClientIp(req);
	return crypto.createHash('sha256').update(`${ua}|${lang}|${enc}|${ip}`).digest('hex').substring(0, 16);
}

// ==================== IN-MEMORY COUNTER ====================
interface BucketEntry { count: number; resetTime: number }

const buckets = new Map<string, BucketEntry>();

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
setInterval(() => {
	const now = Date.now();
	for (const [k, v] of Array.from(buckets.entries())) {
		if (now > v.resetTime) buckets.delete(k);
	}
}, 2 * 60 * 1000);

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
	label: string; // human-readable, e.g. "1 menit"
}

/**
 * Create an Express middleware that enforces multiple window rules
 * on both IP and device fingerprint. Respects the dashboard toggle
 * `apiRateLimitEnabled`.
 *
 * Usage:
 *   const limiter = createPublicRateLimiter('comment-post', [
 *     { windowMs: 60_000, maxPerIp: 100, maxPerDevice: 10, label: '1 menit' },
 *     { windowMs: 86_400_000, maxPerIp: 1000, maxPerDevice: 100, label: '1 hari' },
 *   ]);
 *   router.post('/', limiter, handler);
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

			for (const rule of rules) {
				const ipKey = `prl:${namespace}:ip:${rule.windowMs}:${ip}`;
				const devKey = `prl:${namespace}:dev:${rule.windowMs}:${device}`;

				const ipEntry = increment(ipKey, rule.windowMs);
				const devEntry = increment(devKey, rule.windowMs);

				if (ipEntry.count > rule.maxPerIp) {
					const retry = Math.ceil((ipEntry.resetTime - Date.now()) / 1000);
					console.log(`🚨 PublicRateLimit [${namespace}] IP ${ip} exceeded ${rule.maxPerIp}/${rule.label}`);
					return send429(res, retry, rule.label);
				}
				if (devEntry.count > rule.maxPerDevice) {
					const retry = Math.ceil((devEntry.resetTime - Date.now()) / 1000);
					console.log(`🚨 PublicRateLimit [${namespace}] Device ${device} exceeded ${rule.maxPerDevice}/${rule.label}`);
					return send429(res, retry, rule.label);
				}
			}

			next();
		} catch (err) {
			console.error('PublicRateLimit error:', err);
			next();
		}
	};
}

// ==================== PRE-BUILT LIMITERS ====================

/** Comment: IP 100/min + 1000/day, Device 10/min + 100/day */
export const commentRateLimiter = createPublicRateLimiter('comment', [
	{ windowMs: 60_000, maxPerIp: 100, maxPerDevice: 10, label: '1 menit' },
	{ windowMs: 24 * 60 * 60 * 1000, maxPerIp: 1000, maxPerDevice: 100, label: '1 hari' },
]);

/** Feedback: IP 50/hour, Device 10/hour */
export const feedbackRateLimiter = createPublicRateLimiter('feedback', [
	{ windowMs: 60 * 60 * 1000, maxPerIp: 50, maxPerDevice: 10, label: '1 jam' },
]);

/** Chat/upload: same rules as comment */
export const chatUploadRateLimiter = createPublicRateLimiter('chat-upload', [
	{ windowMs: 60_000, maxPerIp: 100, maxPerDevice: 10, label: '1 menit' },
	{ windowMs: 24 * 60 * 60 * 1000, maxPerIp: 1000, maxPerDevice: 100, label: '1 hari' },
]);
