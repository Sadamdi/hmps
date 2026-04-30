/** Evaluasi diskon kampanye & override produk toko (zona waktu: Asia/Jakarta) */

import { lineSubtotalForProduct, type StoreProductPricingInput } from './store-pricing';

export type DiscountMode =
	| 'recurring_daily_window'
	| 'scheduled_range'
	| 'one_time_flash'
	| 'always';

export type StoreDiscountType = 'percent' | 'fixed';

export type StoreCampaignLike = {
	_id?: unknown;
	scope: 'global' | 'product';
	productIds?: Array<unknown> | null;
	mode: DiscountMode;
	discountType: StoreDiscountType;
	discountValue: number;
	startAt?: Date | string | null;
	endAt?: Date | string | null;
	dailyStart?: string;
	dailyEnd?: string;
	usageLimit?: number | null;
	usageCount?: number;
	oneTimeCompleted?: boolean;
	priority?: number;
	isActive?: boolean;
};

export type ProductOverrideLike = {
	mode?: DiscountMode;
	discountType: StoreDiscountType;
	discountValue: number;
	startAt?: Date | string | null;
	endAt?: Date | string | null;
	dailyStart?: string;
	dailyEnd?: string;
	usageLimit?: number | null;
	usageCount?: number;
} | null;

function toDate(d: Date | string | null | undefined): Date | null {
	if (d == null) return null;
	if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
	const x = new Date(d);
	return Number.isNaN(x.getTime()) ? null : x;
}

/** Menit sejak 00:00 hari yang sama (Asia/Jakarta) */
function minutesSinceMidnightJakarta(date: Date): number {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Asia/Jakarta',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).formatToParts(date);
	let h = 0;
	let m = 0;
	for (const p of parts) {
		if (p.type === 'hour') h = parseInt(p.value, 10) || 0;
		if (p.type === 'minute') m = parseInt(p.value, 10) || 0;
	}
	return h * 60 + m;
}

function parseHHmm(s: string | undefined | null): number | null {
	const t = String(s || '').trim();
	const m = /^(\d{1,2}):(\d{2})$/.exec(t);
	if (!m) return null;
	const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
	const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
	return h * 60 + min;
}

function isInDailyWindow(
	now: Date,
	dailyStart: string | undefined,
	dailyEnd: string | undefined,
): boolean {
	const a = parseHHmm(dailyStart);
	const b = parseHHmm(dailyEnd);
	if (a == null || b == null) return false;
	const cur = minutesSinceMidnightJakarta(now);
	if (a <= b) return cur >= a && cur <= b;
	// lewat tengah malam
	return cur >= a || cur <= b;
}

export function isCampaignTimeActive(
	c: Pick<
		StoreCampaignLike,
		'mode' | 'startAt' | 'endAt' | 'dailyStart' | 'dailyEnd' | 'oneTimeCompleted' | 'usageLimit' | 'usageCount'
	>,
	now: Date = new Date(),
): boolean {
	if (c.mode === 'one_time_flash' && c.oneTimeCompleted) return false;
	if (c.mode === 'one_time_flash') {
		const lim = c.usageLimit;
		if (lim != null && lim > 0 && (c.usageCount ?? 0) >= lim) return false;
	}
	if (c.mode === 'recurring_daily_window') {
		return isInDailyWindow(now, c.dailyStart, c.dailyEnd);
	}
	if (c.mode === 'scheduled_range' || c.mode === 'one_time_flash') {
		const s = toDate(c.startAt);
		const e = toDate(c.endAt);
		if (s && now < s) return false;
		if (e && now > e) return false;
		return true;
	}
	// 'always' (override produk)
	return true;
}

function productInCampaign(
	c: StoreCampaignLike,
	productId: string | undefined,
): boolean {
	if (c.scope === 'global') return true;
	if (!productId) return false;
	const ids = (c.productIds || []) as Array<{ toString: () => string } | string>;
	return ids.some((id) => String(id) === productId);
}

function applyType(subtotal: number, type: StoreDiscountType, value: number): number {
	if (type === 'percent') {
		const p = Math.min(100, Math.max(0, Number(value) || 0));
		return Math.max(0, Math.round((subtotal * p) / 100));
	}
	return Math.max(0, Math.min(subtotal, Math.floor(Number(value) || 0)));
}

/**
 * Subtotal grosir lalu menerapkan: diskon pre-order (%) dalam jendela, lalu override produk, lalu kampanye terpilih.
 */
function overrideTimeActive(ov: NonNullable<ProductOverrideLike>, now: Date): boolean {
	if (!ov.mode || ov.mode === 'always') return true;
	return isCampaignTimeActive(
		{
			mode: ov.mode as StoreCampaignLike['mode'],
			discountType: ov.discountType,
			discountValue: ov.discountValue,
			startAt: ov.startAt,
			endAt: ov.endAt,
			dailyStart: ov.dailyStart,
			dailyEnd: ov.dailyEnd,
			usageLimit: ov.usageLimit,
			usageCount: ov.usageCount,
			oneTimeCompleted: (ov as { oneTimeCompleted?: boolean }).oneTimeCompleted,
		} as StoreCampaignLike,
		now,
	);
}

