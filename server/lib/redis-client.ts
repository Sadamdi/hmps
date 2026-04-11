import Redis from 'ioredis';

let shared: Redis | null | undefined;

/**
 * Klien Redis singleton (opsional). Set `REDIS_URL` di .env, mis. `redis://127.0.0.1:6379`
 * untuk cache + rate limit bersama antar worker PM2.
 */
export function getSharedRedis(): Redis | null {
	if (shared !== undefined) return shared;
	const url = process.env.REDIS_URL?.trim();
	if (!url) {
		shared = null;
		return null;
	}
	try {
		shared = new Redis(url, {
			maxRetriesPerRequest: 3,
			enableOfflineQueue: false,
			lazyConnect: true,
		});
		shared.on('error', (e) =>
			console.error('[redis]', e instanceof Error ? e.message : e),
		);
		shared.connect().catch(() => {
			/* log di error handler */
		});
		return shared;
	} catch {
		shared = null;
		return null;
	}
}

export function isRedisConfigured(): boolean {
	return !!process.env.REDIS_URL?.trim();
}
