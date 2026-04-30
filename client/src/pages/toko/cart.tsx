import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { StorePublicHeaderRow } from '@/components/public/store-public-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useApiUrl } from '@/lib/tenant-context';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { useTenant } from '@/lib/tenant-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { formatStoreMoney, normalizeStoreCurrency } from '@shared/store-currency';

function lineKeyOfCartItem(it: { lineKey?: string; lineKind?: string; bundleId?: string; productId?: string }): string {
	if (it?.lineKey) return String(it.lineKey);
	if (it?.lineKind === 'bundle' || it?.bundleId) return `b:${it.bundleId}`;
	return `p:${it.productId}`;
}

function buildCheckoutItemsFromCart(items: any[]) {
	return items.map((it: any) =>
		it.lineKind === 'bundle' || it.bundleId
			? { bundleId: it.bundleId, qty: it.qty }
			: { productId: it.productId, qty: it.qty },
	);
}

function storeOrderStatusLabel(status: string): string {
	switch (status) {
		case 'pending':
			return 'Menunggu';
		case 'paid':
			return 'Dibayar';
		case 'confirmed':
			return 'Dikonfirmasi';
		case 'completed':
			return 'Diterima';
		case 'cancelled':
			return 'Dibatalkan';
		default:
			return status;
	}
}

