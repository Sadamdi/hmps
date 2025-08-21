import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { formatContentForDisplay } from '@/utils/formatContent';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Calendar, Share2, Tag, User } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { useLocation, useParams } from 'wouter';

const TableOfContents = lazy(
	() => import('@/components/article/table-of-contents')
);

interface Article {
	id?: number;
	_id?: string;
	title: string;
	excerpt: string;
	content: string;
	image: string;
	author: string;
	createdAt: string;
	updatedAt?: string;
	published: boolean;
	tags?: string[];
}

export default function ArticleDetail() {
	const { id, slug } = useParams();
	const [, setLocation] = useLocation();

	// Debug logging
	console.log('🔍 ArticleDetail Debug:', { id, slug });

	// Determine route type and construct API endpoint
	let apiEndpoint: string;
	let isHybridRoute = false;

	if (id && slug) {
		// Hybrid route: /artikel/:id/:slug
		apiEndpoint = `/api/articles/${id}/${slug}`;
		isHybridRoute = true;
		console.log('🔍 Hybrid route detected:', apiEndpoint);
	} else if (slug && !id) {
		// Slug-only route: /artikel/slug/:slug
		apiEndpoint = `/api/articles/slug/${slug}`;
		console.log('🔍 Slug-only route detected:', apiEndpoint);
	} else {
		// ID-only route: /artikel/:id (legacy)
		apiEndpoint = `/api/articles/${id}`;
		console.log('🔍 ID-only route detected:', apiEndpoint);
	}

	const {
		data: article,
		isLoading,
		error,
	} = useQuery<Article>({
		queryKey: [apiEndpoint],
		queryFn: async () => {
			const response = await apiRequest('GET', apiEndpoint);
			return response.json();
		},
		enabled: !!apiEndpoint,
	});

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('id-ID', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	const estimateReadingTime = (content: string) => {
		const wordsPerMinute = 200;
		const textContent = content.replace(/<[^>]*>/g, '');
		const wordCount = textContent.split(/\s+/).length;
		const readingTime = Math.ceil(wordCount / wordsPerMinute);
		return readingTime;
	};

	const shareArticle = () => {
		if (navigator.share) {
			navigator.share({
				title: article?.title,
				text: article?.excerpt,
				url: window.location.href,
			});
		} else {
			navigator.clipboard.writeText(window.location.href);
			// You could add a toast notification here
		}
	};

	const navigateToTaggedArticles = (tag: string) => {
		setLocation(`/artikel?tag=${encodeURIComponent(tag)}`);
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50">
				<div className="bg-white border-b border-gray-200">
					<div className="max-w-7xl mx-auto px-4 py-4">
						<div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
					</div>
				</div>
				<div className="max-w-7xl mx-auto px-4 py-8">
					<div className="flex gap-8">
						<div className="hidden lg:block w-80 flex-shrink-0">
							<div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
								<div className="h-6 bg-gray-200 rounded w-3/4 mb-6"></div>
								<div className="space-y-3">
									{[...Array(5)].map((_, i) => (
										<div
											key={i}
											className="h-4 bg-gray-200 rounded w-full"></div>
									))}
								</div>
							</div>
						</div>
						<div className="flex-1 max-w-4xl animate-pulse">
							<div className="h-12 bg-gray-200 rounded w-3/4 mb-4"></div>
							<div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
							<div className="h-6 bg-gray-200 rounded w-full mb-2"></div>
							<div className="h-6 bg-gray-200 rounded w-5/6 mb-8"></div>
							<div className="h-96 bg-gray-200 rounded mb-8"></div>
							<div className="space-y-4">
								<div className="h-4 bg-gray-200 rounded"></div>
								<div className="h-4 bg-gray-200 rounded"></div>
								<div className="h-4 bg-gray-200 rounded w-5/6"></div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error || !article) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-gray-900 mb-4">
						Artikel tidak ditemukan
					</h1>
					<Button
						onClick={() => setLocation('/')}
						variant="outline">
						<ArrowLeft className="w-4 h-4 mr-2" />
						Kembali ke Beranda
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Navigation Bar */}
			<div className="bg-white border-b border-gray-200">
				<div className="max-w-7xl mx-auto px-4 py-4">
					<Button
						onClick={() => setLocation('/')}
						variant="ghost"
						className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
						<ArrowLeft className="w-4 h-4 mr-2" />
						Kembali ke Beranda
					</Button>
				</div>
			</div>

			{/* Main Layout */}
			<div className="max-w-7xl mx-auto px-4 py-8">
				<div className="flex gap-8">
					{/* Table of Contents - Desktop Sidebar */}
					<div
						className="hidden lg:block w-80 flex-shrink-0"
						data-aos="fade-right">
						<Suspense
							fallback={
								<div className="bg-white rounded-lg border border-gray-200 p-6">
									Memuat daftar isi...
								</div>
							}>
							<TableOfContents content={article.content} />
						</Suspense>
					</div>

					{/* Main Content */}
					<div className="flex-1 max-w-4xl">
						{/* Article Header */}
						<div
							className="mb-8"
							data-aos="fade-up">
							<h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
								{article.title}
							</h1>

							<div
								className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6"
								data-aos="fade-up"
								data-aos-delay="100">
								<div className="flex items-center bg-gray-100 px-3 py-2 rounded-full">
									<User className="w-4 h-4 mr-2 text-primary" />
									<span className="font-medium">{article.author}</span>
								</div>
								<div className="flex items-center bg-gray-100 px-3 py-2 rounded-full">
									<Calendar className="w-4 h-4 mr-2 text-primary" />
									<span>{formatDate(article.createdAt)}</span>
								</div>
								<div className="flex items-center bg-gray-100 px-3 py-2 rounded-full">
									<BookOpen className="w-4 h-4 mr-2 text-primary" />
									<span>{estimateReadingTime(article.content)} menit baca</span>
								</div>
							</div>

							{/* <p className="text-lg text-gray-600 leading-relaxed mb-8">
                {article.excerpt}
              </p> */}
						</div>

						{/* Featured Image */}
						<div
							className="mb-12"
							data-aos="zoom-in"
							data-aos-delay="200">
							<div className="relative overflow-hidden rounded-xl shadow-lg">
								<img
									src={article.image}
									alt={article.title}
									className="w-full h-96 md:h-[400px] object-cover"
									onError={(e) => {
										const target = e.target as HTMLImageElement;
										target.src = '/placeholder-article.jpg';
									}}
								/>
							</div>
						</div>

						{/* Article Content - with proper formatting */}
						<div
							className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
							data-aos="fade-up"
							data-aos-delay="300">
							<div className="p-8 md:p-12">
								<div className="prose prose-lg prose-gray max-w-none article-content">
									<div
										className="text-gray-800 leading-relaxed"
										dangerouslySetInnerHTML={{
											__html: formatContentForDisplay(article.content),
										}}
									/>
								</div>
							</div>
						</div>

						{/* Tags Section */}
						{article.tags && article.tags.length > 0 && (
							<div
								className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6"
								data-aos="fade-up"
								data-aos-delay="350">
								<div className="flex items-center gap-2 mb-4">
									<Tag className="w-5 h-5 text-primary" />
									<h3 className="text-lg font-semibold text-gray-900">Tags:</h3>
								</div>
								<div className="flex flex-wrap gap-2">
									{article.tags.map((tag, index) => (
										<Badge
											key={index}
											variant="secondary"
											className="cursor-pointer hover:bg-primary hover:text-white transition-colors"
											onClick={() => navigateToTaggedArticles(tag)}>
											{tag}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Article Footer */}
						<div
							className="mt-16 pt-8 border-t border-gray-200"
							data-aos="fade-up"
							data-aos-delay="400">
							<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
								<div className="text-sm text-gray-500">
									Artikel ini dipublikasikan pada{' '}
									{formatDate(article.createdAt)}
									{article.updatedAt &&
										article.updatedAt !== article.createdAt && (
											<span>
												{' '}
												• Diperbarui pada {formatDate(article.updatedAt)}
											</span>
										)}
								</div>
								<Button
									onClick={shareArticle}
									variant="outline"
									size="sm"
									className="text-gray-600 hover:text-gray-900">
									<Share2 className="w-4 h-4 mr-2" />
									Bagikan Artikel
								</Button>
							</div>
						</div>

						{/* Back to Articles */}
						<div
							className="mt-12 text-center"
							data-aos="fade-up"
							data-aos-delay="500">
							<Button
								onClick={() => setLocation('/')}
								variant="outline"
								className="px-8 py-3 bg-white hover:bg-gray-50 border-2 border-primary text-primary hover:text-primary font-semibold">
								<ArrowLeft className="w-4 h-4 mr-2" />
								Lihat Artikel Lainnya
							</Button>
						</div>
					</div>
				</div>

				{/* Table of Contents - Mobile */}
				<div className="lg:hidden">
					<Suspense
						fallback={
							<div className="fixed bottom-4 right-4 z-50">
								<button className="bg-primary text-white p-3 rounded-full shadow-lg">
									TOC
								</button>
							</div>
						}>
						<TableOfContents content={article.content} />
					</Suspense>
				</div>
			</div>
		</div>
	);
}
