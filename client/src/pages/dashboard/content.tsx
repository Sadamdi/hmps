import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileEdit, Loader2 } from 'lucide-react';
import { useState } from 'react';

import ContentEditor from '@/components/dashboard/content-editor';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useAuth } from '@/lib/auth';

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
	divisionLogos: {
		akademik: string;
		humas: string;
		pengembangan: string;
		media: string;
		keuangan: string;
		acara: string;
	};
	divisionColors: {
		akademik: string;
		humas: string;
		pengembangan: string;
		leadership: string;
		media: string;
		keuangan: string;
		acara: string;
	};
	socialLinks: {
		facebook: string;
		twitter: string;
		instagram: string;
		youtube: string;
	};
	aboutPageIntro?: string;
	aboutPageTrackRecord?: { year: string; chairpersonName: string; divisions: string[] }[];
	aboutPageLambang?: { key: string; title: string; description: string; imageUrl?: string }[];
}

export default function Content() {
	const [isEditing, setIsEditing] = useState(false);
	const { data: settings, isPending } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		refetchOnWindowFocus: false,
	});

	const { hasSpecificPermission } = useAuth();
	const canEdit = hasSpecificPermission('content.edit');

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	// Guard permission - redirect jika tidak ada akses
	const { hasPermission: hasContentAccess, isLoading: isPermissionLoading } =
		usePermissionGuardAny(['content.view', 'content.edit']);

	const handleEdit = () => {
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
	};

	const handleSaveEdit = () => {
		setIsEditing(false);
	};

	// Show loading jika permission masih loading
	if (isPermissionLoading) {
		return (
			<DashboardLayout title="Konten Halaman Publik">
				<div className="flex items-center justify-center h-64">
					<div className="flex items-center space-x-2">
						<Loader2 className="h-6 w-6 animate-spin" />
						<span>Loading permissions...</span>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// Redirect sudah dihandle di usePermissionGuard
	// Tapi tetap return early untuk safety
	if (!hasContentAccess) {
		return null;
	}

	return (
		<DashboardLayout title="Konten Halaman Publik">
			{isEditing ? (
				<div className="mb-4">
					<Button
						variant="ghost"
						onClick={handleCancelEdit}
						size="sm">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Kembali
					</Button>
				</div>
			) : null}

			{isPending ? (
				<div className="text-center p-8">Memuat data...</div>
			) : isEditing ? (
				<ContentEditor
					settings={settings}
					onSave={handleSaveEdit}
					onCancel={handleCancelEdit}
				/>
			) : (
				<div className="space-y-6">
					<div className="flex justify-between items-center">
						<h2 className="text-2xl font-bold">Konten Halaman</h2>
						{canEdit && (
							<Button onClick={handleEdit}>
								<FileEdit className="mr-2 h-4 w-4" />
								Edit Konten
							</Button>
						)}
					</div>

					<Tabs defaultValue="about">
						<TabsList>
							<TabsTrigger value="about">Tentang Kami</TabsTrigger>
							<TabsTrigger value="about-page">Halaman Tentang Kami</TabsTrigger>
							<TabsTrigger value="vision">Visi & Misi</TabsTrigger>
						</TabsList>

						<TabsContent value="about">
							<Card>
								<CardHeader>
									<CardTitle>Konten Tentang Kami</CardTitle>
									<CardDescription>
										Konten ini akan ditampilkan di bagian "Tentang Kami" pada
										halaman publik
									</CardDescription>
								</CardHeader>
								<CardContent>
									{settings?.aboutUs ? (
										<div className="prose max-w-none border rounded-md p-4 bg-gray-50">
											<div
												dangerouslySetInnerHTML={{
													__html: settings.aboutUs,
												}}
											/>
										</div>
									) : (
										<div className="text-gray-500 italic">
											Belum ada konten.
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="about-page">
							<Card>
								<CardHeader>
									<CardTitle>Halaman Lengkap Tentang Kami</CardTitle>
									<CardDescription>
										Konten ini ditampilkan di halaman /tentang-kami. Sejarah, Track Record, dan Lambang.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									<a href="/tentang-kami" target="_blank" rel="noopener noreferrer">
										<Button variant="outline" size="sm">
											Lihat halaman publik →
										</Button>
									</a>
									{settings?.aboutUs ? (
										<div>
											<h4 className="font-medium mb-2">Intro / Sejarah (sama dengan Tentang Kami)</h4>
											<div
												className="prose max-w-none border rounded-md p-4 bg-muted/30 text-sm"
												dangerouslySetInnerHTML={{ __html: settings.aboutUs }}
											/>
										</div>
									) : null}
									{settings?.aboutPageTrackRecord?.length ? (
										<div>
											<h4 className="font-medium mb-2">Track Record</h4>
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
																<td className="p-2 text-muted-foreground">
																	{r.divisions?.join(', ')}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									) : null}
									{settings?.aboutPageLambang?.length ? (
										<div>
											<h4 className="font-medium mb-2">Lambang</h4>
											<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
												{settings.aboutPageLambang.map((item, i) => (
													<div key={i} className="border rounded-md p-3">
														<img
															src={item.imageUrl || `/attached_assets/filosofi/${item.key}.png`}
															alt={item.title}
															className="w-16 h-16 object-contain mx-auto mb-2"
															onError={(e) => {
																(e.target as HTMLImageElement).style.display = 'none';
															}}
														/>
														<p className="font-medium text-sm">{item.title}</p>
														<p className="text-xs text-muted-foreground line-clamp-2">
															{item.description}
														</p>
													</div>
												))}
											</div>
										</div>
									) : (
										<div className="text-muted-foreground italic">
											Belum ada konten halaman Tentang Kami. Klik Edit untuk mengisi.
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="vision">
							<Card>
								<CardHeader>
									<CardTitle>Konten Visi & Misi</CardTitle>
									<CardDescription>
										Konten ini akan ditampilkan di bagian "Visi & Misi" pada
										halaman publik
									</CardDescription>
								</CardHeader>
								<CardContent>
									{settings?.visionMission ? (
										<div className="prose max-w-none border rounded-md p-4 bg-gray-50">
											<div
												dangerouslySetInnerHTML={{
													__html: settings.visionMission,
												}}
											/>
										</div>
									) : (
										<div className="text-gray-500 italic">
											Belum ada konten.
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</div>
			)}
		</DashboardLayout>
	);
}
