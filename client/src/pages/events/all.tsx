import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { ArchiveHeader } from '@/components/public/archive/archive-header';
import { ArchiveFilterBar } from '@/components/public/archive/archive-filter-bar';
import {
	EventTimeline,
	EventTimelineSkeleton,
	groupTimeline,
	useEventArchiveFilters,
	type TimelineEventItem,
} from '@/components/public/events/event-timeline';
import { usePagination } from '@/hooks/use-pagination';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTenant } from '@/lib/tenant-context';

interface EventItem extends TimelineEventItem {
	published: boolean;
	yearId: { year: number } | null;
	attachments?: { name: string; url: string }[];
}

function eventYear(ev: EventItem) {
	return ev.yearId?.year ?? new Date(ev.startDate).getFullYear();
}

export default function EventsAllPage() {
	const { data, isLoading, error, refetch } = useQuery<EventItem[]>({
		queryKey: ['/api/events/published'],
		queryFn: async () => {
			const res = await fetch('/api/events/published');
			if (!res.ok) throw new Error('Failed to fetch');
			return res.json();
		},
	});

	// Urutan tampil: tahun terbaru dulu, bulan naik dalam tahun (sama seperti sebelumnya).
	const events = useMemo(() => {
		const list = data ?? [];
		return groupTimeline(list, eventYear).flatMap((g) => g.months.flatMap((m) => m.events as EventItem[]));
	}, [data]);

	const filters = useEventArchiveFilters(events);

	const { currentPage, totalPages, paginatedData, setCurrentPage } = usePagination({
		data: filters.filtered,
		itemsPerPageDesktop: 12,
		itemsPerPageMobile: 6,
	});

	useEffect(() => {
		setCurrentPage(1);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filters.searchTerm, filters.status]);

	const listRef = useRef<HTMLDivElement>(null);
	const firstRender = useRef(true);
	useEffect(() => {
		if (firstRender.current) {
			firstRender.current = false;
			return;
		}
		listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, [currentPage]);

	const groups = useMemo(() => groupTimeline(paginatedData as EventItem[], eventYear), [paginatedData]);

	const stats = useMemo(() => {
		if (isLoading || error) return undefined;
		const years = new Set(events.map(eventYear));
		return [
			{ label: 'Kegiatan', value: events.length },
			{ label: 'Tahun', value: years.size },
		];
	}, [isLoading, error, events]);

	const { basePath } = useTenant();
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<ArchiveHeader
				breadcrumb={[
					{ label: 'Beranda', href: '/' },
					{ label: 'Event', href: '/events' },
					{ label: 'Semua' },
				]}
				eyebrow="Linimasa"
				icon={<CalendarRange />}
				title="Semua Event"
				description="Seluruh kegiatan dan acara yang telah dipublikasikan, dari yang terbaru."
				stats={stats}
			/>
			<main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
				<ArchiveFilterBar
					searchValue={filters.searchTerm}
					onSearchChange={filters.setSearchTerm}
					searchPlaceholder="Cari event berdasarkan judul atau deskripsi..."
					groups={filters.groups}
					activeChips={filters.activeChips}
					onClearAll={filters.clearFilters}
					resultText={
						isLoading || error ? undefined : (
							<>
								{filters.filtered.length} dari {events.length} kegiatan
							</>
						)
					}
				/>

				<div ref={listRef} className="pt-6 sm:pt-8 scroll-mt-32">
					{isLoading ? (
						<EventTimelineSkeleton />
					) : error ? (
						<div className="text-center py-12 bg-card border border-border/70 rounded-xl">
							<p className="text-muted-foreground mb-4">Gagal memuat data event. Silakan coba lagi nanti.</p>
							<Button variant="outline" size="sm" onClick={() => refetch()}>
								Coba Lagi
							</Button>
						</div>
					) : filters.filtered.length === 0 ? (
						<div className="text-center py-12 bg-card border border-border/70 rounded-xl">
							<p className="text-muted-foreground text-lg mb-2">
								{events.length === 0 ? 'Belum ada event yang dipublikasikan.' : 'Tidak ada event ditemukan'}
							</p>
							{events.length > 0 && (
								<Button variant="outline" size="sm" onClick={filters.clearFilters}>
									Reset pencarian
								</Button>
							)}
						</div>
					) : (
						<EventTimeline groups={groups} showYearHeadings />
					)}

					<Pagination
						currentPage={currentPage}
						totalPages={totalPages}
						onPageChange={setCurrentPage}
						className="mt-10"
					/>
				</div>
			</main>
			<Footer />
			<AIChat pageContext={{ path: '/events/all', permissions: [] }} />
		</div>
	);
}
