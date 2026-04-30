import {
	capQtyByStock,
	getStoreStockAvailable,
	isStoreStockUnlimited,
} from '../../shared/store-pricing';
import {
	computeDiscountedSubtotal,
	computeDiscountedBundleSubtotal,
	isPreOrderInWindow,
	isPreOrderOrderable,
	shouldSkipStockDecrementForPreOrder,
	type StoreCampaignLike,
} from '../../shared/store-discounts';
import { fetchShippingCost, findCourier, type ShippingCourierOption } from '../services/shipping-api-co-id';

export type CartLineInput =
	| { lineKind: 'product'; productId: string; qty: number; lineKey?: string }
	| { lineKind: 'bundle'; bundleId: string; qty: number; lineKey?: string };

export function ensureCartLineKey(row: {
	lineKey?: string;
	lineKind?: string;
	productId?: unknown;
	bundleId?: unknown;
}): string {
	if (row.lineKey) return String(row.lineKey);
	if (row.lineKind === 'bundle' && row.bundleId) return `b:${row.bundleId}`;
	if (row.productId) return `p:${row.productId}`;
	return '';
}

export function parseCartLinesFromBody(
	items: unknown,
): { ok: true; lines: CartLineInput[] } | { ok: false; message: string } {
	if (!Array.isArray(items) || !items.length) return { ok: false, message: 'Item kosong' };
	const lines: CartLineInput[] = [];
	for (const raw of items) {
		if (!raw || typeof raw !== 'object') continue;
		const o = raw as Record<string, unknown>;
		const qty = Math.max(1, parseInt(String(o.qty ?? 1), 10) || 1);
		if (o.lineKind === 'bundle' || o.bundleId) {
			const id = String(o.bundleId || '').trim();
			if (!id) return { ok: false, message: 'bundleId wajib' };
			lines.push({ lineKind: 'bundle', bundleId: id, qty, lineKey: o.lineKey ? String(o.lineKey) : undefined });
		} else {
			const id = String(o.productId || '').trim();
			if (!id) return { ok: false, message: 'productId wajib' };
			lines.push({ lineKind: 'product', productId: id, qty, lineKey: o.lineKey ? String(o.lineKey) : undefined });
		}
	}
	if (!lines.length) return { ok: false, message: 'Tidak ada item valid' };
	return { ok: true, lines };
}

function productWeightG(p: { shippingWeightGrams?: number | null }, defaultGrams: number): number {
	const w = p.shippingWeightGrams;
	if (w != null && Number.isFinite(Number(w)) && Number(w) > 0) return Math.floor(Number(w));
	return Math.max(1, defaultGrams);
}

export async function totalShippingWeightGrams(
	lines: CartLineInput[],
	ctx: {
		StoreProduct: any;
		StoreBundle: any;
		defaultWeightGrams: number;
	},
): Promise<number> {
	let g = 0;
	for (const line of lines) {
		if (line.lineKind === 'product') {
			const p = await ctx.StoreProduct.findById(line.productId).lean();
			if (!p) continue;
			if (p.isFreeShipping) continue;
			const w = productWeightG(p, ctx.defaultWeightGrams);
			g += w * line.qty;
		} else {
			const b = await ctx.StoreBundle.findById(line.bundleId).lean();
			if (!b || !b.isActive) continue;
			if (b.isFreeShipping) continue;
			if (b.weightGramsOverride != null && Number(b.weightGramsOverride) > 0) {
				g += Math.floor(Number(b.weightGramsOverride)) * line.qty;
				continue;
			}
			let acc = 0;
			for (const it of b.items || []) {
				const p = await ctx.StoreProduct.findById(it.productId).lean();
				if (!p) continue;
				if (p.isFreeShipping) continue;
				acc += productWeightG(p, ctx.defaultWeightGrams) * (it.qty || 1);
			}
			g += acc * line.qty;
		}
	}
	return Math.max(0, g);
}

/**
 * Jika hanya satu asal (override) di seluruh baris, pakai itu; jika bercampur → pakai global.
 */
