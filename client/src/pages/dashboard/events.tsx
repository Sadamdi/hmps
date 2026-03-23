import CommentPanel from '@/components/dashboard/comment-panel';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
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
	Loader2,
	Plus,
	Search,
	Share2,
	Trash2,
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
	const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

	// Event form state
	const [formTitle, setFormTitle] = useState('');
	const [formDesc, setFormDesc] = useState('');
	const [formStartDate, setFormStartDate] = useState('');
	const [formEndDate, setFormEndDate] = useState('');
	const [formPublished, setFormPublished] = useState(false);
	const [formThumbnail, setFormThumbnail] = useState<File | null>(null);
	const [formAttachments, setFormAttachments] = useState<File[]>([]);
	const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
	const [selectedBeritaIds, setSelectedBeritaIds] = useState<string[]>([]);
	const [beritaSearch, setBeritaSearch] = useState('');

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
		setSelectedBeritaIds([]);
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
		setExistingAttachments(event.attachments || []);
		setFormThumbnail(null);
		setFormAttachments([]);
		const beritaIds = (event.relatedBerita || [])
			.map((a: any) => (typeof a === 'object' && a !== null ? a._id : typeof a === 'string' ? a : null))
			.filter((id): id is string => typeof id === 'string' && id.length > 0);
		setSelectedBeritaIds(beritaIds);
		setBeritaSearch('');
		setIsEventDialogOpen(true);
	}, []);

	const handleSaveEvent = useCallback(() => {
		if (!formTitle || !formStartDate || !formEndDate) {
			toast({ title: 'Judul dan tanggal wajib diisi', variant: 'destructive' });
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
		fd.append('attachments', JSON.stringify(existingAttachments));
		const cleanBeritaIds = selectedBeritaIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
		fd.append('relatedBeritaIds', JSON.stringify(cleanBeritaIds));

		saveEventMut.mutate({ formData: fd, isEditing });
	}, [formTitle, formDesc, formStartDate, formEndDate, formPublished, formThumbnail, formAttachments, existingAttachments, selectedBeritaIds, selectedYearId, selectedParentEvent, editingEvent, saveEventMut, toast]);

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
			<DashboardLayout title="Events">
				<div className="flex items-center justify-center h-64">
					<Loader2 className="h-8 w-8 animate-spin" />
				</div>
			</DashboardLayout>
		);
	}

	// ─── Year List View ──────────────────────────────────────────────
	if (!selectedYearId) {
		return (
			<DashboardLayout title={requestOnly ? 'Events' : 'Manajemen Event'}>
				<div className="space-y-6">
					{requestSharingSearchBlock}
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
														onClick={() => {
															if (confirm(`Hapus tahun ${y.year} dan semua eventnya?`)) {
																deleteYearMut.mutate(y._id);
															}
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
			</DashboardLayout>
		);
	}

	// ─── Event List View (inside a year) ────────────────────────────
	return (
		<DashboardLayout title={`Event ${selectedYear?.year || ''}`}>
			<div className="space-y-6">
				{requestSharingSearchBlock}
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
							<Label>Lampiran (file rundown, poster, dokumen, dsb.)</Label>
							{existingAttachments.length > 0 && (
								<div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
									{existingAttachments.map((att, idx) => (
										<div key={idx} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1 min-w-0">
											<span className="flex-1 truncate min-w-0">{att.name}</span>
											<Button
												variant="ghost"
												size="sm"
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
									if (e.target.files) setFormAttachments(Array.from(e.target.files));
								}}
							/>
							{formAttachments.length > 0 && (
								<p className="text-xs text-muted-foreground mt-1">{formAttachments.length} file baru akan diupload</p>
							)}
						</div>
						{hasSpecificPermission('events.edit') && (
							<div>
								<Label className="flex items-center gap-1 mb-2">
									<FileText className="h-4 w-4" />
									Berita Terkait
								</Label>
								<p className="text-xs text-muted-foreground mb-2">
									Pilih berita publish yang berkaitan dengan event ini.
								</p>
								<div className="relative mb-2">
									<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										className="pl-8 h-8 text-sm"
										placeholder="Cari judul berita..."
										value={beritaSearch}
										onChange={(e) => setBeritaSearch(e.target.value)}
									/>
								</div>
								{selectedBeritaIds.length > 0 && (
									<div className="flex flex-wrap gap-1 mb-2">
										{selectedBeritaIds.map((id) => {
											const art = publishedBerita.find((a) => a._id === id);
											return art ? (
												<Badge key={id} variant="secondary" className="text-xs gap-1">
													{art.title.length > 30 ? art.title.slice(0, 30) + '…' : art.title}
													<button
														type="button"
														className="ml-1 text-muted-foreground hover:text-destructive"
														onClick={() => setSelectedBeritaIds((prev) => prev.filter((i) => i !== id))}
													>
														×
													</button>
												</Badge>
											) : null;
										})}
									</div>
								)}
								<div className="border rounded-md max-h-40 overflow-y-auto">
									{publishedBerita
										.filter((a) =>
											beritaSearch
												? a.title.toLowerCase().includes(beritaSearch.toLowerCase())
												: true
										)
										.map((a) => {
											const checked = selectedBeritaIds.includes(a._id);
											return (
												<label
													key={a._id}
													className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
												>
													<input
														type="checkbox"
														checked={checked}
														onChange={() => {
															setSelectedBeritaIds((prev) =>
																checked
																	? prev.filter((i) => i !== a._id)
																	: [...prev, a._id]
															);
														}}
														className="rounded"
													/>
													<span className="flex-1 truncate">{a.title}</span>
												</label>
											);
										})}
									{publishedBerita.filter((a) =>
										beritaSearch
											? a.title.toLowerCase().includes(beritaSearch.toLowerCase())
											: true
									).length === 0 && (
										<p className="text-center text-sm text-muted-foreground py-4">
											{beritaSearch ? 'Tidak ada berita yang cocok' : 'Belum ada berita publish'}
										</p>
									)}
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
