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
							) : (
								<iframe
									src={toBestPreviewSrc(preview)}
									title={preview.name}
									className="w-full h-[75vh] bg-background rounded-sm"
									style={{ border: 'none' }}
								/>
							)}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
