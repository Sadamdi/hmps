import { useState } from 'react';
import { Loader2, Package, ShoppingCart, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatStoreMoney } from '@shared/store-currency';
import { StoreFavoriteButton } from '@/components/toko/store-favorite-button';
import { StoreStatsLine } from '@/components/toko/store-stats-line';
import { postView } from '@/lib/store-stats';
import { useApiUrl } from '@/lib/tenant-context';

export interface BundleChoice {
	id: string;
	label: string;
	available: boolean;
	priceDiff: number;
	thumbnail: string;
}

export interface BundleComponent {
	itemIndex?: number;
	productId: string;
	slug: string;
	name: string;
	variantLabel: string;
	qty: number;
	unitPrice: number;
	thumbnail: string;
	/** true = pembeli memilih varian ("semua ukuran") */
	choose?: boolean;
	groupName?: string;
	choices?: BundleChoice[];
}

export interface BundleSelectionInput {
	itemIndex: number;
	variantId: string;
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
	needsChoice?: boolean;
	addVariantPriceDiff?: boolean;
}

/** "2× Topi, 2× Hoodie (Ukuran M)" — ringkasan isi paket untuk kartu. */
export function bundleContentsText(components: BundleComponent[] = []): string {
	return components
		.map((c) => `${c.qty}× ${c.name}${c.choose ? ` (pilih ${(c.groupName || 'varian').toLowerCase()})` : c.variantLabel ? ` (${c.variantLabel})` : ''}`)
		.join(', ');
}

