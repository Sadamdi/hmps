import RichTextEditor from '@/components/dashboard/rich-text-editor';
import { ContentEnhanceButton } from '@/components/dashboard/content-enhance-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
	CalendarDays,
	FileText,
	Link2,
	Loader2,
	Plus,
	Search,
	Upload,
	X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { GDriveLinkInput } from '../GDriveLinkInput';
import MediaDisplay from '../MediaDisplay';

interface LibraryItem {
	id?: number;
	_id?: string;
	title: string;
	description: string;
	fullDescription: string;
	images: string[];
	mediaKinds?: ('image' | 'video')[];
	date?: string;
	time?: string;
	type: 'photo' | 'video';
	createdAt?: string;
	published?: boolean;
	activityDate?: string;
	relatedEventIds?: string[];
	relatedBeritaIds?: string[];
	gdriveEmbedFolders?: { folderId: string; url: string }[];
	tags?: string[];
}

interface MediaUploaderProps {
	item: LibraryItem | null;
	onSave: () => void;
	onCancel: () => void;
}

function toIsoDateInput(d: string | Date | undefined): string {
	if (!d) return '';
	try {
		const x = new Date(d);
		if (Number.isNaN(x.getTime())) return '';
		return x.toISOString().slice(0, 10);
	} catch {
		return '';
	}
}

