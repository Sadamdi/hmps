import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useApiUrl } from '@/lib/tenant-context';

const SERVICE_ACCOUNT = 'hmpsuinma@gen-lang-client-0095636115.iam.gserviceaccount.com';

type SyncInfo = {
	googleSheetId: string;
	enabled: boolean;
	status: { lastOkAt: string | null; lastError: string | null; lastErrorAt: string | null } | null;
};

/** Pengaturan sinkron otomatis pesanan → Google Sheet (Dashboard → Toko → Pengaturan toko). */
export function StoreSheetSyncCard() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const infoUrl = useApiUrl('/store/admin/sheet-sync');
	const settingsUrl = useApiUrl('/store/admin/settings');
	const { data } = useQuery<SyncInfo>({ queryKey: [infoUrl], refetchInterval: 30000 });
	const [link, setLink] = useState('');
	useEffect(() => {
		if (data?.googleSheetId) setLink(`https://docs.google.com/spreadsheets/d/${data.googleSheetId}/edit`);
	}, [data?.googleSheetId]);

	const refresh = () => queryClient.invalidateQueries({ queryKey: [infoUrl] });
	const errMsg = async (res: Response) => (await res.json().catch(() => ({})))?.message || 'Gagal';

	const test = useMutation({
		mutationFn: async () => {
			const res = await fetch(`${infoUrl}/test`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ googleSheetId: link }),
			});
			if (!res.ok) throw new Error(await errMsg(res));
			return res.json() as Promise<{ title: string }>;
		},
		onSuccess: (d) => {
			toast({ title: 'Terhubung', description: `Sheet "${d.title}" bisa diisi.` });
			refresh();
		},
		onError: (e: Error) => toast({ title: 'Belum bisa terhubung', description: e.message, variant: 'destructive' }),
	});
	const save = useMutation({
		mutationFn: async () => (await apiRequest('PUT', settingsUrl, { googleSheetId: link })).json(),
		onSuccess: () => {
			toast({ title: link ? 'Google Sheet disimpan' : 'Sinkron Google Sheet dimatikan' });
			queryClient.invalidateQueries({ queryKey: [settingsUrl] });
			refresh();
		},
		onError: (e: Error) => toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' }),
	});
	const resync = useMutation({
		mutationFn: async () => {
			const res = await fetch(`${infoUrl}/resync`, { method: 'POST', credentials: 'include' });
			if (!res.ok) throw new Error(await errMsg(res));
			return res.json() as Promise<{ count: number }>;
		},
		onSuccess: (d) => {
			toast({ title: 'Sinkron ulang selesai', description: `${d.count} pesanan ditulis ke Google Sheet.` });
			refresh();
		},
		onError: (e: Error) => toast({ title: 'Sinkron ulang gagal', description: e.message, variant: 'destructive' }),
	});

	const st = data?.status;
	const failing = !!st?.lastError && (!st.lastOkAt || (st.lastErrorAt || '') > st.lastOkAt);

	return (
		<CollapsibleCard
			title="Rekap otomatis ke Google Sheet"
			description="Setiap pesanan baru & perubahan status/pembayaran otomatis tertulis ke Google Sheet (format template rekap). Database tetap sumber utama — Export Excel di tab Pesanan tetap bisa dipakai."
			summary={failing ? 'Ada error sinkron — buka untuk detail' : link ? 'Tersambung' : 'Belum tersambung'}
			badge={failing ? <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-600">Error</span> : undefined}
			storageKey="toko-set-sheet"
			contentClassName="space-y-3 text-sm">
				<ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
					<li>Buat Google Sheet dari template rekap (File → Simpan sebagai Google Spreadsheet).</li>
					<li>
						Bagikan sebagai <b>Editor</b> ke <code className="rounded bg-muted px-1 text-xs">{SERVICE_ACCOUNT}</code>
					</li>
					<li>Tempel link-nya di bawah → Tes koneksi → Simpan → Sinkron ulang semua (sekali di awal).</li>
				</ol>
				<div className="flex flex-wrap gap-2">
					<Input
						className="min-w-[260px] flex-1"
						placeholder="https://docs.google.com/spreadsheets/d/…"
						value={link}
						onChange={(e) => setLink(e.target.value)}
					/>
					<Button type="button" variant="outline" disabled={!link || test.isPending} onClick={() => test.mutate()}>
						{test.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Tes koneksi
					</Button>
					<Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
						Simpan
					</Button>
				</div>
				{data?.googleSheetId && (
					<div className="flex flex-wrap items-center gap-3">
						{failing ? (
							<span className="flex items-center gap-1 text-destructive">
								<XCircle className="h-4 w-4" /> Gagal: {st?.lastError}
							</span>
						) : (
							<span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
								<CheckCircle2 className="h-4 w-4" />
								{st?.lastOkAt ? `Terakhir sinkron ${new Date(st.lastOkAt).toLocaleString('id-ID')}` : 'Aktif'}
							</span>
						)}
						<Button type="button" size="sm" variant="outline" disabled={resync.isPending} onClick={() => resync.mutate()} className="gap-1">
							{resync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
							Sinkron ulang semua
						</Button>
						<a
							className="inline-flex items-center gap-1 text-primary hover:underline"
							href={`https://docs.google.com/spreadsheets/d/${data.googleSheetId}/edit`}
							target="_blank"
							rel="noopener noreferrer">
							Buka sheet <ExternalLink className="h-3.5 w-3.5" />
						</a>
					</div>
				)}
		</CollapsibleCard>
	);
}
