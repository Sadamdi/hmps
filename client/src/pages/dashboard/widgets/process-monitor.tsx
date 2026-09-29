import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Cpu, HardDrive, ListTree, MemoryStick, Network, Pause, Play, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { overviewCardClass } from './widget-styles';

type SortKey = 'cpu' | 'memBytes' | 'diskReadRate' | 'diskPercent' | 'sockets' | 'threads' | 'uptimeSec' | 'pid' | 'name';

interface ProcessRow {
	pid: number;
	name: string;
	service: string;
	command: string;
	user: string;
	state: string;
	threads: number;
	cpu: number;
	memBytes: number;
	memPercent: number;
	diskReadRate: number;
	diskWriteRate: number;
	diskPercent: number;
	sockets: number;
	uptimeSec: number;
}

interface ProcessSnapshot {
	supported: boolean;
	intervalSec: number;
	cores: number;
	memTotal: number;
	totals: { cpu: number; memBytes: number; diskReadRate: number; diskWriteRate: number; netRxRate: number; netTxRate: number; processCount: number };
	processes: ProcessRow[];
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
	{ key: 'cpu', label: 'CPU' },
	{ key: 'memBytes', label: 'RAM' },
	{ key: 'diskReadRate', label: 'Disk (baca+tulis)' },
	{ key: 'diskPercent', label: 'Disk %' },
	{ key: 'sockets', label: 'Koneksi jaringan' },
	{ key: 'threads', label: 'Thread' },
	{ key: 'uptimeSec', label: 'Lama berjalan' },
	{ key: 'name', label: 'Nama' },
	{ key: 'pid', label: 'PID' },
];

function fmtBytes(b: number): string {
	if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
	if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
	if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
	return `${b} B`;
}
const fmtRate = (b: number) => (b > 0 ? `${fmtBytes(b)}/s` : '0');
function fmtUptime(s: number): string {
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	return d ? `${d}h ${h}j` : h ? `${h}j ${m}m` : `${m}m`;
}

/** Warna sel "heat" seperti Task Manager: makin berat makin pekat. */
function heat(pct: number): string {
	if (pct >= 50) return 'bg-red-500/25';
	if (pct >= 20) return 'bg-orange-500/20';
	if (pct >= 5) return 'bg-amber-500/15';
	if (pct > 0) return 'bg-amber-500/5';
	return '';
}

