import RichTextEditor from '@/components/dashboard/rich-text-editor';
import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { isReservedTenantSlug } from '@shared/tenant-paths';
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AboutPageTrackRecordItem } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	Building2,
	Check,
	Eye,
	EyeOff,
	GripVertical,
	Image,
	ImageIcon,
	Key,
	Loader2,
	Mail,
	Plus,
	Trash2,
	Upload,
	User,
	Users,
	X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';

interface LambangItemWithId {
	_dndId: string;
	key: string;
	title: string;
	description: string;
	imageUrl?: string;
}

let _regSeqId = 0;
function genId() {
	return `ob_${Date.now()}_${++_regSeqId}`;
}

function ensureIds(
	items: AboutPageTrackRecordItem[],
): AboutPageTrackRecordItem[] {
	return items.map((it) => (it.id ? it : { ...it, id: genId() }));
}

// Sortable row — Sejarah (reuse pola dashboard profil)
function OnboardSortableTrackRow({
	row,
	idx,
	onUpdate,
	onDelete,
}: {
	row: AboutPageTrackRecordItem;
	idx: number;
	onUpdate: (
		i: number,
		f: keyof AboutPageTrackRecordItem,
		v: string | string[],
	) => void;
	onDelete: (i: number) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row.id! });
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};
	const [divText, setDivText] = useState(
		Array.isArray(row.divisions) ? row.divisions.join(', ') : '',
	);
	const commitDivisions = () => {
		onUpdate(
			idx,
			'divisions',
			divText
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		);
	};
	return (
		<div
			ref={setNodeRef}
			style={style}
			className="flex flex-wrap gap-2 items-start p-3 border rounded-md bg-muted/30">
			<button
				type="button"
				className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground mt-1.5"
				{...attributes}
				{...listeners}>
				<GripVertical className="h-4 w-4" />
			</button>
			<Input
				placeholder="Tahun"
				value={row.year}
				onChange={(e) => onUpdate(idx, 'year', e.target.value)}
				className="w-20 text-sm h-8"
			/>
			<Input
				placeholder="Nama Ketua"
				value={row.chairpersonName}
				onChange={(e) => onUpdate(idx, 'chairpersonName', e.target.value)}
				className="flex-1 min-w-[140px] text-sm h-8"
			/>
			<Input
				placeholder="Divisi (pisah koma)"
				value={divText}
				onChange={(e) => setDivText(e.target.value)}
				onBlur={commitDivisions}
				className="flex-1 min-w-[160px] text-sm h-8"
			/>
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 text-destructive hover:text-destructive"
				onClick={() => onDelete(idx)}>
				<Trash2 className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

// Sortable card — Filosofi + upload gambar (reuse pola dashboard profil)
function OnboardSortableLambangCard({
	item,
	idx,
	onUpdate,
	onUploadImage,
	onDelete,
}: {
	item: LambangItemWithId;
	idx: number;
	onUpdate: (i: number, f: keyof LambangItemWithId, v: string) => void;
	onUploadImage: (idx: number, file: File) => void;
	onDelete: (i: number) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item._dndId });
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};
	return (
		<div
			ref={setNodeRef}
			style={style}
			className="p-3 border rounded-md bg-muted/20 space-y-2">
			<div className="flex gap-3 items-start">
				<button
					type="button"
					className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground mt-1"
					{...attributes}
					{...listeners}>
					<GripVertical className="h-4 w-4" />
				</button>
				<div className="flex-shrink-0 space-y-1">
					<div className="w-16 h-16 rounded-lg overflow-hidden bg-muted border flex items-center justify-center">
						{item.imageUrl ? (
							<img
								src={item.imageUrl}
								alt={item.title}
								className="w-full h-full object-contain"
							/>
						) : (
							<ImageIcon className="h-6 w-6 text-muted-foreground/40" />
						)}
					</div>
					<Input
						type="file"
						accept="image/*"
						className="text-[10px] w-16"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) onUploadImage(idx, f);
							e.target.value = '';
						}}
					/>
				</div>
				<div className="flex-1 min-w-0 space-y-1.5">
					<div className="grid grid-cols-2 gap-2">
						<Input
							value={item.title}
							onChange={(e) => onUpdate(idx, 'title', e.target.value)}
							placeholder="Judul (mis. Lingkaran)"
							className="text-sm h-8"
						/>
						<Input
							value={item.key}
							onChange={(e) => onUpdate(idx, 'key', e.target.value)}
							placeholder="Key (unik)"
							className="text-sm h-8"
						/>
					</div>
					<Textarea
						value={item.description}
						onChange={(e) => onUpdate(idx, 'description', e.target.value)}
						placeholder="Deskripsi makna..."
						rows={2}
						className="text-sm resize-none"
					/>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="flex-shrink-0 h-8 w-8 text-destructive hover:text-destructive mt-1"
					onClick={() => onDelete(idx)}>
					<Trash2 className="h-3.5 w-3.5" />
				</Button>
			</div>
		</div>
	);
}

