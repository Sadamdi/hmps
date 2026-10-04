import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Flag, Loader2, Pencil, Play, Star, Trash2, Video, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useBuyer, useStorePaths } from '@/hooks/use-buyer';
import { useToast } from '@/hooks/use-toast';
import { useApiUrl } from '@/lib/tenant-context';
import { apiErrorText } from '@/lib/queryClient';
import { Link } from 'wouter';

/** Batas media ulasan — sama dengan server (REVIEW_MEDIA_LIMITS). */
const LIMITS = { images: 4, videos: 1, imageMb: 8, videoMb: 30, comment: 1000 };
const PAGE_SIZE = 5;

export interface ReviewItem {
	id: string;
	productId: string;
	orderNo?: string;
	rating: number;
	comment: string;
	media: { url: string; type: 'image' | 'video' }[];
	author: string;
	anonymous?: boolean;
	variantLabel?: string;
	createdAt: string;
	editedAt: string | null;
	mine: boolean;
	hidden?: boolean;
}

interface ReviewsPage {
	summary: { average: number; count: number; distribution: Record<string, number> };
	items: ReviewItem[];
	page: number;
	total: number;
	hasMore: boolean;
	viewer: { loggedIn: boolean; canReview: boolean; eligibleOrderNo: string | null; mine: ReviewItem | null };
}

export function StarRating({ value, size = 16, className = '' }: { value: number; size?: number; className?: string }) {
	return (
		<span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${value} dari 5 bintang`}>
			{[1, 2, 3, 4, 5].map((n) => (
				<Star key={n} style={{ width: size, height: size }} className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'} />
			))}
		</span>
	);
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
	return (
		<div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
			{[1, 2, 3, 4, 5].map((n) => (
				<button
					key={n}
					type="button"
					role="radio"
					aria-checked={value === n}
					aria-label={`${n} bintang`}
					onClick={() => onChange(n)}
					className="p-1 rounded hover:scale-110 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
					<Star className={`h-8 w-8 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
				</button>
			))}
		</div>
	);
}

const RATING_TEXT = ['', 'Sangat buruk', 'Kurang', 'Cukup', 'Bagus', 'Sangat bagus'];
const fmtDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/** Foto/video ulasan: thumbnail kecil, klik untuk memperbesar / memutar. */
function ReviewMedia({ media }: { media: ReviewItem['media'] }) {
	const [open, setOpen] = useState<ReviewItem['media'][number] | null>(null);
	if (!media.length) return null;
	return (
		<>
			<div className="flex flex-wrap gap-2 pt-1">
				{media.map((m) => (
					<button
						key={m.url}
						type="button"
						onClick={() => setOpen(m)}
						className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-md border bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
						aria-label={m.type === 'video' ? 'Putar video ulasan' : 'Perbesar foto ulasan'}>
						{m.type === 'image' ? (
							<img src={m.url} alt="Foto ulasan" loading="lazy" className="h-full w-full object-cover" />
						) : (
							<>
								<video src={`${m.url}#t=0.1`} preload="metadata" muted className="h-full w-full object-cover" />
								<span className="absolute inset-0 flex items-center justify-center bg-black/30">
									<Play className="h-6 w-6 text-white" />
								</span>
							</>
						)}
					</button>
				))}
			</div>
			<Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
				<DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-3xl p-2 sm:p-4">
					<DialogHeader className="sr-only">
						<DialogTitle>Media ulasan</DialogTitle>
						<DialogDescription>Pratinjau foto atau video ulasan</DialogDescription>
					</DialogHeader>
					{open?.type === 'image' && <img src={open.url} alt="Foto ulasan" className="max-h-[80vh] w-full object-contain rounded" />}
					{open?.type === 'video' && <video src={open.url} controls autoPlay playsInline className="max-h-[80vh] w-full rounded bg-black" />}
				</DialogContent>
			</Dialog>
		</>
	);
}

const REPORT_REASONS: { value: string; label: string }[] = [
	{ value: 'spam', label: 'Spam atau iklan' },
	{ value: 'kasar', label: 'Kasar atau menyinggung' },
	{ value: 'tidak_relevan', label: 'Tidak relevan dengan produk' },
	{ value: 'privasi', label: 'Memuat data pribadi' },
	{ value: 'lainnya', label: 'Lainnya' },
];

