/**
 * Shared input sanitization helpers for public + authenticated writes.
 * Used after body parsers so JSON/multipart fields are actually present.
 */

import crypto from 'crypto';

const XSS_LIKE =
	/<script\b|<\/script\s*>|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|on\w+\s*=|<\s*xss\b|<\s*iframe\b|<\s*object\b|<\s*embed\b|<\s*svg\b[^>]*\bon|expression\s*\(|eval\s*\(/i;

const EVENT_HANDLER_ATTR = /\s(on\w+|javascript:)\s*=/gi;

/** True if string looks like an XSS / HTML-injection probe. */
export function looksLikeXss(value: string): boolean {
	if (!value || typeof value !== 'string') return false;
	return XSS_LIKE.test(value);
}

/** Strip script tags and event-handler / javascript: attributes. */
export function stripUnsafeHtml(html: string): string {
	if (!html || typeof html !== 'string') return '';
	return html
		.replace(/<script\b[\s\S]*?<\/script>/gi, '')
		.replace(EVENT_HANDLER_ATTR, ' data-stripped=')
		.replace(/javascript\s*:/gi, '');
}

/** Plain-text fields: strip tags + event handlers; reject if still XSS-like. */
export function sanitizePlainText(value: string, maxLen = 5000): { ok: true; value: string } | { ok: false; message: string } {
	if (typeof value !== 'string') return { ok: false, message: 'Nilai teks tidak valid' };
	let v = value.trim();
	if (!v) return { ok: true, value: '' };
	v = stripUnsafeHtml(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
	if (looksLikeXss(value) || looksLikeXss(v)) {
		return { ok: false, message: 'Konten mengandung pola tidak diizinkan' };
	}
	if (v.length > maxLen) v = v.slice(0, maxLen);
	return { ok: true, value: v };
}

/**
 * Allowlisted HTML for CMS (berita/events/library/store/settings).
 * Removes scripts and event handlers; keeps common formatting tags.
 */
export function sanitizeRichHtml(html: string, maxLen = 500_000): string {
	if (!html || typeof html !== 'string') return '';
	let out = stripUnsafeHtml(html);
	// Remove remaining dangerous tags entirely
	out = out.replace(/<\/?(?:iframe|object|embed|link|meta|base|form|input|button)\b[^>]*>/gi, '');
	if (out.length > maxLen) out = out.slice(0, maxLen);
	return out;
}

/** Recursively sanitize string values in plain objects/arrays (top-level + nested). */
export function sanitizeObjectStrings(input: unknown, depth = 0): unknown {
	if (depth > 8) return input;
	if (typeof input === 'string') {
		return stripUnsafeHtml(input);
	}
	if (Array.isArray(input)) {
		return input.map((v) => sanitizeObjectStrings(v, depth + 1));
	}
	if (input && typeof input === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
			out[k] = sanitizeObjectStrings(v, depth + 1);
		}
		return out;
	}
	return input;
}

/** Hash client IP for forensics without storing raw IP. */
export function hashIp(ip: string, pepper?: string): string {
	const p = pepper || process.env.GUEST_KEY_PEPPER || 'hmps-comment-pepper';
	return crypto.createHmac('sha256', p).update(String(ip || 'unknown')).digest('hex');
}

export function getRequestClientIp(req: { headers?: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string } }): string {
	const xfwd = String(req.headers?.['x-forwarded-for'] || '');
	const forwardedIp = xfwd.split(',')[0]?.trim();
	return forwardedIp || req.ip || req.socket?.remoteAddress || 'unknown';
}
