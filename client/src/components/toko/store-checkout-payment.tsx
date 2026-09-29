import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatStoreMoney } from '@shared/store-currency';
import { AlertTriangle, CalendarClock, Layers } from 'lucide-react';

export interface StorePaymentPreview {
	payOnWeb: boolean;
	orderCount: number;
	orders: { channels: { id: string; type: string; title: string }[]; total: number; dpAllowed: boolean; dpAmount: number; balanceDue: number }[];
	dpAllowed: boolean;
	total: number;
	dpTotal: number;
	balanceTotal: number;
	settleBy: string | null;
	items: { key: string; name: string; dp: { allowed: boolean; mode: string; percent: number; amount: number; fullOnly: boolean } }[];
	cancelPolicyText: string;
}

export function formatDateId(iso: string | null | undefined): string {
	if (!iso) return '';
	return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

/** Pilihan DP / bayar penuh, info pemisahan pesanan, dan persetujuan kebijakan batal di checkout. */
export function StoreCheckoutPayment({
	preview,
	currency,
	plan,
	onPlanChange,
	accepted,
	onAcceptedChange,
}: {
	preview: StorePaymentPreview | undefined;
	currency: string;
	plan: 'full' | 'dp';
	onPlanChange: (p: 'full' | 'dp') => void;
	accepted: boolean;
	onAcceptedChange: (v: boolean) => void;
}) {
	if (!preview?.payOnWeb) return null;
	const dpItems = preview.items.filter((i) => i.dp.allowed);
	return (
		<div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
			<Label className="text-sm font-semibold">Pembayaran</Label>
			{preview.dpAllowed ? (
				<RadioGroup value={plan} onValueChange={(v) => onPlanChange(v as 'full' | 'dp')} className="space-y-2">
					<label className="flex items-start gap-2 rounded-md border p-2.5 cursor-pointer has-[:checked]:border-primary">
						<RadioGroupItem value="dp" id="plan-dp" className="mt-0.5" />
						<span className="min-w-0 text-sm">
							<span className="font-medium">Bayar DP sekarang: {formatStoreMoney(preview.dpTotal, currency)}</span>
							<span className="block text-xs text-muted-foreground">
								Sisa {formatStoreMoney(preview.balanceTotal, currency)}
								{preview.settleBy ? `, lunasi paling lambat ${formatDateId(preview.settleBy)}` : ''}. DP berlaku untuk{' '}
								{dpItems.map((i) => `${i.name} (${i.dp.mode === 'amount' ? formatStoreMoney(i.dp.amount, currency) + '/pcs' : `${i.dp.percent}%`})`).join(', ')}; barang lain & ongkir dibayar penuh di DP.
							</span>
						</span>
					</label>
					<label className="flex items-start gap-2 rounded-md border p-2.5 cursor-pointer has-[:checked]:border-primary">
						<RadioGroupItem value="full" id="plan-full" className="mt-0.5" />
						<span className="text-sm font-medium">Bayar penuh: {formatStoreMoney(preview.total, currency)}</span>
					</label>
				</RadioGroup>
			) : (
				<p className="text-sm">Bayar penuh: <strong>{formatStoreMoney(preview.total, currency)}</strong></p>
			)}
			{preview.settleBy && plan === 'dp' && (
				<p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
					<CalendarClock className="h-3.5 w-3.5 shrink-0" /> Pelunasan wajib sebelum {formatDateId(preview.settleBy)}.
				</p>
			)}
			{preview.orderCount > 1 && (
				<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
					<Layers className="h-3.5 w-3.5 shrink-0 mt-0.5" />
					Barang di keranjang memakai metode bayar berbeda, jadi dibuat {preview.orderCount} pesanan terpisah (masing-masing punya invoice & cara bayar sendiri). Ongkir dihitung sekali di pesanan pertama.
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				Setelah pesanan dibuat, kamu akan melihat QRIS / nomor rekening, lalu upload bukti bayar di halaman invoice.
			</p>
			<label className="flex items-start gap-2 text-xs cursor-pointer">
				<Checkbox checked={accepted} onCheckedChange={(v) => onAcceptedChange(v === true)} className="mt-0.5" />
				<span>
					<AlertTriangle className="inline h-3.5 w-3.5 mr-1 text-amber-500" />
					{preview.cancelPolicyText} Pesanan yang belum dibayar masih bisa dibatalkan sendiri dari halaman invoice.
				</span>
			</label>
		</div>
	);
}
