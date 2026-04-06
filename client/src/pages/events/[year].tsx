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
import { Link, useParams } from 'wouter';
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
	attachments?: { name: string; url: string }[];
	relatedBerita?: { _id: string; title: string; slug?: string }[];
	viewCount?: number;
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

	const eventsByMonth = (data?.events || []).reduce<Record<number, EventItem[]>>((acc, ev) => {
		const m = ev.month || new Date(ev.startDate).getMonth() + 1;
		if (!acc[m]) acc[m] = [];
		acc[m].push(ev);
		return acc;
	}, {});

	const months = Object.keys(eventsByMonth)
		.map(Number)
		.sort((a, b) => a - b);

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
					<div className="text-center">
						<p className="text-muted-foreground mb-4">Tahun event tidak ditemukan.</p>
						<Link href="/">
							<Button variant="outline">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Kembali ke Beranda
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
			<main className="flex-1 py-12 px-4">
				<div className="max-w-4xl mx-auto">
					<Link href="/">
						<Button variant="ghost" size="sm" className="mb-6">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Kembali ke Beranda
						</Button>
					</Link>

					{isLoading ? (
						<div className="space-y-6">
							<Skeleton className="h-10 w-48" />
							<Skeleton className="h-64 w-full" />
						</div>
					) : (
						<>
							<h1 className="text-3xl font-bold mb-2">Event {data?.yearDoc?.year || year}</h1>
							<p className="text-muted-foreground mb-8">Semua kegiatan dan acara tahun ini</p>

							<div className="space-y-10">
								{months.map((month) => (
									<div key={month}>
										<h2 className="text-xl font-semibold text-primary mb-4">
											{MONTH_NAMES[month - 1]}
										</h2>
										<div className="grid gap-4 sm:grid-cols-2">
											{eventsByMonth[month].map((ev) => {
												const status = getEventStatus(ev.startDate, ev.endDate);
												return (
													<Link key={ev._id} href={`/events/${year}/${ev._id}`}>
														<Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
															{ev.thumbnail && (
																<div className="aspect-video overflow-hidden">
																	<img
																		src={ev.thumbnail}
																		alt={ev.title}
																		className="w-full h-full object-cover"
																	/>
																</div>
															)}
															<CardContent className="p-4">
																<div className="flex items-center gap-2 flex-wrap mb-2">
																	<h3 className="font-semibold text-lg">{ev.title}</h3>
																	<StatusBadge status={status} />
																</div>
																<p className="text-sm text-muted-foreground flex items-center gap-1">
																	<Calendar className="h-3.5 w-3.5" />
																	{formatEventDate(ev.startDate)} - {formatEventDate(ev.endDate)} {data?.yearDoc?.year}
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
																				href={art.slug ? `/berita/${art.slug}` : `/berita/${art._id}`}
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
						</>
					)}
				</div>
			</main>
			<Footer />
			<AIChat pageContext={{ path: `/events/${year}`, permissions: [] }} />
		</div>
	);
}
