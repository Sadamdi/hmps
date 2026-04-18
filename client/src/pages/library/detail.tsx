import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import {
	LibraryDetailItem,
	LibraryItemDetailContent,
} from '@/components/public/library-item-detail';
import Navbar from '@/components/public/navbar';
import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useTenant } from '@/lib/tenant-context';
import { isObjectId, toSlug } from '@/utils/slug';

export default function LibraryDetailPage() {
	const { id } = useParams<{ id: string }>();
	const [, setLocation] = useLocation();
	const apiPath = isObjectId(id) ? `/api/library/${id}` : `/api/library/slug/${id}`;
	const { basePath } = useTenant();
	const bp = basePath || '';

	const scrollToSection = (sectionId: string) => {
		window.location.href = bp ? `${bp}/#${sectionId}` : `/#${sectionId}`;
	};

	const {
		data: item,
		isLoading,
		error,
	} = useQuery<LibraryDetailItem>({
		queryKey: ['library-item', id, apiPath],
		queryFn: async () => {
			const res = await apiRequest('GET', apiPath);
			return res.json();
		},
		enabled: !!id,
		retry: false,
	});

	useEffect(() => {
		if (item?.title) {
			document.title = `${item.title} | Galeri`;
		}
	}, [item?.title]);

	useEffect(() => {
		if (item?.title && id && isObjectId(id)) {
			const normalized = toSlug(item.title);
			if (normalized) setLocation(`/library/${normalized}`);
		}
	}, [id, item?.title, setLocation]);

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1">
				<div className="max-w-4xl mx-auto px-4 pt-8 pb-12">
					{error || (!isLoading && !item) ? (
						<PageBreadcrumb
							items={[
								{ label: 'Beranda', href: '/' },
								{ label: 'Galeri', href: '/library' },
								{ label: 'Tidak ditemukan' },
							]}
						/>
					) : item ? (
						<PageBreadcrumb
							items={[
								{ label: 'Beranda', href: '/' },
								{ label: 'Galeri', href: '/library' },
								{
									label:
										item.title.length > 52
											? `${item.title.slice(0, 52)}…`
											: item.title,
								},
							]}
						/>
					) : (
						<PageBreadcrumb
							items={[
								{ label: 'Beranda', href: '/' },
								{ label: 'Galeri', href: '/library' },
								{ label: '…' },
							]}
						/>
					)}

					{isLoading && (
						<div className="animate-pulse space-y-4">
							<div className="h-10 bg-muted rounded w-2/3" />
							<div className="aspect-video bg-muted rounded-lg" />
						</div>
					)}

					{error || (!isLoading && !item) ? (
						<div className="text-center py-16 text-muted-foreground">
							<p>Galeri tidak ditemukan atau tidak tersedia.</p>
						</div>
					) : null}

					{item ? (
						<article>
							<header className="mb-6">
								<h1 className="text-3xl font-bold font-serif">{item.title}</h1>
								{item.authorsDisplay && (
									<p className="text-muted-foreground mt-2">
										By {item.authorsDisplay}
									</p>
								)}
							</header>
							<LibraryItemDetailContent item={item} showHeader={false} />
						</article>
					) : null}
				</div>
			</main>
			<Footer />
			<AIChat pageContext={{ path: '/library', permissions: [] }} />
		</div>
	);
}
