/**
 * Kerangka konten berkilau pengganti spinner saat data halaman belum datang.
 * Atribut data-route-loading membuat transisi halaman menunggu sebentar (maks 0,4 dtk) sampai konten siap.
 */
type Variant = 'grid' | 'list' | 'detail';

const line = (className: string) => <div className={`skeleton-line ${className}`} />;

export function ContentSkeleton({ variant = 'grid', count }: { variant?: Variant; count?: number }) {
	const items = Array.from({ length: count ?? (variant === 'grid' ? 6 : 3) });
	return (
		<div data-route-loading aria-busy="true" aria-label="Memuat">
			{variant === 'detail' ? (
				<div className="grid gap-8 md:grid-cols-2">
					{line('aspect-square w-full rounded-2xl')}
					<div>
						{line('h-8 w-3/4')}
						{line('mt-4 h-6 w-1/3')}
						{line('mt-8 h-3 w-full')}
						{line('mt-3 h-3 w-5/6')}
						{line('mt-3 h-3 w-2/3')}
						{line('mt-10 h-11 w-full rounded-lg')}
					</div>
				</div>
			) : (
				<div className={variant === 'grid' ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
					{items.map((_, i) => (
						<div key={i} className="skeleton-card" style={{ animationDelay: `${i * 60}ms` }}>
							{variant === 'grid' && line('aspect-[4/3] w-full rounded-xl')}
							{line(variant === 'grid' ? 'mt-4 h-4 w-3/4' : 'h-4 w-1/2')}
							{line('mt-3 h-3 w-1/3')}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
