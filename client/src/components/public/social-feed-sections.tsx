import { PublicSectionHeader } from '@/components/public/section-header';
import {
	extractYoutubeVideoId,
	InstagramTile,
	kindOf,
	SocialTabs,
	YoutubeCard,
	YT_KIND_LABEL,
} from '@/components/public/social/social-cards';
import { Button } from '@/components/ui/button';
import { usePublicBrand } from '@/hooks/use-public-brand';
import { useQuery } from '@tanstack/react-query';
import type { SocialFeedItem, SocialFeedLiveState } from '@shared/social-feed';
import { ArrowRight, Clapperboard, ExternalLink, Grid3x3, Instagram, Youtube } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

type Counts = Record<string, number> & { all: number };

export type PublicSocialFeed = {
	config: {
		youtube: {
			enabled: boolean;
			profileOrChannelUrl: string;
			showLiveBadge: boolean;
			showFeaturedEmbed?: boolean;
			homeLimit?: number;
			loadMoreStep?: number;
		};
		instagram: {
			enabled: boolean;
			profileOrChannelUrl: string;
			username?: string | null;
			homeLimit?: number;
			loadMoreStep?: number;
		};
	};
	youtube: SocialFeedItem[];
	instagram: SocialFeedItem[];
	youtubeByKind?: Record<string, SocialFeedItem[]>;
	instagramByKind?: Record<string, SocialFeedItem[]>;
	counts?: { youtube: Counts; instagram: Counts };
	live: SocialFeedLiveState;
	syncedAt: string | null;
};

export function useSocialFeed() {
	return useQuery<PublicSocialFeed>({
		queryKey: ['/api/social-feed'],
		queryFn: async () => {
			const r = await fetch('/api/social-feed', { credentials: 'include' });
			if (!r.ok) throw new Error('social-feed');
			const json = await r.json();
			return json.data || json;
		},
		staleTime: 5 * 60 * 1000,
	});
}

/** Fallback bila respons API versi lama (tanpa *ByKind / counts). */
function byKind(data: PublicSocialFeed | undefined, platform: 'youtube' | 'instagram', kind: string): SocialFeedItem[] {
	const grouped = platform === 'youtube' ? data?.youtubeByKind : data?.instagramByKind;
	if (grouped?.[kind]) return grouped[kind];
	return (data?.[platform] || []).filter((it) => kindOf(it) === kind);
}

function countsOf(data: PublicSocialFeed | undefined, platform: 'youtube' | 'instagram'): Counts {
	const c = data?.counts?.[platform];
	if (c) return c;
	const out: Counts = { all: (data?.[platform] || []).length };
	for (const it of data?.[platform] || []) {
		const k = kindOf(it);
		out[k] = (out[k] ?? 0) + 1;
	}
	return out;
}

function igUsernameFromUrl(url: string): string | null {
	try {
		const first = new URL(url).pathname.split('/').filter(Boolean)[0];
		return first && !['p', 'reel', 'reels'].includes(first) ? first.replace(/^@/, '') : null;
	} catch {
		return null;
	}
}

/** Tombol "Lebih banyak" (sekali, sampai homeLimit + loadMoreStep) lalu "Lihat semua". */
function MoreControls({
	canExpand,
	onExpand,
	allHref,
	allLabel,
}: {
	canExpand: boolean;
	onExpand: () => void;
	allHref: string;
	allLabel: string;
}) {
	return (
		<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
			{canExpand && (
				<Button type="button" variant="outline" onClick={onExpand}>
					Lebih banyak
				</Button>
			)}
			<Link href={allHref}>
				<Button variant="ghost" className="text-primary hover:bg-primary/10">
					{allLabel} <ArrowRight className="ml-1 h-4 w-4" />
				</Button>
			</Link>
		</div>
	);
}

// ============================ YouTube ============================

type YtTab = 'all' | 'video' | 'short' | 'live';

