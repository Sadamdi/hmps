import type { Request } from 'express';

/**
 * IP klien terpercaya di belakang Cloudflare / reverse proxy.
 * Urutan: CF-Connecting-IP → True-Client-IP → hop pertama X-Forwarded-For → req.ip.
 */
export function getTrustedClientIp(req: Request): string {
	const cf = String(req.headers['cf-connecting-ip'] || '').trim();
	if (cf) return cf;

	const trueClient = String(req.headers['true-client-ip'] || '').trim();
	if (trueClient) return trueClient;

	const xfwd = String(req.headers['x-forwarded-for'] || '').trim();
	if (xfwd) {
		const first = xfwd.split(',')[0]?.trim();
		if (first) return first;
	}

	const socketIp =
		req.ip ||
		(req.socket as { remoteAddress?: string })?.remoteAddress ||
		(req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
		'';
	return String(socketIp).replace(/^::ffff:/, '') || 'unknown';
}
