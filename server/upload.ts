import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { promisify } from 'util';
import { isProcessableImage, processImage } from './image-processor';

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

// Create both upload and assets directories if they don't exist
const uploadDir = path.join(process.cwd(), 'uploads');
const assetsDir = path.join(process.cwd(), 'attached_assets');

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
	oldFileUrl?: string, // URL file lama yang akan dihapus
	subFolder?: string, // Subfolder tambahan (contoh: beritaId)
): Promise<string> {
	try {
		// Hapus file lama jika ada
		if (oldFileUrl) {
			await deleteFile(oldFileUrl);
		}

		// Generate a unique filename
		const timestamp = Date.now();
		const randomName = crypto.randomBytes(8).toString('hex');
		const safeOriginalName = file.originalname
			.replace(/[^a-zA-Z0-9.]/g, '_')
			.substring(0, 20);
		const fileExtension = path.extname(file.originalname);
		const fileName = `${timestamp}_${safeOriginalName}_${randomName}${fileExtension}`;

		// Ensure category directory exists
		let categoryDir = await ensureUploadDirectory(category, useAssetsDir);

		// Add subfolder if specified (for berita-specific folders)
		if (subFolder) {
			categoryDir = path.join(categoryDir, subFolder);
			if (!fs.existsSync(categoryDir)) {
				await mkdir(categoryDir, { recursive: true });
			}
		}

		// Determine paths
		const targetPath = subFolder
			? useAssetsDir
				? `/attached_assets/${category}/${subFolder}`
				: `/uploads/${category}/${subFolder}`
			: useAssetsDir
				? `/attached_assets/${category}`
				: `/uploads/${category}`;

		// Create file path
		const filePath = path.join(categoryDir, fileName);

		// Save the file
		await writeFile(filePath, file.buffer);

		// Return the URL (relative path for now)
		return `${targetPath}/${fileName}`;
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
): Promise<string> {
	try {
		if (oldFileUrl) {
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

		let categoryDir = await ensureUploadDirectory('berita', useAssetsDir);
		if (subFolder) {
			categoryDir = path.join(categoryDir, subFolder);
			if (!fs.existsSync(categoryDir)) {
				await mkdir(categoryDir, { recursive: true });
			}
		}

		const targetPath = subFolder
			? useAssetsDir
				? `/attached_assets/berita/${subFolder}`
				: `/uploads/berita/${subFolder}`
			: useAssetsDir
				? `/attached_assets/berita`
				: `/uploads/berita`;

		const filePath = path.join(categoryDir, fileName);

		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 1920,
			maxHeight: 1080,
			format: 'webp',
		});

		await writeFile(filePath, processedBuffer);

		return `${targetPath}/${fileName}`;
	} catch (error) {
		console.error('Error processing berita image:', error);
		throw new Error('Failed to process berita image');
	}
}

/**
 * Handles organization member image upload with automatic processing
 * Converts PNG/JPEG to WebP with compression while maintaining resolution
 */
export async function uploadOrganizationMemberImage(
	file: Express.Multer.File,
	oldFileUrl?: string, // URL file lama yang akan dihapus
): Promise<string> {
	try {
		// Hapus file lama jika ada
		if (oldFileUrl) {
			await deleteFile(oldFileUrl);
		}

		// Generate a unique filename dengan ekstensi WebP
		const timestamp = Date.now();
		const randomName = crypto.randomBytes(8).toString('hex');
		const safeOriginalName = file.originalname
			.replace(/[^a-zA-Z0-9.]/g, '_')
			.substring(0, 20);
		// Ganti ekstensi dengan .webp karena akan dikonversi
		const fileName = `${timestamp}_${safeOriginalName}_${randomName}.webp`;

		// Ensure organization directory exists
		const categoryDir = await ensureUploadDirectory('organization', false);
		const filePath = path.join(categoryDir, fileName);

		// Cek apakah file bisa diproses
		if (!isProcessableImage(file.mimetype)) {
			throw new Error(`File type ${file.mimetype} is not processable`);
		}

		// Proses gambar: konversi ke WebP dengan kompresi
		const processedBuffer = await processImage(file.buffer, {
			quality: 80, // Kualitas 80% untuk balance antara ukuran dan kualitas
			maxWidth: 1920, // Batas maksimal lebar
			maxHeight: 1080, // Batas maksimal tinggi
			format: 'webp', // Konversi ke WebP
		});

		// Simpan file yang sudah diproses
		await writeFile(filePath, processedBuffer);

		// Return the URL (relative path)
		const imageUrl = `/uploads/organization/${fileName}`;

		return imageUrl;
	} catch (error) {
		console.error('Error processing organization member image:', error);
		throw new Error('Failed to process organization member image');
	}
}

