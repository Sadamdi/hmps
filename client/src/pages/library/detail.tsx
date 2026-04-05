import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import {
	LibraryDetailItem,
	LibraryItemDetailContent,
} from '@/components/public/library-item-detail';
import Navbar from '@/components/public/navbar';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useParams } from 'wouter';
import { useTenant } from '@/lib/tenant-context';

export default function LibraryDetailPage() {
	const { id } = useParams();
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
		queryKey: ['library-item', id],
		queryFn: async () => {
			const res = await apiRequest('GET', `/api/library/${id}`);
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

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1">
				<div className="max-w-4xl mx-auto px-4 pt-8 pb-12">
					<Link href="/library">
						<Button variant="ghost" size="sm" className="mb-6">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Kembali ke galeri
						</Button>
					</Link>

					{isLoading && (
						<div className="animate-pulse space-y-4">
							<div className="h-10 bg-muted rounded w-2/3" />
							<div className="aspect-video bg-muted rounded-lg" />
						</div>
					)}

					{error || (!isLoading && !item) ? (
						<div className="text-center py-16 text-muted-foreground">
							<p>Galeri tidak ditemukan atau tidak tersedia.</p>
							<Link href="/library">
								<Button variant="link" className="mt-2">
									Kembali ke daftar galeri
								</Button>
							</Link>
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
