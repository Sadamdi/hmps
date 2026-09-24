import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { ArchiveHeader } from '@/components/public/archive/archive-header';
import { ArchiveGridItem, formatArchiveIndex } from '@/components/public/archive/archive-meta';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'wouter';
import { useTenant } from '@/lib/tenant-context';

interface EventYearDoc {
	_id: string;
	year: number;
	isActiveOnHome?: boolean;
}

interface PublishedEventLite {
	_id: string;
	startDate: string;
	yearId: { year: number } | null;
}

export default function EventsYearPicker() {
	const { data, isLoading, isError, refetch } = useQuery<EventYearDoc[]>({
		queryKey: ['/api/event-years'],
		queryFn: async () => {
			const res = await fetch('/api/event-years');
			if (!res.ok) throw new Error('Failed to fetch');
			return res.json();
		},
	});

	// Jumlah kegiatan per tahun — opsional; query key sama dengan /events/all jadi cache dipakai bersama.
	const { data: published } = useQuery<PublishedEventLite[]>({
		queryKey: ['/api/events/published'],
		queryFn: async () => {
			const res = await fetch('/api/events/published');
			if (!res.ok) throw new Error('Failed to fetch');
			return res.json();
		},
	});

	const years = useMemo(() => [...(data ?? [])].sort((a, b) => b.year - a.year), [data]);

	const countByYear = useMemo(() => {
		const m = new Map<number, number>();
		(published ?? []).forEach((ev) => {
			const y = ev.yearId?.year ?? new Date(ev.startDate).getFullYear();
			m.set(y, (m.get(y) ?? 0) + 1);
		});
		return m;
	}, [published]);

	const { basePath } = useTenant();
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<ArchiveHeader
				breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Event' }]}
				eyebrow="Linimasa"
				icon={<CalendarDays />}
				title="Event"
				description="Pilih tahun untuk menelusuri kegiatan dan acara Himpunan."
				stats={
					isLoading || isError
						? undefined
						: [
								{ label: 'Tahun', value: years.length },
								...(published ? [{ label: 'Kegiatan', value: published.length }] : []),
							]
				}
			/>
			<main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
				{isLoading && (
					<div className="grid gap-3 sm:gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
						{[1, 2, 3, 4].map((i) => (
							<Skeleton key={i} className="h-36 rounded-xl" />
						))}
					</div>
				)}

				{isError && (
					<div className="text-center py-12 bg-card border border-border/70 rounded-xl">
						<p className="text-muted-foreground mb-4">Gagal memuat tahun event.</p>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							Coba Lagi
						</Button>
					</div>
				)}

				{!isLoading && !isError && years.length === 0 && (
					<div className="text-center py-12 text-muted-foreground bg-card border border-border/70 rounded-xl">
						Belum ada tahun event yang tersedia.
					</div>
				)}

				{years.length > 0 && (
					<div className="grid gap-3 sm:gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
						{years.map((yr, i) => {
							const count = published ? (countByYear.get(yr.year) ?? 0) : undefined;
							return (
								<ArchiveGridItem key={yr._id} order={i}>
									<Link
										href={`/events/${yr.year}`}
										className="archive-card group flex h-full flex-col justify-between gap-6 rounded-xl border border-border/70 bg-card p-4 sm:p-6 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
										<div className="flex items-start justify-between">
											<span className="archive-index text-muted-foreground">{formatArchiveIndex(i + 1)}</span>
											<ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
										</div>
										<div>
											<span className="block font-mono text-3xl sm:text-5xl font-bold tabular-nums tracking-tight text-foreground group-hover:text-primary transition-colors">
												{yr.year}
											</span>
											<span className="archive-meta mt-1 block">
												{count !== undefined ? `${String(count).padStart(2, '0')} kegiatan` : 'Lihat kegiatan'}
											</span>
										</div>
									</Link>
								</ArchiveGridItem>
							);
						})}
					</div>
				)}

				<div className="mt-10 flex items-center gap-4">
					<span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
					<Link href="/events/all">
						<Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
							Lihat Semua Event
						</Button>
					</Link>
					<span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
				</div>
			</main>
			<Footer />
			<AIChat pageContext={{ path: '/events', permissions: [] }} />
		</div>
	);
}
