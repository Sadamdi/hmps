import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import Structure from '@/components/public/structure';
import VisionMission from '@/components/public/vision-mission';
import { Suspense, useEffect } from 'react';
import { useTenant } from '@/lib/tenant-context';

export default function KelembagaanPage() {
	const { basePath } = useTenant();
	const bp = basePath || '';

	const scrollToSection = (sectionId: string) => {
		window.location.href = bp ? `${bp}/#${sectionId}` : `/#${sectionId}`;
	};

	useEffect(() => {
		document.title =
			'Kelembagaan | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang';
		const metaDescription = document.querySelector('meta[name="description"]');
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Kelembagaan HIMATIF Encoder - Visi dan Misi serta Struktur Organisasi Himpunan Mahasiswa Teknik Informatika UIN Malang.',
			);
		}
	}, []);

	return (
		<div className="min-h-screen bg-background relative">
			<Navbar
				activeSection="kelembagaan"
				scrollToSection={scrollToSection}
			/>

			{/* Breadcrumb bar */}
			<div className="bg-card border-b border-border">
				<div className="max-w-7xl mx-auto px-4 py-3">
					<PageBreadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Kelembagaan' }]} />
				</div>
			</div>

			{/* Page header */}
			<div className="relative py-14 section-tint-bg overflow-hidden">
				<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
				<div className="max-w-5xl mx-auto px-4 text-center">
					<span className="inline-block px-3 py-1 mb-4 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase">
						Kelembagaan
					</span>
					<h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
						Visi, Misi & Struktur Organisasi
					</h1>
					<p className="text-base text-muted-foreground max-w-xl mx-auto">
						Landasan gerak dan kepengurusan Himpunan Mahasiswa Teknik Informatika
						UIN Maulana Malik Ibrahim Malang
					</p>
					<div className="mx-auto mt-5 w-32 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
				</div>
				<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
			</div>

			{/* Visi dan Misi */}
			<VisionMission showLink={false} />

			{/* Struktur Organisasi */}
			<Suspense
				fallback={
					<div className="py-16 flex justify-center">
						<div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
					</div>
				}>
				<Structure />
			</Suspense>

			<Footer />

			<AIChat
				pageContext={{
					path: '/kelembagaan',
					permissions: [],
					pageData: {
						title: 'Kelembagaan',
						excerpt: 'Visi dan Misi serta Struktur Organisasi HIMATIF Encoder',
					},
				}}
			/>
		</div>
	);
}
