import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ChangeEvent } from 'react';
import { getOrCreateGuestSecret } from '@/lib/guest-identity';
import { queryClient } from '@/lib/queryClient';
import type { FeedbackMedia, FeedbackFormConfig, FeedbackFieldDefinition } from '@shared/schema';
import { DEFAULT_FEEDBACK_FORM_CONFIG } from '@shared/schema';

interface Settings {
	contactEmail?: string;
	address?: string;
	mapsEmbedUrl?: string;
	footerText?: string;
	feedbackSubmitEnabled?: boolean;
	feedbackCardsEnabled?: boolean;
	feedbackCardsAutoScrollEnabled?: boolean;
	socialLinks?: { facebook: string; tiktok: string; instagram: string; youtube: string };
	links?: { uinMalang: string; fakultasSainsTeknologi: string; jurusanTeknikInformatika: string; perpustakaan: string };
	quickLinks?: Array<{ label: string; url: string }>;
}

interface PublicFeedbackCard {
	_id: string;
	target: string;
	type: string;
	body: string;
	isAnonymous: boolean;
	senderName: string;
	media: FeedbackMedia[];
	reply: { adminName: string; message: string; repliedAt: string } | null;
	suggestionStatus?: 'pending' | 'accepted' | 'rejected';
	suggestionDecisionComment?: string;
	suggestionDeciderName?: string;
	destinationLabel?: string;
	typeLabel?: string;
	extraFields?: Record<string, unknown>;
	isOwn?: boolean;
	createdAt: string;
}

