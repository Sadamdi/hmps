import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { isProcessableImage, processImage } from './image-processor';
import { DEFAULT_IMAGE_URL, DEFAULT_MEMBER_IMAGE_PATH } from './constants/default-image';
import { registerUpload } from './services/file-scanner';

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const _writeFile = promisify(fs.writeFile);

/**
 * Wrapped writeFile that tracks the last written file for scan registration.
 * Not a replacement for registerUpload — just the raw fs write.
 */
const writeFile = _writeFile;

// Resolve project root from the script location rather than process.cwd(),
// so uploads land in the correct directory even if PM2/systemd starts
// the process from a different working directory.
const __upload_filename = fileURLToPath(import.meta.url);
const __upload_dirname = path.dirname(__upload_filename);
const PROJECT_ROOT = path.resolve(__upload_dirname, '..');

export const uploadDir = path.join(PROJECT_ROOT, 'uploads');
export const assetsDir = path.join(PROJECT_ROOT, 'attached_assets');
export { PROJECT_ROOT };

/** Thumbnail bawaan berita (file di `uploads/default-berita-image.png`) — jangan hapus dari disk saat ganti/hapus berita. */
export const DEFAULT_BERITA_IMAGE_PATH =
	'/uploads/default-berita-image.png';

/** Path lama (.jpg); tetap dianggap default agar tidak terhapus & migrasi DB bertahap aman. */
const LEGACY_DEFAULT_BERITA_IMAGE_JPG = '/uploads/default-berita-image.jpg';

export function isDefaultBeritaImageUrl(
	fileUrl: string | undefined | null,
): boolean {
	if (!fileUrl || typeof fileUrl !== 'string') return false;
	const t = fileUrl.trim();
	return (
		t === DEFAULT_BERITA_IMAGE_PATH || t === LEGACY_DEFAULT_BERITA_IMAGE_JPG
	);
}

export function isProtectedDefaultImageUrl(
	fileUrl: string | undefined | null,
): boolean {
	if (!fileUrl || typeof fileUrl !== 'string') return false;
	const t = fileUrl.trim();
	return (
		isDefaultBeritaImageUrl(t) ||
		t === DEFAULT_MEMBER_IMAGE_PATH ||
		t === DEFAULT_IMAGE_URL
	);
}

if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(assetsDir)) {
	fs.mkdirSync(assetsDir, { recursive: true });
}

// Definisi kategori folder untuk organisasi yang lebih baik
export type UploadCategory =
	| 'organization' // Logo himpunan, foto ketua, divisi, dll
	| 'content' // Konten halaman (hero, about, vision-mission)
	| 'berita' // Gambar berita dan thumbnail
	| 'library' // Media library (foto/video kegiatan)
	| 'filosofi' // Gambar filosofi lambang HIMATIF (attached_assets/filosofi)
	| 'events' // Thumbnail dan attachment event
	| 'feedback' // Media saran/kritik
	| 'general'; // File umum lainnya

// Membuat subfolder jika belum ada
async function ensureUploadDirectory(
	category: UploadCategory,
	useAssetsDir: boolean,
): Promise<string> {
	const baseDir = useAssetsDir ? assetsDir : uploadDir;
	const categoryDir = path.join(baseDir, category);

	if (!fs.existsSync(categoryDir)) {
		await mkdir(categoryDir, { recursive: true });
	}

	return categoryDir;
}

/**
 * Sanitize a community slug for safe use as a filesystem directory name.
 */
function sanitizeSlug(slug: string): string {
	return slug
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, '_')
		.replace(/_{2,}/g, '_')
		.replace(/^_|_$/g, '') || 'unknown';
}

/**
 * Hapus seluruh folder unggahan komunitas tenant di `uploads/community/{slug}` dan
 * `attached_assets/community/{slug}`. Best-effort; dipanggil saat komunitas dihapus.
 */
export function removeCommunityUploadDirectories(tenantSlug: string): void {
	const safe = sanitizeSlug(tenantSlug);
	for (const base of [uploadDir, assetsDir]) {
		const dir = path.join(base, 'community', safe);
		try {
			if (fs.existsSync(dir)) {
				fs.rmSync(dir, { recursive: true, force: true });
			}
		} catch (e) {
			console.warn(`removeCommunityUploadDirectories(${safe}):`, e);
		}
	}
}

export interface TenantPathContext {
	isTenant: boolean;
	tenantSlug?: string;
}

/**
 * Resolve the physical directory and URL prefix for an upload,
 * scoped to a tenant when applicable.
 *
 * Non-tenant:  attached_assets/{sub}   or  uploads/{sub}
 * Tenant:      attached_assets/community/{slug}/{sub}  or  uploads/community/{slug}/{sub}
 */
