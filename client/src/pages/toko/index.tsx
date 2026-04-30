import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import MediaDisplay from '@/components/MediaDisplay';
import Navbar from '@/components/public/navbar';
import StoreProductCard from '@/components/public/store-product-card';
import { StorePublicHeaderRow } from '@/components/public/store-public-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useApiUrl } from '@/lib/tenant-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flyStoreCartIcon } from '@/lib/store-cart-fly';
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Loader2, Package, Search, ShoppingCart } from 'lucide-react';
import { useTenant } from '@/lib/tenant-context';
import { useEffect, useMemo, useState } from 'react';
import { computeDiscountedBundleSubtotal, computeDiscountedSubtotal } from '@shared/store-discounts';
import { formatStoreMoney, normalizeStoreCurrency } from '@shared/store-currency';

type StoreCategory = { _id: string; name: string; slug: string };

type PublicProductsPage = { items: any[]; total: number; page: number; limit: number };

export default function TokoIndexPage() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { basePath } = useTenant();
	const bp = basePath || '';
	const prefix = (path: string) => (bp ? `${bp}${path}` : path);

	const settingsUrl = useApiUrl('/store/public/settings');
	const productsUrl = useApiUrl('/store/public/products');
	const categoriesUrl = useApiUrl('/store/public/categories');
	const cartItemsUrl = useApiUrl('/store/cart/items');
	const cartUrl = useApiUrl('/store/cart');
	const cartBundlesUrl = useApiUrl('/store/cart/bundles');
	const publicCampaignsUrl = useApiUrl('/store/public/campaigns');
	const publicBundlesUrl = useApiUrl('/store/public/bundles');

	const { data: storeSettings, isLoading: loadingSettings } = useQuery({
		queryKey: [settingsUrl],
		queryFn: async () => {
			const r = await fetch(settingsUrl, { credentials: 'include' });
			if (!r.ok) throw new Error('settings');
			return r.json();
		},
	});

	const { data: categories = [] } = useQuery<StoreCategory[]>({
		queryKey: [categoriesUrl],
		queryFn: async () => {
			const r = await fetch(categoriesUrl, { credentials: 'include' });
			if (!r.ok) return [];
			return r.json();
		},
	});

	const { data: publicCampaigns = [] } = useQuery({
		queryKey: [publicCampaignsUrl],
		queryFn: async () => {
			const r = await fetch(publicCampaignsUrl, { credentials: 'include' });
			if (!r.ok) return [];
			return r.json() as Promise<any[]>;
		},
	});

	const { data: bundlesPayload } = useQuery<{ items: any[] }>({
		queryKey: [publicBundlesUrl],
		queryFn: async () => {
			const r = await fetch(publicBundlesUrl, { credentials: 'include' });
			if (!r.ok) return { items: [] };
			return r.json();
		},
	});
	const bundleList = bundlesPayload?.items ?? [];

	const storeBasePath = useMemo(() => {
		const raw = String(storeSettings?.navbarPath || '/toko').trim();
		if (!raw) return '/toko';
		const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
		const compact = withSlash.replace(/\/{2,}/g, '/');
		if (compact === '/') return '/toko';
		return compact.endsWith('/') ? compact.slice(0, -1) : compact;
	}, [storeSettings?.navbarPath]);

	const defaultCur = normalizeStoreCurrency((storeSettings as { defaultCurrency?: string })?.defaultCurrency);

	const [q, setQ] = useState('');
	/** '' = semua, '__none' = tanpa kategori, else slug kategori */
	const [categoryFilter, setCategoryFilter] = useState('');
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [page, setPage] = useState(1);

	useEffect(() => {
		setPage(1);
	}, [q, categoryFilter]);

	const productsListUrl = useMemo(() => {
		const params = new URLSearchParams();
		params.set('limit', '9');
		params.set('page', String(page));
		if (q.trim()) params.set('q', q.trim());
		if (categoryFilter === '__none') params.set('category', '__none');
		else if (categoryFilter) params.set('category', categoryFilter);
		return `${productsUrl}?${params.toString()}`;
	}, [productsUrl, q, categoryFilter, page]);

	const { data: productsPayload, isLoading: loadingProducts } = useQuery<PublicProductsPage>({
		queryKey: [productsListUrl],
		queryFn: async () => {
			const r = await fetch(productsListUrl, { credentials: 'include' });
			if (!r.ok) throw new Error('products');
			return r.json();
		},
	});

	const products = productsPayload?.items ?? [];
	const totalProducts = productsPayload?.total ?? 0;
	const pageLimit = productsPayload?.limit ?? 9;
	const totalPages = Math.max(1, Math.ceil(totalProducts / pageLimit));

	const hasActiveFilters = categoryFilter !== '';

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

	const addBundleMutation = useMutation({
		mutationFn: async (vars: { bundleId: string; fromEl?: HTMLElement | null }) => {
			const r = await apiRequest('POST', cartBundlesUrl, { bundleId: vars.bundleId, qty: 1 });
			if (!r.ok) throw new Error('cart');
		},
		onSuccess: (_d, vars) => {
			queryClient.invalidateQueries({ queryKey: [cartUrl] });
			toast({ title: 'Paket bundel ditambahkan' });
			if (vars.fromEl) flyStoreCartIcon(vars.fromEl);
		},
		onError: () =>
			toast({
				title: 'Gagal menambah bundel',
				description: 'Coba lagi atau cek stok isi paket.',
				variant: 'destructive',
			}),
	});

	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	const blocks = storeSettings?.layoutBlocks || [];
	const sortedBlocks = [...blocks].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

	const storeLabel = storeSettings?.navbarLabel || 'Toko';

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1">
				<div className="max-w-7xl mx-auto px-4 pt-8 pb-16 space-y-10">
					<StorePublicHeaderRow
						items={[{ label: 'Beranda', href: '/' }, { label: storeLabel }]}
					/>

					<div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
						<div>
							<h1 className="text-3xl font-bold tracking-tight">{storeLabel}</h1>
							<p className="text-muted-foreground mt-1">Katalog produk</p>
						</div>
						<div className="relative w-full sm:w-64 shrink-0">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								className="pl-9"
								placeholder="Cari produk..."
								value={q}
								onChange={(e) => setQ(e.target.value)}
							/>
						</div>
					</div>

					{categories.length > 0 && (
						<div className="bg-card border border-border rounded-xl shadow-sm p-6">
							<div className="space-y-3">
								<Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
									<CollapsibleTrigger asChild>
										<Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
											<Filter className="h-3.5 w-3.5" />
											Filter
											{hasActiveFilters ? ' (1)' : ''}
											<ChevronDown
												className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
											/>
										</Button>
									</CollapsibleTrigger>
									<CollapsibleContent className="mt-3 space-y-3 bg-muted/40 border border-border rounded-lg p-4">
										<div className="space-y-1.5">
											<span className="text-xs font-medium text-muted-foreground">Kategori</span>
											<div className="flex flex-wrap gap-1.5">
												<Badge
													variant={categoryFilter === '' ? 'default' : 'outline'}
													className="cursor-pointer text-xs"
													onClick={() => setCategoryFilter('')}>
													Semua
												</Badge>
												<Badge
													variant={categoryFilter === '__none' ? 'default' : 'outline'}
													className="cursor-pointer text-xs"
													onClick={() => setCategoryFilter('__none')}>
													Tanpa kategori
												</Badge>
												{categories.map((c) => (
													<Badge
														key={c._id}
														variant={categoryFilter === c.slug ? 'default' : 'outline'}
														className="cursor-pointer text-xs"
														onClick={() =>
															setCategoryFilter(categoryFilter === c.slug ? '' : c.slug)
														}>
														{c.name}
													</Badge>
												))}
											</div>
										</div>
										{hasActiveFilters && (
											<Button
												variant="ghost"
												size="sm"
												className="text-xs h-8"
												onClick={() => setCategoryFilter('')}>
												Reset filter
											</Button>
										)}
									</CollapsibleContent>
								</Collapsible>
							</div>
						</div>
					)}

					{bundleList.length > 0 && !loadingSettings && (
						<section className="space-y-3">
							<div className="flex items-center gap-2">
								<Package className="h-5 w-5 text-primary" />
								<h2 className="text-lg font-semibold">Bundling</h2>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{bundleList.map((b: any) => {
									const bPr = computeDiscountedBundleSubtotal(
										String(b._id),
										Number(b.bundlePrice) || 0,
										1,
										publicCampaigns,
									);
									return (
										<Card key={b._id} className="overflow-hidden">
											<div className="aspect-[16/9] bg-muted">
												{b.thumbnail ? (
													<MediaDisplay
														src={b.thumbnail}
														alt={b.name}
														className="w-full h-full object-cover"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center text-muted-foreground">
														<Package className="h-10 w-10 opacity-50" />
													</div>
												)}
											</div>
											<CardContent className="p-4 space-y-2">
												<p className="font-semibold line-clamp-2">{b.name}</p>
												{b.shortDescription && (
													<p className="text-sm text-muted-foreground line-clamp-2">
														{b.shortDescription}
													</p>
												)}
												<div className="flex items-center justify-between gap-2 pt-1">
													<div>
														{bPr.compareSubtotal > bPr.lineSubtotal && (
															<p className="text-xs text-muted-foreground line-through">
																{formatStoreMoney(bPr.compareSubtotal, defaultCur)}
															</p>
														)}
														<p className="text-primary font-bold">
															{formatStoreMoney(bPr.lineSubtotal, defaultCur)}
														</p>
													</div>
													<Button
														type="button"
														size="icon"
														variant="secondary"
														className="shrink-0"
														disabled={addBundleMutation.isPending}
														aria-label="Tambah bundel"
														onClick={(e) =>
															addBundleMutation.mutate({
																bundleId: String(b._id),
																fromEl: e.currentTarget,
															})
														}>
														<ShoppingCart className="h-4 w-4" />
													</Button>
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						</section>
					)}

					{loadingSettings ? (
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
					) : (
						sortedBlocks.map((block: any) => {
							if (block.visible === false) return null;
							if (block.type === 'hero') {
								return (
									<section
										key={block.id}
										className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-cyan-500/10 p-8 md:p-12 text-center">
										<h2 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
											{block.props?.title || 'Toko'}
										</h2>
										<p className="mt-3 text-muted-foreground max-w-xl mx-auto">
											{block.props?.subtitle || ''}
										</p>
									</section>
								);
							}
							if (block.type === 'product_grid') {
								return (
									<section key={block.id}>
										{loadingProducts ? (
											<div className="flex justify-center py-16">
												<Loader2 className="h-8 w-8 animate-spin" />
											</div>
										) : (
											<>
											<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
												{products.map((p: any) => {
													const pr = computeDiscountedSubtotal(p, 1, publicCampaigns);
													return (
														<StoreProductCard
															key={p._id}
															product={p}
															detailHref={prefix(`${storeBasePath}/${p.slug}`)}
															defaultCurrency={defaultCur}
															displayAmount={pr.lineSubtotal}
															compareAtAmount={pr.compareSubtotal}
															promoLabels={pr.applied.map((a) => a.label)}
															quickAddDisabled={quickAddMutation.isPending}
															onQuickAdd={(productId, fromEl) =>
																quickAddMutation.mutate({ productId, fromEl })
															}
														/>
													);
												})}
											</div>
											{totalPages > 1 && (
												<div className="flex items-center justify-center gap-4 mt-8">
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={page <= 1}
														onClick={() => setPage((p) => Math.max(1, p - 1))}>
														<ChevronLeft className="h-4 w-4 mr-1" />
														Sebelumnya
													</Button>
													<span className="text-sm text-muted-foreground tabular-nums">
														Halaman {page} / {totalPages}
													</span>
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={page >= totalPages}
														onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
														Selanjutnya
														<ChevronRight className="h-4 w-4 ml-1" />
													</Button>
												</div>
											)}
											</>
										)}
									</section>
								);
							}
							return null;
						})
					)}
				</div>
			</main>
			<Footer />
			<AIChat pageContext={{ path: storeBasePath, permissions: [] }} />
		</div>
	);
}
