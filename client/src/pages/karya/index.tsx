import { KaryaCard, KaryaCardSkeleton } from '@/components/karya/karya-card';
import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { PublicSectionHeader } from '@/components/public/section-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KARYA_PATHS, useKaryaConfig, usePublicProjects, usePublicTags } from '@/hooks/use-karya';
import { cn } from '@/lib/utils';
import { KARYA_CATEGORIES } from '@shared/karya';
import { Code2, Search, X } from 'lucide-react';
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
	};
}

export default function KaryaIndexPage() {
	const [location] = useLocation();
	const initial = useMemo(readParams, [location]);
	const [qInput, setQInput] = useState(initial.q);
	const [state, setState] = useState(initial);
	const { data: config } = useKaryaConfig();
	const { data: tags } = usePublicTags();
	const { data, isLoading, isError } = usePublicProjects({ ...state, limit: PAGE_SIZE });

	// Simpan filter di URL agar bisa dibagikan & tombol back berfungsi
	useEffect(() => {
		const sp = new URLSearchParams();
		if (state.q) sp.set('q', state.q);
		if (state.tag) sp.set('tag', state.tag);
		if (state.category) sp.set('kategori', state.category);
		if (state.sort === 'popular') sp.set('urut', 'populer');
		if (state.angkatan) sp.set('angkatan', String(state.angkatan));
		if (state.page > 1) sp.set('hal', String(state.page));
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
			<KaryaPublicLayout title="Karya Mahasiswa TI | Himatif Encoder" breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Karya TI' }]}>
				<div className="max-w-xl mx-auto px-4 py-24 text-center text-muted-foreground">Halaman Karya Mahasiswa sedang dinonaktifkan sementara.</div>
			</KaryaPublicLayout>
		);
	}

	return (
		<KaryaPublicLayout title="Karya Mahasiswa TI — Portofolio Mahasiswa Teknik Informatika UIN Malang | Himatif Encoder" breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Karya TI' }]}>
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

				<div className="mb-6 grid gap-3 md:grid-cols-[1fr_180px_160px_160px]">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
						<Input
							aria-label="Cari karya, teknologi, atau nama mahasiswa"
							placeholder="Cari karya, teknologi, atau nama mahasiswa…"
							value={qInput}
							onChange={(e) => setQInput(e.target.value)}
							className="h-11 pl-9"
						/>
					</div>
					<Select value={state.category || 'all'} onValueChange={(v) => setState((s) => ({ ...s, category: v === 'all' ? '' : v, page: 1 }))}>
						<SelectTrigger className="h-11" aria-label="Kategori">
							<SelectValue placeholder="Kategori" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Semua kategori</SelectItem>
							{KARYA_CATEGORIES.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
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
					<Select value={state.sort} onValueChange={(v) => setState((s) => ({ ...s, sort: v, page: 1 }))}>
						<SelectTrigger className="h-11" aria-label="Urutkan">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="latest">Terbaru</SelectItem>
							<SelectItem value="popular">Terpopuler</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{tags?.length ? (
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

				{hasFilter ? (
					<div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
						<span>{isLoading ? 'Mencari…' : `${total} karya ditemukan`}</span>
						<button
							type="button"
							className="inline-flex items-center gap-1 text-primary hover:underline"
							onClick={() => {
								setQInput('');
								setState({ q: '', tag: '', category: '', sort: 'latest', angkatan: 0, page: 1 });
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
			</div>
		</KaryaPublicLayout>
	);
}
