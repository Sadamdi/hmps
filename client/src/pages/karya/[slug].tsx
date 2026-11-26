import { KaryaAvatar, KaryaCard, categoryLabel } from '@/components/karya/karya-card';
import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KARYA_PATHS, usePublicProject } from '@/hooks/use-karya';
import { gdriveFileIdFromUrl, youtubeIdFromUrl, type KaryaRepoInfo } from '@shared/karya';
import { BadgeCheck, Eye, ExternalLink, GitFork, Github, Globe, Link2, Loader2, Share2, Star } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { useToast } from '@/hooks/use-toast';

const HOST_LABEL: Record<string, string> = { github: 'GitHub', gitlab: 'GitLab', bitbucket: 'Bitbucket' };

function RepoCard({ repo }: { repo: KaryaRepoInfo }) {
	return (
		<a href={repo.url} target="_blank" rel="noopener noreferrer nofollow" className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
			<div className="flex items-center gap-2 text-sm font-semibold text-foreground">
				<Github className="h-4 w-4" aria-hidden />
				<span className="truncate">
					{repo.owner}/{repo.name}
				</span>
				<ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
			</div>
			{repo.description ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{repo.description}</p> : null}
			<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				<span>{HOST_LABEL[repo.host] || repo.host}</span>
				{repo.language ? <span>{repo.language}</span> : null}
				<span className="inline-flex items-center gap-1">
					<Star className="h-3 w-3" aria-hidden /> {repo.stars}
				</span>
				<span className="inline-flex items-center gap-1">
					<GitFork className="h-3 w-3" aria-hidden /> {repo.forks}
				</span>
				{repo.updatedAt ? <span>Update {new Date(repo.updatedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span> : null}
			</div>
		</a>
	);
}

export default function KaryaDetailPage() {
	const { slug = '' } = useParams<{ slug: string }>();
	const { data: p, isLoading, isError } = usePublicProject(slug);
	const [active, setActive] = useState(0);
	const { toast } = useToast();

	const crumbs = [
		{ label: 'Beranda', href: '/' },
		{ label: 'Karya TI', href: KARYA_PATHS.index },
		{ label: p?.title || 'Karya' },
	];

	if (isLoading) {
		return (
			<KaryaPublicLayout breadcrumb={crumbs}>
				<div className="py-24 flex justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Memuat" />
				</div>
			</KaryaPublicLayout>
		);
	}
	if (isError || !p) {
		return (
			<KaryaPublicLayout breadcrumb={crumbs} title="Karya tidak ditemukan | Himatif Encoder" noindex>
				<div className="max-w-xl mx-auto px-4 py-24 text-center">
					<h1 className="text-2xl font-bold text-foreground">Karya tidak ditemukan</h1>
					<p className="mt-2 text-muted-foreground">Karya ini mungkin privat, belum disetujui, atau sudah dihapus.</p>
					<Button asChild variant="outline" className="mt-6">
						<Link href={KARYA_PATHS.index}>Lihat karya lain</Link>
					</Button>
				</div>
			</KaryaPublicLayout>
		);
	}

	const youtube = p.links.filter((l) => l.kind === 'youtube').map((l) => ({ ...l, id: youtubeIdFromUrl(l.url) })).filter((l) => l.id);
	const drive = p.links.filter((l) => l.kind === 'gdrive').map((l) => ({ ...l, id: gdriveFileIdFromUrl(l.url) }));
	const otherLinks = p.links.filter((l) => l.kind === 'demo' || l.kind === 'other' || l.kind === 'repo');
	type Slide = { key: string; kind: 'youtube' | 'image' | 'video' | 'drive'; src: string; caption?: string };
	const slides: Slide[] = [
		...youtube.map((y) => ({ key: `yt-${y.id}`, kind: 'youtube' as const, src: `https://www.youtube-nocookie.com/embed/${y.id}`, caption: y.label })),
		...p.media.map((m) => ({ key: m.id, kind: m.type, src: m.url, caption: m.caption })),
		...drive.filter((d) => d.id).map((d) => ({ key: `gd-${d.id}`, kind: 'drive' as const, src: `https://drive.google.com/file/d/${d.id}/preview`, caption: d.label })),
	];
	const current = slides[Math.min(active, slides.length - 1)];

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
		<KaryaPublicLayout breadcrumb={crumbs} title={`${p.title} — Karya ${p.author.name} | Himatif Encoder`}>
			<article className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 lg:grid-cols-[1fr_320px]">
				<div className="min-w-0 space-y-6">
					<header className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary">{categoryLabel(p.category)}</Badge>
							{p.year ? <Badge variant="outline">{p.year}</Badge> : null}
						</div>
						<h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{p.title}</h1>
						{p.summary ? <p className="text-lg text-muted-foreground">{p.summary}</p> : null}
						<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
							<span className="inline-flex items-center gap-1">
								<Eye className="h-4 w-4" aria-hidden /> {p.viewCount} dilihat
							</span>
							{p.publishedAt ? <span>Tayang {new Date(p.publishedAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span> : null}
							<button type="button" onClick={share} className="inline-flex min-h-[40px] items-center gap-1 text-primary hover:underline">
								<Share2 className="h-4 w-4" aria-hidden /> Bagikan
							</button>
						</div>
					</header>

					{current ? (
						<div className="space-y-3">
							<div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
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
					) : p.coverUrl ? (
						<img src={p.coverUrl} alt={p.title} className="w-full rounded-xl border border-border" />
					) : null}

					{p.description ? (
						<section>
							<h2 className="mb-2 text-xl font-semibold text-foreground">Tentang karya</h2>
							<p className="whitespace-pre-line leading-7 text-foreground/90">{p.description}</p>
						</section>
					) : null}
					{p.role ? (
						<section>
							<h2 className="mb-2 text-xl font-semibold text-foreground">Peran pembuat</h2>
							<p className="whitespace-pre-line leading-7 text-foreground/90">{p.role}</p>
						</section>
					) : null}

					{p.tags.length ? (
						<div className="flex flex-wrap gap-2">
							{p.tags.map((t) => (
								<Link key={t} href={`${KARYA_PATHS.index}?tag=${encodeURIComponent(t)}`} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/20">
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

					{p.related.length ? (
						<section className="space-y-3">
							<h2 className="text-xl font-semibold text-foreground">Proyek terkait</h2>
							<div className="flex flex-wrap gap-2">
								{p.related.map((r, i) =>
									r.projectSlug ? (
										<Link key={i} href={KARYA_PATHS.project(r.projectSlug)} className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary/40">
											{r.label}
										</Link>
									) : (
										<a key={i} href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary/40">
											{r.label} <ExternalLink className="h-3 w-3" aria-hidden />
										</a>
									),
								)}
							</div>
						</section>
					) : null}
				</div>

				<aside className="space-y-4 lg:sticky lg:top-24 self-start">
					<Link href={KARYA_PATHS.student(p.author.username)} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
						<KaryaAvatar name={p.author.name} url={p.author.avatarUrl} className="h-12 w-12 text-sm" />
						<div className="min-w-0">
							<p className="truncate font-semibold text-foreground">{p.author.name}</p>
							<p className="text-xs text-muted-foreground">
								Teknik Informatika{p.author.angkatan ? ` · Angkatan ${p.author.angkatan}` : ''}
							</p>
							{p.author.verifiedTi ? (
								<p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
									<BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Mahasiswa TI terverifikasi
								</p>
							) : null}
						</div>
					</Link>

					{otherLinks.length || drive.some((d) => !d.id) ? (
						<div className="space-y-2 rounded-xl border border-border bg-card p-4">
							<p className="text-sm font-semibold text-foreground">Tautan</p>
							{[...otherLinks, ...drive.filter((d) => !d.id)].map((l) => (
								<a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex min-h-[40px] items-center gap-2 text-sm text-primary hover:underline">
									{l.kind === 'demo' ? <Globe className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
									<span className="truncate">{l.label || l.url.replace(/^https:\/\//, '')}</span>
								</a>
							))}
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
		</KaryaPublicLayout>
	);
}
