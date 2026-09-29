import { formatStoreMoney } from '@shared/store-currency';
import type { DpRule } from '@shared/store-payment';
import { CalendarClock, CreditCard, PackageCheck } from 'lucide-react';
import { formatDateId } from './store-checkout-payment';

/** Info pre-order + DP + metode bayar di halaman produk. */
export function StoreProductPaymentInfo({
	product,
	currency,
}: {
	product: {
		isPreOrder?: boolean;
		preOrderCloseAt?: string | null;
		estimatedReadyAt?: string | null;
		paymentInfo?: { dp: DpRule; channels: { id: string; type: string; title: string }[] };
	};
	currency: string;
}) {
	const info = product.paymentInfo;
	if (!info) return null;
	const dp = info.dp;
	const showPo = !!product.isPreOrder;
	if (!showPo && !info.channels.length) return null;
	return (
		<div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-1.5 text-sm">
			{showPo && (
				<p className="flex items-start gap-1.5 font-medium text-violet-700 dark:text-violet-300">
					<PackageCheck className="h-4 w-4 mt-0.5 shrink-0" />
					<span>
						Pre-order
						{product.preOrderCloseAt ? ` sampai ${formatDateId(product.preOrderCloseAt)}` : ''}
						{product.estimatedReadyAt ? ` · estimasi siap ${formatDateId(product.estimatedReadyAt)}` : ''}
					</span>
				</p>
			)}
			{showPo && dp.allowed && (
				<p className="flex items-start gap-1.5">
					<CreditCard className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
					<span>
						Bisa DP{' '}
						<strong>
							{dp.mode === 'amount' ? `${formatStoreMoney(dp.amount, currency)} / pcs` : `${dp.percent}%`}
						</strong>
						{dp.mode === 'percent' && dp.amount > 0 ? ` (min. ${formatStoreMoney(dp.amount, currency)})` : ''}, sisanya
						dilunasi
						{dp.settleBy ? (
							<>
								{' '}paling lambat <strong>{formatDateId(dp.settleBy)}</strong>
							</>
						) : (
							' sebelum barang diambil/dikirim'
						)}
						.
					</span>
				</p>
			)}
			{showPo && dp.fullOnly && (
				<p className="flex items-center gap-1.5 text-muted-foreground">
					<CalendarClock className="h-4 w-4 shrink-0" /> Produk ini wajib bayar penuh.
				</p>
			)}
			{info.channels.length > 0 && (
				<p className="text-xs text-muted-foreground">Bayar via: {info.channels.map((c) => c.title).join(' · ')}</p>
			)}
		</div>
	);
}
