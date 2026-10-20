/**
 * Shared input sanitization helpers for public + authenticated writes.
 * Used after body parsers so JSON/multipart fields are actually present.
 */

import crypto from 'crypto';
import { getTrustedClientIp } from '../lib/client-ip';
import { sanitizeCmsHtml } from './cms-html';

/** Kunci body yang berisi HTML CMS (dirender sebagai HTML di klien): disanitasi dengan daftar putih. */
export const CMS_HTML_KEYS = new Set([
	'content',
	'description',
	'fullDescription',
	'descriptionHtml',
	'aboutUs',
	'visionMission',
	'history',
	'rich_html',
]);

const XSS_LIKE =
	/<script\b|<\/script\s*>|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|on\w+\s*=|<\s*xss\b|<\s*iframe\b|<\s*object\b|<\s*embed\b|<\s*svg\b[^>]*\bon|expression\s*\(|eval\s*\(/i;

const EVENT_HANDLER_ATTR = /\s(on\w+|javascript:)\s*=/gi;

/** True if string looks like an XSS / HTML-injection probe. */
export function looksLikeXss(value: string): boolean {
	if (!value || typeof value !== 'string') return false;
	return XSS_LIKE.test(value);
}

const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif);/;
const NAMED_ENTITIES: Record<string, string> = { tab: '', newline: '', colon: ':', lpar: '(', rpar: ')', sol: '/' };

/** Dekode entity HTML umum + buang karakter kontrol/spasi, seperti yang dilakukan browser pada skema URL. */
function normalizeUrlForCheck(raw: string): string {
	let v = raw.replace(/^["']|["']$/g, '');
	for (let i = 0; i < 2; i++) {
		v = v
			.replace(/&#x([0-9a-f]+);?/gi, (_m, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
			.replace(/&#(\d+);?/g, (_m, d) => String.fromCodePoint(Math.min(parseInt(d, 10), 0x10ffff)))
			.replace(/&(tab|newline|colon|lpar|rpar|sol);?/gi, (_m, n) => NAMED_ENTITIES[String(n).toLowerCase()]);
	}
	return v.replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '').toLowerCase();
}

function isDangerousUrl(raw: string): boolean {
	const v = normalizeUrlForCheck(raw);
	if (/^(javascript|vbscript|livescript|mocha):/.test(v)) return true;
	return v.startsWith('data:') && !SAFE_DATA_IMAGE.test(v);
}

const TAG_PARTS = /^<([a-z][^\s/>]*)([\s\S]*?)(\/?>)$/i;
/** Satu atribut: nama (tanpa spasi, "/", kutip, "=") + nilai opsional. "/" di antara atribut ikut menjadi pemisah. */
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
const URL_ATTR_NAMES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background', 'srcset', 'data']);

/** Bersihkan satu tag: buang atribut on*, dan netralkan URL berskema berbahaya. */
function cleanTag(tag: string): string {
	const m = TAG_PARTS.exec(tag);
	if (!m) return tag;
	const [, name, rest, end] = m;
	const cleaned = rest.replace(ATTRIBUTE, (full, attr: string, val?: string) => {
		const lower = attr.toLowerCase();
		if (lower.startsWith('on')) return '';
		if (val && URL_ATTR_NAMES.has(lower) && isDangerousUrl(val)) return `${attr}="#"`;
		return full;
	});
	return `<${name}${cleaned}${end}`;
}

/** Strip script tags and event-handler / javascript: attributes. */
export function stripUnsafeHtml(html: string): string {
	if (!html || typeof html !== 'string') return '';
	return html
		.replace(/<script\b[\s\S]*?<\/script>/gi, '')
		.replace(/<[a-z][^>]*>/gi, cleanTag)
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
	return sanitizeCmsHtml(stripUnsafeHtml(html), maxLen);
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
			out[k] =
				typeof v === 'string' && CMS_HTML_KEYS.has(k)
					? sanitizeCmsHtml(stripUnsafeHtml(v))
					: sanitizeObjectStrings(v, depth + 1);
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
	return getTrustedClientIp(req as any);
}
