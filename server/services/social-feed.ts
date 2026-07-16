import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import {
	DEFAULT_SOCIAL_FEED_CACHE,
	DEFAULT_SOCIAL_FEED_CONFIG,
	normalizeSocialFeedConfig,
	type SocialFeedCache,
	type SocialFeedConfig,
	type SocialFeedItem,
	type SocialFeedLiveState,
} from '../../shared/social-feed';
import { uploadDir } from '../upload';

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const UPLOADS_YT = path.join(uploadDir, 'social', 'youtube');
const UPLOADS_IG = path.join(uploadDir, 'social', 'instagram');

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function fetchText(url: string, timeoutMs = 20000): Promise<string> {
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			redirect: 'follow',
			signal: controller.signal,
			headers: {
				'User-Agent': UA,
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
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
			headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
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
		h === 'img.youtube.com'
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
	const skip = new Set(['p', 'reel', 'reels', 'stories', 'tv']);
	if (skip.has(parts[0].toLowerCase())) return null;
	return parts[0].replace(/^@/, '') || null;
}

/** Resolve @handle → UC… channel id from channel page HTML. */
export async function resolveYoutubeChannelId(channelUrl: string): Promise<string | null> {
	const html = await fetchText(channelUrl);
	const patterns = [
		/"channelId"\s*:\s*"(UC[\w-]{20,})"/,
		/"externalId"\s*:\s*"(UC[\w-]{20,})"/,
		/https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{20,})/,
		/<meta\s+itemprop="channelId"\s+content="(UC[\w-]{20,})"/i,
	];
	for (const re of patterns) {
		const m = html.match(re);
		if (m?.[1]) return m[1];
	}
	return null;
}

function parseYoutubeRss(xml: string, maxItems: number): SocialFeedItem[] {
	const $ = cheerio.load(xml, { xmlMode: true });
	const items: SocialFeedItem[] = [];
	$('entry').each((_, el) => {
		if (items.length >= maxItems) return;
		const id = $(el).find('yt\\:videoId, videoId').first().text().trim() || $(el).find('id').text().trim();
		const title = $(el).find('title').first().text().replace(/\s+/g, ' ').trim();
		const link =
			$(el).find('link').attr('href') ||
			(id ? `https://www.youtube.com/watch?v=${id}` : '');
		const publishedAt = $(el).find('published').first().text().trim() || undefined;
		let thumbnailUrl =
			$(el).find('media\\:thumbnail, thumbnail').attr('url') ||
			(id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
		if (!id || !title || !link) return;
		items.push({
			id: `yt-${id}`,
			platform: 'youtube',
			title,
			url: link,
			thumbnailUrl,
			publishedAt,
		});
	});
	return items.slice(0, maxItems);
}

export async function syncYoutubeFeed(
	config: SocialFeedConfig['youtube'],
): Promise<{ items: SocialFeedItem[]; live: SocialFeedLiveState['youtube'] }> {
	const channelUrl = config.profileOrChannelUrl || DEFAULT_SOCIAL_FEED_CONFIG.youtube.profileOrChannelUrl;
	const maxItems = config.maxItems;
	const channelId = await resolveYoutubeChannelId(channelUrl);
	if (!channelId) throw new Error('YouTube channelId tidak ditemukan');

	const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
	const xml = await fetchText(rssUrl);
	let items = parseYoutubeRss(xml, maxItems);

	// Cache thumbs locally (best-effort)
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		const vid = it.id.replace(/^yt-/, '');
		const local = await cacheRemoteImage(it.thumbnailUrl, UPLOADS_YT, `${vid}.jpg`);
		if (local) items[i] = { ...it, thumbnailUrl: local };
	}

	let live: SocialFeedLiveState['youtube'] = { isLive: false };
	if (config.showLiveBadge) {
		const handle = extractYoutubeHandle(channelUrl);
		const liveUrl = handle
			? `https://www.youtube.com/@${handle}/live`
			: `https://www.youtube.com/channel/${channelId}/live`;
		try {
			const controller = new AbortController();
			const t = setTimeout(() => controller.abort(), 12000);
			const res = await fetch(liveUrl, {
				redirect: 'follow',
				signal: controller.signal,
				headers: { 'User-Agent': UA },
			});
			clearTimeout(t);
			const finalUrl = res.url || '';
			const watch = finalUrl.match(/[?&]v=([\w-]{11})/);
			const html = await res.text();
			const isLive =
				/isLiveNow["\s:]+true|"isLive"\s*:\s*true|hqdefault_live|LIVE_STREAM/i.test(html) ||
				(!!watch && /live/i.test(finalUrl));
			if (isLive && watch) {
				const vid = watch[1];
				const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
				const title = (titleMatch?.[1] || 'Live sekarang')
					.replace(/\s*-\s*YouTube\s*$/i, '')
					.replace(/\s+/g, ' ')
					.trim();
				const thumbRemote = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
				const thumbLocal = await cacheRemoteImage(thumbRemote, UPLOADS_YT, `${vid}-live.jpg`);
				live = {
					isLive: true,
					url: `https://www.youtube.com/watch?v=${vid}`,
					title,
					thumbnailUrl: thumbLocal || thumbRemote,
				};
				// Pin live at front of list
				const liveItem: SocialFeedItem = {
					id: `yt-live-${vid}`,
					platform: 'youtube',
					title: `🔴 LIVE: ${title}`,
					url: live.url!,
					thumbnailUrl: live.thumbnailUrl!,
					isLive: true,
					publishedAt: new Date().toISOString(),
				};
				items = [liveItem, ...items.filter((x) => x.id !== `yt-${vid}`)].slice(0, maxItems);
			}
		} catch (err) {
			console.warn('YouTube live check failed:', err);
		}
	}

	return { items, live };
}

function extractIgShortcodes(html: string): { code: string; kind: 'p' | 'reel' }[] {
	const found: { code: string; kind: 'p' | 'reel' }[] = [];
	const seen = new Set<string>();
	const re = /instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		const kind = m[1].toLowerCase() === 'reel' ? 'reel' : 'p';
		const code = m[2];
		if (seen.has(code)) continue;
		seen.add(code);
		found.push({ code, kind });
		if (found.length >= 12) break;
	}
	return found;
}

