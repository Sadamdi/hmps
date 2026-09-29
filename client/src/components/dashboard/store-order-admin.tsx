import { useEffect, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatStoreMoney } from '@shared/store-currency';
import {
	STORE_ORDER_STATUS_FLOW,
	STORE_ORDER_STATUS_LABEL,
	STORE_PAYMENT_METHOD_LABEL,
} from '@shared/store-order-status';

const STATUS_BADGE: Record<string, string> = {
	pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
	confirmed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
	paid: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
	shipped: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
	completed: 'bg-green-600/15 text-green-700 dark:text-green-400',
	cancelled: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

export type OrderPatch = { status?: string; paymentMethod?: string; paidAt?: string | null; adminNote?: string };

interface StoreOrderAdminCardProps {
	order: any;
	currency: string;
	saving: boolean;
	onPatch: (orderNo: string, patch: OrderPatch) => void;
	onDelete: (orderNo: string) => void;
}

function toDateInput(v: unknown): string {
	if (!v) return '';
	const d = new Date(String(v));
	return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Kartu pesanan di Dashboard → Toko → Pesanan: status, pembayaran, catatan, rincian barang. */
export function StoreOrderAdminCard({ order: o, currency, saving, onPatch, onDelete }: StoreOrderAdminCardProps) {
	const [note, setNote] = useState(o.adminNote || '');
	useEffect(() => setNote(o.adminNote || ''), [o.adminNote]);

	return (
		<div className="space-y-3 rounded-lg border p-3">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-semibold">{o.orderNo}</span>
						<Badge className={`border-0 ${STATUS_BADGE[o.status] || ''}`}>{STORE_ORDER_STATUS_LABEL[o.status] || o.status}</Badge>
					</div>
					<p className="mt-0.5 text-muted-foreground">
						{new Date(o.createdAt).toLocaleString('id-ID')} · {o.customerName} · {o.customerPhone}
						{o.whatsappAdminName ? ` · admin ${o.whatsappAdminName}` : ''}
					</p>
					<p className="text-muted-foreground">
						{o.fulfillment === 'delivery' ? `Diantar: ${o.shippingAddress || '-'}` : 'Ambil di tempat'}
					</p>
				</div>
				<Button type="button" variant="outline" size="icon" aria-label="Hapus pesanan" onClick={() => onDelete(o.orderNo)}>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>

			<ul className="space-y-0.5 rounded-md bg-muted/40 p-2">
				{(o.items || []).map((it: any, i: number) => (
					<li key={i} className="flex justify-between gap-2">
						<span>
							{it.name}
							{it.variantLabel ? <span className="text-muted-foreground"> ({it.variantLabel})</span> : null} × {it.qty}
						</span>
						<span className="tabular-nums">{formatStoreMoney(it.lineSubtotal, it.currency || currency)}</span>
					</li>
				))}
				<li className="flex justify-between gap-2 border-t border-border pt-1 font-semibold">
					<span>Total{o.shippingCost ? ' (termasuk ongkir)' : ''}</span>
					<span className="tabular-nums">{formatStoreMoney(o.total, currency)}</span>
				</li>
			</ul>

			<div className="grid gap-3 sm:grid-cols-3">
				<div className="space-y-1">
					<Label className="text-xs">Status</Label>
					<Select value={o.status} disabled={saving} onValueChange={(status) => onPatch(o.orderNo, { status })}>
						<SelectTrigger className="h-9">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STORE_ORDER_STATUS_FLOW.map((s) => (
								<SelectItem key={s} value={s}>
									{STORE_ORDER_STATUS_LABEL[s]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Metode bayar</Label>
					<Select
						value={o.paymentMethod || 'none'}
						disabled={saving}
						onValueChange={(v) => onPatch(o.orderNo, { paymentMethod: v === 'none' ? '' : v })}>
						<SelectTrigger className="h-9">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">Belum diisi</SelectItem>
							{Object.entries(STORE_PAYMENT_METHOD_LABEL).map(([k, v]) => (
								<SelectItem key={k} value={k}>
									{v}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Tanggal bayar</Label>
					<Input
						type="date"
						className="h-9"
						disabled={saving}
						value={toDateInput(o.paidAt)}
						onChange={(e) => onPatch(o.orderNo, { paidAt: e.target.value || null })}
					/>
				</div>
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Catatan admin (tidak terlihat pembeli)</Label>
				<Textarea
					rows={2}
					maxLength={1000}
					value={note}
					placeholder="mis. sudah transfer ke BSI, ambil Kamis"
					onChange={(e) => setNote(e.target.value)}
					onBlur={() => note !== (o.adminNote || '') && onPatch(o.orderNo, { adminNote: note })}
				/>
			</div>
			<details className="text-xs">
				<summary className="cursor-pointer text-muted-foreground">Pesan WhatsApp yang dikirim pembeli</summary>
				<div className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2">{o.whatsappMessageSnapshot}</div>
			</details>
		</div>
	);
}

interface StoreOrderExportBarProps {
	exportUrl: string;
}

/** Unduh rekap pesanan (.xlsx) dengan filter tanggal & status. */
export function StoreOrderExportBar({ exportUrl }: StoreOrderExportBarProps) {
	const { toast } = useToast();
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');
	const [status, setStatus] = useState('all');
	const [busy, setBusy] = useState(false);

	const download = async () => {
		setBusy(true);
		try {
			const q = new URLSearchParams();
			if (from) q.set('from', from);
			if (to) q.set('to', to);
			if (status !== 'all') q.set('status', status);
			const res = await fetch(`${exportUrl}?${q.toString()}`, { credentials: 'include' });
			if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'Gagal export');
			const blob = await res.blob();
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `rekap-toko-${from || 'awal'}_${to || new Date().toISOString().slice(0, 10)}.xlsx`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(a.href), 2000);
		} catch (e) {
			toast({ title: 'Export gagal', description: (e as Error).message, variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
			<div className="space-y-1">
				<Label className="text-xs">Dari tanggal</Label>
				<Input type="date" className="h-9 w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Sampai</Label>
				<Input type="date" className="h-9 w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Status</Label>
				<Select value={status} onValueChange={setStatus}>
					<SelectTrigger className="h-9 w-[170px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Semua status</SelectItem>
						{STORE_ORDER_STATUS_FLOW.map((s) => (
							<SelectItem key={s} value={s}>
								{STORE_ORDER_STATUS_LABEL[s]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<Button type="button" onClick={download} disabled={busy} className="gap-2">
				{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
				Export Excel
			</Button>
		</div>
	);
}