export default function MediaUploader({
	item,
	onSave,
	onCancel,
}: MediaUploaderProps) {
	const { toast } = useToast();
	const [title, setTitle] = useState(item?.title || '');
	const [description, setDescription] = useState(item?.description || '');
	const [fullDescription, setFullDescription] = useState(
		item?.fullDescription || '',
	);
	const [mediaType, setMediaType] = useState<'photo' | 'video'>(
		item?.type || 'photo',
	);
	const [published, setPublished] = useState(item?.published !== false);
	const [activityDate, setActivityDate] = useState(
		toIsoDateInput(item?.activityDate as string) ||
			toIsoDateInput(item?.createdAt),
	);
	const [relatedEventIds, setRelatedEventIds] = useState<string[]>([]);
	const [relatedBeritaIds, setRelatedBeritaIds] = useState<string[]>([]);
	const [tags, setTags] = useState<string[]>(item?.tags ?? []);
	const [tagInput, setTagInput] = useState('');

	const [gdriveUrls, setGdriveUrls] = useState<string[]>(['']);
	const [gdriveValidations, setGdriveValidations] = useState<{
		[key: number]: boolean;
	}>({});
	const [gdriveErrors, setGdriveErrors] = useState<{ [key: number]: string }>(
		{},
	);
	const [gdriveMediaTypes, setGdriveMediaTypes] = useState<{
		[key: number]: 'image' | 'video';
	}>({});
	const [embedFoldersOnly, setEmbedFoldersOnly] = useState(false);
	const [showAttachEventDialog, setShowAttachEventDialog] = useState(false);
	const [showAttachBeritaDialog, setShowAttachBeritaDialog] = useState(false);
	const [eventLinkSearch, setEventLinkSearch] = useState('');
	const [beritaLinkSearch, setBeritaLinkSearch] = useState('');

	const { data: eventsForLink = [] } = useQuery<
		{ _id: string; title: string }[]
	>({
		queryKey: ['/api/events/published'],
		queryFn: async () => {
			const r = await fetch('/api/events/published');
			if (!r.ok) return [];
			return r.json();
		},
	});

	const { data: beritaForLink = [] } = useQuery<
		{ _id: string; title: string; published?: boolean }[]
	>({
		queryKey: ['/api/berita/manage'],
		queryFn: async () => {
			const r = await apiRequest('GET', '/api/berita/manage');
			return r.json();
		},
	});

	useEffect(() => {
		if (item) {
			setTitle(item.title || '');
			setDescription(item.description || '');
			setFullDescription(item.fullDescription || '');
			setMediaType(item.type || 'photo');
			setPublished(item.published !== false);
			setActivityDate(
				toIsoDateInput(item.activityDate as string) ||
					toIsoDateInput(item.createdAt),
			);
			setRelatedEventIds(
				(item.relatedEventIds || []).map((x) => String(x)),
			);
		setRelatedBeritaIds(
			(item.relatedBeritaIds || []).map((x) => String(x)),
		);
		setTags(item.tags ?? []);

			const embeds = (item as LibraryItem).gdriveEmbedFolders;
			if (embeds && embeds.length > 0) {
				setEmbedFoldersOnly(true);
				setGdriveUrls(embeds.map((f) => f.url));
				const validations: { [key: number]: boolean } = {};
				embeds.forEach((_, index: number) => {
					validations[index] = true;
				});
				setGdriveValidations(validations);
				setGdriveMediaTypes({});
			} else if (item.images && item.images.length > 0) {
				setEmbedFoldersOnly(false);
				setGdriveUrls(item.images);
				const validations: { [key: number]: boolean } = {};
				const mediaTypes: { [key: number]: 'image' | 'video' } = {};
				item.images.forEach((url: string, index: number) => {
					validations[index] = true;
					const mk = item.mediaKinds?.[index];
					if (mk === 'video') mediaTypes[index] = 'video';
					else if (mk === 'image') mediaTypes[index] = 'image';
					else mediaTypes[index] = item.type === 'video' ? 'video' : 'image';
				});
				setGdriveValidations(validations);
				setGdriveMediaTypes(mediaTypes);
			}
		} else {
			setPublished(true);
			setRelatedEventIds([]);
			setRelatedBeritaIds([]);
			setActivityDate('');
			setEmbedFoldersOnly(false);
		}
	}, [item]);

	const saveMediaMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			if (item) {
				const itemId = (item as any)._id || item.id;
				if (!itemId) throw new Error('Invalid item ID');
				return await apiRequest('PUT', `/api/library/${itemId}`, formData);
			}
			return await apiRequest('POST', '/api/library', formData);
		},
		onSuccess: async (data) => {
			queryClient.invalidateQueries({ queryKey: ['/api/library'] });
			queryClient.invalidateQueries({ queryKey: ['/api/library/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			try {
				const isEdit = !!item;
				const responseData = await data.json();
				const itemId = responseData._id || responseData.id || 'unknown';

				if (isEdit) {
					await logActivity(
						ActivityTemplates.libraryItemUpdated(title, String(itemId)),
					);
				} else {
					await logActivity(
						ActivityTemplates.libraryItemCreated(title, String(itemId)),
					);
				}
			} catch (error) {
				console.warn('Failed to log library activity:', error);
			}

			setTitle('');
			setDescription('');
			setFullDescription('');
			setGdriveUrls(['']);
			setGdriveValidations({});
			setGdriveErrors({});
			setGdriveMediaTypes({});
			setRelatedEventIds([]);
			setRelatedBeritaIds([]);

			toast({
				title: 'Success',
				description: 'Media uploaded successfully',
			});

			onSave();
		},
		onError: (error: any) => {
			const message =
				error?.response?.data?.message ||
				error?.message ||
				'Failed to save the media item. Please try again.';

			toast({
				title: 'Error',
				description: message,
				variant: 'destructive',
			});

			console.error('Save error:', error);
		},
	});

	const handleGdriveValidation = (
		index: number,
		isValid: boolean,
		error?: string,
	) => {
		setGdriveValidations((prev) => ({ ...prev, [index]: isValid }));
		setGdriveErrors((prev) => ({ ...prev, [index]: error || '' }));
	};

	const handleFolderDetected = (index: number, isFolder: boolean) => {
		if (!isFolder) return;
		setEmbedFoldersOnly(true);
		setGdriveUrls((prev) => {
			const url = prev[index];
			return url ? [url] : [''];
		});
		setGdriveValidations({ 0: true });
		setGdriveErrors({});
		setGdriveMediaTypes({});
	};

	const handleGdriveMediaTypeChange = (
		index: number,
		t: 'image' | 'video',
	) => {
		setGdriveMediaTypes((prev) => ({ ...prev, [index]: t }));
	};

	const addGdriveInput = () => {
		setGdriveUrls((prev) => [...prev, '']);
	};

	const removeGdriveInput = (index: number) => {
		setGdriveUrls((prev) => prev.filter((_, i) => i !== index));
		setGdriveValidations((prev) => {
			const newValidations = { ...prev };
			delete newValidations[index];
			return newValidations;
		});
		setGdriveErrors((prev) => {
			const newErrors = { ...prev };
			delete newErrors[index];
			return newErrors;
		});
		setGdriveMediaTypes((prev) => {
			const newTypes = { ...prev };
			delete newTypes[index];
			return newTypes;
		});
	};

	const updateGdriveUrl = (index: number, url: string) => {
		setGdriveUrls((prev) => {
			const newUrls = [...prev];
			newUrls[index] = url;
			return newUrls;
		});
	};

	const toggleEvent = (id: string) => {
		setRelatedEventIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	const toggleBerita = (id: string) => {
		setRelatedBeritaIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	const handleSave = async () => {
		if (!title.trim()) {
			toast({
				title: 'Error',
				description: 'Title is required',
				variant: 'destructive',
			});
			return;
		}

		const validUrls = gdriveUrls.filter((url) => url.trim() !== '');
		if (validUrls.length === 0) {
			toast({
				title: 'Error',
				description: 'Please provide at least one Google Drive link',
				variant: 'destructive',
			});
			return;
		}

		const hasInvalidUrls = validUrls.some(
			(_url, index) => !gdriveValidations[index],
		);
		if (hasInvalidUrls) {
			toast({
				title: 'Error',
				description:
					'Please make sure all Google Drive links are valid and accessible',
				variant: 'destructive',
			});
			return;
		}

		try {
			const formData = new FormData();
			formData.append('title', title);
			formData.append('description', description);
			formData.append('fullDescription', fullDescription);
			formData.append('type', mediaType);
			formData.append('published', String(published));
			if (activityDate) formData.append('activityDate', activityDate);
			formData.append('relatedEventIds', JSON.stringify(relatedEventIds));
			formData.append('relatedBeritaIds', JSON.stringify(relatedBeritaIds));
			formData.append('embedFoldersOnly', String(embedFoldersOnly));
			if (tags.length > 0) formData.append('tags', JSON.stringify(tags));

			validUrls.forEach((url, index) => {
				formData.append(`gdriveUrls[${index}]`, url);
				formData.append(
					`gdriveMediaTypes[${index}]`,
					'image',
				);
			});

			await saveMediaMutation.mutateAsync(formData);
		} catch (error) {
			console.error('Upload error:', error);
			toast({
				title: 'Error',
				description: 'Failed to upload media. Please try again.',
				variant: 'destructive',
			});
		}
	};

	return (
		<div className="flex flex-col max-h-[85vh]">
			<div className="space-y-6 max-h-[85vh] overflow-y-auto pr-1 pb-4 flex-1 min-h-0">
				<div className="space-y-2">
					<Label htmlFor="title">Judul</Label>
					<Input
						id="title"
						placeholder="Judul galeri"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="activityDate">Tanggal kegiatan</Label>
					<Input
						id="activityDate"
						type="date"
						value={activityDate}
						onChange={(e) => setActivityDate(e.target.value)}
					/>
					<p className="text-xs text-muted-foreground">
						Ditampilkan di kartu galeri; default ke tanggal dibuat jika kosong.
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="description">Deskripsi singkat (opsional)</Label>
					<Textarea
						id="description"
						placeholder="Ringkasan untuk kartu (opsional)"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={2}
					/>
				</div>

				<div className="space-y-2">
					<Label>Deskripsi lengkap (opsional)</Label>
					<RichTextEditor
						value={fullDescription}
						onChange={setFullDescription}
						placeholder="Detail kegiatan…"
						height={280}
					/>
				</div>

				<div className="space-y-2">
					<Label>Tags (opsional)</Label>
					<div className="flex flex-wrap gap-1.5 mb-1.5">
						{tags.map((t, idx) => (
							<Badge key={idx} variant="secondary" className="gap-1 text-xs">
								{t}
								<button
									type="button"
									onClick={() => setTags((p) => p.filter((_, i) => i !== idx))}
									className="ml-0.5 hover:text-destructive">
									<X className="h-3 w-3" />
								</button>
							</Badge>
						))}
					</div>
					<div className="flex gap-2">
						<Input
							placeholder="Tambah tag, tekan Enter"
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ',') {
									e.preventDefault();
									const v = tagInput.trim().replace(/,$/,'');
									if (v && !tags.includes(v)) setTags((p) => [...p, v]);
									setTagInput('');
								}
							}}
							className="flex-1"
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								const v = tagInput.trim();
								if (v && !tags.includes(v)) setTags((p) => [...p, v]);
								setTagInput('');
							}}>
							<Plus className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>

				{/* Tipe media dideteksi otomatis — radio dihapus */}

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2 min-w-0">
								<CalendarDays className="h-4 w-4 text-primary shrink-0" />
								<div className="min-w-0">
									<Label className="text-sm font-medium">Event terkait</Label>
									<p className="text-[11px] text-muted-foreground leading-tight">Relasi dua arah. Di komunitas, hanya data komunitas ini.</p>
								</div>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="shrink-0"
								disabled={eventsForLink.length === 0}
								onClick={() => {
									setEventLinkSearch('');
									setShowAttachEventDialog(true);
								}}>
								<Plus className="h-3.5 w-3.5 mr-1" />
								Tambah Event
							</Button>
						</div>
						{eventsForLink.length === 0 ? (
							<p className="text-xs text-muted-foreground">Memuat event…</p>
						) : relatedEventIds.length === 0 ? (
							<p className="text-xs text-muted-foreground">Belum ada event terpilih.</p>
						) : (
							<div className="flex flex-wrap gap-2">
								{relatedEventIds.map((id) => {
									const ev = eventsForLink.find((e) => e._id === id);
									return ev ? (
										<Badge
											key={id}
											variant="outline"
											className="text-xs gap-1.5 py-1 px-2 max-w-full">
											<Link2 className="h-3 w-3 shrink-0" />
											<span className="truncate max-w-[180px]">{ev.title}</span>
											<button
												type="button"
												className="ml-0.5 hover:text-destructive shrink-0"
												onClick={() => toggleEvent(id)}
												title="Hapus">
												<X className="h-3 w-3" />
											</button>
										</Badge>
									) : null;
								})}
							</div>
						)}
					</div>

					<div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2 min-w-0">
								<FileText className="h-4 w-4 text-primary shrink-0" />
								<div className="min-w-0">
									<Label className="text-sm font-medium">Berita terkait</Label>
									<p className="text-[11px] text-muted-foreground leading-tight">Relasi dua arah. Di komunitas, hanya data komunitas ini.</p>
								</div>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="shrink-0"
								disabled={beritaForLink.length === 0}
								onClick={() => {
									setBeritaLinkSearch('');
									setShowAttachBeritaDialog(true);
								}}>
								<Plus className="h-3.5 w-3.5 mr-1" />
								Tambah Berita
							</Button>
						</div>
						{beritaForLink.length === 0 ? (
							<p className="text-xs text-muted-foreground">Memuat berita…</p>
						) : relatedBeritaIds.length === 0 ? (
							<p className="text-xs text-muted-foreground">Belum ada berita terpilih.</p>
						) : (
							<div className="flex flex-wrap gap-2">
								{relatedBeritaIds.map((id) => {
									const b = beritaForLink.find((x) => x._id === id);
									return b ? (
										<Badge
											key={id}
											variant="outline"
											className="text-xs gap-1.5 py-1 px-2 max-w-full">
											<Link2 className="h-3 w-3 shrink-0" />
											<span className="truncate max-w-[180px]">{b.title}</span>
											<button
												type="button"
												className="ml-0.5 hover:text-destructive shrink-0"
												onClick={() => toggleBerita(id)}
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

				<div className="space-y-4">
					<Label>Tautan Google Drive</Label>
					<div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground space-y-2">
						<p>
							<strong className="text-foreground">Satu atau beberapa file:</strong> tempel link file foto atau video (bukan akses private). Tambah baris &quot;Tambah tautan&quot; untuk banyak file.
						</p>
						<p>
							<strong className="text-foreground">Satu folder:</strong> tempel link folder — sistem mengambil foto/video di dalamnya sebagai galeri. Jika terdeteksi folder, mode <strong>folder embed</strong> menampilkan pratinjau folder Drive di situs (bisa diganti ke mode file lewat tautan di bawah).
						</p>
						<p>
							<strong className="text-foreground">Berbagi:</strong> di Drive, set <strong>Siapa pun yang punya link</strong> agar pengunjung bisa melihat.
						</p>
					</div>

					{embedFoldersOnly ? (
						<>
							<div className="rounded-lg border p-3 bg-muted/30 space-y-1">
								<p className="text-sm font-medium">Mode folder embed aktif</p>
								<p className="text-xs text-muted-foreground">
									Folder ditampilkan langsung di situs sebagai iframe Google Drive.
									File tidak diimpor satu per satu.
								</p>
								<button
									type="button"
									className="text-xs underline text-muted-foreground hover:text-foreground mt-1"
									onClick={() => {
										setEmbedFoldersOnly(false);
										setGdriveUrls(['']);
										setGdriveValidations({});
										setGdriveErrors({});
										setGdriveMediaTypes({});
									}}>
									Ganti ke mode file satu-satu
								</button>
							</div>

							<GDriveLinkInput
								label="Tautan folder Google Drive"
								value={gdriveUrls[0] || ''}
								onChange={(newUrl) => setGdriveUrls([newUrl])}
								onValidation={(isValid, error) =>
									handleGdriveValidation(0, isValid, error)
								}
								hideMediaTypeSelector
								onFolderDetected={(isF) => handleFolderDetected(0, isF)}
								placeholder="https://drive.google.com/drive/folders/…"
							/>
						</>
					) : (
						<>
							{gdriveUrls.map((url, index) => (
								<div key={index} className="space-y-2">
									<div className="flex items-center space-x-2">
										<div className="flex-1">
											<GDriveLinkInput
												label={`Media ${index + 1}`}
												value={url}
												onChange={(newUrl) => updateGdriveUrl(index, newUrl)}
												onValidation={(isValid, error) =>
													handleGdriveValidation(index, isValid, error)
												}
												hideMediaTypeSelector
												onFolderDetected={(isF) =>
													handleFolderDetected(index, isF)
												}
												placeholder="Tautan file atau folder Google Drive…"
											/>
										</div>
										{gdriveUrls.length > 1 && (
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => removeGdriveInput(index)}
												className="mt-6">
												<X className="h-4 w-4" />
											</Button>
										)}
									</div>

									{url && gdriveValidations[index] && !embedFoldersOnly && (
										<div className="mt-2">
											<Label className="text-sm">Pratinjau</Label>
											<div className="w-32 h-32 border rounded-md overflow-hidden mt-1">
												<MediaDisplay
													src={url}
													alt={`Media preview ${index + 1}`}
													type="auto"
													className="w-full h-full object-cover"
												/>
											</div>
										</div>
									)}
								</div>
							))}

							<Button
								type="button"
								variant="outline"
								onClick={addGdriveInput}
								className="w-full mt-2">
								<Plus className="h-4 w-4 mr-2" />
								Tambah tautan
							</Button>
						</>
					)}
				</div>
			</div>

			<div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 mt-2 border-t border-border bg-background">
				<div className="flex flex-col sm:flex-row sm:items-center gap-3">
					<span className="text-sm text-muted-foreground">Status</span>
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">Draf</span>
						<Switch
							id="pub-footer"
							checked={published}
							onCheckedChange={setPublished}
						/>
						<span className="text-sm font-medium">Terbit</span>
					</div>
				</div>
				<div className="flex flex-wrap justify-end gap-3 items-center">
					<ContentEnhanceButton
						entityType="library"
						fields={[
							{ key: 'title', label: 'Judul' },
							{ key: 'description', label: 'Deskripsi singkat' },
							{ key: 'fullDescription', label: 'Deskripsi lengkap' },
						]}
						values={{ title, description, fullDescription }}
						onApply={(partial) => {
							if (partial.title !== undefined) setTitle(partial.title);
							if (partial.description !== undefined) setDescription(partial.description);
							if (partial.fullDescription !== undefined) {
								setFullDescription(partial.fullDescription);
							}
						}}
					/>
					<Button variant="outline" onClick={onCancel}>
						Batal
					</Button>
					<Button onClick={handleSave} disabled={saveMediaMutation.isPending}>
						{saveMediaMutation.isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Menyimpan…
							</>
						) : (
							<>
								<Upload className="mr-2 h-4 w-4" />
								Simpan
							</>
						)}
					</Button>
				</div>
			</div>

			<Dialog
				open={showAttachEventDialog}
				onOpenChange={(open) => {
					setShowAttachEventDialog(open);
					if (!open) setEventLinkSearch('');
				}}>
				<DialogContent
					overlayClassName="z-[100]"
					className="z-[100] sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Pilih Event Terkait</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">
							Centang event yang ingin dihubungkan dengan galeri ini.
						</p>
						<div className="relative">
							<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								className="pl-8 h-8 text-sm"
								placeholder="Cari judul event..."
								value={eventLinkSearch}
								onChange={(e) => setEventLinkSearch(e.target.value)}
							/>
						</div>
						<div className="border rounded-md max-h-60 overflow-y-auto overflow-x-hidden pr-2">
							{eventsForLink
								.filter((ev) =>
									eventLinkSearch
										? ev.title.toLowerCase().includes(eventLinkSearch.toLowerCase())
										: true,
								)
								.map((ev) => {
									const checked = relatedEventIds.includes(ev._id);
									return (
										<label
											key={ev._id}
											className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-b-0 overflow-hidden">
											<input
												type="checkbox"
												checked={checked}
												onChange={() => toggleEvent(ev._id)}
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
													{ev.title}
												</span>
											</div>
										</label>
									);
								})}
							{eventsForLink.length === 0 && (
								<p className="text-center text-sm text-muted-foreground py-4">
									Tidak ada event.
								</p>
							)}
						</div>
						<div className="flex justify-end pt-2">
							<Button variant="outline" onClick={() => setShowAttachEventDialog(false)}>
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
					if (!open) setBeritaLinkSearch('');
				}}>
				<DialogContent
					overlayClassName="z-[100]"
					className="z-[100] sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Pilih Berita Terkait</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">
							Centang berita yang ingin dihubungkan dengan galeri ini.
						</p>
						<div className="relative">
							<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								className="pl-8 h-8 text-sm"
								placeholder="Cari judul berita..."
								value={beritaLinkSearch}
								onChange={(e) => setBeritaLinkSearch(e.target.value)}
							/>
						</div>
						<div className="border rounded-md max-h-60 overflow-y-auto overflow-x-hidden pr-2">
							{beritaForLink
								.filter((b) =>
									beritaLinkSearch
										? b.title.toLowerCase().includes(beritaLinkSearch.toLowerCase())
										: true,
								)
								.map((b) => {
									const checked = relatedBeritaIds.includes(b._id);
									return (
										<label
											key={b._id}
											className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-b-0 overflow-hidden">
											<input
												type="checkbox"
												checked={checked}
												onChange={() => toggleBerita(b._id)}
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
													{b.title}
												</span>
												{b.published === false && (
													<span className="text-xs text-muted-foreground mt-0.5 block">
														(draf)
													</span>
												)}
											</div>
										</label>
									);
								})}
							{beritaForLink.length === 0 && (
								<p className="text-center text-sm text-muted-foreground py-4">
									Tidak ada berita.
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
		</div>
	);
}
