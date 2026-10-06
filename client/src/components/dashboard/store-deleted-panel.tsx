import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText, apiRequest } from '@/lib/queryClient';
import { useApiUrl } from '@/lib/tenant-context';

interface Row {
	_id: string;
	name: string;
	deletedAt: string;
	kind: 'products' | 'bundles';
}

/**
 * Produk & bundling yang dihapus (soft delete). Pembeli yang masih punya baris di keranjang melihat
 * "Produk sudah tidak dijual"; riwayat pesanan tetap utuh. Pulihkan mengembalikan sebagai draft.
 */
export function StoreDeletedPanel() {
	const { toast } = useToast();
	const qc = useQueryClient();
	const productsUrl = useApiUrl('/store/admin/products');
	const bundlesUrl = useApiUrl('/store/admin/bundles');
	const [open, setOpen] = useState(false);

	const { data: rows = [], isLoading } = useQuery<Row[]>({
		queryKey: ['store-deleted', productsUrl],
		enabled: open,
		queryFn: async () => {
			const [p, b] = await Promise.all([
				fetch(`${productsUrl}?deleted=1&limit=50`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { items: [] })),
				fetch(`${bundlesUrl}?deleted=1`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
			]);
			return [
				...(p.items || []).map((x: any) => ({ _id: x._id, name: x.name, deletedAt: x.deletedAt, kind: 'products' as const })),
				...(Array.isArray(b) ? b : []).map((x: any) => ({ _id: x._id, name: x.name, deletedAt: x.deletedAt, kind: 'bundles' as const })),
			];
		},
	});
	const restore = useMutation({
		mutationFn: async (r: Row) => {
			await apiRequest('POST', `${r.kind === 'products' ? productsUrl : bundlesUrl}/${r._id}/restore`);
		},
		onSuccess: () => {
			toast({ title: 'Dipulihkan sebagai draft. Terbitkan lagi bila sudah siap.' });
			void qc.invalidateQueries({ queryKey: ['store-deleted', productsUrl] });
			void qc.invalidateQueries({ queryKey: [productsUrl] });
			void qc.invalidateQueries({ queryKey: [bundlesUrl] });
		},
		onError: (e) => toast({ title: apiErrorText(e, 'Gagal memulihkan'), variant: 'destructive' }),
	});

	return (
		<Card className="mt-6">
			<CardHeader className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
				<div className="flex items-center justify-between gap-2">
					<div>
						<CardTitle className="text-base">Produk & bundling yang dihapus</CardTitle>
						<CardDescription>Bisa dipulihkan. Riwayat pesanan pembeli tidak terpengaruh.</CardDescription>
					</div>
					{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
				</div>
			</CardHeader>
			{open && (
				<CardContent>
					{isLoading ? (
						<Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
					) : rows.length === 0 ? (
						<p className="text-sm text-muted-foreground">Tidak ada yang dihapus.</p>
					) : (
						<ul className="divide-y">
							{rows.map((r) => (
								<li key={`${r.kind}-${r._id}`} className="flex items-center justify-between gap-3 py-2">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">
											{r.name} <span className="text-xs font-normal text-muted-foreground">({r.kind === 'products' ? 'produk' : 'bundling'})</span>
										</p>
										<p className="text-xs text-muted-foreground">Dihapus {r.deletedAt ? new Date(r.deletedAt).toLocaleDateString('id-ID') : ''}</p>
									</div>
									<Button size="sm" variant="outline" className="gap-1" disabled={restore.isPending} onClick={() => restore.mutate(r)}>
										<Undo2 className="h-3.5 w-3.5" /> Pulihkan
									</Button>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			)}
		</Card>
	);
}
