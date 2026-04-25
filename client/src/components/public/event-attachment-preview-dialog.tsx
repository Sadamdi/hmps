import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, X } from 'lucide-react';

export interface EventAttachmentPreviewItem {
	name: string;
	url: string;
	type?: string;
}

function resolvePreviewUrl(rawUrl: string): string {
	try {
		const parsed = new URL(rawUrl);
		const host = parsed.hostname.toLowerCase();
		if (!host.includes('drive.google.com')) return rawUrl;
		const parts = parsed.pathname.split('/').filter(Boolean);
		const dIdx = parts.findIndex((p) => p === 'd');
		if (dIdx >= 0 && parts[dIdx + 1]) {
			return `https://drive.google.com/file/d/${parts[dIdx + 1]}/preview`;
		}
		const id = parsed.searchParams.get('id');
		if (id) return `https://drive.google.com/file/d/${id}/preview`;
		return rawUrl;
	} catch {
		return rawUrl;
	}
}

function extractDriveFileId(rawUrl: string): string | null {
	try {
		const parsed = new URL(rawUrl);
		const host = parsed.hostname.toLowerCase();
		if (!host.includes('drive.google.com')) return null;
		if (parsed.pathname.toLowerCase().includes('/drive/folders/')) return null;
		const parts = parsed.pathname.split('/').filter(Boolean);
		const dIdx = parts.findIndex((p) => p === 'd');
		if (dIdx >= 0 && parts[dIdx + 1]) return parts[dIdx + 1];
		const id = parsed.searchParams.get('id');
		if (id) return id;
		return null;
	} catch {
		return null;
	}
}

function isImageAttachment(item: EventAttachmentPreviewItem): boolean {
	if (item.type?.toLowerCase().startsWith('image/')) return true;
	return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(item.url);
}

function isSameOriginLike(rawUrl: string): boolean {
	if (rawUrl.startsWith('/')) return true;
	try {
		const parsed = new URL(rawUrl);
		if (typeof window === 'undefined') return false;
		return parsed.origin === window.location.origin;
	} catch {
		return false;
	}
}

function toPreviewSrc(rawUrl: string): string {
	const resolved = resolvePreviewUrl(rawUrl);
	if (isSameOriginLike(resolved)) return resolved;
	return `/api/prodi/preview?url=${encodeURIComponent(resolved)}`;
}

function toBestPreviewSrc(item: EventAttachmentPreviewItem): string {
	const driveId = extractDriveFileId(item.url);
	if (driveId) {
		if (isImageAttachment(item)) {
			return `https://lh3.googleusercontent.com/d/${driveId}=s1600`;
		}
		return `https://drive.google.com/file/d/${driveId}/preview`;
	}
	return toPreviewSrc(item.url);
}

function canInlinePreview(item: EventAttachmentPreviewItem): boolean {
	if (isImageAttachment(item)) return true;
	const lowerType = (item.type || '').toLowerCase();
	if (
		lowerType.includes('pdf') ||
		lowerType.startsWith('video/') ||
		lowerType.startsWith('audio/') ||
		lowerType.startsWith('text/')
	) {
		return true;
	}
	// Google Drive file preview biasanya aman untuk banyak format.
	if (extractDriveFileId(item.url)) return true;
	// Local/common previewable docs in iframe
	if (/\.(pdf|mp4|webm|ogg|mp3|wav|txt|md)(\?|$)/i.test(item.url)) return true;
	// Office docs (pptx/docx/xlsx/zip dll) sering tidak bisa inline: fallback ke tab baru.
	return false;
}

export default function EventAttachmentPreviewDialog({
	preview,
	onOpenChange,
}: {
	preview: EventAttachmentPreviewItem | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={!!preview} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden [&>button]:hidden">
				{preview && (
					<div className="flex flex-col max-h-[90vh] w-full">
						<DialogHeader className="border-b border-border bg-background/95 px-3 sm:px-4 py-2">
							<div className="flex items-center justify-between gap-3">
								<DialogTitle className="truncate text-sm sm:text-base">{preview.name}</DialogTitle>
								<div className="flex items-center gap-2 shrink-0">
									<a
										href={preview.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
									>
										<ExternalLink className="h-3 w-3" />
										Tab baru
									</a>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7"
										onClick={() => onOpenChange(false)}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</DialogHeader>
						<div className="w-full bg-black flex items-center justify-center p-2 sm:p-3">
							{isImageAttachment(preview) ? (
								<img
									src={toBestPreviewSrc(preview)}
									alt={preview.name}
									className="max-w-full w-auto h-auto max-h-[min(85vh,900px)] object-contain"
								/>
							) : canInlinePreview(preview) ? (
								<div className="w-full space-y-2">
									<iframe
										src={toBestPreviewSrc(preview)}
										title={preview.name}
										className="w-full h-[75vh] bg-background rounded-sm"
										style={{ border: 'none' }}
									/>
									<p className="text-[11px] text-muted-foreground px-1">
										Jika pratinjau kosong, gunakan tombol <strong>Tab baru</strong>{' '}
										untuk membuka atau mengunduh file.
									</p>
								</div>
							) : (
								<div className="w-full h-[40vh] bg-background rounded-sm border border-border flex items-center justify-center">
									<div className="text-center px-4">
										<p className="text-sm font-medium mb-1">
											Format file ini tidak didukung untuk embed
										</p>
										<p className="text-xs text-muted-foreground mb-3">
											Silakan buka di tab baru untuk melihat atau mengunduh file.
										</p>
										<a
											href={preview.url}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
										>
											<ExternalLink className="h-3.5 w-3.5" />
											Buka / Download file
										</a>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
