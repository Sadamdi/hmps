import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import OptimizedImage from '@/components/ui/optimized-image';
import { useRevealAnimation } from '@/hooks/use-reveal-animation';
import { useAosRefreshOnMount } from '@/hooks/use-aos-refresh-on-mount';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { Calendar, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { toSlug } from '@/utils/slug';
import { DEFAULT_IMAGE_URL } from '@/constants/default-image';
import { usePublicBrand } from '@/hooks/use-public-brand';

interface BeritaItem {
	id?: number;
	_id?: string;
	slug?: string;
	title: string;
	excerpt: string;
	content: string;
	image: string;
	author: string;
	authorsDisplay?: string;
	authors?: string[];
	createdAt: string;
	published: boolean;
	tags?: string[];
	viewCount?: number;
	relatedGalleryPreview?: { _id: string; title: string }[];
	linkedEventsPreview?: { _id: string; title: string; year?: number }[];
}

interface PaginatedResponse<T> {
	data: T[];
	meta?: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export default function BeritaList() {
	useAosRefreshOnMount();
	const { siteName } = usePublicBrand();
	const [showAll, setShowAll] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const { ref: headingRef, isVisible: headingVisible } = useRevealAnimation();
	const { data: beritaList = [], isLoading } = useQuery<BeritaItem[]>({
		queryKey: ['/api/berita'],
		queryFn: async () => {
			const response = await apiRequest('GET', '/api/berita?page=1&limit=12');
			const payload = (await response.json()) as BeritaItem[] | PaginatedResponse<BeritaItem>;
			return Array.isArray(payload) ? payload : payload.data;
		},
		placeholderData: [],
		staleTime: 60 * 1000,
	});

	useEffect(() => {
		const checkIsMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};
		checkIsMobile();
		window.addEventListener('resize', checkIsMobile);
		return () => window.removeEventListener('resize', checkIsMobile);
	}, []);

	// Mobile: 2×2 compact (4). Desktop: 6 then up to 12.
	const initialCount = isMobile ? 4 : 6;
	const maxCount = isMobile ? 8 : 12;

	const displayedBerita = showAll
		? beritaList.slice(0, maxCount)
		: beritaList.slice(0, initialCount);

	const getBeritaUrl = (item: BeritaItem) => {
		if (item.slug) return `/berita/${item.slug}`;
		return `/berita/${item.id || item._id}`;
	};

	const truncateText = (text: string, maxLength: number = 120) => {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength).trim() + '...';
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('id-ID', {
			year: isMobile ? '2-digit' : 'numeric',
			month: isMobile ? 'short' : 'long',
			day: 'numeric',
		});
	};

	if (isLoading) {
		return (
			<section id="berita" className="py-14 sm:py-20 bg-background">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-8 sm:mb-12">
						<Skeleton className="h-4 w-28 mb-3" />
						<Skeleton className="h-9 w-56 mb-3" />
						<Skeleton className="h-5 w-72 max-w-full" />
					</div>
					<div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
						{[...Array(isMobile ? 4 : 6)].map((_, i) => (
							<Card key={i} className="overflow-hidden">
								<Skeleton className="aspect-[4/3] w-full" />
								<div className="p-3 space-y-2">
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-2/3" />
								</div>
							</Card>
						))}
					</div>
				</div>
			</section>
		);
	}

	return (
		<section id="berita" className="py-14 sm:py-20 bg-background">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div
					ref={headingRef}
					className="mb-8 sm:mb-12 border-b border-border/70 pb-6">
					<p
						className={`text-xs font-semibold uppercase tracking-[0.22em] text-primary mb-2 ${headingVisible ? 'reveal-heading' : 'opacity-0'}`}>
						Berita
					</p>
					<h2
						className={`text-2xl sm:text-4xl font-bold tracking-tight text-foreground mb-2 sm:mb-3 ${headingVisible ? 'reveal-heading' : 'opacity-0'}`}>
						Berita terbaru
					</h2>
					<p
						className={`text-sm sm:text-base text-muted-foreground max-w-2xl leading-6 sm:leading-7 ${headingVisible ? 'reveal-heading reveal-heading-delay-2' : 'opacity-0'}`}>
						Kabar terkini dari {siteName}
					</p>
				</div>

				{beritaList.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground">
						Belum ada berita yang dipublikasikan
					</div>
				) : (
					<>
						<div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
							{displayedBerita.map((item, index) => (
								<Card
									key={item.id || item._id}
									className="overflow-hidden rounded-xl sm:rounded-2xl border border-border/70 bg-card transition-[border-color,box-shadow,transform] duration-200 group focus-within:ring-2 focus-within:ring-primary/40 hover:border-primary/35 hover:shadow-md active:scale-[0.99]"
									data-aos="fade-up"
									data-aos-delay={index * 80}>
									<Link href={getBeritaUrl(item)}>
										<div className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden cursor-pointer bg-muted">
											<OptimizedImage
												src={item.image}
												alt={item.title}
												className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 motion-reduce:transition-none"
												loading="lazy"
												sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw"
												onError={(e) => {
													const target = e.target as HTMLImageElement;
													target.src = DEFAULT_IMAGE_URL;
												}}
											/>
										</div>
									</Link>

									<CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
										<Link href={getBeritaUrl(item)}>
											<h3 className="font-bold text-[13px] sm:text-xl leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200 cursor-pointer">
												{item.title}
											</h3>
										</Link>
										<div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-0.5 text-[10px] sm:text-sm text-muted-foreground mt-1.5 sm:mt-2">
											<div className="hidden sm:flex items-center gap-1 min-w-0 max-w-full">
												<User className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
												<span className="truncate">
													{item.authorsDisplay || item.author}
												</span>
											</div>
											<div className="flex items-center gap-1">
												<Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
												<span>{formatDate(item.createdAt)}</span>
											</div>
											<span className="hidden sm:inline">{item.viewCount ?? 0} pembaca</span>
										</div>
									</CardHeader>

									<CardContent className="px-3 sm:px-6 pt-0 pb-2 sm:pb-0">
										<p className="text-muted-foreground text-[11px] sm:text-base leading-relaxed mb-2 sm:mb-3 line-clamp-2 sm:line-clamp-3">
											{truncateText(item.excerpt, isMobile ? 80 : 120)}
										</p>
										{item.tags && item.tags.length > 0 && (
											<div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
												{item.tags.slice(0, isMobile ? 2 : 3).map((tag) => (
													<Badge key={tag} variant="secondary" className="text-[10px] sm:text-xs">
														{tag}
													</Badge>
												))}
												{item.tags.length > (isMobile ? 2 : 3) && (
													<Badge variant="outline" className="text-[10px] sm:text-xs">
														+{item.tags.length - (isMobile ? 2 : 3)} lagi
													</Badge>
												)}
											</div>
										)}
									</CardContent>

									<CardFooter className="px-3 sm:px-6 pt-0 pb-3 sm:pb-6">
										<Link href={getBeritaUrl(item)}>
											<Button
												variant="link"
												className="text-primary hover:text-primary/80 p-0 h-auto font-medium text-xs sm:text-sm min-h-8 sm:min-h-11">
												Baca selengkapnya →
											</Button>
										</Link>
									</CardFooter>
								</Card>
							))}
						</div>

						{(beritaList.length > initialCount || showAll) && (
							<div className="text-center mt-8 sm:mt-12">
								{beritaList.length > initialCount && (
									<Button
										onClick={() => setShowAll(!showAll)}
										variant="outline"
										className="px-6 sm:px-8 min-h-11">
										{showAll ? 'Tampilkan lebih sedikit' : 'Lihat lebih banyak'}
									</Button>
								)}
							</div>
						)}

						<div className="text-center mt-4 sm:mt-8">
							<Link href="/berita">
								<Button variant="default" className="px-6 sm:px-8 min-h-11">
									Semua berita
								</Button>
							</Link>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
