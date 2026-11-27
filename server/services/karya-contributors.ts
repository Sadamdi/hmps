/**
 * Kontributor karya (pembuat lain selain pemilik).
 *
 * Sumber:
 * - manual  : pemilik menambah lewat username/link profil Karya TI atau username/link GitHub
 * - repo    : diambil otomatis dari daftar contributor repo GitHub (bot dibuang)
 * Penautan akun: kontributor GitHub otomatis tertaut ke akun Karya TI bila akun itu punya link GitHub
 * yang sama (profil → GitHub). Karya lalu tampil di profil mahasiswa tersebut sebagai "Kontributor".
 * Kontributor bisa menyembunyikan karya dari profilnya sendiri (hiddenByContributor).
 */
import { KaryaProject, KaryaStudent } from '../models/karya';

export interface ContributorEntry {
	key: string;
	studentId: any | null;
	githubLogin: string;
	name: string;
	avatarUrl: string;
	role: string;
	source: 'manual' | 'repo';
	hiddenByContributor: boolean;
	commits?: number;
}

const GH_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export function githubLoginFromUrl(url: string): string {
	const m = String(url || '').match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/?$/i);
	return m ? m[1].toLowerCase() : '';
}

function ghHeaders(): Record<string, string> {
	const h: Record<string, string> = { 'User-Agent': 'himatif-encoder-karya', Accept: 'application/vnd.github+json' };
	if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
	return h;
}

async function getJson(url: string): Promise<{ status: number; body: any }> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 8000);
	try {
		const r = await fetch(url, { headers: ghHeaders(), signal: ctrl.signal });
		return { status: r.status, body: r.ok ? await r.json() : null };
	} catch {
		return { status: 0, body: null };
	} finally {
		clearTimeout(t);
	}
}

/** Akun Karya TI aktif berdasarkan login GitHub (dari social.github). */
export async function studentsByGithubLogins(logins: string[]): Promise<Map<string, any>> {
	const uniq = Array.from(new Set(logins.map((l) => l.toLowerCase()).filter((l) => GH_LOGIN.test(l))));
	if (!uniq.length) return new Map();
	const rx = uniq.map((l) => new RegExp(`^https://(www\\.)?github\\.com/${l}/?$`, 'i'));
	const rows: any[] = await KaryaStudent.find({ 'social.github': { $in: rx }, status: { $ne: 'deleted' } })
		.select('username name avatarUrl social status profilePublic emailVerified suspendedUntil')
		.lean();
	const map = new Map<string, any>();
	for (const s of rows) {
		const l = githubLoginFromUrl(s.social?.github || '');
		if (l) map.set(l, s);
	}
	return map;
}

