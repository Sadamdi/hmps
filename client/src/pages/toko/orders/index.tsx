import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { StorePublicHeaderRow } from '@/components/public/store-public-header';
import {
	OrderProgressBar,
	StoreOrderStatusBadge,
	orderStatusLabel,
} from '@/components/public/store-order-status';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useApiUrl } from '@/lib/tenant-context';
import { useTenant } from '@/lib/tenant-context';
import { formatStoreMoney, normalizeStoreCurrency } from '@shared/store-currency';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, PackageSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'wouter';

type FilterKey = '' | 'pending' | 'paid' | 'confirmed' | 'completed' | 'cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
	{ key: '', label: 'Semua' },
	{ key: 'pending', label: 'Menunggu' },
	{ key: 'paid', label: 'Dibayar' },
	{ key: 'confirmed', label: 'Dikonfirmasi' },
	{ key: 'completed', label: 'Diterima' },
	{ key: 'cancelled', label: 'Dibatalkan' },
];

function matchFilter(status: string, filter: FilterKey): boolean {
	if (!filter) return true;
	return status === filter;
}

export default function TokoOrdersHistoryPage() {
	const { basePath } = useTenant();
	const bp = basePath || '';
	const prefix = (path: string) => (bp ? `${bp}${path}` : path);

	const settingsUrl = useApiUrl('/store/public/settings');
	const myOrdersUrl = useApiUrl('/store/my-orders');

	const { data: storeSettings } = useQuery<{
		navbarPath?: string;
		navbarLabel?: string;
		defaultCurrency?: string;
	}>({
		queryKey: [settingsUrl],
		queryFn: async () => {
			const r = await fetch(settingsUrl, { credentials: 'include' });
			if (!r.ok) return { navbarPath: '/toko' };
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

	const storeLabel = storeSettings?.navbarLabel || 'Toko';
	const defaultCur = normalizeStoreCurrency(storeSettings?.defaultCurrency);

	const { data: myOrders = [], isLoading } = useQuery<any[]>({
		queryKey: [myOrdersUrl],
		queryFn: async () => {
			const r = await fetch(myOrdersUrl, { credentials: 'include' });
			if (!r.ok) return [];
			return r.json();
		},
	});

	const [filter, setFilter] = useState<FilterKey>('');

	const filtered = useMemo(
		() => myOrders.filter((o: any) => matchFilter(String(o.status || ''), filter)),
		[myOrders, filter],
	);

	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
				<StorePublicHeaderRow
					items={[
						{ label: 'Beranda', href: '/' },
						{ label: storeLabel, href: prefix(storeBasePath) },
						{ label: 'Riwayat pesanan' },
					]}
				/>

				<h1 className="text-2xl font-bold mb-6">Riwayat pesanan</h1>

				<div className="flex flex-wrap gap-2 mb-6">
					{FILTERS.map((f) => (
						<Badge
							key={f.key}
							variant={filter === f.key ? 'default' : 'outline'}
							className="cursor-pointer text-xs select-none"
							onClick={() => setFilter(f.key)}>
							{f.label}
							{f.key && (
								<span className="ml-1 tabular-nums opacity-70">
									{myOrders.filter((o: any) =>
										matchFilter(String(o.status || ''), f.key),
									).length}
								</span>
							)}
						</Badge>
					))}
				</div>

				{isLoading ? (
					<div className="flex justify-center py-16">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
						<PackageSearch className="h-12 w-12 text-muted-foreground/50" />
						<p className="text-muted-foreground">
							{myOrders.length === 0
								? 'Belum ada riwayat pesanan di perangkat ini.'
								: `Tidak ada pesanan dengan status "${
										FILTERS.find((x) => x.key === filter)?.label ?? filter
									}".`}
						</p>
					</div>
				) : (
					<div className="space-y-4">
						<AnimatePresence mode="popLayout">
							{filtered.map((o: any, idx: number) => {
								const orderCur =
									(Array.isArray(o.items) && o.items[0]?.currency) || defaultCur;
								const token = o.invoiceAccessToken
									? `?inv=${encodeURIComponent(String(o.invoiceAccessToken))}`
									: '';
								const invoiceHref = prefix(
									`${storeBasePath}/order/${encodeURIComponent(o.orderNo)}${token}`,
								);

								return (
									<motion.div
										key={o._id || o.orderNo}
										layout
										initial={{ opacity: 0, y: 16 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, scale: 0.96 }}
										transition={{
											type: 'spring',
											stiffness: 350,
											damping: 28,
											delay: idx * 0.04,
										}}>
										<Link href={invoiceHref} className="block group">
											<Card className="overflow-hidden hover:border-primary/40 transition-colors">
												<CardContent className="p-5 space-y-4">
													<div className="flex flex-wrap items-start justify-between gap-3">
														<div className="space-y-1">
															<p className="font-semibold font-mono text-sm">
																{o.orderNo}
															</p>
															<p className="text-xs text-muted-foreground">
																{o.createdAt
																	? new Date(o.createdAt).toLocaleString('id-ID')
																	: ''}
															</p>
														</div>
														<StoreOrderStatusBadge
															status={String(o.status || '')}
														/>
													</div>

													<OrderProgressBar status={String(o.status || '')} />

													<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
														<div className="text-muted-foreground">
															{o.customerName}
															{o.customerPhone
																? ` · ${o.customerPhone}`
																: ''}
														</div>
														<p className="font-bold text-primary tabular-nums">
															{formatStoreMoney(
																o.total ?? o.subtotal ?? 0,
																orderCur,
															)}
														</p>
													</div>

													{Array.isArray(o.items) && o.items.length > 0 && (
														<ul className="text-xs text-muted-foreground space-y-0.5">
															{o.items.slice(0, 3).map((li: any, i: number) => (
																<li key={i}>
																	{li.name} × {li.qty}
																</li>
															))}
															{o.items.length > 3 && (
																<li className="italic">
																	+{o.items.length - 3} item lainnya
																</li>
															)}
														</ul>
													)}

													<p className="text-xs text-primary group-hover:underline">
														Lihat detail invoice →
													</p>
												</CardContent>
											</Card>
										</Link>
									</motion.div>
								);
							})}
						</AnimatePresence>
					</div>
				)}
			</main>
			<Footer />
			<AIChat pageContext={{ path: `${storeBasePath}/orders`, permissions: [] }} />
		</div>
	);
}
