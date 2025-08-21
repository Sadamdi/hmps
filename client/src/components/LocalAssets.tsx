import React, { useState } from 'react';

interface LocalAssetProps {
	className?: string;
	alt?: string;
	fallback?: React.ReactNode;
}

// Komponen untuk banner dari local path
export function LocalBannerFull({
	className = '',
	alt = 'Banner',
	fallback,
}: LocalAssetProps) {
	const [imageLoaded, setImageLoaded] = useState(false);
	const [imageError, setImageError] = useState(false);

	const handleImageLoad = () => {
		setImageLoaded(true);
		setImageError(false);
	};

	const handleImageError = () => {
		console.log('LocalBannerFull: Failed to load, showing fallback');
		setImageError(true);
	};

	if (imageError) {
		return fallback ? (
			<>{fallback}</>
		) : (
			<div
				className={`bg-gradient-to-r from-blue-500 to-purple-600 ${className}`}>
				<div className="flex items-center justify-center h-full text-white">
					<span>Banner</span>
				</div>
			</div>
		);
	}

	return (
		<img
			src="/attached_assets/general/bennerfull.webp"
			alt={alt}
			className={`transition-opacity duration-800 ease-out ${
				imageLoaded ? 'opacity-100' : 'opacity-0'
			} ${className}`}
			style={{ willChange: 'opacity' }}
			onLoad={handleImageLoad}
			onError={handleImageError}
			loading="eager"
			decoding="async"
			fetchpriority="high"
		/>
	);
}

// Komponen untuk gambar orang dari local path
export function LocalOrang({
	className = '',
	alt = 'Orang',
	fallback,
}: LocalAssetProps) {
	const [imageLoaded, setImageLoaded] = useState(false);
	const [imageError, setImageError] = useState(false);

	const handleImageLoad = () => {
		setImageLoaded(true);
		setImageError(false);
	};

	const handleImageError = () => {
		console.log('LocalOrang: Failed to load, showing fallback');
		setImageError(true);
	};

	if (imageError) {
		return fallback ? (
			<>{fallback}</>
		) : (
			<div
				className={`bg-gradient-to-br from-gray-300 to-gray-400 ${className}`}>
				<div className="flex items-center justify-center h-full text-gray-600">
					<span>Person</span>
				</div>
			</div>
		);
	}

	return (
		<img
			src="/attached_assets/general/orang.webp"
			alt={alt}
			className={`transition-opacity duration-800 ease-out ${
				imageLoaded ? 'opacity-100' : 'opacity-0'
			} ${className}`}
			style={{ willChange: 'opacity' }}
			onLoad={handleImageLoad}
			onError={handleImageError}
			loading="lazy"
		/>
	);
}
