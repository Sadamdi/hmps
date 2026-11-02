/**
 * Ekstrak ID video YouTube dari URL umum (watch, youtu.be, shorts, live, embed).
 * Mengembalikan null jika tidak terdeteksi.
 */
export function parseYouTubeVideoId(input: string): string | null {
	const raw = input?.trim();
	if (!raw) return null;

	let url: URL;
	try {
		url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
	} catch {
		return null;
	}

	const host = url.hostname.replace(/^www\./, '');

	if (host === 'youtu.be') {
		const id = url.pathname.split('/').filter(Boolean)[0];
		return id && /^[\w-]{11}$/.test(id) ? id : null;
	}

	if (isYouTubeHost(host)) {
		const path = url.pathname;
		// /embed/ID, /shorts/ID, /live/ID (siaran langsung), /v/ID
		const m = path.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})(?:[/?#]|$)/);
		if (m) return m[1];
		if (path === '/watch' || path.startsWith('/watch')) {
			const v = url.searchParams.get('v');
			return v && /^[\w-]{11}$/.test(v) ? v : null;
		}
	}

	return null;
}

const YOUTUBE_HOSTS = new Set([
	'youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtube-nocookie.com',
	'youtu.be',
]);

/** Host keluarga YouTube (tanpa "www."). */
export function isYouTubeHost(host: string): boolean {
	return YOUTUBE_HOSTS.has(host.toLowerCase().replace(/^www\./, ''));
}

/** ID playlist dari youtube.com/playlist?list=... (bukan video tunggal). */
export function parseYouTubePlaylistId(input: string): string | null {
	try {
		const url = new URL(input.trim().startsWith('http') ? input.trim() : `https://${input.trim()}`);
		if (!isYouTubeHost(url.hostname) || url.pathname !== '/playlist') return null;
		const list = url.searchParams.get('list');
		return list && /^[\w-]{10,64}$/.test(list) ? list : null;
	} catch {
		return null;
	}
}

export function getYouTubePlaylistEmbedSrc(listId: string): string {
	return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(listId)}`;
}

export function getYouTubeEmbedSrc(videoId: string): string {
	return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
}

export function getYouTubeEmbedSrcFromUrl(input: string): string | null {
	const id = parseYouTubeVideoId(input);
	return id ? getYouTubeEmbedSrc(id) : null;
}

/**
 * Ekstrak fileId Google Drive dari URL share umum.
 * Mendukung:
 * - /file/d/<id>/view
 * - open?id=<id>
 * - uc?id=<id>
 */
export function parseGoogleDriveFileId(input: string): string | null {
	const raw = input?.trim();
	if (!raw) return null;

	let url: URL;
	try {
		url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
	} catch {
		return null;
	}

	const host = url.hostname.replace(/^www\./, '');
	if (host !== 'drive.google.com' && host !== 'docs.google.com') return null;

	const idFromQuery = url.searchParams.get('id');
	if (idFromQuery && /^[A-Za-z0-9_-]{20,}$/.test(idFromQuery)) return idFromQuery;

	const match = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{20,})/);
	if (match?.[1]) return match[1];

	return null;
}

export function getGoogleDriveEmbedSrc(fileId: string): string {
	return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

export function getGoogleDriveEmbedSrcFromUrl(input: string): string | null {
	const id = parseGoogleDriveFileId(input);
	return id ? getGoogleDriveEmbedSrc(id) : null;
}
