import { LoadingScreen } from '@/components/LoadingScreen';
import MaintenanceMode from '@/components/maintenance-mode';
import About from '@/components/public/about';
import AIChat from '@/components/public/ai-chat';
import Articles from '@/components/public/articles';
import Footer from '@/components/public/footer';
import Hero from '@/components/public/hero';
import Library from '@/components/public/library';
import Navbar from '@/components/public/navbar';
import VisionMission from '@/components/public/vision-mission';
import { useAppLoading } from '@/hooks/use-app-loading';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'wouter';

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

export default function Home() {
	const { isLoading, completeLoading, forceComplete, assetsLoaded } =
		useAppLoading();

	// heroReady diset saat loading screen mulai exit (onExitStart),
	// bukan setelah selesai — agar Hero animation berjalan bersamaan dengan loading screen fade out
	const [heroReady, setHeroReady] = useState(false);
	const [heroTrigger, setHeroTrigger] = useState(() => Date.now());
	const [location] = useLocation();

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

	const [activeSection, setActiveSection] = useState('home');

	const validSections = ['about', 'events', 'vision-mission', 'structure', 'berita', 'library'];

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
				{ id: 'events', navId: 'events' },
				{ id: 'vision-mission', navId: 'kelembagaan' },
				{ id: 'structure', navId: 'kelembagaan' },
				{ id: 'berita', navId: 'berita' },
				{ id: 'library', navId: 'library' },
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

	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* LoadingScreen sebagai overlay fixed z-50 agar Hero di-render di background
			    sehingga gambar sudah selesai load sebelum intro animation dimulai */}
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
			{/* heroReady diset saat loading screen mulai fade out (onExitStart),
			    sehingga banner/orang sudah mulai muncul sebelum loading screen sepenuhnya hilang */}
			<Hero
				scrollToSection={scrollToSection}
				assetsLoaded={heroReady || !isLoading}
				introKey={heroTrigger}
			/>
			<About />
			<Suspense fallback={null}>
				<EventsTree autoScrollEnabled={settings?.eventsAutoScrollEnabled ?? true} />
			</Suspense>
			<VisionMission />
			<Suspense
				fallback={
					<div className="py-16 flex justify-center">
						<div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
					</div>
				}>
				<Structure />
			</Suspense>
			<Articles />
			<Library />
			<Footer />
			<AIChat />
		</div>
	);
}
