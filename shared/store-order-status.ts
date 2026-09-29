/** Status pesanan toko & labelnya (dipakai web, dashboard, dan export Excel). */
export const STORE_ORDER_STATUS_FLOW = ['pending', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled'] as const;
export type StoreOrderStatus = (typeof STORE_ORDER_STATUS_FLOW)[number];

export const STORE_ORDER_STATUS_LABEL: Record<string, string> = {
	pending: 'Menunggu',
	confirmed: 'Dikonfirmasi',
	paid: 'Dibayar',
	shipped: 'Dikirim/Diambil',
	completed: 'Selesai',
	cancelled: 'Dibatalkan',
};

export const STORE_PAYMENT_METHOD_LABEL: Record<string, string> = {
	transfer: 'Transfer',
	qris: 'QRIS',
	cash: 'Tunai',
	ewallet: 'E-Wallet',
};

export function storeOrderStatusLabel(status: string): string {
	return STORE_ORDER_STATUS_LABEL[status] || status;
}
