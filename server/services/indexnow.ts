import crypto from 'crypto';

type IndexNowSource = 'berita' | 'event' | 'library';

function isIndexNowEnabled(): boolean {
	const raw = String(process.env.INDEXNOW_ENABLED || '')
		.trim()
		.toLowerCase();
	return raw === '1' || raw === 'true' || raw === 'yes';
}

function getHost(): string {
	return String(
		process.env.INDEXNOW_HOST || 'https://himatif-encoder.com',
	).trim();
}

function getKey(): string {
	return String(process.env.INDEXNOW_KEY || '').trim();
}

function getKeyLocation(host: string): string {
	const cfg = String(process.env.INDEXNOW_KEY_LOCATION || '').trim();
	if (cfg) return cfg;
	const key = getKey();
	if (!key) return '';
	return `${host.replace(/\/+$/, '')}/${key}.txt`;
}

function normalizePath(pathname: string): string {
	const p = String(pathname || '').trim();
	if (!p) return '/';
	return p.startsWith('/') ? p : `/${p}`;
}

function shouldSkipPath(pathname: string): boolean {
	const p = normalizePath(pathname);
	// Skip private or non-indexable paths.
	if (p.startsWith('/dashboard')) return true;
	if (p.startsWith('/api')) return true;
	if (p === '/login' || p === '/error') return true;
	return false;
}

function isLikelyPublicContentPath(pathname: string): boolean {
	const p = normalizePath(pathname);
	return (
		p.startsWith('/berita/') ||
		p.startsWith('/events/') ||
		p.startsWith('/library/') ||
		p === '/berita' ||
		p === '/events' ||
		p === '/library' ||
		p === '/prodi' ||
		p === '/profil' ||
		p === '/kelembagaan' ||
		p === '/'
	);
}

async function postIndexNow(urls: string[]): Promise<void> {
	if (!isIndexNowEnabled()) return;
	const key = getKey();
	if (!key) {
		console.warn('[indexnow] enabled but INDEXNOW_KEY is empty');
		return;
	}
	const host = getHost().replace(/\/+$/, '');
	const endpoint = String(
		process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow',
	).trim();
	const keyLocation = getKeyLocation(host);

	if (!endpoint) {
		console.warn('[indexnow] endpoint is empty');
		return;
	}

	const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
	if (uniqueUrls.length === 0) return;

	const payload = {
		host: host.replace(/^https?:\/\//, ''),
		key,
		keyLocation,
		urlList: uniqueUrls,
	};

	const startedAt = Date.now();
	const res = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const txt = await res.text().catch(() => '');
		throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`.trim());
	}
	console.log(
		`[indexnow] ping success (${uniqueUrls.length} urls) in ${Date.now() - startedAt}ms`,
	);
}

function pickInterestingPaths(paths: string[]): string[] {
	const normalized = paths
		.map((p) => normalizePath(p))
		.filter((p) => !shouldSkipPath(p))
		.filter((p) => isLikelyPublicContentPath(p));
	return Array.from(new Set(normalized));
}

export async function pingIndexNowPaths(paths: string[]): Promise<void> {
	const host = getHost().replace(/\/+$/, '');
	const selected = pickInterestingPaths(paths);
	if (selected.length === 0) return;
	const urls = selected.map((p) => `${host}${p}`);
	await postIndexNow(urls);
}

export async function pingIndexNowForContent(opts: {
	source: IndexNowSource;
	slugOrPath?: string;
	year?: number;
	eventSlug?: string;
}): Promise<void> {
	const host = getHost().replace(/\/+$/, '');
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

	if (urls.length === 0) return;
	await postIndexNow(urls);
}

/**
 * Helper to build a deterministic key suggestion when ops has not provisioned
 * one yet. This is only diagnostic and never used as runtime key.
 */
export function suggestIndexNowKey(seed?: string): string {
	const s = String(seed || process.env.HOSTNAME || 'himatif-encoder');
	return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
}
