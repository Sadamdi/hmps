import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Flag, Loader2, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StarRating } from '@/components/toko/store-reviews';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText, apiRequest } from '@/lib/queryClient';
import { useApiUrl } from '@/lib/tenant-context';

interface AdminReview {
	id: string;
	productName: string;
	variantLabel: string;
	orderNo: string;
	customerName: string;
	author: string;
	rating: number;
	comment: string;
	media: { url: string; type: 'image' | 'video' }[];
	status: 'visible' | 'hidden';
	hiddenReason: string;
	reportCount: number;
	createdAt: string;
	editedAt: string | null;
}

const FILTERS = [
	{ key: 'all', label: 'Semua' },
	{ key: 'reported', label: 'Dilaporkan' },
	{ key: 'hidden', label: 'Disembunyikan' },
];
const REASON_LABEL: Record<string, string> = { spam: 'Spam/iklan', kasar: 'Kasar', tidak_relevan: 'Tidak relevan', privasi: 'Data pribadi', lainnya: 'Lainnya' };

function Reports({ id, url }: { id: string; url: string }) {
	const { data = [], isLoading } = useQuery<{ reason: string; note: string; createdAt: string }[]>({
		queryKey: [url, id, 'reports'],
		queryFn: async () => {
			const r = await fetch(`${url}/${id}/reports`, { credentials: 'include' });
			if (!r.ok) throw new Error('reports');
			return (await r.json()).data;
		},
	});
	if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
	return (
		<ul className="space-y-1 text-xs">
			{data.map((r, i) => (
				<li key={i} className="rounded bg-muted/50 px-2 py-1">
					<span className="font-medium">{REASON_LABEL[r.reason] || r.reason}</span>
					{r.note ? <span className="text-muted-foreground"> — {r.note}</span> : null}
				</li>
			))}
		</ul>
	);
}

/**
 * Tab Ulasan: moderasi sederhana (tanpa editor rich). Sembunyikan/tampilkan, hapus, dan lihat alasan laporan.
 * Nama asli pemesan + nomor pesanan hanya terlihat oleh admin; publik hanya melihat nama samaran.
 */
