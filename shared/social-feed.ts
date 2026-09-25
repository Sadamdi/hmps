/** Social feed (YouTube / Instagram) — config, cache, dan helper seleksi. Dipakai server + client. */

export type YoutubeKind = 'video' | 'short' | 'live';
export type InstagramKind = 'post' | 'reel';
/** `story` dipertahankan hanya agar cache lama tetap ter-parse; tidak lagi ditampilkan. */
export type SocialContentKind = YoutubeKind | InstagramKind | 'story';
export type SocialPlatform = 'youtube' | 'instagram';

export type SocialFeedItem = {
	id: string;
	platform: SocialPlatform;
	title: string;
	url: string;
	thumbnailUrl: string;
	/** ISO date — YouTube dari halaman watch, Instagram dari shortcode */
	publishedAt?: string;
	/** Pertama kali item terlihat oleh sync (fallback urutan) */
	firstSeenAt?: string;
	isLive?: boolean;
	kind?: SocialContentKind;
	/** Instagram: post berisi beberapa slide */
	isCarousel?: boolean;
	caption?: string;
	/** Instagram: di-pin di profil (tampil paling atas seperti di aplikasi) */
	pinned?: boolean;
	/** Urutan pin di profil (0 = paling atas) */
	pinnedRank?: number;
};

/** Profil akun/kanal untuk header feed (diambil saat sync, avatar di-cache lokal). */
export type SocialProfile = {
	username?: string;
	fullName?: string;
	biography?: string;
	avatarUrl?: string;
	followerCount?: number;
	followingCount?: number;
	/** Jumlah post total di akun (bukan jumlah yang tersimpan) */
	mediaCount?: number;
	isVerified?: boolean;
	externalUrl?: string;
	updatedAt?: string;
};

/** Item dianggap "baru" bila terbit dalam N hari terakhir. */
export const SOCIAL_NEW_DAYS = 7;
export function isNewSocialItem(it: SocialFeedItem, days = SOCIAL_NEW_DAYS, now = Date.now()): boolean {
	const t = Date.parse(it.publishedAt || '');
	return Number.isFinite(t) && now - t <= days * 86_400_000 && t <= now + 86_400_000;
}

export type YoutubeContentFilters = { videos: boolean; shorts: boolean; live: boolean };
export type InstagramContentFilters = {
	posts: boolean;
	reels: boolean;
	/** Tidak dipakai lagi (4.25.0) — hanya kompatibilitas config lama */
	live?: boolean;
	stories?: boolean;
};

type PlatformBase = {
	enabled: boolean;
	profileOrChannelUrl: string;
	showLiveBadge: boolean;
	/** Jumlah item yang tampil pertama di beranda (per tab) */
	homeLimit: number;
	/** Tambahan item saat klik "Lebih banyak" (beranda maks homeLimit + loadMoreStep) */
	loadMoreStep: number;
	/** Legacy (≤4.24): dulu batas tampil 1–5. Dibaca untuk kompatibilitas, tidak dipakai. */
	maxItems?: number;
};

export type YoutubeConfig = PlatformBase & {
	showFeaturedEmbed: boolean;
	content: YoutubeContentFilters;
	/** Jumlah item terbaru yang dicek per kategori pada sync harian (arsip lama tidak dibuang) */
	fetchLimits: Record<YoutubeKind, number>;
	manualUrls?: string[];
};

export type InstagramConfig = PlatformBase & {
	content: InstagramContentFilters;
	fetchLimits: Record<InstagramKind, number>;
	/** Link post/reel yang ditambahkan manual dari dashboard */
	manualUrls: string[];
};

export type SocialFeedConfig = {
	youtube: YoutubeConfig;
	instagram: InstagramConfig;
	syncIntervalHours: number;
};

export type SocialFeedLiveState = {
	youtube?: { isLive: boolean; url?: string; title?: string; thumbnailUrl?: string };
	instagram?: { isLive: boolean; url?: string; title?: string };
};

/** Status sync terakhir per platform (untuk dashboard). */
export type SocialPlatformSyncStatus = {
	at: string;
	ok: boolean;
	/** Sumber yang berhasil, mis. "innertube+watch", "embed", "manual" */
	method?: string;
	newCount?: number;
	total?: number;
	/** Instagram: daftar profil diblokir (butuh login / rate limit) */
	blocked?: boolean;
	error?: string;
	durationMs?: number;
};

export type SocialFeedCache = {
	youtube: SocialFeedItem[];
	instagram: SocialFeedItem[];
	live: SocialFeedLiveState;
	syncedAt?: string;
	lastError?: string;
	status?: Partial<Record<SocialPlatform, SocialPlatformSyncStatus>>;
	profiles?: Partial<Record<SocialPlatform, SocialProfile>>;
	/** Waktu backfill penuh terakhir (ambil semua isi akun) per platform */
	backfilledAt?: Partial<Record<SocialPlatform, string>>;
};

