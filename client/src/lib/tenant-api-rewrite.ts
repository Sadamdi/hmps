/**
 * Rewrites same-origin API paths to tenant-scoped `/api/c/:slug/...` when the browser
 * is on a community path (`/:slug/...`). Used by fetch defaults and apiRequest.
 */
import { isReservedTenantSlug } from '@shared/tenant-paths';

const MAIN_ONLY_API_PREFIXES = ['/api/register', '/api/communities', '/api/registration'];

declare global {
	interface Window {
		__HMPS_ACTIVE_TENANT_SLUG__?: string | null;
	}
}

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
	const activeTenantSlug = window.__HMPS_ACTIVE_TENANT_SLUG__;
	if (!activeTenantSlug) return url;

	const rest = url.replace(/^\/api/, '');
	return `/api/c/${activeTenantSlug}${rest}`;
}

/** First path segment if it looks like a tenant slug (not a reserved app route). */
export function getTenantSlugFromPathname(pathname: string): string | null {
	const m = pathname.match(/^\/([a-zA-Z0-9_-]+)(?:\/|$)/);
	if (!m) return null;
	const first = m[1].toLowerCase();
	if (isReservedTenantSlug(first)) return null;
	return m[1];
}

export function tenantLoginPathFromPathname(pathname: string): string | null {
	const slug = getTenantSlugFromPathname(pathname);
	if (!slug) return null;
	return `/${slug}/login`;
}

export function setActiveTenantSlug(slug: string | null): void {
	if (typeof window === 'undefined') return;
	window.__HMPS_ACTIVE_TENANT_SLUG__ = slug || null;
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
