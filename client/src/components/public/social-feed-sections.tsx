import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Instagram, Youtube } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
	SocialContentKind,
	SocialFeedItem,
	SocialFeedLiveState,
	InstagramContentFilters,
	YoutubeContentFilters,
} from '@shared/social-feed';

type PublicSocialFeed = {
	config: {
		youtube: {
			enabled: boolean;
			profileOrChannelUrl: string;
			maxItems: number;
			showLiveBadge: boolean;
			showFeaturedEmbed?: boolean;
			content?: YoutubeContentFilters;
		};
		instagram: {
			enabled: boolean;
			profileOrChannelUrl: string;
			maxItems: number;
			showLiveBadge: boolean;
			content?: InstagramContentFilters;
		};
	};
	youtube: SocialFeedItem[];
	instagram: SocialFeedItem[];
	live: SocialFeedLiveState;
	syncedAt: string | null;
};

type FilterKey = 'all' | SocialContentKind;

function extractYoutubeVideoId(url: string): string | null {
	try {
		const u = new URL(url);
		if (u.hostname.includes('youtu.be')) {
			return u.pathname.replace(/^\//, '').split('/')[0] || null;
		}
		const v = u.searchParams.get('v');
		if (v) return v;
		const m = u.pathname.match(/\/(?:live|shorts|embed)\/([^/?]+)/);
		return m?.[1] || null;
	} catch {
		return null;
	}
}

function resolveKind(item: SocialFeedItem, platform: 'youtube' | 'instagram'): SocialContentKind {
	if (item.kind) return item.kind;
	if (item.isLive) return 'live';
	if (platform === 'youtube') {
		return item.url.includes('/shorts/') ? 'short' : 'video';
	}
	if (item.url.includes('/stories/')) return 'story';
	if (item.url.includes('/reel')) return 'reel';
	return 'post';
}

function kindLabel(kind: SocialContentKind): string {
	switch (kind) {
		case 'short':
			return 'Shorts';
		case 'video':
			return 'Video';
		case 'live':
			return 'Live';
		case 'reel':
			return 'Reel';
		case 'story':
			return 'Story';
		case 'post':
			return 'Post';
		default:
			return kind;
	}
}

function FeedCard({
	item,
	platform,
	showLiveBadge,
}: {
	item: SocialFeedItem;
	platform: 'youtube' | 'instagram';
	showLiveBadge: boolean;
}) {
	const kind = resolveKind(item, platform);
	const isLive = showLiveBadge && (!!item.isLive || kind === 'live');
	return (
		<a
			href={item.url}
			target="_blank"
			rel="noopener noreferrer"
			className="group relative block overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border/60 transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
			<div className="aspect-video overflow-hidden bg-muted">
				{item.thumbnailUrl ? (
					<img
						src={item.thumbnailUrl}
						alt=""
						loading="lazy"
						className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
					/>
				) : (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						{platform === 'youtube' ? (
							<Youtube className="h-8 w-8 opacity-50" />
						) : (
							<Instagram className="h-8 w-8 opacity-50" />
						)}
					</div>
				)}
			</div>
			<div className="absolute left-2 top-2 flex flex-wrap gap-1">
				<span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
					{kindLabel(kind)}
				</span>
				{isLive && (
					<span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white animate-pulse motion-reduce:animate-none">
						LIVE
					</span>
				)}
			</div>
			<div className="p-3">
				<p className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary">
					{item.title || (platform === 'youtube' ? 'Video YouTube' : 'Post Instagram')}
				</p>
				<span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
					Buka <ExternalLink className="h-3 w-3" />
				</span>
			</div>
		</a>
	);
}

function SocialPlatformSection({
	platform,
	title,
	items,
	profileUrl,
	enabled,
	showLiveBadge,
	live,
	showFeaturedEmbed,
	content,
}: {
	platform: 'youtube' | 'instagram';
	title: string;
	items: SocialFeedItem[];
	profileUrl: string;
	enabled: boolean;
	showLiveBadge: boolean;
	live?: { isLive?: boolean; url?: string; title?: string; thumbnailUrl?: string };
	showFeaturedEmbed?: boolean;
	content?: YoutubeContentFilters | InstagramContentFilters;
}) {
	const [filter, setFilter] = useState<FilterKey>('all');

	const liveItem: SocialFeedItem | null =
		enabled && showLiveBadge && live?.isLive && live.url
			? {
					id: `${platform}-live`,
					platform,
					title: live.title || (platform === 'youtube' ? 'Sedang live' : 'Instagram Live'),
					url: live.url,
					thumbnailUrl: live.thumbnailUrl || items[0]?.thumbnailUrl || '',
					isLive: true,
					kind: 'live',
				}
			: null;

	const ordered = useMemo(() => {
		const list = [...items];
		if (!liveItem) return list;
		const withoutDup = list.filter((i) => i.url !== liveItem.url && !i.isLive);
		return [liveItem, ...withoutDup];
	}, [items, liveItem]);

	const filterOptions: { key: FilterKey; label: string }[] = useMemo(() => {
		const opts: { key: FilterKey; label: string }[] = [{ key: 'all', label: 'Semua' }];
		if (platform === 'youtube') {
			const c = content as YoutubeContentFilters | undefined;
			if (!c || c.videos) opts.push({ key: 'video', label: 'Video' });
			if (!c || c.shorts) opts.push({ key: 'short', label: 'Shorts' });
			if (!c || c.live) opts.push({ key: 'live', label: 'Live' });
		} else {
			const c = content as InstagramContentFilters | undefined;
			if (!c || c.posts) opts.push({ key: 'post', label: 'Post' });
			if (!c || c.reels) opts.push({ key: 'reel', label: 'Reels' });
			if (c?.stories) opts.push({ key: 'story', label: 'Story' });
			if (!c || c.live) opts.push({ key: 'live', label: 'Live' });
		}
		return opts;
	}, [platform, content]);

	const visible = useMemo(() => {
		if (filter === 'all') return ordered;
		return ordered.filter((it) => resolveKind(it, platform) === filter);
	}, [ordered, filter, platform]);

	if (!enabled) return null;

	const featuredId =
		platform === 'youtube' &&
		showFeaturedEmbed &&
		(liveItem?.url || (showFeaturedEmbed && visible[0]?.url))
			? extractYoutubeVideoId(liveItem?.url || visible[0].url)
			: null;

	const Icon = platform === 'youtube' ? Youtube : Instagram;

	return (
		<section
			id={platform}
			className="scroll-mt-20 py-14 md:py-16"
			data-aos="fade-up">
			<div className="mx-auto max-w-6xl px-4">
				<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<span className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
							<Icon className="h-4 w-4" />
							{platform === 'youtube' ? 'YouTube' : 'Instagram'}
						</span>
						<h2 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
						<p className="mt-1 max-w-xl text-sm text-muted-foreground">
							Konten terbaru dari akun resmi — filter Video/Shorts/Reels/Live sesuai platform.
						</p>
					</div>
					{profileUrl ? (
						<a
							href={profileUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
							Buka profil resmi <ExternalLink className="h-3.5 w-3.5" />
						</a>
					) : null}
				</div>

				{filterOptions.length > 2 ? (
					<div className="mb-5 flex flex-wrap gap-2">
						{filterOptions.map((opt) => (
							<button
								key={opt.key}
								type="button"
								onClick={() => setFilter(opt.key)}
								className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
									filter === opt.key
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground hover:text-foreground'
								}`}>
								{opt.label}
							</button>
						))}
					</div>
				) : null}

				{featuredId && filter !== 'short' ? (
					<div className="mb-6 overflow-hidden rounded-xl ring-1 ring-border/60">
						<div className="aspect-video bg-black">
							<iframe
								title={liveItem?.title || 'YouTube'}
								src={`https://www.youtube-nocookie.com/embed/${featuredId}`}
								className="h-full w-full"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
								allowFullScreen
								loading="lazy"
							/>
						</div>
					</div>
				) : null}

				{visible.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
						<p className="text-sm text-muted-foreground">
							Belum ada konten untuk filter ini. Coba filter lain atau buka profil resmi.
						</p>
						{profileUrl ? (
							<a
								href={profileUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
								Buka {platform === 'youtube' ? 'YouTube' : 'Instagram'} resmi{' '}
								<ExternalLink className="h-3.5 w-3.5" />
							</a>
						) : null}
					</div>
				) : (
					<div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
						{visible.map((item) => (
							<FeedCard
								key={item.id || item.url}
								item={item}
								platform={platform}
								showLiveBadge={showLiveBadge}
							/>
						))}
					</div>
				)}
			</div>
		</section>
	);
}

export function YoutubeHomeSection() {
	const { data } = useQuery<PublicSocialFeed>({
		queryKey: ['/api/social-feed'],
		queryFn: async () => {
			const r = await fetch('/api/social-feed', { credentials: 'include' });
			if (!r.ok) throw new Error('social-feed');
			const json = await r.json();
			return json.data || json;
		},
		staleTime: 5 * 60 * 1000,
	});

	if (!data?.config?.youtube?.enabled) return null;

	return (
		<SocialPlatformSection
			platform="youtube"
			title="Kanal YouTube"
			items={data.youtube || []}
			profileUrl={data.config.youtube.profileOrChannelUrl}
			enabled={data.config.youtube.enabled}
			showLiveBadge={data.config.youtube.showLiveBadge}
			live={data.live?.youtube}
			showFeaturedEmbed={
				!!data.config.youtube.showFeaturedEmbed || !!data.live?.youtube?.isLive
			}
			content={data.config.youtube.content}
		/>
	);
}

export function InstagramHomeSection() {
	const { data } = useQuery<PublicSocialFeed>({
		queryKey: ['/api/social-feed'],
		queryFn: async () => {
			const r = await fetch('/api/social-feed', { credentials: 'include' });
			if (!r.ok) throw new Error('social-feed');
			const json = await r.json();
			return json.data || json;
		},
		staleTime: 5 * 60 * 1000,
	});

	if (!data?.config?.instagram?.enabled) return null;

	return (
		<SocialPlatformSection
			platform="instagram"
			title="Instagram"
			items={data.instagram || []}
			profileUrl={data.config.instagram.profileOrChannelUrl}
			enabled={data.config.instagram.enabled}
			showLiveBadge={data.config.instagram.showLiveBadge}
			live={data.live?.instagram}
			content={data.config.instagram.content}
		/>
	);
}
