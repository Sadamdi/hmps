import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AboutPageLambangItem, AboutPageTrackRecordItem } from '@shared/schema';

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
	const [selectedTab, setSelectedTab] = useState('hero');
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
				if (selectedTab === 'hero') {
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

	const handleColorChange = (key: string, value: string) => {
		setDivisionColors((prev) => ({
			...prev,
			[key]: value,
		}));
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

	return (
		<div className="max-w-full overflow-x-hidden p-6 bg-background rounded-lg shadow-md border border-border">
			<h2 className="text-2xl font-bold mb-6">Edit Konten Halaman</h2>

		<Tabs
			value={selectedTab}
			onValueChange={setSelectedTab}>
			<TabsList className="mb-4">
				<TabsTrigger value="hero">Hero</TabsTrigger>
				<TabsTrigger value="colors">Warna Divisi</TabsTrigger>
			</TabsList>

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
