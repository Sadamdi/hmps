import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import {
	DEFAULT_SOCIAL_FEED_CACHE,
	DEFAULT_SOCIAL_FEED_CONFIG,
	filterInstagramItems,
	filterYoutubeItems,
	normalizeSocialFeedConfig,
	type SocialFeedCache,
	type SocialFeedConfig,
	type SocialFeedItem,
	type SocialFeedLiveState,
} from '../../shared/social-feed';
import { uploadDir } from '../upload';

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

export async function syncYoutubeFeed(
	config: SocialFeedConfig['youtube'],
): Promise<{ items: SocialFeedItem[]; live: SocialFeedLiveState['youtube'] }> {
	const channelUrl = config.profileOrChannelUrl || DEFAULT_SOCIAL_FEED_CONFIG.youtube.profileOrChannelUrl;
	const maxItems = config.maxItems;
	const handle = extractYoutubeHandle(channelUrl);
	const channelId = await resolveYoutubeChannelId(channelUrl);
	if (!channelId) throw new Error('YouTube channelId tidak ditemukan untuk @HimatifEncoder');

	const collected: SocialFeedItem[] = [];
	const byId = new Map<string, SocialFeedItem>();

	const pushUnique = (list: SocialFeedItem[]) => {
		for (const it of list) {
			if (byId.has(it.id)) continue;
			byId.set(it.id, it);
			collected.push(it);
		}
	};

	if (config.content.videos || config.content.shorts) {
		const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
		const xml = await fetchText(rssUrl);
		pushUnique(parseYoutubeRss(xml, Math.max(maxItems * 3, 12)));
	}

	if (config.content.shorts && handle) {
		try {
			pushUnique(await scrapeYoutubeShorts(handle, Math.max(maxItems * 2, 8)));
		} catch (err) {
			console.warn('YouTube Shorts scrape failed:', err);
		}
	}

	let live: SocialFeedLiveState['youtube'] = { isLive: false };
	if (config.content.live && config.showLiveBadge) {
		const liveUrl = handle
			? `https://www.youtube.com/@${handle}/live`
			: `https://www.youtube.com/channel/${channelId}/live`;
		try {
			const controller = new AbortController();
			const t = setTimeout(() => controller.abort(), 12000);
			const res = await fetch(liveUrl, {
				redirect: 'follow',
				signal: controller.signal,
				headers: { 'User-Agent': UA_DESKTOP },
			});
			clearTimeout(t);
			const finalUrl = res.url || '';
			const watch = finalUrl.match(/[?&]v=([\w-]{11})/) || finalUrl.match(/\/shorts\/([\w-]{11})/);
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
				const liveItem: SocialFeedItem = {
					id: `yt-live-${vid}`,
					platform: 'youtube',
					title: `LIVE: ${title}`,
					url: live.url!,
					thumbnailUrl: live.thumbnailUrl!,
					isLive: true,
					kind: 'live',
					publishedAt: new Date().toISOString(),
				};
				byId.delete(`yt-${vid}`);
				pushUnique([liveItem]);
			}
		} catch (err) {
			console.warn('YouTube live check failed:', err);
		}
	}

	let filtered = filterYoutubeItems(collected, config.content);
	filtered.sort((a, b) => {
		const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
		const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
		if (a.isLive && !b.isLive) return -1;
		if (!a.isLive && b.isLive) return 1;
		return tb - ta;
	});
	filtered = filtered.slice(0, maxItems);
	filtered = await enrichYoutubeThumbs(filtered);

	if (!filtered.length && !live.isLive) {
		throw new Error('Tidak menemukan video/Shorts YouTube dari channel');
	}

	return { items: filtered, live };
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