export function resolveTenantPaths(
	sub: string,
	useAssetsDir: boolean,
	ctx: TenantPathContext,
): { dir: string; urlPrefix: string } {
	const baseDir = useAssetsDir ? assetsDir : uploadDir;
	const baseUrl = useAssetsDir ? '/attached_assets' : '/uploads';

	if (ctx.isTenant && ctx.tenantSlug) {
		const safe = sanitizeSlug(ctx.tenantSlug);
		const dir = path.join(baseDir, 'community', safe, sub);
		const urlPrefix = `${baseUrl}/community/${safe}/${sub}`;
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		return { dir, urlPrefix };
	}

	const dir = path.join(baseDir, sub);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	return { dir, urlPrefix: `${baseUrl}/${sub}` };
}

/**
 * Build a TenantPathContext from an Express request.
 */
export function tenantCtxFromReq(req: { isTenantRequest?: boolean; tenantSlug?: string }): TenantPathContext {
	return {
		isTenant: !!req.isTenantRequest,
		tenantSlug: req.tenantSlug,
	};
}

// Configure multer storage
const storage = multer.memoryStorage();

// Configure multer upload
export const uploadMiddleware = multer({
	storage,
	limits: {
		fileSize: 100 * 1024 * 1024, // 100MB (sesuai dengan Nginx dan Express body parser limit)
	},
});

/**
 * Handles file upload by writing to disk and returning URL
 */
export async function uploadHandler(
	file: Express.Multer.File,
	useAssetsDir: boolean = false,
	category: UploadCategory = 'general',
	oldFileUrl?: string,
	subFolder?: string,
	tenant?: TenantPathContext,
): Promise<string> {
	try {
		if (oldFileUrl) {
			await deleteFile(oldFileUrl);
		}

		const timestamp = Date.now();
		const randomName = crypto.randomBytes(8).toString('hex');
		const safeOriginalName = file.originalname
			.replace(/[^a-zA-Z0-9.]/g, '_')
			.substring(0, 20);
		const fileExtension = path.extname(file.originalname);
		const fileName = `${timestamp}_${safeOriginalName}_${randomName}${fileExtension}`;

		const sub = subFolder ? `${category}/${subFolder}` : category;
		const { dir: categoryDir, urlPrefix } = tenant?.isTenant
			? resolveTenantPaths(sub, useAssetsDir, tenant)
			: (() => {
				const d = path.join(useAssetsDir ? assetsDir : uploadDir, sub);
				if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
				return { dir: d, urlPrefix: `${useAssetsDir ? '/attached_assets' : '/uploads'}/${sub}` };
			})();

		const filePath = path.join(categoryDir, fileName);
		await writeFile(filePath, file.buffer);

		const fileUrl = `${urlPrefix}/${fileName}`;
		registerUploadedFile({
			url: fileUrl, diskPath: filePath, originalName: file.originalname,
			mimeType: file.mimetype, size: file.size, category,
			tenantSlug: tenant?.tenantSlug,
		});
		return fileUrl;
	} catch (error) {
		console.error('Error handling file upload:', error);
		throw new Error('File upload failed');
	}
}

/**
 * Handles berita image upload with automatic processing to WebP
 * Supports optional subFolder (e.g., beritaId) to organize content images
 */
export async function uploadBeritaImage(
	file: Express.Multer.File,
	oldFileUrl?: string,
	subFolder?: string,
	useAssetsDir: boolean = false,
	tenant?: TenantPathContext,
): Promise<string> {
	try {
		if (oldFileUrl && !isDefaultBeritaImageUrl(oldFileUrl)) {
			await deleteFile(oldFileUrl);
		}

		if (!isProcessableImage(file.mimetype)) {
			throw new Error(`File type ${file.mimetype} is not processable`);
		}

		const timestamp = Date.now();
		const randomName = crypto.randomBytes(8).toString('hex');
		const safeOriginalName = file.originalname
			.replace(/[^a-zA-Z0-9.]/g, '_')
			.substring(0, 20);
		const fileName = `${timestamp}_${safeOriginalName}_${randomName}.webp`;

		const sub = subFolder ? `berita/${subFolder}` : 'berita';
		const { dir: categoryDir, urlPrefix } = tenant?.isTenant
			? resolveTenantPaths(sub, useAssetsDir, tenant)
			: (() => {
				const d = path.join(useAssetsDir ? assetsDir : uploadDir, sub);
				if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
				return { dir: d, urlPrefix: `${useAssetsDir ? '/attached_assets' : '/uploads'}/${sub}` };
			})();

		const filePath = path.join(categoryDir, fileName);

		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 1920,
			maxHeight: 1080,
			format: 'webp',
		});

		await writeFile(filePath, processedBuffer);

		const fileUrl = `${urlPrefix}/${fileName}`;
		registerUploadedFile({
			url: fileUrl, diskPath: filePath, originalName: file.originalname,
			mimeType: 'image/webp', size: processedBuffer.length, category: 'berita',
			tenantSlug: tenant?.tenantSlug,
		});
		return fileUrl;
	} catch (error) {
		console.error('Error processing berita image:', error);
		throw new Error('Failed to process berita image');
	}
}

/**
 * Upload a content image for an event's rich-text description.
 * Files go under events/{eventId}/content/ (or events/{parentId}/sub-events/{eventId}/content/).
 */