export default function ProcessMonitor() {
	const [sort, setSort] = useState<SortKey>('cpu');
	const [dir, setDir] = useState<'desc' | 'asc'>('desc');
	const [limit, setLimit] = useState(20);
	const [paused, setPaused] = useState(false);
	const [filter, setFilter] = useState('');

	// saat mencari, ambil 100 proses agar hasil pencarian tidak terbatas pada top-N
	const fetchLimit = filter.trim() ? 100 : limit;
	const { data, isLoading, isError } = useQuery<ProcessSnapshot>({
		queryKey: ['/api/dashboard/processes', sort, dir, fetchLimit],
		queryFn: async () => {
			const qs = new URLSearchParams({ sort, dir, limit: String(fetchLimit) });
			const res = await fetch(`/api/dashboard/processes?${qs}`, { credentials: 'include' });
			if (!res.ok) throw new Error('Gagal memuat proses');
			return (await res.json()).data;
		},
		refetchInterval: paused ? false : 3000,
		refetchIntervalInBackground: false,
		placeholderData: (prev) => prev,
	});

	const rows = useMemo(() => {
		const list = data?.processes || [];
		const q = filter.trim().toLowerCase();
		const hit = q ? list.filter((p) => `${p.service} ${p.name} ${p.command} ${p.user} ${p.pid}`.toLowerCase().includes(q)) : list;
		return hit.slice(0, limit);
	}, [data, filter, limit]);

	const clickHeader = (key: SortKey) => {
		if (key === sort) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
		else {
			setSort(key);
			setDir(key === 'name' || key === 'pid' ? 'asc' : 'desc');
		}
	};

	const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
		<th className={`px-2 py-2 font-medium whitespace-nowrap ${className}`}>
			<button type="button" onClick={() => clickHeader(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${sort === k ? 'text-foreground' : ''}`}>
				{children}
				{sort === k && (dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
			</button>
		</th>
	);

	const t = data?.totals;
	const memPct = t && data ? Math.round((t.memBytes / data.memTotal) * 100) : 0;

	return (
		<Card className={overviewCardClass}>
			<CardHeader className="pb-3 space-y-3">
				<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						<CardTitle className="text-base sm:text-lg flex items-center gap-2">
							<ListTree className="h-5 w-5 text-primary" /> Process Monitor
						</CardTitle>
						<CardDescription>
							Proses server seperti Task Manager · diperbarui tiap 3 detik{paused ? ' (dijeda)' : ''}
						</CardDescription>
					</div>
					{t && (
						<div className="grid grid-cols-2 sm:flex gap-x-4 gap-y-1 text-xs text-muted-foreground">
							<span className="inline-flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> {t.cpu}% · {data?.cores} core</span>
							<span className="inline-flex items-center gap-1"><MemoryStick className="h-3.5 w-3.5" /> {fmtBytes(t.memBytes)} ({memPct}%)</span>
							<span className="inline-flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> R {fmtRate(t.diskReadRate)} · W {fmtRate(t.diskWriteRate)}</span>
							<span className="inline-flex items-center gap-1"><Network className="h-3.5 w-3.5" /> ↓ {fmtRate(t.netRxRate)} · ↑ {fmtRate(t.netTxRate)}</span>
						</div>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="relative min-w-0 flex-1 basis-40">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input className="pl-9 h-9" placeholder="Cari proses / service / PID" value={filter} onChange={(e) => setFilter(e.target.value)} />
					</div>
					<Select value={sort} onValueChange={(v) => clickHeader(v as SortKey)}>
						<SelectTrigger className="h-9 w-[10.5rem]" aria-label="Urutkan berdasarkan">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SORT_OPTIONS.map((o) => (
								<SelectItem key={o.key} value={o.key}>Urut: {o.label}</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))} aria-label="Balik urutan">
						{dir === 'desc' ? <ArrowDown className="h-4 w-4 mr-1" /> : <ArrowUp className="h-4 w-4 mr-1" />}
						{dir === 'desc' ? 'Terbanyak' : 'Tersedikit'}
					</Button>
					<Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
						<SelectTrigger className="h-9 w-[5.5rem]" aria-label="Jumlah baris">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{[10, 20, 50, 100].map((n) => (
								<SelectItem key={n} value={String(n)}>{n}</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Lanjutkan' : 'Jeda'}>
						{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="px-0 sm:px-6">
				{isLoading && <p className="px-6 text-sm text-muted-foreground">Memuat proses…</p>}
				{isError && <p className="px-6 text-sm text-destructive">Gagal memuat data proses.</p>}
				{data && !data.supported && <p className="px-6 text-sm text-muted-foreground">Process monitor hanya tersedia di server Linux (production).</p>}
				{data?.supported && rows.length === 0 && <p className="px-6 text-sm text-muted-foreground">Tidak ada proses yang cocok.</p>}

				{data?.supported && rows.length > 0 && (
					<>
						{/* Desktop: tabel lengkap */}
						<div className="hidden md:block overflow-x-auto rounded-lg border border-border/60">
							<table className="w-full text-sm">
								<thead className="bg-muted/40 text-xs text-muted-foreground text-left">
									<tr>
										<Th k="name">Service / Proses</Th>
										<Th k="pid" className="text-right">PID</Th>
										<th className="px-2 py-2 font-medium">User</th>
										<Th k="cpu" className="text-right">CPU</Th>
										<Th k="memBytes" className="text-right">RAM</Th>
										<Th k="diskReadRate" className="text-right">Disk R/W</Th>
										<Th k="diskPercent" className="text-right">Disk %</Th>
										<Th k="sockets" className="text-right">Koneksi</Th>
										<Th k="threads" className="text-right">Thread</Th>
										<Th k="uptimeSec" className="text-right">Berjalan</Th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/50">
									{rows.map((p) => (
										<tr key={p.pid} className="hover:bg-muted/30">
											<td className="px-2 py-1.5 max-w-[22rem]">
												<div className="font-medium truncate" title={p.command}>{p.service}</div>
												<div className="text-xs text-muted-foreground truncate" title={p.command}>{p.command}</div>
											</td>
											<td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{p.pid}</td>
											<td className="px-2 py-1.5 text-muted-foreground">{p.user}</td>
											<td className={`px-2 py-1.5 text-right tabular-nums ${heat(p.cpu)}`}>{p.cpu.toFixed(1)}%</td>
											<td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${heat(p.memPercent)}`}>
												{fmtBytes(p.memBytes)} <span className="text-xs text-muted-foreground">({p.memPercent}%)</span>
											</td>
											<td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-xs">
												{fmtRate(p.diskReadRate)} / {fmtRate(p.diskWriteRate)}
											</td>
											<td className={`px-2 py-1.5 text-right tabular-nums ${heat(p.diskPercent)}`}>{p.diskPercent}%</td>
											<td className="px-2 py-1.5 text-right tabular-nums">{p.sockets}</td>
											<td className="px-2 py-1.5 text-right tabular-nums">{p.threads}</td>
											<td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">{fmtUptime(p.uptimeSec)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Mobile: kartu ringkas */}
						<ul className="md:hidden divide-y divide-border/60 border-y border-border/60">
							{rows.map((p) => (
								<li key={p.pid} className="px-4 py-2.5">
									<div className="flex items-baseline justify-between gap-2">
										<span className="font-medium truncate min-w-0">{p.service}</span>
										<span className="text-xs text-muted-foreground shrink-0">PID {p.pid} · {p.user}</span>
									</div>
									<div className="mt-1.5 grid grid-cols-4 gap-1 text-xs tabular-nums">
										<span className={`rounded px-1.5 py-1 ${heat(p.cpu)} ${sort === 'cpu' ? 'ring-1 ring-primary/50' : ''}`}>
											<span className="block text-[10px] text-muted-foreground">CPU</span>{p.cpu.toFixed(1)}%
										</span>
										<span className={`rounded px-1.5 py-1 ${heat(p.memPercent)} ${sort === 'memBytes' ? 'ring-1 ring-primary/50' : ''}`}>
											<span className="block text-[10px] text-muted-foreground">RAM {p.memPercent}%</span>{fmtBytes(p.memBytes)}
										</span>
										<span className={`rounded px-1.5 py-1 ${heat(p.diskPercent)} ${sort === 'diskReadRate' || sort === 'diskPercent' ? 'ring-1 ring-primary/50' : ''}`}>
											<span className="block text-[10px] text-muted-foreground">Disk {p.diskPercent}%</span>{fmtRate(p.diskReadRate + p.diskWriteRate)}
										</span>
										<span className={`rounded px-1.5 py-1 ${sort === 'sockets' ? 'ring-1 ring-primary/50' : ''}`}>
											<span className="block text-[10px] text-muted-foreground">Koneksi</span>{p.sockets}
										</span>
									</div>
								</li>
							))}
						</ul>
						<p className="px-4 sm:px-0 mt-2 text-[11px] text-muted-foreground">
							{t?.processCount} proses. CPU % = porsi dari seluruh core. Linux tidak mencatat trafik jaringan per proses, jadi kolom Koneksi menampilkan jumlah socket terbuka; laju jaringan total ada di atas.
						</p>
					</>
				)}
			</CardContent>
		</Card>
	);
}
