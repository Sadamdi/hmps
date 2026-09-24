import { cn } from '@/lib/utils';
import type { SocialContentKind, SocialFeedItem } from '@shared/social-feed';
import { Clapperboard, GalleryHorizontalEnd, Play, Radio, Youtube } from 'lucide-react';

export const YT_KIND_LABEL: Record<string, string> = { all: 'Semua', video: 'Video', short: 'Shorts', live: 'Live' };
export const IG_KIND_LABEL: Record<string, string> = { all: 'Semua', post: 'Post', reel: 'Reels' };

export function kindOf(item: SocialFeedItem): SocialContentKind {
	if (item.kind) return item.kind;
	if (item.platform === 'youtube') return item.isLive ? 'live' : item.url.includes('/shorts/') ? 'short' : 'video';
	return /\/reels?\//.test(item.url) ? 'reel' : 'post';
}

export function formatSocialDate(iso?: string): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function extractYoutubeVideoId(url: string): string | null {
	try {
		const u = new URL(url);
		if (u.hostname.includes('youtu.be')) return u.pathname.replace(/^\//, '').split('/')[0] || null;
		const v = u.searchParams.get('v');
		if (v) return v;
		return u.pathname.match(/\/(?:live|shorts|embed)\/([^/?]+)/)?.[1] || null;
	} catch {
		return null;
	}
}

/** Kartu YouTube 16:9 — bahasa kartu sama dengan halaman arsip (border hairline, tanpa shadow tebal). */
export function YoutubeCard({ item, className }: { item: SocialFeedItem; className?: string }) {
	const kind = kindOf(item);
	const date = formatSocialDate(item.publishedAt);
	return (
		<a
			href={item.url}
			target="_blank"
			rel="noopener noreferrer"
			className={cn(
				'archive-card group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
				className,
			)}>
			<div className="archive-card-media relative aspect-video overflow-hidden bg-muted">
				{item.thumbnailUrl ? (
					<img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
				) : (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<Youtube className="h-8 w-8 opacity-50" />
					</div>
				)}
				<span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
					{item.isLive ? (
						<>
							<Radio className="h-3 w-3 text-red-400 motion-safe:animate-pulse" /> Live
						</>
					) : (
						YT_KIND_LABEL[kind] || kind
					)}
				</span>
				<span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
					<span className="rounded-full bg-black/60 p-3 text-white">
						<Play className="h-5 w-5 fill-current" />
					</span>
				</span>
			</div>
			<div className="flex flex-1 flex-col p-3 sm:p-4">
				{date && (
					<time dateTime={item.publishedAt} className="archive-meta">
						{date}
					</time>
				)}
				<h3 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-sm">
					{item.title}
				</h3>
			</div>
		</a>
	);
}

/**
 * Tile grid ala profil Instagram mobile: rapat, tanpa teks di bawah; ikon carousel/reel di pojok,
 * caption muncul saat hover/fokus (desktop). Post 4:5, reel 9:16 (rasio grid IG saat ini).
 */
export function InstagramTile({ item }: { item: SocialFeedItem }) {
	const kind = kindOf(item);
	const isReel = kind === 'reel';
	return (
		<a
			href={item.url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`${isReel ? 'Reel' : 'Post'}: ${item.title}`}
			className={cn(
				'group relative block overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
				isReel ? 'aspect-[9/16]' : 'aspect-[4/5]',
			)}>
			{item.thumbnailUrl ? (
				<img
					src={item.thumbnailUrl}
					alt=""
					loading="lazy"
					className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
				/>
			) : null}
			<span className="absolute right-1.5 top-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
				{isReel ? (
					<Clapperboard className="h-4 w-4" />
				) : item.isCarousel ? (
					<GalleryHorizontalEnd className="h-4 w-4" />
				) : null}
			</span>
			<span className="pointer-events-none absolute inset-0 hidden flex-col justify-end bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:flex">
				<span className="line-clamp-3 text-xs font-medium leading-snug text-white">{item.title}</span>
				{formatSocialDate(item.publishedAt) && (
					<span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/75">
						{formatSocialDate(item.publishedAt)}
					</span>
				)}
			</span>
		</a>
	);
}

/** Tab bergaya mono (sama dengan tab topik berita). */
export function SocialTabs<K extends string>({
	tabs,
	active,
	onChange,
	label,
	className,
}: {
	tabs: { key: K; label: string; count?: number; icon?: React.ReactNode }[];
	active: K;
	onChange: (key: K) => void;
	label: string;
	className?: string;
}) {
	return (
		<nav aria-label={label} className={cn('archive-tabs overflow-x-auto', className)}>
			<ul className="flex w-max min-w-full gap-1 border-b border-border/70">
				{tabs.map((t) => {
					const on = t.key === active;
					return (
						<li key={t.key}>
							<button
								type="button"
								aria-current={on ? 'page' : undefined}
								onClick={() => onChange(t.key)}
								className={cn(
									'relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors sm:text-xs',
									on ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
								)}>
								{t.icon}
								{t.label}
								{typeof t.count === 'number' && (
									<span className="tabular-nums text-muted-foreground">{String(t.count).padStart(2, '0')}</span>
								)}
								<span
									aria-hidden
									className={cn(
										'absolute inset-x-2 -bottom-px h-0.5 origin-left rounded-full bg-primary transition-transform duration-200',
										on ? 'scale-x-100' : 'scale-x-0',
									)}
								/>
							</button>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
