export type LibraryVisualKind = 'folder' | 'video' | 'photo' | 'mixed';

interface LibraryKindInput {
	type?: 'photo' | 'video' | string;
	mediaKinds?: ('image' | 'video')[];
	gdriveEmbedFolders?: { folderId: string; url: string }[];
	images?: string[];
}

/**
 * Kadang `images[]` terisi string JSON (mis. respons API) — ekstrak URL Drive asli.
 */
export function normalizeLibraryImageUrl(raw: string | undefined): string {
	if (!raw || typeof raw !== 'string') return '';
	const t = raw.trim();
	if (!t.startsWith('{') && !t.startsWith('[')) return raw;

	try {
		const j = JSON.parse(t) as Record<string, unknown>;
		if (typeof j.url === 'string') return j.url;
		const files = j.files as Array<{ url?: string; type?: string }> | undefined;
		if (files?.[0]?.url) return files[0].url;
		const meta = j.metadata as { webContentLink?: string } | undefined;
		if (meta?.webContentLink) return meta.webContentLink;
		if (typeof j.webViewLink === 'string') return j.webViewLink;
		const flat = JSON.stringify(j);
		const m = flat.match(
			/https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+/,
		);
		if (m) return `${m[0]}/view`;
	} catch {
		const m = t.match(/https:\/\/[^\s"'<>]+/);
		if (m) return m[0].replace(/[.,;:!?)]+$/, '');
	}
	return raw;
}

function jsonHintSlotIsVideo(raw: string | undefined, index: number): boolean {
	if (!raw?.trim().startsWith('{')) return false;
	try {
		const j = JSON.parse(raw) as Record<string, unknown>;
		if (index === 0 && j.type === 'video') return true;
		const files = j.files as Array<{ type?: string; mimeType?: string }> | undefined;
		const f = files?.[index];
		if (f?.type === 'video') return true;
		if (typeof f?.mimeType === 'string' && f.mimeType.startsWith('video/'))
			return true;
	} catch {
		/* ignore */
	}
	return false;
}

function jsonHintSlotIsImage(raw: string | undefined, index: number): boolean {
	if (!raw?.trim().startsWith('{')) return false;
	try {
		const j = JSON.parse(raw) as Record<string, unknown>;
		if (index === 0 && j.type === 'image') return true;
		const files = j.files as Array<{ type?: string; mimeType?: string }> | undefined;
		const f = files?.[index];
		if (f?.type === 'image') return true;
		if (typeof f?.mimeType === 'string' && f.mimeType.startsWith('image/'))
			return true;
	} catch {
		/* ignore */
	}
	return false;
}

/**
 * Heuristik URL video — sengaja konservatif: /view dan /preview Drive dipakai juga untuk foto,
 * jangan anggap video dari path saja (hindari "foto jadi Video").
 */
export function inferVideoFromImageUrl(url: string): boolean {
	if (!url) return false;
	const lower = url.toLowerCase();
	if (/\.(mp4|webm|ogg|mov|m4v|mkv|3gp)(\?|#|$|")/i.test(url)) return true;
	if (lower.includes('drive.google.com') && lower.includes('video')) return true;
	return false;
}

/** Apakah slot ke-`index` cenderung video (bukan foto). */
export function slotLooksLikeVideo(item: LibraryKindInput, index: number): boolean {
	const raw = item.images?.[index];
	if (jsonHintSlotIsImage(raw, index)) return false;
	if (jsonHintSlotIsVideo(raw, index)) return true;
	const mk = item.mediaKinds?.[index];
	if (mk === 'video') return true;
	if (mk === 'image') return false;
	/** Backend menyimpan `type: 'video'` hanya jika semua file video (lihat POST /api/library). */
	if (item.type === 'video') return true;
	const url = normalizeLibraryImageUrl(raw);
	if (inferVideoFromImageUrl(url)) return true;
	const n = item.images?.length ?? 0;
	if (n <= 1 && index === 0) {
		if (item.type === 'photo') return false;
	}
	return false;
}

export function getLibraryVisualKind(item: LibraryKindInput): LibraryVisualKind {
	if (item.gdriveEmbedFolders && item.gdriveEmbedFolders.length > 0) {
		return 'folder';
	}
	const urls = item.images ?? [];
	const n = urls.length;
	if (n === 0) return 'photo';

	let v = 0;
	for (let i = 0; i < n; i++) {
		if (slotLooksLikeVideo(item, i)) v++;
	}
	if (v === n) return 'video';
	if (v === 0) return 'photo';
	return 'mixed';
}

const LABELS: Record<LibraryVisualKind, string> = {
	folder: 'Folder',
	video: 'Video',
	photo: 'Foto',
	mixed: 'Foto & Video',
};

export function getLibraryKindLabel(kind: LibraryVisualKind): string {
	return LABELS[kind];
}

/** Tipe untuk MediaDisplay slot — utamakan mediaKinds, lalu heuristik URL / type. */
export function getMediaDisplayTypeForSlot(
	item: LibraryKindInput,
	index: number,
): 'image' | 'video' | 'auto' {
	const k = item.mediaKinds?.[index];
	if (k === 'video') return 'video';
	if (k === 'image') return 'image';
	const raw = item.images?.[index];
	if (jsonHintSlotIsVideo(raw, index)) return 'video';
	if (jsonHintSlotIsImage(raw, index)) return 'image';
	const url = normalizeLibraryImageUrl(raw);
	if (inferVideoFromImageUrl(url)) return 'video';
	const n = item.images?.length ?? 0;
	if (n <= 1 && index === 0 && item.type === 'photo') return 'image';
	if (slotLooksLikeVideo(item, index)) return 'video';
	return 'auto';
}
