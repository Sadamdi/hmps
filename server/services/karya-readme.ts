/**
 * Isi otomatis pintar dari README repo publik (GitHub, GitLab, Codeberg).
 *
 * - Ringkasan: paragraf/kalimat tebal pertama yang bermakna (bukan judul, badge, atau tautan saja).
 * - Deskripsi rich text: README → HTML (marked) tanpa badge, gambar relatif diubah ke URL raw; HTML disanitasi
 *   pemanggil dengan sanitizeCmsHtml (sama dengan berita).
 * - Gambar: dari `![..](..)` dan `<img src>` (badge/ikon/penghitung dibuang), maks 8.
 * - Video: link YouTube dan lampiran video GitHub (user-attachments / .mp4/.webm).
 * URL API dibangun server dari owner/name tervalidasi (host tetap), timeout 8 dtk, README dibatasi 200 KB.
 */
import { marked } from 'marked';
import { parseRepoUrl, youtubeIdFromUrl } from '../../shared/karya';

export interface ReadmeInsights {
	summary: string;
	descriptionHtml: string;
	images: string[];
	youtube: string[];
	videoFiles: string[];
}

const EMPTY: ReadmeInsights = { summary: '', descriptionHtml: '', images: [], youtube: [], videoFiles: [] };
const cache = new Map<string, { at: number; data: ReadmeInsights }>();

/** Host gambar README yang boleh ditampilkan (hotlink) di situs. */
export const README_IMAGE_HOSTS = [
	'raw.githubusercontent.com',
	'user-images.githubusercontent.com',
	'github.com',
	'camo.githubusercontent.com',
	'gitlab.com',
	'codeberg.org',
	'bitbucket.org',
	'i.imgur.com',
	'imgur.com',
];

const BADGE_RE = /(shields\.io|badgen\.net|badge|travis-ci|codecov|coveralls|circleci|forthebadge|komarev|visitor|hits\.seeyoufarm|skillicons|readme-typing|github-readme-stats|streak-stats|profile-counter|wakatime|\/workflows\/.*\.svg|\.svg(\?|$))/i;

async function getText(url: string, headers: Record<string, string> = {}): Promise<string | null> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 8000);
	try {
		const r = await fetch(url, { headers: { 'User-Agent': 'himatif-encoder-karya', ...headers }, signal: ctrl.signal, redirect: 'follow' });
		if (!r.ok) return null;
		const txt = await r.text();
		return txt.slice(0, 200_000);
	} catch {
		return null;
	} finally {
		clearTimeout(t);
	}
}

