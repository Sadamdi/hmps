import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import {
	countByKind,
	DEFAULT_SOCIAL_FEED_CACHE,
	DEFAULT_SOCIAL_FEED_CONFIG,
	INSTAGRAM_KINDS,
	instagramShortcodeToDate,
	itemKind,
	normalizeSocialFeedConfig,
	selectSocialItems,
	SOCIAL_FEED_LOG_LIMIT,
	sortSocialItems,
	visibleSocialItems,
	YOUTUBE_KINDS,
	type InstagramConfig,
	type InstagramKind,
	type SocialContentKind,
	type SocialFeedCache,
	type SocialFeedConfig,
	type SocialFeedItem,
	type SocialFeedLiveState,
	type SocialFeedLogEntry,
	type SocialPlatform,
	type YoutubeConfig,
	type YoutubeKind,
} from '../../shared/social-feed';
import { uploadDir } from '../upload';
import {
	absorbInstagramCookies,
	getInstagramSession,
	instagramCookieHeader,
	invalidateInstagramSession,
	looksLikeInstagramLoginRequired,
} from './instagram-session';
import { fetchInstagramViaInstagrapi } from './instagram-instagrapi';

const UA_DESKTOP =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const UA_MOBILE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const UPLOADS_YT = path.join(uploadDir, 'social', 'youtube');
const UPLOADS_IG = path.join(uploadDir, 'social', 'instagram');

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function fetchText(
	url: string,
	timeoutMs = 20000,
	extraHeaders: Record<string, string> = {},
): Promise<string> {
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			redirect: 'follow',
			signal: controller.signal,
			headers: {
				'User-Agent': UA_DESKTOP,
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
				...extraHeaders,
			},
		});
		if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
		return await res.text();
	} finally {
		clearTimeout(t);
	}
}

async function fetchBuffer(url: string, timeoutMs = 20000): Promise<Buffer | null> {
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'User-Agent': UA_DESKTOP, Accept: 'image/*,*/*;q=0.8' },
		});
		if (!res.ok) return null;
		return Buffer.from(await res.arrayBuffer());
	} catch {
		return null;
	} finally {
		clearTimeout(t);
	}
}

function isAllowedSocialHost(hostname: string): boolean {
	const h = hostname.replace(/^www\./, '').toLowerCase();
	return (
		h === 'youtube.com' ||
		h === 'youtu.be' ||
		h === 'm.youtube.com' ||
		h === 'instagram.com' ||
		h.endsWith('.cdninstagram.com') ||
		h.endsWith('.fbcdn.net') ||
		h === 'i.ytimg.com' ||
		h === 'img.youtube.com' ||
		h.endsWith('.fna.fbcdn.net')
	);
}

function assertSafeHttpUrl(raw: string): URL | null {
	try {
		const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
		if (!['http:', 'https:'].includes(u.protocol)) return null;
		if (!isAllowedSocialHost(u.hostname)) return null;
		return u;
	} catch {
		return null;
	}
}

async function cacheRemoteImage(
	remoteUrl: string,
	dir: string,
	filename: string,
): Promise<string | null> {
	const safe = assertSafeHttpUrl(remoteUrl);
	if (!safe) return null;
	ensureDir(dir);
	const buf = await fetchBuffer(safe.toString());
	if (!buf || buf.length < 200) return null;
	const dest = path.join(dir, filename);
	fs.writeFileSync(dest, buf);
	const rel = path.relative(uploadDir, dest).replace(/\\/g, '/');
	return `/uploads/${rel}`;
}

function extractYoutubeHandle(url: string): string | null {
	const u = assertSafeHttpUrl(url);
	if (!u) return null;
	const m = u.pathname.match(/@([\w.-]+)/);
	return m?.[1] || null;
}

function extractInstagramUsername(url: string): string | null {
	const u = assertSafeHttpUrl(url);
	if (!u) return null;
	const parts = u.pathname.split('/').filter(Boolean);
	if (!parts.length) return null;
	const skip = new Set(['p', 'reel', 'reels', 'stories', 'tv', 'share']);
	if (skip.has(parts[0].toLowerCase())) return null;
	return parts[0].replace(/^@/, '') || null;
}

