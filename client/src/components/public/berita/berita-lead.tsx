import { ArchiveIndex, formatArchiveIndex } from '@/components/public/archive/archive-meta';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_IMAGE_URL } from '@/constants/default-image';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';

export interface BeritaListItem {
	_id: string;
	slug?: string;
	title: string;
	excerpt: string;
	image: string;
	author: string;
	authorsDisplay?: string;
	authors?: string[];
	createdAt: string;
	updatedAt?: string;
	tags: string[];
	viewCount?: number;
}

export function beritaHref(item: Pick<BeritaListItem, '_id' | 'slug'>) {
	return item.slug ? `/berita/${item.slug}` : `/berita/${item._id}`;
}

export function formatBeritaDate(dateString: string) {
	return new Date(dateString).toLocaleDateString('id-ID', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

/**
 * Blok newsroom halaman berita: satu lead story besar + kolom "Terbaru" bernomor.
 * Dirender di halaman 1 (juga saat search/filter aktif); sisi kanan memuat thumbnail kecil per berita.
 */
export function BeritaLead({
	lead,
	latest,
	sideLabel = 'Terbaru',
}: {
	lead: BeritaListItem;
	latest: BeritaListItem[];
	/** Judul kolom kanan; "Terbaru" hanya benar bila urutan terbaru. */
	sideLabel?: string;
}) {
	return (
		<section aria-label="Sorotan berita" className="grid gap-6 lg:gap-8 lg:grid-cols-3 mb-10 sm:mb-12">
			<article className="archive-card group lg:col-span-2 overflow-hidden rounded-xl border border-border/70 bg-card hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/40">
				<Link href={beritaHref(lead)} className="block">
					<div className="archive-card-media relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden bg-muted">
						<img
							src={lead.image}
							alt={lead.title}
							className="h-full w-full object-cover"
							onError={(e) => {
								(e.target as HTMLImageElement).src = DEFAULT_IMAGE_URL;
							}}
						/>
						<ArchiveIndex n={1} overlay />
					</div>
					<div className="p-4 sm:p-6">
						<p className="archive-meta flex flex-wrap items-center gap-x-2 gap-y-1">
							<time dateTime={lead.createdAt}>{formatBeritaDate(lead.createdAt)}</time>
							<span aria-hidden>·</span>
							<span>{lead.viewCount ?? 0} pembaca</span>
						</p>
						<h2 className="mt-2 text-xl sm:text-3xl font-bold leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-3">
							{lead.title}
						</h2>
						<p className="mt-3 hidden sm:block text-muted-foreground leading-7 line-clamp-3">{lead.excerpt}</p>
						{lead.tags && lead.tags.length > 0 && (
							<div className="mt-4 hidden sm:flex flex-wrap gap-1.5">
								{lead.tags.slice(0, 4).map((tag) => (
									<Badge key={tag} variant="secondary" className="text-xs">
										{tag}
									</Badge>
								))}
							</div>
						)}
						<p className="mt-4 text-sm text-muted-foreground">
							Oleh <span className="font-medium text-foreground">{lead.authorsDisplay || lead.author}</span>
						</p>
					</div>
				</Link>
			</article>

			{latest.length > 0 && (
				<aside aria-label={sideLabel} className="flex flex-col">
					<div className="flex items-center justify-between border-b border-border/70 pb-3">
						<h2 className="archive-meta text-foreground">{sideLabel}</h2>
						<span className="h-px flex-1 ml-3 bg-gradient-to-r from-cyan-400/60 to-transparent" />
					</div>
					<ol className="divide-y divide-border/70">
						{latest.map((item, i) => (
							<li key={item._id}>
								<Link
									href={beritaHref(item)}
									className="group flex gap-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md">
									<span className="archive-index text-primary pt-0.5">{formatArchiveIndex(i + 2)}</span>
									<span className="min-w-0 flex-1">
										<span className="block font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
											{item.title}
										</span>
										<span className="archive-meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
											<time dateTime={item.createdAt}>{formatBeritaDate(item.createdAt)}</time>
											<span aria-hidden>·</span>
											<span>{item.viewCount ?? 0} pembaca</span>
										</span>
									</span>
									<span className="relative h-16 w-16 sm:h-[72px] sm:w-[72px] shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/60">
										<img
											src={item.image || DEFAULT_IMAGE_URL}
											alt=""
											loading="lazy"
											className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
											onError={(e) => {
												(e.target as HTMLImageElement).src = DEFAULT_IMAGE_URL;
											}}
										/>
										<ArrowUpRight className="absolute right-1 top-1 h-4 w-4 rounded bg-background/80 p-0.5 text-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
									</span>
								</Link>
							</li>
						))}
					</ol>
				</aside>
			)}
		</section>
	);
}
