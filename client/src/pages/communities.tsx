import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Building2, ExternalLink, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'wouter';

export default function AllCommunitiesPage() {
	const { data: communities = [], isLoading } = useQuery<any[]>({
		queryKey: ['/api/communities'],
	});

	useEffect(() => {
		document.title = 'Komunitas | Himatif Encoder';
	}, []);

	return (
		<div className="min-h-screen bg-background">
			<div className="max-w-6xl mx-auto px-4 py-12">
				<div className="mb-8">
					<PageBreadcrumb
						className="mb-4"
						items={[{ label: 'Beranda', href: '/' }, { label: 'Semua Komunitas' }]}
					/>
					<h1 className="text-3xl font-bold">Semua Komunitas</h1>
					<p className="text-muted-foreground mt-2">Daftar komunitas yang terdaftar di platform Himatif Encoder</p>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center py-20">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				) : (communities as any[]).length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center justify-center py-16 text-center">
							<Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
							<h3 className="text-lg font-semibold mb-2">Belum Ada Komunitas</h3>
							<p className="text-muted-foreground">Komunitas akan muncul di sini setelah didaftarkan.</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{(communities as any[]).map((c: any) => (
							<Link key={c._id} href={`/${c.slug}`}>
								<Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-3">
											{c.logoUrl ? (
												<img src={c.logoUrl} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
											) : (
												<div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
													<Building2 className="h-5 w-5 text-primary" />
												</div>
											)}
											<CardTitle className="text-lg">{c.name}</CardTitle>
										</div>
									</CardHeader>
									<CardContent>
										<p className="text-sm text-muted-foreground line-clamp-2">
											{c.description || 'Komunitas terdaftar'}
										</p>
										<div className="mt-3 flex items-center gap-1 text-xs text-primary">
											<ExternalLink className="h-3 w-3" />
											/{c.slug}
										</div>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
