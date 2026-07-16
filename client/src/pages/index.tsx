import { LoadingScreen } from '@/components/LoadingScreen';
import MaintenanceMode from '@/components/maintenance-mode';
import About from '@/components/public/about';
import AIChat from '@/components/public/ai-chat';
import BeritaList from '@/components/public/berita';
import Footer from '@/components/public/footer';
import Hero from '@/components/public/hero';
import Library from '@/components/public/library';
import Navbar from '@/components/public/navbar';
import TokoSection from '@/components/public/toko-section';
import {
	InstagramHomeSection,
	YoutubeHomeSection,
} from '@/components/public/social-feed-sections';
import VisionMission from '@/components/public/vision-mission';
import { useAppLoading } from '@/hooks/use-app-loading';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import AOS from 'aos';
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { useLocation } from 'wouter';
import { ALL_SUBITEM_BLOCKS, DEFAULT_HOME_CONFIG, DEFAULT_TENANT_HOME_CONFIG, type HomeBlockItem, type HomeConfig } from '../../../shared/schema';
import { useTenant } from '@/lib/tenant-context';
import { ArrowRight } from 'lucide-react';

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
	eventsAutoScrollEnabled?: boolean;
	eventsAllowMultipleYearsOnHome?: boolean;
	homeConfig?: HomeConfig;
	socialLinks: {
		facebook: string;
		twitter: string;
		instagram: string;
		youtube: string;
	};
	links: {
		uinMalang: string;
		fakultasSainsTeknologi: string;
		jurusanTeknikInformatika: string;
		perpustakaan: string;
	};
}

const Structure = lazy(() => import('@/components/public/structure'));
const EventsTree = lazy(() => import('@/components/public/events-tree'));
const ProfilTentangKamiSection = lazy(() => import('@/components/public/home-sections/profil-tentang-kami'));
const ProfilSejarahSection = lazy(() => import('@/components/public/home-sections/profil-sejarah'));
const ProfilFilosofiSection = lazy(() => import('@/components/public/home-sections/profil-filosofi'));
const KelembagaanVisionMissionSection = lazy(() => import('@/components/public/home-sections/kelembagaan-vision-mission'));
const KelembagaanStructureSection = lazy(() => import('@/components/public/home-sections/kelembagaan-structure'));
const ProdiSummarySection = lazy(() => import('@/components/public/home-sections/prodi-summary'));

/** Satu kali per tab: setelah intro hero desktop pertama selesai, jangan kunci lagi saat navigasi balik ke beranda. */
const HOME_SCROLL_UNLOCK_KEY = 'hmps-home-scroll-unlocked';

/** Sama dengan breakpoint `lg` Tailwind — kunci scroll hanya di viewport desktop. */
const DESKTOP_SCROLL_LOCK_MQ = '(min-width: 1024px)';

