/**
 * Karya Mahasiswa TI — kontrak bersama frontend + backend.
 *
 * Akun mahasiswa terpisah dari akun pengurus dan pembeli. Pendaftaran mandiri hanya untuk email
 * institusi mahasiswa Teknik Informatika UIN Malang: `NIM@student.uin-malang.ac.id`, NIM 12 digit
 * dengan kode prodi di digit 3–6 (TI = `0605`). Angkatan berapa pun lolos (mis. 190605…, 230605…, 260605…).
 * Akun di luar aturan itu hanya bisa dibuat admin dari dashboard.
 */

export const KARYA_STUDENT_EMAIL_DOMAIN = 'student.uin-malang.ac.id';
/** Kode prodi Teknik Informatika di NIM (digit ke-3 s.d. ke-6). */
export const KARYA_TI_PRODI_CODES = ['0605'] as const;
export const KARYA_ADMIN_CONTACT = 'himatif.encoder@gmail.com';

export const KARYA_NOT_ELIGIBLE_MESSAGE =
	'Hanya mahasiswa Teknik Informatika UIN Malang yang bisa masuk, memakai email kampus NIM@student.uin-malang.ac.id. ' +
	`Jika kamu mahasiswa TI dan merasa ini keliru, hubungi administrator di ${KARYA_ADMIN_CONTACT}.`;

export type KaryaEligibility =
	| { ok: true; nim: string; angkatan: number }
	| { ok: false; reason: 'EMAIL_DOMAIN' | 'NIM_FORMAT' | 'NOT_TI' };

/** Cek email mahasiswa TI. `prodiCodes` bisa ditimpa server dari env. */
export function checkKaryaEmail(email: string, prodiCodes: readonly string[] = KARYA_TI_PRODI_CODES): KaryaEligibility {
	const e = String(email || '').trim().toLowerCase();
	const at = e.lastIndexOf('@');
	if (at < 1) return { ok: false, reason: 'EMAIL_DOMAIN' };
	const local = e.slice(0, at);
	const domain = e.slice(at + 1);
	if (domain !== KARYA_STUDENT_EMAIL_DOMAIN) return { ok: false, reason: 'EMAIL_DOMAIN' };
	if (!/^\d{12}$/.test(local)) return { ok: false, reason: 'NIM_FORMAT' };
	if (!prodiCodes.includes(local.slice(2, 6))) return { ok: false, reason: 'NOT_TI' };
	return { ok: true, nim: local, angkatan: 2000 + Number(local.slice(0, 2)) };
}

/** Angkatan dari NIM 12 digit (null bila bukan NIM). */
export function angkatanFromNim(nim: string | null | undefined): number | null {
	const s = String(nim || '');
	return /^\d{12}$/.test(s) ? 2000 + Number(s.slice(0, 2)) : null;
}

// ── Batas media ──
export const KARYA_LIMITS = {
	/** Total semua file unggahan satu mahasiswa (semua karya digabung). */
	quotaBytesPerStudent: 100 * 1024 * 1024,
	maxProjectsPerStudent: 30,
	maxImagesPerProject: 8,
	maxImageBytes: 5 * 1024 * 1024,
	maxVideosPerProject: 1,
	maxVideoBytes: 30 * 1024 * 1024,
	maxLinksPerProject: 10,
	maxTagsPerProject: 8,
	maxRelatedPerProject: 6,
	maxShortlinksPerStudent: 10,
	maxSkills: 20,
} as const;

export const KARYA_CATEGORIES = [
	{ id: 'web', label: 'Web' },
	{ id: 'mobile', label: 'Mobile' },
	{ id: 'ai-data', label: 'AI / Data' },
	{ id: 'game', label: 'Game' },
	{ id: 'iot', label: 'IoT' },
	{ id: 'uiux', label: 'UI/UX' },
	{ id: 'desktop', label: 'Desktop' },
	{ id: 'security', label: 'Keamanan' },
	{ id: 'lainnya', label: 'Lainnya' },
] as const;
export type KaryaCategoryId = (typeof KARYA_CATEGORIES)[number]['id'];

