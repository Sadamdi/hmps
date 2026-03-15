import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import RichTextEditor from './rich-text-editor';
import type { AboutPageLambangItem, AboutPageTrackRecordItem } from '@/shared/schema';

interface Settings {
	_id?: string;
	id?: number;
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	aboutUs: string;
	visionMission: string;
	contactEmail: string;
	address: string;
	enableRegistration: boolean;
	maintenanceMode: boolean;
	footerText: string;
	logoUrl: string;
	chairpersonPhoto?: string;
	chairpersonName?: string;
	chairpersonTitle?: string;
	viceChairpersonPhoto?: string;
	viceChairpersonName?: string;
	viceChairpersonTitle?: string;
	divisionHeads?: Record<string, { name: string; photo: string }>;
	divisionLogos?: Record<string, string>;
	divisionNames?: Record<string, string>;
	divisionColors: Record<string, string>;
	socialLinks: {
		facebook: string;
		twitter: string;
		instagram: string;
		youtube: string;
	};
	aboutPageTrackRecord?: AboutPageTrackRecordItem[];
	aboutPageLambang?: AboutPageLambangItem[];
}

interface ContentEditorProps {
	settings: Settings | undefined;
	onSave: () => void;
	onCancel: () => void;
}

export default function ContentEditor({
	settings,
	onSave,
	onCancel,
}: ContentEditorProps) {
	const [aboutUs, setAboutUs] = useState(settings?.aboutUs || '');
	const [visionMission, setVisionMission] = useState(
		settings?.visionMission || ''
	);
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

	const [aboutPageTrackRecord, setAboutPageTrackRecord] = useState<
		AboutPageTrackRecordItem[]
	>(settings?.aboutPageTrackRecord?.length ? settings.aboutPageTrackRecord : defaultTrackRecord);
	const [aboutPageLambang, setAboutPageLambang] = useState<
		AboutPageLambangItem[]
	>(settings?.aboutPageLambang?.length ? settings.aboutPageLambang : defaultLambang);
	const [selectedTab, setSelectedTab] = useState('about');
	const [logoUrl, setLogoUrl] = useState(
		settings?.logoUrl ||
			'/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp'
	);
	const [divisionLogos, setDivisionLogos] = useState(
		settings?.divisionLogos || {
			akademik: '/uploads/logo-akademik.png',
			humas: '/uploads/logo-humas.png',
			pengembangan: '/uploads/logo-pengembangan.png',
			media: '/uploads/logo-media.png',
			keuangan: '/uploads/logo-keuangan.png',
			acara: '/uploads/logo-acara.png',
		}
	);
	const [divisionColors, setDivisionColors] = useState(
		settings?.divisionColors || {
			senor: 'rgba(255, 152, 0, 0.75)',
			religius: 'rgba(76, 175, 80, 0.75)',
			public_relation: 'rgba(156, 39, 176, 0.75)',
			medinfo: 'rgba(0, 188, 212, 0.75)',
			technopreneurship: 'rgba(33, 150, 243, 0.75)',
			intelektual: 'rgba(89, 58, 69, 0.75)',
			leadership: 'rgba(33, 150, 243, 0.75)',
		}
	);

	const queryClient = useQueryClient();
	const { toast } = useToast();

	const updateMutation = useMutation({
		mutationFn: async (updatedSettings: any) => {
			return await apiRequest('PUT', '/api/settings', updatedSettings);
		},
		onSuccess: async () => {
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });

			// Log activity based on which tab was being edited
			try {
				if (selectedTab === 'about') {
					await logActivity(ActivityTemplates.contentUpdated('Tentang Kami'));
				} else if (selectedTab === 'about-page') {
					await logActivity(ActivityTemplates.contentUpdated('Halaman Tentang Kami'));
				} else if (selectedTab === 'vision') {
					await logActivity(ActivityTemplates.contentUpdated('Visi & Misi'));
				} else if (selectedTab === 'hero') {
					await logActivity(ActivityTemplates.contentUpdated('Hero Section'));
				} else if (selectedTab === 'colors') {
					await logActivity(ActivityTemplates.contentUpdated('Warna Divisi'));
				} else {
					await logActivity(ActivityTemplates.contentUpdated('Konten Halaman'));
				}
			} catch (error) {
				console.warn('Failed to log activity:', error);
			}

			toast({
				title: 'Konten berhasil diperbarui',
				description: 'Perubahan telah disimpan.',
			});
			onSave();
		},
		onError: (error) => {
			console.error('Error updating settings:', error);
			toast({
				title: 'Gagal memperbarui konten',
				description: 'Terjadi kesalahan saat menyimpan perubahan.',
				variant: 'destructive',
			});
		},
	});

	const handleSave = () => {
		const updatedSettings = {
			...settings,
			aboutUs,
			visionMission,
			// Sejarah di /tentang-kami memakai aboutUs yang sama (edit sekali di tab Tentang Kami)
			aboutPageTrackRecord,
			aboutPageLambang,
			logoUrl: hero.logoUrl,
			chairpersonPhoto: hero.chairpersonPhoto,
			chairpersonName: hero.chairpersonName,
			chairpersonTitle: hero.chairpersonTitle,
			viceChairpersonPhoto: hero.viceChairpersonPhoto,
			viceChairpersonName: hero.viceChairpersonName,
			viceChairpersonTitle: hero.viceChairpersonTitle,
			divisionHeads: hero.divisionHeads,
			divisionLogos: hero.divisionLogos,
			divisionNames: hero.divisionNames,
			divisionColors,
		};
		updateMutation.mutate(updatedSettings);
	};

	const handleLogoChange = async (file: File) => {
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('category', 'organization'); // Kategori untuk logo himpunan

			// Kirim URL logo lama untuk dihapus
			if (logoUrl && logoUrl !== '') {
				formData.append('oldFileUrl', logoUrl);
			}

			const response = await fetch('/api/upload', {
				method: 'POST',
				body: formData,
			});

			if (response.ok) {
				const data = await response.json();
				setLogoUrl(data.url);
				toast({
					title: 'Success',
					description: 'Logo berhasil diupload',
				});
			} else {
				throw new Error('Upload failed');
			}
		} catch (error) {
			console.error('Error uploading logo:', error);
			toast({
				title: 'Error',
				description: 'Gagal mengupload logo. Silakan coba lagi.',
				variant: 'destructive',
			});
		}
	};

	const handleDivisionLogoChange = async (division: string, file: File) => {
		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch('/api/upload', {
				method: 'POST',
				body: formData,
			});

			if (response.ok) {
				const data = await response.json();
				setDivisionLogos((prev) => ({
					...prev,
					[division]: data.url,
				}));
				toast({
					title: 'Success',
					description: `Logo divisi ${division} berhasil diupload`,
				});
			} else {
				throw new Error('Upload failed');
			}
		} catch (error) {
			console.error('Error uploading division logo:', error);
			toast({
				title: 'Error',
				description: 'Gagal mengupload logo divisi. Silakan coba lagi.',
				variant: 'destructive',
			});
		}
	};

	const handleColorChange = (key: string, value: string) => {
		setDivisionColors((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	const handlePreview = (content: string) => {
		// Create a popup window with the content preview
		const previewWindow = window.open('', '_blank', 'width=800,height=600');
		if (previewWindow) {
			previewWindow.document.write(`
        <html>
          <head>
            <title>Preview</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
              h1, h2, h3 { color: #2563eb; }
              ul, ol { margin-left: 20px; }
              li { margin-bottom: 8px; }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `);
			previewWindow.document.close();
		}
	};

	const divisionList = [
		{ key: 'senor', label: 'Senor' },
		{ key: 'public_relation', label: 'Public Relation' },
		{ key: 'religius', label: 'Religius' },
		{ key: 'technopreneurship', label: 'Technopreneurship' },
		{ key: 'medinfo', label: 'Media Informasi' },
		{ key: 'intelektual', label: 'Intelektual' },
	];

	const [hero, setHero] = useState({
		logoUrl: settings?.logoUrl || '',
		chairpersonPhoto: settings?.chairpersonPhoto || '',
		chairpersonName: settings?.chairpersonName || '',
		chairpersonTitle: settings?.chairpersonTitle || 'Ketua Himpunan',
		viceChairpersonPhoto: settings?.viceChairpersonPhoto || '',
		viceChairpersonName: settings?.viceChairpersonName || '',
		viceChairpersonTitle: settings?.viceChairpersonTitle || 'Wakil Ketua',
		divisionHeads: settings?.divisionHeads || {},
		divisionLogos: settings?.divisionLogos || {},
		divisionNames: settings?.divisionNames || {},
	});

	const handleHeroImageChange = async (field: string, file: File) => {
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('category', 'content'); // Kategori untuk konten halaman

			// Kirim URL gambar lama untuk dihapus
			const oldImageUrl = hero[field as keyof typeof hero] as string;
			if (oldImageUrl && oldImageUrl !== '') {
				formData.append('oldFileUrl', oldImageUrl);
			}

			const response = await fetch('/api/upload', {
				method: 'POST',
				body: formData,
			});
			if (response.ok) {
				const data = await response.json();
				setHero((prev) => ({ ...prev, [field]: data.url }));
				toast({ title: 'Success', description: 'Gambar berhasil diupload' });
			} else {
				throw new Error('Upload failed');
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Gagal upload gambar',
				variant: 'destructive',
			});
		}
	};

	const handleHeroDivisionHeadChange = async (
		divKey: string,
		field: string,
		value: string | File
	) => {
		if (field === 'photo' && value instanceof File) {
			try {
				const formData = new FormData();
				formData.append('file', value);
				formData.append('category', 'organization'); // Kategori untuk foto kepala divisi

				// Kirim URL foto lama untuk dihapus
				const oldPhotoUrl = hero.divisionHeads?.[divKey]?.photo;
				if (oldPhotoUrl && oldPhotoUrl !== '') {
					formData.append('oldFileUrl', oldPhotoUrl);
				}

				const response = await fetch('/api/upload', {
					method: 'POST',
					body: formData,
				});
				if (response.ok) {
					const data = await response.json();
					setHero((prev) => ({
						...prev,
						divisionHeads: {
							...prev.divisionHeads,
							[divKey]: {
								...prev.divisionHeads?.[divKey],
								photo: data.url,
							},
						},
					}));
					toast({
						title: 'Success',
						description: 'Foto kepala divisi berhasil diupload',
					});
				} else {
					throw new Error('Upload failed');
				}
			} catch (error) {
				toast({
					title: 'Error',
					description: 'Gagal upload foto kepala divisi',
					variant: 'destructive',
				});
			}
		} else {
			setHero((prev) => ({
				...prev,
				divisionHeads: {
					...prev.divisionHeads,
					[divKey]: {
						...prev.divisionHeads?.[divKey],
						[field]: value,
					},
				},
			}));
		}
	};

	const handleHeroDivisionLogoChange = async (divKey: string, file: File) => {
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('category', 'organization'); // Kategori untuk logo divisi

			// Kirim URL logo lama untuk dihapus
			const oldLogoUrl = hero.divisionLogos?.[divKey];
			if (oldLogoUrl && oldLogoUrl !== '') {
				formData.append('oldFileUrl', oldLogoUrl);
			}

			const response = await fetch('/api/upload', {
				method: 'POST',
				body: formData,
			});
			if (response.ok) {
				const data = await response.json();
				setHero((prev) => ({
					...prev,
					divisionLogos: { ...prev.divisionLogos, [divKey]: data.url },
				}));
				toast({
					title: 'Success',
					description: 'Logo divisi berhasil diupload',
				});
			} else {
				throw new Error('Upload failed');
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Gagal upload logo divisi',
				variant: 'destructive',
			});
		}
	};

	const handleHeroDivisionNameChange = (divKey: string, value: string) => {
		setHero((prev) => ({
			...prev,
			divisionNames: { ...prev.divisionNames, [divKey]: value },
		}));
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
					prev.map((item) =>
						item.key === key ? { ...item, imageUrl: data.url } : item
					)
				);
				toast({
					title: 'Berhasil',
					description: `Gambar ${key} berhasil diupload`,
				});
			} else {
				throw new Error('Upload failed');
			}
		} catch (error) {
			console.error('Error uploading filosofi:', error);
			toast({
				title: 'Error',
				description: 'Gagal mengupload gambar filosofi.',
				variant: 'destructive',
			});
		}
	};

	const addTrackRecordRow = () => {
		setAboutPageTrackRecord((prev) => [
			...prev,
			{ year: '', chairpersonName: '', divisions: [] },
		]);
	};

	const removeTrackRecordRow = (idx: number) => {
		setAboutPageTrackRecord((prev) => prev.filter((_, i) => i !== idx));
	};

	const updateTrackRecordRow = (
		idx: number,
		field: keyof AboutPageTrackRecordItem,
		value: string | string[]
	) => {
		setAboutPageTrackRecord((prev) =>
			prev.map((row, i) =>
				i === idx ? { ...row, [field]: value } : row
			)
		);
	};

	const updateLambangItem = (
		idx: number,
		field: keyof AboutPageLambangItem,
		value: string
	) => {
		setAboutPageLambang((prev) =>
			prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
		);
	};

	return (
		<div className="max-w-full overflow-x-hidden p-6 bg-background rounded-lg shadow-md border border-border">
			<h2 className="text-2xl font-bold mb-6">Edit Konten Halaman</h2>

			<Tabs
				value={selectedTab}
				onValueChange={setSelectedTab}>
				<TabsList className="mb-4">
					<TabsTrigger value="about">Tentang Kami</TabsTrigger>
					<TabsTrigger value="about-page">Halaman Tentang Kami</TabsTrigger>
					<TabsTrigger value="vision">Visi & Misi</TabsTrigger>
					<TabsTrigger value="hero">Hero</TabsTrigger>
					<TabsTrigger value="colors">Warna Divisi</TabsTrigger>
				</TabsList>

				<TabsContent
					value="about"
					className="space-y-4">
					<div>
						<Label htmlFor="aboutUs">Konten Tentang Kami</Label>
						<div className="text-sm text-muted-foreground mb-2">
							Gunakan editor rich text untuk membuat konten yang menarik. Anda
							dapat menambahkan formatting, link, dan gambar.
						</div>
						<RichTextEditor
							value={aboutUs}
							onChange={setAboutUs}
							placeholder="Tulis konten tentang kami di sini..."
							height={400}
							articleId="about-us-content"
						/>
					</div>
					<Button
						variant="outline"
						onClick={() => handlePreview(aboutUs)}
						type="button"
						className="mr-2">
						Preview
					</Button>
				</TabsContent>

				<TabsContent
					value="about-page"
					className="space-y-6">
					<Card>
						<CardContent className="pt-6 space-y-6">
							<h3 className="text-lg font-medium">Halaman Lengkap Tentang Kami</h3>
							<p className="text-sm text-muted-foreground">
								Konten ini ditampilkan di halaman /tentang-kami (Sejarah, Track Record, Lambang).
							</p>
							<p className="text-sm text-primary font-medium rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
								Teks Sejarah di halaman ini sama dengan blok &quot;Tentang Kami&quot; di beranda. Edit di tab <strong>Tentang Kami</strong> (satu kali untuk kedua tampilan).
							</p>

							<div>
								<Label className="block mb-2">Track Record Ketua & Divisi</Label>
								<div className="text-sm text-muted-foreground mb-3">
									Tahun, nama ketua, dan daftar divisi (pisahkan dengan koma)
								</div>
								<div className="space-y-3">
									{aboutPageTrackRecord.map((row, idx) => (
										<div
											key={idx}
											className="flex flex-wrap gap-2 items-start p-3 border rounded-md bg-muted/30">
											<Input
												placeholder="Tahun"
												value={row.year}
												onChange={(e) =>
													updateTrackRecordRow(idx, 'year', e.target.value)
												}
												className="w-20"
											/>
											<Input
												placeholder="Nama Ketua"
												value={row.chairpersonName}
												onChange={(e) =>
													updateTrackRecordRow(idx, 'chairpersonName', e.target.value)
												}
												className="flex-1 min-w-[180px]"
											/>
											<Input
												placeholder="Divisi (pisah koma)"
												value={Array.isArray(row.divisions) ? row.divisions.join(', ') : ''}
												onChange={(e) =>
													updateTrackRecordRow(
														idx,
														'divisions',
														e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
													)
												}
												className="flex-1 min-w-[200px]"
											/>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => removeTrackRecordRow(idx)}
												className="text-destructive hover:text-destructive">
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									))}
									<Button
										variant="outline"
										size="sm"
										onClick={addTrackRecordRow}
										className="mt-2">
										<Plus className="h-4 w-4 mr-2" />
										Tambah Baris
									</Button>
								</div>
							</div>

							<div>
								<Label className="block mb-2">Lambang / Filosofi</Label>
								<div className="text-sm text-muted-foreground mb-3">
									Setiap item dapat diunggah gambarnya (menggantikan file di attached_assets/filosofi)
								</div>
								<div className="space-y-4">
									{aboutPageLambang.map((item, idx) => (
										<div
											key={idx}
											className="p-4 border rounded-md bg-muted/20 space-y-3">
											<div className="flex gap-4 items-start">
												<div className="flex-shrink-0">
													<div className="w-24 h-24 rounded-lg overflow-hidden bg-muted border flex items-center justify-center">
														<img
															src={
																item.imageUrl ||
																`/attached_assets/filosofi/${item.key}.png`
															}
															alt={item.title}
															className="w-full h-full object-contain"
															onError={(e) => {
																(e.target as HTMLImageElement).style.display = 'none';
															}}
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
														onChange={(e) =>
															updateLambangItem(idx, 'title', e.target.value)
														}
													/>
													<Label className="text-xs">Deskripsi</Label>
													<Textarea
														value={item.description}
														onChange={(e) =>
															updateLambangItem(idx, 'description', e.target.value)
														}
														rows={3}
														className="resize-none"
													/>
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent
					value="vision"
					className="space-y-4">
					<div>
						<Label htmlFor="visionMission">Konten Visi & Misi</Label>
						<div className="text-sm text-muted-foreground mb-2">
							Gunakan format khusus seperti contoh di bawah ini untuk struktur
							Visi & Misi
						</div>

						<div className="mb-4 p-4 bg-blue-50 rounded-lg">
							<h4 className="text-sm font-semibold text-blue-700 mb-2">
								Petunjuk Format:
							</h4>
							<p className="text-sm text-blue-700">Gunakan format berikut:</p>
							<pre className="text-xs bg-muted p-2 rounded mt-1 text-foreground overflow-auto">
								{`VISI MISI

- VISI
[Tuliskan visi organisasi di sini]

- MISI
* [Poin misi pertama]
* [Poin misi kedua]
* [Dan seterusnya...]`}
							</pre>
						</div>

						<Textarea
							id="visionMission"
							rows={15}
							value={visionMission}
							onChange={(e) => setVisionMission(e.target.value)}
							className="font-mono text-sm"
							placeholder={`VISI MISI

- VISI
Mewujudkan Himpunan Mahasiswa Teknik Informatika yang berintegritas, progresif, dan adaptif sebagai wadah kolaborasi yang responsif, transparan, partisipatif, menjunjung tinggi nilai kekeluargaan, menciptakan lingkungan yang harmonis, inovatif, dan berorientasi pada kemajuan berkelanjutan.

- MISI
* Meningkatkan lingkungan yang kondusif untuk dialog terbuka, penguatan solidaritas, dan pengamalan kepedulian kolektif, dengan semangat kebersamaan untuk mendukung hubungan yang harmonis dan produktif antar anggota.
* Mengintegrasikan nilai-nilai budaya lokal, nasional, dan profesionalisme dalam setiap program kerja, menumbuhkan kesadaran akan tanggung jawab sosial, meningkatkan kompetensi akademik, soft skills, kepemimpinan, dan inovasi teknologi melalui berbagai kegiatan produktif.
* Mengoptimalkan peran Himpunan sebagai wadah pemberdayaan anggota dengan memberikan perhatian terhadap aspirasi, memfasilitasi pengembangan diri, dan menciptakan jaringan kolaborasi yang efektif dengan berbagai pihak untuk mendorong kontribusi aktif dalam pembangunan dan pengembangan organisasi.`}
						/>
					</div>
					<Button
						variant="outline"
						onClick={() => handlePreview(visionMission)}
						type="button"
						className="mr-2">
						Preview
					</Button>
				</TabsContent>

				<TabsContent
					value="hero"
					className="space-y-6">
					<Card>
						<CardContent className="pt-6 space-y-6">
							<h3 className="text-lg font-medium mb-4">Hero Section</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="space-y-2">
									<Label>Logo Himpunan</Label>
									{hero.logoUrl && (
										<img
											src={hero.logoUrl}
											alt="Logo Himpunan"
											className="h-20 w-auto object-contain border rounded-md p-2 mb-2"
										/>
									)}
									<Input
										type="file"
										accept="image/*"
										onChange={(e) => {
											const file = e.target.files?.[0];
											if (file) handleHeroImageChange('logoUrl', file);
										}}
									/>
								</div>
								<div className="space-y-2">
									<Label>Foto Ketua Himpunan</Label>
									{hero.chairpersonPhoto && (
										<img
											src={hero.chairpersonPhoto}
											alt="Foto Ketua"
											className="h-20 w-20 object-cover rounded-full border mb-2"
										/>
									)}
									<Input
										type="file"
										accept="image/*"
										onChange={(e) => {
											const file = e.target.files?.[0];
											if (file) handleHeroImageChange('chairpersonPhoto', file);
										}}
									/>
									<Label className="mt-2">Nama Ketua</Label>
									<Input
										value={hero.chairpersonName}
										onChange={(e) =>
											setHero((prev) => ({
												...prev,
												chairpersonName: e.target.value,
											}))
										}
									/>
									<Label className="mt-2">Jabatan Ketua</Label>
									<Input
										value={hero.chairpersonTitle}
										onChange={(e) =>
											setHero((prev) => ({
												...prev,
												chairpersonTitle: e.target.value,
											}))
										}
									/>
								</div>
								<div className="space-y-2">
									<Label>Foto Wakil Ketua</Label>
									{hero.viceChairpersonPhoto && (
										<img
											src={hero.viceChairpersonPhoto}
											alt="Foto Wakil"
											className="h-20 w-20 object-cover rounded-full border mb-2"
										/>
									)}
									<Input
										type="file"
										accept="image/*"
										onChange={(e) => {
											const file = e.target.files?.[0];
											if (file)
												handleHeroImageChange('viceChairpersonPhoto', file);
										}}
									/>
									<Label className="mt-2">Nama Wakil Ketua</Label>
									<Input
										value={hero.viceChairpersonName}
										onChange={(e) =>
											setHero((prev) => ({
												...prev,
												viceChairpersonName: e.target.value,
											}))
										}
									/>
									<Label className="mt-2">Jabatan Wakil Ketua</Label>
									<Input
										value={hero.viceChairpersonTitle}
										onChange={(e) =>
											setHero((prev) => ({
												...prev,
												viceChairpersonTitle: e.target.value,
											}))
										}
									/>
								</div>
							</div>
							<div className="mt-8">
								<h4 className="font-semibold mb-2">Kepala Divisi</h4>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{divisionList.map((div) => (
										<div
											key={div.key}
											className="p-4 border rounded-md space-y-2">
											<Label className="capitalize">{div.label}</Label>
											<Label className="mt-1">Nama Kepala Divisi</Label>
											<Input
												value={hero.divisionHeads?.[div.key]?.name || ''}
												onChange={(e) =>
													handleHeroDivisionHeadChange(
														div.key,
														'name',
														e.target.value
													)
												}
											/>
											<Label className="mt-1">Foto Kepala Divisi</Label>
											{hero.divisionHeads?.[div.key]?.photo && (
												<img
													src={hero.divisionHeads[div.key].photo}
													alt={div.label}
													className="h-16 w-16 object-cover rounded-full border mb-2"
												/>
											)}
											<Input
												type="file"
												accept="image/*"
												onChange={(e) => {
													const file = e.target.files?.[0];
													if (file)
														handleHeroDivisionHeadChange(
															div.key,
															'photo',
															file
														);
												}}
											/>
											<Label className="mt-1">Logo Divisi</Label>
											{hero.divisionLogos?.[div.key] && (
												<img
													src={hero.divisionLogos[div.key]}
													alt={`Logo ${div.label}`}
													className="h-10 w-10 object-contain border rounded-md mb-2"
												/>
											)}
											<Input
												type="file"
												accept="image/*"
												onChange={(e) => {
													const file = e.target.files?.[0];
													if (file) handleHeroDivisionLogoChange(div.key, file);
												}}
											/>
											<Label className="mt-1">Nama Divisi</Label>
											<Input
												value={hero.divisionNames?.[div.key] || div.label}
												onChange={(e) =>
													handleHeroDivisionNameChange(div.key, e.target.value)
												}
											/>
										</div>
									))}
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent
					value="colors"
					className="space-y-6">
					<Card>
						<CardContent className="pt-6">
							<h3 className="text-lg font-medium mb-4">Warna Divisi</h3>
							<p className="text-sm text-muted-foreground mb-4">
								Sesuaikan warna latar belakang untuk tiap divisi di hero section
							</p>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{[
									{ key: 'senor', label: 'Senor' },
									{ key: 'religius', label: 'Religius' },
									{ key: 'public_relation', label: 'Public Relation' },
									{ key: 'medinfo', label: 'Media Informasi' },
									{ key: 'technopreneurship', label: 'Technopreneurship' },
									{ key: 'intelektual', label: 'Intelektual' },
									{ key: 'leadership', label: 'Ketua & Wakil' },
								].map(({ key, label }) => (
									<div
										key={key}
										className="p-4 border rounded-md">
										<Label className="capitalize mb-2 block">{label}</Label>
										<div className="flex items-center gap-2">
											<div
												className="w-10 h-10 rounded-md border"
												style={{ backgroundColor: divisionColors[key] }}></div>
											<Input
												type="text"
												value={divisionColors[key]}
												onChange={(e) => handleColorChange(key, e.target.value)}
												className="font-mono text-sm"
											/>
											<input
												type="color"
												value={
													divisionColors[key]?.startsWith('rgba')
														? `#${divisionColors[key]
																.match(/\d+/g)
																?.slice(0, 3)
																.map((n) =>
																	parseInt(n).toString(16).padStart(2, '0')
																)
																.join('')}`
														: divisionColors[key]
												}
												onChange={(e) => {
													const hex = e.target.value;
													const r = parseInt(hex.slice(1, 3), 16);
													const g = parseInt(hex.slice(3, 5), 16);
													const b = parseInt(hex.slice(5, 7), 16);
													const rgba = `rgba(${r}, ${g}, ${b}, 0.75)`;
													handleColorChange(key, rgba);
												}}
												className="w-10 h-10 p-1 cursor-pointer"
											/>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<div className="mt-6 flex justify-end space-x-2">
				<Button
					variant="outline"
					onClick={onCancel}>
					Batal
				</Button>
				<Button
					onClick={handleSave}
					disabled={updateMutation.isPending}>
					{updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
				</Button>
			</div>
		</div>
	);
}
