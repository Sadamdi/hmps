import {
	LibraryDetailItem as LibraryItem,
	LibraryItemDetailContent,
} from '@/components/public/library-item-detail';
import { PublicSectionHeader } from '@/components/public/section-header';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { useRevealAnimation } from '@/hooks/use-reveal-animation';
import { useAosRefreshOnMount } from '@/hooks/use-aos-refresh-on-mount';
import { useQuery } from '@tanstack/react-query';
import {
	getLibraryVisualKind,
	getMediaDisplayTypeForSlot,
	normalizeLibraryImageUrl,
} from '@/lib/library-display';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import AOS from 'aos';
import { BookOpen, Calendar, ChevronDown, ChevronLeft, ChevronRight, Eye, Filter, Search, Tag, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { toSlug } from '@/utils/slug';
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
	const [slideIndex, setSlideIndex] = useState(0);
	const [hidePlayHint, setHidePlayHint] = useState(false);
	const kind = getLibraryVisualKind(item);
	const images = item.images ?? [];
	const hasFolder = !!item.gdriveEmbedFolders && item.gdriveEmbedFolders.length > 0;
	const showCarousel = !hasFolder && images.length > 1;
	const slide = Math.min(slideIndex, Math.max(0, images.length - 1));

	const detailHref = `/library/${toSlug(item.title) || item._id || item.id}`;

	return (
		<div
			className="bg-card rounded-xl sm:rounded-lg overflow-hidden shadow-sm sm:shadow-md border border-border/70 hover:shadow-md sm:hover:shadow-lg hover:border-primary/40 transition-all active:scale-[0.99] sm:active:scale-100 flex flex-col h-full"
			data-aos="fade-up"
			data-aos-delay={index * 100}>
			<div
				className="aspect-[4/3] sm:h-48 relative overflow-hidden group touch-pan-y"
				onPointerDownCapture={() => setHidePlayHint(true)}>
				{item.gdriveEmbedFolders && item.gdriveEmbedFolders.length > 0 ? (
					<div className="h-full w-full flex flex-col items-center justify-center bg-muted text-muted-foreground">
						<span className="text-sm font-medium">Folder Drive</span>
						<span className="text-xs mt-1">
							{item.gdriveEmbedFolders.length} folder · embed
						</span>
					</div>
				) : (
					<MediaDisplay
						src={normalizeLibraryImageUrl(images[slide])}
						alt={item.title}
						type={getMediaDisplayTypeForSlot(item, slide)}
						className="w-full h-full object-cover"
						mediaFrameClassName="h-full min-h-[12rem] w-full max-h-48"
					/>
				)}

				{kind === 'video' && !hidePlayHint && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none transition-opacity duration-200">
						<div className="bg-white rounded-full p-2.5 sm:p-3 shadow-md">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-7 w-7 sm:h-8 sm:w-8 text-primary"
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

				{showCarousel && (
					<>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Media sebelumnya"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								setSlideIndex((i) => Math.max(0, i - 1));
							}}
							disabled={slide === 0}
							className="absolute left-1 top-1/2 z-10 h-9 w-9 sm:h-10 sm:w-10 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/75 disabled:opacity-30">
							<ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Media berikutnya"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								setSlideIndex((i) =>
									Math.min(i + 1, images.length - 1),
								);
							}}
							disabled={slide >= images.length - 1}
							className="absolute right-1 top-1/2 z-10 h-9 w-9 sm:h-10 sm:w-10 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/75 disabled:opacity-30">
							<ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
						</Button>
					</>
				)}

				{item.images.length > 1 &&
					(!item.gdriveEmbedFolders || item.gdriveEmbedFolders.length === 0) && (
					<div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs rounded px-2 py-1 z-10">
						<span>{`${slide + 1}/${item.images.length}`}</span>
					</div>
				)}
			</div>

			{/* Satu layout card — mobile 2×2 mirip desktop, hanya lebih compact */}
			<div className="p-3 sm:p-4 md:p-5 flex flex-col flex-1">
				<div className="mb-1.5 sm:mb-2">
					<Link href={detailHref}>
						<h3 className="font-bold text-sm sm:text-lg leading-snug line-clamp-2 hover:text-primary transition-colors cursor-pointer">
							{item.title}
						</h3>
					</Link>
				</div>
				{item.authorsDisplay && (
					<p className="text-[10px] sm:text-xs text-muted-foreground mb-1 flex items-center gap-1">
						<User className="h-3 w-3 shrink-0" />
						<span className="truncate">{item.authorsDisplay}</span>
					</p>
				)}
				<div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0.5 text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2">
					{item.date && (
						<span className="flex items-center gap-1 shrink-0">
							<Calendar className="h-3 w-3" /> {item.date}
						</span>
					)}
					{typeof item.viewCount === 'number' && (
						<span className="hidden sm:flex items-center gap-1">
							<Eye className="h-3 w-3" /> {item.viewCount} pembaca
						</span>
					)}
				</div>
				{item.description ? (
					<p className="text-[11px] sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">
						{item.description}
					</p>
				) : null}
				{item.tags && item.tags.length > 0 && (
					<div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
						{item.tags.slice(0, 2).map((t) => (
							<Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">
								{t}
							</Badge>
						))}
						{item.tags.length > 2 && (
							<Badge variant="outline" className="text-[10px] px-1.5 py-0">
								+{item.tags.length - 2}
							</Badge>
						)}
					</div>
				)}
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-auto pt-1">
					<Dialog>
						<DialogTrigger asChild>
							<Button
								variant="link"
								className="text-primary hover:text-primary/80 p-0 h-auto font-medium text-xs sm:text-sm min-h-8">
								Cepat lihat →
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
							<div className="shrink-0 px-4 sm:px-6 pt-5 sm:pt-6 pb-2 border-b border-border">
								<DialogHeader>
									<DialogTitle className="text-xl sm:text-2xl font-bold font-serif pr-8">
										{item.title}
									</DialogTitle>
									{item.authorsDisplay && (
										<p className="text-sm text-muted-foreground mt-2">
											By {item.authorsDisplay}
										</p>
									)}
								</DialogHeader>
							</div>

							<div className="overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 max-h-[calc(90vh-7rem)]">
								<LibraryItemDetailContent item={item} showHeader={false} />
							</div>
						</DialogContent>
					</Dialog>
					<Link
						href={detailHref}
						className="text-[11px] sm:text-sm font-medium text-muted-foreground hover:text-primary underline underline-offset-2">
						Detail
					</Link>
				</div>
			</div>
		</div>
	);
}

