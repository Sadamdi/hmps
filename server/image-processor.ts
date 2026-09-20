import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { promisify } from 'util';

const unlink = promisify(fs.unlink);

/**
 * Interface untuk konfigurasi image processing
 */
interface ImageProcessingOptions {
	quality?: number; // Kualitas WebP (1-100, default: 80)
	maxWidth?: number; // Lebar maksimum (default: 1920)
	maxHeight?: number; // Tinggi maksimum (default: 1080)
	format?: 'webp' | 'jpeg' | 'png'; // Format output (default: webp)
}

/**
 * Memproses gambar: konversi ke WebP, kompresi, dan resize jika perlu
 * Mengembalikan buffer gambar yang sudah diproses
 */
export async function processImage(
	inputBuffer: Buffer,
	options: ImageProcessingOptions = {}
): Promise<Buffer> {
	const {
		quality = 80,
		maxWidth = 1920,
		maxHeight = 1080,
		format = 'webp',
	} = options;

	try {
		// `rotate()` tanpa argumen menerapkan auto-orientasi EXIF, sehingga foto portrait
		// dari kamera HP (yang menyimpan piksel landscape + tag Orientation) tetap tampil
		// dalam orientasi yang benar setelah dikonversi ke WebP/JPEG/PNG.
		let processor = sharp(inputBuffer, { failOn: 'none' }).rotate();

		// Metadata diambil dari processor yang sudah di-rotate agar width/height
		// merefleksikan dimensi visual akhir (bukan piksel mentah pre-EXIF).
		const metadata = await processor.metadata();

		if (metadata.width && metadata.height) {
			if (metadata.width > maxWidth || metadata.height > maxHeight) {
				processor = processor.resize(maxWidth, maxHeight, {
					fit: 'inside',
					withoutEnlargement: true,
				});
			}
		}

		// Konversi ke format yang diinginkan dengan kompresi
		switch (format) {
			case 'webp':
				processor = processor.webp({
					quality,
					effort: 6, // Tingkat kompresi (0-6, semakin tinggi semakin baik tapi lambat)
				});
				break;
			case 'jpeg':
				processor = processor.jpeg({ quality });
				break;
			case 'png':
				processor = processor.png({
					quality,
					compressionLevel: 9, // Kompresi PNG (0-9)
				});
				break;
		}

		// Proses dan kembalikan buffer
		const processedBuffer = await processor.toBuffer();

		return processedBuffer;
	} catch (error) {
		console.error('Error processing image:', error);
		throw new Error('Failed to process image');
	}
}

/**
 * Memproses file gambar dan menyimpannya
 * Menghapus file lama jika ada, dan mengembalikan path file baru
 */
export async function processAndSaveImage(
	inputFile: Express.Multer.File,
	outputPath: string,
	oldFilePath?: string,
	options: ImageProcessingOptions = {}
): Promise<string> {
	try {
		// Hapus file lama jika ada
		if (oldFilePath && fs.existsSync(oldFilePath)) {
			await unlink(oldFilePath);
		}

		// Proses gambar
		const processedBuffer = await processImage(inputFile.buffer, options);

		// Tentukan ekstensi file berdasarkan format
		const format = options.format || 'webp';
		const fileExtension = `.${format}`;

		// Ganti ekstensi file output dengan format yang baru
		const parsedPath = path.parse(outputPath);
		const newOutputPath = path.join(
			parsedPath.dir,
			parsedPath.name + fileExtension
		);

		// Pastikan direktori output ada
		const outputDir = path.dirname(newOutputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Simpan file yang sudah diproses
		await fs.promises.writeFile(newOutputPath, processedBuffer);

		return newOutputPath;
	} catch (error) {
		console.error('Error processing and saving image:', error);
		throw new Error('Failed to process and save image');
	}
}

/**
 * Mendapatkan informasi ukuran file dalam format yang mudah dibaca
 */
export function getFileSizeInfo(sizeInBytes: number): string {
	if (sizeInBytes < 1024) {
		return `${sizeInBytes} B`;
	} else if (sizeInBytes < 1024 * 1024) {
		return `${(sizeInBytes / 1024).toFixed(2)} KB`;
	} else {
		return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
	}
}

/**
 * Normalisasi mimetype dari Multer/FileReader agar konsisten lintas browser/OS.
 * - Beberapa browser/OS mengirim `.heic`/`.heif` sebagai `image/heic`, `image/heif`,
 *   atau bahkan `application/octet-stream`. Kita tebak dari ekstensi file kalau
 *   mimetype kosong/generik.
 * - Return tuple [normalizedMimetype, extensionHint].
 */
export function normalizeImageMime(
	mimetype: string | undefined | null,
	originalName?: string | null,
): { mime: string; ext: string } {
	let mime = (mimetype || '').toLowerCase().trim();
	const name = (originalName || '').toLowerCase();

	const extFromName = (() => {
		const m = name.match(/\.([a-z0-9]+)$/);
		return m ? m[1] : '';
	})();

	const extByMime: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/pjpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp',
		'image/gif': 'gif',
		'image/bmp': 'bmp',
		'image/x-ms-bmp': 'bmp',
		'image/tiff': 'tiff',
		'image/avif': 'avif',
		'image/heic': 'heic',
		'image/heif': 'heif',
	};

	const extByFile: Record<string, string> = {
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		webp: 'image/webp',
		gif: 'image/gif',
		bmp: 'image/bmp',
		dib: 'image/bmp',
		tif: 'image/tiff',
		tiff: 'image/tiff',
		avif: 'image/avif',
		heic: 'image/heic',
		heif: 'image/heif',
	};

	// 1) Kalau mimetype generic / kosong, tebak dari ekstensi file
	if (
		!mime ||
		mime === 'application/octet-stream' ||
		mime === 'binary/octet-stream' ||
		mime === ''
	) {
		if (extFromName && extByFile[extFromName]) {
			mime = extByFile[extFromName];
		}
	}

	// 2) Kalau mimetype valid tapi tidak ada di map, fallback ke ext
	if (!extByMime[mime] && extFromName && extByFile[extFromName]) {
		mime = extByFile[extFromName];
	}

	// 3) Beberapa OS kirim 'image/jpg' (non-standar) → normalkan ke jpeg
	if (mime === 'image/jpg' || mime === 'image/pjpeg') {
		mime = 'image/jpeg';
	}

	const ext = extByMime[mime] || extFromName || 'bin';
	return { mime, ext };
}

/**
 * Cek apakah file adalah gambar yang bisa diproses.
 * Mendukung deteksi via mimetype ATAU ekstensi file sebagai safety net
 * (beberapa browser/OS mengirim mimetype kosong atau application/octet-stream
 * untuk format seperti HEIC/HEIF/AVIF).
 */
export function isProcessableImage(
	mimetype: string,
	originalName?: string | null,
): boolean {
	const { mime } = normalizeImageMime(mimetype, originalName);
	const supported = [
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/gif',
		'image/tiff',
		'image/bmp',
		'image/avif',
		'image/heic',
		'image/heif',
	];
	return supported.includes(mime);
}
