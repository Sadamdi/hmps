export type EventAttachmentSource = 'local' | 'gdrive' | 'url';

export interface EventAttachmentInput {
	name?: unknown;
	url?: unknown;
	type?: unknown;
	source?: unknown;
}

export interface NormalizedEventAttachment {
	name: string;
	url: string;
	type: string;
	source: EventAttachmentSource;
}

/**
 * Berita reuses the same attachment normalization rules as event so the
 * dashboard UX, viewer popup, and server cleanup all behave consistently.
 */
export type BeritaAttachmentSource = EventAttachmentSource;
export type BeritaAttachmentInput = EventAttachmentInput;
export type NormalizedBeritaAttachment = NormalizedEventAttachment;

function parseDriveFileId(inputUrl: URL): string | null {
	const host = inputUrl.hostname.toLowerCase();
	if (!host.includes('drive.google.com')) return null;
	const pathParts = inputUrl.pathname.split('/').filter(Boolean);
	const fileDIdx = pathParts.findIndex((p) => p === 'd');
	if (fileDIdx >= 0 && pathParts[fileDIdx + 1]) return pathParts[fileDIdx + 1];
	const openId = inputUrl.searchParams.get('id');
	if (openId) return openId;
	const ucId = inputUrl.searchParams.get('id');
	if (ucId) return ucId;
	return null;
}

function isDriveFolderUrl(inputUrl: URL): boolean {
	const p = inputUrl.pathname.toLowerCase();
	return p.includes('/drive/folders/');
}

function toDriveDirectUrl(fileId: string): string {
	return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function normalizeEventAttachmentArray(
	raw: unknown,
): { ok: true; attachments: NormalizedEventAttachment[] } | { ok: false; message: string } {
	if (!Array.isArray(raw)) {
		return { ok: false, message: 'Format attachments harus berupa array.' };
	}

	const normalized: NormalizedEventAttachment[] = [];
	for (const item of raw as EventAttachmentInput[]) {
		const name = String(item?.name || '').trim();
		const rawUrl = String(item?.url || '').trim();
		if (!name || !rawUrl) {
			return { ok: false, message: 'Setiap attachment link wajib memiliki name dan url.' };
		}
		if (rawUrl.length > 2000) {
			return { ok: false, message: 'URL attachment terlalu panjang.' };
		}

		const sourceRaw = String(item?.source || '').trim().toLowerCase();
		const isLocalSource = sourceRaw === 'local';
		if (isLocalSource) {
			const isLocalPath =
				rawUrl.startsWith('/uploads/') ||
				rawUrl.includes('/uploads/');
			if (!isLocalPath) {
				return { ok: false, message: `Attachment local tidak valid: ${name}.` };
			}
			const type =
				typeof item?.type === 'string' && item.type.trim().length > 0
					? item.type.trim()
					: 'file';
			normalized.push({
				name,
				url: rawUrl,
				type,
				source: 'local',
			});
			continue;
		}

		let parsedUrl: URL;
		try {
			parsedUrl = new URL(rawUrl);
		} catch {
			return { ok: false, message: `URL attachment tidak valid: ${name}.` };
		}
		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
			return { ok: false, message: `Attachment hanya mendukung URL http/https: ${name}.` };
		}

		const driveFileId = parseDriveFileId(parsedUrl);
		if (driveFileId && isDriveFolderUrl(parsedUrl)) {
			return { ok: false, message: 'Lampiran Google Drive hanya mendukung link single-file, bukan folder.' };
		}

		const inferredSource: EventAttachmentSource = driveFileId ? 'gdrive' : 'url';
		const source: EventAttachmentSource =
			sourceRaw === 'local' || sourceRaw === 'gdrive' || sourceRaw === 'url'
				? (sourceRaw as EventAttachmentSource)
				: inferredSource;

		const finalSource: EventAttachmentSource = driveFileId ? 'gdrive' : source === 'gdrive' ? 'url' : source;
		const type =
			typeof item?.type === 'string' && item.type.trim().length > 0
				? item.type.trim()
				: 'link';
		normalized.push({
			name,
			url: driveFileId ? toDriveDirectUrl(driveFileId) : parsedUrl.toString(),
			type,
			source: finalSource,
		});
	}

	return { ok: true, attachments: normalized };
}

/**
 * Berita-specific normalizer that delegates to the event normalizer to keep
 * a single source of truth for attachment validation.
 */
export function normalizeBeritaAttachmentArray(
	raw: unknown,
):
	| { ok: true; attachments: NormalizedBeritaAttachment[] }
	| { ok: false; message: string } {
	return normalizeEventAttachmentArray(raw);
}
