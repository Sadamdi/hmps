import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import RichTextEditor from '@/components/dashboard/rich-text-editor';
import { ContentEnhanceButton } from '@/components/dashboard/content-enhance-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	AlertCircle,
	BookOpen,
	CalendarDays,
	CheckCircle2,
	ChevronDown,
	ExternalLink,
	FlaskConical,
	GraduationCap,
	ImageIcon,
	Link2,
	Loader2,
	Pencil,
	Plus,
	RefreshCw,
	Save,
	ShieldCheck,
	Trash2,
	Users,
} from 'lucide-react';
import { buildSimpleSpyroPageData } from '@shared/dashboard-spyro-context';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

export default function DashboardProdi() {
	usePermissionGuardAny(['prodi.view', 'prodi.edit', 'prodi.sync']);
	const { hasSpecificPermission } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const canEdit = hasSpecificPermission('prodi.edit');
	const canSync = hasSpecificPermission('prodi.sync');

	const { data: doc, isLoading } = useQuery<any>({
		queryKey: ['/api/prodi/manage'],
	});

	const [autoSync, setAutoSync] = useState(true);
	const [announcementIntervalDays, setAnnouncementIntervalDays] = useState(1);
	const [localContent, setLocalContent] = useState<any>(null);
	const [dirty, setDirty] = useState(false);
	const [selectedCurriculumYear, setSelectedCurriculumYear] = useState<number | null>(null);

	useEffect(() => {
		if (doc) {
			setAutoSync(doc.autoSyncEnabled ?? true);
			setAnnouncementIntervalDays(doc.announcementSyncIntervalDays ?? 1);
			setLocalContent(doc.content ? JSON.parse(JSON.stringify(doc.content)) : {});
		}
	}, [doc]);

	const saveMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await apiRequest('PUT', '/api/prodi/manage', payload);
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/prodi/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/prodi'] });
			setDirty(false);
			toast({ title: 'Berhasil', description: 'Konten prodi berhasil disimpan' });
		},
		onError: () => {
			toast({ title: 'Error', description: 'Gagal menyimpan konten', variant: 'destructive' });
		},
	});

	const [pendingSyncScope, setPendingSyncScope] = useState<string | null>(null);
	const [confirmOverwrite, setConfirmOverwrite] = useState<{ years: number[]; scope: string } | null>(null);
	const [calendarUploadYear, setCalendarUploadYear] = useState('2026');
	const calendarFileRef = useRef<HTMLInputElement>(null);

	const calendarUploadMutation = useMutation({
		mutationFn: async (params: { yearStart: number; file: File }) => {
			const formData = new FormData();
			formData.append('yearStart', String(params.yearStart));
			formData.append('yearEnd', String(params.yearStart + 1));
			formData.append('file', params.file);
			const res = await apiRequest('POST', '/api/prodi/calendar/upload', formData);
			return res.json();
		},
		onSuccess: (data: any) => {
			toast({
				title: 'PDF kalender terunggah',
				description: data?.pdfUrl
					? `Tersimpan di ${data.pdfUrl}`
					: 'File tersimpan di server production.',
			});
			queryClient.invalidateQueries({ queryKey: ['/api/prodi/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/prodi'] });
			if (calendarFileRef.current) calendarFileRef.current.value = '';
		},
		onError: (err: any) => {
			toast({
				title: 'Upload gagal',
				description: err?.message || 'Gagal mengunggah PDF kalender',
				variant: 'destructive',
			});
		},
	});

	const syncMutation = useMutation({
		mutationFn: async (params: { scope: string; overwrite?: boolean }) => {
			const res = await apiRequest('POST', '/api/prodi/sync/run', {
				scope: params.scope,
				overwrite: params.overwrite ?? false,
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(body.message || body.summary?.error || 'Sinkronisasi gagal');
			}
			return body;
		},
		onSuccess: (data: any) => {
			if (data.needsConfirm) {
				const years: number[] = data.curriculumNeedsConfirmYears
					?? (data.curriculumTargetYear ? [data.curriculumTargetYear] : []);
				setConfirmOverwrite({ years, scope: 'curriculum' });
				toast({ title: 'Konfirmasi', description: data.message });
				return;
			}
			const s = data.summary;
			const calPart =
				s?.calendarYears?.length != null
					? ` Kalender: ${s.calendarYears.length} tahun, pengumuman ${s.announcementCount ?? 0}, template PKL ${s.pklTemplates ?? 0}.`
					: '';
			const desc = s
				? `Sejarah ~${s.profileHistoryLen ?? 0} karakter, dosen ${s.lecturerLinks ?? 0}, semester ${s.semestersCount ?? 0}, MK pilihan ${s.optionalSubjectsCount ?? 0}, lab ${(s.teachingLabs ?? 0) + (s.researchLabs ?? 0)}.${calPart}`
				: (data.message ?? 'Selesai');
			toast({ title: data.message || 'Sinkronisasi selesai', description: desc });
			queryClient.invalidateQueries({ queryKey: ['/api/prodi/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/prodi'] });
		},
		onError: (err: any) => {
			toast({ title: 'Error', description: err?.message || 'Gagal menjalankan sinkronisasi', variant: 'destructive' });
		},
	});

	const handleSyncConfirmed = useCallback((scope: string) => {
		setPendingSyncScope(null);
		const targetYear = doc?.targetSyncYear ?? doc?.activeAcademicYear;
		const touchesCurriculum = scope === 'all' || scope === 'curriculum';
		const yearExists = touchesCurriculum && targetYear && (doc?.curriculumYears ?? []).includes(targetYear);
		if (yearExists) {
			setConfirmOverwrite({ years: [targetYear], scope });
		} else {
			syncMutation.mutate({ scope });
		}
	}, [doc, syncMutation]);

	const handleSave = useCallback(() => {
		if (!canEdit) return;
		const payload: any = {
			autoSyncEnabled: autoSync,
			announcementSyncIntervalDays: announcementIntervalDays,
		};
		if (localContent) payload.content = localContent;
		const activeYear = doc?.activeAcademicYear ?? new Date().getFullYear();
		const years: number[] = doc?.curriculumYears ?? [];
		const curYear = selectedCurriculumYear ?? (years.includes(activeYear) ? activeYear : years[0]);
		if (curYear && payload.content?.curriculum) {
			payload.curriculumYear = curYear;
		}
		saveMutation.mutate(payload);
	}, [canEdit, autoSync, announcementIntervalDays, localContent, saveMutation, selectedCurriculumYear, doc]);

	const handleToggleAutoSync = useCallback((checked: boolean) => {
		setAutoSync(checked);
		setDirty(true);
	}, []);

	const updateField = useCallback((section: string, field: string, value: any) => {
		setLocalContent((prev: any) => {
			const next = { ...prev };
			if (!next[section]) next[section] = {};
			next[section] = { ...next[section], [field]: value };
			return next;
		});
		setDirty(true);
	}, []);

	const prodiPageDataForSpyro = useMemo(() => {
		if (isLoading || !localContent) {
			return buildSimpleSpyroPageData(
				'prodi',
				'prodi.permissions_loading',
				'Memuat konten Program Studi dari server.',
			);
		}
		return buildSimpleSpyroPageData(
			'prodi',
			'prodi.main',
			'Kelola konten Prodi S1 Teknik Informatika: sync dari sumber, profil, dosen, kurikulum, laboratorium.',
		);
	}, [isLoading, localContent]);

	if (isLoading || !localContent) {
		return (
			<DashboardLayout title="Prodi" pageContextExtra={{ pageData: prodiPageDataForSpyro }}>
				<div className="flex justify-center py-24">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			</DashboardLayout>
		);
	}

	const syncStatus = doc?.syncStatus;
	const lastAutoSync = doc?.lastAutoSyncAt ? new Date(doc.lastAutoSyncAt).toLocaleString('id-ID') : '—';
	const lastManualSync = doc?.lastManualSyncAt ? new Date(doc.lastManualSyncAt).toLocaleString('id-ID') : '—';

	return (
		<DashboardLayout title="Prodi" pageContextExtra={{ pageData: prodiPageDataForSpyro }}>
			<div className="space-y-6">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold tracking-tight">Prodi S1 Teknik Informatika</h1>
						<p className="text-muted-foreground text-sm mt-1">
							Kelola konten halaman program studi
						</p>
					</div>
					<div className="flex items-center gap-3">
						{canSync && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="outline"
										disabled={syncMutation.isPending || syncStatus === 'syncing'}>
										<RefreshCw className={`h-4 w-4 mr-2 ${syncStatus === 'syncing' || syncMutation.isPending ? 'animate-spin' : ''}`} />
										{syncStatus === 'syncing' || syncMutation.isPending ? 'Sedang Sync...' : 'Sync'}
										<ChevronDown className="h-4 w-4 ml-1" />
									</Button>
								</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setPendingSyncScope('all')}>
									Sync Semua
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setPendingSyncScope('profile')}>
									Sync Profil
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setPendingSyncScope('lecturers')}>
									Sync Dosen
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setPendingSyncScope('curriculum')}>
									Sync Kurikulum
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setPendingSyncScope('labs')}>
									Sync Laboratorium
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setPendingSyncScope('accreditation')}>
									Sync Akreditasi
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setPendingSyncScope('academicCalendar')}>
									Sync Kalender Akademik
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setPendingSyncScope('studentResources')}>
									Sync Portal / Skripsi / PKL / Pengumuman
								</DropdownMenuItem>
							</DropdownMenuContent>
							</DropdownMenu>
						)}
						{canEdit && (
							<Button onClick={handleSave} disabled={saveMutation.isPending || !dirty}>
								{saveMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<Save className="h-4 w-4 mr-2" />
								)}
								Simpan
							</Button>
						)}
					</div>
				</div>

				<DashboardHintCard
					title="Ringkasan: Sync & simpan halaman Prodi"
					variant="green"
					storageKey="dashboard-prodi-overview"
					description="Konten Program Studi S1 Teknik Informatika UIN Malang diisi per tab di bawah. Tombol Simpan mengirim seluruh perubahan lokal; Sync Sekarang mengambil data dari sumber resmi prodi (bisa menimpa bagian yang di-sync).">
					<ul className="list-disc list-inside space-y-1.5 text-sm">
						<li>
							<strong>Langkah umum</strong>: sunting di tab yang relevan → klik <strong>Simpan</strong> (ikon centang hijau saat ada perubahan) → setelah sync, baca toast ringkasan dan cek satu tab sebagai sampel.
						</li>
						<li>
							<strong>Jika sync gagal</strong>: baca pesan error; jangan simpan bersamaan saat status masih &quot;Sedang Sync&quot;; hubungi admin untuk URL sumber.
						</li>
						<li>
							<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">prodi.edit</code> untuk menyimpan; <code className="text-xs bg-muted px-1 rounded">prodi.sync</code> untuk Sync Sekarang; <code className="text-xs bg-muted px-1 rounded">prodi.view</code> untuk hanya melihat.
						</li>
					</ul>
				</DashboardHintCard>

				{/* Status cards */}
				<div className="grid gap-4 sm:grid-cols-3">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Mode Update</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-3">
								<Switch
									checked={autoSync}
									onCheckedChange={handleToggleAutoSync}
									disabled={!canEdit}
								/>
								<span className="text-sm text-foreground">
									{autoSync ? 'Auto Update (Bulanan)' : 'Manual Update'}
								</span>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Sync Terakhir</CardTitle>
						</CardHeader>
						<CardContent className="space-y-1">
							<p className="text-xs text-muted-foreground">Auto: {lastAutoSync}</p>
							<p className="text-xs text-muted-foreground">Manual: {lastManualSync}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium">Status</CardTitle>
						</CardHeader>
						<CardContent>
							{syncStatus === 'syncing' ? (
								<div className="flex items-center gap-2 text-sm text-amber-600">
									<RefreshCw className="h-4 w-4 animate-spin" /> Sedang sinkronisasi...
								</div>
							) : syncStatus === 'error' ? (
								<div className="flex items-center gap-2 text-sm text-destructive">
									<AlertCircle className="h-4 w-4" /> Error: {doc?.lastSyncError}
								</div>
							) : (
								<div className="flex items-center gap-2 text-sm text-green-600">
									<CheckCircle2 className="h-4 w-4" /> Idle
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Content editor tabs */}
				<Tabs defaultValue="profil" className="w-full">
					<TabsList className="flex flex-wrap w-full h-auto gap-1 justify-start">
						<TabsTrigger value="profil" className="gap-2">
							<GraduationCap className="h-4 w-4" /> Profil
						</TabsTrigger>
						<TabsTrigger value="dosen" className="gap-2">
							<Users className="h-4 w-4" /> Dosen
						</TabsTrigger>
						<TabsTrigger value="kurikulum" className="gap-2">
							<BookOpen className="h-4 w-4" /> Kurikulum
						</TabsTrigger>
						<TabsTrigger value="laboratorium" className="gap-2">
							<FlaskConical className="h-4 w-4" /> Laboratorium
						</TabsTrigger>
						<TabsTrigger value="akreditasi" className="gap-2">
							<ShieldCheck className="h-4 w-4" /> Akreditasi
						</TabsTrigger>
						<TabsTrigger value="kalender" className="gap-2">
							<CalendarDays className="h-4 w-4" /> Kalender
						</TabsTrigger>
						<TabsTrigger value="portal" className="gap-2">
							<Link2 className="h-4 w-4" /> Portal
						</TabsTrigger>
						<TabsTrigger value="skripsi" className="gap-2">
							Skripsi
						</TabsTrigger>
						<TabsTrigger value="pkl" className="gap-2">
							PKL
						</TabsTrigger>
						<TabsTrigger value="pengumuman" className="gap-2">
							Pengumuman
						</TabsTrigger>
					</TabsList>

					<TabsContent value="profil" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: Profil Prodi"
							variant="green"
							storageKey="dashboard-prodi-tab-profil"
							description="Profil program studi: visi, misi, sejarah singkat, dan informasi umum S1 Teknik Informatika UIN Maulana Malik Ibrahim Malang untuk ditampilkan di halaman publik /prodi.">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>
									<strong>Langkah</strong>: isi field teks sesuai label → gunakan rich text bila tersedia dengan heading yang jelas → <strong>Simpan</strong> di header halaman.
								</li>
								<li>
									<strong>Contoh valid</strong>: paragraf yang menyebut program studi secara eksplisit (<em>Teknik Informatika, Fakultas Sains dan Teknologi, UIN Malang</em>) tanpa menyalin teks dari universitas lain.
								</li>
								<li>
									<strong>Contoh tidak valid</strong>: HTML dari paste Word yang merusak layout; menyimpan teks placeholder kosong untuk blok wajib.
								</li>
								<li>
									<strong>Setelah sync</strong>: baca ulang tab Profil; jika ada paragraf ganda, rapikan manual lalu simpan.
								</li>
							</ul>
						</DashboardHintCard>
						<ProfileEditor
							data={localContent.profile ?? {}}
							onChange={(field, val) => updateField('profile', field, val)}
							readOnly={!canEdit}
						/>
					</TabsContent>

					<TabsContent value="dosen" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: Dosen"
							variant="green"
							storageKey="dashboard-prodi-tab-dosen"
							description="Data dosen tetap dan pengajar Program Studi Teknik Informatika UIN Malang: nama, NIP, email, URL profil resmi informatika.uin-malang.ac.id, dan foto (unggah memakai slug dari URL atau nama).">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>
									<strong>Langkah</strong>: lengkapi <strong>Profile URL</strong> (wajib untuk unggah foto) → isi NIP/email → klik area foto untuk mengunggah gambar (WebP) → ulangi untuk Ketua/Sekretaris dan daftar dosen → <strong>Simpan</strong>.
								</li>
								<li>
									<strong>Contoh valid</strong>: Profile URL <code className="text-xs bg-muted px-1 rounded">https://informatika.uin-malang.ac.id/nama-gelar</code>; email <code className="text-xs bg-muted px-1 rounded">nama@ti.uin-malang.ac.id</code>; foto persegi, wajah terang.
								</li>
								<li>
									<strong>Contoh tidak valid</strong>: Profile URL kosong lalu memaksa unggah foto; link ke domain selain halaman resmi prodi tanpa persetujuan; NIP tidak lengkap jika kebijakan internal mewajibkan.
								</li>
								<li>
									<strong>Jika unggah foto nonaktif</strong>: isi Profile URL atau nama+NIP agar sistem bisa membuat slug file.
								</li>
							</ul>
						</DashboardHintCard>
						<LecturerEditor
							data={localContent.lecturers ?? {}}
							onChange={(field, val) => updateField('lecturers', field, val)}
							readOnly={!canEdit}
						/>
					</TabsContent>

					<TabsContent value="kurikulum" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: Kurikulum"
							variant="green"
							storageKey="dashboard-prodi-tab-kurikulum"
							description="Struktur kurikulum S1 Teknik Informatika UIN Malang per semester, termasuk mata kuliah wajib/pilihan. Sinkronisasi mengisi dari sumber resmi; sunting manual untuk koreksi tampilan. Kurikulum disimpan per periode (2020, 2024, dst).">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>
									<strong>Tahun Kurikulum</strong>: pilih periode kurikulum di selector atas. Data sumber mengikuti daftar kurikulum resmi dari website TI UIN (mis. 2020, 2024, nanti 2028 jika muncul).
								</li>
								<li>
									<strong>Langkah</strong>: pilih tahun → buka sub-tab semester atau MK pilihan → pastikan kode/nama/SKS konsisten → <strong>Simpan</strong>.
								</li>
								<li>
									<strong>Setelah sync kurikulum</strong>: jika ada tahun yang sudah ada, akan muncul konfirmasi overwrite untuk tahun-tahun tersebut.
								</li>
							</ul>
						</DashboardHintCard>
						<CurriculumEditor
							data={localContent.curriculum ?? {}}
							curriculumByYear={doc?.curriculumByYear}
							curriculumYears={doc?.curriculumYears ?? []}
							curriculumYearsByLevel={doc?.curriculumYearsByLevel}
							activeAcademicYear={doc?.activeAcademicYear}
							onChange={(field, val) => updateField('curriculum', field, val)}
							onYearChange={setSelectedCurriculumYear}
							readOnly={!canEdit}
						/>
					</TabsContent>

					<TabsContent value="laboratorium" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: Laboratorium"
							variant="green"
							storageKey="dashboard-prodi-tab-laboratorium"
							description="Laboratorium pembelajaran dan penelitian Teknik Informatika UIN Malang: nama lab, perangkat, gambar, dan jadwal/overview jika ada di editor. Path gambar mengikuti konvensi unggah (labs/...).">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>
									<strong>Langkah</strong>: isi nama lab dan deskripsi singkat → unggah foto ruang/peralatan melalui slot yang tersedia → sesuaikan urutan jika editor mendukung drag → <strong>Simpan</strong>.
								</li>
								<li>
									<strong>Contoh valid</strong>: lab <code className="text-xs bg-muted px-1 rounded">Lab Pemrograman 1</code> dengan foto ruangan nyata di gedung prodi; teks menjelaskan fasilitas untuk praktikum mahasiswa TI UIN Malang.
								</li>
								<li>
									<strong>Contoh tidak valid</strong>: gambar non-foto atau terlalu berat; deskripsi kosong untuk entri yang ditampilkan di publik.
								</li>
								<li>
									<strong>Jika gambar tidak tampil</strong>: unggah ulang dengan JPG/PNG/WebP; cek toast error server.
								</li>
							</ul>
						</DashboardHintCard>
						<LaboratoryEditor
							data={localContent.laboratories ?? {}}
							onChange={(field, val) => updateField('laboratories', field, val)}
							readOnly={!canEdit}
						/>
					</TabsContent>
					<TabsContent value="akreditasi" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: Akreditasi"
							variant="green"
							storageKey="dashboard-prodi-tab-akreditasi"
							description="Sinkronisasi akreditasi akan crawl S1, S2, dan mencoba S3. Jika S3 gagal, S1/S2 tetap disimpan. URL S3 manual dipakai sebagai prioritas saat sync.">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>
									<strong>Langkah</strong>: isi URL S3 manual jika ada → klik <strong>Sync Akreditasi</strong> pada tombol Sync di atas.
								</li>
								<li>
									<strong>Fallback</strong>: jika URL S3 kosong, sistem auto-discover dari website TI UIN.
								</li>
							</ul>
						</DashboardHintCard>
						<AccreditationEditor
							data={localContent.accreditation ?? {}}
							onChange={(field, val) => updateField('accreditation', field, val)}
							readOnly={!canEdit}
						/>
					</TabsContent>

					<TabsContent value="kalender" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: Kalender Akademik"
							variant="green"
							storageKey="dashboard-prodi-tab-kalender"
							description="PDF kalender di-cache ke /uploads/prodi/calendar di server. Sync harus dijalankan di production agar file tersedia untuk unduh/pratinjau.">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>
									Klik <strong>Sync Kalender Akademik</strong> (atau Sync Semua) setelah deploy.
								</li>
								<li>
									Jika sync gagal unduh dari Odoo (mis. IP production diblok), unggah PDF manual di bawah.
								</li>
							</ul>
						</DashboardHintCard>
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Tahun tersinkron</CardTitle>
								<CardDescription>
									{(Object.keys(localContent?.studentHub?.academicCalendars || {}).length || 0)} tahun
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								{Object.entries(localContent?.studentHub?.academicCalendars || {})
									.sort(([a], [b]) => Number(b) - Number(a))
									.map(([y, c]: any) => (
										<div key={y} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
											<span>
												{c.academicYear || y} — {c.title || 'Kalender'}
											</span>
											<span className="text-xs text-muted-foreground">
												{c.pdfUrl ? 'PDF lokal' : 'hanya sumber remote'}
												{c.sourcePdfUrl ? (
													<>
														{' · '}
														<a className="text-primary" href={c.sourcePdfUrl} target="_blank" rel="noreferrer">
															sumber
														</a>
													</>
												) : null}
											</span>
										</div>
									))}
								{!Object.keys(localContent?.studentHub?.academicCalendars || {}).length && (
									<p className="text-muted-foreground">Belum ada data. Jalankan Sync Kalender.</p>
								)}
								{canSync && (
									<Button
										variant="outline"
										className="mt-2"
										onClick={() => setPendingSyncScope('academicCalendar')}>
										<RefreshCw className="h-4 w-4 mr-2" /> Sync Kalender Sekarang
									</Button>
								)}
							</CardContent>
						</Card>
						{canSync && (
							<Card>
								<CardHeader>
									<CardTitle className="text-base">Upload PDF manual</CardTitle>
									<CardDescription>
										Untuk tahun yang gagal diunduh otomatis (mis. 2026). File harus PDF valid.
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-col sm:flex-row gap-3 sm:items-end">
									<div className="space-y-1.5 w-full sm:w-32">
										<Label htmlFor="cal-year">Tahun mulai</Label>
										<Input
											id="cal-year"
											type="number"
											min={2000}
											max={2100}
											value={calendarUploadYear}
											onChange={(e) => setCalendarUploadYear(e.target.value)}
										/>
									</div>
									<div className="space-y-1.5 flex-1">
										<Label htmlFor="cal-pdf">File PDF</Label>
										<Input
											id="cal-pdf"
											ref={calendarFileRef}
											type="file"
											accept="application/pdf,.pdf"
										/>
									</div>
									<Button
										disabled={calendarUploadMutation.isPending}
										onClick={() => {
											const file = calendarFileRef.current?.files?.[0];
											const yearStart = parseInt(calendarUploadYear, 10);
											if (!file) {
												toast({
													title: 'File wajib',
													description: 'Pilih PDF kalender terlebih dahulu',
													variant: 'destructive',
												});
												return;
											}
											if (!Number.isFinite(yearStart) || yearStart < 2000) {
												toast({
													title: 'Tahun tidak valid',
													variant: 'destructive',
												});
												return;
											}
											calendarUploadMutation.mutate({ yearStart, file });
										}}>
										{calendarUploadMutation.isPending ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengunggah…
											</>
										) : (
											'Unggah PDF'
										)}
									</Button>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					<TabsContent value="portal" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: Portal"
							variant="green"
							storageKey="dashboard-prodi-tab-portal"
							description="Portal & panduan (termasuk decoder NIM) diisi dari defaults + sync Student Resources.">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>Preview publik: /prodi?tab=portal</li>
							</ul>
						</DashboardHintCard>
						<Card>
							<CardContent className="pt-6 space-y-2 text-sm">
								<p>
									Portal: {(localContent?.studentHub?.portals || []).length} tautan · Panduan:{' '}
									{(localContent?.studentHub?.guides || []).length} item
								</p>
								{(localContent?.studentHub?.portals || []).slice(0, 8).map((p: any) => (
									<div key={p.url} className="text-muted-foreground">
										{p.label} — {p.url}
									</div>
								))}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="skripsi" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: Skripsi"
							variant="green"
							storageKey="dashboard-prodi-tab-skripsi"
							description="Sync mengambil dokumen/tautan dari situs TI. Hasil bisa diedit manual lalu Simpan. Sections sampah tema (MIU Login, Powered By, dll) otomatis dibuang.">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>Sync → cek dokumen → edit nama/URL bila perlu → Simpan.</li>
							</ul>
						</DashboardHintCard>
						<StudentHubResourceEditor
							title="Hub Skripsi"
							hub={localContent?.studentHub?.skripsiHub}
							mode="skripsi"
							canEdit={canEdit}
							canSync={canSync}
							onChange={(next) => updateField('studentHub', 'skripsiHub', next)}
							onSync={() => setPendingSyncScope('studentResources')}
						/>
					</TabsContent>

					<TabsContent value="pkl" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: PKL"
							variant="green"
							storageKey="dashboard-prodi-tab-pkl"
							description="Template PKL dari scrape + edit manual. Sections tema/login otomatis dibersihkan.">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>Edit nama template agar ramah mahasiswa, lalu Simpan.</li>
							</ul>
						</DashboardHintCard>
						<StudentHubResourceEditor
							title="Hub PKL"
							hub={localContent?.studentHub?.pklHub}
							mode="pkl"
							canEdit={canEdit}
							canSync={canSync}
							onChange={(next) => updateField('studentHub', 'pklHub', next)}
							onSync={() => setPendingSyncScope('studentResources')}
						/>
					</TabsContent>

					<TabsContent value="pengumuman" className="space-y-6 mt-6">
						<DashboardHintCard
							title="Panduan tab: Pengumuman"
							variant="green"
							storageKey="dashboard-prodi-tab-pengumuman"
							description="Feed RSS TI + UIN. Max 50/kategori. Publik: 10/halaman + pagination. Auto-fetch default 1 hari untuk seluruh student hub (kalender, skripsi, PKL, pengumuman).">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>Ubah interval → Simpan. Cron cek tiap jam apakah sudah jatuh tempo.</li>
								<li>Hapus item yang tidak relevan, lalu Simpan.</li>
							</ul>
						</DashboardHintCard>
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Interval auto-fetch student hub</CardTitle>
								<CardDescription>
									Berlaku untuk pengumuman + skripsi + PKL + kalender (bukan hanya RSS).
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex flex-wrap items-end gap-3">
									<div className="space-y-1">
										<Label htmlFor="ann-interval">Setiap (hari)</Label>
										<Input
											id="ann-interval"
											type="number"
											min={1}
											max={30}
											className="w-28"
											value={announcementIntervalDays}
											disabled={!canEdit}
											onChange={(e) => {
												setAnnouncementIntervalDays(
													Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)),
												);
												setDirty(true);
											}}
										/>
									</div>
									<p className="text-xs text-muted-foreground">
										Terakhir:{' '}
										{doc?.lastAnnouncementSyncAt
											? new Date(doc.lastAnnouncementSyncAt).toLocaleString('id-ID')
											: 'belum pernah'}
									</p>
								</div>
								{canSync && (
									<Button variant="outline" onClick={() => setPendingSyncScope('studentResources')}>
										Sync Student Hub Sekarang
									</Button>
								)}
							</CardContent>
						</Card>
						<AnnouncementsEditor
							items={localContent?.studentHub?.announcements || []}
							canEdit={canEdit}
							onChange={(next) => updateField('studentHub', 'announcements', next)}
						/>
					</TabsContent>
				</Tabs>
			</div>

			{/* Dialog 1: konfirmasi umum sebelum sync */}
			<Dialog open={!!pendingSyncScope} onOpenChange={(open) => { if (!open) setPendingSyncScope(null); }}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Konfirmasi Sinkronisasi</DialogTitle>
						<DialogDescription>
							Sinkronisasi akan mengambil data terbaru dari sumber resmi dan <strong>dapat menimpa</strong> data yang sudah ada di dashboard untuk bagian <strong>{pendingSyncScope === 'all' ? 'semua' : pendingSyncScope}</strong>. Apakah Anda yakin ingin melanjutkan?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2">
						<Button variant="outline" onClick={() => setPendingSyncScope(null)}>
							Batal
						</Button>
						<Button onClick={() => pendingSyncScope && handleSyncConfirmed(pendingSyncScope)}>
							Lanjutkan
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Dialog 2: konfirmasi overwrite kurikulum */}
			<Dialog open={!!confirmOverwrite} onOpenChange={(open) => { if (!open) setConfirmOverwrite(null); }}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Konfirmasi Overwrite Kurikulum</DialogTitle>
						<DialogDescription>
							Data kurikulum untuk tahun <strong>{confirmOverwrite?.years?.join(', ')}</strong> sudah ada di database. Apakah Anda ingin menimpa data tersebut dengan data terbaru dari sumber?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2">
						<Button variant="outline" onClick={() => setConfirmOverwrite(null)}>
							Batal
						</Button>
						<Button
							variant="destructive"
							disabled={syncMutation.isPending}
							onClick={() => {
								const scope = confirmOverwrite?.scope ?? 'curriculum';
								setConfirmOverwrite(null);
								syncMutation.mutate({ scope, overwrite: true });
							}}>
							{syncMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
							Ya, Timpa Data {confirmOverwrite?.years?.join(', ')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}

/** Sama dengan halaman publik `/prodi` — untuk path upload `lecturers/{slug}.webp`. */
function slugFromProfileUrl(profileUrl: string): string {
	if (!profileUrl) return '';
	const parts = profileUrl.replace(/\/+$/, '').split('/');
	return parts[parts.length - 1] || '';
}

/** Fallback nama file foto jika Profile URL kosong (diselaraskan dengan sanitasi di server). */
function slugifyLecturerNameOrNip(name?: string, nip?: string): string {
	const nipClean = (nip || '').replace(/\s/g, '').replace(/[^a-zA-Z0-9-]/g, '');
	if (nipClean.length >= 4) {
		return nipClean.toLowerCase();
	}
	const raw = (name || '').trim();
	if (!raw) return '';
	return raw
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function ProdiMemberPhotoUpload({
	photoUrl,
	profileUrl,
	nameFallback,
	nipFallback,
	onUploaded,
	readOnly,
	sizeClass = 'w-12 h-12 rounded-full',
}: {
	photoUrl?: string;
	profileUrl?: string;
	nameFallback?: string;
	nipFallback?: string;
	onUploaded: (url: string) => void;
	readOnly?: boolean;
	sizeClass?: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const { toast } = useToast();
	const slugFromUrl = slugFromProfileUrl(profileUrl || '');
	const slugFromPerson = slugifyLecturerNameOrNip(nameFallback, nipFallback);
	const effectiveSlug = slugFromUrl || slugFromPerson;
	const canUpload = !readOnly && !!effectiveSlug;

	const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file || !effectiveSlug) return;
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append('image', file);
			fd.append('slug', effectiveSlug);
			if (profileUrl) fd.append('profileUrl', profileUrl);
			if (photoUrl?.startsWith('/uploads/prodi/')) {
				fd.append('oldPhotoUrl', photoUrl);
			}
			const res = await apiRequest('POST', '/api/prodi/upload/photo/member', fd);
			const j = await res.json();
			onUploaded(j.url);
			toast({ title: 'Berhasil', description: 'Foto diunggah dan dikonversi ke WebP' });
		} catch (err: any) {
			toast({
				title: 'Gagal mengunggah',
				description: err?.message || 'Upload gagal',
				variant: 'destructive',
			});
		} finally {
			setUploading(false);
		}
	};

	if (readOnly) {
		return photoUrl ? (
			<img
				src={photoUrl}
				alt=""
				className={cn('object-cover border border-border shrink-0', sizeClass)}
				onError={(ev) => {
					(ev.target as HTMLImageElement).style.display = 'none';
				}}
			/>
		) : (
			<div
				className={cn(
					'border border-dashed border-border bg-muted/40 shrink-0 flex items-center justify-center text-muted-foreground',
					sizeClass,
				)}>
				<Users className="h-5 w-5" />
			</div>
		);
	}

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/gif,image/webp"
				className="hidden"
				onChange={onPick}
			/>
			<button
				type="button"
				disabled={!canUpload || uploading}
				onClick={() => canUpload && inputRef.current?.click()}
				className={cn(
					'relative shrink-0 overflow-hidden border border-border bg-muted flex items-center justify-center',
					sizeClass,
					canUpload && 'cursor-pointer hover:ring-2 hover:ring-primary/40',
					(!canUpload || uploading) && 'opacity-70',
				)}
				title={
					canUpload
						? 'Klik untuk unggah foto (WebP)'
						: 'Isi Profile URL atau Nama/NIP agar unggah aktif'
				}>
				{uploading ? (
					<Loader2 className="h-6 w-6 animate-spin text-primary" />
				) : photoUrl ? (
					<img
						src={photoUrl}
						alt=""
						className="w-full h-full object-cover"
						onError={(ev) => {
							(ev.target as HTMLImageElement).style.display = 'none';
						}}
					/>
				) : (
					<Users className="h-5 w-5 text-muted-foreground" />
				)}
			</button>
		</>
	);
}

