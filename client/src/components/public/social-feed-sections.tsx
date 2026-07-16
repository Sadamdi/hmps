import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Instagram, Youtube } from 'lucide-react';
import type { SocialFeedItem, SocialFeedLiveState } from '@shared/social-feed';

type PublicSocialFeed = {
	config: {
		youtube: {
			enabled: boolean;
			profileOrChannelUrl: string;
			maxItems: number;
			showLiveBadge: boolean;
			showFeaturedEmbed?: boolean;
		};
		instagram: {
			enabled: boolean;
			profileOrChannelUrl: string;
			maxItems: number;
			showLiveBadge: boolean;
		};
	};
	youtube: SocialFeedItem[];
	instagram: SocialFeedItem[];
	live: SocialFeedLiveState;
	syncedAt: string | null;
};

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

function FeedCard({
	item,
	platform,
	showLiveBadge,
}: {
	item: SocialFeedItem;
	platform: 'youtube' | 'instagram';
	showLiveBadge: boolean;
}) {
	const isLive = showLiveBadge && !!item.isLive;
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
					{platform === 'youtube' ? 'YouTube' : 'Instagram'}
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
}: {
	platform: 'youtube' | 'instagram';
	title: string;
	items: SocialFeedItem[];
	profileUrl: string;
	enabled: boolean;
	showLiveBadge: boolean;
	live?: { isLive?: boolean; url?: string; title?: string; thumbnailUrl?: string };
	showFeaturedEmbed?: boolean;
}) {
	if (!enabled) return null;

	const liveItem: SocialFeedItem | null =
		showLiveBadge && live?.isLive && live.url
			? {
					id: `${platform}-live`,
					platform,
					title: live.title || (platform === 'youtube' ? 'Sedang live' : 'Instagram Live'),
					url: live.url,
					thumbnailUrl: live.thumbnailUrl || items[0]?.thumbnailUrl || '',
					isLive: true,
				}
			: null;

	const ordered = (() => {
		const list = [...items];
		if (!liveItem) return list;
		const withoutDup = list.filter((i) => i.url !== liveItem.url && !i.isLive);
		return [liveItem, ...withoutDup];
	})();

	const featuredId =
		platform === 'youtube' &&
		showFeaturedEmbed &&
		(liveItem?.url || (showFeaturedEmbed && ordered[0]?.url))
			? extractYoutubeVideoId(liveItem?.url || ordered[0].url)
			: null;

	const Icon = platform === 'youtube' ? Youtube : Instagram;

	return (
		<section
			id={platform}
			className="scroll-mt-20 py-14 md:py-16"
			data-aos="fade-up">
			<div className="mx-auto max-w-6xl px-4">
				<div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<span className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
							<Icon className="h-4 w-4" />
							{platform === 'youtube' ? 'YouTube' : 'Instagram'}
						</span>
						<h2 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
						<p className="mt-1 max-w-xl text-sm text-muted-foreground">
							Konten terbaru dari akun resmi — klik untuk membuka di{' '}
							{platform === 'youtube' ? 'YouTube' : 'Instagram'}.
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

				{featuredId ? (
					<div className="mb-6 overflow-hidden rounded-xl ring-1 ring-border/60">
						<div className="aspect-video bg-black">
							<iframe
								title={liveItem?.title || 'YouTube'}
								src={`https://www.youtube-nocookie.com/embed/${featuredId}${liveItem ? '?autoplay=0' : ''}`}
								className="h-full w-full"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
								allowFullScreen
								loading="lazy"
							/>
						</div>
					</div>
				) : null}

				{ordered.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
						<p className="text-sm text-muted-foreground">
							Belum ada konten tersimpan. Kunjungi akun resmi kami.
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
						{ordered.map((item) => (
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
		/>
	);
}
