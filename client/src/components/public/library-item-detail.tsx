import CommentThread from '@/components/public/comment-thread';
import { Button } from '@/components/ui/button';
import { formatContentForDisplay } from '@/utils/formatContent';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

function slideMediaType(
	item: LibraryDetailItem,
	index: number,
): 'image' | 'video' | 'auto' {
	const k = item.mediaKinds?.[index];
	if (k === 'video') return 'video';
	if (k === 'image') return 'image';
	return 'auto';
}

export function LibraryItemDetailContent({
	item,
	showHeader = true,
}: {
	item: LibraryDetailItem;
	/** false jika judul sudah di luar (halaman penuh) */
	showHeader?: boolean;
}) {
	const [slideIndex, setSlideIndex] = useState(0);

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
						<iframe
							key={f.folderId}
							title={`Folder ${f.folderId}`}
							src={`https://drive.google.com/embeddedfolderview?id=${f.folderId}#list`}
							className="w-full min-h-[420px] rounded-lg border border-border bg-background"
							allowFullScreen
						/>
					))}
					<p className="text-xs text-muted-foreground">
						Tampilan memakai folder yang dibagikan publik. Jika kosong, pastikan
						akses &quot;Siapa pun dengan link&quot; di Google Drive.
					</p>
				</div>
			) : null}

			{!hideImageCarousel ? (
				<>
					<div className="relative rounded-lg overflow-hidden bg-secondary">
						<div className="aspect-video w-full max-h-[50vh] min-h-[200px]">
							{item.images?.[slideIndex] ? (
								<MediaDisplay
									src={item.images[slideIndex]}
									alt={`${item.title} — ${slideIndex + 1}`}
									type={slideMediaType(item, slideIndex)}
									className="w-full h-full object-contain"
								/>
							) : null}
						</div>

						{(item.images?.length ?? 0) > 1 && (
							<>
								<Button
									variant="ghost"
									size="icon"
									type="button"
									onClick={() => setSlideIndex((i) => Math.max(i - 1, 0))}
									disabled={slideIndex === 0}
									className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full hover:bg-black/70">
									<ChevronLeft className="h-6 w-6" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									type="button"
									onClick={() =>
										setSlideIndex((i) =>
											Math.min(i + 1, (item.images?.length ?? 1) - 1),
										)
									}
									disabled={slideIndex === (item.images?.length ?? 1) - 1}
									className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full hover:bg-black/70">
									<ChevronRight className="h-6 w-6" />
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
										src={src}
										alt={`Thumbnail ${idx + 1}`}
										type={slideMediaType(item, idx)}
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
				<div
					className="prose prose-sm max-w-none dark:prose-invert prose-p:text-foreground prose-headings:text-foreground"
					dangerouslySetInnerHTML={{
						__html: formatContentForDisplay(item.fullDescription),
					}}
				/>
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
				targetId={item._id || String(item.id)}
				compact
			/>
		</div>
	);
}
