/**
 * Post-body-parser sanitization for API requests.
 * Scrubs nested string fields; blocks clear XSS probes on public write paths.
 */
import { NextFunction, Request, Response } from 'express';
import {
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

const CMS_HTML_KEYS = new Set([
	'content',
	'description',
	'fullDescription',
	'descriptionHtml',
	'aboutUs',
	'visionMission',
	'history',
	'rich_html',
]);

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
