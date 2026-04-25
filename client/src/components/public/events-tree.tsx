import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import EventAttachmentPreviewDialog, {
	type EventAttachmentPreviewItem,
} from '@/components/public/event-attachment-preview-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { EventItem, EventYear, EventStatus } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Download, ExternalLink, Eye, FileText } from 'lucide-react';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { toSlug } from '@/utils/slug';

const BASE_SPEED_PPS = 100;
const EASING_K = 3;
const INIT_DELAY_MS = 600;
const ENTER_TRACK_MS = 750;
const HOVER_GRACE_MS = 1200;
const EDGE_ZONE_PX = 80;
const VIEWPORT_BUFFER_PX = 120;
const SPEED_EPSILON = 0.15;
const DRAG_THRESHOLD_PX = 5;

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
	authorsDisplay?: string;
	authors?: string[];
}

interface HomeEventsYearEntry {
	year: EventYear;
	events: EventWithChildren[];
}

interface HomeEventsResponse {
	year?: EventYear | null;
	events?: EventWithChildren[];
	years?: HomeEventsYearEntry[];
}

export interface EventsTreeRef {
	scrollToMonth: (month: number) => void;
}

interface NodeLayout {
	left: number;
	width: number;
}

function getLeftRelativeTo(el: HTMLElement, ancestor: HTMLElement): number {
	let left = 0;
	let cur: HTMLElement | null = el;
	while (cur && cur !== ancestor) {
		left += cur.offsetLeft;
		cur = cur.offsetParent as HTMLElement | null;
	}
	return left;
}

function EventBranchPill({
	event,
	onClick,
	registerNode,
	nodeId,
	onNodePointerEnter,
	onNodePointerLeave,
}: {
	event: EventWithChildren;
	onClick: () => void;
	registerNode: (id: string, el: HTMLDivElement | null) => void;
	nodeId: string;
	onNodePointerEnter?: () => void;
	onNodePointerLeave?: () => void;
}) {
	const status = getEventStatus(event.startDate, event.endDate);
	const refCb = useCallback(
		(el: HTMLDivElement | null) => registerNode(nodeId, el),
		[nodeId, registerNode],
	);

	return (
		<div
			ref={refCb}
			className="inline-flex origin-center will-change-transform"
			onPointerEnter={onNodePointerEnter}
			onPointerLeave={onNodePointerLeave}
		>
			<button
				type="button"
				onClick={onClick}
				className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/50 transition-colors duration-200 text-left min-w-0 max-w-[180px] flex-shrink-0"
			>
				<div className="flex-1 min-w-0">
					<span className="text-xs font-medium text-white truncate block">{event.title}</span>
					{event.authorsDisplay && (
						<span className="text-[10px] text-white/70 truncate block mt-0.5">
							By {event.authorsDisplay}
						</span>
					)}
				</div>
				<StatusBadge status={status} />
			</button>
		</div>
	);
}

function TrackSegment({
	yearEntry,
	isFirst,
	copyId,
	onEventClick,
	registerNode,
	onNodePointerEnter,
	onNodePointerLeave,
}: {
	yearEntry: HomeEventsYearEntry;
	isFirst: boolean;
	copyId: string;
	onEventClick: (ev: EventWithChildren) => void;
	registerNode: (id: string, el: HTMLDivElement | null) => void;
	onNodePointerEnter?: () => void;
	onNodePointerLeave?: () => void;
}) {
	const yearNodeId = `${copyId}-yr-${yearEntry.year._id}`;
	const yearRefCb = useCallback(
		(el: HTMLDivElement | null) => registerNode(yearNodeId, el),
		[yearNodeId, registerNode],
	);

	const eventsByMonth = useMemo(() => {
		const map = new Map<number, EventWithChildren[]>();
		for (const ev of yearEntry.events) {
			const month = ev.month || new Date(ev.startDate).getMonth() + 1;
			if (!map.has(month)) map.set(month, []);
			map.get(month)!.push(ev);
		}
		return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
	}, [yearEntry.events]);

	return (
		<div className="flex items-start flex-shrink-0">
			{!isFirst && (
				<div className="flex items-center self-center">
					<div className="h-0.5 w-8 bg-gradient-to-r from-primary/30 to-primary/50" />
				</div>
			)}

			<div
				ref={yearRefCb}
				className="flex flex-col items-center flex-shrink-0 mr-2 origin-center will-change-transform"
				onPointerEnter={onNodePointerEnter}
				onPointerLeave={onNodePointerLeave}
			>
				<div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center backdrop-blur-sm">
					<span className="text-xl font-bold text-primary">{yearEntry.year.year}</span>
				</div>
			</div>

			{eventsByMonth.map(([month, monthEvents], mIdx) => (
				<MonthColumn
					key={month}
					month={month}
					mIdx={mIdx}
					monthEvents={monthEvents}
					copyId={copyId}
					yearId={yearEntry.year._id}
					onEventClick={onEventClick}
					registerNode={registerNode}
					onNodePointerEnter={onNodePointerEnter}
					onNodePointerLeave={onNodePointerLeave}
				/>
			))}
		</div>
	);
}

