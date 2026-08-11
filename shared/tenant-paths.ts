/** Origin publik resmi — dipakai canonical, og:url, sitemap, SSR. */
export const SITE_ORIGIN = 'https://himatif-encoder.com';

/** Segmen pertama yang bukan slug komunitas. */
export const RESERVED_FIRST_SEGMENTS: readonly string[] = [
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
	'toko',
	'dashboard',
	'communities',
	'sitemap.xml',
	'robots.txt',
];

const RESERVED_SET = new Set(RESERVED_FIRST_SEGMENTS);

export function isReservedTenantSlug(slug: string): boolean {
	return RESERVED_SET.has(String(slug || '').trim().toLowerCase());
}

export function prefixPublicPath(basePath: string, path: string): string {
	const raw = String(path || '').trim();
	if (!raw) return basePath || '/';
	if (/^https?:\/\//i.test(raw) || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
		return raw;
	}
	if (raw.startsWith('#')) return `${basePath || ''}${raw}` || raw;
	const bp = basePath && basePath !== '/' ? basePath.replace(/\/$/, '') : '';
	if (!raw.startsWith('/')) return bp ? `${bp}/${raw}` : `/${raw}`;
	if (bp && (raw === bp || raw.startsWith(`${bp}/`))) return raw;
	return `${bp}${raw}`;
}

export function publicAbsoluteUrl(basePath: string, path: string): string {
	const prefixed = prefixPublicPath(basePath, path);
	if (/^https?:\/\//i.test(prefixed)) return prefixed;
	return `${SITE_ORIGIN}${prefixed.startsWith('/') ? prefixed : `/${prefixed}`}`;
}