function resolveUrl(raw: string, rawBase: string, blobBase: string): string {
	const u = String(raw || '').trim().replace(/^<|>$/g, '');
	if (!u || u.startsWith('data:') || u.startsWith('#')) return '';
	if (/^https:\/\//i.test(u)) {
		// github.com/.../blob/... → raw
		const m = u.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
		return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : u;
	}
	if (/^http:\/\//i.test(u) || /^[a-z]+:/i.test(u)) return '';
	const clean = u.replace(/^\.\//, '').replace(/^\//, '');
	return `${rawBase}/${clean}`;
}

function allowedImage(url: string): boolean {
	try {
		const h = new URL(url).hostname.toLowerCase();
		return README_IMAGE_HOSTS.includes(h) && !BADGE_RE.test(url);
	} catch {
		return false;
	}
}

function plain(md: string): string {
	return md
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[*_`>#~|]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Gambar di deskripsi HTML: https apa pun (README sering memakai gambar dari vercel.app, shields, dll). */
function anyHttpsImage(url: string): boolean {
	return /^https:\/\//i.test(url);
}

/** Markdown → HTML (belum disanitasi; pemanggil wajib sanitizeCmsHtml). keepBadges untuk README profil. */
export async function markdownToHtml(md: string, opts: { rawBase?: string; blobBase?: string; keepBadges?: boolean } = {}): Promise<string> {
	const rawBase = opts.rawBase || '';
	const blobBase = opts.blobBase || '';
	const mdClean = (opts.keepBadges
		? md
		: md
				.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
				.replace(/!\[[^\]]*\]\(([^)]*)\)/g, (all, url) => (BADGE_RE.test(String(url)) ? '' : all))
	).slice(0, 60_000);
	let html = '';
	try {
		html = String(await marked.parse(mdClean, { gfm: true, async: true }));
	} catch {
		return '';
	}
	return html
		.replace(/(<img[^>]*\ssrc=)(["'])([^"']+)\2/gi, (_a, pre, q, src) => {
			const u = rawBase ? resolveUrl(src, rawBase, blobBase) : /^https:\/\//i.test(src) ? src : '';
			return u && anyHttpsImage(u) ? `${pre}${q}${u}${q}` : `${pre}${q}${q}`;
		})
		.replace(/<img[^>]*\ssrc=(["'])\1[^>]*>/gi, '')
		.replace(/(<a[^>]*\shref=)(["'])([^"']+)\2/gi, (_a, pre, q, href) => {
			if (/^(https?:|mailto:|#)/i.test(href)) return `${pre}${q}${href}${q}`;
			if (!blobBase) return `${pre}${q}#${q}`;
			return `${pre}${q}${blobBase}/${href.replace(/^\.\//, '').replace(/^\//, '')}${q}`;
		});
}

export async function fetchReadmeInsights(repoUrl: string, opts: { keepBadges?: boolean } = {}): Promise<ReadmeInsights> {
	const p = parseRepoUrl(repoUrl);
	if (!p || p.host === 'bitbucket') return EMPTY;
	const key = `${p.host}/${p.owner}/${p.name}/${opts.keepBadges ? 'b' : ''}`.toLowerCase();
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < 30 * 60_000) return hit.data;

	const o = encodeURIComponent(p.owner);
	const n = encodeURIComponent(p.name);
	let md: string | null = null;
	let branch = 'HEAD';
	let rawBase = '';
	let blobBase = '';
	if (p.host === 'github') {
		const headers: Record<string, string> = { Accept: 'application/vnd.github.raw' };
		if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		md = await getText(`https://api.github.com/repos/${o}/${n}/readme`, headers);
		rawBase = `https://raw.githubusercontent.com/${o}/${n}/${branch}`;
		blobBase = `https://github.com/${o}/${n}/blob/${branch}`;
	} else if (p.host === 'gitlab') {
		for (const f of ['README.md', 'readme.md', 'README.MD']) {
			md = await getText(`https://gitlab.com/${o}/${n}/-/raw/HEAD/${f}`);
			if (md) break;
		}
		rawBase = `https://gitlab.com/${o}/${n}/-/raw/HEAD`;
		blobBase = rawBase;
	} else if (p.host === 'codeberg') {
		const info = await getText(`https://codeberg.org/api/v1/repos/${o}/${n}`);
		try {
			branch = JSON.parse(info || '{}').default_branch || 'main';
		} catch {
			branch = 'main';
		}
		md = await getText(`https://codeberg.org/${o}/${n}/raw/branch/${encodeURIComponent(branch)}/README.md`);
		rawBase = `https://codeberg.org/${o}/${n}/raw/branch/${encodeURIComponent(branch)}`;
		blobBase = rawBase;
	}
	if (!md) {
		cache.set(key, { at: Date.now(), data: EMPTY });
		return EMPTY;
	}

	// ── gambar ──
	const imgs: string[] = [];
	const pushImg = (raw: string) => {
		const u = resolveUrl(raw, rawBase, blobBase);
		if (u && allowedImage(u) && !imgs.includes(u)) imgs.push(u);
	};
	for (const m of Array.from(md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g))) pushImg(m[1]);
	for (const m of Array.from(md.matchAll(/<img[^>]*\ssrc=["']([^"']+)["']/gi))) pushImg(m[1]);

	// ── video ──
	const youtube: string[] = [];
	const videoFiles: string[] = [];
	for (const m of Array.from(md.matchAll(/https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{11}[^\s)"'<]*/g))) {
		const id = youtubeIdFromUrl(m[0]);
		const url = id ? `https://youtu.be/${id}` : '';
		if (url && !youtube.includes(url)) youtube.push(url);
	}
	for (const m of Array.from(md.matchAll(/https:\/\/(?:github\.com\/user-attachments\/assets\/[0-9a-f-]{36}|[^\s)"'<]+\.(?:mp4|webm|mov))(?=[\s)"'<]|$)/gi))) {
		if (!videoFiles.includes(m[0]) && m[0].startsWith('https://')) videoFiles.push(m[0]);
	}
	// github user-attachments tanpa ekstensi juga bisa gambar; yang sudah jadi gambar tidak dianggap video
	const video = videoFiles.filter((v) => !imgs.includes(v));

	// ── ringkasan: blok teks pertama yang bermakna ──
	let summary = '';
	for (const block of md.split(/\n\s*\n/)) {
		const b = block.trim();
		if (!b || /^#/.test(b) || /^<\/?div/i.test(b) || /^(---|\*\*\*|___)$/.test(b) || /^\[!\[/.test(b) || /^!\[/.test(b)) continue;
		const t = plain(b);
		if (t.length >= 30) {
			summary = t.length > 240 ? t.slice(0, 237).replace(/\s+\S*$/, '') + '…' : t;
			break;
		}
	}

	// ── deskripsi HTML: buang badge, perbaiki URL relatif ──
	const html = await markdownToHtml(md, { rawBase, blobBase, keepBadges: opts.keepBadges });

	const data: ReadmeInsights = { summary, descriptionHtml: html, images: imgs.slice(0, 8), youtube: youtube.slice(0, 3), videoFiles: video.slice(0, 3) };
	cache.set(key, { at: Date.now(), data });
	if (cache.size > 300) cache.clear();
	return data;
}