function MonthColumn({
	month,
	mIdx,
	monthEvents,
	copyId,
	yearId,
	onEventClick,
	registerNode,
	onNodePointerEnter,
	onNodePointerLeave,
}: {
	month: number;
	mIdx: number;
	monthEvents: EventWithChildren[];
	copyId: string;
	yearId: string;
	onEventClick: (ev: EventWithChildren) => void;
	registerNode: (id: string, el: HTMLDivElement | null) => void;
	onNodePointerEnter?: () => void;
	onNodePointerLeave?: () => void;
}) {
	const monthNodeId = `${copyId}-mo-${yearId}-${month}`;
	const monthRefCb = useCallback(
		(el: HTMLDivElement | null) => registerNode(monthNodeId, el),
		[monthNodeId, registerNode],
	);

	return (
		<div className="flex items-start flex-shrink-0">
			<div className="flex items-center self-center">
				<div
					className="h-0.5 bg-gradient-to-r from-primary/50 to-primary/30"
					style={{ width: mIdx === 0 ? '2rem' : '1.5rem' }}
				/>
			</div>

			<div
				ref={monthRefCb}
				className="flex flex-col items-center flex-shrink-0 origin-center will-change-transform"
				onPointerEnter={onNodePointerEnter}
				onPointerLeave={onNodePointerLeave}
			>
				<div className="px-4 py-2 rounded-full bg-primary/15 border border-primary/30 backdrop-blur-sm mb-2">
					<span className="text-sm font-semibold text-primary whitespace-nowrap">
						{MONTH_NAMES[month - 1]}
					</span>
				</div>

				<div className="w-0.5 h-3 bg-primary/30" />

				<div className="flex flex-wrap gap-2 justify-center max-w-[220px]">
					{monthEvents.map((ev) => (
						<EventBranchPill
							key={`${copyId}-${ev._id}`}
							event={ev}
							onClick={() => onEventClick(ev)}
							registerNode={registerNode}
							nodeId={`${copyId}-ev-${yearId}-${ev._id}`}
							onNodePointerEnter={onNodePointerEnter}
							onNodePointerLeave={onNodePointerLeave}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export default function EventsTree({
	scrollToMonthRef,
	autoScrollEnabled = true,
}: {
	scrollToMonthRef?: React.RefObject<EventsTreeRef | null>;
	autoScrollEnabled?: boolean;
}) {
	const outerRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);

	const [selectedEvent, setSelectedEvent] = useState<EventWithChildren | null>(null);
	const [showSubEvents, setShowSubEvents] = useState<EventWithChildren | null>(null);
	const [attachmentPreview, setAttachmentPreview] = useState<EventAttachmentPreviewItem | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const isDraggingRef = useRef(false);
	const pointerDownRef = useRef(false);
	const dragStartXRef = useRef(0);
	const dragStartOffsetRef = useRef(0);
	const dragPointerIdRef = useRef<number | null>(null);
	const dragTargetRef = useRef<HTMLElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const targetSpeedRef = useRef(BASE_SPEED_PPS);
	const speedRef = useRef(0);
	const offsetRef = useRef(0);
	const lastTsRef = useRef(0);
	const layoutDirtyRef = useRef(true);
	const userInteractedRef = useRef(false);
	const ignoreHoverUntilRef = useRef(0);
	const isInViewRef = useRef(false);
	const animStartedRef = useRef(false);
	const modalOpenRef = useRef(false);
	const sectionRef = useRef<HTMLElement>(null);
	const lastViewedEventIdRef = useRef<string | null>(null);

	const [trackEntered, setTrackEntered] = useState(false);

	const prefersReducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const registeredNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
	const nodeLayoutsRef = useRef<Map<string, NodeLayout>>(new Map());

	const { data, isLoading } = useQuery<HomeEventsResponse>({
		queryKey: ['/api/events/active-home'],
		staleTime: 30 * 1000,
	});

	const yearEntries = useMemo((): HomeEventsYearEntry[] => {
		if (!data) return [];
		if (data.years && data.years.length > 0) {
			return [...data.years].sort((a, b) => a.year.year - b.year.year);
		}
		if (data.year && data.events) {
			return [{ year: data.year, events: data.events }];
		}
		return [];
	}, [data]);

	const hasContent = yearEntries.length > 0 && yearEntries.some((y) => y.events.length > 0);

	const totalEventCount = useMemo(
		() => yearEntries.reduce((sum, y) => sum + y.events.length, 0),
		[yearEntries],
	);

	const repeatCount = useMemo(() => {
		if (totalEventCount === 0) return 1;
		return Math.max(1, Math.ceil(6 / totalEventCount));
	}, [totalEventCount]);

	const registerNode = useCallback((id: string, el: HTMLDivElement | null) => {
		if (el) {
			registeredNodesRef.current.set(id, el);
		} else {
			registeredNodesRef.current.delete(id);
			nodeLayoutsRef.current.delete(id);
		}
		layoutDirtyRef.current = true;
	}, []);

	const measureLayouts = useCallback(() => {
		const inner = innerRef.current;
		if (!inner) return;
		const layouts = nodeLayoutsRef.current;
		registeredNodesRef.current.forEach((el, id) => {
			layouts.set(id, {
				left: getLeftRelativeTo(el, inner),
				width: el.offsetWidth,
			});
		});
		layoutDirtyRef.current = false;
	}, []);

	const wrapOffset = useCallback((raw: number, partWidth: number) => {
		if (partWidth <= 0) return 0;
		return ((raw % partWidth) + partWidth) % partWidth;
	}, []);

	// ── scrollToMonth via offset ──────────────────────────────────────
	const scrollToMonth = useCallback((month: number) => {
		const inner = innerRef.current;
		const outer = outerRef.current;
		if (!inner || !outer || yearEntries.length === 0) return;

		const yearId = yearEntries[0].year._id;
		const nodeId = `a-mo-${yearId}-${month}`;
		const layout = nodeLayoutsRef.current.get(nodeId);
		if (!layout) return;

		const vw = outer.clientWidth;
		const partWidth = inner.scrollWidth / 2;
		offsetRef.current = wrapOffset(layout.left - vw / 2 + layout.width / 2, partWidth);
	}, [yearEntries, wrapOffset]);

	useImperativeHandle(scrollToMonthRef, () => ({ scrollToMonth }), [scrollToMonth]);

	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent<{ month: number }>).detail;
			if (detail?.month) setTimeout(() => scrollToMonth(detail.month), 400);
		};
		window.addEventListener('events-scroll-to-month', handler);
		return () => window.removeEventListener('events-scroll-to-month', handler);
	}, [scrollToMonth]);

	useEffect(() => {
		const stored = sessionStorage.getItem('eventsScrollToMonth');
		if (stored) {
			const month = parseInt(stored, 10);
			sessionStorage.removeItem('eventsScrollToMonth');
			if (month >= 1 && month <= 12) setTimeout(() => scrollToMonth(month), 600);
		}
	}, [data, scrollToMonth]);

	const onNodePointerEnter = useCallback(() => {
		if (!userInteractedRef.current) return;
		if (performance.now() < ignoreHoverUntilRef.current) return;
		targetSpeedRef.current = totalEventCount <= 3 ? BASE_SPEED_PPS * 0.3 : 0;
	}, [totalEventCount]);
	const onNodePointerLeave = useCallback(() => {
		if (modalOpenRef.current) return;
		targetSpeedRef.current = BASE_SPEED_PPS;
	}, []);

	// ── Resize observer ──────────────────────────────────────────────
	useEffect(() => {
		const outer = outerRef.current;
		if (!outer) return;
		const ro = new ResizeObserver(() => { layoutDirtyRef.current = true; });
		ro.observe(outer);
		return () => ro.disconnect();
	}, []);

	// ── IntersectionObserver (toggle, never disconnect early) ────────
	useEffect(() => {
		const section = sectionRef.current;
		if (!section) return;
		const io = new IntersectionObserver(
			([entry]) => {
				isInViewRef.current = entry.isIntersecting;
				if (entry.isIntersecting && !prefersReducedMotion) {
					setTrackEntered(true);
				}
			},
			{ threshold: 0.05 },
		);
		io.observe(section);
		return () => io.disconnect();
	}, [prefersReducedMotion]);

	// If reduced motion, skip intro animation entirely
	useEffect(() => {
		if (prefersReducedMotion) setTrackEntered(true);
	}, [prefersReducedMotion]);

	// ── Animation loop (always-on rAF, visibility-gated movement) ────
	useEffect(() => {
		const outer = outerRef.current;
		const inner = innerRef.current;
		if (!outer || !inner || !autoScrollEnabled || prefersReducedMotion || !hasContent) return;
		if (animStartedRef.current) return;
		animStartedRef.current = true;

		lastTsRef.current = performance.now();
		targetSpeedRef.current = BASE_SPEED_PPS;
		speedRef.current = 0;
		ignoreHoverUntilRef.current = performance.now() + INIT_DELAY_MS + HOVER_GRACE_MS;

		let initDone = false;
		let initTimerId: ReturnType<typeof setTimeout> | null = null;

		const step = (now: number) => {
			const dt = Math.min((now - lastTsRef.current) / 1000, 0.1);
			lastTsRef.current = now;

			if (layoutDirtyRef.current) measureLayouts();

			const partWidth = inner.scrollWidth / 2;
			if (partWidth <= 0) { rafRef.current = requestAnimationFrame(step); return; }

			if (!isInViewRef.current && !isDraggingRef.current) {
				rafRef.current = requestAnimationFrame(step);
				return;
			}

			if (!initDone) {
				if (!initTimerId) {
					const extraDelay = trackEntered ? ENTER_TRACK_MS : 0;
					initTimerId = setTimeout(() => { initDone = true; }, INIT_DELAY_MS + extraDelay);
				}
				// Still render positions but don't move
				const wrapped = wrapOffset(offsetRef.current, partWidth);
				inner.style.transform = `translate3d(${-wrapped}px, 0, 0)`;
				applyNodeVisibility(outer, wrapped, partWidth);
				rafRef.current = requestAnimationFrame(step);
				return;
			}

			if (!isDraggingRef.current) {
				const target = targetSpeedRef.current;
				let spd = speedRef.current;
				spd += (target - spd) * (1 - Math.exp(-EASING_K * dt));
				if (Math.abs(spd) < SPEED_EPSILON && target === 0) spd = 0;
				speedRef.current = spd;
				offsetRef.current += spd * dt;
			}

			const wrapped = wrapOffset(offsetRef.current, partWidth);
			inner.style.transform = `translate3d(${-wrapped}px, 0, 0)`;
			applyNodeVisibility(outer, wrapped, partWidth);

			rafRef.current = requestAnimationFrame(step);
		};

		function applyNodeVisibility(outerEl: HTMLDivElement, wrapped: number, _partWidth: number) {
			const vw = outerEl.clientWidth;
			nodeLayoutsRef.current.forEach((layout, id) => {
				const el = registeredNodesRef.current.get(id);
				if (!el) return;
				const screenX = layout.left - wrapped;
				const screenRight = screenX + layout.width;
				const inRange = screenRight > -VIEWPORT_BUFFER_PX && screenX < vw + VIEWPORT_BUFFER_PX;
				if (!inRange) {
					el.style.visibility = 'hidden';
					el.style.pointerEvents = 'none';
					el.style.transform = 'scale(0)';
					return;
				}
				el.style.visibility = 'visible';
				el.style.pointerEvents = '';
				const leftFactor = Math.min(1, Math.max(0, screenRight / EDGE_ZONE_PX));
				const rightFactor = Math.min(1, Math.max(0, (vw - screenX) / EDGE_ZONE_PX));
				el.style.transform = `scale(${Math.min(leftFactor, rightFactor)})`;
			});
		}

		rafRef.current = requestAnimationFrame(step);

		return () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
			if (initTimerId) clearTimeout(initTimerId);
			animStartedRef.current = false;
		};
	}, [autoScrollEnabled, hasContent, prefersReducedMotion, measureLayouts, trackEntered, wrapOffset]);

	// ── Drag handlers (threshold-based so clicks pass through) ────────
	const handlePointerDown = useCallback((e: React.PointerEvent) => {
		if ((e.target as HTMLElement).closest('button, a')) return;
		pointerDownRef.current = true;
		isDraggingRef.current = false;
		dragStartXRef.current = e.clientX;
		dragStartOffsetRef.current = offsetRef.current;
		dragPointerIdRef.current = e.pointerId;
		dragTargetRef.current = e.currentTarget as HTMLElement;
	}, []);

	const handlePointerMove = useCallback((e: React.PointerEvent) => {
		userInteractedRef.current = true;
		if (!pointerDownRef.current) return;
		const dx = e.clientX - dragStartXRef.current;
		if (!isDraggingRef.current) {
			if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
			isDraggingRef.current = true;
			setIsDragging(true);
			if (dragTargetRef.current && dragPointerIdRef.current !== null) {
				try { dragTargetRef.current.setPointerCapture(dragPointerIdRef.current); } catch {}
			}
		}
		e.preventDefault();
		offsetRef.current = dragStartOffsetRef.current - dx;
	}, []);

	const handlePointerUp = useCallback(() => {
		pointerDownRef.current = false;
		if (isDraggingRef.current) {
			isDraggingRef.current = false;
			setIsDragging(false);
		}
		dragPointerIdRef.current = null;
		dragTargetRef.current = null;
	}, []);

	// Pause marquee saat modal open, resume saat close
	useEffect(() => {
		const isOpen = selectedEvent !== null || showSubEvents !== null;
		modalOpenRef.current = isOpen;
		if (typeof document !== 'undefined') {
			document.documentElement.classList.toggle('events-modal-open', isOpen);
		}
		if (isOpen) {
			targetSpeedRef.current = 0;
		} else {
			targetSpeedRef.current = BASE_SPEED_PPS;
			lastViewedEventIdRef.current = null;
		}

		return () => {
			if (typeof document !== 'undefined') {
				document.documentElement.classList.remove('events-modal-open');
			}
		};
	}, [selectedEvent, showSubEvents]);

	const handleEventClick = useCallback((event: EventWithChildren) => {
		// ViewCount +1 sekali per open
		if (lastViewedEventIdRef.current !== event._id) {
			lastViewedEventIdRef.current = event._id;
			// Fire-and-forget: increment viewCount + fetch latest data with children
			fetch(`/api/events/${event._id}?children=true`)
				.then((r) => (r.ok ? r.json() : null))
				.then((fresh) => {
					if (!fresh) return;
					if (fresh.children && fresh.children.length > 0) {
						setShowSubEvents(fresh);
					} else {
						setSelectedEvent(fresh);
					}
				})
				.catch(() => {});
		}

		// Show immediately with current data (will be replaced once fetch completes)
		if (event.children && event.children.length > 0) {
			setShowSubEvents(event);
		} else {
			setSelectedEvent(event);
		}
	}, []);

	const primaryYear = yearEntries[yearEntries.length - 1]?.year.year;

	if (isLoading) {
		return (
			<section ref={sectionRef} className="py-16 px-4" id="events">
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

	if (!hasContent) return null;

	return (
		<section ref={sectionRef} className="py-16 px-4 relative overflow-hidden" id="events">
			<div className="absolute inset-0 pointer-events-none">
				<div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
			</div>

			<div className="max-w-7xl mx-auto relative">
				<div className="text-center mb-10">
					<h2
						className="text-3xl sm:text-4xl font-bold text-white mb-2"
						data-aos="fade-up"
					>
						Event
					</h2>
					<p
						className="text-gray-400 text-sm"
						data-aos="fade-up"
						data-aos-delay="100"
					>
						Kegiatan dan acara sepanjang tahun
					</p>
				</div>

				<div
					className={`relative eventsTrackEnter ${trackEntered ? 'eventsTrackEntered' : ''}`}
					data-aos="zoom-in"
					data-aos-delay="200"
					data-aos-duration="700"
				>
					<div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
					<div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

					<div
						ref={outerRef}
						className="overflow-hidden pb-6 pt-2 select-none touch-pan-y"
						style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
						onPointerCancel={handlePointerUp}
						onPointerLeave={handlePointerUp}
					>
						<div
							ref={innerRef}
							className="relative flex items-start gap-0 w-max will-change-transform"
						>
						{Array.from({ length: repeatCount }, (_, ri) =>
							yearEntries.map((entry, idx) => (
								<TrackSegment
									key={`a${ri > 0 ? ri : ''}-${entry.year._id}`}
									yearEntry={entry}
									isFirst={ri === 0 && idx === 0}
									copyId={ri === 0 ? 'a' : `a${ri}`}
									onEventClick={handleEventClick}
									registerNode={registerNode}
									onNodePointerEnter={onNodePointerEnter}
									onNodePointerLeave={onNodePointerLeave}
								/>
							)),
						)}
						{Array.from({ length: repeatCount }, (_, ri) =>
							yearEntries.map((entry, idx) => (
								<TrackSegment
									key={`b${ri > 0 ? ri : ''}-${entry.year._id}`}
									yearEntry={entry}
									isFirst={ri === 0 && idx === 0}
									copyId={ri === 0 ? 'b' : `b${ri}`}
									onEventClick={handleEventClick}
									registerNode={registerNode}
									onNodePointerEnter={onNodePointerEnter}
									onNodePointerLeave={onNodePointerLeave}
								/>
							)),
						)}
						</div>
					</div>

					{autoScrollEnabled && !prefersReducedMotion && (
						<p className="text-center text-xs text-gray-500 mt-2" data-aos="fade" data-aos-delay="500">Geser untuk melihat lebih banyak</p>
					)}
				</div>

				<div className="mt-8 text-center" data-aos="fade-up" data-aos-delay="400">
					{yearEntries.length <= 1 ? (
						<Link href={`/events/${primaryYear}`}>
							<Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
								Lihat Semua Event {primaryYear}
							</Button>
						</Link>
					) : yearEntries.length <= 5 ? (
						<Link href="/events/all">
							<Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
								Lihat Semua Event
							</Button>
						</Link>
					) : (
						<Link href="/events">
							<Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
								Lihat Semua Event
							</Button>
						</Link>
					)}
				</div>
			</div>

			{/* Sub-events modal */}
			<Dialog open={!!showSubEvents} onOpenChange={(o) => { if (!o) setShowSubEvents(null); }}>
				<DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto bg-black/90 border-white/10 backdrop-blur-xl">
					<DialogHeader>
						<DialogTitle className="text-white text-xl">{showSubEvents?.title}</DialogTitle>
						{showSubEvents?.authorsDisplay && (
							<p className="text-sm text-gray-400 mt-1">
								By {showSubEvents.authorsDisplay}
							</p>
						)}
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
							<div className="flex gap-2 flex-wrap">
								<Link href={`/events/${new Date(showSubEvents.startDate).getFullYear()}/${toSlug(showSubEvents.title) || showSubEvents._id}`}>
									<Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
										<ExternalLink className="h-4 w-4 mr-2" />
										Lihat Detail
									</Button>
								</Link>
								<Button
									variant="outline"
									size="sm"
									className="border-white/20 text-white hover:bg-white/10"
									onClick={() => { setSelectedEvent(showSubEvents); setShowSubEvents(null); }}
								>
									<FileText className="h-4 w-4 mr-2" />
									Detail Event Utama
								</Button>
							</div>
							{showSubEvents.relatedBerita && showSubEvents.relatedBerita.length > 0 && (
								<div>
									<h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Berita Terkait</h4>
									<div className="space-y-1.5">
									{showSubEvents.relatedBerita.map((art) => (
										<Link
											key={art._id}
											href={art.slug ? `/berita/${art.slug}` : `/berita/${art._id}`}
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
												onClick={() => { setSelectedEvent(child); setShowSubEvents(null); }}
												style={{ animation: `slideInLeft 0.4s ease forwards`, animationDelay: `${idx * 100}ms`, opacity: 0 }}
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
															{child.authorsDisplay && (
																<p className="text-[11px] text-gray-400 mt-0.5">
																	By {child.authorsDisplay}
																</p>
															)}
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
						{selectedEvent?.authorsDisplay && (
							<p className="text-sm text-gray-400 mt-1">
								By {selectedEvent.authorsDisplay}
							</p>
						)}
					</DialogHeader>
					{selectedEvent && (
						<div className="space-y-4">
							{selectedEvent.thumbnail && (
								<div className="w-full rounded-lg overflow-hidden">
									<img src={selectedEvent.thumbnail} alt={selectedEvent.title} className="w-full h-auto max-h-80 object-cover" />
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
								<div className="text-sm text-gray-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedEvent.description }} />
							)}
							{selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
								<div>
									<h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Lampiran</h4>
									<div className="space-y-2">
										{selectedEvent.attachments.map((att, idx) => (
											<button
												key={idx}
												type="button"
												onClick={() => setAttachmentPreview(att)}
												className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-gray-300"
											>
												<Download className="h-4 w-4 flex-shrink-0 text-primary" />
												<span className="flex-1 truncate">{att.name}</span>
												<ExternalLink className="h-3 w-3 flex-shrink-0 text-gray-500" />
											</button>
										))}
									</div>
								</div>
							)}
							{selectedEvent.relatedBerita && selectedEvent.relatedBerita.length > 0 && (
								<div>
									<h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Berita Terkait</h4>
									<div className="space-y-1.5">
									{selectedEvent.relatedBerita.map((art) => (
										<Link
											key={art._id}
											href={art.slug ? `/berita/${art.slug}` : `/berita/${art._id}`}
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
							<Link href={`/events/${new Date(selectedEvent.startDate).getFullYear()}/${toSlug(selectedEvent.title) || selectedEvent._id}`}>
								<Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
									<ExternalLink className="h-4 w-4 mr-2" />
									Lihat Detail (Halaman Baru)
								</Button>
							</Link>
						</div>
					)}
				</DialogContent>
			</Dialog>
			<EventAttachmentPreviewDialog
				preview={attachmentPreview}
				onOpenChange={(open) => {
					if (!open) setAttachmentPreview(null);
				}}
			/>

			<style>{`
				.eventsTrackEnter {
					opacity: 0;
					transform: translateY(10px) scale(0.98);
					transition: opacity ${ENTER_TRACK_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
						transform ${ENTER_TRACK_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
					will-change: opacity, transform;
				}
				.eventsTrackEntered {
					opacity: 1;
					transform: translateY(0) scale(1);
				}
				@keyframes slideInLeft {
					from { opacity: 0; transform: translateX(-16px); }
					to { opacity: 1; transform: translateX(0); }
				}
			`}</style>
		</section>
	);
}
