import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useStoreFavorites } from '@/hooks/use-store-favorites';
import { cn } from '@/lib/utils';

interface StoreFavoriteButtonProps {
	productId: string;
	className?: string;
	/** Tampilkan teks di samping ikon (halaman detail) */
	withLabel?: boolean;
}

export function StoreFavoriteButton({ productId, className, withLabel }: StoreFavoriteButtonProps) {
	const { isFavorite, toggleFavorite } = useStoreFavorites();
	const { toast } = useToast();
	const on = isFavorite(productId);
	return (
		<Button
			type="button"
			variant={withLabel ? 'outline' : 'secondary'}
			size={withLabel ? 'lg' : 'icon'}
			aria-pressed={on}
			aria-label={on ? 'Hapus dari favorit' : 'Tambah ke favorit'}
			className={cn(!withLabel && 'h-9 w-9 rounded-full bg-background/80 backdrop-blur', className)}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				const nowOn = toggleFavorite(productId);
				toast({ title: nowOn ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit' });
			}}>
			<Heart className={cn('h-4 w-4', on && 'fill-rose-500 text-rose-500')} />
			{withLabel && <span className="ml-2">{on ? 'Difavoritkan' : 'Favorit'}</span>}
		</Button>
	);
}