export async function resolveYoutubeChannelId(channelUrl: string): Promise<string | null> {
	const fromPath = channelUrl.match(/\/channel\/(UC[\w-]{22})/i);
	if (fromPath?.[1]) return fromPath[1];

	const html = await fetchText(channelUrl);
	// IMPORTANT: jangan pakai "channelId" pertama — sering ID channel lain (recommended).
	// Prefer canonical / externalId / itemprop / browseId yang cocok dengan handle.
	const preferred = [
		/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})["']/i,
		/href=["']https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})["'][^>]*rel=["']canonical["']/i,
		/"externalId"\s*:\s*"(UC[\w-]{22})"/,
		/<meta\s+itemprop=["']channelId["']\s+content=["'](UC[\w-]{22})["']/i,
		/"browseId"\s*:\s*"(UC[\w-]{22})"/,
	];
	for (const re of preferred) {
		const m = html.match(re);
		if (m?.[1]) return m[1];
	}
	return null;
}

function parseYoutubeRss(xml: string, maxItems: number): SocialFeedItem[] {
	const $ = cheerio.load(xml, { xmlMode: true });
	const items: SocialFeedItem[] = [];
	$('entry').each((_, el) => {
		if (items.length >= maxItems * 2) return;
		const id =
			$(el).find('yt\\:videoId, videoId').first().text().trim() ||
			$(el).find('id').text().trim().replace(/^yt:video:/, '');
		const title = $(el).find('title').first().text().replace(/\s+/g, ' ').trim();
		let link = $(el).find('link').attr('href') || '';
		const publishedAt = $(el).find('published').first().text().trim() || undefined;
		let thumbnailUrl =
			$(el).find('media\\:thumbnail, thumbnail').attr('url') ||
			(id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
		if (!id || !title) return;
		const isShort = /\/shorts\//i.test(link);
		if (!link) {
			link = isShort
				? `https://www.youtube.com/shorts/${id}`
				: `https://www.youtube.com/watch?v=${id}`;
		}
		items.push({
			id: `yt-${id}`,
			platform: 'youtube',
			title,
			url: link,
			thumbnailUrl,
			publishedAt,
			kind: isShort ? 'short' : 'video',
		});
	});
	return items;
}

async function scrapeYoutubeShorts(handle: string, maxItems: number): Promise<SocialFeedItem[]> {
	const url = `https://www.youtube.com/@${encodeURIComponent(handle)}/shorts`;
	const html = await fetchText(url, 25000, { 'User-Agent': UA_MOBILE });
	const ids: string[] = [];
	const seen = new Set<string>();
	const push = (id: string) => {
		if (!id || seen.has(id)) return;
		seen.add(id);
		ids.push(id);
	};

	// Prefer Shorts-specific JSON shapes
	const reelRe = /"reelWatchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/g;
	let m: RegExpExecArray | null;
	while ((m = reelRe.exec(html)) && ids.length < maxItems) push(m[1]);

	const lockupRe = /"shortsLockupViewModel"[\s\S]{0,400}?"videoId"\s*:\s*"([\w-]{11})"/g;
	while ((m = lockupRe.exec(html)) && ids.length < maxItems) push(m[1]);

	const pathRe = /\/shorts\/([\w-]{11})/g;
	while ((m = pathRe.exec(html)) && ids.length < maxItems) push(m[1]);

	return ids.slice(0, maxItems).map((id) => ({
		id: `yt-${id}`,
		platform: 'youtube' as const,
		title: `Short ${id}`,
		url: `https://www.youtube.com/shorts/${id}`,
		thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
		kind: 'short' as const,
	}));
}

async function enrichYoutubeThumbs(items: SocialFeedItem[]): Promise<SocialFeedItem[]> {
	const out: SocialFeedItem[] = [];
	for (const it of items) {
		const vid = it.id.replace(/^yt-/, '').replace(/^yt-live-/, '');
		const local = await cacheRemoteImage(it.thumbnailUrl, UPLOADS_YT, `${vid}.jpg`);
		out.push(local ? { ...it, thumbnailUrl: local } : it);
	}
	return out;
}

function parseDurationBadge(badge?: string): number | null {
	if (!badge) return null;
	const parts = String(badge)
		.trim()
		.split(':')
		.map((p) => parseInt(p, 10));
	if (parts.some((n) => !Number.isFinite(n))) return null;
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	if (parts.length === 1) return parts[0];
	return null;
}

function mapYtLockup(v: any, kind: 'video' | 'short' | 'live'): SocialFeedItem | null {
	const id = v?.content_id;
	if (!id) return null;
	const title = String(v?.metadata?.title?.text || `YouTube ${id}`).replace(/\s+/g, ' ').trim();
	const thumb =
		v?.content_image?.image?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
	const badge = v?.content_image?.overlays
		?.flatMap((o: any) => o?.badges || [])
		?.map((b: any) => b?.text)
		?.find((t: any) => !!t);
	const durationSec = parseDurationBadge(badge);
	const url =
		kind === 'short'
			? `https://www.youtube.com/shorts/${id}`
			: `https://www.youtube.com/watch?v=${id}`;
	return {
		id: `yt-${id}`,
		platform: 'youtube',
		title: title.slice(0, 140),
		url,
		thumbnailUrl: thumb,
		kind,
		...(durationSec != null ? { publishedAt: undefined } : {}),
	};
}

async function fetchYoutubeViaInnertube(
	channelId: string,
	content: SocialFeedConfig['youtube']['content'],
	maxItems: number,
): Promise<{ pools: { video: SocialFeedItem[]; short: SocialFeedItem[]; live: SocialFeedItem[] } }> {
	const { Innertube } = await import('youtubei.js');
	const yt = await Innertube.create({ generate_session_locally: true });
	const channel = await yt.getChannel(channelId);
	const pools = {
		video: [] as SocialFeedItem[],
		short: [] as SocialFeedItem[],
		live: [] as SocialFeedItem[],
	};
	const take = Math.max(maxItems * 4, 12);

	if (content.videos || content.shorts) {
		const tab = await channel.getVideos();
		const list = Array.isArray(tab?.videos) ? tab.videos : [];
		for (const raw of list.slice(0, take) as any[]) {
			const badge = raw?.content_image?.overlays
				?.flatMap((o: any) => o?.badges || [])
				?.map((b: any) => b?.text)
				?.find((t: any) => !!t);
			const dur = parseDurationBadge(badge);
			const asShort = content.shorts && dur != null && dur > 0 && dur <= 60;
			if (asShort) {
				const item = mapYtLockup(raw, 'short');
				if (item) pools.short.push(item);
			} else if (content.videos) {
				const item = mapYtLockup(raw, 'video');
				if (item) pools.video.push(item);
			}
		}
	}

	if (content.shorts) {
		try {
			const tab = await channel.getShorts();
			const list = Array.isArray(tab?.videos) ? tab.videos : [];
			for (const raw of list.slice(0, take) as any[]) {
				const item = mapYtLockup(raw, 'short');
				if (item && !pools.short.some((x) => x.id === item.id)) pools.short.push(item);
			}
		} catch {
			/* channel tanpa tab Shorts — sudah diisi heuristic ≤60s */
		}
	}

	if (content.live) {
		try {
			const tab = await (channel as any).getLiveStreams();
			const list = Array.isArray(tab?.videos) ? tab.videos : [];
			for (const raw of list.slice(0, take) as any[]) {
				const item = mapYtLockup(raw, 'live');
				if (item) pools.live.push(item);
			}
		} catch (err) {
			console.warn('YouTube live tab scrape failed:', err);
		}
	}

	return { pools };
}

async function scrapeYoutubeTabHtml(
	/** `https://www.youtube.com/@handle` atau `https://www.youtube.com/channel/UC...` */
	base: string,
	tab: 'videos' | 'streams' | 'shorts',
	kind: 'video' | 'live' | 'short',
	maxItems: number,
): Promise<SocialFeedItem[]> {
	const url = `${base}/${tab}`;
	const html = await fetchText(url, 25000, { 'User-Agent': UA_DESKTOP });
	const items: SocialFeedItem[] = [];
	const seen = new Set<string>();

	// Tab Shorts: hanya ID yang benar-benar tertaut sebagai /shorts/ID. Channel tanpa tab Shorts
	// dialihkan ke beranda channel — `contentId` di sana adalah video biasa (bug ≤4.24).
	const idRe = tab === 'shorts' ? /\/shorts\/([\w-]{11})/g : /"contentId"\s*:\s*"([\w-]{11})"/g;
	let m: RegExpExecArray | null;
	while ((m = idRe.exec(html)) && items.length < maxItems) {
		const id = m[1];
		if (seen.has(id)) continue;
		const start = Math.max(0, m.index - 900);
		const end = Math.min(html.length, m.index + 900);
		const chunk = html.slice(start, end);
		const titleMatch =
			chunk.match(/"title"\s*:\s*\{\s*"content"\s*:\s*"([^"]+)"/) ||
			chunk.match(/"label"\s*:\s*"([^"]{8,160})"/);
		let title = (titleMatch?.[1] || '')
			.replace(/\\u0026/g, '&')
			.replace(/\s+\d+\s+menit.*$/i, '')
			.replace(/\s+\d+\s+detik.*$/i, '')
			.trim();
		if (!title || /tonton nanti|ditambahkan|antrean|tindakan|watch later/i.test(title)) {
			title = '';
		}
		seen.add(id);
		items.push({
			id: `yt-${id}`,
			platform: 'youtube',
			title: (title || (kind === 'short' ? `Short ${id}` : kind === 'live' ? `Live ${id}` : `Video ${id}`)).slice(
				0,
				140,
			),
			url:
				kind === 'short'
					? `https://www.youtube.com/shorts/${id}`
					: `https://www.youtube.com/watch?v=${id}`,
			thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
			kind,
		});
	}

	if (!items.length) {
		const fallbackRe =
			tab === 'shorts' ? /\/shorts\/([\w-]{11})/g : /"videoId"\s*:\s*"([\w-]{11})"/g;
		while ((m = fallbackRe.exec(html)) && items.length < maxItems) {
			const id = m[1];
			if (seen.has(id)) continue;
			seen.add(id);
			items.push({
				id: `yt-${id}`,
				platform: 'youtube',
				title: kind === 'short' ? `Short ${id}` : `Video ${id}`,
				url:
					kind === 'short'
						? `https://www.youtube.com/shorts/${id}`
						: `https://www.youtube.com/watch?v=${id}`,
				thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
				kind,
			});
		}
	}

	return items;
}

/** Matches both /p/CODE and /username/p/CODE (new Instagram URL shape). */
function extractIgShortcodes(html: string): { code: string; kind: 'p' | 'reel' }[] {
	const found: { code: string; kind: 'p' | 'reel' }[] = [];
	const seen = new Set<string>();
	const re = /instagram\.com\/(?:[\w.-]+\/)?(p|reel|reels)\/([A-Za-z0-9_-]+)/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		const raw = m[1].toLowerCase();
		const kind: 'p' | 'reel' = raw === 'p' ? 'p' : 'reel';
		const code = m[2];
		if (seen.has(code)) continue;
		seen.add(code);
		found.push({ code, kind });
		if (found.length >= 24) break;
	}
	return found;
}

