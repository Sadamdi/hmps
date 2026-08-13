import { AboutVideoEmbed } from '@/components/public/about-video-embed';
import { PublicSectionHeader } from '@/components/public/section-header';
import { useRevealAnimation } from '@/hooks/use-reveal-animation';
import { parseGoogleDriveFileId, parseYouTubeVideoId } from '@/lib/youtube-embed';
import { HIMATIF_ABOUT_HTML, HIMATIF_TAGLINE } from '@shared/himatif-defaults';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import React, { useEffect, useState } from 'react';
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
	side: 'left' | 'right',
	isMobile: boolean,
): Position[] => {
	const positions: Position[] = [];
	// Mobile: sebarkan ke setengah layar (bukan cuma pinggir 12%) agar terlihat di belakang card
	const baseX = isMobile ? 2 : 1;
	const maxX = isMobile ? 46 : 12;
	const minDistance = isMobile ? 12 : 10;

	const sizeCategories = isMobile
		? [
				{ min: 72, max: 96 },
				{ min: 100, max: 128 },
				{ min: 132, max: 168 },
			]
		: [
				{ min: 50, max: 70 },
				{ min: 80, max: 100 },
				{ min: 110, max: 140 },
				{ min: 150, max: 180 },
				{ min: 190, max: 220 },
			];

	const isOverlapping = (pos1: Position, pos2: Position) => {
		const distance = Math.sqrt(
			Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2),
		);
		return distance < minDistance;
	};

	for (let i = 0; i < count; i++) {
		let attempts = 0;
		let newPosition: Position;
		// Slot vertikal merata biar tidak numpuk di area judul/video saja
		const t = count <= 1 ? 0.45 : i / (count - 1);
		const slotY = isMobile ? 6 + t * 86 : 12.5 + t * 70;

		do {
			const sizeCategory =
				sizeCategories[Math.floor(Math.random() * sizeCategories.length)];
			const size =
				Math.random() * (sizeCategory.max - sizeCategory.min) +
				sizeCategory.min;

			newPosition = {
				x: Math.random() * (maxX - baseX) + baseX,
				y: slotY + (Math.random() * 5 - 2.5),
				delay: Math.random() * 6,
				size,
				rotation: Math.random() * 8 - 4,
				duration: Math.random() * 6 + 10,
			};

			attempts++;
		} while (
			attempts < 50 &&
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
		const isMobile =
			typeof window !== 'undefined' && window.innerWidth < 1024;
		const shuffled = [...images].sort(() => Math.random() - 0.5);
		// Mobile: lebih banyak per sisi agar terasa “menyebar” seperti desktop
		const selectedImages = shuffled.slice(0, isMobile ? 6 : 6);
		setCurrentImages(selectedImages);
		setPositions(generateRandomPositions(selectedImages.length, side, isMobile));
	}, [images, side]);

	if (currentImages.length === 0) return null;

	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden">
			{currentImages.map((image, index) => {
				const position = positions[index];
				if (!position) return null;

				const animationTypes = ['gentle-sway', 'float-up', 'float-down'];
				const animationType = animationTypes[index % animationTypes.length];
				const isMobile =
					typeof window !== 'undefined' && window.innerWidth < 1024;
				const sizeScale = isMobile ? 0.62 : 1;
				const layerOpacity = isMobile ? 0.58 : 0.8;

				return (
					<div
						key={`${image}-${index}`}
						className={`absolute overflow-hidden rounded-xl shadow-lg transform transition-all duration-700 hover:scale-110 hover:shadow-2xl pointer-events-auto animate-${animationType} max-lg:pointer-events-none`}
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
							opacity: layerOpacity,
							zIndex: 1,
							willChange: 'transform',
						}}>
						<img
							src={image}
							alt={`Gallery ${index + 1}`}
							className="w-full h-full object-cover transition-all duration-500 hover:scale-105"
							loading="lazy"
							onError={(e) => {
								(e.target as HTMLElement).style.display = 'none';
							}}
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 opacity-60"></div>
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
				<PublicSectionHeader
					headingRef={headingRef}
					visible={headingVisible}
					eyebrow="Tentang Kami"
					icon={<Info />}
					title={settings?.siteName || 'Himatif Encoder'}
					description={aboutTagline}
				/>

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
