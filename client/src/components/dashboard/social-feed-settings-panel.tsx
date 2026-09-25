import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import {
	DEFAULT_SOCIAL_FEED_CONFIG,
	normalizeManualUrls,
	normalizeSocialFeedConfig,
	type SocialFeedCache,
	type SocialFeedConfig,
	type SocialFeedLogEntry,
	type SocialPlatform,
	type SocialPlatformSyncStatus,
} from '@shared/social-feed';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Instagram, Loader2, RefreshCw, Trash2, XCircle, Youtube } from 'lucide-react';
import { useEffect, useState } from 'react';

type ManagePayload = {
	config: SocialFeedConfig;
	cache: SocialFeedCache;
	status?: Partial<Record<SocialPlatform, SocialPlatformSyncStatus>>;
	lastSocialFeedSyncAt?: string | null;
	nextScheduledSyncAt?: string;
	instagramSessionConfigured?: boolean;
	logs?: SocialFeedLogEntry[];
};

const KIND_LABEL: Record<string, string> = { video: 'Video', short: 'Shorts', live: 'Live', post: 'Post', reel: 'Reels' };

function formatWib(iso?: string | null) {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleString('id-ID', {
		timeZone: 'Asia/Jakarta',
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}) + ' WIB';
}

function formatRelative(iso?: string | null) {
	if (!iso) return 'belum pernah';
	const diff = Date.now() - new Date(iso).getTime();
	if (!Number.isFinite(diff)) return '—';
	const future = diff < 0;
	const abs = Math.abs(diff);
	const m = Math.round(abs / 60000);
	const text = m < 1 ? 'baru saja' : m < 60 ? `${m} menit` : m < 1440 ? `${Math.round(m / 60)} jam` : `${Math.round(m / 1440)} hari`;
	if (text === 'baru saja') return text;
	return future ? `${text} lagi` : `${text} lalu`;
}

function countItems(items: { kind?: string; url: string; platform: string; isLive?: boolean }[]) {
	const out: Record<string, number> = {};
	for (const it of items || []) {
		const k =
			it.kind ||
			(it.platform === 'youtube' ? (it.isLive ? 'live' : it.url.includes('/shorts/') ? 'short' : 'video') : /\/reels?\//.test(it.url) ? 'reel' : 'post');
		out[k] = (out[k] ?? 0) + 1;
	}
	return out;
}

function NumberField({
	id,
	label,
	value,
	min,
	max,
	disabled,
	onChange,
}: {
	id: string;
	label: string;
	value: number;
	min: number;
	max: number;
	disabled?: boolean;
	onChange: (n: number) => void;
}) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id} className="text-xs">
				{label} <span className="text-muted-foreground">({min}–{max})</span>
			</Label>
			<Input
				id={id}
				type="number"
				min={min}
				max={max}
				value={value}
				disabled={disabled}
				onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)))}
			/>
		</div>
	);
}

function ToggleRow({
	id,
	label,
	checked,
	disabled,
	onChange,
}: {
	id: string;
	label: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
			<Label htmlFor={id} className="text-sm font-normal">
				{label}
			</Label>
			<Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
		</div>
	);
}