function extractThumbCandidates(html: string): string[] {
	const urls: string[] = [];
	const push = (raw: string) => {
		if (!raw) return;
		let u = raw.replace(/&amp;/g, '&');
		try {
			if (u.includes('\\')) u = JSON.parse(`"${u}"`);
		} catch {
			u = u.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
		}
		if (!/^https?:\/\//i.test(u)) return;
		if (!/cdninstagram|fbcdn|instagram\.com/i.test(u)) return;
		urls.push(u);
	};

	const og = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
	if (og?.[1]) push(og[1]);
	const og2 = html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
	if (og2?.[1]) push(og2[1]);

	const displayRe = /"display_url"\s*:\s*"([^"]+)"/g;
	let dm: RegExpExecArray | null;
	while ((dm = displayRe.exec(html))) {
		push(dm[1]);
		if (urls.length > 40) break;
	}

	const thumbRe = /"thumbnail_src"\s*:\s*"([^"]+)"/g;
	let tm: RegExpExecArray | null;
	while ((tm = thumbRe.exec(html))) {
		push(tm[1]);
		if (urls.length > 50) break;
	}

	const scontentRe = /https:\\\/\\\/scontent[^"\\]+/g;
	let sm: RegExpExecArray | null;
	while ((sm = scontentRe.exec(html))) {
		push(sm[0]);
		if (urls.length > 60) break;
	}

	return urls;
}

let igAnonCookies = '';

/** Cookie anonim instagram.com + cookie sesi akun dummy (auto-login bila perlu). */
async function seedInstagramCookies(): Promise<string> {
	if (!igAnonCookies) {
		try {
			const res = await fetch('https://www.instagram.com/', {
				redirect: 'follow',
				headers: {
					'User-Agent': UA_DESKTOP,
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
				},
			});
			const raw = typeof (res as any).headers?.getSetCookie === 'function'
				? (res as any).headers.getSetCookie()
				: [];
			igAnonCookies = (Array.isArray(raw) ? raw : [])
				.map((c: string) => c.split(';')[0])
				.filter((c: string) => c && !/^(sessionid|csrftoken)=/.test(c))
				.join('; ');
		} catch {
			igAnonCookies = '';
		}
	}
	const session = instagramCookieHeader(await getInstagramSession());
	return session || igAnonCookies;
}

let lastIgProfileUsedSession = false;

async function fetchIgWebProfileInfo(username: string, retried = false): Promise<any | null> {
	try {
		const cookies = await seedInstagramCookies();
		lastIgProfileUsedSession = /sessionid=/.test(cookies);
		const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
		const csrf = cookies.match(/csrftoken=([^;]+)/)?.[1] || '';
		const headers: Record<string, string> = {
			'User-Agent': UA_DESKTOP,
			'X-IG-App-ID': '936619743392459',
			Accept: '*/*',
			'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
			Referer: `https://www.instagram.com/${username}/`,
			'X-Requested-With': 'XMLHttpRequest',
			'X-ASBD-ID': '359341',
			'X-IG-WWW-Claim': '0',
		};
		if (cookies) headers.Cookie = cookies;
		if (csrf) headers['X-CSRFToken'] = csrf;
		const controller = new AbortController();
		const t = setTimeout(() => controller.abort(), 20000);
		let res: Response;
		try {
			res = await fetch(url, { redirect: 'manual', signal: controller.signal, headers });
		} finally {
			clearTimeout(t);
		}
		if (lastIgProfileUsedSession) absorbInstagramCookies(res);
		const text = await res.text();
		const redirectedToLogin = res.status >= 300 && res.status < 400;
		if (lastIgProfileUsedSession && (redirectedToLogin || looksLikeInstagramLoginRequired(res.status, text))) {
			invalidateInstagramSession(`web_profile_info HTTP ${res.status}`);
			return retried ? null : fetchIgWebProfileInfo(username, true);
		}
		if (!res.ok || !text || text.length < 20) return null;
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
		promise.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(err) => {
				clearTimeout(t);
				reject(err);
			},
		);
	});
}

