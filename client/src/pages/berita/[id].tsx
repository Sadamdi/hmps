import AIChat from '@/components/public/ai-chat';
import CommentThread from '@/components/public/comment-thread';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import RichHtmlWithEmbeds from '@/components/public/rich-html-with-embeds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useTenant } from '@/lib/tenant-context';
import { DEFAULT_IMAGE_URL } from '@/constants/default-image';
import {
	formatContentDisplay as formatContentDisplayFn,
	formatContentForDisplay as formatContentForDisplayFn,
} from '@/utils/formatContent';
import { toSlug } from '@/utils/slug';
import { useQuery } from '@tanstack/react-query';
import {
	ArrowLeft,
	BookOpen,
	Calendar,
	CalendarDays,
	Images,
	Share2,
	Tag,
	User,
} from 'lucide-react';
import { Suspense, lazy, useEffect } from 'react';
import { Link, useLocation, useParams } from 'wouter';

const TableOfContents = lazy(
	() => import('@/components/berita/table-of-contents'),
);

interface BeritaItem {
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

interface RelatedBerita {
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

export default function BeritaDetail() {
	const { id, slug } = useParams<{ id?: string; slug?: string }>();
	const [, setLocation] = useLocation();
	const { basePath } = useTenant();
	const bp = basePath || '';
	const isObjectId = (v?: string) => !!v && /^[a-f\d]{24}$/i.test(v);
	const isLegacyHybridRoute = !!id && !!slug;
	const normalizedSlug = isLegacyHybridRoute
		? slug
		: slug && !isObjectId(slug)
			? slug
			: undefined;
	const fallbackId = isLegacyHybridRoute
		? id
		: slug && isObjectId(slug)
			? slug
			: undefined;
	const scrollToSection = (sectionId: string) => {
		window.location.href = bp ? `${bp}/#${sectionId}` : `/#${sectionId}`;
	};

	const apiEndpoint = normalizedSlug
		? `/api/berita/slug/${normalizedSlug}`
		: fallbackId
			? `/api/berita/${fallbackId}`
			: '';

	const {
		data: berita,
		isLoading,
		error,
	} = useQuery<BeritaItem>({
		queryKey: [apiEndpoint],
		queryFn: async () => {
			const response = await apiRequest('GET', apiEndpoint);
			return response.json();
		},
		enabled: !!apiEndpoint,
	});

	const relatedEndpoint = normalizedSlug
		? `/api/berita/slug/${normalizedSlug}/related?limit=2`
		: fallbackId
			? `/api/berita/${fallbackId}/related?limit=2`
			: '';

	const { data: related = [] } = useQuery<RelatedBerita[]>({
		queryKey: [relatedEndpoint],
		queryFn: async () => {
			const response = await apiRequest('GET', relatedEndpoint);
			return response.json();
		},
		enabled: !!relatedEndpoint,
		placeholderData: [],
	});

	const eventsEndpoint = normalizedSlug
		? `/api/berita/slug/${normalizedSlug}/events`
		: fallbackId
			? `/api/berita/${fallbackId}/events`
			: '';

	const { data: linkedEvents = [] } = useQuery<
		{
			_id: string;
			title: string;
			yearId: { year: number };
			startDate: string;
			endDate: string;
		}[]
	>({
		queryKey: [eventsEndpoint],
		queryFn: async () => {
			const response = await fetch(eventsEndpoint);
			if (!response.ok) return [];
			return response.json();
		},
		enabled: !!eventsEndpoint,
		placeholderData: [],
	});

	useEffect(() => {
		// Normalize old /berita/:id/:slug links to /berita/:slug
		if (isLegacyHybridRoute && slug) {
			setLocation(`/berita/${slug}`);
		}
	}, [isLegacyHybridRoute, setLocation, slug]);

	useEffect(() => {
		if (berita) {
			document.title = `${berita.title} | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang`;

			const metaDescription = document.querySelector(
				'meta[name="description"]',
			);
			const descContent =
				berita.excerpt ||
				`${berita.title} - Berita dari Himatif Encoder, Himpunan Mahasiswa Teknik Informatika UIN Malang.`;
			if (metaDescription) {
				metaDescription.setAttribute('content', descContent);
			} else {
				const newMeta = document.createElement('meta');
				newMeta.name = 'description';
				newMeta.content = descContent;
				document.head.appendChild(newMeta);
			}

			const canonicalUrl = `https://himatif-encoder.com/berita/${berita.slug || normalizedSlug || ''}`;
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
				{ property: 'og:title', content: berita.title },
				{ property: 'og:description', content: berita.excerpt || descContent },
				{ property: 'og:type', content: 'article' },
				{ property: 'og:url', content: canonicalUrl },
				{ property: 'og:image', content: berita.image },
				{ property: 'og:site_name', content: 'Himatif Encoder' },
				{ property: 'article:published_time', content: berita.createdAt },
				{ property: 'article:author', content: berita.author },
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

			const existingScript = document.querySelector(
				'script[type="application/ld+json"]',
			);
			if (existingScript) existingScript.remove();

			const script = document.createElement('script');
			script.type = 'application/ld+json';
			script.textContent = JSON.stringify({
				'@context': 'https://schema.org',
				'@type': 'Article',
				headline: berita.title,
				description: berita.excerpt || descContent,
				image: berita.image,
				author: { '@type': 'Person', name: berita.author },
				publisher: {
					'@type': 'Organization',
					name: 'Himatif Encoder',
					url: 'https://himatif-encoder.com',
				},
				datePublished: berita.createdAt,
				dateModified: berita.updatedAt || berita.createdAt,
				mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
				keywords: berita.tags?.join(', ') || '',
				inLanguage: 'id-ID',
			});
			document.head.appendChild(script);
		}
	}, [berita, normalizedSlug]);

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

	const shareBerita = () => {
		if (navigator.share) {
			navigator.share({
				title: berita?.title,
				text: berita?.excerpt,
				url: window.location.href,
			});
		} else {
			navigator.clipboard.writeText(window.location.href);
		}
	};

	const navigateToTaggedBerita = (tag: string) => {
		setLocation(`/berita?tag=${encodeURIComponent(tag)}`);
	};

	const formatForDisplay = (html: string) => {
		try {
			if (typeof formatContentForDisplayFn === 'function')
				return formatContentForDisplayFn(html);
			if (typeof formatContentDisplayFn === 'function')
				return formatContentDisplayFn(html as any);
			return html || '';
		} catch (_e) {
			return html || '';
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background">
				<Navbar
					activeSection="berita"
					scrollToSection={scrollToSection}
				/>
				<div className="max-w-7xl mx-auto px-4 py-8">
					<div className="flex gap-8">
						<div className="hidden lg:block w-80 flex-shrink-0">
							<div className="bg-card border border-border rounded-xl p-6 animate-pulse">
								<div className="h-5 bg-muted rounded w-3/4 mb-6" />
								<div className="space-y-3">
									{[...Array(5)].map((_, i) => (
										<div
											key={i}
											className="h-4 bg-muted rounded w-full"
										/>
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

	if (error || !berita) {
		return (
			<div className="min-h-screen bg-background flex flex-col">
				<Navbar
					activeSection="berita"
					scrollToSection={scrollToSection}
				/>
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<h1 className="text-2xl font-bold text-foreground mb-4">
							Berita tidak ditemukan
						</h1>
						<Button
							onClick={() => setLocation('/')}
							variant="outline">
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
			<Navbar
				activeSection="berita"
				scrollToSection={scrollToSection}
			/>

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
							Berita
						</Button>
						<span className="text-border">/</span>
						<span className="text-foreground font-medium truncate max-w-xs">
							{berita.title}
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
					<div
						className="hidden lg:block w-80 flex-shrink-0"
						data-aos="fade-right">
						<Suspense
							fallback={
								<div className="bg-card border border-border rounded-xl p-6 text-muted-foreground text-sm">
									Memuat daftar isi...
								</div>
							}>
							<TableOfContents content={berita.content} />
						</Suspense>
					</div>

					{/* Main Content */}
					<div className="flex-1 max-w-4xl">
						{/* Header Berita */}
						<div
							className="mb-8"
							data-aos="fade-up">
							<h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-5">
								{berita.title}
							</h1>

							<div
								className="flex flex-wrap items-center gap-3 text-sm mb-6"
								data-aos="fade-up"
								data-aos-delay="100">
								<div className="flex items-center bg-muted px-3 py-1.5 rounded-full gap-1.5">
									<User className="w-3.5 h-3.5 text-primary" />
									<span className="font-medium text-foreground">
										{(berita as any).authorsDisplay || berita.author}
									</span>
								</div>
								<div className="flex items-center bg-muted px-3 py-1.5 rounded-full gap-1.5">
									<Calendar className="w-3.5 h-3.5 text-primary" />
									<span className="text-foreground">
										{formatDate(berita.createdAt)}
									</span>
								</div>
								<div className="flex items-center bg-muted px-3 py-1.5 rounded-full gap-1.5">
									<BookOpen className="w-3.5 h-3.5 text-primary" />
									<span className="text-foreground">
										{estimateReadingTime(berita.content)} menit baca
									</span>
								</div>
								<div className="flex items-center bg-muted px-3 py-1.5 rounded-full gap-1.5">
									<span className="text-foreground">
										{berita.viewCount ?? 0} pembaca
									</span>
								</div>
							</div>
						</div>

						{/* Featured Image */}
						<div
							className="mb-10"
							data-aos="zoom-in"
							data-aos-delay="150">
							<div className="relative overflow-hidden rounded-xl shadow-lg">
								<img
									src={berita.image}
									alt={berita.title}
									className="w-full h-80 md:h-[400px] object-cover"
									onError={(e) => {
										const target = e.target as HTMLImageElement;
										target.src = DEFAULT_IMAGE_URL;
									}}
								/>
							</div>
						</div>

						{/* Konten Berita */}
						<div
							className="bg-card rounded-xl shadow-sm border border-border overflow-hidden"
							data-aos="fade-up"
							data-aos-delay="200">
							<div className="p-6 md:p-10">
								<RichHtmlWithEmbeds
									content={berita.content}
									className="prose prose-lg max-w-none berita-content prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-a:text-primary prose-blockquote:text-muted-foreground dark:prose-invert text-foreground leading-relaxed"
								/>
							</div>
						</div>

						{/* Tags */}
						{berita.tags && berita.tags.length > 0 && (
							<div
								className="mt-6 bg-card rounded-xl shadow-sm border border-border p-5"
								data-aos="fade-up"
								data-aos-delay="250">
								<div className="flex items-center gap-2 mb-3">
									<Tag className="w-4 h-4 text-primary" />
									<h3 className="text-base font-semibold text-foreground">
										Tags:
									</h3>
								</div>
								<div className="flex flex-wrap gap-2">
									{berita.tags.map((tag, index) => (
										<Badge
											key={index}
											variant="secondary"
											className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
											onClick={() => navigateToTaggedBerita(tag)}>
											{tag}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Galeri terkait */}
						{berita.relatedGalleryPreview &&
							berita.relatedGalleryPreview.length > 0 && (
								<div
									className="mt-6 bg-card rounded-xl shadow-sm border border-border p-5"
									data-aos="fade-up"
									data-aos-delay="255">
									<div className="flex items-center gap-2 mb-3">
										<Images className="w-4 h-4 text-primary" />
										<h3 className="text-base font-semibold text-foreground">
											Galeri Terkait
										</h3>
									</div>
									<div className="flex flex-wrap gap-2">
										{berita.relatedGalleryPreview.map((g) => (
											<Link
												key={g._id}
												href={`/library/${toSlug(g.title) || g._id}`}>
												<Badge
													variant="outline"
													className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors gap-1.5 text-sm py-1 px-3">
													<Images className="w-3 h-3" />
													{g.title}
												</Badge>
											</Link>
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
									<h3 className="text-base font-semibold text-foreground">
										Bagian dari Event
									</h3>
								</div>
								<div className="flex flex-wrap gap-2">
									{linkedEvents.map((ev) => {
										const year = ev.yearId?.year;
										return (
											<Link
												key={ev._id}
												href={
													year
														? `/events/${year}/${toSlug(ev.title) || ev._id}`
														: '/events'
												}>
												<Badge
													variant="outline"
													className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors gap-1.5 text-sm py-1 px-3">
													<CalendarDays className="w-3 h-3" />
													{ev.title}
													{year && (
														<span className="text-muted-foreground">
															({year})
														</span>
													)}
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
									Dipublikasikan pada {formatDate(berita.createdAt)}
									{berita.updatedAt &&
										berita.updatedAt !== berita.createdAt && (
											<span>
												{' '}
												• Diperbarui pada {formatDate(berita.updatedAt)}
											</span>
										)}
								</div>
								<Button
									onClick={shareBerita}
									variant="outline"
									size="sm"
									className="text-muted-foreground hover:text-foreground border-border">
									<Share2 className="w-4 h-4 mr-2" />
									Bagikan Berita
								</Button>
							</div>
						</div>

						{/* Berita Terkait */}
						<div
							className="mt-10 bg-card rounded-xl shadow-sm border border-border p-6"
							data-aos="fade-up"
							data-aos-delay="350">
							<h3 className="text-xl font-bold text-foreground mb-5">
								Berita Terkait
							</h3>
							{related && related.length > 0 ? (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
									{related.slice(0, 2).map((r, idx) => {
										const href = r.slug
											? `/berita/${r.slug}`
											: `/berita/${r._id || r.id}`;
										return (
											<div
												key={String(r._id || r.id || idx) + '-' + idx}
												className="group cursor-pointer bg-muted/40 rounded-lg overflow-hidden border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200"
												onClick={() => setLocation(href)}>
												<div className="aspect-video overflow-hidden">
													<img
														src={r.image || DEFAULT_IMAGE_URL}
														alt={r.title}
														className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
														onError={(e) => {
															(e.target as HTMLImageElement).src =
																DEFAULT_IMAGE_URL;
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
																<Badge
																	key={i}
																	variant="secondary"
																	className="text-xs">
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
								<div className="text-muted-foreground text-sm">
									Belum ada Berita Terkait.
								</div>
							)}
						</div>

						{/* Komentar */}
						{(berita._id || berita.id) && (
							<CommentThread
								targetType="berita"
								targetId={(berita._id || String(berita.id))!}
							/>
						)}

						{/* Back button */}
						<div
							className="mt-8 text-center"
							data-aos="fade-up"
							data-aos-delay="400">
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
						<TableOfContents content={berita.content} />
					</Suspense>
				</div>
			</div>

			<Footer />

			{/* AI Chat dengan context berita yang sedang dibaca */}
			<AIChat
				pageContext={{
					path: `/berita/${berita.slug || normalizedSlug || fallbackId || ''}`,
					permissions: [],
					pageData: {
						title: berita.title,
						excerpt: berita.excerpt,
					},
				}}
			/>
		</div>
	);
}
