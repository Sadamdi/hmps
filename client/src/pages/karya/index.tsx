import { KaryaAvatar, KaryaCard, KaryaCardSkeleton } from '@/components/karya/karya-card';
import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { PublicSectionHeader } from '@/components/public/section-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KARYA_PATHS, useKaryaConfig, usePublicCategories, usePublicProjects, usePublicStudents, usePublicTags, type KaryaStudentListItem } from '@/hooks/use-karya';
import { karyaTagToneClass } from '@shared/karya-tags';
import { KaryaTutorialVideo } from '@/components/karya/karya-tutorial-video';
import { cn } from '@/lib/utils';
import { KARYA_CATEGORIES, karyaCategoryLabel } from '@shared/karya';
import { Code2, FolderGit2, Search, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';

const PAGE_SIZE = 12;

function readParams() {
	const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
	return {
		q: p.get('q') || '',
		tag: p.get('tag') || '',
		category: p.get('kategori') || '',
		sort: p.get('urut') === 'populer' ? 'popular' : 'latest',
		angkatan: Number(p.get('angkatan')) || 0,
		page: Math.max(1, Number(p.get('hal')) || 1),
		view: (p.get('lihat') === 'mahasiswa' ? 'students' : 'projects') as 'projects' | 'students',
	};
}

export default function KaryaIndexPage() {
	const [location] = useLocation();
	const initial = useMemo(readParams, [location]);
	const [qInput, setQInput] = useState(initial.q);
	const [state, setState] = useState(initial);
	const { data: config } = useKaryaConfig();
	const { data: tags } = usePublicTags();
	const { data: usedCats } = usePublicCategories();
	const catCount = new Map((usedCats || []).map((c) => [c.id, c.count]));
	const catOptions = [
		...KARYA_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
		...(usedCats || []).filter((c) => !KARYA_CATEGORIES.some((k) => k.id === c.id)).map((c) => ({ id: c.id, label: karyaCategoryLabel(c.id) })),
	];
	const { data, isLoading, isError } = usePublicProjects({ q: state.q, tag: state.tag, category: state.category, sort: state.sort, angkatan: state.angkatan, page: state.page, limit: PAGE_SIZE });
	const studentsQ = usePublicStudents({ q: state.q, angkatan: state.angkatan, page: state.page, limit: PAGE_SIZE }, state.view === 'students');

	// Simpan filter di URL agar bisa dibagikan & tombol back berfungsi
	useEffect(() => {
		const sp = new URLSearchParams();
		if (state.q) sp.set('q', state.q);
		if (state.tag) sp.set('tag', state.tag);
		if (state.category) sp.set('kategori', state.category);
		if (state.sort === 'popular') sp.set('urut', 'populer');
		if (state.angkatan) sp.set('angkatan', String(state.angkatan));
		if (state.page > 1) sp.set('hal', String(state.page));
		if (state.view === 'students') sp.set('lihat', 'mahasiswa');
		const qs = sp.toString();
		const target = qs ? `${KARYA_PATHS.index}?${qs}` : KARYA_PATHS.index;
		if (`${window.location.pathname}${window.location.search}` !== target) window.history.replaceState(null, '', target);
	}, [state]);

	// Cari otomatis setelah berhenti mengetik
	useEffect(() => {
		const t = setTimeout(() => setState((s) => (s.q === qInput.trim() ? s : { ...s, q: qInput.trim(), page: 1 })), 350);
		return () => clearTimeout(t);
	}, [qInput]);

	const items = data?.data || [];
	const total = data?.meta.total || 0;
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const hasFilter = !!(state.q || state.tag || state.category || state.angkatan);
	const years = useMemo(() => {
		const y = new Date().getFullYear();
		return Array.from({ length: 10 }, (_, i) => y - i);
	}, []);

	if (config && !config.enabled) {
		return (
			<KaryaPublicLayout title="Karya Mahasiswa TI | Himatif Encoder" breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Ruang Mahasiswa', href: KARYA_PATHS.home }, { label: 'Karya' }]}>
				<div className="max-w-xl mx-auto px-4 py-24 text-center text-muted-foreground">Halaman Karya Mahasiswa sedang dinonaktifkan sementara.</div>
			</KaryaPublicLayout>
		);
	}

	return (
		<KaryaPublicLayout title="Karya Mahasiswa TI — Portofolio Mahasiswa Teknik Informatika UIN Malang | Himatif Encoder" breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Ruang Mahasiswa', href: KARYA_PATHS.home }, { label: 'Karya' }]}>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<PublicSectionHeader
					eyebrow="Karya Mahasiswa"
					title="Karya Mahasiswa TI"
					description="Jelajahi proyek mahasiswa Teknik Informatika UIN Malang: web, mobile, AI, game, IoT, dan desain."
					icon={<Code2 />}
					actions={
						<Button asChild className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90">
							<Link href={KARYA_PATHS.dashboard}>Pajang karyamu</Link>
						</Button>
					}
				/>

				{config?.tutorialYoutubeUrl || config?.tutorialGdriveUrl ? (
					<details className="mb-6 max-w-3xl rounded-xl border border-border bg-card p-3 [&_summary::-webkit-details-marker]:hidden">
						<summary className="cursor-pointer select-none text-sm font-medium text-primary">▶ Tonton tutorial: cara memajang karyamu</summary>
						<KaryaTutorialVideo title="Dari daftar akun sampai karya tayang" className="mt-3" />
					</details>
				) : null}

				<div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1" role="tablist" aria-label="Tampilan">
					{([
						['projects', 'Karya', FolderGit2],
						['students', 'Profil mahasiswa', Users],
					] as const).map(([v, label, Icon]) => (
						<button
							key={v}
							type="button"
							role="tab"
							aria-selected={state.view === v}
							onClick={() => setState((s) => ({ ...s, view: v, page: 1 }))}
							className={cn('inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors', state.view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
							<Icon className="h-4 w-4" aria-hidden /> {label}
						</button>
					))}
				</div>

				<div className={cn('mb-6 grid gap-3', state.view === 'students' ? 'md:grid-cols-[1fr_180px]' : 'md:grid-cols-[1fr_180px_160px_160px]')}>
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
						<Input
							aria-label={state.view === 'students' ? 'Cari nama, username, atau keahlian mahasiswa' : 'Cari karya, teknologi, atau nama mahasiswa'}
							placeholder={state.view === 'students' ? 'Cari nama, username, atau keahlian (mis. flutter)…' : 'Cari karya, teknologi, atau nama mahasiswa…'}
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							className="h-11 pl-9"
						/>
					</div>
					{state.view === 'projects' ? (
					<Select value={state.category || 'all'} onValueChange={(v) => setState((s) => ({ ...s, category: v === 'all' ? '' : v, page: 1 }))}>
						<SelectTrigger className="h-11" aria-label="Kategori">
							<SelectValue placeholder="Kategori" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Semua kategori</SelectItem>
							{catOptions.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.label}
									{catCount.get(c.id) ? <span className="ml-1 opacity-60">({catCount.get(c.id)})</span> : null}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					) : null}
					<Select value={state.angkatan ? String(state.angkatan) : 'all'} onValueChange={(v) => setState((s) => ({ ...s, angkatan: v === 'all' ? 0 : Number(v), page: 1 }))}>
						<SelectTrigger className="h-11" aria-label="Angkatan">
							<SelectValue placeholder="Angkatan" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Semua angkatan</SelectItem>
							{years.map((y) => (
								<SelectItem key={y} value={String(y)}>
									Angkatan {y}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{state.view === 'projects' ? (
					<Select value={state.sort} onValueChange={(v) => setState((s) => ({ ...s, sort: v, page: 1 }))}>
						<SelectTrigger className="h-11" aria-label="Urutkan">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="latest">Terbaru</SelectItem>
							<SelectItem value="popular">Terpopuler</SelectItem>
						</SelectContent>
					</Select>
					) : null}
				</div>

				{state.view === 'students' ? (
					<StudentDirectory q={studentsQ} page={state.page} setPage={(n) => setState((s) => ({ ...s, page: n }))} />
				) : null}

				{state.view === 'projects' && tags?.length ? (
					<div className="mb-8 flex flex-wrap gap-2" aria-label="Tag populer">
						{tags.slice(0, 24).map((t) => (
							<button
								key={t.tag}
								type="button"
								aria-pressed={state.tag === t.tag}
								onClick={() => setState((s) => ({ ...s, tag: s.tag === t.tag ? '' : t.tag, page: 1 }))}
								className={cn(
									'min-h-[36px] rounded-full border px-3 text-sm transition-colors',
									state.tag === t.tag ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
								)}>
								#{t.tag} <span className="opacity-60">{t.count}</span>
							</button>
						))}
					</div>
				) : null}

				{state.view === 'projects' ? (
				<>
				{hasFilter ? (
					<div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
						<span>{isLoading ? 'Mencari…' : `${total} karya ditemukan`}</span>
						<button
							type="button"
							className="inline-flex items-center gap-1 text-primary hover:underline"
							onClick={() => {
								setQInput('');
								setState((s) => ({ q: '', tag: '', category: '', sort: 'latest', angkatan: 0, page: 1, view: s.view }));
							}}>
							<X className="h-3.5 w-3.5" /> Hapus filter
						</button>
					</div>
				) : null}

				{isError ? (
					<p className="py-16 text-center text-muted-foreground">Karya belum bisa dimuat. Coba lagi sebentar lagi.</p>
				) : isLoading ? (
					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{Array.from({ length: 8 }).map((_, i) => (
							<KaryaCardSkeleton key={i} />
						))}
					</div>
				) : items.length === 0 ? (
					<div className="py-16 text-center">
						<p className="text-lg font-semibold text-foreground">{hasFilter ? 'Tidak ada karya yang cocok' : 'Belum ada karya yang tayang'}</p>
						<p className="mt-2 text-sm text-muted-foreground">{hasFilter ? 'Coba kata kunci atau filter lain.' : 'Jadilah yang pertama memajang karya.'}</p>
					</div>
				) : (
					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{items.map((p) => (
							<KaryaCard key={p.slug} item={p} />
						))}
					</div>
				)}

				{pages > 1 ? (
					<nav className="mt-10 flex items-center justify-center gap-2" aria-label="Halaman">
						<Button variant="outline" disabled={state.page <= 1} onClick={() => setState((s) => ({ ...s, page: s.page - 1 }))}>
							Sebelumnya
						</Button>
						<span className="px-3 text-sm text-muted-foreground">
							{state.page} / {pages}
						</span>
						<Button variant="outline" disabled={state.page >= pages} onClick={() => setState((s) => ({ ...s, page: s.page + 1 }))}>
							Berikutnya
						</Button>
					</nav>
				) : null}
				</>
				) : null}
			</div>
		</KaryaPublicLayout>
	);
}

function StudentCard({ s }: { s: KaryaStudentListItem }) {
	return (
		<Link href={KARYA_PATHS.student(s.username)} className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
			<div className="flex items-center gap-3">
				<KaryaAvatar name={s.name} url={s.avatarUrl} className="h-12 w-12 text-sm" />
				<div className="min-w-0">
					<p className="truncate font-semibold text-foreground group-hover:text-primary">{s.name}</p>
					<p className="truncate text-xs text-muted-foreground">
						@{s.username}
						{s.angkatan ? ` · Angkatan ${s.angkatan}` : ''}
					</p>
				</div>
			</div>
			{s.headline ? <p className="line-clamp-2 text-sm text-muted-foreground">{s.headline}</p> : null}
			{(s.topTags.length ? s.topTags : s.skills).length ? (
				<div className="flex flex-wrap gap-1.5">
					{(s.topTags.length ? s.topTags : s.skills).slice(0, 4).map((t) => (
						<span key={t} className={cn('rounded-full px-2 py-0.5 text-xs', karyaTagToneClass(t))}>
							{t}
						</span>
					))}
				</div>
			) : null}
			<p className="mt-auto border-t border-border/60 pt-3 text-xs text-muted-foreground">
				<FolderGit2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
				{s.projectCount} karya tayang
			</p>
		</Link>
	);
}

function StudentDirectory({ q, page, setPage }: { q: ReturnType<typeof usePublicStudents>; page: number; setPage: (n: number) => void }) {
	const rows = q.data?.data || [];
	const total = q.data?.meta.total || 0;
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	if (q.isError) return <p className="py-16 text-center text-muted-foreground">Profil belum bisa dimuat. Coba lagi sebentar lagi.</p>;
	if (q.isLoading)
		return (
			<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{Array.from({ length: 8 }).map((_, i) => (
					<div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
				))}
			</div>
		);
	if (!rows.length)
		return (
			<div className="py-16 text-center">
				<p className="text-lg font-semibold text-foreground">Profil tidak ditemukan</p>
				<p className="mt-2 text-sm text-muted-foreground">Coba nama, username, atau keahlian lain.</p>
			</div>
		);
	return (
		<>
			<p className="mb-4 text-sm text-muted-foreground">{total} mahasiswa</p>
			<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{rows.map((s) => (
					<StudentCard key={s.username} s={s} />
				))}
			</div>
			{pages > 1 ? (
				<nav className="mt-10 flex items-center justify-center gap-2" aria-label="Halaman profil">
					<Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
						Sebelumnya
					</Button>
					<span className="px-3 text-sm text-muted-foreground">
						{page} / {pages}
					</span>
					<Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
						Berikutnya
					</Button>
				</nav>
			) : null}
		</>
	);
}