const LOCAL_UPLOADS_PREFIX = '/uploads/';

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

		const lecturersDir = path.join(uploadDir, 'prodi', 'lecturers');
		await mkdir(lecturersDir, { recursive: true });

		const fileName = `${safeSlug}.webp`;
		const filePath = path.join(lecturersDir, fileName);

		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 1920,
			maxHeight: 1080,
			format: 'webp',
		});

		await writeFile(filePath, processedBuffer);

		return `/uploads/prodi/lecturers/${fileName}`;
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

		const labsDir = path.join(uploadDir, 'prodi', 'labs', type);
		await mkdir(labsDir, { recursive: true });

		const fileName = `${labIndex}-${imgIndex}.webp`;
		const filePath = path.join(labsDir, fileName);

		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 1920,
			maxHeight: 1080,
			format: 'webp',
		});

		await writeFile(filePath, processedBuffer);

		return `/uploads/prodi/labs/${type}/${fileName}`;
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
): Promise<string> {
	try {
		await maybeDeleteLocalUpload(oldFileUrl);

		if (!isProcessableImage(file.mimetype)) {
			throw new Error(`File type ${file.mimetype} is not processable`);
		}

		const prodiDir = path.join(uploadDir, 'prodi');
		await mkdir(prodiDir, { recursive: true });

		const fileName = 'organization-structure.webp';
		const filePath = path.join(prodiDir, fileName);

		const processedBuffer = await processImage(file.buffer, {
			quality: 80,
			maxWidth: 2400,
			maxHeight: 2400,
			format: 'webp',
		});

		await writeFile(filePath, processedBuffer);

		return `/uploads/prodi/${fileName}`;
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
): Promise<string> {
	try {
		const filosofiDir = await ensureUploadDirectory('filosofi', true);
		const fileExtension = path.extname(file.originalname) || '.png';
		const safeKey = key.replace(/[/\\?*:<>|]/g, '_').trim();
		if (!safeKey) {
			throw new Error('Key is required for filosofi upload');
		}
		const fileName = `${safeKey}${fileExtension}`;

		// Hapus file lama dengan key yang sama (berbagai ekstensi)
		if (fs.existsSync(filosofiDir)) {
			const files = fs.readdirSync(filosofiDir);
			for (const f of files) {
				const baseName = path.basename(f, path.extname(f));
				if (baseName === safeKey) {
					const oldPath = path.join(filosofiDir, f);
					try {
						fs.unlinkSync(oldPath);
					} catch (e) {
						console.warn('Could not delete old filosofi file:', oldPath, e);
					}
				}
			}
		}

		const filePath = path.join(filosofiDir, fileName);
		await writeFile(filePath, file.buffer);

		return `/attached_assets/filosofi/${fileName}`;
	} catch (error) {
		console.error('Error uploading filosofi image:', error);
		throw new Error('Filosofi image upload failed');
	}
}

/**
 * Delete file from uploads directory
 */
export async function deleteFile(fileUrl: string): Promise<void> {
	try {
		if (!fileUrl || fileUrl === '') return;

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
 * Cleanup unused images from berita folder.
 * Cleanup unused images from berita folder.
 */
export async function cleanupBeritaImages(
	beritaId: string,
	usedImageUrls: string[],
): Promise<void> {
	const dirs = [path.join(uploadDir, 'berita', beritaId)];

	for (const dir of dirs) {
		try {
			if (!fs.existsSync(dir)) continue;

			const files = fs.readdirSync(dir);
			console.log(`📂 Found ${files.length} files in ${dir}`);

			if (usedImageUrls.length === 0) {
				for (const file of files) {
					const filePath = path.join(dir, file);
					await promisify(fs.unlink)(filePath);
					console.log(`Deleted: ${filePath}`);
				}
			} else {
				const usedFilenames = usedImageUrls
					.filter((url) => url.includes(`/uploads/berita/${beritaId}/`))
					.map((url) => path.basename(url));

				for (const file of files) {
					if (!usedFilenames.includes(file)) {
						const filePath = path.join(dir, file);
						await promisify(fs.unlink)(filePath);
						console.log(`🧹 Cleaned up unused image: ${filePath}`);
					}
				}
			}

			const remainingFiles = fs.readdirSync(dir);
			if (remainingFiles.length === 0) {
				fs.rmdirSync(dir);
				console.log(`📁 Removed empty directory: ${dir}`);
			}
		} catch (error) {
			console.error(`Error cleaning up images in ${dir}:`, error);
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
