import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImageUp, Loader2, Plus, QrCode, Trash2, Wallet, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
	DEFAULT_CANCEL_POLICY,
	DEFAULT_DP_SETTINGS,
	newChannelId,
	type PaymentChannelType,
	type StoreDpSettings,
	type StorePaymentChannel,
} from '@shared/store-payment';
import { PAYMENT_PROVIDER_GROUP_ORDER, PAYMENT_PROVIDERS, findPaymentProvider } from '@shared/store-payment-providers';

const TYPE_META: Record<PaymentChannelType, { label: string; icon: typeof QrCode }> = {
	qris: { label: 'QRIS', icon: QrCode },
	bank: { label: 'Rekening bank', icon: Landmark },
	ewallet: { label: 'E-wallet', icon: Wallet },
};

function blankChannel(type: PaymentChannelType): StorePaymentChannel {
	return {
		id: newChannelId(),
		type,
		active: true,
		qrisImageUrl: '',
		merchantName: '',
		providerId: '',
		providerName: '',
		accountNumber: '',
		accountHolder: '',
		note: '',
	};
}

/** Dropdown bank / e-wallet Indonesia (dikelompokkan) + "Lainnya (tulis sendiri)". */
function ProviderSelect({ channel, onChange }: { channel: StorePaymentChannel; onChange: (patch: Partial<StorePaymentChannel>) => void }) {
	const type = channel.type === 'ewallet' ? 'ewallet' : 'bank';
	const custom = !channel.providerId && !!channel.providerName;
	const [other, setOther] = useState(custom);
	const list = PAYMENT_PROVIDERS.filter((p) => p.type === type);
	return (
		<div className="space-y-1.5">
			<Label className="text-xs">{type === 'bank' ? 'Bank' : 'E-wallet'}</Label>
			<select
				className="w-full rounded-md border bg-background px-3 py-2 text-sm"
				value={other ? '__other' : channel.providerId}
				onChange={(e) => {
					const v = e.target.value;
					if (v === '__other') {
						setOther(true);
						onChange({ providerId: '', providerName: '' });
						return;
					}
					setOther(false);
					const p = findPaymentProvider(v);
					onChange({ providerId: v, providerName: p?.name || '' });
				}}>
				<option value="">— pilih —</option>
				{PAYMENT_PROVIDER_GROUP_ORDER.map((g) => {
					const items = list.filter((p) => p.group === g);
					if (!items.length) return null;
					return (
						<optgroup key={g} label={g}>
							{items.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
									{p.code ? ` (${p.code})` : ''}
								</option>
							))}
						</optgroup>
					);
				})}
				<option value="__other">Lainnya (tulis sendiri)…</option>
			</select>
			{other && (
				<Input
					placeholder={type === 'bank' ? 'Nama bank' : 'Nama e-wallet'}
					value={channel.providerName}
					onChange={(e) => onChange({ providerName: e.target.value.slice(0, 80) })}
				/>
			)}
		</div>
	);
}

/**
 * Pengaturan Pembayaran toko: kanal bayar (QRIS wajib nama merchant, rekening, e-wallet; tiap kanal
 * on/off & bisa diurutkan) + default DP pre-order + teks kebijakan pembatalan.
 */