function ProdiOrgStructurePhotoUpload({
	imageUrl,
	onUploaded,
	readOnly,
}: {
	imageUrl?: string;
	onUploaded: (url: string) => void;
	readOnly?: boolean;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const { toast } = useToast();

	const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append('image', file);
			if (imageUrl?.startsWith('/uploads/prodi/')) {
				fd.append('oldPhotoUrl', imageUrl);
			}
			const res = await apiRequest('POST', '/api/prodi/upload/photo/org-structure', fd);
			const j = await res.json();
			onUploaded(j.url);
			toast({ title: 'Berhasil', description: 'Gambar struktur diunggah (WebP)' });
		} catch (err: any) {
			toast({
				title: 'Gagal mengunggah',
				description: err?.message || 'Upload gagal',
				variant: 'destructive',
			});
		} finally {
			setUploading(false);
		}
	};

	if (readOnly) {
		return imageUrl ? (
			<div className="border rounded-lg overflow-hidden max-w-md">
				<img
					src={imageUrl}
					alt="Struktur Organisasi Preview"
					className="w-full h-auto object-contain max-h-64"
					onError={(ev) => {
						(ev.target as HTMLImageElement).style.display = 'none';
					}}
				/>
			</div>
		) : (
			<p className="text-sm text-muted-foreground">Belum ada gambar</p>
		);
	}

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/gif,image/webp"
				className="hidden"
				onChange={onPick}
			/>
			<button
				type="button"
				disabled={uploading}
				onClick={() => !uploading && inputRef.current?.click()}
				className={cn(
					'w-full max-w-md rounded-lg border overflow-hidden bg-muted/30 flex flex-col items-center justify-center min-h-[140px] p-2',
					!uploading && 'cursor-pointer hover:ring-2 hover:ring-primary/40',
				)}
				title="Klik untuk unggah gambar struktur organisasi (WebP)">
				{uploading ? (
					<Loader2 className="h-10 w-10 animate-spin text-primary" />
				) : imageUrl ? (
					<img
						src={imageUrl}
						alt="Struktur organisasi"
						className="w-full h-auto max-h-64 object-contain"
						onError={(ev) => {
							(ev.target as HTMLImageElement).style.display = 'none';
						}}
					/>
				) : (
					<div className="flex flex-col items-center gap-2 text-muted-foreground py-6">
						<ImageIcon className="h-12 w-12" />
						<span className="text-xs">Klik untuk unggah (WebP)</span>
					</div>
				)}
			</button>
		</>
	);
}