export async function uploadEventContentImage(
	file: Express.Multer.File,
	eventId: string,
	parentEventId?: string | null,
	tenant?: TenantPathContext,
): Promise<string> {
	if (!isProcessableImage(file.mimetype)) {
		throw new Error(`File type ${file.mimetype} is not processable`);
	}

	const timestamp = Date.now();
	const randomName = crypto.randomBytes(8).toString('hex');
	const safeOriginalName = file.originalname
		.replace(/[^a-zA-Z0-9.]/g, '_')
		.substring(0, 20);
	const fileName = `${timestamp}_${safeOriginalName}_${randomName}.webp`;

	const sub = parentEventId
		? `events/${parentEventId}/sub-events/${eventId}/content`
		: `events/${eventId}/content`;

	const { dir: categoryDir, urlPrefix } = tenant?.isTenant
		? resolveTenantPaths(sub, false, tenant)
		: (() => {
			const d = path.join(uploadDir, sub);
			if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
			return { dir: d, urlPrefix: `/uploads/${sub}` };
		})();

	const filePath = path.join(categoryDir, fileName);

	const processedBuffer = await processImage(file.buffer, {
		quality: 80,
		maxWidth: 1920,
		maxHeight: 1080,
		format: 'webp',
	});

	await writeFile(filePath, processedBuffer);
	const fileUrl = `${urlPrefix}/${fileName}`;
	registerUploadedFile({
		url: fileUrl,
		diskPath: filePath,
		originalName: file.originalname,
		mimeType: 'image/webp',
		size: processedBuffer.length,
		category: 'events-content',
		tenantSlug: tenant?.tenantSlug,
	});
	return fileUrl;
}

/**
 * Upload a thumbnail specifically for an event, stored under events/{eventId}/thumbnail/.
 */
export async function uploadEventThumbnail(
	file: Express.Multer.File,
	eventId: string,
	parentEventId?: string | null,
	oldFileUrl?: string,
	tenant?: TenantPathContext,
): Promise<string> {
	if (oldFileUrl) await deleteFile(oldFileUrl);

	const timestamp = Date.now();
	const randomName = crypto.randomBytes(8).toString('hex');
	const ext = path.extname(file.originalname) || '.webp';
	const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_').substring(0, 20);
	const fileName = `${timestamp}_${safeOriginalName}_${randomName}${ext}`;

	const sub = parentEventId
		? `events/${parentEventId}/sub-events/${eventId}/thumbnail`
		: `events/${eventId}/thumbnail`;

	const { dir: categoryDir, urlPrefix } = tenant?.isTenant
		? resolveTenantPaths(sub, false, tenant)
		: (() => {
			const d = path.join(uploadDir, sub);
			if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
			return { dir: d, urlPrefix: `/uploads/${sub}` };
		})();

	const filePath = path.join(categoryDir, fileName);

	if (isProcessableImage(file.mimetype)) {
		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 1920,
			maxHeight: 1080,
			format: 'webp',
		});
		await writeFile(filePath, processedBuffer);
		registerUploadedFile({
			url: `${urlPrefix}/${fileName}`,
			diskPath: filePath,
			originalName: file.originalname,
			mimeType: 'image/webp',
			size: processedBuffer.length,
			category: 'events-thumbnail',
			tenantSlug: tenant?.tenantSlug,
		});
	} else {
		await writeFile(filePath, file.buffer);
		registerUploadedFile({
			url: `${urlPrefix}/${fileName}`,
			diskPath: filePath,
			originalName: file.originalname,
			mimeType: file.mimetype,
			size: file.size,
			category: 'events-thumbnail',
			tenantSlug: tenant?.tenantSlug,
		});
	}

	return `${urlPrefix}/${fileName}`;
}

/**
 * Upload an attachment for an event, stored under events/{eventId}/attachments/.
 */
export async function uploadEventAttachment(
	file: Express.Multer.File,
	eventId: string,
	parentEventId?: string | null,
	tenant?: TenantPathContext,
): Promise<string> {
	const timestamp = Date.now();
	const randomName = crypto.randomBytes(8).toString('hex');
	const ext = path.extname(file.originalname);
	const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_').substring(0, 20);
	const fileName = `${timestamp}_${safeOriginalName}_${randomName}${ext}`;

	const sub = parentEventId
		? `events/${parentEventId}/sub-events/${eventId}/attachments`
		: `events/${eventId}/attachments`;

	const { dir: categoryDir, urlPrefix } = tenant?.isTenant
		? resolveTenantPaths(sub, false, tenant)
		: (() => {
			const d = path.join(uploadDir, sub);
			if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
			return { dir: d, urlPrefix: `/uploads/${sub}` };
		})();

	const filePath = path.join(categoryDir, fileName);
	await writeFile(filePath, file.buffer);
	const fileUrl = `${urlPrefix}/${fileName}`;
	registerUploadedFile({
		url: fileUrl,
		diskPath: filePath,
		originalName: file.originalname,
		mimeType: file.mimetype,
		size: file.size,
		category: 'events-attachment',
		tenantSlug: tenant?.tenantSlug,
	});
	return fileUrl;
}

