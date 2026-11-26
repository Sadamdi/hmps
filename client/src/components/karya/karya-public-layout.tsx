import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { PageBreadcrumb, type BreadcrumbItem } from '@/components/public/page-breadcrumb';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

/** Kerangka halaman publik Karya: navbar situs, breadcrumb, konten, footer (sama dengan halaman publik lain). */
export function KaryaPublicLayout({
	breadcrumb,
	title,
	children,
	noindex,
}: {
	breadcrumb?: BreadcrumbItem[];
	title?: string;
	children: ReactNode;
	/** Halaman privat/aplikasi: jangan diindeks mesin pencari */
	noindex?: boolean;
}) {
	useEffect(() => {
		if (title) document.title = title;
	}, [title]);

	useEffect(() => {
		if (!noindex) return;
		const meta = document.createElement('meta');
		meta.name = 'robots';
		meta.content = 'noindex, nofollow';
		document.head.appendChild(meta);
		return () => {
			meta.remove();
		};
	}, [noindex]);

	return (
		<div className="min-h-screen bg-background relative flex flex-col">
			<Navbar activeSection="karya" scrollToSection={(id) => (window.location.href = `/#${id}`)} />
			{breadcrumb?.length ? (
				<div className="bg-card border-b border-border pt-16">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
						<PageBreadcrumb className="mb-0" items={breadcrumb} />
					</div>
				</div>
			) : (
				<div className="pt-16" />
			)}
			<main className="flex-1">{children}</main>
			<Footer />
			<AIChat />
		</div>
	);
}
