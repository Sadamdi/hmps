/**
 * Ambil info repo PUBLIK dari GitHub / GitLab / Bitbucket untuk Karya TI.
 *
 * URL API dibangun server dari owner/name yang sudah divalidasi regex (lihat parseRepoUrl), host-nya tetap
 * (api.github.com, gitlab.com, api.bitbucket.org) → tidak ada SSRF. Repo privat / tidak ada ditolak.
 * Hasil di-cache di memori 30 menit agar tidak boros rate limit API.
 */
import { parseRepoUrl, type KaryaRepoInfo } from '../../shared/karya';

export class RepoFetchError extends Error {
	constructor(
		message: string,
		public code: 'REPO_URL_INVALID' | 'REPO_NOT_PUBLIC' | 'REPO_FETCH_FAILED' | 'REPO_RATE_LIMITED',
	) {
		super(message);
	}
}

const cache = new Map<string, { at: number; data: KaryaRepoInfo }>();
const TTL = 30 * 60_000;

async function getJson(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 8000);
	try {
		const r = await fetch(url, { headers: { 'User-Agent': 'himatif-encoder-karya', Accept: 'application/json', ...headers }, signal: ctrl.signal, redirect: 'error' });
		const text = await r.text();
		if (text.length > 2_000_000) return { status: 502, body: null };
		let body: any = null;
		try {
			body = JSON.parse(text);
		} catch {
			body = null;
		}
		return { status: r.status, body };
	} finally {
		clearTimeout(t);
	}
}

const str = (v: unknown, max = 300) => String(v ?? '').slice(0, max);
const safeHomepage = (v: unknown) => {
	const s = str(v, 300).trim();
	return /^https:\/\//i.test(s) ? s : '';
};