function itemsFromIgWebProfile(data: any, username: string, max: number): SocialFeedItem[] {
	const edges =
		data?.data?.user?.edge_owner_to_timeline_media?.edges ||
		data?.user?.edge_owner_to_timeline_media?.edges ||
		[];
	const items: SocialFeedItem[] = [];
	for (const edge of edges) {
		const node = edge?.node;
		if (!node?.shortcode) continue;
		const isVideo = !!node.is_video;
		const product = String(node.product_type || '').toLowerCase();
		const kind =
			product === 'clips' || product === 'reel' || product === 'reels'
				? 'reel'
				: isVideo
					? 'reel'
					: 'post';
		const pathKind = kind === 'reel' ? 'reel' : 'p';
		items.push({
			id: `ig-${node.shortcode}`,
			platform: 'instagram',
			title: (node.edge_media_to_caption?.edges?.[0]?.node?.text || `${kind} @${username}`)
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 120),
			url: `https://www.instagram.com/${pathKind}/${node.shortcode}/`,
			thumbnailUrl:
				node.thumbnail_src ||
				node.display_url ||
				`https://www.instagram.com/p/${node.shortcode}/media/?size=l`,
			publishedAt: node.taken_at_timestamp
				? new Date(node.taken_at_timestamp * 1000).toISOString()
				: undefined,
			kind,
		});
		if (items.length >= max) break;
	}
	return items;
}

// =====================================================================
// YouTube v2 — simpan per kategori (video/short/live) + tanggal pasti
// =====================================================================

type WatchMeta = { publishedAt?: string; isLiveContent?: boolean; lengthSeconds?: number; title?: string };

/** Halaman watch memuat `datePublished` + `isLiveContent` yang akurat (lebih andal dari teks relatif InnerTube). */
async function fetchYoutubeWatchMeta(videoId: string): Promise<WatchMeta | null> {
	try {
		const html = await fetchText(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, 20000, {
			'Accept-Language': 'en-US,en;q=0.9',
		});
		const date =
			html.match(/<meta itemprop="datePublished" content="([^"]+)"/)?.[1] ||
			html.match(/<meta itemprop="uploadDate" content="([^"]+)"/)?.[1];
		const live = html.match(/"isLiveContent":(true|false)/)?.[1];
		const len = html.match(/"lengthSeconds":"(\d+)"/)?.[1];
		const title = html
			.match(/<meta name="title" content="([^"]+)"/)?.[1]
			?.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.trim();
		const parsed = date ? new Date(date) : null;
		return {
			publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined,
			isLiveContent: live === 'true',
			lengthSeconds: len ? parseInt(len, 10) : undefined,
			title,
		};
	} catch {
		return null;
	}
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let i = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (i < items.length) {
			const idx = i++;
			out[idx] = await fn(items[idx]);
		}
	});
	await Promise.all(workers);
	return out;
}

const PLACEHOLDER_TITLE = /^(Video|Short|Live|YouTube) [\w-]{11}$/i;
const ytVideoId = (it: SocialFeedItem) => it.id.replace(/^yt-live-/, '').replace(/^yt-/, '');

export type PlatformSyncOutcome = {
	items: SocialFeedItem[];
	method: string;
	newCount: number;
	blocked?: boolean;
	warning?: string;
};

