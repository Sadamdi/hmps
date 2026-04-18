import { PageBreadcrumb, type BreadcrumbItem } from '@/components/public/page-breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApiUrl, useTenant } from '@/lib/tenant-context';
import { useQuery } from '@tanstack/react-query';
import { History, ShoppingCart } from 'lucide-react';
import { Link } from 'wouter';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

type Props = {
	items: BreadcrumbItem[];
	className?: string;
};

export function StorePublicHeaderRow({ items, className }: Props) {
	const { basePath } = useTenant();
	const bp = basePath || '';
	const prefix = (path: string) => (bp ? `${bp}${path}` : path);

	const settingsUrl = useApiUrl('/store/public/settings');
	const cartUrl = useApiUrl('/store/cart');

	const { data: storeSettings } = useQuery<{
		navbarPath?: string;
		navbarLabel?: string;
	}>({
		queryKey: [settingsUrl],
		queryFn: async () => {
			const r = await fetch(settingsUrl, { credentials: 'include' });
			if (!r.ok) return { navbarPath: '/toko', navbarLabel: 'Toko' };
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

	const { data: cart } = useQuery({
		queryKey: [cartUrl],
		queryFn: async () => {
			const r = await fetch(cartUrl, { credentials: 'include' });
			if (!r.ok) throw new Error('cart');
			return r.json();
		},
	});

	const cartQty = useMemo(() => {
		const rows = (cart as { items?: { qty?: number }[] } | undefined)?.items;
		if (!Array.isArray(rows)) return 0;
		return rows.reduce((s, it) => s + Math.max(0, Math.floor(Number(it.qty) || 0)), 0);
	}, [cart]);

	const ordersHref = prefix(`${storeBasePath}/orders`);
	const cartHref = prefix(`${storeBasePath}/cart`);

	return (
		<div
			className={cn(
				'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-6',
				className,
			)}>
			<PageBreadcrumb items={items} className="mb-0 flex-1 min-w-0" />
			<div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end">
				<Button variant="outline" size="sm" className="gap-2" asChild>
					<Link href={ordersHref}>
						<History className="h-4 w-4" />
						Riwayat
					</Link>
				</Button>
				<Button variant="outline" size="sm" className="gap-2" asChild>
					<Link href={cartHref} className="relative inline-flex items-center gap-2">
						<span id="store-cart-anchor" className="relative inline-flex items-center gap-2">
							<ShoppingCart className="h-4 w-4" />
							Keranjang
							{cartQty > 0 && (
								<Badge
									variant="default"
									className="absolute -top-2.5 -right-3 h-5 min-w-[1.25rem] px-1 flex items-center justify-center p-0 text-[10px] font-bold tabular-nums">
									{cartQty > 99 ? '99+' : cartQty}
								</Badge>
							)}
						</span>
					</Link>
				</Button>
			</div>
		</div>
	);
}
