import { useState } from 'react';
import { Loader2, Package, ShoppingCart, Tag } from 'lucide-react';
import MediaDisplay from '@/components/MediaDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatStoreMoney } from '@shared/store-currency';

export interface BundleComponent {
	productId: string;
	slug: string;
	name: string;
	variantLabel: string;
	qty: number;
	unitPrice: number;
	thumbnail: string;
}

export interface PublicBundle {
	_id: string;
	slug: string;
	name: string;
	shortDescription?: string;
	bundlePrice: number;
	thumbnail?: string;
	components?: BundleComponent[];
	normalTotal?: number;
	saving?: number;
	available?: boolean;
}

/** "2× Topi, 2× Hoodie (Ukuran M)" — ringkasan isi paket untuk kartu. */
export function bundleContentsText(components: BundleComponent[] = []): string {
	return components.map((c) => `${c.qty}× ${c.name}${c.variantLabel ? ` (${c.variantLabel})` : ''}`).join(', ');
}

function Thumb({ src, alt, className }: { src?: string; alt: string; className: string }) {
	return src ? (
		<MediaDisplay src={src} alt={alt} className={className} />
	) : (
		<div className={`${className} grid place-items-center bg-muted text-muted-foreground`}>
			<Package className="h-6 w-6 opacity-50" />
		</div>
	);
}

/**
 * Kartu bundling: gambar, isi paket, harga (coret harga normal + hemat), dan dialog rincian.
 * Dipakai di katalog dan di halaman detail produk ("Tersedia dalam paket").
 */
export function StoreBundleCard({
	bundle,
	price,
	compareAt,
	currency,
	adding,
	onAdd,
	compact = false,
}: {
	bundle: PublicBundle;
	/** Harga paket final (setelah kampanye diskon) */
	price: number;
	/** Harga coret (dari kampanye) bila ada */
	compareAt?: number;
	currency: string;
	adding: boolean;
	onAdd: (el: HTMLElement) => void;
	compact?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const comps = bundle.components || [];
	const normal = Number(bundle.normalTotal) || 0;
	const hemat = Math.max(0, normal - price);
	const soldOut = bundle.available === false;
	return (
		<>
			<Card className="overflow-hidden">
				<button type="button" className="block w-full text-left" onClick={() => setOpen(true)} aria-label={`Lihat isi ${bundle.name}`}>
					<Thumb src={bundle.thumbnail} alt={bundle.name} className={`w-full object-cover ${compact ? 'aspect-[3/2]' : 'aspect-[16/9]'}`} />
				</button>
				<CardContent className="p-4 space-y-2">
					<p className="font-semibold line-clamp-2">{bundle.name}</p>
					{comps.length > 0 && <p className="text-xs text-muted-foreground line-clamp-2">Isi: {bundleContentsText(comps)}</p>}
					{!compact && bundle.shortDescription && <p className="text-sm text-muted-foreground line-clamp-2">{bundle.shortDescription}</p>}
					<div className="flex items-end justify-between gap-2 pt-1">
						<div>
							{Math.max(normal, compareAt || 0) > price && (
								<p className="text-xs text-muted-foreground line-through">{formatStoreMoney(Math.max(normal, compareAt || 0), currency)}</p>
							)}
							<p className="text-primary font-bold">{formatStoreMoney(price, currency)}</p>
							{hemat > 0 && (
								<p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
									<Tag className="h-3 w-3" /> Hemat {formatStoreMoney(hemat, currency)}
								</p>
							)}
						</div>
						<div className="flex gap-1.5 shrink-0">
							<Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
								Lihat isi
							</Button>
							<Button type="button" size="icon" variant="secondary" disabled={adding || soldOut} aria-label="Tambah paket ke keranjang" onClick={(e) => onAdd(e.currentTarget)}>
								{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
							</Button>
						</div>
					</div>
					{soldOut && <p className="text-xs text-destructive">Stok isi paket habis</p>}
				</CardContent>
			</Card>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{bundle.name}</DialogTitle>
						{bundle.shortDescription && <DialogDescription>{bundle.shortDescription}</DialogDescription>}
					</DialogHeader>
					<Thumb src={bundle.thumbnail} alt={bundle.name} className="w-full aspect-[16/9] rounded-md object-cover" />
					<div className="space-y-2">
						<p className="text-sm font-medium">Kamu mendapat:</p>
						<ul className="space-y-2">
							{comps.map((c, i) => (
								<li key={`${c.productId}-${i}`} className="flex items-center gap-3 rounded-md border p-2">
									<Thumb src={c.thumbnail} alt={c.name} className="h-12 w-12 shrink-0 rounded object-cover" />
									<div className="min-w-0 flex-1 text-sm">
										<p className="font-medium truncate">
											{c.qty}× {c.name}
										</p>
										{c.variantLabel && <p className="text-xs text-muted-foreground">{c.variantLabel}</p>}
									</div>
									<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatStoreMoney(c.unitPrice * c.qty, currency)}</span>
								</li>
							))}
						</ul>
						<div className="rounded-md bg-muted/40 p-3 text-sm space-y-1 tabular-nums">
							{normal > 0 && (
								<div className="flex justify-between text-muted-foreground">
									<span>Kalau beli satuan</span>
									<span className="line-through">{formatStoreMoney(normal, currency)}</span>
								</div>
							)}
							<div className="flex justify-between font-semibold">
								<span>Harga paket</span>
								<span className="text-primary">{formatStoreMoney(price, currency)}</span>
							</div>
							{hemat > 0 && (
								<div className="flex justify-between text-emerald-600 dark:text-emerald-400">
									<span>Kamu hemat</span>
									<span>{formatStoreMoney(hemat, currency)}</span>
								</div>
							)}
						</div>
					</div>
					<Button className="w-full" disabled={adding || soldOut} onClick={(e) => onAdd(e.currentTarget)}>
						<ShoppingCart className="h-4 w-4 mr-2" /> {soldOut ? 'Stok habis' : 'Tambah paket ke keranjang'}
					</Button>
				</DialogContent>
			</Dialog>
		</>
	);
}