export async function syncYoutubeFeed(
	config: YoutubeConfig,
	previous: SocialFeedItem[] = [],
): Promise<PlatformSyncOutcome & { live: SocialFeedLiveState['youtube'] }> {
	const channelUrl = config.profileOrChannelUrl || DEFAULT_SOCIAL_FEED_CONFIG.youtube.profileOrChannelUrl;
	const handle = extractYoutubeHandle(channelUrl);
	const channelId = await resolveYoutubeChannelId(channelUrl);
	if (!channelId) throw new Error(`Channel YouTube tidak ditemukan dari URL: ${channelUrl}`);
	const tabBase = handle
		? `https://www.youtube.com/@${encodeURIComponent(handle)}`
		: `https://www.youtube.com/channel/${channelId}`;
	const limits = config.fetchLimits;
	const methods: string[] = [];

	const pools: Record<YoutubeKind, SocialFeedItem[]> = { video: [], short: [], live: [] };
	const addTo = (kind: YoutubeKind, list: SocialFeedItem[]) => {
		for (const it of list) {
			const existing = pools[kind].find((x) => x.id === it.id);
			if (!existing) pools[kind].push({ ...it, kind });
			else if (PLACEHOLDER_TITLE.test(existing.title) && it.title && !PLACEHOLDER_TITLE.test(it.title)) {
				existing.title = it.title;
			}
		}
	};

	// 1) InnerTube (youtubei.js) — tab akurat
	try {
		const { pools: p } = await fetchYoutubeViaInnertube(channelId, config.content, Math.max(limits.video, limits.short, limits.live));
		addTo('video', p.video);
		addTo('short', p.short);
		addTo('live', p.live);
		if (p.video.length + p.short.length + p.live.length) methods.push('innertube');
	} catch (err) {
		console.warn('youtubei.js failed:', err);
	}

	// 2) HTML tab scrape — melengkapi judul / id bila InnerTube terbatas di VPS
	const tabs: Array<[boolean, 'videos' | 'streams' | 'shorts', YoutubeKind]> = [
		[config.content.videos, 'videos', 'video'],
		[config.content.live, 'streams', 'live'],
		[config.content.shorts, 'shorts', 'short'],
	];
	for (const [on, tab, kind] of tabs) {
		if (!on) continue;
		try {
			const found = await scrapeYoutubeTabHtml(tabBase, tab, kind, limits[kind] * 2);
			if (found.length) methods.push(`html:${tab}`);
			addTo(kind, found);
		} catch {
			/* tab tidak ada (mis. channel tanpa Shorts) */
		}
	}

	// 3) RSS — terakhir, hanya bila semua kosong
	if (pools.video.length + pools.short.length + pools.live.length === 0) {
		const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
		for (const it of parseYoutubeRss(xml, 15)) addTo(it.kind === 'short' ? 'short' : 'video', [it]);
		methods.push('rss');
	}

	// Satu video hanya boleh di satu kategori: live > short > video
	const claimed = new Set<string>();
	for (const kind of ['live', 'short', 'video'] as YoutubeKind[]) {
		pools[kind] = pools[kind].filter((it) => {
			const vid = ytVideoId(it);
			if (claimed.has(vid)) return false;
			claimed.add(vid);
			return true;
		});
	}

	// Ambil kandidat secukupnya per kategori, lalu isi tanggal (pakai cache lama bila ada)
	const prevById = new Map(previous.map((p) => [ytVideoId(p), p]));
	const candidates = (['video', 'short', 'live'] as YoutubeKind[]).flatMap((k) =>
		config.content[k === 'video' ? 'videos' : k === 'short' ? 'shorts' : 'live']
			? pools[k].slice(0, limits[k] + 2)
			: [],
	);
	let newCount = 0;
	const enriched = await mapLimit(candidates, 3, async (it) => {
		const vid = ytVideoId(it);
		const prev = prevById.get(vid);
		let next: SocialFeedItem = {
			...it,
			firstSeenAt: prev?.firstSeenAt || new Date().toISOString(),
			publishedAt: prev?.publishedAt || it.publishedAt,
			thumbnailUrl: prev?.thumbnailUrl?.startsWith('/uploads/') ? prev.thumbnailUrl : it.thumbnailUrl,
		};
		if (prev?.title && !PLACEHOLDER_TITLE.test(prev.title) && PLACEHOLDER_TITLE.test(next.title)) next.title = prev.title;
		if (!prev) (next as any).__new = true;
		if (!next.publishedAt || PLACEHOLDER_TITLE.test(next.title)) {
			const meta = await fetchYoutubeWatchMeta(vid);
			if (meta?.publishedAt) next.publishedAt = meta.publishedAt;
			if (meta?.title && PLACEHOLDER_TITLE.test(next.title)) next.title = meta.title.slice(0, 140);
			// Koreksi kategori dari metadata resmi (Shorts maks 3 menit)
			if (meta?.isLiveContent && next.kind !== 'live') next.kind = 'live';
			else if (next.kind === 'short' && (meta?.lengthSeconds ?? 0) > 180) {
				next.kind = 'video';
				next.url = `https://www.youtube.com/watch?v=${vid}`;
			}
		}
		if (!next.thumbnailUrl.startsWith('/uploads/')) {
			const local = await cacheRemoteImage(
				next.thumbnailUrl || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
				UPLOADS_YT,
				`${vid}.jpg`,
			);
			if (local) next.thumbnailUrl = local;
		}
		return next;
	});
	if (enriched.some((e) => e.publishedAt)) methods.push('watch');

	// Batasi per kategori setelah urut terbaru
	const byKind: Record<YoutubeKind, SocialFeedItem[]> = { video: [], short: [], live: [] };
	for (const it of sortSocialItems(enriched)) {
		const k = (it.kind as YoutubeKind) || 'video';
		if (byKind[k].length < limits[k]) byKind[k].push(it);
	}

	// Live sekarang
	let live: SocialFeedLiveState['youtube'] = { isLive: false };
	if (config.content.live && config.showLiveBadge) {
		try {
			const controller = new AbortController();
			const t = setTimeout(() => controller.abort(), 12000);
			const res = await fetch(`${tabBase}/live`, {
				redirect: 'follow',
				signal: controller.signal,
				headers: { 'User-Agent': UA_DESKTOP },
			});
			clearTimeout(t);
			const finalUrl = res.url || '';
			const watch = finalUrl.match(/[?&]v=([\w-]{11})/);
			const html = await res.text();
			const isLive = /"isLiveNow":true|"isLive"\s*:\s*true/i.test(html) && !!watch;
			if (isLive && watch) {
				const vid = watch[1];
				const title = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || 'Live sekarang')
					.replace(/\s*-\s*YouTube\s*$/i, '')
					.trim();
				const thumbRemote = `https://i.ytimg.com/vi/${vid}/hqdefault_live.jpg`;
				const thumbLocal = await cacheRemoteImage(thumbRemote, UPLOADS_YT, `${vid}-live.jpg`);
				live = { isLive: true, url: `https://www.youtube.com/watch?v=${vid}`, title, thumbnailUrl: thumbLocal || thumbRemote };
				const liveItem: SocialFeedItem = {
					id: `yt-live-${vid}`,
						platform: 'youtube',
						title,
						url: live.url!,
						thumbnailUrl: live.thumbnailUrl!,
					isLive: true,
					kind: 'live',
					publishedAt: new Date().toISOString(),
					firstSeenAt: new Date().toISOString(),
				};
				byKind.live = [liveItem, ...byKind.live.filter((x) => ytVideoId(x) !== vid)].slice(0, limits.live);
			}
		} catch (err) {
			console.warn('YouTube live check failed:', err);
		}
	}

	const items = sortSocialItems([...byKind.live, ...byKind.video, ...byKind.short]).map((it) => {
		if ((it as any).__new) newCount++;
		const { __new: _n, ...clean } = it as any;
		return clean as SocialFeedItem;
	});
	if (!items.length) {
		throw new Error('Tidak menemukan konten YouTube sesuai filter (Video / Shorts / Live).');
	}
	return { items, live, method: Array.from(new Set(methods)).join('+') || 'none', newCount };
}

// =====================================================================
// Instagram v2 — gratis tanpa token: daftar dari profil (bila tidak
// diblokir / ada sesi dummy) + link manual, lalu enrich via halaman embed.
// =====================================================================

export type InstagramEmbedInfo = {
	kind: InstagramKind;
	isCarousel: boolean;
	displayUrl?: string;
	caption?: string;
};

function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#039;|&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

/** Ambil string JSON ber-escape setelah `"key":"` (menghormati backslash). */
function readEscapedJsonString(html: string, key: string): string | null {
	const marker = `"${key}":"`;
	const start = html.indexOf(marker);
	if (start < 0) return null;
	let i = start + marker.length;
	while (i < html.length) {
		const ch = html[i];
		if (ch === '\\') {
			i += 2;
			continue;
		}
		if (ch === '"') break;
		i++;
	}
	try {
		return JSON.parse(`"${html.slice(start + marker.length, i)}"`);
	} catch {
		return null;
	}
}

function deepFind(obj: any, key: string, depth = 0): any {
	if (!obj || depth > 10 || typeof obj !== 'object') return undefined;
	if (key in obj) return obj[key];
	for (const v of Object.values(obj)) {
		const r = deepFind(v, key, depth + 1);
		if (r !== undefined) return r;
	}
	return undefined;
}

/**
 * Parser halaman `/p/{code}/embed/captioned/` (publik, tanpa login).
 * Reel: data di `contextJSON`. Post/carousel: markup `EmbeddedMediaImage` + `Caption`.
 * Fungsi murni — diuji dengan fixture HTML nyata.
 */
