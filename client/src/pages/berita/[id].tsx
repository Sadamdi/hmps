import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { apiRequest } from '@/lib/queryClient';
import {
	formatContentDisplay as formatContentDisplayFn,
	formatContentForDisplay as formatContentForDisplayFn,
} from '@/utils/formatContent';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Calendar, CalendarDays, Share2, Tag, User } from 'lucide-react';
import { Suspense, lazy, useEffect } from 'react';
import { Link, useLocation, useParams } from 'wouter';

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
	viewCount?: number;
}

interface RelatedArticle {
	_id?: string;
	id?: number;
	title: string;
	excerpt: string;
	image: string;
	author: string;
	createdAt: string;
	slug?: string;
	tags?: string[];
}

export default function ArticleDetail() {
	const { id, slug } = useParams();
	const [, setLocation] = useLocation();

	const scrollToSection = (sectionId: string) => {
		window.location.href = `/#${sectionId}`;
	};

	let apiEndpoint: string;
	let isHybridRoute = false;

	if (id && slug) {
		apiEndpoint = `/api/berita/${id}/${slug}`;
		isHybridRoute = true;
	} else if (slug && !id) {
		apiEndpoint = `/api/berita/slug/${slug}`;
	} else {
		apiEndpoint = `/api/berita/${id}`;
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

	let relatedEndpoint: string | null = null;
	if (id) {
		relatedEndpoint = `/api/berita/${id}/related?limit=2`;
	} else if (slug && !id) {
		relatedEndpoint = `/api/berita/slug/${slug}/related?limit=2`;
	}

	const { data: related = [] } = useQuery<RelatedArticle[]>({
		queryKey: [relatedEndpoint || ''],
		queryFn: async () => {
			const response = await apiRequest('GET', relatedEndpoint as string);
			return response.json();
		},
		enabled: !!relatedEndpoint,
		placeholderData: [],
	});

	const articleId = id || null;

	const { data: linkedEvents = [] } = useQuery<{ _id: string; title: string; yearId: { year: number }; startDate: string; endDate: string }[]>({
		queryKey: [`/api/berita/${articleId}/events`],
		queryFn: async () => {
			const response = await fetch(`/api/berita/${articleId}/events`);
			if (!response.ok) return [];
			return response.json();
		},
		enabled: !!articleId,
		placeholderData: [],
	});

	useEffect(() => {
		if (article) {
			document.title = `${article.title} | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang`;

			const metaDescription = document.querySelector('meta[name="description"]');
			const descContent =
				article.excerpt ||
				`${article.title} - Berita dari Himatif Encoder, Himpunan Mahasiswa Teknik Informatika UIN Malang.`;
			if (metaDescription) {
				metaDescription.setAttribute('content', descContent);
			} else {
				const newMeta = document.createElement('meta');
				newMeta.name = 'description';
				newMeta.content = descContent;
				document.head.appendChild(newMeta);
			}

			const canonicalUrl = `https://himatif-encoder.com/berita/${
				article._id || article.id
			}/${article.slug || slug || ''}`;
			const canonical = document.querySelector('link[rel="canonical"]');
			if (canonical) {
				canonical.setAttribute('href', canonicalUrl);
			} else {
				const newCanonical = document.createElement('link');
				newCanonical.rel = 'canonical';
				newCanonical.href = canonicalUrl;
				document.head.appendChild(newCanonical);
			}

			const ogTags = [
				{ property: 'og:title', content: article.title },
				{ property: 'og:description', content: article.excerpt || descContent },
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

			const existingScript = document.querySelector('script[type="application/ld+json"]');
			if (existingScript) existingScript.remove();

			const script = document.createElement('script');
			script.type = 'application/ld+json';
			script.textContent = JSON.stringify({
				'@context': 'https://schema.org',
				'@type': 'Article',
				headline: article.title,
				description: article.excerpt || descContent,
				image: article.image,
				author: { '@type': 'Person', name: article.author },
				publisher: {
					'@type': 'Organization',
					name: 'Himatif Encoder',
					url: 'https://himatif-encoder.com',
				},
				datePublished: article.createdAt,
				dateModified: article.updatedAt || article.createdAt,
				mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
				keywords: article.tags?.join(', ') || '',
				inLanguage: 'id-ID',
			});
			document.head.appendChild(script);
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
		const textContent = content.replace(/<[^>]*>/g, '');
		const wordCount = textContent.split(/\s+/).length;
		return Math.ceil(wordCount / 200);
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
		}
	};

	const navigateToTaggedArticles = (tag: string) => {
		setLocation(`/berita?tag=${encodeURIComponent(tag)}`);
	};

	const formatForDisplay = (html: string) => {
		try {
			if (typeof formatContentForDisplayFn === 'function') return formatContentForDisplayFn(html);
			if (typeof formatContentDisplayFn === 'function') return formatContentDisplayFn(html as any);
			return html || '';
		} catch (_e) {
			return html || '';
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background">
				<Navbar activeSection="berita" scrollToSection={scrollToSection} />
				<div className="max-w-7xl mx-auto px-4 py-8">
					<div className="flex gap-8">
						<div className="hidden lg:block w-80 flex-shrink-0">
							<div className="bg-card border border-border rounded-xl p-6 animate-pulse">
								<div className="h-5 bg-muted rounded w-3/4 mb-6" />
								<div className="space-y-3">
									{[...Array(5)].map((_, i) => (
										<div key={i} className="h-4 bg-muted rounded w-full" />
									))}
								</div>
							</div>
						</div>
						<div className="flex-1 max-w-4xl animate-pulse">
							<div className="h-10 bg-muted rounded w-3/4 mb-4" />
							<div className="h-4 bg-muted rounded w-1/2 mb-8" />
							<div className="h-96 bg-muted rounded mb-8" />
							<div className="space-y-3">
								<div className="h-4 bg-muted rounded" />
								<div className="h-4 bg-muted rounded" />
								<div className="h-4 bg-muted rounded w-5/6" />
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error || !article) {
		return (
			<div className="min-h-screen bg-background flex flex-col">
				<Navbar activeSection="berita" scrollToSection={scrollToSection} />
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<h1 className="text-2xl font-bold text-foreground mb-4">
							Berita tidak ditemukan
						</h1>
						<Button onClick={() => setLocation('/')} variant="outline">
							<ArrowLeft className="w-4 h-4 mr-2" />
							Kembali ke Beranda
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background relative">
			<Navbar activeSection="berita" scrollToSection={scrollToSection} />

			{/* Breadcrumb bar */}
			<div className="bg-card border-b border-border">
				<div className="max-w-7xl mx-auto px-4 py-3">
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
						<Button
							onClick={() => setLocation('/')}
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors p-1 h-auto">
							Beranda
						</Button>
						<span className="text-border">/</span>
						<Button
							onClick={() => setLocation('/berita')}
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors p-1 h-auto">
							Artikel
						</Button>
						<span className="text-border">/</span>
						<span className="text-foreground font-medium truncate max-w-xs">
							{article.title}
						</span>
					</div>
					<Button
						onClick={() => setLocation('/berita')}
						variant="ghost"
						size="sm"
						className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
						<ArrowLeft className="w-4 h-4 mr-2" />
						Kembali ke Berita
					</Button>
				</div>
			</div>

			{/* Main Layout */}
			<div className="max-w-7xl mx-auto px-4 py-8">
				<div className="flex gap-8">
					{/* Table of Contents - Desktop Sidebar */}
					<div className="hidden lg:block w-80 flex-shrink-0" data-aos="fade-right">
						<Suspense
							fallback={
								<div className="bg-card border border-border rounded-xl p-6 text-muted-foreground text-sm">
									Memuat daftar isi...
								</div>
							}>
							<TableOfContents content={article.content} />
						</Suspense>
					</div>

					{/* Main Content */}
					<div className="flex-1 max-w-4xl">
						{/* Article Header */}
						<div className="mb-8" data-aos="fade-up">
							<h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-5">
								{article.title}
							</h1>

							<div
								className="flex flex-wrap items-center gap-3 text-sm mb-6"
								data-aos="fade-up"
								data-aos-delay="100">
								<div className="flex items-center bg-muted px-3 py-1.5 rounded-full gap-1.5">
									<User className="w-3.5 h-3.5 text-primary" />
									<span className="font-medium text-foreground">{article.author}</span>
								</div>
								<div className="flex items-center bg-muted px-3 py-1.5 rounded-full gap-1.5">
									<Calendar className="w-3.5 h-3.5 text-primary" />
									<span className="text-foreground">{formatDate(article.createdAt)}</span>
								</div>
								<div className="flex items-center bg-muted px-3 py-1.5 rounded-full gap-1.5">
									<BookOpen className="w-3.5 h-3.5 text-primary" />
									<span className="text-foreground">
										{estimateReadingTime(article.content)} menit baca
									</span>
								</div>
								<div className="flex items-center bg-muted px-3 py-1.5 rounded-full gap-1.5">
									<span className="text-foreground">
										{article.viewCount ?? 0} pembaca
									</span>
								</div>
							</div>
						</div>

						{/* Featured Image */}
						<div className="mb-10" data-aos="zoom-in" data-aos-delay="150">
							<div className="relative overflow-hidden rounded-xl shadow-lg">
								<img
									src={article.image}
									alt={article.title}
									className="w-full h-80 md:h-[400px] object-cover"
									onError={(e) => {
										const target = e.target as HTMLImageElement;
										target.src = '/placeholder-article.jpg';
									}}
								/>
							</div>
						</div>

						{/* Article Content */}
						<div
							className="bg-card rounded-xl shadow-sm border border-border overflow-hidden"
							data-aos="fade-up"
							data-aos-delay="200">
							<div className="p-6 md:p-10">
								<div className="prose prose-lg max-w-none article-content">
									<div
										className="text-foreground leading-relaxed"
										dangerouslySetInnerHTML={{
											__html: formatForDisplay(article.content),
										}}
									/>
								</div>
							</div>
						</div>

						{/* Tags */}
						{article.tags && article.tags.length > 0 && (
							<div
								className="mt-6 bg-card rounded-xl shadow-sm border border-border p-5"
								data-aos="fade-up"
								data-aos-delay="250">
								<div className="flex items-center gap-2 mb-3">
									<Tag className="w-4 h-4 text-primary" />
									<h3 className="text-base font-semibold text-foreground">Tags:</h3>
								</div>
								<div className="flex flex-wrap gap-2">
									{article.tags.map((tag, index) => (
										<Badge
											key={index}
											variant="secondary"
											className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
											onClick={() => navigateToTaggedArticles(tag)}>
											{tag}
										</Badge>
									))}
								</div>
							</div>
						)}

					{/* Event Badge */}
					{linkedEvents && linkedEvents.length > 0 && (
						<div
							className="mt-6 bg-card rounded-xl shadow-sm border border-border p-5"
							data-aos="fade-up"
							data-aos-delay="260">
							<div className="flex items-center gap-2 mb-3">
								<CalendarDays className="w-4 h-4 text-primary" />
								<h3 className="text-base font-semibold text-foreground">Bagian dari Event</h3>
							</div>
							<div className="flex flex-wrap gap-2">
								{linkedEvents.map((ev) => {
									const year = ev.yearId?.year;
									return (
										<Link
											key={ev._id}
											href={year ? `/events/${year}/${ev._id}` : '/events'}
										>
											<Badge
												variant="outline"
												className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors gap-1.5 text-sm py-1 px-3"
											>
												<CalendarDays className="w-3 h-3" />
												{ev.title}
												{year && <span className="text-muted-foreground">({year})</span>}
											</Badge>
										</Link>
									);
								})}
							</div>
						</div>
					)}

					{/* Footer */}
					<div
						className="mt-12 pt-6 border-t border-border"
						data-aos="fade-up"
						data-aos-delay="300">
							<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
								<div className="text-sm text-muted-foreground">
									Dipublikasikan pada {formatDate(article.createdAt)}
									{article.updatedAt && article.updatedAt !== article.createdAt && (
										<span> • Diperbarui pada {formatDate(article.updatedAt)}</span>
									)}
								</div>
								<Button
									onClick={shareArticle}
									variant="outline"
									size="sm"
									className="text-muted-foreground hover:text-foreground border-border">
									<Share2 className="w-4 h-4 mr-2" />
									Bagikan Berita
								</Button>
							</div>
						</div>

						{/* Related Articles */}
						<div
							className="mt-10 bg-card rounded-xl shadow-sm border border-border p-6"
							data-aos="fade-up"
							data-aos-delay="350">
							<h3 className="text-xl font-bold text-foreground mb-5">Berita Terkait</h3>
							{related && related.length > 0 ? (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
									{related.slice(0, 2).map((r, idx) => {
										const rid = (r._id || r.id) as string | number;
										const href =
											r.slug && rid
												? `/berita/${rid}/${r.slug}`
												: `/berita/${rid}`;
										return (
											<div
												key={String(rid) + '-' + idx}
												className="group cursor-pointer bg-muted/40 rounded-lg overflow-hidden border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200"
												onClick={() => setLocation(href)}>
												<div className="aspect-video overflow-hidden">
													<img
														src={r.image}
														alt={r.title}
														className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
														onError={(e) => {
															(e.target as HTMLImageElement).src =
																'/placeholder-article.jpg';
														}}
													/>
												</div>
												<div className="p-4">
													<h4 className="text-base font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
														{r.title}
													</h4>
													<p className="text-sm text-muted-foreground line-clamp-2 mb-2">
														{r.excerpt}
													</p>
													{r.tags && r.tags.length > 0 && (
														<div className="flex flex-wrap gap-1">
															{r.tags.slice(0, 3).map((t, i) => (
																<Badge key={i} variant="secondary" className="text-xs">
																	{t}
																</Badge>
															))}
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<div className="text-muted-foreground text-sm">Belum ada Berita Terkait.</div>
							)}
						</div>

						{/* Back button */}
						<div className="mt-8 text-center" data-aos="fade-up" data-aos-delay="400">
							<Button
								onClick={() => setLocation('/')}
								variant="outline"
								className="px-8 py-2.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold transition-colors">
								<ArrowLeft className="w-4 h-4 mr-2" />
								Kembali ke Beranda
							</Button>
						</div>
					</div>
				</div>

				{/* Table of Contents — Mobile */}
				<div className="lg:hidden">
					<Suspense
						fallback={
							<div className="fixed bottom-4 right-4 z-50">
								<button className="bg-primary text-primary-foreground p-3 rounded-full shadow-lg">
									TOC
								</button>
							</div>
						}>
						<TableOfContents content={article.content} />
					</Suspense>
				</div>
			</div>

		<Footer />

		{/* AI Chat dengan context berita yang sedang dibaca */}
		<AIChat
			pageContext={{
				path: `/berita/${article._id || article.id || id || ''}`,
				permissions: [],
				pageData: {
					title: article.title,
					excerpt: article.excerpt,
				},
			}}
		/>
	</div>
);
}
