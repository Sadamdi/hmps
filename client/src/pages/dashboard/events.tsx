import CommentPanel from '@/components/dashboard/comment-panel';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import SharingPanel from '@/components/dashboard/sharing-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import RichTextEditor from '@/components/dashboard/rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { usePermissionGuardWithSharing } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { buildEventsSpyroPageData } from '@shared/dashboard-spyro-context';
import type { EventItem, EventYear } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ArrowLeft,
	Calendar,
	ChevronRight,
	Copy,
	Edit,
	Eye,
	EyeOff,
	FileText,
	GitBranch,
	Image,
	Link2,
	Loader2,
	Plus,
	Search,
	Share2,
	Trash2,
	X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

type EventStatus = 'ongoing' | 'soon' | 'expired';

function getEventStatus(startDate: string | Date, endDate: string | Date): EventStatus {
	const now = new Date();
	const start = new Date(startDate);
	const end = new Date(endDate);
	if (now >= start && now <= end) return 'ongoing';
	if (now < start) return 'soon';
	return 'expired';
}

function statusBadge(status: EventStatus) {
	switch (status) {
		case 'ongoing':
			return <Badge className="bg-green-600 text-white animate-pulse">ONGOING</Badge>;
		case 'soon':
			return <Badge className="bg-blue-600 text-white">SEGERA</Badge>;
		case 'expired':
			return <Badge variant="secondary">SELESAI</Badge>;
	}
}

