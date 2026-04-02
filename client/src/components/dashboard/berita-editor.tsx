import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import { CalendarDays, Copy, Image, Link2, Loader2, Plus, Search, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import RichTextEditor from './rich-text-editor';

interface BeritaData {
	id?: number;
	_id?: string;
	title: string;
	excerpt: string;
	content: string;
	image: string;
	published: boolean;
	author: string;
	createdAt: string;
	tags?: string[];
}

interface BeritaEditorProps {
	berita: BeritaData | null;
	onSave: () => void;
	onCancel: () => void;
}

export default function BeritaEditor({
	berita,
	onSave,
	onCancel,
}: BeritaEditorProps) {
	const { user } = useAuth();
	const { toast } = useToast();

	const [title, setTitle] = useState(berita?.title || '');
	const [excerpt, setExcerpt] = useState(berita?.excerpt || '');
	const [content, setContent] = useState(berita?.content || '');
	const [imageUrl, setImageUrl] = useState(berita?.image || '');
	const [tags, setTags] = useState<string[]>(berita?.tags || []);
	const [newTag, setNewTag] = useState('');
	const [allExistingTags, setAllExistingTags] = useState<string[]>([]);
	const [gdriveUrl, setGdriveUrl] = useState('');
	const [isGdriveValid, setIsGdriveValid] = useState(false);
	const [gdriveError, setGdriveError] = useState<string | undefined>();
	const [isPublished, setIsPublished] = useState(berita?.published || false);
	const [activeTab, setActiveTab] = useState('edit');
	const contentImageInputRef = useRef<HTMLInputElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [imagePreview, setImagePreview] = useState<string>('');
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	// Copy → Event state
	const [showCopyToEventDialog, setShowCopyToEventDialog] = useState(false);
	const [copyToEventYear, setCopyToEventYear] = useState(new Date().getFullYear());
	const [copyAttachments, setCopyAttachmentsState] = useState(false);
	const [selectedParentEventId, setSelectedParentEventId] = useState<string>('');

	// Attach Event dialog state
	const [showAttachEventDialog, setShowAttachEventDialog] = useState(false);
	const [attachEventYearId, setAttachEventYearId] = useState<string>('');
	const [attachEventSearch, setAttachEventSearch] = useState('');
	const [attachYearSelectOpen, setAttachYearSelectOpen] = useState(false);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const imageUrl = URL.createObjectURL(file);
			setImagePreview(imageUrl);
			setImageUrl(imageUrl);
			setSelectedFile(file); // Simpan file untuk dikirim saat save
		}
	};

	const addTag = () => {
		if (newTag.trim() && !tags.includes(newTag.trim())) {
			setTags([...tags, newTag.trim()]);
			setNewTag('');
		}
	};

	const removeTag = (tagToRemove: string) => {
		setTags(tags.filter((tag) => tag !== tagToRemove));
	};

	const handleTagKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		}
	};

	const fetchAllTags = async () => {
		try {
			const response = await fetch('/api/berita');
			const beritaList = await response.json();
			const tags = new Set<string>();
			beritaList.forEach((item: any) => {
				if (item.tags) {
					item.tags.forEach((tag: string) => tags.add(tag));
				}
			});
			setAllExistingTags(Array.from(tags).sort());
		} catch (error) {
			console.error('Error fetching tags:', error);
		}
	};

	const selectExistingTag = (tag: string) => {
		if (tags.includes(tag)) {
			// If tag is already selected, remove it
			setTags(tags.filter((t) => t !== tag));
		} else {
			// If tag is not selected, add it
			setTags([...tags, tag]);
		}
	};

	const saveBeritaMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			const beritaId = (berita as any)?._id || berita?.id;
			return beritaId
				? apiRequest('PUT', `/api/berita/${beritaId}`, formData)
				: apiRequest('POST', '/api/berita', formData);
		},
		onSuccess: async (response) => {
			// Invalidate queries
			queryClient.invalidateQueries({ queryKey: ['/api/berita'] });
			queryClient.invalidateQueries({ queryKey: ['/api/berita/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			// Log activity
			try {
				const isEdit = !!(berita as any)?._id || !!berita?.id;
				let responseData;

				// Handle response safely
				if (response && typeof response === 'object' && 'json' in response) {
					responseData = await response.json();
				} else {
					responseData = response; // Already parsed
				}

				const beritaId = responseData?._id || responseData?.id || 'unknown';

				if (isEdit) {
					await logActivity(ActivityTemplates.beritaUpdated(title, beritaId));
				} else {
					await logActivity(ActivityTemplates.beritaCreated(title, beritaId));
				}

				// Log publish activity if published
				if (isPublished) {
					await logActivity(
						ActivityTemplates.beritaPublished(title, beritaId)
					);
				}
			} catch (error) {
				console.warn('Failed to log activity:', error);
			}

			onSave();
		},
		onError: () => {
			toast({
				title: 'Error',
				description: 'Gagal menyimpan berita. Coba lagi.',
				variant: 'destructive',
			});
		},
	});

	const uploadContentImageMutation = useMutation({
		mutationFn: async (file: File) => {
			const formData = new FormData();
			formData.append('image', file);

			const beritaId =
				(berita as any)?._id || berita?.id || 'temp-' + Date.now();
			formData.append('beritaId', beritaId.toString());

			const response = await apiRequest(
				'POST',
				'/api/upload/content-image',
				formData
			);
			const data = await response.json(); // 🔥 PERBAIKAN: Parse JSON response

			return data;
		},
		onSuccess: (data) => {
			// Validasi response
			if (!data || !data.url) {
				toast({
					title: 'Error',
					description: 'Invalid server response - no image URL received',
					variant: 'destructive',
				});
				return;
			}

			// Dapatkan posisi cursor di textarea
			const textarea = document.querySelector(
				'textarea[placeholder*="Tulis konten berita"]'
			) as HTMLTextAreaElement;

			let insertPosition = content.length; // Default di akhir
			if (textarea) {
				insertPosition = textarea.selectionStart || content.length;
			}

			const imageTag = `<img src="${data.url}" alt="Content image" class="my-4 max-w-full" />`;
			const beforeText = content.substring(0, insertPosition);
			const afterText = content.substring(insertPosition);

			setContent(beforeText + '\n' + imageTag + '\n' + afterText);

			// Set cursor setelah gambar
			setTimeout(() => {
				if (textarea) {
					const newPosition = insertPosition + imageTag.length + 2; // +2 untuk \n
					textarea.focus();
					textarea.setSelectionRange(newPosition, newPosition);
				}
			}, 0);

			toast({
				title: 'Success',
				description: `Image inserted: ${data.url}`,
			});
		},
		onError: (error: any) => {
			console.error('📸 Upload error:', error);
			toast({
				title: 'Error',
				description: `Failed to upload image: ${
					error?.message || 'Unknown error'
				}`,
				variant: 'destructive',
			});
		},
	});

	const beritaId = (berita as any)?._id || berita?.id;

	// Linked events query
	const { data: linkedEvents = [], refetch: refetchLinkedEvents } = useQuery<any[]>({
		queryKey: [`/api/berita/${beritaId}/events`],
		queryFn: async () => {
			if (!beritaId) return [];
			const res = await fetch(`/api/berita/${beritaId}/events`, {
				credentials: 'include',
			});
			if (!res.ok) return [];
			return res.json();
		},
		enabled: !!beritaId,
	});

	// Event years query (for copy & attach dialogs)
	const { data: eventYears = [] } = useQuery<{ _id: string; year: number }[]>({
		queryKey: ['/api/event-years'],
		queryFn: async () => {
			const res = await fetch('/api/event-years');
			if (!res.ok) return [];
			return res.json();
		},
		enabled: showCopyToEventDialog || showAttachEventDialog,
	});

	// Fetch parent events for the selected year (event utama saja, parentId=null)
	const selectedYearDoc = eventYears.find((y) => y.year === copyToEventYear);
	const { data: parentEventOptions = [], isFetching: isFetchingParentEvents } = useQuery<{ _id: string; title: string; month: number; startDate: string }[]>({
		queryKey: ['/api/events-parent-options', selectedYearDoc?._id],
		queryFn: async () => {
			if (!selectedYearDoc) return [];
			const res = await fetch(`/api/events?yearId=${selectedYearDoc._id}&parentId=null`, {
				credentials: 'include',
			});
			if (!res.ok) return [];
			return res.json();
		},
		enabled: showCopyToEventDialog && !!selectedYearDoc,
	});

	const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

	const copyToEventMut = useMutation({
		mutationFn: async ({ year, parentEventId, copyAtts }: { year: number; parentEventId?: string; copyAtts: boolean }) => {
			if (!beritaId) throw new Error('Simpan berita terlebih dahulu sebelum copy ke event.');
			const res = await apiRequest('POST', `/api/berita/${beritaId}/copy-to-event`, {
				year,
				parentEventId: parentEventId || undefined,
				copyAttachments: copyAtts,
			});
			return res.json();
		},
		onSuccess: (data: any) => {
			setShowCopyToEventDialog(false);
			const parentName = selectedParentEventId
				? parentEventOptions.find((e) => e._id === selectedParentEventId)?.title
				: undefined;
			toast({
				title: 'Event berhasil dibuat dari berita!',
				description: parentName
					? `Draft sub-event "${data.event?.title}" dibuat di bawah "${parentName}" (${data.year}).`
					: `Draft event "${data.event?.title}" dibuat di tahun ${data.year}. Silakan edit di dashboard event.`,
			});
			setSelectedParentEventId('');
		},
		onError: (err: any) => {
			toast({ title: 'Gagal membuat event', description: err.message, variant: 'destructive' });
		},
	});

	const detachEventMut = useMutation({
		mutationFn: async (eventId: string) => {
			if (!beritaId) return;
			await apiRequest('DELETE', `/api/berita/${beritaId}/attach-event/${eventId}`);
		},
		onSuccess: () => {
			refetchLinkedEvents();
			toast({ title: 'Event berhasil dilepas dari berita' });
		},
	});

	// Events list for the attach dialog (filtered by selected year)
	const { data: attachEventsList = [], isFetching: isFetchingAttachEvents } = useQuery<any[]>({
		queryKey: ['/api/events-for-attach', attachEventYearId],
		queryFn: async () => {
			if (!attachEventYearId) return [];
			const res = await fetch(`/api/events?yearId=${attachEventYearId}&parentId=null`, {
				credentials: 'include',
			});
			if (!res.ok) return [];
			return res.json();
		},
		enabled: showAttachEventDialog && !!attachEventYearId,
	});

	const linkedEventIds = linkedEvents.map((ev: any) => ev._id);

	const attachEventMut = useMutation({
		mutationFn: async (eventId: string) => {
			if (!beritaId) throw new Error('Simpan berita terlebih dahulu.');
			await apiRequest('POST', `/api/berita/${beritaId}/attach-event`, {
				eventId,
				copyFiles: false,
			});
		},
		onSuccess: () => {
			refetchLinkedEvents();
		},
		onError: (err: any) => {
			toast({ title: 'Gagal mengaitkan event', description: err.message, variant: 'destructive' });
		},
	});

	const handleToggleEventAttach = (eventId: string) => {
		if (linkedEventIds.includes(eventId)) {
			detachEventMut.mutate(eventId);
		} else {
			attachEventMut.mutate(eventId);
		}
	};

	const handleContentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			uploadContentImageMutation.mutateAsync(file);
		}
		// Reset input untuk bisa upload file yang sama
		e.target.value = '';
	};

	const handleGdriveValidation = (isValid: boolean, error?: string) => {
		setIsGdriveValid(isValid);
		setGdriveError(error);
		if (isValid && gdriveUrl) setImageUrl(gdriveUrl);
	};

	const applyFormatting = (format: string) => {
		const textarea = document.querySelector(
			'textarea[placeholder*="Tulis konten berita"]'
		) as HTMLTextAreaElement;
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selectedText = content.substring(start, end);
		const beforeText = content.substring(0, start);
		const afterText = content.substring(end);

		let formattedText = '';

		switch (format) {
			case 'bold':
				formattedText = selectedText
					? `<strong>${selectedText}</strong>`
					: '<strong>Bold text</strong>';
				break;
			case 'italic':
				formattedText = selectedText
					? `<em>${selectedText}</em>`
					: '<em>Italic text</em>';
				break;
			case 'underline':
				formattedText = selectedText
					? `<u>${selectedText}</u>`
					: '<u>Underlined text</u>';
				break;
			case 'h1':
				formattedText = `<h1>${selectedText || 'Heading 1'}</h1>`;
				break;
			case 'h2':
				formattedText = `<h2>${selectedText || 'Heading 2'}</h2>`;
				break;
			case 'h3':
				formattedText = `<h3>${selectedText || 'Heading 3'}</h3>`;
				break;
			case 'h4':
				formattedText = `<h4>${selectedText || 'Heading 4'}</h4>`;
				break;
			case 'h5':
				formattedText = `<h5>${selectedText || 'Heading 5'}</h5>`;
				break;
			case 'h6':
				formattedText = `<h6>${selectedText || 'Heading 6'}</h6>`;
				break;
			case 'ul':
				formattedText =
					'<ul>\n  <li>List item 1</li>\n  <li>List item 2</li>\n</ul>';
				break;
			case 'ol':
				formattedText =
					'<ol>\n  <li>List item 1</li>\n  <li>List item 2</li>\n</ol>';
				break;
			case 'blockquote':
				formattedText = `<blockquote>${
					selectedText || 'Quote text'
				}</blockquote>`;
				break;
			case 'code':
				formattedText = `<code>${selectedText || 'Code text'}</code>`;
				break;
			case 'pre':
				formattedText = `<pre><code>${
					selectedText || 'Code block'
				}</code></pre>`;
				break;
			default:
				formattedText = selectedText;
		}

		const newContent = beforeText + formattedText + afterText;
		setContent(newContent);

		setTimeout(() => {
			const newPosition = start + formattedText.length;
			textarea.setSelectionRange(newPosition, newPosition);
			textarea.focus();
		}, 0);
	};

	// Fungsi untuk memindahkan gambar
	const moveImageInContent = (direction: 'up' | 'down') => {
		const textarea = document.querySelector(
			'textarea[placeholder*="Tulis konten berita"]'
		) as HTMLTextAreaElement;

		if (!textarea) return;

		const cursorPosition = textarea.selectionStart;
		const lines = content.split('\n');
		let currentLine = 0;
		let charCount = 0;

		// Cari line mana cursor berada
		for (let i = 0; i < lines.length; i++) {
			if (charCount + lines[i].length + 1 > cursorPosition) {
				currentLine = i;
				break;
			}
			charCount += lines[i].length + 1;
		}

		// Cek apakah line ini berisi img tag
		const imgRegex = /<img[^>]+>/;
		const currentLineContent = lines[currentLine];

		if (imgRegex.test(currentLineContent)) {
			// Ada img di line ini, pindahkan
			const newLines = [...lines];
			const imgLine = newLines[currentLine];

			if (direction === 'up' && currentLine > 0) {
				// Pindah ke atas
				newLines[currentLine] = newLines[currentLine - 1];
				newLines[currentLine - 1] = imgLine;
			} else if (direction === 'down' && currentLine < lines.length - 1) {
				// Pindah ke bawah
				newLines[currentLine] = newLines[currentLine + 1];
				newLines[currentLine + 1] = imgLine;
			}

			setContent(newLines.join('\n'));

			toast({
				title: 'Image moved',
				description: `Image moved ${direction}`,
			});
		} else {
			toast({
				title: 'No image found',
				description: 'Place cursor on a line with an image to move it',
				variant: 'destructive',
			});
		}
	};

	const handleSave = async () => {
		if (!title.trim() || !excerpt.trim() || !content.trim()) {
			toast({
				title: 'Error',
				description: 'Semua kolom wajib diisi',
				variant: 'destructive',
			});
			return;
		}
		const isNewBerita = !berita;
		const hasExistingThumbnail = !isNewBerita && !!berita?.image;
		if (!selectedFile && !hasExistingThumbnail) {
			toast({
				title: 'Error',
				description: 'Thumbnail wajib diupload',
				variant: 'destructive',
			});
			return;
		}

		const formData = new FormData();
		formData.append('title', title);
		formData.append('excerpt', excerpt);
		formData.append('content', content);
		formData.append('published', isPublished.toString());
		formData.append('tags', JSON.stringify(tags));

		// Kirim Google Drive URL jika ada dan valid
		if (gdriveUrl && isGdriveValid) {
			formData.append('gdriveUrl', gdriveUrl);
		}

		// PERBAIKAN: Kirim file thumbnail jika ada
		if (selectedFile) {
			formData.append('image', selectedFile);
		}

		await saveBeritaMutation.mutateAsync(formData);
		// Refresh daftar tag global agar tag baru langsung muncul di Existing tags
		await fetchAllTags();
		setTitle('');
		setExcerpt('');
		setContent('');
		setImagePreview('');
		setSelectedFile(null); // Reset selected file
		toast({ title: 'Berhasil', description: 'Berita disimpan.' });
	};

	// Load berita data saat edit mode
	useEffect(() => {
		if (berita) {
			setTitle(berita.title || '');
			setExcerpt(berita.excerpt || '');
			setContent(berita.content || '');
			setImageUrl(berita.image || '');
			setTags(berita.tags || []);
			setIsPublished(berita.published || false);

			if (berita.image && !berita.image.startsWith('blob:')) {
				setImagePreview(berita.image);
			}
		}
	}, [berita]);

	// Fetch all existing tags when component mounts
	useEffect(() => {
		fetchAllTags();
	}, []);

	useEffect(() => {
		return () => {
			if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
		};
	}, [imagePreview]);

	return (
		<div className="space-y-6">
			<DashboardHintCard
				title="Tips mengisi berita"
				variant="blue"
				storageKey="dashboard-berita-editor"
				description="Form ini mengirim judul, excerpt, HTML konten, thumbnail, tag, dan status publish ke API. Field wajib harus terisi; publish membutuhkan izin berita.publish di server.">
				<ul className="list-disc list-inside space-y-1.5 text-sm">
					<li>
						<strong>Langkah</strong>: isi judul &amp; excerpt → tulis isi di editor (bold, list, gambar inline) → unggah thumbnail jika perlu → atur tag → centang publish jika siap → <strong>Simpan</strong>.
					</li>
					<li>
						<strong>Contoh valid</strong>: judul ≤ panjang wajar; excerpt 1–2 kalimat; gambar thumbnail JPG/PNG/WebP sesuai batas upload; tag dari daftar atau input yang diterima form.
					</li>
					<li>
						<strong>Contoh tidak valid</strong>: judul/excerpt/konten kosong; publish ON tanpa izin (server menolak); file gambar terlalu besar atau bukan gambar.
					</li>
					<li>
						<strong>Jika gagal</strong>: baca pesan error; nonaktifkan publish dan simpan draf; periksa ukuran gambar.
					</li>
					<li>
						<strong>Publish</strong>: aktif = tampil di publik (jika diizinkan); nonaktif = draf.
					</li>
					<li>
						<strong>Menutup dialog</strong>: gunakan <strong>Batal</strong> atau <strong>Simpan</strong>—jangan tutup dengan klik di luar jika itu membuang draft.
					</li>
				</ul>
			</DashboardHintCard>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="title">Judul Berita</Label>
					<Input
						id="title"
						placeholder="Masukkan judul berita"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="excerpt">Short Excerpt</Label>
					<Textarea
						id="excerpt"
						placeholder="Deskripsi singkat (ditampilkan di preview berita)"
						value={excerpt}
						onChange={(e) => setExcerpt(e.target.value)}
						rows={2}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="tags">Tags</Label>
					<div className="space-y-2">
						<div className="flex gap-2">
							<Input
								id="tags"
								placeholder="Add a tag and press Enter"
								value={newTag}
								onChange={(e) => setNewTag(e.target.value)}
								onKeyPress={handleTagKeyPress}
								className="flex-1"
							/>
							<Button
								type="button"
								variant="outline"
								onClick={addTag}
								disabled={!newTag.trim()}>
								Add
							</Button>
						</div>

						{/* Existing Tags */}
						{allExistingTags.length > 0 && (
							<div className="space-y-2">
								<p className="text-sm text-gray-600">Existing tags:</p>
								<div className="flex flex-wrap gap-2">
									{allExistingTags.map((tag) => (
										<button
											key={tag}
											type="button"
											onClick={() => selectExistingTag(tag)}
											className={`px-3 py-1 rounded-full text-sm border transition-colors ${
												tags.includes(tag)
													? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
													: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
											}`}>
											{tag}
										</button>
									))}
								</div>
							</div>
						)}

						{/* Selected Tags */}
						{tags.length > 0 && (
							<div className="space-y-2">
								<p className="text-sm text-gray-600">Selected tags:</p>
								<div className="flex flex-wrap gap-2">
									{tags.map((tag, index) => (
										<div
											key={index}
											className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
											<span>{tag}</span>
											<button
												type="button"
												onClick={() => removeTag(tag)}
												className="text-blue-600 hover:text-blue-800">
												×
											</button>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="thumbnail">Thumbnail Image</Label>
					<div className="flex items-center space-x-4">
						<div
							className="w-32 h-32 border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer overflow-hidden"
							onClick={() => fileInputRef.current?.click()}>
							{imagePreview ? (
								<img
									src={imagePreview}
									alt="Thumbnail Preview"
									className="w-full h-full object-cover"
								/>
							) : (
								<Upload className="h-6 w-6 text-gray-400" />
							)}
						</div>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={handleFileChange}
						/>
						<Button
							type="button"
							variant="outline"
							onClick={() => fileInputRef.current?.click()}>
							Choose Image
						</Button>
					</div>
				</div>

				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}>
					<TabsList>
						<TabsTrigger value="edit">Edit</TabsTrigger>
						<TabsTrigger value="preview">Preview</TabsTrigger>
					</TabsList>
					<TabsContent
						value="edit"
						className="space-y-4 pt-4">
						{/* Simplified toolbar - hanya Image upload */}
						<div className="border rounded-md p-3 bg-gray-50">
							<div className="flex items-center gap-2">
								<Label className="text-sm font-medium">Quick Tools:</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => contentImageInputRef.current?.click()}
									disabled={uploadContentImageMutation.isPending}
									title="Insert Image">
									{uploadContentImageMutation.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Image className="h-4 w-4" />
									)}
									Image
								</Button>

								<input
									ref={contentImageInputRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={handleContentImageUpload}
								/>

								<div className="text-xs text-gray-500 ml-4">
									💡 Use TinyMCE toolbar above for formatting. This Image button
									inserts at cursor position.
								</div>
							</div>
						</div>

						{/* Rich Text Editor */}
						<div className="space-y-2">
							<Label>Konten Berita</Label>
							<RichTextEditor
								value={content}
								onChange={setContent}
								placeholder="Tulis konten berita di sini..."
								height={500}
								beritaId={
									(berita as any)?._id || berita?.id || 'temp-' + Date.now()
								}
							/>
						</div>
						<p className="text-sm text-gray-500">
							Note: In a real implementation, a full WYSIWYG editor like
							TinyMCE, CKEditor, or Quill would be used here.
						</p>
					</TabsContent>
					<TabsContent
						value="preview"
						className="pt-4">
						<div className="border rounded-md p-6 min-h-[400px] prose max-w-none">
							<h1 className="text-2xl font-bold mb-4">{title}</h1>
							<div dangerouslySetInnerHTML={{ __html: content }} />
						</div>
					</TabsContent>
				</Tabs>

				<div className="flex items-center space-x-2">
					<Switch
						id="published"
						checked={isPublished}
						onCheckedChange={setIsPublished}
					/>
					<Label htmlFor="published">
						{isPublished ? 'Published' : 'Draft'}
					</Label>
				</div>
			</div>

	{/* Linked Events Section */}
	{beritaId && (
		<div className="border rounded-lg p-4 space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<CalendarDays className="h-4 w-4 text-primary" />
					<h3 className="font-medium text-sm">Event Terkait</h3>
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							setAttachEventYearId(eventYears[0]?._id || '');
							setAttachEventSearch('');
							setShowAttachEventDialog(true);
						}}
					>
						<Plus className="h-3.5 w-3.5 mr-1" />
						Tambah Event
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => { setCopyToEventYear(new Date().getFullYear()); setCopyAttachmentsState(false); setSelectedParentEventId(''); setShowCopyToEventDialog(true); }}
					>
						<Copy className="h-3.5 w-3.5 mr-1" />
						Copy → Event
					</Button>
				</div>
			</div>
				{linkedEvents.length === 0 ? (
					<p className="text-xs text-muted-foreground">Belum ada event yang terhubung ke berita ini.</p>
				) : (
					<div className="flex flex-wrap gap-2">
						{linkedEvents.map((ev: any) => (
							<Badge key={ev._id} variant="outline" className="gap-1.5 text-xs py-1 px-2">
								<Link2 className="h-3 w-3" />
								{ev.title}
								{ev.yearId?.year && <span className="text-muted-foreground">({ev.yearId.year})</span>}
								<button
									type="button"
									onClick={() => detachEventMut.mutate(ev._id)}
									className="ml-0.5 hover:text-destructive transition-colors"
									title="Lepas dari event"
								>
									<X className="h-2.5 w-2.5" />
								</button>
							</Badge>
						))}
					</div>
				)}
			</div>
		)}

		<div className="flex justify-end space-x-4">
			<Button
				variant="outline"
				onClick={onCancel}>
				Cancel
			</Button>
			<Button
				onClick={handleSave}
				disabled={saveBeritaMutation.isPending}>
				{saveBeritaMutation.isPending ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Saving...
					</>
				) : (
					'Simpan Berita'
				)}
			</Button>
		</div>

		{/* Dialog Copy → Event */}
		<Dialog
			open={showCopyToEventDialog}
			onOpenChange={(open) => {
				setShowCopyToEventDialog(open);
				if (!open) { setSelectedParentEventId(''); setCopyAttachmentsState(false); }
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Copy Berita ke Event</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Akan dibuat event baru (draft) dari berita ini. Anda bisa mengedit di halaman dashboard event.
					</p>
					<div className="space-y-1">
						<Label>Tahun Event</Label>
						{eventYears.length > 0 ? (
							<Select
								value={String(copyToEventYear)}
								onValueChange={(val) => {
									setCopyToEventYear(parseInt(val, 10));
									setSelectedParentEventId('');
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Pilih tahun" />
								</SelectTrigger>
								<SelectContent>
									{eventYears.map((y) => (
										<SelectItem key={y._id} value={String(y.year)}>
											{y.year}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<Input
								type="number"
								value={copyToEventYear}
								onChange={(e) => { setCopyToEventYear(parseInt(e.target.value, 10) || new Date().getFullYear()); setSelectedParentEventId(''); }}
								min={2000}
								max={2100}
							/>
						)}
					</div>

					{/* Parent event dropdown */}
					<div className="space-y-1">
						<Label>Jadikan Sub-event dari (opsional)</Label>
						{isFetchingParentEvents ? (
							<div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Memuat daftar event...
							</div>
						) : !selectedYearDoc ? (
							<p className="text-xs text-muted-foreground py-1">Pilih tahun terlebih dahulu.</p>
						) : parentEventOptions.length === 0 ? (
							<p className="text-xs text-muted-foreground py-1">
								Belum ada event utama di tahun ini — berita akan dibuat sebagai event utama baru.
							</p>
						) : (
							<Select
								value={selectedParentEventId}
								onValueChange={(val) => setSelectedParentEventId(val)}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="(Buat event utama baru)" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="">(Buat event utama baru)</SelectItem>
									{parentEventOptions.map((ev) => {
										const monthLabel =
											ev.month >= 1 && ev.month <= 12
												? MONTH_NAMES_SHORT[ev.month - 1]
												: '';
										return (
											<SelectItem key={ev._id} value={ev._id}>
												{ev.title}
												{monthLabel ? ` — ${monthLabel}` : ''}
											</SelectItem>
										);
									})}
								</SelectContent>
							</Select>
						)}
					</div>

					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id="copy-atts-event"
							checked={copyAttachments}
							onChange={(e) => setCopyAttachmentsState(e.target.checked)}
							className="rounded"
						/>
						<Label htmlFor="copy-atts-event" className="cursor-pointer">
							Sertakan gambar berita ke lampiran event
						</Label>
					</div>
					<div className="flex gap-2 pt-2">
						<Button
							className="flex-1"
							onClick={() => copyToEventMut.mutate({
								year: copyToEventYear,
								parentEventId: selectedParentEventId || undefined,
								copyAtts: copyAttachments,
							})}
							disabled={copyToEventMut.isPending || isFetchingParentEvents}
						>
							{copyToEventMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							<Copy className="h-4 w-4 mr-2" />
							{selectedParentEventId ? 'Buat Sub-event' : 'Buat Event'}
						</Button>
						<Button variant="outline" onClick={() => setShowCopyToEventDialog(false)}>Batal</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>

		{/* Dialog Tambah Event Terkait */}
		<Dialog
			open={showAttachEventDialog}
			onOpenChange={(open) => {
				setShowAttachEventDialog(open);
			setAttachYearSelectOpen(false);
				if (!open) { setAttachEventSearch(''); }
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Pilih Event Terkait</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Centang event yang berkaitan dengan berita ini. Perubahan langsung tersimpan.
					</p>

					<div className="space-y-1">
						<Label>Tahun Event</Label>
						{eventYears.length > 0 ? (
							<Select
								value={attachEventYearId}
								open={attachYearSelectOpen}
								onOpenChange={setAttachYearSelectOpen}
								onValueChange={(val) => {
									setAttachEventYearId(val);
									setAttachYearSelectOpen(false); // Pastikan dropdown tertutup setelah pilihan berubah
									setAttachEventSearch('');
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Pilih tahun" />
								</SelectTrigger>
								<SelectContent>
									{eventYears.map((y) => (
										<SelectItem key={y._id} value={y._id}>
											{y.year}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<p className="text-xs text-muted-foreground py-1">Belum ada tahun event.</p>
						)}
					</div>

					<div className="relative">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							className="pl-8 h-8 text-sm"
							placeholder="Cari judul event..."
							value={attachEventSearch}
							onChange={(e) => setAttachEventSearch(e.target.value)}
						/>
					</div>

					{isFetchingAttachEvents ? (
						<div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							Memuat daftar event...
						</div>
					) : !attachEventYearId ? (
						<p className="text-center text-sm text-muted-foreground py-4">Pilih tahun terlebih dahulu.</p>
					) : attachEventsList.length === 0 ? (
						<p className="text-center text-sm text-muted-foreground py-4">Belum ada event di tahun ini.</p>
					) : (
						<div className="border rounded-md max-h-60 overflow-y-auto overflow-x-hidden pr-2">
							{attachEventsList
								.filter((ev: any) =>
									attachEventSearch
										? ev.title.toLowerCase().includes(attachEventSearch.toLowerCase())
										: true
								)
								.map((ev: any) => {
									const isLinked = linkedEventIds.includes(ev._id);
									const isPending = attachEventMut.isPending || detachEventMut.isPending;
									return (
										<label
											key={ev._id}
											className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-b-0 overflow-hidden overflow-x-hidden"
										>
											<input
												type="checkbox"
												checked={isLinked}
												onChange={() => handleToggleEventAttach(ev._id)}
												disabled={isPending}
												className="rounded mt-1"
											/>
											<div className="min-w-0">
												<span
													className="block whitespace-normal break-words overflow-hidden"
													style={{
														display: '-webkit-box',
														WebkitLineClamp: 2 as any,
														WebkitBoxOrient: 'vertical' as any,
													}}
												>
													{ev.title}
												</span>
												{!ev.published && (
													<span className="text-xs text-muted-foreground mt-0.5 block">
														(Draft)
													</span>
												)}
											</div>
											{ev.month >= 1 && ev.month <= 12 && (
												<span className="w-16 flex-shrink-0 text-right text-xs text-muted-foreground whitespace-nowrap">
													{MONTH_NAMES_SHORT[ev.month - 1]}
												</span>
											)}
										</label>
									);
								})}
							{attachEventsList.filter((ev: any) =>
								attachEventSearch
									? ev.title.toLowerCase().includes(attachEventSearch.toLowerCase())
									: true
							).length === 0 && (
								<p className="text-center text-sm text-muted-foreground py-4">
									Tidak ada event yang cocok
								</p>
							)}
						</div>
					)}

					<div className="flex justify-end pt-2">
						<Button variant="outline" onClick={() => setShowAttachEventDialog(false)}>
							Selesai
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	</div>
	);
}