export function YoutubeHomeSection() {
	const { data } = useSocialFeed();
	const [tab, setTab] = useState<YtTab>('all');
	const [expanded, setExpanded] = useState(false);

	const cfg = data?.config?.youtube;
	if (!cfg?.enabled) return null;

	const homeLimit = cfg.homeLimit ?? 8;
	const step = cfg.loadMoreStep ?? 8;
	const counts = countsOf(data, 'youtube');
	const pool: SocialFeedItem[] = tab === 'all' ? data?.youtube || [] : byKind(data, 'youtube', tab);
	const shown = pool.slice(0, expanded ? homeLimit + step : homeLimit);
	const total = tab === 'all' ? counts?.all ?? pool.length : counts?.[tab] ?? pool.length;
	const canExpand = !expanded && pool.length > homeLimit;

	const tabs = (['all', 'video', 'short', 'live'] as YtTab[])
		.filter((k) => k === 'all' || (counts?.[k] ?? 0) > 0)
		.map((k) => ({ key: k, label: YT_KIND_LABEL[k], count: k === 'all' ? counts?.all : counts?.[k] }));

	const live = data?.live?.youtube;
	const featured = live?.isLive && live.url ? live.url : cfg.showFeaturedEmbed && tab !== 'short' ? shown[0]?.url : null;
	const featuredId = featured ? extractYoutubeVideoId(featured) : null;
	const gridItems = featuredId && !live?.isLive ? shown.slice(1) : shown;

	return (
		<section id="youtube" className="scroll-mt-20 py-14 md:py-16">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<PublicSectionHeader
					eyebrow="YouTube"
					icon={<Youtube />}
					title="Kanal YouTube"
					description="Video, siaran langsung, dan Shorts terbaru dari kanal resmi."
					actions={
						cfg.profileOrChannelUrl ? (
							<a
								href={cfg.profileOrChannelUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
								Buka kanal resmi <ExternalLink className="h-3.5 w-3.5" />
							</a>
						) : null
					}
				/>

				{tabs.length > 2 && (
					<SocialTabs
						label="Kategori YouTube"
						tabs={tabs}
						active={tab}
						onChange={(k) => {
							setTab(k);
							setExpanded(false);
						}}
						className="mb-6"
					/>
				)}

				{shown.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
						Belum ada konten untuk kategori ini.
					</div>
				) : (
					<>
						{featuredId && (
							<div className="mb-6 overflow-hidden rounded-xl border border-border/70 bg-black">
								<div className="aspect-video">
									<iframe
										title={live?.isLive ? live.title || 'Live' : shown[0]?.title || 'YouTube'}
										src={`https://www.youtube-nocookie.com/embed/${featuredId}`}
										className="h-full w-full"
										allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
										allowFullScreen
										loading="lazy"
									/>
								</div>
							</div>
						)}
						<div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
							{gridItems.map((item) => (
								<YoutubeCard key={item.id} item={item} />
							))}
						</div>
						<MoreControls
							canExpand={canExpand}
							onExpand={() => setExpanded(true)}
							allHref={tab === 'all' ? '/media/youtube' : `/media/youtube?kind=${tab}`}
							allLabel={`Lihat semua${total ? ` (${total})` : ''}`}
						/>
					</>
				)}
			</div>
		</section>
	);
}

// ============================ Instagram ============================

type IgTab = 'post' | 'reel';

