/**
 * Anggaran harian untuk endpoint LLM (chat Enco).
 *
 * Gerbang origin pada `/api/chat/message` hanya membaca header yang ditulis
 * klien, sehingga siapa pun bisa memicu panggilan model berbayar. Lapis ini
 * membatasi kerugian: jumlah pesan per IP per hari dan jumlah pesan global
 * per hari. Selalu aktif (tidak ikut toggle dashboard) karena menyangkut biaya.
 *
 * Dua lapis:
 *  - per IP: mencegah satu penyerang menghabiskan kuota sendiri-sendiri
 *  - global: pagar terakhir agar tagihan API key tidak meledak
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getTrustedClientIp } from '../lib/client-ip';

type Bucket = { count: number; resetAt: number };

const perIp = new Map<string, Bucket>();
let globalBucket: Bucket = { count: 0, resetAt: 0 };

function envInt(name: string, fallback: number): number {
	const v = parseInt(process.env[name] || '', 10);
	return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Awal hari berikutnya menurut zona WIB (UTC+7), dikembalikan sebagai epoch ms. */
function nextMidnightWibMs(from = Date.now()): number {
	const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
	const wibNow = new Date(from + WIB_OFFSET_MS);
	const next = Date.UTC(
		wibNow.getUTCFullYear(),
		wibNow.getUTCMonth(),
		wibNow.getUTCDate() + 1,
		0,
		0,
		0,
		0,
	);
	return next - WIB_OFFSET_MS;
}

function take(key: string, limit: number, now: number): { allowed: boolean; remaining: number; resetAt: number } {
	let bucket = perIp.get(key);
	if (!bucket || bucket.resetAt <= now) {
		bucket = { count: 0, resetAt: nextMidnightWibMs(now) };
		perIp.set(key, bucket);
	}
	if (bucket.count >= limit) {
		return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
	}
	bucket.count++;
	return { allowed: true, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

function takeGlobal(limit: number, now: number): { allowed: boolean; remaining: number; resetAt: number } {
	if (globalBucket.resetAt <= now) {
		globalBucket = { count: 0, resetAt: nextMidnightWibMs(now) };
	}
	if (globalBucket.count >= limit) {
		return { allowed: false, remaining: 0, resetAt: globalBucket.resetAt };
	}
	globalBucket.count++;
	return { allowed: true, remaining: Math.max(0, limit - globalBucket.count), resetAt: globalBucket.resetAt };
}

/** Sapu bucket kedaluwarsa agar map tidak tumbuh tanpa batas. */
setInterval(
	() => {
		const now = Date.now();
		perIp.forEach((b, k) => {
			if (b.resetAt <= now) perIp.delete(k);
		});
	},
	10 * 60 * 1000,
).unref?.();

export function llmDailyBudget(): RequestHandler {
	return (req: Request, res: Response, next: NextFunction) => {
		const now = Date.now();
		const perIpLimit = envInt('LLM_DAILY_PER_IP', 40);
		const globalLimit = envInt('LLM_DAILY_GLOBAL', 2000);
		const ip = getTrustedClientIp(req) || 'unknown';

		const globalCheck = takeGlobal(globalLimit, now);
		if (!globalCheck.allowed) {
			console.warn(`[llm-budget] kuota harian global habis (${globalLimit})`);
			return res.status(429).json({
				error: 'llm_daily_quota_exceeded',
				code: 'LLM_DAILY_QUOTA_EXCEEDED',
				scope: 'global',
				message:
					'Kuota harian asisten untuk seluruh situs telah habis. Silakan coba lagi besok.',
				retryAfterSeconds: Math.max(1, Math.ceil((globalCheck.resetAt - now) / 1000)),
			});
		}

		const ipCheck = take(`${ip}`, perIpLimit, now);
		if (!ipCheck.allowed) {
			return res.status(429).json({
				error: 'llm_daily_quota_exceeded',
				code: 'LLM_DAILY_QUOTA_EXCEEDED',
				scope: 'ip',
				message:
					'Batas harian pesan asisten untuk koneksi Anda telah tercapai. Silakan coba lagi besok.',
				retryAfterSeconds: Math.max(1, Math.ceil((ipCheck.resetAt - now) / 1000)),
			});
		}

		next();
	};
}

/** Untuk pengujian / observability. */
export function _resetLlmBudgetForTests() {
	perIp.clear();
	globalBucket = { count: 0, resetAt: 0 };
}
