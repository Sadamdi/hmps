import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';

interface Settings {
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	aboutUs: string;
	visionMission: string;
	contactEmail: string;
	address: string;
	enableRegistration: boolean;
	maintenanceMode: boolean;
	footerText: string;
	socialLinks: {
		facebook: string;
		twitter: string;
		instagram: string;
		youtube: string;
	};
}

interface LibraryItem {
	_id: string;
	title: string;
	description: string;
	imageUrls: string[];
	imageSources: string[];
	gdriveFileIds: string[];
	type: 'photo' | 'video';
	createdAt: string;
}

interface Article {
	_id: string;
	title: string;
	image: string;
	imageSource: string;
	gdriveFileId?: string;
	published: boolean;
}

// Define the position type outside the function for reusability
type Position = {
	x: number;
	y: number;
	delay: number;
	size: number;
	rotation: number;
	duration: number;
};

// Generate random positions for floating images with collision detection
const generateRandomPositions = (
	count: number,
	side: 'left' | 'right'
): Position[] => {
	const positions: Position[] = []; // Explicit type annotation
	const baseX = side === 'left' ? 1 : 1; // Distance from edge
	const maxX = 12; // Maximum distance from edge
	const minDistance = 10; // Minimum distance between images (in percentage) - increased for better spacing

	// Define different size categories for more variety
	const sizeCategories = [
		{ min: 50, max: 70 }, // Extra small
		{ min: 80, max: 100 }, // Small
		{ min: 110, max: 140 }, // Medium
		{ min: 150, max: 180 }, // Large
		{ min: 190, max: 220 }, // Extra large
	];

	// Function to check if two positions overlap
	const isOverlapping = (pos1: Position, pos2: Position) => {
		const distance = Math.sqrt(
			Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
		);
		return distance < minDistance;
	};

	// Generate positions with collision detection
	for (let i = 0; i < count; i++) {
		let attempts = 0;
		let newPosition: Position;

		do {
			// Pick random size category
			const sizeCategory =
				sizeCategories[Math.floor(Math.random() * sizeCategories.length)];
			const size =
				Math.random() * (sizeCategory.max - sizeCategory.min) +
				sizeCategory.min;

			newPosition = {
				x: Math.random() * (maxX - baseX) + baseX,
				y: Math.random() * 75 + 12.5, // 12.5% to 87.5% from top
				delay: Math.random() * 6, // Random animation delay up to 6s
				size: size,
				rotation: Math.random() * 8 - 4, // Random rotation -4 to +4 degrees
				duration: Math.random() * 6 + 10, // Animation duration 10-16 seconds
			};

			attempts++;
		} while (
			attempts < 50 && // Max 50 attempts to avoid infinite loop
			positions.some((pos) => isOverlapping(newPosition, pos))
		);

		positions.push(newPosition);
	}

	return positions;
};

// Animated Gallery Component with random positioning
function AnimatedGallery({
	images,
	direction = 'up',
	side,
}: {
	images: string[];
	direction?: 'up' | 'down';
	side: 'left' | 'right';
}) {
	const [currentImages, setCurrentImages] = useState<string[]>([]);
	const [positions, setPositions] = useState<Position[]>([]);

	useEffect(() => {
		// Shuffle and select random images for this gallery
		const shuffled = [...images].sort(() => Math.random() - 0.5);
		const selectedImages = shuffled.slice(0, 6); // Reduce to 6 images for better spacing
		setCurrentImages(selectedImages);

		// Generate random positions for each image with collision detection
		setPositions(generateRandomPositions(selectedImages.length, side));
	}, [images, side]);

	if (currentImages.length === 0) return null;

	return (
		<div className={`hidden lg:block absolute inset-0 pointer-events-none`}>
			{currentImages.map((image, index) => {
				const position = positions[index];
				if (!position) return null;

				// Choose animation type based on index for more variety
				const animationTypes = ['gentle-sway', 'float-up', 'float-down'];
				const animationType = animationTypes[index % animationTypes.length];

				return (
					<div
						key={`${image}-${index}`}
						className={`absolute overflow-hidden rounded-xl shadow-lg transform transition-all duration-700 hover:scale-110 hover:shadow-2xl pointer-events-auto animate-${animationType}`}
						style={{
							[side === 'left' ? 'left' : 'right']: `${position.x}%`,
							top: `${position.y}%`,
							width: `${position.size}px`,
							height: `${position.size * 0.8}px`,
							animationDelay: `${position.delay}s`,
							animationDuration: `${position.duration}s`,
							animationIterationCount: 'infinite',
							animationTimingFunction: 'ease-in-out',
							transform: `rotate(${position.rotation}deg)`,
							opacity: 0.8, // Slightly more visible
							zIndex: 1,
							willChange: 'transform', // Optimize for animation
						}}>
						<img
							src={image}
							alt={`Gallery ${index + 1}`}
							className="w-full h-full object-cover transition-all duration-500 hover:scale-105"
							loading="lazy"
							onError={(e) => {
								// Hide broken images
								(e.target as HTMLElement).style.display = 'none';
							}}
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 opacity-60"></div>

						{/* Subtle border glow effect */}
						<div className="absolute inset-0 rounded-xl border border-white/20"></div>
					</div>
				);
			})}
		</div>
	);
}

