import MediaDisplay from '@/components/MediaDisplay';
import { formatStoreMoney } from '@shared/store-currency';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChatProductCardData = {
	productId: string;
	name: string;
	slug: string;
	thumbnail: string;
	price: number;
	currency: string;
};

interface StoreChatProductCardProps {
	product: ChatProductCardData;
	/** Href lengkap ke halaman produk */
	href: string;
	caption?: string;
	className?: string;
}

/** Kartu produk di chat (seperti "Anda menanyakan produk ini" di marketplace). */
export function StoreChatProductCard({ product, href, caption, className }: StoreChatProductCardProps) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={cn(
				'flex w-full max-w-xs items-center gap-3 rounded-lg border border-border bg-card p-2 text-left text-card-foreground transition-colors hover:border-primary/50',
				className,
			)}>
			<div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
				{product.thumbnail ? (
					<MediaDisplay src={product.thumbnail} alt={product.name} className="h-full w-full object-cover" />
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground">
						<Package className="h-5 w-5" />
					</div>
				)}
			</div>
			<div className="min-w-0 flex-1">
				{caption && <p className="text-[11px] text-muted-foreground">{caption}</p>}
				<p className="line-clamp-2 text-sm font-medium">{product.name}</p>
				<p className="text-sm font-semibold text-primary">
					{formatStoreMoney(Number(product.price) || 0, product.currency || 'IDR')}
				</p>
			</div>
		</a>
	);
}
