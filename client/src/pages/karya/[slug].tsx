import { KaryaAvatar, KaryaCard, categoryLabel, useCoverUrl } from '@/components/karya/karya-card';
import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import RichHtmlWithEmbeds from '@/components/public/rich-html-with-embeds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KARYA_PATHS, usePublicProject, type KaryaProjectDetail } from '@/hooks/use-karya';
import { useToast } from '@/hooks/use-toast';
import { gdriveFileIdFromUrl, KARYA_REPO_HOSTS, KARYA_STATUS_LABEL, youtubeIdFromUrl, karyaLinkIcon, karyaCategoriesOf, type KaryaRepoInfo } from '@shared/karya';
import { BookOpen, Download, Palette, PlayCircle, Smartphone, BadgeCheck, Code2, Eye, ExternalLink, GitFork, Globe, Link2, Loader2, Scale, Share2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KARYA_TAG_GROUPS, karyaTagGroup, karyaTagToneClass } from '@shared/karya-tags';
import { useState } from 'react';
import { Link, useParams } from 'wouter';

/** Ikon platform repo (GitHub/GitLab/Bitbucket/Codeberg) — SVG sederhana, warna ikut teks. */
export function RepoHostIcon({ host, className = 'h-4 w-4' }: { host: string; className?: string }) {
	if (host === 'github')
		return (
			<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
				<path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
			</svg>
		);
	if (host === 'gitlab')
		return (
			<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
				<path d="m23.6 9.6-.03-.09-3.27-8.52a.85.85 0 0 0-1.62.06l-2.2 6.75H7.52L5.32 1.05a.85.85 0 0 0-1.62-.06L.43 9.51l-.03.09a6.06 6.06 0 0 0 2 7l.01.01.03.02 4.98 3.73 2.47 1.87 1.5 1.13a1 1 0 0 0 1.22 0l1.5-1.13 2.47-1.87 5-3.75.01-.01a6.06 6.06 0 0 0 2.01-7Z" />
			</svg>
		);
	if (host === 'bitbucket')
		return (
			<svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
				<path d="M.78 1.21a.77.77 0 0 0-.77.89l3.26 19.8a1.05 1.05 0 0 0 1.03.87H19.9a.77.77 0 0 0 .77-.65l3.27-20.02a.77.77 0 0 0-.77-.89Zm13.71 14.3H9.53L8.2 8.47h7.55Z" />
			</svg>
		);
	return <Code2 className={className} aria-hidden />;
}

