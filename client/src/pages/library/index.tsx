import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Library from '@/components/public/library';
import Navbar from '@/components/public/navbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function LibraryPage() {
	const scrollToSection = (id: string) => {
		window.location.href = `/#${id}`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1">
				<div className="max-w-7xl mx-auto px-4 pt-8 pb-0">
					<Link href="/">
						<Button variant="ghost" size="sm" className="mb-4">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Kembali ke Beranda
						</Button>
					</Link>
				</div>
				<Library variant="page" />
			</main>
			<Footer />
			<AIChat pageContext={{ path: '/library', permissions: [] }} />
		</div>
	);
}
