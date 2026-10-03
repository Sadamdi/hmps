/**
 * Satu pintu notify konten publik: IndexNow + Facebook scrape (env-gated).
 * Fire-and-forget aman — kesalahan tidak boleh gagalkan publish.
 */
import {
	pingIndexNowForContent,
	pingIndexNowHubPages,
	pingIndexNowPaths,
} from './indexnow';
import { scrapeFacebookUrls } from './facebook-scrape';

type ContentSource = 'berita' | 'event' | 'library';

function getHost(): string {
	return String(
		process.env.INDEXNOW_HOST || 'https://himatif-encoder.com',
	)
		.trim()
		.replace(/\/+$/, '');
}

/** Debounce hub-page pings agar publish massal tidak spam. */
let lastHubPingAt = 0;
const HUB_DEBOUNCE_MS = Math.max(
	60_000,
	Number(process.env.PUBLIC_NOTIFY_HUB_DEBOUNCE_MS || 5 * 60_000) ||
		5 * 60_000,
);

async function maybePingHubs(): Promise<void> {
	const now = Date.now();
	if (now - lastHubPingAt < HUB_DEBOUNCE_MS) return;
	lastHubPingAt = now;
	await pingIndexNowHubPages();
	const host = getHost();
	const hubUrls = [
		`${host}/`,
		`${host}/berita`,
		`${host}/events`,
		`${host}/library`,
		`${host}/profil`,
		`${host}/kelembagaan`,
		`${host}/prodi`,
		`${host}/toko`,
	];
	await scrapeFacebookUrls(hubUrls);
}

function contentAbsoluteUrls(opts: {
	source: ContentSource;
	slugOrPath?: string;
	year?: number;
	eventSlug?: string;
}): string[] {
	const host = getHost();
	const urls: string[] = [];
	if (opts.source === 'berita' && opts.slugOrPath) {
		const slug = String(opts.slugOrPath).replace(/^\/+|\/+$/g, '');
		if (slug) {
			urls.push(`${host}/berita/${slug}`);
			urls.push(`${host}/berita`);
		}
	}
	if (opts.source === 'event') {
		const y = Number(opts.year);
		const slug = String(opts.eventSlug || '').replace(/^\/+|\/+$/g, '');
		if (Number.isFinite(y) && slug) {
			urls.push(`${host}/events/${y}/${slug}`);
			urls.push(`${host}/events/${y}`);
			urls.push(`${host}/events`);
		}
	}
	if (opts.source === 'library' && opts.slugOrPath) {
		const slug = String(opts.slugOrPath).replace(/^\/+|\/+$/g, '');
		if (slug) {
			urls.push(`${host}/library/${slug}`);
			urls.push(`${host}/library`);
		}
	}
	return urls;
}

/** Notify satu konten published: IndexNow + FB scrape + hub (debounce). */
export async function notifyPublicContent(opts: {
	source: ContentSource;
	slugOrPath?: string;
	year?: number;
	eventSlug?: string;
}): Promise<void> {
	try {
		await pingIndexNowForContent(opts);
	} catch (e) {
		console.error('[public-notify] IndexNow content failed:', e);
	}

	const urls = contentAbsoluteUrls(opts);
	try {
		await scrapeFacebookUrls(urls);
	} catch (e) {
		console.error('[public-notify] Facebook scrape content failed:', e);
	}

	try {
		await maybePingHubs();
	} catch (e) {
		console.error('[public-notify] hub ping failed:', e);
	}
}

/** Notify daftar path/URL publik ad-hoc (ops/manual). */
export async function notifyPublicPaths(paths: string[]): Promise<void> {
	try {
		await pingIndexNowPaths(paths);
	} catch (e) {
		console.error('[public-notify] IndexNow paths failed:', e);
	}
	const host = getHost();
	const urls = paths
		.map((p) => String(p || '').trim())
		.filter(Boolean)
		.map((p) => (p.startsWith('http') ? p : `${host}${p.startsWith('/') ? p : `/${p}`}`));
	try {
		await scrapeFacebookUrls(urls);
	} catch (e) {
		console.error('[public-notify] Facebook scrape paths failed:', e);
	}
}
