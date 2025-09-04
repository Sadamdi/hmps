import { detectMediaSource } from '@shared/mediaUtils';
import React, { useEffect, useState } from 'react';

interface MediaDisplayProps {
	src: string;
	alt: string;
	className?: string;
	fallback?: React.ReactNode;
	type?: 'image' | 'video' | 'auto';
}

interface MediaFile {
	id: string;
	name: string;
	url: string;
	type: 'image' | 'video';
	mimeType: string;
}

interface MediaState {
	loading: boolean;
	error: boolean;
	files: MediaFile[];
	mediaType: 'single' | 'folder';
	currentIndex: number;
	debugInfo?: any;
}

// Lazy loading thumbnail component
const LazyThumbnail = ({
	file,
	index,
	alt,
	isActive,
	onClick,
	getAlternativeUrls,
}: {
	file: MediaFile;
	index: number;
	alt: string;
	isActive: boolean;
	onClick: () => void;
	getAlternativeUrls: (url: string, isVideo: boolean) => string[];
}) => {
	const [loaded, setLoaded] = useState(false);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setInView(true);
					observer.disconnect();
				}
			},
			{ threshold: 0.1 }
		);

		const element = document.getElementById(`thumbnail-${index}`);
		if (element) {
			observer.observe(element);
		}

		return () => observer.disconnect();
	}, [index]);

	const urls = getAlternativeUrls(file.url, file.type === 'video');
	const thumbnailUrl = urls[0];

	return (
		<button
			id={`thumbnail-${index}`}
			onClick={onClick}
			className={`flex-shrink-0 w-20 h-20 border-2 rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 ${
				isActive
					? 'border-blue-500 shadow-lg ring-2 ring-blue-200'
					: 'border-gray-200 hover:border-gray-400'
			}`}>
			{file.type === 'video' ? (
				<div className="w-full h-full bg-gray-200 flex items-center justify-center relative">
					<svg
						className="w-8 h-8 text-gray-500"
						fill="currentColor"
						viewBox="0 0 24 24">
						<path d="M8 5v14l11-7z" />
					</svg>
					<span className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
						{index + 1}
					</span>
				</div>
			) : (
				<div className="w-full h-full bg-gray-100 flex items-center justify-center">
					{inView ? (
						<img
							src={thumbnailUrl}
							alt={`${alt} ${index + 1}`}
							className={`w-full h-full object-cover transition-opacity duration-300 ${
								loaded ? 'opacity-100' : 'opacity-0'
							}`}
							onLoad={() => setLoaded(true)}
							onError={(e) => {
								const target = e.target as HTMLImageElement;
								if (urls.length > 1 && target.src === urls[0]) {
									target.src = urls[1];
								}
							}}
						/>
					) : (
						<div className="w-8 h-8 animate-pulse bg-gray-300 rounded"></div>
					)}
				</div>
			)}
		</button>
	);
};

