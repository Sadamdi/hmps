import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import { ArchiveHeader } from '@/components/public/archive/archive-header';
import { ArchiveFilterBar } from '@/components/public/archive/archive-filter-bar';
import {
	EventTimeline,
	EventTimelineSkeleton,
	groupTimeline,
	useEventArchiveFilters,
	type TimelineEventItem,
} from '@/components/public/events/event-timeline';
import { getEventStatus } from '@/components/public/events-tree';
import { usePagination } from '@/hooks/use-pagination';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'wouter';
import { useTenant } from '@/lib/tenant-context';

interface EventItem extends TimelineEventItem {
	published: boolean;
	attachments?: { name: string; url: string }[];
}

interface EventsByYearResponse {
	yearDoc: { year: number };
	events: EventItem[];
}

export default function EventsYearPage() {
	const { year } = useParams<{ year: string }>();
	const yearNum = year ? parseInt(year, 10) : 0;

	const { data, isLoading, error } = useQuery<EventsByYearResponse>({
		queryKey: ['/api/events/by-year', yearNum],
		queryFn: async () => {
			const res = await fetch(`/api/events/by-year/${yearNum}?parentOnly=true`);
			if (!res.ok) throw new Error('Failed to fetch');
			return res.json();
		},
		enabled: !!yearNum && !isNaN(yearNum),
	});

	const displayYear = data?.yearDoc?.year || yearNum;
	const events = useMemo(() => data?.events ?? [], [data]);
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

	const groups = useMemo(
		() => groupTimeline(paginatedData as EventItem[], () => displayYear),
		[paginatedData, displayYear],
	);

	const stats = useMemo(() => {
		if (isLoading || !data) return undefined;
		const ongoing = events.filter((e) => getEventStatus(e.startDate, e.endDate) === 'ongoing').length;
		const months = new Set(events.map((e) => e.month || new Date(e.startDate).getMonth() + 1)).size;
		return [
			{ label: 'Kegiatan', value: events.length },
			{ label: 'Bulan aktif', value: months },
			...(ongoing > 0 ? [{ label: 'Berlangsung', value: ongoing }] : []),
		];
	}, [isLoading, data, events]);

	const { basePath } = useTenant();
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	if (error || (data === undefined && !isLoading)) {
		return (
			<div className="min-h-screen flex flex-col">
				<Navbar activeSection="" scrollToSection={scrollToSection} />
				<main className="flex-1 flex items-center justify-center p-8">
					<div className="text-center space-y-4">
						<PageBreadcrumb
							items={[
								{ label: 'Beranda', href: '/' },
								{ label: 'Event', href: '/events' },
								{ label: 'Tidak ditemukan' },
							]}
						/>
						<p className="text-muted-foreground">Tahun event tidak ditemukan.</p>
						<Link href="/events">
							<Button variant="outline" size="sm">
								Kembali ke daftar tahun
							</Button>
						</Link>
					</div>
				</main>
				<Footer />
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<ArchiveHeader
				breadcrumb={[
					{ label: 'Beranda', href: '/' },
					{ label: 'Event', href: '/events' },
					{ label: year ? String(year) : '…' },
				]}
				eyebrow={`Linimasa ${displayYear || ''}`.trim()}
				icon={<CalendarDays />}
				title={`Event ${displayYear || ''}`.trim()}
				description="Semua kegiatan dan acara tahun ini, tersusun per bulan."
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
						isLoading ? undefined : (
							<>
								{filters.filtered.length} dari {events.length} kegiatan
							</>
						)
					}
				/>

				<div ref={listRef} className="pt-6 sm:pt-8 scroll-mt-32">
					{isLoading ? (
						<EventTimelineSkeleton />
					) : filters.filtered.length === 0 ? (
						<div className="text-center py-12 bg-card border border-border/70 rounded-xl">
							<p className="text-muted-foreground text-lg mb-2">
								{events.length === 0 ? 'Belum ada event di tahun ini' : 'Tidak ada event ditemukan'}
							</p>
							{events.length > 0 && (
								<Button variant="outline" size="sm" onClick={filters.clearFilters}>
									Reset pencarian
								</Button>
							)}
						</div>
					) : (
						<EventTimeline groups={groups} />
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
			<AIChat pageContext={{ path: `/events/${year}`, permissions: [] }} />
		</div>
	);
}