function ReportDialog({ reviewId, apiBase, onClose }: { reviewId: string | null; apiBase: string; onClose: () => void }) {
	const { toast } = useToast();
	const [reason, setReason] = useState('spam');
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);
	const submit = async () => {
		if (!reviewId) return;
		setBusy(true);
		try {
			const r = await fetch(`${apiBase}/reviews/${reviewId}/report`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason, note }),
			});
			const j = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(j?.message || 'Gagal mengirim laporan');
			toast({ title: j?.message || 'Laporan diterima' });
			setNote('');
			onClose();
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal mengirim laporan'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};
	return (
		<Dialog open={!!reviewId} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Laporkan ulasan</DialogTitle>
					<DialogDescription>Admin toko akan meninjau laporanmu.</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div className="grid gap-2">
						{REPORT_REASONS.map((r) => (
							<label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
								<input type="radio" name="report-reason" checked={reason === r.value} onChange={() => setReason(r.value)} />
								{r.label}
							</label>
						))}
					</div>
					<Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Catatan (opsional, maks 200 karakter)" rows={2} />
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Batal
					</Button>
					<Button onClick={submit} disabled={busy} className="gap-2">
						{busy && <Loader2 className="h-4 w-4 animate-spin" />} Kirim laporan
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface PendingFile {
	file: File;
	url: string;
	kind: 'image' | 'video';
}

/** Form tulis/edit ulasan: bintang, komentar, samarkan nama, foto (maks 4) dan video (maks 1). */
export function ReviewFormDialog({
	open,
	onOpenChange,
	apiBase,
	orderNo,
	productId,
	productName,
	existing,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	apiBase: string;
	orderNo: string;
	productId: string;
	productName: string;
	existing?: ReviewItem | null;
	onSaved: () => void;
}) {
	const { toast } = useToast();
	const [rating, setRating] = useState(existing?.rating || 0);
	const [comment, setComment] = useState(existing?.comment || '');
	const [anonymous, setAnonymous] = useState(!!existing?.anonymous);
	const [kept, setKept] = useState<ReviewItem['media']>(existing?.media || []);
	const [files, setFiles] = useState<PendingFile[]>([]);
	const [busy, setBusy] = useState(false);
	const photoInput = useRef<HTMLInputElement>(null);
	const videoInput = useRef<HTMLInputElement>(null);

	const imageCount = kept.filter((m) => m.type === 'image').length + files.filter((f) => f.kind === 'image').length;
	const videoCount = kept.filter((m) => m.type === 'video').length + files.filter((f) => f.kind === 'video').length;

	const addFiles = (kind: 'image' | 'video') => (e: ChangeEvent<HTMLInputElement>) => {
		const picked = Array.from(e.target.files || []);
		e.target.value = '';
		let img = imageCount;
		let vid = videoCount;
		const next: PendingFile[] = [];
		for (const file of picked) {
			if (kind === 'image') {
				if (!file.type.startsWith('image/')) return toast({ title: 'Pilih file foto', variant: 'destructive' });
				if (file.size > LIMITS.imageMb * 1024 * 1024) return toast({ title: `Foto maksimal ${LIMITS.imageMb} MB`, variant: 'destructive' });
				if (img >= LIMITS.images) return toast({ title: `Maksimal ${LIMITS.images} foto`, variant: 'destructive' });
				img++;
			} else {
				if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) return toast({ title: 'Video harus MP4, WebM, atau MOV', variant: 'destructive' });
				if (file.size > LIMITS.videoMb * 1024 * 1024) return toast({ title: `Video maksimal ${LIMITS.videoMb} MB`, variant: 'destructive' });
				if (vid >= LIMITS.videos) return toast({ title: `Maksimal ${LIMITS.videos} video`, variant: 'destructive' });
				vid++;
			}
			next.push({ file, kind, url: URL.createObjectURL(file) });
		}
		setFiles((f) => [...f, ...next]);
	};
	const removePending = (url: string) => {
		URL.revokeObjectURL(url);
		setFiles((f) => f.filter((x) => x.url !== url));
	};

	const submit = async () => {
		if (!rating) return toast({ title: 'Pilih rating bintang dulu', variant: 'destructive' });
		setBusy(true);
		try {
			const fd = new FormData();
			fd.append('rating', String(rating));
			fd.append('comment', comment);
			fd.append('anonymous', anonymous ? 'true' : 'false');
			if (existing) fd.append('keepMedia', JSON.stringify(kept.map((m) => m.url)));
			else fd.append('productId', productId);
			files.forEach((f) => fd.append('media', f.file, f.file.name));
			const r = await fetch(existing ? `${apiBase}/reviews/${existing.id}` : `${apiBase}/orders/${encodeURIComponent(orderNo)}/reviews`, {
				method: existing ? 'PATCH' : 'POST',
				credentials: 'include',
				body: fd,
			});
			const j = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(j?.message || 'Gagal menyimpan ulasan');
			toast({ title: existing ? 'Ulasan diperbarui' : 'Terima kasih! Ulasanmu tersimpan' });
			files.forEach((f) => URL.revokeObjectURL(f.url));
			setFiles([]);
			onSaved();
			onOpenChange(false);
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal menyimpan ulasan'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
			<DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{existing ? 'Edit ulasan' : 'Tulis ulasan'}</DialogTitle>
					<DialogDescription className="line-clamp-2">{productName}</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<StarInput value={rating} onChange={setRating} />
						<p className="mt-1 text-xs text-muted-foreground h-4">{RATING_TEXT[rating]}</p>
					</div>
					<div className="space-y-1">
						<Label htmlFor="rv-comment">Ceritakan pengalamanmu (opsional)</Label>
						<Textarea id="rv-comment" value={comment} onChange={(e) => setComment(e.target.value.slice(0, LIMITS.comment))} rows={4} placeholder="Kualitas, ukuran, pengiriman, kesan..." />
						<p className="text-right text-[11px] text-muted-foreground">
							{comment.length}/{LIMITS.comment}
						</p>
					</div>
					<div className="space-y-2">
						<Label>
							Foto & video (opsional) <span className="text-xs text-muted-foreground font-normal">— maks {LIMITS.images} foto ({LIMITS.imageMb} MB) + {LIMITS.videos} video ({LIMITS.videoMb} MB)</span>
						</Label>
						<div className="flex flex-wrap gap-2">
							{kept.map((m) => (
								<div key={m.url} className="relative h-20 w-20 overflow-hidden rounded-md border bg-muted">
									{m.type === 'image' ? <img src={m.url} alt="" className="h-full w-full object-cover" /> : <video src={`${m.url}#t=0.1`} preload="metadata" muted className="h-full w-full object-cover" />}
									<button type="button" aria-label="Hapus media" onClick={() => setKept((k) => k.filter((x) => x.url !== m.url))} className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white">
										<X className="h-3.5 w-3.5" />
									</button>
								</div>
							))}
							{files.map((f) => (
								<div key={f.url} className="relative h-20 w-20 overflow-hidden rounded-md border bg-muted">
									{f.kind === 'image' ? <img src={f.url} alt="" className="h-full w-full object-cover" /> : <video src={f.url} muted className="h-full w-full object-cover" />}
									<button type="button" aria-label="Hapus media" onClick={() => removePending(f.url)} className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white">
										<X className="h-3.5 w-3.5" />
									</button>
								</div>
							))}
						</div>
						<div className="flex flex-wrap gap-2">
							<input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={addFiles('image')} />
							<input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={addFiles('video')} />
							<Button type="button" variant="outline" size="sm" className="gap-2" disabled={imageCount >= LIMITS.images} onClick={() => photoInput.current?.click()}>
								<Camera className="h-4 w-4" /> Foto ({imageCount}/{LIMITS.images})
							</Button>
							<Button type="button" variant="outline" size="sm" className="gap-2" disabled={videoCount >= LIMITS.videos} onClick={() => videoInput.current?.click()}>
								<Video className="h-4 w-4" /> Video ({videoCount}/{LIMITS.videos})
							</Button>
						</div>
					</div>
					<div className="flex items-center justify-between gap-3 rounded-md border p-3">
						<div>
							<p className="text-sm font-medium">Samarkan namaku</p>
							<p className="text-xs text-muted-foreground">Tampil sebagai "{anonymous ? 'S*****n' : 'Nama depan + inisial'}". Email dan no HP tidak pernah ditampilkan.</p>
						</div>
						<Switch checked={anonymous} onCheckedChange={setAnonymous} aria-label="Samarkan nama" />
					</div>
				</div>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
						Batal
					</Button>
					<Button onClick={submit} disabled={busy || !rating} className="gap-2">
						{busy && <Loader2 className="h-4 w-4 animate-spin" />} {existing ? 'Simpan perubahan' : 'Kirim ulasan'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ReviewCard({ r, onEdit, onDelete, onReport }: { r: ReviewItem; onEdit?: () => void; onDelete?: () => void; onReport?: () => void }) {
	return (
		<div className="py-4 first:pt-0 space-y-1.5">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				<StarRating value={r.rating} size={14} />
				<span className="text-sm font-medium">{r.author}</span>
				{r.mine && <Badge variant="secondary">Ulasanmu</Badge>}
				{r.hidden && <Badge variant="destructive">Disembunyikan admin</Badge>}
				<span className="text-xs text-muted-foreground">
					{fmtDate(r.createdAt)}
					{r.editedAt ? ' · diedit' : ''}
				</span>
			</div>
			{r.variantLabel && <p className="text-xs text-muted-foreground">Varian: {r.variantLabel}</p>}
			{r.comment && <p className="text-sm whitespace-pre-line break-words">{r.comment}</p>}
			<ReviewMedia media={r.media} />
			{(onEdit || onDelete || onReport) && (
				<div className="flex gap-1 pt-1">
					{onEdit && (
						<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onEdit}>
							<Pencil className="h-3 w-3" /> Edit
						</Button>
					)}
					{onDelete && (
						<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-destructive" onClick={onDelete}>
							<Trash2 className="h-3 w-3" /> Hapus
						</Button>
					)}
					{onReport && (
						<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={onReport}>
							<Flag className="h-3 w-3" /> Laporkan
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

type Filter = 'all' | '5' | '4' | '3' | '2' | '1' | 'media';

/**
 * Ulasan di halaman produk: ringkasan bintang, filter, dan daftar yang bisa di-scroll di dalam kotak
 * (5 ulasan per muatan, "Muat lebih banyak" otomatis lewat tombol atau scroll). Mobile & PC.
 */
export function ProductReviews({ productId, productName }: { productId: string; productName: string }) {
	const base = useApiUrl('/store');
	const { buyer } = useBuyer();
	const { loginHref } = useStorePaths();
	const qc = useQueryClient();
	const { toast } = useToast();
	const [filter, setFilter] = useState<Filter>('all');
	const [sort, setSort] = useState<'new' | 'high' | 'low'>('new');
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<ReviewItem | null>(null);
	const [reportId, setReportId] = useState<string | null>(null);

	const queryKey = ['store-reviews', base, productId, filter, sort, buyer?.id || ''];
	const q = useInfiniteQuery<ReviewsPage>({
		queryKey,
		initialPageParam: 1,
		queryFn: async ({ pageParam }) => {
			const params = new URLSearchParams({ page: String(pageParam), limit: String(PAGE_SIZE), sort: filter === 'media' ? 'media' : sort });
			if (['1', '2', '3', '4', '5'].includes(filter)) params.set('star', filter);
			const r = await fetch(`${base}/public/products/${encodeURIComponent(productId)}/reviews?${params}`, { credentials: 'include' });
			if (!r.ok) throw new Error('reviews');
			return (await r.json()).data as ReviewsPage;
		},
		getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
		enabled: !!productId,
	});

	const first = q.data?.pages[0];
	const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) || [], [q.data]);
	const summary = first?.summary;
	const viewer = first?.viewer;
	const refresh = () => void qc.invalidateQueries({ queryKey: ['store-reviews', base, productId] });

	const remove = async (id: string) => {
		if (!window.confirm('Hapus ulasan ini? Setelah dihapus kamu bisa menulis ulasan baru untuk pesanan yang sama.')) return;
		try {
			const r = await fetch(`${base}/reviews/${id}`, { method: 'DELETE', credentials: 'include' });
			const j = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(j?.message || 'Gagal menghapus');
			toast({ title: 'Ulasan dihapus' });
			refresh();
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal menghapus ulasan'), variant: 'destructive' });
		}
	};

	const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 80 && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
	};

	const total = summary?.count || 0;
	const chips: { key: Filter; label: string }[] = [
		{ key: 'all', label: 'Semua' },
		...[5, 4, 3, 2, 1].map((n) => ({ key: String(n) as Filter, label: `${n}★ (${summary?.distribution?.[String(n)] || 0})` })),
		{ key: 'media', label: 'Dengan foto/video' },
	];

	return (
		<section id="ulasan" className="mt-10 scroll-mt-24" aria-label="Ulasan pembeli">
			<h2 className="text-xl font-bold mb-3">Ulasan pembeli</h2>
			<Card>
				<CardContent className="p-4 sm:p-6 space-y-4">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
						<div className="flex items-baseline gap-2 sm:flex-col sm:items-center sm:gap-1 sm:min-w-[7rem]">
							<span className="text-4xl font-bold tabular-nums">{total ? summary?.average.toFixed(1) : '–'}</span>
							<div className="flex flex-col sm:items-center">
								<StarRating value={summary?.average || 0} size={16} />
								<span className="text-xs text-muted-foreground">{total ? `${total} ulasan` : 'Belum ada ulasan'}</span>
							</div>
						</div>
						<div className="flex-1 space-y-1">
							{[5, 4, 3, 2, 1].map((n) => {
								const c = summary?.distribution?.[String(n)] || 0;
								return (
									<div key={n} className="flex items-center gap-2 text-xs">
										<span className="w-6 tabular-nums">{n}★</span>
										<div className="h-2 flex-1 overflow-hidden rounded bg-muted">
											<div className="h-full bg-amber-400" style={{ width: total ? `${(c / total) * 100}%` : '0%' }} />
										</div>
										<span className="w-6 text-right tabular-nums text-muted-foreground">{c}</span>
									</div>
								);
							})}
						</div>
						<div className="sm:min-w-[11rem]">
							{viewer?.canReview && viewer.eligibleOrderNo ? (
								<Button className="w-full" onClick={() => { setEditing(null); setFormOpen(true); }}>
									Tulis ulasan
								</Button>
							) : viewer?.mine ? null : !buyer ? (
								<Button asChild variant="outline" className="w-full">
									<Link href={loginHref(typeof window !== 'undefined' ? window.location.pathname : '')}>Masuk untuk menulis ulasan</Link>
								</Button>
							) : (
								<p className="text-xs text-muted-foreground">Ulasan bisa ditulis setelah pesananmu selesai.</p>
							)}
						</div>
					</div>

					{viewer?.mine && (
						<div className="rounded-md border border-primary/30 bg-primary/5 px-3">
							<ReviewCard
								r={viewer.mine}
								onEdit={() => { setEditing(viewer.mine); setFormOpen(true); }}
								onDelete={() => remove(viewer.mine!.id)}
							/>
						</div>
					)}

					{total > 0 && (
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex flex-wrap gap-1.5">
								{chips.map((c) => (
									<button
										key={c.key}
										type="button"
										onClick={() => setFilter(c.key)}
										aria-pressed={filter === c.key}
										className={`rounded-full border px-3 py-1 text-xs transition-colors ${filter === c.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>
										{c.label}
									</button>
								))}
							</div>
							<select
								value={sort}
								onChange={(e) => setSort(e.target.value as typeof sort)}
								disabled={filter === 'media'}
								aria-label="Urutkan ulasan"
								className="h-8 rounded-md border bg-background px-2 text-xs">
								<option value="new">Terbaru</option>
								<option value="high">Rating tertinggi</option>
								<option value="low">Rating terendah</option>
							</select>
						</div>
					)}

					{q.isLoading ? (
						<Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-muted-foreground" />
					) : q.isError ? (
						<p className="text-sm text-muted-foreground">Ulasan belum bisa dimuat. Coba muat ulang halaman.</p>
					) : items.length === 0 ? (
						<p className="py-4 text-center text-sm text-muted-foreground">{total ? 'Tidak ada ulasan untuk filter ini.' : 'Jadilah yang pertama mengulas produk ini.'}</p>
					) : (
						<div onScroll={onScroll} className="max-h-[32rem] overflow-y-auto divide-y pr-1" tabIndex={0} aria-label="Daftar ulasan">
							{items.map((r) => (
								<ReviewCard key={r.id} r={r} onReport={r.mine ? undefined : () => setReportId(r.id)} />
							))}
							{q.hasNextPage && (
								<div className="py-3 text-center">
									<Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="gap-2">
										{q.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />} Muat lebih banyak
									</Button>
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{(editing || viewer?.eligibleOrderNo) && formOpen && (
				<ReviewFormDialog
					key={editing?.id || 'new'}
					open={formOpen}
					onOpenChange={setFormOpen}
					apiBase={base}
					orderNo={editing?.orderNo || viewer?.eligibleOrderNo || ''}
					productId={productId}
					productName={productName}
					existing={editing}
					onSaved={refresh}
				/>
			)}
			<ReportDialog reviewId={reportId} apiBase={base} onClose={() => setReportId(null)} />
		</section>
	);
}

/** Ringkasan bintang kecil di dekat judul produk (tautan ke bagian ulasan). */
export function ProductRatingBadge({ productId }: { productId: string }) {
	const base = useApiUrl('/store');
	const { buyer } = useBuyer();
	const q = useInfiniteQuery<ReviewsPage>({
		queryKey: ['store-reviews', base, productId, 'all', 'new', buyer?.id || ''],
		initialPageParam: 1,
		queryFn: async ({ pageParam }) => {
			const r = await fetch(`${base}/public/products/${encodeURIComponent(productId)}/reviews?page=${pageParam}&limit=${PAGE_SIZE}&sort=new`, { credentials: 'include' });
			if (!r.ok) throw new Error('reviews');
			return (await r.json()).data as ReviewsPage;
		},
		getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
		enabled: !!productId,
	});
	const s = q.data?.pages[0]?.summary;
	if (!s?.count) return null;
	return (
		<a href="#ulasan" className="mt-1 inline-flex items-center gap-1.5 text-sm hover:underline">
			<StarRating value={s.average} size={14} />
			<span className="font-medium">{s.average.toFixed(1)}</span>
			<span className="text-muted-foreground">({s.count} ulasan)</span>
		</a>
	);
}

interface OrderLine {
	productId: string;
	name: string;
	variantLabel: string;
	review: ReviewItem | null;
}

/** Dari dashboard pembeli: daftar produk di pesanan selesai + tulis/edit/hapus ulasan per produk. */
export function OrderReviewDialog({ orderNo, storeBasePath, open, onOpenChange }: { orderNo: string; storeBasePath: string; open: boolean; onOpenChange: (v: boolean) => void }) {
	const apiBase = storeBasePath ? `/api/c/${storeBasePath.replace(/^\//, '')}/store` : '/api/store';
	const { toast } = useToast();
	const qc = useQueryClient();
	const [form, setForm] = useState<{ line: OrderLine } | null>(null);
	const key = ['order-reviews', apiBase, orderNo];
	const q = useQuery<{ lines: OrderLine[]; completed: boolean }>({
		queryKey: key,
		queryFn: async () => {
			const r = await fetch(`${apiBase}/orders/${encodeURIComponent(orderNo)}/reviews`, { credentials: 'include' });
			if (!r.ok) throw new Error('order-reviews');
			return (await r.json()).data;
		},
		enabled: open,
	});
	const lines = q.data?.lines || [];
	const refresh = () => {
		void qc.invalidateQueries({ queryKey: key });
		void qc.invalidateQueries({ queryKey: ['store-reviews'] });
	};
	const remove = async (id: string) => {
		if (!window.confirm('Hapus ulasan ini?')) return;
		try {
			const r = await fetch(`${apiBase}/reviews/${id}`, { method: 'DELETE', credentials: 'include' });
			if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || 'Gagal menghapus');
			toast({ title: 'Ulasan dihapus' });
			refresh();
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal menghapus ulasan'), variant: 'destructive' });
		}
	};
	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Ulasan pesanan</DialogTitle>
						<DialogDescription className="font-mono text-xs">{orderNo}</DialogDescription>
					</DialogHeader>
					{q.isLoading ? (
						<Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-muted-foreground" />
					) : lines.length === 0 ? (
						<p className="text-sm text-muted-foreground">Tidak ada produk yang bisa diulas di pesanan ini.</p>
					) : (
						<div className="divide-y">
							{lines.map((l) => (
								<div key={l.productId} className="py-3 space-y-2">
									<p className="text-sm font-medium">
										{l.name}
										{l.variantLabel ? <span className="text-muted-foreground font-normal"> · {l.variantLabel}</span> : null}
									</p>
									{l.review ? (
										<div className="rounded-md bg-muted/40 px-3">
											<ReviewCard r={l.review} onEdit={() => setForm({ line: l })} onDelete={() => remove(l.review!.id)} />
										</div>
									) : (
										<Button size="sm" onClick={() => setForm({ line: l })}>
											Tulis ulasan
										</Button>
									)}
								</div>
							))}
						</div>
					)}
				</DialogContent>
			</Dialog>
			{form && (
				<ReviewFormDialog
					key={form.line.review?.id || form.line.productId}
					open
					onOpenChange={(v) => !v && setForm(null)}
					apiBase={apiBase}
					orderNo={orderNo}
					productId={form.line.productId}
					productName={form.line.name}
					existing={form.line.review}
					onSaved={refresh}
				/>
			)}
		</>
	);
}