function deriveItemYear(item: LibraryItem): number | null {
	const raw = item.activityDate || item.createdAt;
	if (!raw) return null;
	const d = new Date(raw);
	return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

export default function Library({ variant = 'section' }: LibraryProps) {
	useAosRefreshOnMount();
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [selectedYear, setSelectedYear] = useState<number | null>(null);
	const [filtersOpen, setFiltersOpen] = useState(false);
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

	const allTags = useMemo(() => {
		const s = new Set<string>();
		libraryItems.forEach((i) => i.tags?.forEach((t) => s.add(t)));
		return Array.from(s).sort();
	}, [libraryItems]);

	const allYears = useMemo(() => {
		const s = new Set<number>();
		libraryItems.forEach((i) => {
			const y = deriveItemYear(i);
			if (y) s.add(y);
		});
		return Array.from(s).sort((a, b) => b - a);
	}, [libraryItems]);

	useEffect(() => {
		if (libraryItems.length > 0) {
			const timer = setTimeout(() => AOS.refreshHard(), 80);
			return () => clearTimeout(timer);
		}
	}, [libraryItems.length]);

	const filteredLibraryItems = useMemo(() => {
		let items = libraryItems;
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			items = items.filter((i) =>
				i.title.toLowerCase().includes(q) ||
				i.description?.toLowerCase().includes(q),
			);
		}
		if (selectedTags.length > 0) {
			items = items.filter((i) =>
				i.tags && selectedTags.some((t) => i.tags!.includes(t)),
			);
		}
		if (selectedYear !== null) {
			items = items.filter((i) => deriveItemYear(i) === selectedYear);
		}
		return items;
	}, [libraryItems, searchQuery, selectedTags, selectedYear]);

	const toggleTag = (tag: string) =>
		setSelectedTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]);
	const hasActiveFilters = selectedTags.length > 0 || selectedYear !== null;

	const outerClass =
		variant === 'page'
			? 'py-12 bg-secondary/35 min-h-[60vh]'
			: 'py-16 bg-secondary/35';

	return (
		<section id={variant === 'section' ? 'library' : undefined} className={outerClass}>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<PublicSectionHeader
					headingRef={headingRef}
					visible={headingVisible}
					eyebrow="Galeri"
					icon={<BookOpen />}
					title="Galeri"
					description="Koleksi foto dan video kegiatan Himpunan"
				/>

				<div className="mb-6 space-y-3" data-aos="fade-up" data-aos-delay="100">
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

					{variant === 'page' && (allTags.length > 0 || allYears.length > 1) && (
						<Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="max-w-2xl mx-auto">
							<CollapsibleTrigger asChild>
								<Button variant="outline" size="sm" className="mx-auto flex items-center gap-1.5 text-xs">
									<Filter className="h-3.5 w-3.5" />
									Filter{hasActiveFilters ? ` (${selectedTags.length + (selectedYear ? 1 : 0)})` : ''}
									<ChevronDown className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="mt-3 space-y-3 bg-card border border-border rounded-lg p-4">
								{allYears.length > 1 && (
									<div className="space-y-1.5">
										<span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Tahun</span>
										<div className="flex flex-wrap gap-1.5">
											{allYears.map((y) => (
												<Badge
													key={y}
													variant={selectedYear === y ? 'default' : 'outline'}
													className="cursor-pointer text-xs"
													onClick={() => setSelectedYear(selectedYear === y ? null : y)}>
													{y}
												</Badge>
											))}
										</div>
									</div>
								)}
								{allTags.length > 0 && (
									<div className="space-y-1.5">
										<span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tag</span>
										<div className="flex flex-wrap gap-1.5">
											{allTags.map((t) => (
												<Badge
													key={t}
													variant={selectedTags.includes(t) ? 'default' : 'outline'}
													className="cursor-pointer text-xs"
													onClick={() => toggleTag(t)}>
													{t}
												</Badge>
											))}
										</div>
									</div>
								)}
								{hasActiveFilters && (
									<Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSelectedTags([]); setSelectedYear(null); }}>
										Hapus semua filter
									</Button>
								)}
							</CollapsibleContent>
						</Collapsible>
					)}
				</div>

				{isLoading ? (
					<div className="animate-pulse space-y-8">
						<div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
							{[...Array(4)].map((_, i) => (
								<div
									key={i}
									className="bg-card rounded-xl sm:rounded-lg overflow-hidden shadow-sm border border-border/60">
									<div className="aspect-[4/3] sm:h-48 bg-gray-200" />
									<div className="p-2.5 sm:p-6 space-y-2 sm:space-y-3">
										<div className="h-3 sm:h-4 bg-gray-200 rounded w-full" />
										<div className="hidden sm:block h-4 bg-gray-200 rounded w-5/6" />
									</div>
								</div>
							))}
						</div>
					</div>
				) : (
					<>
						<div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
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
