import type { ArchiveActiveChip, ArchiveFilterGroup } from '@/components/public/archive/archive-filter-bar';
import { ArchiveGridItem } from '@/components/public/archive/archive-meta';
import { formatEventDate, getEventStatus, StatusBadge } from '@/components/public/events-tree';
import type { EventStatus } from '@shared/schema';
import { MONTH_NAMES } from '@/constants/month-names';
import { DEFAULT_IMAGE_URL } from '@/constants/default-image';
import { toSlug } from '@/utils/slug';
import { Activity, Calendar, Eye, FileText } from 'lucide-react';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';

export interface TimelineEventItem {
	_id: string;
	title: string;
	description: string;
	thumbnail: string;
	startDate: string;
	endDate: string;
	month: number;
	relatedBerita?: { _id: string; title: string; slug?: string }[];
	viewCount?: number;
}

const STATUS_LABEL: Record<EventStatus, string> = {
	ongoing: 'Berlangsung',
	soon: 'Akan datang',
	expired: 'Selesai',
};

const STATUS_NODE: Record<EventStatus, string> = {
	ongoing: 'bg-emerald-500 ring-emerald-500/25',
	soon: 'bg-primary ring-primary/25',
	expired: 'bg-muted-foreground/50 ring-muted-foreground/15',
};

export function eventMonth(ev: Pick<TimelineEventItem, 'month' | 'startDate'>) {
	return ev.month || new Date(ev.startDate).getMonth() + 1;
}

/** Search judul/deskripsi + filter status untuk halaman list event. */
export function useEventArchiveFilters<T extends TimelineEventItem>(events: T[]) {
	const [searchTerm, setSearchTerm] = useState('');
	const [status, setStatus] = useState<EventStatus | null>(null);

	const filtered = useMemo(() => {
		let out = events;
		if (searchTerm) {
			const q = searchTerm.toLowerCase();
			out = out.filter(
				(e) => e.title.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q),
			);
		}
		if (status) out = out.filter((e) => getEventStatus(e.startDate, e.endDate) === status);
		return out;
	}, [events, searchTerm, status]);

	const presentStatuses = useMemo(() => {
		const s = new Set<EventStatus>();
		events.forEach((e) => s.add(getEventStatus(e.startDate, e.endDate)));
		return (['ongoing', 'soon', 'expired'] as EventStatus[]).filter((x) => s.has(x));
	}, [events]);

	const groups: ArchiveFilterGroup[] =
		presentStatuses.length > 1
			? [
					{
						key: 'status',
						label: 'Status',
						icon: createElement(Activity),
						options: presentStatuses.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
						isSelected: (v) => status === v,
						onSelect: (v) => setStatus((cur) => (cur === v ? null : (v as EventStatus))),
					},
				]
			: [];

	const activeChips: ArchiveActiveChip[] = status
		? [{ key: `status-${status}`, label: STATUS_LABEL[status], onRemove: () => setStatus(null) }]
		: [];

	const clearFilters = () => {
		setSearchTerm('');
		setStatus(null);
	};

	return { searchTerm, setSearchTerm, status, filtered, groups, activeChips, clearFilters };
}

function TimelineEventCard({ ev, year, order }: { ev: TimelineEventItem; year: number; order: number }) {
	const status = getEventStatus(ev.startDate, ev.endDate);
	const href = `/events/${year}/${toSlug(ev.title) || ev._id}`;
	const plain = ev.description ? ev.description.replace(/<[^>]*>/g, '') : '';

	return (
		<ArchiveGridItem order={order} className="relative pl-7 sm:pl-9">
			<span
				aria-hidden
				className={`absolute left-[3px] sm:left-[7px] top-6 h-2.5 w-2.5 rounded-full ring-4 ${STATUS_NODE[status]}`}
			/>
			<article className="archive-card group relative overflow-hidden rounded-xl border border-border/70 bg-card hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/40 sm:flex">
				<div className="archive-card-media relative aspect-video sm:aspect-auto sm:min-h-[11rem] sm:w-56 lg:w-64 shrink-0 overflow-hidden bg-muted">
					<img
						src={ev.thumbnail || DEFAULT_IMAGE_URL}
						alt=""
						loading="lazy"
						className="h-full w-full object-cover sm:absolute sm:inset-0"
						onError={(e) => {
							(e.target as HTMLImageElement).src = DEFAULT_IMAGE_URL;
						}}
					/>
				</div>
				<div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
					<div className="flex flex-wrap items-center gap-2">
						<StatusBadge status={status} />
						<span className="archive-meta flex items-center gap-1">
							<Calendar className="h-3 w-3" />
							{formatEventDate(ev.startDate)} – {formatEventDate(ev.endDate)} {year}
						</span>
					</div>
					<h3 className="mt-2 text-base sm:text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
						{/* Stretched link: seluruh kartu bisa diklik tanpa anchor bersarang. */}
						<Link href={href} className="after:absolute after:inset-0 after:z-[1] focus-visible:outline-none">
							{ev.title}
						</Link>
					</h3>
					{plain && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{plain}</p>}
					{ev.relatedBerita && ev.relatedBerita.length > 0 && (
						<div className="relative z-[2] mt-3 flex flex-wrap gap-1.5">
							{ev.relatedBerita.map((art) => (
								<Link
									key={art._id}
									href={art.slug ? `/berita/${art.slug}` : `/berita/${art._id}`}
									className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-secondary/60 px-2 py-0.5 text-xs text-secondary-foreground hover:border-primary/40 hover:text-primary">
									<FileText className="h-3 w-3" />
									{art.title.length > 28 ? art.title.slice(0, 28) + '…' : art.title}
								</Link>
							))}
						</div>
					)}
					<div className="mt-auto pt-3 flex items-center justify-between gap-2">
						<span className="archive-meta flex items-center gap-1">
							<Eye className="h-3 w-3" />
							{ev.viewCount ?? 0} dilihat
						</span>
						<span className="text-xs font-semibold text-primary">Lihat detail →</span>
					</div>
				</div>
			</article>
		</ArchiveGridItem>
	);
}

