import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { channelTitle, type ProductDpMode, type StoreDpSettings, type StorePaymentChannel } from '@shared/store-payment';

export interface ProductPaymentForm {
	isPreOrder: boolean;
	preOrderOpenAt: string;
	preOrderCloseAt: string;
	estimatedReadyAt: string;
	preOrderDiscountPercent: number;
	preOrderAllowAfterClose: boolean;
	dpMode: ProductDpMode;
	dpPercent: number;
	dpAmount: number;
	dpSettleBy: string;
	paymentChannelMode: 'global' | 'custom';
	paymentChannelIds: string[];
}

export const EMPTY_PRODUCT_PAYMENT: ProductPaymentForm = {
	isPreOrder: false,
	preOrderOpenAt: '',
	preOrderCloseAt: '',
	estimatedReadyAt: '',
	preOrderDiscountPercent: 0,
	preOrderAllowAfterClose: false,
	dpMode: 'default',
	dpPercent: 30,
	dpAmount: 0,
	dpSettleBy: '',
	paymentChannelMode: 'global',
	paymentChannelIds: [],
};

/** Date dari server → nilai input datetime-local (jam lokal browser). */
function toLocalInput(v: unknown): string {
	if (!v) return '';
	const d = new Date(String(v));
	if (Number.isNaN(d.getTime())) return '';
	const off = d.getTimezoneOffset() * 60000;
	return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
const toIsoOrNull = (v: string) => (v ? new Date(v).toISOString() : null);

export function productPaymentFromProduct(p: any): ProductPaymentForm {
	return {
		isPreOrder: !!p?.isPreOrder,
		preOrderOpenAt: toLocalInput(p?.preOrderOpenAt),
		preOrderCloseAt: toLocalInput(p?.preOrderCloseAt),
		estimatedReadyAt: toLocalInput(p?.estimatedReadyAt),
		preOrderDiscountPercent: Number(p?.preOrderDiscountPercent) || 0,
		preOrderAllowAfterClose: !!p?.preOrderAllowAfterClose,
		dpMode: ['percent', 'amount', 'full'].includes(p?.dpMode) ? p.dpMode : 'default',
		dpPercent: Number(p?.dpPercent) || 30,
		dpAmount: Number(p?.dpAmount) || 0,
		dpSettleBy: toLocalInput(p?.dpSettleBy),
		paymentChannelMode: p?.paymentChannelMode === 'custom' ? 'custom' : 'global',
		paymentChannelIds: Array.isArray(p?.paymentChannelIds) ? p.paymentChannelIds.map(String) : [],
	};
}

export function productPaymentPayload(f: ProductPaymentForm) {
	return {
		isPreOrder: f.isPreOrder,
		preOrderOpenAt: toIsoOrNull(f.preOrderOpenAt),
		preOrderCloseAt: toIsoOrNull(f.preOrderCloseAt),
		estimatedReadyAt: toIsoOrNull(f.estimatedReadyAt),
		preOrderDiscountPercent: Math.min(100, Math.max(0, Number(f.preOrderDiscountPercent) || 0)),
		preOrderAllowAfterClose: f.preOrderAllowAfterClose,
		dpMode: f.dpMode,
		dpPercent: f.dpPercent,
		dpAmount: f.dpAmount,
		dpSettleBy: toIsoOrNull(f.dpSettleBy),
		paymentChannelMode: f.paymentChannelMode,
		paymentChannelIds: f.paymentChannelIds,
	};
}

/** Editor produk: pre-order (jadwal, estimasi, diskon), DP produk, dan kanal bayar produk. */
export function StoreProductPaymentEditor({
	value,
	onChange,
	channels,
	dpDefault,
}: {
	value: ProductPaymentForm;
	onChange: (next: ProductPaymentForm) => void;
	channels: StorePaymentChannel[];
	dpDefault: StoreDpSettings | undefined;
}) {
	const set = (p: Partial<ProductPaymentForm>) => onChange({ ...value, ...p });
	const defaultText = dpDefault?.enabled
		? dpDefault.mode === 'amount'
			? `Rp${Number(dpDefault.amount).toLocaleString('id-ID')}/pcs`
			: `${dpDefault.percent}%`
		: 'DP default toko nonaktif';
	return (
		<div className="space-y-4 rounded-lg border p-3">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="font-medium text-sm">Pre-order</p>
					<p className="text-xs text-muted-foreground">Stok tidak dikurangi selama masa pre-order. DP hanya berlaku untuk produk pre-order.</p>
				</div>
				<Switch checked={value.isPreOrder} onCheckedChange={(v) => set({ isPreOrder: v })} aria-label="Aktifkan pre-order" />
			</div>
			{value.isPreOrder && (
				<>
					<div className="grid gap-3 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label className="text-xs">Pre-order dibuka</Label>
							<Input type="datetime-local" value={value.preOrderOpenAt} onChange={(e) => set({ preOrderOpenAt: e.target.value })} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Pre-order ditutup</Label>
							<Input type="datetime-local" value={value.preOrderCloseAt} onChange={(e) => set({ preOrderCloseAt: e.target.value })} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Estimasi barang siap</Label>
							<Input type="datetime-local" value={value.estimatedReadyAt} onChange={(e) => set({ estimatedReadyAt: e.target.value })} />
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Diskon pre-order (%)</Label>
							<Input type="number" min={0} max={100} value={value.preOrderDiscountPercent} onChange={(e) => set({ preOrderDiscountPercent: Number(e.target.value) || 0 })} />
						</div>
					</div>
					<label className="flex items-center gap-2 text-xs">
						<Checkbox checked={value.preOrderAllowAfterClose} onCheckedChange={(v) => set({ preOrderAllowAfterClose: v === true })} />
						Tetap bisa dipesan setelah pre-order ditutup (harga & stok normal)
					</label>

					<div className="grid gap-3 sm:grid-cols-3 border-t pt-3">
						<div className="space-y-1.5">
							<Label className="text-xs">DP produk ini</Label>
							<select
								className="w-full rounded-md border bg-background px-3 py-2 text-sm"
								value={value.dpMode}
								onChange={(e) => set({ dpMode: e.target.value as ProductDpMode })}>
								<option value="default">Ikut default toko ({defaultText})</option>
								<option value="percent">Persen sendiri</option>
								<option value="amount">Nominal tetap per pcs</option>
								<option value="full">Wajib bayar penuh</option>
							</select>
						</div>
						{value.dpMode === 'percent' && (
							<div className="space-y-1.5">
								<Label className="text-xs">Persen DP</Label>
								<Input type="number" min={1} max={99} value={value.dpPercent} onChange={(e) => set({ dpPercent: Number(e.target.value) || 0 })} />
							</div>
						)}
						{value.dpMode === 'amount' && (
							<div className="space-y-1.5">
								<Label className="text-xs">DP per pcs (Rp)</Label>
								<Input type="number" min={0} value={value.dpAmount} onChange={(e) => set({ dpAmount: Number(e.target.value) || 0 })} />
							</div>
						)}
						{value.dpMode !== 'full' && (
							<div className="space-y-1.5">
								<Label className="text-xs">Batas pelunasan</Label>
								<Input type="datetime-local" value={value.dpSettleBy} onChange={(e) => set({ dpSettleBy: e.target.value })} />
								<p className="text-[11px] text-muted-foreground">Kosong = estimasi siap / tanggal tutup pre-order.</p>
							</div>
						)}
					</div>
				</>
			)}

			<div className="space-y-2 border-t pt-3">
				<Label className="text-xs">Metode bayar produk</Label>
				<select
					className="w-full rounded-md border bg-background px-3 py-2 text-sm"
					value={value.paymentChannelMode}
					onChange={(e) => set({ paymentChannelMode: e.target.value === 'custom' ? 'custom' : 'global' })}>
					<option value="global">Ikut pengaturan toko (semua kanal aktif)</option>
					<option value="custom">Pilih kanal tertentu</option>
				</select>
				{value.paymentChannelMode === 'custom' && (
					<div className="space-y-1.5">
						{channels.length === 0 && <p className="text-xs text-muted-foreground">Belum ada kanal — tambahkan di Pengaturan → Pembayaran.</p>}
						{channels.map((c) => (
							<label key={c.id} className={`flex items-center gap-2 text-sm ${c.active ? '' : 'opacity-60'}`}>
								<Checkbox
									checked={value.paymentChannelIds.includes(c.id)}
									onCheckedChange={(v) =>
										set({
											paymentChannelIds: v === true ? [...value.paymentChannelIds, c.id] : value.paymentChannelIds.filter((x) => x !== c.id),
										})
									}
								/>
								{channelTitle(c)}
								{c.type !== 'qris' && c.accountNumber ? <span className="text-xs text-muted-foreground">{c.accountNumber}</span> : null}
								{!c.active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}
							</label>
						))}
						<p className="text-[11px] text-muted-foreground">
							Keranjang berisi produk dengan kanal berbeda otomatis dipecah menjadi beberapa pesanan.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
