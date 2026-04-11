import type { Request } from 'express';

const WINDOW_MS = 60 * 60 * 1000; // 1 jam
const MAX_FAILURES = 10;
const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 jam cooldown setelah limit tercapai

interface AttemptRecord {
	failures: number[];
	lockedUntil: number;
}

const store = new Map<string, AttemptRecord>();

setInterval(() => {
	const now = Date.now();
	for (const [key, rec] of Array.from(store.entries())) {
		if (now > rec.lockedUntil && rec.failures.every((ts) => now - ts > WINDOW_MS)) {
			store.delete(key);
		}
	}
}, 5 * 60 * 1000);

function getClientIp(req: Request): string {
	const xfwd = (req.headers['x-forwarded-for'] as string) || '';
	const forwardedIp = xfwd.split(',')[0]?.trim();
	return forwardedIp || req.ip || (req.connection as any)?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

function getOrCreate(ip: string): AttemptRecord {
	let rec = store.get(ip);
	if (!rec) {
		rec = { failures: [], lockedUntil: 0 };
		store.set(ip, rec);
	}
	return rec;
}

function pruneOld(rec: AttemptRecord) {
	const cutoff = Date.now() - WINDOW_MS;
	rec.failures = rec.failures.filter((ts) => ts > cutoff);
}

/**
 * Cek apakah IP sedang terkunci. Kembalikan { locked, retryAfter } (detik).
 */
export function checkRegistrationCodeLock(req: Request): { locked: boolean; retryAfter: number } {
	const ip = getClientIp(req);
	const rec = getOrCreate(ip);
	const now = Date.now();

	if (now < rec.lockedUntil) {
		return { locked: true, retryAfter: Math.ceil((rec.lockedUntil - now) / 1000) };
	}

	pruneOld(rec);
	if (rec.failures.length >= MAX_FAILURES) {
		rec.lockedUntil = now + LOCK_DURATION_MS;
		return { locked: true, retryAfter: Math.ceil(LOCK_DURATION_MS / 1000) };
	}

	return { locked: false, retryAfter: 0 };
}

/**
 * Catat satu percobaan gagal. Panggil setelah validasi kode mengembalikan "tidak valid".
 */
export function recordRegistrationCodeFailure(req: Request): void {
	const ip = getClientIp(req);
	const rec = getOrCreate(ip);
	pruneOld(rec);
	rec.failures.push(Date.now());

	if (rec.failures.length >= MAX_FAILURES) {
		rec.lockedUntil = Date.now() + LOCK_DURATION_MS;
	}
}
