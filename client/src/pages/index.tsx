import { LoadingScreen } from '@/components/LoadingScreen';
import MaintenanceMode from '@/components/maintenance-mode';
import About from '@/components/public/about';
import AIChat from '@/components/public/ai-chat';
import Articles from '@/components/public/articles';
import Footer from '@/components/public/footer';
import Hero from '@/components/public/hero';
import Library from '@/components/public/library';
import Navbar from '@/components/public/navbar';
import Structure from '@/components/public/structure';
import VisionMission from '@/components/public/vision-mission';
import { useAppLoading } from '@/hooks/use-app-loading';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

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

export default function Home() {
	const { isLoading, completeLoading, forceComplete, assetsLoaded } =
		useAppLoading();

	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		queryFn: async () => {
			const response = await apiRequest('GET', '/api/settings');
			return response.json();
		},
		staleTime: 0,
		refetchOnWindowFocus: true,
	});

	const [activeSection, setActiveSection] = useState('home');
	const scrollToSection = (id: string) => {
		setActiveSection(id);
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth' });
		}
	};

	useEffect(() => {
		const handleScroll = () => {
			const sections = [
				'home',
				'about',
				'vision-mission',
				'structure',
				'articles',
				'library',
			];
			const currentPosition = window.scrollY + 200;
			for (const section of sections) {
				const element = document.getElementById(section);
				if (!element) continue;
				const offsetTop = element.offsetTop;
				const offsetHeight = element.offsetHeight;
				if (
					currentPosition >= offsetTop &&
					currentPosition < offsetTop + offsetHeight
				) {
					setActiveSection(section);
					break;
				}
			}
		};
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	if (settings?.maintenanceMode) {
		return <MaintenanceMode />;
	}

	if (isLoading) {
		return (
			<LoadingScreen
				onLoadingComplete={completeLoading}
				forceComplete={forceComplete}
				assetsLoaded={assetsLoaded}
			/>
		);
	}

	return (
		<div>
			<Navbar
				activeSection={activeSection}
				scrollToSection={scrollToSection}
			/>
			<Hero
				scrollToSection={scrollToSection}
				assetsLoaded={assetsLoaded}
			/>
			<About />
			<VisionMission />
			<Structure />
			<Articles />
			<Library />
			<Footer />
			<AIChat />
		</div>
	);
}
