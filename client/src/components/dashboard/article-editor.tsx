import { GDriveLinkInput } from '@/components/GDriveLinkInput';
import { MediaDisplay } from '@/components/MediaDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import { Image, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';

// Note: In a real implementation, you would use a proper WYSIWYG editor like TinyMCE, CKEditor, or Quill
// This is a simplified version for the demo

interface Article {
	id: number;
	title: string;
	excerpt: string;
	content: string;
	image: string;
	published: boolean;
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

	// Create or update article mutation
	const saveArticleMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			if (article) {
				// Update existing article - Use MongoDB _id or PostgreSQL id
				const articleId = (article as any)._id || article.id;
				console.log('Updating article with ID:', articleId);
				return await apiRequest('PUT', `/api/articles/${articleId}`, formData);
			} else {
				// Create new article
				return await apiRequest('POST', '/api/articles', formData);
			}
		},
		onSuccess: () => {
			// Invalidate queries to refresh data
			queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
			queryClient.invalidateQueries({ queryKey: ['/api/articles/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
			onSave();
		},
		onError: (error) => {
			toast({
				title: 'Error',
				description: 'Failed to save the article. Please try again.',
				variant: 'destructive',
			});
			console.error('Save error:', error);
		},
	});

	const handleGdriveValidation = (isValid: boolean, error?: string) => {
		setIsGdriveValid(isValid);
		setGdriveError(error);
		if (isValid && gdriveUrl) {
			setImageUrl(gdriveUrl);
		}
	};

	const handleSave = async () => {
		// Validation
		if (!title.trim()) {
			toast({
				title: 'Error',
				description: 'Title is required',
				variant: 'destructive',
			});
			return;
		}

		if (!excerpt.trim()) {
			toast({
				title: 'Error',
				description: 'Please provide a short excerpt',
				variant: 'destructive',
			});
			return;
		}

		if (!content.trim()) {
			toast({
				title: 'Error',
				description: 'Content cannot be empty',
				variant: 'destructive',
			});
			return;
		}

		if (!imageUrl && !gdriveUrl) {
			toast({
				title: 'Error',
				description:
					'Please provide a Google Drive link for the thumbnail image',
				variant: 'destructive',
			});
			return;
		}

		if (gdriveUrl && !isGdriveValid) {
			toast({
				title: 'Error',
				description:
					gdriveError || 'Google Drive link is not valid or accessible',
				variant: 'destructive',
			});
			return;
		}

		try {
			// Create FormData for submission
			const formData = new FormData();
			formData.append('title', title);
			formData.append('excerpt', excerpt);
			formData.append('content', content);
			formData.append('published', isPublished.toString());

			if (gdriveUrl && isGdriveValid) {
				formData.append('gdriveUrl', gdriveUrl);
			}

			await saveArticleMutation.mutateAsync(formData);

			// Clear form after successful upload
			setTitle('');
			setExcerpt('');
			setContent('');
			setImageUrl('');
			setGdriveUrl('');
			setIsGdriveValid(false);

			toast({
				title: 'Success',
				description: 'Article saved successfully',
			});
		} catch (error) {
			console.error('Save error:', error);
			toast({
				title: 'Error',
				description: 'Failed to save article. Please try again.',
				variant: 'destructive',
			});
		}
	};

	// Upload content image mutation
	const uploadContentImageMutation = useMutation({
		mutationFn: async (file: File) => {
			const formData = new FormData();
			formData.append('image', file);
			return await apiRequest('POST', '/api/upload/content-image', formData);
		},
		onSuccess: (data) => {
			// Insert image tag at cursor position or at the end of content
			const imageTag = `<img src="${data.url}" alt="Content image" class="my-4 max-w-full" />`;
			setContent((prev) => prev + '\n' + imageTag);

			toast({
				title: 'Success',
				description: 'Image has been inserted into your content.',
			});
		},
		onError: (error) => {
			console.error('Upload error:', error);
			toast({
				title: 'Error',
				description: 'Failed to upload the image. Please try again.',
				variant: 'destructive',
			});
		},
	});

	const handleContentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			uploadContentImageMutation.mutateAsync(file);
		}
	};

	// Format content
	const applyFormatting = (format: string) => {
		// This is a very simplified formatting - in a real app, use proper editor
		let formattedText = '';

		switch (format) {
			case 'bold':
				formattedText = `<strong>${content}</strong>`;
				break;
			case 'italic':
				formattedText = `<em>${content}</em>`;
				break;
			case 'underline':
				formattedText = `<u>${content}</u>`;
				break;
			case 'h1':
				formattedText = `<h1>${content}</h1>`;
				break;
			case 'h2':
				formattedText = `<h2>${content}</h2>`;
				break;
			case 'h3':
				formattedText = `<h3>${content}</h3>`;
				break;
			default:
				formattedText = content;
		}

		setContent(formattedText);
	};

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
					<GDriveLinkInput
						label="Thumbnail Image"
						value={gdriveUrl}
						onChange={setGdriveUrl}
						onValidation={handleGdriveValidation}
						placeholder="Paste Google Drive link for article thumbnail..."
					/>

					{imageUrl && (
						<div className="mt-4">
							<Label>Preview:</Label>
							<div className="w-32 h-32 border rounded-md overflow-hidden mt-2">
								<MediaDisplay
									src={imageUrl}
									alt="Article thumbnail preview"
									className="w-full h-full object-cover"
								/>
							</div>
						</div>
					)}
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
						<div className="border rounded-md p-2 bg-gray-50 flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => applyFormatting('bold')}>
								<strong>B</strong>
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => applyFormatting('italic')}>
								<em>I</em>
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => applyFormatting('underline')}>
								<u>U</u>
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => applyFormatting('h1')}>
								H1
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => applyFormatting('h2')}>
								H2
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => applyFormatting('h3')}>
								H3
							</Button>
							<div className="border-l mx-1 h-6"></div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => contentImageInputRef.current?.click()}
								disabled={uploadContentImageMutation.isPending}>
								{uploadContentImageMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Image className="h-4 w-4" />
								)}
								<span className="ml-1">Add Image</span>
							</Button>
							<input
								ref={contentImageInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleContentImageUpload}
							/>
						</div>
						<Textarea
							placeholder="Write your article content here..."
							value={content}
							onChange={(e) => setContent(e.target.value)}
							rows={15}
						/>
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
