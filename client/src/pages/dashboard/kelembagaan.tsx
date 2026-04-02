import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import OrganizationStructureEditor from '@/components/dashboard/organization-structure-editor';
import RichTextEditor from '@/components/dashboard/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { useTenant } from '@/lib/tenant-context';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, FileEdit, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Settings {
	_id?: string;
	id?: number;
	visionMission?: string;
}

const DEFAULT_VISION_MISSION = `VISI MISI

- VISI
Mewujudkan Himpunan Mahasiswa Teknik Informatika yang berintegritas, progresif, dan adaptif sebagai wadah kolaborasi yang responsif, transparan, partisipatif, menjunjung tinggi nilai kekeluargaan, menciptakan lingkungan yang harmonis, inovatif, dan berorientasi pada kemajuan berkelanjutan.

- MISI
* Meningkatkan lingkungan yang kondusif untuk dialog terbuka, penguatan solidaritas, dan pengamalan kepedulian kolektif, dengan semangat kebersamaan untuk mendukung hubungan yang harmonis dan produktif antar anggota.
* Mengintegrasikan nilai-nilai budaya lokal, nasional, dan profesionalisme dalam setiap program kerja, menumbuhkan kesadaran akan tanggung jawab sosial, meningkatkan kompetensi akademik, soft skills, kepemimpinan, dan inovasi teknologi melalui berbagai kegiatan produktif.
* Mengoptimalkan peran Himpunan sebagai wadah pemberdayaan anggota dengan memberikan perhatian terhadap aspirasi, memfasilitasi pengembangan diri, dan menciptakan jaringan kolaborasi yang efektif dengan berbagai pihak untuk mendorong kontribusi aktif dalam pembangunan dan pengembangan organisasi.`;