/** Unggah / ganti / hapus slot gambar lab (path konsisten dengan sync: labs/{type}/{labIndex}-{imgIndex}.webp). */
function ProdiLabPhotoSlots({
	labKind,
	labIndex,
	urls,
	readOnly,
	onUrlsChange,
}: {
	labKind: 'teaching' | 'research';
	labIndex: number;
	urls: string[];
	readOnly: boolean;
	onUrlsChange: (next: string[]) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploadTarget, setUploadTarget] = useState<number | null>(null);
	const [uploading, setUploading] = useState(false);
	const { toast } = useToast();

	const startPick = (imgIndex: number) => {
		setUploadTarget(imgIndex);
		requestAnimationFrame(() => inputRef.current?.click());
	};

	const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		const imgIndex = uploadTarget;
		setUploadTarget(null);
		e.target.value = '';
		if (!file || imgIndex === null) return;

		setUploading(true);
		try {
			const fd = new FormData();
			fd.append('image', file);
			fd.append('type', labKind);
			fd.append('labIndex', String(labIndex));
			fd.append('imgIndex', String(imgIndex));
			const oldUrl = urls[imgIndex];
			if (oldUrl?.startsWith('/uploads/')) {
				fd.append('oldPhotoUrl', oldUrl);
			}
			const res = await apiRequest('POST', '/api/prodi/upload/photo/lab', fd);
			const j = await res.json();
			const next = [...urls];
			if (imgIndex < next.length) {
				next[imgIndex] = j.url;
			} else if (imgIndex === next.length) {
				next.push(j.url);
			} else {
				while (next.length < imgIndex) next.push('');
				next[imgIndex] = j.url;
			}
			const compacted = next.filter((u) => u.trim() !== '');
			onUrlsChange(compacted);
			toast({ title: 'Berhasil', description: 'Gambar lab diunggah (WebP)' });
		} catch (err: any) {
			toast({
				title: 'Gagal mengunggah',
				description: err?.message || 'Upload gagal',
				variant: 'destructive',
			});
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="space-y-2">
			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/gif,image/webp"
				className="hidden"
				onChange={onPick}
			/>
			<div className="flex flex-wrap gap-2 items-end">
				{urls.map((url, j) => (
					<div key={`${j}-${url.slice(-20)}`} className="flex flex-col gap-1">
						<div className="relative w-20 h-14 rounded border border-border overflow-hidden bg-muted">
							<img
								src={url}
								alt=""
								className="w-full h-full object-cover"
								onError={(ev) => {
									(ev.target as HTMLImageElement).style.display = 'none';
								}}
							/>
						</div>
						{!readOnly && (
							<div className="flex gap-1 flex-wrap">
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="h-7 text-[10px] px-2"
									disabled={uploading}
									onClick={() => startPick(j)}>
									Ganti
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 text-[10px] px-2 text-destructive"
									disabled={uploading}
									onClick={() => onUrlsChange(urls.filter((_, idx) => idx !== j))}>
									Hapus
								</Button>
							</div>
						)}
					</div>
				))}
				{!readOnly && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-14 px-3 shrink-0"
						disabled={uploading}
						onClick={() => startPick(urls.length)}
						title="Tambah gambar">
						{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
					</Button>
				)}
			</div>
		</div>
	);
}