function extractThumbCandidates(html: string): string[] {
	const urls: string[] = [];
	const og = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
	if (og?.[1]) urls.push(og[1].replace(/&amp;/g, '&'));

	const pushEscaped = (raw: string) => {
		try {
			urls.push(JSON.parse(`"${raw}"`));
		} catch {
			urls.push(raw.replace(/\\u0026/g, '&'));
		}
	};

	const displayRe = /"display_url"\s*:\s*"([^"]+)"/g;
	let dm: RegExpExecArray | null;
	while ((dm = displayRe.exec(html))) {
		pushEscaped(dm[1]);
		if (urls.length > 20) break;
	}

	const thumbRe = /"thumbnail_src"\s*:\s*"([^"]+)"/g;
	let tm: RegExpExecArray | null;
	while ((tm = thumbRe.exec(html))) {
		pushEscaped(tm[1]);
		if (urls.length > 30) break;
	}
	return urls;
}

export async function syncInstagramFeed(
	config: SocialFeedConfig['instagram'],
): Promise<{ items: SocialFeedItem[]; live: SocialFeedLiveState['instagram'] }> {
	const profileUrl =
		config.profileOrChannelUrl || DEFAULT_SOCIAL_FEED_CONFIG.instagram.profileOrChannelUrl;
	const username = extractInstagramUsername(profileUrl);
	if (!username) throw new Error('Username Instagram tidak valid');

	const pageUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;
	const html = await fetchText(pageUrl);
	const shortcodes = extractIgShortcodes(html);
	const thumbs = extractThumbCandidates(html);

	const items: SocialFeedItem[] = [];
	for (let i = 0; i < shortcodes.length && items.length < config.maxItems; i++) {
		const { code, kind } = shortcodes[i];
		const url = `https://www.instagram.com/${kind}/${code}/`;
		let thumbnailUrl = thumbs[i] || thumbs[0] || '';
		if (thumbnailUrl) {
			const local = await cacheRemoteImage(thumbnailUrl, UPLOADS_IG, `${code}.jpg`);
			if (local) thumbnailUrl = local;
		}
		items.push({
			id: `ig-${code}`,
			platform: 'instagram',
			title: kind === 'reel' ? `Reel @${username}` : `Post @${username}`,
			url,
			thumbnailUrl: thumbnailUrl || '',
		});
	}

	// Enrich first item title via og:title on post page (best-effort, limited)
	if (items[0]?.url) {
		try {
			const postHtml = await fetchText(items[0].url, 12000);
			const titleM = postHtml.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i);
			if (titleM?.[1]) {
				items[0].title = titleM[1].replace(/\s+/g, ' ').trim().slice(0, 120);
			}
			if (!items[0].thumbnailUrl) {
				const og = postHtml.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
				if (og?.[1]) {
					const local = await cacheRemoteImage(
						og[1].replace(/&amp;/g, '&'),
						UPLOADS_IG,
						`${items[0].id.replace(/^ig-/, '')}.jpg`,
					);
					items[0].thumbnailUrl = local || og[1];
				}
			}
		} catch {
			/* ignore */
		}
	}

	let live: SocialFeedLiveState['instagram'] = { isLive: false };
	if (config.showLiveBadge) {
		// Avoid false positives: only mark live if explicit live broadcast markers exist
		const liveSignal =
			/"is_live_broadcast"\s*:\s*true|"broadcast_status"\s*:\s*"LIVE"/i.test(html) ||
			/instagram\.com\/[^/]+\/live\//i.test(html);
		if (liveSignal) {
			live = {
				isLive: true,
				url: pageUrl,
				title: `@${username} sedang live`,
			};
		}
	}

	if (!items.length) {
		throw new Error('Tidak menemukan post Instagram publik (profil mungkin membatasi scrape)');
	}

	return { items, live };
}