/** Satu kelompok bulan: label sticky di kiri, rail + kartu di kanan. */
function MonthGroup({
	month,
	year,
	events,
	showYear,
}: {
	month: number;
	year: number;
	events: TimelineEventItem[];
	showYear?: boolean;
}) {
	const railRef = useRef<HTMLSpanElement>(null);
	const [drawn, setDrawn] = useState(false);

	useEffect(() => {
		const el = railRef.current;
		if (!el || typeof IntersectionObserver === 'undefined') {
			setDrawn(true);
			return;
		}
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setDrawn(true);
					io.disconnect();
				}
			},
			{ threshold: 0.05 },
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);

	return (
		<section aria-label={`${MONTH_NAMES[month - 1]} ${year}`} className="grid gap-3 md:grid-cols-[10rem_1fr] md:gap-8">
			<div className="md:sticky md:top-44 self-start">
				<p className="font-mono text-sm sm:text-base font-semibold uppercase tracking-wider text-primary">
					{MONTH_NAMES[month - 1]}
					{showYear ? <span className="text-muted-foreground"> {year}</span> : null}
				</p>
				<p className="archive-meta mt-0.5">{String(events.length).padStart(2, '0')} kegiatan</p>
			</div>
			<div className="relative">
				<span
					ref={railRef}
					aria-hidden
					data-drawn={drawn}
					className="archive-rail absolute left-[7px] sm:left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-400/70 via-primary/30 to-transparent"
				/>
				<div className="space-y-4">
						{events.map((ev, i) => (
							<TimelineEventCard key={ev._id} ev={ev} year={year} order={i} />
						))}
				</div>
			</div>
		</section>
	);
}

export type TimelineYearGroup = {
	year: number;
	months: { month: number; events: TimelineEventItem[] }[];
};

export function EventTimeline({ groups, showYearHeadings }: { groups: TimelineYearGroup[]; showYearHeadings?: boolean }) {
	return (
		<div className="space-y-12 sm:space-y-14">
			{groups.map(({ year, months }) => (
				<div key={year} className="space-y-10">
					{showYearHeadings && (
						<div className="flex items-center gap-3">
							<h2 className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-foreground">{year}</h2>
							<span className="h-px flex-1 bg-gradient-to-r from-cyan-400/60 to-transparent" />
						</div>
					)}
					{months.map(({ month, events }) => (
						<MonthGroup key={`${year}-${month}`} month={month} year={year} events={events} />
					))}
				</div>
			))}
		</div>
	);
}

/** Kelompokkan event (sudah dipaginasi) → tahun → bulan. */
export function groupTimeline<T extends TimelineEventItem>(
	events: T[],
	getYear: (ev: T) => number,
	yearOrder: 'asc' | 'desc' = 'desc',
): TimelineYearGroup[] {
	const byYear = new Map<number, Map<number, T[]>>();
	for (const ev of events) {
		const y = getYear(ev);
		const m = eventMonth(ev);
		if (!byYear.has(y)) byYear.set(y, new Map());
		const mm = byYear.get(y)!;
		if (!mm.has(m)) mm.set(m, []);
		mm.get(m)!.push(ev);
	}
	return Array.from(byYear.entries())
		.sort((a, b) => (yearOrder === 'desc' ? b[0] - a[0] : a[0] - b[0]))
		.map(([year, mm]) => ({
			year,
			months: Array.from(mm.entries())
				.sort((a, b) => a[0] - b[0])
				.map(([month, evs]) => ({ month, events: evs })),
		}));
}

export function EventTimelineSkeleton() {
	return (
		<div className="grid gap-3 md:grid-cols-[10rem_1fr] md:gap-8 animate-pulse" aria-busy="true" aria-label="Memuat event">
			<div className="h-5 w-24 rounded bg-muted" />
			<div className="space-y-4 pl-7 sm:pl-9">
				{[0, 1, 2].map((i) => (
					<div key={i} className="h-40 rounded-xl border border-border/60 bg-card" />
				))}
			</div>
		</div>
	);
}
