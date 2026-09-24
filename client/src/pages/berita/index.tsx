import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import { usePagination } from '@/hooks/use-pagination';
import Navbar from '@/components/public/navbar';
import { ArchiveHeader } from '@/components/public/archive/archive-header';
import { ArchiveFilterBar } from '@/components/public/archive/archive-filter-bar';
import { ArchiveGridItem, ArchiveIndex } from '@/components/public/archive/archive-meta';
import {
	BeritaLead,
	beritaHref,
	formatBeritaDate,
	type BeritaListItem,
} from '@/components/public/berita/berita-lead';
import { useArchiveFilters } from '@/hooks/use-archive-filters';
import { Newspaper } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useTenant } from '@/lib/tenant-context';
import { usePublicBrand } from '@/hooks/use-public-brand';
import { DEFAULT_IMAGE_URL } from '@/constants/default-image';

type BeritaItem = BeritaListItem;

/** Jumlah item yang diambil blok lead (1 utama + 4 terbaru). */
const LEAD_COUNT = 5;
/** Jumlah tag yang tampil sebagai tab. Sisanya tetap ada di panel Filter. */
const TAB_TAG_LIMIT = 8;

/** PRNG deterministik kecil (mulberry32) — agar sampel tab stabil selama satu load halaman. */
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Pilih `limit` tag secara acak berbobot jumlah berita (Efraimidis–Spirakis).
 * Hanya tag dengan >= 2 berita yang jadi kandidat; bila kurang, sisanya diisi tag lain.
 */
