/**
 * Post-body-parser sanitization for API requests.
 * Scrubs nested string fields; blocks clear XSS probes on public write paths.
 */
import { NextFunction, Request, Response } from 'express';
import { isCommonWeakPassword } from '../lib/weak-passwords';
import {
	CMS_HTML_KEYS,
	looksLikeXss,
	sanitizeObjectStrings,
} from '../utils/input-sanitize';

const PUBLIC_WRITE_PREFIXES = [
	'/api/feedback',
	'/api/comments',
	'/api/chat',
	'/api/system-errors/report',
	'/api/auth/login',
	'/api/auth/forgot-password',
	'/api/register',
	'/api/store/checkout',
	'/api/store/direct-checkout',
	'/api/store/buy-link',
	'/api/store/cart',
	'/api/gdrive',
];

function normalizeApiPath(path: string): string {
	// Tenant rewrite leaves /api/...; also handle /api/c/:slug/...
	const m = path.match(/^\/api\/c\/[^/]+(\/.*)?$/);
	if (m) return `/api${m[1] || ''}`;
	return path;
}

function isPublicWrite(req: Request): boolean {
	if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return false;
	const p = normalizeApiPath(req.path || req.url || '');
	return PUBLIC_WRITE_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/') || p.startsWith(prefix));
}

function collectStringLeaves(value: unknown, out: string[], depth = 0): void {
	if (depth > 8) return;
	if (typeof value === 'string') {
		out.push(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const v of value) collectStringLeaves(v, out, depth + 1);
		return;
	}
	if (value && typeof value === 'object') {
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			// Skip intentional CMS HTML keys here — they use allowlist sanitize at route level
			if (CMS_HTML_KEYS.has(k)) continue;
			collectStringLeaves(v, out, depth + 1);
		}
	}
}

export function postBodySanitizeMiddleware(req: Request, res: Response, next: NextFunction) {
	try {
		const path = req.path || '';
		if (!path.startsWith('/api')) return next();

		if (req.body && typeof req.body === 'object') {
			req.body = sanitizeObjectStrings(req.body) as typeof req.body;
		}
		if (req.query && typeof req.query === 'object') {
			req.query = sanitizeObjectStrings(req.query) as typeof req.query;
		}

		// Password yang DIATUR (daftar/ubah/reset) tidak boleh umum/bawaan seperti "admin123". Jalur login dikecualikan
		// (di sana password hanya dibandingkan; akun berpassword bawaan ditolak oleh finalizeLogin).
		if (
			['POST', 'PUT', 'PATCH'].includes(req.method) &&
			req.body &&
			typeof req.body === 'object' &&
			!/(login|signin|switch-to-staff|google)/i.test(path)
		) {
			for (const k of ['password', 'newPassword', 'ownerPassword']) {
				const v = (req.body as Record<string, unknown>)[k];
				if (typeof v === 'string' && v && isCommonWeakPassword(v)) {
					return res.status(400).json({
						message: 'Password terlalu umum/mudah ditebak. Gunakan kombinasi unik minimal 8 karakter.',
						error: { code: 'WEAK_PASSWORD' },
					});
				}
			}
		}

		// Block obvious XSS probes on public write endpoints (text fields)
		if (isPublicWrite(req) && req.body) {
			const strings: string[] = [];
			collectStringLeaves(req.body, strings);
			for (const s of strings) {
				if (looksLikeXss(s)) {
					return res.status(400).json({
						message: 'Konten mengandung pola tidak diizinkan',
						error: { code: 'XSS_REJECTED' },
					});
				}
			}
		}

		next();
	} catch (err) {
		console.error('postBodySanitizeMiddleware error:', err);
		next();
	}
}
