/**
 * Alamat Ruang Mahasiswa (satu sumber untuk klien & server).
 *
 * Ruang Mahasiswa adalah wadah fitur mahasiswa TI. Saat ini isinya Karya (publik + dashboard);
 * ruang lain (belajar, kelompok, dll.) cukup menambah segmen baru di bawah STUDENT_SPACE_BASE.
 * Shortlink tetap /go/:slug.
 */
export const STUDENT_SPACE_BASE = '/ruang-mahasiswa';

export const STUDENT_SPACE_PATHS = {
	home: STUDENT_SPACE_BASE,
	karya: `${STUDENT_SPACE_BASE}/karya`,
	login: `${STUDENT_SPACE_BASE}/masuk`,
	register: `${STUDENT_SPACE_BASE}/daftar`,
	dashboard: `${STUDENT_SPACE_BASE}/dashboard`,
	newProject: `${STUDENT_SPACE_BASE}/dashboard/karya/baru`,
	editProject: (id: string) => `${STUDENT_SPACE_BASE}/dashboard/karya/edit/${id}`,
	preview: (id: string) => `${STUDENT_SPACE_BASE}/dashboard/karya/pratinjau/${id}`,
	profilePreview: `${STUDENT_SPACE_BASE}/dashboard/pratinjau-profil`,
	project: (slug: string) => `${STUDENT_SPACE_BASE}/karya/${slug}`,
	tag: (tag: string) => `${STUDENT_SPACE_BASE}/karya/tag/${encodeURIComponent(tag)}`,
	student: (username: string) => `${STUDENT_SPACE_BASE}/mahasiswa/${username}`,
	studentsDirectory: `${STUDENT_SPACE_BASE}/karya?lihat=mahasiswa`,
} as const;

/**
 * Alamat lama → alamat baru (dipakai redirect 301 server & redirect klien).
 * /karya → /ruang-mahasiswa/karya, /karya/:slug, /karya/tag/:t, /karya/mahasiswa/:u,
 * /karya/saya/* → dashboard, /karya/masuk, /karya/daftar, juga /mahasiswa* (sempat dipakai saat pengembangan).
 * null bila bukan alamat lama.
 */
export function legacyStudentSpacePath(pathname: string): string | null {
	const p = pathname.replace(/\/+$/, '') || '/';
	const B = STUDENT_SPACE_BASE;
	if (p === '/karya') return `${B}/karya`;
	if (p === '/karya/masuk' || p === '/mahasiswa/masuk') return `${B}/masuk`;
	if (p === '/karya/daftar' || p === '/mahasiswa/daftar') return `${B}/daftar`;
	if (p === '/karya/saya' || p === '/mahasiswa') return `${B}/dashboard`;
	let m = p.match(/^\/karya\/saya\/(.+)$/) || p.match(/^\/mahasiswa\/(karya\/.+|pratinjau-profil)$/);
	if (m) {
		const rest = m[1].replace(/^karya\//, '');
		if (rest === 'pratinjau-profil') return `${B}/dashboard/pratinjau-profil`;
		return `${B}/dashboard/karya/${rest}`;
	}
	m = p.match(/^\/karya\/(tag\/.+|mahasiswa\/.+)$/);
	if (m) return m[1].startsWith('tag/') ? `${B}/karya/${m[1]}` : `${B}/${m[1]}`;
	m = p.match(/^\/karya\/([^/]+)$/);
	if (m) return `${B}/karya/${m[1]}`;
	return null;
}
