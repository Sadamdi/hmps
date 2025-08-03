import ArticleEditor from '@/components/dashboard/article-editor';
import Header from '@/components/dashboard/header';
import Sidebar from '@/components/dashboard/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';

// Compatible Article interface with ArticleEditor
interface Article {
	_id: string;
	title: string;
	excerpt: string;
	content: string;
	image: string;
	published: boolean;
	author: string;
	authorId: string;
	createdAt: string;
	updatedAt: string;
	// Optional fields for compatibility
	date?: string;
	time?: string;
}

export default function DashboardArticles() {
	const [searchQuery, setSearchQuery] = useState('');
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editingArticle, setEditingArticle] = useState<Article | null>(null);
	const [activeTab, setActiveTab] = useState('all');
	const { toast } = useToast();
	const queryClient = useQueryClient();

	// Query articles with proper typing
	const { data: articlesData = [], isLoading } = useQuery({
		queryKey: ['/api/articles/manage'],
	});

	// Type assertion for articles array
	const articles = articlesData as Article[];

	// Delete article mutation
	const deleteArticleMutation = useMutation({
		mutationFn: async (articleId: string | number) => {
			await apiRequest('DELETE', `/api/articles/${articleId}`, {});
		},
		onSuccess: async (_, articleId) => {
			// Find the deleted article for logging
			const deletedArticle = articles.find(
				(article) => ((article as any)._id || article.id) === articleId
			);

			queryClient.invalidateQueries({ queryKey: ['/api/articles/manage'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			// Log activity
			if (deletedArticle) {
				try {
					await logActivity(
						ActivityTemplates.articleDeleted(
							deletedArticle.title,
							String(articleId)
						)
					);
				} catch (error) {
					console.warn('Failed to log delete activity:', error);
				}
			}

			toast({
				title: 'Success',
				description: 'Article deleted successfully',
			});
		},
		onError: (error) => {
			toast({
				title: 'Error',
				description: 'Failed to delete article',
				variant: 'destructive',
			});
			console.error('Delete error:', error);
		},
	});

	// Filter articles based on search and tab
	const filteredArticles = articles
		.filter(
			(article: Article) =>
				article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				article.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
		)
		.filter((article: Article) => {
			if (activeTab === 'all') return true;
			if (activeTab === 'published') return article.published;
			if (activeTab === 'drafts') return !article.published;
			return true;
		});

	const handleNewArticle = () => {
		setEditingArticle(null);
		setIsEditorOpen(true);
	};

	const handleEditArticle = (article: Article) => {
		setEditingArticle(article);
		setIsEditorOpen(true);
	};

	const handleDeleteArticle = async (articleId: string | number) => {
		if (window.confirm('Are you sure you want to delete this article?')) {
			await deleteArticleMutation.mutateAsync(articleId);
		}
	};

	const closeEditor = () => {
		setIsEditorOpen(false);
		setEditingArticle(null);
	};

	const handleArticleSaved = () => {
		queryClient.invalidateQueries({ queryKey: ['/api/articles/manage'] });
		closeEditor();
		toast({
			title: 'Success',
			description: `Article ${
				editingArticle ? 'updated' : 'created'
			} successfully`,
		});
	};

	return (
		<div className="flex min-h-screen bg-gray-50">
			<Sidebar />
			<div className="flex-1 flex flex-col">
				<Header title="Articles" />
				<main className="flex-1 p-6">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
						<h1 className="text-2xl font-bold">Articles Management</h1>
						<Button onClick={handleNewArticle}>
							<Plus className="h-4 w-4 mr-2" />
							New Article
						</Button>
					</div>

					<div className="mb-6 flex flex-col sm:flex-row gap-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
							<Input
								placeholder="Search articles..."
								className="pl-10"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
						<Tabs
							value={activeTab}
							onValueChange={setActiveTab}
							className="w-full sm:w-auto">
							<TabsList>
								<TabsTrigger value="all">All</TabsTrigger>
								<TabsTrigger value="published">Published</TabsTrigger>
								<TabsTrigger value="drafts">Drafts</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					{isLoading ? (
						<div className="flex justify-center items-center h-64">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : filteredArticles.length === 0 ? (
						<Card>
							<CardContent className="p-8 text-center">
								<p className="text-gray-500 mb-4">No articles found.</p>
								<Button onClick={handleNewArticle}>Create an Article</Button>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-6">
							{filteredArticles.map((article: Article) => (
								<Card
									key={article._id}
									className="overflow-hidden">
									<div className="flex flex-col md:flex-row">
										<div className="w-full md:w-64 h-48 md:h-auto">
											<img
												src={article.image}
												alt={article.title}
												className="w-full h-full object-cover"
											/>
										</div>
										<CardContent className="flex-1 p-6">
											<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
												<div className="flex-1">
													<div className="flex items-center mb-2">
														<h2 className="text-xl font-bold mr-3">
															{article.title}
														</h2>
														{article.published ? (
															<span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
																Published
															</span>
														) : (
															<span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
																Draft
															</span>
														)}
													</div>
													<p className="text-gray-600 mb-4 line-clamp-2">
														{article.excerpt}
													</p>
													<div className="flex items-center text-xs text-gray-500">
														<span className="mr-4">By {article.author}</span>
														<span>
															{article.date} at {article.time}
														</span>
													</div>
												</div>
												<div className="flex space-x-2">
													<Button
														size="sm"
														variant="outline"
														onClick={() => handleEditArticle(article)}>
														<Edit className="h-4 w-4 mr-1" />
														Edit
													</Button>
													<Button
														size="sm"
														variant="outline"
														className="text-red-600 border-red-200 hover:bg-red-50"
														onClick={() =>
															handleDeleteArticle(article._id)
														}>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</div>
										</CardContent>
									</div>
								</Card>
							))}
						</div>
					)}

					<Dialog
						open={isEditorOpen}
						onOpenChange={() => {}} // ❌ Disable backdrop close dan escape key
					>
						<DialogContent
							className="max-w-5xl max-h-[90vh] overflow-y-auto"
							hideCloseButton={true} // ❌ Hide close button (X)
							onPointerDownOutside={(e) => e.preventDefault()} // ❌ Disable backdrop clicks
							onEscapeKeyDown={(e) => e.preventDefault()} // ❌ Disable Escape key
							onInteractOutside={(e) => e.preventDefault()}>
							<DialogHeader>
								<DialogTitle>
									{editingArticle ? 'Edit Article' : 'Create New Article'}
								</DialogTitle>
								{/* Peringatan bahwa editor hanya bisa ditutup dengan tombol */}
								<div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
									<span>🔒</span>
									<span>
										Editor can only be closed using <strong>Cancel</strong> or{' '}
										<strong>Save Article</strong> buttons below
									</span>
								</div>
							</DialogHeader>
							<ArticleEditor
								article={editingArticle}
								onSave={handleArticleSaved}
								onCancel={closeEditor}
							/>
						</DialogContent>
					</Dialog>
				</main>
			</div>
		</div>
	);
}
