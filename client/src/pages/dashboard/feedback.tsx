import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import FeedbackFormPreview from '@/components/dashboard/feedback-form-preview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	BookOpen,
	Bug,
	Check,
	CheckCircle2,
	ChevronsUpDown,
	Download,
	Eye,
	EyeOff,
	FileText,
	LayoutPanelLeft,
	Loader2,
	MessageSquareReply,
	Monitor,
	Plus,
	RefreshCw,
	Server,
	Settings2,
	Sparkles,
	Star,
	Trash2,
	XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildSimpleSpyroPageData } from '@shared/dashboard-spyro-context';
import type {
	FeedbackItem,
	FeedbackFormConfig,
	FeedbackDestination,
	FeedbackTypePerDestination,
	FeedbackFieldDefinition,
	FeedbackRatingDimension,
	FeedbackFieldKind,
	BugReportItem,
	SystemErrorItem,
} from '@shared/schema';
import { DEFAULT_FEEDBACK_FORM_CONFIG, feedbackDecisionTypeIds } from '@shared/schema';
import { useTenant } from '@/lib/tenant-context';

const STATUS_LABELS: Record<string, string> = {
	pending: 'Menunggu',
	accepted: 'Diterima',
	rejected: 'Ditolak',
};

const FIELD_KIND_OPTIONS: { value: FeedbackFieldKind; label: string }[] = [
	{ value: 'short_text', label: 'Jawaban singkat (satu baris)' },
	{ value: 'textarea', label: 'Jawaban panjang (beberapa baris)' },
	{ value: 'rich_html', label: 'Teks berformat (bold, list, …)' },
	{ value: 'select', label: 'Pilihan tunggal (dropdown)' },
	{ value: 'checkbox', label: 'Satu centang (setuju / ya–tidak)' },
	{ value: 'multi_select', label: 'Pilihan ganda (beberapa opsi)' },
	{ value: 'file', label: 'Lampiran (unggah file)' },
];

function genId(prefix: string): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
	}
	return `${prefix}_${Date.now()}`;
}

