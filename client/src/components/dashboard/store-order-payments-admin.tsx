import { useState } from 'react';
import { Check, ExternalLink, Loader2, Plus, X } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatStoreMoney } from '@shared/store-currency';
import {
	channelTitle,
	STORE_PAYMENT_KIND_LABEL,
	STORE_PAYMENT_STATUS_LABEL,
	type StorePaymentEntry,
} from '@shared/store-payment';

const tone: Record<string, string> = {
	paid: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
	dp_verified: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
	awaiting_verification: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
	balance_awaiting_verification: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
	rejected: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
};

function waLink(phone: string, text: string) {
	let d = String(phone || '').replace(/\D/g, '');
	if (d.startsWith('0')) d = `62${d.slice(1)}`;
	return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : '';
}

/**
 * Bagian pembayaran di kartu pesanan admin: status bayar, bukti (lihat / verifikasi / tolak),
 * catat pembayaran manual, permintaan batal, dana dikembalikan, dan template WA ke pembeli.
 */
export function StoreOrderPaymentsAdmin({
	order: o,
	currency,
	ordersUrl,
	onChanged,
}: {
	order: any;
	currency: string;
	ordersUrl: string;
	onChanged: () => void;
}) {
	const { toast } = useToast();
	const [busy, setBusy] = useState('');
	const [amountEdit, setAmountEdit] = useState<Record<string, string>>({});
	const [manualOpen, setManualOpen] = useState(false);
	const [manualAmount, setManualAmount] = useState('');
	const [manualNote, setManualNote] = useState('');
	const payments: StorePaymentEntry[] = o.payments || [];
	const snap = o.paymentChannelsSnapshot || [];
	const hasPaymentFlow = snap.length > 0 || payments.length > 0;
	const base = `${ordersUrl}/${encodeURIComponent(o.orderNo)}`;
	const legacy = !hasPaymentFlow;

	const run = async (key: string, fn: () => Promise<Response>, ok: string) => {
		setBusy(key);
		try {
			await fn();
			toast({ title: ok });
			onChanged();
		} catch (e) {
			toast({ title: 'Gagal', description: (e as Error).message.replace(/^\d+:\s*/, ''), variant: 'destructive' });
		} finally {
			setBusy('');
		}
	};

	const verify = (p: StorePaymentEntry) => {
		const raw = amountEdit[p.id];
		const body: Record<string, unknown> = { action: 'verify' };
		if (raw && Number(raw) !== p.amount) body.amount = Number(raw);
		return run(`v-${p.id}`, () => apiRequest('PATCH', `${base}/payments/${p.id}`, body), 'Pembayaran diverifikasi');
	};
	const reject = (p: StorePaymentEntry) => {
		const reason = window.prompt('Alasan menolak bukti (terlihat oleh pembeli), mis. "nominal tidak sesuai" / "bukti tidak terbaca":');
		if (!reason?.trim()) return;
		return run(`r-${p.id}`, () => apiRequest('PATCH', `${base}/payments/${p.id}`, { action: 'reject', reason }), 'Bukti ditolak — pembeli diminta upload ulang');
	};

	if (legacy) return null;

	const invoiceHint = 'Cek halaman invoice pesananmu.';
	const waReupload = waLink(
		o.customerPhone,
		`Halo Kak ${o.customerName}, bukti pembayaran pesanan ${o.orderNo} belum bisa kami verifikasi (nominal/tanggal tidak sesuai atau kurang jelas). Mohon upload ulang bukti di halaman invoice ya. Terima kasih.`,
	);
	const waRemind = waLink(
		o.customerPhone,
		`Halo Kak ${o.customerName}, pengingat pelunasan pesanan ${o.orderNo}: sisa ${formatStoreMoney(o.balanceDue ?? o.total, currency)}${
			o.settleBy ? `, paling lambat ${new Date(o.settleBy).toLocaleDateString('id-ID')}` : ''
		}. ${invoiceHint}`,
	);

	return (
		<div className="space-y-2 rounded-md border border-dashed p-2">
			<div className="flex flex-wrap items-center gap-2 text-xs">
				<span className={`rounded-full px-2 py-0.5 font-semibold ${tone[o.paymentStatus] || 'bg-muted text-muted-foreground'}`}>
					{STORE_PAYMENT_STATUS_LABEL[o.paymentStatus || 'unpaid']}
				</span>
				<span>{o.paymentPlan === 'dp' ? `DP ${formatStoreMoney(o.dpAmount || 0, currency)}` : 'Bayar penuh'}</span>
				<span>· masuk {formatStoreMoney(o.amountPaid || 0, currency)}</span>
				<span className="font-semibold">· sisa {formatStoreMoney(o.balanceDue ?? o.total, currency)}</span>
				{o.settleBy && (
					<span className={new Date(o.settleBy) < new Date() && o.paymentStatus !== 'paid' ? 'text-rose-600 font-semibold' : 'text-muted-foreground'}>
						· tenggat {new Date(o.settleBy).toLocaleDateString('id-ID')}
					</span>
				)}
			</div>
			{snap.length > 0 && (
				<p className="text-[11px] text-muted-foreground">Kanal: {snap.map((c: any) => channelTitle(c)).join(', ')}</p>
			)}

			{o.cancelRequestedAt && o.status !== 'cancelled' && (
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-500/10 p-2 text-xs">
					<span>
						<strong>Minta dibatalkan</strong> {new Date(o.cancelRequestedAt).toLocaleString('id-ID')}
						{o.cancelRequestReason ? ` — "${o.cancelRequestReason}"` : ''}. Hubungi pembeli, lalu ubah status/dana sesuai kebijakan.
					</span>
					<Button
						size="sm"
						variant="outline"
						disabled={!!busy}
						onClick={() => run('clear', () => apiRequest('PATCH', base, { clearCancelRequest: true }), 'Permintaan ditandai selesai')}>
						Tandai sudah ditangani
					</Button>
				</div>
			)}

			{payments.map((p) => (
				<div key={p.id} className="flex flex-wrap items-start gap-3 rounded-md bg-muted/40 p-2 text-xs">
					{p.proofUrl ? (
						<a href={`${base}/payment-proof/${p.id}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
							<img src={`${base}/payment-proof/${p.id}`} alt="Bukti bayar" className="h-20 w-16 rounded border object-cover bg-white" loading="lazy" />
						</a>
					) : (
						<span className="shrink-0 rounded border px-2 py-6 text-muted-foreground">Manual</span>
					)}
					<div className="min-w-0 flex-1 space-y-1">
						<p className="font-medium">
							{STORE_PAYMENT_KIND_LABEL[p.kind]} · {formatStoreMoney(p.amount, currency)}{' '}
							<span className="text-muted-foreground font-normal">
								{p.channelId ? `via ${channelTitle(snap.find((c: any) => c.id === p.channelId) || { type: 'bank', merchantName: '', providerName: '' })}` : ''}
							</span>
						</p>
						<p className="text-muted-foreground">
							{new Date(p.uploadedAt).toLocaleString('id-ID')}
							{p.verifiedBy ? ` · ${p.status === 'verified' ? 'diverifikasi' : 'ditolak'} ${p.verifiedBy}` : ''}
						</p>
						{p.rejectReason && <p className={p.status === 'rejected' ? 'text-rose-600' : 'text-muted-foreground'}>{p.rejectReason}</p>}
						{p.proofUrl && (
							<a href={`${base}/payment-proof/${p.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary">
								Buka ukuran penuh <ExternalLink className="h-3 w-3" />
							</a>
						)}
						{p.status === 'submitted' && (
							<div className="flex flex-wrap items-center gap-2 pt-1">
								<Input
									type="number"
									className="h-8 w-32"
									placeholder={String(p.amount)}
									value={amountEdit[p.id] ?? ''}
									onChange={(e) => setAmountEdit((m) => ({ ...m, [p.id]: e.target.value }))}
									aria-label="Nominal masuk"
								/>
								<Button size="sm" className="h-8" disabled={!!busy} onClick={() => void verify(p)}>
									{busy === `v-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />} Verifikasi
								</Button>
								<Button size="sm" variant="outline" className="h-8" disabled={!!busy} onClick={() => void reject(p)}>
									<X className="h-3.5 w-3.5 mr-1" /> Tolak
								</Button>
							</div>
						)}
					</div>
					<span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${p.status === 'verified' ? tone.paid : p.status === 'rejected' ? tone.rejected : tone.awaiting_verification}`}>
						{p.status === 'verified' ? 'Terverifikasi' : p.status === 'rejected' ? 'Ditolak' : 'Perlu dicek'}
					</span>
				</div>
			))}

			<div className="flex flex-wrap gap-2">
				{waReupload && payments.some((p) => p.status !== 'verified') && (
					<Button asChild size="sm" variant="outline" className="h-8 text-xs">
						<a href={waReupload} target="_blank" rel="noopener noreferrer">
							<FaWhatsapp className="h-3.5 w-3.5 mr-1" /> Minta upload ulang
						</a>
					</Button>
				)}
				{waRemind && o.paymentPlan === 'dp' && o.paymentStatus === 'dp_verified' && (
					<Button asChild size="sm" variant="outline" className="h-8 text-xs">
						<a href={waRemind} target="_blank" rel="noopener noreferrer">
							<FaWhatsapp className="h-3.5 w-3.5 mr-1" /> Ingatkan pelunasan
						</a>
					</Button>
				)}
				{o.paymentStatus !== 'paid' && (
					<Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setManualOpen((v) => !v)}>
						<Plus className="h-3.5 w-3.5 mr-1" /> Catat bayar manual
					</Button>
				)}
				{Number(o.amountPaid) > 0 && o.paymentStatus !== 'refunded' && o.status === 'cancelled' && (
					<Button
						size="sm"
						variant="outline"
						className="h-8 text-xs"
						disabled={!!busy}
						onClick={() =>
							window.confirm('Tandai dana sudah dikembalikan ke pembeli?') &&
							run('refund', () => apiRequest('PATCH', base, { paymentStatus: 'refunded' }), 'Ditandai dana dikembalikan')
						}>
						Dana dikembalikan
					</Button>
				)}
			</div>

			{manualOpen && (
				<div className="flex flex-wrap items-end gap-2 rounded-md border p-2">
					<div className="space-y-1">
						<Label className="text-xs">Nominal diterima</Label>
						<Input type="number" className="h-8 w-36" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
					</div>
					<div className="space-y-1 flex-1 min-w-[160px]">
						<Label className="text-xs">Catatan (mis. tunai saat ambil)</Label>
						<Input className="h-8" value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
					</div>
					<Button
						size="sm"
						className="h-8"
						disabled={!!busy || !(Number(manualAmount) > 0)}
						onClick={() =>
							run(
								'manual',
								() => apiRequest('POST', `${base}/payments`, { amount: Number(manualAmount), note: manualNote }),
								'Pembayaran dicatat',
							).then(() => {
								setManualOpen(false);
								setManualAmount('');
								setManualNote('');
							})
						}>
						Simpan
					</Button>
				</div>
			)}
		</div>
	);
}
