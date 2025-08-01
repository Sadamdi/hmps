import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { LocalBannerFull, LocalOrang } from '../LocalAssets';

interface HeroProps {
	scrollToSection: (id: string) => void;
	assetsLoaded?: boolean;
}

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
	logoUrl: string;
	divisionLogos: Record<string, string>;
	divisionColors: Record<string, string>;
	socialLinks: Record<string, string>;
	divisionNames: Record<string, string>;
	chairpersonName: string;
	chairpersonPhoto: string;
	chairpersonTitle: string;
	viceChairpersonName: string;
	viceChairpersonPhoto: string;
	viceChairpersonTitle: string;
	divisionHeads: {
		[key: string]: {
			name: string;
			photo: string;
		};
	};
}

export default function Hero({
	scrollToSection,
	assetsLoaded = false,
}: HeroProps) {
	const [scrollY, setScrollY] = useState(0);
	const [smoothScrollY, setSmoothScrollY] = useState(0);
	const [showText, setShowText] = useState(false);
	const [textMoveUp, setTextMoveUp] = useState(false);
	const [showBanner, setShowBanner] = useState(false);
	const [showPerson, setShowPerson] = useState(false);
	const [currentMobileBanner, setCurrentMobileBanner] = useState(0);

	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		staleTime: 1000,
		refetchOnWindowFocus: true,
	});

	// Get real-time stats for mobile stats section
	const { data: stats } = useQuery({
		queryKey: ['/api/stats'],
		queryFn: async () => {
			const response = await fetch('/api/stats');
			if (!response.ok) throw new Error('Failed to fetch stats');
			return response.json() as Promise<{
				articles: number;
				libraryItems: number;
				organizationMembers: number;
			}>;
		},
		// Refresh every 30 seconds for public stats
		refetchInterval: 30000,
		refetchOnWindowFocus: true,
		staleTime: 10000,
		// Default fallback data
		placeholderData: {
			articles: 50,
			libraryItems: 100,
			organizationMembers: 500,
		},
	});

	// Mobile banner images from benner folder
	const mobileBanners = [
		'/attached_assets/benner/ketua.jpg',
		'/attached_assets/benner/wakil.jpg',
		'/attached_assets/benner/intelek.jpg',
		'/attached_assets/benner/pr.jpg',
		'/attached_assets/benner/techno.jpg',
		'/attached_assets/benner/senor.jpg',
		'/attached_assets/benner/medinfo.jpg',
		'/attached_assets/benner/religius.jpg',
	];

	useEffect(() => {
		let ticking = false;
		let lastScrollY = 0;

		const handleScroll = () => {
			lastScrollY = window.scrollY;

			if (!ticking) {
				requestAnimationFrame(() => {
					setScrollY(lastScrollY);
					ticking = false;
				});
				ticking = true;
			}
		};

		// Smooth scroll update dengan delay untuk 144fps
		const smoothScrollUpdate = () => {
			setSmoothScrollY((prev) => {
				const diff = scrollY - prev;
				const step = diff * 0.15; // Smoothing factor lebih agresif untuk 144fps
				return prev + step;
			});
		};

		const smoothTimer = setInterval(smoothScrollUpdate, 7); // ~144fps (1000ms / 144 ≈ 7ms)

		window.addEventListener('scroll', handleScroll, { passive: true });

		return () => {
			window.removeEventListener('scroll', handleScroll);
			clearInterval(smoothTimer);
		};
	}, [scrollY]);

	// Mobile banner rotation
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentMobileBanner((prev) => (prev + 1) % mobileBanners.length);
		}, 3000); // Change every 3 seconds

		return () => clearInterval(interval);
	}, [mobileBanners.length]);

	useEffect(() => {
		// Trigger semua animasi langsung saat assets loaded (tanpa delay)
		if (assetsLoaded) {
			setShowText(true);
			setShowBanner(true);
			setShowPerson(true);
			setTextMoveUp(true);
		}
	}, [assetsLoaded]);

	const getParallaxStyle = (ratio: number) => ({
		transform: `translate3d(0, ${smoothScrollY * ratio}px, 0)`,
		willChange: 'transform',
		backfaceVisibility: 'hidden' as const,
		perspective: 1000,
	});

	// Scroll limit where we start hiding banner - lebih besar agar teks bertahan lebih lama
	const fadeOutThreshold = 800;
	const textFadeOutThreshold = 1000; // Teks hilang lebih lambat dari gambar
	const opacityValue = Math.max(0, 1 - smoothScrollY / fadeOutThreshold);
	const textOpacityValue = Math.max(
		0,
		1 - smoothScrollY / textFadeOutThreshold
	);

	return (
		<div
			id="home"
			className="relative w-full overflow-hidden">
			{/* Desktop Version - Original Design */}
			<div className="hidden lg:block relative w-full h-[200vh]">
				{/* Fixed Banner inside Hero */}
				<div
					className={`fixed top-0 left-0 w-full h-[400px] z-0 pointer-events-none transition-opacity duration-800 ease-out hardware-accelerated ${
						showBanner ? 'opacity-100' : 'opacity-0'
					}`}
					style={{
						opacity: showBanner ? opacityValue : 0,
						willChange: 'opacity',
					}}>
					<LocalBannerFull
						alt="Banner"
						className="w-full h-full object-cover"
					/>
					<div className="absolute bottom-0 w-full h-full bg-gradient-to-t from-white via-white/70 to-transparent" />
				</div>

				{/* Teks tengah */}
				<div
					className={`absolute left-1/2 z-[5] text-center bg-white/80 backdrop-blur-sm px-6 py-8 rounded-lg shadow-lg transition-opacity duration-800 ease-out scroll-optimized ${
						showText ? 'opacity-100' : 'opacity-0'
					}`}
					style={{
						...getParallaxStyle(-0.6),
						transform: `translate3d(-50%, ${
							textMoveUp
								? -100 + smoothScrollY * -0.6
								: -50 + smoothScrollY * -0.6
						}%, 0)`,
						left: '50%',
						top: textMoveUp ? '35%' : '50%',
						opacity: showText ? textOpacityValue : 0,
						transition: 'opacity 0.8s ease-out',
						willChange: 'opacity, transform',
						backfaceVisibility: 'hidden' as const,
						perspective: 1000,
					}}>
					<h1 className="text-5xl font-bold mb-3 text-gray-800">
						{settings?.siteName}
					</h1>
					<h2 className="text-3xl mb-2 text-gray-700">
						{settings?.siteTagline}
					</h2>
					<p className="text-lg text-gray-600">{settings?.siteDescription}</p>
				</div>

				{/* Gambar orang */}
				<div
					className={`fixed top-0 left-0 w-full h-full z-10 pointer-events-none transition-opacity duration-800 ease-out hardware-accelerated ${
						showPerson ? 'opacity-100' : 'opacity-0'
					}`}
					style={{
						...getParallaxStyle(0.4),
						opacity: showPerson ? opacityValue : 0,
						willChange: 'opacity, transform',
						backfaceVisibility: 'hidden' as const,
						perspective: 1000,
					}}>
					<LocalOrang
						alt="Orang"
						className="w-full h-full object-contain"
					/>
					<div className="absolute bottom-0 left-0 w-full h-1/2 bg-[linear-gradient(to_top,_rgba(255,255,255,1)_0%,_rgba(255,255,255,1)_30%,_rgba(255,255,255,0)_100%)]" />
				</div>
			</div>

			{/* Mobile Version - New Design */}
			<div className="lg:hidden relative w-full h-screen overflow-hidden">
				{/* Mobile Banner Slideshow - Full Screen */}
				<div className="relative h-screen overflow-hidden">
					{mobileBanners.map((banner, index) => (
						<div
							key={index}
							className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
								index === currentMobileBanner
									? 'opacity-100 scale-100'
									: 'opacity-0 scale-105'
							}`}>
							<img
								src={banner}
								alt={`Banner ${index + 1}`}
								className="w-full h-full object-cover"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
						</div>
					))}

					{/* Mobile Content Overlay */}
					<div className="absolute inset-0 flex flex-col justify-center items-center px-4 text-white z-10">
						{/* Logo */}
						{settings?.logoUrl && (
							<div className="mb-6">
								<img
									src={settings.logoUrl}
									alt="Logo"
									className="h-16 w-auto drop-shadow-2xl"
								/>
							</div>
						)}

						{/* Main Content */}
						<div className="text-center max-w-lg mx-auto">
							<h1 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">
								<span className="bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent drop-shadow-lg">
									{settings?.siteName || 'HIMATIF ENCODER'}
								</span>
							</h1>

							<h2 className="text-lg sm:text-xl mb-4 font-medium text-white/90 drop-shadow-lg">
								{settings?.siteTagline ||
									'Himpunan Mahasiswa Teknik Informatika'}
							</h2>

							<p className="text-sm sm:text-base mb-8 leading-relaxed text-white/80 drop-shadow-lg">
								{settings?.siteDescription ||
									'Platform resmi informasi dan komunikasi mahasiswa Teknik Informatika UIN Malang'}
							</p>

							{/* Mobile CTA Buttons */}
							<div className="flex flex-col gap-3 mb-8">
								<button
									onClick={() => scrollToSection('about')}
									className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-full font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 backdrop-blur-sm">
									Tentang Kami
								</button>
								<button
									onClick={() => scrollToSection('articles')}
									className="border-2 border-white/80 text-white hover:bg-white hover:text-gray-800 px-6 py-3 rounded-full font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 backdrop-blur-sm">
									Artikel Terbaru
								</button>
							</div>

							{/* Mobile Stats - Real-time data */}
							<div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
								<div className="text-center p-3 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg border border-white/30">
									<div className="text-xl font-bold text-blue-300 mb-1">
										{stats?.organizationMembers || 500}+
									</div>
									<div className="text-xs text-white/80">Anggota</div>
								</div>
								<div className="text-center p-3 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg border border-white/30">
									<div className="text-xl font-bold text-purple-300 mb-1">
										{stats?.articles || 50}+
									</div>
									<div className="text-xs text-white/80">Artikel</div>
								</div>
								<div className="text-center p-3 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg border border-white/30">
									<div className="text-xl font-bold text-green-300 mb-1">
										{stats?.libraryItems || 100}+
									</div>
									<div className="text-xs text-white/80">Media</div>
								</div>
							</div>
						</div>
					</div>

					{/* Banner Indicators */}
					<div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
						{mobileBanners.map((_, index) => (
							<button
								key={index}
								onClick={() => setCurrentMobileBanner(index)}
								className={`w-3 h-3 rounded-full transition-all duration-300 ${
									index === currentMobileBanner
										? 'bg-white scale-125 shadow-lg'
										: 'bg-white/50 hover:bg-white/70'
								}`}
							/>
						))}
					</div>

					{/* Mobile Scroll Indicator */}
					<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center z-20">
						<button
							onClick={() => scrollToSection('about')}
							className="flex flex-col items-center text-white/80 hover:text-white transition-colors duration-300">
							<span className="text-xs mb-1 drop-shadow-lg">Scroll</span>
							<div className="w-1 h-8 bg-white/30 rounded-full overflow-hidden">
								<div className="w-full h-2 bg-white rounded-full animate-bounce"></div>
							</div>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
