/** Public social feed config + cache shapes (YouTube / Instagram home sections). */

export type SocialFeedItem = {
	id: string;
	platform: 'youtube' | 'instagram';
	title: string;
	url: string;
	thumbnailUrl: string;
	publishedAt?: string;
	isLive?: boolean;
};

export type SocialPlatformConfig = {
	enabled: boolean;
	profileOrChannelUrl: string;
	maxItems: number;
	showLiveBadge: boolean;
	showFeaturedEmbed?: boolean;
};

export type SocialFeedConfig = {
	youtube: SocialPlatformConfig;
	instagram: SocialPlatformConfig;
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

export const DEFAULT_SOCIAL_FEED_CONFIG: SocialFeedConfig = {
	youtube: {
		enabled: true,
		profileOrChannelUrl: 'https://www.youtube.com/@HimatifEncoder',
		maxItems: 4,
		showLiveBadge: true,
		showFeaturedEmbed: true,
	},
	instagram: {
		enabled: true,
		profileOrChannelUrl: 'https://www.instagram.com/himatif.encoder/',
		maxItems: 4,
		showLiveBadge: true,
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
	const yt = { ...base.youtube, ...(raw?.youtube || {}) };
	const ig = { ...base.instagram, ...(raw?.instagram || {}) };
	yt.maxItems = clampSocialMaxItems(yt.maxItems);
	ig.maxItems = clampSocialMaxItems(ig.maxItems);
	yt.profileOrChannelUrl = String(yt.profileOrChannelUrl || base.youtube.profileOrChannelUrl).trim();
	ig.profileOrChannelUrl = String(ig.profileOrChannelUrl || base.instagram.profileOrChannelUrl).trim();
	const syncIntervalHours = Math.min(
		24,
		Math.max(1, Number(raw?.syncIntervalHours) || base.syncIntervalHours),
	);
	return { youtube: yt, instagram: ig, syncIntervalHours };
}