export type SocialFeedLogEntry = {
	id: string;
	platform: SocialPlatform;
	trigger: 'cron' | 'manual';
	startedAt: string;
	durationMs: number;
	ok: boolean;
	method?: string;
	newCount: number;
	total: number;
	byKind: Record<string, number>;
	blocked?: boolean;
	error?: string;
	triggeredBy?: string;
};

/** Log disimpan di dokumen Settings, dibatasi N terakhir. */
export const SOCIAL_FEED_LOG_LIMIT = 50;

export const YOUTUBE_KINDS: YoutubeKind[] = ['video', 'short', 'live'];
export const INSTAGRAM_KINDS: InstagramKind[] = ['post', 'reel'];

export const DEFAULT_YOUTUBE_URL = 'https://www.youtube.com/c/HimatifEncoder';
export const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/himatif.encoder/';

export const DEFAULT_SOCIAL_FEED_CONFIG: SocialFeedConfig = {
	youtube: {
		enabled: true,
		profileOrChannelUrl: DEFAULT_YOUTUBE_URL,
		showLiveBadge: true,
		showFeaturedEmbed: true,
		homeLimit: 8,
		loadMoreStep: 8,
		content: { videos: true, shorts: true, live: true },
		fetchLimits: { video: 10, short: 10, live: 5 },
		manualUrls: [],
	},
	instagram: {
		enabled: true,
		profileOrChannelUrl: DEFAULT_INSTAGRAM_URL,
		showLiveBadge: false,
		homeLimit: 9,
		loadMoreStep: 9,
		content: { posts: true, reels: true },
		fetchLimits: { post: 36, reel: 36 },
		manualUrls: [],
	},
	syncIntervalHours: 24,
};

export const DEFAULT_SOCIAL_FEED_CACHE: SocialFeedCache = {
	youtube: [],
	instagram: [],
	live: {},
};

const LIMITS = {
	ytFetch: { video: [1, 30], short: [1, 30], live: [1, 15] } as Record<YoutubeKind, [number, number]>,
	igFetch: [1, 60] as [number, number],
	ytHome: [4, 16] as [number, number],
	igHome: [3, 18] as [number, number],
};

export function clampInt(n: unknown, min: number, max: number, fallback: number): number {
	const v = parseInt(String(n), 10);
	if (!Number.isFinite(v)) return fallback;
	return Math.min(max, Math.max(min, v));
}

/** @deprecated dipertahankan untuk import lama. */
export function clampSocialMaxItems(n: unknown): number {
	return clampInt(n, 1, 5, 4);
}

export function normalizeManualUrls(raw: unknown, max = 200): string[] {
	const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n|,/) : [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const entry of list) {
		const u = String(entry || '').trim();
		if (!u || seen.has(u)) continue;
		seen.add(u);
		out.push(u);
		if (out.length >= max) break;
	}
	return out;
}

/** Terima config lama (≤4.24, dengan maxItems 1–5) maupun v2. Tidak pernah melempar. */
export function normalizeSocialFeedConfig(raw?: any): SocialFeedConfig {
	const base = DEFAULT_SOCIAL_FEED_CONFIG;
	const ytIn = (raw && typeof raw.youtube === 'object' && raw.youtube) || {};
	const igIn = (raw && typeof raw.instagram === 'object' && raw.instagram) || {};

	const ytFetchIn = ytIn.fetchLimits || {};
	const youtube: YoutubeConfig = {
		enabled: ytIn.enabled !== undefined ? !!ytIn.enabled : base.youtube.enabled,
		profileOrChannelUrl: String(ytIn.profileOrChannelUrl || base.youtube.profileOrChannelUrl).trim(),
		showLiveBadge: ytIn.showLiveBadge !== undefined ? !!ytIn.showLiveBadge : base.youtube.showLiveBadge,
		showFeaturedEmbed:
			ytIn.showFeaturedEmbed !== undefined ? !!ytIn.showFeaturedEmbed : base.youtube.showFeaturedEmbed,
		homeLimit: clampInt(ytIn.homeLimit, ...LIMITS.ytHome, base.youtube.homeLimit),
		loadMoreStep: clampInt(ytIn.loadMoreStep, ...LIMITS.ytHome, base.youtube.loadMoreStep),
		content: {
			videos: ytIn.content?.videos !== undefined ? !!ytIn.content.videos : true,
			shorts: ytIn.content?.shorts !== undefined ? !!ytIn.content.shorts : true,
			live: ytIn.content?.live !== undefined ? !!ytIn.content.live : true,
		},
		fetchLimits: {
			video: clampInt(ytFetchIn.video, ...LIMITS.ytFetch.video, base.youtube.fetchLimits.video),
			short: clampInt(ytFetchIn.short, ...LIMITS.ytFetch.short, base.youtube.fetchLimits.short),
			live: clampInt(ytFetchIn.live, ...LIMITS.ytFetch.live, base.youtube.fetchLimits.live),
		},
		manualUrls: normalizeManualUrls(ytIn.manualUrls, 50),
	};

	const igFetchIn = igIn.fetchLimits || {};
	const instagram: InstagramConfig = {
		enabled: igIn.enabled !== undefined ? !!igIn.enabled : base.instagram.enabled,
		profileOrChannelUrl: String(igIn.profileOrChannelUrl || base.instagram.profileOrChannelUrl).trim(),
		showLiveBadge: false,
		homeLimit: clampInt(igIn.homeLimit, ...LIMITS.igHome, base.instagram.homeLimit),
		loadMoreStep: clampInt(igIn.loadMoreStep, ...LIMITS.igHome, base.instagram.loadMoreStep),
		content: {
			posts: igIn.content?.posts !== undefined ? !!igIn.content.posts : true,
			reels: igIn.content?.reels !== undefined ? !!igIn.content.reels : true,
		},
		fetchLimits: {
			post: clampInt(igFetchIn.post, ...LIMITS.igFetch, base.instagram.fetchLimits.post),
			reel: clampInt(igFetchIn.reel, ...LIMITS.igFetch, base.instagram.fetchLimits.reel),
		},
		manualUrls: normalizeManualUrls(igIn.manualUrls, 200),
	};

	const syncIntervalHours = clampInt(raw?.syncIntervalHours, 1, 168, base.syncIntervalHours);
	return { youtube, instagram, syncIntervalHours };
}

