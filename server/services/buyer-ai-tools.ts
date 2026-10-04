/**
 * Tool AI khusus PEMBELI yang sedang login (Enco mode pembeli).
 *
 * Aturan keamanan:
 * - read-only, tidak ada aksi tulis;
 * - `buyerId` SELALU dari sesi server (pageContext.buyerId diisi route chat setelah verifikasi cookie
 *   `buyerToken`), tidak pernah dari argumen model;
 * - hanya membaca toko konteks aktif (DB utama atau DB tenant yang sudah di-resolve server);
 * - pesanan milik pembeli lain diperlakukan "tidak ditemukan".
 */
import { StoreOrder as MainStoreOrder } from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';
import { STORE_ORDER_STATUS_LABEL } from '../../shared/store-order-status';
import { STORE_PAYMENT_STATUS_LABEL } from '../../shared/store-payment';

export const BUYER_TOOL_DEFS = [
	{
		name: 'buyer_list_orders',
		description:
			'Daftar pesanan milik PEMBELI yang sedang login di toko ini (nomor pesanan, tanggal, status, status bayar, total, sisa tagihan, isi). Gunakan saat pembeli bertanya "pesanan saya", "status pesanan", "sudah dibayar belum", dsb. Hanya pesanan milik akun ini.',
		parameters: {
			type: 'object' as const,
			properties: {
				status: { type: 'string', description: 'Opsional: filter status (pending, confirmed, preorder, paid, shipped, completed, cancelled).' },
			},
			required: [] as string[],
		},
	},
	{
		name: 'buyer_get_order',
		description:
			'Detail satu pesanan milik pembeli yang login: item, status, pembayaran (skema penuh/DP, sudah dibayar, sisa, tenggat pelunasan), kanal bayar (QRIS/rekening) untuk cara bayar, dan link invoice. Gunakan untuk "berapa sisa pelunasan", "cara bayar pesanan X".',
		parameters: {
			type: 'object' as const,
			properties: { orderNo: { type: 'string', description: 'Nomor pesanan, mis. ORD-XXXX-xxxxxx' } },
			required: ['orderNo'],
		},
	},
];

export const BUYER_TOOL_NAMES = new Set(BUYER_TOOL_DEFS.map((t) => t.name));

function storeOrderModel(tenantDbName?: string | null) {
	return tenantDbName ? getTenantModels(tenantDbName).StoreOrder : MainStoreOrder;
}

const statusLabel = (s: string) => STORE_ORDER_STATUS_LABEL[s] || s;
const payLabel = (s: string) => STORE_PAYMENT_STATUS_LABEL[s || 'unpaid'] || s;

export async function runBuyerTool(
	name: string,
	args: Record<string, unknown>,
	ctx: { buyerId: string | null; tenantDbName?: string | null },
): Promise<Record<string, unknown>> {
	if (!ctx.buyerId) return { error: 'Fitur ini hanya untuk pembeli yang sudah masuk akun toko. Ajak pengguna masuk di halaman Masuk toko.' };
	const StoreOrder: any = storeOrderModel(ctx.tenantDbName);

	if (name === 'buyer_list_orders') {
		const filter: Record<string, unknown> = { buyerId: ctx.buyerId };
		const st = String(args.status || '').trim();
		if (st) filter.status = st;
		const rows: any[] = await StoreOrder.find(filter)
			.sort({ createdAt: -1 })
			.limit(20)
			.select('orderNo createdAt status paymentStatus paymentPlan total amountPaid balanceDue settleBy items.name items.qty items.variantLabel')
			.lean();
		return {
			count: rows.length,
			orders: rows.map((o) => ({
				orderNo: o.orderNo,
				date: o.createdAt,
				status: statusLabel(o.status),
				paymentStatus: payLabel(o.paymentStatus),
				scheme: o.paymentPlan === 'dp' ? 'DP' : 'Penuh',
				total: o.total,
				amountPaid: o.amountPaid || 0,
				balanceDue: o.balanceDue || 0,
				settleBy: o.settleBy || null,
				items: (o.items || []).map((i: any) => `${i.qty}× ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''}`),
			})),
			note: 'Detail & pembayaran ada di halaman Akun → Pesanan saya atau link invoice.',
		};
	}

	if (name === 'buyer_get_order') {
		const orderNo = String(args.orderNo || '').trim().slice(0, 60);
		if (!orderNo) return { error: 'Nomor pesanan wajib diisi' };
		const o: any = await StoreOrder.findOne({ orderNo, buyerId: ctx.buyerId }).lean();
		if (!o) return { error: 'Pesanan tidak ditemukan di akun ini.' };
		const channels = (o.paymentChannelsSnapshot || []).map((c: any) => ({
			type: c.type,
			name: c.type === 'qris' ? c.merchantName : c.providerName,
			accountNumber: c.type === 'qris' ? undefined : c.accountNumber,
			accountHolder: c.type === 'qris' ? undefined : c.accountHolder,
			note: c.note || undefined,
		}));
		return {
			orderNo: o.orderNo,
			date: o.createdAt,
			status: statusLabel(o.status),
			paymentStatus: payLabel(o.paymentStatus),
			scheme: o.paymentPlan === 'dp' ? 'DP' : 'Penuh',
			total: o.total,
			dpAmount: o.paymentPlan === 'dp' ? o.dpAmount || 0 : 0,
			amountPaid: o.amountPaid || 0,
			balanceDue: o.balanceDue || 0,
			settleBy: o.settleBy || null,
			fulfillment: o.fulfillment === 'delivery' ? 'Diantar' : 'Ambil di tempat',
			items: (o.items || []).map((i: any) => ({ name: i.name, variant: i.variantLabel || '', qty: i.qty, price: i.unitPrice })),
			paymentChannels: channels,
			howToPay: channels.length
				? 'Bayar lewat salah satu kanal di atas, lalu buka invoice dan unggah bukti bayar ("Saya sudah bayar"). Admin akan memverifikasi.'
				: 'Pesanan ini dibayar lewat koordinasi WhatsApp admin.',
			cancelRequested: !!o.cancelRequestedAt,
		};
	}
	return { error: `Tool "${name}" tidak dikenali` };
}