function StatusCard({
	platform,
	status,
	counts,
	enabled,
	canSync,
	syncing,
	onSync,
	nextAt,
	sessionConfigured,
}: {
	platform: SocialPlatform;
	status?: SocialPlatformSyncStatus;
	counts: Record<string, number>;
	enabled: boolean;
	canSync: boolean;
	syncing: boolean;
	onSync: () => void;
	nextAt?: string;
	sessionConfigured?: boolean;
}) {
	const Icon = platform === 'youtube' ? Youtube : Instagram;
	const kinds = platform === 'youtube' ? ['video', 'short', 'live'] : ['post', 'reel'];
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle className="flex items-center gap-2 text-base">
							<Icon className="h-4 w-4" /> {platform === 'youtube' ? 'YouTube' : 'Instagram'}
							{!enabled && <Badge variant="outline">Nonaktif</Badge>}
						</CardTitle>
						<CardDescription className="mt-1">
							Fetch terakhir: <span className="font-medium text-foreground">{formatRelative(status?.at)}</span>
							{status?.at ? <span className="block text-xs">{formatWib(status.at)}</span> : null}
						</CardDescription>
					</div>
					{canSync && (
						<Button size="sm" variant="outline" onClick={onSync} disabled={syncing || !enabled}>
							{syncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
							Fetch sekarang
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-3 text-sm">
				<div className="flex flex-wrap gap-2">
					{kinds.map((k) => (
						<span key={k} className="rounded-md border border-border/70 px-2 py-1 font-mono text-xs tabular-nums">
							{KIND_LABEL[k]} {String(counts[k] ?? 0).padStart(2, '0')}
						</span>
					))}
				</div>
				{status ? (
					<p className="flex items-center gap-1.5">
						{status.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
						{status.ok ? 'Berhasil' : 'Gagal'}
						{typeof status.newCount === 'number' && status.ok ? ` · ${status.newCount} baru` : ''}
						{status.method ? <span className="text-xs text-muted-foreground"> · {status.method}</span> : null}
					</p>
				) : null}
				{status?.error && (
					<p className={`flex gap-1.5 rounded-md p-2 text-xs ${status.ok ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-destructive/10 text-destructive'}`}>
						<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						{status.error}
					</p>
				)}
				{platform === 'instagram' && (
					<p className="text-xs text-muted-foreground">
						Sesi akun dummy IG di server:{' '}
						<span className={sessionConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}>
							{sessionConfigured ? 'terpasang' : 'tidak terpasang'}
						</span>
					</p>
				)}
				<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Clock className="h-3.5 w-3.5" /> Jadwal otomatis berikutnya: {formatWib(nextAt)}
				</p>
			</CardContent>
		</Card>
	);
}

export default function SocialFeedSettingsPanel() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { hasSpecificPermission } = useAuth();
	const canEdit = hasSpecificPermission('social_feed.edit');
	const canSync = hasSpecificPermission('social_feed.sync');

	const { data, isLoading, isError, refetch } = useQuery<ManagePayload>({
		queryKey: ['/api/social-feed/manage'],
		queryFn: async () => {
			const r = await apiRequest('GET', '/api/social-feed/manage');
			const json = await r.json();
			return json.data || json;
		},
	});

	const [config, setConfig] = useState<SocialFeedConfig>(DEFAULT_SOCIAL_FEED_CONFIG);
	const [pasteLinks, setPasteLinks] = useState('');
	useEffect(() => {
		if (data?.config) setConfig(normalizeSocialFeedConfig(data.config));
	}, [data?.config]);

	const setYt = (patch: Partial<SocialFeedConfig['youtube']>) => setConfig((c) => ({ ...c, youtube: { ...c.youtube, ...patch } }));
	const setIg = (patch: Partial<SocialFeedConfig['instagram']>) => setConfig((c) => ({ ...c, instagram: { ...c.instagram, ...patch } }));

	const saveMut = useMutation({
		mutationFn: async (next: SocialFeedConfig) => (await apiRequest('PUT', '/api/social-feed/manage', { config: next })).json(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/social-feed/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/social-feed'] });
			queryClient.invalidateQueries({ queryKey: ['/api/social-feed/items'] });
			toast({ title: 'Tersimpan', description: 'Pengaturan media sosial diperbarui.' });
		},
		onError: (err: any) => toast({ title: 'Gagal menyimpan', description: err?.message || 'Coba lagi', variant: 'destructive' }),
	});

	const [syncing, setSyncing] = useState<SocialPlatform | 'all' | null>(null);
	const invalidateFeed = () => {
		queryClient.invalidateQueries({ queryKey: ['/api/social-feed/manage'] });
		queryClient.invalidateQueries({ queryKey: ['/api/social-feed'] });
		queryClient.invalidateQueries({ queryKey: ['/api/social-feed/items'] });
	};
	const syncMut = useMutation({
		mutationFn: async (target: SocialPlatform | 'all' | 'full') => {
			setSyncing(target === 'full' ? 'all' : target);
			const body = target === 'all' ? {} : target === 'full' ? { full: true } : { platform: target };
			const r = await apiRequest('POST', '/api/social-feed/sync', body);
			return r.json();
		},
		onSuccess: (json) => {
			invalidateFeed();
			if (json.data?.backfill) {
				// Backfill jalan di background: segarkan status beberapa kali
				for (const ms of [30_000, 90_000, 180_000, 300_000, 480_000]) window.setTimeout(invalidateFeed, ms);
				toast({ title: 'Mengambil semua isi akun', description: json.message });
				return;
			}
			toast({
				title: json.success ? 'Fetch selesai' : 'Fetch selesai dengan masalah',
				description: json.success ? 'Konten media sosial diperbarui.' : json.data?.error || json.message,
				variant: json.success ? undefined : 'destructive',
			});
		},
		onError: (err: any) => toast({ title: 'Fetch gagal', description: err?.message || 'Coba lagi', variant: 'destructive' }),
		onSettled: () => setSyncing(null),
	});

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 py-10 text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" /> Memuat pengaturan media sosial…
			</div>
		);
	}
	if (isError || !data) {
		return (
			<div className="py-10 text-center">
				<p className="mb-3 text-destructive">Gagal memuat pengaturan media sosial.</p>
				<Button variant="outline" onClick={() => refetch()}>
					Coba Lagi
				</Button>
			</div>
		);
	}

	const ytCounts = countItems(data.cache?.youtube || []);
	const igCounts = countItems(data.cache?.instagram || []);
	const manual = config.instagram.manualUrls || [];
	const addPasted = () => {
		const incoming = normalizeManualUrls(pasteLinks).filter((u) => /instagram\.com\/(?:[\w.-]+\/)?(p|reel|reels|tv)\//i.test(u));
		if (!incoming.length) {
			toast({ title: 'Tidak ada link valid', description: 'Tempel link post/reel Instagram, satu per baris.', variant: 'destructive' });
			return;
		}
		setIg({ manualUrls: normalizeManualUrls([...incoming, ...manual]) });
		setPasteLinks('');
		toast({ title: `${incoming.length} link ditambahkan`, description: 'Klik Simpan, lalu Fetch Instagram.' });
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="mr-auto">
					<h3 className="text-lg font-semibold">Media Sosial</h3>
					<p className="text-sm text-muted-foreground">
						Fetch otomatis sekali sehari pukul 00:00 WIB. Terakhir: {formatWib(data.lastSocialFeedSyncAt)}.
					</p>
				</div>
				{canSync && (
					<Button onClick={() => syncMut.mutate('all')} disabled={!!syncing}>
						{syncing === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
						Fetch semua sekarang
					</Button>
				)}
				{canSync && (
					<Button
						variant="outline"
						onClick={() => {
							if (window.confirm('Ambil ulang SELURUH isi akun YouTube & Instagram? Bisa beberapa menit dan berjalan di background.')) {
								syncMut.mutate('full');
							}
						}}
						disabled={!!syncing}>
						<RefreshCw className="mr-2 h-4 w-4" />
						Ambil ulang semua isi akun
					</Button>
				)}
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<StatusCard
					platform="youtube"
					status={data.status?.youtube}
					counts={ytCounts}
					enabled={config.youtube.enabled}
					canSync={canSync}
					syncing={syncing === 'youtube' || syncing === 'all'}
					onSync={() => syncMut.mutate('youtube')}
					nextAt={data.nextScheduledSyncAt}
				/>
				<StatusCard
					platform="instagram"
					status={data.status?.instagram}
					counts={igCounts}
					enabled={config.instagram.enabled}
					canSync={canSync}
					syncing={syncing === 'instagram' || syncing === 'all'}
					onSync={() => syncMut.mutate('instagram')}
					nextAt={data.nextScheduledSyncAt}
					sessionConfigured={data.instagramSessionConfigured}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Youtube className="h-4 w-4" /> Pengaturan YouTube
						</CardTitle>
						<CardDescription>Arsip menyimpan seluruh isi akun (fetch pertama mengambil semua). Angka Cek = jumlah terbaru yang diperiksa tiap fetch harian.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<ToggleRow id="yt-enabled" label="Tampilkan di beranda" checked={config.youtube.enabled} disabled={!canEdit} onChange={(v) => setYt({ enabled: v })} />
						<div className="space-y-1.5">
							<Label htmlFor="yt-url">URL kanal</Label>
							<Input id="yt-url" value={config.youtube.profileOrChannelUrl} disabled={!canEdit} onChange={(e) => setYt({ profileOrChannelUrl: e.target.value })} placeholder="https://www.youtube.com/c/NamaKanal" />
						</div>
						<div className="grid grid-cols-3 gap-2">
							<ToggleRow id="yt-v" label="Video" checked={config.youtube.content.videos} disabled={!canEdit} onChange={(v) => setYt({ content: { ...config.youtube.content, videos: v } })} />
							<ToggleRow id="yt-s" label="Shorts" checked={config.youtube.content.shorts} disabled={!canEdit} onChange={(v) => setYt({ content: { ...config.youtube.content, shorts: v } })} />
							<ToggleRow id="yt-l" label="Live" checked={config.youtube.content.live} disabled={!canEdit} onChange={(v) => setYt({ content: { ...config.youtube.content, live: v } })} />
						</div>
						<div className="grid grid-cols-3 gap-3">
							<NumberField id="yt-fv" label="Cek video" value={config.youtube.fetchLimits.video} min={1} max={30} disabled={!canEdit} onChange={(n) => setYt({ fetchLimits: { ...config.youtube.fetchLimits, video: n } })} />
							<NumberField id="yt-fs" label="Cek shorts" value={config.youtube.fetchLimits.short} min={1} max={30} disabled={!canEdit} onChange={(n) => setYt({ fetchLimits: { ...config.youtube.fetchLimits, short: n } })} />
							<NumberField id="yt-fl" label="Cek live" value={config.youtube.fetchLimits.live} min={1} max={15} disabled={!canEdit} onChange={(n) => setYt({ fetchLimits: { ...config.youtube.fetchLimits, live: n } })} />
						</div>
						<div className="grid grid-cols-2 gap-3">
							<NumberField id="yt-home" label="Tampil di beranda" value={config.youtube.homeLimit} min={4} max={16} disabled={!canEdit} onChange={(n) => setYt({ homeLimit: n })} />
							<NumberField id="yt-step" label='Tambahan "Lebih banyak"' value={config.youtube.loadMoreStep} min={4} max={16} disabled={!canEdit} onChange={(n) => setYt({ loadMoreStep: n })} />
						</div>
						<ToggleRow id="yt-embed" label="Tampilkan video unggulan (embed)" checked={config.youtube.showFeaturedEmbed} disabled={!canEdit} onChange={(v) => setYt({ showFeaturedEmbed: v })} />
						<ToggleRow id="yt-live" label="Deteksi & tampilkan badge LIVE" checked={config.youtube.showLiveBadge} disabled={!canEdit} onChange={(v) => setYt({ showLiveBadge: v })} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Instagram className="h-4 w-4" /> Pengaturan Instagram
						</CardTitle>
						<CardDescription>
							Instagram memblokir daftar post tanpa login. Post baru masuk otomatis bila sesi akun dummy terpasang di server; selain itu tambahkan link post/reel di bawah.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<ToggleRow id="ig-enabled" label="Tampilkan di beranda" checked={config.instagram.enabled} disabled={!canEdit} onChange={(v) => setIg({ enabled: v })} />
						<div className="space-y-1.5">
							<Label htmlFor="ig-url">URL profil</Label>
							<Input id="ig-url" value={config.instagram.profileOrChannelUrl} disabled={!canEdit} onChange={(e) => setIg({ profileOrChannelUrl: e.target.value })} placeholder="https://www.instagram.com/username/" />
						</div>
						<div className="grid grid-cols-2 gap-2">
							<ToggleRow id="ig-p" label="Post" checked={config.instagram.content.posts} disabled={!canEdit} onChange={(v) => setIg({ content: { ...config.instagram.content, posts: v } })} />
							<ToggleRow id="ig-r" label="Reels" checked={config.instagram.content.reels} disabled={!canEdit} onChange={(v) => setIg({ content: { ...config.instagram.content, reels: v } })} />
						</div>
						<div className="grid grid-cols-2 gap-3">
							<NumberField id="ig-home" label="Tampil di beranda" value={config.instagram.homeLimit} min={3} max={18} disabled={!canEdit} onChange={(n) => setIg({ homeLimit: n })} />
							<NumberField id="ig-step" label='Tambahan "Lebih banyak"' value={config.instagram.loadMoreStep} min={3} max={18} disabled={!canEdit} onChange={(n) => setIg({ loadMoreStep: n })} />
						</div>
						<div className="grid grid-cols-2 gap-3">
							<NumberField id="ig-fp" label="Cek post" value={config.instagram.fetchLimits.post} min={1} max={60} disabled={!canEdit} onChange={(n) => setIg({ fetchLimits: { ...config.instagram.fetchLimits, post: n } })} />
							<NumberField id="ig-fr" label="Cek reels" value={config.instagram.fetchLimits.reel} min={1} max={60} disabled={!canEdit} onChange={(n) => setIg({ fetchLimits: { ...config.instagram.fetchLimits, reel: n } })} />
						</div>

						<div className="space-y-2">
							<Label htmlFor="ig-paste">Tambah link post/reel</Label>
							<Textarea
								id="ig-paste"
								rows={3}
								value={pasteLinks}
								disabled={!canEdit}
								onChange={(e) => setPasteLinks(e.target.value)}
								placeholder={'https://www.instagram.com/p/XXXXXXXXXXX/\nhttps://www.instagram.com/reel/YYYYYYYYYYY/'}
							/>
							<Button type="button" size="sm" variant="outline" onClick={addPasted} disabled={!canEdit || !pasteLinks.trim()}>
								Tambahkan
							</Button>
						</div>
						{manual.length > 0 && (
							<div className="space-y-1.5">
								<p className="text-xs text-muted-foreground">Link manual ({manual.length})</p>
								<ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/70 p-2">
									{manual.map((u) => (
										<li key={u} className="flex items-center justify-between gap-2 text-xs">
											<a href={u} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">
												{u.replace(/^https?:\/\/(www\.)?instagram\.com/, '')}
											</a>
											{canEdit && (
												<button
													type="button"
													aria-label={`Hapus ${u}`}
													onClick={() => setIg({ manualUrls: manual.filter((x) => x !== u) })}
													className="shrink-0 text-muted-foreground hover:text-destructive">
													<Trash2 className="h-3.5 w-3.5" />
												</button>
											)}
										</li>
									))}
								</ul>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{canEdit && (
				<div className="flex justify-end">
					<Button onClick={() => saveMut.mutate(config)} disabled={saveMut.isPending}>
						{saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Simpan pengaturan
					</Button>
				</div>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Log fetch</CardTitle>
					<CardDescription>20 fetch terakhir (otomatis & manual).</CardDescription>
				</CardHeader>
				<CardContent>
					{!data.logs?.length ? (
						<p className="text-sm text-muted-foreground">Belum ada log. Log mulai tercatat sejak versi 4.25.0.</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead className="text-muted-foreground">
									<tr className="border-b border-border/70">
										<th className="py-2 pr-3 font-medium">Waktu</th>
										<th className="py-2 pr-3 font-medium">Platform</th>
										<th className="py-2 pr-3 font-medium">Pemicu</th>
										<th className="py-2 pr-3 font-medium">Hasil</th>
										<th className="py-2 pr-3 font-medium">Baru / total</th>
										<th className="py-2 font-medium">Keterangan</th>
									</tr>
								</thead>
								<tbody>
									{data.logs.map((l) => (
										<tr key={l.id} className="border-b border-border/40 align-top">
											<td className="whitespace-nowrap py-2 pr-3">{formatWib(l.startedAt)}</td>
											<td className="py-2 pr-3 capitalize">{l.platform}</td>
											<td className="py-2 pr-3">
												{l.trigger === 'cron' ? 'Otomatis' : 'Manual'}
												{l.triggeredBy ? <span className="block text-muted-foreground">{l.triggeredBy}</span> : null}
											</td>
											<td className="py-2 pr-3">
												{l.ok ? (
													<span className="text-emerald-600 dark:text-emerald-400">Berhasil</span>
												) : (
													<span className="text-destructive">Gagal</span>
												)}
												<span className="block text-muted-foreground">{(l.durationMs / 1000).toFixed(1)} dtk</span>
											</td>
											<td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums">
												{l.newCount} / {l.total}
											</td>
											<td className="py-2 text-muted-foreground">
												{l.method ? <span className="block">{l.method}</span> : null}
												{l.error ? <span className={l.ok ? 'text-amber-700 dark:text-amber-300' : 'text-destructive'}>{l.error}</span> : null}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