export function parseInstagramEmbed(html: string): InstagramEmbedInfo | null {
	if (!html || html.length < 500) return null;
	let kind: InstagramKind | null = null;
	let isCarousel = false;
	let displayUrl: string | undefined;
	let caption: string | undefined;

	const ctxRaw = readEscapedJsonString(html, 'contextJSON');
	if (ctxRaw) {
		try {
			const ctx = JSON.parse(ctxRaw);
			const typename = String(deepFind(ctx, '__typename') || '');
			const product = String(deepFind(ctx, 'product_type') || '').toLowerCase();
			const isVideo = deepFind(ctx, 'is_video') === true;
			if (product === 'clips' || typename === 'GraphVideo' || isVideo) kind = 'reel';
			else if (typename === 'GraphSidecar') {
				kind = 'post';
				isCarousel = true;
			} else if (typename === 'GraphImage') kind = 'post';
			const du = deepFind(ctx, 'display_url');
			if (typeof du === 'string') displayUrl = du;
			const capEdges = deepFind(ctx, 'edge_media_to_caption')?.edges;
			const capText = Array.isArray(capEdges) ? capEdges[0]?.node?.text : undefined;
			if (typeof capText === 'string') caption = capText;
		} catch {
			/* lanjut ke markup */
		}
	}

	if (!displayUrl) {
		const img = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/) || html.match(/src="([^"]+)"[^>]*class="EmbeddedMediaImage"/);
		if (img?.[1]) displayUrl = decodeHtmlEntities(img[1]);
	}
	if (!kind) {
		if (/GraphVideo|"is_video":true|video_url/.test(html)) kind = 'reel';
		else if (/EmbeddedMediaImage/.test(html)) kind = 'post';
	}
	if (kind === 'post' && !isCarousel && /Sidecar/.test(html)) isCarousel = true;
	if (!caption) {
		const capBlock = html.match(/<div class="Caption">([\s\S]*?)<\/div>/)?.[1];
		if (capBlock) {
			caption = decodeHtmlEntities(
				capBlock
					.replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, '')
					.replace(/<br\s*\/?>/gi, '\n')
					.replace(/<[^>]+>/g, '')
					.trim(),
			);
		}
	}
	if (!kind && !displayUrl) return null;
	return {
		kind: kind || 'post',
		isCarousel,
		displayUrl,
		caption: caption?.replace(/\s+\n/g, '\n').trim() || undefined,
	};
}

function captionToTitle(caption: string | undefined, fallback: string): string {
	const first = (caption || '').split('\n').map((l) => l.trim()).find((l) => l.length > 0);
	return (first || fallback).replace(/\s+/g, ' ').slice(0, 120);
}

async function fetchInstagramEmbed(code: string): Promise<InstagramEmbedInfo | null> {
	// PENTING: dengan UA browser lengkap IG mengirim shell aplikasi JS (tanpa data).
	// UA sederhana mendapat halaman embed statis yang berisi gambar/caption/tipe.
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), 20000);
	try {
		const res = await fetch(`https://www.instagram.com/p/${encodeURIComponent(code)}/embed/captioned/`, {
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'User-Agent': 'Mozilla/5.0' },
		});
		if (!res.ok) return null;
		return parseInstagramEmbed(await res.text());
	} catch {
		return null;
	} finally {
		clearTimeout(t);
	}
}

type IgDiscovered = { code: string; kindHint?: InstagramKind; item?: SocialFeedItem; source: string };

