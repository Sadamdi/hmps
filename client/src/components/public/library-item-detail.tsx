import CommentThread from '@/components/public/comment-thread';
import LibraryFullDescription from '@/components/public/library-full-description';
import {
	getMediaDisplayTypeForSlot,
	normalizeLibraryImageUrl,
} from '@/lib/library-display';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink, Film, ImageIcon, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import MediaDisplay from '../MediaDisplay';

export interface LibraryDetailItem {
	id?: number;
	_id?: string;
	title: string;
	description: string;
	fullDescription: string;
	images: string[];
	mediaKinds?: ('image' | 'video')[];
	date?: string;
	time?: string;
	type: 'photo' | 'video';
	authorsDisplay?: string;
	relatedEventsPreview?: { _id: string; title: string; year?: number }[];
	relatedBeritaPreview?: { _id: string; title: string; slug?: string }[];
	gdriveEmbedFolders?: { folderId: string; url: string }[];
}

interface FolderFile {
	id: string;
	name: string;
	mimeType: string;
	thumbnailLink: string;
}

function FolderGallery({
	libraryId,
	folder,
}: {
	libraryId: string;
	folder: { folderId: string; url: string };
}) {
	const [previewFile, setPreviewFile] = useState<FolderFile | null>(null);

	const { data, isLoading, error } = useQuery<{ files: FolderFile[] }>({
		queryKey: ['library-folder-files', libraryId, folder.folderId],
		queryFn: async () => {
			const res = await fetch(
				`/api/library/${libraryId}/folder/${folder.folderId}/files`,
			);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				const msg =
					typeof (body as { message?: string }).message === 'string'
						? (body as { message: string }).message
						: 'Gagal memuat isi folder.';
				throw new Error(msg);
			}
			return res.json();
		},
		retry: 1,
		staleTime: 5 * 60 * 1000,
	});

	const files = data?.files ?? [];
	const isVideo = (f: FolderFile) => f.mimeType?.startsWith('video/');

	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Memuat isi folder…
			</div>
		);
	}

	if (error || files.length === 0) {
		return (
			<div className="text-center py-8 text-sm text-muted-foreground space-y-2">
				<p>
					{error != null
						? error instanceof Error
							? error.message
							: String(error)
						: 'Folder kosong.'}
				</p>
				<a
					href={folder.url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
					<ExternalLink className="h-3 w-3" />
					Buka di Google Drive
				</a>
			</div>
		);
	}

	return (
		<>
			<div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-thin snap-x snap-mandatory">
				{files.map((f) => (
					<button
						key={f.id}
						type="button"
						onClick={() => setPreviewFile(f)}
						className="flex-shrink-0 snap-start w-40 rounded-lg overflow-hidden border border-border hover:border-primary/50 hover:shadow-md transition-all group bg-muted/30">
						<div className="relative w-40 h-28 bg-muted">
							<img
								src={f.thumbnailLink}
								alt={f.name}
								className="w-full h-full object-cover"
								loading="lazy"
								onError={(e) => {
									const t = e.target as HTMLImageElement;
									t.src = `https://lh3.googleusercontent.com/d/${f.id}=w400`;
								}}
							/>
							{isVideo(f) && (
								<div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
									<Film className="h-8 w-8 text-white drop-shadow" />
								</div>
							)}
							{!isVideo(f) && (
								<div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
									<ImageIcon className="h-4 w-4 text-white drop-shadow" />
								</div>
							)}
						</div>
						<p className="text-xs px-2 py-1.5 truncate text-muted-foreground group-hover:text-foreground transition-colors">
							{f.name}
						</p>
					</button>
				))}
			</div>

			<Dialog
				open={!!previewFile}
				onOpenChange={(open) => {
					if (!open) setPreviewFile(null);
				}}>
				<DialogContent className="max-w-4xl w-[95vw] p-0 gap-0 overflow-hidden [&>button]:hidden">
					{previewFile && (
						<div className="flex flex-col max-h-[90vh] w-full">
							<div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border bg-background/95 shrink-0">
								<p className="text-sm font-medium truncate pr-4">
									{previewFile.name}
								</p>
								<div className="flex items-center gap-2 shrink-0">
									<a
										href={`https://drive.google.com/file/d/${previewFile.id}/view`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
										<ExternalLink className="h-3 w-3" />
										Drive
									</a>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7"
										onClick={() => setPreviewFile(null)}>
										<X className="h-4 w-4" />
									</Button>
								</div>
							</div>
							<div className="w-full bg-black flex items-center justify-center p-2 sm:p-3">
								{isVideo(previewFile) ? (
									<div className="w-full max-h-[min(85vh,900px)] aspect-video">
										<iframe
											src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
											className="w-full h-full rounded-sm"
											allow="autoplay; encrypted-media"
											allowFullScreen
											title={previewFile.name}
											style={{ border: 'none' }}
										/>
									</div>
								) : (
									<img
										src={`https://lh3.googleusercontent.com/d/${previewFile.id}=s1600`}
										alt={previewFile.name}
										className="max-w-full w-auto h-auto max-h-[min(85vh,900px)] object-contain"
										onError={(e) => {
											const t = e.target as HTMLImageElement;
											t.src = `https://drive.google.com/thumbnail?id=${previewFile.id}&sz=w1600`;
										}}
									/>
								)}
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

export function LibraryItemDetailContent({
	item,
	showHeader = true,
}: {
	item: LibraryDetailItem;
	showHeader?: boolean;
}) {
	const [slideIndex, setSlideIndex] = useState(0);

	const libraryId = item._id || String(item.id);

	const hideImageCarousel =
		!!item.gdriveEmbedFolders &&
		item.gdriveEmbedFolders.length > 0 &&
		(item.images || []).every(
			(u) => typeof u === 'string' && u.startsWith('data:image/svg+xml'),
		);

	return (
		<div className="space-y-4">
			{showHeader ? (
				<div className="space-y-1">
					<h2 className="text-2xl font-bold font-serif">{item.title}</h2>
					{item.authorsDisplay && (
						<p className="text-sm text-muted-foreground">By {item.authorsDisplay}</p>
					)}
				</div>
			) : null}

			{item.gdriveEmbedFolders && item.gdriveEmbedFolders.length > 0 ? (
				<div className="space-y-3">
					<p className="text-sm font-medium text-muted-foreground">
						Isi folder (Google Drive)
					</p>
					{item.gdriveEmbedFolders.map((f) => (
						<FolderGallery
							key={f.folderId}
							libraryId={libraryId}
							folder={f}
						/>
					))}
				</div>
			) : null}

			{!hideImageCarousel ? (
				<>
					<div className="relative rounded-lg overflow-hidden bg-black/80">
						<div className="w-full flex justify-center items-center">
							{item.images?.[slideIndex] ? (
								<MediaDisplay
									src={normalizeLibraryImageUrl(item.images[slideIndex])}
									alt={`${item.title} — ${slideIndex + 1}`}
									type={getMediaDisplayTypeForSlot(item, slideIndex)}
									className="w-full object-contain"
									mediaFrameClassName="w-full min-h-[200px] max-h-[min(72vh,800px)] sm:max-h-[min(78vh,900px)]"
								/>
							) : null}
						</div>

						{(item.images?.length ?? 0) > 1 && (
							<>
								<Button
									variant="ghost"
									size="icon"
									type="button"
									aria-label="Slide sebelumnya"
									onClick={() => setSlideIndex((i) => Math.max(i - 1, 0))}
									disabled={slideIndex === 0}
									className="absolute left-1 sm:left-2 top-1/2 z-10 h-10 w-10 sm:h-11 sm:w-11 -translate-y-1/2 bg-black/55 text-white rounded-full hover:bg-black/75 disabled:opacity-30 shadow-md">
									<ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									type="button"
									aria-label="Slide berikutnya"
									onClick={() =>
										setSlideIndex((i) =>
											Math.min(i + 1, (item.images?.length ?? 1) - 1),
										)
									}
									disabled={slideIndex === (item.images?.length ?? 1) - 1}
									className="absolute right-1 sm:right-2 top-1/2 z-10 h-10 w-10 sm:h-11 sm:w-11 -translate-y-1/2 bg-black/55 text-white rounded-full hover:bg-black/75 disabled:opacity-30 shadow-md">
									<ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
								</Button>
							</>
						)}
					</div>

					{(item.images?.length ?? 0) > 1 && (
						<div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
							{item.images.map((src, idx) => (
								<button
									key={idx}
									type="button"
									onClick={() => setSlideIndex(idx)}
									className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-colors ${
										slideIndex === idx
											? 'border-primary ring-2 ring-primary/30'
											: 'border-transparent'
									}`}>
									<MediaDisplay
										src={normalizeLibraryImageUrl(src)}
										alt={`Thumbnail ${idx + 1}`}
										type={getMediaDisplayTypeForSlot(item, idx)}
										className="w-full h-full object-cover"
									/>
								</button>
							))}
						</div>
					)}
				</>
			) : null}

			<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<span>
					{item.date && item.time ? `${item.date} · ${item.time}` : ''}
				</span>
			</div>

			{item.description ? (
				<p className="text-sm text-muted-foreground">{item.description}</p>
			) : null}

			{item.fullDescription ? (
				<LibraryFullDescription content={item.fullDescription} />
			) : null}

			{(item.relatedBeritaPreview && item.relatedBeritaPreview.length > 0) ||
			(item.relatedEventsPreview && item.relatedEventsPreview.length > 0) ? (
				<div className="flex flex-wrap gap-2 pt-2 border-t border-border">
					<span className="text-xs font-semibold text-muted-foreground w-full">
						Terkait:
					</span>
					{item.relatedBeritaPreview?.map((b) => (
						<Link
							key={b._id}
							href={
								b.slug ? `/berita/${b._id}/${b.slug}` : `/berita/${b._id}`
							}>
							<span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs hover:bg-primary/20">
								Berita: {b.title}
							</span>
						</Link>
					))}
					{item.relatedEventsPreview?.map((ev) => (
						<Link
							key={ev._id}
							href={
								ev.year ? `/events/${ev.year}/${ev._id}` : '/events/all'
							}>
							<span className="inline-flex items-center rounded-full bg-secondary text-foreground px-3 py-1 text-xs hover:bg-secondary/80">
								Event: {ev.title}
							</span>
						</Link>
					))}
				</div>
			) : null}

			<CommentThread
				targetType="library"
				targetId={libraryId}
				compact
			/>
		</div>
	);
}