/** Daftar contributor repo GitHub (maks 30, tanpa bot). Host lain: kosong. */
export async function fetchRepoContributors(repo: { host?: string; owner?: string; name?: string }): Promise<{ login: string; avatarUrl: string; commits: number }[]> {
	if (repo.host !== 'github' || !repo.owner || !repo.name) return [];
	const r = await getJson(`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contributors?per_page=30`);
	if (r.status !== 200 || !Array.isArray(r.body)) return [];
	return r.body
		.filter((c: any) => c && c.type !== 'Bot' && !/\[bot\]$/i.test(String(c.login || '')))
		.map((c: any) => ({ login: String(c.login).toLowerCase(), avatarUrl: /^https:\/\/avatars\.githubusercontent\.com\//.test(String(c.avatar_url)) ? String(c.avatar_url) : '', commits: Number(c.contributions) || 0 }))
		.filter((c: { login: string }) => GH_LOGIN.test(c.login));
}

export interface ContributorCandidate {
	key: string;
	kind: 'student' | 'github';
	studentId?: string;
	username?: string;
	githubLogin?: string;
	name: string;
	avatarUrl: string;
	profileUrl: string;
	hasAccount: boolean;
}

function studentCandidate(s: any): ContributorCandidate {
	return {
		key: `s:${String(s._id)}`,
		kind: 'student',
		studentId: String(s._id),
		username: s.username,
		githubLogin: githubLoginFromUrl(s.social?.github || '') || undefined,
		name: s.name || s.username,
		avatarUrl: s.avatarUrl || '',
		profileUrl: `/ruang-mahasiswa/mahasiswa/${s.username}`,
		hasAccount: true,
	};
}

/**
 * Tebak kontributor dari input bebas:
 * "budi" / "@budi" / "himatif-encoder.com/ruang-mahasiswa/mahasiswa/budi" → akun Karya TI
 * "github.com/budi" / "budi" (bila bukan akun Karya TI) → GitHub (tertaut ke akun Karya TI bila ada).
 */
export async function resolveContributorInput(raw: string): Promise<ContributorCandidate | null> {
	const input = String(raw || '').trim().slice(0, 200);
	if (!input) return null;
	const karyaUrl = input.match(/\/(?:karya|ruang-mahasiswa)\/mahasiswa\/([a-z0-9-]{3,40})/i);
	const ghUrl = input.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/?$/i);
	const plain = input.replace(/^@/, '');
	if (karyaUrl || (!ghUrl && /^[a-z0-9-]{3,40}$/i.test(plain))) {
		const u = (karyaUrl ? karyaUrl[1] : plain).toLowerCase();
		const s: any = await KaryaStudent.findOne({ $or: [{ username: u }, { previousUsernames: u }], status: 'active' })
			.select('username name avatarUrl social')
			.lean();
		if (s) return studentCandidate(s);
		if (karyaUrl) return null;
	}
	const login = (ghUrl ? ghUrl[1] : plain).toLowerCase();
	if (!GH_LOGIN.test(login)) return null;
	const linked = (await studentsByGithubLogins([login])).get(login);
	if (linked) return studentCandidate(linked);
	const r = await getJson(`https://api.github.com/users/${encodeURIComponent(login)}`);
	if (r.status !== 200 || !r.body) return null;
	if (r.body.type === 'Bot') return null;
	return {
		key: `gh:${login}`,
		kind: 'github',
		githubLogin: login,
		name: String(r.body.name || r.body.login || login).slice(0, 80),
		avatarUrl: /^https:\/\/avatars\.githubusercontent\.com\//.test(String(r.body.avatar_url)) ? String(r.body.avatar_url) : '',
		profileUrl: `https://github.com/${login}`,
		hasAccount: false,
	};
}

/** Kandidat kontributor dari repo (untuk editor), tanpa pemilik sendiri. */
export async function contributorCandidatesFromRepo(repo: any, ownerStudentId: any, ownerGithubLogin: string): Promise<ContributorCandidate[]> {
	const list = await fetchRepoContributors(repo);
	const map = await studentsByGithubLogins(list.map((c) => c.login));
	const out: ContributorCandidate[] = [];
	for (const c of list) {
		if (c.login === ownerGithubLogin) continue;
		const s = map.get(c.login);
		if (s && String(s._id) === String(ownerStudentId)) continue;
		out.push(
			s
				? { ...studentCandidate(s), avatarUrl: s.avatarUrl || c.avatarUrl }
				: { key: `gh:${c.login}`, kind: 'github', githubLogin: c.login, name: c.login, avatarUrl: c.avatarUrl, profileUrl: `https://github.com/${c.login}`, hasAccount: false },
		);
	}
	return out;
}

/**
 * Bangun daftar kontributor tersimpan dari kiriman editor: [{key, role}] (maks 20).
 * Key `s:<id>` diverifikasi ke DB; `gh:<login>` ditaut ke akun bila ada. Status hidden dipertahankan.
 */
export async function buildContributorEntries(
	input: { key: string; role?: string; source?: string }[] | undefined,
	ownerStudentId: any,
	existing: ContributorEntry[] = [],
): Promise<ContributorEntry[] | undefined> {
	if (!Array.isArray(input)) return undefined;
	const prev = new Map(existing.map((e) => [e.key, e]));
	const ids = input.filter((x) => /^s:[a-f0-9]{24}$/.test(String(x.key))).map((x) => x.key.slice(2));
	const logins = input.filter((x) => /^gh:[a-z0-9-]{1,39}$/i.test(String(x.key))).map((x) => x.key.slice(3).toLowerCase());
	const students: any[] = ids.length ? await KaryaStudent.find({ _id: { $in: ids }, status: { $ne: 'deleted' } }).select('username name avatarUrl social').lean() : [];
	const byId = new Map(students.map((s) => [String(s._id), s]));
	const byLogin = await studentsByGithubLogins(logins);
	const out: ContributorEntry[] = [];
	const seen = new Set<string>();
	for (const x of input.slice(0, 20)) {
		const role = String(x.role || '').replace(/[<>]/g, '').trim().slice(0, 60);
		const source = x.source === 'repo' ? 'repo' : 'manual';
		let s: any = null;
		let login = '';
		if (x.key.startsWith('s:')) s = byId.get(x.key.slice(2));
		else if (x.key.startsWith('gh:')) {
			login = x.key.slice(3).toLowerCase();
			// Key dari klien: hanya format login GitHub yang sah (menolak gh:../../x dsb.)
			if (!GH_LOGIN.test(login)) continue;
			s = byLogin.get(login) || null;
		}
		if (!s && !login) continue;
		if (s && String(s._id) === String(ownerStudentId)) continue;
		const key = s ? `s:${String(s._id)}` : `gh:${login}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const old = prev.get(key) || prev.get(`gh:${login}`);
		out.push({
			key,
			studentId: s ? s._id : null,
			githubLogin: s ? githubLoginFromUrl(s.social?.github || '') : login,
			name: s ? s.name || s.username : old?.name || login,
			avatarUrl: s?.avatarUrl || old?.avatarUrl || (login ? `https://avatars.githubusercontent.com/${login}` : ''),
			role,
			source: (old?.source as 'manual' | 'repo') || source,
			hiddenByContributor: !!old?.hiddenByContributor,
			commits: old?.commits,
		});
	}
	return out;
}

