import DashboardLayout from '@/components/dashboard/dashboard-layout';
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
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
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
	FileText,
	GitBranch,
	Loader2,
	Plus,
	Search,
	Trash2,
	Upload,
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

export default function DashboardEvents() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { hasSpecificPermission } = useAuth();
	usePermissionRefresh();

	const { hasPermission: hasAccess, isLoading: isPermLoading } =
		usePermissionGuardAny(['events.view', 'events.create', 'events.edit']);

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
	const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
	const [articleSearch, setArticleSearch] = useState('');

	// Copy to article state
	const [copyToArticleEvent, setCopyToArticleEvent] = useState<EventItem | null>(null);
	const [copyAttachments, setCopyAttachments] = useState(false);

	// Queries
	const { data: eventYears = [], isLoading: isYearsLoading } = useQuery<EventYear[]>({
		queryKey: ['/api/event-years'],
		enabled: hasAccess,
	});

	const { data: publishedArticles = [] } = useQuery<{ _id: string; title: string; slug?: string }[]>({
		queryKey: ['/api/articles/manage'],
		queryFn: async () => {
			const res = await fetch('/api/articles/manage');
			if (!res.ok) return [];
			const data = await res.json();
			return (data.articles || data || []).filter((a: any) => a.published);
		},
		enabled: isEventDialogOpen && hasSpecificPermission('events.edit'),
	});

	const { data: events = [], isLoading: isEventsLoading } = useQuery<EventItem[]>({
		queryKey: ['/api/events', selectedYearId, selectedParentEvent?._id],
		queryFn: async () => {
			const parentParam = selectedParentEvent ? selectedParentEvent._id : 'null';
			const res = await fetch(`/api/events?yearId=${selectedYearId}&parentId=${parentParam}`);
			if (!res.ok) throw new Error('Failed to fetch events');
			return res.json();
		},
		enabled: !!selectedYearId && hasAccess,
	});

	const selectedYear = useMemo(
		() => eventYears.find((y) => y._id === selectedYearId),
		[eventYears, selectedYearId],
	);

	// Mutations
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

	const copyToArticleMut = useMutation({
		mutationFn: async ({ eventId, copyAtts }: { eventId: string; copyAtts: boolean }) => {
			const res = await apiRequest('POST', `/api/events/${eventId}/copy-to-article`, { copyAttachments: copyAtts });
			return res.json();
		},
		onSuccess: (data: any) => {
			// Invalidate both articles AND events (copy modifies event.relatedArticles in DB)
			queryClient.invalidateQueries({ queryKey: ['/api/articles'], exact: false });
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
			setCopyToArticleEvent(null);
			toast({
				title: 'Artikel berhasil dibuat dari event!',
				description: `"${data.title}" – silakan edit di halaman artikel.`,
			});
		},
		onError: (err: any) => {
			toast({ title: 'Gagal membuat artikel', description: err.message, variant: 'destructive' });
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
		setSelectedArticleIds([]);
		setArticleSearch('');
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
		// relatedArticles may be populated objects { _id, title } or raw ObjectId strings depending on fetch
		const articleIds = (event.relatedArticles || [])
			.map((a: any) => (typeof a === 'object' && a !== null ? a._id : typeof a === 'string' ? a : null))
			.filter((id): id is string => typeof id === 'string' && id.length > 0);
		setSelectedArticleIds(articleIds);
		setArticleSearch('');
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
		// Filter out any null/undefined that may appear if relatedArticles were returned unpopulated
		const cleanArticleIds = selectedArticleIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
		fd.append('relatedArticleIds', JSON.stringify(cleanArticleIds));

		saveEventMut.mutate({ formData: fd, isEditing });
	}, [formTitle, formDesc, formStartDate, formEndDate, formPublished, formThumbnail, formAttachments, existingAttachments, selectedArticleIds, selectedYearId, selectedParentEvent, editingEvent, saveEventMut, toast]);

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

	// ─── Year List View ─────────────────────────────────────────
	if (!selectedYearId) {
		return (
			<DashboardLayout title="Manajemen Event">
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-2xl font-bold">Event Tahunan</h2>
							<p className="text-muted-foreground mt-1">Kelola event per tahun dan pilih yang ditampilkan di Home</p>
						</div>
						{hasSpecificPermission('events.create') && (
							<Button onClick={() => setIsYearDialogOpen(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Tambah Tahun
							</Button>
						)}
					</div>

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
										<div className="flex items-center justify-between">
											{y.isActiveOnHome ? (
												<Badge className="bg-green-600 text-white">Ditampilkan di Home</Badge>
											) : (
												<Badge variant="outline">Tidak aktif</Badge>
											)}
											<div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
												{!y.isActiveOnHome && hasSpecificPermission('events.edit') && (
													<Button
														variant="outline"
														size="sm"
														onClick={() => activateYearMut.mutate(y._id)}
														disabled={activateYearMut.isPending}
													>
														<Eye className="h-3 w-3 mr-1" />
														Tampilkan
													</Button>
												)}
												{hasSpecificPermission('events.delete') && (
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
				</div>

				{/* Dialog Tambah Tahun */}
				<Dialog open={isYearDialogOpen} onOpenChange={setIsYearDialogOpen}>
					<DialogContent className="sm:max-w-md">
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
			</DashboardLayout>
		);
	}

	// ─── Event List View (inside a year) ─────────────────────────
	return (
		<DashboardLayout title={`Event ${selectedYear?.year || ''}`}>
			<div className="space-y-6">
				{/* Breadcrumb */}
				<div className="flex items-center gap-2 text-sm flex-wrap">
					<Button variant="ghost" size="sm" onClick={() => { setSelectedYearId(null); setSelectedParentEvent(null); }}>
						<ArrowLeft className="h-4 w-4 mr-1" /> Semua Tahun
					</Button>
					{selectedParentEvent && (
						<>
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
							<Button variant="ghost" size="sm" onClick={() => setSelectedParentEvent(null)}>
								Event {selectedYear?.year}
							</Button>
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
							<span className="font-medium">{selectedParentEvent.title}</span>
						</>
					)}
				</div>

				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-2xl font-bold">
							{selectedParentEvent
								? `Sub-event: ${selectedParentEvent.title}`
								: `Event Tahun ${selectedYear?.year}`}
						</h2>
						{selectedParentEvent && (
							<p className="text-muted-foreground mt-1">
								{formatDate(selectedParentEvent.startDate)} - {formatDate(selectedParentEvent.endDate)}
								<span className="ml-2">{statusBadge(getEventStatus(selectedParentEvent.startDate, selectedParentEvent.endDate))}</span>
							</p>
						)}
					</div>
					{hasSpecificPermission('events.create') && (
						<Button onClick={openCreateEvent}>
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
												<CardContent className="p-4">
													<div className="flex items-start gap-4">
														{ev.thumbnail && (
															<img
																src={ev.thumbnail}
																alt={ev.title}
																className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
															/>
														)}
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2 flex-wrap">
																<h4 className="font-semibold text-lg truncate">{ev.title}</h4>
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
															{ev.relatedArticles && ev.relatedArticles.length > 0 && (
																<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
																	<FileText className="h-3 w-3" />
																	{ev.relatedArticles.length} artikel terkait
																</p>
															)}
														</div>
														<div className="flex flex-col gap-1 flex-shrink-0">
															{!selectedParentEvent && (
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() => setSelectedParentEvent(ev)}
																>
																	<GitBranch className="h-3 w-3 mr-1" />
																	Sub-event
																</Button>
															)}
															{hasSpecificPermission('events.edit') && (
																<Button variant="outline" size="sm" onClick={() => openEditEvent(ev)}>
																	<Edit className="h-3 w-3 mr-1" />
																	Edit
																</Button>
															)}
															<Button
																variant="outline"
																size="sm"
																title="Copy ke Artikel"
																onClick={() => { setCopyToArticleEvent(ev); setCopyAttachments(false); }}
															>
																<Copy className="h-3 w-3 mr-1" />
																Copy → Artikel
															</Button>
															{hasSpecificPermission('events.delete') && (
																<Button
																	variant="destructive"
																	size="sm"
																	onClick={() => {
																		if (confirm(`Hapus event "${ev.title}"?`)) {
																			deleteEventMut.mutate(ev._id);
																		}
																	}}
																	disabled={deleteEventMut.isPending}
																>
																	<Trash2 className="h-3 w-3 mr-1" />
																	Hapus
																</Button>
															)}
														</div>
													</div>
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
				<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
						<div className="mt-1">
							<RichTextEditor
								value={formDesc}
								onChange={setFormDesc}
								placeholder="Deskripsi event..."
								height={300}
							/>
						</div>
					</div>
						<div className="grid grid-cols-2 gap-4">
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
								<div className="mt-2 space-y-1">
									{existingAttachments.map((att, idx) => (
										<div key={idx} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1">
											<span className="flex-1 truncate">{att.name}</span>
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0"
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
								Artikel Terkait
							</Label>
							<p className="text-xs text-muted-foreground mb-2">
								Pilih artikel publish yang berkaitan dengan event ini.
							</p>
							<div className="relative mb-2">
								<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									className="pl-8 h-8 text-sm"
									placeholder="Cari judul artikel..."
									value={articleSearch}
									onChange={(e) => setArticleSearch(e.target.value)}
								/>
							</div>
							{selectedArticleIds.length > 0 && (
								<div className="flex flex-wrap gap-1 mb-2">
									{selectedArticleIds.map((id) => {
										const art = publishedArticles.find((a) => a._id === id);
										return art ? (
											<Badge key={id} variant="secondary" className="text-xs gap-1">
												{art.title.length > 30 ? art.title.slice(0, 30) + '…' : art.title}
												<button
													type="button"
													className="ml-1 text-muted-foreground hover:text-destructive"
													onClick={() => setSelectedArticleIds((prev) => prev.filter((i) => i !== id))}
												>
													×
												</button>
											</Badge>
										) : null;
									})}
								</div>
							)}
							<div className="border rounded-md max-h-40 overflow-y-auto">
								{publishedArticles
									.filter((a) =>
										articleSearch
											? a.title.toLowerCase().includes(articleSearch.toLowerCase())
											: true
									)
									.map((a) => {
										const checked = selectedArticleIds.includes(a._id);
										return (
											<label
												key={a._id}
												className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
											>
												<input
													type="checkbox"
													checked={checked}
													onChange={() => {
														setSelectedArticleIds((prev) =>
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
								{publishedArticles.filter((a) =>
									articleSearch
										? a.title.toLowerCase().includes(articleSearch.toLowerCase())
										: true
								).length === 0 && (
									<p className="text-center text-sm text-muted-foreground py-4">
										{articleSearch ? 'Tidak ada artikel yang cocok' : 'Belum ada artikel publish'}
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

			{/* Dialog Copy Event ke Artikel */}
			<Dialog open={!!copyToArticleEvent} onOpenChange={(o) => { if (!o) setCopyToArticleEvent(null); }}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Copy Event ke Artikel</DialogTitle>
					</DialogHeader>
					{copyToArticleEvent && (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Akan dibuat artikel baru (draft) dari event <strong>"{copyToArticleEvent.title}"</strong>.
								Anda bisa mengedit dan mempublikasikannya nanti di halaman Artikel.
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
									Sertakan lampiran/gambar ke konten artikel
								</Label>
							</div>
							<div className="flex gap-2 pt-2">
								<Button
									className="flex-1"
									onClick={() => copyToArticleMut.mutate({ eventId: copyToArticleEvent._id, copyAtts: copyAttachments })}
									disabled={copyToArticleMut.isPending}
								>
									{copyToArticleMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
									<Copy className="h-4 w-4 mr-2" />
									Buat Artikel
								</Button>
								<Button variant="outline" onClick={() => setCopyToArticleEvent(null)}>Batal</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
