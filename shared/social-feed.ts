/** Public social feed config + cache shapes (YouTube / Instagram home sections). */

export type SocialContentKind =
	| 'video'
	| 'short'
	| 'live'
	| 'post'
	| 'reel'
	| 'story';

export type SocialFeedItem = {
	id: string;
	platform: 'youtube' | 'instagram';
	title: string;
	url: string;
	thumbnailUrl: string;
	publishedAt?: string;
	isLive?: boolean;
	/** Content flavour for filter UI */
	kind?: SocialContentKind;
};

export type YoutubeContentFilters = {
	/** Tab Videos channel (@handle/videos) */
	videos: boolean;
	/** Tab Shorts; jika tab kosong, fallback video berdurasi ≤60 dtk */
	shorts: boolean;
	/** Tab Live/Streams (arsip live) + badge live sekarang */
	live: boolean;
};

export type InstagramContentFilters = {
	/** Post feed (/p/) */
	posts: boolean;
	/** Reels (product_type clips / /reel/) */
	reels: boolean;
	/** Live broadcast (badge only when reliable) */
	live: boolean;
	/** Stories (best-effort; butuh INSTAGRAM_SESSION_ID) */
	stories: boolean;
};

export type SocialPlatformConfig = {
	enabled: boolean;
	profileOrChannelUrl: string;
	maxItems: number;
	showLiveBadge: boolean;
	showFeaturedEmbed?: boolean;
	/**
	 * Optional fallback / pinned post URLs (1 per line di UI).
	 * Dipakai jika scrape profil kosong / kena rate-limit.
	 */
	manualUrls?: string[];
};

export type SocialFeedConfig = {
	youtube: SocialPlatformConfig & { content: YoutubeContentFilters };
	instagram: SocialPlatformConfig & { content: InstagramContentFilters };
	syncIntervalHours: number;
};

export type SocialFeedLiveState = {
	youtube?: { isLive: boolean; url?: string; title?: string; thumbnailUrl?: string };
	instagram?: { isLive: boolean; url?: string; title?: string };
};

export type SocialFeedCache = {
	youtube: SocialFeedItem[];
	instagram: SocialFeedItem[];
	live: SocialFeedLiveState;
	syncedAt?: string;
	lastError?: string;
};

export const DEFAULT_YOUTUBE_CONTENT: YoutubeContentFilters = {
	videos: true,
	shorts: true,
	live: true,
};

export const DEFAULT_INSTAGRAM_CONTENT: InstagramContentFilters = {
	posts: true,
	reels: true,
	live: true,
	stories: false,
};

export const DEFAULT_SOCIAL_FEED_CONFIG: SocialFeedConfig = {
	youtube: {
		enabled: true,
		profileOrChannelUrl: 'https://www.youtube.com/@HimatifEncoder',
		maxItems: 4,
		showLiveBadge: true,
		showFeaturedEmbed: true,
		content: { ...DEFAULT_YOUTUBE_CONTENT },
	},
	instagram: {
		enabled: true,
		profileOrChannelUrl: 'https://www.instagram.com/himatif.encoder/',
		maxItems: 4,
		showLiveBadge: true,
		content: { ...DEFAULT_INSTAGRAM_CONTENT },
		manualUrls: [],
	},
	syncIntervalHours: 3,
};

export const DEFAULT_SOCIAL_FEED_CACHE: SocialFeedCache = {
	youtube: [],
	instagram: [],
	live: {},
};

export function clampSocialMaxItems(n: unknown): number {
	const v = parseInt(String(n), 10);
	if (!Number.isFinite(v)) return 4;
	return Math.min(5, Math.max(1, v));
}

export function normalizeSocialFeedConfig(raw?: Partial<SocialFeedConfig> | null): SocialFeedConfig {
	const base = DEFAULT_SOCIAL_FEED_CONFIG;
	const ytIn = raw?.youtube || {};
	const igIn = raw?.instagram || {};
	const yt = {
		...base.youtube,
		...ytIn,
		content: { ...base.youtube.content, ...(ytIn as any).content },
	};
	const ig = {
		...base.instagram,
		...igIn,
		content: { ...base.instagram.content, ...(igIn as any).content },
	};
	yt.maxItems = clampSocialMaxItems(yt.maxItems);
	ig.maxItems = clampSocialMaxItems(ig.maxItems);
	yt.profileOrChannelUrl = String(yt.profileOrChannelUrl || base.youtube.profileOrChannelUrl).trim();
	ig.profileOrChannelUrl = String(ig.profileOrChannelUrl || base.instagram.profileOrChannelUrl).trim();
	yt.manualUrls = normalizeManualUrls(
		Array.isArray((ytIn as any).manualUrls) && (ytIn as any).manualUrls.length
			? (ytIn as any).manualUrls
			: base.youtube.manualUrls,
	);
	ig.manualUrls = normalizeManualUrls(
		Array.isArray((igIn as any).manualUrls) && (igIn as any).manualUrls.length
			? (igIn as any).manualUrls
			: base.instagram.manualUrls,
	);
	const syncIntervalHours = Math.min(
		24,
		Math.max(1, Number(raw?.syncIntervalHours) || base.syncIntervalHours),
	);
	return { youtube: yt, instagram: ig, syncIntervalHours };
}

export function normalizeManualUrls(raw: unknown): string[] {
	const list = Array.isArray(raw)
		? raw
		: typeof raw === 'string'
			? raw.split(/\r?\n|,/)
			: [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const entry of list) {
		const u = String(entry || '').trim();
		if (!u || seen.has(u)) continue;
		seen.add(u);
		out.push(u);
		if (out.length >= 12) break;
	}
	return out;
}

export function filterYoutubeItems(
	items: SocialFeedItem[],
	content: YoutubeContentFilters,
): SocialFeedItem[] {
	return items.filter((it) => {
		const kind = it.kind || (it.isLive ? 'live' : it.url.includes('/shorts/') ? 'short' : 'video');
		if (kind === 'live') return content.live;
		if (kind === 'short') return content.shorts;
		return content.videos;
	});
}

export function filterInstagramItems(
	items: SocialFeedItem[],
	content: InstagramContentFilters,
): SocialFeedItem[] {
	return items.filter((it) => {
		const kind =
			it.kind ||
			(it.isLive ? 'live' : it.url.includes('/reel/') || it.url.includes('/reels/') ? 'reel' : 'post');
		if (kind === 'live') return content.live;
		if (kind === 'story') return content.stories;
		if (kind === 'reel') return content.reels;
		return content.posts;
	});
}

/**
 * Round-robin antar pool jenis konten supaya filter Video+Live+Shorts
 * tidak didominasi satu sumber (mis. RSS live VOD).
 */
export function mixSocialItemsByKind(
	pools: Partial<Record<SocialContentKind, SocialFeedItem[]>>,
	order: SocialContentKind[],
	maxItems: number,
): SocialFeedItem[] {
	const queues = order
		.map((kind) => ({ kind, items: [...(pools[kind] || [])] }))
		.filter((q) => q.items.length > 0);
	const out: SocialFeedItem[] = [];
	const seen = new Set<string>();
	while (out.length < maxItems && queues.some((q) => q.items.length)) {
		for (const q of queues) {
			if (out.length >= maxItems) break;
			while (q.items.length) {
				const next = q.items.shift()!;
				if (seen.has(next.id)) continue;
				seen.add(next.id);
				out.push(next);
				break;
			}
		}
	}
	return out;
}
