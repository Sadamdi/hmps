import { AboutVideoEmbed } from '@/components/public/about-video-embed';
import { useRevealAnimation } from '@/hooks/use-reveal-animation';
import { parseGoogleDriveFileId, parseYouTubeVideoId } from '@/lib/youtube-embed';
import { HIMATIF_ABOUT_HTML, HIMATIF_TAGLINE } from '@shared/himatif-defaults';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';

interface Settings {
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	aboutUs: string;
	aboutPageIntro?: string;
	aboutVideoUrl?: string;
	aboutVideoGdriveUrl?: string;
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

interface BeritaItem {
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
		const selectedImages = shuffled.slice(0, typeof window !== 'undefined' && window.innerWidth < 1024 ? 4 : 6);
		setCurrentImages(selectedImages);

		// Generate random positions for each image with collision detection
		setPositions(generateRandomPositions(selectedImages.length, side));
	}, [images, side]);

	if (currentImages.length === 0) return null;

	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden">
			{currentImages.map((image, index) => {
				const position = positions[index];
				if (!position) return null;

				// Choose animation type based on index for more variety
				const animationTypes = ['gentle-sway', 'float-up', 'float-down'];
				const animationType = animationTypes[index % animationTypes.length];

				const sizeScale =
					typeof window !== 'undefined' && window.innerWidth < 1024 ? 0.38 : 1;
				const mobileOpacity =
					typeof window !== 'undefined' && window.innerWidth < 1024 ? 0.35 : 0.8;

				return (
					<div
						key={`${image}-${index}`}
						className={`absolute overflow-hidden rounded-xl shadow-lg transform transition-all duration-700 hover:scale-110 hover:shadow-2xl pointer-events-auto animate-${animationType} max-lg:opacity-40 max-lg:pointer-events-none`}
						style={{
							[side === 'left' ? 'left' : 'right']: `${position.x}%`,
							top: `${position.y}%`,
							width: `${position.size * sizeScale}px`,
							height: `${position.size * sizeScale * 0.8}px`,
							animationDelay: `${position.delay}s`,
							animationDuration: `${position.duration}s`,
							animationIterationCount: 'infinite',
							animationTimingFunction: 'ease-in-out',
							transform: `rotate(${position.rotation}deg)`,
							opacity: mobileOpacity,
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
	const { ref: headingRef, isVisible: headingVisible } = useRevealAnimation();
	const [aboutExpanded, setAboutExpanded] = useState(false);

	const { data: libraryItems } = useQuery<LibraryItem[]>({
		queryKey: ['/api/library'],
	});

	const { data: beritaItems } = useQuery<BeritaItem[]>({
		queryKey: ['/api/berita'],
	});

	const hasAboutVideo =
		!!parseYouTubeVideoId(settings?.aboutVideoUrl || '') ||
		!!parseGoogleDriveFileId(settings?.aboutVideoGdriveUrl || '');
	const aboutHtml =
		String(settings?.aboutUs || '').trim() ||
		String(settings?.aboutPageIntro || '').trim() ||
		HIMATIF_ABOUT_HTML;
	const aboutTagline = String(settings?.siteTagline || '').trim() || HIMATIF_TAGLINE;

	const galleryImages = React.useMemo(() => {
		const images: string[] = [];

		if (libraryItems) {
			libraryItems.forEach((item) => {
				if (item.type === 'photo' && item.imageUrls) {
					item.imageUrls.forEach((url, index) => {
						if (
							item.imageSources[index] === 'gdrive' &&
							item.gdriveFileIds[index]
						) {
							images.push(
								`https://drive.google.com/uc?export=view&id=${item.gdriveFileIds[index]}`,
							);
						} else {
							images.push(url);
						}
					});
				}
			});
		}

		if (beritaItems) {
			beritaItems.forEach((item) => {
				if (item.published && item.image) {
					if (item.imageSource === 'gdrive' && item.gdriveFileId) {
						images.push(
							`https://drive.google.com/uc?export=view&id=${item.gdriveFileId}`,
						);
					} else if (!item.image.includes('default-berita-image')) {
						images.push(item.image);
					}
				}
			});
		}

		return images.sort(() => Math.random() - 0.5);
	}, [libraryItems, beritaItems]);

	return (
		<section
			id="about"
			className="py-12 sm:py-16 bg-background section-tint-bg relative overflow-hidden">
			<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
			<AnimatedGallery images={galleryImages} direction="up" side="left" />
			<AnimatedGallery images={galleryImages} direction="down" side="right" />

			<div className="container mx-auto px-4 relative z-10">
				<div ref={headingRef} className="text-center mb-8 sm:mb-12">
					<span
						className={`inline-block px-3 py-1 mb-3 sm:mb-4 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase ${headingVisible ? 'reveal-heading' : 'opacity-0'}`}>
						Tentang Kami
					</span>
					<h1
						className={`text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight ${headingVisible ? 'reveal-heading reveal-heading-delay-1' : 'opacity-0'}`}>
						{settings?.siteName || 'Himatif Encoder'}
					</h1>
					<p
						className={`text-sm sm:text-base text-muted-foreground mb-4 sm:mb-5 max-w-xl mx-auto ${headingVisible ? 'reveal-heading reveal-heading-delay-2' : 'opacity-0'}`}>
						{aboutTagline}
					</p>
					<div className="mx-auto w-32 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
				</div>

				<AboutVideoEmbed
					aboutVideoUrl={settings?.aboutVideoUrl}
					aboutVideoGdriveUrl={settings?.aboutVideoGdriveUrl}
					aosDelay={180}
				/>

				<div className="max-w-3xl mx-auto relative mt-4 sm:mt-8">
					{aboutHtml ? (
						<div className="space-y-4">
							{/* Mobile: teks penuh. Desktop: clamp + Baca di sini */}
							<div className="relative bg-card/95 backdrop-blur-sm border border-border/70 rounded-xl p-5 sm:p-8 shadow-md max-lg:shadow-lg">
								<div
									className={`prose prose-sm sm:prose-lg max-w-none leading-relaxed text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground ${
										aboutExpanded
											? ''
											: 'sm:max-h-[14rem] sm:overflow-hidden'
									}`}>
									<div
										dangerouslySetInnerHTML={{ __html: aboutHtml }}
										className="text-left sm:text-justify"
									/>
								</div>
								{!aboutExpanded && (
									<div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-xl bg-gradient-to-t from-card via-card/95 to-transparent hidden sm:block" />
								)}
							</div>
							<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
								<button
									type="button"
									onClick={() => setAboutExpanded((v) => !v)}
									className="hidden sm:inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold border border-border text-foreground hover:bg-secondary transition-colors">
									{aboutExpanded ? 'Ringkas' : 'Baca di sini'}
								</button>
								<Link href="/profil">
									<button
										type="button"
										className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold border-2 border-primary/50 text-primary hover:bg-primary/10 transition-colors">
										Halaman profil
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
										</svg>
									</button>
								</Link>
							</div>
						</div>
					) : hasAboutVideo ? (
						<div className="flex justify-center mt-2">
							<Link href="/profil">
								<button
									type="button"
									className="inline-flex min-h-11 items-center gap-2 px-6 py-3 rounded-lg font-semibold border-2 border-primary/50 text-primary hover:bg-primary/10 transition-colors">
									Halaman profil
								</button>
							</Link>
						</div>
					) : null}
				</div>
			</div>
			<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
		</section>
	);
}