export function computeDiscountedSubtotal(
	product: StoreProductPricingInput & {
		_id?: unknown;
		isPreOrder?: boolean;
		preOrderOpenAt?: Date | string | null;
		preOrderCloseAt?: Date | string | null;
		preOrderDiscountPercent?: number;
		discountOverride?: ProductOverrideLike;
		disableGlobalDiscount?: boolean;
	},
	qty: number,
	campaigns: StoreCampaignLike[],
	now: Date = new Date(),
): { lineSubtotal: number; compareSubtotal: number; applied: Array<{ id?: string; label: string; amount: number }> } {
	const q = Math.max(1, Math.floor(Number(qty) || 0));
	let base = lineSubtotalForProduct(product, q);
	const compare = base;
	const applied: Array<{ id?: string; label: string; amount: number }> = [];

	const pid = product._id != null ? String(product._id) : undefined;

	const preWindow =
		product.isPreOrder &&
		isPreOrderInWindow(
			{
				isPreOrder: true,
				preOrderOpenAt: product.preOrderOpenAt,
				preOrderCloseAt: product.preOrderCloseAt,
			},
			now,
		);
	if (preWindow) {
		const p = Math.min(100, Math.max(0, Number(product.preOrderDiscountPercent) || 0));
		if (p > 0) {
			const off = applyType(base, 'percent', p);
			if (off > 0) {
				base -= off;
				applied.push({ label: 'Diskon pre-order', amount: off });
			}
		}
	}

	const ov = product.discountOverride;
	if (ov && overrideTimeActive(ov, now)) {
		const off = applyType(base, ov.discountType, ov.discountValue);
		if (off > 0) {
			base -= off;
			applied.push({ label: 'Diskon produk', amount: off });
		}
	}

	if (!product.disableGlobalDiscount) {
		const list = (campaigns || [])
			.filter((c) => c.isActive !== false)
			.filter((c) => isCampaignTimeActive(c, now))
			.filter((c) => productInCampaign(c, pid))
			.sort(
				(a, b) =>
					Number(b.priority ?? 0) - Number(a.priority ?? 0) ||
					Number(applyType(base, b.discountType, b.discountValue)) -
						Number(applyType(base, a.discountType, a.discountValue)),
			);
		if (list.length) {
			const c = list[0];
			const off = applyType(base, c.discountType, c.discountValue);
			if (off > 0) {
				base -= off;
				const id = c._id != null ? String(c._id) : undefined;
				applied.push({
					id,
					label: `Promo: ${(c as { name?: string }).name || 'Kampanye'}`,
					amount: off,
				});
			}
		}
	}

	return { lineSubtotal: Math.max(0, base), compareSubtotal: compare, applied };
}

/** Harga bundle; kampanye global atau scope produk (productIds memuat id bundle). */
export function computeDiscountedBundleSubtotal(
	bundleId: string,
	bundlePrice: number,
	qty: number,
	campaigns: StoreCampaignLike[],
	now: Date = new Date(),
): { lineSubtotal: number; compareSubtotal: number; applied: Array<{ id?: string; label: string; amount: number }> } {
	const q = Math.max(1, Math.floor(Number(qty) || 0));
	let base = lineSubtotalForBundle(bundlePrice, q);
	const compare = base;
	const applied: Array<{ id?: string; label: string; amount: number }> = [];
	const list = (campaigns || [])
		.filter((c) => c.isActive !== false)
		.filter((c) => isCampaignTimeActive(c, now))
		.filter((c) => productInCampaign(c, bundleId))
		.sort(
			(a, b) =>
				Number(b.priority ?? 0) - Number(a.priority ?? 0) ||
				Number(applyType(base, b.discountType, b.discountValue)) -
					Number(applyType(base, a.discountType, a.discountValue)),
		);
	if (list.length) {
		const c = list[0];
		const off = applyType(base, c.discountType, c.discountValue);
		if (off > 0) {
			base -= off;
			const id = c._id != null ? String(c._id) : undefined;
			applied.push({
				id,
				label: `Promo: ${(c as { name?: string }).name || 'Kampanye'}`,
				amount: off,
			});
		}
	}
	return { lineSubtotal: Math.max(0, base), compareSubtotal: compare, applied };
}

export function isPreOrderInWindow(
	product: {
		isPreOrder?: boolean;
		preOrderOpenAt?: Date | string | null;
		preOrderCloseAt?: Date | string | null;
	},
	now: Date = new Date(),
): boolean {
	if (!product.isPreOrder) return false;
	const op = toDate(product.preOrderOpenAt);
	const cl = toDate(product.preOrderCloseAt);
	if (op && now < op) return false;
	if (cl && now > cl) return false;
	return true;
}

export function isPreOrderOrderable(
	product: {
		isPreOrder?: boolean;
		preOrderOpenAt?: Date | string | null;
		preOrderCloseAt?: Date | string | null;
		preOrderAllowAfterClose?: boolean;
		published?: boolean;
	},
	now: Date = new Date(),
): boolean {
	if (product.published === false) return false;
	if (!product.isPreOrder) return true;
	if (isPreOrderInWindow(product, now)) return true;
	if (product.preOrderAllowAfterClose) return true;
	return false;
}

/** Untuk stok: pre-order + window → tidak kurangi stok fisis (logika di route) */
export function shouldSkipStockDecrementForPreOrder(
	product: { isPreOrder?: boolean; preOrderOpenAt?: Date | string | null; preOrderCloseAt?: Date | string | null },
	now: Date = new Date(),
): boolean {
	return !!product.isPreOrder && isPreOrderInWindow(product, now);
}

export function lineSubtotalForBundle(bundlePrice: number, qty: number): number {
	const q = Math.max(1, Math.floor(Number(qty) || 0));
	const p = Math.max(0, Number(bundlePrice) || 0);
	return p * q;
}
