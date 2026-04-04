import RichTextEditor from '@/components/dashboard/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
	Image as ImageIcon,
	Loader2,
	Plus,
	Upload,
	Video,
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
		{ _id: string; title: string }[]
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

			validUrls.forEach((url, index) => {
				formData.append(`gdriveUrls[${index}]`, url);
				const urlMediaType = gdriveMediaTypes[index] || mediaType;
				formData.append(
					`gdriveMediaTypes[${index}]`,
					urlMediaType === 'video' ? 'video' : 'image',
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

				<div className="space-y-3">
					<Label>Default tipe untuk tautan baru</Label>
					<RadioGroup
						value={mediaType}
						onValueChange={(value) => setMediaType(value as 'photo' | 'video')}
						className="flex space-x-4">
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="photo" id="photo" />
							<Label htmlFor="photo" className="flex items-center">
								<ImageIcon className="h-4 w-4 mr-1" />
								Foto
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="video" id="video" />
							<Label htmlFor="video" className="flex items-center">
								<Video className="h-4 w-4 mr-1" />
								Video
							</Label>
						</div>
					</RadioGroup>
				</div>

				<div className="space-y-2 rounded-md border p-3 max-h-40 overflow-y-auto">
					<Label>Kaitkan ke event (opsional)</Label>
					{eventsForLink.length === 0 ? (
						<p className="text-xs text-muted-foreground">Memuat event…</p>
					) : (
						<div className="space-y-2">
							{eventsForLink.map((ev) => (
								<label
									key={ev._id}
									className="flex items-center gap-2 text-sm cursor-pointer">
									<input
										type="checkbox"
										checked={relatedEventIds.includes(ev._id)}
										onChange={() => toggleEvent(ev._id)}
									/>
									<span className="truncate">{ev.title}</span>
								</label>
							))}
						</div>
					)}
				</div>

				<div className="space-y-2 rounded-md border p-3 max-h-40 overflow-y-auto">
					<Label>Kaitkan ke berita (opsional)</Label>
					{beritaForLink.length === 0 ? (
						<p className="text-xs text-muted-foreground">Memuat berita…</p>
					) : (
						<div className="space-y-2">
							{beritaForLink.map((b) => (
								<label
									key={b._id}
									className="flex items-center gap-2 text-sm cursor-pointer">
									<input
										type="checkbox"
										checked={relatedBeritaIds.includes(b._id)}
										onChange={() => toggleBerita(b._id)}
									/>
									<span className="truncate">{b.title}</span>
								</label>
							))}
						</div>
					)}
				</div>

				<div className="space-y-4">
					<Label>Tautan Google Drive</Label>

					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3 bg-muted/30">
						<div className="space-y-1">
							<Label htmlFor="embed-folder">Folder: embed saja</Label>
							<p className="text-xs text-muted-foreground max-w-xl">
								Aktifkan jika tautan folder: jangan impor semua file ke database —
								di situs tampil iframe folder Google (pengunjung membuka lewat
								browser mereka).
							</p>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<span className="text-sm text-muted-foreground">Impor file</span>
							<Switch
								id="embed-folder"
								checked={embedFoldersOnly}
								onCheckedChange={setEmbedFoldersOnly}
							/>
							<span className="text-sm font-medium">Embed folder</span>
						</div>
					</div>

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
										onMediaTypeChange={(type) =>
											handleGdriveMediaTypeChange(index, type)
										}
										mediaType={gdriveMediaTypes[index] || mediaType}
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

							{url && gdriveValidations[index] && (
								<div className="mt-2">
									<Label className="text-sm">Pratinjau</Label>
									<div className="w-32 h-32 border rounded-md overflow-hidden mt-1">
										<MediaDisplay
											src={url}
											alt={`Media preview ${index + 1}`}
											type={
												gdriveMediaTypes[index] === 'video' ? 'video' : 'auto'
											}
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
				<div className="flex justify-end gap-3">
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
		</div>
	);
}
