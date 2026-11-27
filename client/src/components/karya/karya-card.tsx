import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Code2, Star } from 'lucide-react';
import { Link } from 'wouter';
import type { KaryaProjectCard as Card } from '@shared/karya';
import { karyaCategoriesOf, karyaCategoryLabel } from '@shared/karya';
import { karyaTagToneClass } from '@shared/karya-tags';
import { KARYA_PATHS } from '@/hooks/use-karya';
import { useTheme } from '@/lib/theme';

/** URL sampul: sampul template otomatis mengikuti tema terang/gelap. */
export function useCoverUrl(url: string, generated?: boolean): string {
	const { theme } = useTheme();
	return generated && url ? `${url}${url.includes('?') ? '&' : '?'}theme=${theme === 'light' ? 'light' : 'dark'}` : url;
}

export function initialsOf(name: string): string {
	return (
		String(name || '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join('') || 'TI'
	);
}

export function KaryaAvatar({ name, url, className }: { name: string; url?: string; className?: string }) {
	return url ? (
		<img src={url} alt="" loading="lazy" className={cn('rounded-full object-cover bg-muted', className)} />
	) : (
		<span aria-hidden className={cn('rounded-full bg-primary/15 text-primary font-semibold inline-flex items-center justify-center', className)}>
			{initialsOf(name)}
		</span>
	);
}

export const categoryLabel = (id: string) => karyaCategoryLabel(id);

/** Kartu karya publik: sampul, label media, judul, ringkasan, tag, pembuat. */
export function KaryaCard({ item, className }: { item: Card; className?: string }) {
	const cover = useCoverUrl(item.coverUrl, item.coverGenerated);
	/** Gambar pratinjau repo (OG 2:1, berisi teks) jangan dipotong: tampilkan utuh di latar putih. */
	const isRepoOg = /opengraph\.githubassets\.com|gitlab\.com\/uploads|avatar/.test(cover);
	const cats = karyaCategoriesOf(item);
	return (
		<Link
			href={KARYA_PATHS.project(item.slug)}
			className={cn(
				'group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all',
				'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				className,
			)}>
			<div className="relative aspect-[16/10] overflow-hidden bg-muted">
				{cover ? (
					<img
						src={cover}
						alt=""
						loading="lazy"
						className={cn('h-full w-full transition-transform duration-300 group-hover:scale-[1.03]', isRepoOg ? 'object-contain bg-white px-2 pt-9 pb-8' : 'object-cover')}
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-background to-accent/15">
						<Code2 className="h-10 w-10 text-primary/60" aria-hidden />
					</div>
				)}
				<div className="absolute left-3 right-3 top-2.5 flex flex-wrap gap-1.5">
					{cats.map((c) => (
						<Badge key={c} variant="secondary" className="bg-slate-950/75 text-white backdrop-blur hover:bg-slate-950/75">
							{categoryLabel(c)}
						</Badge>
					))}
					{item.asContributor ? (
						<Badge className="bg-violet-500 text-white hover:bg-violet-500">Kontributor</Badge>
					) : null}
					{item.featured ? (
						<Badge className="bg-amber-400 text-slate-900 hover:bg-amber-400">
							<Star className="mr-1 h-3 w-3" aria-hidden /> Unggulan
						</Badge>
					) : null}
				</div>
				{item.mediaLabel ? (
					<span className="absolute bottom-2 left-3 rounded-md bg-slate-950/80 px-2 py-0.5 text-[11px] font-medium text-white">{item.mediaLabel}</span>
				) : null}
			</div>
			<div className="flex flex-1 flex-col gap-2 p-4">
				<h3 className="line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary">{item.title}</h3>
				{item.summary ? <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p> : null}
				{item.tags.length ? (
					<div className="flex flex-wrap gap-1.5">
						{item.tags.slice(0, 4).map((t) => (
							<span key={t} className={cn('rounded-full px-2 py-0.5 text-xs', karyaTagToneClass(t))}>
								#{t}
							</span>
						))}
					</div>
				) : null}
				<div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-3">
					<span className="flex -space-x-2">
						<KaryaAvatar name={item.author.name} url={item.author.avatarUrl} className="h-7 w-7 text-xs ring-2 ring-card" />
						{(item.contributorAvatars || []).slice(0, 3).map((c, i) => (
							<KaryaAvatar key={i} name={c.name} url={c.avatarUrl} className="h-7 w-7 text-[10px] ring-2 ring-card" />
						))}
					</span>
					<span className="truncate text-sm text-muted-foreground">
						{item.author.name}
						{item.author.angkatan ? ` · Angkatan ${item.author.angkatan}` : ''}
					</span>
				</div>
			</div>
		</Link>
	);
}

export function KaryaCardSkeleton() {
	return (
		<div className="overflow-hidden rounded-xl border border-border bg-card">
			<div className="aspect-[16/10] animate-pulse bg-muted" />
			<div className="space-y-2 p-4">
				<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
				<div className="h-3 w-full animate-pulse rounded bg-muted" />
				<div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
			</div>
		</div>
	);
}
