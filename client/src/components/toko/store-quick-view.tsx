import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Minus, Plus, ShoppingCart, Zap } from 'lucide-react';
import { useLocation } from 'wouter';
import MediaDisplay from '@/components/MediaDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProductRatingBadge } from '@/components/toko/store-reviews';
import { useStorePaths } from '@/hooks/use-buyer';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText, apiRequest } from '@/lib/queryClient';
import { flyStoreCartIcon } from '@/lib/store-cart-fly';
import { useApiUrl } from '@/lib/tenant-context';
import { effectiveProductCurrency, formatStoreMoney, normalizeStoreCurrency } from '@shared/store-currency';
import { getStoreStockAvailable } from '@shared/store-pricing';
import { activeVariants, productAsVariant, type StoreVariant } from '@shared/store-variants';

/** Produk perlu dipilih varian dulu sebelum masuk keranjang / dibeli. */
export function productNeedsChoice(p: any): boolean {
	return activeVariants(p).length > 0;
}

interface QuickViewProps {
	/** Produk dari daftar (slug dipakai untuk memuat detail lengkap) */
	product: { slug: string; name: string; _id: string } | null;
	onClose: () => void;
	defaultCurrency?: string;
}

/**
 * Popup "Lihat cepat": foto + thumbnail, harga, stok, deskripsi singkat, pilihan varian, jumlah,
 * tombol Keranjang dan Beli sekarang. Satu komponen dipakai di beranda, katalog, dan favorit.
 * Konten scroll di dalam dialog; tombol aksi selalu terlihat di bawah (aman di HP 375px).
 */
