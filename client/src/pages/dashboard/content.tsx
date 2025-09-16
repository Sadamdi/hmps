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
