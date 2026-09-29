import { useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import type { StoreWaAdminPublic } from '@shared/store-wa';
import { STORE_CLOSED_MESSAGE } from '@shared/store-wa';

interface StoreWaAdminPickerProps {
	admins: StoreWaAdminPublic[] | undefined;
	value: string;
	onChange: (id: string) => void;
}

/**
 * Pilih admin WhatsApp tujuan pesanan.
 * 0 admin → pesan toko tutup; 1 → otomatis (hanya info); >1 → pembeli memilih.
 */
export function StoreWaAdminPicker({ admins, value, onChange }: StoreWaAdminPickerProps) {
	const list = admins || [];
	useEffect(() => {
		if (list.length === 1 && value !== list[0].id) onChange(list[0].id);
		if (list.length > 1 && value && !list.some((a) => a.id === value)) onChange('');
	}, [list, value, onChange]);

	if (!admins) return null;
	if (list.length === 0) {
		return (
			<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{STORE_CLOSED_MESSAGE}
			</p>
		);
	}
	if (list.length === 1) {
		return (
			<p className="flex items-center gap-2 text-sm text-muted-foreground">
				<MessageCircle className="h-4 w-4" /> Pesanan dikirim ke <strong>{list[0].name}</strong>
			</p>
		);
	}
	return (
		<div className="space-y-2">
			<Label>Kirim pesanan ke admin</Label>
			<div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Admin tujuan">
				{list.map((a) => (
					<button
						key={a.id}
						type="button"
						role="radio"
						aria-checked={value === a.id}
						onClick={() => onChange(a.id)}
						className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
							value === a.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
						}`}>
						<MessageCircle className="h-4 w-4 shrink-0" />
						<span className="truncate">{a.name}</span>
					</button>
				))}
			</div>
		</div>
	);
}

/** True bila pembeli masih harus memilih admin (lebih dari 1 aktif dan belum dipilih). */
export function needsAdminChoice(admins: StoreWaAdminPublic[] | undefined, value: string): boolean {
	return (admins?.length || 0) > 1 && !value;
}
