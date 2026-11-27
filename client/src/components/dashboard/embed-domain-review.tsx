/**
 * Panel admin: hasil analisis otomatis domain embed (allowlist pintar).
 * Domain baru dianalisis sekali oleh server; di sini admin melihat yang diblokir/izinkan,
 * lalu bisa mengizinkan, memblokir, menjadikan kartu tautan, atau menganalisis ulang.
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ban, CheckCircle2, Link2, Loader2, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface EmbedDomainRecord {
	host: string;
	status: 'pending' | 'allowed' | 'noframe' | 'blocked';
	reason: string;
	checks: string[];
	sampleUrl: string;
	pageTitle: string;
	aiVerdict: string;
	decidedBy: 'auto' | 'admin' | 'seed';
	decidedByName: string;
	analysisCount: number;
	analyzedAt: string | null;
	seenCount: number;
	history?: { at: string; from: string; to: string; by: string; reason: string }[];
}

const STATUS_LABEL: Record<EmbedDomainRecord['status'], { text: string; cls: string }> = {
	blocked: { text: 'Diblokir', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
	allowed: { text: 'Diizinkan', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
	noframe: { text: 'Kartu tautan', cls: 'bg-slate-500/15 text-slate-700 dark:text-slate-300' },
	pending: { text: 'Dianalisis…', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
};

const FILTERS = [
	{ v: 'blocked', label: 'Diblokir' },
	{ v: 'allowed', label: 'Diizinkan' },
	{ v: 'noframe', label: 'Kartu tautan' },
	{ v: '', label: 'Semua' },
] as const;

export function useEmbedDomains(status: string, q: string) {
	return useQuery<{ items: EmbedDomainRecord[]; counts: Record<string, number> }>({
		queryKey: ['/api/embed-domains', status, q],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (status) params.set('status', status);
			if (q) params.set('q', q);
			const res = await apiRequest('GET', `/api/embed-domains?${params.toString()}`);
			const body = await res.json();
			return { items: body.data || [], counts: body.meta || {} };
		},
	});
}

export default function EmbedDomainReview({ canEdit }: { canEdit: boolean }) {
	const { toast } = useToast();
	const [status, setStatus] = useState<string>('blocked');
	const [q, setQ] = useState('');
	const { data, isLoading, isError, refetch } = useEmbedDomains(status, q.trim());

	const act = useMutation({
		mutationFn: async (v: { host: string; op: 'allowed' | 'blocked' | 'noframe' | 'reanalyze' | 'delete' | 'undo' }) => {
			const h = encodeURIComponent(v.host);
			if (v.op === 'reanalyze') return apiRequest('POST', `/api/embed-domains/${h}/reanalyze`);
			if (v.op === 'undo') return apiRequest('POST', `/api/embed-domains/${h}/undo`);
			if (v.op === 'delete') return apiRequest('DELETE', `/api/embed-domains/${h}`);
			return apiRequest('POST', `/api/embed-domains/${h}/decision`, { status: v.op });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/embed-domains'] });
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			toast({ title: 'Domain diperbarui' });
		},
		onError: (e: any) => toast({ title: 'Gagal', description: String(e?.message || 'Coba lagi'), variant: 'destructive' }),
	});

	const counts = data?.counts || {};
	return (
		<div className="space-y-3">
			<div>
				<h4 className="text-sm font-semibold">Analisis otomatis domain</h4>
				<p className="text-xs text-muted-foreground">
					Domain embed baru di konten (mis. README karya) diperiksa <strong>sekali</strong>: https, DNS publik, kata terlarang,
					respons halaman, header framing, dan penilaian <strong>Enco</strong>. Lolos → otomatis masuk daftar tambahan. Domain yang sudah diputuskan tidak
					dianalisis ulang kecuali Anda menekan <em>Analisis ulang</em>.
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				{FILTERS.map((f) => (
					<Button key={f.v || 'all'} type="button" size="sm" variant={status === f.v ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setStatus(f.v)}>
						{f.label}
						{f.v && counts[f.v] ? <span className="ml-1 opacity-70">({counts[f.v]})</span> : null}
					</Button>
				))}
				<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari domain…" className="h-7 w-36 text-xs" />
				<Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => refetch()} aria-label="Muat ulang daftar">
					<RefreshCw className="h-3.5 w-3.5" />
				</Button>
			</div>
			{isLoading ? (
				<p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat…</p>
			) : isError ? (
				<p className="text-xs text-red-600">Gagal memuat daftar domain.</p>
			) : !data?.items.length ? (
				<p className="text-xs text-muted-foreground">Belum ada domain pada filter ini.</p>
			) : (
				<ul className="space-y-2">
					{data.items.map((d) => {
						const s = STATUS_LABEL[d.status];
						const busy = act.isPending && act.variables?.host === d.host;
						return (
							<li key={d.host} className="rounded-md border border-border p-2.5 text-xs">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-mono text-sm font-medium break-all">{d.host}</span>
									<span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.text}</span>
									<span className="text-muted-foreground">
										{d.decidedBy === 'admin' ? `oleh ${d.decidedByName || 'admin'}` : 'oleh Enco'} · dilihat {d.seenCount}× · dianalisis {d.analysisCount}×
									</span>
								</div>
								<p className="mt-1 text-foreground/90">{d.reason}</p>
								{d.pageTitle ? <p className="text-muted-foreground truncate">Judul: {d.pageTitle}</p> : null}
								{d.checks?.length ? <p className="text-muted-foreground">{d.checks.join(' · ')}</p> : null}
								{d.history?.length ? (
									<details className="mt-1">
										<summary className="cursor-pointer text-muted-foreground">Riwayat keputusan ({d.history.length})</summary>
										<ul className="mt-1 space-y-0.5 text-muted-foreground">
											{d.history.map((h, i) => (
												<li key={i}>
													{new Date(h.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} · {h.by}: {STATUS_LABEL[h.from as EmbedDomainRecord['status']]?.text || h.from} → {STATUS_LABEL[h.to as EmbedDomainRecord['status']]?.text || h.to}
													{h.reason ? ` — ${h.reason}` : ''}
												</li>
											))}
										</ul>
									</details>
								) : null}
								{d.sampleUrl ? (
									<a href={d.sampleUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-primary break-all hover:underline">
										{d.sampleUrl}
									</a>
								) : null}
								{canEdit ? (
									<div className="mt-2 flex flex-wrap gap-1.5">
										{d.status !== 'allowed' ? (
											<Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => act.mutate({ host: d.host, op: 'allowed' })}>
												<CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Izinkan
											</Button>
										) : null}
										{d.status !== 'blocked' ? (
											<Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => act.mutate({ host: d.host, op: 'blocked' })}>
												<Ban className="mr-1 h-3.5 w-3.5" /> Blokir
											</Button>
										) : null}
										{d.status !== 'noframe' ? (
											<Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => act.mutate({ host: d.host, op: 'noframe' })}>
												<Link2 className="mr-1 h-3.5 w-3.5" /> Jadikan kartu tautan
											</Button>
										) : null}
										{d.history?.[0]?.from && d.history[0].from !== 'pending' && d.history[0].from !== d.status ? (
											<Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => act.mutate({ host: d.host, op: 'undo' })}>
												<Undo2 className="mr-1 h-3.5 w-3.5" /> Batalkan ({STATUS_LABEL[d.history[0].from as EmbedDomainRecord['status']]?.text || d.history[0].from})
											</Button>
										) : null}
										<Button type="button" size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => act.mutate({ host: d.host, op: 'reanalyze' })}>
											{busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />} Analisis ulang
										</Button>
										<Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-600" disabled={busy} onClick={() => act.mutate({ host: d.host, op: 'delete' })}>
											<Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus catatan
										</Button>
									</div>
								) : null}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
