import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { StorePublicHeaderRow } from '@/components/public/store-public-header';
import {
	OrderProgressBar,
	StoreOrderStatusBadge,
} from '@/components/public/store-order-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApiUrl } from '@/lib/tenant-context';
import { useTenant } from '@/lib/tenant-context';
import { formatStoreMoney, normalizeStoreCurrency } from '@shared/store-currency';
import { useQuery } from '@tanstack/react-query';
import { Copy, Loader2 } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'wouter';

function normalizeWaDigits(phone: string): string {
	return String(phone || '').replace(/\D/g, '');
}

interface OrderData {
	orderNo: string;
	items: {
		name: string;
		qty: number;
		unitPrice: number;
		lineSubtotal: number;
		currency?: string;
	}[];
	subtotal: number;
	total: number;
	shippingCost?: number;
	taxAmount?: number;
	taxPercent?: number;
	fulfillment: string;
	customerName: string;
	customerPhone: string;
	shippingAddress?: string;
	status: string;
	createdAt: string;
	whatsappMessageSnapshot?: string;
	whatsappPhoneUsed?: string;
}

export default function TokoOrderInvoicePage() {
	const { orderNo: rawOrderNo } = useParams<{ orderNo: string }>();
	const orderNo = decodeURIComponent(rawOrderNo || '');
	const { basePath } = useTenant();
	const bp = basePath || '';
	const prefix = (path: string) => (bp ? `${bp}${path}` : path);

	const settingsUrl = useApiUrl('/store/public/settings');
	const storeApiBase = useApiUrl('/store');
	const [invQuery, setInvQuery] = useState('');
	useEffect(() => {
		const inv = new URLSearchParams(window.location.search).get('inv') || '';
		setInvQuery(inv);
		const onPop = () =>
			setInvQuery(new URLSearchParams(window.location.search).get('inv') || '');
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	const orderUrl = useMemo(() => {
		if (!orderNo) return '';
		const qs = invQuery ? `?inv=${encodeURIComponent(invQuery)}` : '';
		return `${storeApiBase}/orders/${encodeURIComponent(orderNo)}${qs}`;
	}, [storeApiBase, orderNo, invQuery]);

	const { data: storeSettings } = useQuery({
		queryKey: [settingsUrl],
		queryFn: async () => {
			const r = await fetch(settingsUrl, { credentials: 'include' });
			if (!r.ok) return { navbarPath: '/toko', navbarLabel: 'Toko', defaultCurrency: 'IDR' };
			return r.json();
		},
	});

	const storeBasePath = useMemo(() => {
		const raw = String(storeSettings?.navbarPath || '/toko').trim();
		if (!raw) return '/toko';
		const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
		const compact = withSlash.replace(/\/{2,}/g, '/');
		if (compact === '/') return '/toko';
		return compact.endsWith('/') ? compact.slice(0, -1) : compact;
	}, [storeSettings?.navbarPath]);

	const storeLabel = (storeSettings as { navbarLabel?: string } | undefined)?.navbarLabel || 'Toko';

	const defaultCur = normalizeStoreCurrency(storeSettings?.defaultCurrency);

	const {
		data: order,
		isLoading,
		error,
	} = useQuery({
		queryKey: [orderUrl, invQuery],
		queryFn: async () => {
			const r = await fetch(orderUrl, { credentials: 'include' });
			if (!r.ok) throw new Error('notfound');
			return r.json() as Promise<OrderData>;
		},
		enabled: !!orderNo && !!orderUrl,
	});

	useEffect(() => {
		if (order?.orderNo) document.title = `Pesanan ${order.orderNo} | Toko`;
	}, [order?.orderNo]);

	const orderCur =
		(order && Array.isArray(order.items) && order.items[0]?.currency) || defaultCur;

	const waUrl = useMemo(() => {
		if (!order?.whatsappPhoneUsed || !order?.whatsappMessageSnapshot) return '';
		const digits = normalizeWaDigits(order.whatsappPhoneUsed);
		if (!digits) return '';
		return `https://wa.me/${digits}?text=${encodeURIComponent(order.whatsappMessageSnapshot)}`;
	}, [order?.whatsappPhoneUsed, order?.whatsappMessageSnapshot]);

	const [copied, setCopied] = useState(false);
	const copyMsg = () => {
		if (!order?.whatsappMessageSnapshot) return;
		navigator.clipboard.writeText(order.whatsappMessageSnapshot).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	return (
		<div className="min-h-screen bg-background flex flex-col">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
				<StorePublicHeaderRow
					items={[
						{ label: 'Beranda', href: '/' },
						{ label: storeLabel, href: prefix(storeBasePath) },
						{ label: 'Riwayat', href: prefix(`${storeBasePath}/orders`) },
						{ label: order?.orderNo || 'Invoice' },
					]}
				/>

				{isLoading && (
					<div className="flex justify-center py-16">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				)}
				{error && (
					<p className="text-center text-muted-foreground py-12">
						Pesanan tidak ditemukan atau sesi perangkat tidak cocok.
					</p>
				)}
				{order && (
					<div className="space-y-6">
						<Card>
							<CardHeader className="space-y-3">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<CardTitle className="text-xl">Detail pesanan</CardTitle>
									<StoreOrderStatusBadge status={order.status} />
								</div>
								<p className="text-sm text-muted-foreground font-mono">{order.orderNo}</p>
								<p className="text-sm text-muted-foreground">
									{order.createdAt ? new Date(order.createdAt).toLocaleString('id-ID') : ''}
								</p>
								<OrderProgressBar status={order.status} />
							</CardHeader>
							<CardContent className="space-y-4 text-sm">
								<div>
									<p className="font-medium">{order.customerName}</p>
									<p className="text-muted-foreground">{order.customerPhone}</p>
									<p className="text-muted-foreground capitalize mt-1">
										{order.fulfillment === 'delivery' ? 'Pengiriman' : 'Ambil di tempat'}
									</p>
									{order.shippingAddress ? (
										<p className="text-muted-foreground mt-2 whitespace-pre-wrap">
											{order.shippingAddress}
										</p>
									) : null}
								</div>
								<div className="border-t pt-3 space-y-2">
									<p className="font-medium">Item</p>
									<ul className="space-y-1">
										{(order.items || []).map((li, i) => (
											<li key={i} className="flex justify-between gap-2">
												<span>
													{li.name} × {li.qty}
												</span>
												<span className="tabular-nums shrink-0">
													{formatStoreMoney(
														li.lineSubtotal ?? li.unitPrice * li.qty,
														li.currency || orderCur,
													)}
												</span>
											</li>
										))}
									</ul>
								</div>
								<div className="border-t pt-3 space-y-1 tabular-nums">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Subtotal</span>
										<span>{formatStoreMoney(order.subtotal ?? 0, orderCur)}</span>
									</div>
									{(order.taxAmount ?? 0) > 0 && (
										<div className="flex justify-between text-muted-foreground">
											<span>Pajak ({order.taxPercent ?? 0}%)</span>
											<span>{formatStoreMoney(order.taxAmount ?? 0, orderCur)}</span>
										</div>
									)}
									{(order.shippingCost ?? 0) > 0 && (
										<div className="flex justify-between text-muted-foreground">
											<span>Ongkos kirim</span>
											<span>{formatStoreMoney(order.shippingCost ?? 0, orderCur)}</span>
										</div>
									)}
									<div className="flex justify-between font-semibold text-base pt-1">
										<span>Total</span>
										<span>{formatStoreMoney(order.total ?? 0, orderCur)}</span>
									</div>
								</div>

								{waUrl && (
									<div className="border-t pt-4 space-y-2">
										<Button asChild className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white">
											<a href={waUrl} target="_blank" rel="noopener noreferrer">
												<FaWhatsapp className="h-5 w-5 mr-2" />
												Kirim ke WhatsApp
											</a>
										</Button>
										{order.whatsappMessageSnapshot && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="w-full text-xs text-muted-foreground"
												onClick={copyMsg}>
												<Copy className="h-3.5 w-3.5 mr-1.5" />
												{copied ? 'Tersalin!' : 'Salin teks pesan'}
											</Button>
										)}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				)}
			</main>
			<Footer />
			<AIChat pageContext={{ path: `${storeBasePath}/order`, permissions: [] }} />
		</div>
	);
}