/**
 * Cleanup unused event content images from disk.
 * Works for both main and tenant by resolving correct path.
 */
export async function cleanupEventImages(
	eventId: string,
	usedImageUrls: string[],
	parentEventId?: string | null,
	tenant?: TenantPathContext,
): Promise<void> {
	const sub = parentEventId
		? `events/${parentEventId}/sub-events/${eventId}/content`
		: `events/${eventId}/content`;

	const { dir, urlPrefix } =
		tenant?.isTenant && tenant.tenantSlug
			? resolveTenantPaths(sub, false, tenant)
			: { dir: path.join(uploadDir, sub), urlPrefix: `/uploads/${sub}` };

	try {
		if (!fs.existsSync(dir)) return;
		const files = fs.readdirSync(dir);

		if (usedImageUrls.length === 0) {
			for (const file of files) {
				await promisify(fs.unlink)(path.join(dir, file)).catch(() => {});
			}
		} else {
			const pathMarker = `${urlPrefix}/`;
			const usedFilenames = usedImageUrls
				.filter((url) => url.includes(pathMarker))
				.map((url) => url.split(pathMarker).pop()!)
				.filter(Boolean);
			for (const file of files) {
				if (!usedFilenames.includes(file)) {
					await promisify(fs.unlink)(path.join(dir, file)).catch(() => {});
				}
			}
		}
	} catch (e) {
		console.warn(`cleanupEventImages(${eventId}):`, e);
	}
}

/**
 * Delete the entire file directory tree for an event (thumbnail, content, attachments).
 * Used on cascade delete of event/sub-event.
 */
export async function deleteEventFileTree(
	eventId: string,
	parentEventId?: string | null,
	tenant?: TenantPathContext,
): Promise<void> {
	const sub = parentEventId
		? `events/${parentEventId}/sub-events/${eventId}`
		: `events/${eventId}`;

	const resolveDir = (t?: TenantPathContext) => {
		if (t?.isTenant && t.tenantSlug) {
			const safe = t.tenantSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '') || 'unknown';
			return path.join(uploadDir, 'community', safe, sub);
		}
		return path.join(uploadDir, sub);
	};

	const dir = resolveDir(tenant);
	try {
		if (fs.existsSync(dir)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	} catch (e) {
		console.warn(`deleteEventFileTree(${eventId}):`, e);
	}
}

/**
 * Handles organization member image upload with automatic processing
 * Converts PNG/JPEG to WebP with compression while maintaining resolution
 */
export async function uploadOrganizationMemberImage(
	file: Express.Multer.File,
	oldFileUrl?: string,
	tenant?: TenantPathContext,
): Promise<string> {
	try {
		if (oldFileUrl) {
			await deleteFile(oldFileUrl);
		}

		const timestamp = Date.now();
		const randomName = crypto.randomBytes(8).toString('hex');
		const safeOriginalName = file.originalname
			.replace(/[^a-zA-Z0-9.]/g, '_')
			.substring(0, 20);
		const fileName = `${timestamp}_${safeOriginalName}_${randomName}.webp`;

		if (!isProcessableImage(file.mimetype)) {
			throw new Error(`File type ${file.mimetype} is not processable`);
		}

		const { dir: categoryDir, urlPrefix } = tenant?.isTenant
			? resolveTenantPaths('organization', false, tenant)
			: (() => {
				const d = path.join(uploadDir, 'organization');
				if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
				return { dir: d, urlPrefix: '/uploads/organization' };
			})();

		const filePath = path.join(categoryDir, fileName);

		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 1920,
			maxHeight: 1080,
			format: 'webp',
		});

		await writeFile(filePath, processedBuffer);
		const fileUrl = `${urlPrefix}/${fileName}`;
		registerUploadedFile({
			url: fileUrl,
			diskPath: filePath,
			originalName: file.originalname,
			mimeType: 'image/webp',
			size: processedBuffer.length,
			category: 'organization',
			tenantSlug: tenant?.tenantSlug,
		});
		return fileUrl;
	} catch (error) {
		console.error('Error processing organization member image:', error);
		throw new Error('Failed to process organization member image');
	}
}

const LOCAL_UPLOADS_PREFIX = '/uploads/';

function registerUploadedFile(opts: {
	url: string;
	diskPath: string;
	originalName: string;
	mimeType: string;
	size: number;
	category: string;
	tenantSlug?: string;
}): void {
	registerUpload(opts).catch((err) => {
		console.error('[upload:registerUpload] Failed to register uploaded file', {
			url: opts.url,
			category: opts.category,
			tenantSlug: opts.tenantSlug || 'main',
			error: err instanceof Error ? err.message : String(err),
		});
	});
}

function maybeDeleteLocalUpload(oldFileUrl?: string): Promise<void> {
	if (!oldFileUrl || !oldFileUrl.startsWith(LOCAL_UPLOADS_PREFIX)) {
		return Promise.resolve();
	}
	return deleteFile(oldFileUrl);
}