const MONTH_NAMES = [
	'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
	'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatDate(d: string | Date) {
	const date = new Date(d);
	return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

interface SiteSettings {
	eventsAllowMultipleYearsOnHome?: boolean;
	[key: string]: unknown;
}

interface EventRequestable {
	_id: string;
	title: string;
	published?: boolean;
}
type EventAttachmentForm = {
	name: string;
	url: string;
	type: string;
	source: 'local' | 'gdrive' | 'url';
};
type EventWithSharing = EventItem & {
	_sharingPermission?: 'view' | 'edit';
	_sharingStatus?: 'pending' | 'approved';
};

export default function DashboardEvents() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { user, hasSpecificPermission } = useAuth();
	usePermissionRefresh();

	const {
		hasPermission: hasAccess,
		hasRolePermission,
		hasSharedAccess,
		isLoading: isPermLoading,
	} = usePermissionGuardWithSharing(
		['events.view', 'events.view_others', 'events.create', 'events.edit'],
		'events',
		{ allowRequestOnly: true },
	);

	const requestOnly = !hasRolePermission && !hasSharedAccess;
	const manageEnabled = !requestOnly;
	const showRequestSharingSearch =
		hasAccess && !hasSpecificPermission('events.view_others');

	const canEditEvent = (ev: EventWithSharing) => {
		const isOwner = user?._id === ev.createdBy;
		const hasSharedEdit = ev._sharingPermission === 'edit';
		return (
			(hasSpecificPermission('events.edit') && isOwner) ||
			hasSpecificPermission('events.edit_others') ||
			hasSharedEdit
		);
	};
	const canDeleteEvent = (ev: EventWithSharing) => {
		const isOwner = user?._id === ev.createdBy;
		const hasSharedEdit = ev._sharingPermission === 'edit';
		return (
			(hasSpecificPermission('events.delete') && isOwner) ||
			hasSpecificPermission('events.delete_others') ||
			hasSharedEdit
		);
	};
	const canViewEvent = (ev: EventWithSharing) => {
		const isOwner = user?._id === ev.createdBy;
		return (
			(hasSpecificPermission('events.view') && isOwner) ||
			hasSpecificPermission('events.view_others')
		);
	};

	const [sharingEvent, setSharingEvent] = useState<EventItem | null>(null);

	const [requestTitleQuery, setRequestTitleQuery] = useState('');

	const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
	const [selectedParentEvent, setSelectedParentEvent] = useState<EventItem | null>(null);
	const [isYearDialogOpen, setIsYearDialogOpen] = useState(false);
	const [newYear, setNewYear] = useState(new Date().getFullYear());
	const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);

	const [deleteYearTarget, setDeleteYearTarget] = useState<EventYear | null>(null);
	const [deleteYearConfirmText, setDeleteYearConfirmText] = useState('');
	const [deleteYearEventsCount, setDeleteYearEventsCount] = useState<number | null>(null);
	const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

	// Event form state
	const [formTitle, setFormTitle] = useState('');
	const [formDesc, setFormDesc] = useState('');
	const [formStartDate, setFormStartDate] = useState('');
	const [formEndDate, setFormEndDate] = useState('');
	const [formPublished, setFormPublished] = useState(false);
	const [formThumbnail, setFormThumbnail] = useState<File | null>(null);
	const [formAttachments, setFormAttachments] = useState<File[]>([]);
	const [existingAttachments, setExistingAttachments] = useState<EventAttachmentForm[]>([]);
	const [formAttachmentLinkName, setFormAttachmentLinkName] = useState('');
	const [formAttachmentLinkUrl, setFormAttachmentLinkUrl] = useState('');
	const [selectedBeritaIds, setSelectedBeritaIds] = useState<string[]>([]);
	const [selectedGalleryIds, setSelectedGalleryIds] = useState<string[]>([]);
	const [gallerySearch, setGallerySearch] = useState('');
	const [beritaSearch, setBeritaSearch] = useState('');
	const [showAttachGalleryDialog, setShowAttachGalleryDialog] = useState(false);
	const [showAttachBeritaDialog, setShowAttachBeritaDialog] = useState(false);

	// Copy to berita state
	const [copyToBeritaEvent, setCopyToBeritaEvent] = useState<EventItem | null>(null);
	const [copyAttachments, setCopyAttachments] = useState(false);

	// Queries
	const { data: eventYears = [], isLoading: isYearsLoading } = useQuery<EventYear[]>({
		queryKey: ['/api/event-years'],
		enabled: manageEnabled,
	});

	const { data: siteSettings } = useQuery<SiteSettings>({
		queryKey: ['/api/settings'],
		enabled: manageEnabled,
	});

	const multiYearMode = siteSettings?.eventsAllowMultipleYearsOnHome === true;

	const { data: libraryForLink = [] } = useQuery<
		{ _id: string; title: string; published?: boolean }[]
	>({
		queryKey: ['/api/library/manage'],
		queryFn: async () => {
			const res = await fetch('/api/library/manage', { credentials: 'include' });
			if (!res.ok) return [];
			const data = await res.json();
			return Array.isArray(data) ? data : data.data || [];
		},
		enabled:
			manageEnabled &&
			hasSpecificPermission('events.edit') &&
			isEventDialogOpen,
	});

	const { data: publishedBerita = [] } = useQuery<{ _id: string; title: string; slug?: string }[]>({
		queryKey: ['/api/berita/manage'],
		queryFn: async () => {
			const res = await fetch('/api/berita/manage', { credentials: 'include' });
			if (!res.ok) return [];
			const data = await res.json();
			return (data.data || data || []).filter((a: any) => a.published);
		},
		enabled: isEventDialogOpen && hasSpecificPermission('events.edit'),
	});

	const { data: events = [], isLoading: isEventsLoading } = useQuery<EventWithSharing[]>({
		queryKey: ['/api/events', selectedYearId, selectedParentEvent?._id],
		queryFn: async () => {
			const parentParam = selectedParentEvent ? selectedParentEvent._id : 'null';
			const res = await fetch(`/api/events?yearId=${selectedYearId}&parentId=${parentParam}`, {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed to fetch events');
			return res.json();
		},
		enabled: !!selectedYearId && manageEnabled,
	});

	const {
		data: requestableEvents = [],
		isLoading: isRequestableLoading,
	} = useQuery<EventRequestable[]>({
		queryKey: ['/api/sharing/requestable', 'events', requestTitleQuery],
		enabled:
			showRequestSharingSearch && requestTitleQuery.trim().length >= 2,
		staleTime: 5000,
		queryFn: async () => {
			const res = await fetch(
				`/api/sharing/requestable?entityType=events&q=${encodeURIComponent(requestTitleQuery)}`,
				{ credentials: 'include' },
			);
			if (!res.ok) return [];
			return (await res.json()) as EventRequestable[];
		},
	});

	const selectedYear = useMemo(
		() => eventYears.find((y) => y._id === selectedYearId),
		[eventYears, selectedYearId],
	);

	const eventsPageDataForSpyro = useMemo(
		() =>
			buildEventsSpyroPageData({
				requestOnly,
				manageEnabled,
				permissionsLoading: isPermLoading,
				selectedYearId,
				selectedYear: selectedYear ?? null,
				selectedParentEvent,
			}),
		[
			requestOnly,
			manageEnabled,
			isPermLoading,
			selectedYearId,
			selectedYear,
			selectedParentEvent,
		],
	);

	const requestSharingSearchBlock = showRequestSharingSearch ? (
		<div className="mb-6 flex flex-col gap-4">
			<div className="relative max-w-xl">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					placeholder="Cari judul event untuk request sharing..."
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
					<CardContent className="p-6 text-center text-muted-foreground">
						Masukkan minimal 2 huruf untuk mencari.
					</CardContent>
				</Card>
			) : requestableEvents.length === 0 ? (
				<Card>
					<CardContent className="p-6 text-center text-muted-foreground">
						Tidak ada hasil untuk judul tersebut.
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4">
					{requestableEvents.map((item, index) => (
						<Card
							key={item._id}
							className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.01] animate-fade-in-up"
							style={{ animationDelay: `${index * 30}ms` }}>
							<CardContent className="p-4">
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0">
										<h3 className="font-bold truncate">{item.title}</h3>
										<span className="text-xs text-muted-foreground">
											{item.published ? 'Published' : 'Draft'}
										</span>
									</div>
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											setSharingEvent({
												_id: item._id,
												title: item.title,
											} as any)
										}
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
	) : null;

	// ─── Settings mutations ──────────────────────────────────────────
	const updateSettingsMut = useMutation({
		mutationFn: async (patch: Partial<SiteSettings>) => {
			const res = await apiRequest('PUT', '/api/settings', patch);
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
		},
		onError: (err: any) => {
			toast({ title: 'Gagal update settings', description: err.message, variant: 'destructive' });
		},
	});

	// ─── Year mutations ────────────────────────────────────────────
	const createYearMut = useMutation({
		mutationFn: async (year: number) => {
			const res = await apiRequest('POST', '/api/event-years', { year });
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/event-years'] });
			setIsYearDialogOpen(false);
			toast({ title: 'Tahun event berhasil dibuat' });
		},
		onError: (err: any) => {
			toast({ title: 'Gagal membuat tahun', description: err.message, variant: 'destructive' });
		},
	});

	const deleteYearMut = useMutation({
		mutationFn: async (id: string) => {
			await apiRequest('DELETE', `/api/event-years/${id}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/event-years'] });
			if (selectedYearId) setSelectedYearId(null);
			toast({ title: 'Tahun event berhasil dihapus' });
		},
	});

	const activateYearMut = useMutation({
		mutationFn: async (id: string) => {
			const res = await apiRequest('PATCH', `/api/event-years/${id}/activate`);
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/event-years'] });
			toast({ title: 'Tahun event ditampilkan di Home' });
		},
	});

	const deactivateYearMut = useMutation({
		mutationFn: async (id: string) => {
			const res = await apiRequest('PATCH', `/api/event-years/${id}/deactivate`);
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/event-years'] });
			toast({ title: 'Tahun event disembunyikan dari Home' });
		},
	});

	// ─── Event mutations ───────────────────────────────────────────
	const saveEventMut = useMutation({
		mutationFn: async ({ formData, isEditing }: { formData: FormData; isEditing: boolean }) => {
			if (isEditing && editingEvent) {
				const res = await apiRequest('PATCH', `/api/events/${editingEvent._id}`, formData);
				return res.json();
			} else {
				const res = await apiRequest('POST', '/api/events', formData);
				return res.json();
			}
		},
		onSuccess: (_data, { isEditing }) => {
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
			queryClient.invalidateQueries({ queryKey: ['/api/berita'], exact: false });
			queryClient.invalidateQueries({ queryKey: ['/api/library'], exact: false });
			setIsEventDialogOpen(false);
			resetForm();
			toast({ title: isEditing ? 'Event berhasil diupdate' : 'Event berhasil dibuat' });
		},
		onError: (err: any) => {
			toast({ title: 'Gagal menyimpan event', description: err.message, variant: 'destructive' });
		},
	});

	const deleteEventMut = useMutation({
		mutationFn: async (id: string) => {
			await apiRequest('DELETE', `/api/events/${id}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/events'] });
			queryClient.invalidateQueries({ queryKey: ['/api/berita'], exact: false });
			queryClient.invalidateQueries({ queryKey: ['/api/library'], exact: false });
			toast({ title: 'Event berhasil dihapus' });
		},
	});

	const copyToBeritaMut = useMutation({
		mutationFn: async ({ eventId, copyAtts }: { eventId: string; copyAtts: boolean }) => {
			const res = await apiRequest('POST', `/api/events/${eventId}/copy-to-berita`, { copyAttachments: copyAtts });
			return res.json();
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({ queryKey: ['/api/berita'], exact: false });
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
			setCopyToBeritaEvent(null);
			toast({
				title: 'Berita berhasil dibuat dari event!',
				description: `"${data.title}" – silakan edit di halaman berita.`,
			});
		},
		onError: (err: any) => {
			toast({ title: 'Gagal membuat berita', description: err.message, variant: 'destructive' });
		},
	});

	const resetForm = useCallback(() => {
		setFormTitle('');
		setFormDesc('');
		setFormStartDate('');
		setFormEndDate('');
		setFormPublished(false);
		setFormThumbnail(null);
		setFormAttachments([]);
		setExistingAttachments([]);
		setFormAttachmentLinkName('');
		setFormAttachmentLinkUrl('');
		setSelectedBeritaIds([]);
		setSelectedGalleryIds([]);
		setGallerySearch('');
		setBeritaSearch('');
		setEditingEvent(null);
	}, []);

	const openCreateEvent = useCallback(() => {
		resetForm();
		setIsEventDialogOpen(true);
	}, [resetForm]);

	const openEditEvent = useCallback((event: EventItem) => {
		setEditingEvent(event);
		setFormTitle(event.title);
		setFormDesc(event.description || '');
		const startStr = event.startDate ? new Date(event.startDate).toISOString().slice(0, 10) : '';
		const endStr = event.endDate ? new Date(event.endDate).toISOString().slice(0, 10) : '';
		setFormStartDate(startStr);
		setFormEndDate(endStr);
		setFormPublished(event.published);
		setExistingAttachments(
			(event.attachments || []).map((att: any) => ({
				name: String(att?.name || 'Lampiran'),
				url: String(att?.url || ''),
				type: String(att?.type || 'link'),
				source: att?.source === 'local' || att?.source === 'gdrive' || att?.source === 'url' ? att.source : 'url',
			})),
		);
		setFormThumbnail(null);
		setFormAttachments([]);
		const beritaIds = (event.relatedBerita || [])
			.map((a: any) => (typeof a === 'object' && a !== null ? a._id : typeof a === 'string' ? a : null))
			.filter((id): id is string => typeof id === 'string' && id.length > 0);
		setSelectedBeritaIds(beritaIds);
		const gids = ((event as any).relatedGalleryIds || [])
			.map((x: any) => (typeof x === 'object' && x?._id ? String(x._id) : String(x)))
			.filter(Boolean);
		setSelectedGalleryIds(gids);
		setGallerySearch('');
		setBeritaSearch('');
		setIsEventDialogOpen(true);
	}, []);

	const detectDriveFileId = useCallback((rawUrl: string): string | null => {
		try {
			const parsed = new URL(rawUrl);
			const host = parsed.hostname.toLowerCase();
			if (!host.includes('drive.google.com')) return null;
			if (parsed.pathname.toLowerCase().includes('/drive/folders/')) return null;
			const parts = parsed.pathname.split('/').filter(Boolean);
			const dIdx = parts.findIndex((part) => part === 'd');
			if (dIdx >= 0 && parts[dIdx + 1]) return parts[dIdx + 1];
			const idParam = parsed.searchParams.get('id');
			if (idParam) return idParam;
			return null;
		} catch {
			return null;
		}
	}, []);

	const handleSaveEvent = useCallback(() => {
		if (!formTitle || !formStartDate || !formEndDate) {
			toast({ title: 'Judul dan tanggal wajib diisi', variant: 'destructive' });
			return;
		}

		let finalAttachments = [...existingAttachments];
		const pendingLinkName = formAttachmentLinkName.trim();
		const pendingLinkUrl = formAttachmentLinkUrl.trim();
		if (pendingLinkName && pendingLinkUrl) {
			try {
				const parsed = new URL(pendingLinkUrl);
				if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
					const driveFileId = detectDriveFileId(pendingLinkUrl);
					const source: EventAttachmentForm['source'] = driveFileId ? 'gdrive' : 'url';
					finalAttachments.push({ name: pendingLinkName, url: pendingLinkUrl, type: 'link', source });
				} else {
					toast({ title: 'URL lampiran harus http/https', variant: 'destructive' });
					return;
				}
			} catch {
				toast({ title: 'URL lampiran tidak valid', variant: 'destructive' });
				return;
			}
		} else if (pendingLinkName || pendingLinkUrl) {
			toast({ title: 'Nama dan URL lampiran wajib diisi lengkap, atau kosongkan keduanya', variant: 'destructive' });
			return;
		}

		const totalAttachments = finalAttachments.length + formAttachments.length;
		if (totalAttachments > 10) {
			toast({ title: `Maksimal 10 lampiran per event. Saat ini ada ${totalAttachments} lampiran.`, variant: 'destructive' });
			return;
		}

		const fd = new FormData();
		fd.append('title', formTitle);
		fd.append('description', formDesc);
		fd.append('startDate', formStartDate);
		fd.append('endDate', formEndDate);
		fd.append('published', String(formPublished));

		const isEditing = !!editingEvent;

		if (!isEditing) {
			fd.append('yearId', selectedYearId!);
			if (selectedParentEvent) {
				fd.append('parentId', selectedParentEvent._id);
			}
		}

		if (formThumbnail) {
			fd.append('thumbnail', formThumbnail);
		}
		for (const f of formAttachments) {
			fd.append('attachmentFiles', f);
		}
		fd.append('attachments', JSON.stringify(finalAttachments));
		const cleanBeritaIds = selectedBeritaIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
		fd.append('relatedBeritaIds', JSON.stringify(cleanBeritaIds));
		const cleanGalleryIds = selectedGalleryIds.filter(
			(id): id is string => typeof id === 'string' && id.length > 0,
		);
		fd.append('relatedGalleryIds', JSON.stringify(cleanGalleryIds));

		saveEventMut.mutate({ formData: fd, isEditing });
	}, [formTitle, formDesc, formStartDate, formEndDate, formPublished, formThumbnail, formAttachments, existingAttachments, formAttachmentLinkName, formAttachmentLinkUrl, detectDriveFileId, selectedBeritaIds, selectedGalleryIds, selectedYearId, selectedParentEvent, editingEvent, saveEventMut, toast]);

	const handleAddAttachmentLink = useCallback(() => {
		const name = formAttachmentLinkName.trim();
		const rawUrl = formAttachmentLinkUrl.trim();
		if (!name || !rawUrl) {
			toast({
				title: 'Nama dan URL lampiran wajib diisi',
				variant: 'destructive',
			});
			return;
		}
		if (existingAttachments.length + formAttachments.length + 1 > 10) {
			toast({ title: 'Maksimal 10 lampiran per event', variant: 'destructive' });
			return;
		}

		let parsed: URL;
		try {
			parsed = new URL(rawUrl);
		} catch {
			toast({ title: 'URL lampiran tidak valid', variant: 'destructive' });
			return;
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			toast({
				title: 'URL lampiran harus http/https',
				variant: 'destructive',
			});
			return;
		}

		const driveFileId = detectDriveFileId(rawUrl);
		const source: EventAttachmentForm['source'] = driveFileId ? 'gdrive' : 'url';
		setExistingAttachments((prev) => [
			...prev,
			{
				name,
				url: rawUrl,
				type: 'link',
				source,
			},
		]);
		setFormAttachmentLinkName('');
		setFormAttachmentLinkUrl('');
	}, [detectDriveFileId, formAttachmentLinkName, formAttachmentLinkUrl, existingAttachments.length, formAttachments.length, toast]);

	const eventsByMonth = useMemo(() => {
		const map = new Map<number, EventItem[]>();
		for (const ev of events) {
			const month = ev.month || new Date(ev.startDate).getMonth() + 1;
			if (!map.has(month)) map.set(month, []);
			map.get(month)!.push(ev);
		}
		return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
	}, [events]);

	if (isPermLoading) {
		return (
			<DashboardLayout
				title="Events"
				pageContextExtra={{ pageData: eventsPageDataForSpyro }}>
				<div className="flex items-center justify-center h-64">
					<Loader2 className="h-8 w-8 animate-spin" />
				</div>
			</DashboardLayout>
		);
	}

	// ─── Year List View ──────────────────────────────────────────────
	if (!selectedYearId) {
		return (
			<DashboardLayout
				title={requestOnly ? 'Events' : 'Manajemen Event'}
				pageContextExtra={{ pageData: eventsPageDataForSpyro }}>
				<div className="space-y-6">
					{requestSharingSearchBlock}
					<DashboardHintCard
						title="Panduan: daftar tahun event"
						variant="blue"
						storageKey="dashboard-events-years"
						description="Tahun mengelompokkan agenda kegiatan HMPS TI UIN Malang (workshop, open house, dll.). Satu atau lebih tahun bisa ditandai tampil di beranda. Hapus tahun bersifat permanen dan memerlukan konfirmasi teks.">
						<ul className="list-disc list-inside space-y-1.5 text-sm">
							<li>
								<strong>Langkah</strong>: (1) klik <strong>Tambah Tahun</strong> jika ada izin <code className="text-xs bg-muted px-1 rounded">events.years_admin</code> → masukkan tahun kalender (mis. <code className="text-xs bg-muted px-1 rounded">2026</code> untuk kepengurusan/kegiatan 2026); (2) klik kartu tahun untuk mengisi event di dalamnya; (3) atur <strong>tampil di Home</strong> untuk tahun yang ingin dipromosikan di beranda.
							</li>
							<li>
								<strong>Contoh valid</strong>: tahun <code className="text-xs bg-muted px-1 rounded">2025</code> untuk arsip kegiatan lalu, <code className="text-xs bg-muted px-1 rounded">2026</code> untuk jadwal himpunan tahun berjalan; satu tahun ditandai aktif di Home; multi-year ON jika beranda perlu menampilkan lebih dari satu kurikulum event.
							</li>
							<li>
								<strong>Contoh tidak valid</strong>: menghapus tahun tanpa mengetik konfirmasi persis seperti diminta; menambah tahun duplikat; mengubah multi-year tanpa izin <code className="text-xs bg-muted px-1 rounded">events.years_admin</code>.
							</li>
							<li>
								<strong>Jika gagal</strong>: refresh; pastikan Anda punya <code className="text-xs bg-muted px-1 rounded">events.years_admin</code> untuk tombol tahun; baca dialog merah sebelum hapus.
							</li>
							<li>
								<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">events.view</code> untuk melihat; <code className="text-xs bg-muted px-1 rounded">events.years_admin</code> untuk tambah/atur tahun &amp; multi-year; <code className="text-xs bg-muted px-1 rounded">events.create</code>/<code className="text-xs bg-muted px-1 rounded">events.edit</code> untuk mengisi event di dalam tahun.
							</li>
						</ul>
					</DashboardHintCard>
					{manageEnabled && (
						<>
					{/* Header */}
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="text-xl sm:text-2xl font-bold">Event Tahunan</h2>
							<p className="text-muted-foreground mt-1 text-sm">Kelola event per tahun dan pilih yang ditampilkan di Home</p>
						</div>
						{hasSpecificPermission('events.years_admin') && (
							<Button onClick={() => setIsYearDialogOpen(true)} className="w-full sm:w-auto">
								<Plus className="h-4 w-4 mr-2" />
								Tambah Tahun
							</Button>
						)}
					</div>

					{/* Multi-year toggle */}
					{hasSpecificPermission('events.years_admin') && (
						<Card className="border-primary/20 bg-primary/5">
							<CardContent className="p-4">
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
									<div>
										<p className="font-medium text-sm">Tampilkan Lebih dari 1 Tahun di Home</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											Jika aktif, beberapa tahun bisa ditampilkan sekaligus dalam satu track di halaman utama.
										</p>
									</div>
									<Switch
										checked={multiYearMode}
										onCheckedChange={(checked) =>
											updateSettingsMut.mutate({ eventsAllowMultipleYearsOnHome: checked })
										}
										disabled={updateSettingsMut.isPending}
										className="flex-shrink-0"
									/>
								</div>
							</CardContent>
						</Card>
					)}

					{isYearsLoading ? (
						<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
					) : eventYears.length === 0 ? (
						<Card>
							<CardContent className="py-12 text-center text-muted-foreground">
								<Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
								<p>Belum ada tahun event. Buat tahun pertama untuk memulai.</p>
							</CardContent>
						</Card>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{eventYears.map((y) => (
								<Card
									key={y._id}
									className="cursor-pointer hover:shadow-lg transition-shadow group relative"
									onClick={() => setSelectedYearId(y._id)}
								>
									<CardHeader className="pb-2">
										<div className="flex items-center justify-between">
											<CardTitle className="text-3xl font-bold">{y.year}</CardTitle>
											<ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
										</div>
									</CardHeader>
									<CardContent>
										<div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
											{/* Status badge */}
											{y.isActiveOnHome ? (
												<Badge className="bg-green-600 text-white w-fit">Ditampilkan di Home</Badge>
											) : (
												<Badge variant="outline" className="w-fit">Tidak aktif</Badge>
											)}

											{/* Action buttons */}
											<div className="flex flex-wrap gap-1.5">
												{/* Multi-year mode: switch toggle per year */}
												{multiYearMode && hasSpecificPermission('events.years_admin') ? (
													<div className="flex items-center gap-2">
														<Switch
															checked={y.isActiveOnHome}
															onCheckedChange={(checked) => {
																if (checked) {
																	activateYearMut.mutate(y._id);
																} else {
																	deactivateYearMut.mutate(y._id);
																}
															}}
															disabled={activateYearMut.isPending || deactivateYearMut.isPending}
														/>
														<span className="text-xs text-muted-foreground">
															{y.isActiveOnHome ? 'Aktif di Home' : 'Nonaktif'}
														</span>
													</div>
												) : (
													/* Single-year mode: Tampilkan button */
													!y.isActiveOnHome && hasSpecificPermission('events.years_admin') && (
														<Button
															variant="outline"
															size="sm"
															onClick={() => activateYearMut.mutate(y._id)}
															disabled={activateYearMut.isPending}
														>
															<Eye className="h-3 w-3 mr-1" />
															Tampilkan
														</Button>
													)
												)}

												{/* Hide button for single-year mode */}
												{!multiYearMode && y.isActiveOnHome && hasSpecificPermission('events.years_admin') && (
													<Button
														variant="outline"
														size="sm"
														onClick={() => deactivateYearMut.mutate(y._id)}
														disabled={deactivateYearMut.isPending}
													>
														<EyeOff className="h-3 w-3 mr-1" />
														Sembunyikan
													</Button>
												)}

											{hasSpecificPermission('events.years_admin') && (
												<Button
													variant="destructive"
														size="sm"
														onClick={async () => {
															setDeleteYearTarget(y);
															setDeleteYearConfirmText('');
															setDeleteYearEventsCount(null);
															try {
																const res = await fetch(`/api/event-years/${y._id}/events-count`, { credentials: 'include' });
																if (res.ok) {
																	const data = await res.json();
																	setDeleteYearEventsCount(data.count ?? 0);
																}
															} catch { setDeleteYearEventsCount(0); }
														}}
														disabled={deleteYearMut.isPending}
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												)}
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
						</>
					)}
				</div>

				{manageEnabled && (
				<Dialog open={isYearDialogOpen} onOpenChange={setIsYearDialogOpen}>
					<DialogContent className="w-[calc(100vw-2rem)] max-w-md">
						<DialogHeader>
							<DialogTitle>Tambah Tahun Event</DialogTitle>
						</DialogHeader>
						<DashboardHintCard
							title="Saat menambah tahun"
							variant="blue"
							storageKey="dashboard-events-dialog-add-year"
							description="Tahun adalah label kalender untuk semua event HMPS TI UIN Malang di periode tersebut. Setelah dibuat, Anda bisa mengisi agenda (mis. seminar TI, pelatihan) di dalam tahun ini.">
							<ul className="list-disc list-inside space-y-1.5 text-sm">
								<li>
									<strong>Langkah</strong>: isi angka tahun antara 2020–2100 → klik <strong>Buat Tahun …</strong> → buka kartu tahun baru untuk menambah event.
								</li>
								<li>
									<strong>Contoh valid</strong>: <code className="text-xs bg-muted px-1 rounded">2026</code> untuk menyimpan rangkaian kegiatan himpunan sepanjang tahun 2026.
								</li>
								<li>
									<strong>Contoh tidak valid</strong>: duplikat tahun yang sudah ada; tahun di luar rentang form.
								</li>
								<li>
									<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">events.years_admin</code>.
								</li>
							</ul>
						</DashboardHintCard>
						<div className="space-y-4">
							<div>
								<Label>Tahun</Label>
								<Input
									type="number"
									value={newYear}
									onChange={(e) => setNewYear(Number(e.target.value))}
									min={2020}
									max={2100}
								/>
							</div>
							<Button
								className="w-full"
								onClick={() => createYearMut.mutate(newYear)}
								disabled={createYearMut.isPending}
							>
								{createYearMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
								Buat Tahun {newYear}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
				)}
			{sharingEvent && (
				<SharingPanel
					entityType="events"
					entityId={sharingEvent._id}
					entityTitle={sharingEvent.title}
					open={!!sharingEvent}
					onOpenChange={(open) => {
						if (!open) setSharingEvent(null);
					}}
				/>
			)}

			<Dialog open={!!deleteYearTarget} onOpenChange={(open) => { if (!open) setDeleteYearTarget(null); }}>
				<DialogContent className="w-[calc(100vw-2rem)] max-w-md">
					<DialogHeader>
						<DialogTitle className="text-red-600">Hapus Tahun {deleteYearTarget?.year}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm space-y-2">
							<p className="font-semibold text-red-700 dark:text-red-400">Peringatan: Tindakan ini tidak dapat dibatalkan!</p>
							<p className="text-red-600 dark:text-red-300">
								{deleteYearEventsCount === null
									? 'Menghitung jumlah event...'
									: deleteYearEventsCount === 0
										? 'Tidak ada event di tahun ini.'
										: `Akan menghapus ${deleteYearEventsCount} event beserta seluruh sub-event dan file yang telah di-upload (thumbnail, attachment, gambar konten).`}
							</p>
						</div>
						<div>
							<Label>Ketik <strong>HAPUS</strong> untuk konfirmasi:</Label>
							<Input
								className="mt-1"
								value={deleteYearConfirmText}
								onChange={(e) => setDeleteYearConfirmText(e.target.value)}
								placeholder="Ketik HAPUS"
								autoFocus
							/>
						</div>
						<div className="flex gap-2 justify-end">
							<Button variant="outline" onClick={() => setDeleteYearTarget(null)}>Batal</Button>
							<Button
								variant="destructive"
								disabled={deleteYearConfirmText !== 'HAPUS' || deleteYearMut.isPending}
								onClick={() => {
									if (deleteYearTarget) {
										deleteYearMut.mutate(deleteYearTarget._id, {
											onSuccess: () => setDeleteYearTarget(null),
										});
									}
								}}
							>
								{deleteYearMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
								Hapus Permanen
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			</DashboardLayout>
		);
	}

	// ─── Event List View (inside a year) ────────────────────────────
	return (
		<DashboardLayout
			title={`Event ${selectedYear?.year || ''}`}
			pageContextExtra={{ pageData: eventsPageDataForSpyro }}>
			<div className="space-y-6">
				{requestSharingSearchBlock}
				{selectedParentEvent ? (
					<DashboardHintCard
						title="Panduan: sub-event (di bawah event induk)"
						variant="blue"
						storageKey="dashboard-events-subevent-level"
						description="Sub-agenda dari satu event induk. Form sama: judul, deskripsi rich text (bisa menyematkan URL YouTube atau Google Drive: file foto/video atau folder — seperti di berita), tanggal, lampiran upload/link online (termasuk Google Drive single-file), publish, berita terkait, sharing.">
						<ul className="list-disc list-inside space-y-1.5 text-sm">
							<li>
								<strong>Langkah</strong>: gunakan breadcrumb <strong>Event {selectedYear?.year}</strong> untuk kembali ke daftar event utama tahun ini → untuk menambah agenda turunan, klik <strong>Tambah Sub-event</strong> → isi judul (mis. &quot;Hari 2: Lomba CP&quot;) → set tanggal mulai/selesai di dalam rentang logis acara induk → lampiran/thumbnail jika perlu → simpan → publish bila siap.
							</li>
							<li>
								<strong>Contoh valid</strong>: induk <em>Open House Teknik Informatika UIN Malang 2026</em>; sub-event <code className="text-xs bg-muted px-1 rounded">Simulasi Lab Pemrograman</code> dengan tanggal di hari kedua pelaksanaan.
							</li>
							<li>
								<strong>Contoh tidak valid</strong>: tanggal sub-event sebelum/sesudah induk secara tidak masuk akal; judul kosong; mengedit sub-event orang lain tanpa izin atau sharing.
							</li>
							<li>
								<strong>Aksi baris</strong>: <strong>Akses</strong> membuka panel sharing; <strong>Edit</strong> mengubah data; <strong>Copy → Berita</strong> membuat draf berita; <strong>Hapus</strong> permanen setelah konfirmasi.
							</li>
							<li>
								<strong>Izin</strong>: sama seperti event utama: <code className="text-xs bg-muted px-1 rounded">events.create</code>, <code className="text-xs bg-muted px-1 rounded">events.edit</code>/<code className="text-xs bg-muted px-1 rounded">events.edit_others</code>, <code className="text-xs bg-muted px-1 rounded">events.publish</code>.
							</li>
						</ul>
					</DashboardHintCard>
				) : (
					<DashboardHintCard
						title="Panduan: event dalam tahun (level utama)"
						variant="blue"
						storageKey="dashboard-events-detail"
						description="Event utama per tahun; bisa dipecah sub-event. Di deskripsi (rich text) Anda bisa menempel URL YouTube atau Google Drive — satu file, banyak file, atau folder — agar tampil di halaman publik (sama seperti modul berita). Untuk lampiran, Anda bisa upload file atau tambah link online/Google Drive single-file langsung dari form.">
						<ul className="list-disc list-inside space-y-1.5 text-sm">
							<li>
								<strong>Langkah</strong>: klik <strong>Tambah Event</strong> → isi judul &amp; deskripsi rich text (sertakan URL Drive/YouTube jika perlu) → tanggal mulai/selesai (input tanggal di dialog) → thumbnail, lampiran, berita terkait → simpan → aktifkan publish jika siap → untuk agenda turunan, buka kartu lalu <strong>Sub-event</strong>.
							</li>
							<li>
								<strong>Contoh valid</strong>: judul <code className="text-xs bg-muted px-1 rounded">Seminar Nasional Teknik Informatika UIN Malang 2026</code>; rentang tanggal konsisten; thumbnail poster himpunan; lampiran PDF rundown.
							</li>
							<li>
								<strong>Contoh tidak valid</strong>: selesai sebelum mulai; judul kosong; publish tanpa <code className="text-xs bg-muted px-1 rounded">events.publish</code>; mengedit milik orang lain tanpa <code className="text-xs bg-muted px-1 rounded">events.edit_others</code> atau sharing.
							</li>
							<li>
								<strong>Sharing</strong>: tombol <strong>Akses</strong> pada kartu untuk mengelola berbagi seperti pada modul lain; dari halaman tahun tanpa membuka tahun, gunakan pencarian ajuan akses jika Anda hanya boleh request.
							</li>
							<li>
								<strong>Copy → Berita</strong>: menyalin ke draft berita—cek dan publish dari modul Berita.
							</li>
							<li>
								<strong>Izin utama</strong>: <code className="text-xs bg-muted px-1 rounded">events.create</code>, <code className="text-xs bg-muted px-1 rounded">events.edit</code>/<code className="text-xs bg-muted px-1 rounded">events.edit_others</code>, <code className="text-xs bg-muted px-1 rounded">events.publish</code>, <code className="text-xs bg-muted px-1 rounded">events.view_others</code>.
							</li>
						</ul>
					</DashboardHintCard>
				)}
				{/* Breadcrumb */}
				<div className="flex items-center gap-1 text-sm flex-wrap">
					<Button variant="ghost" size="sm" className="px-2" onClick={() => { setSelectedYearId(null); setSelectedParentEvent(null); }}>
						<ArrowLeft className="h-4 w-4 mr-1" /> Semua Tahun
					</Button>
					{selectedParentEvent && (
						<>
							<ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							<Button variant="ghost" size="sm" className="px-2" onClick={() => setSelectedParentEvent(null)}>
								Event {selectedYear?.year}
							</Button>
							<ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							<span className="font-medium text-sm truncate max-w-[180px]">{selectedParentEvent.title}</span>
						</>
					)}
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="text-xl sm:text-2xl font-bold">
							{selectedParentEvent
								? `Sub-event: ${selectedParentEvent.title}`
								: `Event Tahun ${selectedYear?.year}`}
						</h2>
						{selectedParentEvent && (
							<p className="text-muted-foreground mt-1 text-sm flex flex-wrap items-center gap-1">
								{formatDate(selectedParentEvent.startDate)} - {formatDate(selectedParentEvent.endDate)}
								<span>{statusBadge(getEventStatus(selectedParentEvent.startDate, selectedParentEvent.endDate))}</span>
							</p>
						)}
					</div>
					{hasSpecificPermission('events.create') && (
						<Button onClick={openCreateEvent} className="w-full sm:w-auto">
							<Plus className="h-4 w-4 mr-2" />
							{selectedParentEvent ? 'Tambah Sub-event' : 'Tambah Event'}
						</Button>
					)}
				</div>

				{isEventsLoading ? (
					<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
				) : events.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center text-muted-foreground">
							<GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>Belum ada {selectedParentEvent ? 'sub-event' : 'event'}. Tambahkan yang pertama.</p>
						</CardContent>
					</Card>
				) : (
					<div className="space-y-6">
						{eventsByMonth.map(([month, monthEvents]) => (
							<div key={month}>
								{!selectedParentEvent && (
									<h3 className="text-lg font-semibold mb-3 text-primary">
										{MONTH_NAMES[month - 1]}
									</h3>
								)}
								<div className="grid gap-3">
									{monthEvents.map((ev) => {
										const status = getEventStatus(ev.startDate, ev.endDate);
										return (
											<Card key={ev._id} className="hover:shadow-md transition-shadow">
												<CardContent className="p-3 sm:p-4">
													<div className="flex flex-col gap-3 sm:flex-row sm:items-start">
														{/* Thumbnail — only show on sm+ inline, or stacked on mobile */}
														{ev.thumbnail && (
															<img
																src={ev.thumbnail}
																alt={ev.title}
																className="w-full h-40 rounded-lg object-cover sm:w-20 sm:h-20 flex-shrink-0"
															/>
														)}
														<div className="flex-1 min-w-0">
															<div className="flex items-start gap-2 flex-wrap">
																<h4 className="font-semibold text-base sm:text-lg break-words min-w-0 flex-1">{ev.title}</h4>
																{statusBadge(status)}
																{!ev.published && <Badge variant="outline">Draft</Badge>}
															</div>
															<p className="text-sm text-muted-foreground mt-1">
																{formatDate(ev.startDate)} - {formatDate(ev.endDate)}
															</p>
															{ev.description && (
																<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
																	{ev.description.replace(/<[^>]*>/g, '')}
																</p>
															)}
															{ev.attachments && ev.attachments.length > 0 && (
																<p className="text-xs text-muted-foreground mt-1">
																	{ev.attachments.length} file terlampir
																</p>
															)}
															{ev.relatedBerita && ev.relatedBerita.length > 0 && (
																<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
																	<FileText className="h-3 w-3" />
																	{ev.relatedBerita.length} berita terkait
																</p>
															)}
														</div>
														{/* Action buttons — full-width row on mobile, column on sm+ */}
														<div className="flex flex-row flex-wrap gap-1.5 sm:flex-col sm:flex-nowrap sm:items-stretch">
															{!selectedParentEvent && (
																<Button
																	variant="outline"
																	size="sm"
																	className="flex-1 sm:flex-none text-xs"
																	onClick={() => setSelectedParentEvent(ev)}
																>
																	<GitBranch className="h-3 w-3 mr-1" />
																	Sub-event
																</Button>
															)}
															<Button variant="outline" size="sm" className="flex-1 sm:flex-none text-xs" onClick={() => setSharingEvent(ev)}>
																<Share2 className="h-3 w-3 mr-1" />
																Akses
															</Button>
															{canEditEvent(ev) && (
																<Button variant="outline" size="sm" className="flex-1 sm:flex-none text-xs" onClick={() => openEditEvent(ev)}>
																	<Edit className="h-3 w-3 mr-1" />
																	Edit
																</Button>
															)}
															{canViewEvent(ev) && (
																<Button
																	variant="outline"
																	size="sm"
																	className="flex-1 sm:flex-none text-xs"
																	title="Copy ke Berita"
																	onClick={() => { setCopyToBeritaEvent(ev); setCopyAttachments(false); }}
																>
																	<Copy className="h-3 w-3 mr-1" />
																	<span className="hidden xs:inline">Copy → </span>Berita
																</Button>
															)}
															{canDeleteEvent(ev) && (
																<Button
																	variant="destructive"
																	size="sm"
																	className="flex-1 sm:flex-none text-xs"
																	onClick={() => {
																		if (confirm(`Hapus event "${ev.title}"?`)) {
																			deleteEventMut.mutate(ev._id);
																		}
																	}}
																	disabled={deleteEventMut.isPending}
																>
																	<Trash2 className="h-3 w-3 mr-1 sm:mr-0" />
																	<span className="sm:hidden">Hapus</span>
																</Button>
															)}
														</div>
													</div>
													{hasSpecificPermission('comments.manage') && (
														<CommentPanel targetType="event" targetId={ev._id} />
													)}
												</CardContent>
											</Card>
										);
									})}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Dialog Create / Edit Event */}
			<Dialog open={isEventDialogOpen} onOpenChange={(open) => { setIsEventDialogOpen(open); if (!open) resetForm(); }}>
				<DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingEvent ? 'Edit Event' : selectedParentEvent ? 'Tambah Sub-event' : 'Tambah Event'}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Judul Event *</Label>
							<Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Nama event..." />
						</div>
						<div>
							<Label>Deskripsi</Label>
							<div className="mt-1 min-w-0 overflow-hidden">
								<RichTextEditor
									value={formDesc}
									onChange={setFormDesc}
									placeholder="Deskripsi event..."
									height={300}
									eventId={editingEvent?._id || `temp-event-${Date.now()}`}
									parentEventId={selectedParentEvent?._id || (editingEvent as any)?.parentId || undefined}
								/>
							</div>
						</div>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<Label>Tanggal Mulai *</Label>
								<Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
							</div>
							<div>
								<Label>Tanggal Selesai *</Label>
								<Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
							</div>
						</div>
						<div>
							<Label>Thumbnail / Poster</Label>
							<div className="mt-1">
								{editingEvent?.thumbnail && !formThumbnail && (
									<img src={editingEvent.thumbnail} alt="current" className="w-32 h-32 object-cover rounded-lg mb-2" />
								)}
								<Input
									type="file"
									accept="image/*"
									onChange={(e) => setFormThumbnail(e.target.files?.[0] || null)}
								/>
							</div>
						</div>
						<div>
							<div className="flex items-center justify-between">
							<Label>Lampiran (file rundown, poster, dokumen, dsb.)</Label>
							<span className="text-xs text-muted-foreground">
								{existingAttachments.length + formAttachments.length}/10 slot terpakai
							</span>
						</div>
							{existingAttachments.length > 0 && (
								<div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
									{existingAttachments.map((att, idx) => (
										<div key={idx} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1 min-w-0">
											<span className="flex-1 truncate min-w-0">{att.name}</span>
											<span className="text-[10px] uppercase rounded px-1.5 py-0.5 bg-background border text-muted-foreground">
												{att.source === 'gdrive' ? 'gdrive' : att.source === 'url' ? 'link' : 'file'}
											</span>
											<Button
												variant="ghost"
												size="sm"
												type="button"
												className="h-6 w-6 p-0 flex-shrink-0"
												onClick={() => setExistingAttachments((prev) => prev.filter((_, i) => i !== idx))}
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</div>
									))}
								</div>
							)}
							<Input
								type="file"
								multiple
								className="mt-2"
								onChange={(e) => {
									if (e.target.files && e.target.files.length > 0) {
										const newFiles = Array.from(e.target.files);
										const currentTotal = existingAttachments.length + formAttachments.length;
										const remaining = 10 - currentTotal;
										if (remaining <= 0) {
											toast({ title: 'Maksimal 10 lampiran per event', variant: 'destructive' });
										} else if (newFiles.length > remaining) {
											toast({ title: `Hanya bisa menambah ${remaining} file lagi (maks 10 total)`, variant: 'destructive' });
											setFormAttachments(prev => [...prev, ...newFiles.slice(0, remaining)]);
										} else {
											setFormAttachments(prev => [...prev, ...newFiles]);
										}
										e.target.value = '';
									}
								}}
							/>
							{formAttachments.length > 0 && (
								<div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
									{formAttachments.map((file, idx) => (
										<div key={`new-${idx}-${file.name}`} className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 rounded px-3 py-1 min-w-0">
											<span className="flex-1 truncate min-w-0">{file.name}</span>
											<span className="text-[10px] uppercase rounded px-1.5 py-0.5 bg-background border text-blue-600 dark:text-blue-400">baru</span>
											<Button
												variant="ghost"
												size="sm"
												type="button"
												className="h-6 w-6 p-0 flex-shrink-0"
												onClick={() => setFormAttachments(prev => prev.filter((_, i) => i !== idx))}
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</div>
									))}
								</div>
							)}
							<div className="mt-3 rounded-md border p-3 space-y-2">
								<p className="text-xs font-medium">Tambah lampiran dari link online</p>
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
									<Input
										value={formAttachmentLinkName}
										onChange={(e) => setFormAttachmentLinkName(e.target.value)}
										placeholder="Nama lampiran (mis. Rundown PDF)"
										className="sm:col-span-1"
									/>
									<Input
										value={formAttachmentLinkUrl}
										onChange={(e) => setFormAttachmentLinkUrl(e.target.value)}
										placeholder="https://... (URL file online)"
										className="sm:col-span-2"
									/>
								</div>
								<div className="flex items-center justify-between gap-2">
									<p className="text-[11px] text-muted-foreground">
										Support link online umum + Google Drive single-file (bukan folder). URL akan dinormalisasi otomatis saat disimpan.
									</p>
									<Button type="button" variant="outline" size="sm" onClick={handleAddAttachmentLink}>
										<Link2 className="h-3.5 w-3.5 mr-1" />
										Tambah Link
									</Button>
								</div>
							</div>
						</div>
						{hasSpecificPermission('events.edit') && (
							<div className="rounded-lg border border-border p-4 space-y-4 bg-muted/20">
								<div>
									<Label className="text-base">Berita &amp; galeri terkait</Label>
									<p className="text-xs text-muted-foreground mt-1">
										Klik Tambah untuk memilih di dialog — sama seperti menautkan event di editor berita.
									</p>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div className="space-y-2 rounded-lg border border-border/80 p-3 bg-background/50">
										<div className="flex items-center justify-between gap-2">
											<div className="flex items-center gap-2 min-w-0">
												<Image className="h-4 w-4 text-primary shrink-0" />
												<span className="text-sm font-medium">Galeri</span>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="shrink-0"
												onClick={() => {
													setGallerySearch('');
													setShowAttachGalleryDialog(true);
												}}>
												<Plus className="h-3.5 w-3.5 mr-1" />
												Tambah Galeri
											</Button>
										</div>
										{selectedGalleryIds.length === 0 ? (
											<p className="text-xs text-muted-foreground">Belum ada galeri terpilih.</p>
										) : (
											<div className="flex flex-wrap gap-2">
												{selectedGalleryIds.map((id) => {
													const g = libraryForLink.find((x) => x._id === id);
													return g ? (
														<Badge
															key={id}
															variant="outline"
															className="text-xs gap-1.5 py-1 px-2 max-w-full">
															<Link2 className="h-3 w-3 shrink-0" />
															<span className="truncate max-w-[220px]">{g.title}</span>
															{g.published === false && (
																<span className="text-muted-foreground shrink-0">(draf)</span>
															)}
															<button
																type="button"
																className="ml-0.5 hover:text-destructive shrink-0"
																onClick={() =>
																	setSelectedGalleryIds((prev) =>
																		prev.filter((i) => i !== id),
																	)
																}
																title="Hapus">
																<X className="h-3 w-3" />
															</button>
														</Badge>
													) : null;
												})}
											</div>
										)}
									</div>
									<div className="space-y-2 rounded-lg border border-border/80 p-3 bg-background/50">
										<div className="flex items-center justify-between gap-2">
											<div className="flex items-center gap-2 min-w-0">
												<FileText className="h-4 w-4 text-primary shrink-0" />
												<span className="text-sm font-medium">Berita</span>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="shrink-0"
												onClick={() => {
													setBeritaSearch('');
													setShowAttachBeritaDialog(true);
												}}>
												<Plus className="h-3.5 w-3.5 mr-1" />
												Tambah Berita
											</Button>
										</div>
										<p className="text-xs text-muted-foreground">
											Hanya berita yang sudah terbit.
										</p>
										{selectedBeritaIds.length === 0 ? (
											<p className="text-xs text-muted-foreground">Belum ada berita terpilih.</p>
										) : (
											<div className="flex flex-wrap gap-2">
												{selectedBeritaIds.map((id) => {
													const art = publishedBerita.find((a) => a._id === id);
													return art ? (
														<Badge
															key={id}
															variant="outline"
															className="text-xs gap-1.5 py-1 px-2 max-w-full">
															<Link2 className="h-3 w-3 shrink-0" />
															<span className="truncate max-w-[220px]">{art.title}</span>
															<button
																type="button"
																className="ml-0.5 hover:text-destructive shrink-0"
																onClick={() =>
																	setSelectedBeritaIds((prev) =>
																		prev.filter((i) => i !== id),
																	)
																}
																title="Hapus">
																<X className="h-3 w-3" />
															</button>
														</Badge>
													) : null;
												})}
											</div>
										)}
									</div>
								</div>
							</div>
						)}
						<div className="flex items-center gap-2">
							<Switch checked={formPublished} onCheckedChange={setFormPublished} />
							<Label>Publikasikan (tampil di Home)</Label>
						</div>
						<Button
							className="w-full"
							onClick={handleSaveEvent}
							disabled={saveEventMut.isPending}
						>
							{saveEventMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							{editingEvent ? 'Simpan Perubahan' : 'Buat Event'}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={showAttachGalleryDialog}
				onOpenChange={(open) => {
					setShowAttachGalleryDialog(open);
					if (!open) setGallerySearch('');
				}}>
				<DialogContent
					overlayClassName="z-[100]"
					className="z-[100] sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Pilih Galeri Terkait</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">
							Centang galeri yang terhubung ke event ini. Simpan event untuk menerapkan.
						</p>
						<div className="relative">
							<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								className="pl-8 h-8 text-sm"
								placeholder="Cari judul galeri..."
								value={gallerySearch}
								onChange={(e) => setGallerySearch(e.target.value)}
							/>
						</div>
						<div className="border rounded-md max-h-60 overflow-y-auto overflow-x-hidden pr-2">
							{libraryForLink
								.filter((g) =>
									gallerySearch
										? g.title.toLowerCase().includes(gallerySearch.toLowerCase())
										: true,
								)
								.map((g) => {
									const checked = selectedGalleryIds.includes(g._id);
									return (
										<label
											key={g._id}
											className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-b-0 overflow-hidden">
											<input
												type="checkbox"
												checked={checked}
												onChange={() => {
													setSelectedGalleryIds((prev) =>
														checked
															? prev.filter((i) => i !== g._id)
															: [...prev, g._id],
													);
												}}
												className="rounded mt-1"
											/>
											<div className="min-w-0">
												<span
													className="block whitespace-normal break-words overflow-hidden"
													style={{
														display: '-webkit-box',
														WebkitLineClamp: 2 as const,
														WebkitBoxOrient: 'vertical' as const,
													}}>
													{g.title}
												</span>
												{g.published === false && (
													<span className="text-xs text-muted-foreground mt-0.5 block">
														(draf)
													</span>
												)}
											</div>
										</label>
									);
								})}
							{libraryForLink.length === 0 && (
								<p className="text-center text-sm text-muted-foreground py-4">
									Tidak ada galeri atau memuat…
								</p>
							)}
						</div>
						<div className="flex justify-end pt-2">
							<Button variant="outline" onClick={() => setShowAttachGalleryDialog(false)}>
								Selesai
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={showAttachBeritaDialog}
				onOpenChange={(open) => {
					setShowAttachBeritaDialog(open);
					if (!open) setBeritaSearch('');
				}}>
				<DialogContent
					overlayClassName="z-[100]"
					className="z-[100] sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Pilih Berita Terkait</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">
							Hanya berita yang sudah terbit. Centang yang relevan dengan event ini.
						</p>
						<div className="relative">
							<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								className="pl-8 h-8 text-sm"
								placeholder="Cari judul berita..."
								value={beritaSearch}
								onChange={(e) => setBeritaSearch(e.target.value)}
							/>
						</div>
						<div className="border rounded-md max-h-60 overflow-y-auto overflow-x-hidden pr-2">
							{publishedBerita
								.filter((a) =>
									beritaSearch
										? a.title.toLowerCase().includes(beritaSearch.toLowerCase())
										: true,
								)
								.map((a) => {
									const checked = selectedBeritaIds.includes(a._id);
									return (
										<label
											key={a._id}
											className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-b-0 overflow-hidden">
											<input
												type="checkbox"
												checked={checked}
												onChange={() => {
													setSelectedBeritaIds((prev) =>
														checked
															? prev.filter((i) => i !== a._id)
															: [...prev, a._id],
													);
												}}
												className="rounded mt-1"
											/>
											<div className="min-w-0">
												<span
													className="block whitespace-normal break-words overflow-hidden"
													style={{
														display: '-webkit-box',
														WebkitLineClamp: 2 as const,
														WebkitBoxOrient: 'vertical' as const,
													}}>
													{a.title}
												</span>
											</div>
										</label>
									);
								})}
							{publishedBerita.filter((a) =>
								beritaSearch
									? a.title.toLowerCase().includes(beritaSearch.toLowerCase())
									: true,
							).length === 0 && (
								<p className="text-center text-sm text-muted-foreground py-4">
									{beritaSearch ? 'Tidak ada berita yang cocok' : 'Belum ada berita publish'}
								</p>
							)}
						</div>
						<div className="flex justify-end pt-2">
							<Button variant="outline" onClick={() => setShowAttachBeritaDialog(false)}>
								Selesai
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Dialog Copy Event ke Berita */}
			<Dialog open={!!copyToBeritaEvent} onOpenChange={(o) => { if (!o) setCopyToBeritaEvent(null); }}>
				<DialogContent className="w-[calc(100vw-1rem)] max-w-md">
					<DialogHeader>
						<DialogTitle>Copy Event ke Berita</DialogTitle>
					</DialogHeader>
					{copyToBeritaEvent && (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Akan dibuat berita baru (draft) dari event <strong>"{copyToBeritaEvent.title}"</strong>.
								Anda bisa mengedit dan mempublikasikannya nanti di halaman Berita.
							</p>
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="copy-attachments-check"
									checked={copyAttachments}
									onChange={(e) => setCopyAttachments(e.target.checked)}
									className="rounded"
								/>
								<Label htmlFor="copy-attachments-check" className="cursor-pointer">
									Sertakan lampiran/gambar ke konten berita
								</Label>
							</div>
							<div className="flex flex-col gap-2 sm:flex-row pt-2">
								<Button
									className="flex-1"
									onClick={() => copyToBeritaMut.mutate({ eventId: copyToBeritaEvent._id, copyAtts: copyAttachments })}
									disabled={copyToBeritaMut.isPending}
								>
									{copyToBeritaMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
									<Copy className="h-4 w-4 mr-2" />
									Buat Berita
								</Button>
								<Button variant="outline" onClick={() => setCopyToBeritaEvent(null)}>Batal</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
			{sharingEvent && (
				<SharingPanel
					entityType="events"
					entityId={sharingEvent._id}
					entityTitle={sharingEvent.title}
					open={!!sharingEvent}
					onOpenChange={(open) => {
						if (!open) setSharingEvent(null);
					}}
				/>
			)}
		</DashboardLayout>
	);
}
