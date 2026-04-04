import {
	LibraryDetailItem as LibraryItem,
	LibraryItemDetailContent,
} from '@/components/public/library-item-detail';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { useRevealAnimation } from '@/hooks/use-reveal-animation';
import { useQuery } from '@tanstack/react-query';
import AOS from 'aos';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import MediaDisplay from '../MediaDisplay';

interface PaginatedResponse<T> {
	data: T[];
	meta?: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

function slideMediaType(
	item: LibraryItem,
	index: number,
): 'image' | 'video' | 'auto' {
	const k = item.mediaKinds?.[index];
	if (k === 'video') return 'video';
	if (k === 'image') return 'image';
	return 'auto';
}

type LibraryVariant = 'section' | 'page';

interface LibraryProps {
	variant?: LibraryVariant;
}

function LibraryGalleryCard({
	item,
	index,
}: {
	item: LibraryItem;
	index: number;
}) {
	return (
		<div
			className="bg-card rounded-lg overflow-hidden shadow-md border border-border/70 hover:shadow-lg hover:border-primary/40 transition-all"
			data-aos="fade-up"
			data-aos-delay={index * 100}>
			<div className="h-48 relative overflow-hidden group">
				{item.gdriveEmbedFolders && item.gdriveEmbedFolders.length > 0 ? (
					<div className="h-full w-full flex flex-col items-center justify-center bg-muted text-muted-foreground">
						<span className="text-sm font-medium">Folder Drive</span>
						<span className="text-xs mt-1">
							{item.gdriveEmbedFolders.length} folder · embed
						</span>
					</div>
				) : (
					<MediaDisplay
						src={item.images[0]}
						alt={item.title}
						type={slideMediaType(item, 0)}
						className="w-full h-full object-cover"
					/>
				)}

				{item.type === 'video' &&
				(!item.gdriveEmbedFolders || item.gdriveEmbedFolders.length === 0) && (
					<div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 pointer-events-none">
						<div className="bg-white rounded-full p-3">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-8 w-8 text-primary"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
					</div>
				)}

				{item.images.length > 1 &&
					(!item.gdriveEmbedFolders || item.gdriveEmbedFolders.length === 0) && (
					<div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs rounded px-2 py-1">
						<span>{`1/${item.images.length}`}</span>
					</div>
				)}
			</div>

			<div className="p-6">
				<div className="flex justify-between items-center mb-3">
					<span className="text-xs text-muted-foreground">
						{item.date && item.time ? `${item.date} · ${item.time}` : ''}
					</span>
					<span className="capitalize text-xs px-2 py-1 bg-secondary text-slate-200 rounded-full">
						{item.type}
					</span>
				</div>
				<h3 className="font-bold text-xl mb-2">{item.title}</h3>
				{item.authorsDisplay && (
					<p className="text-sm text-muted-foreground mb-3">
						By {item.authorsDisplay}
					</p>
				)}
				{item.description ? (
					<p className="text-muted-foreground mb-4 line-clamp-2">
						{item.description}
					</p>
				) : null}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<Dialog>
						<DialogTrigger asChild>
							<Button
								variant="link"
								className="text-primary hover:text-primary/80 p-0 h-auto font-medium">
								Cepat lihat →
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
							<div className="shrink-0 px-6 pt-6 pb-2 border-b border-border">
								<DialogHeader>
									<DialogTitle className="text-2xl font-bold font-serif pr-8">
										{item.title}
									</DialogTitle>
									{item.authorsDisplay && (
										<p className="text-sm text-muted-foreground mt-2">
											By {item.authorsDisplay}
										</p>
									)}
								</DialogHeader>
							</div>

							<div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
								<LibraryItemDetailContent item={item} showHeader={false} />
							</div>
						</DialogContent>
					</Dialog>
					<Link
						href={`/library/${item._id || item.id}`}
						className="text-sm font-medium text-muted-foreground hover:text-primary underline underline-offset-2">
						Halaman detail
					</Link>
				</div>
			</div>
		</div>
	);
}

export default function Library({ variant = 'section' }: LibraryProps) {
	const [searchQuery, setSearchQuery] = useState('');
	const { ref: headingRef, isVisible: headingVisible } = useRevealAnimation();

	const listLimit = variant === 'page' ? 100 : 18;

	const { data: libraryItems = [], isLoading } = useQuery<LibraryItem[]>({
		queryKey: ['/api/library', variant, listLimit],
		queryFn: async () => {
			const response = await fetch(
				`/api/library?page=1&limit=${listLimit}`,
			);
			const payload =
				(await response.json()) as LibraryItem[] | PaginatedResponse<LibraryItem>;
			if (Array.isArray(payload)) return payload;
			return payload?.data ?? [];
		},
		placeholderData: [],
		staleTime: 60 * 1000,
	});

	const searchLibrary = (items: LibraryItem[]) => {
		if (!searchQuery) return items;
		return items.filter((item) =>
			item.title.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	};

	useEffect(() => {
		if (libraryItems.length > 0) {
			const timer = setTimeout(() => AOS.refreshHard(), 80);
			return () => clearTimeout(timer);
		}
	}, [libraryItems.length]);

	const filteredLibraryItems = useMemo(
		() => searchLibrary(libraryItems),
		[libraryItems, searchQuery],
	);

	const outerClass =
		variant === 'page'
			? 'py-12 bg-secondary/35 min-h-[60vh]'
			: 'py-16 bg-secondary/35';

	return (
		<section id={variant === 'section' ? 'library' : undefined} className={outerClass}>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div ref={headingRef} className="text-center mb-12">
					<h2
						className={`text-3xl font-bold text-foreground font-serif ${headingVisible ? 'reveal-heading' : 'opacity-0'}`}>
						Galeri
					</h2>
					<div
						className={`mt-2 h-1 w-20 bg-primary mx-auto ${headingVisible ? 'reveal-heading reveal-heading-delay-1' : 'opacity-0'}`}
					/>
					<p
						className={`mt-4 text-lg text-muted-foreground ${headingVisible ? 'reveal-heading reveal-heading-delay-2' : 'opacity-0'}`}>
						Koleksi foto dan video kegiatan Himpunan
					</p>
				</div>

				<div className="mb-8" data-aos="fade-up" data-aos-delay="100">
					<div className="relative max-w-lg mx-auto">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<Search className="h-5 w-5 text-muted-foreground" />
						</div>
						<input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							type="text"
							className="block w-full pl-10 pr-3 py-2 border border-border rounded-md leading-5 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
							placeholder="Cari di galeri..."
						/>
					</div>
				</div>

				{isLoading ? (
					<div className="animate-pulse space-y-8">
						<div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
							{[...Array(3)].map((_, i) => (
								<div
									key={i}
									className="bg-card rounded-lg overflow-hidden shadow-md border border-border/60">
									<div className="h-48 bg-gray-200" />
									<div className="p-6 space-y-3">
										<div className="h-4 bg-gray-200 rounded w-3/4" />
										<div className="h-4 bg-gray-200 rounded" />
										<div className="h-4 bg-gray-200 rounded w-5/6" />
									</div>
								</div>
							))}
						</div>
					</div>
				) : (
					<>
						<div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
							{filteredLibraryItems.map((item: LibraryItem, index) => (
								<LibraryGalleryCard
									key={item._id || item.id}
									item={item}
									index={index}
								/>
							))}
						</div>

						{variant === 'section' && (
							<div
								className="text-center mt-10"
								data-aos="fade-up"
								data-aos-delay="200">
								<Link href="/library">
									<Button variant="outline" className="btn-secondary">
										Lihat semua galeri
									</Button>
								</Link>
							</div>
						)}
					</>
				)}
			</div>
		</section>
	);
}
