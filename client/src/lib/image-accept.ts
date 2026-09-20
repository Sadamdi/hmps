/**
 * Accept-string generik untuk input file gambar yang dipakai di seluruh FE HMPS.
 *
 * Catatan:
 * - `image/*` saja TIDAK menjamin HEIC/HEIF/AVIF masuk file picker di Safari/iOS,
 *   karena beberapa browser hanya mencantumkan subtype yang dikenal. Karena itu
 *   kita tambahkan ekstensi file eksplisit sehingga dialog "Choose File" membuka
 *   tipe yang dimaksud di Windows / macOS / iOS / Android.
 * - Daftar ekstensi disinkronkan dengan backend `isProcessableImage()` di
 *   `server/image-processor.ts`. Saat ini didukung:
 *   jpg/jpeg, png, webp, gif, bmp, tif/tiff, avif, heic, heif.
 * - `image/heic` & `image/heif` ditambahkan eksplisit supaya Safari/iOS
 *   yang kadang tidak membaca ekstensi `.heic`/`.heif` tetap menampilkan
 *   file di file picker.
 */
export const ALL_IMAGE_ACCEPT = [
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/bmp',
	'image/avif',
	'image/heic',
	'image/heif',
	'image/heic-sequence',
	'image/heif-sequence',
	'image/tiff',
	'image/*',
	'.heic',
	'.heif',
	'.avif',
	'.bmp',
	'.tif',
	'.tiff',
	'.webp',
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
].join(',');