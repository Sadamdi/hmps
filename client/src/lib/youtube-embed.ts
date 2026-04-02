/**
 * Ekstrak ID video YouTube dari URL umum (watch, youtu.be, shorts, embed).
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

	if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
		const path = url.pathname;
		if (path.startsWith('/embed/')) {
			const id = path.split('/')[2];
			return id && /^[\w-]{11}$/.test(id) ? id : null;
		}
		if (path.startsWith('/shorts/')) {
			const id = path.split('/')[2]?.split('?')[0];
			return id && /^[\w-]{11}$/.test(id) ? id : null;
		}
		if (path === '/watch' || path.startsWith('/watch')) {
			const v = url.searchParams.get('v');
			return v && /^[\w-]{11}$/.test(v) ? v : null;
		}
	}

	return null;
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
