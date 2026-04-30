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
import { Badge } from '@/components/ui/badge';

export interface StoreProductCardProps {
	product: any;
	/** Full href ke halaman detail produk (sudah dipadukan dengan basePath/navbarPath). */
	detailHref: string;
	defaultCurrency: string;
	/** Jika diset, menggantikan tampilan harga dari harga katalog (mis. setelah hitung diskon) */
	displayAmount?: number;
	/** Harga perbandingan (coret) bila &gt; displayAmount */
	compareAtAmount?: number;
	promoLabels?: string[];
	quickAddDisabled?: boolean;
	onQuickAdd?: (productId: string, fromEl: HTMLElement) => void;
	aosDelay?: number;
}

export function StoreProductCard({
	product,
	detailHref,
	defaultCurrency,
	displayAmount,
	compareAtAmount,
	promoLabels = [],
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

	const showPromo = typeof compareAtAmount === 'number' && typeof displayAmount === 'number' && compareAtAmount > displayAmount;
	const priceMain =
		typeof displayAmount === 'number'
			? displayAmount
			: Number(product.price) || 0;
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
				<div className="flex items-start justify-between gap-2">
					<Link href={detailHref} className="min-w-0 flex-1">
						<h3 className="font-semibold line-clamp-2 hover:text-primary">
							{product.name}
						</h3>
					</Link>
					{product.isPreOrder ? (
						<Badge variant="secondary" className="text-[10px] shrink-0">
							Pre-order
						</Badge>
					) : null}
				</div>
				{categoryName && (
					<p className="text-xs text-muted-foreground mt-1">{categoryName}</p>
				)}
				{product.shortDescription && (
					<p className="text-sm text-muted-foreground line-clamp-2 mt-1">
						{product.shortDescription}
					</p>
				)}
				{promoLabels.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-1">
						{promoLabels.slice(0, 2).map((l) => (
							<Badge key={l} variant="outline" className="text-[10px] font-normal line-clamp-1 max-w-full">
								{l}
							</Badge>
						))}
					</div>
				)}
				<div className="flex items-center justify-between gap-2 mt-3">
					<div className="min-w-0">
						<div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
							{showPromo && (
								<p className="text-sm text-muted-foreground line-through tabular-nums">
									{formatStoreMoney(compareAtAmount, effectiveProductCurrency(product, defaultCurrency))}
								</p>
							)}
							<p className="text-primary font-bold tabular-nums">
								{formatStoreMoney(priceMain, effectiveProductCurrency(product, defaultCurrency))}
							</p>
						</div>
					</div>
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
