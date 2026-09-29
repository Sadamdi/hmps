import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FaWhatsapp } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatStoreMoney } from '@shared/store-currency';
import { STORE_ORDER_STATUS_LABEL } from '@shared/store-order-status';
import { STORE_PAYMENT_STATUS_LABEL } from '@shared/store-payment';

const FILTERS: { key: string; label: string; match: (o: any) => boolean }[] = [
	{ key: 'all', label: 'Semua', match: () => true },
	{ key: 'waiting', label: 'Perlu verifikasi', match: (o) => ['awaiting_verification', 'balance_awaiting_verification'].includes(o.paymentStatus) },
	{ key: 'unpaid', label: 'Belum bayar', match: (o) => ['unpaid', 'rejected'].includes(o.paymentStatus || 'unpaid') },
	{ key: 'dp', label: 'Sudah DP (belum lunas)', match: (o) => o.paymentStatus === 'dp_verified' },
	{ key: 'paid', label: 'Lunas', match: (o) => o.paymentStatus === 'paid' },
	{ key: 'overdue', label: 'Lewat tenggat', match: (o) => !!o.settleBy && new Date(o.settleBy) < new Date() && o.paymentStatus !== 'paid' },
];

function waHref(phone: string, text: string) {
	let d = String(phone || '').replace(/\D/g, '');
	if (d.startsWith('0')) d = `62${d.slice(1)}`;
	return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/** Tab Pre-order: riwayat pesanan pre-order, siapa sudah DP / lunas / belum, tenggat, kontak. */
export function StorePreorderPanel({ preordersUrl, currency, onOpenOrders }: { preordersUrl: string; currency: string; onOpenOrders: () => void }) {
	const [filter, setFilter] = useState('all');
	const { data = [], isLoading } = useQuery<any[]>({
		queryKey: [preordersUrl],
		queryFn: async () => {
			const r = await fetch(preordersUrl, { credentials: 'include' });
			if (!r.ok) throw new Error('preorders');
			return r.json();
		},
	});
	const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, data.filter(f.match).length])), [data]);
	const rows = data.filter(FILTERS.find((f) => f.key === filter)!.match);
	const sum = (k: string) => rows.reduce((s, o) => s + (Number(o[k]) || 0), 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Pre-order</CardTitle>
				<CardDescription>
					Pesanan berisi barang pre-order. Verifikasi bukti & catat pembayaran di tab Pesanan; di sini untuk memantau siapa
					sudah DP, lunas, atau belum, beserta kontaknya.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap gap-2">
					{FILTERS.map((f) => (
						<Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
							{f.label} ({counts[f.key] ?? 0})
						</Button>
					))}
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
					<div className="rounded-md bg-muted/40 p-2">
						<span className="block text-xs text-muted-foreground">Total nilai</span>
						{formatStoreMoney(sum('total'), currency)}
					</div>
					<div className="rounded-md bg-muted/40 p-2">
						<span className="block text-xs text-muted-foreground">Uang masuk</span>
						{formatStoreMoney(sum('amountPaid'), currency)}
					</div>
					<div className="rounded-md bg-muted/40 p-2">
						<span className="block text-xs text-muted-foreground">Sisa tagihan</span>
						<strong>{formatStoreMoney(sum('balanceDue'), currency)}</strong>
					</div>
				</div>
				{isLoading ? (
					<Loader2 className="h-6 w-6 animate-spin mx-auto" />
				) : rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">Tidak ada pesanan pre-order untuk filter ini.</p>
				) : (
					<div className="space-y-2">
						{rows.map((o) => {
							const overdue = o.settleBy && new Date(o.settleBy) < new Date() && o.paymentStatus !== 'paid';
							return (
								<PreorderRow key={o.orderNo} o={o} overdue={!!overdue} currency={currency} onOpenOrders={onOpenOrders} />
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function PreorderRow({ o, overdue, currency, onOpenOrders }: { o: any; overdue: boolean; currency: string; onOpenOrders: () => void }) {
	const [open, setOpen] = useState(false);
	return (
		<Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border text-sm">
			<CollapsibleTrigger asChild>
				<button type="button" className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/30 rounded-lg transition-colors">
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-semibold">{o.orderNo}</span>
							<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{STORE_PAYMENT_STATUS_LABEL[o.paymentStatus || 'unpaid']}</span>
							{overdue && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-600">Lewat tenggat</span>}
						</div>
						<p className="truncate text-xs text-muted-foreground">
							{o.customerName} · sisa {formatStoreMoney(o.balanceDue ?? o.total, currency)}
							{o.settleBy ? ` · tenggat ${new Date(o.settleBy).toLocaleDateString('id-ID')}` : ''}
						</p>
					</div>
					<ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="space-y-1.5 border-t p-3">
					<p className="text-muted-foreground">
						{o.customerName} · {o.customerPhone} · {new Date(o.createdAt).toLocaleDateString('id-ID')} · {STORE_ORDER_STATUS_LABEL[o.status] || o.status}
					</p>
					<p className="text-xs">{(o.items || []).map((it: any) => `${it.name}${it.variantLabel ? ` (${it.variantLabel})` : ''} ×${it.qty}`).join(', ')}</p>
					<p className="text-xs tabular-nums">
						Total {formatStoreMoney(o.total, currency)} · {o.paymentPlan === 'dp' ? `DP ${formatStoreMoney(o.dpAmount || 0, currency)}` : 'penuh'} · masuk{' '}
						{formatStoreMoney(o.amountPaid || 0, currency)} · <strong>sisa {formatStoreMoney(o.balanceDue ?? o.total, currency)}</strong>
					</p>
					<div className="flex flex-wrap gap-2 pt-1">
						<Button asChild size="sm" variant="outline" className="h-8 text-xs">
							<a
								href={waHref(
									o.customerPhone,
									`Halo Kak ${o.customerName}, info pesanan pre-order ${o.orderNo}: sisa pembayaran ${formatStoreMoney(o.balanceDue ?? o.total, currency)}${o.settleBy ? `, paling lambat ${new Date(o.settleBy).toLocaleDateString('id-ID')}` : ''}.`,
								)}
								target="_blank"
								rel="noopener noreferrer">
								<FaWhatsapp className="h-3.5 w-3.5 mr-1" /> Hubungi
							</a>
						</Button>
						<Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onOpenOrders}>
							Kelola di tab Pesanan →
						</Button>
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
