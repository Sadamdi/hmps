import CommentPanel from '@/components/dashboard/comment-panel';
import { ConfirmDeleteAlertDialog } from '@/components/dashboard/confirm-delete-alert-dialog';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import MediaUploader from '@/components/dashboard/media-uploader';
import SharingPanel from '@/components/dashboard/sharing-panel';
import MediaDisplay from '@/components/MediaDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissionGuardWithSharing } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import {
	Edit,
	FolderOpen,
	ImageIcon,
	Loader2,
	Layers,
	Plus,
	Search,
	Share2,
	Trash2,
	User,
	VideoIcon,
} from 'lucide-react';
import {
	getLibraryKindLabel,
	getLibraryVisualKind,
	getMediaDisplayTypeForSlot,
	normalizeLibraryImageUrl,
} from '@/lib/library-display';
import { buildLibraryEncoPageData } from '@shared/dashboard-enco-context';
import { useMemo, useState } from 'react';

interface LibraryItem {
	id?: number;
	_id?: string;
	title: string;
	description: string;
	fullDescription: string;
	images: string[];
	imageSources?: string[];
	gdriveFileIds?: string[];
	mediaKinds?: ('image' | 'video')[];
	gdriveEmbedFolders?: { folderId: string; url: string }[];
	date?: string;
	time?: string;
	type: 'photo' | 'video';
	published?: boolean;
	activityDate?: string;
	relatedEventIds?: string[];
	relatedBeritaIds?: string[];
	createdAt: string;
	authorId?: string;
	_sharingPermission?: 'view' | 'edit';
	_sharingStatus?: 'pending' | 'approved';
	authorsDisplay?: string;
}

interface LibraryRequestable {
	_id: string;
	title: string;
}

