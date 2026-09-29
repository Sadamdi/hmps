/**
 * Pembayaran toko: kanal bayar (QRIS / rekening / e-wallet), DP pre-order, status pembayaran.
 * Dipakai server (validasi & hitung nominal — sumber kebenaran) dan client (tampilan).
 */
import { findPaymentProvider } from './store-payment-providers';

export type PaymentChannelType = 'qris' | 'bank' | 'ewallet';

export interface StorePaymentChannel {
	id: string;
	type: PaymentChannelType;
	active: boolean;
	/** QRIS: gambar + nama merchant (wajib) */
	qrisImageUrl: string;
	merchantName: string;
	/** Bank / e-wallet: id dari daftar provider atau kosong bila "Lainnya" */
	providerId: string;
	providerName: string;
	accountNumber: string;
	accountHolder: string;
	note: string;
}

export type StoreDpMode = 'percent' | 'amount';
export interface StoreDpSettings {
	enabled: boolean;
	mode: StoreDpMode;
	percent: number;
	/** Nominal minimal DP per item (mode percent) atau nominal tetap per unit (mode amount) */
	amount: number;
	cancelPolicyText: string;
}

export type ProductDpMode = 'default' | 'percent' | 'amount' | 'full';
export type ProductChannelMode = 'global' | 'custom';

export const DEFAULT_CANCEL_POLICY =
	'Pesanan yang sudah dibayar (termasuk DP) tidak bisa dibatalkan sendiri. Untuk pembatalan atau pengembalian dana, hubungi admin toko.';

export const DEFAULT_DP_SETTINGS: StoreDpSettings = {
	enabled: false,
	mode: 'percent',
	percent: 30,
	amount: 0,
	cancelPolicyText: DEFAULT_CANCEL_POLICY,
};

