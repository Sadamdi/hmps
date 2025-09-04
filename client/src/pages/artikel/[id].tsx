import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import {
	formatContentDisplay as formatContentDisplayFn,
	formatContentForDisplay as formatContentForDisplayFn,
} from '@/utils/formatContent';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Calendar, Share2, Tag, User } from 'lucide-react';
import { Suspense, lazy, useEffect } from 'react';
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
	slug?: string;
}

export default function ArticleDetail() {
	const { id, slug } = useParams();
	const [, setLocation] = useLocation();

	// Debug logging

	// Determine route type and construct API endpoint
	let apiEndpoint: string;
	let isHybridRoute = false;

	if (id && slug) {
		// Hybrid route: /artikel/:id/:slug
		apiEndpoint = `/api/articles/${id}/${slug}`;
		isHybridRoute = true;
	} else if (slug && !id) {
		// Slug-only route: /artikel/slug/:slug
		apiEndpoint = `/api/articles/slug/${slug}`;
	} else {
		// ID-only route: /artikel/:id (legacy)
		apiEndpoint = `/api/articles/${id}`;
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

	// SEO Meta Tags dan Structured Data
	useEffect(() => {
		if (article) {
			// Update document title
			document.title = `${article.title} | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang`;

			// Update meta description
			const metaDescription = document.querySelector(
				'meta[name="description"]'
			);
			if (metaDescription) {
				metaDescription.setAttribute(
					'content',
					article.excerpt ||
						`${
							article.title
						} - Artikel dari Himatif Encoder, Himpunan Mahasiswa Teknik Informatika UIN Malang. Baca artikel lengkap tentang ${article.title.toLowerCase()}.`
				);
			} else {
				const newMeta = document.createElement('meta');
				newMeta.name = 'description';
				newMeta.content =
					article.excerpt ||
					`${
						article.title
					} - Artikel dari Himatif Encoder, Himpunan Mahasiswa Teknik Informatika UIN Malang. Baca artikel lengkap tentang ${article.title.toLowerCase()}.`;
				document.head.appendChild(newMeta);
			}

			// Add canonical URL
			const canonical = document.querySelector('link[rel="canonical"]');
			const canonicalUrl = `https://himatif-encoder.com/artikel/${
				article._id || article.id
			}/${article.slug || slug || ''}`;
			if (canonical) {
				canonical.setAttribute('href', canonicalUrl);
			} else {
				const newCanonical = document.createElement('link');
				newCanonical.rel = 'canonical';
				newCanonical.href = canonicalUrl;
				document.head.appendChild(newCanonical);
			}

			// Add Open Graph tags
			const ogTags = [
				{ property: 'og:title', content: article.title },
				{
					property: 'og:description',
					content:
						article.excerpt ||
						`${article.title} - Artikel dari Himatif Encoder, Himpunan Mahasiswa Teknik Informatika UIN Malang`,
				},
				{ property: 'og:type', content: 'article' },
				{ property: 'og:url', content: canonicalUrl },
				{ property: 'og:image', content: article.image },
				{ property: 'og:site_name', content: 'Himatif Encoder' },
				{ property: 'article:published_time', content: article.createdAt },
				{ property: 'article:author', content: article.author },
			];

			ogTags.forEach(({ property, content }) => {
				let meta = document.querySelector(`meta[property="${property}"]`);
				if (meta) {
					meta.setAttribute('content', content);
				} else {
					meta = document.createElement('meta');
					meta.setAttribute('property', property);
					meta.setAttribute('content', content);
					document.head.appendChild(meta);
				}
			});

			// Add Twitter Card tags
			const twitterTags = [
				{ name: 'twitter:card', content: 'summary_large_image' },
				{ name: 'twitter:title', content: article.title },
				{
					name: 'twitter:description',
					content:
						article.excerpt ||
						`${article.title} - Artikel dari Himatif Encoder`,
				},
				{ name: 'twitter:image', content: article.image },
			];

			twitterTags.forEach(({ name, content }) => {
				let meta = document.querySelector(`meta[name="${name}"]`);
				if (meta) {
					meta.setAttribute('content', content);
				} else {
					meta = document.createElement('meta');
					meta.setAttribute('name', name);
					meta.setAttribute('content', content);
					document.head.appendChild(meta);
				}
			});

			// Add structured data (JSON-LD)
			const structuredData = {
				'@context': 'https://schema.org',
				'@type': 'Article',
				headline: article.title,
				description:
					article.excerpt ||
					`${article.title} - Artikel dari Himatif Encoder, Himpunan Mahasiswa Teknik Informatika UIN Malang`,
				image: article.image,
				author: {
					'@type': 'Person',
					name: article.author,
				},
				publisher: {
					'@type': 'Organization',
					name: 'Himatif Encoder',
					alternateName: 'Himpunan Mahasiswa Teknik Informatika UIN Malang',
					url: 'https://himatif-encoder.com',
					logo: {
						'@type': 'ImageObject',
						url: 'https://himatif-encoder.com/attached_assets/general/logo.png',
					},
				},
				datePublished: article.createdAt,
				dateModified: article.updatedAt || article.createdAt,
				mainEntityOfPage: {
					'@type': 'WebPage',
					'@id': canonicalUrl,
				},
				keywords: article.tags
					? article.tags.join(', ')
					: 'himatif encoder, himpunan mahasiswa teknik informatika, uin malang, artikel teknologi, fakultas sains dan teknologi',
				articleSection: 'Artikel',
				inLanguage: 'id-ID',
			};

			// Remove existing structured data
			const existingScript = document.querySelector(
				'script[type="application/ld+json"]'
			);
			if (existingScript) {
				existingScript.remove();
			}

			// Add new structured data
			const script = document.createElement('script');
			script.type = 'application/ld+json';
			script.textContent = JSON.stringify(structuredData);
			document.head.appendChild(script);

			// Add breadcrumb structured data
			const breadcrumbData = {
				'@context': 'https://schema.org',
				'@type': 'BreadcrumbList',
				itemListElement: [
					{
						'@type': 'ListItem',
						position: 1,
						name: 'Beranda',
						item: 'https://himatif-encoder.com',
					},
					{
						'@type': 'ListItem',
						position: 2,
						name: 'Artikel',
						item: 'https://himatif-encoder.com/artikel',
					},
					{
						'@type': 'ListItem',
						position: 3,
						name: article.title,
						item: canonicalUrl,
					},
				],
			};

			const breadcrumbScript = document.createElement('script');
			breadcrumbScript.type = 'application/ld+json';
			breadcrumbScript.textContent = JSON.stringify(breadcrumbData);
			document.head.appendChild(breadcrumbScript);
		}
	}, [article, id, slug]);

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

	// Wrapper aman untuk kompatibilitas bundel lama/baru
	const formatForDisplay = (html: string) => {
		try {
			if (typeof formatContentForDisplayFn === 'function') {
				return formatContentForDisplayFn(html);
			}
			if (typeof formatContentDisplayFn === 'function') {
				return formatContentDisplayFn(html as any);
			}
			return html || '';
		} catch (_e) {
			return html || '';
		}
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
			{/* Navigation Bar with Breadcrumbs */}
			<div className="bg-white border-b border-gray-200">
				<div className="max-w-7xl mx-auto px-4 py-4">
					<div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
						<Button
							onClick={() => setLocation('/')}
							variant="ghost"
							size="sm"
							className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors p-1 h-auto">
							Beranda
						</Button>
						<span>/</span>
						<Button
							onClick={() => setLocation('/artikel')}
							variant="ghost"
							size="sm"
							className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors p-1 h-auto">
							Artikel
						</Button>
						<span>/</span>
						<span className="text-gray-900 font-medium truncate max-w-xs">
							{article.title}
						</span>
					</div>
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
											__html: formatForDisplay(article.content),
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

						{/* Related Articles Section */}
						<div
							className="mt-12 bg-white rounded-xl shadow-sm border border-gray-100 p-8"
							data-aos="fade-up"
							data-aos-delay="500">
							<h3 className="text-2xl font-bold text-gray-900 mb-6">
								Artikel Terkait Himatif Encoder
							</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="bg-gray-50 rounded-lg p-6">
									<h4 className="text-lg font-semibold text-gray-900 mb-2">
										Artikel Himatif Encoder
									</h4>
									<p className="text-gray-600 mb-4">
										Temukan artikel menarik lainnya dari Himpunan Mahasiswa
										Teknik Informatika UIN Malang
									</p>
									<Button
										onClick={() => setLocation('/artikel')}
										variant="outline"
										className="w-full">
										Lihat Semua Artikel
									</Button>
								</div>
								<div className="bg-gray-50 rounded-lg p-6">
									<h4 className="text-lg font-semibold text-gray-900 mb-2">
										Beranda Himatif Encoder
									</h4>
									<p className="text-gray-600 mb-4">
										Kembali ke halaman utama untuk melihat informasi lengkap
										tentang Himpunan Mahasiswa Teknik Informatika UIN Malang
									</p>
									<Button
										onClick={() => setLocation('/')}
										variant="outline"
										className="w-full">
										Kembali ke Beranda
									</Button>
								</div>
							</div>
						</div>

						{/* Back to Articles */}
						<div
							className="mt-8 text-center"
							data-aos="fade-up"
							data-aos-delay="600">
							<Button
								onClick={() => setLocation('/')}
								variant="outline"
								className="px-8 py-3 bg-white hover:bg-gray-50 border-2 border-primary text-primary hover:text-primary font-semibold">
								<ArrowLeft className="w-4 h-4 mr-2" />
								Kembali ke Beranda
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
