/**
 * Photopea kadang crash (mis. TypeError reading 'at') saat parse PSD dari Photoshop CC
 * dengan blok layer tambahan. ag-psd membaca struktur + piksel lalu menulis ulang PSD
 * yang lebih "bersih" tanpa chunk asing — biasanya aman untuk Photopea.
 */
export async function normalizePsdForPhotopea(
	buffer: ArrayBuffer,
): Promise<ArrayBuffer> {
	try {
		const { readPsd, writePsd } = await import('ag-psd');
		const psd = readPsd(buffer, {
			skipThumbnail: true,
			logMissingFeatures: false,
		});
		return writePsd(psd, { invalidateTextLayers: false });
	} catch (e) {
		console.warn(
			'[banner] Normalisasi PSD gagal, memakai file mentah:',
			e,
		);
		return buffer;
	}
}