/** Thumbnail ringan: <img> biasa (MediaDisplay punya tinggi minimum & lightbox sehingga merusak ukuran kartu/dialog). */
function thumbSrc(src: string): string {
	const m = src.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]+)/i);
	return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w600` : src;
}

function Thumb({ src, alt, className }: { src?: string; alt: string; className: string }) {
	const [failed, setFailed] = useState(false);
	return src && !failed ? (
		<img src={thumbSrc(src)} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`${className} block bg-muted object-cover`} />
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
	onAdd: (el: HTMLElement, selections: BundleSelectionInput[], done?: () => void) => void;
	compact?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const viewBase = useApiUrl('/x').slice(0, -2);
	// pilihan varian untuk isi paket bermode "pilih" (itemIndex → variantId)
	const [picked, setPicked] = useState<Record<number, string>>({});
	const comps = bundle.components || [];
	const normal = Number(bundle.normalTotal) || 0;
	const hemat = Math.max(0, normal - price);
	const soldOut = bundle.available === false;
	const chooseItems = comps.filter((c) => c.choose);
	const allPicked = chooseItems.every((c) => picked[c.itemIndex ?? -1]);
	const selections: BundleSelectionInput[] = chooseItems.map((c) => ({ itemIndex: c.itemIndex ?? 0, variantId: picked[c.itemIndex ?? -1] || '' }));
	// selisih harga varian terpilih (bila paket menambah selisih)
	const extra = chooseItems.reduce((sum, c) => sum + (c.choices?.find((x) => x.id === picked[c.itemIndex ?? -1])?.priceDiff || 0), 0);
	const shownPrice = price + extra;
	const startsFrom = bundle.addVariantPriceDiff && chooseItems.length > 0 && extra === 0;
	// tombol cepat di kartu: bila perlu memilih, buka rincian dulu
	const quickAdd = (el: HTMLElement) => (bundle.needsChoice ? setOpen(true) : onAdd(el, []));
		const addFromDialog = (el: HTMLElement) => onAdd(el, selections, () => { setOpen(false); setPicked({}); });
	return (
		<>
			<Card className="overflow-hidden relative">
				<StoreFavoriteButton productId={String(bundle._id)} kind="bundle" className="absolute right-3 top-3 z-10" />
				<button type="button" className="block w-full text-left" onClick={() => setOpen(true)} aria-label={`Lihat isi ${bundle.name}`}>
					<Thumb src={bundle.thumbnail} alt={bundle.name} className={`w-full ${compact ? 'aspect-[3/2]' : 'aspect-[16/9]'}`} />
				</button>
				<CardContent className="p-4 space-y-2">
					<p className="font-semibold line-clamp-2">{bundle.name}</p>
					<StoreStatsLine favorites={(bundle as any).favoriteCount} views={(bundle as any).viewCount} />
					{comps.length > 0 && <p className="text-xs text-muted-foreground line-clamp-2">Isi: {bundleContentsText(comps)}</p>}
					{!compact && bundle.shortDescription && <p className="text-sm text-muted-foreground line-clamp-2">{bundle.shortDescription}</p>}
					<div className="flex items-end justify-between gap-2 pt-1">
						<div>
							{Math.max(normal, compareAt || 0) > price && (
								<p className="text-xs text-muted-foreground line-through">{formatStoreMoney(Math.max(normal, compareAt || 0), currency)}</p>
							)}
							<p className="text-primary font-bold">
								{startsFrom ? 'Mulai ' : ''}
								{formatStoreMoney(price, currency)}
							</p>
							{hemat > 0 && (
								<p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
									<Tag className="h-3 w-3" /> Hemat {formatStoreMoney(hemat, currency)}
								</p>
							)}
						</div>
						<div className="flex gap-1.5 shrink-0">
							<Button type="button" size="sm" variant="ghost" onClick={() => { postView(viewBase, 'bundle', String(bundle._id)); setOpen(true); }}>
								Lihat isi
							</Button>
							<Button type="button" size="icon" variant="secondary" disabled={adding || soldOut} aria-label="Tambah paket ke keranjang" onClick={(e) => quickAdd(e.currentTarget)}>
								{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
							</Button>
						</div>
					</div>
					{soldOut && <p className="text-xs text-destructive">Stok isi paket habis</p>}
				</CardContent>
			</Card>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
					<DialogHeader>
						<DialogTitle className="pr-6 text-left break-words">{bundle.name}</DialogTitle>
						{bundle.shortDescription && <DialogDescription>{bundle.shortDescription}</DialogDescription>}
					</DialogHeader>
					<Thumb src={bundle.thumbnail} alt={bundle.name} className="w-full aspect-[16/9] rounded-md object-cover" />
					<div className="space-y-2">
						<p className="text-sm font-medium">Kamu mendapat:</p>
						<ul className="space-y-2">
							{comps.map((c, i) => (
								<li key={`${c.productId}-${i}`} className="flex items-start gap-3 rounded-md border p-2">
									<Thumb src={c.thumbnail} alt={c.name} className="h-12 w-12 shrink-0 rounded" />
									<div className="min-w-0 flex-1 text-sm">
										<p className="font-medium break-words">
											{c.qty}× {c.name}
										</p>
										{c.variantLabel && <p className="text-xs text-muted-foreground">{c.variantLabel}</p>}
										{c.choose && (
											<div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Pilih ${c.groupName || 'varian'} ${c.name}`}>
												{(c.choices || []).map((ch) => {
													const on = picked[c.itemIndex ?? -1] === ch.id;
													return (
														<button
															key={ch.id}
															type="button"
															role="radio"
															aria-checked={on}
															disabled={!ch.available}
															onClick={() => setPicked((p) => ({ ...p, [c.itemIndex ?? -1]: ch.id }))}
															className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${on ? 'border-primary bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'} ${ch.available ? '' : 'opacity-40 line-through'}`}>
															{ch.label}
															{ch.priceDiff > 0 ? ` +${formatStoreMoney(ch.priceDiff, currency)}` : ''}
														</button>
													);
												})}
											</div>
										)}
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
								<span className="text-primary">{formatStoreMoney(shownPrice, currency)}</span>
							</div>
							{hemat > 0 && (
								<div className="flex justify-between text-emerald-600 dark:text-emerald-400">
									<span>Kamu hemat</span>
									<span>{formatStoreMoney(hemat, currency)}</span>
								</div>
							)}
						</div>
					</div>
					{chooseItems.length > 0 && !allPicked && !soldOut && (
						<p className="text-xs text-amber-600 dark:text-amber-400">Pilih {chooseItems.map((c) => (c.groupName || 'varian').toLowerCase()).join(' & ')} dulu untuk menambah paket.</p>
					)}
					<Button className="w-full" disabled={adding || soldOut || !allPicked} onClick={(e) => addFromDialog(e.currentTarget)}>
						<ShoppingCart className="h-4 w-4 mr-2" /> {soldOut ? 'Stok habis' : 'Tambah paket ke keranjang'}
					</Button>
				</DialogContent>
			</Dialog>
		</>
	);
}
