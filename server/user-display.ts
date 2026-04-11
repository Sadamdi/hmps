/**
 * Nama yang ditampilkan sebagai publisher/owner di konten publik & notifikasi.
 * Mengutamakan divisionLabel (nama divisi/unit) jika diisi; fallback ke name.
 */
export function getPublisherDisplayName(user: {
	name?: string | null;
	divisionLabel?: string | null;
}): string {
	const label =
		typeof user?.divisionLabel === 'string' ? user.divisionLabel.trim() : '';
	if (label) return label;
	const n = typeof user?.name === 'string' ? user.name.trim() : '';
	return n || 'Unknown';
}
