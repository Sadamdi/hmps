import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import { LibraryGalleryCard, deriveItemYear } from '@/components/public/library';
import type { LibraryDetailItem as LibraryItem } from '@/components/public/library-item-detail';
import Navbar from '@/components/public/navbar';
import { ArchiveHeader } from '@/components/public/archive/archive-header';
import { ArchiveFilterBar } from '@/components/public/archive/archive-filter-bar';
import { ArchiveGridItem } from '@/components/public/archive/archive-meta';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { useArchiveFilters } from '@/hooks/use-archive-filters';
import { usePagination } from '@/hooks/use-pagination';
import { useTenant } from '@/lib/tenant-context';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

interface PaginatedResponse<T> {
	data: T[];
}

/** Sama dengan limit varian `page` sebelumnya di components/public/library.tsx. */
const LIST_LIMIT = 100;

export default function LibraryPage() {
	const { basePath } = useTenant();
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	const {
		data: libraryItems = [],
		isLoading,
		isError,
		refetch,
	} = useQuery<LibraryItem[]>({
		queryKey: ['/api/library', 'page', LIST_LIMIT],
		queryFn: async () => {
			const response = await fetch(`/api/library?page=1&limit=${LIST_LIMIT}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const payload = (await response.json()) as LibraryItem[] | PaginatedResponse<LibraryItem>;
			if (Array.isArray(payload)) return payload;
			return payload?.data ?? [];
		},
		staleTime: 60 * 1000,
	});

	const filters = useArchiveFilters<LibraryItem>({
		items: libraryItems,
		getSearchText: (i) => `${i.title}\n${i.description ?? ''}`,
		getYear: deriveItemYear,
		getTags: (i) => i.tags,
	});
	const { filtered, searchTerm, selectedTags, selectedYear } = filters;

	const { currentPage, totalPages, paginatedData, setCurrentPage, itemsPerPage } = usePagination({
		data: filtered,
		itemsPerPageDesktop: 9,
		itemsPerPageMobile: 6,
	});
	const pageItems = paginatedData as LibraryItem[];

	useEffect(() => {
		setCurrentPage(1);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchTerm, selectedTags, selectedYear]);

	const gridRef = useRef<HTMLDivElement>(null);
	const firstRender = useRef(true);
	useEffect(() => {
		if (firstRender.current) {
			firstRender.current = false;
			return;
		}
		gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, [currentPage]);

	const stats = useMemo(() => {
		if (isLoading || isError) return undefined;
		const videos = libraryItems.filter((i) => i.type === 'video').length;
		return [
			{ label: 'Koleksi', value: libraryItems.length },
			...(videos > 0 ? [{ label: 'Video', value: videos }] : []),
			{ label: 'Tahun', value: filters.allYears.length },
		];
	}, [isLoading, isError, libraryItems, filters.allYears.length]);

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<ArchiveHeader
				breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Galeri' }]}
				eyebrow="Galeri"
				icon={<BookOpen />}
				title="Arsip visual kegiatan Himpunan."
				description="Koleksi foto dan video kegiatan Himpunan — buka satu untuk melihat seluruh dokumentasinya."
				stats={stats}
			/>
			<main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
				<ArchiveFilterBar
					searchValue={searchTerm}
					onSearchChange={filters.setSearchTerm}
					searchPlaceholder="Cari di galeri..."
					groups={filters.groups}
					activeChips={filters.activeChips}
					onClearAll={filters.clearFilters}
					resultText={
						isLoading || isError ? undefined : (
							<>
								Menampilkan {pageItems.length} dari {filtered.length} koleksi
							</>
						)
					}
				/>

				<div className="pt-6 sm:pt-8">
					{isLoading ? (
						<div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6" aria-busy="true" aria-label="Memuat galeri">
							{[...Array(6)].map((_, i) => (
								<div key={i} className="animate-pulse rounded-xl overflow-hidden border border-border/60 bg-card">
									<div className="aspect-[4/3] sm:h-48 bg-muted" />
									<div className="p-3 sm:p-5 space-y-2">
										<div className="h-3 sm:h-4 bg-muted rounded w-full" />
										<div className="hidden sm:block h-4 bg-muted rounded w-5/6" />
									</div>
								</div>
							))}
						</div>
					) : isError ? (
						<div className="text-center py-16 bg-card border border-border/70 rounded-xl">
							<p className="text-destructive mb-4">Gagal memuat galeri. Silakan coba lagi.</p>
							<Button variant="outline" onClick={() => refetch()}>
								Coba Lagi
							</Button>
						</div>
					) : filtered.length === 0 ? (
						<div className="text-center py-12 bg-card border border-border/70 rounded-xl">
							<p className="text-muted-foreground text-lg mb-2">
								{libraryItems.length === 0 ? 'Belum ada koleksi galeri' : 'Tidak ada koleksi ditemukan'}
							</p>
							{libraryItems.length > 0 && (
								<>
									<p className="text-muted-foreground/70 text-sm mb-4">Coba sesuaikan pencarian atau filter Anda</p>
									<Button variant="outline" size="sm" onClick={filters.clearFilters}>
										Reset pencarian
									</Button>
								</>
							)}
						</div>
					) : (
						<div ref={gridRef} className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 scroll-mt-32">
								{pageItems.map((item, index) => (
									<ArchiveGridItem key={item._id || item.id} order={index}>
										<LibraryGalleryCard
											item={item}
											index={index}
											archiveIndex={(currentPage - 1) * itemsPerPage + index + 1}
										/>
									</ArchiveGridItem>
								))}
						</div>
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
			<AIChat pageContext={{ path: '/library', permissions: [] }} />
		</div>
	);
}