export default function TokoCartPage() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [location] = useLocation();
	const { basePath } = useTenant();
	const bp = basePath || '';
	const prefix = (path: string) => (bp ? `${bp}${path}` : path);

	const cartUrl = useApiUrl('/store/cart');
	const checkoutUrl = useApiUrl('/store/checkout');
	const shippingQuoteUrl = useApiUrl('/store/shipping/quote');
	const myOrdersUrl = useApiUrl('/store/my-orders');
	const settingsUrl = useApiUrl('/store/public/settings');
	const { data: storeSettings } = useQuery<{
		navbarPath?: string;
		navbarLabel?: string;
		defaultCurrency?: string;
		shipping?: { enabled: boolean; hasGlobalOrigin: boolean };
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
	const storeLabel = storeSettings?.navbarLabel || 'Toko';

	const { data: cart, isLoading } = useQuery({
		queryKey: [cartUrl],
		queryFn: async () => {
			const r = await fetch(cartUrl, { credentials: 'include' });
			if (!r.ok) throw new Error('cart');
			return r.json();
		},
	});

	const { data: myOrders = [] } = useQuery<any[]>({
		queryKey: [myOrdersUrl],
		queryFn: async () => {
			const r = await fetch(myOrdersUrl, { credentials: 'include' });
			if (!r.ok) return [];
			return r.json();
		},
	});

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (window.location.hash !== '#riwayat-pesanan') return;
		requestAnimationFrame(() => {
			document.getElementById('riwayat-pesanan')?.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		});
	}, [location, myOrders.length]);

	const cartCurrency = normalizeStoreCurrency(
		(cart as { currency?: string } | undefined)?.currency ?? storeSettings?.defaultCurrency,
	);

	const [name, setName] = useState('');
	const [phone, setPhone] = useState('');
	const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
	const [address, setAddress] = useState('');
	const [destVillage, setDestVillage] = useState('');
	const [selectedCourier, setSelectedCourier] = useState('');
	const [quotedShipping, setQuotedShipping] = useState<{
		cost: number;
		etd: string;
		code: string;
	} | null>(null);
	const [selectedByKey, setSelectedByKey] = useState<Record<string, boolean>>({});

	useEffect(() => {
		const items = (cart as { items?: any[] } | undefined)?.items || [];
		setSelectedByKey((prev) => {
			const out: Record<string, boolean> = {};
			for (const it of items) {
				const k = lineKeyOfCartItem(it);
				out[k] = prev[k] !== false;
			}
			return out;
		});
	}, [cart]);

	const selectedItems = useMemo(() => {
		const items = (cart as { items?: any[] } | undefined)?.items || [];
		return items.filter((it: any) => selectedByKey[lineKeyOfCartItem(it)] !== false);
	}, [cart, selectedByKey]);

	const selectedSummary = useMemo(() => {
		let sub = 0;
		for (const it of selectedItems) {
			const line =
				typeof it.lineSubtotal === 'number'
					? it.lineSubtotal
					: (Number(it.price) || 0) * (Number(it.qty) || 1);
			sub += line;
		}
		const taxEnabled = !!(cart as { taxEnabled?: boolean } | undefined)?.taxEnabled;
		const taxPercent = Number((cart as { taxPercent?: number } | undefined)?.taxPercent || 0);
		const tax = taxEnabled ? Math.round((sub * taxPercent) / 100) : 0;
		const ship =
			fulfillment === 'delivery' && storeSettings?.shipping?.enabled && quotedShipping
				? quotedShipping.cost
				: 0;
		return { subtotal: sub, tax, total: sub + tax + ship, taxPercent, taxEnabled, shipping: ship };
	}, [selectedItems, cart, fulfillment, storeSettings, quotedShipping]);

	const allSelected =
		(cart?.items?.length ?? 0) > 0 &&
		(cart?.items || []).every((it: any) => selectedByKey[lineKeyOfCartItem(it)] !== false);

	const toggleAll = useCallback(
		(checked: boolean) => {
			const items = (cart as { items?: any[] } | undefined)?.items || [];
			const out: Record<string, boolean> = {};
			for (const it of items) {
				out[lineKeyOfCartItem(it)] = checked;
			}
			setSelectedByKey(out);
		},
		[cart],
	);

	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	const checkoutMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest('POST', checkoutUrl, {
				items: buildCheckoutItemsFromCart(selectedItems),
				customerName: name.trim(),
				customerPhone: phone.trim(),
				fulfillment,
				shippingAddress: fulfillment === 'delivery' ? address.trim() : '',
				destinationVillageCode: fulfillment === 'delivery' ? destVillage.trim() : '',
				shippingCourierCode: fulfillment === 'delivery' ? (selectedCourier || quotedShipping?.code || '') : '',
			});
			return res.json();
		},
		onSuccess: (data: { whatsappUrl?: string }) => {
			if (data.whatsappUrl) {
				window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
			}
			queryClient.invalidateQueries({ queryKey: [cartUrl] });
			queryClient.invalidateQueries({ queryKey: [myOrdersUrl] });
			toast({ title: 'Pesanan dibuat', description: 'WhatsApp dibuka untuk mengirim ke admin toko.' });
		},
		onError: (e: Error) => toast({ title: 'Checkout gagal', description: e.message, variant: 'destructive' }),
	});

	const cartItemsUrlBase = useApiUrl('/store/cart/items');
	const cartBundlesUrlBase = useApiUrl('/store/cart/bundles');

	const onRemove = (it: any) => {
		const isB = it.lineKind === 'bundle' || it.bundleId;
		const url = isB ? `${cartBundlesUrlBase}/${it.bundleId}` : `${cartItemsUrlBase}/${it.productId}`;
		apiRequest('DELETE', url).then(() => {
			queryClient.invalidateQueries({ queryKey: [cartUrl] });
		});
	};

	const setItemQty = (it: any, nextQty: number) => {
		if (nextQty < 1) {
			onRemove(it);
			return;
		}
		const isB = it.lineKind === 'bundle' || it.bundleId;
		const url = isB ? `${cartBundlesUrlBase}/${it.bundleId}` : `${cartItemsUrlBase}/${it.productId}`;
		apiRequest('PATCH', url, { qty: nextQty }).then(() => {
			queryClient.invalidateQueries({ queryKey: [cartUrl] });
		});
	};

	const fetchQuote = useCallback(() => {
		if (fulfillment !== 'delivery' || !storeSettings?.shipping?.enabled) {
			setQuotedShipping(null);
			return;
		}
		if (!/^\d{10}$/.test(destVillage.trim()) || selectedItems.length === 0) return;
		apiRequest('POST', shippingQuoteUrl, {
			destinationVillageCode: destVillage.trim(),
			items: buildCheckoutItemsFromCart(selectedItems),
		} as any)
			.then((r) => r.json())
			.then((j: any) => {
				const c = j?.cheapest;
				if (c) {
					setSelectedCourier(c.courierCode);
					setQuotedShipping({ cost: c.price, etd: c.etd, code: c.courierCode });
				} else {
					setQuotedShipping(null);
				}
			})
			.catch(() => setQuotedShipping(null));
	}, [fulfillment, storeSettings, destVillage, selectedItems, shippingQuoteUrl]);

	useEffect(() => {
		fetchQuote();
	}, [fetchQuote]);

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
				<StorePublicHeaderRow
					items={[
						{ label: 'Beranda', href: '/' },
						{ label: storeLabel, href: prefix(storeBasePath) },
						{ label: 'Keranjang' },
					]}
				/>

				<h1 className="text-2xl font-bold mb-6">Keranjang</h1>

				{isLoading ? (
					<Loader2 className="h-8 w-8 animate-spin mx-auto" />
				) : !cart?.items?.length ? (
					<p className="text-muted-foreground">Keranjang kosong.</p>
				) : (
					<div className="space-y-6">
						<div className="flex items-center gap-2 text-sm">
							<Checkbox
								id="cart-select-all"
								checked={allSelected}
								onCheckedChange={(v) => toggleAll(v === true)}
							/>
							<label htmlFor="cart-select-all" className="cursor-pointer select-none">
								Pilih semua untuk checkout
							</label>
						</div>
						{cart.items.map((it: any) => {
							const line =
								typeof it.lineSubtotal === 'number'
									? it.lineSubtotal
									: (Number(it.price) || 0) * (Number(it.qty) || 1);
							const unit = typeof it.unitPrice === 'number' ? it.unitPrice : Number(it.price) || 0;
							const cur = it.currency || cartCurrency;
							const maxQ = it.stockAvailable != null ? it.stockAvailable : 999999;
							const lkey = lineKeyOfCartItem(it);
							const checked = selectedByKey[lkey] !== false;
							return (
								<Card key={lkey}>
									<CardContent className="p-4 flex flex-col sm:flex-row justify-between gap-4">
										<div className="flex gap-3 flex-1 min-w-0">
											<div className="pt-0.5">
												<Checkbox
													checked={checked}
													onCheckedChange={(v) =>
														setSelectedByKey((prev) => ({
															...prev,
															[lkey]: v === true,
														}))
													}
													aria-label={`Pilih ${it.name}`}
												/>
											</div>
											<div className="flex-1 min-w-0">
											<div className="font-medium">
												{it.lineKind === 'bundle' || it.bundleId ? (
													<span className="text-xs rounded bg-primary/10 text-primary px-1.5 py-0.5 mr-1">
														Bundel
													</span>
												) : null}
												{it.name}
											</div>
											<div className="text-sm text-muted-foreground mt-1">
												{formatStoreMoney(unit, cur)} × {it.qty}
											</div>
											<div className="font-semibold text-primary mt-1">
												{formatStoreMoney(line, cur)}
											</div>
											</div>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<div className="flex items-center gap-1 border rounded-md p-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8"
													onClick={() => setItemQty(it, it.qty - 1)}>
													<Minus className="h-4 w-4" />
												</Button>
												<span className="w-8 text-center text-sm tabular-nums">{it.qty}</span>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8"
													disabled={it.qty >= maxQ}
													onClick={() => setItemQty(it, it.qty + 1)}>
													<Plus className="h-4 w-4" />
												</Button>
											</div>
											<Button variant="ghost" size="icon" onClick={() => onRemove(it)}>
												<Trash2 className="h-4 w-4 text-destructive" />
											</Button>
										</div>
									</CardContent>
								</Card>
							);
						})}

						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Ringkasan</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								<p className="text-xs text-muted-foreground mb-2">
									Ringkasan untuk baris yang dicentang saja.
								</p>
								<div className="flex justify-between">
									<span>Subtotal</span>
									<span>{formatStoreMoney(selectedSummary.subtotal, cartCurrency)}</span>
								</div>
								{selectedSummary.taxEnabled && (
									<div className="flex justify-between">
										<span>Pajak ({selectedSummary.taxPercent}%)</span>
										<span>{formatStoreMoney(selectedSummary.tax, cartCurrency)}</span>
									</div>
								)}
								{fulfillment === 'delivery' && storeSettings?.shipping?.enabled && (
									<div className="flex justify-between text-muted-foreground">
										<span>Ongkos kirim (estimasi)</span>
										<span>
											{quotedShipping
												? formatStoreMoney(quotedShipping.cost, cartCurrency)
												: '—'}
										</span>
									</div>
								)}
								<div className="flex justify-between font-bold text-base pt-2 border-t">
									<span>Total</span>
									<span>{formatStoreMoney(selectedSummary.total, cartCurrency)}</span>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Checkout</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Nama</Label>
									<Input value={name} onChange={(e) => setName(e.target.value)} />
								</div>
								<div className="space-y-2">
									<Label>Nomor WhatsApp</Label>
									<Input value={phone} onChange={(e) => setPhone(e.target.value)} />
								</div>
								<div className="space-y-2">
									<Label>Pengiriman</Label>
									<RadioGroup
										value={fulfillment}
										onValueChange={(v) => setFulfillment(v as 'pickup' | 'delivery')}
										className="flex gap-4">
										<div className="flex items-center gap-2">
											<RadioGroupItem value="pickup" id="pickup" />
											<Label htmlFor="pickup">Ambil di tempat</Label>
										</div>
										<div className="flex items-center gap-2">
											<RadioGroupItem value="delivery" id="delivery" />
											<Label htmlFor="delivery">Diantar</Label>
										</div>
									</RadioGroup>
								</div>
								{fulfillment === 'delivery' && (
									<div className="space-y-2">
										<Label>Alamat lengkap</Label>
										<Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
									</div>
								)}
								{fulfillment === 'delivery' && storeSettings?.shipping?.enabled && (
									<div className="space-y-2">
										<Label>Kode kelurahan tujuan (10 digit)</Label>
										<Input
											inputMode="numeric"
											placeholder="Dari peta wilayah Indonesia / admin toko"
											value={destVillage}
											onChange={(e) => setDestVillage(e.target.value.replace(/\D/g, '').slice(0, 10))}
										/>
										<p className="text-xs text-muted-foreground">
									Ongkir dihitung otomatis. Isi 10 digit kode desa/kelurahan tujuan.
										</p>
										<Button type="button" variant="secondary" size="sm" onClick={fetchQuote}>
											Hitung ulang ongkir
										</Button>
									</div>
								)}
								<Button
									className="w-full"
									size="lg"
									disabled={
										checkoutMutation.isPending ||
										!name.trim() ||
										!phone.trim() ||
										selectedItems.length === 0
									}
									onClick={() => {
										if (selectedItems.length === 0) {
											toast({
												title: 'Pilih minimal satu item',
												variant: 'destructive',
											});
											return;
										}
										if (fulfillment === 'delivery' && !address.trim()) {
											toast({
												title: 'Alamat wajib diisi',
												variant: 'destructive',
											});
											return;
										}
										if (
											fulfillment === 'delivery' &&
											storeSettings?.shipping?.enabled &&
											!/^\d{10}$/.test(destVillage.trim())
										) {
											toast({ title: 'Kode kelurahan 10 digit wajib', variant: 'destructive' });
											return;
										}
										checkoutMutation.mutate();
									}}>
									{checkoutMutation.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										'Checkout & WhatsApp'
									)}
								</Button>
							</CardContent>
						</Card>

						{myOrders.length > 0 && (
							<Card id="riwayat-pesanan">
								<CardHeader>
									<CardTitle className="text-lg">Riwayat pesanan (perangkat ini)</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3 text-sm">
									<div className="flex items-center justify-between gap-2">
										<p className="text-muted-foreground text-xs">
											Tersimpan lewat cookie sesi — tanpa login.
										</p>
										<Button variant="link" size="sm" className="text-xs px-0 h-auto" asChild>
											<Link href={prefix(`${storeBasePath}/orders`)}>
												Lihat semua riwayat →
											</Link>
										</Button>
									</div>
									{myOrders.map((o: any) => {
										const orderCur =
											(Array.isArray(o.items) && o.items[0]?.currency) || cartCurrency;
										const token = o.invoiceAccessToken
											? `?inv=${encodeURIComponent(String(o.invoiceAccessToken))}`
											: '';
										const invoiceHref = prefix(
											`${storeBasePath}/order/${encodeURIComponent(o.orderNo)}${token}`,
										);
										return (
											<Link
												key={o._id || o.orderNo}
												href={invoiceHref}
												className="block border rounded-lg p-3 space-y-1 text-left hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
												<div className="flex justify-between gap-2 flex-wrap">
													<span className="font-medium">{o.orderNo}</span>
													<span className="text-muted-foreground">
														{o.createdAt
															? new Date(o.createdAt).toLocaleString('id-ID')
															: ''}
													</span>
												</div>
												<div className="text-muted-foreground">
													{formatStoreMoney(o.total ?? o.subtotal ?? 0, orderCur)} ·{' '}
													{storeOrderStatusLabel(String(o.status || ''))}
												</div>
												{Array.isArray(o.items) && o.items.length > 0 && (
													<ul className="list-disc list-inside text-xs text-muted-foreground">
														{o.items.map((li: any, i: number) => (
															<li key={i}>
																{li.name} × {li.qty}
															</li>
														))}
													</ul>
												)}
												<p className="text-xs text-primary pt-1">Lihat detail invoice →</p>
											</Link>
										);
									})}
								</CardContent>
							</Card>
						)}
					</div>
				)}
			</main>
			<Footer />
			<AIChat pageContext={{ path: `${storeBasePath}/cart`, permissions: [] }} />
		</div>
	);
}