async function fetchIgWebProfileInfo(username: string): Promise<any | null> {
	try {
		const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
		const session = process.env.INSTAGRAM_SESSION_ID?.trim();
		const csrf = process.env.INSTAGRAM_CSRF_TOKEN?.trim() || '';
		const headers: Record<string, string> = {
			'User-Agent': UA_DESKTOP,
			'X-IG-App-ID': '936619743392459',
			Accept: '*/*',
			Referer: `https://www.instagram.com/${username}/`,
			'X-Requested-With': 'XMLHttpRequest',
		};
		if (session) {
			headers.Cookie = `sessionid=${session}${csrf ? `; csrftoken=${csrf}` : ''}; ds_user_id=1`;
			if (csrf) headers['X-CSRFToken'] = csrf;
		}
		const text = await fetchText(url, 20000, headers);
		if (!text || text.length < 20) return null;
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

async function enrichIgViaBochil(url: string): Promise<{ thumb?: string; title?: string } | null> {
	try {
		const mod: any = await withTimeout(
			import('@bochilteam/scraper-instagram'),
			8000,
			'bochil-import',
		);
		const instagramdl = mod.instagramdl || mod.default?.instagramdl;
		if (typeof instagramdl !== 'function') return null;
		const data: any = await withTimeout(instagramdl(url), 12000, 'bochil-dl');
		const thumb =
			data?.thumbnail ||
			data?.thumb ||
			data?.[0]?.thumbnail ||
			data?.url?.[0]?.url ||
			undefined;
		const title = data?.title || data?.caption || undefined;
		return { thumb: typeof thumb === 'string' ? thumb : undefined, title };
	} catch {
		return null;
	}
}

async function scrapeIgStories(username: string): Promise<SocialFeedItem[]> {
	try {
		const mod: any = await withTimeout(
			import('@bochilteam/scraper-instagram'),
			8000,
			'bochil-import-story',
		);
		const instagramStory = mod.instagramStory || mod.default?.instagramStory;
		if (typeof instagramStory !== 'function') return [];
		const data: any = await withTimeout(
			instagramStory(`https://www.instagram.com/stories/${username}/`),
			15000,
			'bochil-story',
		);
		const list = Array.isArray(data) ? data : data?.results || data?.story || [];
		if (!Array.isArray(list)) return [];
		return list.slice(0, 5).map((s: any, i: number) => ({
			id: `ig-story-${s.id || s.pk || i}`,
			platform: 'instagram' as const,
			title: `Story @${username}`,
			url: s.url || `https://www.instagram.com/stories/${username}/`,
			thumbnailUrl: s.thumbnail || s.thumb || s.url || '',
			kind: 'story' as const,
			publishedAt: s.taken_at ? new Date(s.taken_at * 1000).toISOString() : undefined,
		}));
	} catch (err) {
		console.warn('IG stories scrape failed:', err);
		return [];
	}
}

function itemsFromManualIgUrls(urls: string[], username: string): SocialFeedItem[] {
	const out: SocialFeedItem[] = [];
	for (const raw of urls) {
		const m = raw.match(/instagram\.com\/(?:[\w.-]+\/)?(p|reel|reels)\/([A-Za-z0-9_-]+)/i);
		if (!m) continue;
		const kind = m[1].toLowerCase() === 'p' ? 'post' : 'reel';
		const code = m[2];
		const pathKind = kind === 'reel' ? 'reel' : 'p';
		out.push({
			id: `ig-${code}`,
			platform: 'instagram',
			title: kind === 'reel' ? `Reel @${username}` : `Post @${username}`,
			url: `https://www.instagram.com/${pathKind}/${code}/`,
			// /p/{code}/media works for both posts and reels ( /reel/.../media often 404 )
			thumbnailUrl: `https://www.instagram.com/p/${code}/media/?size=l`,
			kind,
		});
	}
	return out;
}

export async function syncInstagramFeed(
	config: SocialFeedConfig['instagram'],
): Promise<{ items: SocialFeedItem[]; live: SocialFeedLiveState['instagram'] }> {
	const profileUrl =
		config.profileOrChannelUrl || DEFAULT_SOCIAL_FEED_CONFIG.instagram.profileOrChannelUrl;
	const username = extractInstagramUsername(profileUrl);
	if (!username) throw new Error('Username Instagram tidak valid');

	const pageUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;
	const collected: SocialFeedItem[] = [];
	const byId = new Map<string, SocialFeedItem>();
	const pushUnique = (list: SocialFeedItem[]) => {
		for (const it of list) {
			if (byId.has(it.id)) continue;
			byId.set(it.id, it);
			collected.push(it);
		}
	};

	// 1) Official-ish web_profile_info (works more often with INSTAGRAM_SESSION_ID)
	const profileJson = await fetchIgWebProfileInfo(username);
	if (profileJson) {
		pushUnique(itemsFromIgWebProfile(profileJson, username, Math.max(config.maxItems * 3, 12)));
	}

	// 2) HTML profile + reels tab scrape (URL shape: /username/p/CODE)
	const pages = [pageUrl, `https://www.instagram.com/${encodeURIComponent(username)}/reels/`];
	let html = '';
	for (const page of pages) {
		try {
			const body = await fetchText(page, 25000, {
				'User-Agent': UA_MOBILE,
				Referer: 'https://www.instagram.com/',
				...(process.env.INSTAGRAM_SESSION_ID?.trim()
					? {
							Cookie: `sessionid=${process.env.INSTAGRAM_SESSION_ID.trim()}${
								process.env.INSTAGRAM_CSRF_TOKEN?.trim()
									? `; csrftoken=${process.env.INSTAGRAM_CSRF_TOKEN.trim()}`
									: ''
							}`,
						}
					: {}),
			});
			if (body.length > html.length) html = body;
			const shortcodes = extractIgShortcodes(body);
			const thumbs = extractThumbCandidates(body);
			for (let i = 0; i < shortcodes.length; i++) {
				const { code, kind } = shortcodes[i];
				const pathKind = kind === 'reel' ? 'reel' : 'p';
				pushUnique([
					{
						id: `ig-${code}`,
						platform: 'instagram',
						title: kind === 'reel' ? `Reel @${username}` : `Post @${username}`,
						url: `https://www.instagram.com/${pathKind}/${code}/`,
						thumbnailUrl:
							thumbs[i] ||
							thumbs[0] ||
							`https://www.instagram.com/p/${code}/media/?size=l`,
						kind: kind === 'reel' ? 'reel' : 'post',
					},
				]);
			}
		} catch (err) {
			console.warn('IG HTML scrape failed for', page, err);
		}
	}

	// 3) Manual / pinned URLs (Settings) — andalan saat IG rate-limit / login wall
	if (config.manualUrls?.length) {
		pushUnique(itemsFromManualIgUrls(config.manualUrls, username));
	}

	// 4) Stories (optional)
	if (config.content.stories) {
		pushUnique(await scrapeIgStories(username));
	}

	// Enrich missing / weak thumbs (og:image first — lebih andal dari bochil di server)
	for (let i = 0; i < Math.min(collected.length, config.maxItems + 2); i++) {
		const it = collected[i];
		const weakThumb =
			!it.thumbnailUrl || /instagram\.com\/.+\/media\/\?size=/i.test(it.thumbnailUrl);
		if (!weakThumb) continue;

		try {
			const postHtml = await fetchText(it.url, 20000, {
				'User-Agent': UA_DESKTOP,
				Accept:
					'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
				'Sec-Fetch-Dest': 'document',
				'Sec-Fetch-Mode': 'navigate',
			});
			const candidates = extractThumbCandidates(postHtml);
			if (candidates[0]) {
				collected[i] = { ...collected[i], thumbnailUrl: candidates[0] };
			}
		} catch {
			/* ignore */
		}

		if (
			!collected[i].thumbnailUrl ||
			/instagram\.com\/.+\/media\/\?size=/i.test(collected[i].thumbnailUrl)
		) {
			const enriched = await enrichIgViaBochil(it.url);
			if (enriched?.thumb) collected[i] = { ...collected[i], thumbnailUrl: enriched.thumb };
			if (
				enriched?.title &&
				(it.title.startsWith('Post @') || it.title.startsWith('Reel @'))
			) {
				collected[i] = { ...collected[i], title: String(enriched.title).slice(0, 120) };
			}
		}
	}

	// Cache thumbs locally
	for (let i = 0; i < collected.length; i++) {
		const it = collected[i];
		if (!it.thumbnailUrl) continue;
		const code = it.id.replace(/^ig-/, '');
		const local = await cacheRemoteImage(it.thumbnailUrl, UPLOADS_IG, `${code}.jpg`);
		if (local) collected[i] = { ...it, thumbnailUrl: local };
	}

	let live: SocialFeedLiveState['instagram'] = { isLive: false };
	if (config.content.live && config.showLiveBadge) {
		const liveSignal =
			/"is_live_broadcast"\s*:\s*true|"broadcast_status"\s*:\s*"LIVE"/i.test(html) ||
			/instagram\.com\/[^/]+\/live\//i.test(html);
		if (liveSignal) {
			live = {
				isLive: true,
				url: pageUrl,
				title: `@${username} sedang live`,
			};
			pushUnique([
				{
					id: `ig-live-${username}`,
					platform: 'instagram',
					title: live.title!,
					url: pageUrl,
					thumbnailUrl: collected[0]?.thumbnailUrl || '',
					isLive: true,
					kind: 'live',
				},
			]);
		}
	}

	let filtered = filterInstagramItems(collected, config.content);
	filtered.sort((a, b) => {
		if (a.isLive && !b.isLive) return -1;
		if (!a.isLive && b.isLive) return 1;
		const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
		const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
		return tb - ta;
	});
	filtered = filtered.slice(0, config.maxItems);

	if (!filtered.length) {
		throw new Error(
			'Tidak menemukan post/reel Instagram. Isi "URL manual" di Settings, atau set INSTAGRAM_SESSION_ID di server (sessionid cookie akun publik).',
		);
	}

	return { items: filtered, live };
}

export type SocialSyncResult = {
	ok: boolean;
	cache: SocialFeedCache;
	error?: string;
};

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

export function publicSocialFeedPayload(config: SocialFeedConfig, cache: SocialFeedCache) {
	const cfg = normalizeSocialFeedConfig(config);
	const ytItems = cfg.youtube.enabled
		? filterYoutubeItems(cache.youtube || [], cfg.youtube.content).slice(0, cfg.youtube.maxItems)
		: [];
	const igItems = cfg.instagram.enabled
		? filterInstagramItems(cache.instagram || [], cfg.instagram.content).slice(
				0,
				cfg.instagram.maxItems,
			)
		: [];
	return {
		config: {
			youtube: {
				enabled: cfg.youtube.enabled,
				profileOrChannelUrl: cfg.youtube.profileOrChannelUrl,
				maxItems: cfg.youtube.maxItems,
				showLiveBadge: cfg.youtube.showLiveBadge,
				showFeaturedEmbed: !!cfg.youtube.showFeaturedEmbed,
				content: cfg.youtube.content,
			},
			instagram: {
				enabled: cfg.instagram.enabled,
				profileOrChannelUrl: cfg.instagram.profileOrChannelUrl,
				maxItems: cfg.instagram.maxItems,
				showLiveBadge: cfg.instagram.showLiveBadge,
				content: cfg.instagram.content,
			},
		},
		youtube: ytItems,
		instagram: igItems,
		live: {
			youtube:
				cfg.youtube.enabled && cfg.youtube.showLiveBadge && cfg.youtube.content.live
					? cache.live?.youtube
					: undefined,
			instagram:
				cfg.instagram.enabled && cfg.instagram.showLiveBadge && cfg.instagram.content.live
					? cache.live?.instagram
					: undefined,
		},
		syncedAt: cache.syncedAt || null,
	};
}