export function StorePaymentSettingsCard({
	settings,
	settingsUrl,
	uploadUrl,
	invalidateKeys,
}: {
	settings: any;
	settingsUrl: string;
	uploadUrl: string;
	invalidateKeys: unknown[][];
}) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [channels, setChannels] = useState<StorePaymentChannel[]>([]);
	const [dp, setDp] = useState<StoreDpSettings>(DEFAULT_DP_SETTINGS);
	const [uploadingId, setUploadingId] = useState('');
	const fileRef = useRef<HTMLInputElement>(null);
	const uploadTarget = useRef('');

	useEffect(() => {
		setChannels(Array.isArray(settings?.paymentChannels) ? settings.paymentChannels : []);
		setDp({ ...DEFAULT_DP_SETTINGS, ...(settings?.dp || {}), cancelPolicyText: settings?.dp?.cancelPolicyText || DEFAULT_CANCEL_POLICY });
	}, [settings]);

	const patch = (id: string, p: Partial<StorePaymentChannel>) => setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
	const move = (i: number, d: -1 | 1) =>
		setChannels((cs) => {
			const j = i + d;
			if (j < 0 || j >= cs.length) return cs;
			const n = [...cs];
			[n[i], n[j]] = [n[j], n[i]];
			return n;
		});

	const save = useMutation({
		mutationFn: () => apiRequest('PUT', settingsUrl, { paymentChannels: channels, dp }),
		onSuccess: () => {
			for (const k of invalidateKeys) queryClient.invalidateQueries({ queryKey: k });
			toast({ title: 'Pengaturan pembayaran disimpan' });
		},
		onError: (e: Error) =>
			toast({ title: 'Gagal menyimpan', description: e.message.replace(/^\d+:\s*/, ''), variant: 'destructive' }),
	});

	const onPickQris = async (file: File | null) => {
		const id = uploadTarget.current;
		if (!file || !id) return;
		setUploadingId(id);
		try {
			const fd = new FormData();
			fd.append('image', file);
			const r = await apiRequest('POST', uploadUrl, fd);
			const d = await r.json();
			patch(id, { qrisImageUrl: d.url });
		} catch (e) {
			toast({ title: 'Upload QRIS gagal', description: (e as Error).message, variant: 'destructive' });
		} finally {
			setUploadingId('');
			if (fileRef.current) fileRef.current.value = '';
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Pembayaran</CardTitle>
				<CardDescription>
					Kanal yang aktif tampil di invoice pembeli (QRIS / nomor rekening) beserta tombol upload bukti bayar. Produk bisa
					memilih kanal sendiri di editor produk. Kosongkan semua kanal untuk kembali ke alur lama (checkout langsung ke
					WhatsApp).
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPickQris(e.target.files?.[0] || null)} />
				<div className="space-y-3">
					{channels.length === 0 && (
						<p className="text-sm text-muted-foreground">Belum ada kanal bayar — pembeli masih diarahkan ke WhatsApp.</p>
					)}
					{channels.map((c, i) => {
						const Meta = TYPE_META[c.type];
						return (
							<div key={c.id} className={`rounded-lg border p-3 space-y-3 ${c.active ? '' : 'opacity-60'}`}>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className="font-medium text-sm flex items-center gap-1.5">
										<Meta.icon className="h-4 w-4" /> {Meta.label}
										<span className="text-xs text-muted-foreground font-normal">#{i + 1}</span>
									</p>
									<div className="flex items-center gap-1">
										<span className="text-xs text-muted-foreground mr-1">{c.active ? 'Aktif' : 'Nonaktif'}</span>
										<Switch checked={c.active} onCheckedChange={(v) => patch(c.id, { active: v })} aria-label="Aktifkan kanal" />
										<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naik">
											<ArrowUp className="h-4 w-4" />
										</Button>
										<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === channels.length - 1} aria-label="Turun">
											<ArrowDown className="h-4 w-4" />
										</Button>
										<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChannels((cs) => cs.filter((x) => x.id !== c.id))} aria-label="Hapus">
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								</div>
								{c.type === 'qris' ? (
									<div className="grid gap-3 sm:grid-cols-[160px_1fr]">
										<div className="space-y-2">
											{c.qrisImageUrl ? (
												<img src={c.qrisImageUrl} alt="QRIS" className="w-40 rounded-md border bg-white p-1" />
											) : (
												<div className="w-40 h-40 rounded-md border border-dashed grid place-items-center text-xs text-muted-foreground">Belum ada gambar</div>
											)}
											<Button
												variant="outline"
												size="sm"
												className="w-40"
												disabled={uploadingId === c.id}
												onClick={() => {
													uploadTarget.current = c.id;
													fileRef.current?.click();
												}}>
												{uploadingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ImageUp className="h-4 w-4 mr-1" /> Upload QRIS</>}
											</Button>
										</div>
										<div className="space-y-3">
											<div className="space-y-1.5">
												<Label className="text-xs">Nama merchant (wajib, sesuai yang tertera di QRIS)</Label>
												<Input value={c.merchantName} onChange={(e) => patch(c.id, { merchantName: e.target.value.slice(0, 120) })} />
											</div>
											<div className="space-y-1.5">
												<Label className="text-xs">Catatan untuk pembeli (opsional)</Label>
												<Textarea rows={2} value={c.note} onChange={(e) => patch(c.id, { note: e.target.value.slice(0, 300) })} />
											</div>
										</div>
									</div>
								) : (
									<div className="grid gap-3 sm:grid-cols-2">
										<ProviderSelect channel={c} onChange={(p) => patch(c.id, p)} />
										<div className="space-y-1.5">
											<Label className="text-xs">{c.type === 'bank' ? 'Nomor rekening' : 'Nomor akun / HP'}</Label>
											<Input inputMode="numeric" value={c.accountNumber} onChange={(e) => patch(c.id, { accountNumber: e.target.value.replace(/[^\d\s.-]/g, '').slice(0, 40) })} />
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs">Atas nama</Label>
											<Input value={c.accountHolder} onChange={(e) => patch(c.id, { accountHolder: e.target.value.slice(0, 120) })} />
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs">Catatan (opsional)</Label>
											<Input value={c.note} onChange={(e) => patch(c.id, { note: e.target.value.slice(0, 300) })} />
										</div>
									</div>
								)}
							</div>
						);
					})}
					<div className="flex flex-wrap gap-2">
						{(Object.keys(TYPE_META) as PaymentChannelType[]).map((t) => (
							<Button key={t} variant="outline" size="sm" onClick={() => setChannels((cs) => [...cs, blankChannel(t)])}>
								<Plus className="h-4 w-4 mr-1" /> {TYPE_META[t].label}
							</Button>
						))}
					</div>
				</div>

				<div className="space-y-3 border-t pt-4">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="font-medium text-sm">DP pre-order (default)</p>
							<p className="text-xs text-muted-foreground">
								Berlaku untuk produk pre-order yang memakai "Ikut default". Produk bisa mengganti persen/nominal atau mewajibkan
								bayar penuh. Ongkir & pajak selalu ikut dibayar saat DP.
							</p>
						</div>
						<Switch checked={dp.enabled} onCheckedChange={(v) => setDp((d) => ({ ...d, enabled: v }))} aria-label="Aktifkan DP default" />
					</div>
					{dp.enabled && (
						<div className="grid gap-3 sm:grid-cols-3">
							<div className="space-y-1.5">
								<Label className="text-xs">Jenis</Label>
								<select
									className="w-full rounded-md border bg-background px-3 py-2 text-sm"
									value={dp.mode}
									onChange={(e) => setDp((d) => ({ ...d, mode: e.target.value === 'amount' ? 'amount' : 'percent' }))}>
									<option value="percent">Persentase dari harga</option>
									<option value="amount">Nominal tetap per pcs</option>
								</select>
							</div>
							{dp.mode === 'percent' && (
								<div className="space-y-1.5">
									<Label className="text-xs">Persen DP</Label>
									<Input type="number" min={1} max={99} value={dp.percent} onChange={(e) => setDp((d) => ({ ...d, percent: Number(e.target.value) || 0 }))} />
								</div>
							)}
							<div className="space-y-1.5">
								<Label className="text-xs">{dp.mode === 'percent' ? 'Minimal DP per item (Rp, opsional)' : 'DP per pcs (Rp)'}</Label>
								<Input type="number" min={0} value={dp.amount} onChange={(e) => setDp((d) => ({ ...d, amount: Number(e.target.value) || 0 }))} />
							</div>
						</div>
					)}
					<div className="space-y-1.5">
						<Label className="text-xs">Ketentuan pembatalan (wajib dicentang pembeli saat checkout)</Label>
						<Textarea rows={3} value={dp.cancelPolicyText} onChange={(e) => setDp((d) => ({ ...d, cancelPolicyText: e.target.value.slice(0, 600) }))} />
					</div>
				</div>

				<Button onClick={() => save.mutate()} disabled={save.isPending}>
					{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan pembayaran'}
				</Button>
			</CardContent>
		</Card>
	);
}