/**
 * Foto anggota Prodi (dosen / staff / pimpinan): WebP ke uploads/prodi/lecturers/{slug}.webp
 */
export async function uploadProdiLecturerPhoto(
	file: Express.Multer.File,
	slug: string,
	oldFileUrl?: string,
	tenant?: TenantPathContext,
): Promise<string> {
	try {
		await maybeDeleteLocalUpload(oldFileUrl);

		if (!isProcessableImage(file.mimetype)) {
			throw new Error(`File type ${file.mimetype} is not processable`);
		}

		const safeSlug = String(slug)
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9-]+/g, '-')
			.replace(/^-+|-+$/g, '');
		if (!safeSlug) {
			throw new Error('Invalid slug');
		}

		const { dir: lecturersDir, urlPrefix } = tenant?.isTenant
			? resolveTenantPaths('prodi/lecturers', false, tenant)
			: (() => {
				const d = path.join(uploadDir, 'prodi', 'lecturers');
				if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
				return { dir: d, urlPrefix: '/uploads/prodi/lecturers' };
			})();

		const fileName = `${safeSlug}.webp`;
		const filePath = path.join(lecturersDir, fileName);

		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 1920,
			maxHeight: 1080,
			format: 'webp',
		});

		await writeFile(filePath, processedBuffer);
		const fileUrl = `${urlPrefix}/${fileName}`;
		registerUploadedFile({
			url: fileUrl,
			diskPath: filePath,
			originalName: file.originalname,
			mimeType: 'image/webp',
			size: processedBuffer.length,
			category: 'prodi-lecturers',
			tenantSlug: tenant?.tenantSlug,
		});
		return fileUrl;
	} catch (error) {
		console.error('Error processing prodi lecturer photo:', error);
		throw new Error('Failed to process prodi photo');
	}
}

export type ProdiLabType = 'teaching' | 'research';

/**
 * Gambar laboratorium Prodi: uploads/prodi/labs/{type}/{labIndex}-{imgIndex}.webp
 * (sama dengan pola cache di prodi-sync)
 */
export async function uploadProdiLabPhoto(
	file: Express.Multer.File,
	type: ProdiLabType,
	labIndex: number,
	imgIndex: number,
	oldFileUrl?: string,
	tenant?: TenantPathContext,
): Promise<string> {
	try {
		if (type !== 'teaching' && type !== 'research') {
			throw new Error('Invalid lab type');
		}
		if (!Number.isInteger(labIndex) || labIndex < 0) {
			throw new Error('Invalid lab index');
		}
		if (!Number.isInteger(imgIndex) || imgIndex < 0) {
			throw new Error('Invalid image index');
		}

		await maybeDeleteLocalUpload(oldFileUrl);

		if (!isProcessableImage(file.mimetype)) {
			throw new Error(`File type ${file.mimetype} is not processable`);
		}

		const { dir: labsDir, urlPrefix } = tenant?.isTenant
			? resolveTenantPaths(`prodi/labs/${type}`, false, tenant)
			: (() => {
				const d = path.join(uploadDir, 'prodi', 'labs', type);
				if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
				return { dir: d, urlPrefix: `/uploads/prodi/labs/${type}` };
			})();

		const fileName = `${labIndex}-${imgIndex}.webp`;
		const filePath = path.join(labsDir, fileName);

		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 1920,
			maxHeight: 1080,
			format: 'webp',
		});

		await writeFile(filePath, processedBuffer);
		const fileUrl = `${urlPrefix}/${fileName}`;
		registerUploadedFile({
			url: fileUrl,
			diskPath: filePath,
			originalName: file.originalname,
			mimeType: 'image/webp',
			size: processedBuffer.length,
			category: `prodi-labs-${type}`,
			tenantSlug: tenant?.tenantSlug,
		});
		return fileUrl;
	} catch (error) {
		console.error('Error processing prodi lab photo:', error);
		throw new Error('Failed to process prodi lab photo');
	}
}

/**
 * Gambar struktur organisasi Prodi: uploads/prodi/organization-structure.webp
 */
export async function uploadProdiOrganizationStructureImage(
	file: Express.Multer.File,
	oldFileUrl?: string,
	tenant?: TenantPathContext,
): Promise<string> {
	try {
		await maybeDeleteLocalUpload(oldFileUrl);

		if (!isProcessableImage(file.mimetype)) {
			throw new Error(`File type ${file.mimetype} is not processable`);
		}

		const { dir: prodiDir, urlPrefix } = tenant?.isTenant
			? resolveTenantPaths('prodi', false, tenant)
			: (() => {
				const d = path.join(uploadDir, 'prodi');
				if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
				return { dir: d, urlPrefix: '/uploads/prodi' };
			})();

		const fileName = 'organization-structure.webp';
		const filePath = path.join(prodiDir, fileName);

		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 2400,
			maxHeight: 2400,
			format: 'webp',
		});

		await writeFile(filePath, processedBuffer);
		const fileUrl = `${urlPrefix}/${fileName}`;
		registerUploadedFile({
			url: fileUrl,
			diskPath: filePath,
			originalName: file.originalname,
			mimeType: 'image/webp',
			size: processedBuffer.length,
			category: 'prodi-organization-structure',
			tenantSlug: tenant?.tenantSlug,
		});
		return fileUrl;
	} catch (error) {
		console.error('Error processing prodi organization structure image:', error);
		throw new Error('Failed to process prodi organization structure image');
	}
}

