import RichHtmlWithEmbeds from '@/components/public/rich-html-with-embeds';
import { KaryaAvatar, KaryaCard } from '@/components/karya/karya-card';
import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Button } from '@/components/ui/button';
import { KARYA_PATHS, usePublicStudent } from '@/hooks/use-karya';
import { BadgeCheck, BookOpen, FileText, FolderGit2, Github, Globe, Instagram, Link2, Linkedin, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { karyaCategoriesOf, karyaCategoryLabel } from '@shared/karya';
import { Activity, Flame, Search } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import type { KaryaProjectCard, KaryaSocialLinks, KaryaStudentPublic } from '@shared/karya';

const SOCIAL: { key: keyof KaryaSocialLinks; label: string; icon: ReactNode }[] = [
	{ key: 'github', label: 'GitHub', icon: <Github className="h-4 w-4" /> },
	{ key: 'gitlab', label: 'GitLab', icon: <Link2 className="h-4 w-4" /> },
	{ key: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> },
	{ key: 'instagram', label: 'Instagram', icon: <Instagram className="h-4 w-4" /> },
	{ key: 'website', label: 'Website', icon: <Globe className="h-4 w-4" /> },
	{ key: 'cv', label: 'CV', icon: <FileText className="h-4 w-4" /> },
];

const shortHandle = (url: string) => url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');

export default function KaryaStudentPage() {
	const { username = '' } = useParams<{ username: string }>();
	const { data, isLoading, isError } = usePublicStudent(username);
	const [, navigate] = useLocation();
	const s = data?.student;
	// Username lama → alamat baru
	useEffect(() => {
		if (data?.redirectTo) navigate(KARYA_PATHS.student(data.redirectTo), { replace: true });
	}, [data?.redirectTo, navigate]);
	const crumbs = [{ label: 'Beranda', href: '/' }, { label: 'Ruang Mahasiswa', href: KARYA_PATHS.home }, { label: 'Mahasiswa', href: KARYA_PATHS.studentsDirectory }, { label: s?.name || 'Profil' }];

	if (isLoading) {
		return (
			<KaryaPublicLayout breadcrumb={crumbs}>
				<div className="py-24 flex justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Memuat" />
				</div>
			</KaryaPublicLayout>
		);
	}
	if (isError || !data || !s) {
		return (
			<KaryaPublicLayout breadcrumb={crumbs} title="Profil tidak ditemukan | Himatif Encoder" noindex>
				<div className="max-w-xl mx-auto px-4 py-24 text-center">
					<h1 className="text-2xl font-bold text-foreground">Profil tidak ditemukan</h1>
					<p className="mt-2 text-muted-foreground">Profil ini privat, belum diverifikasi, atau tidak ada.</p>
					<Button asChild variant="outline" className="mt-6">
						<Link href={KARYA_PATHS.index}>Lihat karya mahasiswa</Link>
					</Button>
				</div>
			</KaryaPublicLayout>
		);
	}

	return (
		<KaryaPublicLayout breadcrumb={crumbs} title={`${s.name} — Karya Mahasiswa TI | Himatif Encoder`} noindex={data.indexable === false}>
			<StudentProfileView s={s} projects={data.projects} />
		</KaryaPublicLayout>
	);
}

/** Tampilan profil (dipakai halaman publik dan pratinjau pemilik). */
export function StudentProfileView({ s, projects }: { s: KaryaStudentPublic & { shortlink?: string }; projects: KaryaProjectCard[] }) {
	const socials = SOCIAL.filter((x) => s.social?.[x.key]);
	const tagCount = new Map<string, number>();
	for (const p of projects) for (const t of p.tags || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
	const topTags = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

	return (
		<>
			<div className="h-32 sm:h-40 bg-gradient-to-r from-blue-600 via-cyan-700 to-background" aria-hidden />
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 pb-14 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
				<aside className="space-y-4 self-start rounded-xl border border-border bg-card p-6 shadow-sm">
					<KaryaAvatar name={s.name} url={s.avatarUrl} className="h-24 w-24 border-4 border-background text-2xl" />
					<div>
						<h1 className="text-2xl font-bold text-foreground">{s.name}</h1>
						<p className="text-sm text-muted-foreground">Teknik Informatika UIN Malang{s.angkatan ? ` · Angkatan ${s.angkatan}` : ''}</p>
						{s.verifiedTi ? (
							<span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
								<BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Terverifikasi mahasiswa TI
							</span>
						) : null}
					</div>
					{s.headline ? <p className="font-medium text-foreground">{s.headline}</p> : null}
					{s.bio ? <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{s.bio}</p> : null}
					{s.skills.length ? (
						<div className="flex flex-wrap gap-1.5">
							{s.skills.map((k) => (
								<span key={k} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
									{k}
								</span>
							))}
						</div>
					) : null}
					{socials.length ? (
						<ul className="space-y-1 border-t border-border pt-3">
							{socials.map((x) => (
								<li key={x.key}>
									<a href={s.social[x.key]} target="_blank" rel="noopener noreferrer me" className="flex min-h-[40px] items-center gap-2 text-sm text-foreground hover:text-primary">
										<span className="text-muted-foreground">{x.icon}</span>
										<span className="font-medium">{x.label}</span>
										<span className="ml-auto truncate text-xs text-muted-foreground max-w-[140px]">{shortHandle(s.social[x.key] || '')}</span>
									</a>
								</li>
							))}
						</ul>
					) : null}
					{s.shortlink ? (
						<p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
							Shortlink: <span className="font-semibold text-primary">himatif-encoder.com{s.shortlink}</span>
						</p>
					) : null}
				</aside>

				<ProfileMain s={s} projects={projects} topTags={topTags} />
			</div>
		</>
	);
}

type SortKey = 'active' | 'popular' | 'latest';

/**
 * Isi profil gaya GitHub:
 * - Ringkasan: README, lalu "Sedang aktif" (aktivitas repo/karya terbaru) dan "Terpopuler" (paling banyak dilihat).
 * - Portofolio: semua karya (milik sendiri + sebagai kontributor) dalam kartu, bisa dicari, difilter kategori, diurutkan.
 */
function ProfileMain({ s, projects, topTags }: { s: KaryaStudentPublic; projects: KaryaProjectCard[]; topTags: [string, number][] }) {
	const [tab, setTab] = useState<'overview' | 'portfolio'>(() =>
		typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'portofolio' ? 'portfolio' : 'overview',
	);
	const [q, setQ] = useState('');
	const [cat, setCat] = useState('');
	const [sort, setSort] = useState<SortKey>('active');
	const ts = (d?: string | null) => (d ? new Date(d).getTime() : 0);
	const active = useMemo(() => [...projects].sort((a, b) => ts(b.activeAt || b.publishedAt) - ts(a.activeAt || a.publishedAt)).slice(0, 4), [projects]);
	const popular = useMemo(
		() => [...projects].filter((p) => !active.slice(0, 2).includes(p)).sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 4),
		[projects, active],
	);
	const cats = useMemo(() => Array.from(new Set(projects.flatMap((p) => karyaCategoriesOf(p)))), [projects]);
	const list = useMemo(() => {
		const needle = q.trim().toLowerCase();
		const out = projects.filter(
			(p) =>
				(!cat || karyaCategoriesOf(p).includes(cat)) &&
				(!needle || `${p.title} ${p.summary} ${p.tags.join(' ')}`.toLowerCase().includes(needle)),
		);
		return out.sort((a, b) =>
			sort === 'popular' ? (b.viewCount || 0) - (a.viewCount || 0) : sort === 'latest' ? ts(b.publishedAt) - ts(a.publishedAt) : ts(b.activeAt || b.publishedAt) - ts(a.activeAt || a.publishedAt),
		);
	}, [projects, q, cat, sort]);

	const setTabUrl = (t: 'overview' | 'portfolio') => {
		setTab(t);
		const u = new URL(window.location.href);
		if (t === 'portfolio') u.searchParams.set('tab', 'portofolio');
		else u.searchParams.delete('tab');
		window.history.replaceState(null, '', u.toString());
	};

	const empty = (
		<div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
			<p className="font-semibold text-foreground">Belum ada karya yang tayang</p>
			<p className="mt-1 text-sm text-muted-foreground">Karya {s.name.split(' ')[0]} akan muncul di sini setelah dipublikasikan.</p>
		</div>
	);

	return (
		<section className="min-w-0 space-y-6 lg:pt-20">
			<div className="flex flex-wrap items-center gap-1 border-b border-border" role="tablist" aria-label="Bagian profil">
				{(
					[
						['overview', 'Ringkasan', BookOpen, null],
						['portfolio', 'Portofolio', FolderGit2, projects.length],
					] as const
				).map(([id, label, Icon, n]) => (
					<button
						key={id}
						type="button"
						role="tab"
						aria-selected={tab === id}
						onClick={() => setTabUrl(id)}
						className={cn(
							'-mb-px inline-flex min-h-[44px] items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
							tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
						)}>
						<Icon className="h-4 w-4" aria-hidden /> {label}
						{n !== null ? <span className="rounded-full bg-muted px-2 text-xs">{n}</span> : null}
					</button>
				))}
			</div>

			{tab === 'overview' ? (
				<div className="space-y-8">
					{topTags.length ? (
						<div className="flex flex-wrap gap-1.5">
							{topTags.map(([t, n]) => (
								<Link key={t} href={KARYA_PATHS.tag(t)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
									#{t} <span className="opacity-70">{n}</span>
								</Link>
							))}
						</div>
					) : null}
					{s.profileReadme ? (
						<article className="overflow-hidden rounded-xl border border-border bg-card">
							<div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
								<BookOpen className="h-4 w-4" aria-hidden /> {s.username} / README.md
							</div>
							<div className="p-5 sm:p-6">
								<RichHtmlWithEmbeds content={s.profileReadme} className="prose prose-sm max-w-none dark:prose-invert [&_img]:inline-block [&_img]:my-1 [&_p[align=center]]:text-center [&_div[align=center]]:text-center" />
							</div>
						</article>
					) : null}
					{!projects.length ? (
						empty
					) : (
						<>
							<div className="space-y-3">
								<h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
									<Activity className="h-5 w-5 text-emerald-500" aria-hidden /> Sedang aktif
								</h2>
								<div className="grid gap-5 sm:grid-cols-2">
									{active.slice(0, 2).map((p) => (
										<KaryaCard key={p.slug} item={p} />
									))}
								</div>
							</div>
							{popular.length ? (
								<div className="space-y-3">
									<h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
										<Flame className="h-5 w-5 text-orange-500" aria-hidden /> Terpopuler
									</h2>
									<div className="grid gap-5 sm:grid-cols-2">
										{popular.slice(0, 2).map((p) => (
											<KaryaCard key={p.slug} item={p} />
										))}
									</div>
								</div>
							) : null}
							{projects.length > 2 ? (
								<Button variant="outline" onClick={() => setTabUrl('portfolio')}>
									Lihat semua {projects.length} karya
								</Button>
							) : null}
						</>
					)}
				</div>
			) : (
				<div className="space-y-4">
					<div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
							<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cari di karya ${s.name.split(' ')[0]}…`} aria-label="Cari karya di profil" className="h-10 pl-9" />
						</div>
						<div className="flex gap-1 rounded-lg border border-border p-1" role="group" aria-label="Urutkan">
							{(
								[
									['active', 'Terakhir aktif'],
									['popular', 'Terpopuler'],
									['latest', 'Terbaru'],
								] as const
							).map(([k, label]) => (
								<button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={cn('rounded-md px-2.5 py-1 text-xs', sort === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
									{label}
								</button>
							))}
						</div>
					</div>
					{cats.length > 1 ? (
						<div className="flex flex-wrap gap-1.5">
							{['', ...cats].map((c) => (
								<button key={c || 'all'} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn('min-h-[32px] rounded-full border px-3 text-xs', cat === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
									{c ? karyaCategoryLabel(c) : 'Semua'}
								</button>
							))}
						</div>
					) : null}
					{!projects.length ? (
						empty
					) : list.length ? (
						<div className="grid gap-5 sm:grid-cols-2">
							{list.map((p) => (
								<KaryaCard key={p.slug} item={p} />
							))}
						</div>
					) : (
						<p className="py-10 text-center text-sm text-muted-foreground">Tidak ada karya yang cocok.</p>
					)}
				</div>
			)}
		</section>
	);
}
