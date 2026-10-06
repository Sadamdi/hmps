import { Eye, Heart } from 'lucide-react';
import { formatCount } from '@/lib/store-stats';

/** "♥ 120 favorit · 👁 1,2 rb dilihat" — disembunyikan bila keduanya 0. */
export function StoreStatsLine({ favorites, views, className = '' }: { favorites?: number; views?: number; className?: string }) {
	const f = Math.max(0, Number(favorites) || 0);
	const v = Math.max(0, Number(views) || 0);
	if (!f && !v) return null;
	return (
		<p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground ${className}`}>
			<span className="inline-flex items-center gap-1" title={`${f} orang memfavoritkan`}>
				<Heart className="h-3 w-3" /> {formatCount(f)} favorit
			</span>
			<span className="inline-flex items-center gap-1" title={`${v} kali dilihat`}>
				<Eye className="h-3 w-3" /> {formatCount(v)} dilihat
			</span>
		</p>
	);
}