export default function DashboardLibrary() {
	const [searchQuery, setSearchQuery] = useState('');
	const [requestTitleQuery, setRequestTitleQuery] = useState('');
	const [isUploaderOpen, setIsUploaderOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
	const [activeTab, setActiveTab] = useState('all');
	const [sharingItem, setSharingItem] = useState<LibraryItem | null>(null);
	const [itemPendingDelete, setItemPendingDelete] = useState<{
		id: string | number;
		title: string;
	} | null>(null);
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { user, hasSpecificPermission } = useAuth();

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	const {
		hasPermission: hasLibraryAccess,
		hasRolePermission,
		hasSharedAccess,
		isLoading: isPermissionLoading,
	} =
		usePermissionGuardWithSharing(
			[
				'library.view',
				'library.view_others',
				'library.edit',
				'library.edit_others',
				'library.create',
			],
			'library',
			{ allowRequestOnly: true },
		);

	const requestOnly = !hasRolePermission && !hasSharedAccess;

	const libraryPageDataForEnco = useMemo(
		() =>
			buildLibraryEncoPageData({
				permissionsLoading: isPermissionLoading,
				requestOnly,
				activeTab,
				isUploaderOpen,
				editingItem,
			}),
		[isPermissionLoading, requestOnly, activeTab, isUploaderOpen, editingItem],
	);

	const showRequestSharingSearch =
		hasLibraryAccess &&
		!hasSpecificPermission('library.view_others') &&
		!hasSpecificPermission('library.edit_others');

	const openSharingRequest = (item: LibraryRequestable) => {
		setSharingItem({
			_id: item._id,
			title: item.title,
			description: '',
			fullDescription: '',
			images: [],
			type: 'photo',
			authorId: String(user?._id || ''),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			time: '',
			date: '',
		} as any);
	};

	// Helper function to check if user can edit/delete library item
	const canEditLibraryItem = (item: LibraryItem) => {
		const isOwner = user?._id === item.authorId;
		const hasSharedEdit = item._sharingPermission === 'edit';
		return (
			(hasSpecificPermission('library.edit') && isOwner) ||
			hasSpecificPermission('library.edit_others') ||
			hasSharedEdit
		);
	};

	const canDeleteLibraryItem = (item: LibraryItem) => {
		const isOwner = user?._id === item.authorId;
		const hasSharedEdit = item._sharingPermission === 'edit';
		return (
			(hasSpecificPermission('library.delete') && isOwner) ||
			hasSpecificPermission('library.delete_others') ||
			hasSharedEdit
		);
	};

	// Query library items
	const { data: libraryItems = [], isLoading } = useQuery<LibraryItem[]>({
		queryKey: ['/api/library/manage'],
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		staleTime: 60000,
		enabled: !requestOnly,
	});

	const {
		data: requestableLibrary = [],
		isLoading: isRequestableLoading,
	} = useQuery({
		queryKey: ['/api/sharing/requestable', 'library', requestTitleQuery],
		enabled:
			showRequestSharingSearch && requestTitleQuery.trim().length >= 2,
		staleTime: 5000,
		queryFn: async () => {
			const res = await fetch(
				`/api/sharing/requestable?entityType=library&q=${encodeURIComponent(requestTitleQuery)}`,
				{ credentials: 'include' },
			);
			if (!res.ok) return [];
			return (await res.json()) as LibraryRequestable[];
		},
	});

	// Delete library item mutation
	const deleteLibraryItemMutation = useMutation({
		mutationFn: async (itemId: string | number) => {
			await apiRequest('DELETE', `/api/library/${itemId}`, {});
		},
		onSuccess: async (_, itemId) => {
			// Find the deleted item for logging
			const deletedItem = libraryItems.find(
				(item) => (item._id || item.id) === itemId
			);

			queryClient.invalidateQueries({ queryKey: ['/api/library/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			// Log activity
			if (deletedItem) {
				try {
					await logActivity(
						ActivityTemplates.libraryItemDeleted(
							deletedItem.title,
							String(itemId)
						)
					);
				} catch (error) {
					console.warn('Failed to log delete activity:', error);
				}
			}

			toast({
				title: 'Berhasil',
				description: 'Item galeri berhasil dihapus',
			});
		},
		onError: (error) => {
			toast({
				title: 'Gagal',
				description: 'Gagal menghapus item galeri',
				variant: 'destructive',
			});
			console.error('Delete error:', error);
		},
	});

	// Filter items based on search and tab
	const filteredItems = libraryItems
		.filter(
			(item) =>
				item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.description.toLowerCase().includes(searchQuery.toLowerCase())
		)
		.filter((item) => {
			if (activeTab === 'all') return true;
			if (activeTab === 'draft')
				return item.published === false;
			if (activeTab === 'published')
				return item.published !== false;
			if (activeTab === 'photos') return item.type === 'photo';
			if (activeTab === 'videos') return item.type === 'video';
			return true;
		});

	const handleNewItem = () => {
		setEditingItem(null);
		setIsUploaderOpen(true);
	};

	const handleEditItem = (item: LibraryItem) => {
		setEditingItem(item);
		setIsUploaderOpen(true);
	};

	const requestDeleteItem = (itemId: string | number, title: string) => {
		setItemPendingDelete({ id: itemId, title });
	};

	const closeUploader = () => {
		setIsUploaderOpen(false);
		setEditingItem(null);
	};

	const handleItemSaved = () => {
		queryClient.invalidateQueries({ queryKey: ['/api/library/manage'] });
		closeUploader();
		toast({
			title: 'Success',
			description: `Library item ${
				editingItem ? 'updated' : 'created'
			} successfully`,
		});
	};

	// Show loading jika permission masih loading
	if (isPermissionLoading) {
		return (
			<DashboardLayout title="Galeri">
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
	if (!hasLibraryAccess) {
		return null;
	}

	return (
		<DashboardLayout title="Galeri" pageContextExtra={{ pageData: libraryPageDataForEnco }}>
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
				<h1 className="text-2xl font-bold">
					{requestOnly ? 'Ajukan Akses Galeri' : 'Galeri Media'}
				</h1>
				{!requestOnly && hasSpecificPermission('library.create') && (
					<Button onClick={handleNewItem}>
						<Plus className="h-4 w-4 mr-2" />
						Upload Media
					</Button>
				)}
			</div>

			<DashboardHintCard
				title="Cara memakai Galeri Media"
				variant="blue"
				storageKey="dashboard-library"
				description="Wajib: judul dan minimal satu tautan Google Drive. Satu atau beberapa file (foto/video), atau satu folder (isi folder dijadikan galeri), atau mode embed folder (iframe Drive). Deskripsi dan relasi opsional. Draf/terbit seperti modul lain.">
				<ul className="list-disc list-inside space-y-1.5 text-sm">
					<li>
						<strong>Google Drive</strong>: tempel link <strong>file</strong> tunggal (foto atau video), atau tambah beberapa baris untuk banyak file, atau tempel link <strong>folder</strong> — sistem mengambil foto/video di dalamnya. Jika Anda menempel folder, mode <strong>folder embed</strong> bisa menampilkan folder sebagai pratinjau di situs. Set berbagi ke <strong>Siapa pun yang punya link</strong>.
					</li>
					<li>
						<strong>Langkah create</strong>: <strong>Upload Media</strong> → judul → (opsional) deskripsi &amp; editor lengkap → tautan Drive → simpan (terbit atau draf).
					</li>
					<li>
						<strong>Contoh valid</strong>: Judul <code className="text-xs bg-muted px-1 rounded">Dokumentasi Wisuda 2026</code>; deskripsi singkat satu kalimat; deskripsi lengkap paragraf; link Google Drive berbagi <strong>Anyone with the link / siapa pun yang punya link</strong> (bukan private).
					</li>
					<li>
						<strong>Contoh tidak valid</strong>: field wajib kosong; link Drive private/tidak bisa diakses publik; mencoba edit entri orang lain tanpa izin atau sharing.
					</li>
					<li>
						<strong>Jika gagal</strong>: periksa pesan error unggah (kurangi ukuran file atau ganti format); pastikan link drive bisa dibuka di jendela incognito; pastikan Anda pemilik entri atau punya akses edit.
					</li>
					<li>
						<strong>Sharing</strong>: gunakan pencarian judul di mode ajuan untuk meminta akses ke satu entri tanpa akses penuh ke semua galeri.
					</li>
					<li>
						<strong>Izin utama</strong>: <code className="text-xs bg-muted px-1 rounded">library.create</code>, <code className="text-xs bg-muted px-1 rounded">library.edit</code>/<code className="text-xs bg-muted px-1 rounded">library.delete</code>, <code className="text-xs bg-muted px-1 rounded">library.edit_others</code>/<code className="text-xs bg-muted px-1 rounded">library.view_others</code>.
					</li>
				</ul>
			</DashboardHintCard>

			{showRequestSharingSearch && (
				<div className="mb-6 flex flex-col gap-4">
					<div className="relative max-w-xl">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
						<Input
							placeholder="Cari judul galeri untuk request sharing..."
							className="pl-10"
							value={requestTitleQuery}
							onChange={(e) => setRequestTitleQuery(e.target.value)}
						/>
					</div>

					{isRequestableLoading ? (
						<div className="flex justify-center items-center h-48">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : requestTitleQuery.trim().length < 2 ? (
						<Card>
							<CardContent className="p-6 text-center text-gray-500">
								Masukkan minimal 2 huruf untuk mencari.
							</CardContent>
						</Card>
					) : requestableLibrary.length === 0 ? (
						<Card>
							<CardContent className="p-6 text-center text-gray-500">
								Tidak ada hasil untuk judul tersebut.
							</CardContent>
						</Card>
					) : (
						<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{requestableLibrary.map((item, index) => (
								<Card
									key={item._id}
									className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.01] animate-fade-in-up"
									style={{ animationDelay: `${index * 30}ms` }}>
									<CardContent className="p-4">
										<div className="flex items-start justify-between gap-4">
											<div className="min-w-0">
												<h3 className="font-bold truncate">{item.title}</h3>
											</div>
											<Button
												size="sm"
												variant="outline"
												onClick={() => openSharingRequest(item)}
												className="shrink-0">
												<Share2 className="h-4 w-4 mr-1" />
												Ajukan Akses
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</div>
			)}

			{!requestOnly && (
				<>
					<div className="mb-6 flex flex-col sm:flex-row gap-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
							<Input
								placeholder="Cari galeri..."
								className="pl-10"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
						<Tabs
							value={activeTab}
							onValueChange={setActiveTab}
							className="w-full sm:w-auto">
							<TabsList className="flex flex-wrap h-auto gap-1">
								<TabsTrigger value="all">Semua</TabsTrigger>
								<TabsTrigger value="published">Terbit</TabsTrigger>
								<TabsTrigger value="draft">Draf</TabsTrigger>
								<TabsTrigger value="photos">Foto</TabsTrigger>
								<TabsTrigger value="videos">Video</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					{isLoading ? (
						<div className="flex justify-center items-center h-64">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : filteredItems.length === 0 ? (
						<Card>
							<CardContent className="p-8 text-center">
								<p className="text-gray-500 mb-4">
									No media items found.
								</p>
								{hasSpecificPermission('library.create') && (
									<Button onClick={handleNewItem}>
										Upload Media
									</Button>
								)}
							</CardContent>
						</Card>
					) : (
						<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{filteredItems.map((item) => (
								<Card
									key={item._id || item.id}
									className="overflow-hidden">
									<div className="h-48 relative overflow-hidden group">
										{item.published === false && (
											<Badge
												className="absolute top-2 left-2 z-10"
												variant="secondary">
												Draf
											</Badge>
										)}
										<MediaDisplay
											src={normalizeLibraryImageUrl(item.images[0])}
											alt={item.title}
											type={getMediaDisplayTypeForSlot(item, 0)}
											className="w-full h-full"
										/>

								{/* Type indicator */}
								{(() => {
									const kind = getLibraryVisualKind(item);
									const label = getLibraryKindLabel(kind);
									const Icon =
										kind === 'folder'
											? FolderOpen
											: kind === 'video'
												? VideoIcon
												: kind === 'mixed'
													? Layers
													: ImageIcon;
									const count = kind === 'folder'
										? (item.gdriveEmbedFolders?.length ?? 0)
										: item.images.length;
									return (
										<div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs rounded px-2 py-1 flex items-center">
											<Icon className="h-3 w-3 mr-1" />
											<span>
												{label}
												{count > 1 ? ` (${count})` : ''}
											</span>
										</div>
									);
								})()}
							</div>
							<CardContent className="p-4">
								<div className="flex flex-col space-y-2">
									<div className="flex justify-between items-start">
										<h3 className="font-bold truncate">{item.title}</h3>
										<div className="flex space-x-1">
											<Button
												size="sm"
												variant="ghost"
												className="h-8 w-8 p-0"
												onClick={() => setSharingItem(item)}>
												<Share2 className="h-4 w-4" />
											</Button>
											{canEditLibraryItem(item) && (
												<Button
													size="sm"
													variant="ghost"
													className="h-8 w-8 p-0"
													onClick={() => handleEditItem(item)}>
													<Edit className="h-4 w-4" />
												</Button>
											)}
											{canDeleteLibraryItem(item) && (
												<Button
													size="sm"
													variant="ghost"
													className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
													onClick={() =>
														requestDeleteItem(
															item._id || item.id!,
															item.title,
														)
													}>
													<Trash2 className="h-4 w-4" />
												</Button>
											)}
										</div>
									</div>
									<p className="text-sm text-gray-600 line-clamp-2">
										{item.description}
									</p>
									{item.authorsDisplay ? (
										<p className="text-xs text-muted-foreground flex items-center gap-1">
											<User className="h-3 w-3 shrink-0" />
											{item.authorsDisplay}
										</p>
									) : null}
									<div className="text-xs text-gray-500">
										{item.date} · {item.time}
									</div>
								</div>
								{hasSpecificPermission('comments.manage') && (
									<CommentPanel targetType="library" targetId={item._id || String(item.id)} />
								)}
							</CardContent>
						</Card>
					))}
						</div>
					)}
				</>
			)}

			<Dialog
				open={isUploaderOpen}
				onOpenChange={setIsUploaderOpen}>
				<DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
					<DialogHeader>
						<DialogTitle>
							{editingItem ? 'Edit Media Item' : 'Upload New Media'}
						</DialogTitle>
					</DialogHeader>
					<MediaUploader
						item={editingItem as any}
						onSave={handleItemSaved}
						onCancel={closeUploader}
					/>
				</DialogContent>
			</Dialog>

			{sharingItem && (
				<SharingPanel
					entityType="library"
					entityId={sharingItem._id || String(sharingItem.id)}
					entityTitle={sharingItem.title}
					open={!!sharingItem}
					onOpenChange={(open) => {
						if (!open) setSharingItem(null);
					}}
				/>
			)}

			<ConfirmDeleteAlertDialog
				open={!!itemPendingDelete}
				onOpenChange={(open) => {
					if (!open) setItemPendingDelete(null);
				}}
				title="Hapus item galeri?"
				description={
					itemPendingDelete ? (
						<>
							Anda yakin ingin menghapus{' '}
							<strong className="text-foreground">{itemPendingDelete.title}</strong>?
							Tindakan ini tidak dapat dibatalkan.
						</>
					) : null
				}
				isPending={deleteLibraryItemMutation.isPending}
				onConfirm={async () => {
					if (!itemPendingDelete) return;
					await deleteLibraryItemMutation.mutateAsync(itemPendingDelete.id);
				}}
			/>
		</DashboardLayout>
	);
}
