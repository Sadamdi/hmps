import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatStoreMoney } from '@shared/store-currency';
import {
	channelTitle,
	derivePaymentState,
	amountForKind,
	STORE_PAYMENT_KIND_LABEL,
	STORE_PAYMENT_STATUS_LABEL,
	type StorePaymentChannel,
	type StorePaymentEntry,
} from '@shared/store-payment';
import { ArrowLeft, CalendarClock, Check, Copy, Download, ImageUp, Loader2, QrCode, Wallet, XCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { formatDateId } from './store-checkout-payment';

export interface OrderPaymentData {
	orderNo: string;
	status: string;
	total: number;
	paymentPlan?: 'full' | 'dp';
	dpAmount?: number;
	amountPaid?: number;
	balanceDue?: number;
	settleBy?: string | null;
	paymentStatus?: string;
	payments?: StorePaymentEntry[];
	paymentChannelsSnapshot?: StorePaymentChannel[];
	cancelRequestedAt?: string | null;
	whatsappPhoneUsed?: string;
	customerName?: string;
}

const statusTone: Record<string, string> = {
	paid: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
	dp_verified: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
	awaiting_verification: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
	balance_awaiting_verification: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
	rejected: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
	unpaid: 'bg-muted text-muted-foreground',
	refunded: 'bg-muted text-muted-foreground',
};

/**
 * Panel pembayaran di invoice: cara bayar (QRIS / rekening), "Saya sudah bayar" → upload bukti,
 * riwayat pembayaran & status verifikasi, pembatalan (langsung bila belum bayar, selain itu ke admin).
 */
export function StoreOrderPaymentPanel({
	order,
	apiBase,
	inv,
	currency,
	onChanged,
}: {
	order: OrderPaymentData;
	apiBase: string;
	inv: string;
	currency: string;
	onChanged: () => void;
}) {
	const { toast } = useToast();
	const channels = (order.paymentChannelsSnapshot || []).filter(Boolean);
	const payments = order.payments || [];
	const st = useMemo(() => derivePaymentState(order as any), [order]);
	const nextAmount = st.nextKind ? amountForKind(order, st.nextKind, st.amountPaid) : 0;
	const [step, setStep] = useState<'info' | 'upload'>('info');
	const [channelId, setChannelId] = useState(channels[0]?.id || '');
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState('');
	const [busy, setBusy] = useState(false);
	const [cancelOpen, setCancelOpen] = useState(false);
	const [cancelReason, setCancelReason] = useState('');
	const fileRef = useRef<HTMLInputElement>(null);
	const q = inv ? `?inv=${encodeURIComponent(inv)}` : '';
	const base = `${apiBase}/orders/${encodeURIComponent(order.orderNo)}`;
	const cancelled = order.status === 'cancelled';
	const hasPayment = payments.some((p) => p.status !== 'rejected');
	const kindText = (k: 'dp' | 'full' | 'balance') => (k === 'dp' ? 'DP' : STORE_PAYMENT_KIND_LABEL[k].toLowerCase());
	const canSelfCancel = !cancelled && !hasPayment && ['pending', 'confirmed'].includes(order.status);

	if (!channels.length && !payments.length) return null;

	const pickFile = (f: File | null) => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		setFile(f);
		setPreviewUrl(f ? URL.createObjectURL(f) : '');
	};

	const submitProof = async () => {
		if (!file) return toast({ title: 'Pilih foto bukti bayar dulu', variant: 'destructive' });
		if (file.size > 5 * 1024 * 1024) return toast({ title: 'Ukuran maksimal 5 MB', variant: 'destructive' });
		setBusy(true);
		try {
			const fd = new FormData();
			fd.append('image', file);
			if (channelId) fd.append('channelId', channelId);
			const r = await fetch(`${base}/payment-proof${q}`, { method: 'POST', credentials: 'include', body: fd });
			const d = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(d?.message || 'Gagal mengirim bukti');
			toast({ title: 'Bukti terkirim', description: 'Admin akan memverifikasi pembayaranmu.' });
			pickFile(null);
			setStep('info');
			onChanged();
		} catch (e) {
			toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	const doCancel = async () => {
		setBusy(true);
		try {
			const r = await fetch(`${base}/cancel${q}`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason: cancelReason }),
			});
			const d = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(d?.message || 'Gagal');
			toast({
				title: d.cancelled ? 'Pesanan dibatalkan' : 'Permintaan batal terkirim',
				description: d.cancelled ? 'Stok sudah dikembalikan.' : 'Admin akan menghubungi kamu lewat WhatsApp.',
			});
			setCancelOpen(false);
			onChanged();
		} catch (e) {
			toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast({ title: 'Disalin' }));
	const waDigits = String(order.whatsappPhoneUsed || '').replace(/\D/g, '');
	const waText = `Halo, saya ${order.customerName || ''} ingin konfirmasi pembayaran pesanan ${order.orderNo}${
		nextAmount ? ` sebesar ${formatStoreMoney(nextAmount, currency)}` : ''
	}.\nInvoice: ${typeof window !== 'undefined' ? window.location.href : ''}`;

	return (
		<div className="border-t pt-4 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="font-semibold flex items-center gap-2">
					<Wallet className="h-4 w-4 text-primary" /> Pembayaran
				</p>
				<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[st.paymentStatus] || statusTone.unpaid}`}>
					{STORE_PAYMENT_STATUS_LABEL[st.paymentStatus]}
				</span>
			</div>

			<div className="grid grid-cols-2 gap-2 text-xs sm:text-sm tabular-nums">
				<div className="rounded-md bg-muted/40 p-2">
					<span className="block text-muted-foreground text-[11px]">Skema</span>
					{order.paymentPlan === 'dp' ? `DP ${formatStoreMoney(order.dpAmount || 0, currency)}` : 'Bayar penuh'}
				</div>
				<div className="rounded-md bg-muted/40 p-2">
					<span className="block text-muted-foreground text-[11px]">Sudah dibayar (terverifikasi)</span>
					{formatStoreMoney(st.amountPaid, currency)}
				</div>
				<div className="rounded-md bg-muted/40 p-2">
					<span className="block text-muted-foreground text-[11px]">Sisa tagihan</span>
					<strong>{formatStoreMoney(st.balanceDue, currency)}</strong>
				</div>
				<div className="rounded-md bg-muted/40 p-2">
					<span className="block text-muted-foreground text-[11px]">Tenggat pelunasan</span>
					{order.settleBy ? formatDateId(order.settleBy) : '—'}
				</div>
			</div>

			{order.cancelRequestedAt && !cancelled && (
				<p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
					Permintaan pembatalan sudah dikirim ke admin. Admin akan menghubungi kamu.
				</p>
			)}

			{!cancelled && st.nextKind && step === 'info' && (
				<div className="space-y-3">
					<p className="text-sm">
						Bayar <strong>{kindText(st.nextKind)}</strong> sebesar{' '}
						<strong className="text-primary">{formatStoreMoney(nextAmount, currency)}</strong> ke salah satu:
					</p>
					{order.settleBy && st.nextKind === 'balance' && (
						<p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
							<CalendarClock className="h-3.5 w-3.5" /> Lunasi sebelum {formatDateId(order.settleBy)}.
						</p>
					)}
					<div className="grid gap-3 sm:grid-cols-2">
						{channels.map((c) => (
							<div key={c.id} className="rounded-lg border p-3 space-y-2">
								<p className="text-sm font-semibold flex items-center gap-1.5">
									{c.type === 'qris' ? <QrCode className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
									{channelTitle(c)}
								</p>
								{c.type === 'qris' ? (
									<>
										<img
											src={c.qrisImageUrl}
											alt={`QRIS ${c.merchantName}`}
											className="w-full max-w-[260px] mx-auto rounded-md bg-white p-2"
											loading="lazy"
										/>
										<p className="text-xs text-center text-muted-foreground">Merchant: {c.merchantName}</p>
										<Button asChild variant="outline" size="sm" className="w-full">
											<a href={c.qrisImageUrl} download={`QRIS-${c.merchantName}.webp`}>
												<Download className="h-3.5 w-3.5 mr-1.5" /> Unduh QRIS
											</a>
										</Button>
									</>
								) : (
									<div className="text-sm space-y-1">
										<div className="flex items-center justify-between gap-2">
											<span className="font-mono tracking-wide break-all">{c.accountNumber}</span>
											<Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copy(c.accountNumber.replace(/\D/g, ''))}>
												<Copy className="h-3.5 w-3.5" />
											</Button>
										</div>
										<p className="text-xs text-muted-foreground">a.n. {c.accountHolder}</p>
									</div>
								)}
								{c.note && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.note}</p>}
							</div>
						))}
					</div>
					<div className="flex flex-col sm:flex-row gap-2">
						<Button className="flex-1" onClick={() => setStep('upload')}>
							<Check className="h-4 w-4 mr-1.5" /> Saya sudah bayar
						</Button>
						{waDigits && (
							<Button asChild variant="outline" className="flex-1">
								<a href={`https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">
									<FaWhatsapp className="h-4 w-4 mr-1.5" /> Tanya / konfirmasi via WA
								</a>
							</Button>
						)}
					</div>
					<p className="text-[11px] text-muted-foreground">Belum sempat bayar? Tidak apa-apa, buka lagi halaman ini kapan saja dari Riwayat pesanan.</p>
				</div>
			)}

			{!cancelled && st.nextKind && step === 'upload' && (
				<div className="space-y-3 rounded-lg border p-3">
					<p className="text-sm font-medium">Upload bukti {kindText(st.nextKind)} ({formatStoreMoney(nextAmount, currency)})</p>
					{channels.length > 1 && (
						<div className="space-y-1">
							<Label className="text-xs">Dibayar lewat</Label>
							<select
								className="w-full rounded-md border bg-background px-3 py-2 text-sm"
								value={channelId}
								onChange={(e) => setChannelId(e.target.value)}>
								{channels.map((c) => (
									<option key={c.id} value={c.id}>
										{channelTitle(c)}
									</option>
								))}
							</select>
						</div>
					)}
					<input
						ref={fileRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={(e) => pickFile(e.target.files?.[0] || null)}
					/>
					{previewUrl ? (
						<img src={previewUrl} alt="Pratinjau bukti" className="max-h-72 mx-auto rounded-md border" />
					) : null}
					<Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
						<ImageUp className="h-4 w-4 mr-1.5" /> {file ? 'Ganti foto' : 'Pilih foto / screenshot bukti'}
					</Button>
					<p className="text-[11px] text-muted-foreground">Gambar saja (JPG/PNG/WebP/HEIC), maks 5 MB. Pastikan nominal & tanggal terlihat jelas.</p>
					<div className="flex gap-2">
						<Button variant="ghost" onClick={() => { pickFile(null); setStep('info'); }} disabled={busy}>
							<ArrowLeft className="h-4 w-4 mr-1" /> Kembali
						</Button>
						<Button className="flex-1" onClick={submitProof} disabled={busy || !file}>
							{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Kirim bukti'}
						</Button>
					</div>
				</div>
			)}

			{payments.length > 0 && (
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground">Riwayat pembayaran</p>
					{payments.map((p) => (
						<div key={p.id} className="flex items-start justify-between gap-3 rounded-md border p-2 text-xs">
							<div className="min-w-0">
								<p className="font-medium">
									{STORE_PAYMENT_KIND_LABEL[p.kind]} · {formatStoreMoney(p.amount, currency)}
								</p>
								<p className="text-muted-foreground">{new Date(p.uploadedAt).toLocaleString('id-ID')}</p>
								{p.status === 'rejected' && p.rejectReason && (
									<p className="text-rose-600 dark:text-rose-400">Ditolak: {p.rejectReason} — silakan upload ulang.</p>
								)}
								{p.proofUrl && (
									<a className="text-primary underline" href={`${base}/payment-proof/${p.id}${q}`} target="_blank" rel="noopener noreferrer">
										Lihat bukti
									</a>
								)}
							</div>
							<span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${p.status === 'verified' ? statusTone.paid : p.status === 'rejected' ? statusTone.rejected : statusTone.awaiting_verification}`}>
								{p.status === 'verified' ? 'Terverifikasi' : p.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
							</span>
						</div>
					))}
				</div>
			)}

			{!cancelled && !order.cancelRequestedAt && (
				<Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setCancelOpen(true)}>
					<XCircle className="h-3.5 w-3.5 mr-1.5" />
					{canSelfCancel ? 'Batalkan pesanan' : 'Ajukan pembatalan ke admin'}
				</Button>
			)}

			<AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{canSelfCancel ? 'Batalkan pesanan?' : 'Ajukan pembatalan?'}</AlertDialogTitle>
						<AlertDialogDescription>
							{canSelfCancel
								? 'Pesanan belum dibayar, jadi bisa langsung dibatalkan. Stok akan dikembalikan.'
								: 'Pesanan ini sudah ada pembayaran. Pembatalan & pengembalian dana diputuskan admin toko; admin akan menghubungi kamu.'}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<Textarea
						placeholder="Alasan (opsional)"
						value={cancelReason}
						onChange={(e) => setCancelReason(e.target.value.slice(0, 300))}
						rows={3}
					/>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>Tidak jadi</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								void doCancel();
							}}
							disabled={busy}>
							{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : canSelfCancel ? 'Ya, batalkan' : 'Kirim permintaan'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
