import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import {
	DEFAULT_SOCIAL_FEED_CONFIG,
	clampSocialMaxItems,
	normalizeSocialFeedConfig,
	type SocialFeedConfig,
	type SocialFeedCache,
} from '@shared/social-feed';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

type ManagePayload = {
	config: SocialFeedConfig;
	cache: SocialFeedCache;
	lastSocialFeedSyncAt?: string | null;
	preview?: unknown;
	error?: string | null;
};

export default function SocialFeedSettingsPanel() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { hasSpecificPermission } = useAuth();
	const canEdit = hasSpecificPermission('social_feed.edit');
	const canSync = hasSpecificPermission('social_feed.sync');

	const { data, isLoading } = useQuery<ManagePayload>({
		queryKey: ['/api/social-feed/manage'],
		queryFn: async () => {
			const r = await apiRequest('GET', '/api/social-feed/manage');
			const json = await r.json();
			return json.data || json;
		},
	});

	const [config, setConfig] = useState<SocialFeedConfig>(DEFAULT_SOCIAL_FEED_CONFIG);

	useEffect(() => {
		if (data?.config) setConfig(normalizeSocialFeedConfig(data.config));
	}, [data?.config]);

	const saveMut = useMutation({
		mutationFn: async (next: SocialFeedConfig) => {
			const r = await apiRequest('PUT', '/api/social-feed/manage', { config: next });
			return r.json();
		},
		onSuccess: (json) => {
			queryClient.setQueryData(['/api/social-feed/manage'], json.data);
			queryClient.invalidateQueries({ queryKey: ['/api/social-feed'] });
			toast({ title: 'Tersimpan', description: 'Pengaturan media sosial beranda diperbarui.' });
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal menyimpan',
				description: err?.message || 'Coba lagi',
				variant: 'destructive',
			});
		},
	});

	const syncMut = useMutation({
		mutationFn: async () => {
			const r = await apiRequest('POST', '/api/social-feed/sync', { config });
			return r.json();
		},
		onSuccess: (json) => {
			if (json.data) {
				queryClient.setQueryData(['/api/social-feed/manage'], {
					config: json.data.config,
					cache: json.data.cache,
					preview: json.data.preview,
					lastSocialFeedSyncAt: new Date().toISOString(),
				});
			}
			queryClient.invalidateQueries({ queryKey: ['/api/social-feed'] });
			toast({
				title: json.success ? 'Sync selesai' : 'Sync dengan peringatan',
				description: json.data?.error || json.message,
			});
		},
		onError: (err: any) => {
			toast({
				title: 'Sync gagal',
				description: err?.message || 'Cache lama tetap dipakai',
				variant: 'destructive',
			});
		},
	});

	if (isLoading) {
		return (
			<div className="flex h-40 items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	const cache = data?.cache;
	const ytThumbs = (cache?.youtube || []).slice(0, 5);
	const igThumbs = (cache?.instagram || []).slice(0, 5);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Media Sosial Beranda</CardTitle>
					<CardDescription>
						YouTube lewat youtubei.js (tab Video / Live / Shorts). Instagram lewat
						web_profile_info + cookie seed. Filter tipe konten di-round-robin supaya
						campuran adil. Section + item navbar YouTube/Instagram bisa digabung ke
						grup Media di tab Beranda.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-8">
					<div className="space-y-4 rounded-lg border p-4">
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="font-medium">YouTube</p>
								<p className="text-sm text-muted-foreground">Channel RSS + deteksi live</p>
							</div>
							<Switch
								checked={config.youtube.enabled}
								disabled={!canEdit}
								onCheckedChange={(v) =>
									setConfig((c) => ({
										...c,
										youtube: { ...c.youtube, enabled: v },
									}))
								}
							/>
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="space-y-2">
								<Label>URL channel</Label>
								<Input
									disabled={!canEdit}
									value={config.youtube.profileOrChannelUrl}
									onChange={(e) =>
										setConfig((c) => ({
											...c,
											youtube: { ...c.youtube, profileOrChannelUrl: e.target.value },
										}))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Jumlah item (1–5)</Label>
								<Input
									type="number"
									min={1}
									max={5}
									disabled={!canEdit}
									value={config.youtube.maxItems}
									onChange={(e) =>
										setConfig((c) => ({
											...c,
											youtube: {
												...c.youtube,
												maxItems: clampSocialMaxItems(e.target.value),
											},
										}))
									}
								/>
							</div>
						</div>
						<div className="flex flex-wrap gap-6">
							<label className="flex items-center gap-2 text-sm">
								<Switch
									checked={config.youtube.showLiveBadge}
									disabled={!canEdit}
									onCheckedChange={(v) =>
										setConfig((c) => ({
											...c,
											youtube: { ...c.youtube, showLiveBadge: v },
										}))
									}
								/>
								Badge LIVE
							</label>
							<label className="flex items-center gap-2 text-sm">
								<Switch
									checked={!!config.youtube.showFeaturedEmbed}
									disabled={!canEdit}
									onCheckedChange={(v) =>
										setConfig((c) => ({
											...c,
											youtube: { ...c.youtube, showFeaturedEmbed: v },
										}))
									}
								/>
								Embed unggulan
							</label>
						</div>
						<div className="space-y-2">
							<Label>Tipe konten YouTube</Label>
							<div className="flex flex-wrap gap-4 text-sm">
								{(
									[
										['videos', 'Video'],
										['shorts', 'Shorts'],
										['live', 'Live'],
									] as const
								).map(([key, label]) => (
									<label key={key} className="flex items-center gap-2">
										<Switch
											checked={!!config.youtube.content[key]}
											disabled={!canEdit}
											onCheckedChange={(v) =>
												setConfig((c) => ({
													...c,
													youtube: {
														...c.youtube,
														content: { ...c.youtube.content, [key]: v },
													},
												}))
											}
										/>
										{label}
									</label>
								))}
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							Scrape lewat youtubei.js (InnerTube): tab <strong>Video</strong>,{' '}
							<strong>Live/Streams</strong>, dan <strong>Shorts</strong> (jika ada).
							Channel @HimatifEncoder saat ini tidak punya tab Shorts — filter Shorts
							pakai video ≤60 dtk dari tab Video. Filter campur di-round-robin supaya
							Live tidak menelan slot Video.
						</p>
						{ytThumbs.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{ytThumbs.map((item) => (
									<img
										key={item.id}
										src={item.thumbnailUrl}
										alt=""
										className="h-14 w-24 rounded object-cover ring-1 ring-border"
										title={`${item.kind || 'video'}: ${item.title}`}
									/>
								))}
							</div>
						)}
					</div>

					<div className="space-y-4 rounded-lg border p-4">
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="font-medium">Instagram</p>
								<p className="text-sm text-muted-foreground">
									web_profile_info + cookie seed + enrich media thumb
								</p>
							</div>
							<Switch
								checked={config.instagram.enabled}
								disabled={!canEdit}
								onCheckedChange={(v) =>
									setConfig((c) => ({
										...c,
										instagram: { ...c.instagram, enabled: v },
									}))
								}
							/>
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="space-y-2">
								<Label>URL profil</Label>
								<Input
									disabled={!canEdit}
									value={config.instagram.profileOrChannelUrl}
									onChange={(e) =>
										setConfig((c) => ({
											...c,
											instagram: {
												...c.instagram,
												profileOrChannelUrl: e.target.value,
											},
										}))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Jumlah item (1–5)</Label>
								<Input
									type="number"
									min={1}
									max={5}
									disabled={!canEdit}
									value={config.instagram.maxItems}
									onChange={(e) =>
										setConfig((c) => ({
											...c,
											instagram: {
												...c.instagram,
												maxItems: clampSocialMaxItems(e.target.value),
											},
										}))
									}
								/>
							</div>
						</div>
						<label className="flex items-center gap-2 text-sm">
							<Switch
								checked={config.instagram.showLiveBadge}
								disabled={!canEdit}
								onCheckedChange={(v) =>
									setConfig((c) => ({
										...c,
										instagram: { ...c.instagram, showLiveBadge: v },
									}))
								}
							/>
							Badge LIVE (hanya jika sinyal andal)
						</label>
						<div className="space-y-2">
							<Label>Tipe konten Instagram</Label>
							<div className="flex flex-wrap gap-4 text-sm">
								{(
									[
										['posts', 'Post'],
										['reels', 'Reels'],
										['live', 'Live'],
										['stories', 'Story'],
									] as const
								).map(([key, label]) => (
									<label key={key} className="flex items-center gap-2">
										<Switch
											checked={!!config.instagram.content[key]}
											disabled={!canEdit}
											onCheckedChange={(v) =>
												setConfig((c) => ({
													...c,
													instagram: {
														...c.instagram,
														content: { ...c.instagram.content, [key]: v },
													},
												}))
											}
										/>
										{label}
									</label>
								))}
							</div>
							<p className="text-xs text-muted-foreground">
								Post vs Reel dipisah dari product_type / URL. Story butuh{' '}
								<code className="text-[10px]">INSTAGRAM_SESSION_ID</code>. URL manual
								hanya fallback jika scrape IP kena rate-limit.
							</p>
						</div>
						<div className="space-y-2">
							<Label>URL manual (fallback, 1 baris 1 URL post/reel)</Label>
							<textarea
								disabled={!canEdit}
								className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								value={(config.instagram.manualUrls || []).join('\n')}
								onChange={(e) =>
									setConfig((c) => ({
										...c,
										instagram: {
											...c.instagram,
											manualUrls: e.target.value
												.split(/\r?\n/)
												.map((s) => s.trim())
												.filter(Boolean)
												.slice(0, 12),
										},
									}))
								}
								placeholder="https://www.instagram.com/himatif.encoder/reel/...."
							/>
						</div>
						{igThumbs.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{igThumbs.map((item) => (
									<img
										key={item.id}
										src={item.thumbnailUrl}
										alt=""
										className="h-14 w-14 rounded object-cover ring-1 ring-border"
									/>
								))}
							</div>
						)}
					</div>

					<div className="space-y-2 max-w-xs">
						<Label>Interval sync (jam)</Label>
						<Input
							type="number"
							min={1}
							max={24}
							disabled={!canEdit}
							value={config.syncIntervalHours}
							onChange={(e) =>
								setConfig((c) => ({
									...c,
									syncIntervalHours: Math.min(
										24,
										Math.max(1, parseInt(e.target.value, 10) || 3),
									),
								}))
							}
						/>
						{data?.lastSocialFeedSyncAt ? (
							<p className="text-xs text-muted-foreground">
								Terakhir sync:{' '}
								{new Date(data.lastSocialFeedSyncAt).toLocaleString('id-ID')}
							</p>
						) : null}
						{cache?.lastError ? (
							<p className="text-xs text-amber-700">Peringatan: {cache.lastError}</p>
						) : null}
					</div>

					<div className="flex flex-wrap gap-3">
						{canEdit && (
							<Button
								onClick={() => saveMut.mutate(normalizeSocialFeedConfig(config))}
								disabled={saveMut.isPending}>
								{saveMut.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : null}
								Simpan pengaturan
							</Button>
						)}
						{canSync && (
							<Button
								variant="outline"
								onClick={() => syncMut.mutate()}
								disabled={syncMut.isPending}>
								{syncMut.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="mr-2 h-4 w-4" />
								)}
								Sync sekarang
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