export type KaryaVisibility = 'public' | 'private';
/** draft = belum dikirim; pending = menunggu review; approved = tayang; revision = perlu revisi; hidden = disembunyikan admin */
export type KaryaStatus = 'draft' | 'pending' | 'approved' | 'revision' | 'hidden';

export const KARYA_STATUS_LABEL: Record<KaryaStatus, string> = {
	draft: 'Draf',
	pending: 'Menunggu review',
	approved: 'Disetujui',
	revision: 'Perlu revisi',
	hidden: 'Disembunyikan admin',
};

export type KaryaLinkKind = 'youtube' | 'gdrive' | 'demo' | 'repo' | 'video' | 'other';
export type KaryaRepoHost = 'github' | 'gitlab' | 'bitbucket' | 'codeberg';

export const KARYA_REPO_HOSTS: Record<KaryaRepoHost, { label: string; domain: string }> = {
	github: { label: 'GitHub', domain: 'github.com' },
	gitlab: { label: 'GitLab', domain: 'gitlab.com' },
	bitbucket: { label: 'Bitbucket', domain: 'bitbucket.org' },
	codeberg: { label: 'Codeberg', domain: 'codeberg.org' },
};

export interface KaryaRepoInfo {
	host: KaryaRepoHost;
	owner: string;
	name: string;
	url: string;
	description: string;
	homepage: string;
	stars: number;
	forks: number;
	language: string;
	topics: string[];
	/** SPDX lisensi bila ada (mis. MIT) */
	license?: string;
	/** Gambar pratinjau repo (Open Graph) — dipakai sebagai sampul cadangan */
	ogImage?: string;
	updatedAt: string | null;
	fetchedAt: string;
}

export interface KaryaMedia {
	id: string;
	type: 'image' | 'video';
	url: string;
	size: number;
	caption?: string;
}

export interface KaryaLink {
	kind: KaryaLinkKind;
	url: string;
	label?: string;
}

export interface KaryaRelated {
	/** Karya lain di situs ini (slug) atau repo luar (url) */
	projectSlug?: string;
	url?: string;
	label: string;
}

export interface KaryaSocialLinks {
	github?: string;
	gitlab?: string;
	linkedin?: string;
	instagram?: string;
	website?: string;
	cv?: string;
}

/** Validasi URL sosial: host tertentu saja, https. Mengembalikan URL bersih atau '' bila tidak valid. */
const SOCIAL_HOSTS: Record<keyof KaryaSocialLinks, string[] | null> = {
	github: ['github.com'],
	gitlab: ['gitlab.com'],
	linkedin: ['linkedin.com', 'www.linkedin.com', 'id.linkedin.com'],
	instagram: ['instagram.com', 'www.instagram.com'],
	website: null,
	cv: null,
};

export function cleanHttpsUrl(raw: unknown, hosts: string[] | null = null): string {
	const s = String(raw || '').trim().slice(0, 500);
	if (!s) return '';
	try {
		const u = new URL(s);
		if (u.protocol !== 'https:') return '';
		if (u.username || u.password) return '';
		const host = u.hostname.toLowerCase();
		if (hosts && !hosts.includes(host)) return '';
		return u.toString();
	} catch {
		return '';
	}
}

export function cleanSocialLinks(raw: any): KaryaSocialLinks {
	const out: KaryaSocialLinks = {};
	for (const key of Object.keys(SOCIAL_HOSTS) as (keyof KaryaSocialLinks)[]) {
		const v = cleanHttpsUrl(raw?.[key], SOCIAL_HOSTS[key]);
		if (v) out[key] = v;
	}
	return out;
}

