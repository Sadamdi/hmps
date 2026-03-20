import DashboardLayout from '@/components/dashboard/dashboard-layout';
import RichTextEditor from '@/components/dashboard/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
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
	CheckCircle2,
	ExternalLink,
	FlaskConical,
	GraduationCap,
	ImageIcon,
	Loader2,
	Pencil,
	Plus,
	RefreshCw,
	Save,
	Trash2,
	Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
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
	const [localContent, setLocalContent] = useState<any>(null);
	const [dirty, setDirty] = useState(false);

	useEffect(() => {
		if (doc) {
			setAutoSync(doc.autoSyncEnabled ?? true);
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

	const syncMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest('POST', '/api/prodi/sync/run');
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(body.message || body.summary?.error || 'Sinkronisasi gagal');
			}
			return body;
		},
		onSuccess: (data: { message?: string; summary?: Record<string, number> }) => {
			const s = data.summary;
			const desc = s
				? `Sejarah ~${s.profileHistoryLen} karakter, dosen ${s.lecturerLinks}, semester ${s.semestersCount}, MK pilihan ${s.optionalSubjectsCount}, lab ${s.teachingLabs + s.researchLabs}.`
				: (data.message ?? 'Selesai');
			toast({ title: data.message || 'Sinkronisasi selesai', description: desc });
			queryClient.invalidateQueries({ queryKey: ['/api/prodi/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/prodi'] });
		},
		onError: (err: any) => {
			toast({ title: 'Error', description: err?.message || 'Gagal menjalankan sinkronisasi', variant: 'destructive' });
		},
	});

	const handleSave = useCallback(() => {
		if (!canEdit) return;
		const payload: any = { autoSyncEnabled: autoSync };
		if (localContent) payload.content = localContent;
		saveMutation.mutate(payload);
	}, [canEdit, autoSync, localContent, saveMutation]);

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

	if (isLoading || !localContent) {
		return (
			<DashboardLayout title="Prodi">
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
		<DashboardLayout title="Prodi">
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
							<Button
								variant="outline"
								onClick={() => syncMutation.mutate()}
								disabled={syncMutation.isPending || syncStatus === 'syncing'}>
								<RefreshCw className={`h-4 w-4 mr-2 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
								{syncStatus === 'syncing' ? 'Sedang Sync...' : 'Sync Sekarang'}
							</Button>
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
					<TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
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
					</TabsList>

					<TabsContent value="profil" className="space-y-6 mt-6">
						<ProfileEditor
							data={localContent.profile ?? {}}
							onChange={(field, val) => updateField('profile', field, val)}
							readOnly={!canEdit}
						/>
					</TabsContent>

					<TabsContent value="dosen" className="space-y-6 mt-6">
						<LecturerEditor
							data={localContent.lecturers ?? {}}
							onChange={(field, val) => updateField('lecturers', field, val)}
							readOnly={!canEdit}
						/>
					</TabsContent>

					<TabsContent value="kurikulum" className="space-y-6 mt-6">
						<CurriculumEditor
							data={localContent.curriculum ?? {}}
							onChange={(field, val) => updateField('curriculum', field, val)}
							readOnly={!canEdit}
						/>
					</TabsContent>

					<TabsContent value="laboratorium" className="space-y-6 mt-6">
						<LaboratoryEditor
							data={localContent.laboratories ?? {}}
							onChange={(field, val) => updateField('laboratories', field, val)}
							readOnly={!canEdit}
						/>
					</TabsContent>
				</Tabs>
			</div>
		</DashboardLayout>
	);
}

/** Sama dengan halaman publik `/prodi` — untuk path upload `lecturers/{slug}.webp`. */
function slugFromProfileUrl(profileUrl: string): string {
	if (!profileUrl) return '';
	const parts = profileUrl.replace(/\/+$/, '').split('/');
	return parts[parts.length - 1] || '';
}

function ProdiMemberPhotoUpload({
	photoUrl,
	profileUrl,
	onUploaded,
	readOnly,
	sizeClass = 'w-12 h-12 rounded-full',
}: {
	photoUrl?: string;
	profileUrl?: string;
	onUploaded: (url: string) => void;
	readOnly?: boolean;
	sizeClass?: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const { toast } = useToast();
	const slug = slugFromProfileUrl(profileUrl || '');
	const canUpload = !readOnly && !!slug;

	const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file || !slug) return;
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append('image', file);
			fd.append('slug', slug);
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
						: 'Isi Profile URL terlebih dahulu agar unggah aktif'
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

// ─── Profile Editor ───

function ProfileEditor({ data, onChange, readOnly }: { data: any; onChange: (f: string, v: any) => void; readOnly: boolean }) {
	return (
		<div className="space-y-6">
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
											<Label className="text-xs">Profile URL (wajib untuk unggah foto)</Label>
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
	const slug = deriveSlugFromUrl(subject?.rpsUrl || '');
	const resources = (allData.subjectRpsResources ?? []).find(
		(r: any) => (r.slug || '').toLowerCase() === slug,
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
		const idx = rps.findIndex((r: any) => (r.slug || '').toLowerCase() === slug);
		const entry = {
			slug,
			subjectName: subject?.name || '',
			materiPpt: materiPptNew,
			linkFile: linkFileNew,
			parsedAt: new Date().toISOString(),
		};
		if (idx >= 0) {
			rps[idx] = { ...rps[idx], ...entry };
		} else if (slug) {
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

					{slug && (
						<>
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
						</>
					)}
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
					{totalSks && (
						<tfoot>
							<tr className="border-t bg-muted/50 font-semibold">
								<td colSpan={3} className="p-2 text-right">Total SKS</td>
								<td className="p-2 text-center">{totalSks}</td>
								<td colSpan={readOnly ? 1 : 2} />
							</tr>
						</tfoot>
					)}
				</table>
			</div>

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

function CurriculumEditor({ data, onChange, readOnly }: { data: any; onChange: (f: string, v: any) => void; readOnly: boolean }) {
	const semesters: any[] = data.semesters ?? [];
	const optionalSubjects: any[] = data.optionalSubjects ?? [];
	const defaultTab = semesters.length ? `sem-${semesters[0]?.semester ?? 1}` : 'optional';

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Struktur Kurikulum</CardTitle>
				</CardHeader>
				<CardContent>
					<Textarea
						value={data.structureSummary || ''}
						onChange={(e) => onChange('structureSummary', e.target.value)}
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
						items={data.knowledgeGroups ?? []}
						onChange={(v) => onChange('knowledgeGroups', v)}
						readOnly={readOnly}
						placeholder="Tambah kelompok keilmuan..."
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Distribusi Mata Kuliah Per Semester</CardTitle>
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
										allData={data}
										onChange={onChange}
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
										allData={data}
										onChange={onChange}
										readOnly={readOnly}
									/>
								</TabsContent>
							)}
						</Tabs>
					) : (
						<p className="text-sm text-muted-foreground">Belum ada data kurikulum. Jalankan Sync untuk mengambil data.</p>
					)}
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
						{item.photoUrl && (
							<img
								src={item.photoUrl}
								alt={item.name}
								className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
								onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
							/>
						)}
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

function LabListEditor({ items, onChange, readOnly }: {
	items: any[];
	onChange: (v: any[]) => void;
	readOnly: boolean;
}) {
	return (
		<div className="space-y-3">
			{items.map((item, i) => (
				<div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
					<div className="flex gap-3 items-start">
						{item.imageUrl && (
							<img
								src={item.imageUrl}
								alt={item.name}
								className="w-20 h-14 rounded object-cover border border-border shrink-0"
								onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
							/>
						)}
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
					<div>
						<Label className="text-xs">Gambar URL (override)</Label>
						<Input
							value={item.imageUrl || ''}
							onChange={(e) => {
								const next = [...items];
								next[i] = { ...next[i], imageUrl: e.target.value };
								onChange(next);
							}}
							disabled={readOnly}
							placeholder="https://..."
							className="text-xs"
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
			))}
			{!readOnly && (
				<Button
					variant="outline"
					size="sm"
					onClick={() => onChange([...items, { name: '', description: '', imageUrl: '' }])}>
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