const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const num = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => {
	const n = Number(v);
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

export function newChannelId(): string {
	return `ch_${Math.random().toString(36).slice(2, 10)}`;
}

/** Nama tampilan kanal: "QRIS · Nama Merchant", "BCA · 123… a.n. X", "DANA · 08…". */
export function channelTitle(c: Pick<StorePaymentChannel, 'type' | 'merchantName' | 'providerName'>): string {
	if (c.type === 'qris') return `QRIS${c.merchantName ? ` · ${c.merchantName}` : ''}`;
	return c.providerName || (c.type === 'bank' ? 'Transfer bank' : 'E-wallet');
}

/** Normalisasi + validasi daftar kanal dari body admin. Mengembalikan error pertama bila tidak valid. */
export function normalizePaymentChannelsInput(
	raw: unknown,
	max = 20,
): { ok: true; channels: StorePaymentChannel[] } | { ok: false; message: string } {
	if (!Array.isArray(raw)) return { ok: true, channels: [] };
	const out: StorePaymentChannel[] = [];
	const seen = new Set<string>();
	for (const r of raw.slice(0, max) as any[]) {
		const type: PaymentChannelType = r?.type === 'bank' || r?.type === 'ewallet' ? r.type : 'qris';
		let id = str(r?.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || newChannelId();
		if (seen.has(id)) id = newChannelId();
		seen.add(id);
		const provider = findPaymentProvider(r?.providerId);
		const c: StorePaymentChannel = {
			id,
			type,
			active: r?.active !== false,
			qrisImageUrl: type === 'qris' ? str(r?.qrisImageUrl, 500) : '',
			merchantName: type === 'qris' ? str(r?.merchantName, 120) : '',
			providerId: type === 'qris' ? '' : provider && provider.type === type ? provider.id : '',
			providerName: type === 'qris' ? '' : provider && provider.type === type ? provider.name : str(r?.providerName, 80),
			accountNumber: type === 'qris' ? '' : str(r?.accountNumber, 40).replace(/[^\d\s.-]/g, ''),
			accountHolder: type === 'qris' ? '' : str(r?.accountHolder, 120),
			note: str(r?.note, 300),
		};
		const n = out.length + 1;
		if (type === 'qris') {
			if (!c.qrisImageUrl) return { ok: false, message: `Kanal #${n}: gambar QRIS wajib diupload` };
			if (!c.merchantName) return { ok: false, message: `Kanal #${n}: nama merchant QRIS wajib diisi` };
		} else {
			if (!c.providerName) return { ok: false, message: `Kanal #${n}: pilih atau tulis nama ${type === 'bank' ? 'bank' : 'e-wallet'}` };
			if (!c.accountNumber.replace(/\D/g, '')) return { ok: false, message: `Kanal #${n}: nomor rekening/akun wajib diisi` };
			if (!c.accountHolder) return { ok: false, message: `Kanal #${n}: nama pemilik (atas nama) wajib diisi` };
		}
		out.push(c);
	}
	return { ok: true, channels: out };
}

export function normalizeDpSettingsInput(raw: unknown): StoreDpSettings {
	const r = (raw || {}) as any;
	return {
		enabled: r.enabled === true,
		mode: r.mode === 'amount' ? 'amount' : 'percent',
		percent: Math.round(num(r.percent ?? 30, 1, 99)),
		amount: Math.round(num(r.amount, 0)),
		cancelPolicyText: str(r.cancelPolicyText, 600) || DEFAULT_CANCEL_POLICY,
	};
}

export function readDpSettings(settings: any): StoreDpSettings {
	return normalizeDpSettingsInput({ ...DEFAULT_DP_SETTINGS, ...(settings?.dp || {}) });
}

/** Kanal aktif untuk sebuah produk (global atau pilihan produk). */
export function channelsForProduct(product: any, allChannels: StorePaymentChannel[]): StorePaymentChannel[] {
	const active = (allChannels || []).filter((c) => c.active);
	if (product?.paymentChannelMode !== 'custom') return active;
	const ids = new Set((product?.paymentChannelIds || []).map(String));
	return active.filter((c) => ids.has(c.id));
}

/** Kunci pengelompokan checkout: produk dengan himpunan kanal sama → satu pesanan. */
export function channelGroupKey(channels: StorePaymentChannel[]): string {
	return channels
		.map((c) => c.id)
		.sort()
		.join('|');
}

export interface DpRule {
	/** true = pembeli boleh memilih DP untuk item ini */
	allowed: boolean;
	mode: StoreDpMode;
	percent: number;
	amount: number;
	/** Tenggat pelunasan (ISO) atau null */
	settleBy: string | null;
	/** Produk mewajibkan bayar penuh (ditampilkan ke pembeli) */
	fullOnly: boolean;
}

const toIso = (d: unknown): string | null => {
	if (!d) return null;
	const t = new Date(String(d instanceof Date ? d.toISOString() : d));
	return Number.isNaN(t.getTime()) ? null : t.toISOString();
};

/**
 * Aturan DP efektif untuk produk. DP hanya untuk produk pre-order; `inWindow` = saat ini
 * produk sedang dalam masa pre-order (dihitung pemanggil memakai isPreOrderInWindow).
 */
export function effectiveDpRule(product: any, settings: any, inWindow: boolean): DpRule {
	const dp = readDpSettings(settings);
	const settleBy = toIso(product?.dpSettleBy) || toIso(product?.estimatedReadyAt) || toIso(product?.preOrderCloseAt);
	const pm: ProductDpMode = ['percent', 'amount', 'full'].includes(product?.dpMode) ? product.dpMode : 'default';
	const none: DpRule = { allowed: false, mode: 'percent', percent: 0, amount: 0, settleBy, fullOnly: pm === 'full' };
	if (!product?.isPreOrder || !inWindow || pm === 'full') return none;
	if (pm === 'percent') {
		const percent = Math.round(num(product.dpPercent, 1, 99));
		return { allowed: true, mode: 'percent', percent, amount: dp.amount, settleBy, fullOnly: false };
	}
	if (pm === 'amount') {
		const amount = Math.round(num(product.dpAmount, 0));
		return amount > 0 ? { allowed: true, mode: 'amount', percent: 0, amount, settleBy, fullOnly: false } : none;
	}
	if (!dp.enabled) return none;
	return { allowed: true, mode: dp.mode, percent: dp.percent, amount: dp.amount, settleBy, fullOnly: false };
}

/** DP satu baris: persen × subtotal (min nominal) atau nominal tetap × qty; tidak melebihi subtotal. */
export function lineDpAmount(rule: DpRule, lineSubtotal: number, qty: number): number {
	if (!rule.allowed) return lineSubtotal;
	const raw = rule.mode === 'amount' ? rule.amount * qty : Math.max((lineSubtotal * rule.percent) / 100, rule.amount);
	return Math.min(lineSubtotal, Math.ceil(raw));
}

export interface OrderPaymentPlanResult {
	plan: 'full' | 'dp';
	dpAmount: number;
	amountDue: number;
	balanceDue: number;
	settleBy: string | null;
}

/**
 * Nominal DP pesanan: jumlah DP per item (item non-DP penuh) + ongkir + pajak (ikut dibayar di DP).
 * Bila tidak ada item yang boleh DP atau plan=full → bayar penuh.
 */
export function computeOrderPaymentPlan(
	lines: { lineSubtotal: number; qty: number; dpRule: DpRule | null }[],
	extras: { shippingCost: number; taxAmount: number; total: number },
	requested: 'full' | 'dp',
): OrderPaymentPlanResult {
	const dpLines = lines.filter((l) => l.dpRule?.allowed);
	const settles = dpLines.map((l) => l.dpRule!.settleBy).filter(Boolean) as string[];
	const settleBy = settles.length ? settles.sort()[0] : null;
	if (requested !== 'dp' || !dpLines.length) {
		return { plan: 'full', dpAmount: 0, amountDue: extras.total, balanceDue: 0, settleBy: null };
	}
	const itemsDp = lines.reduce((s, l) => s + (l.dpRule ? lineDpAmount(l.dpRule, l.lineSubtotal, l.qty) : l.lineSubtotal), 0);
	const dpAmount = Math.min(extras.total, Math.round(itemsDp + extras.shippingCost + extras.taxAmount));
	if (dpAmount >= extras.total) {
		return { plan: 'full', dpAmount: 0, amountDue: extras.total, balanceDue: 0, settleBy: null };
	}
	return { plan: 'dp', dpAmount, amountDue: dpAmount, balanceDue: extras.total - dpAmount, settleBy };
}

// ── Status pembayaran ──

export const STORE_PAYMENT_STATUSES = [
	'unpaid',
	'awaiting_verification',
	'dp_verified',
	'balance_awaiting_verification',
	'paid',
	'rejected',
	'refunded',
] as const;
export type StorePaymentStatus = (typeof STORE_PAYMENT_STATUSES)[number];

export const STORE_PAYMENT_STATUS_LABEL: Record<string, string> = {
	unpaid: 'Belum bayar',
	awaiting_verification: 'Menunggu verifikasi',
	dp_verified: 'DP terverifikasi',
	balance_awaiting_verification: 'Pelunasan menunggu verifikasi',
	paid: 'Lunas',
	rejected: 'Bukti ditolak',
	refunded: 'Dana dikembalikan',
};

export const STORE_PAYMENT_KIND_LABEL: Record<string, string> = { dp: 'DP', full: 'Pembayaran penuh', balance: 'Pelunasan' };

export interface StorePaymentEntry {
	id: string;
	kind: 'dp' | 'full' | 'balance';
	amount: number;
	proofUrl: string;
	method: 'proof' | 'manual';
	channelId: string;
	uploadedAt: string | Date;
	status: 'submitted' | 'verified' | 'rejected';
	rejectReason: string;
	verifiedBy: string;
	verifiedAt: string | Date | null;
}

/**
 * Hitung ulang amountPaid, balanceDue, paymentStatus dari daftar pembayaran.
 * Aturan: terverifikasi menambah amountPaid; bukti "submitted" terbaru menentukan status menunggu.
 */
export function derivePaymentState(order: {
	total: number;
	paymentPlan?: string;
	dpAmount?: number;
	payments?: StorePaymentEntry[];
	paymentStatus?: string;
}): { amountPaid: number; balanceDue: number; paymentStatus: StorePaymentStatus; nextKind: 'dp' | 'full' | 'balance' | null } {
	const pays = order.payments || [];
	const amountPaid = pays.filter((p) => p.status === 'verified').reduce((s, p) => s + (Number(p.amount) || 0), 0);
	const total = Number(order.total) || 0;
	const balanceDue = Math.max(0, total - amountPaid);
	const isDp = order.paymentPlan === 'dp';
	const pending = pays.some((p) => p.status === 'submitted');
	const lastRejected = pays.length > 0 && pays[pays.length - 1].status === 'rejected';
	if (order.paymentStatus === 'refunded') return { amountPaid, balanceDue, paymentStatus: 'refunded', nextKind: null };

	let paymentStatus: StorePaymentStatus;
	if (amountPaid >= total && total > 0) paymentStatus = 'paid';
	else if (pending) paymentStatus = amountPaid > 0 ? 'balance_awaiting_verification' : 'awaiting_verification';
	else if (amountPaid > 0) paymentStatus = 'dp_verified';
	else if (lastRejected) paymentStatus = 'rejected';
	else paymentStatus = 'unpaid';

	let nextKind: 'dp' | 'full' | 'balance' | null = null;
	if (paymentStatus !== 'paid' && !pending) nextKind = amountPaid > 0 ? 'balance' : isDp ? 'dp' : 'full';
	return { amountPaid, balanceDue, paymentStatus, nextKind };
}

/** Nominal yang harus dibayar untuk jenis pembayaran berikutnya. */
export function amountForKind(order: { total: number; dpAmount?: number }, kind: 'dp' | 'full' | 'balance', amountPaid: number): number {
	const total = Number(order.total) || 0;
	if (kind === 'dp') return Math.min(total, Number(order.dpAmount) || total);
	return Math.max(0, total - amountPaid);
}
