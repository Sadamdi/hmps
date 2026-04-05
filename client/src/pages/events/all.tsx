import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { getEventStatus, formatEventDate, StatusBadge } from '@/components/public/events-tree';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Eye, FileText } from 'lucide-react';
import { Link } from 'wouter';
import { useTenant } from '@/lib/tenant-context';

const MONTH_NAMES = [
	'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
	'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

interface EventItem {
	_id: string;
	title: string;
	description: string;
	thumbnail: string;
	startDate: string;
	endDate: string;
	month: number;
	published: boolean;
	yearId: { year: number } | null;
	attachments?: { name: string; url: string }[];
	relatedBerita?: { _id: string; title: string; slug?: string }[];
	viewCount?: number;
}

interface GroupedByYear {
	year: number;
	months: {
		month: number;
		events: EventItem[];
	}[];
}

function groupEvents(events: EventItem[]): GroupedByYear[] {
	const byYear = new Map<number, Map<number, EventItem[]>>();

	for (const ev of events) {
		const yr = ev.yearId?.year ?? new Date(ev.startDate).getFullYear();
		const mo = ev.month || new Date(ev.startDate).getMonth() + 1;

		if (!byYear.has(yr)) byYear.set(yr, new Map());
		const monthMap = byYear.get(yr)!;
		if (!monthMap.has(mo)) monthMap.set(mo, []);
		monthMap.get(mo)!.push(ev);
	}

	return Array.from(byYear.entries())
		.sort((a, b) => b[0] - a[0])
		.map(([year, monthMap]) => ({
			year,
			months: Array.from(monthMap.entries())
				.sort((a, b) => a[0] - b[0])
				.map(([month, evs]) => ({ month, events: evs })),
		}));
}

export default function EventsAllPage() {
	const { data, isLoading, error } = useQuery<EventItem[]>({
		queryKey: ['/api/events/published'],
		queryFn: async () => {
			const res = await fetch('/api/events/published');
			if (!res.ok) throw new Error('Failed to fetch');
			return res.json();
		},
	});

	const grouped = data ? groupEvents(data) : [];

	const { basePath } = useTenant();
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1 py-12 px-4">
				<div className="max-w-4xl mx-auto">
					<Link href="/">
						<Button variant="ghost" size="sm" className="mb-6">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Kembali ke Beranda
						</Button>
					</Link>

					<h1 className="text-3xl font-bold mb-2">Semua Event</h1>
					<p className="text-muted-foreground mb-8">Seluruh kegiatan dan acara yang telah dipublikasikan</p>

					{isLoading && (
						<div className="space-y-6">
							<Skeleton className="h-8 w-32" />
							<div className="grid gap-4 sm:grid-cols-2">
								{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
							</div>
						</div>
					)}

					{error && (
						<div className="text-center py-12 text-muted-foreground">
							Gagal memuat data event. Silakan coba lagi nanti.
						</div>
					)}

					{!isLoading && !error && grouped.length === 0 && (
						<div className="text-center py-12 text-muted-foreground">
							Belum ada event yang dipublikasikan.
						</div>
					)}

					<div className="space-y-12">
						{grouped.map(({ year, months }) => (
							<div key={year}>
								<h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
									<Calendar className="h-5 w-5" />
									{year}
								</h2>
								<div className="space-y-8">
									{months.map(({ month, events }) => (
										<div key={month}>
											<h3 className="text-lg font-semibold mb-4 text-muted-foreground">
												{MONTH_NAMES[month - 1]}
											</h3>
											<div className="grid gap-4 sm:grid-cols-2">
												{events.map((ev) => {
													const status = getEventStatus(ev.startDate, ev.endDate);
													return (
														<Link key={ev._id} href={`/events/${year}/${ev._id}`}>
															<Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
																{ev.thumbnail && (
																	<div className="aspect-video overflow-hidden">
																		<img src={ev.thumbnail} alt={ev.title} className="w-full h-full object-cover" />
																	</div>
																)}
																<CardContent className="p-4">
																	<div className="flex items-center gap-2 flex-wrap mb-2">
																		<h4 className="font-semibold text-lg">{ev.title}</h4>
																		<StatusBadge status={status} />
																	</div>
																	<p className="text-sm text-muted-foreground flex items-center gap-1">
																		<Calendar className="h-3.5 w-3.5" />
																		{formatEventDate(ev.startDate)} - {formatEventDate(ev.endDate)} {year}
																	</p>
																	<p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
																		<Eye className="h-3 w-3" />
																		{ev.viewCount ?? 0} kali dilihat
																	</p>
																	{ev.description && (
																		<p className="text-sm text-muted-foreground mt-2 line-clamp-2">
																			{ev.description.replace(/<[^>]*>/g, '')}
																		</p>
																	)}
																	{ev.relatedBerita && ev.relatedBerita.length > 0 && (
																		<div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.preventDefault()}>
																			{ev.relatedBerita.map((art) => (
																				<Link
																					key={art._id}
																					href={`/berita/${art._id}${art.slug ? `/${art.slug}` : ''}`}
																				>
																					<Badge variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-secondary/80">
																						<FileText className="h-2.5 w-2.5" />
																						{art.title.length > 20 ? art.title.slice(0, 20) + '…' : art.title}
																					</Badge>
																				</Link>
																			))}
																		</div>
																	)}
																	<Button variant="link" className="p-0 h-auto mt-2">
																		Lihat Detail
																	</Button>
																</CardContent>
															</Card>
														</Link>
													);
												})}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			</main>
			<Footer />
			<AIChat pageContext={{ path: '/events/all', permissions: [] }} />
		</div>
	);
}
