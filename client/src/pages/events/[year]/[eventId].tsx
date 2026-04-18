import AIChat from '@/components/public/ai-chat';
import CommentThread from '@/components/public/comment-thread';
import {
	formatEventDate,
	getEventStatus,
	StatusBadge,
} from '@/components/public/events-tree';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import EventAttachmentPreviewDialog, {
	type EventAttachmentPreviewItem,
} from '@/components/public/event-attachment-preview-dialog';
import RichHtmlWithEmbeds from '@/components/public/rich-html-with-embeds';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTenant } from '@/lib/tenant-context';
import { useQuery } from '@tanstack/react-query';
import {
	Calendar,
	Download,
	ExternalLink,
	Eye,
	FileText,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { isObjectId, toSlug } from '@/utils/slug';

interface RelatedBerita {
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
	relatedBerita?: RelatedBerita[];
	viewCount?: number;
}

export default function EventDetailPage() {
	const { year, eventId } = useParams<{ year: string; eventId: string }>();
	const [, setLocation] = useLocation();
	const eventSlug = eventId && !isObjectId(eventId) ? eventId : undefined;
	const eventObjectId = eventId && isObjectId(eventId) ? eventId : undefined;
	const endpoint = eventSlug
		? `/api/events/year/${year}/slug/${eventSlug}?children=true`
		: `/api/events/${eventObjectId}?children=true`;

	const {
		data: event,
		isLoading,
		error,
	} = useQuery<EventItem>({
		queryKey: ['event-detail', year, eventId],
		queryFn: async () => {
			const res = await fetch(endpoint);
			if (!res.ok) throw new Error('Event not found');
			return res.json();
		},
		enabled: !!year && !!eventId,
	});

	const { basePath } = useTenant();
	const [attachmentPreview, setAttachmentPreview] = useState<EventAttachmentPreviewItem | null>(null);
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	useEffect(() => {
		if (event && year && eventId && isObjectId(eventId)) {
			const normalized = toSlug(event.title);
			if (normalized) setLocation(`/events/${year}/${normalized}`);
		}
	}, [event, eventId, setLocation, year]);

	if (error || (!isLoading && !event)) {
		return (
			<div className="min-h-screen flex flex-col">
				<Navbar
					activeSection=""
					scrollToSection={scrollToSection}
				/>
				<main className="flex-1 flex items-center justify-center p-8">
					<div className="text-center space-y-4">
						<PageBreadcrumb
							items={[
								{ label: 'Beranda', href: '/' },
								{ label: 'Event', href: '/events' },
								...(year ? [{ label: year, href: `/events/${year}` }] : []),
								{ label: 'Tidak ditemukan' },
							]}
						/>
						<p className="text-muted-foreground">Event tidak ditemukan.</p>
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
					{!isLoading && event ? (
						<PageBreadcrumb
							items={[
								{ label: 'Beranda', href: '/' },
								{ label: 'Event', href: '/events' },
								...(year ? [{ label: year, href: `/events/${year}` }] : []),
								{
									label:
										event.title.length > 48
											? `${event.title.slice(0, 48)}…`
											: event.title,
								},
							]}
						/>
					) : (
						<PageBreadcrumb
							items={[
								{ label: 'Beranda', href: '/' },
								{ label: 'Event', href: '/events' },
								...(year ? [{ label: year, href: `/events/${year}` }] : []),
								{ label: '…' },
							]}
						/>
					)}

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
								<RichHtmlWithEmbeds
									content={event.description}
									className="prose prose-sm dark:prose-invert max-w-none"
								/>
							)}

							{event.attachments && event.attachments.length > 0 && (
								<div>
									<h2 className="text-lg font-semibold mb-3">Lampiran</h2>
									<div className="space-y-2">
										{event.attachments.map((att, idx) => (
											<button
												key={idx}
												type="button"
												onClick={() => setAttachmentPreview(att)}
												className="flex items-center gap-2 px-4 py-3 rounded-lg border bg-card hover:bg-accent transition-colors">
												<Download className="h-4 w-4 flex-shrink-0 text-primary" />
												<span className="flex-1 truncate">{att.name}</span>
												<ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
											</button>
										))}
									</div>
								</div>
							)}

							{event.relatedBerita && event.relatedBerita.length > 0 && (
								<div>
									<h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
										<FileText className="h-5 w-5 text-primary" />
										Berita Terkait
									</h2>
									<div className="space-y-2">
										{event.relatedBerita.map((art) => (
											<Link
												key={art._id}
												href={art.slug ? `/berita/${art.slug}` : `/berita/${art._id}`}
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
												href={`/events/${year}/${toSlug(child.title) || child._id}`}>
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
							{/* Komentar */}
							<CommentThread
								targetType="event"
								targetId={event._id}
							/>
						</article>
					) : null}
				</div>
			</main>
			<Footer />
			<EventAttachmentPreviewDialog
				preview={attachmentPreview}
				onOpenChange={(open) => {
					if (!open) setAttachmentPreview(null);
				}}
			/>
			<AIChat
				pageContext={{ path: `/events/${year}/${eventSlug || (event ? toSlug(event.title) : eventId)}`, permissions: [] }}
			/>
		</div>
	);
}
