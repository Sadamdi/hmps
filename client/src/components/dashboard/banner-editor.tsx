import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { BANNER_TEMPLATE_DEFAULTS } from '@/lib/banner-template-layers';
import { Image as ImageIcon, Loader2, Palette, RefreshCw, Save, Wand2, X } from 'lucide-react';
import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

/** Default = GM stop 0 di template (#6b2896, ungu) */
const DEFAULT_THEME = '#6b2896';

function hexToRgbComponents(hex: string): { r: number; g: number; b: number } | null {
	const raw = hex.trim().replace(/^#/, '');
	if (raw.length === 3) {
		const r = parseInt(raw[0] + raw[0], 16);
		const g = parseInt(raw[1] + raw[1], 16);
		const b = parseInt(raw[2] + raw[2], 16);
		if ([r, g, b].some((n) => Number.isNaN(n))) return null;
		return { r, g, b };
	}
	if (raw.length !== 6) return null;
	const n = parseInt(raw, 16);
	if (Number.isNaN(n)) return null;
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
	const c = (x: number) =>
		Math.max(0, Math.min(255, Math.round(x)))
			.toString(16)
			.padStart(2, '0');
	return `#${c(r)}${c(g)}${c(b)}`;
}

interface BannerEditorProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	year: number;
	slotIds: string[];
	slotLabels: Record<string, string>;
	onSaved: () => void;
}

/** Pemilih warna: input native (color picker OS) + hex; slider RGB opsional di popover. */
const ThemeColorPicker = memo(function ThemeColorPicker({
	label,
	value,
	onChange,
	hint,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	hint?: string;
}) {
	const rgb = useMemo(
		() => hexToRgbComponents(value) ?? { r: 128, g: 128, b: 128 },
		[value],
	);

	const [hexDraft, setHexDraft] = useState(value);
	useEffect(() => {
		setHexDraft(value);
	}, [value]);

	const setCh = useCallback(
		(ch: 'r' | 'g' | 'b', n: number) => {
			const next = { ...rgb, [ch]: n };
			onChange(rgbToHex(next.r, next.g, next.b));
		},
		[onChange, rgb],
	);

	const onHexInput = useCallback(
		(raw: string) => {
			let s = raw.trim();
			if (!s.startsWith('#')) s = `#${s}`;
			setHexDraft(s);
			const c = hexToRgbComponents(s);
			if (c) onChange(rgbToHex(c.r, c.g, c.b));
		},
		[onChange],
	);

	const onNativeColorChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			onChange(e.target.value);
		},
		[onChange],
	);

	return (
		<div className="space-y-1.5">
			<Label className="text-xs">{label}</Label>
			<div className="flex flex-wrap items-center gap-2">
				<input
					type="color"
					value={value}
					onChange={onNativeColorChange}
					onPointerDown={(e) => e.stopPropagation()}
					className="h-10 w-[4.5rem] shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					aria-label={`Pilih warna: ${label}`}
					title="Pilih warna"
				/>
				<Input
					className="font-mono text-sm h-10 min-w-[7.5rem] flex-1"
					value={hexDraft}
					onChange={(e) => onHexInput(e.target.value)}
					onBlur={() => setHexDraft(value)}
					placeholder="#RRGGBB"
					spellCheck={false}
					autoComplete="off"
				/>
				<Popover>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-10 shrink-0 text-xs"
							data-banner-color-popover="">
							RGB
						</Button>
					</PopoverTrigger>
					<PopoverContent
						className="z-[100] w-72"
						align="start"
						data-banner-color-popover=""
						onOpenAutoFocus={(e) => e.preventDefault()}
						onCloseAutoFocus={(e) => e.preventDefault()}>
						<p className="text-xs font-medium mb-3">Sesuaikan R / G / B</p>
						<div className="space-y-3">
							<div className="space-y-1">
								<div className="flex justify-between text-[10px] text-muted-foreground">
									<span>Merah</span>
									<span>{rgb.r}</span>
								</div>
								<Slider
									value={[rgb.r]}
									min={0}
									max={255}
									step={1}
									onValueChange={(v) => setCh('r', v[0] ?? 0)}
								/>
							</div>
							<div className="space-y-1">
								<div className="flex justify-between text-[10px] text-muted-foreground">
									<span>Hijau</span>
									<span>{rgb.g}</span>
								</div>
								<Slider
									value={[rgb.g]}
									min={0}
									max={255}
									step={1}
									onValueChange={(v) => setCh('g', v[0] ?? 0)}
								/>
							</div>
							<div className="space-y-1">
								<div className="flex justify-between text-[10px] text-muted-foreground">
									<span>Biru</span>
									<span>{rgb.b}</span>
								</div>
								<Slider
									value={[rgb.b]}
									min={0}
									max={255}
									step={1}
									onValueChange={(v) => setCh('b', v[0] ?? 0)}
								/>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>
			{hint ? (
				<p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>
			) : null}
		</div>
	);
});

