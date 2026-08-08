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
import { CalendarDays, Copy, FileUp, Image, Link2, Loader2, Paperclip, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import RichTextEditor from './rich-text-editor';
import { ContentEnhanceButton } from './content-enhance-button';

type BeritaAttachmentForm = {
	name: string;
	url: string;
	type: string;
	source: 'local' | 'gdrive' | 'url';
};

/** Radix Select melarang SelectItem dengan value=""; gunakan sentinel untuk opsi "event utama baru". */
const COPY_TO_EVENT_NO_PARENT_VALUE = '__no_parent_event__';

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
	relatedGalleryIds?: string[];
	attachments?: BeritaAttachmentForm[];
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
	const [existingTagsOpen, setExistingTagsOpen] = useState(false);
	const [existingTagQuery, setExistingTagQuery] = useState('');
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

	const [selectedGalleryIds, setSelectedGalleryIds] = useState<string[]>([]);
	const [showAttachGalleryDialog, setShowAttachGalleryDialog] = useState(false);
	const [attachGallerySearch, setAttachGallerySearch] = useState('');

	// Attachment state (uploaded file/url entries)
	const [existingAttachments, setExistingAttachments] = useState<
		BeritaAttachmentForm[]
	>([]);
	const [formAttachmentLinkName, setFormAttachmentLinkName] = useState('');
	const [formAttachmentLinkUrl, setFormAttachmentLinkUrl] = useState('');
	const attachmentFileInputRef = useRef<HTMLInputElement>(null);
	const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
	const draftBeritaIdRef = useRef(`temp-${Date.now()}`);

	const escapeHtml = useCallback((value: string) => {
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}, []);

	const detectDriveFileId = useCallback((url: string): string | null => {
		if (!url) return null;
		try {
			const parsed = new URL(url);
			const host = parsed.hostname.toLowerCase();
			if (!host.includes('drive.google.com')) return null;
			const parts = parsed.pathname.split('/').filter(Boolean);
			const dIdx = parts.findIndex((p) => p === 'd');
			if (dIdx >= 0 && parts[dIdx + 1]) return parts[dIdx + 1];
			const idParam = parsed.searchParams.get('id');
			if (idParam) return idParam;
			return null;
		} catch {
			return null;
		}
	}, []);

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
		if (existingAttachments.length + 1 > 10) {
			toast({
				title: 'Maksimal 10 lampiran per berita',
				variant: 'destructive',
			});
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
		const source: BeritaAttachmentForm['source'] = driveFileId
			? 'gdrive'
			: 'url';
		setExistingAttachments((prev) => [
			...prev,
			{ name, url: rawUrl, type: 'link', source },
		]);
		setFormAttachmentLinkName('');
		setFormAttachmentLinkUrl('');
	}, [
		detectDriveFileId,
		existingAttachments.length,
		formAttachmentLinkName,
		formAttachmentLinkUrl,
		toast,
	]);

	const handleCopyAttachmentLink = useCallback(
		async (att: BeritaAttachmentForm) => {
			try {
				const safeName = escapeHtml(att.name || 'Lampiran');
				const snippet = `<a href="${att.url}" data-attachment="berita" target="_blank" rel="noopener noreferrer">${safeName}</a>`;
				// Prefer rich clipboard (HTML + plain text URL) so paste in TinyMCE
				// becomes a clickable anchor, while non-rich targets still receive URL.
				if (
					typeof window !== 'undefined' &&
					'ClipboardItem' in window &&
					navigator?.clipboard?.write
				) {
					const item = new (window as any).ClipboardItem({
						'text/html': new Blob([snippet], { type: 'text/html' }),
						'text/plain': new Blob([att.url], { type: 'text/plain' }),
					});
					await navigator.clipboard.write([item]);
					toast({ title: 'Link lampiran disalin (rich)' });
					return;
				}
				if (navigator?.clipboard?.writeText) {
					await navigator.clipboard.writeText(att.url);
					toast({ title: 'URL lampiran disalin' });
					return;
				}
				throw new Error('Clipboard API unavailable');
			} catch {
				toast({
					title: 'Gagal menyalin link',
					description: 'Silakan salin manual dari daftar lampiran.',
					variant: 'destructive',
				});
			}
		},
		[escapeHtml, toast],
	);

	const uploadAttachmentFile = useCallback(
		async (file: File) => {
			const beritaIdForUpload =
				(berita as any)?._id || berita?.id || draftBeritaIdRef.current;
			const body = new FormData();
			body.append('file', file);
			body.append('beritaId', String(beritaIdForUpload));
			const response = await apiRequest('POST', '/api/upload/berita-attachment', body);
			const data = await response.json();
			const newAttachment: BeritaAttachmentForm = {
				name: file.name,
				url: String(data?.url || ''),
				type: file.type || 'file',
				source: 'local',
			};
			if (!newAttachment.url) throw new Error('URL lampiran tidak tersedia');
			setExistingAttachments((prev) => [...prev, newAttachment]);
		},
		[berita],
	);

	const handleInsertAttachmentToContent = useCallback(
		(att: BeritaAttachmentForm) => {
			const safeName = escapeHtml(att.name || 'Lampiran');
			const safeUrl = String(att.url || '').replace(/"/g, '&quot;');
			const snippet = `<p><a href="${safeUrl}" data-attachment="berita" target="_blank" rel="noopener noreferrer">${safeName}</a></p>`;
			const tinyMce = (window as any)?.tinymce;
			const activeEditor = tinyMce?.activeEditor;
			if (activeEditor && typeof activeEditor.insertContent === 'function') {
				activeEditor.focus();
				activeEditor.insertContent(snippet);
				setContent(activeEditor.getContent() || '');
			} else {
				setContent((prev) => `${prev || ''}\n${snippet}`);
			}
			toast({
				title: 'Lampiran disisipkan ke konten',
				description: 'Posisi mengikuti kursor editor (atau ditambah di akhir konten).',
			});
		},
		[escapeHtml, toast],
	);

	const { data: libraryForBeritaLink = [] } = useQuery<
		{ _id: string; title: string; published?: boolean }[]
	>({
		queryKey: ['/api/library/manage'],
		queryFn: async () => {
			const res = await fetch('/api/library/manage', { credentials: 'include' });
			if (!res.ok) return [];
			const data = await res.json();
			return Array.isArray(data) ? data : data.data || [];
		},
	});

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
			queryClient.invalidateQueries({ queryKey: ['/api/library'] });
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
			queryClient.invalidateQueries({ queryKey: ['/api/berita'], exact: false });
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
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
			queryClient.invalidateQueries({ queryKey: ['/api/berita'], exact: false });
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
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
			queryClient.invalidateQueries({ queryKey: ['/api/berita'], exact: false });
			queryClient.invalidateQueries({ queryKey: ['/api/events'], exact: false });
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

		// Tambahan attachment dari input link yang belum ditekan "Tambah Link"
		let finalAttachments = [...existingAttachments];
		const pendingLinkName = formAttachmentLinkName.trim();
		const pendingLinkUrl = formAttachmentLinkUrl.trim();
		if (pendingLinkName && pendingLinkUrl) {
			try {
				const parsed = new URL(pendingLinkUrl);
				if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
					toast({
						title: 'URL lampiran harus http/https',
						variant: 'destructive',
					});
					return;
				}
				const driveFileId = detectDriveFileId(pendingLinkUrl);
				const source: BeritaAttachmentForm['source'] = driveFileId
					? 'gdrive'
					: 'url';
				finalAttachments.push({
					name: pendingLinkName,
					url: pendingLinkUrl,
					type: 'link',
					source,
				});
			} catch {
				toast({ title: 'URL lampiran tidak valid', variant: 'destructive' });
				return;
			}
		} else if (pendingLinkName || pendingLinkUrl) {
			toast({
				title:
					'Nama dan URL lampiran wajib diisi lengkap, atau kosongkan keduanya',
				variant: 'destructive',
			});
			return;
		}

		const totalAttachments = finalAttachments.length;
		if (totalAttachments > 10) {
			toast({
				title: `Maksimal 10 lampiran per berita. Saat ini ada ${totalAttachments} lampiran.`,
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
		formData.append('relatedGalleryIds', JSON.stringify(selectedGalleryIds));
		formData.append('attachments', JSON.stringify(finalAttachments));

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
		setExistingAttachments([]);
		setFormAttachmentLinkName('');
		setFormAttachmentLinkUrl('');
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
			setSelectedGalleryIds(
				(berita.relatedGalleryIds || []).map((x) => String(x)),
			);
			setAttachGallerySearch('');
			setExistingAttachments(
				Array.isArray(berita.attachments)
					? berita.attachments
							.filter((a): a is BeritaAttachmentForm => !!a && !!a.url && !!a.name)
							.map((a) => ({
								name: a.name,
								url: a.url,
								type: a.type || 'file',
								source:
									a.source === 'gdrive' || a.source === 'url'
										? a.source
										: 'local',
							}))
					: [],
			);
			setFormAttachmentLinkName('');
			setFormAttachmentLinkUrl('');

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
				description="Form mengirim judul, excerpt, HTML konten, thumbnail, tag, dan publish. Di isi artikel Anda bisa menyematkan YouTube atau Google Drive (link file foto/video atau folder) dengan menempel URL; host lain perlu diizinkan admin di Settings (domain embed).">
				<ul className="list-disc list-inside space-y-1.5 text-sm">
					<li>
						<strong>Embed</strong>: salin tautan Google Drive (buka file/folder → bagikan → siapa pun dengan link) atau YouTube, tempel di paragraf — tampil otomatis di halaman publik. Satu URL per baris atau sebagai tautan.
					</li>
					<li>
						<strong>Langkah</strong>: isi judul &amp; excerpt → tulis isi di editor (bold, list, gambar inline, URL embed) → unggah thumbnail jika perlu → atur tag → centang publish jika siap → <strong>Simpan</strong>.
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

						{/* Existing Tags — collapsed by default; search + max 20 + scroll */}
						{allExistingTags.length > 0 && (
							<div className="space-y-2">
								<button
									type="button"
									className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50"
									onClick={() => setExistingTagsOpen((o) => !o)}
									aria-expanded={existingTagsOpen}
								>
									<span>
										Existing tags ({allExistingTags.length})
										{!existingTagsOpen ? ' — klik untuk membuka' : ''}
									</span>
									<span className="text-xs">{existingTagsOpen ? 'Tutup' : 'Buka'}</span>
								</button>
								{existingTagsOpen && (
									<div className="space-y-2 rounded-md border border-border p-3">
										<div className="relative">
											<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
											<Input
												placeholder="Cari tag…"
												value={existingTagQuery}
												onChange={(e) => setExistingTagQuery(e.target.value)}
												className="h-9 pl-8"
											/>
										</div>
										<div className="max-h-40 overflow-y-auto">
											<div className="flex flex-wrap gap-2">
												{allExistingTags
													.filter((tag) =>
														!existingTagQuery.trim()
															? true
															: tag
																	.toLowerCase()
																	.includes(existingTagQuery.trim().toLowerCase()),
													)
													.slice(0, 20)
													.map((tag) => (
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
											{allExistingTags.filter((tag) =>
												!existingTagQuery.trim()
													? true
													: tag.toLowerCase().includes(existingTagQuery.trim().toLowerCase()),
											).length > 20 && (
												<p className="mt-2 text-xs text-muted-foreground">
													Menampilkan 20 teratas. Ketik di pencarian untuk menyaring tag lain.
												</p>
											)}
										</div>
									</div>
								)}
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
				<div className="flex items-center gap-2 min-w-0">
					<CalendarDays className="h-4 w-4 text-primary shrink-0" />
					<div className="min-w-0">
						<h3 className="font-medium text-sm">Event Terkait</h3>
						<p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Relasi dua arah — perubahan di sini juga terlihat di detail event. Di komunitas, hanya berlaku untuk data komunitas tersebut.</p>
					</div>
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

		<div className="border rounded-lg p-4 space-y-3">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<Image className="h-4 w-4 text-primary shrink-0" />
					<div className="min-w-0">
						<h3 className="font-medium text-sm">Galeri Terkait</h3>
						<p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Hubungkan dokumentasi foto/video. Relasi tersimpan dua arah dengan galeri.</p>
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="shrink-0"
					onClick={() => {
						setAttachGallerySearch('');
						setShowAttachGalleryDialog(true);
					}}>
					<Plus className="h-3.5 w-3.5 mr-1" />
					Tambah Galeri
				</Button>
			</div>
			{selectedGalleryIds.length === 0 ? (
				<p className="text-xs text-muted-foreground">
					Belum ada galeri yang terhubung. Klik Tambah Galeri untuk memilih dokumentasi foto/video.
				</p>
			) : (
				<div className="flex flex-wrap gap-2">
					{selectedGalleryIds.map((id) => {
						const g = libraryForBeritaLink.find((x) => x._id === id);
						if (!g) return null;
						return (
							<Badge
								key={id}
								variant="outline"
								className="gap-1.5 text-xs py-1 px-2 max-w-full">
								<Link2 className="h-3 w-3 shrink-0" />
								<span className="truncate">{g.title}</span>
								{g.published === false && (
									<span className="text-muted-foreground shrink-0">(draf)</span>
								)}
								<button
									type="button"
									onClick={() =>
										setSelectedGalleryIds((prev) => prev.filter((i) => i !== id))
									}
									className="ml-0.5 hover:text-destructive transition-colors shrink-0"
									title="Hapus">
									<X className="h-2.5 w-2.5" />
								</button>
							</Badge>
						);
					})}
				</div>
			)}
		</div>

		<div className="border rounded-lg p-4 space-y-3">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<Paperclip className="h-4 w-4 text-primary shrink-0" />
					<div className="min-w-0">
						<h3 className="font-medium text-sm">Lampiran Berita</h3>
						<p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
							Tambahkan dokumen, media, atau link pendukung. Bisa juga ditempel
							inline di konten — lampiran berikut tampil sebagai daftar di bawah
							artikel publik.
						</p>
					</div>
				</div>
				<span className="text-xs text-muted-foreground shrink-0">
					{existingAttachments.length}/10 slot terpakai
				</span>
			</div>

			{existingAttachments.length > 0 && (
				<div className="space-y-1 max-h-36 overflow-y-auto">
					{existingAttachments.map((att, idx) => (
						<div
							key={`existing-${idx}-${att.url}`}
							className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1 min-w-0">
							<span className="flex-1 truncate min-w-0">{att.name}</span>
							<span className="text-[10px] uppercase rounded px-1.5 py-0.5 bg-background border text-muted-foreground">
								{att.source === 'gdrive'
									? 'gdrive'
									: att.source === 'url'
										? 'link'
										: 'file'}
							</span>
							<Button
								variant="ghost"
								size="sm"
								type="button"
								className="h-6 px-2 text-[11px]"
								onClick={() => handleCopyAttachmentLink(att)}>
								Copy Link
							</Button>
							<Button
								variant="ghost"
								size="sm"
								type="button"
								className="h-6 px-2 text-[11px]"
								onClick={() => handleInsertAttachmentToContent(att)}>
								Sisipkan
							</Button>
							<Button
								variant="ghost"
								size="sm"
								type="button"
								className="h-6 w-6 p-0 flex-shrink-0"
								onClick={() =>
									setExistingAttachments((prev) =>
										prev.filter((_, i) => i !== idx),
									)
								}>
								<Trash2 className="h-3 w-3" />
							</Button>
						</div>
					))}
				</div>
			)}

			<div>
				<input
					ref={attachmentFileInputRef}
					type="file"
					multiple
					className="hidden"
					onChange={async (e) => {
						if (e.target.files && e.target.files.length > 0) {
							const newFiles = Array.from(e.target.files);
							const remaining = 10 - existingAttachments.length;
							if (remaining <= 0) {
								toast({
									title: 'Maksimal 10 lampiran per berita',
									variant: 'destructive',
								});
								e.target.value = '';
								return;
							}
							const acceptedFiles = newFiles.slice(0, remaining);
							if (newFiles.length > remaining) {
								toast({
									title: `Hanya bisa menambah ${remaining} file lagi (maks 10 total)`,
									variant: 'destructive',
								});
							}
							setIsUploadingAttachments(true);
							for (const file of acceptedFiles) {
								try {
									await uploadAttachmentFile(file);
								} catch (err: any) {
									toast({
										title: `Gagal upload lampiran: ${file.name}`,
										description: err?.message || 'Terjadi kesalahan saat upload.',
										variant: 'destructive',
									});
								}
							}
							setIsUploadingAttachments(false);
							e.target.value = '';
						}
					}}
				/>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={isUploadingAttachments}
					onClick={() => attachmentFileInputRef.current?.click()}>
					<FileUp className="h-3.5 w-3.5 mr-1" />
					{isUploadingAttachments ? 'Mengunggah...' : 'Pilih File Lampiran'}
				</Button>
			</div>

			<div className="rounded-md border p-3 space-y-2">
				<p className="text-xs font-medium">Tambah lampiran dari link online</p>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
					<Input
						value={formAttachmentLinkName}
						onChange={(e) => setFormAttachmentLinkName(e.target.value)}
						placeholder="Nama lampiran (mis. Rilis PDF)"
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
						Mendukung URL umum + Google Drive single-file (bukan folder). URL
						akan dinormalisasi otomatis saat disimpan.
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleAddAttachmentLink}>
						<Link2 className="h-3.5 w-3.5 mr-1" />
						Tambah Link
					</Button>
				</div>
				<p className="text-[11px] text-muted-foreground">
					Setelah masuk daftar, klik <strong>Copy Link</strong> atau{' '}
					<strong>Sisipkan</strong> untuk menaruh lampiran ke posisi bebas
					di konten.
				</p>
			</div>
		</div>

		<div className="flex flex-wrap justify-end items-center gap-2">
			<ContentEnhanceButton
				entityType="berita"
				fields={[
					{ key: 'title', label: 'Judul' },
					{ key: 'excerpt', label: 'Excerpt' },
					{ key: 'content', label: 'Konten' },
				]}
				values={{ title, excerpt, content }}
				onApply={(partial) => {
					if (partial.title !== undefined) setTitle(partial.title);
					if (partial.excerpt !== undefined) setExcerpt(partial.excerpt);
					if (partial.content !== undefined) setContent(partial.content);
				}}
			/>
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
								value={
									selectedParentEventId || COPY_TO_EVENT_NO_PARENT_VALUE
								}
								onValueChange={(val) =>
									setSelectedParentEventId(
										val === COPY_TO_EVENT_NO_PARENT_VALUE ? '' : val,
									)
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="(Buat event utama baru)" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={COPY_TO_EVENT_NO_PARENT_VALUE}>
										(Buat event utama baru)
									</SelectItem>
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

		<Dialog
			open={showAttachGalleryDialog}
			onOpenChange={(open) => {
				setShowAttachGalleryDialog(open);
				if (!open) setAttachGallerySearch('');
			}}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Pilih Galeri Terkait</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Centang galeri yang berkaitan dengan berita ini. Perubahan ikut disimpan saat Anda
						menekan Simpan Berita.
					</p>
					<div className="relative">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							className="pl-8 h-8 text-sm"
							placeholder="Cari judul galeri..."
							value={attachGallerySearch}
							onChange={(e) => setAttachGallerySearch(e.target.value)}
						/>
					</div>
					<div className="border rounded-md max-h-60 overflow-y-auto">
						{libraryForBeritaLink
							.filter((g) =>
								attachGallerySearch
									? g.title.toLowerCase().includes(attachGallerySearch.toLowerCase())
									: true,
							)
							.map((g) => {
								const checked = selectedGalleryIds.includes(g._id);
								return (
									<label
										key={g._id}
										className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-b-0">
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
											className="rounded"
										/>
										<span className="flex-1 truncate">{g.title}</span>
										{g.published === false && (
											<span className="text-xs text-muted-foreground">draf</span>
										)}
									</label>
								);
							})}
						{libraryForBeritaLink.length === 0 && (
							<p className="text-center text-sm text-muted-foreground py-4">
								Belum ada galeri atau memuat…
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
	</div>
	);
}
