import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { EventItem, EventYear, EventStatus } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Download, ExternalLink, Eye, FileText } from 'lucide-react';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';

const MONTH_NAMES = [
	'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
	'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function getEventStatus(startDate: string | Date, endDate: string | Date): EventStatus {
	const now = new Date();
	const start = new Date(startDate);
	const end = new Date(endDate);
	if (now >= start && now <= end) return 'ongoing';
	if (now < start) return 'soon';
	return 'expired';
}

export function formatEventDate(d: string | Date) {
	const date = new Date(d);
	return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export function StatusBadge({ status }: { status: EventStatus }) {
	switch (status) {
		case 'ongoing':
			return (
				<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
					<span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
					On Going
				</span>
			);
		case 'soon':
			return (
				<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
					Segera
				</span>
			);
		case 'expired':
			return (
				<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gray-500/20 text-gray-400 border border-gray-500/30">
					Selesai
				</span>
			);
	}
}

interface EventWithChildren extends EventItem {
	children?: EventItem[];
}

interface HomeEventsResponse {
	year: EventYear | null;
	events: EventWithChildren[];
}

export interface EventsTreeRef {
	scrollToMonth: (month: number) => void;
}

function EventBranchPill({
	event,
	onClick,
	delay,
}: {
	event: EventItem;
	onClick: () => void;
	delay: number;
}) {
	const status = getEventStatus(event.startDate, event.endDate);
	const ref = useRef<HTMLButtonElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => { if (entry.isIntersecting) setVisible(true); },
			{ threshold: 0.15 },
		);
		if (ref.current) observer.observe(ref.current);
		return () => observer.disconnect();
	}, []);

	return (
		<button
			ref={ref}
			type="button"
			onClick={onClick}
			className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/50 transition-all duration-300 text-left min-w-0 max-w-[180px]"
			style={{
				opacity: visible ? 1 : 0,
				transform: visible ? 'translateX(0)' : 'translateX(-12px)',
				transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
			}}
		>
			<span className="text-xs font-medium text-white truncate flex-1 min-w-0">{event.title}</span>
			<StatusBadge status={status} />
		</button>
	);
}

const scrollToMonthFn = (monthRefs: React.RefObject<Map<number, HTMLDivElement>>, scrollRef: React.RefObject<HTMLDivElement | null>) => (month: number) => {
	const el = monthRefs.current?.get(month);
	if (el && scrollRef.current) {
		el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
	}
};