export function BannerEditor({
	open,
	onOpenChange,
	year,
	slotIds,
	slotLabels,
	onSaved,
}: BannerEditorProps) {
	const { toast } = useToast();
	const [selectedSlot, setSelectedSlot] = useState(slotIds[0] || '');
	const [photoFile, setPhotoFile] = useState<File | null>(null);
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);

	const [themeColor, setThemeColor] = useState(DEFAULT_THEME);

	const [divisionText, setDivisionText] = useState('');
	const [personName, setPersonName] = useState(BANNER_TEMPLATE_DEFAULTS.personName);
	const [showLogo, setShowLogo] = useState(false);
	const [logoFile, setLogoFile] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	const [showDivisionName, setShowDivisionName] = useState(true);

	const [serverRendering, setServerRendering] = useState(false);
	const [saving, setSaving] = useState(false);
	const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
	const [exportPreview, setExportPreview] = useState<string | null>(null);

	/** Sinkron label divisi hanya saat slot berubah — bukan saat `slotLabels` objek baru dari parent (menghindari timpa teks custom). */
	const divisionSlotSyncRef = useRef<string | null>(null);

	const resetState = useCallback(() => {
		divisionSlotSyncRef.current = null;
		setSelectedSlot(slotIds[0] || '');
		setPhotoFile(null);
		setPhotoPreview(null);
		setThemeColor(DEFAULT_THEME);
		setDivisionText('');
		setPersonName(BANNER_TEMPLATE_DEFAULTS.personName);
		setShowLogo(false);
		setLogoFile(null);
		setLogoPreview(null);
		setShowDivisionName(true);
		setServerRendering(false);
		setSaving(false);
		setExportedBlob(null);
		setExportPreview((prev) => {
			if (prev) URL.revokeObjectURL(prev);
			return null;
		});
	}, [slotIds]);

	useEffect(() => {
		if (!open) resetState();
	}, [open, resetState]);

	/** Saat ganti slot: isi divisi dari label slot (sekali per slot, tidak memicu ulang jika hanya referensi `slotLabels` berubah). */
	useEffect(() => {
		if (!selectedSlot || !slotLabels[selectedSlot]) return;
		if (divisionSlotSyncRef.current !== selectedSlot) {
			divisionSlotSyncRef.current = selectedSlot;
			setDivisionText(slotLabels[selectedSlot]);
		}
	}, [selectedSlot, slotLabels]);

	/** Buka dialog dengan field divisi kosong (mis. setelah clear): isi lagi dari slot terpilih. */
	useEffect(() => {
		if (!open || !selectedSlot || !slotLabels[selectedSlot]) return;
		setDivisionText((prev) =>
			prev.trim() === '' ? slotLabels[selectedSlot] : prev,
		);
	}, [open, selectedSlot, slotLabels]);

	useEffect(() => {
		return () => {
			if (exportPreview) URL.revokeObjectURL(exportPreview);
		};
	}, [exportPreview]);

	const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setPhotoFile(file);
		const reader = new FileReader();
		reader.onload = () => setPhotoPreview(reader.result as string);
		reader.readAsDataURL(file);
	};

	const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setLogoFile(file);
		setShowLogo(true);
		const reader = new FileReader();
		reader.onload = () => setLogoPreview(reader.result as string);
		reader.readAsDataURL(file);
	};

	const generateBannerOnServer = useCallback(async () => {
		if (!selectedSlot) {
			toast({ title: 'Pilih divisi dulu', variant: 'destructive' });
			return;
		}
		setServerRendering(true);
		try {
			const divisionForRender =
				divisionText.trim() ||
				(selectedSlot ? (slotLabels[selectedSlot] ?? '') : '');
			const fd = new FormData();
			fd.append('personName', personName);
			fd.append('divisionText', divisionForRender);
			fd.append('themeColor', themeColor);
			fd.append('showDivisionName', String(showDivisionName));
			fd.append('showLogo', String(showLogo));
			if (photoFile) fd.append('photo', photoFile);
			if (showLogo && logoFile) fd.append('logo', logoFile);

			const res = await fetch(`/api/home-images/${year}/banner-render`, {
				method: 'POST',
				body: fd,
				credentials: 'include',
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Render gagal');
			}
			const blob = await res.blob();
			setExportedBlob(blob);
			setExportPreview((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return URL.createObjectURL(blob);
			});
			toast({
				title: 'Pratinjau diperbarui',
				description:
					'Ubah lagi form lalu klik perbarui, atau simpan ke slot banner.',
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			toast({
				title: 'Gagal render di server',
				description: message,
				variant: 'destructive',
			});
		} finally {
			setServerRendering(false);
		}
	}, [
		selectedSlot,
		slotLabels,
		personName,
		divisionText,
		themeColor,
		showDivisionName,
		showLogo,
		photoFile,
		logoFile,
		year,
		toast,
	]);

	const handleSave = useCallback(async () => {
		if (!exportedBlob) {
			toast({
				title: 'Buat pratinjau dulu',
				description: 'Klik «Perbarui pratinjau» sebelum menyimpan.',
				variant: 'destructive',
			});
			return;
		}

		setSaving(true);
		try {
			const form = new FormData();
			form.append('image', exportedBlob, `banner_${selectedSlot}.webp`);
			const res = await fetch(
				`/api/home-images/${year}/upload/${selectedSlot}`,
				{ method: 'POST', body: form, credentials: 'include' },
			);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Upload gagal');
			}
			toast({
				title: 'Banner berhasil disimpan!',
				description: `Banner ${slotLabels[selectedSlot] || selectedSlot} tahun ${year} berhasil diupdate.`,
			});
			onSaved();
			onOpenChange(false);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			toast({
				title: 'Gagal menyimpan',
				description: message,
				variant: 'destructive',
			});
		} finally {
			setSaving(false);
		}
	}, [exportedBlob, selectedSlot, year, slotLabels, toast, onSaved, onOpenChange]);

	return (
		<Dialog modal={false} open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-[min(1100px,96vw)] max-h-[min(92dvh,900px)] flex flex-col gap-0 p-0 overflow-hidden"
				onPointerDownOutside={(e) => {
					const t = e.target as HTMLElement | null;
					if (t?.closest?.('[data-banner-color-popover]')) e.preventDefault();
				}}>
				<DialogHeader className="px-6 pt-6 pb-2 shrink-0 text-left border-b">
					<DialogTitle className="flex items-center gap-2">
						<Wand2 className="h-5 w-5" />
						Editor banner
					</DialogTitle>
					<DialogDescription>
						Pilih satu <strong>warna tema</strong>. Server menyesuaikan Gradient Map,
						strip belakang nama, dan kabut bawah. Setiap kali Anda mengubah foto, warna,
						nama, divisi, atau logo, klik <strong>«Perbarui pratinjau»</strong> agar gambar
						di-render ulang di server (pratinjau tidak berubah otomatis). Jika sudah sesuai,
						barulah <strong>«Simpan ke slot»</strong>.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 min-h-0 overflow-y-auto">
					<div className="grid md:grid-cols-[minmax(280px,400px)_1fr] gap-6 p-6">
						<div className="space-y-4 min-w-0">
							<div className="space-y-2">
								<Label>Pilih divisi / slot</Label>
								<Select value={selectedSlot} onValueChange={setSelectedSlot}>
									<SelectTrigger>
										<SelectValue placeholder="Pilih divisi..." />
									</SelectTrigger>
									<SelectContent>
										{slotIds.map((id) => (
											<SelectItem key={id} value={id}>
												{slotLabels[id] || id}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label>Foto potret (opsional)</Label>
								<Input
									type="file"
									accept="image/*"
									onChange={handlePhotoSelect}
								/>
								{photoPreview && (
									<div className="relative inline-block max-w-full">
										<img
											src={photoPreview}
											alt="Preview foto"
											className="max-h-36 rounded-md border bg-muted object-contain"
										/>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="absolute top-1 right-1 h-7 w-7 p-0 bg-black/50 hover:bg-black/70 text-white rounded-full"
											onClick={() => {
												setPhotoFile(null);
												setPhotoPreview(null);
											}}>
											<X className="h-3 w-3" />
										</Button>
									</div>
								)}
								<p className="text-xs text-muted-foreground">
									Untuk memasukkan foto potrait.
								</p>
							</div>

							<ThemeColorPicker
								label="Warna tema"
								value={themeColor}
								onChange={setThemeColor}
								hint="Satu warna utama: server otomatis menghitung Gradient Map (gelap & terang), strip belakang teks nama, dan kabut bawah — untuk auto adjust warna."
							/>

							<div className="space-y-2">
								<Label>Logo (opsional)</Label>
								<div className="flex flex-wrap items-center gap-2">
									<Input
										type="file"
										accept="image/*"
										onChange={handleLogoSelect}
										className="flex-1 min-w-[180px]"
									/>
									<div className="flex items-center gap-2">
										<Switch
											checked={showLogo}
											onCheckedChange={setShowLogo}
											id="banner-show-logo"
										/>
										<Label htmlFor="banner-show-logo" className="text-xs cursor-pointer">
											Tampilkan logo
										</Label>
									</div>
								</div>
								{logoPreview && showLogo && (
									<img
										src={logoPreview}
										alt="Logo"
										className="h-12 w-auto object-contain rounded border bg-muted p-1"
									/>
								)}
								<p className="text-xs text-muted-foreground">
									Kotak Layer Logo — gambar di-scale agar utuh terlihat (tidak ter-crop).
									Matikan toggle untuk menyembunyikan logo.
								</p>
							</div>

							<div className="flex items-center gap-2">
								<Switch
									checked={showDivisionName}
									onCheckedChange={setShowDivisionName}
									id="banner-show-text"
								/>
								<Label htmlFor="banner-show-text" className="text-sm cursor-pointer">
									Tampilkan teks nama & divisi
								</Label>
							</div>

							<div className="space-y-2">
								<Label>Nama</Label>
								<Input
									className="font-bold uppercase italic"
									value={personName}
									onChange={(e) =>
										setPersonName(e.target.value.toUpperCase())
									}
									placeholder={BANNER_TEMPLATE_DEFAULTS.personName}
								/>
							</div>

							<div className="space-y-2">
								<Label>Divisi (teks vertikal)</Label>
								<Input
									className="font-bold uppercase italic"
									value={divisionText}
									onChange={(e) =>
										setDivisionText(e.target.value.toUpperCase())
									}
									placeholder={
										slotLabels[selectedSlot] ?? 'Nama divisi...'
									}
								/>
							</div>
						</div>

						<div className="flex flex-col min-h-[280px] md:min-h-[420px] rounded-lg border bg-muted/30 p-4">
							<div className="flex items-center gap-2 text-sm font-medium mb-3 shrink-0">
								<ImageIcon className="h-4 w-4 opacity-70" />
								Pratinjau
							</div>
							<div className="flex-1 flex items-center justify-center min-h-0 rounded-md border border-dashed bg-background/80 p-4">
								{exportPreview ? (
									<img
										src={exportPreview}
										alt="Pratinjau banner"
										className="max-w-full max-h-[min(60dvh,560px)] w-auto h-auto object-contain shadow-sm rounded"
									/>
								) : (
									<div className="text-center px-4 space-y-2">
										<Palette className="h-8 w-8 mx-auto text-muted-foreground/50" />
										<p className="text-sm text-muted-foreground">
											Belum ada pratinjau. Isi form lalu klik «Perbarui pratinjau» untuk
											render di server (bukan otomatis).
										</p>
									</div>
								)}
							</div>
							{exportedBlob ? (
								<p className="text-xs text-muted-foreground mt-3 text-center">
									{(exportedBlob.size / 1024).toFixed(1)} KB WebP — ubah lagi lalu perbarui,
									atau simpan.
								</p>
							) : null}
						</div>
					</div>
				</div>

				<DialogFooter className="shrink-0 px-6 py-4 border-t bg-background gap-2 flex-wrap">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Tutup
					</Button>
					<Button
						variant="secondary"
						onClick={() => void generateBannerOnServer()}
						disabled={!selectedSlot || serverRendering}>
						{serverRendering ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4 mr-2" />
						)}
						Perbarui pratinjau
					</Button>
					<Button
						onClick={() => void handleSave()}
						disabled={!exportedBlob || saving}
						className="bg-green-600 hover:bg-green-700 text-white">
						{saving ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Save className="h-4 w-4 mr-2" />
						)}
						Simpan ke slot
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
