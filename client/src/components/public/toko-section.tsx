import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicSectionHeader } from '@/components/public/section-header';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useApiUrl, useTenant } from '@/lib/tenant-context';
import { flyStoreCartIcon } from '@/lib/store-cart-fly';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { normalizeStoreCurrency } from '@shared/store-currency';
import StoreProductCard from './store-product-card';

type PublicProductsPage = { items: any[]; total: number; page: number; limit: number };

const INITIAL_DESKTOP = 6;
const INITIAL_MOBILE = 4;
const MAX_DESKTOP = 12;
const MAX_MOBILE = 6;

export default function TokoSection() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { basePath } = useTenant();
	const bp = basePath || '';
	const prefix = (path: string) => (bp ? `${bp}${path}` : path);

	const settingsUrl = useApiUrl('/store/public/settings');
	const productsUrl = useApiUrl('/store/public/products');
	const cartItemsUrl = useApiUrl('/store/cart/items');
	const cartUrl = useApiUrl('/store/cart');

	const [showAll, setShowAll] = useState(false);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const sync = () => setIsMobile(window.innerWidth < 768);
		sync();
		window.addEventListener('resize', sync);
		return () => window.removeEventListener('resize', sync);
	}, []);

	const { data: storeSettings } = useQuery<{
		navbarLabel?: string;
		navbarPath?: string;
		defaultCurrency?: string;
	}>({
		queryKey: [settingsUrl],
		queryFn: async () => {
			const r = await fetch(settingsUrl, { credentials: 'include' });
			if (!r.ok) return {};
			return r.json();
		},
		staleTime: 60 * 1000,
	});

	const storeLabel = (storeSettings?.navbarLabel || 'Toko').trim() || 'Toko';

	const storeBasePath = useMemo(() => {
		const raw = String(storeSettings?.navbarPath || '/toko').trim();
		if (!raw) return '/toko';
		const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
		const compact = withSlash.replace(/\/{2,}/g, '/');
		if (compact === '/') return '/toko';
		return compact.endsWith('/') ? compact.slice(0, -1) : compact;
	}, [storeSettings?.navbarPath]);

	const catalogHref = prefix(storeBasePath);

	const defaultCur = normalizeStoreCurrency(storeSettings?.defaultCurrency);

	const latestUrl = `${productsUrl}?limit=12&sort=latest&page=1`;
	const { data: productsPayload, isLoading } = useQuery<PublicProductsPage>({
		queryKey: [latestUrl],
		queryFn: async () => {
			const r = await fetch(latestUrl, { credentials: 'include' });
			if (!r.ok) throw new Error('products');
			return r.json();
		},
		staleTime: 60 * 1000,
	});

	const allProducts = productsPayload?.items ?? [];
	const initialCount = isMobile ? INITIAL_MOBILE : INITIAL_DESKTOP;
	const maxCount = isMobile ? MAX_MOBILE : MAX_DESKTOP;
	const displayedProducts = showAll
		? allProducts.slice(0, maxCount)
		: allProducts.slice(0, initialCount);

	const quickAddMutation = useMutation({
		mutationFn: async (vars: { productId: string; fromEl?: HTMLElement | null }) => {
			const r = await apiRequest('POST', cartItemsUrl, { productId: vars.productId, qty: 1 });
			if (!r.ok) throw new Error('cart');
		},
		onSuccess: (_data, vars) => {
			queryClient.invalidateQueries({ queryKey: [cartUrl] });
			toast({ title: 'Ditambahkan ke keranjang' });
			if (vars.fromEl) flyStoreCartIcon(vars.fromEl);
		},
		onError: () =>
			toast({
				title: 'Gagal menambah ke keranjang',
				description: 'Cek stok atau coba lagi.',
				variant: 'destructive',
			}),
	});

	if (isLoading) {
		return (
			<section id="toko" className="py-16 bg-background scroll-mt-20">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-12">
						<Skeleton className="h-6 w-28 mx-auto mb-3 rounded-full" />
						<Skeleton className="h-8 w-48 mx-auto mb-4" />
						<Skeleton className="h-px w-28 mx-auto mb-4" />
						<Skeleton className="h-6 w-96 max-w-full mx-auto" />
					</div>
					<div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
						{[...Array(4)].map((_, i) => (
							<Card key={i} className="overflow-hidden">
								<Skeleton className="aspect-[4/3] w-full" />
								<CardContent className="p-4 space-y-2">
									<Skeleton className="h-5 w-3/4" />
									<Skeleton className="h-4 w-1/2" />
									<Skeleton className="h-4 w-full" />
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</section>
		);
	}

	return (
		<section id="toko" className="py-16 bg-background scroll-mt-20">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<PublicSectionHeader
					eyebrow="Toko"
					icon={<ShoppingBag />}
					title={storeLabel}
					description="Lihat katalog terbaru dan lanjutkan pembelian via WhatsApp."
				/>

				{allProducts.length === 0 ? (
					<div className="text-center py-12">
						<div className="text-muted-foreground text-lg">
							Belum ada produk tersedia
						</div>
					</div>
				) : (
					<>
						<div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
							{displayedProducts.map((p: any, index: number) => (
								<StoreProductCard
									key={p._id}
									product={p}
									detailHref={prefix(`${storeBasePath}/${p.slug}`)}
									defaultCurrency={defaultCur}
									quickAddDisabled={quickAddMutation.isPending}
									onQuickAdd={(productId, fromEl) =>
										quickAddMutation.mutate({ productId, fromEl })
									}
									aosDelay={index * 100}
								/>
							))}
						</div>

						{allProducts.length > initialCount && (
							<div
								className="text-center mt-12"
								data-aos="fade-up"
								data-aos-delay="200">
								<Button
									onClick={() => setShowAll(!showAll)}
									variant="outline"
									className="px-8 py-2">
									{showAll ? 'Tampilkan Lebih Sedikit' : 'Lihat Lebih Banyak Katalog'}
								</Button>
							</div>
						)}

						<div
							className="text-center mt-8"
							data-aos="fade-up"
							data-aos-delay="300">
							<Link href={catalogHref}>
								<Button variant="default" className="px-8 py-2">
									Lihat Semua Katalog
									<ArrowRight className="h-4 w-4 ml-2" />
								</Button>
							</Link>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
