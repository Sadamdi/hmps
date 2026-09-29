/**
 * Helper meta embed (og:*) untuk link yang dibagikan ke WhatsApp/Telegram/Facebook/X.
 *
 * - Galeri Google Drive: link "view", folder, atau video tidak bisa dipakai sebagai og:image.
 *   `resolveLibraryOgImage` memilih gambar pertama yang benar-benar gambar dan mengarahkannya ke
 *   `/api/og/drive/:fileId` (thumbnail 800px lewat akun layanan, di-cache di disk).
 * - Proxy hanya melayani file yang dirujuk galeri published (bukan proxy Drive terbuka).
 */
import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';

const SITE = 'https://himatif-encoder.com';
const DRIVE_ID = /^[a-zA-Z0-9_-]{20,}$/;
const CACHE_DIR = path.resolve(process.cwd(), 'uploads', 'og-cache');
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

/** fileId yang sudah dipilih resolver di proses ini (termasuk isi folder). */
const allowed = new Set<string>();
/** Hasil resolve per galeri (hemat panggilan Drive API). */
const resolved = new Map<string, { at: number; url: string | null }>();

function driveIdFrom(raw: string): string | null {
	const v = String(raw || '').trim();
	const m = v.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || v.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
	if (m) return m[1];
	return DRIVE_ID.test(v) ? v : null;
}

const isDriveLink = (v: string) => /drive\.google\.com|docs\.google\.com|googleusercontent\.com/.test(v);
const looksLikeImagePath = (v: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(v);

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
	return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/** Gambar pertama dari file/folder Drive (bukan video), menelusuri subfolder hingga 2 tingkat. */
async function firstDriveImage(ids: string[]): Promise<string | null> {
	const { getFileMetadata, getFolderContents } = await import('../googleDrive');
	let listings = 0;
	const searchFolder = async (folderId: string, depth: number): Promise<string | null> => {
		if (listings++ >= 8) return null;
		const files = (await withTimeout(getFolderContents(folderId), 5000).catch(() => null)) || [];
		const img = files.find((f) => f.mimeType?.startsWith('image/'));
		if (img) return img.id;
		if (depth <= 0) return null;
		for (const sub of files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder').slice(0, 4)) {
			const hit = await searchFolder(sub.id, depth - 1);
			if (hit) return hit;
		}
		return null;
	};
	for (const id of ids.slice(0, 6)) {
		const meta = await withTimeout(getFileMetadata(id), 4000).catch(() => null);
		if (!meta) continue;
		if (meta.mimeType?.startsWith('image/')) return id;
		if (meta.mimeType === 'application/vnd.google-apps.folder') {
			const hit = await searchFolder(id, 2);
			if (hit) return hit;
		}
	}
	return null;
}

/**
 * og:image galeri: gambar lokal/URL gambar pertama; jika hanya Drive → thumbnail gambar pertama
 * lewat proxy. null bila tidak ada gambar (pemanggil memakai logo default).
 */
export async function resolveLibraryOgImage(doc: { _id?: unknown; images?: unknown[]; gdriveFileIds?: unknown[] }): Promise<string | null> {
	const key = String(doc._id || '');
	const hit = resolved.get(key);
	if (hit && Date.now() - hit.at < 3600_000) return hit.url;

	const images = (Array.isArray(doc.images) ? doc.images : []).map(String);
	let url: string | null = null;
	for (const raw of images) {
		const v = raw.trim();
		if (!v || v.startsWith('data:') || isDriveLink(v)) continue;
		if (v.startsWith('/') || looksLikeImagePath(v)) {
			url = v.startsWith('http') ? v : `${SITE}${v.startsWith('/') ? '' : '/'}${v}`;
			break;
		}
	}
	if (!url) {
		const ids = [
			...images.filter(isDriveLink).map(driveIdFrom),
			...(Array.isArray(doc.gdriveFileIds) ? doc.gdriveFileIds.map(String) : []),
		].filter((x): x is string => !!x && DRIVE_ID.test(x));
		const unique = Array.from(new Set(ids));
		if (unique.length) {
			const fileId = await firstDriveImage(unique).catch(() => null);
			if (fileId) {
				allowed.add(fileId);
				url = `${SITE}/api/og/drive/${fileId}.jpg`;
			}
		}
	}
	resolved.set(key, { at: Date.now(), url });
	return url;
}

/** Pastikan fileId dirujuk galeri published (setelah restart, allowlist memori kosong). */
async function isReferenced(fileId: string): Promise<boolean> {
	if (allowed.has(fileId)) return true;
	const { Library } = await import('../../db/mongodb');
	const docs: any[] = await Library.find({ published: { $ne: false } }).select('_id images gdriveFileIds').lean();
	for (const d of docs) {
		const ids = [...(d.images || []).map((x: string) => driveIdFrom(String(x))), ...(d.gdriveFileIds || []).map(String)];
		if (ids.includes(fileId)) return true;
	}
	// file di dalam folder galeri: jalankan resolver (mengisi allowlist)
	for (const d of docs) await resolveLibraryOgImage(d).catch(() => null);
	return allowed.has(fileId);
}

/** GET /api/og/drive/:fileId(.jpg) — thumbnail 800px untuk crawler embed. */
export async function driveOgImageHandler(req: Request, res: Response) {
	const fileId = String(req.params.fileId || '').replace(/\.jpg$/, '');
	if (!DRIVE_ID.test(fileId)) return res.status(400).end();
	try {
		const cached = path.join(CACHE_DIR, `${fileId}.jpg`);
		const st = fs.existsSync(cached) ? fs.statSync(cached) : null;
		if (st && Date.now() - st.mtimeMs < CACHE_TTL_MS && st.size > 0) {
			res.set('Cache-Control', 'public, max-age=86400');
			return res.type('image/jpeg').sendFile(cached);
		}
		if (!(await isReferenced(fileId))) return res.status(404).end();

		const { getFileMetadata, getDriveAccessToken } = await import('../googleDrive');
		const meta = await getFileMetadata(fileId);
		if (!meta?.thumbnailLink || !meta.mimeType?.startsWith('image/')) return res.status(404).end();
		const thumbUrl = meta.thumbnailLink.replace(/=s\d+$/, '=w800');
		let r = await fetch(thumbUrl);
		if (!r.ok) r = await fetch(thumbUrl, { headers: { Authorization: `Bearer ${await getDriveAccessToken()}` } });
		if (!r.ok || !String(r.headers.get('content-type')).startsWith('image/')) return res.status(502).end();
		// Ukuran Drive tidak selalu mengikuti parameter lebar → kecilkan sendiri agar preview WhatsApp (< ~300 KB) aman
		const sharp = (await import('sharp')).default;
		const buf = await sharp(Buffer.from(await r.arrayBuffer()))
			.rotate()
			.resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality: 80, mozjpeg: true })
			.toBuffer();
		fs.mkdirSync(CACHE_DIR, { recursive: true });
		fs.writeFileSync(cached, buf);
		res.set('Cache-Control', 'public, max-age=86400');
		return res.type('image/jpeg').send(buf);
	} catch (e) {
		console.warn('[og-drive]', fileId, (e as Error)?.message);
		return res.status(502).end();
	}
}

/** Teks polos pendek dari HTML. */
export function plainText(html: unknown, max = 160): string {
	const t = String(html || '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
	return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function formatRupiah(n: number, currency = 'IDR'): string {
	if (currency && currency !== 'IDR') return `${currency} ${Number(n).toLocaleString('id-ID')}`;
	return `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
}
