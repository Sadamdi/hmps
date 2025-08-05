import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { ArrowLeft, Calendar, Search, Tag, User } from 'lucide-react';
import { useEffect, useState } from 'react';
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
}

export default function AllArticles() {
	const [articles, setArticles] = useState<Article[]>([]);
	const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [allTags, setAllTags] = useState<string[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const articlesPerPage = 15;
	// Removed useLocation since we're using window.location.search directly

	useEffect(() => {
		// Initialize AOS
		AOS.init({
			duration: 800,
			easing: 'ease-in-out',
			once: true,
		});
		fetchArticles();
	}, []);

	// Handle URL query parameters for tags
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

			const response = await fetch('/api/articles');

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			setArticles(data);

			// Extract all unique tags
			const tags = new Set<string>();
			data.forEach((article: Article) => {
				if (article.tags) {
					article.tags.forEach((tag) => tags.add(tag));
				}
			});
			setAllTags(Array.from(tags).sort());
		} catch (error) {
			console.error('Error fetching articles:', error);
			setError('Gagal memuat artikel. Silakan coba lagi.');
		} finally {
			setLoading(false);
		}
	};

	const filterArticles = () => {
		let filtered = articles;

		// Filter by search term
		if (searchTerm) {
			filtered = filtered.filter(
				(article) =>
					article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
					article.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}

		// Filter by selected tags
		if (selectedTags.length > 0) {
			filtered = filtered.filter(
				(article) =>
					article.tags && selectedTags.some((tag) => article.tags.includes(tag))
			);
		}

		setFilteredArticles(filtered);
		setCurrentPage(1); // Reset to first page when filtering
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

	// Pagination
	const indexOfLastArticle = currentPage * articlesPerPage;
	const indexOfFirstArticle = indexOfLastArticle - articlesPerPage;
	const currentArticles = filteredArticles.slice(
		indexOfFirstArticle,
		indexOfLastArticle
	);
	const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);

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
			<div className="min-h-screen bg-gray-50">
				<div className="container mx-auto px-4 py-8">
					<div className="text-center">
						<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
						<p className="mt-4 text-gray-600">Memuat artikel...</p>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-gray-50">
				<div className="container mx-auto px-4 py-8">
					<div className="text-center">
						<p className="text-red-600 mb-4">{error}</p>
						<Button
							onClick={fetchArticles}
							variant="outline">
							Coba Lagi
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div
					className="mb-8"
					data-aos="fade-down">
					<div className="flex items-center gap-4 mb-4">
						<Link href="/">
							<Button
								variant="ghost"
								size="sm">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Kembali ke Beranda
							</Button>
						</Link>
					</div>
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						All Articles
					</h1>
					<p className="text-gray-600">
						Discover articles and latest information from HIMATIF ENCODER
					</p>
				</div>

				{/* Search and Filter Section */}
				<div
					className="bg-white rounded-lg shadow-sm p-6 mb-8"
					data-aos="fade-up"
					data-aos-delay="100">
					<div className="space-y-4">
						{/* Search Bar */}
						<div className="relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
							<Input
								placeholder="Cari artikel berdasarkan judul atau deskripsi..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
							/>
						</div>

						{/* Tags Filter */}
						{allTags.length > 0 && (
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<Tag className="h-4 w-4 text-gray-600" />
									<span className="text-sm font-medium text-gray-700">
										Filter berdasarkan tags:
									</span>
								</div>
								<div className="flex flex-wrap gap-2">
									{allTags.map((tag) => (
										<Badge
											key={tag}
											variant={
												selectedTags.includes(tag) ? 'default' : 'outline'
											}
											className="cursor-pointer hover:bg-gray-100"
											onClick={() => toggleTag(tag)}>
											{tag}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Clear Filters */}
						{(searchTerm || selectedTags.length > 0) && (
							<Button
								variant="outline"
								size="sm"
								onClick={clearFilters}>
								Hapus Filter
							</Button>
						)}
					</div>
				</div>

				{/* Results Count */}
				<div
					className="mb-6"
					data-aos="fade-up"
					data-aos-delay="150">
					<p className="text-gray-600">
						Menampilkan {currentArticles.length} dari {filteredArticles.length}{' '}
						artikel
						{searchTerm && ` untuk "${searchTerm}"`}
						{selectedTags.length > 0 &&
							` dengan tags: ${selectedTags.join(', ')}`}
					</p>
				</div>

				{/* Articles Grid */}
				{currentArticles.length === 0 ? (
					<div
						className="text-center py-12 bg-white rounded-lg shadow-sm"
						data-aos="fade-up"
						data-aos-delay="200">
						<p className="text-gray-500 text-lg mb-2">
							Tidak ada artikel ditemukan
						</p>
						<p className="text-gray-400">
							Coba sesuaikan pencarian atau filter Anda
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
						{currentArticles.map((article, index) => (
							<Card
								key={article._id}
								className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group"
								data-aos="fade-up"
								data-aos-delay={200 + index * 50}>
								<CardHeader className="p-0">
									<Link
										href={
											article.slug
												? `/artikel/${article._id}/${article.slug}`
												: `/artikel/${article._id}`
										}>
										<div className="relative h-48 overflow-hidden">
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
								</CardHeader>
								<CardContent className="p-4">
									<Link
										href={
											article.slug
												? `/artikel/${article._id}/${article.slug}`
												: `/artikel/${article._id}`
										}>
										<CardTitle className="text-lg mb-2 hover:text-blue-600 transition-colors line-clamp-2">
											{article.title}
										</CardTitle>
									</Link>
									<p className="text-gray-600 text-sm mb-3 line-clamp-3">
										{article.excerpt}
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

									{/* Meta */}
									<div className="flex items-center justify-between text-xs text-gray-500 mb-3">
										<div className="flex items-center gap-1">
											<User className="h-3 w-3" />
											<span>{article.author}</span>
										</div>
										<div className="flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											<span>{formatDate(article.createdAt)}</span>
										</div>
									</div>

									{/* Read More Button */}
									<Link
										href={
											article.slug
												? `/artikel/${article._id}/${article.slug}`
												: `/artikel/${article._id}`
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

				{/* Pagination */}
				{totalPages > 1 && (
					<div
						className="flex justify-center gap-2"
						data-aos="fade-up"
						data-aos-delay="300">
						<Button
							variant="outline"
							onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
							disabled={currentPage === 1}>
							Sebelumnya
						</Button>

						{Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
							<Button
								key={page}
								variant={currentPage === page ? 'default' : 'outline'}
								onClick={() => setCurrentPage(page)}>
								{page}
							</Button>
						))}

						<Button
							variant="outline"
							onClick={() =>
								setCurrentPage((prev) => Math.min(prev + 1, totalPages))
							}
							disabled={currentPage === totalPages}>
							Selanjutnya
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