export default function About() {
	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
	});

	// Fetch library items (photos from Google Drive)
	const { data: libraryItems } = useQuery<LibraryItem[]>({
		queryKey: ['/api/library'],
	});

	// Fetch published articles (for article images)
	const { data: articles } = useQuery<Article[]>({
		queryKey: ['/api/articles'],
	});

	// Combine and process images from both sources
	const galleryImages = React.useMemo(() => {
		const images: string[] = [];

		// Add images from library items (Google Drive photos)
		if (libraryItems) {
			libraryItems.forEach((item) => {
				if (item.type === 'photo' && item.imageUrls) {
					// Convert Google Drive URLs to direct image URLs
					item.imageUrls.forEach((url, index) => {
						if (
							item.imageSources[index] === 'gdrive' &&
							item.gdriveFileIds[index]
						) {
							// Use Google Drive direct image URL
							const directUrl = `https://drive.google.com/uc?export=view&id=${item.gdriveFileIds[index]}`;
							images.push(directUrl);
						} else {
							images.push(url);
						}
					});
				}
			});
		}

		// Add images from published articles
		if (articles) {
			articles.forEach((article) => {
				if (article.published && article.image) {
					if (article.imageSource === 'gdrive' && article.gdriveFileId) {
						// Use Google Drive direct image URL
						const directUrl = `https://drive.google.com/uc?export=view&id=${article.gdriveFileId}`;
						images.push(directUrl);
					} else if (!article.image.includes('default-article-image')) {
						// Only add non-default article images
						images.push(article.image);
					}
				}
			});
		}

		// Shuffle the images array
		return images.sort(() => Math.random() - 0.5);
	}, [libraryItems, articles]);

	return (
		<section
			id="about"
			className="py-16 bg-white relative overflow-hidden">
			{/* Animated Galleries */}
			<AnimatedGallery
				images={galleryImages}
				direction="up"
				side="left"
			/>
			<AnimatedGallery
				images={galleryImages}
				direction="down"
				side="right"
			/>

			<div className="container mx-auto px-4 relative z-10">
				<div
					className="text-center mb-12"
					data-aos="fade-up">
					<h2 className="text-3xl md:text-4xl font-bold text-primary mb-2 tracking-tight">
						Tentang HIMATIF "Encoder"
					</h2>
					<div className="w-24 h-1 bg-primary mx-auto rounded"></div>
				</div>

				<div
					className="max-w-4xl mx-auto text-justify relative" // Back to text-justify
					data-aos="fade-up"
					data-aos-delay="200">
					{settings?.aboutUs ? (
						<div className="prose prose-lg lg:prose-xl prose-slate leading-relaxed space-y-4 bg-white/90 backdrop-blur-sm rounded-lg p-8 shadow-sm mx-auto">
							<div
								dangerouslySetInnerHTML={{ __html: settings.aboutUs }}
								className="text-justify" // Back to justify alignment
							/>
						</div>
					) : (
						<div className="text-center text-gray-500 bg-white/90 backdrop-blur-sm rounded-lg p-8 shadow-sm">
							<div className="text-4xl mb-4">📝</div>
							<p className="text-lg mb-2">
								Informasi tentang himpunan belum tersedia
							</p>
							<p className="text-sm text-gray-400">
								Konten sedang dalam proses pengembangan
							</p>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
