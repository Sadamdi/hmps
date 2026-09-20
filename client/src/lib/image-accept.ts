/**
 * Accept-string generik untuk input file gambar yang dipakai di seluruh FE HMPS.
 *
 * Catatan:
 * - `image/*` saja TIDAK menjamin HEIC/HEIF/AVIF masuk file picker di Safari/iOS,
 *   karena beberapa browser hanya mencantumkan subtype yang dikenal. Karena itu
 *   kita tambahkan ekstensi file eksplisit sehingga dialog "Choose File" membuka
 *   tipe yang dimaksud di Windows / macOS / iOS / Android.
 * - Daftar ekstensi disinkronkan dengan backend `isProcessableImage()` di
 *   `server/image-processor.ts`.
 */
export const ALL_IMAGE_ACCEPT =
	'image/*,.heic,.heif,.avif,.bmp,.tif,.tiff,.webp,.png,.jpg,.jpeg,.gif';