/** Klasifikasi link media: YouTube / Google Drive / lainnya. */
export function classifyKaryaLink(url: string): KaryaLinkKind {
	try {
		const h = new URL(url).hostname.toLowerCase();
		if (h === 'youtu.be' || h.endsWith('youtube.com')) return 'youtube';
		// File video langsung (mis. lampiran video README GitHub) → diputar di galeri
		if (/\.(mp4|webm|mov)(\?|$)/i.test(new URL(url).pathname) || (h === 'github.com' && /^\/user-attachments\/assets\//.test(new URL(url).pathname))) return 'video';
		if (h === 'drive.google.com' || h === 'docs.google.com') return 'gdrive';
		if (h === 'github.com' || h === 'gitlab.com' || h === 'bitbucket.org' || h === 'codeberg.org') return 'repo';
		return 'demo';
	} catch {
		return 'other';
	}
}

export function youtubeIdFromUrl(url: string): string | null {
	try {
		const u = new URL(url);
		const h = u.hostname.toLowerCase();
		let id = '';
		if (h === 'youtu.be') id = u.pathname.slice(1);
		else if (h.endsWith('youtube.com')) {
			if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
			else {
				const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
				id = m?.[1] || '';
			}
		}
		return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
	} catch {
		return null;
	}
}

export function gdriveFileIdFromUrl(url: string): string | null {
	try {
		const u = new URL(url);
		if (!['drive.google.com', 'docs.google.com'].includes(u.hostname.toLowerCase())) return null;
		const m = u.pathname.match(/\/d\/([A-Za-z0-9_-]{10,})/);
		const id = m?.[1] || u.searchParams.get('id') || '';
		return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : null;
	} catch {
		return null;
	}
}

/** Parse URL repo publik → host/owner/name. */
export function parseRepoUrl(raw: string): { host: KaryaRepoHost; owner: string; name: string } | null {
	try {
		const u = new URL(String(raw || '').trim());
		if (u.protocol !== 'https:') return null;
		const hostMap: Record<string, KaryaRepoHost> = {
			'github.com': 'github',
			'www.github.com': 'github',
			'gitlab.com': 'gitlab',
			'bitbucket.org': 'bitbucket',
			'codeberg.org': 'codeberg',
		};
		const host = hostMap[u.hostname.toLowerCase()];
		if (!host) return null;
		const parts = u.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
		if (parts.length < 2) return null;
		const [owner, name] = parts;
		const ok = /^[A-Za-z0-9_.-]{1,100}$/;
		if (!ok.test(owner) || !ok.test(name)) return null;
		return { host, owner, name };
	} catch {
		return null;
	}
}

/** Slug URL dari teks bebas. */
export function karyaSlugify(v: string, max = 70): string {
	return String(v || '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, max)
		.replace(/-+$/g, '');
}

/** Tag: huruf kecil, maks 30 karakter, tanpa simbol aneh. */
export function cleanKaryaTags(raw: unknown, max: number = KARYA_LIMITS.maxTagsPerProject): string[] {
	const list = Array.isArray(raw) ? raw : String(raw || '').split(',');
	const out: string[] = [];
	for (const t of list) {
		const v = String(t || '')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9+#.\- ]/g, '')
			.replace(/\s+/g, ' ')
			.slice(0, 30);
		if (v && !out.includes(v)) out.push(v);
		if (out.length >= max) break;
	}
	return out;
}

/** Shortlink slug: 3–40 karakter a-z0-9-, tidak boleh kata cadangan. */
export const KARYA_RESERVED_SHORTLINKS = new Set([
	'admin', 'api', 'dashboard', 'login', 'logout', 'karya', 'go', 'toko', 'berita', 'event', 'events', 'prodi',
	'profil', 'himatif', 'encoder', 'hmps', 'uin', 'official', 'support', 'help', 'bantuan', 'sitemap', 'robots',
]);
export function validShortlinkSlug(slug: string): boolean {
	return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !KARYA_RESERVED_SHORTLINKS.has(slug);
}

export function formatBytes(n: number): string {
	if (!n || n < 1024) return `${n || 0} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── Bentuk data publik ──
export interface KaryaStudentPublic {
	username: string;
	name: string;
	angkatan: number | null;
	headline: string;
	bio: string;
	avatarUrl: string;
	skills: string[];
	social: KaryaSocialLinks;
	verifiedTi: boolean;
	/** Profil boleh dibuka publik (link profil hanya ditampilkan bila true) */
	profileVisible?: boolean;
	shortlink?: string;
}

export interface KaryaProjectCard {
	slug: string;
	title: string;
	summary: string;
	category: string;
	tags: string[];
	coverUrl: string;
	/** Sampul otomatis dari template (tambahkan `?theme=light|dark` sesuai tema) */
	coverGenerated?: boolean;
	mediaLabel: string;
	featured: boolean;
	author: { username: string; name: string; angkatan: number | null; avatarUrl: string };
	publishedAt: string | null;
}
