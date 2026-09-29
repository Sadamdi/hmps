/**
 * Varian produk toko (seperti marketplace): satu jenis pilihan per produk, mis. "Desain" untuk
 * gantungan kunci atau "Ukuran" untuk kaos. Setiap varian boleh punya foto, harga, stok, serta
 * judul & deskripsi pengganti sendiri (semuanya opsional kecuali nama).
 *
 * Konvensi stok sama dengan produk: -1 / null = tak terbatas.
 */
import type { StorePriceTier } from './store-pricing';

export type StoreVariant = {
	id: string;
	/** Nama pilihan yang tampil di tombol, mis. "GitHub" / "L" */
	label: string;
	/** Foto varian (opsional) — dipakai sebagai foto utama saat varian dipilih */
	thumbnail: string;
	/** Harga varian (opsional). null = pakai harga produk */
	price: number | null;
	/** Stok varian; -1 = tak terbatas */
	stock: number;
	/** Judul pengganti saat varian dipilih (opsional) */
	title: string;
	/** Deskripsi singkat pengganti saat varian dipilih (opsional) */
	description: string;
	active: boolean;
};

export const VARIANT_MAX = 30;

export function normalizeVariantsInput(raw: unknown): StoreVariant[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: StoreVariant[] = [];
	raw.slice(0, VARIANT_MAX).forEach((v, i) => {
		const o = (v || {}) as Record<string, unknown>;
		const label = String(o.label || '').trim().slice(0, 60);
		if (!label) return;
		let id = String(o.id || '').trim().slice(0, 40) || `v${i + 1}`;
		while (seen.has(id)) id = `${id}-${i}`;
		seen.add(id);
		const priceNum = o.price === '' || o.price === null || o.price === undefined ? null : Number(o.price);
		const stockNum = o.stock === '' || o.stock === null || o.stock === undefined ? -1 : Number(o.stock);
		out.push({
			id,
			label,
			thumbnail: String(o.thumbnail || '').trim().slice(0, 1000),
			price: priceNum !== null && Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : null,
			stock: Number.isFinite(stockNum) && stockNum >= 0 ? Math.floor(stockNum) : -1,
			title: String(o.title || '').trim().slice(0, 200),
			description: String(o.description || '').trim().slice(0, 500),
			active: o.active !== false,
		});
	});
	return out;
}

export function productVariants(p: any): StoreVariant[] {
	return normalizeVariantsInput(p?.variants);
}

export function activeVariants(p: any): StoreVariant[] {
	return productVariants(p).filter((v) => v.active);
}

export function hasVariants(p: any): boolean {
	return activeVariants(p).length > 0;
}

export function findVariant(p: any, variantId: unknown): StoreVariant | null {
	const id = String(variantId || '');
	if (!id) return null;
	return activeVariants(p).find((v) => v.id === id) || null;
}

/**
 * Salinan produk "sebagai varian": harga, tier harga, dan stok memakai milik varian, sehingga
 * fungsi harga/stok yang sudah ada bisa dipakai tanpa perubahan. Tier harga ikut bergeser sebesar
 * selisih harga varian terhadap harga produk.
 */
export function productAsVariant<T extends { price?: number; priceTiers?: StorePriceTier[] | null; stock?: unknown }>(
	p: T,
	v: StoreVariant | null,
): T {
	if (!v) return p;
	const base = Number(p.price) || 0;
	const price = v.price ?? base;
	const delta = price - base;
	return {
		...p,
		price,
		priceTiers: Array.isArray(p.priceTiers)
			? p.priceTiers.map((t) => ({ ...t, unitPrice: Math.max(0, Number(t.unitPrice) + delta) }))
			: p.priceTiers,
		stock: v.stock,
	};
}

export function variantLineKey(productId: unknown, variantId: unknown): string {
	const vid = String(variantId || '');
	return vid ? `p:${productId}:v:${vid}` : `p:${productId}`;
}