export function StoreQuickViewDialog({ product, onClose, defaultCurrency = 'IDR' }: QuickViewProps) {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [, navigate] = useLocation();
	const { storeHref } = useStorePaths();
	const slug = product?.slug || '';
	const detailUrl = useApiUrl(`/store/public/products/${encodeURIComponent(slug)}`);
	const cartItemsUrl = useApiUrl('/store/cart/items');
	const cartUrl = useApiUrl('/store/cart');

	const { data, isLoading, isError } = useQuery<any>({
		queryKey: [detailUrl, 'quick'],
		queryFn: async () => {
			const r = await fetch(detailUrl, { credentials: 'include' });
			if (!r.ok) throw new Error('notfound');
			return r.json();
		},
		enabled: !!slug,
	});

	const variants: StoreVariant[] = useMemo(() => (data ? activeVariants(data) : []), [data]);
	const [variantId, setVariantId] = useState('');
	const [qty, setQty] = useState(1);
	const [imgIdx, setImgIdx] = useState(0);
	useEffect(() => {
		setVariantId('');
		setQty(1);
		setImgIdx(0);
	}, [slug]);

	const selVariant = variants.find((v) => v.id === variantId) || null;
	const needVariant = variants.length > 0 && !selVariant;
	const view: any = useMemo(() => (data ? productAsVariant(data, selVariant) : null), [data, selVariant]);
	const gallery = useMemo(() => {
		if (!data) return [] as string[];
		const all = [String(data.thumbnail || ''), ...(Array.isArray(data.gallery) ? data.gallery.filter((g: any) => g?.type !== 'video').map((g: any) => String(g?.url || '')) : []), ...variants.map((v) => v.thumbnail)]
			.map((u) => u.trim())
			.filter(Boolean);
		return Array.from(new Set(all));
	}, [data, variants]);
	const activeImg = gallery[Math.min(imgIdx, Math.max(0, gallery.length - 1))] || '';

	const pickVariant = (v: StoreVariant) => {
		setVariantId(v.id);
		const i = v.thumbnail ? gallery.indexOf(v.thumbnail.trim()) : -1;
		if (i >= 0) setImgIdx(i);
	};

	const stock = view ? getStoreStockAvailable(view.stock) : null;
	const soldOut = stock !== null && stock < 1;
	const maxQty = stock === null ? 99 : Math.max(1, stock);
	useEffect(() => setQty((q) => Math.min(Math.max(1, q), maxQty)), [maxQty]);

	const cur = data ? normalizeStoreCurrency(effectiveProductCurrency(view || data, defaultCurrency)) : defaultCurrency;
	const price = Number(view?.price ?? data?.price) || 0;
	const title = selVariant?.title || data?.name || product?.name || '';
	const desc = selVariant?.description || data?.shortDescription || '';

	const addMutation = useMutation({
		mutationFn: async (fromEl: HTMLElement | null) => {
			const r = await apiRequest('POST', cartItemsUrl, { productId: data._id, variantId: selVariant?.id || '', qty });
			if (!r.ok) throw new Error('cart');
			return fromEl;
		},
		onSuccess: (fromEl) => {
			void qc.invalidateQueries({ queryKey: [cartUrl] });
			toast({ title: 'Ditambahkan ke keranjang' });
			flyStoreCartIcon(fromEl);
			onClose();
		},
		onError: (e: Error) => toast({ title: 'Gagal menambah ke keranjang', description: apiErrorText(e, 'Cek stok atau coba lagi.'), variant: 'destructive' }),
	});

	const buyNow = () => {
		if (!data) return;
		const q = new URLSearchParams({ beli: '1', qty: String(qty) });
		if (selVariant) q.set('v', selVariant.id);
		onClose();
		navigate(`${storeHref}/${data.slug}?${q.toString()}`);
	};

	return (
		<Dialog open={!!product} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col">
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>Lihat cepat produk</DialogDescription>
				</DialogHeader>
				{isLoading ? (
					<div className="flex h-64 items-center justify-center">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : isError || !data ? (
					<div className="p-8 text-center text-sm text-muted-foreground">Produk tidak tersedia atau gagal dimuat.</div>
				) : (
					<>
						<div className="flex-1 overflow-y-auto overscroll-contain">
							<div className="grid gap-4 p-4 sm:grid-cols-2 sm:gap-6 sm:p-6">
								<div className="min-w-0 space-y-2">
									<div className="mx-auto aspect-square w-full max-h-[38dvh] overflow-hidden rounded-lg bg-muted sm:max-h-none">
										{activeImg ? <MediaDisplay src={activeImg} alt={title} className="h-full w-full object-cover" /> : null}
									</div>
									{gallery.length > 1 && (
										<div className="flex gap-2 overflow-x-auto pb-1">
											{gallery.map((g, i) => (
												<button
													key={g}
													type="button"
													onClick={() => setImgIdx(i)}
													aria-label={`Foto ${i + 1}`}
													className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${i === imgIdx ? 'border-primary' : 'border-transparent'}`}>
													<MediaDisplay src={g} alt="" className="h-full w-full object-cover" />
												</button>
											))}
										</div>
									)}
								</div>
								<div className="min-w-0 space-y-3">
									<div>
										<h2 className="text-lg font-bold leading-tight break-words sm:text-xl">{title}</h2>
										<ProductRatingBadge productId={String(data._id)} />
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<p className="text-2xl font-bold text-primary tabular-nums">{formatStoreMoney(price, cur)}</p>
										{data.isPreOrder && <Badge variant="secondary">Pre-order</Badge>}
										{soldOut ? <Badge variant="destructive">Stok habis</Badge> : stock !== null && stock <= 10 ? <Badge variant="outline">Sisa {stock}</Badge> : null}
									</div>
									{desc && <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{desc}</p>}
									{variants.length > 0 && (
										<div className="space-y-2">
											<p className="text-sm font-medium">
												{data.variantGroupName || 'Varian'}
												{selVariant ? <span className="font-normal text-muted-foreground">: {selVariant.label}</span> : <span className="font-normal text-destructive"> — pilih dulu</span>}
											</p>
											<div className="flex flex-wrap gap-2" role="radiogroup" aria-label={data.variantGroupName || 'Varian'}>
												{variants.map((v) => {
													const out = getStoreStockAvailable(v.stock) !== null && (getStoreStockAvailable(v.stock) as number) < 1;
													return (
														<button
															key={v.id}
															type="button"
															role="radio"
															aria-checked={v.id === variantId}
															disabled={out}
															onClick={() => pickVariant(v)}
															className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${v.id === variantId ? 'border-primary bg-primary/10 font-medium' : 'hover:border-primary/50'} ${out ? 'cursor-not-allowed opacity-40 line-through' : ''}`}>
															{v.thumbnail ? <MediaDisplay src={v.thumbnail} alt="" className="h-6 w-6 rounded object-cover" /> : null}
															{v.label}
														</button>
													);
												})}
											</div>
										</div>
									)}
									<div className="flex items-center gap-3">
										<span className="text-sm font-medium">Jumlah</span>
										<div className="flex items-center rounded-md border">
											<Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Kurangi" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
												<Minus className="h-4 w-4" />
											</Button>
											<span className="w-10 text-center text-sm tabular-nums">{qty}</span>
											<Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Tambah" disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>
												<Plus className="h-4 w-4" />
											</Button>
										</div>
									</div>
									<a href={`${storeHref}/${data.slug}`} className="inline-block text-sm text-primary underline">
										Lihat detail lengkap
									</a>
								</div>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2 border-t bg-background p-3 sm:p-4">
							<Button type="button" variant="outline" className="gap-2" disabled={soldOut || needVariant || addMutation.isPending} onClick={(e) => addMutation.mutate(e.currentTarget)}>
								{addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
								{needVariant ? 'Pilih varian' : 'Keranjang'}
							</Button>
							<Button type="button" className="gap-2" disabled={soldOut || needVariant} onClick={buyNow}>
								<Zap className="h-4 w-4" /> Beli sekarang
							</Button>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** Hook: buka popup dari kartu mana pun. `node` dirender sekali di halaman. */
export function useStoreQuickView(defaultCurrency?: string): { open: (p: { slug: string; name: string; _id: string }) => void; node: ReactNode } {
	const [product, setProduct] = useState<{ slug: string; name: string; _id: string } | null>(null);
	return {
		open: (p) => setProduct({ slug: p.slug, name: p.name, _id: String(p._id) }),
		node: <StoreQuickViewDialog product={product} onClose={() => setProduct(null)} defaultCurrency={defaultCurrency} />,
	};
}