/** Jenis item dengan fallback dari URL (cache lama bisa tanpa `kind`). */
export function itemKind(it: SocialFeedItem): SocialContentKind {
	if (it.kind) return it.kind;
	if (it.platform === 'youtube') return it.isLive ? 'live' : it.url.includes('/shorts/') ? 'short' : 'video';
	return /\/reels?\//.test(it.url) ? 'reel' : 'post';
}

function itemTime(it: SocialFeedItem): number {
	const t = Date.parse(it.publishedAt || it.firstSeenAt || '');
	return Number.isFinite(t) ? t : 0;
}

/** Urutan seperti di aplikasi: live-sekarang → pinned (urutan pin) → terbaru. */
export function sortSocialItems(items: SocialFeedItem[]): SocialFeedItem[] {
	return [...items].sort((a, b) => {
		if (!!b.isLive !== !!a.isLive) return b.isLive ? 1 : -1;
		if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
		if (a.pinned && b.pinned) return (a.pinnedRank ?? 0) - (b.pinnedRank ?? 0);
		return itemTime(b) - itemTime(a);
	});
}

export function dedupeSocialItems(items: SocialFeedItem[]): SocialFeedItem[] {
	const seen = new Set<string>();
	const out: SocialFeedItem[] = [];
	for (const it of items) {
		const key = it.id.replace(/^yt-live-/, 'yt-');
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(it);
	}
	return out;
}

/** Item yang boleh tampil publik sesuai filter konten + platform aktif. */
export function visibleSocialItems(config: SocialFeedConfig, platform: SocialPlatform, cache: SocialFeedCache) {
	if (platform === 'youtube') {
		if (!config.youtube.enabled) return [];
		const c = config.youtube.content;
		return sortSocialItems(
			dedupeSocialItems(cache.youtube || []).filter((it) => {
				const k = itemKind(it);
				return k === 'live' ? c.live : k === 'short' ? c.shorts : k === 'video' ? c.videos : false;
			}),
		);
	}
	if (!config.instagram.enabled) return [];
	const c = config.instagram.content;
	return sortSocialItems(
		dedupeSocialItems(cache.instagram || []).filter((it) => {
			const k = itemKind(it);
			return k === 'reel' ? c.reels : k === 'post' ? c.posts : false;
		}),
	);
}

export function countByKind(items: SocialFeedItem[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const it of items) {
		const k = itemKind(it);
		out[k] = (out[k] ?? 0) + 1;
	}
	return out;
}

export function selectSocialItems(
	items: SocialFeedItem[],
	kind: SocialContentKind | 'all',
	offset: number,
	limit: number,
): SocialFeedItem[] {
	const pool = kind === 'all' ? items : items.filter((it) => itemKind(it) === kind);
	return pool.slice(offset, offset + limit);
}

/**
 * Waktu posting Instagram dari shortcode: shortcode → media id (base64 IG),
 * `id >> 23` = milidetik sejak epoch Instagram.
 */
const IG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const IG_EPOCH_MS = 1314220021721;
export function instagramShortcodeToDate(code: string): string | undefined {
	if (!/^[A-Za-z0-9_-]{6,14}$/.test(code)) return undefined;
	try {
		let n = BigInt(0);
		const base = BigInt(64);
		for (const ch of code) n = n * base + BigInt(IG_ALPHABET.indexOf(ch));
		const ms = Number(n >> BigInt(23)) + IG_EPOCH_MS;
		const d = new Date(ms);
		const year = d.getUTCFullYear();
		if (year < 2011 || year > 2100) return undefined;
		return d.toISOString();
	} catch {
		return undefined;
	}
}
