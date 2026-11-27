/**
 * Pratinjau link karya non-repo (Figma, Behance, itch.io, YouTube, situs apa pun): judul, deskripsi,
 * gambar (Open Graph / Twitter card), sumber yang dikenali, saran kategori & tag.
 *
 * Keamanan: hanya https; IP tujuan divalidasi publik saat koneksi (agent undici, anti DNS rebinding);
 * redirect manual maks 4 hop; body maks 512 KB; timeout 8 dtk. Gambar hasil pratinjau diberi tanda tangan
 * HMAC agar klien hanya bisa menyimpan gambar yang memang berasal dari pratinjau server.
 */
import crypto from 'crypto';
import { karyaSourceOf } from '@shared/karya-sources';
import { publicOnlyAgent, resolvesPublic } from './embed-domain-analysis';

const MAX_BYTES = 512 * 1024;

export interface LinkPreview {
	url: string;
	finalUrl: string;
	title: string;
	description: string;
	siteName: string;
	images: { url: string; sig: string }[];
	source: { id: string; label: string; linkLabel: string } | null;
	categories: string[];
	tags: string[];
	youtube: boolean;
}

export class LinkPreviewError extends Error {
	constructor(message: string, public code: string) {
		super(message);
	}
}

const secret = () => `${process.env.JWT_SECRET || 'hmti-secret-key-change-in-production'}::karya-media`;
export function signMediaUrl(url: string): string {
	return crypto.createHmac('sha256', secret()).update(url).digest('base64url').slice(0, 32);
}
export function verifyMediaUrl(url: string, sig: string): boolean {
	const a = Buffer.from(signMediaUrl(url));
	const b = Buffer.from(String(sig || ''));
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function decode(s: string): string {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
		.replace(/\s+/g, ' ')
		.trim();
}

function meta(html: string, names: string[]): string {
	for (const n of names) {
		const re = new RegExp(`<meta[^>]+(?:property|name)=["']${n.replace(/[:.]/g, '\\$&')}["'][^>]*>`, 'i');
		const tag = html.match(re)?.[0];
		const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
		if (content) return decode(content);
	}
	return '';
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
	let current = url;
	for (let hop = 0; hop < 5; hop++) {
		const u = new URL(current);
		if (u.protocol !== 'https:') throw new LinkPreviewError('Link wajib https://', 'LINK_INVALID');
		if (!(await resolvesPublic(u.hostname))) throw new LinkPreviewError('Alamat link tidak bisa diakses publik', 'LINK_UNREACHABLE');
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), 8000);
		let res: Response;
		try {
			res = await fetch(u.toString(), {
				redirect: 'manual',
				signal: ctrl.signal,
				// @ts-expect-error dispatcher undici (fetch bawaan Node)
				dispatcher: publicOnlyAgent,
				headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HimatifLinkPreview/1.0; +https://himatif-encoder.com)', Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'id,en;q=0.8' },
			});
		} catch {
			clearTimeout(t);
			throw new LinkPreviewError('Link tidak bisa dibuka (timeout / ditolak situs)', 'LINK_UNREACHABLE');
		}
		if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
			clearTimeout(t);
			await res.body?.cancel().catch(() => null);
			current = new URL(res.headers.get('location')!, u).toString();
			continue;
		}
		if (res.status >= 400) {
			clearTimeout(t);
			throw new LinkPreviewError(`Situs membalas HTTP ${res.status}. Pastikan link bisa dibuka publik.`, 'LINK_UNREACHABLE');
		}
		const chunks: Uint8Array[] = [];
		let size = 0;
		const reader = res.body?.getReader();
		while (reader && size < MAX_BYTES) {
			const { done, value } = await reader.read();
			if (done || !value) break;
			chunks.push(value);
			size += value.length;
		}
		await reader?.cancel().catch(() => null);
		clearTimeout(t);
		return { html: Buffer.concat(chunks).toString('utf8'), finalUrl: u.toString() };
	}
	throw new LinkPreviewError('Terlalu banyak pengalihan', 'LINK_UNREACHABLE');
}

async function fetchOEmbed(endpoint: string): Promise<Record<string, unknown> | null> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 8000);
	try {
		// @ts-expect-error dispatcher undici (fetch bawaan Node)
		const r = await fetch(endpoint, { signal: ctrl.signal, dispatcher: publicOnlyAgent, headers: { Accept: 'application/json' } });
		if (!r.ok) return null;
		return (await r.json()) as Record<string, unknown>;
	} catch {
		return null;
	} finally {
		clearTimeout(t);
	}
}

export async function fetchLinkPreview(raw: string): Promise<LinkPreview> {
	let url: URL;
	try {
		url = new URL(String(raw || '').trim());
	} catch {
		throw new LinkPreviewError('Link tidak valid', 'LINK_INVALID');
	}
	if (url.protocol !== 'https:') throw new LinkPreviewError('Link wajib https://', 'LINK_INVALID');
	const source = karyaSourceOf(url.toString());
	// YouTube & Vimeo: halaman untuk bot sering berupa persetujuan cookie tanpa Open Graph → pakai oEmbed resmi
	const oembedBase = source?.id === 'youtube' ? 'https://www.youtube.com/oembed' : source?.id === 'vimeo' ? 'https://vimeo.com/api/oembed.json' : '';
	if (oembedBase) {
		const oe = await fetchOEmbed(`${oembedBase}?format=json&url=${encodeURIComponent(url.toString())}`);
		if (oe?.title) {
			const thumb = /^https:\/\//i.test(String(oe.thumbnail_url || '')) ? String(oe.thumbnail_url) : '';
			return {
				url: url.toString(),
				finalUrl: url.toString(),
				title: String(oe.title).slice(0, 120),
				description: oe.author_name ? `Video oleh ${String(oe.author_name).slice(0, 80)}` : '',
				siteName: source!.label,
				images: thumb ? [{ url: thumb, sig: signMediaUrl(thumb) }] : [],
				source: { id: source!.id, label: source!.label, linkLabel: source!.linkLabel },
				categories: source!.categories,
				tags: source!.tags,
				youtube: source!.id === 'youtube',
			};
		}
	}
	const { html, finalUrl } = await fetchHtml(url.toString());
	const title = meta(html, ['og:title', 'twitter:title']) || decode(html.match(/<title[^>]*>([^<]{0,300})/i)?.[1] || '');
	const description = meta(html, ['og:description', 'twitter:description', 'description']);
	const siteName = meta(html, ['og:site_name', 'application-name']) || source?.label || new URL(finalUrl).hostname;
	const imgs = [meta(html, ['og:image:secure_url', 'og:image']), meta(html, ['twitter:image', 'twitter:image:src'])]
		.map((u) => {
			try {
				return u ? new URL(u, finalUrl).toString() : '';
			} catch {
				return '';
			}
		})
		.filter((u, i, a) => /^https:\/\//i.test(u) && a.indexOf(u) === i)
		.slice(0, 2);
	const isYt = source?.id === 'youtube';
	return {
		url: url.toString(),
		finalUrl,
		title: title.slice(0, 120),
		description: description.slice(0, 500),
		siteName: siteName.slice(0, 60),
		images: imgs.map((u) => ({ url: u, sig: signMediaUrl(u) })),
		source: source ? { id: source.id, label: source.label, linkLabel: source.linkLabel } : null,
		categories: source?.categories || [],
		tags: source?.tags || [],
		youtube: isYt,
	};
}