export default function EventsTree({ scrollToMonthRef }: { scrollToMonthRef?: React.RefObject<EventsTreeRef | null> }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const monthRefs = useRef<Map<number, HTMLDivElement>>(new Map());
	const [selectedEvent, setSelectedEvent] = useState<EventWithChildren | null>(null);
	const [showSubEvents, setShowSubEvents] = useState<EventWithChildren | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [startX, setStartX] = useState(0);
	const [scrollLeft, setScrollLeft] = useState(0);

	const { data, isLoading } = useQuery<HomeEventsResponse>({
		queryKey: ['/api/events/active-home'],
		staleTime: 30 * 1000,
	});

	const eventsByMonth = useMemo(() => {
		if (!data?.events) return [];
		const map = new Map<number, EventWithChildren[]>();
		for (const ev of data.events) {
			const month = ev.month || new Date(ev.startDate).getMonth() + 1;
			if (!map.has(month)) map.set(month, []);
			map.get(month)!.push(ev);
		}
		return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
	}, [data]);

	useImperativeHandle(scrollToMonthRef, () => ({
		scrollToMonth: (month: number) => scrollToMonthFn(monthRefs, scrollRef)(month),
	}), []);

	// Listen for custom event from navbar
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent<{ month: number }>).detail;
			if (detail?.month) {
				setTimeout(() => scrollToMonthFn(monthRefs, scrollRef)(detail.month), 400);
			}
		};
		window.addEventListener('events-scroll-to-month', handler);
		return () => window.removeEventListener('events-scroll-to-month', handler);
	}, []);

	// Check sessionStorage when mounted (e.g. from navbar on another page)
	useEffect(() => {
		const stored = sessionStorage.getItem('eventsScrollToMonth');
		if (stored) {
			const month = parseInt(stored, 10);
			sessionStorage.removeItem('eventsScrollToMonth');
			if (month >= 1 && month <= 12) {
				setTimeout(() => scrollToMonthFn(monthRefs, scrollRef)(month), 600);
			}
		}
	}, [data]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		setIsDragging(true);
		setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
		setScrollLeft(scrollRef.current?.scrollLeft || 0);
	}, []);

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		if (!isDragging) return;
		e.preventDefault();
		const x = e.pageX - (scrollRef.current?.offsetLeft || 0);
		const walk = (x - startX) * 1.5;
		if (scrollRef.current) scrollRef.current.scrollLeft = scrollLeft - walk;
	}, [isDragging, startX, scrollLeft]);

	const handleMouseUp = useCallback(() => setIsDragging(false), []);

	const handleEventClick = useCallback((event: EventWithChildren) => {
		if (event.children && event.children.length > 0) {
			setShowSubEvents(event);
		} else {
			setSelectedEvent(event);
		}
	}, []);

	if (isLoading) {
		return (
			<section className="py-16 px-4" id="events">
				<div className="max-w-7xl mx-auto">
					<Skeleton className="h-8 w-64 mx-auto mb-8" />
					<div className="flex gap-6 overflow-hidden">
						{[1, 2, 3, 4].map((i) => (
							<Skeleton key={i} className="w-40 h-24 rounded-xl flex-shrink-0" />
						))}
					</div>
				</div>
			</section>
		);
	}

	if (!data?.year || eventsByMonth.length === 0) return null;

	return (
		<section className="py-16 px-4 relative overflow-hidden" id="events">
			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
			</div>

			<div className="max-w-7xl mx-auto relative">
				<div className="text-center mb-10" data-aos="fade-up">
					<h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">
						Event {data.year.year}
					</h2>
					<p className="text-gray-400 text-sm">
						Kegiatan dan acara sepanjang tahun
					</p>
				</div>

				<div className="relative">
					<div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
					<div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

					<div
						ref={scrollRef}
						className="flex items-start gap-0 overflow-x-auto pb-6 pt-2 px-8 scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent select-none"
						style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
						onMouseUp={handleMouseUp}
						onMouseLeave={handleMouseUp}
					>
						<div className="flex flex-col items-center flex-shrink-0 mr-2" data-aos="fade-right">
							<div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center backdrop-blur-sm">
								<span className="text-xl font-bold text-primary">{data.year.year}</span>
							</div>
						</div>

						{eventsByMonth.map(([month, monthEvents], mIdx) => (
							<div
								key={month}
								ref={(el) => { if (el) monthRefs.current.set(month, el); }}
								className="flex items-start flex-shrink-0"
							>
								<div className="flex items-center self-center">
									<div
										className="h-0.5 bg-gradient-to-r from-primary/50 to-primary/30"
										style={{ width: mIdx === 0 ? '2rem' : '1.5rem' }}
									/>
								</div>

								<div className="flex flex-col items-center flex-shrink-0">
									<div
										className="px-4 py-2 rounded-full bg-primary/15 border border-primary/30 backdrop-blur-sm mb-2"
										data-aos="zoom-in"
										data-aos-delay={mIdx * 80}
									>
										<span className="text-sm font-semibold text-primary whitespace-nowrap">
											{MONTH_NAMES[month - 1]}
										</span>
									</div>

									<div className="w-0.5 h-3 bg-primary/30" />

									<div className="flex flex-wrap gap-2 justify-center max-w-[220px]">
										{monthEvents.map((ev, eIdx) => (
											<EventBranchPill
												key={ev._id}
												event={ev}
												onClick={() => handleEventClick(ev)}
												delay={mIdx * 80 + eIdx * 60}
											/>
										))}
									</div>
								</div>
							</div>
						))}
					</div>

					<p className="text-center text-xs text-gray-500 mt-2">
						← Geser untuk melihat lebih banyak →
					</p>
				</div>

				{/* Tombol Lihat Semua Event */}
				<div className="mt-8 text-center">
					<Link href={`/events/${data.year.year}`}>
						<Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
							Lihat Semua Event {data.year.year}
						</Button>
					</Link>
				</div>
			</div>

			{/* Sub-events modal */}
			<Dialog open={!!showSubEvents} onOpenChange={(o) => { if (!o) setShowSubEvents(null); }}>
				<DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto bg-black/90 border-white/10 backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-white text-xl">{showSubEvents?.title}</DialogTitle>
					</DialogHeader>
					{showSubEvents && (
						<div className="space-y-4">
							{showSubEvents.thumbnail && (
								<div className="w-full rounded-lg overflow-hidden">
									<img src={showSubEvents.thumbnail} alt={showSubEvents.title} className="w-full h-auto max-h-64 object-cover" />
								</div>
							)}
							<div className="flex items-center gap-3 flex-wrap">
								<StatusBadge status={getEventStatus(showSubEvents.startDate, showSubEvents.endDate)} />
								<span className="text-sm text-gray-400 flex items-center gap-1">
									<Calendar className="h-3.5 w-3.5" />
									{formatEventDate(showSubEvents.startDate)} - {formatEventDate(showSubEvents.endDate)} {new Date(showSubEvents.startDate).getFullYear()}
								</span>
								<span className="text-xs text-gray-400 flex items-center gap-1">
									<Eye className="h-3 w-3" />
									{showSubEvents.viewCount ?? 0} kali dilihat
								</span>
							</div>
							{showSubEvents.description && (
								<p className="text-sm text-gray-300">{showSubEvents.description.replace(/<[^>]*>/g, '')}</p>
							)}

						<div className="flex gap-2">
							<Link href={`/events/${data.year.year}/${showSubEvents._id}`}>
								<Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
									<ExternalLink className="h-4 w-4 mr-2" />
									Lihat Detail
								</Button>
							</Link>
							<Button
								variant="outline"
								size="sm"
								className="border-white/20 text-white hover:bg-white/10"
								onClick={() => {
									setSelectedEvent(showSubEvents);
									setShowSubEvents(null);
								}}
							>
								<FileText className="h-4 w-4 mr-2" />
								Detail Event Utama
							</Button>
						</div>
						{showSubEvents.relatedArticles && showSubEvents.relatedArticles.length > 0 && (
							<div>
								<h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Artikel Terkait</h4>
								<div className="space-y-1.5">
									{showSubEvents.relatedArticles.map((art) => (
										<Link
											key={art._id}
											href={`/artikel/${art._id}${art.slug ? `/${art.slug}` : ''}`}
											className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-primary"
										>
											<FileText className="h-4 w-4 flex-shrink-0" />
											<span className="flex-1 truncate">{art.title}</span>
											<ExternalLink className="h-3 w-3 flex-shrink-0 text-gray-500" />
										</Link>
									))}
								</div>
							</div>
						)}

							<div className="mt-4">
								<h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Sub-Event</h3>
								<div className="space-y-3 relative">
									<div className="absolute left-5 top-0 bottom-0 w-0.5 bg-primary/20" />
									{showSubEvents.children?.map((child, idx) => {
										const childStatus = getEventStatus(child.startDate, child.endDate);
										return (
											<div
												key={child._id}
												className="flex items-start gap-3 relative pl-10 cursor-pointer group"
												onClick={() => {
													setSelectedEvent(child);
													setShowSubEvents(null);
												}}
												style={{
													animation: `slideInLeft 0.4s ease forwards`,
													animationDelay: `${idx * 100}ms`,
													opacity: 0,
												}}
											>
												<div className="absolute left-3.5 top-4 w-4 h-0.5 bg-primary/30" />
												<div className="absolute left-3 top-3 w-2.5 h-2.5 rounded-full bg-primary/40 border border-primary/60 z-10" />
												<div className="flex-1 rounded-lg border border-white/10 bg-white/5 p-3 group-hover:bg-white/10 transition-colors">
													<div className="flex items-center gap-2 flex-wrap">
														{child.thumbnail && (
															<img src={child.thumbnail} alt={child.title} className="w-12 h-12 rounded object-cover" />
														)}
														<div className="flex-1 min-w-0">
															<h4 className="font-medium text-white text-sm truncate">{child.title}</h4>
															<p className="text-[11px] text-gray-400 mt-0.5">
																{formatEventDate(child.startDate)} - {formatEventDate(child.endDate)}
															</p>
														</div>
														<StatusBadge status={childStatus} />
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Event detail modal */}
			<Dialog open={!!selectedEvent} onOpenChange={(o) => { if (!o) setSelectedEvent(null); }}>
				<DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-black/90 border-white/10 backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-white text-xl">{selectedEvent?.title}</DialogTitle>
					</DialogHeader>
					{selectedEvent && (
						<div className="space-y-4">
							{selectedEvent.thumbnail && (
								<div className="w-full rounded-lg overflow-hidden">
									<img
										src={selectedEvent.thumbnail}
										alt={selectedEvent.title}
										className="w-full h-auto max-h-80 object-cover"
									/>
								</div>
							)}
							<div className="flex items-center gap-3 flex-wrap">
								<StatusBadge status={getEventStatus(selectedEvent.startDate, selectedEvent.endDate)} />
								<span className="text-sm text-gray-400 flex items-center gap-1">
									<Calendar className="h-3.5 w-3.5" />
									{formatEventDate(selectedEvent.startDate)} - {formatEventDate(selectedEvent.endDate)} {new Date(selectedEvent.startDate).getFullYear()}
								</span>
								<span className="text-xs text-gray-400 flex items-center gap-1">
									<Eye className="h-3 w-3" />
									{selectedEvent.viewCount ?? 0} kali dilihat
								</span>
							</div>
							{selectedEvent.description && (
								<div
									className="text-sm text-gray-300 leading-relaxed"
									dangerouslySetInnerHTML={{ __html: selectedEvent.description }}
								/>
							)}
						{selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
							<div>
								<h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Lampiran</h4>
								<div className="space-y-2">
									{selectedEvent.attachments.map((att, idx) => (
										<a
											key={idx}
											href={att.url}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-gray-300"
										>
											<Download className="h-4 w-4 flex-shrink-0 text-primary" />
											<span className="flex-1 truncate">{att.name}</span>
											<ExternalLink className="h-3 w-3 flex-shrink-0 text-gray-500" />
										</a>
									))}
								</div>
							</div>
						)}
						{selectedEvent.relatedArticles && selectedEvent.relatedArticles.length > 0 && (
							<div>
								<h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Artikel Terkait</h4>
								<div className="space-y-1.5">
									{selectedEvent.relatedArticles.map((art) => (
										<Link
											key={art._id}
											href={`/artikel/${art._id}${art.slug ? `/${art.slug}` : ''}`}
											className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-primary"
										>
											<FileText className="h-4 w-4 flex-shrink-0" />
											<span className="flex-1 truncate">{art.title}</span>
											<ExternalLink className="h-3 w-3 flex-shrink-0 text-gray-500" />
										</Link>
									))}
								</div>
							</div>
						)}
						<Link href={`/events/${data.year.year}/${selectedEvent._id}`}>
							<Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
								<ExternalLink className="h-4 w-4 mr-2" />
								Lihat Detail (Halaman Baru)
							</Button>
						</Link>
						</div>
					)}
				</DialogContent>
			</Dialog>

			<style>{`
				@keyframes slideInLeft {
					from { opacity: 0; transform: translateX(-16px); }
					to { opacity: 1; transform: translateX(0); }
				}
				.scrollbar-thin::-webkit-scrollbar { height: 6px; }
				.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
				.scrollbar-thin::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.3); border-radius: 3px; }
				.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: hsl(var(--primary) / 0.5); }
			`}</style>
		</section>
	);
}