export function resolveOriginVillageForLines(
	lines: CartLineInput[],
	productById: Map<string, { originVillageCodeOverride?: string; isFreeShipping?: boolean }>,
	bundleById: Map<string, { isFreeShipping?: boolean; items: { productId: { toString: () => string } }[] }>,
	globalOrigin: string,
): string {
	const set = new Set<string>();
	for (const line of lines) {
		if (line.lineKind === 'product') {
			const p = productById.get(String(line.productId));
			if (p?.isFreeShipping) continue;
			const o = String(p?.originVillageCodeOverride || '').trim();
			if (o) set.add(o);
		} else {
			const b = bundleById.get(String(line.bundleId));
			if (b?.isFreeShipping) continue;
			if (!b?.items) continue;
			for (const it of b.items) {
				const p = productById.get(String(it.productId));
				if (p?.isFreeShipping) continue;
				const o = String(p?.originVillageCodeOverride || '').trim();
				if (o) set.add(o);
			}
		}
	}
	const fromSet = Array.from(set);
	if (fromSet.length === 1) return fromSet[0]!;
	return String(globalOrigin || '').trim();
}

export async function resolveShippingForCheckout(params: {
	fulfillment: 'pickup' | 'delivery';
	shippingSettings: { enabled: boolean; globalOriginVillageCode: string; defaultWeightGrams: number; defaultCouriers: string[] };
	destinationVillageCode: string;
	weightGrams: number;
	/** override origin (hasil resolveOriginVillageForLines) */
	originVillageCode?: string;
	selectedCourierCode: string;
}): Promise<
	| { ok: true; cost: number; etd: string; courier: ShippingCourierOption }
	| { ok: false; message: string }
> {
	if (params.fulfillment === 'pickup') {
		return { ok: true, cost: 0, etd: '', courier: { courierCode: '', courierName: 'Ambil', price: 0, etd: '', weight: 0 } };
	}
	/** Hanya ongkis berat 0 = gratis */
	if (Number(params.weightGrams) <= 0) {
		return { ok: true, cost: 0, etd: '', courier: { courierCode: '', courierName: 'Gratis', price: 0, etd: '', weight: 0 } };
	}
	if (!params.shippingSettings?.enabled) {
		return { ok: true, cost: 0, etd: '', courier: { courierCode: '', courierName: '—', price: 0, etd: '', weight: 0 } };
	}
	const origin = String(
		(params.originVillageCode && params.originVillageCode.trim()) || params.shippingSettings.globalOriginVillageCode || '',
	).trim();
	const dest = String(params.destinationVillageCode || '').trim();
	if (!/^\d{10}$/.test(origin) || !/^\d{10}$/.test(dest)) {
		return { ok: false, message: 'Kode kelurahan asal/tujuan 10 digit wajib untuk pengiriman' };
	}
	const key = (process.env.ONGKIR_API || '').trim();
	if (!key) {
		return { ok: false, message: 'Ongkir belum diatur (ONGKIR_API)' };
	}
	const { couriers, raw } = await fetchShippingCost({
		originVillageCode: origin,
		destinationVillageCode: dest,
		weightGrams: params.weightGrams,
	});
	if (!couriers.length) {
		return {
			ok: false,
			message: (raw as { message?: string })?.message || 'Gagal mengambil ongkir. Periksa alamat/berat.',
		};
	}
	let list = couriers;
	const def = (params.shippingSettings.defaultCouriers || []).map((c) => String(c).toLowerCase()).filter(Boolean);
	if (def.length) {
		const filtered = list.filter((c) => def.includes(c.courierCode.toLowerCase()));
		if (filtered.length) list = filtered;
	}
	const pick = findCourier(list, params.selectedCourierCode) || list[0]!;
	return {
		ok: true,
		cost: pick.price,
		etd: pick.etd,
		courier: pick,
	};
}

export {
	capQtyByStock,
	getStoreStockAvailable,
	isStoreStockUnlimited,
	computeDiscountedSubtotal,
	computeDiscountedBundleSubtotal,
	isPreOrderInWindow,
	isPreOrderOrderable,
	shouldSkipStockDecrementForPreOrder,
	type StoreCampaignLike,
};
