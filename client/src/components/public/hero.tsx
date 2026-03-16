import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LocalBannerFull } from '../LocalAssets';

interface HeroProps {
	scrollToSection: (id: string) => void;
	assetsLoaded?: boolean;
	introKey?: number;
}

interface Settings {
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	navbarBrand: string;
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

interface HomeImagesData {
	year: number;
	isActive: boolean;
	desktopMode: 'bennerfull' | 'combined';
	bennerfull: string;
	orang: string;
	banners: {
		public_relation: string;
		technopreneurship: string;
		intelektual: string;
		wakil_ketua: string;
		ketua: string;
		medinfo: string;
		religius: string;
		senor: string;
	};
}

const DEFAULT_BANNERS = {
	ketua: '/attached_assets/benner/ketua.webp',
	wakil_ketua: '/attached_assets/benner/wakil.webp',
	intelektual: '/attached_assets/benner/intelek.webp',
	public_relation: '/attached_assets/benner/pr.webp',
	technopreneurship: '/attached_assets/benner/techno.webp',
	senor: '/attached_assets/benner/senor.webp',
	medinfo: '/attached_assets/benner/medinfo.webp',
	religius: '/attached_assets/benner/religius.webp',
};

const MOBILE_BANNER_ORDER = [
	'public_relation',
	'technopreneurship',
	'intelektual',
	'wakil_ketua',
	'ketua',
	'medinfo',
	'religius',
	'senor',
] as const;

export default function Hero({
	scrollToSection,
	assetsLoaded = false,
	introKey,
}: HeroProps) {
	const [showText, setShowText] = useState(false);
	const [textMoveUp, setTextMoveUp] = useState(false);
	const [showBanner, setShowBanner] = useState(false);
	const [showPerson, setShowPerson] = useState(false);
	const [currentMobileBanner, setCurrentMobileBanner] = useState(0);
	const [isHeroVisible, setIsHeroVisible] = useState(true);
	// Hanya jalankan animasi hero (banner/orang) saat scroll benar-benar di paling atas
	const [isAtTop, setIsAtTop] = useState(false);
	const hasAnimatedRef = useRef(false);

	// Refs untuk direct DOM manipulation
	const heroRef = useRef<HTMLDivElement>(null);
	const bannerRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLDivElement>(null);
	const personRef = useRef<HTMLDivElement>(null);
	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
	});

	const { data: homeImages } = useQuery<HomeImagesData>({
		queryKey: ['/api/home-images/active'],
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
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
		refetchInterval: 60000,
		refetchOnWindowFocus: false,
		staleTime: 60 * 1000,
		placeholderData: {
			articles: 50,
			libraryItems: 100,
			organizationMembers: 500,
		},
	});

	const desktopMode = homeImages?.desktopMode || 'bennerfull';
	const bennerfullSrc =
		homeImages?.bennerfull || '/attached_assets/general/bennerfull.webp';
	const orangSrc =
		homeImages?.orang || '/attached_assets/general/orang.webp';

	const mobileBanners = useMemo(() => {
		const b = homeImages?.banners;
		return MOBILE_BANNER_ORDER.map(
			(key) => (b && b[key]) || DEFAULT_BANNERS[key],
		);
	}, [homeImages?.banners]);

	const TOP_THRESHOLD = 80;

	// Set isAtTop setelah layout (termasuk scroll ke hash di parent) agar hero tidak animate saat masuk ke section
	useLayoutEffect(() => {
		setIsAtTop(typeof window !== 'undefined' && window.scrollY <= TOP_THRESHOLD);
	}, []);

	// Update isAtTop on scroll agar animasi bisa jalan saat user scroll ke atas
	useEffect(() => {
		const onScroll = () => {
			setIsAtTop(window.scrollY <= TOP_THRESHOLD);
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	// Observe visibility of hero section to pause effects when out of view
	useEffect(() => {
		const node = heroRef.current;
		if (!node) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				setIsHeroVisible(entry?.isIntersecting ?? true);
			},
			{ root: null, threshold: 0, rootMargin: '200px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	// Optimized parallax — semua DOM manipulation langsung via refs, tanpa React state
	useEffect(() => {
		let ticking = false;

		const handleScroll = () => {
			if (!isHeroVisible) return;
			if (!ticking) {
				requestAnimationFrame(() => {
					const scrollY = window.scrollY;

					// Banner - smooth fade
					if (bannerRef.current && showBanner) {
						bannerRef.current.style.opacity = Math.max(
							0,
							1 - scrollY / 1000
						).toString();
					}

					// Text - smooth parallax
					if (textRef.current && showText) {
						textRef.current.style.transform = `translate3d(-50%, ${
							-50 + scrollY * -0.3
						}%, 0)`;
						textRef.current.style.opacity = Math.max(
							0,
							1 - scrollY / 1200
						).toString();
					}

					// Person - fade out only, no parallax movement
					if (personRef.current && showPerson) {
						personRef.current.style.opacity = Math.max(
							0,
							1 - scrollY / 1000
						).toString();
					}

					ticking = false;
				});
				ticking = true;
			}
		};

		if (isHeroVisible) {
			window.addEventListener('scroll', handleScroll, { passive: true });
		}
		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	}, [showBanner, showText, showPerson, isHeroVisible]);

	// Mobile banner rotation
	useEffect(() => {
		const interval = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			setCurrentMobileBanner((prev) => (prev + 1) % mobileBanners.length);
		}, 3000); // Change every 3 seconds

		return () => clearInterval(interval);
	}, [mobileBanners.length]);

	// Reset hasAnimated saat introKey berubah (e.g. navigasi balik ke beranda)
	useEffect(() => {
		hasAnimatedRef.current = false;
	}, [introKey]);

	// Trigger animasi intro hanya saat scroll benar-benar di paling atas (banner/orang tidak jalan di section lain)
	useEffect(() => {
		if (!assetsLoaded || !introKey || !isAtTop) return;
		if (hasAnimatedRef.current) return;

		hasAnimatedRef.current = true;

		// Reset state animasi
		setShowBanner(false);
		setShowPerson(false);
		setShowText(false);
		setTextMoveUp(false);

		// Reset style langsung untuk menghindari sisa opacity/transform
		if (bannerRef.current) {
			bannerRef.current.style.opacity = '0';
		}
		if (textRef.current) {
			textRef.current.style.opacity = '0';
			textRef.current.style.transform = 'translate3d(-50%, -50%, 0)';
		}
		if (personRef.current) {
			personRef.current.style.opacity = '0';
		}

		// Banner muncul duluan sebagai latar
		const bannerTimer = setTimeout(() => {
			setShowBanner(true);
		}, 0);

		// Gambar orang muncul 300ms setelah banner
		const personTimer = setTimeout(() => setShowPerson(true), 300);

		// Text box dan scroll indicator muncul 600ms setelah banner
		const textTimer = setTimeout(() => {
			setShowText(true);
			setTextMoveUp(true);
		}, 600);

		return () => {
			clearTimeout(bannerTimer);
			clearTimeout(personTimer);
			clearTimeout(textTimer);
		};
	}, [assetsLoaded, introKey, isAtTop]);

	return (
		<div
			id="home"
			className="relative w-full overflow-hidden"
			ref={heroRef}>
			{/* Desktop Version - JavaScript Parallax */}
			<div className="hidden lg:block relative w-full h-[200vh]">
				{/* Fixed Banner inside Hero */}
				<div
					ref={bannerRef}
					className="fixed top-0 left-0 w-full h-[400px] z-0 pointer-events-none"
					style={{
						opacity: showBanner ? 1 : 0,
						transition: 'opacity 0.7s ease-out',
						transform: 'translate3d(0, 0, 0)',
						willChange: 'opacity',
						backfaceVisibility: 'hidden',
					}}>
					{desktopMode === 'combined' ? (
						<div className="flex w-full h-full">
							{MOBILE_BANNER_ORDER.map((key) => {
								const b = homeImages?.banners;
								const src = (b && b[key]) || DEFAULT_BANNERS[key];
								return (
									<img
										key={key}
										src={src}
										alt={key}
										className="h-full flex-1 object-cover min-w-0"
										loading="eager"
										decoding="async"
									/>
								);
							})}
						</div>
					) : (
						<LocalBannerFull
							alt="Banner"
							className="w-full h-full object-cover"
							src={bennerfullSrc}
						/>
					)}
					{/* Fog belakang — full height, tipis */}
					<div
						className="absolute bottom-0 w-full h-full pointer-events-none"
						style={{ background: 'var(--gradient-hero-fog)' }}
					/>
				</div>

			{/* Teks tengah */}
		<div
			ref={textRef}
			className="absolute z-[5] text-center bg-white/90 dark:bg-card/80 border border-slate-200/80 dark:border-border/70 backdrop-blur-sm px-8 py-8 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
				style={{
					left: '50%',
					top: textMoveUp ? '35%' : '50%',
					transform: 'translate3d(-50%, -50%, 0)',
					opacity: showText ? 1 : 0,
					transition: 'opacity 0.6s ease-out, top 0.5s ease-out',
					willChange: 'opacity, transform',
					backfaceVisibility: 'hidden',
					minWidth: '340px',
				}}>
			{/* Accent top bar */}
			<div className="mx-auto mb-5 h-px w-20 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

			<h1 className="text-5xl font-bold mb-3 text-foreground drop-shadow-lg">
				{settings?.siteName}
			</h1>
			<h2 className="text-2xl mb-2 text-foreground/80 font-medium drop-shadow-md">
				{settings?.siteTagline}
			</h2>
				<p className="text-base text-muted-foreground max-w-xs mx-auto leading-relaxed">
					{settings?.siteDescription}
				</p>

				{/* Desktop CTA Buttons */}
				<div className="flex items-center justify-center gap-3 mt-6">
					<button
						onClick={() => scrollToSection('about')}
						className="relative overflow-hidden px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 rounded-full font-semibold text-sm shadow-[0_4px_16px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_22px_rgba(245,158,11,0.55)] hover:scale-105 transition-all duration-250">
						<span className="relative z-10">Tentang Kami</span>
					</button>
				<button
					onClick={() => scrollToSection('articles')}
					className="px-5 py-2 border border-blue-400/60 dark:border-cyan-300/50 text-blue-600 dark:text-cyan-200 rounded-full font-medium text-sm hover:bg-blue-50 dark:hover:bg-cyan-400/10 hover:border-blue-500 dark:hover:border-cyan-300/80 hover:scale-105 transition-all duration-250">
					Lihat Artikel
				</button>
				</div>

			{/* Accent bottom bar */}
			<div className="mx-auto mt-5 h-px w-20 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
			</div>

			{/* Desktop scroll indicator */}
			<div
				className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[5] flex flex-col items-center gap-1.5 pointer-events-auto"
				style={{ opacity: showText ? 1 : 0, transition: 'opacity 0.6s ease-out' }}>
			<span className="text-xs text-muted-foreground tracking-widest uppercase">Scroll</span>
			<div className="w-px h-10 bg-gradient-to-b from-primary/60 to-transparent relative overflow-hidden">
				<div
					className="absolute top-0 w-full h-4 bg-primary rounded-full"
					style={{ animation: 'slideDownIndicator 1.8s ease-in-out infinite' }}
				/>
				</div>
			</div>

				{/* Gambar orang - Optimized untuk smooth rendering */}
				<div
					ref={personRef}
					className="fixed top-0 left-0 w-full h-full z-10 pointer-events-none"
					style={{
						transform: 'translate3d(0, 0, 0)',
						opacity: showPerson ? 1 : 0,
						transition: 'opacity 0.7s ease-out',
						willChange: 'opacity',
						backfaceVisibility: 'hidden',
					}}>
					<div style={{ transform: 'translateZ(0)', width: '100%', height: '100%' }}>
						<img
							src={orangSrc}
							alt="Orang"
							className="w-full h-full object-contain"
							loading="eager"
							decoding="async"
							style={{ transform: 'translateZ(0)' }}
						/>
					</div>
					{/* Fog depan — setengah, tebal */}
				<div className="absolute bottom-0 left-0 w-full h-1/2 pointer-events-none"
						style={{ background: 'var(--gradient-hero-fog-front)' }} />
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
							}`}
							style={{
								willChange:
									index === currentMobileBanner ? 'opacity, transform' : 'auto',
								transform: 'translateZ(0)',
							}}>
							<img
								src={banner}
								alt={`Banner ${index + 1}`}
								className="w-full h-full object-cover"
								loading={index === 0 ? 'eager' : 'lazy'}
								decoding="async"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-800/55 to-slate-700/10" />
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
									loading="lazy"
									decoding="async"
								/>
							</div>
						)}

						{/* Main Content */}
						<div className="text-center max-w-lg mx-auto">
							<h1 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">
								<span className="bg-gradient-to-r from-blue-300 via-cyan-200 to-blue-100 bg-clip-text text-transparent drop-shadow-lg">
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
									className="bg-gradient-to-r from-blue-500 to-blue-600 text-slate-950 px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
									Tentang Kami
								</button>
								<button
									onClick={() => scrollToSection('articles')}
									className="border-2 border-blue-200/70 text-blue-100 hover:bg-blue-100 hover:text-slate-900 px-6 py-3 rounded-full font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
									Artikel Terbaru
								</button>
							</div>

							{/* Mobile Stats - Real-time data */}
							<div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
								<div className="text-center p-3 bg-slate-950/35 backdrop-blur-sm rounded-lg shadow-lg border border-blue-300/30">
									<div className="text-xl font-bold text-blue-200 mb-1">
										{stats?.organizationMembers || 500}+
									</div>
									<div className="text-xs text-white/80">Anggota</div>
								</div>
								<div className="text-center p-3 bg-slate-950/35 backdrop-blur-sm rounded-lg shadow-lg border border-blue-300/30">
									<div className="text-xl font-bold text-cyan-200 mb-1">
										{stats?.articles || 50}+
									</div>
									<div className="text-xs text-white/80">Artikel</div>
								</div>
								<div className="text-center p-3 bg-slate-950/35 backdrop-blur-sm rounded-lg shadow-lg border border-blue-300/30">
									<div className="text-xl font-bold text-indigo-200 mb-1">
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
