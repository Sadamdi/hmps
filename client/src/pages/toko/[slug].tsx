import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { StorePublicHeaderRow } from '@/components/public/store-public-header';
import { AboutVideoEmbed } from '@/components/public/about-video-embed';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useApiUrl } from '@/lib/tenant-context';
import { apiRequest } from '@/lib/queryClient';
import { flyStoreCartIcon } from '@/lib/store-cart-fly';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ChevronLeft,
	ChevronRight,
	Loader2,
	MapPin,
	Minus,
	Plus,
	ShoppingCart,
	UserRound,
} from 'lucide-react';
import { useParams } from 'wouter';
import { useTenant } from '@/lib/tenant-context';
import { useEffect, useMemo, useState } from 'react';
import {
	effectiveProductCurrency,
	formatStoreMoney,
	normalizeStoreCurrency,
} from '@shared/store-currency';
import {
	computeUnitPriceForQty,
	getStoreStockAvailable,
	lineSubtotalForProduct,
} from '@shared/store-pricing';

export default function TokoProductDetailPage() {
	const extractDriveFileId = (url: string): string | null => {
		const trimmed = String(url || '').trim();
		const byPath = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
		if (byPath?.[1]) return byPath[1];
		const byQuery = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
		return byQuery?.[1] || null;
	};
	const imageCandidates = (url: string, proxyBase: string): string[] => {
		const trimmed = String(url || '').trim();
		if (!trimmed) return [];
		const driveId = extractDriveFileId(trimmed);
		if (!driveId) return [trimmed];
		const cleanProxyBase = String(proxyBase || '').replace(/\/+$/, '');
		const proxyUrl = cleanProxyBase
			? `${cleanProxyBase}/${encodeURIComponent(driveId)}`
			: '';
		return [
			...(proxyUrl ? [proxyUrl] : []),
			`https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`,
			`https://lh3.googleusercontent.com/d/${driveId}=s2000`,
			`https://drive.google.com/uc?export=view&id=${driveId}`,
			trimmed,
		];
	};
	const StoreImage = ({
		src,
		alt,
		className,
	}: {
		src: string;
		alt: string;
		className?: string;
	}) => {
		const candidates = useMemo(
			() => imageCandidates(src, gdriveImageProxyBase),
			[src, gdriveImageProxyBase],
		);
		const [candidateIndex, setCandidateIndex] = useState(0);
		useEffect(() => {
			setCandidateIndex(0);
		}, [src]);
		const activeSrc = candidates[candidateIndex] || src;
		return (
			<img
				src={activeSrc}
				alt={alt}
				className={className}
				loading="lazy"
				onError={() => {
					setCandidateIndex((i) => (i < candidates.length - 1 ? i + 1 : i));
				}}
			/>
		);
	};

	const params = useParams();
	const slug = (params as any)?.slug || '';
	const { basePath } = useTenant();
	const bp = basePath || '';
	const prefix = (path: string) => (bp ? `${bp}${path}` : path);

	const { toast } = useToast();
	const queryClient = useQueryClient();
	const productUrl = useApiUrl(`/store/public/products/${encodeURIComponent(slug)}`);
	const cartItemsUrl = useApiUrl('/store/cart/items');
	const cartUrl = useApiUrl('/store/cart');
	const directCheckoutUrl = useApiUrl('/store/direct-checkout');
	const myOrdersUrl = useApiUrl('/store/my-orders');
	const gdriveImageProxyBase = useApiUrl('/store/public/gdrive-image');
	const settingsUrl = useApiUrl('/store/public/settings');
	const { data: storeSettings } = useQuery<{
		navbarPath?: string;
		navbarLabel?: string;
		defaultCurrency?: string;
		whatsappContactName?: string;
		storeAddress?: string;
	}>({
		queryKey: [settingsUrl],
		queryFn: async () => {
			const r = await fetch(settingsUrl, { credentials: 'include' });
			if (!r.ok) return { navbarPath: '/toko' };
			return r.json();
		},
	});
	const storeBasePath = (() => {
		const raw = String(storeSettings?.navbarPath || '/toko').trim();
		if (!raw) return '/toko';
		const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
		const compact = withSlash.replace(/\/{2,}/g, '/');
		if (compact === '/') return '/toko';
		return compact.endsWith('/') ? compact.slice(0, -1) : compact;
	})();

	const defaultCur = normalizeStoreCurrency(storeSettings?.defaultCurrency);
	const storeLabel = storeSettings?.navbarLabel || 'Toko';

	const { data: product, isLoading, isError } = useQuery({
		queryKey: [productUrl],
		queryFn: async () => {
			const r = await fetch(productUrl, { credentials: 'include' });
			if (!r.ok) throw new Error('notfound');
			return r.json();
		},
		enabled: !!slug,
	});

	useEffect(() => {
		if (!product?.name) return;
		document.title = `${product.name} | Toko`;
	}, [product]);

	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	const [qty, setQty] = useState(1);
	const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);

	useEffect(() => {
		if (!product?._id) return;
		setQty(1);
	}, [product?._id]);
	useEffect(() => {
		setActiveGalleryIndex(0);
	}, [product?._id]);

	const galleryImages = useMemo(() => {
		if (!product) return [] as string[];
		const all = [
			String(product.thumbnail || ''),
			...(Array.isArray(product.gallery) ? product.gallery.map((g: any) => String(g?.url || '')) : []),
		]
			.map((u) => u.trim())
			.filter(Boolean);
		return Array.from(new Set(all));
	}, [product]);
	const maxGalleryIndex = Math.max(0, galleryImages.length - 1);
	const safeGalleryIndex = Math.min(activeGalleryIndex, maxGalleryIndex);
	const activeImageSrc = galleryImages[safeGalleryIndex] || '';

	const effectiveContactName =
		String(product?.whatsappContactNameOverride || '').trim() ||
		String(storeSettings?.whatsappContactName || '').trim();
	const effectiveStoreAddress =
		String(product?.storeAddressOverride || '').trim() ||
		String(storeSettings?.storeAddress || '').trim();

	useEffect(() => {
		if (!product?._id) return;
		const avail = getStoreStockAvailable(product.stock);
		if (avail === null) return;
		if (avail < 1) {
			setQty(1);
			return;
		}
		setQty((q) => Math.min(Math.max(1, q), avail));
	}, [product?._id, product?.stock]);

	const addToCartMutation = useMutation({
		mutationFn: async ({ fromEl }: { fromEl?: HTMLElement | null }) => {
			if (!product?._id) throw new Error('no product');
			const r = await apiRequest('POST', cartItemsUrl, { productId: product._id, qty });
			if (!r.ok) throw new Error('cart');
			return { fromEl };
		},
		onSuccess: (_data, vars) => {
			queryClient.invalidateQueries({ queryKey: [cartUrl] });
			toast({ title: 'Ditambahkan ke keranjang' });
			flyStoreCartIcon(vars.fromEl ?? null);
		},
		onError: () =>
			toast({
				title: 'Gagal menambah ke keranjang',
				variant: 'destructive',
			}),
	});

	// Ambil checkoutDraft dari /cart untuk prefill form beli langsung
	const { data: cartData } = useQuery<{
		checkoutDraft?: {
			customerName?: string;
			customerPhone?: string;
			fulfillment?: 'pickup' | 'delivery' | '';
			shippingAddress?: string;
		};
	}>({
		queryKey: [cartUrl],
		queryFn: async () => {
			const r = await fetch(cartUrl, { credentials: 'include' });
			if (!r.ok) return {};
			return r.json();
		},
		staleTime: 30 * 1000,
	});

	const [buyDialogOpen, setBuyDialogOpen] = useState(false);
	const [buyerName, setBuyerName] = useState('');
	const [buyerPhone, setBuyerPhone] = useState('');
	const [buyerFulfillment, setBuyerFulfillment] =
		useState<'pickup' | 'delivery'>('pickup');
	const [buyerAddress, setBuyerAddress] = useState('');
	const [formErrors, setFormErrors] = useState<{
		name?: string;
		phone?: string;
		address?: string;
	}>({});

	useEffect(() => {
		const draft = cartData?.checkoutDraft;
		if (!draft) return;
		setBuyerName((prev) => prev || String(draft.customerName || ''));
		setBuyerPhone((prev) => prev || String(draft.customerPhone || ''));
		setBuyerFulfillment((prev) =>
			draft.fulfillment === 'delivery' || draft.fulfillment === 'pickup'
				? (draft.fulfillment as 'pickup' | 'delivery')
				: prev,
		);
		setBuyerAddress((prev) => prev || String(draft.shippingAddress || ''));
	}, [cartData?.checkoutDraft]);

	const directCheckoutMutation = useMutation({
		mutationFn: async () => {
			if (!product?._id) throw new Error('no product');
			const payload = {
				productId: product._id,
				qty,
				customerName: buyerName.trim(),
				customerPhone: buyerPhone.trim(),
				fulfillment: buyerFulfillment,
				shippingAddress:
					buyerFulfillment === 'delivery' ? buyerAddress.trim() : '',
			};
			const res = await apiRequest('POST', directCheckoutUrl, payload);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Checkout langsung gagal');
			}
			return res.json() as Promise<{ whatsappUrl: string; invoiceUrl: string }>;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: [cartUrl] });
			queryClient.invalidateQueries({ queryKey: [myOrdersUrl] });
			toast({
				title: 'Pesanan dibuat',
				description: 'WhatsApp dibuka. Order juga tersimpan di riwayat.',
			});
			setBuyDialogOpen(false);
			if (data.whatsappUrl) {
				window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
			}
		},
		onError: (e: Error) =>
			toast({
				title: 'Gagal membuat pesanan',
				description: e.message,
				variant: 'destructive',
			}),
	});

	const openBuyDialog = () => {
		if (!product?._id) return;
		setFormErrors({});
		setBuyDialogOpen(true);
	};

	const submitBuyForm = () => {
		const errs: typeof formErrors = {};
		if (!buyerName.trim()) errs.name = 'Nama wajib diisi';
		if (!buyerPhone.trim()) errs.phone = 'Nomor WhatsApp wajib diisi';
		if (buyerFulfillment === 'delivery' && !buyerAddress.trim()) {
			errs.address = 'Alamat pengiriman wajib diisi';
		}
		if (Object.keys(errs).length > 0) {
			setFormErrors(errs);
			return;
		}
		setFormErrors({});
		directCheckoutMutation.mutate();
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex flex-col bg-background">
				<Navbar activeSection="" scrollToSection={scrollToSection} />
				<main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-8 pb-16">
					<StorePublicHeaderRow
						items={[
							{ label: 'Beranda', href: '/' },
							{ label: storeLabel, href: prefix(storeBasePath) },
							{ label: 'Memuat…' },
						]}
					/>
					<div className="flex justify-center py-20">
						<Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
					</div>
				</main>
				<Footer />
			</div>
		);
	}

	if (isError || !product) {
		return (
			<div className="min-h-screen flex flex-col bg-background">
				<Navbar activeSection="" scrollToSection={scrollToSection} />
				<div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 max-w-5xl mx-auto w-full text-center">
					<StorePublicHeaderRow
						items={[
							{ label: 'Beranda', href: '/' },
							{ label: storeLabel, href: prefix(storeBasePath) },
							{ label: 'Tidak ditemukan' },
						]}
					/>
					<p className="text-muted-foreground">Produk tidak ditemukan.</p>
				</div>
				<Footer />
			</div>
		);
	}

	const stockAvail = getStoreStockAvailable(product.stock);
	const productOutOfStock = stockAvail !== null && stockAvail < 1;
	const maxBuyQty = stockAvail ?? 9999;

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1">
				<div className="max-w-5xl mx-auto px-4 pt-8 pb-16">
					<StorePublicHeaderRow
						items={[
							{ label: 'Beranda', href: '/' },
							{ label: storeLabel, href: prefix(storeBasePath) },
							{
								label:
									product.name.length > 40
										? `${product.name.slice(0, 40)}…`
										: product.name,
							},
						]}
					/>

					<div className="grid md:grid-cols-2 gap-8 mt-6">
						<div className="space-y-4">
							<div className="rounded-xl overflow-hidden border bg-muted aspect-square">
								{activeImageSrc ? (
									<div className="relative w-full h-full">
										<StoreImage
											src={activeImageSrc}
											alt={`${product.name} - foto ${safeGalleryIndex + 1}`}
											className="w-full h-full object-cover"
										/>
										{galleryImages.length > 1 && (
											<>
												<Button
													type="button"
													size="icon"
													variant="secondary"
													className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8"
													onClick={() =>
														setActiveGalleryIndex((i) =>
															i <= 0 ? maxGalleryIndex : i - 1,
														)
													}
												>
													<ChevronLeft className="h-4 w-4" />
												</Button>
												<Button
													type="button"
													size="icon"
													variant="secondary"
													className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
													onClick={() =>
														setActiveGalleryIndex((i) =>
															i >= maxGalleryIndex ? 0 : i + 1,
														)
													}
												>
													<ChevronRight className="h-4 w-4" />
												</Button>
											</>
										)}
									</div>
								) : (
									<div className="w-full h-full" />
								)}
							</div>
							{galleryImages.length > 1 && (
								<div className="overflow-x-auto">
									<div className="flex gap-2 min-w-max pr-1">
										{galleryImages.map((img, i) => (
											<button
												key={`${img}-${i}`}
												type="button"
												onClick={() => setActiveGalleryIndex(i)}
												className={`aspect-square w-20 rounded-lg overflow-hidden border transition ${
													safeGalleryIndex === i
														? 'border-primary ring-2 ring-primary/30'
														: 'border-border hover:border-primary/60'
												}`}
											>
											<StoreImage
												src={img}
												alt={`${product.name} - thumbnail ${i + 1}`}
												className="w-full h-full object-cover"
											/>
											</button>
									))}
									</div>
								</div>
							)}
							{product.videoUrl && (
								<Card>
									<CardContent className="p-4">
										<h3 className="font-semibold mb-3">Video demo</h3>
										{product.videoType === 'public' ? (
											<video
												src={product.videoUrl}
												controls
												className="w-full rounded-lg border bg-black/80"
											/>
										) : (
											<AboutVideoEmbed
												aboutVideoUrl={product.videoType === 'youtube' ? product.videoUrl : undefined}
												aboutVideoGdriveUrl={product.videoType === 'gdrive' ? product.videoUrl : undefined}
												className="mb-0"
											/>
										)}
									</CardContent>
								</Card>
							)}
						</div>
						<div>
							<h1 className="text-3xl font-bold">{product.name}</h1>
							{(() => {
								const cur = effectiveProductCurrency(product, defaultCur);
								const lineTotal = lineSubtotalForProduct(product, qty);
								const unitEff = computeUnitPriceForQty(product, qty);
								return (
									<>
										<p className="text-2xl font-bold text-primary mt-4">
											{formatStoreMoney(lineTotal, cur)}
											{qty > 1 && (
												<span className="text-base font-normal text-muted-foreground ml-2">
													({formatStoreMoney(unitEff, cur)} / satuan)
												</span>
											)}
										</p>
										<p className="text-sm text-muted-foreground mt-1">
											Harga dasar: {formatStoreMoney(product.price, cur)}
										</p>
										{Array.isArray(product.priceTiers) && product.priceTiers.length > 0 && (
											<ul className="text-sm text-muted-foreground mt-2 space-y-0.5 list-disc list-inside">
												{[...product.priceTiers]
													.slice()
													.sort((a: any, b: any) => (a.minQty ?? 0) - (b.minQty ?? 0))
													.map((t: any) => {
														const mult =
															typeof t.applyMultiples === 'boolean'
																? t.applyMultiples
																: !!product.priceTierMultiples;
														return (
															<li key={`${t.minQty}-${t.unitPrice}`}>
																Minimal {t.minQty} pcs: {formatStoreMoney(t.unitPrice, cur)} / satuan
																<span className="text-muted-foreground/90">
																	{' '}
																	({mult ? 'kelipatan' : 'blok pertama'})
																</span>
															</li>
														);
													})}
											</ul>
										)}
										{stockAvail !== null && (
											<p className="text-sm text-muted-foreground mt-2">
												Stok: {stockAvail}
												{productOutOfStock ? ' (habis)' : ''}
											</p>
										)}
										<div className="flex flex-wrap items-center gap-3 mt-6">
											<span className="text-sm font-medium">Jumlah</span>
											<div className="flex items-center gap-2">
												<Button
													type="button"
													variant="outline"
													size="icon"
													disabled={productOutOfStock || qty <= 1}
													onClick={() => setQty((q) => Math.max(1, q - 1))}>
													<Minus className="h-4 w-4" />
												</Button>
												<span className="w-8 text-center tabular-nums">{qty}</span>
												<Button
													type="button"
													variant="outline"
													size="icon"
													disabled={productOutOfStock || qty >= maxBuyQty}
													onClick={() => setQty((q) => Math.min(maxBuyQty, q + 1))}>
													<Plus className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</>
								);
							})()}
							{product.shortDescription && (
								<p className="text-muted-foreground mt-4">{product.shortDescription}</p>
							)}
							<div className="flex flex-wrap gap-3 mt-8">
								<Button
									size="lg"
									onClick={openBuyDialog}
									disabled={productOutOfStock}>
									Beli via WhatsApp
								</Button>
								<Button
									size="lg"
									variant="secondary"
									disabled={productOutOfStock || addToCartMutation.isPending}
									onClick={(e) =>
										addToCartMutation.mutate({ fromEl: e.currentTarget })
									}>
									<ShoppingCart className="h-4 w-4 mr-2" />
									Masukkan keranjang
								</Button>
							</div>
							{(effectiveContactName || effectiveStoreAddress) && (
								<Card className="mt-6">
									<CardContent className="p-4 space-y-3">
										<p className="text-sm font-semibold">Kontak toko</p>
										{effectiveContactName && (
											<div className="flex items-start gap-2 text-sm text-muted-foreground">
												<UserRound className="h-4 w-4 mt-0.5 shrink-0" />
												<span>{effectiveContactName}</span>
											</div>
										)}
										{effectiveStoreAddress && (
											<div className="flex items-start gap-2 text-sm text-muted-foreground">
												<MapPin className="h-4 w-4 mt-0.5 shrink-0" />
												<span>{effectiveStoreAddress}</span>
											</div>
										)}
									</CardContent>
								</Card>
							)}
							{product.descriptionHtml && (
								<div
									className="prose prose-sm dark:prose-invert max-w-none mt-8 border-t pt-8"
									dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
								/>
							)}
						</div>
					</div>
				</div>
			</main>
			<Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Beli via WhatsApp</DialogTitle>
						<DialogDescription>
							Isi data pemesan. Pesanan akan masuk ke riwayat dan invoice, lalu
							WhatsApp admin terbuka. Data ini disimpan untuk pembelian
							berikutnya.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-1.5">
							<Label htmlFor="buyer-name">Nama</Label>
							<Input
								id="buyer-name"
								value={buyerName}
								onChange={(e) => setBuyerName(e.target.value)}
								placeholder="Nama lengkap"
							/>
							{formErrors.name && (
								<p className="text-xs text-destructive">{formErrors.name}</p>
							)}
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="buyer-phone">Nomor WhatsApp</Label>
							<Input
								id="buyer-phone"
								value={buyerPhone}
								onChange={(e) => setBuyerPhone(e.target.value)}
								placeholder="08xxxxxxxxxx"
								inputMode="tel"
							/>
							{formErrors.phone && (
								<p className="text-xs text-destructive">{formErrors.phone}</p>
							)}
						</div>
						<div className="space-y-1.5">
							<Label>Pengiriman</Label>
							<RadioGroup
								value={buyerFulfillment}
								onValueChange={(v) =>
									setBuyerFulfillment(v as 'pickup' | 'delivery')
								}
								className="flex gap-4">
								<div className="flex items-center gap-2">
									<RadioGroupItem value="pickup" id="buy-pickup" />
									<Label htmlFor="buy-pickup">Ambil di tempat</Label>
								</div>
								<div className="flex items-center gap-2">
									<RadioGroupItem value="delivery" id="buy-delivery" />
									<Label htmlFor="buy-delivery">Diantar</Label>
								</div>
							</RadioGroup>
						</div>
						{buyerFulfillment === 'delivery' && (
							<div className="space-y-1.5">
								<Label htmlFor="buyer-address">Alamat pengiriman</Label>
								<Textarea
									id="buyer-address"
									value={buyerAddress}
									onChange={(e) => setBuyerAddress(e.target.value)}
									rows={3}
									placeholder="Alamat lengkap untuk pengiriman"
								/>
								{formErrors.address && (
									<p className="text-xs text-destructive">
										{formErrors.address}
									</p>
								)}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => setBuyDialogOpen(false)}
							disabled={directCheckoutMutation.isPending}>
							Batal
						</Button>
						<Button
							onClick={submitBuyForm}
							disabled={directCheckoutMutation.isPending}>
							{directCheckoutMutation.isPending ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Memproses...
								</>
							) : (
								'Lanjut ke WhatsApp'
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Footer />
			<AIChat pageContext={{ path: storeBasePath, permissions: [] }} />
		</div>
	);
}
