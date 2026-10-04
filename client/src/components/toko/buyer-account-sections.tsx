import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, Laptop, Loader2, MapPin, MessageCircle, Plus, Smartphone, Star, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { StoreChatPanel } from '@/components/toko/store-chat-panel';
import { buyerApi, useBuyer, useStorePaths, type BuyerAddress } from '@/hooks/use-buyer';
import { useStoreFavorites } from '@/hooks/use-store-favorites';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText } from '@/lib/queryClient';
import { useApiUrl } from '@/lib/tenant-context';
import { formatStoreMoney } from '@shared/store-currency';

const emptyAddress = (): BuyerAddress => ({ id: '', label: '', recipient: '', phone: '', address: '', isDefault: false });

/** Alamat tersimpan (maks 5). Alamat default otomatis dipakai saat checkout "Diantar". */
export function BuyerAddressesSection() {
	const { buyer, refetch } = useBuyer();
	const { toast } = useToast();
	const [list, setList] = useState<BuyerAddress[]>([]);
	const [draft, setDraft] = useState<BuyerAddress | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => setList(buyer?.addresses || []), [buyer?.addresses]);

	const save = async (next: BuyerAddress[]) => {
		setBusy(true);
		try {
			const saved = await buyerApi<BuyerAddress[]>('PUT', '/addresses', { addresses: next });
			setList(saved || []);
			setDraft(null);
			await refetch();
			toast({ title: 'Alamat disimpan' });
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal menyimpan alamat'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
				<div>
					<CardTitle className="text-base">Alamat tersimpan</CardTitle>
					<CardDescription>Alamat utama otomatis terisi saat checkout dengan pengiriman. Maksimal 5.</CardDescription>
				</div>
				{list.length < 5 && !draft && (
					<Button size="sm" className="gap-1 shrink-0" onClick={() => setDraft(emptyAddress())}>
						<Plus className="h-4 w-4" /> Tambah
					</Button>
				)}
			</CardHeader>
			<CardContent className="space-y-3">
				{list.length === 0 && !draft && <p className="text-sm text-muted-foreground">Belum ada alamat.</p>}
				{list.map((a) => (
					<div key={a.id} className="rounded-md border p-3 text-sm">
						<div className="flex flex-wrap items-center gap-2">
							<MapPin className="h-4 w-4 text-primary" />
							<span className="font-medium">{a.label || 'Alamat'}</span>
							{a.isDefault && <Badge variant="secondary" className="text-[10px]">Utama</Badge>}
						</div>
						<p className="mt-1 text-muted-foreground break-words">
							{[a.recipient, a.phone].filter(Boolean).join(' · ')}
						</p>
						<p className="whitespace-pre-line break-words">{a.address}</p>
						<div className="mt-2 flex flex-wrap gap-2">
							{!a.isDefault && (
								<Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => save(list.map((x) => ({ ...x, isDefault: x.id === a.id })))}>
									<Star className="h-3.5 w-3.5" /> Jadikan utama
								</Button>
							)}
							<Button size="sm" variant="ghost" disabled={busy} onClick={() => setDraft({ ...a })}>
								Ubah
							</Button>
							<Button size="sm" variant="ghost" className="text-destructive gap-1" disabled={busy} onClick={() => save(list.filter((x) => x.id !== a.id))}>
								<Trash2 className="h-3.5 w-3.5" /> Hapus
							</Button>
						</div>
					</div>
				))}
				{draft && (
					<div className="rounded-md border border-primary/40 p-3 space-y-2">
						<div className="grid gap-2 sm:grid-cols-3">
							<div className="space-y-1">
								<Label htmlFor="ad-label">Label</Label>
								<Input id="ad-label" placeholder="Rumah / Kos" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
							</div>
							<div className="space-y-1">
								<Label htmlFor="ad-rec">Penerima</Label>
								<Input id="ad-rec" value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })} />
							</div>
							<div className="space-y-1">
								<Label htmlFor="ad-phone">No HP</Label>
								<Input id="ad-phone" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
							</div>
						</div>
						<div className="space-y-1">
							<Label htmlFor="ad-addr">Alamat lengkap</Label>
							<Textarea id="ad-addr" rows={3} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
						</div>
						<div className="flex gap-2">
							<Button
								size="sm"
								disabled={busy || draft.address.trim().length < 5}
								onClick={() => save(draft.id ? list.map((x) => (x.id === draft.id ? draft : x)) : [...list, { ...draft, isDefault: list.length === 0 }])}>
								{busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}Simpan alamat
							</Button>
							<Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
								Batal
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/** Produk favorit (tersimpan di akun, ikut di semua perangkat). */
export function BuyerFavoritesSection() {
	const { favoriteIds, toggleFavorite } = useStoreFavorites();
	const { storeHref } = useStorePaths();
	const productsUrl = useApiUrl('/store/public/products');
	const { data, isLoading } = useQuery<any>({
		queryKey: [productsUrl, 'buyer-favorites'],
		queryFn: async () => {
			const r = await fetch(`${productsUrl}?limit=200`, { credentials: 'include' });
			return r.ok ? r.json() : [];
		},
	});
	const all: any[] = Array.isArray(data) ? data : data?.items || [];
	const favs = all.filter((p) => favoriteIds.includes(String(p._id)));
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Favorit</CardTitle>
				<CardDescription>Favorit dari perangkat ini otomatis digabung ke akun.</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Loader2 className="h-6 w-6 animate-spin mx-auto my-4 text-muted-foreground" />
				) : favs.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Belum ada favorit. Tekan ikon <Heart className="inline h-3.5 w-3.5" /> di produk untuk menyimpan.
					</p>
				) : (
					<div className="grid gap-2 sm:grid-cols-2">
						{favs.map((p) => (
							<div key={p._id} className="flex items-center gap-3 rounded-md border p-2">
								{p.thumbnail ? <img src={p.thumbnail} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded object-cover bg-muted" /> : <div className="h-14 w-14 shrink-0 rounded bg-muted" />}
								<Link href={`${storeHref}/${p.slug}`} className="min-w-0 flex-1">
									<p className="text-sm font-medium line-clamp-2 hover:text-primary">{p.name}</p>
									<p className="text-xs text-primary font-semibold tabular-nums">{formatStoreMoney(Number(p.price) || 0, 'IDR')}</p>
								</Link>
								<Button size="icon" variant="ghost" aria-label="Hapus dari favorit" onClick={() => toggleFavorite(String(p._id))}>
									<Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
								</Button>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/** Pintasan chat penjual — percakapan ikut akun (bisa dibuka dari perangkat lain). */
export function BuyerChatSection() {
	const [open, setOpen] = useState(false);
	const settingsUrl = useApiUrl('/store/public/settings');
	const { data: settings } = useQuery<any>({
		queryKey: [settingsUrl],
		queryFn: async () => {
			const r = await fetch(settingsUrl, { credentials: 'include' });
			return r.ok ? r.json() : {};
		},
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Chat penjual</CardTitle>
				<CardDescription>Percakapanmu dengan admin toko tersimpan di akun, jadi bisa dilanjutkan dari HP mana saja.</CardDescription>
			</CardHeader>
			<CardContent>
				<Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
					<MessageCircle className="h-4 w-4" /> Buka chat
				</Button>
				<StoreChatPanel open={open} onOpenChange={setOpen} waAdmins={settings?.waAdmins} />
			</CardContent>
		</Card>
	);
}

interface BuyerSession {
	id: string;
	device: string;
	userAgent: string;
	lastActive: string;
	current: boolean;
}

/** Perangkat yang sedang masuk; bisa dikeluarkan satu per satu atau sekaligus. */
export function BuyerSessionsSection() {
	const { toast } = useToast();
	const { data = [], refetch, isLoading } = useQuery<BuyerSession[]>({
		queryKey: ['buyer-sessions'],
		queryFn: async () => (await buyerApi<BuyerSession[]>('GET', '/sessions')) || [],
	});
	const act = async (fn: () => Promise<unknown>, msg: string) => {
		try {
			await fn();
			await refetch();
			toast({ title: msg });
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal'), variant: 'destructive' });
		}
	};
	const browser = (ua: string) => (/Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser');
	return (
		<Card className="md:col-span-2">
			<CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
				<div>
					<CardTitle className="text-base">Perangkat yang masuk</CardTitle>
					<CardDescription>Keluarkan perangkat yang tidak kamu kenali.</CardDescription>
				</div>
				{data.length > 1 && (
					<Button size="sm" variant="outline" onClick={() => act(() => buyerApi('POST', '/sessions/revoke-others', {}), 'Perangkat lain dikeluarkan')}>
						Keluar dari perangkat lain
					</Button>
				)}
			</CardHeader>
			<CardContent className="space-y-2">
				{isLoading ? (
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
				) : (
					data.map((s) => (
						<div key={s.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
							{s.device === 'Mobile' ? <Smartphone className="h-4 w-4 shrink-0" /> : <Laptop className="h-4 w-4 shrink-0" />}
							<div className="min-w-0 flex-1">
								<p className="font-medium">
									{browser(s.userAgent)} · {s.device}
									{s.current && <Badge variant="secondary" className="ml-2 text-[10px]">Perangkat ini</Badge>}
								</p>
								<p className="text-xs text-muted-foreground">Aktif {new Date(s.lastActive).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
							</div>
							{!s.current && (
								<Button size="sm" variant="ghost" onClick={() => act(() => buyerApi('DELETE', `/sessions/${s.id}`), 'Perangkat dikeluarkan')}>
									Keluarkan
								</Button>
							)}
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

/** Preferensi email: kabar status & pengingat bayar (email transaksi inti tetap terkirim). */
export function BuyerNotifySection() {
	const { buyer, refetch } = useBuyer();
	const { toast } = useToast();
	const [busy, setBusy] = useState(false);
	if (!buyer) return null;
	const prefs = buyer.notifyPrefs || { orderStatus: true, paymentReminders: true };
	const update = async (patch: Partial<typeof prefs>) => {
		setBusy(true);
		try {
			await buyerApi('PATCH', '/me', { notifyPrefs: patch });
			await refetch();
			toast({ title: 'Preferensi disimpan' });
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal menyimpan'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};
	const row = (key: keyof typeof prefs, title: string, desc: string) => (
		<label className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
			<span>
				<span className="font-medium">{title}</span>
				<span className="block text-xs text-muted-foreground">{desc}</span>
			</span>
			<Switch checked={prefs[key] !== false} disabled={busy} onCheckedChange={(v) => update({ [key]: v })} aria-label={title} />
		</label>
	);
	return (
		<Card className="md:col-span-2">
			<CardHeader>
				<CardTitle className="text-base">Notifikasi email</CardTitle>
				<CardDescription>Email pesanan diterima, bukti bayar diterima/ditolak, pembayaran terverifikasi, dan pembatalan selalu dikirim.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{row('orderStatus', 'Kabar status pesanan', 'Dikonfirmasi, pre-order diproses, dikirim/siap diambil, selesai.')}
				{row('paymentReminders', 'Pengingat pembayaran', 'Pengingat sebelum batas bayar & tenggat pelunasan DP.')}
			</CardContent>
		</Card>
	);
}

/** Hapus akun: konfirmasi OTP; data pribadi dianonimkan, riwayat pesanan tetap di toko. */
export function BuyerDeleteSection({ onDeleted }: { onDeleted: () => void }) {
	const { buyer } = useBuyer();
	const { toast } = useToast();
	const [challengeId, setChallengeId] = useState('');
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	if (!buyer) return null;
	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		try {
			await fn();
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};
	return (
		<Card className="md:col-span-2 border-destructive/40">
			<CardHeader>
				<CardTitle className="text-base text-destructive">Hapus akun</CardTitle>
				<CardDescription>
					Nama, email, no HP, alamat, dan favorit di akun dihapus permanen. Pesanan yang sudah dibuat tetap tersimpan di toko untuk pembukuan.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3 max-w-md">
				{!challengeId ? (
					<Button
						variant="outline"
						className="text-destructive"
						disabled={busy}
						onClick={() =>
							run(async () => {
								const r = await buyerApi<{ challengeId: string }>('POST', '/delete/otp', {});
								setChallengeId(r.challengeId);
								toast({ title: `Kode konfirmasi dikirim ke ${buyer.email}` });
							})
						}>
						Kirim kode konfirmasi
					</Button>
				) : (
					<>
						<div className="space-y-1">
							<Label htmlFor="del-code">Kode konfirmasi</Label>
							<Input id="del-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
						</div>
						<div className="flex gap-2">
							<Button
								variant="destructive"
								disabled={busy || code.length !== 6}
								onClick={() =>
									run(async () => {
										await buyerApi('POST', '/delete', { challengeId, code });
										toast({ title: 'Akun dihapus' });
										onDeleted();
									})
								}>
								Hapus akun permanen
							</Button>
							<Button variant="ghost" onClick={() => setChallengeId('')}>
								Batal
							</Button>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