export default function DashboardKelembagaan() {
	const { hasSpecificPermission } = useAuth();
	const { isTenant, basePath } = useTenant();
	const canEdit = hasSpecificPermission('kelembagaan.edit');
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [selectedTab, setSelectedTab] = useState('visi-misi');
	const [isEditing, setIsEditing] = useState(false);
	const [visionMission, setVisionMission] = useState('');
	// Tracks whether user has started editing — prevents query refetch from overwriting input
	const isEditingRef = useRef(false);

	usePermissionRefresh();

	const { hasPermission: hasAccess, isLoading: isPermissionLoading } =
		usePermissionGuardAny(['kelembagaan.view', 'kelembagaan.edit']);

	const { data: settings, isPending } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		refetchOnWindowFocus: false,
	});

	// Sync visionMission from settings once loaded; prefill default if empty
	useEffect(() => {
		if (settings !== undefined && !isEditingRef.current) {
			setVisionMission(settings.visionMission || DEFAULT_VISION_MISSION);
		}
	}, [settings]);

	const updateMutation = useMutation({
		mutationFn: async (updatedSettings: Partial<Settings>) => {
			return await apiRequest('PUT', '/api/settings', updatedSettings);
		},
		onSuccess: async () => {
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			try {
				await logActivity(ActivityTemplates.contentUpdated('Visi & Misi'));
			} catch (e) {
				console.warn('Failed to log activity:', e);
			}
			toast({ title: 'Berhasil disimpan', description: 'Perubahan telah disimpan.' });
			isEditingRef.current = false;
			setIsEditing(false);
		},
		onError: () => {
			toast({ title: 'Gagal menyimpan', description: 'Terjadi kesalahan.', variant: 'destructive' });
		},
	});

	const handleSave = () => {
		updateMutation.mutate({ ...settings, visionMission });
	};

	if (isPermissionLoading) {
		return (
			<DashboardLayout title="Dashboard Kelembagaan">
				<div className="flex items-center justify-center h-64">
					<Loader2 className="h-6 w-6 animate-spin" />
					<span className="ml-2">Memuat...</span>
				</div>
			</DashboardLayout>
		);
	}

	if (!hasAccess) return null;

	return (
		<DashboardLayout title="Dashboard Kelembagaan">
			<div className="space-y-6">
				<div className="flex justify-between items-center">
					<div>
						<h2 className="text-2xl font-bold">Kelembagaan</h2>
						<p className="text-muted-foreground text-sm mt-1">
							Kelola konten halaman{' '}
							<a href="/kelembagaan" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
								/kelembagaan <ExternalLink className="h-3 w-3" />
							</a>
						</p>
					</div>
					{selectedTab === 'visi-misi' && (
						<div className="flex gap-2">
						{isEditing ? (
							<>
								<Button variant="outline" onClick={() => { isEditingRef.current = false; setIsEditing(false); }} size="sm">
									<ArrowLeft className="mr-2 h-4 w-4" />
									Batal
								</Button>
								<Button onClick={handleSave} size="sm" disabled={updateMutation.isPending}>
									{updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
									Simpan
								</Button>
							</>
						) : canEdit ? (
							<Button onClick={() => { isEditingRef.current = true; setIsEditing(true); }} size="sm">
								<FileEdit className="mr-2 h-4 w-4" />
								Edit Konten
							</Button>
						) : null}
						</div>
					)}
				</div>

				<DashboardHintCard
					title="Cara memakai Kelembagaan"
					variant="blue"
					storageKey="dashboard-kelembagaan"
					description="Tab Visi & Misi menyimpan HTML rich text. Tab Struktur memakai periode kepengurusan (format tahun seperti 2024–2025), divisi, posisi, dan anggota. Tanpa simpan, perubahan hilang.">
					<ul className="list-disc list-inside space-y-1.5 text-sm">
						<li>
							<strong>Langkah visi-misi</strong>: buka tab → Edit → ikuti blok <strong>VISI</strong> / <strong>MISI</strong> di petunjuk format → simpan.
						</li>
						<li>
							<strong>Langkah struktur</strong>: pilih periode aktif → tambah divisi/posisi bila perlu → tambah anggota dengan nama dan jabatan → unggah foto sesuai form → simpan per blok jika diminta.
						</li>
						<li>
							<strong>Contoh valid (periode)</strong>: <code className="text-xs bg-muted px-1 rounded">2025-2026</code> atau label yang konsisten dengan struktur organisasi; anggota terhubung ke divisi yang ada.
						</li>
						<li>
							<strong>Contoh tidak valid</strong>: menyimpan visi kosong jika wajib diisi; memasukkan anggota tanpa periode yang dipilih; file foto terlalu besar atau format ditolak.
						</li>
						<li>
							<strong>Jika gagal</strong>: cek toast; pastikan periode sudah dibuat sebelum menambah anggota; refresh jika data struktur tidak sinkron.
						</li>
						<li>
							<strong>Pratinjau</strong>:{' '}
							{isTenant ? (
								<>halaman <code className="text-xs bg-muted px-1 rounded">{basePath || ''}/kelembagaan</code></>
							) : (
								<code className="text-xs bg-muted px-1 rounded">/kelembagaan</code>
							)}
							.
						</li>
						<li>
							<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">kelembagaan.edit</code> untuk mengubah visi-misi dan struktur.
						</li>
					</ul>
				</DashboardHintCard>

				{isPending ? (
					<div className="text-center p-8 text-muted-foreground">Memuat data...</div>
				) : (
					<Tabs value={selectedTab} onValueChange={(v) => { setSelectedTab(v); isEditingRef.current = false; setIsEditing(false); }}>
						<TabsList>
							<TabsTrigger value="visi-misi">Visi &amp; Misi</TabsTrigger>
							<TabsTrigger value="struktur">Struktur Organisasi</TabsTrigger>
						</TabsList>

						{/* Tab Visi & Misi */}
						<TabsContent value="visi-misi" className="space-y-4 mt-4">
							<Card>
								<CardHeader>
									<CardTitle>Visi &amp; Misi</CardTitle>
									<CardDescription>
										Konten ini ditampilkan di halaman /kelembagaan dan beranda.
									</CardDescription>
								</CardHeader>
								<CardContent>
									{isEditing ? (
										<div className="space-y-4">
											<DashboardHintCard
												title="Petunjuk Format Visi & Misi"
												variant="blue"
												storageKey="dashboard-kelembagaan-visi-format"
												description="Gunakan kerangka ini di editor agar heading dan bullet konsisten di halaman publik. Anda boleh menyesuaikan teks; jangan hapus label VISI/MISI jika tim desain memerlukannya.">
												<ul className="list-disc list-inside space-y-1.5 text-sm mb-3">
													<li>
														<strong>Contoh valid</strong>: baris judul <code className="text-xs bg-muted px-1 rounded">VISI MISI</code>, lalu <code className="text-xs bg-muted px-1 rounded">- VISI</code> diikuti satu paragraf; <code className="text-xs bg-muted px-1 rounded">- MISI</code> diikuti daftar <code className="text-xs bg-muted px-1 rounded">*</code> per poin.
													</li>
													<li>
														<strong>Contoh kurang rapi</strong>: hanya paste dari Word tanpa baris baru—bisa merusak jarak; gunakan Enter dan bullet di editor.
													</li>
													<li>
														<strong>Jika tampilan aneh</strong>: bersihkan format (hapus style aneh), simpan, lalu cek pratinjau publik.
													</li>
												</ul>
												<pre className="text-xs bg-muted p-2 rounded mt-1 text-foreground overflow-auto">
{`VISI MISI

- VISI
[Tuliskan visi organisasi di sini]

- MISI
* [Poin misi pertama]
* [Poin misi kedua]
* [Dan seterusnya...]`}
												</pre>
											</DashboardHintCard>
											<RichTextEditor
												value={visionMission}
												onChange={setVisionMission}
												placeholder="Tulis konten visi dan misi di sini..."
												height={350}
												beritaId="vision-mission-content"
											/>
										</div>
									) : settings?.visionMission ? (
										<div className="prose max-w-none border rounded-md p-4 bg-muted/30">
											<div dangerouslySetInnerHTML={{ __html: settings.visionMission }} />
										</div>
									) : (
										<p className="text-muted-foreground italic">Belum ada konten. Klik Edit untuk mengisi.</p>
									)}
								</CardContent>
							</Card>
						</TabsContent>

					{/* Tab Struktur Organisasi */}
					<TabsContent value="struktur" className="space-y-4 mt-4">
						<OrganizationStructureEditor />
					</TabsContent>
					</Tabs>
				)}
			</div>
		</DashboardLayout>
	);
}
