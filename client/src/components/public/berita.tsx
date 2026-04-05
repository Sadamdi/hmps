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
import { apiRequest } from '@/lib/queryClient';
import { useTenant } from '@/lib/tenant-context';
import { useQuery } from '@tanstack/react-query';
import { Calendar, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';

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
	const [showAll, setShowAll] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const { ref: headingRef, isVisible: headingVisible } = useRevealAnimation();
	const { basePath } = useTenant();
	const bp = basePath || '';

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

	// Check if screen is mobile
	useEffect(() => {
		const checkIsMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};

		checkIsMobile();
		window.addEventListener('resize', checkIsMobile);

		return () => window.removeEventListener('resize', checkIsMobile);
	}, []);

	const initialCount = isMobile ? 3 : 6;
	const maxCount = isMobile ? 6 : 12;

	const displayedBerita = showAll
		? beritaList.slice(0, maxCount)
		: beritaList.slice(0, initialCount);

	const getBeritaUrl = (item: BeritaItem) => {
		const beritaId = item.id || item._id;
		if (item.slug && beritaId) {
			return `${bp}/berita/${beritaId}/${item.slug}`;
		}
		return `${bp}/berita/${beritaId}`;
	};

	const truncateText = (text: string, maxLength: number = 150) => {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength).trim() + '...';
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('id-ID', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	if (isLoading) {
		return (
			<section
				id="berita"
				className="py-16 bg-background">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-12">
						<Skeleton className="h-8 w-48 mx-auto mb-4" />
						<Skeleton className="h-1 w-20 mx-auto mb-4" />
						<Skeleton className="h-6 w-96 mx-auto" />
					</div>
					<div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
						{[...Array(6)].map((_, i) => (
							<Card
								key={i}
								className="overflow-hidden">
								<Skeleton className="h-48 w-full" />
								<CardHeader>
									<Skeleton className="h-6 w-3/4" />
									<Skeleton className="h-4 w-1/2" />
								</CardHeader>
								<CardContent>
									<Skeleton className="h-4 w-full mb-2" />
									<Skeleton className="h-4 w-full mb-2" />
									<Skeleton className="h-4 w-2/3" />
								</CardContent>
								<CardFooter>
									<Skeleton className="h-10 w-32" />
								</CardFooter>
							</Card>
						))}
					</div>
				</div>
			</section>
		);
	}
	return (
		<section
			id="berita"
			className="py-16 bg-background">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div ref={headingRef} className="text-center mb-12">
					<h2 className={`text-3xl font-bold text-foreground mb-4 ${headingVisible ? 'reveal-heading' : 'opacity-0'}`}>
						Berita Terbaru
					</h2>
					<div className={`w-20 h-1 bg-primary mx-auto mb-4 ${headingVisible ? 'reveal-heading reveal-heading-delay-1' : 'opacity-0'}`} />
					<p className={`text-muted-foreground max-w-2xl mx-auto ${headingVisible ? 'reveal-heading reveal-heading-delay-2' : 'opacity-0'}`}>
						Temukan berita dan informasi terkini dari HIMATIF ENCODER
					</p>
				</div>

				{/* Berita Grid */}
				{beritaList.length === 0 ? (
						<div className="text-center py-12">
							<div className="text-muted-foreground text-lg">
							Belum ada berita yang dipublikasikan
						</div>
					</div>
				) : (
					<>
						<div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
							{displayedBerita.map((item, index) => (
								<Card
									key={item.id || item._id}
									className="overflow-hidden border border-border/70 bg-card hover:shadow-lg hover:border-primary/40 transition-all duration-300 group"
									data-aos="fade-up"
									data-aos-delay={index * 100}>
									{/* Berita Image */}
									<Link href={getBeritaUrl(item)}>
										<div className="relative h-48 overflow-hidden cursor-pointer">
											<OptimizedImage
												src={item.image}
												alt={item.title}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
												loading="lazy"
												sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
												onError={(e) => {
													const target = e.target as HTMLImageElement;
													target.src = '/placeholder-berita.jpg';
												}}
											/>
											<div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
										</div>
									</Link>
									{/* Berita Content */}
									<CardHeader className="pb-3">
										<Link href={getBeritaUrl(item)}>
											<h3 className="font-bold text-xl leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200 cursor-pointer">
												{item.title}
											</h3>
										</Link>
										<div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
											<div className="flex items-center gap-1">
												<User className="h-4 w-4" />
												<span>{item.authorsDisplay || item.author}</span>
											</div>
											<div className="flex items-center gap-1">
												<Calendar className="h-4 w-4" />
												<span>{formatDate(item.createdAt)}</span>
											</div>
											<div className="flex items-center gap-1">
												<span>{item.viewCount ?? 0} pembaca</span>
											</div>
										</div>
									</CardHeader>

									<CardContent className="pt-0">
										<p className="text-muted-foreground leading-relaxed mb-3">
											{truncateText(item.excerpt)}
										</p>

										{/* Tags */}
										{item.tags && item.tags.length > 0 && (
											<div className="flex flex-wrap gap-1 mb-3">
												{item.tags.slice(0, 3).map((tag) => (
													<Badge
														key={tag}
														variant="secondary"
														className="text-xs">
														{tag}
													</Badge>
												))}
												{item.tags.length > 3 && (
													<Badge
														variant="outline"
														className="text-xs">
														+{item.tags.length - 3} lagi
													</Badge>
												)}
											</div>
										)}
										{(item.relatedGalleryPreview &&
											item.relatedGalleryPreview.length > 0) ||
										(item.linkedEventsPreview &&
											item.linkedEventsPreview.length > 0) ? (
											<div className="flex flex-wrap gap-2 pt-2 mt-2 border-t border-border">
												<span className="text-xs font-semibold text-muted-foreground w-full">
													Terkait:
												</span>
												{item.relatedGalleryPreview?.map((g) => (
													<Link
														key={g._id}
														href={`${bp}/library/${g._id}`}>
														<span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs hover:bg-primary/20">
															Galeri: {g.title}
														</span>
													</Link>
												))}
												{item.linkedEventsPreview?.map((ev) => (
													<Link
														key={ev._id}
														href={
															ev.year
																? `${bp}/events/${ev.year}/${ev._id}`
																: `${bp}/events/all`
														}>
														<span className="inline-flex items-center rounded-full bg-secondary text-foreground px-3 py-1 text-xs hover:bg-secondary/80">
															Event: {ev.title}
														</span>
													</Link>
												))}
											</div>
										) : null}
									</CardContent>

									<CardFooter className="pt-0">
										<Link href={getBeritaUrl(item)}>
											<Button
												variant="link"
												className="text-primary hover:text-primary/80 p-0 h-auto font-medium">
												Baca selengkapnya →
											</Button>
										</Link>
									</CardFooter>
								</Card>
							))}
						</div>
						{/* Show More/Less Button */}
						{beritaList.length > 6 && (
							<div
								className="text-center mt-12"
								data-aos="fade-up"
								data-aos-delay="200">
								<Button
									onClick={() => setShowAll(!showAll)}
									variant="outline"
									className="px-8 py-2">
									{showAll
										? 'Tampilkan Lebih Sedikit'
										: 'Lihat Lebih Banyak Berita'}
								</Button>
							</div>
						)}

						{/* Always show "Lihat Semua Berita" button */}
						<div
							className="text-center mt-8"
							data-aos="fade-up"
							data-aos-delay="300">
						<Link href={`${bp}/berita`}>
							<Button
								variant="default"
								className="px-8 py-2">
								Lihat Semua Berita
								</Button>
							</Link>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
