import { useState, type ReactNode } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export interface EditableAttachment {
	name: string;
	url: string;
	type?: string;
	source?: 'local' | 'gdrive' | 'url' | string;
}

const sourceLabel = (a: EditableAttachment) => (a.source === 'gdrive' ? 'gdrive' : a.source === 'url' ? 'link' : 'file');

/**
 * Daftar lampiran yang bisa diedit (nama; URL untuk lampiran link/Drive) dan dihapus.
 * Dipakai bersama oleh editor Berita dan Event. `extraActions` untuk tombol khusus (Copy Link, Sisipkan).
 */
export function AttachmentList<T extends EditableAttachment>({
	items,
	onChange,
	extraActions,
	className = 'max-h-64',
}: {
	items: T[];
	onChange: (next: T[]) => void;
	extraActions?: (att: T) => ReactNode;
	className?: string;
}) {
	const { toast } = useToast();
	const [editIdx, setEditIdx] = useState<number | null>(null);
	const [draftName, setDraftName] = useState('');
	const [draftUrl, setDraftUrl] = useState('');

	if (items.length === 0) return null;

	const startEdit = (i: number) => {
		setEditIdx(i);
		setDraftName(items[i].name);
		setDraftUrl(items[i].url);
	};

	const commit = (i: number) => {
		const att = items[i];
		const name = draftName.trim();
		if (!name) {
			toast({ title: 'Nama lampiran wajib diisi', variant: 'destructive' });
			return;
		}
		let url = att.url;
		if (att.source !== 'local') {
			url = draftUrl.trim();
			try {
				const u = new URL(url);
				if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('proto');
			} catch {
				toast({ title: 'URL lampiran harus http/https yang valid', variant: 'destructive' });
				return;
			}
			if (/drive\.google\.com\/drive\/folders\//i.test(url)) {
				toast({ title: 'Google Drive hanya mendukung link single-file, bukan folder', variant: 'destructive' });
				return;
			}
		}
		onChange(items.map((x, j) => (j === i ? { ...x, name, url } : x)));
		setEditIdx(null);
	};

	return (
		<div className={`space-y-1 overflow-y-auto ${className}`}>
			{items.map((att, idx) => {
				const editing = editIdx === idx;
				return (
					<div key={`att-${idx}-${att.url}`} className="rounded bg-muted/50 px-3 py-1.5 text-sm min-w-0">
						{editing ? (
							<div className="space-y-2">
								<Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Nama lampiran" aria-label="Nama lampiran" />
								{att.source !== 'local' ? (
									<Input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="https://..." aria-label="URL lampiran" />
								) : (
									<p className="text-[11px] text-muted-foreground">File yang diunggah: hanya nama tampilan yang bisa diubah. Untuk mengganti file, hapus lalu unggah ulang.</p>
								)}
								<div className="flex justify-end gap-2">
									<Button type="button" size="sm" variant="ghost" onClick={() => setEditIdx(null)}>
										<X className="h-3.5 w-3.5 mr-1" /> Batal
									</Button>
									<Button type="button" size="sm" onClick={() => commit(idx)}>
										<Check className="h-3.5 w-3.5 mr-1" /> Simpan
									</Button>
								</div>
							</div>
						) : (
							<div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
								<span className="min-w-0 flex-1 basis-40 truncate" title={att.name}>
									{att.name}
								</span>
								<span className="text-[10px] uppercase rounded px-1.5 py-0.5 bg-background border text-muted-foreground">{sourceLabel(att)}</span>
								<div className="flex items-center">
									{extraActions?.(att)}
									<Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => startEdit(idx)} aria-label={`Edit lampiran ${att.name}`}>
										<Pencil className="h-3 w-3 mr-1" /> Edit
									</Button>
									<Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onChange(items.filter((_, j) => j !== idx))} aria-label={`Hapus lampiran ${att.name}`}>
										<Trash2 className="h-3 w-3" />
									</Button>
								</div>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
