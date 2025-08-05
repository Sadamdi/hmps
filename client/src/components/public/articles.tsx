import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { Calendar, User } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

interface Article {
	id?: number;
	_id?: string;
	slug?: string;
	title: string;
	excerpt: string;
	content: string;
	image: string;
	author: string;
	createdAt: string;
	published: boolean;
	tags?: string[];
}

export default function Articles() {
	const [showAll, setShowAll] = useState(false);

	const { data: articles = [], isLoading } = useQuery<Article[]>({
		queryKey: ['/api/articles'],
		queryFn: async () => {
			const response = await apiRequest('GET', '/api/articles');
			return response.json();
		},
		placeholderData: [],
	});

	// Show only first 6 articles initially, or up to 12 if showAll is true
	const displayedArticles = showAll
		? articles.slice(0, 12)
		: articles.slice(0, 6);

	// Helper function to get article URL (hybrid: ID + slug for SEO)
	const getArticleUrl = (article: Article) => {
		const articleId = article.id || article._id;
		if (article.slug && articleId) {
			// Hybrid URL: /artikel/:id/:slug (SEO-friendly + unique)
			return `/artikel/${articleId}/${article.slug}`;
		}
		// Fallback to ID-only if no slug
		return `/artikel/${articleId}`;
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
				id="articles"
				className="py-16 bg-white">
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
			id="articles"
			className="py-16 bg-white">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="text-center mb-12">
					<h2 className="text-3xl font-bold text-gray-900 mb-4">
						Artikel Terbaru
					</h2>
					<div className="w-20 h-1 bg-primary mx-auto mb-4"></div>
					<p className="text-gray-600 max-w-2xl mx-auto">
						Temukan artikel dan informasi terkini dari HIMATIF ENCODER
					</p>
				</div>

				{/* Articles Grid */}
				{articles.length === 0 ? (
					<div className="text-center py-12">
						<div className="text-gray-500 text-lg">
							Belum ada artikel yang dipublikasikan
						</div>
					</div>
				) : (
					<>
						<div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
							{displayedArticles.map((article, index) => (
								<Card
									key={article.id || article._id}
									className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group"
									data-aos="fade-up"
									data-aos-delay={index * 100}>
									{/* Article Image */}
									<Link href={getArticleUrl(article)}>
										<div className="relative h-48 overflow-hidden cursor-pointer">
											<img
												src={article.image}
												alt={article.title}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
												onError={(e) => {
													const target = e.target as HTMLImageElement;
													target.src = '/placeholder-article.jpg';
												}}
											/>
											<div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
										</div>
									</Link>
									{/* Article Content */}
									<CardHeader className="pb-3">
										<Link href={getArticleUrl(article)}>
											<h3 className="font-bold text-xl leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200 cursor-pointer">
												{article.title}
											</h3>
										</Link>
										<div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
											<div className="flex items-center gap-1">
												<User className="h-4 w-4" />
												<span>{article.author}</span>
											</div>
											<div className="flex items-center gap-1">
												<Calendar className="h-4 w-4" />
												<span>{formatDate(article.createdAt)}</span>
											</div>
										</div>
									</CardHeader>

									<CardContent className="pt-0">
										<p className="text-gray-600 leading-relaxed mb-3">
											{truncateText(article.excerpt)}
										</p>

										{/* Tags */}
										{article.tags && article.tags.length > 0 && (
											<div className="flex flex-wrap gap-1 mb-3">
												{article.tags.slice(0, 3).map((tag) => (
													<Badge
														key={tag}
														variant="secondary"
														className="text-xs">
														{tag}
													</Badge>
												))}
												{article.tags.length > 3 && (
													<Badge
														variant="outline"
														className="text-xs">
														+{article.tags.length - 3} lagi
													</Badge>
												)}
											</div>
										)}
									</CardContent>

									<CardFooter className="pt-0">
										<Link href={getArticleUrl(article)}>
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
						{articles.length > 6 && (
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
										: 'Lihat Lebih Banyak Artikel'}
								</Button>
							</div>
						)}

						{/* Always show "Lihat Semua Artikel" button */}
						<div
							className="text-center mt-8"
							data-aos="fade-up"
							data-aos-delay="300">
							<Link href="/artikel">
								<Button
									variant="default"
									className="px-8 py-2">
									Lihat Semua Artikel
								</Button>
							</Link>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
