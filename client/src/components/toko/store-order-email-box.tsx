import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { EMAIL_PATTERN, saveBuyerEmail } from './store-email-field';

const mask = (e: string) => e.replace(/^(.{1,2})[^@]*(@.*)$/, '$1***$2');

/**
 * Di invoice: bila pembeli belum mengisi email, tawarkan kabar pesanan lewat email (opsional);
 * bila sudah, tampilkan ke mana kabar dikirim dan izinkan mengganti.
 */
export function StoreOrderEmailBox({
	orderNo,
	apiBase,
	inv,
	email,
	enabled,
	onChanged,
}: {
	orderNo: string;
	apiBase: string;
	inv: string;
	email?: string;
	enabled: boolean;
	onChanged: () => void;
}) {
	const { toast } = useToast();
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState('');
	const [busy, setBusy] = useState(false);
	if (!enabled) return null;

	const save = async () => {
		const v = value.trim().toLowerCase();
		if (!EMAIL_PATTERN.test(v)) return toast({ title: 'Format email belum benar', variant: 'destructive' });
		setBusy(true);
		try {
			const q = inv ? `?inv=${encodeURIComponent(inv)}` : '';
			const r = await fetch(`${apiBase}/orders/${encodeURIComponent(orderNo)}/email${q}`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: v }),
			});
			const d = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(d?.message || 'Gagal menyimpan email');
			saveBuyerEmail(v);
			toast({ title: 'Email tersimpan', description: 'Kabar pesanan berikutnya dikirim ke email ini.' });
			setEditing(false);
			setValue('');
			onChanged();
		} catch (e) {
			toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="border-t pt-4 space-y-2 text-sm">
			<p className="flex items-center gap-2 font-medium">
				<Mail className="h-4 w-4 text-primary" /> Kabar lewat email
			</p>
			{email && !editing ? (
				<p className="text-muted-foreground">
					Invoice dan kabar pesanan (pembayaran, pengiriman, dll.) dikirim ke <strong>{mask(email)}</strong>.{' '}
					<button type="button" className="text-primary underline" onClick={() => setEditing(true)}>
						Ganti
					</button>
				</p>
			) : (
				<>
					<p className="text-xs text-muted-foreground">
						{email ? 'Masukkan email baru.' : 'Opsional: isi email supaya invoice dan kabar pesanan (pembayaran diverifikasi, dikirim, dll.) sampai ke kotak masukmu. Tidak diisi pun tidak masalah.'}
					</p>
					<div className="flex gap-2">
						<Input type="email" inputMode="email" placeholder="nama@email.com" value={value} onChange={(e) => setValue(e.target.value.slice(0, 120))} />
						<Button onClick={save} disabled={busy || !value.trim()}>
							{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
						</Button>
						{editing && (
							<Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
								Batal
							</Button>
						)}
					</div>
				</>
			)}
		</div>
	);
}
