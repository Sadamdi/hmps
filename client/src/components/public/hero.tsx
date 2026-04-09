import { DEFAULT_IMAGE_URL } from '@/constants/default-image';
import { useTenant } from '@/lib/tenant-context';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
	COMBINED_SLOT_TRANSITION_MS,
	HeroBannerContent,
	HeroDesktopText,
	HeroMobileSlideshow,
	HeroPersonContent,
	HeroScrollIndicator,
	homeImageVersionSuffix,
	useHeroPreviewOverrides,
	versionHomeImageUrls,
} from './hero-renderer';

interface HeroProps {
	scrollToSection: (id: string) => void;
	assetsLoaded?: boolean;
	introKey?: number;
	/** Dipanggil setelah animasi intro desktop selesai (sinkron dengan durasi combined / classic). */
	onIntroSettled?: () => void;
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
	desktopBannerSource?: 'classic' | 'fullBackground';
	bennerfull: string;
	orang: string;
	desktopBackground?: string;
	banners: Record<string, string>;
	people?: Record<string, string>;
	updatedAt?: string;
}

interface BannerSlotDef {
	id: string;
	label: string;
	order: number;
}

const DEFAULT_BANNERS: Record<string, string> = {
	ketua: DEFAULT_IMAGE_URL,
	wakil_ketua: DEFAULT_IMAGE_URL,
	intelektual: DEFAULT_IMAGE_URL,
	public_relation: DEFAULT_IMAGE_URL,
	technopreneurship: DEFAULT_IMAGE_URL,
	senor: DEFAULT_IMAGE_URL,
	medinfo: DEFAULT_IMAGE_URL,
	religius: DEFAULT_IMAGE_URL,
};

const DEFAULT_SLOT_ORDER = [
	'public_relation',
	'technopreneurship',
	'intelektual',
	'wakil_ketua',
	'ketua',
	'medinfo',
	'religius',
	'senor',
];