/** Header profil ala aplikasi Instagram di HP: avatar ber-ring, handle, hitungan, tombol ikuti. */
export function InstagramProfileHeader({
	username,
	profileUrl,
	counts,
}: {
	username: string | null | undefined;
	profileUrl: string;
	counts?: Counts;
}) {
	const { siteName } = usePublicBrand();
	return (
		<div className="flex items-center gap-4 sm:gap-6">
			<span className="shrink-0 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2.5px]">
				<span className="flex h-16 w-16 items-center justify-center rounded-full bg-background sm:h-20 sm:w-20">
					<Instagram className="h-7 w-7 text-foreground sm:h-8 sm:w-8" />
				</span>
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-base font-semibold text-foreground sm:text-lg">@{username || 'instagram'}</p>
				<p className="truncate text-sm text-muted-foreground">{siteName}</p>
				<dl className="mt-2 flex gap-5 text-sm">
					<div className="flex items-baseline gap-1">
						<dd className="font-mono font-semibold tabular-nums text-foreground">{counts?.post ?? 0}</dd>
						<dt className="text-muted-foreground">post</dt>
					</div>
					<div className="flex items-baseline gap-1">
						<dd className="font-mono font-semibold tabular-nums text-foreground">{counts?.reel ?? 0}</dd>
						<dt className="text-muted-foreground">reels</dt>
					</div>
				</dl>
			</div>
			<a
				href={profileUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="hidden shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex">
				Ikuti <ExternalLink className="h-3.5 w-3.5" />
			</a>
		</div>
	);
}

export function InstagramHomeSection() {
	const { data } = useSocialFeed();
	const [tab, setTab] = useState<IgTab>('post');
	const [expanded, setExpanded] = useState(false);

	const cfg = data?.config?.instagram;
	if (!cfg?.enabled) return null;

	const homeLimit = cfg.homeLimit ?? 9;
	const step = cfg.loadMoreStep ?? 9;
	const counts = countsOf(data, 'instagram');
	// Bila salah satu jenis kosong, langsung buka jenis yang ada isinya
	const effectiveTab: IgTab =
		(counts?.[tab] ?? 0) === 0 && (counts?.[tab === 'post' ? 'reel' : 'post'] ?? 0) > 0
			? tab === 'post'
				? 'reel'
				: 'post'
			: tab;
	const pool = byKind(data, 'instagram', effectiveTab);
	const shown = pool.slice(0, expanded ? homeLimit + step : homeLimit);
	const canExpand = !expanded && pool.length > homeLimit;

	return (
		<section id="instagram" className="scroll-mt-20 py-14 md:py-16">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<PublicSectionHeader
					eyebrow="Instagram"
					icon={<Instagram />}
					title="Instagram"
					description="Post dan Reels terbaru dari akun resmi."
				/>

				<div className="mx-auto max-w-3xl">
					<div className="rounded-xl border border-border/70 bg-card p-4 sm:p-6">
						<InstagramProfileHeader username={cfg.username ?? igUsernameFromUrl(cfg.profileOrChannelUrl)} profileUrl={cfg.profileOrChannelUrl} counts={counts} />
						<a
							href={cfg.profileOrChannelUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:hidden">
							Ikuti di Instagram <ExternalLink className="h-3.5 w-3.5" />
						</a>
					</div>

					<div className="mt-4 grid grid-cols-2 border-b border-border/70" role="tablist" aria-label="Jenis konten Instagram">
						{(
							[
								{ key: 'post', label: 'Post', icon: <Grid3x3 className="h-4 w-4" /> },
								{ key: 'reel', label: 'Reels', icon: <Clapperboard className="h-4 w-4" /> },
							] as const
						).map((t) => {
							const on = effectiveTab === t.key;
							return (
								<button
									key={t.key}
									type="button"
									role="tab"
									aria-selected={on}
									onClick={() => {
										setTab(t.key);
										setExpanded(false);
									}}
									className={`relative flex items-center justify-center gap-2 py-3 font-mono text-xs uppercase tracking-wider transition-colors ${
										on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
									}`}>
									{t.icon}
									{t.label}
									<span
										aria-hidden
										className={`absolute inset-x-0 -bottom-px h-0.5 bg-foreground transition-transform duration-200 ${
											on ? 'scale-x-100' : 'scale-x-0'
										}`}
									/>
								</button>
							);
						})}
					</div>

					{shown.length === 0 ? (
						<div className="border-x border-b border-border/70 px-6 py-12 text-center text-sm text-muted-foreground">
							Belum ada {effectiveTab === 'post' ? 'post' : 'reels'} yang tersinkron.{' '}
							<a href={cfg.profileOrChannelUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
								Lihat di Instagram
							</a>
						</div>
					) : (
						<div className="mt-0.5 grid grid-cols-3 gap-0.5">
							{shown.map((item) => (
								<InstagramTile key={item.id} item={item} />
							))}
						</div>
					)}

					{shown.length > 0 && (
						<MoreControls
							canExpand={canExpand}
							onExpand={() => setExpanded(true)}
							allHref={`/media/instagram?kind=${effectiveTab}`}
							allLabel={`Lihat semua${counts?.all ? ` (${counts.all})` : ''}`}
						/>
					)}
				</div>
			</div>
		</section>
	);
}
