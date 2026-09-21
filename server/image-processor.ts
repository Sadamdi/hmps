import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { promisify } from 'util';

const unlink = promisify(fs.unlink);

/**
 * Decode HEIC/HEIF input via `heic-convert` (pure-JS implementation, tidak
 * butuh libheif/libde265 native). Hasil decode adalah raw RGBA buffer yang
 * kita bungkus ke dalam format JPEG via `sharp` agar pipeline resize/rotate/
 * webp yang sudah ada bisa jalan tanpa duplikasi.
 *
 * Cache lookup `processImage`: kita decode HEIC hanya sekali per call, dan
 * hasil JPEG intermediate dilempar ke pipeline sharp yang sama.
 */
let heicConvertModule: any | null | undefined; // lazy require cache
async function getHeicConvert(): Promise<any | null> {
	if (heicConvertModule !== undefined) return heicConvertModule;
	try {
		const mod = await import('heic-convert');
		heicConvertModule = mod.default ?? mod;
		return heicConvertModule;
	} catch (e) {
		console.warn(
			'[image-processor] heic-convert not available, HEIC/HEIF upload will fail:',
			(e as Error).message,
		);
		heicConvertModule = null;
		return null;
	}
}

/**
 * Decode HEIC/HEIF buffer ke JPEG buffer (qualitas default 92) atau null jika gagal.
 * - Pure-JS, cross-platform (Windows/Linux/macOS), tidak butuh system libheif.
 * - Output adalah JPEG yang siap diproses ulang oleh sharp.
 */
async function decodeHeicToJpeg(input: Buffer): Promise<Buffer | null> {
	const mod = await getHeicConvert();
	if (!mod) return null;
	try {
		const out = await mod({ buffer: input, format: 'JPEG', quality: 0.92 });
		return Buffer.from(out);
	} catch (e) {
		console.warn(
			'[image-processor] heic-convert decode failed:',
			(e as Error).message,
		);
		return null;
	}
}

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
 * Deteksi apakah buffer adalah HEIC/HEIF berdasarkan header bytes.
 * - HEIC/HEIF dimulai dengan box `ftyp` (bytes 4..8) dan major brand salah satu
 *   dari heic/heix/hevc/hevx/heim/heis/heics/heicm/mif1/msf1.
 * - AVIF juga pakai container ISOBMFF tapi major brand-nya `avif`; AVIF tidak
 *   boleh di-route ke `heic-convert` (codec AV1 vs HEVC) — sharp sudah bisa
 *   handle AVIF secara native. Kalau salah route, AVIF akan gagal decode.
 * - Pendekatan: cek major brand eksplisit agar AVIF tidak ikut salah deteksi
 *   sebagai HEIC walaupun share secondary brand `mif1` di header.
 */
function looksLikeHeic(input: Buffer): boolean {
	if (!input || input.length < 12) return false;
	// Bytes 4..7 harus ASCII 'ftyp' untuk ISOBMFF container.
	const brand = input.toString('ascii', 4, 8);
	if (brand !== 'ftyp') return false;
	// Bytes 8..12 adalah major brand (4 ASCII chars).
	const major = input.toString('ascii', 8, 12).toLowerCase();
	// Explicit AVIF exclusion: AVIF major brand = 'avif'. Jangan route ke heic-convert.
	if (major === 'avif') return false;
	const heicBrands = new Set([
		'heic',
		'heix',
		'hevc',
		'hevx',
		'heim',
		'heis',
		'heic', // duplicate di list sebelumnya (no-op, dibiarkan untuk backward)
		'heics',
		'heicm',
		'mif1',
		'msf1',
	]);
	return heicBrands.has(major);
}

/**
 * Memproses gambar: konversi ke WebP, kompresi, dan resize jika perlu.
 * - Mendukung HEIC/HEIF via fallback `heic-convert` (pure-JS).
 * - Mendukung AVIF, JPEG, PNG, WebP, GIF, TIFF, BMP via sharp.
 * - Mengembalikan buffer gambar yang sudah diproses (WebP by default).
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

	// Decode HEIC/HEIF ke JPEG intermediate sebelum masuk pipeline sharp.
	let processableBuffer = inputBuffer;
	if (looksLikeHeic(inputBuffer)) {
		const jpeg = await decodeHeicToJpeg(inputBuffer);
		if (!jpeg) {
			throw new Error(
				'Gagal decode HEIC/HEIF: heic-convert tidak tersedia atau file rusak.',
			);
		}
		processableBuffer = jpeg;
	}

	try {
		// `rotate()` tanpa argumen menerapkan auto-orientasi EXIF, sehingga foto portrait
		// dari kamera HP (yang menyimpan piksel landscape + tag Orientation) tetap tampil
		// dalam orientasi yang benar setelah dikonversi ke WebP/JPEG/PNG.
		let processor = sharp(processableBuffer, { failOn: 'none' }).rotate();

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
		'image/heic-sequence': 'heic',
		'image/heif-sequence': 'heif',
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
 *
 * Catatan tambahan: dekoder HEIC/HEIF butuh package `heic-convert` (pure-JS),
 * jadi walaupun mimetype cocok, prosesing bisa gagal kalau dependency ini
 * tidak terpasang. Pesan error akan membantu diagnosa.
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
		'image/heic-sequence',
		'image/heif-sequence',
	];
	return supported.includes(mime);
}