// ─── Profile Editor ───

function ProfileEditor({ data, onChange, readOnly }: { data: any; onChange: (f: string, v: any) => void; readOnly: boolean }) {
	return (
		<div className="space-y-6">
			{!readOnly && (
				<ContentEnhanceButton
					entityType="prodi"
					fields={[
						{ key: 'history', label: 'Sejarah' },
						{ key: 'vision', label: 'Visi' },
						{ key: 'strategy', label: 'Strategi' },
					]}
					values={{
						history: data.history || '',
						vision: data.vision || '',
						strategy: data.strategy || '',
					}}
					onApply={(partial) => {
						for (const [k, v] of Object.entries(partial)) {
							onChange(k, v);
						}
					}}
				/>
			)}
			<Card>
				<CardHeader>
					<CardTitle>Sejarah</CardTitle>
				</CardHeader>
				<CardContent>
					{readOnly ? (
						<div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: data.history || '<em>Belum ada data</em>' }} />
					) : (
						<RichTextEditor
							value={data.history || ''}
							onChange={(v) => onChange('history', v)}
						/>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Visi</CardTitle>
				</CardHeader>
				<CardContent>
					<Textarea
						value={data.vision || ''}
						onChange={(e) => onChange('vision', e.target.value)}
						disabled={readOnly}
						rows={3}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Misi</CardTitle>
					<CardDescription>Satu item per baris</CardDescription>
				</CardHeader>
				<CardContent>
					<ListEditor
						items={data.mission ?? []}
						onChange={(v) => onChange('mission', v)}
						readOnly={readOnly}
						placeholder="Tambah misi..."
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Tujuan</CardTitle>
				</CardHeader>
				<CardContent>
					<ListEditor
						items={data.objectives ?? []}
						onChange={(v) => onChange('objectives', v)}
						readOnly={readOnly}
						placeholder="Tambah tujuan..."
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Strategi</CardTitle>
				</CardHeader>
				<CardContent>
					<Textarea
						value={data.strategy || ''}
						onChange={(e) => onChange('strategy', e.target.value)}
						disabled={readOnly}
						rows={3}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Tonggak Sejarah</CardTitle>
				</CardHeader>
				<CardContent>
					<MilestoneEditor
						items={data.milestones ?? []}
						onChange={(v) => onChange('milestones', v)}
						readOnly={readOnly}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Pimpinan Jurusan</CardTitle>
					<CardDescription>Data pimpinan jurusan per periode</CardDescription>
				</CardHeader>
				<CardContent>
					<ManagementEditor
						items={data.managements ?? []}
						onChange={(v) => onChange('managements', v)}
						readOnly={readOnly}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Struktur Organisasi</CardTitle>
					<CardDescription>Gambar dan deskripsi struktur organisasi jurusan</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<Label className="text-xs mb-1 block">Pratinjau / unggah</Label>
						<div className="mt-1">
							<ProdiOrgStructurePhotoUpload
								imageUrl={data.organizationStructureImageUrl}
								onUploaded={(url) => onChange('organizationStructureImageUrl', url)}
								readOnly={readOnly}
							/>
						</div>
						<Label className="text-xs mb-1 block mt-3">URL Gambar (override manual)</Label>
						<Input
							value={data.organizationStructureImageUrl || ''}
							onChange={(e) => onChange('organizationStructureImageUrl', e.target.value)}
							disabled={readOnly}
							placeholder="URL gambar struktur organisasi"
						/>
					</div>
					<div>
						<Label className="text-xs mb-1 block">Deskripsi (opsional)</Label>
						<Textarea
							value={data.organizationStructureDescription || ''}
							onChange={(e) => onChange('organizationStructureDescription', e.target.value)}
							disabled={readOnly}
							rows={3}
							placeholder="Deskripsi struktur organisasi..."
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Management Editor ───

function ManagementEditor({ items, onChange, readOnly }: {
	items: any[];
	onChange: (v: any[]) => void;
	readOnly: boolean;
}) {
	const updatePeriod = (idx: number, field: string, value: any) => {
		const next = [...items];
		next[idx] = { ...next[idx], [field]: value };
		onChange(next);
	};

	const updateMember = (periodIdx: number, memberIdx: number, field: string, value: string) => {
		const next = [...items];
		const members = [...(next[periodIdx].members || [])];
		members[memberIdx] = { ...members[memberIdx], [field]: value };
		next[periodIdx] = { ...next[periodIdx], members };
		onChange(next);
	};

	const addMember = (periodIdx: number) => {
		const next = [...items];
		const members = [...(next[periodIdx].members || []), { name: '', position: '', profileUrl: '', photoUrl: '' }];
		next[periodIdx] = { ...next[periodIdx], members };
		onChange(next);
	};

	const removeMember = (periodIdx: number, memberIdx: number) => {
		const next = [...items];
		const members = (next[periodIdx].members || []).filter((_: any, i: number) => i !== memberIdx);
		next[periodIdx] = { ...next[periodIdx], members };
		onChange(next);
	};

	return (
		<div className="space-y-4">
			{items.map((period, pi) => (
				<div key={pi} className="border rounded-lg p-4 space-y-3 bg-muted/20">
					<div className="flex items-center gap-3">
						<div className="flex-1">
							<Label className="text-xs">Periode</Label>
							<Input
								value={period.period || ''}
								onChange={(e) => updatePeriod(pi, 'period', e.target.value)}
								disabled={readOnly}
								placeholder="e.g. 2020-2024"
							/>
						</div>
						<div className="flex items-center gap-2 pt-4">
							<Switch
								checked={period.isCurrent ?? false}
								onCheckedChange={(v) => updatePeriod(pi, 'isCurrent', v)}
								disabled={readOnly}
							/>
							<span className="text-xs text-muted-foreground">Aktif</span>
						</div>
						{!readOnly && (
							<Button variant="ghost" size="icon" className="shrink-0 text-destructive mt-4"
								onClick={() => onChange(items.filter((_, idx) => idx !== pi))}>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
					</div>

					<div className="space-y-2 pl-2 border-l-2 border-border ml-1">
						{(period.members || []).map((member: any, mi: number) => (
							<div key={mi} className="border rounded-lg p-3 space-y-2 bg-card">
								<div className="flex gap-3 items-start">
									<ProdiMemberPhotoUpload
										photoUrl={member.photoUrl}
										profileUrl={member.profileUrl}
										onUploaded={(url) => updateMember(pi, mi, 'photoUrl', url)}
										readOnly={readOnly}
										sizeClass="w-10 h-10 rounded-full"
									/>
									<div className="flex-1 space-y-2">
										<div className="flex gap-2 flex-wrap">
											<div className="flex-1 min-w-[160px]">
												<Label className="text-xs">Nama</Label>
												<Input value={member.name || ''} disabled={readOnly}
													onChange={(e) => updateMember(pi, mi, 'name', e.target.value)} />
											</div>
											<div className="flex-1 min-w-[160px]">
												<Label className="text-xs">Jabatan</Label>
												<Input value={member.position || ''} disabled={readOnly}
													onChange={(e) => updateMember(pi, mi, 'position', e.target.value)} />
											</div>
										</div>
										<div>
											<Label className="text-xs">Profile URL (opsional; atau isi Nama untuk unggah foto)</Label>
											<Input value={member.profileUrl || ''} disabled={readOnly}
												onChange={(e) => updateMember(pi, mi, 'profileUrl', e.target.value)}
												placeholder="https://informatika.uin-malang.ac.id/..." className="text-xs" />
										</div>
										<div>
											<Label className="text-xs">Foto URL (override)</Label>
											<Input value={member.photoUrl || ''} disabled={readOnly}
												onChange={(e) => updateMember(pi, mi, 'photoUrl', e.target.value)}
												placeholder="https://..." className="text-xs" />
										</div>
									</div>
								</div>
								{!readOnly && (
									<Button variant="ghost" size="sm" className="text-destructive"
										onClick={() => removeMember(pi, mi)}>
										<Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus Anggota
									</Button>
								)}
							</div>
						))}
						{!readOnly && (
							<Button variant="outline" size="sm" onClick={() => addMember(pi)}>
								<Plus className="h-4 w-4 mr-1" /> Tambah Anggota
							</Button>
						)}
					</div>
				</div>
			))}
			{!readOnly && (
				<Button variant="outline" size="sm"
					onClick={() => onChange([...items, { period: '', isCurrent: false, members: [] }])}>
					<Plus className="h-4 w-4 mr-1" /> Tambah Periode
				</Button>
			)}
		</div>
	);
}

// ─── Lecturer Editor ───

function LecturerEditor({ data, onChange, readOnly }: { data: any; onChange: (f: string, v: any) => void; readOnly: boolean }) {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Ketua & Sekretaris</CardTitle>
					<CardDescription>Data pimpinan jurusan saat ini</CardDescription>
				</CardHeader>
				<CardContent>
					<PersonListEditor
						items={data.headAndSecretary ?? []}
						onChange={(v) => onChange('headAndSecretary', v)}
						readOnly={readOnly}
					/>
				</CardContent>
			</Card>

			{(data.groups ?? []).map((group: any, gi: number) => (
				<Card key={gi}>
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<span>{group.name}</span>
							<span className="text-xs text-muted-foreground font-normal">
								{group.lecturers?.length ?? 0} dosen
							</span>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<PersonListEditor
							items={group.lecturers ?? []}
							onChange={(v) => {
								const groups = [...(data.groups ?? [])];
								groups[gi] = { ...groups[gi], lecturers: v };
								onChange('groups', groups);
							}}
							readOnly={readOnly}
							showAcademic
						/>
					</CardContent>
				</Card>
			))}

			<Card>
				<CardHeader>
					<CardTitle>Staff</CardTitle>
				</CardHeader>
				<CardContent>
					<PersonListEditor
						items={data.staff ?? []}
						onChange={(v) => onChange('staff', v)}
						readOnly={readOnly}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Curriculum Editor ───

function deriveSlugFromUrl(url: string): string {
	if (!url) return '';
	try {
		const u = new URL(url, 'https://informatika.uin-malang.ac.id');
		const parts = u.pathname.split('/').filter(Boolean);
		return (parts[parts.length - 1] || '').toLowerCase().trim();
	} catch {
		return url.replace(/\/+$/, '').split('/').pop()?.toLowerCase().trim() || '';
	}
}

function slugFromCode(code: string): string {
	return (code || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function effectiveSlugForSubject(subject: any): string {
	const fromUrl = deriveSlugFromUrl(subject?.rpsUrl || '');
	if (fromUrl) return fromUrl;
	if (subject?.code) return slugFromCode(subject.code);
	if (subject?.name) return (subject.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	return '';
}

function SubjectEditDialog({
	open,
	onOpenChange,
	subject,
	semIdx,
	subIdx,
	isOptional,
	allData,
	onChange,
	readOnly,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	subject: any;
	semIdx: number;
	subIdx: number;
	isOptional: boolean;
	allData: any;
	onChange: (field: string, val: any) => void;
	readOnly: boolean;
}) {
	const slug = effectiveSlugForSubject(subject);
	const urlSlug = deriveSlugFromUrl(subject?.rpsUrl || '');
	const resources = (allData.subjectRpsResources ?? []).find(
		(r: any) => {
			const rs = (r.slug || '').toLowerCase();
			return rs === slug || (urlSlug && rs === urlSlug);
		},
	);
	const materiPpt: { label: string; url: string }[] = resources?.materiPpt ?? [];
	const linkFileList: { label: string; url: string }[] = resources?.linkFile ?? [];

	const updateSubject = (field: string, value: string) => {
		if (isOptional) {
			const list = [...(allData.optionalSubjects ?? [])];
			list[subIdx] = { ...list[subIdx], [field]: value };
			onChange('optionalSubjects', list);
		} else {
			const sems = [...(allData.semesters ?? [])];
			const sem = { ...sems[semIdx] };
			const subs = [...(sem.subjects ?? [])];
			subs[subIdx] = { ...subs[subIdx], [field]: value };
			sem.subjects = subs;
			sems[semIdx] = sem;
			onChange('semesters', sems);
		}
	};

	const updateResources = (materiPptNew: any[], linkFileNew: any[]) => {
		const rps = [...(allData.subjectRpsResources ?? [])];
		const lookupSlug = urlSlug || slug;
		const idx = rps.findIndex((r: any) => (r.slug || '').toLowerCase() === lookupSlug);
		const entry = {
			slug: lookupSlug,
			subjectName: subject?.name || '',
			materiPpt: materiPptNew,
			linkFile: linkFileNew,
			parsedAt: new Date().toISOString(),
		};
		if (idx >= 0) {
			rps[idx] = { ...rps[idx], ...entry };
		} else if (lookupSlug) {
			rps.push(entry);
		}
		onChange('subjectRpsResources', rps);
	};

	const updateMateri = (i: number, field: 'label' | 'url', value: string) => {
		const next = [...materiPpt];
		next[i] = { ...next[i], [field]: value };
		updateResources(next, linkFileList);
	};
	const addMateri = () => updateResources([...materiPpt, { label: `Materi ${materiPpt.length + 1}`, url: '' }], linkFileList);
	const removeMateri = (i: number) => updateResources(materiPpt.filter((_, idx) => idx !== i), linkFileList);

	const updateLinkFile = (i: number, field: 'label' | 'url', value: string) => {
		const next = [...linkFileList];
		next[i] = { ...next[i], [field]: value };
		updateResources(materiPpt, next);
	};
	const addLinkFile = () => updateResources(materiPpt, [...linkFileList, { label: 'Link File', url: '' }]);
	const removeLinkFile = (i: number) => updateResources(materiPpt, linkFileList.filter((_, idx) => idx !== i));

	if (!subject) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-lg">{subject.name || 'Edit Mata Kuliah'}</DialogTitle>
				</DialogHeader>

				<div className="space-y-5 pt-2">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label className="text-xs">Kode</Label>
							<Input value={subject.code || ''} onChange={(e) => updateSubject('code', e.target.value)} disabled={readOnly} />
						</div>
						<div>
							<Label className="text-xs">SKS</Label>
							<Input value={subject.sks || ''} onChange={(e) => updateSubject('sks', e.target.value)} disabled={readOnly} />
						</div>
					</div>
					<div>
						<Label className="text-xs">Nama Mata Kuliah</Label>
						<Input value={subject.name || ''} onChange={(e) => updateSubject('name', e.target.value)} disabled={readOnly} />
					</div>
					<div>
						<Label className="text-xs">Prasyarat</Label>
						<Input value={subject.prerequisite || ''} onChange={(e) => updateSubject('prerequisite', e.target.value)} disabled={readOnly} />
					</div>
					<div>
						<Label className="text-xs">RPS URL</Label>
						<Input value={subject.rpsUrl || ''} onChange={(e) => updateSubject('rpsUrl', e.target.value)} disabled={readOnly} className="text-xs" placeholder="https://informatika.uin-malang.ac.id/..." />
					</div>

				<div className="border-t pt-4">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-semibold flex items-center gap-2">
							<BookOpen className="h-4 w-4 text-primary" /> Materi PPT
						</h3>
						{!readOnly && (
							<Button variant="outline" size="sm" onClick={addMateri}>
								<Plus className="h-3 w-3 mr-1" /> Tambah
							</Button>
						)}
					</div>
					{materiPpt.length ? (
						<div className="space-y-2">
							{materiPpt.map((m, i) => (
								<div key={i} className="flex gap-2 items-center">
									<Input value={m.label} onChange={(e) => updateMateri(i, 'label', e.target.value)} disabled={readOnly} className="w-28 text-xs" placeholder="Label" />
									<Input value={m.url} onChange={(e) => updateMateri(i, 'url', e.target.value)} disabled={readOnly} className="flex-1 text-xs" placeholder="URL" />
									{m.url && (
										<a href={m.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:text-primary/80">
											<ExternalLink className="h-3.5 w-3.5" />
										</a>
									)}
									{!readOnly && (
										<Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-destructive" onClick={() => removeMateri(i)}>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									)}
								</div>
							))}
						</div>
					) : (
						<p className="text-xs text-muted-foreground">Belum ada materi.</p>
					)}
				</div>

				<div className="border-t pt-4">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-semibold">Link File</h3>
						{!readOnly && (
							<Button variant="outline" size="sm" onClick={addLinkFile}>
								<Plus className="h-3 w-3 mr-1" /> Tambah
							</Button>
						)}
					</div>
					{linkFileList.length ? (
						<div className="space-y-2">
							{linkFileList.map((f, i) => (
								<div key={i} className="flex gap-2 items-center">
									<Input value={f.label} onChange={(e) => updateLinkFile(i, 'label', e.target.value)} disabled={readOnly} className="w-28 text-xs" placeholder="Label" />
									<Input value={f.url} onChange={(e) => updateLinkFile(i, 'url', e.target.value)} disabled={readOnly} className="flex-1 text-xs" placeholder="URL" />
									{f.url && (
										<a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:text-primary/80">
											<ExternalLink className="h-3.5 w-3.5" />
										</a>
									)}
									{!readOnly && (
										<Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-destructive" onClick={() => removeLinkFile(i)}>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									)}
								</div>
							))}
						</div>
					) : (
						<p className="text-xs text-muted-foreground">Belum ada link file.</p>
					)}
				</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function SemesterSubjectTable({
	subjects,
	totalSks,
	semIdx,
	isOptional,
	allData,
	onChange,
	readOnly,
}: {
	subjects: any[];
	totalSks?: string;
	semIdx: number;
	isOptional: boolean;
	allData: any;
	onChange: (field: string, val: any) => void;
	readOnly: boolean;
}) {
	const [editIdx, setEditIdx] = useState<number | null>(null);

	return (
		<>
			<div className="overflow-x-auto">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b bg-muted/50">
							<th className="text-left p-2 font-medium text-muted-foreground w-10">No</th>
							<th className="text-left p-2 font-medium text-muted-foreground w-28">Kode</th>
							<th className="text-left p-2 font-medium text-muted-foreground">Mata Kuliah</th>
							<th className="text-center p-2 font-medium text-muted-foreground w-14">SKS</th>
							<th className="text-left p-2 font-medium text-muted-foreground w-28">Prasyarat</th>
							{!readOnly && <th className="w-10" />}
						</tr>
					</thead>
					<tbody>
						{subjects.map((sub, i) => (
							<tr key={i} className="border-b hover:bg-muted/30 transition-colors">
								<td className="p-2 text-muted-foreground">{sub.no || i + 1}</td>
								<td className="p-2 font-mono text-xs">{sub.code}</td>
								<td className="p-2">
									<button
										type="button"
										onClick={() => setEditIdx(i)}
										className="text-left text-primary hover:underline font-medium"
									>
										{sub.name || '(tanpa nama)'}
									</button>
									{sub.rpsUrl && (
										<a href={sub.rpsUrl} target="_blank" rel="noopener noreferrer"
											className="ml-2 text-muted-foreground hover:text-primary text-xs inline-flex items-center gap-0.5">
											RPS <ExternalLink className="w-3 h-3" />
										</a>
									)}
								</td>
								<td className="p-2 text-center">{sub.sks}</td>
								<td className="p-2 text-muted-foreground text-xs">{sub.prerequisite || '–'}</td>
								{!readOnly && (
									<td className="p-2">
										<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditIdx(i)}>
											<Pencil className="h-3.5 w-3.5" />
										</Button>
									</td>
								)}
							</tr>
						))}
					</tbody>
				<tfoot>
					<tr className="border-t bg-muted/50 font-semibold">
						<td colSpan={3} className="p-2 text-right">Total SKS</td>
						<td className="p-2 text-center">
							{!readOnly && !isOptional ? (
								<Input
									value={totalSks || ''}
									onChange={(e) => {
										const sems = [...(allData.semesters ?? [])];
										sems[semIdx] = { ...sems[semIdx], totalSks: e.target.value };
										onChange('semesters', sems);
									}}
									className="w-14 h-7 text-center text-sm p-1"
								/>
							) : (
								totalSks || '–'
							)}
						</td>
						<td colSpan={readOnly ? 1 : 2} />
					</tr>
				</tfoot>
			</table>
		</div>

		{!readOnly && (
			<div className="mt-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						if (isOptional) {
							const list = [...(allData.optionalSubjects ?? [])];
							list.push({ no: String(list.length + 1), code: '', name: '', sks: '', prerequisite: '' });
							onChange('optionalSubjects', list);
						} else {
							const sems = [...(allData.semesters ?? [])];
							const sem = { ...sems[semIdx] };
							const subs = [...(sem.subjects ?? [])];
							subs.push({ no: String(subs.length + 1), code: '', name: '', sks: '', prerequisite: '' });
							sem.subjects = subs;
							sems[semIdx] = sem;
							onChange('semesters', sems);
						}
					}}
				>
					<Plus className="h-3 w-3 mr-1" /> Tambah Mata Kuliah
				</Button>
			</div>
		)}

		{editIdx !== null && (
			<SubjectEditDialog
				open
				onOpenChange={(v) => { if (!v) setEditIdx(null); }}
				subject={subjects[editIdx]}
				semIdx={semIdx}
				subIdx={editIdx}
				isOptional={isOptional}
				allData={allData}
				onChange={onChange}
				readOnly={readOnly}
			/>
		)}
	</>
	);
}

function CurriculumEditor({
	data,
	curriculumByYear,
	curriculumYears,
	curriculumYearsByLevel,
	activeAcademicYear,
	onChange,
	onYearChange,
	readOnly,
}: {
	data: any;
	curriculumByYear?: any[];
	curriculumYears?: number[];
	curriculumYearsByLevel?: { s1?: number[]; s2?: number[] };
	activeAcademicYear?: number;
	onChange: (f: string, v: any) => void;
	onYearChange?: (year: number | null) => void;
	readOnly: boolean;
}) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [level, setLevel] = useState<'s1' | 's2'>('s1');
	const years =
		curriculumYearsByLevel?.[level] ??
		(level === 's1' ? curriculumYears ?? [] : []);
	const formatRange = (year: number) =>
		level === 's2' ? `${year}-${year + 2}` : `${year}-${year + 4}`;
	const [selectedYear, setSelectedYear] = useState<number | null>(null);
	const [newYearInput, setNewYearInput] = useState('');

	const activeYear = activeAcademicYear ?? new Date().getFullYear();
	const effectiveYear = selectedYear ?? (years.length > 0 ? (years.includes(activeYear) ? activeYear : years[0]) : null);

	const yearEntries: any[] = (curriculumByYear ?? []).filter(
		(e: any) => (e.level || 's1') === level,
	);
	const yearData = effectiveYear != null
		? yearEntries.find((e: any) => e.academicYear === effectiveYear)
		: null;
	const [editingData, setEditingData] = useState<any>({});

	useEffect(() => {
		const source = yearData ?? data ?? {};
		setEditingData(JSON.parse(JSON.stringify(source)));
	}, [effectiveYear, yearData, data]);

	const displayData = editingData ?? {};
	const semesters: any[] = displayData?.semesters ?? [];
	const optionalSubjects: any[] = displayData?.optionalSubjects ?? [];
	const defaultTab = semesters.length ? `sem-${semesters[0]?.semester ?? 1}` : 'optional';

	const handleYearChange = (v: string) => {
		const y = parseInt(v, 10);
		setSelectedYear(y);
		onYearChange?.(y);
	};

	const addYearMutation = useMutation({
		mutationFn: async (yr: number) => {
			const res = await apiRequest('POST', '/api/prodi/curriculum/year', {
				academicYear: yr,
				copyFromYear: effectiveYear ?? undefined,
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.message || 'Gagal membuat tahun');
			return body;
		},
		onSuccess: (data: any) => {
			toast({ title: 'Berhasil', description: data.message });
			queryClient.invalidateQueries({ queryKey: ['/api/prodi/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/prodi'] });
			const yr = parseInt(newYearInput, 10);
			setSelectedYear(yr);
			onYearChange?.(yr);
			setNewYearInput('');
		},
		onError: (err: any) => {
			toast({ title: 'Error', description: err?.message || 'Gagal membuat tahun kurikulum', variant: 'destructive' });
		},
	});

	const handleAddYear = () => {
		const yr = parseInt(newYearInput, 10);
		if (!Number.isFinite(yr) || yr < 2000 || yr > 2100) {
			toast({ title: 'Error', description: 'Tahun harus antara 2000–2100', variant: 'destructive' });
			return;
		}
		if (years.includes(yr)) {
			toast({ title: 'Error', description: `Tahun ${yr} sudah ada`, variant: 'destructive' });
			return;
		}
		addYearMutation.mutate(yr);
	};

	const setField = (field: string, value: any) => {
		setEditingData((prev: any) => ({ ...prev, [field]: value }));
		onChange(field, value);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<span>Tahun Kurikulum</span>
						<span className="text-xs text-muted-foreground font-normal">
							Periode aktif saat ini: {formatRange(activeYear)}
						</span>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center gap-2 flex-wrap">
						<Button
							type="button"
							size="sm"
							variant={level === 's1' ? 'default' : 'outline'}
							onClick={() => {
								setLevel('s1');
								setSelectedYear(null);
							}}
						>
							S1
						</Button>
						<Button
							type="button"
							size="sm"
							variant={level === 's2' ? 'default' : 'outline'}
							onClick={() => {
								setLevel('s2');
								setSelectedYear(null);
							}}
						>
							S2
						</Button>
					</div>
					{years.length > 0 && (
						<Select
							value={String(effectiveYear ?? '')}
							onValueChange={handleYearChange}
						>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Pilih tahun" />
							</SelectTrigger>
							<SelectContent>
								{years.map((y) => (
									<SelectItem key={`${level}-${y}`} value={String(y)}>
										Kurikulum {formatRange(y)} {y === activeYear ? '(Aktif)' : ''}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{!readOnly && (
						<div className="flex items-center gap-2">
							<Input
								type="number"
								placeholder="Tahun baru, misal 2024"
								value={newYearInput}
								onChange={(e) => setNewYearInput(e.target.value)}
								className="w-48"
								min={2000}
								max={2100}
							/>
							<Button
								size="sm"
								variant="outline"
								disabled={!newYearInput || addYearMutation.isPending}
								onClick={handleAddYear}
							>
								{addYearMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
								Tambah Tahun
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Struktur Kurikulum</CardTitle>
				</CardHeader>
				<CardContent>
					<Textarea
						value={displayData?.structureSummary || ''}
						onChange={(e) => setField('structureSummary', e.target.value)}
						disabled={readOnly}
						rows={5}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Kelompok Keilmuan</CardTitle>
				</CardHeader>
				<CardContent>
					<ListEditor
						items={displayData?.knowledgeGroups ?? []}
						onChange={(v) => setField('knowledgeGroups', v)}
						readOnly={readOnly}
						placeholder="Tambah kelompok keilmuan..."
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Metadata Kurikulum</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid gap-3 md:grid-cols-2">
						<div className="space-y-1">
							<Label>Periode Label</Label>
							<Input
								value={displayData?.periodLabel || ''}
								onChange={(e) => setField('periodLabel', e.target.value)}
								disabled={readOnly}
								placeholder="contoh: 2024-2028"
							/>
						</div>
						<div className="space-y-1">
							<Label>Guidebook URL</Label>
							<Input
								value={displayData?.guidebookUrl || ''}
								onChange={(e) => setField('guidebookUrl', e.target.value)}
								disabled={readOnly}
								placeholder="https://..."
							/>
						</div>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<div className="space-y-1">
							<Label>Halaman Kurikulum URL</Label>
							<Input
								value={displayData?.curriculumUrl || ''}
								onChange={(e) => setField('curriculumUrl', e.target.value)}
								disabled={readOnly}
								placeholder="https://..."
							/>
						</div>
						<div className="space-y-1">
							<Label>Official Index URL</Label>
							<Input
								value={displayData?.officialUrl || ''}
								onChange={(e) => setField('officialUrl', e.target.value)}
								disabled={readOnly}
								placeholder="https://..."
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Graduate Profile</CardTitle>
					<CardDescription>
						Semua field graduate profile bisa diedit manual (format JSON array).
					</CardDescription>
				</CardHeader>
				<CardContent>
					<JsonEditor
						label="Graduate Profile"
						value={displayData?.graduateProfile ?? []}
						onChange={(v) => setField('graduateProfile', v)}
						readOnly={readOnly}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>
						Distribusi Mata Kuliah Per Semester
						{effectiveYear != null && (
							<span className="text-sm font-normal text-muted-foreground ml-2">
								— Kurikulum {effectiveYear}
							</span>
						)}
					</CardTitle>
					<CardDescription>
						Klik nama mata kuliah untuk melihat/mengedit detail & materi RPS.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{semesters.length > 0 || optionalSubjects.length > 0 ? (
						<Tabs defaultValue={defaultTab} className="w-full">
							<TabsList className="flex flex-wrap gap-1 h-auto">
								{semesters.map((s) => (
									<TabsTrigger key={s.semester} value={`sem-${s.semester}`} className="text-xs">
										Sem {s.semester}
									</TabsTrigger>
								))}
								{optionalSubjects.length > 0 && (
									<TabsTrigger value="optional" className="text-xs">Pilihan</TabsTrigger>
								)}
							</TabsList>

							{semesters.map((s, si) => (
								<TabsContent key={s.semester} value={`sem-${s.semester}`}>
									<SemesterSubjectTable
										subjects={s.subjects ?? []}
										totalSks={s.totalSks}
										semIdx={si}
										isOptional={false}
										allData={displayData}
										onChange={setField}
										readOnly={readOnly}
									/>
								</TabsContent>
							))}

							{optionalSubjects.length > 0 && (
								<TabsContent value="optional">
									<SemesterSubjectTable
										subjects={optionalSubjects}
										semIdx={-1}
										isOptional
										allData={displayData}
										onChange={setField}
										readOnly={readOnly}
									/>
								</TabsContent>
							)}
						</Tabs>
					) : (
						<p className="text-sm text-muted-foreground">Belum ada data kurikulum untuk tahun ini. Jalankan Sync Kurikulum untuk mengambil data.</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Accreditation Editor ───

function AccreditationEditor({
	data,
	onChange,
	readOnly,
}: {
	data: any;
	onChange: (f: string, v: any) => void;
	readOnly: boolean;
}) {
	const s3ManualUrl = data?.s3ManualUrl ?? '';
	const levels = [
		{ key: 's1', label: 'S1' },
		{ key: 's2', label: 'S2' },
		{ key: 's3', label: 'S3' },
	] as const;
	const [activeLevel, setActiveLevel] = useState<'s1' | 's2' | 's3'>('s1');
	const levelData = data?.[activeLevel] ?? {};
	const setLevelField = (field: string, value: any) => {
		const next = {
			...(data || {}),
			[activeLevel]: {
				...(data?.[activeLevel] || {}),
				[field]: value,
			},
		};
		onChange(activeLevel, next[activeLevel]);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Konfigurasi S3</CardTitle>
					<CardDescription>
						URL ini opsional. Jika diisi, sync akreditasi akan pakai URL ini untuk data S3.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2">
					<Label htmlFor="accreditation-s3-manual-url">URL Akreditasi S3 (manual)</Label>
					<Input
						id="accreditation-s3-manual-url"
						value={s3ManualUrl}
						onChange={(e) => onChange('s3ManualUrl', e.target.value)}
						placeholder="https://informatika.uin-malang.ac.id/accreditation-certificate-for-doctoral-s3/"
						disabled={readOnly}
					/>
				</CardContent>
			</Card>

			<div className="grid gap-4 md:grid-cols-3">
				{levels.map((lvl) => {
					const levelData = data?.[lvl.key];
					return (
						<Card key={lvl.key}>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Akreditasi {lvl.label}</CardTitle>
							</CardHeader>
							<CardContent className="space-y-1 text-xs text-muted-foreground">
								<p>Dokumen: {(levelData?.items ?? []).length}</p>
								<p className="truncate">Sumber: {levelData?.sourceUrl || '—'}</p>
								{levelData?.lastError ? (
									<p className="text-destructive">Error: {levelData.lastError}</p>
								) : (
									<p>Status: OK</p>
								)}
							</CardContent>
						</Card>
					);
				})}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Edit Manual Data Akreditasi</CardTitle>
					<CardDescription>
						Pilih jenjang, lalu edit source/title/groups/items secara manual.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Select value={activeLevel} onValueChange={(v) => setActiveLevel(v as 's1' | 's2' | 's3')}>
						<SelectTrigger className="w-44">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{levels.map((lvl) => (
								<SelectItem key={lvl.key} value={lvl.key}>{lvl.label}</SelectItem>
							))}
						</SelectContent>
					</Select>

					<div className="grid gap-3 md:grid-cols-2">
						<div className="space-y-1">
							<Label>Judul</Label>
							<Input
								value={levelData?.title || ''}
								onChange={(e) => setLevelField('title', e.target.value)}
								disabled={readOnly}
							/>
						</div>
						<div className="space-y-1">
							<Label>Source URL</Label>
							<Input
								value={levelData?.sourceUrl || ''}
								onChange={(e) => setLevelField('sourceUrl', e.target.value)}
								disabled={readOnly}
								placeholder="https://..."
							/>
						</div>
					</div>

					<JsonEditor
						label={`Groups ${activeLevel.toUpperCase()}`}
						value={levelData?.groups ?? []}
						onChange={(v) => setLevelField('groups', v)}
						readOnly={readOnly}
					/>
					<JsonEditor
						label={`Items ${activeLevel.toUpperCase()}`}
						value={levelData?.items ?? []}
						onChange={(v) => setLevelField('items', v)}
						readOnly={readOnly}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Laboratory Editor ───

function LaboratoryEditor({ data, onChange, readOnly }: { data: any; onChange: (f: string, v: any) => void; readOnly: boolean }) {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Laboratorium Pengajaran</CardTitle>
				</CardHeader>
				<CardContent>
					<LabListEditor
						labKind="teaching"
						items={data.teaching ?? []}
						onChange={(v) => onChange('teaching', v)}
						readOnly={readOnly}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Laboratorium Riset</CardTitle>
				</CardHeader>
				<CardContent>
					<LabListEditor
						labKind="research"
						items={data.research ?? []}
						onChange={(v) => onChange('research', v)}
						readOnly={readOnly}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Reusable sub-components ───

function ListEditor({ items, onChange, readOnly, placeholder }: {
	items: string[];
	onChange: (v: string[]) => void;
	readOnly: boolean;
	placeholder?: string;
}) {
	const [newItem, setNewItem] = useState('');

	return (
		<div className="space-y-2">
			{items.map((item, i) => (
				<div key={i} className="flex gap-2 items-start">
					<span className="text-sm text-muted-foreground mt-2 w-6 text-right">{i + 1}.</span>
					<Textarea
						value={item}
						onChange={(e) => {
							const next = [...items];
							next[i] = e.target.value;
							onChange(next);
						}}
						disabled={readOnly}
						rows={2}
						className="flex-1"
					/>
					{!readOnly && (
						<Button
							variant="ghost"
							size="icon"
							className="shrink-0 text-destructive"
							onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
				</div>
			))}
			{!readOnly && (
				<div className="flex gap-2">
					<Input
						value={newItem}
						onChange={(e) => setNewItem(e.target.value)}
						placeholder={placeholder}
						className="flex-1"
						onKeyDown={(e) => {
							if (e.key === 'Enter' && newItem.trim()) {
								e.preventDefault();
								onChange([...items, newItem.trim()]);
								setNewItem('');
							}
						}}
					/>
					<Button
						variant="outline"
						size="icon"
						onClick={() => {
							if (newItem.trim()) {
								onChange([...items, newItem.trim()]);
								setNewItem('');
							}
						}}>
						<Plus className="h-4 w-4" />
					</Button>
				</div>
			)}
		</div>
	);
}

function MilestoneEditor({ items, onChange, readOnly }: {
	items: any[];
	onChange: (v: any[]) => void;
	readOnly: boolean;
}) {
	return (
		<div className="space-y-3">
			{items.map((item, i) => (
				<div key={i} className="flex gap-2 items-start">
					<Input
						value={item.year || ''}
						onChange={(e) => {
							const next = [...items];
							next[i] = { ...next[i], year: e.target.value };
							onChange(next);
						}}
						disabled={readOnly}
						className="w-20"
						placeholder="Tahun"
					/>
					<Input
						value={item.description || ''}
						onChange={(e) => {
							const next = [...items];
							next[i] = { ...next[i], description: e.target.value };
							onChange(next);
						}}
						disabled={readOnly}
						className="flex-1"
						placeholder="Deskripsi"
					/>
					{!readOnly && (
						<Button
							variant="ghost"
							size="icon"
							className="shrink-0 text-destructive"
							onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
				</div>
			))}
			{!readOnly && (
				<Button
					variant="outline"
					size="sm"
					onClick={() => onChange([...items, { year: '', description: '' }])}>
					<Plus className="h-4 w-4 mr-1" /> Tambah
				</Button>
			)}
		</div>
	);
}

function PersonListEditor({ items, onChange, readOnly, showAcademic }: {
	items: any[];
	onChange: (v: any[]) => void;
	readOnly: boolean;
	showAcademic?: boolean;
}) {
	return (
		<div className="space-y-3">
			{items.map((item, i) => (
				<div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
					<div className="flex gap-3 items-start">
						<ProdiMemberPhotoUpload
							photoUrl={item.photoUrl}
							profileUrl={item.profileUrl}
							nameFallback={item.name}
							nipFallback={item.nip}
							onUploaded={(url) => {
								const next = [...items];
								next[i] = { ...next[i], photoUrl: url };
								onChange(next);
							}}
							readOnly={readOnly}
						/>
						<div className="flex-1 space-y-2">
							<div className="flex gap-2 flex-wrap">
								<div className="flex-1 min-w-[200px]">
									<Label className="text-xs">Nama</Label>
									<Input
										value={item.name || ''}
										onChange={(e) => {
											const next = [...items];
											next[i] = { ...next[i], name: e.target.value };
											onChange(next);
										}}
										disabled={readOnly}
									/>
								</div>
								<div className="w-40">
									<Label className="text-xs">NIP</Label>
									<Input
										value={item.nip || ''}
										onChange={(e) => {
											const next = [...items];
											next[i] = { ...next[i], nip: e.target.value };
											onChange(next);
										}}
										disabled={readOnly}
									/>
								</div>
								{item.email !== undefined && (
									<div className="w-48">
										<Label className="text-xs">Email</Label>
										<Input
											value={item.email || ''}
											onChange={(e) => {
												const next = [...items];
												next[i] = { ...next[i], email: e.target.value };
												onChange(next);
											}}
											disabled={readOnly}
										/>
									</div>
								)}
							</div>
							<div>
								<Label className="text-xs">Profile URL (wajib untuk unggah foto)</Label>
								<Input
									value={item.profileUrl || ''}
									onChange={(e) => {
										const next = [...items];
										next[i] = { ...next[i], profileUrl: e.target.value };
										onChange(next);
									}}
									disabled={readOnly}
									placeholder="https://informatika.uin-malang.ac.id/..."
									className="text-xs"
								/>
							</div>
							<div>
								<Label className="text-xs">Foto URL (override)</Label>
								<Input
									value={item.photoUrl || ''}
									onChange={(e) => {
										const next = [...items];
										next[i] = { ...next[i], photoUrl: e.target.value };
										onChange(next);
									}}
									disabled={readOnly}
									placeholder="https://..."
									className="text-xs"
								/>
							</div>
						</div>
					</div>
					{showAcademic && (
						<div className="flex gap-2 flex-wrap text-xs">
							{item.googleScholar && (
								<a href={item.googleScholar} target="_blank" rel="noopener noreferrer"
									className="text-primary hover:underline flex items-center gap-1">
									Scholar <ExternalLink className="h-3 w-3" />
								</a>
							)}
							{item.scopusUrl && (
								<a href={item.scopusUrl} target="_blank" rel="noopener noreferrer"
									className="text-primary hover:underline flex items-center gap-1">
									Scopus <ExternalLink className="h-3 w-3" />
								</a>
							)}
							{item.orcidUrl && (
								<a href={item.orcidUrl} target="_blank" rel="noopener noreferrer"
									className="text-primary hover:underline flex items-center gap-1">
									ORCID <ExternalLink className="h-3 w-3" />
								</a>
							)}
						</div>
					)}
					{!readOnly && (
						<Button
							variant="ghost"
							size="sm"
							className="text-destructive"
							onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
							<Trash2 className="h-4 w-4 mr-1" /> Hapus
						</Button>
					)}
				</div>
			))}
			{!readOnly && (
				<Button
					variant="outline"
					size="sm"
					onClick={() =>
						onChange([...items, { name: '', nip: '', email: '', profileUrl: '', photoUrl: '' }])
					}>
					<Plus className="h-4 w-4 mr-1" /> Tambah
				</Button>
			)}
		</div>
	);
}

function LabListEditor({ labKind, items, onChange, readOnly }: {
	labKind: 'teaching' | 'research';
	items: any[];
	onChange: (v: any[]) => void;
	readOnly: boolean;
}) {
	return (
		<div className="space-y-3">
			{items.map((item, i) => {
				const imgs: string[] = item.imageUrls?.length ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
				const setLabImages = (urls: string[]) => {
					const next = [...items];
					next[i] = { ...next[i], imageUrls: urls, imageUrl: urls[0] || '' };
					onChange(next);
				};
				return (
					<div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
						<div className="flex gap-3 items-start">
							<div className="flex-1">
								<Label className="text-xs">Nama</Label>
								<Input
									value={item.name || ''}
									onChange={(e) => {
										const next = [...items];
										next[i] = { ...next[i], name: e.target.value };
										onChange(next);
									}}
									disabled={readOnly}
								/>
							</div>
						</div>
						{(imgs.length > 0 || !readOnly) && (
							<ProdiLabPhotoSlots
								labKind={labKind}
								labIndex={i}
								urls={imgs}
								readOnly={readOnly}
								onUrlsChange={setLabImages}
							/>
						)}
						<div>
							<Textarea
								value={(item.imageUrls?.length ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : [])).join('\n')}
								onChange={(e) => {
									const urls = e.target.value.split('\n').map((u: string) => u.trim()).filter(Boolean);
									const next = [...items];
									next[i] = { ...next[i], imageUrls: urls, imageUrl: urls[0] || '' };
									onChange(next);
								}}
								disabled={readOnly}
								rows={2}
								placeholder="URL manual (opsional, satu per baris)"
								className="text-xs font-mono"
								aria-label="URL gambar lab manual"
							/>
						</div>
						<div>
							<Label className="text-xs">Deskripsi</Label>
							<Textarea
								value={item.description || ''}
								onChange={(e) => {
									const next = [...items];
									next[i] = { ...next[i], description: e.target.value };
									onChange(next);
								}}
								disabled={readOnly}
								rows={3}
							/>
						</div>
						{!readOnly && (
							<Button
								variant="ghost"
								size="sm"
								className="text-destructive"
								onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
								<Trash2 className="h-4 w-4 mr-1" /> Hapus
							</Button>
						)}
					</div>
				);
			})}
			{!readOnly && (
				<Button
					variant="outline"
					size="sm"
					onClick={() => onChange([...items, { name: '', description: '', imageUrl: '', imageUrls: [] }])}>
					<Plus className="h-4 w-4 mr-1" /> Tambah
				</Button>
			)}
		</div>
	);
}

function JsonEditor({ value, onChange, readOnly, label }: {
	value: any;
	onChange: (v: any) => void;
	readOnly: boolean;
	label: string;
}) {
	const [text, setText] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		setText(JSON.stringify(value, null, 2));
	}, [value]);

	const handleBlur = () => {
		try {
			const parsed = JSON.parse(text);
			setError('');
			onChange(parsed);
		} catch {
			setError('JSON tidak valid');
		}
	};

	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			<Textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				onBlur={handleBlur}
				disabled={readOnly}
				rows={12}
				className="font-mono text-xs"
			/>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}

function StudentHubResourceEditor({
	title,
	hub,
	mode,
	canEdit,
	canSync,
	onChange,
	onSync,
}: {
	title: string;
	hub: any;
	mode: 'skripsi' | 'pkl';
	canEdit: boolean;
	canSync: boolean;
	onChange: (next: any) => void;
	onSync: () => void;
}) {
	const data = hub || {};
	const docsKey = mode === 'skripsi' ? 'documents' : 'templates';
	const docs: { name: string; url: string }[] = Array.isArray(data[docsKey]) ? data[docsKey] : [];
	const subjects: any[] = Array.isArray(data.subjects) ? data.subjects : [];

	const patch = (partial: Record<string, any>) => onChange({ ...data, ...partial });

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
				<CardDescription>{data.hubUrl || 'Belum ada URL hub'}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div className="space-y-1">
						<Label>URL hub</Label>
						<Input
							value={data.hubUrl || ''}
							disabled={!canEdit}
							onChange={(e) => patch({ hubUrl: e.target.value })}
						/>
					</div>
					{mode === 'skripsi' && (
						<div className="space-y-1">
							<Label>Pedoman / SOP PDF</Label>
							<Input
								value={data.pedomanPdf || data.sopPdf || ''}
								disabled={!canEdit}
								onChange={(e) => patch({ pedomanPdf: e.target.value, sopPdf: e.target.value })}
							/>
						</div>
					)}
				</div>

				<div className="space-y-1">
					<Label>Intro (teks dari halaman resmi)</Label>
					<Textarea
						rows={5}
						disabled={!canEdit}
						value={data.intro || ''}
						onChange={(e) => patch({ intro: e.target.value })}
					/>
				</div>

				<div className="space-y-1">
					<Label>URL gambar alur (flowchart)</Label>
					<Input
						value={data.flowchartImageUrl || ''}
						disabled={!canEdit}
						placeholder="/uploads/prodi/skripsi/alur-skripsi.jpg"
						onChange={(e) => patch({ flowchartImageUrl: e.target.value })}
					/>
					{data.flowchartImageUrl ? (
						<img
							src={data.flowchartImageUrl}
							alt="Preview alur"
							className="mt-2 max-h-48 rounded border border-border object-contain"
						/>
					) : null}
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<Label>Mata kuliah / subjects ({subjects.length})</Label>
						{canEdit && (
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() =>
									patch({
										subjects: [
											...subjects,
											{
												name: 'Subject baru',
												code: '',
												credits: '',
												prerequisite: '',
												objectives: [],
												activities: [],
											},
										],
									})
								}>
								<Plus className="h-3.5 w-3.5 mr-1" /> Tambah subject
							</Button>
						)}
					</div>
					{subjects.map((sub, idx) => (
						<div key={idx} className="rounded-md border border-border p-3 space-y-2">
							<div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
								<Input
									placeholder="Nama subject"
									value={sub.name || ''}
									disabled={!canEdit}
									onChange={(e) => {
										const next = subjects.map((x, i) =>
											i === idx ? { ...x, name: e.target.value } : x,
										);
										patch({ subjects: next });
									}}
								/>
								{canEdit && (
									<Button
										type="button"
										size="icon"
										variant="ghost"
										onClick={() => patch({ subjects: subjects.filter((_, i) => i !== idx) })}>
										<Trash2 className="h-4 w-4 text-destructive" />
									</Button>
								)}
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
								<Input
									placeholder="Kode"
									value={sub.code || ''}
									disabled={!canEdit}
									onChange={(e) => {
										const next = subjects.map((x, i) =>
											i === idx ? { ...x, code: e.target.value } : x,
										);
										patch({ subjects: next });
									}}
								/>
								<Input
									placeholder="Credit / SKS"
									value={sub.credits || ''}
									disabled={!canEdit}
									onChange={(e) => {
										const next = subjects.map((x, i) =>
											i === idx ? { ...x, credits: e.target.value } : x,
										);
										patch({ subjects: next });
									}}
								/>
								<Input
									placeholder="Prerequisite"
									value={sub.prerequisite || ''}
									disabled={!canEdit}
									onChange={(e) => {
										const next = subjects.map((x, i) =>
											i === idx ? { ...x, prerequisite: e.target.value } : x,
										);
										patch({ subjects: next });
									}}
								/>
							</div>
							<Textarea
								rows={3}
								placeholder="Objectives (satu baris per item)"
								disabled={!canEdit}
								value={(sub.objectives || []).join('\n')}
								onChange={(e) => {
									const next = subjects.map((x, i) =>
										i === idx
											? {
													...x,
													objectives: e.target.value
														.split('\n')
														.map((s) => s.trim())
														.filter(Boolean),
												}
											: x,
									);
									patch({ subjects: next });
								}}
							/>
							<Textarea
								rows={3}
								placeholder="Activities (satu baris per item)"
								disabled={!canEdit}
								value={(sub.activities || []).join('\n')}
								onChange={(e) => {
									const next = subjects.map((x, i) =>
										i === idx
											? {
													...x,
													activities: e.target.value
														.split('\n')
														.map((s) => s.trim())
														.filter(Boolean),
												}
											: x,
									);
									patch({ subjects: next });
								}}
							/>
						</div>
					))}
				</div>

				{mode === 'pkl' && (
					<div className="space-y-1">
						<Label>Catatan (satu baris per catatan)</Label>
						<Textarea
							rows={4}
							disabled={!canEdit}
							value={(data.notes || []).join('\n')}
							onChange={(e) =>
								patch({
									notes: e.target.value
										.split('\n')
										.map((s) => s.trim())
										.filter(Boolean),
								})
							}
						/>
					</div>
				)}

				{mode === 'skripsi' && (
					<div className="space-y-1">
						<Label>Tahapan (satu baris per tahap)</Label>
						<Textarea
							rows={5}
							disabled={!canEdit}
							value={(data.steps || []).join('\n')}
							onChange={(e) =>
								patch({
									steps: e.target.value
										.split('\n')
										.map((s) => s.trim())
										.filter(Boolean),
								})
							}
						/>
					</div>
				)}

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<Label>{mode === 'skripsi' ? 'Dokumen' : 'Template'} ({docs.length})</Label>
						{canEdit && (
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() =>
									patch({
										[docsKey]: [...docs, { name: 'Dokumen baru', url: 'https://' }],
									})
								}>
								<Plus className="h-3.5 w-3.5 mr-1" /> Tambah
							</Button>
						)}
					</div>
					{docs.map((d, idx) => (
						<div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2">
							<Input
								placeholder="Nama"
								value={d.name || ''}
								disabled={!canEdit}
								onChange={(e) => {
									const next = docs.map((x, i) =>
										i === idx ? { ...x, name: e.target.value } : x,
									);
									patch({ [docsKey]: next });
								}}
							/>
							<Input
								placeholder="URL"
								value={d.url || ''}
								disabled={!canEdit}
								onChange={(e) => {
									const next = docs.map((x, i) =>
										i === idx ? { ...x, url: e.target.value } : x,
									);
									patch({ [docsKey]: next });
								}}
							/>
							{canEdit && (
								<Button
									type="button"
									size="icon"
									variant="ghost"
									onClick={() => patch({ [docsKey]: docs.filter((_, i) => i !== idx) })}>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							)}
						</div>
					))}
				</div>

				<div className="flex flex-wrap gap-2 items-center">
					<p className="text-xs text-muted-foreground">
						Subjects: {subjects.length} · Sections fallback: {(data.sections || []).length}
						{data.syncedAt
							? ` · sync ${new Date(data.syncedAt).toLocaleString('id-ID')}`
							: ''}
					</p>
					{canEdit && (data.sections || []).length > 0 && (
						<Button type="button" size="sm" variant="outline" onClick={() => patch({ sections: [] })}>
							Hapus semua sections
						</Button>
					)}
					{canSync && (
						<Button type="button" size="sm" variant="outline" onClick={onSync}>
							<RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync ulang
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function AnnouncementsEditor({
	items,
	canEdit,
	onChange,
}: {
	items: any[];
	canEdit: boolean;
	onChange: (next: any[]) => void;
}) {
	const list = Array.isArray(items) ? items : [];
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Daftar pengumuman ({list.length})</CardTitle>
				<CardDescription>Max 50 per kategori saat sync. Hapus item yang tidak relevan.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{!list.length && (
					<p className="text-sm text-muted-foreground">Belum ada item. Jalankan sync student hub.</p>
				)}
				{list.map((item, idx) => (
					<div
						key={(item.url || '') + idx}
						className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-2">
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium truncate">{item.title}</p>
							<p className="text-xs text-muted-foreground">
								{item.category || 'lainnya'} · {item.source || '-'}
								{item.publishedAt
									? ` · ${new Date(item.publishedAt).toLocaleDateString('id-ID')}`
									: ''}
							</p>
						</div>
						{canEdit && (
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={() => onChange(list.filter((_, i) => i !== idx))}>
								<Trash2 className="h-4 w-4 text-destructive" />
							</Button>
						)}
					</div>
				))}
			</CardContent>
		</Card>
	);
}
