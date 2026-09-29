import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';

export const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/** Email pembeli (opsional) + penjelasan gunanya. Tampil hanya bila pengiriman email toko aktif. */
export function StoreEmailField({
	value,
	onChange,
	enabled,
}: {
	value: string;
	onChange: (v: string) => void;
	enabled: boolean;
}) {
	if (!enabled) return null;
	const invalid = value.trim() !== '' && !EMAIL_PATTERN.test(value.trim());
	return (
		<div className="space-y-1.5">
			<Label className="flex items-center gap-1.5">
				<Mail className="h-3.5 w-3.5" /> Email <span className="text-xs font-normal text-muted-foreground">(opsional)</span>
			</Label>
			<Input
				type="email"
				inputMode="email"
				autoComplete="email"
				placeholder="nama@email.com"
				value={value}
				aria-invalid={invalid}
				onChange={(e) => onChange(e.target.value.slice(0, 120))}
			/>
			{invalid ? (
				<p className="text-xs text-destructive">Format email belum benar.</p>
			) : (
				<p className="text-xs text-muted-foreground">
					Diisi supaya invoice dan kabar pesanan (pembayaran diverifikasi, dikirim, dll.) sampai ke email kamu. Tidak diisi juga tidak
					masalah — status tetap bisa dicek lewat link invoice.
				</p>
			)}
		</div>
	);
}

/** Email terakhir yang dipakai pembeli (hanya di perangkat ini) supaya tidak mengetik ulang. */
export function readSavedBuyerEmail(): string {
	try {
		return window.localStorage.getItem('store-buyer-email') || '';
	} catch {
		return '';
	}
}
export function saveBuyerEmail(v: string) {
	try {
		if (v) window.localStorage.setItem('store-buyer-email', v);
	} catch {
		/* diabaikan */
	}
}
