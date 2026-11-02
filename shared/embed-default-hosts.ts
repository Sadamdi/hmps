/**
 * Hostname domain yang diizinkan embed (iframe / rich content) secara bawaan.
 * Dipakai oleh CSP frame-src (server/security.ts), rich-html-with-embeds (klien),
 * dan dialog Settings → Security untuk daftar read-only.
 *
 * Daftar tambahan dari admin tetap lewat Settings.embedAllowedHosts (tanpa deploy).
 */
export const DEFAULT_EMBED_HOSTNAMES: readonly string[] = [
	// YouTube
	'www.youtube.com',
	'youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtu.be',
	'www.youtube-nocookie.com',
	'youtube-nocookie.com',
	// Google (Drive, Docs/Sheets/Slides/Forms, Maps, Kalender, Looker Studio)
	'drive.google.com',
	'docs.google.com',
	'drive.usercontent.google.com',
	'forms.gle',
	'calendar.google.com',
	'lookerstudio.google.com',
	'www.google.com',
	'google.com',
	'maps.google.com',
	// Media dan desain populer
	'player.vimeo.com',
	'open.spotify.com',
	'www.canva.com',
	'www.instagram.com',
	'www.tiktok.com',
	// Photopea
	'www.photopea.com',
	'photopea.com',
] as const;

let _set: Set<string> | null = null;

export function getDefaultEmbedHostSet(): Set<string> {
	if (!_set) _set = new Set(DEFAULT_EMBED_HOSTNAMES);
	return _set;
}

/** Sumber `frame-src` CSP (https://host) dari daftar bawaan. */
export function getDefaultEmbedFrameSources(): string[] {
	return DEFAULT_EMBED_HOSTNAMES.map((h) => `https://${h}`);
}