function pickWeightedTags(list: { tags?: string[] }[], limit: number, seed: number): string[] {
	const count = new Map<string, number>();
	list.forEach((b) => b.tags?.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
	const rand = mulberry32(seed);
	const keyed = Array.from(count.entries()).map(([tag, w]) => ({
		tag,
		w,
		key: Math.pow(rand() || Number.EPSILON, 1 / w),
	}));
	const byKey = (a: { key: number }, b: { key: number }) => b.key - a.key;
	const primary = keyed.filter((k) => k.w >= 2).sort(byKey);
	const rest = keyed.filter((k) => k.w < 2).sort(byKey);
	return [...primary, ...rest].slice(0, limit).map((k) => k.tag);
}

function readInitialTag(): string[] {
	if (typeof window === 'undefined') return [];
	const tag = new URLSearchParams(window.location.search).get('tag');
	return tag ? [tag] : [];
}

export default function AllBerita() {
	const [beritaList, setBeritaList] = useState<BeritaItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const beritaContainerRef = useRef<HTMLDivElement>(null);
	const [initialTags] = useState(readInitialTag);

	const { basePath } = useTenant();
	const { documentTitle, siteName, isTenant } = usePublicBrand();
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	const filters = useArchiveFilters<BeritaItem>({
		items: beritaList,
		getSearchText: (i) => `${i.title}\n${i.excerpt}`,
		getYear: (i) => new Date(i.createdAt).getFullYear(),
		getTags: (i) => i.tags,
		initialTags,
	});
	const { filtered: filteredBerita, searchTerm, selectedTags, selectedYear, hasActiveFilters } = filters;

	// Lead story hanya saat tidak ada search/filter, supaya hasil pencarian tetap jujur.
	const showLead = !searchTerm && !hasActiveFilters && filteredBerita.length > LEAD_COUNT;
	const gridSource = useMemo(
		() => (showLead ? filteredBerita.slice(LEAD_COUNT) : filteredBerita),
		[showLead, filteredBerita],
	);
	const indexOffset = showLead ? LEAD_COUNT : 0;

	const {
		currentPage,
		totalPages,
		paginatedData,
		setCurrentPage,
		itemsPerPage,
	} = usePagination({
		data: gridSource,
		itemsPerPageDesktop: 9,
		itemsPerPageMobile: 6,
	});
	const paginatedBerita = paginatedData as BeritaItem[];

	useEffect(() => {
		fetchBerita();
	}, []);

	useEffect(() => {
		document.title = documentTitle('Berita');
		const desc = isTenant
			? `Berita dan informasi terkini dari ${siteName}`
			: 'Daftar berita dan informasi terkini dari Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang.';
		const meta = document.querySelector('meta[name="description"]');
		if (meta) meta.setAttribute('content', desc);
	}, [documentTitle, isTenant, siteName]);

	// Setiap perubahan filter kembali ke halaman 1 (perilaku lama).
	useEffect(() => {
		setCurrentPage(1);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchTerm, selectedTags, selectedYear]);

	const fetchBerita = async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch('/api/berita');
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			setBeritaList(data);
		} catch (err) {
			console.error('Error fetching berita:', err);
			setError('Gagal memuat berita. Silakan coba lagi.');
		} finally {
			setLoading(false);
		}
	};

	const isFirstPageRender = useRef(true);
	useEffect(() => {
		if (isFirstPageRender.current) {
			isFirstPageRender.current = false;
			return;
		}
		beritaContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, [currentPage]);

	// Tab: sampel acak berbobot frekuensi, berganti tiap load halaman (seed stabil selama halaman terbuka).
	const [tabSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
	const tabTags = useMemo(
		() => pickWeightedTags(beritaList, TAB_TAG_LIMIT, tabSeed),
		[beritaList, tabSeed],
	);
	// Tag aktif (mis. dari ?tag=) selalu tampil sebagai tab.
	const visibleTabTags = useMemo(() => {
		const extra = selectedTags.filter((t) => !tabTags.includes(t));
		return selectedTags.length === 1 && extra.length ? [...extra, ...tabTags].slice(0, TAB_TAG_LIMIT) : tabTags;
	}, [tabTags, selectedTags]);

	const yearRange = useMemo(() => {
		if (filters.allYears.length === 0) return null;
		const min = filters.allYears[filters.allYears.length - 1];
		const max = filters.allYears[0];
		return min === max ? String(max) : `${min}–${max}`;
	}, [filters.allYears]);

	const activeTab = selectedTags.length === 1 ? selectedTags[0] : selectedTags.length === 0 ? null : undefined;
	const selectTab = (tag: string | null) => filters.setSelectedTags(tag ? [tag] : []);

	const shownCount = (showLead && currentPage === 1 ? LEAD_COUNT : 0) + paginatedBerita.length;

	const header = (
		<ArchiveHeader
			breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Berita' }]}
			eyebrow="Ruang redaksi"
			icon={<Newspaper />}
			title="Cerita, kabar, dan gagasan terbaru."
			description={`Ikuti berita dan informasi terkini dari ${siteName}, disajikan ringkas untuk membantu Anda menemukan hal yang penting.`}
			stats={
				loading || error
					? undefined
					: [
							{ label: 'Berita', value: beritaList.length },
							{ label: 'Topik', value: filters.allTags.length },
							...(yearRange ? [{ label: 'Arsip', value: yearRange }] : []),
						]
			}
		/>
	);

	if (loading || error) {
		return (
			<div className="min-h-screen bg-background">
				<Navbar activeSection="berita" scrollToSection={scrollToSection} />
				{header}
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					{loading ? (
						<div className="grid gap-6 lg:grid-cols-3 py-8" aria-busy="true" aria-label="Memuat berita">
							<div className="lg:col-span-2 rounded-xl border border-border/70 bg-card overflow-hidden animate-pulse">
								<div className="aspect-[16/9] bg-muted" />
								<div className="p-6 space-y-3">
									<div className="h-3 w-40 rounded bg-muted" />
									<div className="h-7 w-5/6 rounded bg-muted" />
								</div>
							</div>
							<div className="space-y-5 animate-pulse">
								{[0, 1, 2, 3].map((i) => (
									<div key={i} className="space-y-2">
										<div className="h-4 w-full rounded bg-muted" />
										<div className="h-3 w-24 rounded bg-muted" />
									</div>
								))}
							</div>
						</div>
					) : (
						<div className="text-center py-24">
							<p className="text-destructive mb-4">{error}</p>
							<Button onClick={fetchBerita} variant="outline">
								Coba Lagi
							</Button>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background relative">
			<Navbar activeSection="berita" scrollToSection={scrollToSection} />

			{header}

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14">
				<ArchiveFilterBar
					searchValue={searchTerm}
					onSearchChange={filters.setSearchTerm}
					searchPlaceholder="Cari berita berdasarkan judul atau deskripsi..."
					groups={filters.groups}
					activeChips={filters.activeChips}
					onClearAll={filters.clearFilters}
					resultText={
						<>
							Menampilkan {shownCount} dari {filteredBerita.length} berita
							{searchTerm && ` untuk "${searchTerm}"`}
						</>
					}>
					{visibleTabTags.length > 0 && (
						<nav aria-label="Topik berita" className="archive-tabs -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
							<ul className="flex w-max gap-1 border-b border-border/70">
								{[null, ...visibleTabTags].map((tag) => {
									const active = activeTab === tag;
									return (
										<li key={tag ?? '__all'}>
											<button
												type="button"
												aria-current={active ? 'page' : undefined}
												onClick={() => selectTab(tag)}
												className={`relative px-3 py-2 font-mono text-[11px] sm:text-xs uppercase tracking-wider whitespace-nowrap transition-colors ${
													active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
												}`}>
												{tag ?? 'Semua'}
												<span
													aria-hidden
													className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary transition-transform duration-200 origin-left ${
														active ? 'scale-x-100' : 'scale-x-0'
													}`}
												/>
											</button>
										</li>
									);
								})}
							</ul>
						</nav>
					)}
				</ArchiveFilterBar>

				<div className="pt-6 sm:pt-8">
					{showLead && currentPage === 1 && (
						<BeritaLead lead={filteredBerita[0]} latest={filteredBerita.slice(1, LEAD_COUNT)} />
					)}

					{filteredBerita.length === 0 ? (
						<div className="text-center py-12 bg-card border border-border/70 rounded-xl">
							<p className="text-muted-foreground text-lg mb-2">Tidak ada berita ditemukan</p>
							<p className="text-muted-foreground/70 text-sm mb-4">Coba sesuaikan pencarian atau filter Anda</p>
							<Button variant="outline" size="sm" onClick={filters.clearFilters}>
								Reset pencarian
							</Button>
						</div>
					) : (
						<>
							{showLead && currentPage === 1 && paginatedBerita.length > 0 && (
								<div className="mb-4 flex items-center gap-3">
									<h2 className="archive-meta text-foreground">Arsip berita</h2>
									<span className="h-px flex-1 bg-gradient-to-r from-cyan-400/50 to-transparent" />
								</div>
							)}
							<div
								ref={beritaContainerRef}
								className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 mb-8 scroll-mt-32">
									{paginatedBerita.map((item, index) => {
										const n = indexOffset + (currentPage - 1) * itemsPerPage + index + 1;
										return (
											<ArchiveGridItem key={item._id} order={index}>
												<article className="archive-card group h-full flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/40">
													<Link href={beritaHref(item)} className="block" tabIndex={-1} aria-hidden>
														<div className="archive-card-media relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden bg-muted">
															<img
																src={item.image}
																alt=""
																loading="lazy"
																className="w-full h-full object-cover"
																onError={(e) => {
																	(e.target as HTMLImageElement).src = DEFAULT_IMAGE_URL;
																}}
															/>
															<ArchiveIndex n={n} overlay />
														</div>
													</Link>
													<div className="flex flex-1 flex-col p-3 sm:p-5">
														<time dateTime={item.createdAt} className="archive-meta">
															{formatBeritaDate(item.createdAt)}
														</time>
														<Link href={beritaHref(item)}>
															<h3 className="mt-1.5 text-[13px] sm:text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
																{item.title}
															</h3>
														</Link>
														<p className="hidden sm:block mt-2 text-muted-foreground text-sm leading-6 line-clamp-2">
															{item.excerpt}
														</p>

														{item.tags && item.tags.length > 0 && (
															<div className="hidden sm:flex flex-wrap gap-1 mt-3">
																{item.tags.slice(0, 3).map((tag: string) => (
																	<Badge key={tag} variant="secondary" className="text-xs">
																		{tag}
																	</Badge>
																))}
																{item.tags.length > 3 && (
																	<Badge variant="outline" className="text-xs">
																		+{item.tags.length - 3} lagi
																	</Badge>
																)}
															</div>
														)}

														<div className="mt-auto pt-3 hidden sm:flex items-center justify-between gap-2 border-t border-border/60 text-xs text-muted-foreground">
															<span className="truncate">{item.authorsDisplay || item.author}</span>
															<span className="archive-meta shrink-0">{item.viewCount ?? 0} pembaca</span>
														</div>
													</div>
												</article>
											</ArchiveGridItem>
										);
									})}
							</div>
						</>
					)}

					<Pagination
						currentPage={currentPage}
						totalPages={totalPages}
						onPageChange={setCurrentPage}
						className="mt-8"
					/>
				</div>
			</main>

			<Footer />

			{/* AI Chat */}
			<AIChat
				pageContext={{
					path: '/berita',
					permissions: [],
				}}
			/>
		</div>
	);
}
