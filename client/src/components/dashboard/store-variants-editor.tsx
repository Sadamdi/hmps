import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import MediaDisplay from '@/components/MediaDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { StoreVariant } from '@shared/store-variants';

interface StoreVariantsEditorProps {
	groupName: string;
	onGroupNameChange: (v: string) => void;
	value: StoreVariant[];
	onChange: (next: StoreVariant[]) => void;
	/** Upload gambar (dipakai upload produk yang sudah ada); mengembalikan URL */
	uploadImage: (file: File) => Promise<string>;
	basePrice: number;
}

function newVariant(n: number): StoreVariant {
	return {
		id: `v-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
		label: `Varian ${String.fromCharCode(64 + Math.min(n, 26))}`,
		thumbnail: '',
		price: null,
		stock: -1,
		title: '',
		description: '',
		active: true,
	};
}

/**
 * Varian produk seperti marketplace: satu jenis pilihan (mis. Desain / Ukuran), tiap varian punya
 * nama, foto, harga, stok, serta judul & deskripsi pengganti (opsional).
 */
export function StoreVariantsEditor({ groupName, onGroupNameChange, value, onChange, uploadImage, basePrice }: StoreVariantsEditorProps) {
	const { toast } = useToast();
	const [uploadingId, setUploadingId] = useState<string | null>(null);
	const [openId, setOpenId] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement | null>(null);
	const pendingUploadFor = useRef<string | null>(null);

	const update = (id: string, patch: Partial<StoreVariant>) =>
		onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
	const move = (i: number, d: -1 | 1) => {
		const j = i + d;
		if (j < 0 || j >= value.length) return;
		const next = [...value];
		[next[i], next[j]] = [next[j], next[i]];
		onChange(next);
	};
	const add = () => {
		const v = newVariant(value.length + 1);
		onChange([...value, v]);
		setOpenId(v.id);
	};

	const onFile = async (file: File | undefined) => {
		const id = pendingUploadFor.current;
		if (!file || !id) return;
		setUploadingId(id);
		try {
			const url = await uploadImage(file);
			update(id, { thumbnail: url });
		} catch (e) {
			toast({ title: 'Upload foto varian gagal', description: (e as Error).message, variant: 'destructive' });
		} finally {
			setUploadingId(null);
			if (fileRef.current) fileRef.current.value = '';
		}
	};

	return (
		<div className="space-y-3">
			<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
			<div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-end">
				<div className="space-y-1">
					<Label className="text-xs">Nama pilihan</Label>
					<Input
						placeholder="mis. Desain / Ukuran / Warna"
						value={groupName}
						maxLength={40}
						onChange={(e) => onGroupNameChange(e.target.value)}
					/>
				</div>
				<p className="text-xs text-muted-foreground">
					Kosongkan daftar bila produk tanpa varian. Bila ada varian, pembeli wajib memilih, dan stok dihitung per varian
					(stok produk utama diabaikan).
				</p>
			</div>

			{value.map((v, i) => {
				const open = openId === v.id;
				return (
					<div key={v.id} className="rounded-lg border border-border">
						<div className="flex flex-wrap items-center gap-3 p-2">
							<button
								type="button"
								onClick={() => {
									pendingUploadFor.current = v.id;
									fileRef.current?.click();
								}}
								className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-dashed bg-muted"
								aria-label={`Foto ${v.label}`}>
								{uploadingId === v.id ? (
									<Loader2 className="m-auto h-5 w-5 animate-spin" />
								) : v.thumbnail ? (
									<MediaDisplay src={v.thumbnail} alt={v.label} className="h-full w-full object-cover" />
								) : (
									<ImagePlus className="m-auto h-5 w-5 text-muted-foreground" />
								)}
							</button>
							<Input
								aria-label="Nama varian"
								className="h-9 w-40"
								value={v.label}
								maxLength={60}
								onChange={(e) => update(v.id, { label: e.target.value })}
							/>
							<Input
								aria-label="Harga varian"
								className="h-9 w-32"
								type="number"
								min={0}
								placeholder={`Harga (${basePrice || 0})`}
								value={v.price ?? ''}
								onChange={(e) => update(v.id, { price: e.target.value === '' ? null : Number(e.target.value) })}
							/>
							<Input
								aria-label="Stok varian"
								className="h-9 w-28"
								type="number"
								min={0}
								placeholder="Stok (∞)"
								value={v.stock >= 0 ? v.stock : ''}
								onChange={(e) => update(v.id, { stock: e.target.value === '' ? -1 : Number(e.target.value) })}
							/>
							<div className="flex items-center gap-1.5">
								<Switch checked={v.active} onCheckedChange={(on) => update(v.id, { active: on })} aria-label="Aktif" />
								<span className="text-xs text-muted-foreground">{v.active ? 'Aktif' : 'Nonaktif'}</span>
							</div>
							<div className="ml-auto flex items-center">
								<Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Naikkan">
									<ArrowUp className="h-4 w-4" />
								</Button>
								<Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Turunkan">
									<ArrowDown className="h-4 w-4" />
								</Button>
								<Button type="button" size="sm" variant="ghost" onClick={() => setOpenId(open ? null : v.id)}>
									{open ? 'Tutup' : 'Detail'}
								</Button>
								<Button
									type="button"
									size="icon"
									variant="ghost"
									onClick={() => onChange(value.filter((x) => x.id !== v.id))}
									aria-label="Hapus varian">
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							</div>
						</div>
						{open && (
							<div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
								<div className="space-y-1">
									<Label className="text-xs">Link foto (opsional, bisa juga klik kotak foto untuk upload)</Label>
									<Input value={v.thumbnail} onChange={(e) => update(v.id, { thumbnail: e.target.value })} placeholder="/uploads/... atau https://..." />
								</div>
								<div className="space-y-1">
									<Label className="text-xs">Judul saat varian dipilih (opsional)</Label>
									<Input value={v.title} maxLength={200} onChange={(e) => update(v.id, { title: e.target.value })} placeholder="Kosong = judul produk" />
								</div>
								<div className="space-y-1 sm:col-span-2">
									<Label className="text-xs">Deskripsi singkat saat varian dipilih (opsional)</Label>
									<Textarea
										rows={2}
										maxLength={500}
										value={v.description}
										onChange={(e) => update(v.id, { description: e.target.value })}
										placeholder="Kosong = deskripsi singkat produk"
									/>
								</div>
							</div>
						)}
					</div>
				);
			})}
			<Button type="button" variant="outline" size="sm" onClick={add} disabled={value.length >= 30}>
				<Plus className="mr-1 h-4 w-4" /> Tambah varian
			</Button>
		</div>
	);
}
