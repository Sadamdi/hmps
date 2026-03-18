import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import { usePagination } from '@/hooks/use-pagination';
import Navbar from '@/components/public/navbar';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { ArrowLeft, Calendar, Search, Tag, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';

interface Article {
	_id: string;
	slug?: string;
	title: string;
	excerpt: string;
	image: string;
	author: string;
	createdAt: string;
	tags: string[];
	viewCount?: number;
}

export default function AllArticles() {
	const [articles, setArticles] = useState<Article[]>([]);
	const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [allTags, setAllTags] = useState<string[]>([]);
	const articlesContainerRef = useRef<HTMLDivElement>(null);

	const scrollToSection = (id: string) => {
		window.location.href = `/#${id}`;
	};

	const {
		currentPage,
		totalPages,
		paginatedData: paginatedArticles,
		setCurrentPage,
	} = usePagination({
		data: filteredArticles,
		itemsPerPageDesktop: 9,
		itemsPerPageMobile: 6,
	});

	useEffect(() => {
		AOS.init({
			duration: 500,
			easing: 'ease-out',
			once: true,
		});
		fetchArticles();
	}, []);

	useEffect(() => {
		document.title =
			'Berita | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang';
		const desc =
			'Daftar berita dan informasi terkini dari Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang.';
		const meta = document.querySelector('meta[name="description"]');
		if (meta) meta.setAttribute('content', desc);
		return () => {
			document.title =
				'Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang | Fakultas Saintek';
		};
	}, []);

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const tagParam = urlParams.get('tag');
		if (tagParam) {
			setSelectedTags([tagParam]);
		}
	}, []);

	useEffect(() => {
		filterArticles();
	}, [articles, searchTerm, selectedTags]);

	const fetchArticles = async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch('/api/berita');
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			setArticles(data);
			const tags = new Set<string>();
			data.forEach((article: Article) => {
				if (article.tags) article.tags.forEach((tag) => tags.add(tag));
			});
			setAllTags(Array.from(tags).sort());
		} catch (error) {
			console.error('Error fetching articles:', error);
			setError('Gagal memuat berita. Silakan coba lagi.');
		} finally {
			setLoading(false);
		}
	};

	const filterArticles = () => {
		let filtered = articles;
		if (searchTerm) {
			filtered = filtered.filter(
				(article) =>
					article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
					article.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}
		if (selectedTags.length > 0) {
			filtered = filtered.filter(
				(article) =>
					article.tags && selectedTags.some((tag) => article.tags.includes(tag))
			);
		}
		setFilteredArticles(filtered);
		setCurrentPage(1);
	};

	const toggleTag = (tag: string) => {
		setSelectedTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
		);
	};

	const clearFilters = () => {
		setSearchTerm('');
		setSelectedTags([]);
	};

	useEffect(() => {
		if (articlesContainerRef.current) {
			articlesContainerRef.current.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		}
	}, [currentPage]);

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('id-ID', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-background">
				<Navbar activeSection="berita" scrollToSection={scrollToSection} />
				<div className="container mx-auto px-4 py-8">
					<div className="text-center py-24">
						<div className="animate-spin rounded-full h-14 w-14 border-b-2 border-primary mx-auto" />
						<p className="mt-4 text-muted-foreground">Memuat berita...</p>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-background">
				<Navbar activeSection="berita" scrollToSection={scrollToSection} />
				<div className="container mx-auto px-4 py-8">
					<div className="text-center py-24">
						<p className="text-destructive mb-4">{error}</p>
						<Button onClick={fetchArticles} variant="outline">
							Coba Lagi
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background relative">
			<Navbar activeSection="berita" scrollToSection={scrollToSection} />

			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="mb-8" data-aos="fade-down">
					<div className="flex items-center gap-4 mb-4">
						<Link href="/#berita">
							<Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Kembali ke Beranda
							</Button>
						</Link>
					</div>
				<h1 className="text-3xl font-bold text-foreground mb-2">Semua Berita</h1>
				<p className="text-muted-foreground">
					Temukan berita dan informasi terkini dari Himatif Encoder
				</p>
				</div>

				{/* Search and Filter */}
				<div
					className="bg-card border border-border rounded-xl shadow-sm p-6 mb-8"
					data-aos="fade-up"
					data-aos-delay="100">
					<div className="space-y-4">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
							<Input
								placeholder="Cari berita berdasarkan judul atau deskripsi..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
							/>
						</div>

						{allTags.length > 0 && (
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<Tag className="h-4 w-4 text-muted-foreground" />
									<span className="text-sm font-medium text-foreground/80">
										Filter berdasarkan tags:
									</span>
								</div>
								<div className="flex flex-wrap gap-2">
									{allTags.map((tag) => (
										<Badge
											key={tag}
											variant={selectedTags.includes(tag) ? 'default' : 'outline'}
											className="cursor-pointer"
											onClick={() => toggleTag(tag)}>
											{tag}
										</Badge>
									))}
								</div>
							</div>
						)}

						{(searchTerm || selectedTags.length > 0) && (
							<Button variant="outline" size="sm" onClick={clearFilters}>
								Hapus Filter
							</Button>
						)}
					</div>
				</div>

				{/* Results Count */}
				<div className="mb-6">
					<p className="text-muted-foreground text-sm">
						Menampilkan {paginatedArticles.length} dari {filteredArticles.length} berita
						{searchTerm && ` untuk "${searchTerm}"`}
						{selectedTags.length > 0 && ` dengan tags: ${selectedTags.join(', ')}`}
					</p>
				</div>

				{/* Articles Grid */}
				{paginatedArticles.length === 0 ? (
					<div className="text-center py-12 bg-card border border-border rounded-xl">
						<p className="text-muted-foreground text-lg mb-2">Tidak ada berita ditemukan</p>
						<p className="text-muted-foreground/70 text-sm">
							Coba sesuaikan pencarian atau filter Anda
						</p>
					</div>
				) : (
					<div
						ref={articlesContainerRef}
						key={`page-${currentPage}`}
						className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
						{paginatedArticles.map((article, index) => (
							<Card
								key={article._id}
								className="overflow-hidden hover:shadow-lg transition-all duration-300 group hover:scale-[1.02] bg-card border-border"
								data-aos="fade-up"
								data-aos-delay={`${index * 40}`}>
								<CardHeader className="p-0">
									<Link
										href={
											article.slug
												? `/berita/${article._id}/${article.slug}`
												: `/berita/${article._id}`
										}>
										<div className="relative h-48 overflow-hidden">
											<img
												src={article.image}
												alt={article.title}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
												onError={(e) => {
													const target = e.target as HTMLImageElement;
													target.src = '/placeholder-berita.jpg';
												}}
											/>
											<div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
										</div>
									</Link>
								</CardHeader>
								<CardContent className="p-4">
									<Link
										href={
											article.slug
												? `/berita/${article._id}/${article.slug}`
												: `/berita/${article._id}`
										}>
										<CardTitle className="text-base mb-2 hover:text-primary transition-colors line-clamp-2 text-foreground">
											{article.title}
										</CardTitle>
									</Link>
									<p className="text-muted-foreground text-sm mb-3 line-clamp-3">
										{article.excerpt}
									</p>

									{article.tags && article.tags.length > 0 && (
										<div className="flex flex-wrap gap-1 mb-3">
											{article.tags.slice(0, 3).map((tag: string) => (
												<Badge key={tag} variant="secondary" className="text-xs">
													{tag}
												</Badge>
											))}
											{article.tags.length > 3 && (
												<Badge variant="outline" className="text-xs">
													+{article.tags.length - 3} lagi
												</Badge>
											)}
										</div>
									)}

									<div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
										<div className="flex items-center gap-1">
											<User className="h-3 w-3" />
											<span>{article.author}</span>
										</div>
										<div className="flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											<span>{formatDate(article.createdAt)}</span>
										</div>
										<div className="flex items-center gap-1">
											<span>{article.viewCount ?? 0} pembaca</span>
										</div>
									</div>

									<Link
										href={
											article.slug
												? `/berita/${article._id}/${article.slug}`
												: `/berita/${article._id}`
										}>
										<Button
											variant="link"
											className="text-primary hover:text-primary/80 p-0 h-auto font-medium text-sm">
											Baca selengkapnya →
										</Button>
									</Link>
								</CardContent>
							</Card>
						))}
					</div>
				)}

				<Pagination
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={setCurrentPage}
					className="mt-8"
				/>
			</div>

		<Footer />

		{/* AI Chat */}
		<AIChat
			pageContext={{
				path: '/berita',
				permissions: [],
			}}
		/>
	</div>
);
}
