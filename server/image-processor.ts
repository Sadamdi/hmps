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
		let processor = sharp(inputBuffer);

		// Dapatkan metadata gambar untuk menentukan apakah perlu resize
		const metadata = await processor.metadata();

		// Resize jika gambar lebih besar dari dimensi maksimum
		if (metadata.width && metadata.height) {
			if (metadata.width > maxWidth || metadata.height > maxHeight) {
				processor = processor.resize(maxWidth, maxHeight, {
					fit: 'inside', // Menjaga aspect ratio
					withoutEnlargement: true, // Tidak memperbesar gambar kecil
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
 * Cek apakah file adalah gambar yang bisa diproses
 */
export function isProcessableImage(mimetype: string): boolean {
	const processableTypes = [
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/gif',
		'image/tiff',
		'image/bmp',
	];
	return processableTypes.includes(mimetype);
}
