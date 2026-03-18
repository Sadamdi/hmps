import BeritaEditor from '@/components/dashboard/berita-editor';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePagination } from '@/hooks/use-pagination';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface BeritaData {
	_id: string;
	title: string;
	excerpt: string;
	content: string;
	image: string;
	published: boolean;
	author: string;
	authorId: string;
	createdAt: string;
	updatedAt: string;
	date?: string;
	time?: string;
}

export default function DashboardBerita() {
	const [searchQuery, setSearchQuery] = useState('');
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editingBerita, setEditingBerita] = useState<BeritaData | null>(null);
	const [activeTab, setActiveTab] = useState('all');
	const beritaContainerRef = useRef<HTMLDivElement>(null);
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { user, hasSpecificPermission } = useAuth();

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	// Guard permission - redirect jika tidak ada akses
	const { hasPermission: hasBeritaAccess, isLoading: isPermissionLoading } =
		usePermissionGuardAny([
			'berita.view',
			'berita.view_others',
			'berita.edit',
			'berita.create',
		]);

	const canEditBerita = (item: BeritaData) => {
		const isOwner = user?._id === item.authorId;
		return (
			(hasSpecificPermission('berita.edit') && isOwner) ||
			hasSpecificPermission('berita.edit_others')
		);
	};

	const canDeleteBerita = (item: BeritaData) => {
		const isOwner = user?._id === item.authorId;
		return (
			(hasSpecificPermission('berita.delete') && isOwner) ||
			hasSpecificPermission('berita.delete_others')
		);
	};

	const { data: beritaData = [], isLoading } = useQuery({
		queryKey: ['/api/berita/manage'],
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		staleTime: 60000,
	});

	const beritaList = beritaData as BeritaData[];

	const filteredBerita = beritaList
		.filter(
			(item: BeritaData) =>
				item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
		)
		.filter((item: BeritaData) => {
			if (activeTab === 'all') return true;
			if (activeTab === 'published') return item.published;
			if (activeTab === 'drafts') return !item.published;
			return true;
		});

	// Pagination for berita
	const {
		currentPage,
		totalPages,
		paginatedData: paginatedBerita,
		setCurrentPage,
	} = usePagination({
		data: filteredBerita,
		itemsPerPageDesktop: 9,
		itemsPerPageMobile: 6,
	});

	// Delete berita mutation
	const deleteBeritaMutation = useMutation({
		mutationFn: async (beritaId: string | number) => {
			await apiRequest('DELETE', `/api/berita/${beritaId}`, {});
		},
		onSuccess: async (_, beritaId) => {
			const deletedItem = beritaList.find(
				(b) => (b as any)._id === beritaId
			);

			queryClient.invalidateQueries({ queryKey: ['/api/berita/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			if (deletedItem) {
				try {
					await logActivity(
						ActivityTemplates.beritaDeleted(
							deletedItem.title,
							String(beritaId)
						)
					);
				} catch (error) {
					console.warn('Failed to log delete activity:', error);
				}
			}

			toast({
				title: 'Success',
				description: 'Berita berhasil dihapus',
			});
		},
		onError: (error) => {
			toast({
				title: 'Error',
				description: 'Gagal menghapus berita',
				variant: 'destructive',
			});
			console.error('Delete error:', error);
		},
	});

	// Auto-scroll to berita container when page changes
	useEffect(() => {
		if (beritaContainerRef.current) {
			beritaContainerRef.current.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		}
	}, [currentPage]);

	const handleNewBerita = () => {
		setEditingBerita(null);
		setIsEditorOpen(true);
	};

	const handleEditBerita = (item: BeritaData) => {
		setEditingBerita(item);
		setIsEditorOpen(true);
	};

	const handleDeleteBerita = async (beritaId: string | number) => {
		if (window.confirm('Yakin ingin menghapus berita ini?')) {
			await deleteBeritaMutation.mutateAsync(beritaId);
		}
	};

	const closeEditor = () => {
		setIsEditorOpen(false);
		setEditingBerita(null);
	};

	const handleBeritaSaved = () => {
		queryClient.invalidateQueries({ queryKey: ['/api/berita/manage'] });
		closeEditor();
		toast({
			title: 'Success',
			description: `Berita berhasil ${
				editingBerita ? 'diperbarui' : 'dibuat'
			}`,
		});
	};

	// Show loading jika permission masih loading
	if (isPermissionLoading) {
		return (
		<DashboardLayout title="Berita">
			<div className="flex items-center justify-center h-64">
					<div className="flex items-center space-x-2">
						<Loader2 className="h-6 w-6 animate-spin" />
						<span>Loading permissions...</span>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// Redirect sudah dihandle di usePermissionGuardAny
	// Tapi tetap return early untuk safety
	if (!hasBeritaAccess) {
		return null;
	}

	return (
		<DashboardLayout title="Berita">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
				<h1 className="text-2xl font-bold">Kelola Berita</h1>
				{hasSpecificPermission('berita.create') && (
					<Button onClick={handleNewBerita}>
						<Plus className="h-4 w-4 mr-2" />
						Berita Baru
					</Button>
				)}
			</div>

			<div className="mb-6 flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Cari berita..."
						className="pl-10"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="w-full sm:w-auto">
					<TabsList>
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="published">Published</TabsTrigger>
						<TabsTrigger value="drafts">Drafts</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{isLoading ? (
				<div className="flex justify-center items-center h-64">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : filteredBerita.length === 0 ? (
				<Card>
					<CardContent className="p-8 text-center">
					<p className="text-muted-foreground mb-4">Belum ada berita.</p>
					<Button onClick={handleNewBerita}>Buat Berita</Button>
					</CardContent>
				</Card>
			) : (
				<div
					ref={beritaContainerRef}
					key={`page-${currentPage}`}
					className="grid gap-6 animate-page-transition">
					{paginatedBerita.map((item: BeritaData, index: number) => (
						<Card
							key={item._id}
							className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] animate-fade-in-up"
							style={{ animationDelay: `${index * 50}ms` }}>
							<div className="flex flex-col md:flex-row">
								<div className="w-full md:w-64 h-48 md:h-auto">
									<img
										src={item.image}
										alt={item.title}
										className="w-full h-full object-cover"
									/>
								</div>
								<CardContent className="flex-1 p-6">
									<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
										<div className="flex-1">
											<div className="flex items-center mb-2">
												<h2 className="text-xl font-bold mr-3">
													{item.title}
												</h2>
											{item.published ? (
												<span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs px-2 py-1 rounded">
													Published
												</span>
											) : (
												<span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
													Draft
												</span>
											)}
											</div>
										<p className="text-muted-foreground mb-4 line-clamp-2">
											{item.excerpt}
										</p>
										<div className="flex items-center text-xs text-muted-foreground">
												<span className="mr-4">By {item.author}</span>
												<span>
													{item.date} at {item.time}
												</span>
											</div>
										</div>
										<div className="flex space-x-2">
											{canEditBerita(item) && (
												<Button
													size="sm"
													variant="outline"
													onClick={() => handleEditBerita(item)}>
													<Edit className="h-4 w-4 mr-1" />
													Edit
												</Button>
											)}
											{canDeleteBerita(item) && (
												<Button
													size="sm"
													variant="outline"
													className="text-red-600 border-red-200 hover:bg-red-50"
													onClick={() => handleDeleteBerita(item._id)}>
													<Trash2 className="h-4 w-4" />
												</Button>
											)}
										</div>
									</div>
								</CardContent>
							</div>
						</Card>
					))}
				</div>
			)}

			{/* Pagination */}
			<Pagination
				currentPage={currentPage}
				totalPages={totalPages}
				onPageChange={setCurrentPage}
				className="mt-8"
			/>

			<Dialog
				open={isEditorOpen}
				onOpenChange={() => {}} // ❌ Disable backdrop close dan escape key
			>
				<DialogContent
					className="max-w-5xl max-h-[90vh] overflow-y-auto"
					hideCloseButton={true} // ❌ Hide close button (X)
					onPointerDownOutside={(e) => e.preventDefault()} // ❌ Disable backdrop clicks
					onEscapeKeyDown={(e) => e.preventDefault()} // ❌ Disable Escape key
					onInteractOutside={(e) => e.preventDefault()}>
					<DialogHeader>
						<DialogTitle>
							{editingBerita ? 'Edit Berita' : 'Buat Berita Baru'}
						</DialogTitle>
						{/* Peringatan bahwa editor hanya bisa ditutup dengan tombol */}
						<div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-sm text-blue-700 dark:text-blue-300">
							<span>🔒</span>
							<span>
								Editor hanya bisa ditutup menggunakan tombol <strong>Batal</strong> atau{' '}
								<strong>Simpan Berita</strong> di bawah
							</span>
						</div>
					</DialogHeader>
					<BeritaEditor
						berita={editingBerita}
						onSave={handleBeritaSaved}
						onCancel={closeEditor}
					/>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