/** Sinkron kontributor repo ke karya (menambah yang baru, tidak menghapus yang manual). */
export async function syncProjectContributors(projectId: any): Promise<number> {
	const p: any = await KaryaProject.findById(projectId).select('studentId repos contributors').lean();
	if (!p) return 0;
	const owner: any = await KaryaStudent.findById(p.studentId).select('social').lean();
	const ownerLogin = githubLoginFromUrl(owner?.social?.github || '');
	const current: ContributorEntry[] = p.contributors || [];
	const keys = new Set(current.map((c) => c.key));
	const add: ContributorEntry[] = [];
	for (const repo of p.repos || []) {
		const cands = await contributorCandidatesFromRepo(repo, p.studentId, ownerLogin);
		for (const c of cands) {
			const altKey = c.githubLogin ? `gh:${c.githubLogin}` : '';
			if (keys.has(c.key) || (altKey && keys.has(altKey))) continue;
			keys.add(c.key);
			add.push({
				key: c.key,
				studentId: c.studentId || null,
				githubLogin: c.githubLogin || '',
				name: c.name,
				avatarUrl: c.avatarUrl,
				role: '',
				source: 'repo',
				hiddenByContributor: false,
			});
		}
	}
	const set: any = { contributorsSyncedAt: new Date() };
	if (add.length) set.contributors = [...current, ...add].slice(0, 30);
	await KaryaProject.updateOne({ _id: p._id }, { $set: set });
	return add.length;
}

/** Saat mahasiswa menyetel/menyinkronkan GitHub: tautkan entri kontributor GitHub miliknya ke akunnya. */
export async function linkStudentToContributions(student: any): Promise<number> {
	const login = githubLoginFromUrl(student?.social?.github || '');
	if (!login) return 0;
	const r = await KaryaProject.updateMany(
		{ 'contributors.key': `gh:${login}`, studentId: { $ne: student._id } },
		{ $set: { 'contributors.$[c].key': `s:${String(student._id)}`, 'contributors.$[c].studentId': student._id, 'contributors.$[c].name': student.name || student.username } },
		{ arrayFilters: [{ 'c.key': `gh:${login}` }] },
	);
	return r.modifiedCount || 0;
}

/** Sinkron kontributor untuk karya lama yang belum/lama tidak disinkron (backfill bertahap). */
export async function syncStaleContributors(limit = 20, maxAgeMs = 7 * 86_400_000): Promise<{ checked: number; added: number }> {
	const rows: any[] = await KaryaProject.find({
		'repos.host': 'github',
		$or: [{ contributorsSyncedAt: null }, { contributorsSyncedAt: { $lt: new Date(Date.now() - maxAgeMs) } }],
	})
		.select('_id')
		.limit(limit)
		.lean();
	let added = 0;
	for (const r of rows) added += await syncProjectContributors(r._id).catch(() => 0);
	return { checked: rows.length, added };
}

/** Bentuk publik: profil Karya TI bila akun terlihat, selain itu tautan GitHub. */
export async function publicContributors(p: any): Promise<
	{ name: string; avatarUrl: string; role: string; source: string; username?: string; githubUrl?: string; commits?: number }[]
> {
	const list: ContributorEntry[] = p.contributors || [];
	const ids = list.filter((c) => c.studentId).map((c) => c.studentId);
	const studs: any[] = ids.length
		? await KaryaStudent.find({ _id: { $in: ids } }).select('username name avatarUrl status profilePublic emailVerified suspendedUntil').lean()
		: [];
	const byId = new Map(studs.map((s) => [String(s._id), s]));
	const visible = (s: any) =>
		s && s.status === 'active' && s.profilePublic !== false && s.emailVerified && !(s.suspendedUntil && new Date(s.suspendedUntil) > new Date());
	return list.map((c) => {
		const s = c.studentId ? byId.get(String(c.studentId)) : null;
		return {
			name: s?.name || c.name,
			avatarUrl: s?.avatarUrl || c.avatarUrl || '',
			role: c.role || '',
			source: c.source,
			commits: c.commits,
			...(visible(s) ? { username: s.username } : {}),
			...(c.githubLogin ? { githubUrl: `https://github.com/${c.githubLogin}` } : {}),
		};
	});
}
