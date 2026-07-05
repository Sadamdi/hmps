import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useContentEnhance } from '@/hooks/use-content-enhance';
import type {
	ContentEnhanceEntityType,
	EnhanceFieldDef,
} from '@shared/content-enhance';
import { Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export type ContentEnhanceButtonProps = {
	entityType: ContentEnhanceEntityType;
	fields: EnhanceFieldDef[];
	values: Record<string, string | undefined>;
	onApply: (partial: Record<string, string>) => void;
	disabled?: boolean;
	className?: string;
};

function stripHtmlPreview(html: string, max = 220): string {
	const plain = html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (plain.length <= max) return plain;
	return `${plain.slice(0, max - 1)}…`;
}

export function ContentEnhanceButton({
	entityType,
	fields,
	values,
	onApply,
	disabled,
	className,
}: ContentEnhanceButtonProps) {
	const { toast } = useToast();
	const { loading, error, changes, meta, requestEnhance, reset } =
		useContentEnhance();
	const [open, setOpen] = useState(false);
	const [approved, setApproved] = useState<Record<string, boolean>>({});

	const filledFields = useMemo(() => {
		const out: Record<string, string> = {};
		const labels: Record<string, string> = {};
		for (const f of fields) {
			const v = values[f.key];
			if (typeof v === 'string' && v.trim()) {
				out[f.key] = v;
				labels[f.key] = f.label;
			}
		}
		return { out, labels };
	}, [fields, values]);

	useEffect(() => {
		if (!changes) return;
		const next: Record<string, boolean> = {};
		for (const c of changes) next[c.field] = true;
		setApproved(next);
	}, [changes]);

	const handleEnhance = async () => {
		if (!Object.keys(filledFields.out).length) {
			toast({
				title: 'Isi field dulu',
				description: 'Enhance membutuhkan minimal satu field teks yang sudah diisi.',
				variant: 'destructive',
			});
			return;
		}
		setOpen(true);
		try {
			await requestEnhance({
				entityType,
				fields: filledFields.out,
				fieldLabels: filledFields.labels,
				preserveHtml: true,
			});
		} catch (e) {
			toast({
				title: 'Enhance gagal',
				description: (e as Error).message,
				variant: 'destructive',
			});
		}
	};

	const handleApply = () => {
		if (!changes?.length) return;
		const partial: Record<string, string> = {};
		for (const c of changes) {
			if (approved[c.field]) partial[c.field] = c.after;
		}
		if (!Object.keys(partial).length) {
			toast({
				title: 'Tidak ada perubahan',
				description: 'Pilih minimal satu field untuk diterapkan.',
				variant: 'destructive',
			});
			return;
		}
		onApply(partial);
		toast({ title: 'Perubahan diterapkan', description: 'Klik Simpan untuk menyimpan ke server.' });
		setOpen(false);
		reset();
	};

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className={className}
				disabled={disabled || loading}
				onClick={handleEnhance}
			>
				{loading ? (
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
				) : (
					<Sparkles className="mr-2 h-4 w-4" />
				)}
				Enhance dengan AI
			</Button>

			<Dialog
				open={open}
				onOpenChange={(v) => {
					setOpen(v);
					if (!v) reset();
				}}
			>
				<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Preview Enhance AI</DialogTitle>
						<DialogDescription>
							Setujui atau tolak perubahan per field sebelum diterapkan ke form.
							{meta ? ` (${meta.provider} / ${meta.model})` : ''}
						</DialogDescription>
					</DialogHeader>

					{loading && (
						<div className="flex items-center gap-2 py-8 text-muted-foreground">
							<Loader2 className="h-5 w-5 animate-spin" />
							Memproses dengan AI…
						</div>
					)}

					{error && !loading && (
						<p className="text-sm text-destructive">{error}</p>
					)}

					{changes && !loading && (
						<div className="space-y-4">
							{changes.map((c) => (
								<div
									key={c.field}
									className="rounded-lg border p-3 space-y-2"
								>
									<div className="flex items-start gap-2">
										<Checkbox
											id={`approve-${c.field}`}
											checked={approved[c.field] ?? false}
											onCheckedChange={(v) =>
												setApproved((prev) => ({
													...prev,
													[c.field]: v === true,
												}))
											}
										/>
										<label
											htmlFor={`approve-${c.field}`}
											className="font-medium text-sm cursor-pointer"
										>
											{c.label}
										</label>
									</div>
									<div className="grid gap-2 text-sm md:grid-cols-2">
										<div>
											<p className="text-xs text-muted-foreground mb-1">
												Sebelum
											</p>
											<p className="rounded bg-muted/60 p-2 line-through opacity-80 whitespace-pre-wrap break-words">
												{stripHtmlPreview(c.before, 400)}
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground mb-1">
												Sesudah
											</p>
											<p className="rounded bg-primary/5 border border-primary/20 p-2 whitespace-pre-wrap break-words">
												{stripHtmlPreview(c.after, 400)}
											</p>
										</div>
									</div>
									{c.reason ? (
										<p className="text-xs text-muted-foreground">
											Alasan: {c.reason}
										</p>
									) : null}
								</div>
							))}
						</div>
					)}

					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								setOpen(false);
								reset();
							}}
						>
							Batal
						</Button>
						{changes && !loading ? (
							<>
								<Button
									type="button"
									variant="secondary"
									onClick={() => {
										const all: Record<string, boolean> = {};
										for (const c of changes) all[c.field] = true;
										setApproved(all);
									}}
								>
									Setujui semua
								</Button>
								<Button type="button" onClick={handleApply}>
									Terapkan yang disetujui
								</Button>
							</>
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