function RepoCard({ repo }: { repo: KaryaRepoInfo }) {
	const host = KARYA_REPO_HOSTS[repo.host]?.label || 'repo';
	return (
		<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
			<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
				<RepoHostIcon host={repo.host} />
				<span className="truncate">
					{repo.owner}/{repo.name}
				</span>
				<Badge variant="outline" className="ml-auto">
					{host}
				</Badge>
			</div>
			{repo.description ? <p className="line-clamp-3 text-sm text-muted-foreground">{repo.description}</p> : null}
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				{repo.language ? <span>{repo.language}</span> : null}
				<span className="inline-flex items-center gap-1">
					<Star className="h-3 w-3" aria-hidden /> {repo.stars}
				</span>
				<span className="inline-flex items-center gap-1">
					<GitFork className="h-3 w-3" aria-hidden /> {repo.forks}
				</span>
				{repo.license ? (
					<span className="inline-flex items-center gap-1">
						<Scale className="h-3 w-3" aria-hidden /> {repo.license}
					</span>
				) : null}
				{repo.updatedAt ? <span>Update {new Date(repo.updatedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span> : null}
			</div>
			<div className="flex flex-wrap gap-2">
				<Button asChild size="sm" variant="outline">
					<a href={repo.url} target="_blank" rel="noopener noreferrer nofollow">
						Lihat selengkapnya di {host} <ExternalLink className="ml-1 h-3.5 w-3.5" />
					</a>
				</Button>
				{repo.homepage ? (
					<Button asChild size="sm" variant="ghost">
						<a href={repo.homepage} target="_blank" rel="noopener noreferrer nofollow">
							Demo <Globe className="ml-1 h-3.5 w-3.5" />
						</a>
					</Button>
				) : null}
			</div>
		</div>
	);
}

function AuthorBox({ p }: { p: KaryaProjectDetail }) {
	return (
		<>
			<KaryaAvatar name={p.author.name} url={p.author.avatarUrl} className="h-12 w-12 text-sm" />
			<div className="min-w-0">
				<p className="truncate font-semibold text-foreground">{p.author.name}</p>
				<p className="text-xs text-muted-foreground">Teknik Informatika{p.author.angkatan ? ` · Angkatan ${p.author.angkatan}` : ''}</p>
				{p.author.verifiedTi ? (
					<p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
						<BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Mahasiswa TI terverifikasi
					</p>
				) : null}
			</div>
		</>
	);
}

/** Tampilan detail karya — dipakai halaman publik dan pratinjau pemilik. */
export function KaryaDetailView({ p }: { p: KaryaProjectDetail }) {
	const [active, setActive] = useState(0);
	const { toast } = useToast();
	const coverUrl = useCoverUrl(p.coverUrl, p.coverGenerated);

	const youtube = p.links.filter((l) => l.kind === 'youtube').map((l) => ({ ...l, id: youtubeIdFromUrl(l.url) })).filter((l) => l.id);
	const drive = p.links.filter((l) => l.kind === 'gdrive').map((l) => ({ ...l, id: gdriveFileIdFromUrl(l.url) }));
	const otherLinks = p.links.filter((l) => l.kind === 'demo' || l.kind === 'other' || l.kind === 'repo');
	type Slide = { key: string; kind: 'youtube' | 'image' | 'video' | 'drive'; src: string; caption?: string };
	const slides: Slide[] = [
		...youtube.map((y) => ({ key: `yt-${y.id}`, kind: 'youtube' as const, src: `https://www.youtube-nocookie.com/embed/${y.id}`, caption: y.label })),
		...p.media.map((m) => ({ key: m.id, kind: m.type, src: m.url, caption: m.caption })),
		...p.links.filter((l) => l.kind === 'video').map((l, i) => ({ key: `vf-${i}`, kind: 'video' as const, src: l.url, caption: l.label })),
		...drive.filter((d) => d.id).map((d) => ({ key: `gd-${d.id}`, kind: 'drive' as const, src: `https://drive.google.com/file/d/${d.id}/preview`, caption: d.label })),
	];
	const current = slides[Math.min(active, slides.length - 1)];
	const relatedAll = [...p.relatedCards, ...(p.relatedAuto || []).filter((c) => !p.relatedCards.some((r) => r.slug === c.slug))];

	const share = async () => {
		const url = window.location.href;
		try {
			if (navigator.share) await navigator.share({ title: p.title, url });
			else {
				await navigator.clipboard.writeText(url);
				toast({ title: 'Link disalin' });
			}
		} catch {
			/* dibatalkan */
		}
	};

	return (
		<article className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
			<div className="min-w-0 space-y-6">
				{p.preview ? (
					<div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
						<strong>Pratinjau</strong> — hanya kamu yang melihat halaman ini. Status: {p.status ? KARYA_STATUS_LABEL[p.status] : '-'}, {p.visibility === 'public' ? 'Publik' : 'Privat'}.
					</div>
				) : null}
				<header className="space-y-3">
					<div className="flex flex-wrap items-center gap-2">
						{karyaCategoriesOf(p).map((c) => (
							<Badge key={c} variant="secondary">{categoryLabel(c)}</Badge>
						))}
						{p.year ? <Badge variant="outline">{p.year}</Badge> : null}
					</div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{p.title}</h1>
					{p.summary ? <p className="text-lg text-muted-foreground">{p.summary}</p> : null}
					<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
						<span className="inline-flex items-center gap-1">
							<Eye className="h-4 w-4" aria-hidden /> {p.viewCount} dilihat
						</span>
						{p.publishedAt ? <span>Tayang {new Date(p.publishedAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span> : null}
						{!p.preview ? (
							<button type="button" onClick={share} className="inline-flex min-h-[40px] items-center gap-1 text-primary hover:underline">
								<Share2 className="h-4 w-4" aria-hidden /> Bagikan
							</button>
						) : null}
					</div>
				</header>

				{current ? (
					<div className="space-y-3">
						<div className="aspect-video overflow-hidden rounded-xl border border-border bg-black">
							{current.kind === 'image' ? (
								<img src={current.src} alt={current.caption || p.title} className="h-full w-full object-contain" />
							) : current.kind === 'video' ? (
								<video src={current.src} controls preload="metadata" className="h-full w-full" />
							) : (
								<iframe
									src={current.src}
									title={current.caption || p.title}
									className="h-full w-full"
									loading="lazy"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
									referrerPolicy="strict-origin-when-cross-origin"
								/>
							)}
						</div>
						{current.caption ? <p className="text-sm text-muted-foreground">{current.caption}</p> : null}
						{slides.length > 1 ? (
							<div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Media karya">
								{slides.map((s, i) => (
									<button
										key={s.key}
										type="button"
										role="tab"
										aria-selected={i === active}
										aria-label={`Media ${i + 1}`}
										onClick={() => setActive(i)}
										className={`h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 bg-muted text-xs ${i === active ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}>
										{s.kind === 'image' ? <img src={s.src} alt="" className="h-full w-full object-cover" /> : s.kind === 'youtube' ? 'YouTube' : s.kind === 'drive' ? 'Drive' : 'Video'}
									</button>
								))}
							</div>
						) : null}
					</div>
				) : coverUrl ? (
					<img src={coverUrl} alt={p.title} className="w-full rounded-xl border border-border" />
				) : null}

				{p.description ? (
					<section>
						<h2 className="mb-2 text-xl font-semibold text-foreground">Tentang karya</h2>
						{p.descriptionFormat === 'html' ? (
							<RichHtmlWithEmbeds content={p.description} className="prose max-w-none dark:prose-invert" />
						) : (
							<p className="whitespace-pre-line leading-7 text-foreground/90">{p.description}</p>
						)}
					</section>
				) : null}
				{p.role ? (
					<section>
						<h2 className="mb-2 text-xl font-semibold text-foreground">Peran pembuat</h2>
						<p className="whitespace-pre-line leading-7 text-foreground/90">{p.role}</p>
					</section>
				) : null}

				{p.tags.length ? (
					<div className="flex flex-wrap gap-2" aria-label="Tag">
						{p.tags.map((t) => (
							<Link key={t} href={KARYA_PATHS.tag(t)} title={KARYA_TAG_GROUPS.find((g) => g.id === karyaTagGroup(t))?.label} className={cn('rounded-full px-3 py-1 text-sm hover:opacity-80', karyaTagToneClass(t))}>
								#{t}
							</Link>
						))}
					</div>
				) : null}

				{p.repos.length ? (
					<section className="space-y-3">
						<h2 className="text-xl font-semibold text-foreground">Kode sumber</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							{p.repos.map((r) => (
								<RepoCard key={r.url} repo={r} />
							))}
						</div>
					</section>
				) : null}

				{p.related.some((r) => r.url) ? (
					<section className="space-y-3">
						<h2 className="text-xl font-semibold text-foreground">Tautan proyek terkait</h2>
						<div className="flex flex-wrap gap-2">
							{p.related
								.filter((r) => r.url)
								.map((r, i) => (
									<a key={i} href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary/40">
										{r.label} <ExternalLink className="h-3 w-3" aria-hidden />
									</a>
								))}
						</div>
					</section>
				) : null}

				{relatedAll.length ? (
					<section className="space-y-3">
						<h2 className="text-xl font-semibold text-foreground">Karya terkait</h2>
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
							{relatedAll.slice(0, 6).map((c) => (
								<KaryaCard key={c.slug} item={c} />
							))}
						</div>
					</section>
				) : null}
			</div>

			<aside className="min-w-0 space-y-4 self-start lg:sticky lg:top-24">
				{p.author.profileVisible ? (
					<Link href={KARYA_PATHS.student(p.author.username)} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
						<AuthorBox p={p} />
					</Link>
				) : (
					<div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
						<AuthorBox p={p} />
					</div>
				)}

				{p.contributors?.length ? (
					<div className="space-y-2 rounded-xl border border-border bg-card p-4">
						<p className="text-sm font-semibold text-foreground">Tim pembuat</p>
						<ul className="space-y-1.5">
							{p.contributors.map((c, i) => {
								const inner = (
									<>
										<KaryaAvatar name={c.name} url={c.avatarUrl} className="h-8 w-8 shrink-0 text-xs" />
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
											<span className="block truncate text-xs text-muted-foreground">
												{c.role || (c.source === 'repo' ? 'Contributor repo' : 'Kontributor')}
												{c.username ? ` · @${c.username}` : c.githubUrl ? ' · GitHub' : ''}
											</span>
										</span>
									</>
								);
								return (
									<li key={i}>
										{c.username ? (
											<Link href={KARYA_PATHS.student(c.username)} className="flex min-h-[44px] items-center gap-2.5 rounded-md px-1 hover:bg-muted/60">
												{inner}
											</Link>
										) : c.githubUrl ? (
											<a href={c.githubUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex min-h-[44px] items-center gap-2.5 rounded-md px-1 hover:bg-muted/60">
												{inner}
											</a>
										) : (
											<div className="flex min-h-[44px] items-center gap-2.5 px-1">{inner}</div>
										)}
									</li>
								);
							})}
						</ul>
					</div>
				) : null}

				{otherLinks.length || drive.some((d) => !d.id) ? (
					<div className="space-y-2 rounded-xl border border-border bg-card p-4">
						<p className="text-sm font-semibold text-foreground">Tautan</p>
						{[...otherLinks, ...drive.filter((d) => !d.id)].map((l, idx) => {
							const ic = karyaLinkIcon(l.label || '', l.url);
							const Icon = ic === 'download' ? Download : ic === 'store' ? Smartphone : ic === 'docs' ? BookOpen : ic === 'design' ? Palette : ic === 'video' ? PlayCircle : ic === 'demo' ? Globe : Link2;
							return (
								<a
									key={l.url}
									href={l.url}
									target="_blank"
									rel="noopener noreferrer nofollow"
									className={cn(
										'flex min-h-[44px] items-center gap-2.5 rounded-lg border px-3 text-sm font-medium transition-colors',
										idx === 0 ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'border-border text-foreground hover:border-primary/40 hover:text-primary',
									)}>
									<Icon className="h-4 w-4 shrink-0" aria-hidden />
									<span className="min-w-0 flex-1 truncate">{l.label || l.url.replace(/^https:\/\/(www\.)?/, '')}</span>
									<ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
								</a>
							);
						})}
					</div>
				) : null}

				{p.moreFromAuthor.length ? (
					<div className="space-y-3">
						<p className="text-sm font-semibold text-foreground">Karya lain dari {p.author.name.split(' ')[0]}</p>
						{p.moreFromAuthor.slice(0, 2).map((c) => (
							<KaryaCard key={c.slug} item={c} />
						))}
					</div>
				) : null}
			</aside>
		</article>
	);
}

export default function KaryaDetailPage() {
	const { slug = '' } = useParams<{ slug: string }>();
	const { data: p, isLoading, isError } = usePublicProject(slug);
	const crumbs = [
		{ label: 'Beranda', href: '/' },
		{ label: 'Ruang Mahasiswa', href: KARYA_PATHS.home },
		{ label: 'Karya', href: KARYA_PATHS.index },
		{ label: p?.title || 'Karya' },
	];

	if (isLoading) {
		return (
			<KaryaPublicLayout breadcrumb={crumbs}>
				<div className="flex justify-center py-24">
					<Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Memuat" />
				</div>
			</KaryaPublicLayout>
		);
	}
	if (isError || !p) {
		return (
			<KaryaPublicLayout breadcrumb={crumbs} title="Karya tidak ditemukan | Himatif Encoder" noindex>
				<div className="mx-auto max-w-xl px-4 py-24 text-center">
					<h1 className="text-2xl font-bold text-foreground">Karya tidak ditemukan</h1>
					<p className="mt-2 text-muted-foreground">Karya ini mungkin privat, belum disetujui, atau sudah dihapus.</p>
					<Button asChild variant="outline" className="mt-6">
						<Link href={KARYA_PATHS.index}>Lihat karya lain</Link>
					</Button>
				</div>
			</KaryaPublicLayout>
		);
	}

	return (
		<KaryaPublicLayout breadcrumb={crumbs} title={`${p.title} — Karya ${p.author.name} | Himatif Encoder`}>
			<KaryaDetailView p={p} />
		</KaryaPublicLayout>
	);
}
