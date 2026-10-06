/**
 * Penjaga sesi (4.52.0): deteksi token dicuri + batas diam.
 *  - Sidik jari ringan = keluarga browser + kelas OS dari User-Agent. Berubah di tengah sesi (mis. Chrome Windows →
 *    Firefox Linux) = cookie dipakai di perangkat lain → HANYA sesi itu dicabut. IP/negara berubah tidak mencabut
 *    (pindah jaringan wajar); cukup dicatat.
 *  - Sesi pengurus yang diam > 8 jam dicabut (token tetap 24 jam).
 * UA tanpa browser dikenal (curl, skrip, tes) tidak diperiksa agar tidak ada logout palsu.
 */
export const STAFF_IDLE_MS = 8 * 60 * 60 * 1000;

function osClass(ua: string): string {
	if (/Windows/i.test(ua)) return 'win';
	if (/iPhone|iPad|iOS/i.test(ua)) return 'ios';
	if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
	// Android "situs desktop" memakai UA Linux → satu kelas agar tidak logout palsu
	if (/Android|Linux|X11|CrOS/i.test(ua)) return 'linux';
	return '';
}

function browserFamily(ua: string): string {
	if (/Firefox\//i.test(ua)) return 'firefox';
	if (/Edg\/|Chrome\/|CriOS\//i.test(ua)) return 'chromium';
	if (/Safari\//i.test(ua)) return 'safari';
	return '';
}

export function uaFingerprint(ua: string): string {
	const b = browserFamily(ua);
	const o = osClass(ua);
	return b && o ? `${b}|${o}` : '';
}

/** true = jelas berbeda (keduanya terbaca dan tidak sama). */
export function fingerprintMismatch(storedUa: string, currentUa: string): boolean {
	const a = uaFingerprint(storedUa || '');
	const b = uaFingerprint(currentUa || '');
	return !!a && !!b && a !== b;
}
