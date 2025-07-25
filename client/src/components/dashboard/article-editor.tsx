import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import { Image, Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import RichTextEditor from './rich-text-editor';

interface Article {
	id?: number;
	_id?: string;
	title: string;
	excerpt: string;
	content: string;
	image: string;
	published: boolean;
	author: string;
	createdAt: string;
}

interface ArticleEditorProps {
	article: Article | null;
	onSave: () => void;
	onCancel: () => void;
}

export default function ArticleEditor({
	article,
	onSave,
	onCancel,
}: ArticleEditorProps) {
	const { user } = useAuth();
	const { toast } = useToast();

	const [title, setTitle] = useState(article?.title || '');
	const [excerpt, setExcerpt] = useState(article?.excerpt || '');
	const [content, setContent] = useState(article?.content || '');
	const [imageUrl, setImageUrl] = useState(article?.image || '');
	const [gdriveUrl, setGdriveUrl] = useState('');
	const [isGdriveValid, setIsGdriveValid] = useState(false);
	const [gdriveError, setGdriveError] = useState<string | undefined>();
	const [isPublished, setIsPublished] = useState(article?.published || false);
	const [activeTab, setActiveTab] = useState('edit');
	const contentImageInputRef = useRef<HTMLInputElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [imagePreview, setImagePreview] = useState<string>('');
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const imageUrl = URL.createObjectURL(file);
			setImagePreview(imageUrl);
			setImageUrl(imageUrl);
			setSelectedFile(file); // Simpan file untuk dikirim saat save
		}
	};

	const saveArticleMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			const articleId = (article as any)?._id || article?.id;
			return articleId
				? apiRequest('PUT', `/api/articles/${articleId}`, formData)
				: apiRequest('POST', '/api/articles', formData);
		},
		onSuccess: async (response) => {
			// Invalidate queries
			queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
			queryClient.invalidateQueries({ queryKey: ['/api/articles/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			// Log activity
			try {
				const isEdit = !!(article as any)?._id || !!article?.id;
				let responseData;

				// Handle response safely
				if (response && typeof response === 'object' && 'json' in response) {
					responseData = await response.json();
				} else {
					responseData = response; // Already parsed
				}

				const articleId = responseData?._id || responseData?.id || 'unknown';

				if (isEdit) {
					await logActivity(ActivityTemplates.articleUpdated(title, articleId));
				} else {
					await logActivity(ActivityTemplates.articleCreated(title, articleId));
				}

				// Log publish activity if published
				if (isPublished) {
					await logActivity(
						ActivityTemplates.articlePublished(title, articleId)
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
				description: 'Failed to save the article. Please try again.',
				variant: 'destructive',
			});
		},
	});

	const uploadContentImageMutation = useMutation({
		mutationFn: async (file: File) => {
			const formData = new FormData();
			formData.append('image', file);

			// Kirim articleId untuk folder organization
			const articleId =
				(article as any)?._id || article?.id || 'temp-' + Date.now();
			formData.append('articleId', articleId.toString());

			console.log('📤 Uploading image for article:', articleId);

			const response = await apiRequest(
				'POST',
				'/api/upload/content-image',
				formData
			);
			const data = await response.json(); // 🔥 PERBAIKAN: Parse JSON response

			console.log('📥 Server response:', data);
			return data;
		},
		onSuccess: (data) => {
			console.log('📸 Upload success response:', data);

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
				'textarea[placeholder*="Write your article"]'
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
			'textarea[placeholder*="Write your article"]'
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
			'textarea[placeholder*="Write your article"]'
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
				description: 'All fields are required',
				variant: 'destructive',
			});
			return;
		}
		if (!imageUrl && !gdriveUrl) {
			toast({
				title: 'Error',
				description: 'Provide a Google Drive image link',
				variant: 'destructive',
			});
			return;
		}
		if (gdriveUrl && !isGdriveValid) {
			toast({
				title: 'Error',
				description: gdriveError || 'Invalid Google Drive link',
				variant: 'destructive',
			});
			return;
		}

		const formData = new FormData();
		formData.append('title', title);
		formData.append('excerpt', excerpt);
		formData.append('content', content);
		formData.append('published', isPublished.toString());

		// Kirim Google Drive URL jika ada dan valid
		if (gdriveUrl && isGdriveValid) {
			formData.append('gdriveUrl', gdriveUrl);
		}

		// PERBAIKAN: Kirim file thumbnail jika ada
		if (selectedFile) {
			formData.append('image', selectedFile);
		}

		await saveArticleMutation.mutateAsync(formData);
		setTitle('');
		setExcerpt('');
		setContent('');
		setImagePreview('');
		setSelectedFile(null); // Reset selected file
		toast({ title: 'Success', description: 'Article saved.' });
	};

	// Load article data saat edit mode
	useEffect(() => {
		if (article) {
			setTitle(article.title || '');
			setExcerpt(article.excerpt || '');
			setContent(article.content || '');
			setImageUrl(article.image || '');
			setIsPublished(article.published || false);

			// Set image preview untuk edit mode
			if (article.image && !article.image.startsWith('blob:')) {
				setImagePreview(article.image);
			}
		}
	}, [article]);

	useEffect(() => {
		return () => {
			if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
		};
	}, [imagePreview]);

	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="title">Article Title</Label>
					<Input
						id="title"
						placeholder="Enter article title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="excerpt">Short Excerpt</Label>
					<Textarea
						id="excerpt"
						placeholder="Brief description (shown in article previews)"
						value={excerpt}
						onChange={(e) => setExcerpt(e.target.value)}
						rows={2}
					/>
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
							<Label>Article Content</Label>
							<RichTextEditor
								value={content}
								onChange={setContent}
								placeholder="Write your article content here..."
								height={500}
								articleId={
									(article as any)?._id || article?.id || 'temp-' + Date.now()
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

			<div className="flex justify-end space-x-4">
				<Button
					variant="outline"
					onClick={onCancel}>
					Cancel
				</Button>
				<Button
					onClick={handleSave}
					disabled={saveArticleMutation.isPending}>
					{saveArticleMutation.isPending ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Saving...
						</>
					) : (
						'Save Article'
					)}
				</Button>
			</div>
		</div>
	);
}