function codesFromUrls(urls: string[]): { code: string; kindHint: InstagramKind }[] {
	const out: { code: string; kindHint: InstagramKind }[] = [];
	for (const raw of urls) {
		const m = raw.match(/instagram\.com\/(?:[\w.-]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
		if (!m) continue;
		out.push({ code: m[2], kindHint: m[1].toLowerCase() === 'p' ? 'post' : 'reel' });
	}
	return out;
}

export function instagramUsernameFromUrl(url: string): string | null {
	return extractInstagramUsername(url);
}

export async function syncInstagramFeed(
	config: InstagramConfig,
	previous: SocialFeedItem[] = [],
): Promise<PlatformSyncOutcome> {
	const profileUrl = config.profileOrChannelUrl || DEFAULT_SOCIAL_FEED_CONFIG.instagram.profileOrChannelUrl;
	const username = extractInstagramUsername(profileUrl);
	if (!username) throw new Error('Username Instagram tidak valid');

	const discovered = new Map<string, IgDiscovered>();
	const add = (d: IgDiscovered) => {
		if (!discovered.has(d.code)) discovered.set(d.code, d);
	};
	const methods: string[] = [];
	let profileListWorked = false;

	// 0) instagrapi (API mobile, sesi akun dummy dikelola ops/instagram/ig_feed.py)
	const igLimit = Math.max(12, (config.fetchLimits.post || 0) + (config.fetchLimits.reel || 0));
	const viaPy = await fetchInstagramViaInstagrapi(username, Math.min(igLimit, 50));
	if (viaPy.ok && viaPy.items?.length) {
		for (const m of viaPy.items) {
			add({
				code: m.code,
				kindHint: m.kind,
				source: 'instagrapi',
				item: {
					id: `ig-${m.code}`,
					platform: 'instagram',
					kind: m.kind,
					isCarousel: m.isCarousel,
					caption: m.caption,
					title: m.caption,
					url: `https://www.instagram.com/${m.kind === 'reel' ? 'reel' : 'p'}/${m.code}/`,
					thumbnailUrl: m.thumbnailUrl || '',
					publishedAt: m.takenAt || undefined,
				},
			});
		}
		profileListWorked = true;
		methods.push(`instagrapi(${viaPy.method})`);
	}

	// 1) web_profile_info — berhasil bila IP tidak dibatasi atau INSTAGRAM_SESSION_ID (akun dummy) terpasang
	const profileJson = profileListWorked ? null : await fetchIgWebProfileInfo(username);
	if (profileJson) {
		const fromApi = itemsFromIgWebProfile(profileJson, username, 50);
		for (const it of fromApi) {
			const code = it.id.replace(/^ig-/, '');
			add({ code, kindHint: it.kind === 'reel' ? 'reel' : 'post', item: it, source: 'profile-api' });
		}
		if (fromApi.length) {
			profileListWorked = true;
			methods.push(lastIgProfileUsedSession ? 'profile-api(session)' : 'profile-api');
		}
	}

	// 2) HTML profil + tab reels (jarang berhasil tanpa login, murah dicoba)
	if (!profileListWorked) {
		const cookies = await seedInstagramCookies();
		for (const page of [`https://www.instagram.com/${encodeURIComponent(username)}/`, `https://www.instagram.com/${encodeURIComponent(username)}/reels/`]) {
			try {
				const body = await fetchText(page, 25000, {
					'User-Agent': UA_MOBILE,
					Referer: 'https://www.instagram.com/',
					...(cookies ? { Cookie: cookies } : {}),
				});
				const codes = extractIgShortcodes(body);
				for (const { code, kind } of codes) add({ code, kindHint: kind === 'reel' ? 'reel' : 'post', source: 'profile-html' });
				if (codes.length) {
					profileListWorked = true;
					methods.push('profile-html');
				}
			} catch {
				/* diblokir */
			}
		}
	}

	// 3) Link manual dari dashboard — selalu dipakai
	const manual = codesFromUrls(config.manualUrls || []);
	for (const m of manual) add({ ...m, source: 'manual' });
	if (manual.length) methods.push('manual');

	// 4) Item lama tetap dipertahankan (data tidak hilang saat IG memblokir)
	const prevByCode = new Map(previous.map((p) => [p.id.replace(/^ig-/, ''), p]));
	for (const [code, p] of Array.from(prevByCode.entries())) {
		const k = itemKind(p);
		if (k === 'post' || k === 'reel') add({ code, kindHint: k, source: 'cache' });
	}

	let newCount = 0;
	const list = Array.from(discovered.values());
	const items = await mapLimit(list, 3, async (d): Promise<SocialFeedItem | null> => {
		const prev = prevByCode.get(d.code);
		const needsEnrich =
			!prev ||
			!prev.thumbnailUrl?.startsWith('/uploads/') ||
			/^(Post|Reel) @/i.test(prev.title) ||
			prev.isCarousel === undefined;
		let kind: InstagramKind = (prev && (itemKind(prev) as InstagramKind)) || d.item?.kind as InstagramKind || d.kindHint || 'post';
		let isCarousel = prev?.isCarousel ?? false;
		let caption = prev?.caption;
		let remoteThumb = d.item?.thumbnailUrl;
		if (needsEnrich && d.source === 'instagrapi' && d.item) {
			kind = d.item.kind as InstagramKind;
			isCarousel = !!d.item.isCarousel;
			caption = d.item.caption || caption;
		} else if (needsEnrich) {
			const info = await fetchInstagramEmbed(d.code);
			if (info) {
				kind = info.kind;
				isCarousel = info.isCarousel;
				caption = info.caption || caption;
				remoteThumb = info.displayUrl || remoteThumb;
			}
		}
		let thumbnailUrl = prev?.thumbnailUrl?.startsWith('/uploads/') ? prev.thumbnailUrl : '';
		if (!thumbnailUrl && remoteThumb) {
			thumbnailUrl = (await cacheRemoteImage(remoteThumb, UPLOADS_IG, `${d.code}.jpg`)) || remoteThumb;
		}
		if (!thumbnailUrl) return null; // tanpa gambar tidak ditampilkan
		const pathKind = kind === 'reel' ? 'reel' : 'p';
		const fallbackTitle = `${kind === 'reel' ? 'Reel' : 'Post'} @${username}`;
		return {
			id: `ig-${d.code}`,
			platform: 'instagram',
			kind,
			isCarousel: kind === 'post' ? isCarousel : false,
			url: `https://www.instagram.com/${pathKind}/${d.code}/`,
			thumbnailUrl,
			caption: caption?.slice(0, 600),
			title: captionToTitle(caption, prev && !/^(Post|Reel) @/i.test(prev.title) ? prev.title : fallbackTitle),
			publishedAt: d.item?.publishedAt || instagramShortcodeToDate(d.code) || prev?.publishedAt,
			firstSeenAt: prev?.firstSeenAt || new Date().toISOString(),
		};
	});

	const sorted = sortSocialItems(items.filter((x): x is SocialFeedItem => !!x));
	const byKind: Record<InstagramKind, SocialFeedItem[]> = { post: [], reel: [] };
	for (const it of sorted) {
		const k = it.kind as InstagramKind;
		if (byKind[k] && byKind[k].length < config.fetchLimits[k]) byKind[k].push(it);
	}
	const finalItems = sortSocialItems([...byKind.post, ...byKind.reel]);
	newCount = finalItems.filter((it) => !prevByCode.has(it.id.replace(/^ig-/, ''))).length;
	const blocked = !profileListWorked;
	if (!finalItems.length) {
		throw new Error(
			'Instagram memblokir daftar post tanpa login. Tambahkan link post/reel manual di dashboard, atau pasang sesi akun dummy (INSTAGRAM_DUMMY_USERNAME/PASSWORD untuk auto-login, atau INSTAGRAM_SESSION_ID).',
		);
	}
	return {
		items: finalItems,
		method: (methods.length ? methods : ['cache']).join('+'),
		newCount,
		blocked,
		warning: blocked
			? 'Daftar post otomatis diblokir Instagram (butuh login / rate limit). Post baru hanya masuk lewat link manual atau sesi akun dummy.'
			: undefined,
	};
}

// =====================================================================
// Orkestrasi + log
// =====================================================================

export type SocialSyncResult = {
	ok: boolean;
	cache: SocialFeedCache;
	error?: string;
	logs: SocialFeedLogEntry[];
};

export async function runSocialFeedSync(
	configInput?: unknown,
	previous?: SocialFeedCache | null,
	options: { platform?: SocialPlatform; trigger?: 'cron' | 'manual'; triggeredBy?: string } = {},
): Promise<SocialSyncResult> {
	const config = normalizeSocialFeedConfig(configInput);
	const prev = previous || DEFAULT_SOCIAL_FEED_CACHE;
	const next: SocialFeedCache = {
		youtube: [...(prev.youtube || [])],
		instagram: [...(prev.instagram || [])],
		live: { ...(prev.live || {}) },
		status: { ...(prev.status || {}) },
		syncedAt: new Date().toISOString(),
	};
	const errors: string[] = [];
	const logs: SocialFeedLogEntry[] = [];
	const trigger = options.trigger || 'manual';

	const runOne = async (platform: SocialPlatform) => {
		const started = Date.now();
		const startedAt = new Date(started).toISOString();
		try {
			const outcome =
				platform === 'youtube'
					? await syncYoutubeFeed(config.youtube, prev.youtube || [])
					: await syncInstagramFeed(config.instagram, prev.instagram || []);
			if (platform === 'youtube') {
				next.youtube = outcome.items;
				next.live.youtube = (outcome as any).live;
			} else {
				next.instagram = outcome.items;
			}
			const durationMs = Date.now() - started;
			next.status![platform] = {
				at: startedAt,
				ok: true,
				method: outcome.method,
				newCount: outcome.newCount,
				total: outcome.items.length,
				blocked: outcome.blocked,
				error: outcome.warning,
				durationMs,
			};
			if (outcome.warning) errors.push(`${platform}(warning): ${outcome.warning}`);
			logs.push({
				id: `${started}-${platform}`,
				platform,
				trigger,
				startedAt,
				durationMs,
				ok: true,
				method: outcome.method,
				newCount: outcome.newCount,
				total: outcome.items.length,
				byKind: countByKind(outcome.items),
				blocked: outcome.blocked,
				error: outcome.warning,
				triggeredBy: options.triggeredBy,
			});
		} catch (err: any) {
			const msg = String(err?.message || err).slice(0, 400);
			const durationMs = Date.now() - started;
			errors.push(`${platform}: ${msg}`);
			console.warn(`${platform} social sync failed:`, err);
			const kept = platform === 'youtube' ? next.youtube : next.instagram;
			next.status![platform] = { at: startedAt, ok: false, error: msg, total: kept.length, durationMs };
			logs.push({
				id: `${started}-${platform}`,
				platform,
				trigger,
				startedAt,
				durationMs,
				ok: false,
				newCount: 0,
				total: kept.length,
				byKind: countByKind(kept),
				error: msg,
				triggeredBy: options.triggeredBy,
			});
		}
	};

	const want = (p: SocialPlatform) => !options.platform || options.platform === p;
	if (want('youtube')) {
		if (config.youtube.enabled) await runOne('youtube');
		else {
			next.youtube = [];
			next.live.youtube = { isLive: false };
		}
	}
	if (want('instagram')) {
		if (config.instagram.enabled) await runOne('instagram');
		else next.instagram = [];
	}

	if (errors.length) next.lastError = errors.join('; ');
	else delete next.lastError;
	const hardFail = logs.some((l) => !l.ok);
	return { ok: !hardFail, cache: next, error: errors.length ? errors.join('; ') : undefined, logs };
}

/** Simpan hasil sync + log (maks SOCIAL_FEED_LOG_LIMIT) ke storage (main atau tenant). */
export async function persistSocialFeedSync(storage: any, result: SocialSyncResult, previousLogs: unknown) {
	const old = Array.isArray(previousLogs) ? (previousLogs as SocialFeedLogEntry[]) : [];
	const socialFeedLogs = [...result.logs.slice().reverse(), ...old].slice(0, SOCIAL_FEED_LOG_LIMIT);
	await storage.updateSettings({
		socialFeedCache: result.cache,
		lastSocialFeedSyncAt: new Date(),
		socialFeedLogs,
	});
	return socialFeedLogs;
}

// =====================================================================
// Payload publik
// =====================================================================

function publicItem(it: SocialFeedItem): SocialFeedItem {
	const { caption: _c, ...rest } = it;
	return { ...rest, kind: itemKind(it) };
}

/**
 * Payload beranda: per kategori maksimal homeLimit + loadMoreStep (cukup untuk "Lebih banyak"
 * tanpa request tambahan). Field lama `youtube` / `instagram` tetap ada (tab "Semua").
 */
export function publicSocialFeedPayload(configInput: unknown, cache: SocialFeedCache) {
	const cfg = normalizeSocialFeedConfig(configInput);
	const yt = visibleSocialItems(cfg, 'youtube', cache);
	const ig = visibleSocialItems(cfg, 'instagram', cache);
	const ytCap = cfg.youtube.homeLimit + cfg.youtube.loadMoreStep;
	const igCap = cfg.instagram.homeLimit + cfg.instagram.loadMoreStep;
	const slice = (items: SocialFeedItem[], kinds: string[], cap: number) =>
		Object.fromEntries(kinds.map((k) => [k, selectSocialItems(items, k as any, 0, cap).map(publicItem)]));
	return {
		config: {
			youtube: {
				enabled: cfg.youtube.enabled,
				profileOrChannelUrl: cfg.youtube.profileOrChannelUrl,
				showLiveBadge: cfg.youtube.showLiveBadge,
				showFeaturedEmbed: cfg.youtube.showFeaturedEmbed,
				content: cfg.youtube.content,
				homeLimit: cfg.youtube.homeLimit,
				loadMoreStep: cfg.youtube.loadMoreStep,
				maxItems: cfg.youtube.homeLimit,
			},
			instagram: {
				enabled: cfg.instagram.enabled,
				profileOrChannelUrl: cfg.instagram.profileOrChannelUrl,
				username: extractInstagramUsername(cfg.instagram.profileOrChannelUrl),
				showLiveBadge: false,
				content: cfg.instagram.content,
				homeLimit: cfg.instagram.homeLimit,
				loadMoreStep: cfg.instagram.loadMoreStep,
				maxItems: cfg.instagram.homeLimit,
			},
		},
		youtube: yt.slice(0, ytCap).map(publicItem),
		instagram: ig.slice(0, igCap).map(publicItem),
		youtubeByKind: slice(yt, YOUTUBE_KINDS, ytCap),
		instagramByKind: slice(ig, INSTAGRAM_KINDS, igCap),
		counts: {
			youtube: { all: yt.length, ...countByKind(yt) },
			instagram: { all: ig.length, ...countByKind(ig) },
		},
		live: {
			youtube:
				cfg.youtube.enabled && cfg.youtube.showLiveBadge && cfg.youtube.content.live ? cache.live?.youtube : undefined,
			instagram: undefined,
		},
		syncedAt: cache.syncedAt || null,
	};
}

/** Daftar paginasi untuk "Lihat semua" (`/media/youtube`, `/media/instagram`). */
export function publicSocialFeedItems(
	configInput: unknown,
	cache: SocialFeedCache,
	platform: SocialPlatform,
	kind: string,
	offset: number,
	limit: number,
) {
	const cfg = normalizeSocialFeedConfig(configInput);
	const items = visibleSocialItems(cfg, platform, cache);
	const allowed = platform === 'youtube' ? YOUTUBE_KINDS : INSTAGRAM_KINDS;
	const k = (allowed as string[]).includes(kind) ? (kind as SocialContentKind) : 'all';
	const pool = k === 'all' ? items : items.filter((it) => itemKind(it) === k);
	return {
		items: pool.slice(offset, offset + limit).map(publicItem),
		total: pool.length,
		counts: { all: items.length, ...countByKind(items) },
		profileUrl: platform === 'youtube' ? cfg.youtube.profileOrChannelUrl : cfg.instagram.profileOrChannelUrl,
		username: platform === 'instagram' ? extractInstagramUsername(cfg.instagram.profileOrChannelUrl) : null,
		enabled: platform === 'youtube' ? cfg.youtube.enabled : cfg.instagram.enabled,
		syncedAt: cache.syncedAt || null,
	};
}