/**
 * Upload gambar filosofi ke attached_assets/filosofi/{key}.{ext}
 * Menggantikan file lama dengan key yang sama (tanpa memandang ekstensi)
 */
export async function uploadFilosofiImage(
	file: Express.Multer.File,
	key: string,
	tenant?: TenantPathContext,
): Promise<string> {
	try {
		const { dir: filosofiDir, urlPrefix } = tenant?.isTenant
			? resolveTenantPaths('filosofi', true, tenant)
			: (() => {
				const d = path.join(assetsDir, 'filosofi');
				if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
				return { dir: d, urlPrefix: '/attached_assets/filosofi' };
			})();

		const fileExtension = path.extname(file.originalname) || '.png';
		const safeKey = key.replace(/[/\\?*:<>|]/g, '_').trim();
		if (!safeKey) {
			throw new Error('Key is required for filosofi upload');
		}
		const fileName = `${safeKey}${fileExtension}`;

		if (fs.existsSync(filosofiDir)) {
			const files = fs.readdirSync(filosofiDir);
			for (const f of files) {
				const baseName = path.basename(f, path.extname(f));
				if (baseName === safeKey) {
					try { fs.unlinkSync(path.join(filosofiDir, f)); } catch {}
				}
			}
		}

		const filePath = path.join(filosofiDir, fileName);
		await writeFile(filePath, file.buffer);
		const fileUrl = `${urlPrefix}/${fileName}`;
		registerUploadedFile({
			url: fileUrl,
			diskPath: filePath,
			originalName: file.originalname,
			mimeType: file.mimetype,
			size: file.size,
			category: 'filosofi',
			tenantSlug: tenant?.tenantSlug,
		});
		return fileUrl;
	} catch (error) {
		console.error('Error uploading filosofi image:', error);
		throw new Error('Filosofi image upload failed');
	}
}

/**
 * Upload feedback image: konversi ke WebP, simpan di uploads/feedback/
 */
export async function uploadFeedbackImage(
	file: Express.Multer.File,
	tenant?: TenantPathContext,
): Promise<{ url: string; originalName: string }> {
	if (!isProcessableImage(file.mimetype)) {
		throw new Error(`File type ${file.mimetype} is not a processable image`);
	}

	const timestamp = Date.now();
	const randomName = crypto.randomBytes(8).toString('hex');
	const fileName = `${timestamp}_${randomName}.webp`;

	const { dir: categoryDir, urlPrefix } = tenant?.isTenant
		? resolveTenantPaths('feedback', false, tenant)
		: (() => {
			const d = path.join(uploadDir, 'feedback');
			if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
			return { dir: d, urlPrefix: '/uploads/feedback' };
		})();

	const filePath = path.join(categoryDir, fileName);

	const processedBuffer = await processImage(file.buffer, {
		quality: 80,
		maxWidth: 1920,
		maxHeight: 1080,
		format: 'webp',
	});

	await writeFile(filePath, processedBuffer);

	const feedbackResult = {
		url: `${urlPrefix}/${fileName}`,
		originalName: file.originalname,
	};
	registerUploadedFile({
		url: feedbackResult.url, diskPath: filePath, originalName: file.originalname,
		mimeType: 'image/webp', size: processedBuffer.length, category: 'feedback',
		tenantSlug: tenant?.tenantSlug,
	});
	return feedbackResult;
}

/**
 * Upload any file type (universal) — saves as-is without conversion.
 * Images are still processed to WebP for consistency; other types kept raw.
 */
export async function uploadUniversalFile(
	file: Express.Multer.File,
	subCategory: string = 'feedback',
	tenant?: TenantPathContext,
): Promise<{ url: string; originalName: string; mimeType: string; size: number }> {
	const timestamp = Date.now();
	const randomName = crypto.randomBytes(8).toString('hex');
	const safeOriginalName = file.originalname
		.replace(/[^a-zA-Z0-9.]/g, '_')
		.substring(0, 40);

	const shouldProcessAsImage = isProcessableImage(file.mimetype);

	const fileExtension = shouldProcessAsImage
		? '.webp'
		: (path.extname(file.originalname) || '.bin');
	const fileName = `${timestamp}_${safeOriginalName}_${randomName}${fileExtension}`;

	const { dir: categoryDir, urlPrefix } = tenant?.isTenant
		? resolveTenantPaths(subCategory, false, tenant)
		: (() => {
			const d = path.join(uploadDir, subCategory);
			if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
			return { dir: d, urlPrefix: `/uploads/${subCategory}` };
		})();

	const filePath = path.join(categoryDir, fileName);
	let savedSize = file.size;

	if (shouldProcessAsImage) {
		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 1920,
			maxHeight: 1080,
			format: 'webp',
		});
		await writeFile(filePath, processedBuffer);
		savedSize = processedBuffer.length;
	} else {
		await writeFile(filePath, file.buffer);
		savedSize = file.size;
	}

	const result = {
		url: `${urlPrefix}/${fileName}`,
		originalName: file.originalname,
		mimeType: shouldProcessAsImage ? 'image/webp' : file.mimetype,
		size: savedSize,
	};

	registerUploadedFile({
		url: result.url, diskPath: filePath, originalName: file.originalname,
		mimeType: result.mimeType, size: result.size, category: subCategory,
		tenantSlug: tenant?.tenantSlug,
	});

	return result;
}

