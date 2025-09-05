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
	| 'articles' // Gambar artikel dan thumbnail
	| 'library' // Media library (foto/video kegiatan)
	| 'general'; // File umum lainnya

// Membuat subfolder jika belum ada
async function ensureUploadDirectory(
	category: UploadCategory,
	useAssetsDir: boolean
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
		fileSize: 5 * 1024 * 1024, // 5MB
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
	subFolder?: string // Subfolder tambahan (contoh: articleId)
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

		// Add subfolder if specified (for article-specific folders)
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
 * Handles organization member image upload with automatic processing
 * Converts PNG/JPEG to WebP with compression while maintaining resolution
 */
export async function uploadOrganizationMemberImage(
	file: Express.Multer.File,
	oldFileUrl?: string // URL file lama yang akan dihapus
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
			if (uploadIndex !== -1 && urlParts[uploadIndex + 1]) {
				category = urlParts[uploadIndex + 1];
			}
		}

		// Construct file path
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
 * Cleanup unused images from article folder
 */
export async function cleanupArticleImages(
	articleId: string,
	usedImageUrls: string[]
): Promise<void> {
	try {
		const articleDir = path.join(uploadDir, 'articles', articleId);

		if (!fs.existsSync(articleDir)) {
			console.log(`📁 Article directory not found: ${articleDir}`);
			return;
		}

		// Get all files in article directory
		const files = fs.readdirSync(articleDir);
		console.log(`📂 Found ${files.length} files in article ${articleId}`);

		if (usedImageUrls.length === 0) {
			// Delete all files (article deletion case)
			console.log(`🗑️ Deleting entire article folder: ${articleId}`);
			for (const file of files) {
				const filePath = path.join(articleDir, file);
				await promisify(fs.unlink)(filePath);
				console.log(`Deleted: ${filePath}`);
			}
		} else {
			// Extract filenames from used URLs
			const usedFilenames = usedImageUrls
				.filter((url) => url.includes(`/uploads/articles/${articleId}/`))
				.map((url) => path.basename(url));

			console.log(`🔍 Used filenames:`, usedFilenames);

			// Delete files that are not in the used list
			for (const file of files) {
				if (!usedFilenames.includes(file)) {
					const filePath = path.join(articleDir, file);
					await promisify(fs.unlink)(filePath);
					console.log(`🧹 Cleaned up unused image: ${filePath}`);
				}
			}
		}

		// Remove empty directory if no files left
		const remainingFiles = fs.readdirSync(articleDir);
		if (remainingFiles.length === 0) {
			fs.rmdirSync(articleDir);
			console.log(`📁 Removed empty article directory: ${articleDir}`);
		}
	} catch (error) {
		console.error('Error cleaning up article images:', error);
	}
}

/**
 * Extract image URLs from article content
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