function SelectOptionsEditor({
	fieldId,
	options,
	updateField,
}: {
	fieldId: string;
	options: string[] | undefined;
	updateField: (fid: string, patch: Partial<FeedbackFieldDefinition>) => void;
}) {
	const rows = options && options.length > 0 ? options : [''];
	return (
		<div className="space-y-2">
			<Label className="text-xs font-medium">Daftar pilihan</Label>
			<p className="text-xs text-muted-foreground leading-relaxed">
				Satu baris per opsi. Contoh baris pertama <span className="text-foreground/80">Puas</span>, baris berikutnya{' '}
				<span className="text-foreground/80">Cukup</span>, lalu <span className="text-foreground/80">Kurang</span>.
			</p>
			<div className="space-y-2">
				{rows.map((opt, i) => (
					<div key={i} className="flex gap-2 items-center">
						<Input
							className="h-10 flex-1"
							placeholder={i === 0 ? 'Mis. Puas' : `Opsi ${i + 1}`}
							value={opt}
							onChange={(e) => {
								const next = [...rows];
								next[i] = e.target.value;
								updateField(fieldId, { options: next });
							}}
						/>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							className="text-destructive shrink-0"
							disabled={rows.length <= 1 && !opt.trim()}
							onClick={() => {
								const next = rows.filter((_, j) => j !== i);
								updateField(fieldId, { options: next.length ? next : [] });
							}}
							aria-label="Hapus opsi"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				))}
			</div>
			<Button type="button" size="sm" variant="outline" onClick={() => updateField(fieldId, { options: [...rows, ''] })}>
				<Plus className="h-4 w-4 mr-1" />
				Tambah opsi
			</Button>
		</div>
	);
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
	return (
		<span className="inline-flex items-center gap-0.5">
			{Array.from({ length: max }, (_, i) => i + 1).map((i) => (
				<Star
					key={i}
					className={`h-3.5 w-3.5 ${i <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
				/>
			))}
			<span className="text-xs ml-1 text-muted-foreground">
				{value > 0 ? value.toFixed(1) : '-'}
			</span>
		</span>
	);
}

function SuggestionStatusBadge({ status }: { status: string }) {
	if (status === 'accepted') {
		return <Badge variant="outline" className="border-green-500/50 text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Diterima</Badge>;
	}
	if (status === 'rejected') {
		return <Badge variant="outline" className="border-red-500/50 text-red-600"><XCircle className="h-3 w-3 mr-1" />Ditolak</Badge>;
	}
	return <Badge variant="secondary">Menunggu</Badge>;
}

function formatExtraValue(val: unknown): string {
	if (val === null || val === undefined) return '';
	if (typeof val === 'boolean') return val ? 'Ya' : 'Tidak';
	if (Array.isArray(val)) {
		if (val.length && typeof val[0] === 'object' && val[0] !== null && 'url' in (val[0] as object)) {
			return `${val.length} lampiran`;
		}
		return val.join(', ');
	}
	if (typeof val === 'string' && val.length > 200) return val.slice(0, 200) + '…';
	return String(val);
}

function ConfigEditor({ config, onSave, isSaving }: { config: FeedbackFormConfig; onSave: (c: FeedbackFormConfig) => void; isSaving: boolean }) {
	const [destinations, setDestinations] = useState<FeedbackDestination[]>(() =>
		[...config.destinations].sort((a, b) => a.order - b.order),
	);
	const [selectedId, setSelectedId] = useState<string | null>(() => config.destinations[0]?.id ?? null);
	const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
	const [configView, setConfigView] = useState<'edit' | 'preview'>('edit');
	const [destOpen, setDestOpen] = useState(false);
	const [fieldOpen, setFieldOpen] = useState(false);

	const selected = destinations.find((d) => d.id === selectedId);
	const sortedFields = useMemo(
		() => (selected ? [...selected.fields].sort((a, b) => a.order - b.order) : []),
		[selected],
	);
	const selectedField = sortedFields.find((f) => f.id === selectedFieldId);
	const fieldIndex = sortedFields.findIndex((f) => f.id === selectedFieldId);

	const updateDest = (id: string, patch: Partial<FeedbackDestination>) => {
		setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
	};

	const addDestination = () => {
		const id = genId('dest');
		const blank: FeedbackDestination = {
			id,
			label: 'Formulir baru',
			order: destinations.length,
			types: [{ id: genId('type'), label: 'Saran', order: 0, enableDecisionWorkflow: true }],
			fields: [{ id: genId('field'), label: 'Isi masukan', order: 0, kind: 'textarea', required: true }],
			ratings: [],
		};
		setDestinations((prev) => [...prev, blank]);
		setSelectedId(id);
		setSelectedFieldId(null);
		setConfigView('edit');
	};

	const removeDestination = (id: string) => {
		setDestinations((prev) => {
			const next = prev.filter((d) => d.id !== id).map((d, i) => ({ ...d, order: i }));
			if (selectedId === id) {
				setSelectedId(next[0]?.id ?? null);
				setSelectedFieldId(null);
			}
			return next;
		});
	};

	const handleSave = () => {
		const cleaned = destinations.map((d, i) => ({
			...d,
			order: i,
			fields: d.fields.map((f) => {
				if (f.kind !== 'select' && f.kind !== 'multi_select') return f;
				const opts = (f.options || []).map((s) => s.trim()).filter(Boolean);
				return { ...f, options: opts };
			}),
		}));
		onSave({ destinations: cleaned });
	};

	const addType = () => {
		if (!selected) return;
		updateDest(selected.id, {
			types: [...selected.types, { id: genId('type'), label: '', order: selected.types.length, enableDecisionWorkflow: false }],
		});
	};

	const updateType = (tid: string, patch: Partial<FeedbackTypePerDestination>) => {
		if (!selected) return;
		updateDest(selected.id, { types: selected.types.map((t) => (t.id === tid ? { ...t, ...patch } : t)) });
	};

	const removeType = (tid: string) => {
		if (!selected) return;
		updateDest(selected.id, { types: selected.types.filter((t) => t.id !== tid) });
	};

	const addField = () => {
		if (!selected) return;
		const id = genId('field');
		updateDest(selected.id, {
			fields: [...selected.fields, { id, label: '', order: selected.fields.length, kind: 'short_text' as FeedbackFieldKind, required: false }],
		});
		setSelectedFieldId(id);
	};

	const updateField = (fid: string, patch: Partial<FeedbackFieldDefinition>) => {
		if (!selected) return;
		updateDest(selected.id, { fields: selected.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)) });
	};

	const removeField = (fid: string) => {
		if (!selected) return;
		updateDest(selected.id, { fields: selected.fields.filter((f) => f.id !== fid).map((f, i) => ({ ...f, order: i })) });
		if (selectedFieldId === fid) setSelectedFieldId(null);
	};

	const moveField = (fid: string, dir: number) => {
		const sorted = [...sortedFields];
		const idx = sorted.findIndex((f) => f.id === fid);
		const swapIdx = idx + dir;
		if (swapIdx < 0 || swapIdx >= sorted.length) return;
		[sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
		updateDest(selected!.id, { fields: sorted.map((f, i) => ({ ...f, order: i })) });
	};

	const addRating = () => {
		if (!selected) return;
		updateDest(selected.id, { ratings: [...selected.ratings, { id: genId('rating'), label: '' }] });
	};

	const updateRating = (rid: string, patch: Partial<FeedbackRatingDimension>) => {
		if (!selected) return;
		updateDest(selected.id, { ratings: selected.ratings.map((r) => (r.id === rid ? { ...r, ...patch } : r)) });
	};

	const removeRating = (rid: string) => {
		if (!selected) return;
		updateDest(selected.id, { ratings: selected.ratings.filter((r) => r.id !== rid) });
	};

	return (
		<div className="max-w-4xl space-y-8">
			<Card className="border-primary/20 bg-muted/20 shadow-sm">
				<CardHeader className="pb-2">
					<CardTitle className="text-lg font-semibold tracking-tight">Cara membuat formulir</CardTitle>
					<CardDescription className="text-sm leading-relaxed">
						Pilih formulir, atur jenis masukan, susun pertanyaan, lalu simpan.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 pt-0">
					<ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2 leading-relaxed">
						<li><span className="text-foreground">Pilih atau buat formulir</span> — misalnya Website atau Prodi.</li>
						<li><span className="text-foreground">Isi nama formulir</span> dan <span className="text-foreground">jenis masukan</span> (Saran, Kritik, …).</li>
						<li><span className="text-foreground">Tambah pertanyaan</span> dan atur urutannya.</li>
						<li>Buka <span className="text-foreground">Lihat pratinjau</span> bila perlu, lalu klik <span className="text-foreground">Simpan perubahan</span>.</li>
					</ol>
				</CardContent>
			</Card>

			<section className="space-y-3">
				<div>
					<h3 className="text-sm font-semibold text-foreground">1. Formulir yang diedit</h3>
					<p className="text-xs text-muted-foreground mt-0.5">Ini yang akan dipilih pengunjung di form publik. Gunakan pencarian jika ada banyak formulir.</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Popover open={destOpen} onOpenChange={setDestOpen}>
						<PopoverTrigger asChild>
							<Button variant="outline" role="combobox" aria-expanded={destOpen} className="w-full sm:min-w-[280px] sm:max-w-md justify-between h-11">
								<span className="truncate text-left">{selected ? selected.label || '(beri nama formulir)' : 'Pilih formulir…'}</span>
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
							<Command>
								<CommandInput placeholder="Cari nama formulir…" />
								<CommandList>
									<CommandEmpty>Tidak ada yang cocok</CommandEmpty>
									<CommandGroup>
										{[...destinations].sort((a, b) => a.order - b.order).map((d) => (
											<CommandItem
												key={d.id}
												value={d.label || d.id}
												onSelect={() => { setSelectedId(d.id); setDestOpen(false); setSelectedFieldId(null); }}
											>
												<Check className={cn('mr-2 h-4 w-4', d.id === selectedId ? 'opacity-100' : 'opacity-0')} />
												{d.label || '(beri nama formulir)'}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					<Button size="sm" variant="secondary" className="h-11" onClick={addDestination}><Plus className="h-4 w-4 mr-1" />Formulir baru</Button>
					{selected && (
						<Button size="sm" variant="outline" className="h-11 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => removeDestination(selected.id)}>
							<Trash2 className="h-4 w-4 mr-1" />Hapus formulir ini
						</Button>
					)}
				</div>
			</section>

			{selected && (
				<>
					<Tabs value={configView} onValueChange={(v) => setConfigView(v as 'edit' | 'preview')}>
						<TabsList className="grid w-full max-w-md grid-cols-2 h-11">
							<TabsTrigger value="edit" className="text-sm">Susun form</TabsTrigger>
							<TabsTrigger value="preview" className="text-sm">Lihat pratinjau</TabsTrigger>
						</TabsList>

						<TabsContent value="edit" className="space-y-6 mt-6">
							<Card className="shadow-sm">
								<CardHeader className="space-y-1 pb-3">
									<CardTitle className="text-base font-semibold">2. Nama formulir</CardTitle>
									<CardDescription>Nama yang terbaca manusia untuk pengunjung dan admin (bukan kode teknis).</CardDescription>
								</CardHeader>
								<CardContent>
									<Label htmlFor="fb-dest-label" className="sr-only">Nama formulir</Label>
									<Input
										id="fb-dest-label"
										placeholder="Contoh: Website kampus, Himatif Encoder, Form prodi…"
										className="h-11"
										value={selected.label}
										onChange={(e) => updateDest(selected.id, { label: e.target.value })}
									/>
								</CardContent>
							</Card>

							<Card className="shadow-sm">
								<CardHeader className="space-y-1 pb-3">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<CardTitle className="text-base font-semibold">3. Jenis masukan</CardTitle>
											<CardDescription>Tombol atau tab di form publik: Saran, Kritik, atau kategori lain.</CardDescription>
										</div>
										<Button size="sm" variant="secondary" onClick={addType}><Plus className="h-4 w-4 mr-1" />Tambah jenis</Button>
									</div>
								</CardHeader>
								<CardContent className="space-y-3">
									{[...selected.types].sort((a, b) => a.order - b.order).map((t) => (
										<div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/50 p-4">
											<Input className="flex-1 min-w-[140px] h-10" placeholder="Nama jenis, mis. Saran" value={t.label} onChange={(e) => updateType(t.id, { label: e.target.value })} />
											<label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
												<Checkbox checked={t.enableDecisionWorkflow} onCheckedChange={(c) => updateType(t.id, { enableDecisionWorkflow: !!c })} />
												Moderator bisa terima / tolak
											</label>
											<Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeType(t.id)} aria-label="Hapus jenis"><Trash2 className="h-4 w-4" /></Button>
										</div>
									))}
								</CardContent>
							</Card>

							<Card className="shadow-sm">
								<CardHeader className="space-y-1 pb-3">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<CardTitle className="text-base font-semibold">4. Pertanyaan ({sortedFields.length})</CardTitle>
											<CardDescription>Urutan di sini sama dengan urutan di form publik.</CardDescription>
										</div>
										<Button size="sm" variant="secondary" onClick={addField}><Plus className="h-4 w-4 mr-1" />Tambah pertanyaan</Button>
									</div>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex flex-wrap items-center gap-2">
										<Popover open={fieldOpen} onOpenChange={setFieldOpen}>
											<PopoverTrigger asChild>
												<Button variant="outline" role="combobox" aria-expanded={fieldOpen} className="w-full sm:min-w-[280px] sm:max-w-xl justify-between h-11">
													<span className="truncate text-left">
														{selectedField
															? `${selectedField.label || '(beri judul pertanyaan)'} — ${FIELD_KIND_OPTIONS.find((o) => o.value === selectedField.kind)?.label || selectedField.kind}`
															: 'Pilih pertanyaan untuk diedit…'}
													</span>
													<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
												<Command>
													<CommandInput placeholder="Cari pertanyaan…" />
													<CommandList>
														<CommandEmpty>Tidak ada yang cocok</CommandEmpty>
														<CommandGroup>
															{sortedFields.map((f, i) => (
																<CommandItem
																	key={f.id}
																	value={`${f.label || f.id} ${FIELD_KIND_OPTIONS.find((o) => o.value === f.kind)?.label || f.kind}`}
																	onSelect={() => { setSelectedFieldId(f.id); setFieldOpen(false); }}
																>
																	<Check className={cn('mr-2 h-4 w-4', f.id === selectedFieldId ? 'opacity-100' : 'opacity-0')} />
																	<span className="truncate">{i + 1}. {f.label || '(beri judul)'}</span>
																	<span className="ml-auto max-w-[45%] truncate text-right text-[10px] text-muted-foreground">{FIELD_KIND_OPTIONS.find((o) => o.value === f.kind)?.label || f.kind}</span>
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												</Command>
											</PopoverContent>
										</Popover>
									</div>

									{selectedField && (
										<div className="rounded-xl border bg-muted/20 p-5 space-y-4">
											<div className="flex items-center justify-between gap-2">
												<p className="text-sm font-medium text-foreground">
													Pertanyaan ke-{fieldIndex + 1} dari {sortedFields.length}
												</p>
												<div className="flex items-center gap-1">
													<Button size="icon" variant="ghost" disabled={fieldIndex === 0} onClick={() => moveField(selectedField.id, -1)} title="Naik">
														<ArrowUp className="h-3.5 w-3.5" />
													</Button>
													<Button size="icon" variant="ghost" disabled={fieldIndex === sortedFields.length - 1} onClick={() => moveField(selectedField.id, 1)} title="Turun">
														<ArrowDown className="h-3.5 w-3.5" />
													</Button>
													<Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeField(selectedField.id)} title="Hapus">
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</div>
											</div>

											<div className="grid gap-4 sm:grid-cols-2">
												<div className="space-y-1.5">
													<Label className="text-xs font-medium">Judul pertanyaan</Label>
													<Input className="h-10" placeholder="Contoh: Apa saran Anda untuk website?" value={selectedField.label} onChange={(e) => updateField(selectedField.id, { label: e.target.value })} />
												</div>
												<div className="space-y-1.5">
													<Label className="text-xs font-medium">Tipe jawaban</Label>
													<Select value={selectedField.kind} onValueChange={(v: FeedbackFieldKind) => updateField(selectedField.id, { kind: v })}>
														<SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
														<SelectContent className="max-h-72">
															{FIELD_KIND_OPTIONS.map((o) => (
																<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											</div>

											<div className="flex flex-wrap gap-5 pt-1">
												<label className="flex items-center gap-2 text-sm cursor-pointer">
													<Checkbox checked={!!selectedField.required} onCheckedChange={(c) => updateField(selectedField.id, { required: !!c })} />
													Wajib diisi pengunjung
												</label>
												<label className="flex items-start gap-2 text-sm cursor-pointer">
													<Checkbox className="mt-0.5" checked={!!selectedField.useForCardPreview} onCheckedChange={(c) => updateField(selectedField.id, { useForCardPreview: !!c })} />
													<span>
														Tampilkan cuplikan di kartu publik
														<span className="block text-xs text-muted-foreground font-normal mt-0.5">Jika diisi, teks kolom ini dipakai sebagai ringkasan di kartu berjalan di footer.</span>
													</span>
												</label>
											</div>

											{(selectedField.kind === 'select' || selectedField.kind === 'multi_select') && (
												<SelectOptionsEditor
													fieldId={selectedField.id}
													options={selectedField.options}
													updateField={updateField}
												/>
											)}
											{selectedField.kind === 'file' && (
												<div className="flex flex-wrap items-center gap-3">
													<Label className="text-xs font-medium whitespace-nowrap">Maks. jumlah berkas</Label>
													<Input
														type="number"
														min={1}
														max={20}
														className="w-24 h-10"
														value={selectedField.maxFiles ?? 10}
														onChange={(e) => updateField(selectedField.id, { maxFiles: parseInt(e.target.value, 10) || 10 })}
													/>
												</div>
											)}
											<div className="space-y-1.5">
												<Label className="text-xs font-medium">Teks contoh di kolom (opsional)</Label>
												<Input
													className="h-10"
													placeholder="Muncul abu-abu di dalam kolom sebelum pengunjung mengetik"
													value={selectedField.placeholder || ''}
													onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value || undefined })}
												/>
											</div>
											<div className="space-y-1.5">
												<Label className="text-xs font-medium">Petunjuk di bawah pertanyaan (opsional)</Label>
												<Input
													className="h-10"
													placeholder="Penjelasan singkat untuk pengunjung"
													value={selectedField.helpText || ''}
													onChange={(e) => updateField(selectedField.id, { helpText: e.target.value || undefined })}
												/>
											</div>
										</div>
									)}
								</CardContent>
							</Card>

							<Card className="shadow-sm">
								<CardHeader className="space-y-1 pb-3">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<CardTitle className="text-base font-semibold">5. Penilaian bintang (opsional)</CardTitle>
											<CardDescription>Setiap baris = satu aspek yang dinilai 1–5 bintang di form publik. Boleh dikosongkan.</CardDescription>
										</div>
										<Button size="sm" variant="secondary" onClick={addRating}><Plus className="h-4 w-4 mr-1" />Tambah aspek</Button>
									</div>
								</CardHeader>
								<CardContent className="space-y-3">
									{selected.ratings.map((r) => (
										<div key={r.id} className="flex items-center gap-2 rounded-lg border bg-background/50 p-2">
											<Input className="flex-1 h-10 border-0 shadow-none focus-visible:ring-0" placeholder="Contoh: Kualitas layanan, Tampilan website…" value={r.label} onChange={(e) => updateRating(r.id, { label: e.target.value })} />
											<Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeRating(r.id)} aria-label="Hapus"><Trash2 className="h-4 w-4" /></Button>
										</div>
									))}
									<p className="text-xs text-muted-foreground leading-relaxed">Skala selalu 1–5 bintang; pengunjung boleh melewati jika tidak wajib.</p>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="preview" className="mt-6">
							<p className="text-sm text-muted-foreground mb-4 max-w-xl">Pratinjau mengikuti perubahan di tab Susun form (tanpa mengirim data sungguhan).</p>
							<FeedbackFormPreview destination={selected} />
						</TabsContent>
					</Tabs>

					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2 border-t">
						<p className="text-xs text-muted-foreground sm:mr-auto order-2 sm:order-1">Simpan untuk menerapkan ke form publik.</p>
						<Button size="lg" className="order-1 sm:order-2 min-w-[200px]" onClick={handleSave} disabled={isSaving}>
							{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Simpan perubahan
						</Button>
					</div>
				</>
			)}
		</div>
	);
}

const CODE_EXTENSIONS = new Set([
	'.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs',
	'.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.sql',
	'.html', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml',
	'.toml', '.ini', '.cfg', '.conf', '.sh', '.bash', '.zsh', '.bat', '.ps1',
	'.md', '.txt', '.log', '.env', '.gitignore', '.dockerfile',
]);

function getFileExt(name: string): string {
	const idx = name.lastIndexOf('.');
	return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function isCodeLikeFile(name: string): boolean {
	return CODE_EXTENSIONS.has(getFileExt(name));
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UniversalFilePreview({ url, name, mimeType, size }: { url: string; name: string; mimeType?: string; size?: number }) {
	const [showPreview, setShowPreview] = useState(false);
	const [codeContent, setCodeContent] = useState<string | null>(null);
	const [codeLoading, setCodeLoading] = useState(false);

	const mime = mimeType || '';
	const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(name);
	const isVideo = mime.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi)$/i.test(name);
	const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name);
	const isCode = isCodeLikeFile(name);

	const loadCode = async () => {
		if (codeContent !== null) return;
		setCodeLoading(true);
		try {
			const res = await fetch(url);
			const text = await res.text();
			setCodeContent(text.slice(0, 8000));
		} catch {
			setCodeContent('(Gagal memuat konten file)');
		} finally {
			setCodeLoading(false);
		}
	};

	return (
		<div className="border rounded-md overflow-hidden">
			<div className="flex items-center gap-2 p-2 bg-muted/50">
				<FileText className="h-4 w-4 text-muted-foreground shrink-0" />
				<span className="text-sm truncate flex-1">{name}</span>
				{size != null && size > 0 && <span className="text-xs text-muted-foreground">{formatBytes(size)}</span>}
				{(isImage || isVideo || isPdf || isCode) && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2"
						onClick={() => {
							setShowPreview(!showPreview);
							if (isCode && !showPreview) loadCode();
						}}
					>
						<Eye className="h-3.5 w-3.5 mr-1" />
						{showPreview ? 'Tutup' : 'Preview'}
					</Button>
				)}
				<a href={url} download={name} target="_blank" rel="noopener noreferrer">
					<Button variant="ghost" size="sm" className="h-7 px-2">
						<Download className="h-3.5 w-3.5 mr-1" />
						Download
					</Button>
				</a>
			</div>

			{showPreview && (
				<div className="p-3 border-t">
					{isImage && <img src={url} alt={name} className="max-w-full max-h-96 rounded" />}
					{isVideo && <video src={url} controls className="max-w-full max-h-96 rounded" />}
					{isPdf && <iframe src={url} title={name} className="w-full h-96 rounded border" />}
					{isCode && (
						codeLoading ? (
							<div className="flex items-center gap-2 p-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat...</div>
						) : (
							<pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap font-mono">{codeContent}</pre>
						)
					)}
				</div>
			)}
		</div>
	);
}

export default function FeedbackPage() {
	const { user, hasSpecificPermission } = useAuth();
	const { isTenant } = useTenant();
	usePermissionRefresh();

	const { hasPermission, isLoading: isPermLoading } = usePermissionGuardAny([
		'feedback.view',
		'feedback.manage',
	]);

	const canManage = hasSpecificPermission('feedback.manage');
	const isOwner = user?.role === 'owner' && !isTenant;
	const { toast } = useToast();

	const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
	const initialTab = urlParams?.get('tab') === 'bugs' && isOwner ? 'bugs' : 'list';
	const [activeTab, setActiveTab] = useState(initialTab);
	const [listDestTab, setListDestTab] = useState<string>('all');
	const [filterType, setFilterType] = useState<string>('all');
	const [filterReply, setFilterReply] = useState<string>('all');
	const [listDestOpen, setListDestOpen] = useState(false);

	const [replyDialogOpen, setReplyDialogOpen] = useState(false);
	const [replyFeedbackId, setReplyFeedbackId] = useState<string | null>(null);
	const [replyMessage, setReplyMessage] = useState('');

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteFeedbackId, setDeleteFeedbackId] = useState<string | null>(null);

	const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
	const [decisionFeedbackId, setDecisionFeedbackId] = useState<string | null>(null);
	const [decisionAction, setDecisionAction] = useState<'accepted' | 'rejected'>('accepted');
	const [decisionComment, setDecisionComment] = useState('');

	const { data: formConfig } = useQuery<FeedbackFormConfig>({
		queryKey: ['/api/feedback/config'],
		queryFn: async () => {
			const res = await fetch('/api/feedback/config', { credentials: 'include' });
			if (!res.ok) return DEFAULT_FEEDBACK_FORM_CONFIG;
			return res.json();
		},
		staleTime: 60000,
	});

	const config = formConfig || DEFAULT_FEEDBACK_FORM_CONFIG;

	const targetLabels = useMemo(() => {
		const map: Record<string, string> = {};
		for (const d of config.destinations) map[d.id] = d.label;
		return map;
	}, [config.destinations]);

	const typeLabels = useMemo(() => {
		const map: Record<string, string> = {};
		for (const d of config.destinations) {
			for (const t of d.types) map[t.id] = t.label;
		}
		return map;
	}, [config.destinations]);

	const decisionTypeIds = useMemo(() => feedbackDecisionTypeIds(config), [config]);

	const fieldLabelByTarget = useMemo(() => {
		const m: Record<string, Record<string, string>> = {};
		for (const d of config.destinations) {
			m[d.id] = {};
			for (const f of d.fields) m[d.id][f.id] = f.label;
		}
		return m;
	}, [config.destinations]);

	const allRatingDims = useMemo(() => {
		const dimMap = new Map<string, string>();
		for (const d of config.destinations) {
			for (const r of d.ratings) dimMap.set(r.id, r.label);
		}
		return dimMap;
	}, [config.destinations]);

	const allTypesUnion = useMemo(() => {
		const seen = new Map<string, string>();
		for (const d of config.destinations) {
			for (const t of d.types) {
				if (!seen.has(t.id)) seen.set(t.id, t.label);
			}
		}
		return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
	}, [config.destinations]);

	const queryParams = new URLSearchParams();
	if (listDestTab !== 'all') queryParams.set('target', listDestTab);
	if (filterType !== 'all') queryParams.set('type', filterType);
	if (filterReply !== 'all') queryParams.set('hasReply', filterReply);

	const { data, isLoading } = useQuery<{ items: FeedbackItem[]; total: number }>({
		queryKey: ['/api/feedback/manage', listDestTab, filterType, filterReply],
		queryFn: async () => {
			const res = await fetch(`/api/feedback/manage?${queryParams.toString()}`, { credentials: 'include' });
			if (!res.ok) throw new Error('Failed to fetch feedback');
			return res.json();
		},
		staleTime: 5000,
	});

	const { data: countData } = useQuery<{ counts: Record<string, number> }>({
		queryKey: ['/api/feedback/manage/counts-by-target'],
		queryFn: async () => {
			const res = await fetch('/api/feedback/manage/counts-by-target', { credentials: 'include' });
			if (!res.ok) return { counts: {} };
			return res.json();
		},
		staleTime: 15000,
	});

	const { data: ratingData } = useQuery<Record<string, number> & { count: number }>({
		queryKey: ['/api/feedback/manage/ratings'],
		staleTime: 30000,
	});

	const toggleVisibilityMut = useMutation({
		mutationFn: async ({ id, visible }: { id: string; visible: boolean }) => {
			await apiRequest('PATCH', `/api/feedback/manage/${id}/visibility`, { visible });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage/counts-by-target'] });
			toast({ title: 'Visibility diperbarui' });
		},
		onError: () => toast({ title: 'Gagal', variant: 'destructive' }),
	});

	const replyMut = useMutation({
		mutationFn: async ({ id, message }: { id: string; message: string }) => {
			await apiRequest('POST', `/api/feedback/manage/${id}/reply`, { message });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage'] });
			toast({ title: 'Balasan terkirim' });
			setReplyDialogOpen(false);
			setReplyMessage('');
		},
		onError: () => toast({ title: 'Gagal mengirim balasan', variant: 'destructive' }),
	});

	const deleteMut = useMutation({
		mutationFn: async (id: string) => {
			await apiRequest('DELETE', `/api/feedback/manage/${id}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage/counts-by-target'] });
			toast({ title: 'Feedback dihapus' });
			setDeleteDialogOpen(false);
		},
		onError: () => toast({ title: 'Gagal menghapus', variant: 'destructive' }),
	});

	const decisionMut = useMutation({
		mutationFn: async ({ id, status, comment }: { id: string; status: 'accepted' | 'rejected'; comment: string }) => {
			await apiRequest('POST', `/api/feedback/manage/${id}/decision`, { status, comment });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage'] });
			toast({ title: `Feedback telah ${decisionAction === 'accepted' ? 'diterima' : 'ditolak'}` });
			setDecisionDialogOpen(false);
			setDecisionComment('');
		},
		onError: () => toast({ title: 'Gagal memproses keputusan', variant: 'destructive' }),
	});

	const saveConfigMut = useMutation({
		mutationFn: async (newConfig: FeedbackFormConfig) => {
			await apiRequest('PATCH', '/api/feedback/manage/config', newConfig);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/config'] });
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/manage/config'] });
			toast({ title: 'Konfigurasi formulir tersimpan' });
		},
		onError: () => toast({ title: 'Gagal menyimpan konfigurasi', variant: 'destructive' }),
	});

	const { data: siteSettings, isLoading: siteSettingsLoading } = useQuery({
		queryKey: ['/api/settings'],
		queryFn: async () => {
			const res = await fetch('/api/settings', { credentials: 'include' });
			if (!res.ok) throw new Error('Failed to load settings');
			return res.json() as {
				feedbackSubmitEnabled?: boolean;
				feedbackCardsEnabled?: boolean;
				feedbackCardsAutoScrollEnabled?: boolean;
				feedbackPublicTypeFilter?: string;
			};
		},
		enabled: canManage,
		staleTime: 15000,
	});

	const footerDisplayMut = useMutation({
		mutationFn: async (patch: Record<string, unknown>) => {
			await apiRequest('PATCH', '/api/feedback/manage/footer-display', patch);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			toast({ title: 'Tampilan footer diperbarui' });
		},
		onError: () => toast({ title: 'Gagal memperbarui tampilan footer', variant: 'destructive' }),
	});

	const submitEnabled = siteSettings?.feedbackSubmitEnabled !== false;
	const cardsEnabled = siteSettings?.feedbackCardsEnabled !== false;

	// ── Bug Report state & queries (owner-only) ──
	const [bugStatusFilter, setBugStatusFilter] = useState<string>('all');
	const [bugReplyDialogOpen, setBugReplyDialogOpen] = useState(false);
	const [bugReplyId, setBugReplyId] = useState<string | null>(null);
	const [bugReplyMessage, setBugReplyMessage] = useState('');
	const [expandedBugId, setExpandedBugId] = useState<string | null>(null);

	const { data: bugData, isLoading: bugLoading } = useQuery<{ items: BugReportItem[]; total: number }>({
		queryKey: ['/api/feedback/bug-report/list', bugStatusFilter],
		queryFn: async () => {
			const qs = bugStatusFilter !== 'all' ? `?status=${bugStatusFilter}` : '';
			const res = await fetch(`/api/feedback/bug-report/list${qs}`, { credentials: 'include' });
			if (!res.ok) throw new Error('Forbidden');
			return res.json();
		},
		enabled: isOwner,
		staleTime: 5000,
	});

	const { data: bugCount } = useQuery<{ total: number; open: number; replied: number; closed: number }>({
		queryKey: ['/api/feedback/bug-report/count'],
		queryFn: async () => {
			const res = await fetch('/api/feedback/bug-report/count', { credentials: 'include' });
			if (!res.ok) return { total: 0, open: 0, replied: 0, closed: 0 };
			return res.json();
		},
		enabled: isOwner,
		staleTime: 10000,
	});

	const bugReplyMut = useMutation({
		mutationFn: async ({ id, message }: { id: string; message: string }) => {
			await apiRequest('POST', `/api/feedback/bug-report/${id}/reply`, { message });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/bug-report/list'] });
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/bug-report/count'] });
			toast({ title: 'Balasan bug report terkirim' });
			setBugReplyDialogOpen(false);
			setBugReplyMessage('');
		},
		onError: () => toast({ title: 'Gagal mengirim balasan', variant: 'destructive' }),
	});

	const bugStatusMut = useMutation({
		mutationFn: async ({ id, status }: { id: string; status: string }) => {
			await apiRequest('PATCH', `/api/feedback/bug-report/${id}/status`, { status });
		},
		onSuccess: (_data, variables) => {
			queryClient.setQueriesData(
				{ queryKey: ['/api/feedback/bug-report/list'] },
				(old: { items: BugReportItem[]; total: number } | undefined) =>
					old
						? {
								...old,
								items: old.items.map((item) =>
									item._id === variables.id ? { ...item, status: variables.status as any } : item,
								),
							}
						: old,
			);
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/bug-report/list'] });
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/bug-report/count'] });
			toast({ title: 'Status diperbarui' });
		},
		onError: () => toast({ title: 'Gagal memperbarui status', variant: 'destructive' }),
	});

	const bugDeleteMut = useMutation({
		mutationFn: async (id: string) => {
			await apiRequest('DELETE', `/api/feedback/bug-report/${id}`);
		},
		onSuccess: (_data, deletedId) => {
			queryClient.setQueriesData(
				{ queryKey: ['/api/feedback/bug-report/list'] },
				(old: { items: BugReportItem[]; total: number } | undefined) =>
					old
						? {
								...old,
								items: old.items.filter((item) => item._id !== deletedId),
								total: Math.max(0, old.total - 1),
							}
						: old,
			);
			if (expandedBugId === deletedId) setExpandedBugId(null);
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/bug-report/list'] });
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/bug-report/count'] });
			toast({ title: 'Bug report dihapus' });
		},
		onError: () => toast({ title: 'Gagal menghapus', variant: 'destructive' }),
	});

	// ── Bug Otomatis (SystemError) state & queries (owner-only) ──
	const [sysStatusFilter, setSysStatusFilter] = useState<string>('all');
	const [sysSourceFilter, setSysSourceFilter] = useState<string>('all');
	const [expandedSysId, setExpandedSysId] = useState<string | null>(null);

	const { data: sysData, isLoading: sysLoading } = useQuery<{ items: SystemErrorItem[]; total: number }>({
		queryKey: ['/api/system-errors/list', sysStatusFilter, sysSourceFilter],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (sysStatusFilter !== 'all') params.set('status', sysStatusFilter);
			if (sysSourceFilter !== 'all') params.set('source', sysSourceFilter);
			const qs = params.toString() ? `?${params.toString()}` : '';
			const res = await fetch(`/api/system-errors/list${qs}`, { credentials: 'include' });
			if (!res.ok) throw new Error('Forbidden');
			return res.json();
		},
		enabled: isOwner,
		staleTime: 5000,
	});

	const { data: sysCount } = useQuery<{ total: number; new: number; investigating: number; resolved: number; ignored: number; critical: number; high: number }>({
		queryKey: ['/api/system-errors/count'],
		queryFn: async () => {
			const res = await fetch('/api/system-errors/count', { credentials: 'include' });
			if (!res.ok) return { total: 0, new: 0, investigating: 0, resolved: 0, ignored: 0, critical: 0, high: 0 };
			return res.json();
		},
		enabled: isOwner,
		staleTime: 10000,
	});

	const sysStatusMut = useMutation({
		mutationFn: async ({ id, status }: { id: string; status: string }) => {
			await apiRequest('PATCH', `/api/system-errors/${id}/status`, { status });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/system-errors/list'] });
			queryClient.invalidateQueries({ queryKey: ['/api/system-errors/count'] });
			toast({ title: 'Status bug diperbarui' });
		},
		onError: () => toast({ title: 'Gagal memperbarui status', variant: 'destructive' }),
	});

	const sysAnalyzeMut = useMutation({
		mutationFn: async (id: string) => {
			await apiRequest('POST', `/api/system-errors/${id}/analyze`, {});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/system-errors/list'] });
			toast({ title: 'Analisis AI diperbarui' });
		},
		onError: () => toast({ title: 'Gagal menjalankan analisis AI', variant: 'destructive' }),
	});

	const sysDeleteMut = useMutation({
		mutationFn: async (id: string) => {
			await apiRequest('DELETE', `/api/system-errors/${id}`);
		},
		onSuccess: (_data, deletedId) => {
			if (expandedSysId === deletedId) setExpandedSysId(null);
			queryClient.invalidateQueries({ queryKey: ['/api/system-errors/list'] });
			queryClient.invalidateQueries({ queryKey: ['/api/system-errors/count'] });
			toast({ title: 'Bug otomatis dihapus' });
		},
		onError: () => toast({ title: 'Gagal menghapus', variant: 'destructive' }),
	});

	const feedbackPageDataForSpyro = useMemo(() => {
		if (!user || isPermLoading) {
			return buildSimpleSpyroPageData(
				'feedback',
				'feedback.permissions_loading',
				'Memuat izin atau sesi untuk moderasi saran & kritik.',
			);
		}
		const filterSummary = `tujuan:${listDestTab}, jenis:${filterType}, balasan:${filterReply}`;
		const dialogHint =
			replyDialogOpen || deleteDialogOpen || decisionDialogOpen
				? ' Dialog moderasi (balasan/hapus/keputusan) terbuka.'
				: '';
		return buildSimpleSpyroPageData(
			'feedback',
			'feedback.main',
			`Moderasi masukan pengunjung.${dialogHint} Filter aktif: ${filterSummary}. Tab: ${activeTab}.`,
			{ tab: `${activeTab}/${listDestTab}/${filterType}/${filterReply}` },
		);
	}, [
		user,
		isPermLoading,
		activeTab,
		listDestTab,
		filterType,
		filterReply,
		replyDialogOpen,
		deleteDialogOpen,
		decisionDialogOpen,
	]);

	if (!user || isPermLoading) {
		return (
			<DashboardLayout title="Saran & Kritik" pageContextExtra={{ pageData: feedbackPageDataForSpyro }}>
				<div className="flex items-center justify-center h-64">
					<Loader2 className="h-6 w-6 animate-spin" />
				</div>
			</DashboardLayout>
		);
	}

	if (!hasPermission) return null;

	const items = data?.items ?? [];
	const counts = countData?.counts || {};

	return (
		<DashboardLayout title="Saran & Kritik" pageContextExtra={{ pageData: feedbackPageDataForSpyro }}>
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="mb-4 flex-wrap h-auto gap-1">
					<TabsTrigger value="list">Daftar feedback</TabsTrigger>
					{canManage && <TabsTrigger value="config"><Settings2 className="h-4 w-4 mr-1" />Atur form</TabsTrigger>}
					{canManage && (
						<TabsTrigger value="footer">
							<LayoutPanelLeft className="h-4 w-4 mr-1" />
							Footer publik
						</TabsTrigger>
					)}
					{canManage && <TabsTrigger value="guide"><BookOpen className="h-4 w-4 mr-1" />Penjelasan form</TabsTrigger>}
					{isOwner && (
						<TabsTrigger value="bugs" className="text-red-600 data-[state=active]:text-red-700">
							<Bug className="h-4 w-4 mr-1" />
							Daftar Bug
							{bugCount && bugCount.open > 0 && (
								<Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">
									{bugCount.open}
								</Badge>
							)}
						</TabsTrigger>
					)}
					{isOwner && (
						<TabsTrigger value="system-bugs" className="text-amber-600 data-[state=active]:text-amber-700">
							<AlertTriangle className="h-4 w-4 mr-1" />
							Bug Otomatis
							{sysCount && sysCount.new > 0 && (
								<Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">
									{sysCount.new}
								</Badge>
							)}
						</TabsTrigger>
					)}
				</TabsList>

				<TabsContent value="list">
					<div className="space-y-6">
						<DashboardHintCard
							title="Moderasi feedback"
							variant="blue"
							storageKey="dashboard-feedback"
							description="Filter per tujuan (tab), jenis, dan status balasan.">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li><strong>feedback.view</strong> melihat daftar; <strong>feedback.manage</strong> untuk balasan, keputusan, dan pengaturan form.</li>
							</ul>
						</DashboardHintCard>

						{ratingData && ratingData.count > 0 && (
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								{Array.from(allRatingDims.entries()).map(([dimId, dimLabel]) => {
									const val = ratingData[dimId];
									if (!val || val <= 0) return null;
									return (
										<Card key={dimId}>
											<CardHeader className="pb-2">
												<CardDescription>{dimLabel}</CardDescription>
											</CardHeader>
											<CardContent>
												<StarRating value={val} />
											</CardContent>
										</Card>
									);
								})}
							</div>
						)}

						<Card>
							<CardHeader>
								<CardTitle>Filter</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-4">
									<div className="w-full sm:w-64">
										<Label className="text-xs mb-1 block">Tujuan</Label>
										<Popover open={listDestOpen} onOpenChange={setListDestOpen}>
											<PopoverTrigger asChild>
												<Button variant="outline" role="combobox" aria-expanded={listDestOpen} className="w-full justify-between">
													<span className="truncate">
														{listDestTab === 'all'
															? `Semua (${counts._all ?? '—'})`
															: `${targetLabels[listDestTab] || listDestTab} (${counts[listDestTab] ?? 0})`}
													</span>
													<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
												<Command>
													<CommandInput placeholder="Cari tujuan..." />
													<CommandList>
														<CommandEmpty>Tidak ditemukan</CommandEmpty>
														<CommandGroup>
															<CommandItem value="Semua" onSelect={() => { setListDestTab('all'); setListDestOpen(false); }}>
																<Check className={cn('mr-2 h-4 w-4', listDestTab === 'all' ? 'opacity-100' : 'opacity-0')} />
																Semua ({counts._all ?? '—'})
															</CommandItem>
															{[...config.destinations].sort((a, b) => a.order - b.order).map((d) => (
																<CommandItem key={d.id} value={d.label} onSelect={() => { setListDestTab(d.id); setListDestOpen(false); }}>
																	<Check className={cn('mr-2 h-4 w-4', listDestTab === d.id ? 'opacity-100' : 'opacity-0')} />
																	{d.label} ({counts[d.id] ?? 0})
																</CommandItem>
															))}
														</CommandGroup>
													</CommandList>
												</Command>
											</PopoverContent>
										</Popover>
									</div>
									<div className="w-40">
										<Label className="text-xs mb-1 block">Jenis</Label>
										<Select value={filterType} onValueChange={setFilterType}>
											<SelectTrigger><SelectValue /></SelectTrigger>
											<SelectContent>
												<SelectItem value="all">Semua</SelectItem>
												{allTypesUnion.map((t) => (
													<SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="w-40">
										<Label className="text-xs mb-1 block">Balasan</Label>
										<Select value={filterReply} onValueChange={setFilterReply}>
											<SelectTrigger><SelectValue /></SelectTrigger>
											<SelectContent>
												<SelectItem value="all">Semua</SelectItem>
												<SelectItem value="false">Belum dibalas</SelectItem>
												<SelectItem value="true">Sudah dibalas</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Daftar ({data?.total ?? 0})</CardTitle>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="flex justify-center py-8">
										<Loader2 className="h-6 w-6 animate-spin" />
									</div>
								) : items.length === 0 ? (
									<p className="text-center py-8 text-muted-foreground">Belum ada feedback</p>
								) : (
									<div className="space-y-4">
										{items.map((fb) => {
											const hasDecisionWorkflow = decisionTypeIds.has(fb.type);
											const fbRatings = fb.ratings && typeof fb.ratings === 'object' ? fb.ratings : {};
											const ratingEntries = Object.entries(fbRatings).filter(([, v]) => typeof v === 'number' && v > 0);
											const flMap = fieldLabelByTarget[fb.target] || {};
											return (
												<div key={fb._id} className="border rounded-lg p-4 space-y-3">
													<div className="flex items-start justify-between gap-2">
														<div className="flex items-center gap-2 flex-wrap">
															<Badge variant="default">
																{typeLabels[fb.type] || fb.typeLabel || fb.type}
															</Badge>
															<Badge variant="outline">
																{targetLabels[fb.target] || fb.destinationLabel || fb.target}
															</Badge>
															{fb.isAnonymous && <Badge variant="secondary">Anonim</Badge>}
															{fb.reply && (
																<Badge variant="outline" className="border-green-500/50 text-green-600">Sudah dibalas</Badge>
															)}
															{hasDecisionWorkflow && (
																<SuggestionStatusBadge status={fb.suggestionStatus || 'pending'} />
															)}
														</div>
														<span className="text-xs text-muted-foreground whitespace-nowrap">
															{new Date(fb.createdAt).toLocaleDateString('id-ID', {
																day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
															})}
														</span>
													</div>

													{!fb.isAnonymous && (
														<div className="text-sm text-muted-foreground">
															<span className="font-medium text-foreground">{fb.senderName}</span>
															{fb.senderNim && <span> · {fb.senderNim}</span>}
															{fb.senderEmail && <span> · {fb.senderEmail}</span>}
														</div>
													)}

													<p className="text-sm whitespace-pre-wrap">{fb.body}</p>

													{fb.extraFields && Object.keys(fb.extraFields).length > 0 && (
														<div className="space-y-1 text-xs">
															{Object.entries(fb.extraFields).map(([k, v]) => {
																if (Array.isArray(v) && v.length && typeof v[0] === 'object' && v[0] !== null && 'url' in (v[0] as object)) {
																	return (
																		<div key={k} className="space-y-1">
																			<span className="font-medium text-muted-foreground">{flMap[k] || k}:</span>
																			<div className="grid gap-1.5">
																				{(v as { url: string; originalName?: string; mimeType?: string; size?: number }[]).map((m, i) => (
																					<UniversalFilePreview
																						key={i}
																						url={m.url}
																						name={m.originalName || 'file'}
																						mimeType={m.mimeType}
																						size={m.size}
																					/>
																				))}
																			</div>
																		</div>
																	);
																}
																if (typeof v === 'string' && v.includes('<') && v.includes('>')) {
																	return (
																		<div key={k}>
																			<span className="font-medium text-muted-foreground">{flMap[k] || k}: </span>
																			<div className="prose prose-sm dark:prose-invert max-w-none border rounded p-2 mt-1" dangerouslySetInnerHTML={{ __html: v }} />
																		</div>
																	);
																}
																return (
																	<div key={k}>
																		<span className="font-medium text-muted-foreground">{flMap[k] || k}:</span>{' '}
																		{formatExtraValue(v)}
																	</div>
																);
															})}
														</div>
													)}

													{Array.isArray(fb.media) && fb.media.length > 0 && (
														<div className="space-y-1.5 text-xs">
															<span className="font-medium text-muted-foreground">Lampiran:</span>
															<div className="grid gap-1.5">
																{fb.media.map((m, idx) => (
																	<UniversalFilePreview
																		key={idx}
																		url={m.url}
																		name={m.originalName || 'file'}
																		mimeType={(m as any).mimeType}
																		size={(m as any).size}
																	/>
																))}
															</div>
														</div>
													)}

													{ratingEntries.length > 0 && (
														<div className="flex flex-wrap gap-4 text-xs">
															{ratingEntries.map(([key, val]) => (
																<span key={key}>{allRatingDims.get(key) || key}: <StarRating value={val as number} /></span>
															))}
														</div>
													)}

													{hasDecisionWorkflow && fb.suggestionStatus !== 'pending' && fb.suggestionDecidedAt && (
														<div className={`rounded-lg p-3 border-l-2 ${fb.suggestionStatus === 'accepted' ? 'bg-green-50 dark:bg-green-500/10 border-green-500' : 'bg-red-50 dark:bg-red-500/10 border-red-500'}`}>
															<p className="text-xs text-muted-foreground mb-1">
																{STATUS_LABELS[fb.suggestionStatus] || fb.suggestionStatus} · {fb.suggestionDeciderName}
															</p>
															{fb.suggestionDecisionComment && <p className="text-sm whitespace-pre-wrap">{fb.suggestionDecisionComment}</p>}
														</div>
													)}

													{fb.reply && (
														<div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary">
															<p className="text-xs text-muted-foreground mb-1">Balasan · {fb.reply.adminName}</p>
															<p className="text-sm whitespace-pre-wrap">{fb.reply.message}</p>
														</div>
													)}

													{canManage && (
														<div className="flex flex-wrap items-center gap-2 pt-1">
															<Switch
																checked={fb.isVisibleCard}
																onCheckedChange={(checked) => toggleVisibilityMut.mutate({ id: fb._id, visible: checked })}
															/>
															<Label className="text-xs">{fb.isVisibleCard ? <><Eye className="inline h-3 w-3" /> Tampil</> : <><EyeOff className="inline h-3 w-3" /> Sembunyi</>}</Label>
															{!fb.reply && (
																<Button variant="outline" size="sm" onClick={() => { setReplyFeedbackId(fb._id); setReplyMessage(''); setReplyDialogOpen(true); }}>
																	<MessageSquareReply className="h-4 w-4 mr-1" />Balas
																</Button>
															)}
															{hasDecisionWorkflow && fb.suggestionStatus === 'pending' && (
																<>
																	<Button variant="outline" size="sm" className="border-green-500/50 text-green-600" onClick={() => { setDecisionFeedbackId(fb._id); setDecisionAction('accepted'); setDecisionComment(''); setDecisionDialogOpen(true); }}>
																		<CheckCircle2 className="h-4 w-4 mr-1" />Terima
																	</Button>
																	<Button variant="outline" size="sm" className="border-red-500/50 text-red-600" onClick={() => { setDecisionFeedbackId(fb._id); setDecisionAction('rejected'); setDecisionComment(''); setDecisionDialogOpen(true); }}>
																		<XCircle className="h-4 w-4 mr-1" />Tolak
																	</Button>
																</>
															)}
															<Button variant="destructive" size="sm" onClick={() => { setDeleteFeedbackId(fb._id); setDeleteDialogOpen(true); }}>
																<Trash2 className="h-4 w-4 mr-1" />Hapus
															</Button>
														</div>
													)}
												</div>
											);
										})}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{canManage && (
					<TabsContent value="config">
						<ConfigEditor config={config} onSave={(c) => saveConfigMut.mutate(c)} isSaving={saveConfigMut.isPending} />
					</TabsContent>
				)}

				{canManage && (
					<TabsContent value="footer">
						<div className="max-w-2xl space-y-6">
							<DashboardHintCard
								title="Tampilan footer situs"
								variant="blue"
								storageKey="dashboard-feedback-footer-display"
								description="Mengatur tombol form, kartu masukan, auto-scroll, dan filter jenis yang tampil di footer untuk pengunjung. Perubahan langsung disimpan; tidak perlu membuka Settings → Appearance.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">feedback.manage</code>
									</li>
									<li>Matikan tombol kirim menyembunyikan form dan kartu di footer (sama seperti perilaku sebelumnya).</li>
								</ul>
							</DashboardHintCard>
							<Card>
								<CardHeader>
									<CardTitle>Footer publik</CardTitle>
									<CardDescription>Visibilitas dan perilaku blok saran &amp; kritik di footer halaman umum.</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{siteSettingsLoading && !siteSettings ? (
										<div className="flex justify-center py-8">
											<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
										</div>
									) : (
										<>
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0">
													<Label htmlFor="fb-footer-submit">Tombol kirim masukan</Label>
													<p className="text-sm text-muted-foreground">
														Tampilkan tombol &quot;Tulis Saran/Kritik&quot; di footer. Jika dimatikan, kartu masukan ikut tersembunyi.
													</p>
												</div>
												<Switch
													id="fb-footer-submit"
													className="flex-shrink-0"
													checked={submitEnabled}
													disabled={footerDisplayMut.isPending}
													onCheckedChange={(checked) => footerDisplayMut.mutate({ feedbackSubmitEnabled: checked })}
												/>
											</div>
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
												<div className="min-w-0">
													<Label htmlFor="fb-footer-cards">Kartu di footer</Label>
													<p className="text-sm text-muted-foreground">
														Tampilkan section kartu saran/kritik. Hanya berlaku jika tombol kirim aktif.
													</p>
												</div>
												<Switch
													id="fb-footer-cards"
													className="flex-shrink-0"
													checked={cardsEnabled}
													disabled={footerDisplayMut.isPending || !submitEnabled}
													onCheckedChange={(checked) => footerDisplayMut.mutate({ feedbackCardsEnabled: checked })}
												/>
											</div>
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
												<div className="min-w-0">
													<Label htmlFor="fb-footer-autoscroll">Kartu: auto-scroll</Label>
													<p className="text-sm text-muted-foreground">Animasi geser otomatis untuk kartu di footer.</p>
												</div>
												<Switch
													id="fb-footer-autoscroll"
													className="flex-shrink-0"
													checked={siteSettings?.feedbackCardsAutoScrollEnabled !== false}
													disabled={footerDisplayMut.isPending || !submitEnabled || !cardsEnabled}
													onCheckedChange={(checked) => footerDisplayMut.mutate({ feedbackCardsAutoScrollEnabled: checked })}
												/>
											</div>
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
												<div className="min-w-0">
													<Label htmlFor="fb-footer-filter">Filter tampilan publik</Label>
													<p className="text-sm text-muted-foreground">Jenis feedback yang ditampilkan di kartu footer.</p>
												</div>
												<Select
													value={siteSettings?.feedbackPublicTypeFilter ?? 'all'}
													onValueChange={(value) => footerDisplayMut.mutate({ feedbackPublicTypeFilter: value })}
													disabled={footerDisplayMut.isPending}
												>
													<SelectTrigger id="fb-footer-filter" className="w-[180px] flex-shrink-0">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="all">Semua jenis</SelectItem>
														<SelectItem value="saran">Saran saja</SelectItem>
														<SelectItem value="kritik">Kritik saja</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</>
									)}
								</CardContent>
							</Card>
						</div>
					</TabsContent>
				)}

				{isOwner && (
					<TabsContent value="bugs">
						<div className="space-y-6">
							<DashboardHintCard
								title="Daftar Bug"
								variant="rose"
								storageKey="dashboard-bug-reports"
								description="Semua laporan bug dari user dashboard web utama dan komunitas.">
								<ul className="list-disc list-inside space-y-1 text-sm">
									<li>Bug report dikirim oleh user melalui tombol <strong>Report Bug</strong> di sidebar.</li>
									<li>Hanya Anda (owner) yang dapat melihat dan membalas bug report.</li>
								</ul>
							</DashboardHintCard>

							<div className="flex flex-wrap gap-2">
								{([
									['all', `Semua (${bugCount?.total ?? 0})`],
									['open', `Open (${bugCount?.open ?? 0})`],
									['replied', `Dibalas (${bugCount?.replied ?? 0})`],
									['closed', `Closed (${bugCount?.closed ?? 0})`],
								] as const).map(([val, label]) => (
									<Button
										key={val}
										variant={bugStatusFilter === val ? 'default' : 'outline'}
										size="sm"
										onClick={() => setBugStatusFilter(val)}
									>
										{label}
									</Button>
								))}
							</div>

							{bugLoading ? (
								<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
							) : !bugData?.items?.length ? (
								<Card><CardContent className="py-12 text-center text-muted-foreground">Belum ada bug report.</CardContent></Card>
							) : (
								<div className="space-y-4">
									{bugData.items.map((bug: BugReportItem) => {
										const isExpanded = expandedBugId === bug._id;
										return (
											<Card key={bug._id} className="shadow-sm">
												<CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedBugId(isExpanded ? null : bug._id)}>
													<div className="flex items-start justify-between gap-4">
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-2 flex-wrap mb-1">
																<Badge variant={bug.status === 'open' ? 'destructive' : bug.status === 'replied' ? 'default' : 'secondary'}>
																	{bug.status === 'open' ? 'Open' : bug.status === 'replied' ? 'Dibalas' : 'Closed'}
																</Badge>
																{bug.sourceCommunityName && (
																	<Badge variant="outline">{bug.sourceCommunityName}</Badge>
																)}
																{!bug.sourceCommunitySlug && (
																	<Badge variant="outline">Web Utama</Badge>
																)}
																<span className="text-xs text-muted-foreground">
																	{new Date(bug.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
																</span>
															</div>
															<div className="text-sm">
																<span className="font-medium">{bug.reporterName}</span>
																<span className="text-muted-foreground ml-1">(@{bug.reporterUsername})</span>
																<span className="text-muted-foreground ml-2">{bug.reporterEmail}</span>
															</div>
														</div>
														<ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
													</div>
												</CardHeader>

												{isExpanded && (
													<CardContent className="space-y-4 pt-0">
														<div className="prose prose-sm max-w-none dark:prose-invert"
															dangerouslySetInnerHTML={{ __html: bug.description }}
														/>

														{bug.attachments.length > 0 && (
															<div className="space-y-2">
																<Label className="text-xs font-medium">Lampiran ({bug.attachments.length})</Label>
																<div className="grid gap-2">
																	{bug.attachments.map((att, i) => (
																		<UniversalFilePreview
																			key={i}
																			url={att.url}
																			name={att.originalName}
																			mimeType={att.mimeType}
																			size={att.size}
																		/>
																	))}
																</div>
															</div>
														)}

														{bug.gdriveLinks.length > 0 && (
															<div className="space-y-2">
																<Label className="text-xs font-medium">Link Google Drive ({bug.gdriveLinks.length})</Label>
																<div className="space-y-1">
																	{bug.gdriveLinks.map((link, i) => (
																		<a
																			key={i}
																			href={link}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="block text-sm text-blue-600 hover:underline truncate"
																		>
																			{link}
																		</a>
																	))}
																</div>
															</div>
														)}

														{bug.reply && (
															<div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3 space-y-1">
																<p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
																	Balasan dari {bug.reply.repliedByName} — {new Date(bug.reply.repliedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
																</p>
																<p className="text-sm whitespace-pre-wrap">{bug.reply.message}</p>
															</div>
														)}

														<div className="flex flex-wrap gap-2 pt-2 border-t">
															{!bug.reply && (
																<Button
																	size="sm"
																	onClick={() => {
																		setBugReplyId(bug._id);
																		setBugReplyMessage('');
																		setBugReplyDialogOpen(true);
																	}}
																>
																	<MessageSquareReply className="h-4 w-4 mr-1" />
																	Balas
																</Button>
															)}
															{bug.status !== 'closed' && (
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() => bugStatusMut.mutate({ id: bug._id, status: 'closed' })}
																>
																	<CheckCircle2 className="h-4 w-4 mr-1" />
																	Close
																</Button>
															)}
															{bug.status === 'closed' && (
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() => bugStatusMut.mutate({ id: bug._id, status: 'open' })}
																>
																	Reopen
																</Button>
															)}
															<Button
																size="sm"
																variant="destructive"
																onClick={() => bugDeleteMut.mutate(bug._id)}
															>
																<Trash2 className="h-4 w-4 mr-1" />
																Hapus
															</Button>
														</div>
													</CardContent>
												)}
											</Card>
										);
									})}
								</div>
							)}
						</div>
					</TabsContent>
				)}

				{isOwner && (
					<TabsContent value="system-bugs">
						<div className="space-y-6">
							<DashboardHintCard
								title="Bug Otomatis (Sistem)"
								variant="amber"
								storageKey="dashboard-system-errors"
								description="Laporan bug yang dibuat OTOMATIS oleh sistem — bukan dari user.">
								<ul className="list-disc list-inside space-y-1 text-sm">
									<li>Sistem menangkap error server (5xx) dan error tampilan/runtime di browser.</li>
									<li>Tiap laporan dilengkapi IP, akun (bila login), perangkat, waktu, route, dan file:baris.</li>
									<li>Error yang sama dikelompokkan otomatis (lihat jumlah kemunculan), dan dianalisis AI.</li>
								</ul>
							</DashboardHintCard>

							<div className="flex flex-wrap gap-2">
								{([
									['all', `Semua (${sysCount?.total ?? 0})`],
									['new', `Baru (${sysCount?.new ?? 0})`],
									['investigating', `Diteliti (${sysCount?.investigating ?? 0})`],
									['resolved', `Selesai (${sysCount?.resolved ?? 0})`],
									['ignored', `Diabaikan (${sysCount?.ignored ?? 0})`],
								] as const).map(([val, label]) => (
									<Button
										key={val}
										variant={sysStatusFilter === val ? 'default' : 'outline'}
										size="sm"
										onClick={() => setSysStatusFilter(val)}
									>
										{label}
									</Button>
								))}
							</div>

							<div className="flex flex-wrap gap-2">
								{([
									['all', 'Semua sumber'],
									['server', 'Server'],
									['client', 'Tampilan/Client'],
								] as const).map(([val, label]) => (
									<Button
										key={val}
										variant={sysSourceFilter === val ? 'secondary' : 'ghost'}
										size="sm"
										onClick={() => setSysSourceFilter(val)}
									>
										{val === 'server' ? <Server className="h-3.5 w-3.5 mr-1" /> : val === 'client' ? <Monitor className="h-3.5 w-3.5 mr-1" /> : null}
										{label}
									</Button>
								))}
							</div>

							{sysLoading ? (
								<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
							) : !sysData?.items?.length ? (
								<Card><CardContent className="py-12 text-center text-muted-foreground">Belum ada bug otomatis tercatat. 🎉</CardContent></Card>
							) : (
								<div className="space-y-4">
									{sysData.items.map((err: SystemErrorItem) => {
										const isExpanded = expandedSysId === err._id;
										const sevVariant = err.severity === 'critical' || err.severity === 'high'
											? 'destructive'
											: err.severity === 'medium' ? 'default' : 'secondary';
										return (
											<Card key={err._id} className="shadow-sm">
												<CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedSysId(isExpanded ? null : err._id)}>
													<div className="flex items-start justify-between gap-4">
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-2 flex-wrap mb-1">
																<Badge variant={sevVariant as any} className="uppercase text-[10px]">{err.severity}</Badge>
																<Badge variant="outline" className="gap-1">
																	{err.source === 'server' ? <Server className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
																	{err.source === 'server' ? 'Server' : 'Client'}
																</Badge>
																<Badge variant={err.status === 'new' ? 'destructive' : err.status === 'resolved' ? 'secondary' : 'default'}>
																	{err.status === 'new' ? 'Baru' : err.status === 'investigating' ? 'Diteliti' : err.status === 'resolved' ? 'Selesai' : 'Diabaikan'}
																</Badge>
																{err.count > 1 && (
																	<Badge variant="outline" className="text-amber-600">×{err.count}</Badge>
																)}
																<span className="text-xs text-muted-foreground">
																	{new Date(err.lastSeenAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
																</span>
															</div>
															<div className="text-sm font-medium truncate">
																<span className="text-red-600">{err.name}</span>: {err.message}
															</div>
															{(err.file || err.route) && (
																<div className="text-xs text-muted-foreground mt-0.5 truncate">
																	{err.file ? `${err.file}${err.line ? `:${err.line}` : ''}` : ''}
																	{err.file && err.route ? ' · ' : ''}
																	{err.route ? `${err.httpMethod ? err.httpMethod + ' ' : ''}${err.route}` : ''}
																</div>
															)}
														</div>
														<ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
													</div>
												</CardHeader>

												{isExpanded && (
													<CardContent className="space-y-4 pt-0">
														{/* Analisis AI */}
														<div className="rounded-md border border-violet-200 dark:border-violet-900 bg-violet-50/60 dark:bg-violet-950/20 p-3 space-y-2">
															<div className="flex items-center justify-between gap-2">
																<Label className="text-xs font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1">
																	<Sparkles className="h-3.5 w-3.5" /> Analisis AI
																</Label>
																<Button
																	size="sm"
																	variant="ghost"
																	className="h-7 px-2 text-xs"
																	disabled={sysAnalyzeMut.isPending}
																	onClick={() => sysAnalyzeMut.mutate(err._id)}
																>
																	{sysAnalyzeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
																	Analisis ulang
																</Button>
															</div>
															{err.aiAnalysis ? (
																<div className="space-y-1.5 text-sm">
																	{err.aiAnalysis.summary && <p><span className="font-medium">Ringkasan: </span>{err.aiAnalysis.summary}</p>}
																	{err.aiAnalysis.likelyCause && <p><span className="font-medium">Dugaan penyebab: </span>{err.aiAnalysis.likelyCause}</p>}
																	{err.aiAnalysis.suggestedFix && <p><span className="font-medium">Saran perbaikan: </span>{err.aiAnalysis.suggestedFix}</p>}
																	{err.aiAnalysis.model && (
																		<p className="text-[11px] text-muted-foreground">Model: {err.aiAnalysis.model}{err.aiAnalysis.analyzedAt ? ` · ${new Date(err.aiAnalysis.analyzedAt).toLocaleString('id-ID')}` : ''}</p>
																	)}
																</div>
															) : (
																<p className="text-xs text-muted-foreground">Belum ada analisis AI. Klik "Analisis ulang" untuk menjalankan.</p>
															)}
														</div>

														{/* Detail konteks */}
														<div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-sm">
															<div><span className="text-muted-foreground">Akun: </span>{err.username ? `${err.username} (${err.userRole || '-'})` : 'Tamu / tidak login'}</div>
															<div><span className="text-muted-foreground">Email: </span>{err.userEmail || '-'}</div>
															<div><span className="text-muted-foreground">IP: </span>{err.ip || '-'}</div>
															<div><span className="text-muted-foreground">Perangkat: </span>{[err.device, err.os, err.browser].filter(Boolean).join(' · ') || '-'}</div>
															<div><span className="text-muted-foreground">Komunitas: </span>{err.communityName || (err.communitySlug ? err.communitySlug : 'Web Utama')}</div>
															<div><span className="text-muted-foreground">Lingkungan: </span>{err.environment || '-'}</div>
															<div><span className="text-muted-foreground">Fungsi: </span>{err.functionName || '-'}</div>
															<div><span className="text-muted-foreground">Pertama terlihat: </span>{new Date(err.firstSeenAt).toLocaleString('id-ID')}</div>
														</div>

														{err.stack && (
															<div className="space-y-1">
																<Label className="text-xs font-medium">Stack trace</Label>
																<pre className="text-[11px] bg-muted/60 rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-64">{err.stack}</pre>
															</div>
														)}

														<div className="flex flex-wrap gap-2 pt-2 border-t">
															{err.status !== 'investigating' && (
																<Button size="sm" variant="outline" onClick={() => sysStatusMut.mutate({ id: err._id, status: 'investigating' })}>
																	<Eye className="h-4 w-4 mr-1" /> Tandai diteliti
																</Button>
															)}
															{err.status !== 'resolved' && (
																<Button size="sm" variant="outline" onClick={() => sysStatusMut.mutate({ id: err._id, status: 'resolved' })}>
																	<CheckCircle2 className="h-4 w-4 mr-1" /> Selesai
																</Button>
															)}
															{err.status !== 'ignored' && (
																<Button size="sm" variant="ghost" onClick={() => sysStatusMut.mutate({ id: err._id, status: 'ignored' })}>
																	<XCircle className="h-4 w-4 mr-1" /> Abaikan
																</Button>
															)}
															<Button size="sm" variant="destructive" onClick={() => sysDeleteMut.mutate(err._id)}>
																<Trash2 className="h-4 w-4 mr-1" /> Hapus
															</Button>
														</div>
													</CardContent>
												)}
											</Card>
										);
									})}
								</div>
							)}
						</div>
					</TabsContent>
				)}

				{canManage && (
					<TabsContent value="guide">
						<Card className="max-w-4xl shadow-sm">
							<CardHeader>
								<CardTitle className="text-xl">Panduan formulir masukan</CardTitle>
								<CardDescription className="text-sm leading-relaxed">
									Istilah untuk mengatur form saran dan kritik di footer situs.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-8">
								<section className="space-y-3">
									<h3 className="text-base font-semibold">Ringkasan istilah</h3>
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="rounded-xl border bg-card/50 p-4 space-y-1.5">
											<h4 className="font-medium text-sm">Formulir</h4>
											<p className="text-sm text-muted-foreground leading-relaxed">
												Satu formulir lengkap: nama yang dipilih pengunjung (misalnya Website atau Prodi). Tiap formulir punya jenis masukan, pertanyaan, dan penilaian sendiri.
											</p>
											<p className="text-xs text-muted-foreground/80">Contoh nama: Website kampus, Himatif Encoder, Form prodi TI.</p>
										</div>
										<div className="rounded-xl border bg-card/50 p-4 space-y-1.5">
											<h4 className="font-medium text-sm">Jenis masukan</h4>
											<p className="text-sm text-muted-foreground leading-relaxed">
												Tab atau tombol di form publik: Saran, Kritik, dll. Opsi &quot;Moderator bisa terima / tolak&quot; mengaktifkan alur moderasi untuk jenis itu.
											</p>
											<p className="text-xs text-muted-foreground/80">Contoh: Saran (bisa diterima/ditolak), Kritik.</p>
										</div>
										<div className="rounded-xl border bg-card/50 p-4 space-y-1.5">
											<h4 className="font-medium text-sm">Pertanyaan</h4>
											<p className="text-sm text-muted-foreground leading-relaxed">
												Kolom yang diisi pengunjung. Urutan di pengaturan sama dengan urutan di form.
											</p>
											<p className="text-xs text-muted-foreground/80">Tipe: singkat, panjang, pilihan, lampiran, dll.</p>
										</div>
										<div className="rounded-xl border bg-card/50 p-4 space-y-1.5">
											<h4 className="font-medium text-sm">Penilaian bintang</h4>
											<p className="text-sm text-muted-foreground leading-relaxed">
												Aspek opsional yang dinilai 1–5 bintang. Kosongkan jika tidak ingin bagian ini di form.
											</p>
											<p className="text-xs text-muted-foreground/80">Contoh judul: Pelayanan, Tampilan website, Fasilitas.</p>
										</div>
									</div>
								</section>

								<section className="space-y-3">
									<h3 className="text-base font-semibold">Tipe pertanyaan</h3>
									<div className="overflow-x-auto">
										<table className="w-full text-sm border-collapse">
											<thead>
												<tr className="border-b">
													<th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Jenis</th>
													<th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Tampilan di Form</th>
													<th className="text-left py-2 font-medium">Catatan</th>
												</tr>
											</thead>
											<tbody className="divide-y">
												<tr>
													<td className="py-2.5 pr-4 font-medium whitespace-nowrap">Teks pendek</td>
													<td className="py-2.5 pr-4 text-muted-foreground">Input satu baris</td>
													<td className="py-2.5 text-muted-foreground">Jawaban singkat: nama, judul, kode, dll.</td>
												</tr>
												<tr>
													<td className="py-2.5 pr-4 font-medium whitespace-nowrap">Teks panjang</td>
													<td className="py-2.5 pr-4 text-muted-foreground">Textarea multi-baris</td>
													<td className="py-2.5 text-muted-foreground">Beberapa kalimat; bisa dipakai sebagai ringkasan kartu jika Anda centang opsi cuplikan.</td>
												</tr>
												<tr>
													<td className="py-2.5 pr-4 font-medium whitespace-nowrap">Teks berformat</td>
													<td className="py-2.5 pr-4 text-muted-foreground">Editor teks kaya</td>
													<td className="py-2.5 text-muted-foreground">Bold, italic, daftar, dsb. Di situs publik editor dimuat ringan (lazy) agar halaman tetap cepat.</td>
												</tr>
												<tr>
													<td className="py-2.5 pr-4 font-medium whitespace-nowrap">Dropdown</td>
													<td className="py-2.5 pr-4 text-muted-foreground">Select satu pilihan</td>
													<td className="py-2.5 text-muted-foreground">Isi tiap opsi di baris sendiri di pengaturan (tombol tambah opsi).</td>
												</tr>
												<tr>
													<td className="py-2.5 pr-4 font-medium whitespace-nowrap">Checkbox</td>
													<td className="py-2.5 pr-4 text-muted-foreground">Satu centang</td>
													<td className="py-2.5 text-muted-foreground">Contoh: &quot;Saya setuju dengan kebijakan privasi.&quot;</td>
												</tr>
												<tr>
													<td className="py-2.5 pr-4 font-medium whitespace-nowrap">Multi pilihan</td>
													<td className="py-2.5 pr-4 text-muted-foreground">Checkbox banyak opsi</td>
													<td className="py-2.5 text-muted-foreground">Daftar opsi diatur seperti dropdown: satu baris per pilihan.</td>
												</tr>
												<tr>
													<td className="py-2.5 pr-4 font-medium whitespace-nowrap">Lampiran</td>
													<td className="py-2.5 pr-4 text-muted-foreground">Unggah dari perangkat</td>
													<td className="py-2.5 text-muted-foreground">Saat ini server hanya memproses gambar (WebP). Batas jumlah di pengaturan.</td>
												</tr>
											</tbody>
										</table>
									</div>
								</section>

								<section className="space-y-3">
									<h3 className="text-base font-semibold">Alur pengunjung di situs publik</h3>
									<ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground leading-relaxed">
										<li>Membuka form di footer, memilih <strong className="text-foreground">formulir</strong> (arah masukan).</li>
										<li>Memilih <strong className="text-foreground">jenis masukan</strong> (mis. Saran atau Kritik).</li>
										<li>Bisa kirim <strong className="text-foreground">anonim</strong> atau mengisi nama, NIM, dan email.</li>
										<li>Mengisi <strong className="text-foreground">pertanyaan</strong> sesuai urutan yang Anda atur.</li>
										<li>Jika ada: memberi <strong className="text-foreground">bintang 1–5</strong> per aspek penilaian.</li>
										<li>Mengirim. Data masuk ke tab <strong className="text-foreground">Daftar feedback</strong> di dashboard ini.</li>
									</ol>
								</section>
							</CardContent>
						</Card>
					</TabsContent>
				)}
			</Tabs>

			<Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Balas feedback</DialogTitle>
					</DialogHeader>
					<Textarea placeholder="Tulis balasan..." value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} rows={4} />
					<DialogFooter>
						<Button variant="outline" onClick={() => setReplyDialogOpen(false)}>Batal</Button>
						<Button disabled={!replyMessage.trim() || replyMut.isPending} onClick={() => replyFeedbackId && replyMut.mutate({ id: replyFeedbackId, message: replyMessage })}>
							{replyMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Kirim
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{decisionAction === 'accepted' ? 'Terima' : 'Tolak'}</DialogTitle>
					</DialogHeader>
					<Textarea placeholder="Komentar (opsional)" value={decisionComment} onChange={(e) => setDecisionComment(e.target.value)} rows={3} />
					<DialogFooter>
						<Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>Batal</Button>
						<Button variant={decisionAction === 'accepted' ? 'default' : 'destructive'} disabled={decisionMut.isPending} onClick={() => decisionFeedbackId && decisionMut.mutate({ id: decisionFeedbackId, status: decisionAction, comment: decisionComment })}>
							{decisionMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Konfirmasi
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Hapus feedback?</DialogTitle>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
						<Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteFeedbackId && deleteMut.mutate(deleteFeedbackId)}>
							{deleteMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Hapus
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={bugReplyDialogOpen} onOpenChange={setBugReplyDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Balas Bug Report</DialogTitle>
					</DialogHeader>
					<Textarea
						placeholder="Tulis balasan untuk pelapor bug..."
						value={bugReplyMessage}
						onChange={(e) => setBugReplyMessage(e.target.value)}
						rows={5}
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setBugReplyDialogOpen(false)}>Batal</Button>
						<Button
							disabled={!bugReplyMessage.trim() || bugReplyMut.isPending}
							onClick={() => bugReplyId && bugReplyMut.mutate({ id: bugReplyId, message: bugReplyMessage })}
						>
							{bugReplyMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Kirim Balasan
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