/**
 * Delete file from uploads directory
 */
export async function deleteFile(fileUrl: string): Promise<void> {
	try {
		if (!fileUrl || fileUrl === '') return;
		if (isProtectedDefaultImageUrl(fileUrl)) return;

		// Extract filename and category from URL
		const urlParts = fileUrl.split('/');
		const fileName = urlParts[urlParts.length - 1];
		let category = 'general';
		let baseDir = uploadDir;

		// Determine category and base directory from URL structure
		if (fileUrl.includes('/attached_assets/')) {
			baseDir = assetsDir;
			const assetIndex = urlParts.indexOf('attached_assets');
			if (assetIndex !== -1 && urlParts[assetIndex + 1]) {
				category = urlParts[assetIndex + 1];
			}
		} else if (fileUrl.includes('/uploads/')) {
			baseDir = uploadDir;
			const uploadIndex = urlParts.indexOf('uploads');
			if (uploadIndex !== -1) {
				const relParts = urlParts.slice(uploadIndex + 1).filter(Boolean);
				if (relParts.length > 0) {
					category = relParts[0];
					const nestedPath = path.join(baseDir, ...relParts);
					if (fs.existsSync(nestedPath)) {
						await promisify(fs.unlink)(nestedPath);
						console.log(`Deleted old file: ${nestedPath}`);
						return;
					}
				}
			}
		}

		// Construct file path (satu segmen kategori + nama file; kompatibilitas URL lama)
		const filePath = path.join(baseDir, category, fileName);

		// Check if file exists and delete
		if (fs.existsSync(filePath)) {
			await promisify(fs.unlink)(filePath);
			console.log(`Deleted old file: ${filePath}`);
		} else {
			// Fallback: try direct path without category (for old files)
			const fallbackPath = path.join(baseDir, fileName);
			if (fs.existsSync(fallbackPath)) {
				await promisify(fs.unlink)(fallbackPath);
				console.log(`Deleted old file (fallback): ${fallbackPath}`);
			}
		}
	} catch (error) {
		console.error('Error deleting file:', error);
		// Don't throw error here - file deletion shouldn't break upload process
	}
}

/**
 * Cleanup unused images from berita folder (main DB or tenant community path).
 */
export async function cleanupBeritaImages(
	beritaId: string,
	usedImageUrls: string[],
	tenant?: TenantPathContext,
): Promise<void> {
	const { dir, urlPrefix } =
		tenant?.isTenant && tenant.tenantSlug
			? resolveTenantPaths(`berita/${beritaId}`, false, tenant)
			: {
				dir: path.join(uploadDir, 'berita', beritaId),
				urlPrefix: `/uploads/berita/${beritaId}`,
			};
	const dirs = [dir];

	for (const cleanupDir of dirs) {
		try {
			if (!fs.existsSync(cleanupDir)) continue;

			const files = fs.readdirSync(cleanupDir);
			console.log(`📂 Found ${files.length} files in ${cleanupDir}`);

			if (usedImageUrls.length === 0) {
				for (const file of files) {
					const filePath = path.join(cleanupDir, file);
					await promisify(fs.unlink)(filePath);
					console.log(`Deleted: ${filePath}`);
				}
			} else {
				const pathMarker = `${urlPrefix}/`;
				const usedFilenames = usedImageUrls
					.filter((url) => url.includes(pathMarker))
					.map((url) => path.basename(url));

				for (const file of files) {
					if (!usedFilenames.includes(file)) {
						const filePath = path.join(cleanupDir, file);
						await promisify(fs.unlink)(filePath);
						console.log(`🧹 Cleaned up unused image: ${filePath}`);
					}
				}
			}

			const remainingFiles = fs.readdirSync(cleanupDir);
			if (remainingFiles.length === 0) {
				fs.rmdirSync(cleanupDir);
				console.log(`📁 Removed empty directory: ${cleanupDir}`);
			}
		} catch (error) {
			console.error(`Error cleaning up images in ${cleanupDir}:`, error);
		}
	}
}

/**
 * Extract image URLs from berita content
 */
export function extractImageUrlsFromContent(content: string): string[] {
	const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
	const urls: string[] = [];
	let match;

	while ((match = imgRegex.exec(content)) !== null) {
		urls.push(match[1]);
	}

	return urls;
}