export default function MediaDisplay({
	src,
	alt,
	className = '',
	fallback,
	type = 'auto',
}: MediaDisplayProps) {
	// Simple single image display for organization members (only for non-GDrive URLs)
	if (type === 'image' && src && !src.includes('drive.google.com')) {
		return (
			<img
				src={src}
				alt={alt}
				className={className}
				onError={(e) => {
					console.error('MediaDisplay: Local image failed to load:', src);
					// Fallback to default image or placeholder
					const target = e.target as HTMLImageElement;
					target.style.display = 'none';
				}}
			/>
		);
	}

	// Original complex logic for library/media gallery
	const [mediaState, setMediaState] = useState<MediaState>({
		loading: true,
		error: false,
		files: [],
		mediaType: 'single',
		currentIndex: 0,
	});
	const [imageError, setImageError] = useState(false);
	const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		const loadMedia = async () => {
			setMediaState((prev) => ({ ...prev, loading: true, error: false }));

			try {
				const source = detectMediaSource(src);

				if (source.type === 'gdrive' && source.fileId) {
					// Prepare request body with media type hint
					const requestBody: any = {
						url: src,
						fileId: source.fileId,
					};

					// Add media type hint if provided and not auto
					if (type !== 'auto') {
						requestBody.mediaType = type;
					}

					// Fetch Google Drive media URL from server
					const response = await fetch('/api/gdrive/media-url', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(requestBody),
					});

					if (!response.ok) {
						const errorData = await response.json();
						console.error('MediaDisplay: API error:', errorData);
						throw new Error(
							errorData.message || 'Failed to fetch Google Drive media'
						);
					}

					const data = await response.json();

					setMediaState({
						loading: false,
						error: false,
						files: data.files || [],
						mediaType: data.type === 'folder' ? 'folder' : 'single',
						currentIndex: 0,
						debugInfo: data,
					});
				} else {
					// Local file - determine type from extension or use provided type
					let mediaType: 'image' | 'video' = 'image';

					if (type !== 'auto') {
						mediaType = type;
					} else {
						const extension = src.split('.').pop()?.toLowerCase();

						// Extended support for more file formats
						const imageExtensions = [
							'jpg',
							'jpeg',
							'png',
							'gif',
							'webp',
							'bmp',
							'tiff',
							'svg',
							'heic',
							'heif',
							'avif',
							'ico',
							'jfif',
						];
						const videoExtensions = [
							'mp4',
							'webm',
							'ogg',
							'avi',
							'mov',
							'wmv',
							'flv',
							'mkv',
							'm4v',
							'3gp',
							'qt',
							'asf',
							'rm',
							'rmvb',
						];

						if (videoExtensions.includes(extension || '')) {
							mediaType = 'video';
						} else {
							mediaType = 'image'; // Default to image for all other cases
						}
					}

					setMediaState({
						loading: false,
						error: false,
						files: [
							{
								id: 'local',
								name: alt,
								url: src,
								type: mediaType,
								mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
							},
						],
						mediaType: 'single',
						currentIndex: 0,
					});
				}
			} catch (error) {
				console.error('MediaDisplay: Error loading media:', error);
				setMediaState({
					loading: false,
					error: true,
					files: [],
					mediaType: 'single',
					currentIndex: 0,
				});
			}
		};

		loadMedia();
	}, [src, type, alt]);

	const currentFile = mediaState.files[mediaState.currentIndex];

	// For Google Drive media, we can try alternative URLs if one fails
	const getAlternativeUrls = (
		originalUrl: string,
		isVideo: boolean = false
	) => {
		if (!originalUrl.includes('drive.google.com')) return [originalUrl];

		const fileIdMatch = originalUrl.match(
			/[?&]id=([a-zA-Z0-9-_]+)|\/d\/([a-zA-Z0-9-_]+)/
		);
		if (!fileIdMatch) return [originalUrl];

		const fileId = fileIdMatch[1] || fileIdMatch[2];

		if (isVideo) {
			return [
				originalUrl,
				`https://drive.google.com/file/d/${fileId}/preview`,
				`https://drive.google.com/file/d/${fileId}/view`,
				`https://docs.google.com/file/d/${fileId}/preview`,
			];
		}

		return [
			`https://lh3.googleusercontent.com/d/${fileId}=s2000`, // High resolution - most reliable
			`https://lh3.googleusercontent.com/d/${fileId}=w2000-h2000`, // Specific dimensions
			originalUrl,
			`https://drive.google.com/uc?export=view&id=${fileId}`,
			`https://drive.google.com/uc?id=${fileId}&export=download`,
			`https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
			`https://docs.google.com/uc?export=view&id=${fileId}`, // Alternative docs URL
		];
	};

	const handleImageError = () => {
		const isVideo = currentFile?.type === 'video';
		const urls = getAlternativeUrls(currentFile?.url || '', isVideo);
		if (currentUrlIndex < urls.length - 1) {
			setCurrentUrlIndex((prev) => prev + 1);
			setImageError(false);
		} else {
			console.error('MediaDisplay: All alternative URLs failed');
			setImageError(true);
		}
	};

	const handleVideoError = () => {
		console.error('MediaDisplay: Video failed to load:', currentFile?.url);
		// Try alternative URLs for video
		handleImageError();
	};

	// Reset URL index when src changes
	useEffect(() => {
		setCurrentUrlIndex(0);
		setImageError(false);
	}, [src]);

	// Handle thumbnail click
	const handleThumbnailClick = (index: number) => {
		setMediaState((prev) => ({
			...prev,
			currentIndex: index,
		}));
		setCurrentUrlIndex(0);
		setImageError(false);
	};

	// Handle fullscreen toggle
	const toggleFullscreen = () => {
		setIsFullscreen(!isFullscreen);
	};

	// Handle fullscreen close with Escape key
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsFullscreen(false);
			}
		};

		if (isFullscreen) {
			document.addEventListener('keydown', handleKeyDown);
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = 'unset';
		}

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.body.style.overflow = 'unset';
		};
	}, [isFullscreen]);

	if (mediaState.loading) {
		return (
			<div
				className={`flex items-center justify-center bg-gray-100 ${className}`}>
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	if (mediaState.error || !currentFile) {
		return (
			<div
				className={`flex items-center justify-center bg-gray-100 text-gray-500 ${className}`}>
				{fallback || (
					<div className="text-center p-4">
						<svg
							className="mx-auto h-12 w-12 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
							/>
						</svg>
						<p className="mt-2 text-sm">Failed to load media</p>
						<p className="text-xs text-gray-400">
							File may be private or inaccessible
						</p>
					</div>
				)}
			</div>
		);
	}

	const handleNext = () => {
		if (mediaState.currentIndex < mediaState.files.length - 1) {
			setMediaState((prev) => ({
				...prev,
				currentIndex: prev.currentIndex + 1,
			}));
			setCurrentUrlIndex(0);
			setImageError(false);
		}
	};

	const handlePrev = () => {
		if (mediaState.currentIndex > 0) {
			setMediaState((prev) => ({
				...prev,
				currentIndex: prev.currentIndex - 1,
			}));
			setCurrentUrlIndex(0);
			setImageError(false);
		}
	};

	const MediaContent = () => {
		if (currentFile.type === 'video') {
			const isGoogleDriveVideo = currentFile.url.includes('drive.google.com');
			const urls = getAlternativeUrls(currentFile.url, true);
			const currentUrl = urls[currentUrlIndex] || currentFile.url;

			if (imageError && currentUrlIndex >= urls.length - 1) {
				return (
					<div className="w-full h-64 flex items-center justify-center bg-gray-100 text-gray-500 rounded">
						<div className="text-center p-4">
							<p className="text-sm">Failed to load video</p>
							<p className="text-xs text-gray-400">
								Video may be private or inaccessible
							</p>
							{mediaState.debugInfo && (
								<details className="mt-2 text-xs">
									<summary>Debug Info</summary>
									<pre className="text-left bg-gray-200 p-2 rounded mt-1">
										{JSON.stringify(mediaState.debugInfo, null, 2)}
									</pre>
								</details>
							)}
						</div>
					</div>
				);
			}

			// Google Drive videos work better with iframe
			if (isGoogleDriveVideo) {
				return (
					<div className="w-full h-64 flex items-center justify-center bg-black rounded relative group">
						<iframe
							src={currentUrl}
							className="w-full h-full rounded cursor-pointer"
							allow="autoplay; encrypted-media"
							allowFullScreen
							onError={handleVideoError}
							style={{ border: 'none' }}
							title={alt}
							onClick={toggleFullscreen}
							onLoad={() => {
								setImageError(false);
							}}
						/>

						{/* Fullscreen button for video */}
						<button
							onClick={toggleFullscreen}
							className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-70">
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
								/>
							</svg>
						</button>
					</div>
				);
			}

			// Regular video element for non-Google Drive videos
			return (
				<div className="w-full h-64 flex justify-center items-center bg-black rounded relative group">
					<video
						className="w-full h-full object-cover cursor-pointer"
						controls
						preload="metadata"
						onClick={toggleFullscreen}
						onError={handleVideoError}>
						<source src={currentUrl} />
						<p>Your browser does not support the video element.</p>
					</video>

					{/* Fullscreen button for video */}
					<button
						onClick={toggleFullscreen}
						className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-70">
						<svg
							className="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
							/>
						</svg>
					</button>
				</div>
			);
		}

		const urls = getAlternativeUrls(currentFile.url, false);
		const currentUrl = urls[currentUrlIndex] || currentFile.url;

		if (imageError && currentUrlIndex >= urls.length - 1) {
			return (
				<div className="w-full h-64 flex items-center justify-center bg-gray-100 text-gray-500 rounded">
					<div className="text-center p-4">
						<p className="text-sm">Failed to load image</p>
						<p className="text-xs text-gray-400">
							File may be private or inaccessible
						</p>
						{mediaState.debugInfo && (
							<details className="mt-2 text-xs">
								<summary>Debug Info</summary>
								<pre className="text-left bg-gray-200 p-2 rounded mt-1">
									{JSON.stringify(mediaState.debugInfo, null, 2)}
								</pre>
							</details>
						)}
					</div>
				</div>
			);
		}

		return (
			<div className="w-full h-64 flex justify-center items-center bg-gray-50 rounded relative group">
				<img
					src={currentUrl}
					alt={alt}
					className="w-full h-full object-cover cursor-pointer"
					onError={handleImageError}
					onClick={toggleFullscreen}
					onLoad={() => {
						setImageError(false);
					}}
					loading="lazy"
				/>

				{/* Fullscreen icon - shown on hover */}
				<button
					onClick={toggleFullscreen}
					className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-70">
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
						/>
					</svg>
				</button>
			</div>
		);
	};

	// Fullscreen Modal Component
	const FullscreenModal = () => {
		if (!isFullscreen || !currentFile) return null;

		const urls = getAlternativeUrls(
			currentFile.url,
			currentFile.type === 'video'
		);
		const currentUrl = urls[currentUrlIndex] || currentFile.url;

		return (
			<div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center">
				<div className="relative w-full h-full flex items-center justify-center p-4">
					{/* Close button */}
					<button
						onClick={toggleFullscreen}
						className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-70 z-10">
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>

					{/* Navigation for folders */}
					{mediaState.mediaType === 'folder' && mediaState.files.length > 1 && (
						<>
							<button
								onClick={handlePrev}
								disabled={mediaState.currentIndex === 0}
								className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-4 hover:bg-opacity-70 disabled:opacity-30 z-10">
								<svg
									className="w-6 h-6"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15 19l-7-7 7-7"
									/>
								</svg>
							</button>

							<button
								onClick={handleNext}
								disabled={
									mediaState.currentIndex === mediaState.files.length - 1
								}
								className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-4 hover:bg-opacity-70 disabled:opacity-30 z-10">
								<svg
									className="w-6 h-6"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 5l7 7-7 7"
									/>
								</svg>
							</button>

							{/* Counter */}
							<div className="absolute top-4 left-4 text-white bg-black bg-opacity-50 px-4 py-2 rounded-full z-10">
								{mediaState.currentIndex + 1} / {mediaState.files.length}
							</div>
						</>
					)}

					{/* Main image */}
					{currentFile.type === 'video' ? (
						<div className="max-w-full max-h-full flex items-center justify-center">
							<video
								src={currentUrl}
								className="max-w-full max-h-full object-contain"
								controls
								autoPlay={false}>
								<p>Your browser does not support the video element.</p>
							</video>
						</div>
					) : (
						<img
							src={currentUrl}
							alt={alt}
							className="max-w-full max-h-full object-contain"
							onError={handleImageError}
						/>
					)}
				</div>
			</div>
		);
	};

	// If it's a folder with multiple files, show navigation with thumbnails
	if (mediaState.mediaType === 'folder' && mediaState.files.length > 1) {
		return (
			<div className="w-full max-w-full overflow-hidden">
				{/* Main photo display - Fixed size container */}
				<div className="relative mb-4 w-full max-w-full">
					<MediaContent />

					{/* Navigation buttons overlay */}
					<div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
						<button
							onClick={handlePrev}
							disabled={mediaState.currentIndex === 0}
							className="bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 disabled:opacity-30 pointer-events-auto transition-all">
							<svg
								className="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M15 19l-7-7 7-7"
								/>
							</svg>
						</button>

						<button
							onClick={handleNext}
							disabled={mediaState.currentIndex === mediaState.files.length - 1}
							className="bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 disabled:opacity-30 pointer-events-auto transition-all">
							<svg
								className="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</button>
					</div>

					{/* File counter */}
					<div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white text-sm px-3 py-1 rounded-full">
						{mediaState.currentIndex + 1} / {mediaState.files.length}
					</div>
				</div>

				{/* Thumbnail navigation - ONLY this area can scroll horizontally */}
				<div className="w-full mt-4">
					<div className="flex gap-2 overflow-x-auto py-3 px-2 scrollbar-thin scrollbar-track-gray-200 scrollbar-thumb-gray-400 hover:scrollbar-thumb-gray-500">
						{mediaState.files.map((file, index) => {
							return (
								<LazyThumbnail
									key={`${file.id}-${index}`}
									file={file}
									index={index}
									alt={`${alt} ${index + 1}`}
									isActive={index === mediaState.currentIndex}
									onClick={() => handleThumbnailClick(index)}
									getAlternativeUrls={getAlternativeUrls}
								/>
							);
						})}
					</div>
				</div>
				<FullscreenModal />
			</div>
		);
	}

	// Single media item
	return (
		<div className={`${className} w-full max-w-full overflow-hidden`}>
			<MediaContent />
			<FullscreenModal />
		</div>
	);
}

// Gallery component for multiple media items
interface MediaGalleryProps {
	items: string[];
	className?: string;
	itemClassName?: string;
	alt?: string;
}

export function MediaGallery({
	items,
	className = '',
	itemClassName = '',
	alt = 'Gallery item',
}: MediaGalleryProps) {
	return (
		<div className={`grid gap-4 ${className}`}>
			{items.map((src, index) => (
				<MediaDisplay
					key={index}
					src={src}
					alt={`${alt} ${index + 1}`}
					className={itemClassName}
				/>
			))}
		</div>
	);
}