export default function Home() {
	const { isTenant } = useTenant();
	const { isLoading, completeLoading, forceComplete, assetsLoaded } =
		useAppLoading();

	const defaultHomeBlocks = isTenant
		? DEFAULT_TENANT_HOME_CONFIG.blocks
		: DEFAULT_HOME_CONFIG.blocks;

	// heroReady diset saat loading screen mulai exit (onExitStart),
	// bukan setelah selesai — agar Hero animation berjalan bersamaan dengan loading screen fade out
	const [heroReady, setHeroReady] = useState(false);
	const [heroTrigger, setHeroTrigger] = useState(() => Date.now());
	const [location] = useLocation();

	const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
		typeof window !== 'undefined' &&
		window.matchMedia(DESKTOP_SCROLL_LOCK_MQ).matches,
	);

	useEffect(() => {
		const mq = window.matchMedia(DESKTOP_SCROLL_LOCK_MQ);
		const sync = () => setIsDesktopViewport(mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	}, []);

	const [homeScrollUnlocked, setHomeScrollUnlocked] = useState(() => {
		if (typeof window === 'undefined') return true;
		try {
			return sessionStorage.getItem(HOME_SCROLL_UNLOCK_KEY) === '1';
		} catch {
			return false;
		}
	});

	const handleHeroIntroSettled = useCallback(() => {
		try {
			sessionStorage.setItem(HOME_SCROLL_UNLOCK_KEY, '1');
		} catch {
			/* ignore */
		}
		setHomeScrollUnlocked(true);
	}, []);

	// Mobile: tidak pakai gate intro desktop; hindari stuck jika resize mobile ↔ desktop.
	useEffect(() => {
		if (!isDesktopViewport) handleHeroIntroSettled();
	}, [isDesktopViewport, handleHeroIntroSettled]);

	// Samakan dengan perilaku reload: kunci hanya selama loading screen aktif.
	const scrollLocked = isDesktopViewport && isLoading;

	useLayoutEffect(() => {
		if (!scrollLocked) return;

		const html = document.documentElement;
		const body = document.body;
		const scrollY = window.scrollY;

		const prevHtmlOverflow = html.style.overflow;
		const prevBodyOverflow = body.style.overflow;
		const prevBodyPosition = body.style.position;
		const prevBodyTop = body.style.top;
		const prevBodyLeft = body.style.left;
		const prevBodyRight = body.style.right;
		const prevBodyWidth = body.style.width;
		const prevTouchAction = body.style.touchAction;

		html.style.overflow = 'hidden';
		body.style.overflow = 'hidden';
		body.style.touchAction = 'none';
		body.style.position = 'fixed';
		body.style.top = `-${scrollY}px`;
		body.style.left = '0';
		body.style.right = '0';
		body.style.width = '100%';

		return () => {
			html.style.overflow = prevHtmlOverflow;
			body.style.overflow = prevBodyOverflow;
			body.style.touchAction = prevTouchAction;
			body.style.position = prevBodyPosition;
			body.style.top = prevBodyTop;
			body.style.left = prevBodyLeft;
			body.style.right = prevBodyRight;
			body.style.width = prevBodyWidth;
			window.scrollTo(0, scrollY);
		};
	}, [scrollLocked]);

	const prevScrollLockedRef = useRef<boolean | null>(null);

	// Hanya setelah kunci scroll dilepas: AOS sempat mengukur saat body `position: fixed` — hitung ulang (jangan saat mount tanpa kunci).
	useLayoutEffect(() => {
		const wasLocked = prevScrollLockedRef.current === true;
		prevScrollLockedRef.current = scrollLocked;

		if (scrollLocked || !wasLocked) return;

		let raf2 = 0;
		const raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(() => {
				AOS.refreshHard();
			});
		});
		return () => {
			cancelAnimationFrame(raf1);
			cancelAnimationFrame(raf2);
		};
	}, [scrollLocked]);

	// Restore judul tab dan canonical saat kembali ke beranda dari halaman lain
	useEffect(() => {
		document.title =
			'Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang | Fakultas Saintek';
		const canonical = document.querySelector('link[rel="canonical"]');
		if (canonical) canonical.setAttribute('href', 'https://himatif-encoder.com');
		const metaDescription = document.querySelector('meta[name="description"]');
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Himatif Encoder adalah Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang. Wadah pengembangan akademik, organisasi, kepemimpinan mahasiswa TI, dan kegiatan teknologi di Fakultas Sains dan Teknologi UIN Malang.',
			);
		}
	}, []);

	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		queryFn: async () => {
			const response = await apiRequest('GET', '/api/settings');
			return response.json();
		},
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
	});

	// Tanpa blok hero, tidak ada yang memanggil onIntroSettled — buka gate desktop.
	useEffect(() => {
		if (!isDesktopViewport || isLoading || homeScrollUnlocked) return;
		const blocks: HomeBlockItem[] = settings?.homeConfig?.blocks?.length
			? settings.homeConfig.blocks
			: defaultHomeBlocks;
		const hasHero = blocks.filter((b) => b.visible).some((b) => b.id === 'hero');
		if (!hasHero) handleHeroIntroSettled();
	}, [
		isDesktopViewport,
		isLoading,
		homeScrollUnlocked,
		settings?.homeConfig,
		handleHeroIntroSettled,
		defaultHomeBlocks,
	]);

	// Pada SPA navigation/reload, section ber-data-aos bisa render ulang setelah init.
	// Paksa re-scan AOS saat masuk beranda dan scroll tidak sedang dikunci.
	useEffect(() => {
		if (location !== '/' || scrollLocked) return;

		let raf2 = 0;
		const refresh = () => AOS.refreshHard();
		const raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(refresh);
		});
		const timer = window.setTimeout(refresh, 220);

		return () => {
			cancelAnimationFrame(raf1);
			cancelAnimationFrame(raf2);
			window.clearTimeout(timer);
		};
	}, [location, scrollLocked, settings?.homeConfig]);

	const [activeSection, setActiveSection] = useState('home');

	const validSections = [
		'about',
		'events',
		'vision-mission',
		'structure',
		'prodi',
		'berita',
		'library',
		'toko',
		'profil-tentangKami',
		'profil-sejarah',
		'profil-filosofi',
		'kelembagaan-visionMission',
		'kelembagaan-structure',
	];

	// Saat beranda dimuat dengan hash (mis. /#about dari halaman lain):
	// Cegah browser loncat langsung ke section — tampilkan dari atas dulu
	useLayoutEffect(() => {
		const hash = window.location.hash.slice(1);
		if (hash && validSections.includes(hash)) {
			window.scrollTo(0, 0);
		}
	}, []);

	// Lalu smooth scroll ke section setelah delay singkat (animasi dari atas ke section)
	useEffect(() => {
		const hash = window.location.hash.slice(1);
		if (!hash || !validSections.includes(hash)) return;
		const t = setTimeout(() => {
			const el = document.getElementById(hash);
			el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 350);
		return () => clearTimeout(t);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const scrollToSection = (id: string) => {
		setActiveSection(id);
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth' });
		}
	};

	useEffect(() => {
		let ticking = false;
		const handleScroll = () => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => {
			const sections = [
				{ id: 'home', navId: 'home' },
				{ id: 'about', navId: 'profil' },
				{ id: 'profil-tentangKami', navId: 'profil' },
				{ id: 'profil-sejarah', navId: 'profil' },
				{ id: 'profil-filosofi', navId: 'profil' },
				{ id: 'events', navId: 'events' },
				{ id: 'vision-mission', navId: 'kelembagaan' },
				{ id: 'kelembagaan-visionMission', navId: 'kelembagaan' },
				{ id: 'structure', navId: 'kelembagaan' },
				{ id: 'kelembagaan-structure', navId: 'kelembagaan' },
				{ id: 'prodi', navId: 'prodi' },
				{ id: 'berita', navId: 'berita' },
				{ id: 'library', navId: 'library' },
				{ id: 'toko', navId: 'toko' },
			];
			const currentPosition = window.scrollY + 200;
			for (const section of sections) {
				const element = document.getElementById(section.id);
				if (!element) continue;
				const offsetTop = element.offsetTop;
				const offsetHeight = element.offsetHeight;
				if (
					currentPosition >= offsetTop &&
					currentPosition < offsetTop + offsetHeight
				) {
					setActiveSection(section.navId);
					break;
				}
			}
				ticking = false;
			});
		};
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	// Setiap kali route berubah ke '/', trigger ulang animasi Hero
	useEffect(() => {
		if (location === '/') {
			setHeroTrigger(Date.now());
		}
	}, [location]);

	if (settings?.maintenanceMode) {
		return <MaintenanceMode />;
	}

	const blocks: HomeBlockItem[] = settings?.homeConfig?.blocks?.length
		? settings.homeConfig.blocks
		: defaultHomeBlocks;

	const visibleBlocks = blocks.filter((b) => b.visible);

	const renderBlock = (block: HomeBlockItem) => {
		if (block.kind === 'section') {
			switch (block.id) {
				case 'hero':
					return (
						<Hero
							key="hero"
							scrollToSection={scrollToSection}
							assetsLoaded={heroReady || !isLoading}
							introKey={heroTrigger}
							onIntroSettled={
								isDesktopViewport ? handleHeroIntroSettled : undefined
							}
						/>
					);
				case 'about':
					return <About key="about" />;
				case 'events':
					return (
						<Suspense key="events" fallback={null}>
							<EventsTree autoScrollEnabled={settings?.eventsAutoScrollEnabled ?? true} />
						</Suspense>
					);
				case 'visionMission':
					return <VisionMission key="visionMission" />;
				case 'structure':
					return (
						<Suspense
							key="structure"
							fallback={
								<div className="py-16 flex justify-center">
									<div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
								</div>
							}>
							<Structure />
						</Suspense>
					);
			case 'prodi':
				return (
					<Suspense key="prodi" fallback={null}>
						<ProdiSummarySection />
					</Suspense>
				);
			case 'berita':
				return <BeritaList key="berita" />;
			case 'youtube':
				return (
					<Suspense key="youtube" fallback={null}>
						<YoutubeHomeSection />
					</Suspense>
				);
			case 'instagram':
				return (
					<Suspense key="instagram" fallback={null}>
						<InstagramHomeSection />
					</Suspense>
				);
			case 'library':
				return <Library key="library" />;
				case 'toko':
					return <TokoSection key="toko" />;
				case 'footer':
					return <Footer key="footer" />;
				default:
					return null;
			}
		}

		if (block.kind === 'subItem') {
			const mode = block.renderMode || 'summary';
			if (mode === 'full') {
				return renderSubItemFull(block);
			}
			return renderSubItemSummary(block);
		}
		return null;
	};

	const renderSubItemSummary = (block: HomeBlockItem) => {
		const meta = ALL_SUBITEM_BLOCKS.find((s) => s.id === block.id);
		if (!meta) return null;
		const isKelembagaanStructure = block.id === 'kelembagaan.structure';
		return (
			<section key={block.id} id={block.id.replace('.', '-')} className="py-16 scroll-mt-20">
				<div className="max-w-5xl mx-auto px-4 text-center">
					<span className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase">
						{meta.label}
					</span>
					<h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{meta.label}</h2>
					{isKelembagaanStructure ? (
						<div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
							<a
								href={meta.href}
								className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
								Lihat semua struktur <ArrowRight className="h-4 w-4" />
							</a>
							<a
								href="/kelembagaan?tab=grid#structure"
								className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors">
								Lihat daftar anggota <ArrowRight className="h-4 w-4" />
							</a>
						</div>
					) : (
						<a
							href={meta.href}
							className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
							Lihat Detail <ArrowRight className="h-4 w-4" />
						</a>
					)}
				</div>
			</section>
		);
	};

	const renderSubItemFull = (block: HomeBlockItem) => {
		const fallback = (
			<div className="py-16 flex justify-center">
				<div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
			</div>
		);
		switch (block.id) {
			case 'profil.tentangKami':
				return <Suspense key={block.id} fallback={fallback}><ProfilTentangKamiSection /></Suspense>;
			case 'profil.sejarah':
				return <Suspense key={block.id} fallback={fallback}><ProfilSejarahSection /></Suspense>;
			case 'profil.filosofi':
				return <Suspense key={block.id} fallback={fallback}><ProfilFilosofiSection /></Suspense>;
			case 'kelembagaan.visionMission':
				return <Suspense key={block.id} fallback={fallback}><KelembagaanVisionMissionSection /></Suspense>;
			case 'kelembagaan.structure':
				return <Suspense key={block.id} fallback={fallback}><KelembagaanStructureSection /></Suspense>;
			default:
				return renderSubItemSummary(block);
		}
	};

	return (
		<div className="min-h-screen bg-background text-foreground">
			{isLoading && (
				<LoadingScreen
					onLoadingComplete={completeLoading}
					forceComplete={forceComplete}
					assetsLoaded={assetsLoaded}
					onExitStart={() => {
						setHeroReady(true);
						setHeroTrigger(Date.now());
					}}
				/>
			)}
			<Navbar
				activeSection={activeSection}
				scrollToSection={scrollToSection}
			/>
			{visibleBlocks.map(renderBlock)}
			<AIChat
				pageContext={{
					path: '/',
					permissions: [],
					pageData: {
						title: 'Beranda Himatif Encoder',
					},
				}}
			/>
		</div>
	);
}