export function StoreReviewsPanel() {
	const { toast } = useToast();
	const qc = useQueryClient();
	const url = useApiUrl('/store/admin/reviews');
	const [filter, setFilter] = useState('all');
	const [q, setQ] = useState('');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState<string | null>(null);

	const { data, isLoading, isError } = useQuery<{ data: AdminReview[]; meta: { page: number; limit: number; total: number } }>({
		queryKey: [url, filter, search, page],
		queryFn: async () => {
			const r = await fetch(`${url}?filter=${filter}&q=${encodeURIComponent(search)}&page=${page}`, { credentials: 'include' });
			if (!r.ok) throw new Error('reviews');
			return r.json();
		},
	});
	const refresh = () => void qc.invalidateQueries({ queryKey: [url] });
	const setStatus = useMutation({
		mutationFn: async (v: { id: string; status: 'visible' | 'hidden'; reason?: string }) => {
			await apiRequest('PATCH', `${url}/${v.id}`, { status: v.status, reason: v.reason });
		},
		onSuccess: (_d, v) => {
			toast({ title: v.status === 'hidden' ? 'Ulasan disembunyikan' : 'Ulasan ditampilkan' });
			refresh();
		},
		onError: (e) => toast({ title: apiErrorText(e, 'Gagal mengubah status'), variant: 'destructive' }),
	});
	const remove = useMutation({
		mutationFn: async (id: string) => {
			await apiRequest('DELETE', `${url}/${id}`);
		},
		onSuccess: () => {
			toast({ title: 'Ulasan dihapus' });
			refresh();
		},
		onError: (e) => toast({ title: apiErrorText(e, 'Gagal menghapus'), variant: 'destructive' }),
	});

	const rows = data?.data || [];
	const meta = data?.meta;
	const pages = Math.max(1, Math.ceil((meta?.total || 0) / (meta?.limit || 20)));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Ulasan produk</CardTitle>
				<CardDescription>Moderasi ulasan pembeli. Ulasan yang disembunyikan tidak tampil di publik dan tidak dihitung di rating.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap gap-2">
					{FILTERS.map((f) => (
						<Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => { setFilter(f.key); setPage(1); }}>
							{f.label}
						</Button>
					))}
				</div>
				<form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}>
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama produk / nomor pesanan" />
					<Button type="submit" variant="outline" className="gap-2 shrink-0">
						<Search className="h-4 w-4" /> Cari
					</Button>
				</form>
				{isLoading ? (
					<Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-muted-foreground" />
				) : isError ? (
					<p className="text-sm text-muted-foreground">Gagal memuat ulasan.</p>
				) : rows.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted-foreground">Belum ada ulasan{filter !== 'all' ? ' untuk filter ini' : ''}.</p>
				) : (
					<div className="divide-y">
						{rows.map((r) => (
							<div key={r.id} className="py-3 space-y-2">
								<div className="flex flex-wrap items-center gap-2">
									<StarRating value={r.rating} size={14} />
									<span className="text-sm font-medium">{r.productName}{r.variantLabel ? ` · ${r.variantLabel}` : ''}</span>
									{r.status === 'hidden' && <Badge variant="destructive">Disembunyikan</Badge>}
									{r.reportCount > 0 && (
										<Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
											<Flag className="h-3 w-3" /> {r.reportCount} laporan
										</Badge>
									)}
								</div>
								<p className="text-xs text-muted-foreground">
									Tampil sebagai <strong>{r.author}</strong> · pemesan {r.customerName || '-'} · <span className="font-mono">{r.orderNo}</span> · {new Date(r.createdAt).toLocaleDateString('id-ID')}
									{r.editedAt ? ' · diedit' : ''}
								</p>
								{r.comment && <p className="text-sm whitespace-pre-line break-words">{r.comment}</p>}
								{r.media.length > 0 && (
									<div className="flex flex-wrap gap-2">
										{r.media.map((m) =>
											m.type === 'image' ? (
												<a key={m.url} href={m.url} target="_blank" rel="noreferrer">
													<img src={m.url} alt="Foto ulasan" loading="lazy" className="h-16 w-16 rounded border object-cover" />
												</a>
											) : (
												<video key={m.url} src={m.url} controls preload="none" className="h-16 w-28 rounded border bg-black" />
											),
										)}
									</div>
								)}
								{r.status === 'hidden' && r.hiddenReason && <p className="text-xs text-muted-foreground">Alasan disembunyikan: {r.hiddenReason}</p>}
								<div className="flex flex-wrap gap-2">
									{r.status === 'visible' ? (
										<Button size="sm" variant="outline" className="gap-1" disabled={setStatus.isPending} onClick={() => {
											const reason = window.prompt('Alasan menyembunyikan (opsional, terlihat oleh admin):', '');
											if (reason === null) return;
											setStatus.mutate({ id: r.id, status: 'hidden', reason });
										}}>
											<EyeOff className="h-3.5 w-3.5" /> Sembunyikan
										</Button>
									) : (
										<Button size="sm" variant="outline" className="gap-1" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.id, status: 'visible' })}>
											<Eye className="h-3.5 w-3.5" /> Tampilkan
										</Button>
									)}
									<Button size="sm" variant="outline" className="gap-1 text-destructive" disabled={remove.isPending} onClick={() => window.confirm('Hapus ulasan ini permanen (termasuk foto/video)?') && remove.mutate(r.id)}>
										<Trash2 className="h-3.5 w-3.5" /> Hapus
									</Button>
									{r.reportCount > 0 && (
										<Button size="sm" variant="ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>
											{open === r.id ? 'Tutup laporan' : 'Lihat laporan'}
										</Button>
									)}
								</div>
								{open === r.id && <Reports id={r.id} url={url} />}
							</div>
						))}
					</div>
				)}
				{pages > 1 && (
					<div className="flex items-center justify-between text-sm">
						<Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
						<span className="text-muted-foreground">Halaman {page} / {pages}</span>
						<Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
