import { NextFunction, Request, Response } from 'express';
import { getTrustedClientIp } from '../lib/client-ip';
import { isTrustedOrigin } from '../config/trusted-network';

/**
 * Hardening khusus endpoint chat: menolak request mutasi (/api/chat/message)
 * yang bukan dari origin tepercaya dan tanpa bukti same-site browser.
 *
 * - FE resmi selalu mengirim Origin/Referer https://himatif-encoder.com (atau host tepercaya lain).
 * - Browser fetch dari FE resmi mengirim header Sec-Fetch-Site: same-origin|same-site.
 * - Curl/Postman TANPA Origin/Referer + tanpa Sec-Fetch-Site same-* harus ditolak.
 *
 * Middleware ini TIDAK menggantikan api-protection global; ini pengaman kedua
 * khusus chat. Endpoint read (GET /api/chat/*, /history, /all) tetap lolos.
 */
export function requireTrustedChatOrigin(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	try {
		// Hanya untuk method mutasi (POST/PUT/PATCH/DELETE). GET tetap lewat.
		const m = String(req.method || 'GET').toUpperCase();
		if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') {
			return next();
		}

		const origin = String(req.headers['origin'] || '').trim();
		const referer = String(req.headers['referer'] || '').trim();
		const secFetchSite = String(req.headers['sec-fetch-site'] || '').trim().toLowerCase();
		const secFetchMode = String(req.headers['sec-fetch-mode'] || '').trim().toLowerCase();
		const userAgent = String(req.headers['user-agent'] || '').trim();

		// 1. Header Sec-Fetch-Site same-origin / same-site adalah bukti kuat bahwa
		//    request datang dari browser FE resmi (fetch/XHR/form). Browser akan
		//    mengirim ini otomatis; curl biasanya tidak.
		const isSameSite = secFetchSite === 'same-origin' || secFetchSite === 'same-site';

		// 2. Fallback: Origin atau Referer termasuk host tepercaya (FE resmi / komunitas).
		const trustedFromOrigin = isTrustedOrigin(origin) || isTrustedOrigin(referer);

		// 3. Browser fetch (cors navigation form) biasanya juga membawa
		//    Accept: application/json atau Sec-Fetch-Mode=cors. Tanpa salah satu pun,
		//    tolak.
		//    SSE perlu Accept: text/event-stream (atau */* + Sec-Fetch-Mode=cors).
		const accept = String(req.headers['accept'] || '');
		const looksLikeBrowserFetch =
			(secFetchMode === 'cors' || secFetchMode === 'navigate' || secFetchMode === 'no-cors') ||
			accept.includes('application/json') ||
			accept.includes('text/event-stream') ||
			accept.includes('*/*');

		const ok = isSameSite || trustedFromOrigin;

		if (!ok || (!looksLikeBrowserFetch && !userAgent)) {
			console.warn(
				`[chat-origin-gate] blocked method=${m} ip=${getTrustedClientIp(req)} ` +
					`secFetchSite=${secFetchSite || '-'} origin=${origin || '-'} referer=${referer ? referer.slice(0, 80) : '-'}`,
			);
			res.status(403).json({
				error: 'trusted_frontend_required',
				message:
					'Akses chat hanya diizinkan dari frontend resmi Himatif Encoder. Buka situs untuk mengirim pesan.',
			});
			return;
		}

		return next();
	} catch (err) {
		console.error('[chat-origin-gate] error:', err);
		return next();
	}
}