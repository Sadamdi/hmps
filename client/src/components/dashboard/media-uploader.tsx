import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
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
	id: number;
	title: string;
	description: string;
	fullDescription: string;
	images: string[];
	date: string;
	time: string;
	type: 'photo' | 'video';
	createdAt: string;
}

interface MediaUploaderProps {
	item: LibraryItem | null;
	onSave: () => void;
	onCancel: () => void;
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
		item?.fullDescription || ''
	);
	const [mediaType, setMediaType] = useState<'photo' | 'video'>(
		item?.type || 'photo'
	);
	const [gdriveUrls, setGdriveUrls] = useState<string[]>(['']);
	const [gdriveValidations, setGdriveValidations] = useState<{
		[key: number]: boolean;
	}>({});
	const [gdriveErrors, setGdriveErrors] = useState<{ [key: number]: string }>(
		{}
	);
	const [gdriveMediaTypes, setGdriveMediaTypes] = useState<{
		[key: number]: 'image' | 'video';
	}>({});
	const [mediaUrls, setMediaUrls] = useState<string[]>(item?.images || []);

	// Initialize form data when editing
	useEffect(() => {
		if (item) {
			setTitle(item.title || '');
			setDescription(item.description || '');
			setFullDescription(item.fullDescription || '');
			setMediaType(item.type || 'photo');

			// Load Google Drive URLs if they exist
			if (item.images && item.images.length > 0) {
				console.log('Loading existing images for edit:', item.images);
				setGdriveUrls(item.images);
				setMediaUrls(item.images);

				// Set all as valid since they're already saved
				const validations: { [key: number]: boolean } = {};
				const mediaTypes: { [key: number]: 'image' | 'video' } = {};
				item.images.forEach((url: string, index: number) => {
					validations[index] = true;
					// Determine media type based on item type or URL
					mediaTypes[index] = item.type === 'video' ? 'video' : 'image';
				});
				setGdriveValidations(validations);
				setGdriveMediaTypes(mediaTypes);
			}
		}
	}, [item]);

	// Save media mutation
	const saveMediaMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			if (item) {
				// Update existing item - Use MongoDB _id or PostgreSQL id
				const itemId = (item as any)._id || item.id;

				console.log('Updating library item with ID:', itemId);

				if (!itemId) {
					throw new Error('Invalid item ID');
				}

				return await apiRequest('PUT', `/api/library/${itemId}`, formData);
			} else {
				// Create new item
				return await apiRequest('POST', '/api/library', formData);
			}
		},
		onSuccess: async (data) => {
			// Invalidate queries to refresh data
			queryClient.invalidateQueries({ queryKey: ['/api/library'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			// Log activity
			try {
				const isEdit = !!item;
				const responseData = await data.json();
				const itemId = responseData._id || responseData.id || 'unknown';

				if (isEdit) {
					await logActivity(
						ActivityTemplates.libraryItemUpdated(title, String(itemId))
					);
				} else {
					await logActivity(
						ActivityTemplates.libraryItemCreated(title, String(itemId))
					);
				}
			} catch (error) {
				console.warn('Failed to log library activity:', error);
			}

			// Clear form after successful upload
			setTitle('');
			setDescription('');
			setFullDescription('');
			setGdriveUrls(['']);
			setGdriveValidations({});
			setGdriveErrors({});
			setGdriveMediaTypes({});
			setMediaUrls([]);

			toast({
				title: 'Success',
				description: 'Media uploaded successfully',
			});

			onSave();
		},
		onError: (error: any) => {
			const message =
				error?.response?.data?.message || // kalau pakai axios & server kirim error message
				error?.message || // pesan dari error JS biasa
				'Failed to save the media item. Please try again.'; // fallback

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
		error?: string
	) => {
		setGdriveValidations((prev) => ({ ...prev, [index]: isValid }));
		setGdriveErrors((prev) => ({ ...prev, [index]: error || '' }));

		// Update media URLs when valid
		if (isValid && gdriveUrls[index]) {
			setMediaUrls((prev) => {
				const newUrls = [...prev];
				newUrls[index] = gdriveUrls[index];
				return newUrls;
			});
		}
	};

	const handleGdriveMediaTypeChange = (
		index: number,
		type: 'image' | 'video'
	) => {
		setGdriveMediaTypes((prev) => ({ ...prev, [index]: type }));
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
		setMediaUrls((prev) => prev.filter((_, i) => i !== index));
	};

	const updateGdriveUrl = (index: number, url: string) => {
		setGdriveUrls((prev) => {
			const newUrls = [...prev];
			newUrls[index] = url;
			return newUrls;
		});
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

		if (!description.trim()) {
			toast({
				title: 'Error',
				description: 'Please provide a short description',
				variant: 'destructive',
			});
			return;
		}

		// Validate Google Drive URLs
		const validUrls = gdriveUrls.filter((url) => url.trim() !== '');
		if (validUrls.length === 0) {
			toast({
				title: 'Error',
				description: 'Please provide at least one Google Drive link',
				variant: 'destructive',
			});
			return;
		}

		// Check if all provided URLs are valid
		const hasInvalidUrls = validUrls.some(
			(url, index) => !gdriveValidations[index]
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
			// Create FormData for submission
			const formData = new FormData();
			formData.append('title', title);
			formData.append('description', description);
			formData.append('fullDescription', fullDescription);
			formData.append('type', mediaType);

			// Add Google Drive URLs with their types
			validUrls.forEach((url, index) => {
				formData.append(`gdriveUrls[${index}]`, url);
				// Add media type for each URL (use global mediaType as default)
				const urlMediaType = gdriveMediaTypes[index] || mediaType;
				formData.append(`gdriveMediaTypes[${index}]`, urlMediaType);
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
		<div className="space-y-6">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="title">Title</Label>
					<Input
						id="title"
						placeholder="Enter media title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="description">Short Description</Label>
					<Textarea
						id="description"
						placeholder="Brief description (shown in previews)"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={2}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="fullDescription">Full Description</Label>
					<Textarea
						id="fullDescription"
						placeholder="Detailed description (shown when item is opened)"
						value={fullDescription}
						onChange={(e) => setFullDescription(e.target.value)}
						rows={4}
					/>
				</div>

				<div className="space-y-3">
					<Label>Media Type</Label>
					<RadioGroup
						value={mediaType}
						onValueChange={(value) => setMediaType(value as 'photo' | 'video')}
						className="flex space-x-4">
						<div className="flex items-center space-x-2">
							<RadioGroupItem
								value="photo"
								id="photo"
							/>
							<Label
								htmlFor="photo"
								className="flex items-center">
								<ImageIcon className="h-4 w-4 mr-1" />
								Photo
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem
								value="video"
								id="video"
							/>
							<Label
								htmlFor="video"
								className="flex items-center">
								<Video className="h-4 w-4 mr-1" />
								Video
							</Label>
						</div>
					</RadioGroup>
				</div>

				<div className="space-y-4">
					<Label>Google Drive Media Links</Label>

					{gdriveUrls.map((url, index) => (
						<div
							key={index}
							className="space-y-2">
							<div className="flex items-center space-x-2">
								<div className="flex-1">
									<GDriveLinkInput
										label={`Media Link ${index + 1}`}
										value={url}
										onChange={(newUrl) => updateGdriveUrl(index, newUrl)}
										onValidation={(isValid, error) =>
											handleGdriveValidation(index, isValid, error)
										}
										onMediaTypeChange={(type) =>
											handleGdriveMediaTypeChange(index, type)
										}
										mediaType={gdriveMediaTypes[index] || mediaType}
										placeholder={`Paste Google Drive link for ${mediaType}...`}
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
									<Label className="text-sm">Preview:</Label>
									<div className="w-32 h-32 border rounded-md overflow-hidden mt-1">
										<MediaDisplay
											src={url}
											alt={`Media preview ${index + 1}`}
											type={gdriveMediaTypes[index] || mediaType}
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
						Add Another {mediaType === 'photo' ? 'Photo' : 'Video'} Link
					</Button>

					<p className="text-sm text-gray-500 mt-2">
						{mediaType === 'photo'
							? 'You can add multiple Google Drive photo links'
							: 'You can add multiple Google Drive video links'}
					</p>
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
					disabled={saveMediaMutation.isPending}>
					{saveMediaMutation.isPending ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Saving...
						</>
					) : (
						<>
							<Upload className="mr-2 h-4 w-4" />
							Save
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