export async function fetchPublicRepo(rawUrl: string): Promise<KaryaRepoInfo> {
	const p = parseRepoUrl(rawUrl);
	if (!p) throw new RepoFetchError('URL repo tidak valid. Pakai https://github.com/user/repo, gitlab.com, bitbucket.org, atau codeberg.org.', 'REPO_URL_INVALID');
	const key = `${p.host}/${p.owner}/${p.name}`.toLowerCase();
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < TTL) return hit.data;

	const notPublic = new RepoFetchError('Repo tidak ditemukan atau masih privat. Jadikan repo publik dulu.', 'REPO_NOT_PUBLIC');
	let info: KaryaRepoInfo;
	const now = new Date().toISOString();
	try {
		if (p.host === 'github') {
			const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
			if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
			const r = await getJson(`https://api.github.com/repos/${encodeURIComponent(p.owner)}/${encodeURIComponent(p.name)}`, headers);
			if (r.status === 403 || r.status === 429) throw new RepoFetchError('Batas akses GitHub sedang penuh. Coba lagi beberapa menit lagi.', 'REPO_RATE_LIMITED');
			if (r.status !== 200 || !r.body || r.body.private || r.body.visibility === 'private') throw notPublic;
			const b = r.body;
			info = {
				host: 'github',
				owner: str(b.owner?.login, 100),
				name: str(b.name, 100),
				url: `https://github.com/${str(b.full_name, 200)}`,
				description: str(b.description, 500),
				homepage: safeHomepage(b.homepage),
				stars: Number(b.stargazers_count) || 0,
				forks: Number(b.forks_count) || 0,
				language: str(b.language, 50),
				topics: Array.isArray(b.topics) ? b.topics.slice(0, 10).map((t: unknown) => str(t, 40)) : [],
				license: str(b.license?.spdx_id && b.license.spdx_id !== 'NOASSERTION' ? b.license.spdx_id : '', 40),
				ogImage: `https://opengraph.githubassets.com/1/${encodeURIComponent(str(b.owner?.login, 100))}/${encodeURIComponent(str(b.name, 100))}`,
				updatedAt: b.pushed_at || b.updated_at || null,
				fetchedAt: now,
			};
		} else if (p.host === 'gitlab') {
			const r = await getJson(`https://gitlab.com/api/v4/projects/${encodeURIComponent(`${p.owner}/${p.name}`)}`);
			if (r.status === 429) throw new RepoFetchError('Batas akses GitLab sedang penuh. Coba lagi nanti.', 'REPO_RATE_LIMITED');
			if (r.status !== 200 || !r.body || (r.body.visibility && r.body.visibility !== 'public')) throw notPublic;
			const b = r.body;
			info = {
				host: 'gitlab',
				owner: str(b.namespace?.path || p.owner, 100),
				name: str(b.path || p.name, 100),
				url: /^https:\/\/gitlab\.com\//.test(String(b.web_url)) ? str(b.web_url, 300) : `https://gitlab.com/${p.owner}/${p.name}`,
				description: str(b.description, 500),
				homepage: '',
				stars: Number(b.star_count) || 0,
				forks: Number(b.forks_count) || 0,
				language: '',
				topics: Array.isArray(b.topics) ? b.topics.slice(0, 10).map((t: unknown) => str(t, 40)) : [],
				ogImage: /^https:\/\//.test(String(b.avatar_url || '')) ? str(b.avatar_url, 300) : '',
				updatedAt: b.last_activity_at || null,
				fetchedAt: now,
			};
		} else if (p.host === 'codeberg') {
			const r = await getJson(`https://codeberg.org/api/v1/repos/${encodeURIComponent(p.owner)}/${encodeURIComponent(p.name)}`);
			if (r.status === 429) throw new RepoFetchError('Batas akses Codeberg sedang penuh. Coba lagi nanti.', 'REPO_RATE_LIMITED');
			if (r.status !== 200 || !r.body || r.body.private || r.body.internal) throw notPublic;
			const b = r.body;
			info = {
				host: 'codeberg',
				owner: str(b.owner?.login || p.owner, 100),
				name: str(b.name || p.name, 100),
				url: `https://codeberg.org/${str(b.full_name || `${p.owner}/${p.name}`, 200)}`,
				description: str(b.description, 500),
				homepage: safeHomepage(b.website),
				stars: Number(b.stars_count) || 0,
				forks: Number(b.forks_count) || 0,
				language: str(b.language, 50),
				topics: Array.isArray(b.topics) ? b.topics.slice(0, 10).map((t: unknown) => str(t, 40)) : [],
				license: Array.isArray(b.licenses) ? str(b.licenses[0] || '', 40) : '',
				ogImage: /^https:\/\//.test(String(b.avatar_url || '')) ? str(b.avatar_url, 300) : '',
				updatedAt: b.updated_at || null,
				fetchedAt: now,
			};
		} else {
			const r = await getJson(`https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(p.owner)}/${encodeURIComponent(p.name)}`);
			if (r.status === 429) throw new RepoFetchError('Batas akses Bitbucket sedang penuh. Coba lagi nanti.', 'REPO_RATE_LIMITED');
			if (r.status !== 200 || !r.body || r.body.is_private) throw notPublic;
			const b = r.body;
			info = {
				host: 'bitbucket',
				owner: str(b.owner?.username || p.owner, 100),
				name: str(b.slug || p.name, 100),
				url: `https://bitbucket.org/${p.owner}/${p.name}`,
				description: str(b.description, 500),
				homepage: safeHomepage(b.website),
				stars: 0,
				forks: 0,
				language: str(b.language, 50),
				topics: [],
				updatedAt: b.updated_on || null,
				fetchedAt: now,
			};
		}
	} catch (e) {
		if (e instanceof RepoFetchError) throw e;
		throw new RepoFetchError('Gagal menghubungi layanan repo. Coba lagi.', 'REPO_FETCH_FAILED');
	}
	cache.set(key, { at: Date.now(), data: info });
	if (cache.size > 500) cache.clear();
	return info;
}

/**
 * Cek link Google Drive bisa dibuka publik ("siapa saja yang memiliki link").
 * Drive tanpa akses publik mengarahkan ke halaman login (accounts.google.com).
 */
export async function isDrivePublic(fileId: string): Promise<boolean> {
	if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return false;
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 8000);
	try {
		const r = await fetch(`https://drive.google.com/file/d/${fileId}/view`, { method: 'GET', redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'himatif-encoder-karya' } });
		if (r.status >= 300 && r.status < 400) {
			const loc = String(r.headers.get('location') || '');
			return !/accounts\.google\.com|ServiceLogin/i.test(loc);
		}
		return r.status === 200;
	} catch {
		// Jaringan gagal: jangan blokir mahasiswa; admin tetap mereview
		return true;
	} finally {
		clearTimeout(t);
	}
}
