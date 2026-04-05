/**
 * Rewrites same-origin API paths to tenant-scoped `/api/c/:slug/...` when the browser
 * is on a community path (`/:slug/...`). Used by fetch defaults and apiRequest.
 */
const RESERVED_FIRST_SEGMENTS = new Set([
	'',
	'api',
	'assets',
	'attached_assets',
	'uploads',
	'berita',
	'login',
	'register',
	'forgot-password',
	'error',
	'profil',
	'kelembagaan',
	'prodi',
	'events',
	'library',
	'dashboard',
	'communities',
	'sitemap.xml',
]);

const MAIN_ONLY_API_PREFIXES = ['/api/register', '/api/communities', '/api/registration'];

function isMainOnlyApi(url: string): boolean {
	return MAIN_ONLY_API_PREFIXES.some(
		(p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`),
	);
}

export function rewriteApiUrlForTenantPath(url: string): string {
	if (typeof window === 'undefined') return url;
	// Sudah scoped tenant atau main-only: jangan rewrite dua kali (hindari /api/c/x/api/c/x/...)
	if (!url.startsWith('/api/') || url.startsWith('/api/c/')) return url;
	if (isMainOnlyApi(url)) return url;

	const m = window.location.pathname.match(/^\/([a-zA-Z0-9_-]+)(?:\/|$)/);
	if (!m) return url;
	const first = m[1].toLowerCase();
	if (RESERVED_FIRST_SEGMENTS.has(first)) return url;

	const rest = url.replace(/^\/api/, '');
	return `/api/c/${m[1]}${rest}`;
}

/** First path segment if it looks like a tenant slug (not a reserved app route). */
export function getTenantSlugFromPathname(pathname: string): string | null {
	const m = pathname.match(/^\/([a-zA-Z0-9_-]+)(?:\/|$)/);
	if (!m) return null;
	const first = m[1].toLowerCase();
	if (RESERVED_FIRST_SEGMENTS.has(first)) return null;
	return m[1];
}

export function tenantLoginPathFromPathname(pathname: string): string | null {
	const slug = getTenantSlugFromPathname(pathname);
	if (!slug) return null;
	return `/${slug}/login`;
}

let _fetchPatched = false;
export function installGlobalFetchRewrite(): void {
	if (_fetchPatched || typeof window === 'undefined') return;
	_fetchPatched = true;

	const nativeFetch = window.fetch.bind(window);

	window.fetch = function patchedFetch(
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> {
		if (typeof input === 'string') {
			input = rewriteApiUrlForTenantPath(input);
		}
		return nativeFetch(input, init);
	} as typeof window.fetch;
}
