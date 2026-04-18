import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Library from '@/components/public/library';
import Navbar from '@/components/public/navbar';
import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import { useTenant } from '@/lib/tenant-context';

export default function LibraryPage() {
	const { basePath } = useTenant();
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1">
				<div className="max-w-7xl mx-auto px-4 pt-8 pb-0">
					<PageBreadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Galeri' }]} />
				</div>
				<Library variant="page" />
			</main>
			<Footer />
			<AIChat pageContext={{ path: '/library', permissions: [] }} />
		</div>
	);
}
