import type { ShortJsonCache } from './short-cache';
import { getSharedRedis } from './redis-client';

const PREFIX = 'hmps:public:';

/** Baca cache JSON: memori dulu, lalu Redis (shared antar PM2). */
export async function readPublicJsonCache(
	memory: ShortJsonCache,
	redisKeySuffix: string,
): Promise<string | null> {
	const mem = memory.get(redisKeySuffix);
	if (mem) return mem;
	const r = getSharedRedis();
	if (!r) return null;
	try {
		const v = await r.get(`${PREFIX}${redisKeySuffix}`);
		return v ?? null;
	} catch {
		return null;
	}
}

/** Tulis cache JSON ke memori + Redis (TTL detik). */
export async function writePublicJsonCache(
	memory: ShortJsonCache,
	redisKeySuffix: string,
	body: string,
	ttlMs: number,
): Promise<void> {
	memory.set(redisKeySuffix, body);
	const r = getSharedRedis();
	if (!r) return;
	try {
		const sec = Math.max(1, Math.ceil(ttlMs / 1000));
		await r.setex(`${PREFIX}${redisKeySuffix}`, sec, body);
	} catch {
		/* ignore */
	}
}