/**
 * Helper function to migrate existing files to organized folders
 */
export async function migrateExistingFiles(): Promise<void> {
	try {
		console.log('Starting file migration...');

		// Migrate files from attached_assets root to subfolders
		const assetFiles = fs
			.readdirSync(assetsDir)
			.filter((file) => fs.statSync(path.join(assetsDir, file)).isFile());

		for (const file of assetFiles) {
			const oldPath = path.join(assetsDir, file);
			const newPath = path.join(assetsDir, 'general', file);

			// Ensure general folder exists
			await ensureUploadDirectory('general', true);

			// Move file
			fs.renameSync(oldPath, newPath);
			console.log(`Migrated: ${file} -> general/${file}`);
		}

		// Migrate files from uploads root to subfolders
		if (fs.existsSync(uploadDir)) {
			const uploadFiles = fs
				.readdirSync(uploadDir)
				.filter((file) => fs.statSync(path.join(uploadDir, file)).isFile());

			for (const file of uploadFiles) {
				const oldPath = path.join(uploadDir, file);
				const newPath = path.join(uploadDir, 'general', file);

				// Ensure general folder exists
				await ensureUploadDirectory('general', false);

				// Move file
				fs.renameSync(oldPath, newPath);
				console.log(`Migrated: ${file} -> general/${file}`);
			}
		}

		console.log('File migration completed!');
	} catch (error) {
		console.error('Error during file migration:', error);
	}
}

// ---------------------------------------------------------------------------
// Temporary onboarding upload helpers
// ---------------------------------------------------------------------------

const TEMP_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Upload a file to a temporary namespace scoped by registration code.
 * Returns { url, diskPath } so the caller can store metadata.
 */
export async function uploadTempOnboarding(
	file: Express.Multer.File,
	code: string,
	category: UploadCategory = 'organization',
): Promise<{ url: string; diskPath: string }> {
	const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
	const sub = `community/tmp/${safeCode}/${category}`;
	const dir = path.join(assetsDir, sub);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

	const timestamp = Date.now();
	const randomName = crypto.randomBytes(8).toString('hex');
	const ext = path.extname(file.originalname) || '.bin';
	const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_').substring(0, 20);
	const fileName = `${timestamp}_${safeName}_${randomName}${ext}`;
	const filePath = path.join(dir, fileName);
	await writeFile(filePath, file.buffer);

	const url = `/attached_assets/${sub}/${fileName}`;
	registerUploadedFile({
		url,
		diskPath: filePath,
		originalName: file.originalname,
		mimeType: file.mimetype,
		size: file.size,
		category: `temp-${category}`,
		tenantSlug: 'tmp',
	});
	return { url, diskPath: filePath };
}

/**
 * Move a file from its temporary path to the final tenant path and return the new URL.
 * If the source doesn't exist (already moved/deleted), returns the original URL unchanged.
 */
export function promoteTempFile(
	diskPath: string,
	tempUrl: string,
	tenantSlug: string,
	category: string,
): string {
	if (!fs.existsSync(diskPath)) return tempUrl;

	const safeSlug = tenantSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'unknown';
	const destSub = `community/${safeSlug}/${category}`;
	const destDir = path.join(assetsDir, destSub);
	if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

	const fileName = path.basename(diskPath);
	const destPath = path.join(destDir, fileName);
	fs.renameSync(diskPath, destPath);
	return `/attached_assets/${destSub}/${fileName}`;
}

/**
 * Delete all temporary files for a given registration code.
 */
export function cleanupTempDir(code: string): void {
	const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
	const tmpDir = path.join(assetsDir, 'community', 'tmp', safeCode);
	if (fs.existsSync(tmpDir)) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		console.log(`[temp-upload] Cleaned up temp dir for code ${safeCode}`);
	}
}

/**
 * Run periodic cleanup of expired temporary uploads.
 * Deletes disk files and MongoDB metadata for uploads past their TTL.
 */
export async function runTempUploadCleanup(): Promise<number> {
	try {
		const { TempUpload } = await import('../db/mongodb');
		const expired = await TempUpload.find({
			consumedAt: null,
			expiresAt: { $lt: new Date() },
		}).lean();

		let cleaned = 0;
		const codeDirs = new Set<string>();

		for (const doc of expired) {
			const d = doc as any;
			if (d.diskPath && fs.existsSync(d.diskPath)) {
				try { fs.unlinkSync(d.diskPath); } catch {}
			}
			if (d.code) codeDirs.add(d.code);
			cleaned++;
		}

		if (expired.length > 0) {
			await TempUpload.deleteMany({
				_id: { $in: expired.map((d: any) => d._id) },
			});
		}

		Array.from(codeDirs).forEach((c) => {
			cleanupTempDir(c);
		});

		if (cleaned > 0) {
			console.log(`[temp-upload] TTL cleanup: removed ${cleaned} expired file(s)`);
		}
		return cleaned;
	} catch (err) {
		console.warn('[temp-upload] TTL cleanup error:', err);
		return 0;
	}
}

export { TEMP_UPLOAD_TTL_MS };
