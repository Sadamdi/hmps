import { useState } from 'react';
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { StoreWaAdmin } from '@shared/store-wa';

interface StoreWaAdminsEditorProps {
	value: StoreWaAdmin[];
	onChange: (next: StoreWaAdmin[]) => void;
	/** Teks saat daftar kosong (mis. "Memakai admin global") */
	emptyText?: string;
}

function newId(): string {
	return `admin-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Daftar admin WhatsApp toko: tambah / edit / hapus / on-off.
 * Dipakai di pengaturan global dan override per produk.
 */
export function StoreWaAdminsEditor({ value, onChange, emptyText }: StoreWaAdminsEditorProps) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draft, setDraft] = useState<{ name: string; phone: string }>({ name: '', phone: '' });

	const startEdit = (a: StoreWaAdmin) => {
		setEditingId(a.id);
		setDraft({ name: a.name, phone: a.phone });
	};
	const startCreate = () => {
		const id = newId();
		const next = [...value, { id, name: `Admin ${value.length + 1}`, phone: '', active: true }];
		onChange(next);
		setEditingId(id);
		setDraft({ name: `Admin ${value.length + 1}`, phone: '' });
	};
	const save = () => {
		if (!editingId) return;
		onChange(
			value.map((a, i) =>
				a.id === editingId
					? { ...a, name: draft.name.trim() || `Admin ${i + 1}`, phone: draft.phone.replace(/\D/g, '') }
					: a,
			),
		);
		setEditingId(null);
	};
	const cancel = () => {
		// Admin baru yang belum diisi nomor dibuang saat batal
		onChange(value.filter((a) => a.id !== editingId || a.phone));
		setEditingId(null);
	};
	const remove = (id: string) => onChange(value.filter((a) => a.id !== id));
	const toggle = (id: string, active: boolean) =>
		onChange(value.map((a) => (a.id === id ? { ...a, active } : a)));

	const activeCount = value.filter((a) => a.active && a.phone).length;

	return (
		<div className="space-y-2">
			{value.length === 0 && (
				<p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
					{emptyText || 'Belum ada admin WhatsApp.'}
				</p>
			)}
			{value.map((a) =>
				editingId === a.id ? (
					<div key={a.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
						<Input
							aria-label="Nama admin"
							placeholder="Nama admin (mis. Fiqah)"
							value={draft.name}
							onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
						/>
						<Input
							aria-label="Nomor WhatsApp"
							placeholder="62812..."
							inputMode="numeric"
							value={draft.phone}
							onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
						/>
						<div className="flex gap-2">
							<Button type="button" size="sm" onClick={save} disabled={!draft.phone.replace(/\D/g, '')}>
								<Check className="mr-1 h-4 w-4" /> Simpan
							</Button>
							<Button type="button" size="sm" variant="ghost" onClick={cancel}>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</div>
				) : (
					<div
						key={a.id}
						className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
					>
						<Switch
							checked={a.active}
							onCheckedChange={(v) => toggle(a.id, v)}
							aria-label={`Aktifkan ${a.name}`}
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium">{a.name || 'Admin'}</p>
							<p className="truncate text-xs text-muted-foreground">
								{a.phone ? `+${a.phone}` : 'Nomor belum diisi'} · {a.active ? 'On' : 'Off'}
							</p>
						</div>
						<Button type="button" size="icon" variant="ghost" onClick={() => startEdit(a)} aria-label="Edit">
							<Pencil className="h-4 w-4" />
						</Button>
						<Button type="button" size="icon" variant="ghost" onClick={() => remove(a.id)} aria-label="Hapus">
							<Trash2 className="h-4 w-4 text-destructive" />
						</Button>
					</div>
				),
			)}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Button type="button" size="sm" variant="outline" onClick={startCreate} disabled={!!editingId || value.length >= 10}>
					<Plus className="mr-1 h-4 w-4" /> Tambah admin
				</Button>
				{value.length > 0 && (
					<span className="text-xs text-muted-foreground">
						{activeCount === 0
							? 'Semua off → pembeli melihat "Mohon maaf, toko sedang tutup".'
							: activeCount === 1
								? '1 admin on → pembeli langsung diarahkan ke admin tersebut.'
								: `${activeCount} admin on → pembeli memilih admin tujuan.`}
					</span>
				)}
			</div>
		</div>
	);
}
