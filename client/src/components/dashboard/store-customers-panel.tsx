import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2, Search, ShieldBan, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText, apiRequest } from '@/lib/queryClient';
import { useApiUrl } from '@/lib/tenant-context';
import { formatStoreMoney } from '@shared/store-currency';
import { STORE_ORDER_STATUS_LABEL } from '@shared/store-order-status';

interface CustomerRow {
	id: string;
	name: string;
	email: string;
	phone: string;
	status: string;
	loginMethods: string[];
	createdAt: string;
	lastLoginAt: string | null;
	orders: number;
	totalSpent: number;
	lastOrderAt: string | null;
}

function CustomerDetail({ id, currency }: { id: string; currency: string }) {
	const url = useApiUrl(`/store/admin/customers/${id}`);
	const { data, isLoading } = useQuery<any>({
		queryKey: [url],
		queryFn: async () => {
			const r = await fetch(url, { credentials: 'include' });
			if (!r.ok) throw new Error('detail');
			return r.json();
		},
	});
	if (isLoading) return <Loader2 className="h-4 w-4 animate-spin my-2" />;
	return (
		<div className="space-y-1 text-xs">
			{(data?.orders || []).map((o: any) => (
				<div key={o.orderNo} className="flex flex-wrap justify-between gap-2 rounded bg-muted/40 px-2 py-1">
					<span className="font-mono">{o.orderNo}</span>
					<span>{STORE_ORDER_STATUS_LABEL[o.status] || o.status}</span>
					<span className="tabular-nums">{formatStoreMoney(o.total, currency)}</span>
				</div>
			))}
		</div>
	);
}

/**
 * Tab Pelanggan: akun pembeli yang pernah memesan di toko ini (bukan User Management staf).
 * Tanpa toko.customers.manage, email/HP disamarkan dan tombol blokir tidak tampil.
 */
export function StoreCustomersPanel({ currency }: { currency: string }) {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [q, setQ] = useState('');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);
	const listUrl = useApiUrl('/store/admin/customers');
	const key = [listUrl, search, page];
	const { data, isLoading, isError } = useQuery<{ items: CustomerRow[]; total: number; limit: number; canManage: boolean }>({
		queryKey: key,
		queryFn: async () => {
			const r = await fetch(`${listUrl}?q=${encodeURIComponent(search)}&page=${page}`, { credentials: 'include' });
			if (!r.ok) throw new Error('customers');
			return r.json();
		},
	});
	const setStatus = useMutation({
		mutationFn: async ({ id, status }: { id: string; status: string }) => {
			await apiRequest('PATCH', `${listUrl}/${id}/status`, { status });
		},
		onSuccess: (_d, v) => {
			void qc.invalidateQueries({ queryKey: [listUrl] });
			toast({ title: v.status === 'blocked' ? 'Akun pembeli diblokir & dikeluarkan dari semua perangkat' : 'Akun pembeli dibuka kembali' });
		},
		onError: (e) => toast({ title: apiErrorText(e, 'Gagal mengubah status'), variant: 'destructive' }),
	});
	const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 20)));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Pelanggan</CardTitle>
				<CardDescription>
					Akun pembeli yang pernah memesan di toko ini. Akun pembeli terpisah dari akun pengurus (tidak ada di User Management) dan tidak
					bisa membuka dashboard.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						setPage(1);
						setSearch(q.trim());
					}}>
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / email / no HP" />
					<Button type="submit" variant="outline" className="gap-2 shrink-0">
						<Search className="h-4 w-4" /> Cari
					</Button>
				</form>
				{data && !data.canManage && <p className="text-xs text-muted-foreground">Email & no HP disamarkan (perlu permission toko.customers.manage).</p>}
				{isLoading ? (
					<Loader2 className="h-6 w-6 animate-spin mx-auto my-6 text-muted-foreground" />
				) : isError ? (
					<p className="text-sm text-destructive">Gagal memuat pelanggan.</p>
				) : !data?.items.length ? (
					<p className="text-sm text-muted-foreground">Belum ada pembeli berakun yang memesan.</p>
				) : (
					<div className="space-y-2">
						{data.items.map((c) => (
							<Collapsible key={c.id} className="rounded-md border">
								<div className="flex flex-wrap items-center gap-2 p-3">
									<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
										<ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=open]_&]:rotate-180" />
										<div className="min-w-0">
											<p className="text-sm font-medium break-words">
												{c.name || '(tanpa nama)'}{' '}
												{c.status === 'blocked' && (
													<Badge variant="destructive" className="text-[10px]">
														Diblokir
													</Badge>
												)}
											</p>
											<p className="text-xs text-muted-foreground break-all">
												{c.email}
												{c.phone ? ` · ${c.phone}` : ''} · {c.loginMethods.join(' + ') || '-'}
											</p>
										</div>
									</CollapsibleTrigger>
									<div className="text-right text-xs">
										<p className="font-semibold tabular-nums">{formatStoreMoney(c.totalSpent, currency)}</p>
										<p className="text-muted-foreground">{c.orders} pesanan</p>
									</div>
									{data.canManage && (
										<Button
											size="sm"
											variant={c.status === 'blocked' ? 'outline' : 'ghost'}
											className="gap-1"
											disabled={setStatus.isPending}
											onClick={() => {
												const blocked = c.status === 'blocked';
												if (!blocked && !window.confirm(`Blokir akun ${c.name || c.email}? Pembeli langsung keluar dari semua perangkat.`)) return;
												setStatus.mutate({ id: c.id, status: blocked ? 'active' : 'blocked' });
											}}>
											{c.status === 'blocked' ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldBan className="h-3.5 w-3.5" />}
											{c.status === 'blocked' ? 'Buka blokir' : 'Blokir'}
										</Button>
									)}
								</div>
								<CollapsibleContent className="border-t px-3 py-2">
									<CustomerDetail id={c.id} currency={currency} />
								</CollapsibleContent>
							</Collapsible>
						))}
					</div>
				)}
				{pages > 1 && (
					<div className="flex items-center justify-end gap-2 text-sm">
						<Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
							Sebelumnya
						</Button>
						<span>
							{page}/{pages}
						</span>
						<Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
							Berikutnya
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
