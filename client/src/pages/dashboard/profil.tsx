import ContentEditor from '@/components/dashboard/content-editor';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import RichTextEditor from '@/components/dashboard/rich-text-editor';
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
import type { AboutPageLambangItem, AboutPageTrackRecordItem } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, FileEdit, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Settings {
	_id?: string;
	id?: number;
	aboutUs?: string;
	aboutPageTrackRecord?: AboutPageTrackRecordItem[];
	aboutPageLambang?: AboutPageLambangItem[];
	[key: string]: any;
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

export default function DashboardProfil() {
	const { hasSpecificPermission } = useAuth();
	const canEdit = hasSpecificPermission('profil.edit');
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [selectedTab, setSelectedTab] = useState('tentang-kami');
	const [isEditing, setIsEditing] = useState(false);
	const [isHeroEditing, setIsHeroEditing] = useState(false);

	usePermissionRefresh();

	const { hasPermission: hasAccess, isLoading: isPermissionLoading } =
		usePermissionGuardAny(['profil.view', 'profil.edit']);

	const { data: settings, isPending } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		refetchOnWindowFocus: false,
	});

	const [aboutUs, setAboutUs] = useState('');
	const [aboutPageTrackRecord, setAboutPageTrackRecord] = useState<AboutPageTrackRecordItem[]>([]);
	const [aboutPageLambang, setAboutPageLambang] = useState<AboutPageLambangItem[]>([]);
	const [initialized, setInitialized] = useState(false);

	if (settings && !initialized) {
		setAboutUs(settings.aboutUs || '');
		setAboutPageTrackRecord(settings.aboutPageTrackRecord?.length ? settings.aboutPageTrackRecord : defaultTrackRecord);
		setAboutPageLambang(settings.aboutPageLambang?.length ? settings.aboutPageLambang : defaultLambang);
		setInitialized(true);
	}

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
		updateMutation.mutate({
			...settings,
			aboutUs,
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

	if (isPermissionLoading) {
		return (
			<DashboardLayout title="Dashboard Profil">
				<div className="flex items-center justify-center h-64">
					<Loader2 className="h-6 w-6 animate-spin" />
					<span className="ml-2">Memuat...</span>
				</div>
			</DashboardLayout>
		);
	}

	if (!hasAccess) return null;

	return (
		<DashboardLayout title="Dashboard Profil">
			<div className="space-y-6">
				<div className="flex justify-between items-center">
					<div>
						<h2 className="text-2xl font-bold">Profil Himpunan</h2>
						<p className="text-muted-foreground text-sm mt-1">
							Kelola konten halaman{' '}
							<a href="/profil" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
								/profil <ExternalLink className="h-3 w-3" />
							</a>
						</p>
					</div>
				<div className="flex gap-2">
					{selectedTab !== 'hero-warna' && (
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

				{isPending ? (
					<div className="text-center p-8 text-muted-foreground">Memuat data...</div>
				) : (
				<Tabs value={selectedTab} onValueChange={(v) => { setSelectedTab(v); setIsEditing(false); setIsHeroEditing(false); }}>
					<TabsList>
						<TabsTrigger value="tentang-kami">Tentang Kami</TabsTrigger>
						<TabsTrigger value="sejarah">Sejarah</TabsTrigger>
						<TabsTrigger value="filosofi">Filosofi</TabsTrigger>
						<TabsTrigger value="hero-warna">Hero &amp; Warna</TabsTrigger>
					</TabsList>

						{/* Tab Tentang Kami */}
						<TabsContent value="tentang-kami" className="space-y-4 mt-4">
							<Card>
								<CardHeader>
									<CardTitle>Tentang Kami</CardTitle>
									<CardDescription>
										Konten ini ditampilkan di bagian "Tentang Kami" pada halaman /profil dan beranda.
									</CardDescription>
								</CardHeader>
								<CardContent>
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
							<Card>
								<CardHeader>
									<CardTitle>Sejarah — Track Record Ketua & Divisi</CardTitle>
									<CardDescription>
										Daftar rekam jejak ketua himpunan dan divisi per tahun.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{isEditing ? (
										<div className="space-y-3">
											{aboutPageTrackRecord.map((row, idx) => (
												<div key={idx} className="flex flex-wrap gap-2 items-start p-3 border rounded-md bg-muted/30">
													<Input
														placeholder="Tahun"
														value={row.year}
														onChange={(e) => updateTrackRecordRow(idx, 'year', e.target.value)}
														className="w-20"
													/>
													<Input
														placeholder="Nama Ketua"
														value={row.chairpersonName}
														onChange={(e) => updateTrackRecordRow(idx, 'chairpersonName', e.target.value)}
														className="flex-1 min-w-[180px]"
													/>
													<Input
														placeholder="Divisi (pisah koma)"
														value={Array.isArray(row.divisions) ? row.divisions.join(', ') : ''}
														onChange={(e) =>
															updateTrackRecordRow(idx, 'divisions', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
														}
														className="flex-1 min-w-[200px]"
													/>
													<Button
														variant="ghost"
														size="icon"
														onClick={() => setAboutPageTrackRecord((prev) => prev.filter((_, i) => i !== idx))}
														className="text-destructive hover:text-destructive">
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											))}
											<Button
												variant="outline"
												size="sm"
												onClick={() => setAboutPageTrackRecord((prev) => [...prev, { year: '', chairpersonName: '', divisions: [] }])}>
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
							<Card>
								<CardHeader>
									<CardTitle>Filosofi Lambang</CardTitle>
									<CardDescription>
										Makna dan filosofi dari setiap elemen lambang himpunan.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{isEditing ? (
										<div className="space-y-4">
											{aboutPageLambang.map((item, idx) => (
												<div key={idx} className="p-4 border rounded-md bg-muted/20 space-y-3">
													<div className="flex gap-4 items-start">
														<div className="flex-shrink-0">
															<div className="w-24 h-24 rounded-lg overflow-hidden bg-muted border flex items-center justify-center">
																<img
																	src={item.imageUrl || `/attached_assets/filosofi/${item.key}.png`}
																	alt={item.title}
																	className="w-full h-full object-contain"
																	onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
																/>
															</div>
															<Input
																type="file"
																accept="image/*"
																className="mt-2 text-xs"
																onChange={(ev) => {
																	const f = ev.target.files?.[0];
																	if (f) handleFilosofiUpload(item.key, f);
																	ev.target.value = '';
																}}
															/>
														</div>
														<div className="flex-1 min-w-0 space-y-2">
															<Label className="text-xs">Judul</Label>
															<Input
																value={item.title}
																onChange={(e) => updateLambangItem(idx, 'title', e.target.value)}
															/>
															<Label className="text-xs">Deskripsi</Label>
															<Textarea
																value={item.description}
																onChange={(e) => updateLambangItem(idx, 'description', e.target.value)}
																rows={3}
																className="resize-none"
															/>
														</div>
													</div>
												</div>
											))}
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
						{/* Tab Hero & Warna Divisi */}
						<TabsContent value="hero-warna" className="space-y-4 mt-4">
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
		</DashboardLayout>
	);
}