export default function Hero({
	scrollToSection,
	assetsLoaded = false,
	introKey,
	onIntroSettled,
}: HeroProps) {
	const { isTenant } = useTenant();
	const [showText, setShowText] = useState(false);
	const [textMoveUp, setTextMoveUp] = useState(false);
	const [showBanner, setShowBanner] = useState(false);
	const [showPerson, setShowPerson] = useState(false);
	const [isHeroVisible, setIsHeroVisible] = useState(true);
	const [combinedAssetsReady, setCombinedAssetsReady] = useState(false);
	const [combinedIntroStarted, setCombinedIntroStarted] = useState(false);
	const [combinedIntroWaveIndex, setCombinedIntroWaveIndex] = useState(-1);
	const combinedRafRef = useRef(0);
	const preloadCacheRef = useRef(new Set<string>());
	// Hanya jalankan animasi hero (banner/orang) saat scroll benar-benar di paling atas
	const [isAtTop, setIsAtTop] = useState(false);
	const hasAnimatedRef = useRef(false);

	// Refs untuk direct DOM manipulation
	const heroRef = useRef<HTMLDivElement>(null);
	const bannerRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLDivElement>(null);
	const personRef = useRef<HTMLDivElement>(null);
	const previewOverrides = useHeroPreviewOverrides();
	const isPreview = !!previewOverrides;

	const { data: _settings } = useQuery<
		Settings & { homeImageBannerSlots?: BannerSlotDef[] }
	>({
		queryKey: ['/api/settings'],
		staleTime: 30 * 1000,
		refetchOnWindowFocus: false,
		refetchOnMount: 'always',
		enabled: !isPreview,
	});

	const { data: _homeImages } = useQuery<HomeImagesData>({
		queryKey: ['/api/home-images/active'],
		staleTime: 30 * 1000,
		refetchOnWindowFocus: false,
		refetchOnMount: 'always',
		enabled: !isPreview,
	});

	const settings = useMemo(() => {
		if (!previewOverrides?.settings) return _settings;
		return { ..._settings, ...previewOverrides.settings } as typeof _settings;
	}, [_settings, previewOverrides?.settings]);

	const homeImages = useMemo(() => {
		if (!previewOverrides?.homeImages) return _homeImages;
		return {
			..._homeImages,
			...previewOverrides.homeImages,
		} as typeof _homeImages;
	}, [_homeImages, previewOverrides?.homeImages]);

	const { data: stats } = useQuery({
		queryKey: ['/api/stats'],
		queryFn: async () => {
			const response = await fetch('/api/stats');
			if (!response.ok) throw new Error('Failed to fetch stats');
			return response.json() as Promise<{
				berita: number;
				libraryItems: number;
				organizationMembers: number;
			}>;
		},
		refetchInterval: 60000,
		refetchOnWindowFocus: false,
		staleTime: 60 * 1000,
		placeholderData: {
			berita: 50,
			libraryItems: 100,
			organizationMembers: 500,
		},
	});

	const slotOrder = useMemo(() => {
		const dynSlots = settings?.homeImageBannerSlots;
		if (dynSlots && dynSlots.length > 0) {
			return [...dynSlots].sort((a, b) => a.order - b.order).map((s) => s.id);
		}
		return DEFAULT_SLOT_ORDER;
	}, [settings?.homeImageBannerSlots]);

	const desktopMode = homeImages?.desktopMode || 'bennerfull';
	const desktopBannerSource = homeImages?.desktopBannerSource || 'classic';
	const enableCommunityCombinedFx = isTenant && desktopMode === 'combined';

	const versionSuffix = homeImageVersionSuffix(homeImages?.updatedAt);
	const bennerfullSrc =
		(homeImages?.bennerfull || DEFAULT_IMAGE_URL) + versionSuffix;
	const orangSrc = (homeImages?.orang || DEFAULT_IMAGE_URL) + versionSuffix;
	const desktopBackgroundSrc = homeImages?.desktopBackground
		? homeImages.desktopBackground + versionSuffix
		: '';

	const versionedBanners = useMemo(
		() => versionHomeImageUrls(homeImages?.banners || {}, versionSuffix),
		[homeImages?.banners, versionSuffix],
	);

	const versionedPeople = useMemo(
		() => versionHomeImageUrls(homeImages?.people || {}, versionSuffix),
		[homeImages?.people, versionSuffix],
	);

	const dataReady = !!homeImages;

	const combinedAssetUrls = useMemo(() => {
		if (desktopMode !== 'combined') return [];
		const urls: string[] = [];
		for (const key of slotOrder) {
			const b = versionedBanners[key] || DEFAULT_BANNERS[key] || '';
			const p = versionedPeople[key] || '';
			if (b) urls.push(b);
			if (p) urls.push(p);
		}
		return Array.from(new Set(urls));
	}, [desktopMode, slotOrder, versionedBanners, versionedPeople]);

	const TOP_THRESHOLD = 80;

	// Set isAtTop setelah layout (termasuk scroll ke hash di parent) agar hero tidak animate saat masuk ke section
	useLayoutEffect(() => {
		setIsAtTop(
			typeof window !== 'undefined' && window.scrollY <= TOP_THRESHOLD,
		);
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
			{ root: null, threshold: 0, rootMargin: '200px' },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	// Preload semua asset combined; cached agar URL yang sudah dimuat
	// tidak di-fetch ulang saat dependency berubah reference.
	useEffect(() => {
		let cancelled = false;
		if (desktopMode !== 'combined') {
			setCombinedAssetsReady(true);
			return;
		}
		if (combinedAssetUrls.length === 0) {
			setCombinedAssetsReady(true);
			return;
		}

		const uncached = combinedAssetUrls.filter(
			(u) => !preloadCacheRef.current.has(u),
		);
		if (uncached.length === 0) {
			setCombinedAssetsReady(true);
			return;
		}

		setCombinedAssetsReady(false);
		const preloadOne = (src: string) =>
			new Promise<void>((resolve) => {
				const img = new Image();
				img.onload = async () => {
					// Ensure browser has decoded the bitmap, not just fetched bytes.
					try {
						await img.decode();
					} catch {
						// ignore decode errors; onload already means image is usable
					}
					preloadCacheRef.current.add(src);
					resolve();
				};
				img.onerror = () => {
					preloadCacheRef.current.add(src);
					resolve();
				};
				img.src = src;
			});

		Promise.all(uncached.map(preloadOne)).then(() => {
			if (!cancelled) setCombinedAssetsReady(true);
		});

		return () => {
			cancelled = true;
		};
	}, [desktopMode, combinedAssetUrls]);

	// After containers become visible, wait for browser to paint items in hidden+offset
	// state, then flip combinedIntroStarted to kick off per-item CSS transitions.
	useEffect(() => {
		if (desktopMode !== 'combined' || !showBanner || !showPerson) {
			setCombinedIntroStarted(false);
			setCombinedIntroWaveIndex(-1);
			return;
		}
		const maxWave = Math.floor((slotOrder.length - 1) / 2);
		const raf1 = requestAnimationFrame(() => {
			combinedRafRef.current = requestAnimationFrame(() => {
				setCombinedIntroStarted(true);
				// Experiment mode: all pairs animate together in one wave.
				setCombinedIntroWaveIndex(maxWave);
			});
		});
		return () => {
			cancelAnimationFrame(raf1);
			cancelAnimationFrame(combinedRafRef.current);
		};
	}, [desktopMode, showBanner, showPerson, slotOrder.length]);

	// Setelah intro combined paralel selesai (bukan combinedIntroDurationMs berjenjang — itu bikin timer ~12s vs CSS 3s).
	useEffect(() => {
		if (!onIntroSettled) return;
		if (desktopMode !== 'combined') return;
		if (!combinedIntroStarted) return;
		const textDelay = 80 + COMBINED_SLOT_TRANSITION_MS + 100;
		const ms = Math.max(0, textDelay - 40) + 600 + 60;
		const t = setTimeout(() => onIntroSettled(), ms);
		return () => clearTimeout(t);
	}, [desktopMode, combinedIntroStarted, onIntroSettled]);

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
							1 - scrollY / 1000,
						).toString();
					}

					// Text - smooth parallax
					if (textRef.current && showText) {
						textRef.current.style.transform = `translate3d(-50%, ${
							-50 + scrollY * -0.3
						}%, 0)`;
						textRef.current.style.opacity = Math.max(
							0,
							1 - scrollY / 1200,
						).toString();
					}

					// Person - fade out only, no parallax movement
					if (personRef.current && showPerson) {
						personRef.current.style.opacity = Math.max(
							0,
							1 - scrollY / 1000,
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

	// Reset hasAnimated saat introKey berubah (e.g. navigasi balik ke beranda)
	useEffect(() => {
		hasAnimatedRef.current = false;
	}, [introKey]);

	// Trigger animasi intro hanya saat data sudah ready dan scroll di paling atas
	useEffect(() => {
		if (!assetsLoaded || !introKey || !isAtTop || !dataReady) return;
		if (desktopMode === 'combined' && !combinedAssetsReady) return;
		if (hasAnimatedRef.current) return;

		hasAnimatedRef.current = true;

		// Reset state animasi
		setShowBanner(false);
		setShowPerson(false);
		setShowText(false);
		setTextMoveUp(false);
		setCombinedIntroStarted(false);
		setCombinedIntroWaveIndex(-1);

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

		const isCombinedMode = desktopMode === 'combined';

		if (isCombinedMode) {
			const t0 = setTimeout(() => {
				setShowBanner(true);
				setShowPerson(true);
			}, 0);
			const textDelay = 80 + COMBINED_SLOT_TRANSITION_MS + 100;
			const t1 = setTimeout(() => {
				setShowText(true);
				setTextMoveUp(true);
			}, textDelay);
			return () => {
				clearTimeout(t0);
				clearTimeout(t1);
			};
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

		let settledTimer: ReturnType<typeof setTimeout> | undefined;
		if (onIntroSettled) {
			// Cukup untuk opacity 0.7s + jeda teks 600ms + transisi teks 0.6s
			settledTimer = setTimeout(() => onIntroSettled(), 1500);
		}

		return () => {
			clearTimeout(bannerTimer);
			clearTimeout(personTimer);
			clearTimeout(textTimer);
			if (settledTimer) clearTimeout(settledTimer);
		};
	}, [
		assetsLoaded,
		introKey,
		isAtTop,
		dataReady,
		desktopMode,
		combinedAssetsReady,
		slotOrder.length,
		onIntroSettled,
	]);

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
					className={`fixed top-0 left-0 w-full z-0 pointer-events-none ${desktopBannerSource === 'fullBackground' && desktopMode === 'bennerfull' ? 'h-screen' : 'h-[400px]'}`}
					style={{
						opacity: showBanner ? 1 : 0,
						transition:
							desktopMode === 'combined' ? 'none' : 'opacity 0.7s ease-out',
						transform: 'translate3d(0, 0, 0)',
						willChange: 'opacity',
						backfaceVisibility: 'hidden',
					}}>
					<HeroBannerContent
						desktopMode={desktopMode}
						desktopBannerSource={desktopBannerSource}
						slotOrder={slotOrder}
						banners={versionedBanners}
						bennerfullSrc={bennerfullSrc}
						desktopBackgroundSrc={desktopBackgroundSrc}
						enableCommunityCombinedFx={enableCommunityCombinedFx}
						combinedIntroActive={combinedIntroStarted}
						combinedIntroWaveIndex={combinedIntroWaveIndex}
					/>
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
					<HeroDesktopText
						siteName={settings?.siteName || ''}
						siteTagline={settings?.siteTagline || ''}
						siteDescription={settings?.siteDescription || ''}
						onScrollTo={scrollToSection}
					/>
				</div>

				{/* Desktop scroll indicator */}
				<div
					className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[5]"
					style={{
						opacity: showText ? 1 : 0,
						transition: 'opacity 0.6s ease-out',
					}}>
					<HeroScrollIndicator onScrollTo={scrollToSection} />
				</div>

				{/* Gambar orang - single or composed per-slot */}
				<div
					ref={personRef}
					className="fixed top-0 left-0 w-full h-full z-10 pointer-events-none"
					style={{
						transform: 'translate3d(0, 0, 0)',
						opacity: showPerson ? 1 : 0,
						transition:
							desktopMode === 'combined' ? 'none' : 'opacity 0.7s ease-out',
						willChange: 'opacity',
						backfaceVisibility: 'hidden',
					}}>
					<div
						style={{
							transform: 'translateZ(0)',
							width: '100%',
							height: '100%',
						}}>
						<HeroPersonContent
							desktopMode={desktopMode}
							desktopBannerSource={desktopBannerSource}
							slotOrder={slotOrder}
							people={versionedPeople}
							orangSrc={orangSrc}
							combinedIntroActive={combinedIntroStarted}
							combinedIntroWaveIndex={combinedIntroWaveIndex}
						/>
					</div>
					{/* Fog depan — setengah, tebal */}
					<div
						className="absolute bottom-0 left-0 w-full h-1/2 pointer-events-none"
						style={{ background: 'var(--gradient-hero-fog-front)' }}
					/>
				</div>
			</div>

			{/* Mobile Version */}
			<div className="lg:hidden relative w-full h-screen overflow-hidden">
				<HeroMobileSlideshow
					slotOrder={slotOrder}
					banners={versionedBanners}
					siteName={settings?.siteName || 'HIMATIF ENCODER'}
					siteTagline={
						settings?.siteTagline || 'Himpunan Mahasiswa Teknik Informatika'
					}
					siteDescription={settings?.siteDescription || ''}
					logoUrl={settings?.logoUrl}
					onScrollTo={scrollToSection}
					stats={stats}
				/>
			</div>
		</div>
	);
}