type Step = 'code' | 'basic' | 'structure' | 'profil' | 'accounts' | 'success';

interface DivisionEntry {
	id: string;
	label: string;
}
interface AccountEntry {
	username: string;
	password: string;
	email: string;
	name: string;
	role: string;
	division: string;
}

const DEFAULT_BPH = ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara'];

function slugify(s: string) {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

export default function RegisterPage() {
	const { toast } = useToast();
	const [, navigate] = useLocation();
	const [step, setStep] = useState<Step>('code');
	const [code, setCode] = useState('');
	const [codeValid, setCodeValid] = useState(false);
	const [isValidating, setIsValidating] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [createdSlug, setCreatedSlug] = useState('');

	const [form, setForm] = useState({
		communityName: '',
		slug: '',
		ownerUsername: '',
		ownerPassword: '',
		ownerName: '',
		ownerEmail: '',
		description: '',
	});

	const [divisions, setDivisions] = useState<DivisionEntry[]>([
		{ id: 'divisi_1', label: 'Divisi 1' },
		{ id: 'divisi_2', label: 'Divisi 2' },
		{ id: 'divisi_3', label: 'Divisi 3' },
	]);
	const [bphPositions, setBphPositions] = useState<string[]>([...DEFAULT_BPH]);
	const [autoCreateAccounts, setAutoCreateAccounts] = useState(false);
	const [accountEntries, setAccountEntries] = useState<AccountEntry[]>([]);

	const [aboutUs, setAboutUs] = useState('');
	const [trackRecord, setTrackRecord] = useState<AboutPageTrackRecordItem[]>(
		ensureIds([{ year: '', chairpersonName: '', divisions: [] }]),
	);
	const [lambang, setLambang] = useState<LambangItemWithId[]>([
		{ _dndId: genId(), key: '', title: '', description: '', imageUrl: '' },
	]);
	const [logoUrl, setLogoUrl] = useState('');
	const [logoUploading, setLogoUploading] = useState(false);
	const logoInputRef = useRef<HTMLInputElement>(null);

	const dndSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleSejarahDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setTrackRecord((prev) => {
			const oldIdx = prev.findIndex((r) => r.id === active.id);
			const newIdx = prev.findIndex((r) => r.id === over.id);
			return arrayMove(prev, oldIdx, newIdx);
		});
	};

	const handleFilosofiDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setLambang((prev) => {
			const oldIdx = prev.findIndex((i) => i._dndId === active.id);
			const newIdx = prev.findIndex((i) => i._dndId === over.id);
			return arrayMove(prev, oldIdx, newIdx);
		});
	};

	const updateTrackRow = (
		idx: number,
		field: keyof AboutPageTrackRecordItem,
		value: string | string[],
	) => {
		setTrackRecord((prev) =>
			prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
		);
	};

	const updateLambangItem = (
		idx: number,
		field: keyof LambangItemWithId,
		value: string,
	) => {
		setLambang((prev) =>
			prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
		);
	};

	const handleLambangUpload = async (idx: number, file: File) => {
		try {
			const fd = new FormData();
			fd.append('file', file);
			fd.append('category', 'organization');
			fd.append('code', code);
			fd.append('key', `filosofi_${idx}`);
			const res = await fetch('/api/register/upload', {
				method: 'POST',
				body: fd,
			});
			if (!res.ok) throw new Error('Upload gagal');
			const data = await res.json();
			const url = data.url || data.path || '';
			setLambang((prev) =>
				prev.map((it, i) => (i === idx ? { ...it, imageUrl: url } : it)),
			);
			toast({ title: 'Gambar berhasil diupload' });
		} catch {
			toast({ title: 'Upload gagal', variant: 'destructive' });
		}
	};

	const { data: settings } = useQuery<any>({ queryKey: ['/api/settings'] });
	const registrationEnabled = (settings as any)?.enableRegistration;

	useEffect(() => {
		document.title = 'Register Komunitas';
	}, []);

	const [codeCooldownUntil, setCodeCooldownUntil] = useState(0);
	const codeCooldownActive = codeCooldownUntil > Date.now();

	useEffect(() => {
		if (codeCooldownUntil <= Date.now()) return;
		const id = setInterval(() => {
			if (Date.now() >= codeCooldownUntil) {
				setCodeCooldownUntil(0);
				clearInterval(id);
			} else {
				setCodeCooldownUntil((v) => v); // trigger re-render
			}
		}, 1000);
		return () => clearInterval(id);
	}, [codeCooldownUntil]);

	const validateCode = async () => {
		if (!code.trim() || codeCooldownActive) return;
		setIsValidating(true);
		try {
			const res = await fetch('/api/register/validate-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: code.trim() }),
			});
			const data = await res.json();

			if (res.status === 429) {
				const retryAfter = data.retryAfter || 3600;
				setCodeCooldownUntil(Date.now() + retryAfter * 1000);
				toast({
					title: 'Terlalu Banyak Percobaan',
					description: data.message || `Coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.`,
					variant: 'destructive',
				});
				return;
			}

			if (data.valid) {
				setCodeValid(true);
				setStep('basic');
				toast({
					title: 'Kode Valid',
					description: 'Silakan isi form pendaftaran komunitas',
				});
			} else {
				toast({
					title: 'Kode Tidak Valid',
					description: data.message,
					variant: 'destructive',
				});
			}
		} catch {
			toast({
				title: 'Error',
				description: 'Gagal memvalidasi kode',
				variant: 'destructive',
			});
		} finally {
			setIsValidating(false);
		}
	};

	const updateForm = (key: string, value: string) =>
		setForm((prev) => ({ ...prev, [key]: value }));

	const autoSlug = (name: string) =>
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.substring(0, 30);

	// When autoCreateAccounts is toggled on, seed entries from BPH + divisions
	useEffect(() => {
		if (autoCreateAccounts && accountEntries.length === 0) {
			const entries: AccountEntry[] = [];
			for (const pos of bphPositions) {
				const uname = slugify(pos);
				if (uname && uname !== 'ketua') {
					entries.push({
						username: uname,
						password: '',
						email: '',
						name: pos,
						role: 'bph',
						division: '',
					});
				}
			}
			for (const div of divisions) {
				entries.push({
					username: div.id,
					password: '',
					email: '',
					name: div.label,
					role: 'division_head',
					division: div.id,
				});
			}
			setAccountEntries(entries);
		}
	}, [autoCreateAccounts]);

	const handleSubmit = async () => {
		if (
			!form.communityName ||
			!form.slug ||
			!form.ownerUsername ||
			!form.ownerPassword
		) {
			toast({
				title: 'Lengkapi Form',
				description: 'Nama komunitas, slug, username, dan password wajib diisi',
				variant: 'destructive',
			});
			return;
		}
		if (isReservedTenantSlug(form.slug)) {
			toast({
				title: 'Slug tidak tersedia',
				description: 'URL itu dipakai sistem (mis. toko, berita, dashboard). Pilih slug lain.',
				variant: 'destructive',
			});
			return;
		}
		setIsSubmitting(true);
		try {
			const res = await fetch('/api/register/community', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: code.trim(),
					...form,
					initialDivisionCount: divisions.length,
					divisions,
					bphPositions,
					autoCreateAccounts,
					accountEntries: autoCreateAccounts ? accountEntries : [],
					aboutUs: aboutUs || '',
					aboutPageTrackRecord: trackRecord
						.filter((r) => r.year.trim() || r.chairpersonName.trim())
						.map((r) => ({
							year: r.year.trim(),
							chairpersonName: r.chairpersonName.trim(),
							divisions: Array.isArray(r.divisions) ? r.divisions : [],
						})),
					aboutPageLambang: lambang
						.filter((l) => l.key.trim() || l.title.trim())
						.map((l) => ({
							key:
								l.key.trim() ||
								l.title
									.trim()
									.toLowerCase()
									.replace(/\s+/g, '_')
									.replace(/[^a-z0-9_]/g, ''),
							title: l.title.trim(),
							description: l.description.trim(),
							imageUrl: l.imageUrl || '',
						})),
					logoUrl: logoUrl || '',
				}),
			});
			const data = await res.json();
			if (res.status === 429) {
				const retryAfter = data.retryAfter || 3600;
				setCodeCooldownUntil(Date.now() + retryAfter * 1000);
				toast({
					title: 'Terlalu Banyak Percobaan',
					description: data.message || `Coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.`,
					variant: 'destructive',
				});
				return;
			}
			if (!res.ok) throw new Error(data.message);
			setCreatedSlug(data.community.slug);
			setStep('success');
			toast({
				title: 'Berhasil!',
				description: 'Komunitas berhasil didaftarkan',
			});
		} catch (err: any) {
			toast({
				title: 'Gagal',
				description: err.message,
				variant: 'destructive',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!registrationEnabled) {
		return (
			<div
				className="relative min-h-screen flex items-center justify-center overflow-hidden p-4"
				style={{ background: 'var(--gradient-login)' }}>
				<div
					className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full"
					style={{ background: 'var(--orb-color-1)', filter: 'blur(80px)' }}
				/>
				<Card className="relative z-10 w-full max-w-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-xl shadow-xl">
					<CardContent className="py-12 text-center">
						<div className="flex justify-center mb-4">
							<PageBreadcrumb
								className="mb-0"
								items={[{ label: 'Beranda', href: '/' }, { label: 'Daftar' }]}
							/>
						</div>
						<Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
						<h2 className="text-lg font-semibold mb-2">
							Registrasi Tidak Tersedia
						</h2>
						<p className="text-sm text-muted-foreground mb-4">
							Pendaftaran komunitas sedang tidak diaktifkan oleh administrator.
						</p>
						<Button variant="outline" onClick={() => navigate('/login')}>
							Ke halaman login
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const stepLabels: Record<Step, string> = {
		code: 'Kode',
		basic: 'Info Dasar',
		structure: 'Organisasi',
		profil: 'Profil',
		accounts: 'Akun',
		success: 'Selesai',
	};
	const stepOrder: Step[] = [
		'code',
		'basic',
		'structure',
		'profil',
		'accounts',
	];
	const currentIdx = stepOrder.indexOf(step);

	return (
		<div
			className="relative min-h-screen flex items-start sm:items-center justify-center overflow-y-auto overflow-x-hidden p-4 py-8 sm:py-4"
			style={{ background: 'var(--gradient-login)' }}>
			<div
				className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full"
				style={{ background: 'var(--orb-color-1)', filter: 'blur(80px)' }}
			/>
			<div
				className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full"
				style={{ background: 'var(--orb-color-2)', filter: 'blur(70px)' }}
			/>
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.04]"
				style={{
					backgroundImage:
						'linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)',
					backgroundSize: '40px 40px',
				}}
			/>

			<Card
				className={`relative z-10 w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-xl shadow-xl animate-scale-in ${step === 'profil' ? 'max-w-2xl' : 'max-w-xl'}`}>
				<CardHeader className="text-center pb-2 pt-8 px-8">
					<div className="flex justify-center w-full mb-3">
						<PageBreadcrumb
							className="mb-0"
							items={[{ label: 'Beranda', href: '/' }, { label: 'Daftar' }]}
						/>
					</div>
					<p className="text-sm text-slate-600 dark:text-muted-foreground mb-4">
						<Link
							href="/login"
							className="hover:text-primary underline-offset-2 hover:underline transition-colors">
							Ke halaman login
						</Link>
					</p>
					<div className="mx-auto mb-4 w-16 h-16 rounded-full ring-2 ring-cyan-400/40 flex items-center justify-center bg-slate-100 dark:bg-white/5">
						<Building2 className="w-8 h-8 text-cyan-500" />
					</div>
					<h1 className="text-2xl font-bold text-slate-800 dark:bg-gradient-to-r dark:from-white dark:via-blue-100 dark:to-cyan-300 dark:bg-clip-text dark:text-transparent">
						{step === 'success'
							? 'Pendaftaran Berhasil!'
							: 'Daftarkan Komunitas'}
					</h1>
					{step !== 'success' && step !== 'code' && (
						<div className="flex justify-center gap-2 mt-4">
							{stepOrder.map((s, i) => (
								<div
									key={s}
									className={`flex items-center gap-1 text-xs font-medium ${i <= currentIdx ? 'text-cyan-500' : 'text-muted-foreground'}`}>
									<div
										className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < currentIdx ? 'bg-cyan-500 text-white' : i === currentIdx ? 'bg-cyan-500/20 text-cyan-500 ring-1 ring-cyan-500' : 'bg-muted text-muted-foreground'}`}>
										{i < currentIdx ? <Check className="h-3 w-3" /> : i + 1}
									</div>
									<span className="hidden sm:inline">{stepLabels[s]}</span>
									{i < stepOrder.length - 1 && (
										<div className="w-4 h-px bg-border mx-1" />
									)}
								</div>
							))}
						</div>
					)}
					<div className="mx-auto mt-3 h-px w-24 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
				</CardHeader>

				<CardContent
					className={`px-4 sm:px-8 pb-8 pt-4 overflow-y-auto ${step === 'profil' ? 'max-h-[75vh]' : 'max-h-[65vh]'}`}>
					{/* Step: Code */}
					{step === 'code' && (
						<div className="space-y-5">
							<div className="space-y-2">
								<Label>Kode Registrasi</Label>
								<div className="relative">
									<Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
									<Input
										value={code}
										onChange={(e) => setCode(e.target.value)}
										placeholder="XXXX-XXXX-XXXX-XXXX"
										className="pl-9 bg-white dark:bg-white/5 border-slate-200 dark:border-white/15"
										onKeyDown={(e) => e.key === 'Enter' && validateCode()}
									/>
								</div>
								<p className="text-xs text-muted-foreground">
									Dapatkan kode dari administrator website utama
								</p>
							</div>
							<Button
								onClick={validateCode}
								disabled={isValidating || !code.trim() || codeCooldownUntil > Date.now()}
								className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 text-white">
								{isValidating ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<ArrowRight className="h-4 w-4 mr-2" />
								)}
								{codeCooldownUntil > Date.now()
									? `Coba lagi dalam ${Math.ceil((codeCooldownUntil - Date.now()) / 60000)} menit`
									: 'Validasi Kode'}
							</Button>
						</div>
					)}

					{/* Step: Basic Info */}
					{step === 'basic' && (
						<div className="space-y-4">
							<div className="space-y-1.5">
								<Label>Nama Komunitas *</Label>
								<Input
									value={form.communityName}
									onChange={(e) => {
										updateForm('communityName', e.target.value);
										if (
											!form.slug ||
											form.slug === autoSlug(form.communityName)
										)
											updateForm('slug', autoSlug(e.target.value));
									}}
									placeholder="Contoh: GDGOC UIN Malang"
								/>
							</div>
							<div className="space-y-1.5">
								<Label>URL Slug *</Label>
								<div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
									<span>domain.com/</span>
									<span className="font-mono font-semibold text-foreground">
										{form.slug || '...'}
									</span>
								</div>
								<Input
									value={form.slug}
									onChange={(e) =>
										updateForm(
											'slug',
											e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
										)
									}
									placeholder="gdgoc"
								/>
							</div>
							<div className="space-y-1.5">
								<Label>Deskripsi</Label>
								<Input
									value={form.description}
									onChange={(e) => updateForm('description', e.target.value)}
									placeholder="Deskripsi singkat komunitas"
								/>
							</div>
							<div className="h-px bg-border my-2" />
							<p className="text-sm font-medium">Akun Owner Komunitas</p>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label>Username *</Label>
									<div className="relative">
										<User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
										<Input
											value={form.ownerUsername}
											onChange={(e) =>
												updateForm('ownerUsername', e.target.value)
											}
											className="pl-9"
											placeholder="admin"
										/>
									</div>
								</div>
								<div className="space-y-1.5">
									<Label>Nama Lengkap</Label>
									<Input
										value={form.ownerName}
										onChange={(e) => updateForm('ownerName', e.target.value)}
										placeholder="Nama lengkap"
									/>
								</div>
							</div>
							<div className="space-y-1.5">
								<Label>
									Email{' '}
									<span className="text-muted-foreground text-xs">
										(opsional)
									</span>
								</Label>
								<div className="relative">
									<Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
									<Input
										type="email"
										value={form.ownerEmail}
										onChange={(e) => updateForm('ownerEmail', e.target.value)}
										className="pl-9"
										placeholder="email@example.com"
									/>
								</div>
							</div>
							<div className="space-y-1.5">
								<Label>Password *</Label>
								<div className="relative">
									<Input
										type={showPassword ? 'text' : 'password'}
										value={form.ownerPassword}
										onChange={(e) =>
											updateForm('ownerPassword', e.target.value)
										}
										className="pr-10"
										placeholder="Min. 6 karakter"
									/>
									<button
										type="button"
										className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-foreground"
										onClick={() => setShowPassword(!showPassword)}>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
							</div>
							<div className="flex gap-3 pt-2">
								<Button
									variant="outline"
									onClick={() => {
										setStep('code');
										setCodeValid(false);
									}}
									className="flex-1">
									<ArrowLeft className="h-4 w-4 mr-2" />
									Sebelumnya
								</Button>
								<Button
									onClick={() => {
										if (
											!form.communityName ||
											!form.slug ||
											!form.ownerUsername ||
											!form.ownerPassword
										) {
											toast({
												title: 'Lengkapi',
												description: 'Isi field wajib',
												variant: 'destructive',
											});
											return;
										}
										setStep('structure');
									}}
									className="flex-1 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 text-white">
									<ArrowRight className="h-4 w-4 mr-2" />
									Lanjut
								</Button>
							</div>
						</div>
					)}

					{/* Step: Organization Structure */}
					{step === 'structure' && (
						<div className="space-y-4">
							<div>
								<p className="text-sm font-medium mb-2 flex items-center gap-2">
									<Users className="h-4 w-4" /> Divisi Komunitas
								</p>
								<p className="text-xs text-muted-foreground mb-3">
									Tentukan divisi yang akan dibuat. Nama divisi juga digunakan
									sebagai slot banner di Home Images.
								</p>
								<div className="space-y-2">
									{divisions.map((d, idx) => (
										<div
											key={idx}
											className="flex items-center gap-2">
											<Input
												value={d.label}
												onChange={(e) => {
													const nd = [...divisions];
													nd[idx] = {
														id: slugify(e.target.value) || `divisi_${idx + 1}`,
														label: e.target.value,
													};
													setDivisions(nd);
												}}
												placeholder={`Divisi ${idx + 1}`}
												className="flex-1"
											/>
											{divisions.length > 1 && (
												<Button
													size="icon"
													variant="ghost"
													className="shrink-0 text-destructive"
													onClick={() =>
														setDivisions(divisions.filter((_, i) => i !== idx))
													}>
													<Trash2 className="h-4 w-4" />
												</Button>
											)}
										</div>
									))}
								</div>
								<Button
									variant="outline"
									size="sm"
									className="mt-2"
									onClick={() =>
										setDivisions([
											...divisions,
											{ id: `divisi_${divisions.length + 1}`, label: '' },
										])
									}>
									<Plus className="h-3.5 w-3.5 mr-1" />
									Tambah Divisi
								</Button>
							</div>

							<div className="h-px bg-border" />

							<div>
								<p className="text-sm font-medium mb-2">
									Posisi BPH (Badan Pengurus Harian)
								</p>
								<p className="text-xs text-muted-foreground mb-3">
									Posisi yang dibuat otomatis di kepengurusan. Bisa diubah nanti
									di dashboard.
								</p>
								<div className="space-y-2">
									{bphPositions.map((pos, idx) => (
										<div
											key={idx}
											className="flex items-center gap-2">
											<Input
												value={pos}
												onChange={(e) => {
													const np = [...bphPositions];
													np[idx] = e.target.value;
													setBphPositions(np);
												}}
												placeholder="Nama posisi"
												className="flex-1"
											/>
											{bphPositions.length > 1 && (
												<Button
													size="icon"
													variant="ghost"
													className="shrink-0 text-destructive"
													onClick={() =>
														setBphPositions(
															bphPositions.filter((_, i) => i !== idx),
														)
													}>
													<Trash2 className="h-4 w-4" />
												</Button>
											)}
										</div>
									))}
								</div>
								<Button
									variant="outline"
									size="sm"
									className="mt-2"
									onClick={() => setBphPositions([...bphPositions, ''])}>
									<Plus className="h-3.5 w-3.5 mr-1" />
									Tambah Posisi
								</Button>
							</div>

							<div className="flex gap-3 pt-2">
								<Button
									variant="outline"
									onClick={() => setStep('basic')}
									className="flex-1">
									<ArrowLeft className="h-4 w-4 mr-2" />
									Sebelumnya
								</Button>
								<Button
									onClick={() => setStep('profil')}
									className="flex-1 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 text-white">
									<ArrowRight className="h-4 w-4 mr-2" />
									Lanjut
								</Button>
							</div>
						</div>
					)}

					{/* Step: Profil (Opsional) — pola identik dashboard profil */}
					{step === 'profil' && (
						<div className="space-y-5">
							<p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5">
								Semua field di bawah ini bersifat <strong>opsional</strong>.
								Kamu bisa mengisi atau mengubahnya nanti di Dashboard &gt;
								Profil.
							</p>

							{/* ── Tentang Kami (Rich Text) ── */}
							<div className="space-y-2">
								<Label className="flex items-center gap-1.5">
									<BookOpen className="h-3.5 w-3.5" /> Tentang Kami
								</Label>
								<RichTextEditor
									value={aboutUs}
									onChange={setAboutUs}
									placeholder="Deskripsi tentang komunitas..."
									height={200}
								/>
							</div>

							{/* ── Sejarah — Track Record (sortable drag-drop) ── */}
							<div className="space-y-2">
								<Label>Sejarah — Track Record Ketua</Label>
								<p className="text-xs text-muted-foreground">
									Rekam jejak per tahun. Seret handle untuk mengubah urutan.
									Divisi pisah koma.
								</p>
								<DndContext
									sensors={dndSensors}
									collisionDetection={closestCenter}
									onDragEnd={handleSejarahDragEnd}>
									<SortableContext
										items={trackRecord.map((r) => r.id!)}
										strategy={verticalListSortingStrategy}>
										<div className="space-y-2">
											{trackRecord.map((row, idx) => (
												<OnboardSortableTrackRow
													key={row.id}
													row={row}
													idx={idx}
													onUpdate={updateTrackRow}
													onDelete={(i) =>
														setTrackRecord((p) => p.filter((_, j) => j !== i))
													}
												/>
											))}
										</div>
									</SortableContext>
								</DndContext>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setTrackRecord((prev) => [
											...prev,
											{
												id: genId(),
												year: '',
												chairpersonName: '',
												divisions: [],
											},
										])
									}>
									<Plus className="h-3.5 w-3.5 mr-1" />
									Tambah Periode
								</Button>
							</div>

							{/* ── Filosofi / Makna Logo (sortable drag-drop + upload gambar) ── */}
							<div className="space-y-2">
								<Label>Filosofi / Makna Logo</Label>
								<p className="text-xs text-muted-foreground">
									Elemen filosofi lambang. Seret handle untuk urutan. Upload
									gambar per elemen.
								</p>
								<DndContext
									sensors={dndSensors}
									collisionDetection={closestCenter}
									onDragEnd={handleFilosofiDragEnd}>
									<SortableContext
										items={lambang.map((i) => i._dndId)}
										strategy={verticalListSortingStrategy}>
										<div className="space-y-2">
											{lambang.map((item, idx) => (
												<OnboardSortableLambangCard
													key={item._dndId}
													item={item}
													idx={idx}
													onUpdate={updateLambangItem}
													onUploadImage={handleLambangUpload}
													onDelete={(i) =>
														setLambang((p) => p.filter((_, j) => j !== i))
													}
												/>
											))}
										</div>
									</SortableContext>
								</DndContext>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setLambang((prev) => [
											...prev,
											{
												_dndId: genId(),
												key: '',
												title: '',
												description: '',
												imageUrl: '',
											},
										])
									}>
									<Plus className="h-3.5 w-3.5 mr-1" />
									Tambah Filosofi
								</Button>
							</div>

							{/* ── Logo Komunitas Upload ── */}
							<div className="border rounded-lg p-4 bg-muted/30 space-y-3">
								<Label className="flex items-center gap-1.5">
									<Image className="h-4 w-4 text-cyan-500" /> Logo Komunitas
								</Label>
								<p className="text-xs text-muted-foreground">
									Upload logo komunitas (opsional). Bisa juga diupload nanti via
									Dashboard &gt; Profil.
								</p>
								<input
									ref={logoInputRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={async (e) => {
										const file = e.target.files?.[0];
										if (!file) return;
										setLogoUploading(true);
										try {
											const fd = new FormData();
											fd.append('file', file);
											fd.append('category', 'organization');
											fd.append('code', code);
											fd.append('key', 'logo');
											const res = await fetch('/api/register/upload', {
												method: 'POST',
												body: fd,
											});
											if (!res.ok) throw new Error('Upload gagal');
											const data = await res.json();
											setLogoUrl(data.url || data.path || '');
											toast({ title: 'Logo berhasil diupload' });
										} catch {
											toast({ title: 'Upload gagal', variant: 'destructive' });
										} finally {
											setLogoUploading(false);
											if (logoInputRef.current) logoInputRef.current.value = '';
										}
									}}
								/>
								{logoUrl ? (
									<div className="flex items-center gap-3">
										<img
											src={logoUrl}
											alt="Logo"
											className="h-16 w-16 rounded-lg object-contain border bg-white dark:bg-white/10"
										/>
										<div className="flex gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() => logoInputRef.current?.click()}
												disabled={logoUploading}>
												{logoUploading ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
												) : (
													<Upload className="h-3.5 w-3.5 mr-1" />
												)}
												Ganti
											</Button>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												className="text-destructive"
												onClick={() => setLogoUrl('')}>
												<X className="h-3.5 w-3.5 mr-1" />
												Hapus
											</Button>
										</div>
									</div>
								) : (
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => logoInputRef.current?.click()}
										disabled={logoUploading}>
										{logoUploading ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
										) : (
											<Upload className="h-3.5 w-3.5 mr-1" />
										)}
										Upload Logo
									</Button>
								)}
							</div>

							<div className="flex gap-3 pt-2">
								<Button
									variant="outline"
									onClick={() => setStep('structure')}
									className="flex-1">
									<ArrowLeft className="h-4 w-4 mr-2" />
									Sebelumnya
								</Button>
								<Button
									onClick={() => setStep('accounts')}
									className="flex-1 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 text-white">
									<ArrowRight className="h-4 w-4 mr-2" />
									Lanjut
								</Button>
							</div>
						</div>
					)}

					{/* Step: Accounts */}
					{step === 'accounts' && (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">
										Buat Akun Login Otomatis
									</p>
									<p className="text-xs text-muted-foreground">
										Buat akun untuk BPH dan kepala divisi secara otomatis
										(opsional).
									</p>
								</div>
								<Switch
									checked={autoCreateAccounts}
									onCheckedChange={setAutoCreateAccounts}
								/>
							</div>

							{autoCreateAccounts && (
								<div className="space-y-3">
									<p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
										Password kosong = default{' '}
										<code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">
											admin123
										</code>
										. Pastikan setiap user mengganti password setelah login
										pertama.
									</p>
									{accountEntries.map((entry, idx) => (
										<div
											key={idx}
											className="border rounded-lg p-3 space-y-2 bg-muted/30">
											<div className="flex items-center justify-between">
												<span className="text-xs font-medium text-muted-foreground">
													{entry.role === 'bph' ? 'BPH' : 'Divisi'}:{' '}
													{entry.name}
												</span>
												<Button
													size="icon"
													variant="ghost"
													className="h-6 w-6 text-destructive"
													onClick={() =>
														setAccountEntries(
															accountEntries.filter((_, i) => i !== idx),
														)
													}>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
											<div className="grid grid-cols-2 gap-2">
												<Input
													value={entry.username}
													onChange={(e) => {
														const ne = [...accountEntries];
														ne[idx] = { ...ne[idx], username: e.target.value };
														setAccountEntries(ne);
													}}
													placeholder="Username"
													className="text-sm h-8"
												/>
												<Input
													value={entry.password}
													onChange={(e) => {
														const ne = [...accountEntries];
														ne[idx] = { ...ne[idx], password: e.target.value };
														setAccountEntries(ne);
													}}
													placeholder="Password (kosong=admin123)"
													type="password"
													className="text-sm h-8"
												/>
											</div>
											<Input
												value={entry.email}
												onChange={(e) => {
													const ne = [...accountEntries];
													ne[idx] = { ...ne[idx], email: e.target.value };
													setAccountEntries(ne);
												}}
												placeholder="Email (opsional)"
												type="email"
												className="text-sm h-8"
											/>
										</div>
									))}
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											setAccountEntries([
												...accountEntries,
												{
													username: '',
													password: '',
													email: '',
													name: '',
													role: 'bph',
													division: '',
												},
											])
										}>
										<Plus className="h-3.5 w-3.5 mr-1" />
										Tambah Akun
									</Button>
								</div>
							)}

							<div className="flex gap-3 pt-2">
								<Button
									variant="outline"
									onClick={() => setStep('profil')}
									className="flex-1">
									<ArrowLeft className="h-4 w-4 mr-2" />
									Sebelumnya
								</Button>
								<Button
									onClick={handleSubmit}
									disabled={isSubmitting}
									className="flex-1 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 text-white">
									{isSubmitting ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Check className="h-4 w-4 mr-2" />
									)}
									Daftarkan Komunitas
								</Button>
							</div>
						</div>
					)}

					{/* Step: Success */}
					{step === 'success' && (
						<div className="text-center space-y-4">
							<div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto">
								<Check className="h-8 w-8 text-green-600 dark:text-green-400" />
							</div>
							<p className="text-sm text-muted-foreground">
								Komunitas kamu sudah dibuat dan siap digunakan!
							</p>
							{autoCreateAccounts &&
								accountEntries.some((e) => !e.password.trim()) && (
									<p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
										Beberapa akun dibuat dengan password default{' '}
										<strong>admin123</strong>. Segera minta setiap user
										mengganti password mereka.
									</p>
								)}
							<div className="flex gap-3 justify-center">
								<Button
									variant="outline"
									onClick={() => navigate(`/${createdSlug}/login`)}>
									Login ke Dashboard
								</Button>
								<Button onClick={() => navigate(`/${createdSlug}`)}>
									Lihat Website
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
