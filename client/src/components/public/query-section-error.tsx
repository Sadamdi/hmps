import { RefreshCw } from 'lucide-react';

/** Inline error + retry untuk section home yang gagal load (bukan “data kosong”). */
export function QuerySectionError({
	message = 'Gagal memuat data. Coba lagi.',
	onRetry,
	isRetrying,
	compact,
}: {
	message?: string;
	onRetry: () => void;
	isRetrying?: boolean;
	compact?: boolean;
}) {
	return (
		<div
			className={
				compact
					? 'flex flex-col items-center justify-center gap-2 py-6 px-4 text-center'
					: 'flex flex-col items-center justify-center gap-3 py-12 px-4 text-center'
			}
			role="alert">
			<p className="text-sm text-muted-foreground max-w-sm">{message}</p>
			<button
				type="button"
				onClick={onRetry}
				disabled={isRetrying}
				className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/70 disabled:opacity-60 transition-colors">
				<RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
				{isRetrying ? 'Memuat…' : 'Coba lagi'}
			</button>
		</div>
	);
}