function StarInput({ value, onChange, max = 5 }: { value: number; onChange: (v: number) => void; max?: number }) {
	const [hover, setHover] = useState(0);
	return (
		<span className="inline-flex items-center gap-0.5">
			{Array.from({ length: max }, (_, i) => i + 1).map((i) => (
				<button key={i} type="button" onClick={() => onChange(value === i ? 0 : i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} className="p-0.5 transition-transform hover:scale-110">
					<svg className={`h-5 w-5 transition-colors ${i <= (hover || value) ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-muted-foreground/40 dark:text-slate-500'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
					</svg>
				</button>
			))}
		</span>
	);
}

const RichTextEditor = lazy(() => import('@/components/dashboard/rich-text-editor'));

function stripHtmlPreview(html: string): string {
	return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function renderExtraFieldsBlock(extra: Record<string, unknown> | undefined) {
	if (!extra || Object.keys(extra).length === 0) return null;
	return (
		<div className="space-y-2 pt-2 border-t border-border/30">
			<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lampiran & field tambahan</p>
			<ul className="space-y-2 text-sm">
				{Object.entries(extra).map(([key, val]) => (
					<li key={key} className="rounded-md border border-border/40 bg-muted/20 p-2">
						<span className="text-xs text-muted-foreground font-mono block mb-1">{key}</span>
						<ExtraValueView value={val} />
					</li>
				))}
			</ul>
		</div>
	);
}

function ExtraValueView({ value }: { value: unknown }) {
	if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
	if (typeof value === 'boolean') return <span>{value ? 'Ya' : 'Tidak'}</span>;
	if (typeof value === 'string') {
		const looksHtml = /<[^>]+>/.test(value);
		return <span className="whitespace-pre-wrap break-words">{looksHtml ? stripHtmlPreview(value) : value}</span>;
	}
	if (Array.isArray(value)) {
		if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'url' in (value[0] as object)) {
			return (
				<div className="grid grid-cols-2 gap-2 mt-1">
					{(value as { url: string; originalName?: string }[]).map((m, i) => (
						<a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block rounded overflow-hidden border border-border/30">
							<img src={m.url} alt={m.originalName || `file-${i}`} className="w-full h-24 object-cover" loading="lazy" />
						</a>
					))}
				</div>
			);
		}
		return <span>{(value as string[]).join(', ')}</span>;
	}
	return <span className="break-all">{String(value)}</span>;
}

const SCROLL_SPEED = 40;
const INTRO_DELAY_MS = 600;
const EASING_K = 3;
const SPEED_EPSILON = 0.15;
const CARD_WIDTH_PX = 272;
const DRAG_THRESHOLD_PX = 5;

function wrapOffset(raw: number, partWidth: number): number {
	if (partWidth <= 0) return 0;
	return ((raw % partWidth) + partWidth) % partWidth;
}

function FeedbackCarousel({ cards, enabled, onCardClick }: { cards: PublicFeedbackCard[]; enabled: boolean; onCardClick: (c: PublicFeedbackCard) => void }) {
	const outerRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const offsetRef = useRef(0);
	const speedRef = useRef(0);
	const rafRef = useRef<number | null>(null);
	const lastTsRef = useRef(0);
	const pausedRef = useRef(false);
	const isDraggingRef = useRef(false);
	const pointerDownRef = useRef(false);
	const dragStartXRef = useRef(0);
	const dragStartOffsetRef = useRef(0);
	const dragPointerIdRef = useRef<number | null>(null);
	const dragTargetRef = useRef<HTMLElement | null>(null);
	const didDragRef = useRef(false);
	const [isDragging, setIsDragging] = useState(false);
	const [expandedReply, setExpandedReply] = useState<string | null>(null);
	const [outerWidth, setOuterWidth] = useState(1200);

	useEffect(() => {
		const el = outerRef.current;
		if (!el) return;
		setOuterWidth(el.clientWidth);
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) setOuterWidth(entry.contentRect.width);
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const baseCards = useMemo(() => {
		if (cards.length === 0) return [];
		const minWidth = outerWidth * 2 + CARD_WIDTH_PX;
		const result: PublicFeedbackCard[] = [];
		while (result.length * CARD_WIDTH_PX < minWidth) {
			for (const c of cards) result.push(c);
		}
		return result;
	}, [cards, outerWidth]);

	const trackCards = useMemo(() => [...baseCards, ...baseCards], [baseCards]);

	useEffect(() => {
		const track = trackRef.current;
		if (!track || !enabled || cards.length === 0) return;

		offsetRef.current = 0;
		speedRef.current = 0;
		track.style.transform = 'translate3d(0, 0, 0)';
		lastTsRef.current = performance.now();

		let initDone = false;
		let initTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => { initDone = true; }, INTRO_DELAY_MS);

		const step = (now: number) => {
			const dt = Math.min((now - lastTsRef.current) / 1000, 0.1);
			lastTsRef.current = now;

			const partWidth = track.scrollWidth / 2;
			if (partWidth <= 0) { rafRef.current = requestAnimationFrame(step); return; }

			if (!initDone) {
				const wrapped = wrapOffset(offsetRef.current, partWidth);
				track.style.transform = `translate3d(${-wrapped}px, 0, 0)`;
				rafRef.current = requestAnimationFrame(step);
				return;
			}

			const targetSpeed = (pausedRef.current || isDraggingRef.current) ? 0 : SCROLL_SPEED;
			speedRef.current += (targetSpeed - speedRef.current) * (1 - Math.exp(-EASING_K * dt));
			if (Math.abs(speedRef.current) < SPEED_EPSILON && targetSpeed === 0) speedRef.current = 0;

			offsetRef.current += speedRef.current * dt;
			const wrapped = wrapOffset(offsetRef.current, partWidth);
			track.style.transform = `translate3d(${-wrapped}px, 0, 0)`;
			rafRef.current = requestAnimationFrame(step);
		};

		rafRef.current = requestAnimationFrame(step);
		return () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
			if (initTimer) clearTimeout(initTimer);
		};
	}, [enabled, cards.length, baseCards.length]);

	// ── Drag handlers (threshold-based so click tetap aman) ────────
	const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
		if ((e.target as HTMLElement)?.closest?.('button, a')) return;
		pointerDownRef.current = true;
		isDraggingRef.current = false;
		didDragRef.current = false;
		dragStartXRef.current = e.clientX;
		dragStartOffsetRef.current = offsetRef.current;
		dragPointerIdRef.current = e.pointerId;
		dragTargetRef.current = e.currentTarget as HTMLElement;
	}, []);

	const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
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

		const track = trackRef.current;
		if (!track) return;
		offsetRef.current = dragStartOffsetRef.current - dx;
		const partWidth = track.scrollWidth / 2;
		const wrapped = wrapOffset(offsetRef.current, partWidth);
		track.style.transform = `translate3d(${-wrapped}px, 0, 0)`;
		didDragRef.current = true;
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

	if (cards.length === 0) return null;

	return (
		<div
			ref={outerRef}
			className="overflow-hidden relative select-none touch-pan-y"
			style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onPointerLeave={handlePointerUp}
		>
			<div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background dark:from-[#050b1c] to-transparent z-10 pointer-events-none" />
			<div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background dark:from-[#050b1c] to-transparent z-10 pointer-events-none" />
			<div ref={trackRef} className="flex gap-4 w-max will-change-transform py-2" onMouseEnter={() => { pausedRef.current = true; }} onMouseLeave={() => { pausedRef.current = false; }}>
				{trackCards.map((card, idx) => (
					<div
						key={`fb-${idx}`}
						className="w-64 flex-shrink-0 rounded-lg border border-border/50 bg-card/50 dark:bg-white/5 backdrop-blur-sm p-4 space-y-2 transition-transform hover:scale-[1.02] relative overflow-hidden cursor-pointer"
						onClick={() => {
							// Kalau user tadi drag, jangan buka modal (click event bisa tetap terpanggil).
							if (didDragRef.current) {
								didDragRef.current = false;
								return;
							}
							onCardClick(card);
						}}
					>
						{card.suggestionStatus === 'accepted' && (
							<div className="absolute inset-0 bg-green-500/15 flex items-center justify-center z-[1] pointer-events-none">
								<span className="text-green-600 dark:text-green-400 text-3xl font-black uppercase tracking-widest rotate-[-12deg] opacity-70 drop-shadow-sm">Diterima</span>
							</div>
						)}
						{card.suggestionStatus === 'rejected' && (
							<div className="absolute inset-0 bg-red-500/10 flex items-center justify-center z-[1] pointer-events-none">
								<span className="text-red-600 dark:text-red-400 text-3xl font-black uppercase tracking-widest rotate-[-12deg] opacity-70 drop-shadow-sm">Ditolak</span>
								<svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
									<line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="3" className="text-red-500" />
									<line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="3" className="text-red-500" />
								</svg>
							</div>
						)}
						<div className="relative z-[2]">
							<div className="flex items-center justify-between gap-1">
								<span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
									{card.typeLabel || card.type}
								</span>
								<span className="text-[10px] text-muted-foreground dark:text-slate-500">{card.destinationLabel || card.target}</span>
							</div>
							<p className="text-sm text-foreground dark:text-slate-200 line-clamp-3 mt-1">{card.body}</p>
							<p className="text-[11px] text-muted-foreground dark:text-slate-400 mt-1">— {card.isAnonymous ? 'Anonim' : card.senderName}</p>
							{card.media && card.media.length > 0 && (
								<p className="text-[10px] text-primary mt-1">{card.media.length} media</p>
							)}
							{card.reply && (
								<>
									<button
										type="button"
										onClick={(e) => { e.stopPropagation(); setExpandedReply(expandedReply === `fb-${idx}` ? null : `fb-${idx}`); }}
										className="mt-1.5 flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
									>
										<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
										{expandedReply === `fb-${idx}` ? 'Tutup Balasan' : 'Lihat Balasan'}
									</button>
									{expandedReply === `fb-${idx}` && (
										<div className="mt-1.5 p-2 rounded bg-muted/50 border-l-2 border-primary text-[11px]" onClick={(e) => e.stopPropagation()}>
											<p className="text-muted-foreground mb-0.5">Dari <span className="font-medium text-foreground">{card.reply.adminName}</span></p>
											<p className="text-foreground dark:text-slate-200 whitespace-pre-wrap line-clamp-4">{card.reply.message}</p>
										</div>
									)}
								</>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export default function Footer() {
	const { data: settings } = useQuery<Settings>({ queryKey: ['/api/settings'], staleTime: 1000, refetchOnWindowFocus: true });

	const guestSecret = getOrCreateGuestSecret();

	const { data: feedbackCards = [] } = useQuery<PublicFeedbackCard[]>({
		queryKey: ['/api/feedback/public'],
		queryFn: async () => {
			const res = await fetch('/api/feedback/public', { headers: { 'x-guest-key': guestSecret } });
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		staleTime: 30000,
	});

	const { data: fbConfig } = useQuery<FeedbackFormConfig>({
		queryKey: ['/api/feedback/config'],
		queryFn: async () => {
			const res = await fetch('/api/feedback/config');
			if (!res.ok) return DEFAULT_FEEDBACK_FORM_CONFIG;
			return res.json();
		},
		staleTime: 60000,
	});
	const config = fbConfig || DEFAULT_FEEDBACK_FORM_CONFIG;

	const destLabels = useMemo(() => {
		const map: Record<string, string> = {};
		for (const d of config.destinations) map[d.id] = d.label;
		return map;
	}, [config.destinations]);

	const typeLabels = useMemo(() => {
		const map: Record<string, string> = {};
		for (const d of config.destinations) {
			for (const t of d.types) map[t.id] = t.label;
		}
		return map;
	}, [config.destinations]);

	const sortedDestinations = useMemo(
		() => [...config.destinations].sort((a, b) => a.order - b.order),
		[config.destinations],
	);

	const contactEmail = settings?.contactEmail || 'hmti@uin-malang.ac.id';
	const address = settings?.address || 'Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang';
	const mapsEmbedUrl = settings?.mapsEmbedUrl || '';
	const footerText = settings?.footerText || `\u00A9 ${new Date().getFullYear()} Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.`;
	const socialLinks = settings?.socialLinks || { facebook: '#', tiktok: '#', instagram: '#', youtube: '#' };
	const oldLinks = settings?.links || { uinMalang: 'https://uin-malang.ac.id/', fakultasSainsTeknologi: 'https://saintek.uin-malang.ac.id/', jurusanTeknikInformatika: 'https://informatika.uin-malang.ac.id/', perpustakaan: 'https://library.uin-malang.ac.id/' };
	const quickLinks: Array<{ label: string; url: string }> = settings?.quickLinks?.length
		? settings.quickLinks
		: [
			{ label: 'UIN Malang', url: oldLinks.uinMalang },
			{ label: 'Fakultas Sains dan Teknologi', url: oldLinks.fakultasSainsTeknologi },
			{ label: 'Jurusan Teknik Informatika', url: oldLinks.jurusanTeknikInformatika },
			{ label: 'Perpustakaan', url: oldLinks.perpustakaan },
		].filter((l) => l.url);
	const submitEnabled = settings?.feedbackSubmitEnabled !== false;
	const cardsEnabled = settings?.feedbackCardsEnabled !== false;
	const autoScrollEnabled = settings?.feedbackCardsAutoScrollEnabled !== false;
	const showCards = submitEnabled && cardsEnabled;

	const [formOpen, setFormOpen] = useState(false);
	const [detailCard, setDetailCard] = useState<PublicFeedbackCard | null>(null);
	const [editingCard, setEditingCard] = useState<PublicFeedbackCard | null>(null);
	const [editBody, setEditBody] = useState('');
	const [isAnonymous, setIsAnonymous] = useState(false);
	const [target, setTarget] = useState(() => DEFAULT_FEEDBACK_FORM_CONFIG.destinations[0]?.id || 'web');
	const [feedbackType, setFeedbackType] = useState(
		() => DEFAULT_FEEDBACK_FORM_CONFIG.destinations[0]?.types[0]?.id || 'saran',
	);
	const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
	const [fileByField, setFileByField] = useState<Record<string, File[]>>({});
	const [senderName, setSenderName] = useState('');
	const [senderNim, setSenderNim] = useState('');
	const [senderEmail, setSenderEmail] = useState('');
	const [ratings, setRatings] = useState<Record<string, number>>({});
	const fileReplaceRefs = useRef<Record<string, HTMLInputElement | null>>({});
	const [submitSuccess, setSubmitSuccess] = useState(false);
	const [formClientError, setFormClientError] = useState<string | null>(null);
	const MAX_FEEDBACK_FILE_SIZE = 10 * 1024 * 1024; // 10MB

	const currentDest = useMemo(() => config.destinations.find((d) => d.id === target), [config.destinations, target]);
	const allowedTypes = currentDest?.types ?? [];
	const sortedFields = useMemo(() => {
		if (!currentDest) return [];
		return [...currentDest.fields].sort((a, b) => a.order - b.order);
	}, [currentDest]);

	useEffect(() => {
		if (sortedDestinations.length > 0 && !sortedDestinations.some((d) => d.id === target)) {
			setTarget(sortedDestinations[0].id);
		}
	}, [sortedDestinations, target]);

	useEffect(() => {
		setFieldValues({});
		setFileByField({});
		setRatings({});
	}, [target]);

	useEffect(() => {
		if (allowedTypes.length > 0 && !allowedTypes.find((t) => t.id === feedbackType)) {
			setFeedbackType(allowedTypes[0].id);
		}
	}, [allowedTypes, feedbackType]);

	const maxFilesForField = useCallback((f: FeedbackFieldDefinition) => Math.min(20, Math.max(1, f.maxFiles ?? 10)), []);

	const appendFilesForField = useCallback(
		(fieldId: string, files: FileList | null, append: boolean) => {
			const picked = Array.from(files || []);
			if (picked.length === 0) return;
			const oversized = picked.find((f) => f.size > MAX_FEEDBACK_FILE_SIZE);
			if (oversized) {
				setFormClientError(`File "${oversized.name}" melebihi batas 10MB.`);
				return;
			}
			setFormClientError(null);
			setFileByField((prev) => {
				const field = sortedFields.find((x) => x.id === fieldId);
				const max = field ? maxFilesForField(field) : 10;
				const cur = append ? (prev[fieldId] || []) : [];
				const merged = [...cur, ...picked].slice(0, max);
				return { ...prev, [fieldId]: merged };
			});
		},
		[sortedFields, maxFilesForField, MAX_FEEDBACK_FILE_SIZE],
	);

	const removeFileAt = useCallback((fieldId: string, idx: number) => {
		setFileByField((prev) => {
			const list = [...(prev[fieldId] || [])];
			list.splice(idx, 1);
			return { ...prev, [fieldId]: list };
		});
	}, []);

	const replaceFileAt = useCallback((fieldId: string, idx: number, file: File) => {
		if (file.size > MAX_FEEDBACK_FILE_SIZE) {
			setFormClientError(`File "${file.name}" melebihi batas 10MB.`);
			return;
		}
		setFormClientError(null);
		setFileByField((prev) => {
			const list = [...(prev[fieldId] || [])];
			list[idx] = file;
			return { ...prev, [fieldId]: list };
		});
	}, [MAX_FEEDBACK_FILE_SIZE]);

	const toggleMultiSelect = useCallback((fieldId: string, option: string) => {
		setFieldValues((p) => {
			const cur = Array.isArray(p[fieldId]) ? (p[fieldId] as string[]) : [];
			const next = cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option];
			return { ...p, [fieldId]: next };
		});
	}, []);

	const validateClient = useCallback((): string | null => {
		if (!isAnonymous) {
			if (!senderName.trim()) return 'Nama wajib diisi';
			if (!senderNim.trim()) return 'NIM wajib diisi';
			if (!senderEmail.trim()) return 'Email wajib diisi';
		}
		if (allowedTypes.length === 0) return 'Form belum dikonfigurasi (tidak ada jenis feedback)';
		for (const f of sortedFields) {
			if (f.kind === 'file') {
				if (f.required && (fileByField[f.id]?.length || 0) === 0) return `"${f.label}" wajib diunggah`;
				continue;
			}
			const v = fieldValues[f.id];
			if (f.kind === 'checkbox') {
				if (f.required && !v) return `"${f.label}" wajib dicentang`;
				continue;
			}
			if (f.kind === 'multi_select') {
				const arr = Array.isArray(v) ? (v as string[]) : [];
				if (f.required && arr.length === 0) return `"${f.label}" wajib dipilih`;
				continue;
			}
			const s = typeof v === 'string' ? v.trim() : '';
			if (
				f.required &&
				(f.kind === 'short_text' || f.kind === 'textarea' || f.kind === 'rich_html' || f.kind === 'select') &&
				!s
			) {
				return `"${f.label}" wajib diisi`;
			}
			if (f.kind === 'select' && s && f.options?.length && !f.options.includes(s)) {
				return `Pilihan tidak valid untuk "${f.label}"`;
			}
		}
		return null;
	}, [isAnonymous, senderName, senderNim, senderEmail, allowedTypes.length, sortedFields, fieldValues, fileByField]);

	const submitMut = useMutation({
		mutationFn: async () => {
			const jsonExtra: Record<string, unknown> = {};
			for (const f of sortedFields) {
				if (f.kind === 'file') continue;
				const v = fieldValues[f.id];
				if (f.kind === 'checkbox') {
					jsonExtra[f.id] = !!v;
					continue;
				}
				if (f.kind === 'multi_select') {
					jsonExtra[f.id] = Array.isArray(v) ? v : [];
					continue;
				}
				if (typeof v === 'string') {
					const t = v.trim();
					if (t) jsonExtra[f.id] = t;
				}
			}

			const previewTa = sortedFields.find((f) => f.kind === 'textarea' && f.useForCardPreview);
			const previewText =
				previewTa && typeof fieldValues[previewTa.id] === 'string' ? (fieldValues[previewTa.id] as string).trim() : '';
			const firstTa = sortedFields.find((f) => f.kind === 'textarea');
			const firstTaText =
				firstTa && typeof fieldValues[firstTa.id] === 'string' ? (fieldValues[firstTa.id] as string).trim() : '';
			const bodyFieldText = previewText || firstTaText;

			const fd = new FormData();
			fd.append('target', target);
			fd.append('type', feedbackType);
			fd.append('body', bodyFieldText);
			fd.append('isAnonymous', String(isAnonymous));
			if (!isAnonymous) {
				fd.append('senderName', senderName.trim());
				fd.append('senderNim', senderNim.trim());
				fd.append('senderEmail', senderEmail.trim());
			}
			fd.append('ratings', JSON.stringify(ratings));
			if (Object.keys(jsonExtra).length > 0) fd.append('extraFields', JSON.stringify(jsonExtra));

			for (const f of sortedFields) {
				if (f.kind !== 'file') continue;
				for (const file of fileByField[f.id] || []) {
					fd.append(`field_${f.id}`, file);
				}
			}

			const res = await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'x-guest-key': guestSecret },
				body: fd,
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Gagal mengirim' }));
				throw new Error(err.message);
			}
			return res.json();
		},
		onSuccess: () => {
			setSubmitSuccess(true);
			setSenderName('');
			setSenderNim('');
			setSenderEmail('');
			setRatings({});
			setFieldValues({});
			setFileByField({});
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/public'] });
			setTimeout(() => {
				setSubmitSuccess(false);
				setFormOpen(false);
			}, 2500);
		},
	});

	const deleteMut = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/feedback/own/${id}`, { method: 'DELETE', headers: { 'x-guest-key': guestSecret } });
			if (!res.ok) throw new Error('Failed');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/public'] });
			setDetailCard(null);
		},
	});

	const editMut = useMutation({
		mutationFn: async ({ id, body: newBody }: { id: string; body: string }) => {
			const res = await fetch(`/api/feedback/own/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', 'x-guest-key': guestSecret },
				body: JSON.stringify({ body: newBody }),
			});
			if (!res.ok) throw new Error('Failed');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/public'] });
			setEditingCard(null);
			setDetailCard(null);
		},
	});

	return (
		<footer className="bg-background dark:bg-gradient-to-b dark:from-[#07122d] dark:to-[#050b1c] text-foreground dark:text-slate-100 py-12 border-t border-border">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Feedback Cards Carousel */}
				{showCards && feedbackCards.length > 0 && (
					<div className="mb-10" data-aos="fade-up">
						<h3 className="text-center text-lg font-semibold mb-4">Saran & Kritik dari Pengguna</h3>
						<FeedbackCarousel cards={feedbackCards} enabled={autoScrollEnabled && !detailCard} onCardClick={(c) => setDetailCard(c)} />
					</div>
				)}

				<div className="grid md:grid-cols-4 sm:grid-cols-2 gap-8">
					<div data-aos="fade-up" data-aos-delay="100">
						<h3 className="text-lg font-semibold mb-4">Lokasi</h3>
						<div className="w-full h-48 md:h-56 lg:h-64 rounded-lg overflow-hidden border border-border shadow-md">
							<iframe title="Lokasi Fakultas Sains dan Teknologi UIN Malang" src={mapsEmbedUrl || 'https://www.google.com/maps?q=' + encodeURIComponent(address) + '&output=embed'} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="w-full h-full border-0" allowFullScreen />
						</div>
					</div>

					<div data-aos="fade-up" data-aos-delay="200">
						<h3 className="text-lg font-semibold mb-4">Kontak</h3>
						<ul className="space-y-2 text-muted-foreground dark:text-slate-300/80">
							<li className="flex items-start">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-foreground/70 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
								{contactEmail}
							</li>
							<li className="flex items-start">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-foreground/70 dark:text-slate-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
								{address}
							</li>
						</ul>
					</div>

					<div data-aos="fade-up" data-aos-delay="300">
						<h3 className="text-lg font-semibold mb-4">Tautan</h3>
						<ul className="space-y-2 text-muted-foreground dark:text-slate-300/80">
							{quickLinks.map((link, idx) => (
								<li key={idx}><a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{link.label}</a></li>
							))}
						</ul>
					</div>

					<div data-aos="fade-up" data-aos-delay="400">
						<h3 className="text-lg font-semibold mb-4">Media Sosial</h3>
						<div className="flex space-x-4">
							<a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground dark:text-slate-300/80 hover:text-primary transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg></a>
							<a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-muted-foreground dark:text-slate-300/80 hover:text-primary transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg></a>
							<a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-muted-foreground dark:text-slate-300/80 hover:text-primary transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg></a>
							<a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground dark:text-slate-300/80 hover:text-primary transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" /></svg></a>
						</div>
						{submitEnabled && (
							<button
								type="button"
								onClick={() => {
									setFormOpen(true);
									setSubmitSuccess(false);
									setFormClientError(null);
								}}
								className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
							>
								<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
								Kirim Masukan
							</button>
						)}
					</div>
				</div>

				<div className="mt-12 pt-8 border-t border-border text-center text-muted-foreground dark:text-slate-300/70 text-sm" data-aos="fade-up" data-aos-delay="500">
					<p>{footerText}</p>
				</div>
			</div>

			{/* Detail Modal */}
			{detailCard && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailCard(null)} />
					<div className="relative bg-background dark:bg-[#0c1a3a] border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold">Detail {typeLabels[detailCard.type] || detailCard.typeLabel || detailCard.type}</h3>
							<button type="button" onClick={() => setDetailCard(null)} className="text-muted-foreground hover:text-foreground p-1">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						<div className="flex items-center gap-2 flex-wrap">
							<span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
								{typeLabels[detailCard.type] || detailCard.typeLabel || detailCard.type}
							</span>
							<span className="text-xs text-muted-foreground">{destLabels[detailCard.target] || detailCard.destinationLabel || detailCard.target}</span>
							{detailCard.suggestionStatus && detailCard.suggestionStatus !== 'pending' && (
								<span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${detailCard.suggestionStatus === 'accepted' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
									{detailCard.suggestionStatus === 'accepted' ? 'Diterima' : 'Ditolak'}
								</span>
							)}
						</div>

						<div className="text-sm">
							<span className="text-muted-foreground">Dari: </span>
							<span className="font-medium">{detailCard.isAnonymous ? 'Anonim' : detailCard.senderName}</span>
							<span className="text-muted-foreground ml-2">{new Date(detailCard.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
						</div>

						<p className="text-sm whitespace-pre-wrap">{detailCard.body}</p>

						{renderExtraFieldsBlock(detailCard.extraFields)}

						{detailCard.media && detailCard.media.length > 0 && (
							<div className="grid grid-cols-2 gap-2">
								{detailCard.media.map((m, i) => (
									<a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border/30">
										{(m as any).mimeType?.startsWith('image/') ? (
											<img src={m.url} alt={m.originalName || `media-${i}`} className="w-full h-32 object-cover" loading="lazy" />
										) : (
											<div className="w-full h-32 flex items-center justify-center text-xs text-muted-foreground px-2 text-center">
												{m.originalName || `Lampiran ${i + 1}`}
											</div>
										)}
									</a>
								))}
							</div>
						)}

						{/* Decision comment */}
						{detailCard.suggestionStatus && detailCard.suggestionStatus !== 'pending' && detailCard.suggestionDecisionComment && (
							<div className={`rounded-lg p-3 border-l-2 ${detailCard.suggestionStatus === 'accepted' ? 'bg-green-50 dark:bg-green-500/10 border-green-500' : 'bg-red-50 dark:bg-red-500/10 border-red-500'}`}>
								<p className="text-xs text-muted-foreground mb-1">Komentar keputusan dari {detailCard.suggestionDeciderName}:</p>
								<p className="text-sm whitespace-pre-wrap">{detailCard.suggestionDecisionComment}</p>
							</div>
						)}

						{/* Reply dari admin/owner */}
						{detailCard.reply && (
							<div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary">
								<p className="text-xs text-muted-foreground mb-1">Balasan dari <span className="font-medium">{detailCard.reply.adminName}</span></p>
								<p className="text-sm whitespace-pre-wrap">{detailCard.reply.message}</p>
							</div>
						)}

						{/* Own actions: edit/delete */}
						{detailCard.isOwn && (
							<div className="flex gap-2 pt-2 border-t border-border/30">
								<button type="button" onClick={() => { setEditingCard(detailCard); setEditBody(detailCard.body); }} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">Edit</button>
								<button type="button" onClick={() => { if (confirm('Hapus feedback ini?')) deleteMut.mutate(detailCard._id); }} className="flex-1 py-2 rounded-lg border border-red-500/30 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors">
									{deleteMut.isPending ? 'Menghapus...' : 'Hapus'}
								</button>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Edit Modal */}
			{editingCard && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingCard(null)} />
					<div className="relative bg-background dark:bg-[#0c1a3a] border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
						<h3 className="text-lg font-semibold">Edit Feedback</h3>
						<textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
						<div className="flex gap-2">
							<button type="button" onClick={() => setEditingCard(null)} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50">Batal</button>
							<button type="button" disabled={!editBody.trim() || editMut.isPending} onClick={() => editMut.mutate({ id: editingCard._id, body: editBody })} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
								{editMut.isPending ? 'Menyimpan...' : 'Simpan'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Feedback Form Modal */}
			{formOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
					<div className="relative bg-background dark:bg-[#0c1a3a] border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold">Kirim Masukan</h3>
							<button type="button" onClick={() => setFormOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						{submitSuccess ? (
							<div className="text-center py-8 space-y-3">
								<div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
									<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
								</div>
								<p className="text-lg font-medium">Terima kasih!</p>
								<p className="text-sm text-muted-foreground">Feedback Anda berhasil dikirim.</p>
							</div>
						) : (
							<form
								onSubmit={(e) => {
									e.preventDefault();
									const err = validateClient();
									if (err) {
										setFormClientError(err);
										return;
									}
									setFormClientError(null);
									submitMut.mutate();
								}}
								className="space-y-4"
							>
								<div>
									<label className="text-sm font-medium block mb-1.5">Tujuan</label>
									<select
										value={target}
										onChange={(e) => {
											setTarget(e.target.value);
										}}
										className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
									>
										{sortedDestinations.map((d) => (
											<option key={d.id} value={d.id}>
												{d.label}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className="text-sm font-medium block mb-1.5">Jenis</label>
									{allowedTypes.length === 0 ? (
										<p className="text-sm text-amber-600 dark:text-amber-400">Belum ada jenis feedback untuk tujuan ini.</p>
									) : (
										<div className="flex gap-3 flex-wrap">
											{[...allowedTypes].sort((a, b) => a.order - b.order).map((t) => (
												<button
													key={t.id}
													type="button"
													onClick={() => setFeedbackType(t.id)}
													className={`flex-1 min-w-[80px] py-2 rounded-lg border text-sm font-medium transition-colors ${feedbackType === t.id ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'}`}
												>
													{t.label}
												</button>
											))}
										</div>
									)}
								</div>

								<div className="flex items-center justify-between">
									<label className="text-sm font-medium">Kirim sebagai Anonim</label>
									<button type="button" role="switch" aria-checked={isAnonymous} onClick={() => setIsAnonymous(!isAnonymous)} className={`relative w-11 h-6 rounded-full transition-colors ${isAnonymous ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
										<span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isAnonymous ? 'translate-x-5' : ''}`} />
									</button>
								</div>

								{!isAnonymous && (
									<div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
										<div>
											<label className="text-sm font-medium block mb-1">Nama</label>
											<input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Nama lengkap" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" required />
										</div>
										<div>
											<label className="text-sm font-medium block mb-1">NIM</label>
											<input type="text" value={senderNim} onChange={(e) => setSenderNim(e.target.value)} placeholder="Nomor Induk Mahasiswa" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" required />
										</div>
										<div>
											<label className="text-sm font-medium block mb-1">Email</label>
											<input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="Email aktif (untuk menerima balasan)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" required />
										</div>
									</div>
								)}

								<div className="space-y-4">
									{sortedFields.map((f) => {
										const req = f.required ? <span className="text-red-500 ml-0.5">*</span> : null;
										const valStr = typeof fieldValues[f.id] === 'string' ? (fieldValues[f.id] as string) : '';
										if (f.kind === 'short_text') {
											return (
												<div key={f.id}>
													<label className="text-sm font-medium block mb-1.5">
														{f.label}
														{req}
													</label>
													<input
														type="text"
														value={valStr}
														onChange={(e) => setFieldValues((p) => ({ ...p, [f.id]: e.target.value }))}
														placeholder={f.placeholder || ''}
														className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
													/>
													{f.helpText ? <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p> : null}
												</div>
											);
										}
										if (f.kind === 'textarea') {
											return (
												<div key={f.id}>
													<label className="text-sm font-medium block mb-1.5">
														{f.label}
														{req}
													</label>
													<textarea
														value={valStr}
														onChange={(e) => setFieldValues((p) => ({ ...p, [f.id]: e.target.value }))}
														placeholder={f.placeholder || 'Tuliskan masukan Anda...'}
														rows={4}
														className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
													/>
													{f.helpText ? <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p> : null}
												</div>
											);
										}
										if (f.kind === 'rich_html') {
											return (
												<div key={f.id}>
													<label className="text-sm font-medium block mb-1.5">
														{f.label}
														{req}
													</label>
													<Suspense
														fallback={<div className="min-h-[180px] rounded-lg border border-border bg-muted/30 animate-pulse" aria-hidden />}
													>
														<RichTextEditor
															value={valStr}
															onChange={(html) => setFieldValues((p) => ({ ...p, [f.id]: html }))}
															height={220}
															placeholder={f.placeholder || 'Tulis di sini...'}
														/>
													</Suspense>
													{f.helpText ? <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p> : null}
												</div>
											);
										}
										if (f.kind === 'select') {
											return (
												<div key={f.id}>
													<label className="text-sm font-medium block mb-1.5">
														{f.label}
														{req}
													</label>
													<select
														value={valStr}
														onChange={(e) => setFieldValues((p) => ({ ...p, [f.id]: e.target.value }))}
														className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
													>
														<option value="">Pilih...</option>
														{(f.options || []).map((opt) => (
															<option key={opt} value={opt}>
																{opt}
															</option>
														))}
													</select>
													{f.helpText ? <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p> : null}
												</div>
											);
										}
										if (f.kind === 'checkbox') {
											const checked = !!fieldValues[f.id];
											return (
												<label key={f.id} className="flex items-center gap-2 cursor-pointer text-sm">
													<input
														type="checkbox"
														checked={checked}
														onChange={(e) => setFieldValues((p) => ({ ...p, [f.id]: e.target.checked }))}
														className="rounded border-border"
													/>
													<span>
														{f.label}
														{req}
													</span>
												</label>
											);
										}
										if (f.kind === 'multi_select') {
											const selected = Array.isArray(fieldValues[f.id]) ? (fieldValues[f.id] as string[]) : [];
											return (
												<div key={f.id}>
													<p className="text-sm font-medium block mb-1.5">
														{f.label}
														{req}
													</p>
													<div className="space-y-1.5 pl-0.5">
														{(f.options || []).map((opt) => (
															<label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
																<input
																	type="checkbox"
																	checked={selected.includes(opt)}
																	onChange={() => toggleMultiSelect(f.id, opt)}
																	className="rounded border-border"
																/>
																{opt}
															</label>
														))}
													</div>
													{f.helpText ? <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p> : null}
												</div>
											);
										}
										if (f.kind === 'file') {
											const max = maxFilesForField(f);
											const list = fileByField[f.id] || [];
											return (
												<div key={f.id}>
													<label className="text-sm font-medium block mb-1.5">
														{f.label}
														{req}{' '}
														<span className="text-muted-foreground font-normal">(maks {max} file)</span>
													</label>
													<input
														type="file"
														multiple
														onChange={(e: ChangeEvent<HTMLInputElement>) => {
															appendFilesForField(f.id, e.target.files, true);
															e.target.value = '';
														}}
														disabled={list.length >= max}
														className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:bg-muted/50 file:text-sm file:font-medium hover:file:bg-muted disabled:opacity-60"
													/>
													{list.length > 0 && (
														<ul className="mt-2 space-y-1.5">
															{list.map((file, idx) => (
																<li
																	key={`${file.name}-${file.lastModified}-${idx}`}
																	className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-xs"
																>
																	<span className="truncate font-medium">{file.name}</span>
																	<span className="flex items-center gap-1 shrink-0">
																		<input
																			ref={(el) => {
																				fileReplaceRefs.current[`${f.id}-${idx}`] = el;
																			}}
																			type="file"
																			className="hidden"
																			onChange={(event) => {
																				const next = event.target.files?.[0];
																				if (next) replaceFileAt(f.id, idx, next);
																				event.target.value = '';
																			}}
																		/>
																		<button
																			type="button"
																			className="rounded border border-border px-2 py-0.5 hover:bg-muted/60"
																			onClick={() => fileReplaceRefs.current[`${f.id}-${idx}`]?.click()}
																		>
																			Ganti
																		</button>
																		<button
																			type="button"
																			className="rounded border border-red-500/40 px-2 py-0.5 text-red-500 hover:bg-red-500/10"
																			onClick={() => removeFileAt(f.id, idx)}
																		>
																			Hapus
																		</button>
																	</span>
																</li>
															))}
														</ul>
													)}
													{f.helpText ? <p className="text-xs text-muted-foreground mt-1">{f.helpText}</p> : null}
												</div>
											);
										}
										return null;
									})}
								</div>

								{(currentDest?.ratings ?? []).length > 0 && (
									<div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
										<p className="text-sm font-medium mb-2">
											Rating <span className="text-muted-foreground font-normal">(opsional, skala 1–5)</span>
										</p>
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
											{(currentDest?.ratings ?? []).map((dim) => (
												<div key={dim.id} className="flex items-center justify-between gap-2">
													<span className="text-xs text-muted-foreground">{dim.label}</span>
													<StarInput value={ratings[dim.id] || 0} max={5} onChange={(v) => setRatings((p) => ({ ...p, [dim.id]: v }))} />
												</div>
											))}
										</div>
									</div>
								)}

								{formClientError && <p className="text-sm text-red-500">{formClientError}</p>}
								{submitMut.isError && <p className="text-sm text-red-500">{(submitMut.error as Error).message}</p>}

								<button
									type="submit"
									disabled={submitMut.isPending || allowedTypes.length === 0}
									className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
								>
									{submitMut.isPending && (<svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>)}
									Kirim
								</button>
							</form>
						)}
					</div>
				</div>
			)}
		</footer>
	);
}
