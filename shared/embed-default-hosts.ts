/**
 * Hostname domain yang diizinkan embed (iframe / rich content) secara bawaan.
 * Dipakai oleh CSP frame-src (server/security.ts), rich-html-with-embeds (klien),
 * dan dialog Settings → Security untuk daftar read-only.
 */
export const DEFAULT_EMBED_HOSTNAMES: readonly string[] = [
	'www.youtube.com',
	'youtube.com',
	'youtu.be',
	'www.youtube-nocookie.com',
	'drive.google.com',
	'docs.google.com',
	'www.google.com',
	'maps.google.com',
	'www.photopea.com',
	'photopea.com',
] as const;

let _set: Set<string> | null = null;

export function getDefaultEmbedHostSet(): Set<string> {
	if (!_set) _set = new Set(DEFAULT_EMBED_HOSTNAMES);
	return _set;
}
