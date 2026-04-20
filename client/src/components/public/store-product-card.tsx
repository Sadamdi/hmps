import MediaDisplay from '@/components/MediaDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { Link } from 'wouter';
import {
	effectiveProductCurrency,
	formatStoreMoney,
} from '@shared/store-currency';
import { getStoreStockAvailable } from '@shared/store-pricing';

export interface StoreProductCardProps {
	product: any;
	/** Full href ke halaman detail produk (sudah dipadukan dengan basePath/navbarPath). */
	detailHref: string;
	defaultCurrency: string;
	quickAddDisabled?: boolean;
	onQuickAdd?: (productId: string, fromEl: HTMLElement) => void;
	aosDelay?: number;
}

export function StoreProductCard({
	product,
	detailHref,
	defaultCurrency,
	quickAddDisabled = false,
	onQuickAdd,
	aosDelay,
}: StoreProductCardProps) {
	const stockAvail = getStoreStockAvailable(product.stock);
	const outOfStock = stockAvail !== null && stockAvail < 1;
	const categoryName =
		product.categoryId &&
		typeof product.categoryId === 'object' &&
		(product.categoryId as { name?: string }).name
			? (product.categoryId as { name: string }).name
			: null;

	return (
		<Card
			className="h-full overflow-hidden hover:border-primary/40 transition-colors group"
			data-aos="fade-up"
			data-aos-delay={aosDelay}>
			<Link href={detailHref}>
				<div className="aspect-[4/3] bg-muted relative overflow-hidden block">
					<MediaDisplay
						src={product.thumbnail}
						alt={product.name}
						className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
					/>
				</div>
			</Link>
			<CardContent className="p-4">
				<Link href={detailHref}>
					<h3 className="font-semibold line-clamp-2 hover:text-primary">
						{product.name}
					</h3>
				</Link>
				{categoryName && (
					<p className="text-xs text-muted-foreground mt-1">{categoryName}</p>
				)}
				{product.shortDescription && (
					<p className="text-sm text-muted-foreground line-clamp-2 mt-1">
						{product.shortDescription}
					</p>
				)}
				<div className="flex items-center justify-between gap-2 mt-3">
					<p className="text-primary font-bold">
						{formatStoreMoney(
							product.price,
							effectiveProductCurrency(product, defaultCurrency),
						)}
					</p>
					{onQuickAdd && (
						<Button
							type="button"
							size="icon"
							variant="secondary"
							className="shrink-0"
							disabled={outOfStock || quickAddDisabled}
							aria-label="Tambah ke keranjang"
							onClick={(e) => onQuickAdd(String(product._id), e.currentTarget)}>
							<ShoppingCart className="h-4 w-4" />
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export default StoreProductCard;
