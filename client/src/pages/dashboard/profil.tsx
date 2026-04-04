import ContentEditor from '@/components/dashboard/content-editor';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import RichTextEditor from '@/components/dashboard/rich-text-editor';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
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
import { buildSimpleSpyroPageData } from '@shared/dashboard-spyro-context';
import type { AboutPageLambangItem, AboutPageTrackRecordItem } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/lib/tenant-context';
import { ArrowLeft, ExternalLink, FileEdit, GripVertical, ImageIcon, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

interface Settings {
	_id?: string;
	id?: number;
	aboutUs?: string;
	aboutVideoUrl?: string;
	aboutVideoGdriveUrl?: string;
	aboutPageTrackRecord?: AboutPageTrackRecordItem[];
	aboutPageLambang?: AboutPageLambangItem[];
	[key: string]: any;
}

let _seqId = 0;
function genId() {
	return `tr_${Date.now()}_${++_seqId}`;
}

function ensureTrackRecordIds(items: AboutPageTrackRecordItem[]): AboutPageTrackRecordItem[] {
	return items.map((item) => (item.id ? item : { ...item, id: genId() }));
}

const defaultTrackRecord: AboutPageTrackRecordItem[] = [
	{ year: '2013', chairpersonName: 'Willdan Pramanda W.', divisions: ['Public Relation', 'Multimedia', 'Jaringan & Hardware', 'Keagamaan', 'Pemrograman', 'Softskill'] },
	{ year: '2014', chairpersonName: 'Saiful Rizal', divisions: ['Public Relation', 'Multimedia', 'Jaringan', 'Keagamaan', 'Pemrograman', 'Softskill'] },
	{ year: '2015', chairpersonName: 'M. Fairuz Zumar Rounnaqi', divisions: ['Public Relation', 'Multimedia', 'Jaringan', 'Open Source', 'Pemrograman', 'Softskill & Jurnalistik', 'Keagamaan & Enterpreneurship'] },
	{ year: '2016', chairpersonName: 'M. Wildan Taufiqurrahman', divisions: ['Public Relation', 'Multimedia', 'Intelektual', 'Softskill', 'Jurnalistik', 'Technopreneurship', 'Religius'] },
	{ year: '2017', chairpersonName: 'Zakiya Ramadhan', divisions: ['Public Relation', 'Multimedia', 'Intelektual', 'Softskill', 'Jurnalistik', 'Technopreneurship', 'Religius'] },
	{ year: '2018', chairpersonName: 'Muhammad Fahmi Abidin', divisions: ['Public Relation', 'Intelektual', 'Softskill', 'Jurnalistik', 'Technopreneurship', 'Religius'] },
	{ year: '2019', chairpersonName: 'Aqilarik Nugra Rezkanintio', divisions: ['Public Relation', 'Intelektual', 'Seni dan Olahraga', 'Media dan Informasi', 'Technopreneurship', 'Religius'] },
	{ year: '2020', chairpersonName: 'M. Ibram Gusti Childrabahti', divisions: ['Public Relation', 'Intelektual', 'Seni dan Olahraga', 'Media dan Informasi', 'Technopreneurship', 'Religius'] },
	{ year: '2021', chairpersonName: 'Bisyri Syamsuri', divisions: ['Public Relation', 'Intelektual', 'Seni dan Olahraga', 'Media dan Informasi', 'Technopreneurship', 'Religius'] },
	{ year: '2022', chairpersonName: 'Rafi Aulia Prasetya', divisions: ['Public Relation', 'Intelektual', 'Seni dan Olahraga', 'Media dan Informasi', 'Technopreneurship', 'Religius'] },
	{ year: '2023', chairpersonName: 'M. Reyhan Aditya Hendrawan', divisions: ['Public Relation', 'Intelektual', 'Seni dan Olahraga', 'Media dan Informasi', 'Technopreneurship', 'Religius'] },
	{ year: '2024', chairpersonName: 'Mohammad Aulia Syamsul Hadi', divisions: ['Public Relation', 'Intelektual', 'Seni dan Olahraga', 'Media dan Informasi', 'Technopreneurship', 'Religius'] },
];

const defaultLambang: AboutPageLambangItem[] = [
	{ key: 'Lingkaran', title: 'Lingkaran', description: 'Lingkaran menandakan bahwa jurusan Teknik Informatika memiliki solidaritas tanpa ujung.', imageUrl: '/attached_assets/filosofi/Lingkaran.png' },
	{ key: 'Bidikan', title: 'Bidikan', description: 'Merepresentasikan bahwa Himpunan memiliki sebuah tujuan yang jelas untuk dicapai, dengan mengedepankan karakter yang dinamis dan kuat.', imageUrl: '/attached_assets/filosofi/Bidikan.png' },
	{ key: 'Tulisan TI Berbentuk Puzzle', title: 'Tulisan TI Berbentuk Puzzle', description: 'Merepresentasikan penyelesaian setiap masalah dengan langkah-langkah yang harus diambil dengan benar.', imageUrl: '/attached_assets/filosofi/Tulisan TI Berbentuk Puzzle.png' },
	{ key: 'Mata', title: 'Mata', description: 'Fokus menghadapi masa depan dengan penuh perhitungan dan percaya diri.', imageUrl: '/attached_assets/filosofi/Mata.png' },
	{ key: 'Kurung Kurawal', title: 'Kurung Kurawal', description: 'Menandakan elemen penting dalam pembentuk gambar mata yang memiliki arti fokus, loyal, dan memiliki jiwa tanggung jawab.', imageUrl: '/attached_assets/filosofi/Kurung Kurawal.png' },
	{ key: 'Grafik Linier', title: 'Grafik Linier', description: 'Menandakan Himpunan yang selalu berkembang, namun tetap adil.', imageUrl: '/attached_assets/filosofi/Grafik Linier.png' },
	{ key: 'Biru 81BFE8', title: 'Biru', description: 'Bermakna intelektual, loyalitas, dan tanggung jawab. Hex Color: 81BFE8', imageUrl: '/attached_assets/filosofi/Biru 81BFE8.png' },
	{ key: 'Jingga E75B1D', title: 'Jingga', description: 'Melambangkan kehangatan dan kenyamanan. Hex Color: E75B1D.', imageUrl: '/attached_assets/filosofi/Jingga E75B1D.png' },
	{ key: 'Abu Abu A1A5A6', title: 'Abu-abu', description: 'Menggambarkan keseriusan, kestabilan, kemandirian, dan memberikan kesan tanggung jawab. Hex Color: A1A5A6.', imageUrl: '/attached_assets/filosofi/Abu Abu A1A5A6.png' },
	{ key: 'Putih FFFFFF', title: 'Putih', description: 'Melambangkan kebebasan dan keterbukaan. Hex Color: FFFFFF.', imageUrl: '/attached_assets/filosofi/Putih FFFFFF.png' },
];

// ---------------------------------------------------------------------------
// Sortable row for Sejarah (Track Record)
// ---------------------------------------------------------------------------
function SortableTrackRecordRow({
	row,
	idx,
	onUpdate,
	onRequestDelete,
}: {
	row: AboutPageTrackRecordItem;
	idx: number;
	onUpdate: (idx: number, field: keyof AboutPageTrackRecordItem, value: string | string[]) => void;
	onRequestDelete: (idx: number) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: row.id!,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div ref={setNodeRef} style={style} className="flex flex-wrap gap-2 items-start p-3 border rounded-md bg-muted/30">
			<button
				type="button"
				className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground mt-1.5"
				{...attributes}
				{...listeners}
			>
				<GripVertical className="h-4 w-4" />
			</button>
			<Input
				placeholder="Tahun"
				value={row.year}
				onChange={(e) => onUpdate(idx, 'year', e.target.value)}
				className="w-20"
			/>
			<Input
				placeholder="Nama Ketua"
				value={row.chairpersonName}
				onChange={(e) => onUpdate(idx, 'chairpersonName', e.target.value)}
				className="flex-1 min-w-[180px]"
			/>
			<Input
				placeholder="Divisi (pisah koma)"
				value={Array.isArray(row.divisions) ? row.divisions.join(', ') : ''}
				onChange={(e) =>
					onUpdate(idx, 'divisions', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
				}
				className="flex-1 min-w-[200px]"
			/>
			<Button
				variant="ghost"
				size="icon"
				onClick={() => onRequestDelete(idx)}
				className="text-destructive hover:text-destructive"
			>
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Sortable card for Filosofi (Lambang)
// ---------------------------------------------------------------------------
function SortableLambangCard({
	item,
	idx,
	onUpdate,
	onUpload,
	onRequestDelete,
}: {
	item: AboutPageLambangItem;
	idx: number;
	onUpdate: (idx: number, field: keyof AboutPageLambangItem, value: string) => void;
	onUpload: (key: string, file: File) => void;
	onRequestDelete: (idx: number) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.key,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div ref={setNodeRef} style={style} className="p-4 border rounded-md bg-muted/20 space-y-3">
			<div className="flex gap-4 items-start">
				<button
					type="button"
					className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground mt-1"
					{...attributes}
					{...listeners}
				>
					<GripVertical className="h-5 w-5" />
				</button>
				<div className="flex-shrink-0">
					<div className="w-24 h-24 rounded-lg overflow-hidden bg-muted border flex items-center justify-center">
						<img
							src={item.imageUrl || `/attached_assets/filosofi/${item.key}.png`}
							alt={item.title}
							className="w-full h-full object-contain"
							onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
						/>
					</div>
					{item.key && (
						<Input
							type="file"
							accept="image/*"
							className="mt-2 text-xs"
							onChange={(ev) => {
								const f = ev.target.files?.[0];
								if (f) onUpload(item.key, f);
								ev.target.value = '';
							}}
						/>
					)}
				</div>
				<div className="flex-1 min-w-0 space-y-2">
					<Label className="text-xs">Key (unik, untuk upload gambar)</Label>
					<Input
						value={item.key}
						onChange={(e) => onUpdate(idx, 'key', e.target.value)}
						placeholder="contoh: Lingkaran"
					/>
					<Label className="text-xs">Judul</Label>
					<Input
						value={item.title}
						onChange={(e) => onUpdate(idx, 'title', e.target.value)}
					/>
					<Label className="text-xs">Deskripsi</Label>
					<Textarea
						value={item.description}
						onChange={(e) => onUpdate(idx, 'description', e.target.value)}
						rows={3}
						className="resize-none"
					/>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => onRequestDelete(idx)}
					className="flex-shrink-0 text-destructive hover:text-destructive mt-1"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Logo Komunitas Section (tenant only)
// ---------------------------------------------------------------------------
function LogoKomunitasSection({ settings, canEdit }: { settings: Settings | undefined; canEdit: boolean }) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	const currentLogo = (settings as any)?.logoUrl || '';

	const handleUpload = async (file: File) => {
		if (!file) return;
		setUploading(true);
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('category', 'organization');
			if (currentLogo) formData.append('oldFileUrl', currentLogo);
			const uploadRes = await fetch('/api/upload', {
				method: 'POST',
				body: formData,
				credentials: 'include',
			});
			if (!uploadRes.ok) throw new Error('Upload gagal');
			const { url } = await uploadRes.json();
			await apiRequest('PUT', '/api/settings', { logoUrl: url });
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			toast({ title: 'Berhasil', description: 'Logo komunitas berhasil diperbarui' });
		} catch {
			toast({ title: 'Error', description: 'Gagal mengupload logo', variant: 'destructive' });
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = '';
		}
	};

	const handleRemove = async () => {
		setUploading(true);
		try {
			await apiRequest('PUT', '/api/settings', { logoUrl: '' });
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			toast({ title: 'Berhasil', description: 'Logo komunitas dihapus' });
		} catch {
			toast({ title: 'Error', description: 'Gagal menghapus logo', variant: 'destructive' });
		} finally {
			setUploading(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Logo Komunitas</CardTitle>
				<CardDescription>Upload atau ganti logo komunitas kamu. Logo akan ditampilkan di navbar dan halaman publik.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{currentLogo ? (
					<div className="flex items-start gap-6">
						<div className="border rounded-lg p-3 bg-muted/30">
							<img src={currentLogo} alt="Logo Komunitas" className="h-24 w-24 object-contain" />
						</div>
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">Logo saat ini</p>
							<p className="text-xs font-mono text-muted-foreground break-all">{currentLogo}</p>
						</div>
					</div>
				) : (
					<div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
						<ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
						<p className="text-sm">Belum ada logo. Upload logo komunitas kamu.</p>
					</div>
				)}
				{canEdit && (
					<div className="flex items-center gap-3">
						<input
							ref={fileRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }}
						/>
						<Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
							{uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
							{currentLogo ? 'Ganti Logo' : 'Upload Logo'}
						</Button>
						{currentLogo && (
							<Button size="sm" variant="outline" className="text-destructive" disabled={uploading} onClick={handleRemove}>
								<Trash2 className="h-4 w-4 mr-2" />
								Hapus Logo
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DashboardProfil() {
	const { hasSpecificPermission } = useAuth();
	const canEdit = hasSpecificPermission('profil.edit');
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { isTenant, basePath } = useTenant();
	const [selectedTab, setSelectedTab] = useState('tentang-kami');
	const [isEditing, setIsEditing] = useState(false);
	const [isHeroEditing, setIsHeroEditing] = useState(false);

	// Delete confirmation state
	const [deleteDialog, setDeleteDialog] = useState<{
		open: boolean;
		type: 'sejarah' | 'filosofi';
		idx: number;
		label: string;
	}>({ open: false, type: 'sejarah', idx: -1, label: '' });

	usePermissionRefresh();

	const { hasPermission: hasAccess, isLoading: isPermissionLoading } =
		usePermissionGuardAny(['profil.view', 'profil.edit']);

	const { data: settings, isPending } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		refetchOnWindowFocus: false,
	});

	const [aboutUs, setAboutUs] = useState('');
	const [aboutVideoUrl, setAboutVideoUrl] = useState('');
	const [aboutVideoGdriveUrl, setAboutVideoGdriveUrl] = useState('');
	const [aboutPageTrackRecord, setAboutPageTrackRecord] = useState<AboutPageTrackRecordItem[]>([]);
	const [aboutPageLambang, setAboutPageLambang] = useState<AboutPageLambangItem[]>([]);
	const [initialized, setInitialized] = useState(false);

	if (settings && !initialized) {
		setAboutUs(settings.aboutUs || '');
		setAboutVideoUrl(settings.aboutVideoUrl || '');
		setAboutVideoGdriveUrl(settings.aboutVideoGdriveUrl || '');
		setAboutPageTrackRecord(
			ensureTrackRecordIds(
				settings.aboutPageTrackRecord?.length ? settings.aboutPageTrackRecord : defaultTrackRecord,
			),
		);
		setAboutPageLambang(settings.aboutPageLambang?.length ? settings.aboutPageLambang : defaultLambang);
		setInitialized(true);
	}

	// DnD sensors
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const updateMutation = useMutation({
		mutationFn: async (updatedSettings: Partial<Settings>) => {
			return await apiRequest('PUT', '/api/settings', updatedSettings);
		},
		onSuccess: async () => {
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			try {
				if (selectedTab === 'tentang-kami') {
					await logActivity(ActivityTemplates.contentUpdated('Tentang Kami'));
				} else if (selectedTab === 'sejarah') {
					await logActivity(ActivityTemplates.contentUpdated('Sejarah'));
				} else if (selectedTab === 'filosofi') {
					await logActivity(ActivityTemplates.contentUpdated('Filosofi'));
				}
			} catch (e) {
				console.warn('Failed to log activity:', e);
			}
			toast({ title: 'Berhasil disimpan', description: 'Perubahan telah disimpan.' });
			setIsEditing(false);
		},
		onError: () => {
			toast({ title: 'Gagal menyimpan', description: 'Terjadi kesalahan.', variant: 'destructive' });
		},
	});

	const handleSave = () => {
		// Validate filosofi keys before saving
		if (selectedTab === 'filosofi') {
			const keys = aboutPageLambang.map((i) => i.key.trim());
			if (keys.some((k) => !k)) {
				toast({ title: 'Validasi gagal', description: 'Semua item filosofi harus memiliki Key.', variant: 'destructive' });
				return;
			}
			const uniqueKeys = new Set(keys);
			if (uniqueKeys.size !== keys.length) {
				toast({ title: 'Validasi gagal', description: 'Key filosofi harus unik (tidak boleh duplikat).', variant: 'destructive' });
				return;
			}
		}

		updateMutation.mutate({
			...settings,
			aboutUs,
			aboutVideoUrl: aboutVideoUrl.trim(),
			aboutVideoGdriveUrl: aboutVideoGdriveUrl.trim(),
			aboutPageTrackRecord,
			aboutPageLambang,
		});
	};

	const handleFilosofiUpload = async (key: string, file: File) => {
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('key', key);
			const response = await fetch('/api/upload/filosofi', {
				method: 'POST',
				body: formData,
				credentials: 'include',
			});
			if (response.ok) {
				const data = await response.json();
				setAboutPageLambang((prev) =>
					prev.map((item) => item.key === key ? { ...item, imageUrl: data.url } : item)
				);
				toast({ title: 'Berhasil', description: `Gambar ${key} berhasil diupload` });
			} else {
				throw new Error('Upload failed');
			}
		} catch {
			toast({ title: 'Error', description: 'Gagal mengupload gambar.', variant: 'destructive' });
		}
	};

	const updateTrackRecordRow = (idx: number, field: keyof AboutPageTrackRecordItem, value: string | string[]) => {
		setAboutPageTrackRecord((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
	};

	const updateLambangItem = (idx: number, field: keyof AboutPageLambangItem, value: string) => {
		setAboutPageLambang((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
	};

	// --- DnD handlers ---
	const handleSejarahDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setAboutPageTrackRecord((prev) => {
			const oldIdx = prev.findIndex((r) => r.id === active.id);
			const newIdx = prev.findIndex((r) => r.id === over.id);
			return arrayMove(prev, oldIdx, newIdx);
		});
	};

	const handleFilosofiDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setAboutPageLambang((prev) => {
			const oldIdx = prev.findIndex((r) => r.key === active.id);
			const newIdx = prev.findIndex((r) => r.key === over.id);
			return arrayMove(prev, oldIdx, newIdx);
		});
	};

	// --- Delete confirmation ---
	const requestDeleteSejarah = (idx: number) => {
		const row = aboutPageTrackRecord[idx];
		setDeleteDialog({
			open: true,
			type: 'sejarah',
			idx,
			label: row ? `${row.year} — ${row.chairpersonName}` : `Baris #${idx + 1}`,
		});
	};

	const requestDeleteFilosofi = (idx: number) => {
		const item = aboutPageLambang[idx];
		setDeleteDialog({
			open: true,
			type: 'filosofi',
			idx,
			label: item ? (item.title || item.key || `Item #${idx + 1}`) : `Item #${idx + 1}`,
		});
	};

	const confirmDelete = () => {
		if (deleteDialog.type === 'sejarah') {
			setAboutPageTrackRecord((prev) => prev.filter((_, i) => i !== deleteDialog.idx));
		} else {
			setAboutPageLambang((prev) => prev.filter((_, i) => i !== deleteDialog.idx));
		}
		setDeleteDialog((d) => ({ ...d, open: false }));
	};

	const profilPageDataForSpyro = useMemo(() => {
		if (isPermissionLoading) {
			return buildSimpleSpyroPageData(
				'profil',
				'profil.permissions_loading',
				'Memuat izin halaman Profil.',
			);
		}
		const loadHint = isPending ? ' Memuat konten dari server.' : '';
		const editHint =
			isEditing || isHeroEditing ? ' Mode sunting konten aktif.' : '';
		return buildSimpleSpyroPageData(
			'profil',
			'profil.main',
			`${isTenant ? 'Profil komunitas' : 'Profil himpunan'} — mengelola konten halaman publik (tab aktif).${loadHint}${editHint}`,
			{ tab: selectedTab },
		);
	}, [
		isPermissionLoading,
		isPending,
		selectedTab,
		isEditing,
		isHeroEditing,
		isTenant,
	]);

	if (isPermissionLoading) {
		return (
			<DashboardLayout title="Dashboard Profil" pageContextExtra={{ pageData: profilPageDataForSpyro }}>
				<div className="flex items-center justify-center h-64">
					<Loader2 className="h-6 w-6 animate-spin" />
					<span className="ml-2">Memuat...</span>
				</div>
			</DashboardLayout>
		);
	}

	if (!hasAccess) return null;

	return (
		<DashboardLayout title="Dashboard Profil" pageContextExtra={{ pageData: profilPageDataForSpyro }}>
			<div className="space-y-6">
				<div className="flex justify-between items-center">
					<div>
						<h2 className="text-2xl font-bold">{isTenant ? 'Profil Komunitas' : 'Profil Himpunan'}</h2>
						<p className="text-muted-foreground text-sm mt-1">
							Kelola konten halaman{' '}
							<a href={isTenant ? `${basePath}/profil` : '/profil'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
								{isTenant ? `${basePath}/profil` : '/profil'} <ExternalLink className="h-3 w-3" />
							</a>
						</p>
					</div>
				<div className="flex gap-2">
					{selectedTab !== 'hero-warna' && selectedTab !== 'logo' && (
						isEditing ? (
							<>
								<Button variant="outline" onClick={() => setIsEditing(false)} size="sm">
									<ArrowLeft className="mr-2 h-4 w-4" />
									Batal
								</Button>
								<Button onClick={handleSave} size="sm" disabled={updateMutation.isPending}>
									{updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
									Simpan
								</Button>
							</>
						) : canEdit ? (
							<Button onClick={() => setIsEditing(true)} size="sm">
								<FileEdit className="mr-2 h-4 w-4" />
								Edit Konten
							</Button>
						) : null
					)}
				</div>
				</div>

				<DashboardHintCard
					title="Cara memakai Profil"
					variant="blue"
					storageKey="dashboard-profil"
					description="Halaman profil publik disusun dari beberapa tab (Tentang Kami, Sejarah, Hero, Logo, dll.). Setiap perubahan teks/gambar/urutan harus disimpan agar tersimpan di server.">
					<ul className="list-disc list-inside space-y-1.5 text-sm">
						<li>
							<strong>Langkah</strong>: pilih tab → <strong>Edit Konten</strong> (jika ada) → sunting rich text atau unggah gambar → <strong>Simpan</strong> di bagian tersebut sebelum pindah tab jika diminta.
						</li>
						<li>
							<strong>Contoh valid</strong>: paragraf HTML dari editor; gambar JPG/PNG/WebP di bawah batas unggah; blok diurutkan drag-and-drop lalu disimpan.
						</li>
						<li>
							<strong>Contoh tidak valid</strong>: menyimpan saat unggah masih berjalan; file melebihi batas atau format ditolak server; mengedit tanpa izin <code className="text-xs bg-muted px-1 rounded">profil.edit</code> (tombol tidak ada).
						</li>
						<li>
							<strong>Jika gagal</strong>: tunggu indikator upload selesai; perkecil gambar; baca pesan error di toast.
						</li>
						<li>
							<strong>Pratinjau</strong>: gunakan tautan pratinjau di header halaman ini untuk melihat tampilan publik.
						</li>
						<li>
							<strong>Izin</strong>: butuh izin edit profil untuk mengubah konten; pengunjung hanya melihat versi yang sudah tersimpan.
						</li>
					</ul>
				</DashboardHintCard>

				{isPending ? (
					<div className="text-center p-8 text-muted-foreground">Memuat data...</div>
				) : (
				<Tabs value={selectedTab} onValueChange={(v) => { setSelectedTab(v); setIsEditing(false); setIsHeroEditing(false); }}>
					<TabsList>
						<TabsTrigger value="tentang-kami">Tentang Kami</TabsTrigger>
						<TabsTrigger value="sejarah">Sejarah</TabsTrigger>
						<TabsTrigger value="filosofi">Filosofi</TabsTrigger>
						{isTenant && <TabsTrigger value="logo">Logo Komunitas</TabsTrigger>}
						{!isTenant && <TabsTrigger value="hero-warna">Hero &amp; Warna</TabsTrigger>}
					</TabsList>

						{/* Tab Tentang Kami */}
						<TabsContent value="tentang-kami" className="space-y-4 mt-4">
							<DashboardHintCard
								title="Panduan tab: Tentang Kami"
								variant="blue"
								storageKey="dashboard-profil-tab-tentang-kami"
								description="Mengisi teks profil himpunan mahasiswa Teknik Informatika UIN Malang, plus video embed YouTube (prioritas) dan fallback Google Drive jika perlu.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Langkah</strong>: klik <strong>Edit Konten</strong> → tempel URL video YouTube resmi himpunan (opsional) → isi fallback Drive jika embed YouTube sering gagal di perangkat pengunjung → tulis narasi di editor rich text → <strong>Simpan</strong>.
									</li>
									<li>
										<strong>Contoh valid</strong>: YouTube <code className="text-xs bg-muted px-1 rounded">https://www.youtube.com/watch?v=...</code> atau short link; teks menjelaskan visi HMPS TI UIN Malang secara ringkas dengan paragraf rapi.
									</li>
									<li>
										<strong>Contoh tidak valid</strong>: URL bukan tautan video (mis. halaman beranda saja); Drive tanpa izin akses &quot;siapa pun yang punya link&quot;; menyimpan saat unggah masih berjalan.
									</li>
									<li>
										<strong>Jika video tidak tampil</strong>: cek link di jendela incognito; aktifkan fallback Drive; pastikan tidak ada typo pada URL.
									</li>
									<li>
										<strong>Izin</strong>: butuh <code className="text-xs bg-muted px-1 rounded">profil.edit</code> untuk mengubah konten tab ini.
									</li>
								</ul>
							</DashboardHintCard>
							<Card>
								<CardHeader>
									<CardTitle>Tentang Kami</CardTitle>
									<CardDescription>
										Konten ini ditampilkan di bagian "Tentang Kami" pada halaman /profil dan beranda.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{isEditing && (
										<div className="space-y-2">
											<Label htmlFor="about-video-url">Link video profil (YouTube)</Label>
											<Input
												id="about-video-url"
												type="url"
												placeholder="https://www.youtube.com/watch?v=..."
												value={aboutVideoUrl}
												onChange={(e) => setAboutVideoUrl(e.target.value)}
											/>
											<p className="text-xs text-muted-foreground">
												Ditampilkan sebagai embed di beranda dan halaman profil, di atas teks Tentang Kami. Kosongkan untuk menyembunyikan.
											</p>
											<Label htmlFor="about-video-gdrive-url" className="pt-1 block">
												Link video profil (Google Drive - fallback)
											</Label>
											<Input
												id="about-video-gdrive-url"
												type="url"
												placeholder="https://drive.google.com/file/d/.../view"
												value={aboutVideoGdriveUrl}
												onChange={(e) => setAboutVideoGdriveUrl(e.target.value)}
											/>
											<p className="text-xs text-muted-foreground">
												Digunakan otomatis saat YouTube gagal dimuat di sisi client. Jika dua-duanya ada, YouTube tetap prioritas.
											</p>
										</div>
									)}
									{!isEditing && settings?.aboutVideoUrl?.trim() && (
										<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
											<span className="text-muted-foreground">Video profil: </span>
											<span className="font-mono text-xs break-all">{settings.aboutVideoUrl.trim()}</span>
										</div>
									)}
									{!isEditing && settings?.aboutVideoGdriveUrl?.trim() && (
										<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
											<span className="text-muted-foreground">Fallback Google Drive: </span>
											<span className="font-mono text-xs break-all">{settings.aboutVideoGdriveUrl.trim()}</span>
										</div>
									)}
									{isEditing ? (
										<RichTextEditor
											value={aboutUs}
											onChange={setAboutUs}
											placeholder="Tulis konten tentang kami di sini..."
											height={400}
											beritaId="about-us-content"
										/>
									) : settings?.aboutUs ? (
										<div className="prose max-w-none border rounded-md p-4 bg-muted/30">
											<div dangerouslySetInnerHTML={{ __html: settings.aboutUs }} />
										</div>
									) : (
										<p className="text-muted-foreground italic">Belum ada konten.</p>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						{/* Tab Sejarah */}
						<TabsContent value="sejarah" className="space-y-4 mt-4">
							<DashboardHintCard
								title="Panduan tab: Sejarah"
								variant="blue"
								storageKey="dashboard-profil-tab-sejarah"
								description="Track record ketua himpunan dan susunan divisi per periode kepengurusan. Data tampil sebagai tabel di halaman profil publik.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Langkah</strong>: <strong>Edit Konten</strong> → isi kolom tahun, nama ketua, dan daftar divisi (pisahkan dengan koma jika satu baris) → seret handle untuk mengurutkan tahun → tambah baris lewat <strong>Tambah Baris</strong> jika perlu → <strong>Simpan</strong>.
									</li>
									<li>
										<strong>Contoh valid</strong>: tahun <code className="text-xs bg-muted px-1 rounded">2025</code>; ketua <code className="text-xs bg-muted px-1 rounded">Nama Lengkap</code>; divisi mis. <code className="text-xs bg-muted px-1 rounded">Public Relation, Multimedia, Intelektual</code> untuk kepengurusan HMPS TI UIN Malang.
									</li>
									<li>
										<strong>Contoh tidak valid</strong>: tahun kosong atau tidak konsisten; nama ketua kosong; urutan tahun tidak sinkron dengan fakta organisasi.
									</li>
									<li>
										<strong>Jika tabel berantakan</strong>: edit ulang per baris; gunakan drag untuk menyelaraskan urutan kronologis.
									</li>
									<li>
										<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">profil.edit</code>.
									</li>
								</ul>
							</DashboardHintCard>
							<Card>
								<CardHeader>
									<CardTitle>Sejarah — Track Record Ketua & Divisi</CardTitle>
									<CardDescription>
										Daftar rekam jejak ketua himpunan dan divisi per tahun. Seret handle untuk mengubah urutan.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{isEditing ? (
										<div className="space-y-3">
											<DndContext
												sensors={sensors}
												collisionDetection={closestCenter}
												onDragEnd={handleSejarahDragEnd}
											>
												<SortableContext
													items={aboutPageTrackRecord.map((r) => r.id!)}
													strategy={verticalListSortingStrategy}
												>
													{aboutPageTrackRecord.map((row, idx) => (
														<SortableTrackRecordRow
															key={row.id}
															row={row}
															idx={idx}
															onUpdate={updateTrackRecordRow}
															onRequestDelete={requestDeleteSejarah}
														/>
													))}
												</SortableContext>
											</DndContext>
											<Button
												variant="outline"
												size="sm"
												onClick={() => setAboutPageTrackRecord((prev) => [...prev, { id: genId(), year: '', chairpersonName: '', divisions: [] }])}
											>
												<Plus className="h-4 w-4 mr-2" />
												Tambah Baris
											</Button>
										</div>
									) : settings?.aboutPageTrackRecord?.length ? (
										<div className="overflow-x-auto border rounded-md">
											<table className="w-full text-sm">
												<thead>
													<tr className="border-b bg-muted/50">
														<th className="text-left p-2">Tahun</th>
														<th className="text-left p-2">Ketua</th>
														<th className="text-left p-2">Divisi</th>
													</tr>
												</thead>
												<tbody>
													{settings.aboutPageTrackRecord.map((r, i) => (
														<tr key={i} className="border-b">
															<td className="p-2">{r.year}</td>
															<td className="p-2">{r.chairpersonName}</td>
															<td className="p-2 text-muted-foreground">{r.divisions?.join(', ')}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									) : (
										<p className="text-muted-foreground italic">Belum ada data. Klik Edit untuk mengisi.</p>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						{/* Tab Filosofi */}
						<TabsContent value="filosofi" className="space-y-4 mt-4">
							<DashboardHintCard
								title="Panduan tab: Filosofi Lambang"
								variant="blue"
								storageKey="dashboard-profil-tab-filosofi"
								description="Setiap elemen lambang HMPS TI UIN Malang punya judul, deskripsi makna, dan gambar ikon. Urutan kartu mengikuti drag-and-drop saat mode edit.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Langkah</strong>: <strong>Edit Konten</strong> → edit judul/deskripsi tiap kartu → unggah gambar ikon (PNG transparan disarankan) → urutkan dengan drag → tambah item lewat <strong>Tambah Filosofi</strong> jika ada elemen baru → <strong>Simpan</strong>.
									</li>
									<li>
										<strong>Contoh valid</strong>: judul singkat seperti <code className="text-xs bg-muted px-1 rounded">Bidikan</code>; deskripsi 2–4 kalimat tentang makna bagi mahasiswa TI UIN Malang; gambar persegi dengan latar transparan.
									</li>
									<li>
										<strong>Contoh tidak valid</strong>: gambar sangat besar sehingga lambat dimuat; deskripsi kosong; menghapus kartu tanpa sengaja sebelum simpan (gunakan konfirmasi hapus).
									</li>
									<li>
										<strong>Jika gambar tidak muncul</strong>: periksa path/URL; unggah ulang dengan format JPG/PNG/WebP yang didukung browser.
									</li>
									<li>
										<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">profil.edit</code>.
									</li>
								</ul>
							</DashboardHintCard>
							<Card>
								<CardHeader>
									<CardTitle>Filosofi Lambang</CardTitle>
									<CardDescription>
										Makna dan filosofi dari setiap elemen lambang himpunan. Seret handle untuk mengubah urutan.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{isEditing ? (
										<div className="space-y-4">
											<DndContext
												sensors={sensors}
												collisionDetection={closestCenter}
												onDragEnd={handleFilosofiDragEnd}
											>
												<SortableContext
													items={aboutPageLambang.map((i) => i.key)}
													strategy={verticalListSortingStrategy}
												>
													{aboutPageLambang.map((item, idx) => (
														<SortableLambangCard
															key={item.key || idx}
															item={item}
															idx={idx}
															onUpdate={updateLambangItem}
															onUpload={handleFilosofiUpload}
															onRequestDelete={requestDeleteFilosofi}
														/>
													))}
												</SortableContext>
											</DndContext>
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													setAboutPageLambang((prev) => [
														...prev,
														{ key: `new_${Date.now()}`, title: '', description: '', imageUrl: '' },
													])
												}
											>
												<Plus className="h-4 w-4 mr-2" />
												Tambah Filosofi
											</Button>
										</div>
									) : settings?.aboutPageLambang?.length ? (
										<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
											{settings.aboutPageLambang.map((item, i) => (
												<div key={i} className="border rounded-md p-3">
													<img
														src={item.imageUrl || `/attached_assets/filosofi/${item.key}.png`}
														alt={item.title}
														className="w-16 h-16 object-contain mx-auto mb-2"
														onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
													/>
													<p className="font-medium text-sm">{item.title}</p>
													<p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
												</div>
											))}
										</div>
									) : (
										<p className="text-muted-foreground italic">Belum ada data. Klik Edit untuk mengisi.</p>
									)}
								</CardContent>
							</Card>
						</TabsContent>
						{/* Tab Logo Komunitas (tenant only) */}
						<TabsContent value="logo" className="space-y-4 mt-4">
							<DashboardHintCard
								title="Panduan tab: Logo Komunitas"
								variant="purple"
								storageKey="dashboard-profil-tab-logo"
								description="Logo khusus komunitas (tenant) untuk navbar dan halaman publik. Terpisah dari logo utama kampus; unggah file gambar melalui API pengaturan.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Langkah</strong>: siapkan file PNG/SVG raster (via ekspor) atau JPG dengan latar transparan jika perlu → klik unggah → tunggu selesai → cek pratinjau di navbar komunitas.
									</li>
									<li>
										<strong>Contoh valid</strong>: logo komunitas studi/prodi di UIN Malang dengan rasio mendekati persegi, ukuran wajar (&lt; beberapa MB), kontras baik di mode terang/gelap.
									</li>
									<li>
										<strong>Contoh tidak valid</strong>: file bukan gambar; ukuran sangat besar; menghapus logo tanpa mengganti jika komunitas masih butuh identitas visual.
									</li>
									<li>
										<strong>Jika gagal</strong>: coba format lain; periksa toast error dari server upload.
									</li>
									<li>
										<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">profil.edit</code> dan akses pengaturan logo komunitas.
									</li>
								</ul>
							</DashboardHintCard>
							<LogoKomunitasSection settings={settings} canEdit={canEdit} />
						</TabsContent>
						{/* Tab Hero & Warna Divisi */}
						<TabsContent value="hero-warna" className="space-y-4 mt-4">
							<DashboardHintCard
								title="Panduan tab: Hero & Warna"
								variant="green"
								storageKey="dashboard-profil-tab-hero-warna"
								description="Mengatur foto ketua, logo himpunan, kepala divisi, dan warna divisi pada hero beranda untuk representasi visual HMPS TI UIN Malang. Editor terbuka lewat tombol khusus di kartu.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Langkah</strong>: klik <strong>Edit Hero &amp; Warna</strong> → ikuti form di editor (unggah gambar, pilih warna divisi) → simpan dari dalam editor → verifikasi di beranda publik.
									</li>
									<li>
										<strong>Contoh valid</strong>: foto resmi pengurus; warna divisi konsisten dengan pedoman himpunan; logo himpunan tidak terpotong di crop.
									</li>
									<li>
										<strong>Contoh tidak valid</strong>: menyimpan saat upload belum selesai; warna kontras rendah sehingga teks tidak terbaca di hero.
									</li>
									<li>
										<strong>Jika tampilan beranda tidak berubah</strong>: hard refresh; pastikan simpan sukses; cek cache CDN jika ada.
									</li>
									<li>
										<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">profil.edit</code> untuk membuka editor hero.
									</li>
								</ul>
							</DashboardHintCard>
							{isHeroEditing ? (
								<ContentEditor
									settings={settings as any}
									onSave={() => setIsHeroEditing(false)}
									onCancel={() => setIsHeroEditing(false)}
								/>
							) : (
								<Card>
									<CardHeader>
										<CardTitle>Hero Section &amp; Warna Divisi</CardTitle>
										<CardDescription>
											Kelola foto ketua, logo himpunan, kepala divisi, dan warna divisi di hero section beranda.
										</CardDescription>
									</CardHeader>
									<CardContent>
										<p className="text-sm text-muted-foreground mb-4">
											Klik tombol Edit untuk mengelola konten Hero Section dan Warna Divisi.
										</p>
										{canEdit && (
											<Button onClick={() => setIsHeroEditing(true)} size="sm">
												<FileEdit className="mr-2 h-4 w-4" />
												Edit Hero &amp; Warna
											</Button>
										)}
									</CardContent>
								</Card>
							)}
						</TabsContent>
					</Tabs>
				)}
			</div>

			{/* Delete confirmation dialog */}
			<AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
						<AlertDialogDescription>
							Apakah kamu yakin ingin menghapus{' '}
							<strong>{deleteDialog.label}</strong>? Perubahan ini akan tersimpan setelah kamu klik Simpan.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Batal</AlertDialogCancel>
						<AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
							Hapus
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</DashboardLayout>
	);
}
