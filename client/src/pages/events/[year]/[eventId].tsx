import AIChat from '@/components/public/ai-chat';
import {
	formatEventDate,
	getEventStatus,
	StatusBadge,
} from '@/components/public/events-tree';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import {
	ArrowLeft,
	Calendar,
	Download,
	ExternalLink,
	Eye,
	FileText,
} from 'lucide-react';
import { Link, useParams } from 'wouter';

interface RelatedArticle {
	_id: string;
	title: string;
	slug?: string;
}

interface EventItem {
	_id: string;
	title: string;
	description: string;
	thumbnail: string;
	startDate: string;
	endDate: string;
	month: number;
	attachments?: { name: string; url: string; type?: string }[];
	children?: EventItem[];
	relatedBerita?: RelatedArticle[];
	viewCount?: number;
}

export default function EventDetailPage() {
	const { year, eventId } = useParams<{ year: string; eventId: string }>();

	const {
		data: event,
		isLoading,
		error,
	} = useQuery<EventItem>({
		queryKey: ['/api/events', eventId],
		queryFn: async () => {
			const res = await fetch(`/api/events/${eventId}?children=true`);
			if (!res.ok) throw new Error('Event not found');
			return res.json();
		},
		enabled: !!eventId,
	});

	const scrollToSection = (id: string) => {
		window.location.href = `/#${id}`;
	};

	if (error || (!isLoading && !event)) {
		return (
			<div className="min-h-screen flex flex-col">
				<Navbar
					activeSection=""
					scrollToSection={scrollToSection}
				/>
				<main className="flex-1 flex items-center justify-center p-8">
					<div className="text-center">
						<p className="text-muted-foreground mb-4">Event tidak ditemukan.</p>
						<Link href={year ? `/events/${year}` : '/'}>
							<Button variant="outline">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Kembali
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
			<Navbar
				activeSection=""
				scrollToSection={scrollToSection}
			/>
			<main className="flex-1 py-12 px-4">
				<div className="max-w-3xl mx-auto">
					<Link href={year ? `/events/${year}` : '/'}>
						<Button
							variant="ghost"
							size="sm"
							className="mb-6">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Kembali ke Daftar Event
						</Button>
					</Link>

					{isLoading ? (
						<div className="h-96 animate-pulse bg-muted rounded-lg" />
					) : event ? (
						<article className="space-y-6">
							{event.thumbnail && (
								<div className="rounded-xl overflow-hidden">
									<img
										src={event.thumbnail}
										alt={event.title}
										className="w-full h-auto max-h-[400px] object-cover"
									/>
								</div>
							)}

						<div className="flex items-center gap-3 flex-wrap">
							<StatusBadge
								status={getEventStatus(event.startDate, event.endDate)}
							/>
							<span className="text-sm text-muted-foreground flex items-center gap-1">
								<Calendar className="h-4 w-4" />
								{formatEventDate(event.startDate)} -{' '}
								{formatEventDate(event.endDate)}{' '}
								{new Date(event.startDate).getFullYear()}
							</span>
							<span className="text-sm text-muted-foreground flex items-center gap-1">
								<Eye className="h-4 w-4" />
								{event.viewCount ?? 0} kali dilihat
							</span>
						</div>

							<h1 className="text-3xl font-bold">{event.title}</h1>

							{event.description && (
								<div
									className="prose prose-sm dark:prose-invert max-w-none"
									dangerouslySetInnerHTML={{ __html: event.description }}
								/>
							)}

							{event.attachments && event.attachments.length > 0 && (
								<div>
									<h2 className="text-lg font-semibold mb-3">Lampiran</h2>
									<div className="space-y-2">
										{event.attachments.map((att, idx) => (
											<a
												key={idx}
												href={att.url}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-2 px-4 py-3 rounded-lg border bg-card hover:bg-accent transition-colors">
												<Download className="h-4 w-4 flex-shrink-0 text-primary" />
												<span className="flex-1 truncate">{att.name}</span>
												<ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
											</a>
										))}
									</div>
								</div>
							)}

							{event.relatedBerita && event.relatedBerita.length > 0 && (
								<div>
									<h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
										<FileText className="h-5 w-5 text-primary" />
										Artikel Terkait
									</h2>
									<div className="space-y-2">
										{event.relatedBerita.map((art) => (
											<Link
												key={art._id}
												href={`/berita/${art._id}${art.slug ? `/${art.slug}` : ''}`}
												className="flex items-center gap-2 px-4 py-3 rounded-lg border bg-card hover:bg-accent transition-colors">
												<FileText className="h-4 w-4 flex-shrink-0 text-primary" />
												<span className="flex-1 truncate font-medium">
													{art.title}
												</span>
												<ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
											</Link>
										))}
									</div>
								</div>
							)}

							{event.children && event.children.length > 0 && (
								<div>
									<h2 className="text-lg font-semibold mb-3">Sub-Event</h2>
									<div className="space-y-3">
										{event.children.map((child) => (
											<Link
												key={child._id}
												href={`/events/${year}/${child._id}`}>
												<Card className="hover:shadow-md transition-shadow cursor-pointer">
													<CardContent className="p-4 flex items-center gap-4">
														{child.thumbnail && (
															<img
																src={child.thumbnail}
																alt={child.title}
																className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
															/>
														)}
														<div className="flex-1 min-w-0">
															<h3 className="font-medium">{child.title}</h3>
															<p className="text-sm text-muted-foreground">
																{formatEventDate(child.startDate)} -{' '}
																{formatEventDate(child.endDate)}
															</p>
														</div>
														<StatusBadge
															status={getEventStatus(
																child.startDate,
																child.endDate,
															)}
														/>
														<Button
															variant="ghost"
															size="sm">
															Lihat Detail
														</Button>
													</CardContent>
												</Card>
											</Link>
										))}
									</div>
								</div>
							)}
						</article>
					) : null}
				</div>
			</main>
			<Footer />
			<AIChat
				pageContext={{ path: `/events/${year}/${eventId}`, permissions: [] }}
			/>
		</div>
	);
}
