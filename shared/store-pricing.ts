/** Harga bertingkat & stok toko — dipakai server + client */

export type StorePriceTier = { minQty: number; unitPrice: number; applyMultiples?: boolean };

export type StoreProductPricingInput = {
	price: number;
	priceTiers?: StorePriceTier[] | null;
	/** @deprecated fallback bila tier tidak punya applyMultiples (data lama) */
	priceTierMultiples?: boolean | null;
};

type NormalizedTier = { minQty: number; unitPrice: number; applyMultiples: boolean };

function basePrice(product: StoreProductPricingInput): number {
	const base = Number(product?.price);
	return Number.isFinite(base) && base >= 0 ? base : 0;
}

function normalizedTiers(product: StoreProductPricingInput): NormalizedTier[] {
	const legacy = !!product.priceTierMultiples;
	return (product.priceTiers || [])
		.map((t) => {
			const minQty = Math.max(2, Math.floor(Number(t.minQty) || 0));
			const unitPrice = Number(t.unitPrice);
			const raw = t.applyMultiples;
			const applyMultiples =
				typeof raw === 'boolean' ? raw : legacy;
			return { minQty, unitPrice, applyMultiples };
		})
		.filter((t) => Number.isFinite(t.unitPrice) && t.unitPrice >= 0 && t.minQty >= 2)
		.sort((a, b) => a.minQty - b.minQty);
}

/** Tier dengan minQty terbesar yang masih ≤ qty (sama seperti logika diskon sebelumnya). */
function pickApplicableTier(tiers: NormalizedTier[], q: number): NormalizedTier | null {
	let best: NormalizedTier | null = null;
	for (const t of tiers) {
		if (q >= t.minQty) {
			if (!best || t.minQty > best.minQty) best = t;
		}
	}
	return best;
}

/**
 * Subtotal baris untuk qty: harga dasar + aturan grosir (kelipatan atau blok pertama saja).
 */
export function lineSubtotalForProduct(product: StoreProductPricingInput, qty: number): number {
	const q = Math.max(1, Math.floor(Number(qty) || 0));
	const b = basePrice(product);
	const tiers = normalizedTiers(product);
	const t = pickApplicableTier(tiers, q);
	if (!t) return q * b;
	const m = t.minQty;
	const u = t.unitPrice;
	if (t.applyMultiples) {
		const full = Math.floor(q / m) * m;
		const rem = q % m;
		return full * u + rem * b;
	}
	return m * u + (q - m) * b;
}

/**
 * Harga satuan efektif (rata-rata) untuk tampilan: subtotal / qty.
 */
export function computeUnitPriceForQty(product: StoreProductPricingInput, qty: number): number {
	const q = Math.max(1, Math.floor(Number(qty) || 0));
	const sub = lineSubtotalForProduct(product, q);
	return sub / q;
}

/** Stok < 0 atau null/undefined = tidak dibatasi (tidak dikurangi saat checkout). */
export function isStoreStockUnlimited(stock: unknown): boolean {
	if (stock === undefined || stock === null) return true;
	const n = Number(stock);
	return !Number.isFinite(n) || n < 0;
}

/** Jumlah stok yang bisa dijual (null = tak terbatas). */
export function getStoreStockAvailable(stock: unknown): number | null {
	if (isStoreStockUnlimited(stock)) return null;
	return Math.max(0, Math.floor(Number(stock)));
}

/** Batasi qty ke stok tersedia (jika ada). */
export function capQtyByStock(stock: unknown, qty: number): number {
	const q = Math.max(0, Math.floor(Number(qty) || 0));
	const avail = getStoreStockAvailable(stock);
	if (avail === null) return q;
	return Math.min(q, avail);
}

/** Normalisasi tier dari API/dashboard: minQty ≥ 2, unik per minQty, simpan applyMultiples per baris. */
export function normalizePriceTiersInput(raw: unknown, max = 12): StorePriceTier[] {
	if (!Array.isArray(raw)) return [];
	const byMin = new Map<number, StorePriceTier>();
	for (const row of raw) {
		if (!row || typeof row !== 'object') continue;
		const o = row as Record<string, unknown>;
		const minQty = Math.floor(Number(o.minQty));
		const unitPrice = Number(o.unitPrice);
		if (!Number.isFinite(minQty) || minQty < 2) continue;
		if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
		const applyMultiples =
			o.applyMultiples === true ||
			o.applyMultiples === 'true' ||
			String(o.applyMultiples) === '1';
		byMin.set(minQty, { minQty, unitPrice, applyMultiples: !!applyMultiples });
		if (byMin.size >= max) break;
	}
	return [...byMin.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([, t]) => t);
}