export type SocialSyncResult = {
	ok: boolean;
	cache: SocialFeedCache;
	error?: string;
};

/** Merge keep-on-fail: never wipe previous platform cache on partial failure. */
export async function runSocialFeedSync(
	configInput?: Partial<SocialFeedConfig> | null,
	previous?: SocialFeedCache | null,
): Promise<SocialSyncResult> {
	const config = normalizeSocialFeedConfig(configInput);
	const prev = previous || DEFAULT_SOCIAL_FEED_CACHE;
	const next: SocialFeedCache = {
		youtube: [...(prev.youtube || [])],
		instagram: [...(prev.instagram || [])],
		live: { ...(prev.live || {}) },
		syncedAt: new Date().toISOString(),
	};
	const errors: string[] = [];

	if (config.youtube.enabled) {
		try {
			const yt = await syncYoutubeFeed(config.youtube);
			next.youtube = yt.items;
			next.live.youtube = yt.live;
		} catch (err: any) {
			errors.push(`youtube: ${err?.message || err}`);
			console.warn('YouTube social sync failed:', err);
		}
	} else {
		next.youtube = [];
		next.live.youtube = { isLive: false };
	}

	if (config.instagram.enabled) {
		try {
			const ig = await syncInstagramFeed(config.instagram);
			next.instagram = ig.items;
			next.live.instagram = ig.live;
		} catch (err: any) {
			errors.push(`instagram: ${err?.message || err}`);
			console.warn('Instagram social sync failed:', err);
		}
	} else {
		next.instagram = [];
		next.live.instagram = { isLive: false };
	}

	if (errors.length) next.lastError = errors.join('; ');
	else delete next.lastError;

	return {
		ok: errors.length === 0,
		cache: next,
		error: errors.length ? errors.join('; ') : undefined,
	};
}

export function publicSocialFeedPayload(
	config: SocialFeedConfig,
	cache: SocialFeedCache,
) {
	const cfg = normalizeSocialFeedConfig(config);
	return {
		config: {
			youtube: {
				enabled: cfg.youtube.enabled,
				profileOrChannelUrl: cfg.youtube.profileOrChannelUrl,
				maxItems: cfg.youtube.maxItems,
				showLiveBadge: cfg.youtube.showLiveBadge,
				showFeaturedEmbed: !!cfg.youtube.showFeaturedEmbed,
			},
			instagram: {
				enabled: cfg.instagram.enabled,
				profileOrChannelUrl: cfg.instagram.profileOrChannelUrl,
				maxItems: cfg.instagram.maxItems,
				showLiveBadge: cfg.instagram.showLiveBadge,
			},
		},
		youtube: cfg.youtube.enabled ? (cache.youtube || []).slice(0, cfg.youtube.maxItems) : [],
		instagram: cfg.instagram.enabled
			? (cache.instagram || []).slice(0, cfg.instagram.maxItems)
			: [],
		live: {
			youtube: cfg.youtube.enabled && cfg.youtube.showLiveBadge ? cache.live?.youtube : undefined,
			instagram:
				cfg.instagram.enabled && cfg.instagram.showLiveBadge ? cache.live?.instagram : undefined,
		},
		syncedAt: cache.syncedAt || null,
	};
}
