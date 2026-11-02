import { DEFAULT_IMAGE_URL } from '@/constants/default-image';
import { Badge } from '@/components/ui/badge';
import { Film } from 'lucide-react';
import { Link } from 'wouter';

export interface RelatedCardItem {
	key: string;
	href: string;
	title: string;
	excerpt?: string;
	image?: string;
	/** Tampilkan placeholder video bila media pertama bukan gambar. */
	isVideo?: boolean;
	badges?: string[];
}

/** Kartu "terkait" bergaya sama dengan Berita Terkait; kosong = tidak dirender. */
export default function RelatedContentSection({
	heading,
	items,
}: {
	heading: string;
	items: RelatedCardItem[];
}) {
	if (!items.length) return null;
	return (
		<section
			className="mt-10 bg-card rounded-xl shadow-sm border border-border p-6"
			aria-label={heading}>
			<h3 className="text-xl font-bold text-foreground mb-5">{heading}</h3>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
				{items.map((it) => (
					<Link
						key={it.key}
						href={it.href}
						className="group block bg-muted/40 rounded-lg overflow-hidden border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200">
						<div className="aspect-video overflow-hidden bg-muted flex items-center justify-center">
							{it.isVideo ? (
								<Film className="h-10 w-10 text-muted-foreground" aria-hidden />
							) : (
								<img
									src={it.image || DEFAULT_IMAGE_URL}
									alt={it.title}
									loading="lazy"
									className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
									onError={(e) => {
										(e.target as HTMLImageElement).src = DEFAULT_IMAGE_URL;
									}}
								/>
							)}
						</div>
						<div className="p-4">
							<h4 className="text-base font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
								{it.title}
							</h4>
							{it.excerpt ? (
								<p className="text-sm text-muted-foreground line-clamp-2 mb-2">
									{it.excerpt}
								</p>
							) : null}
							{it.badges && it.badges.length > 0 ? (
								<div className="flex flex-wrap gap-1">
									{it.badges.slice(0, 3).map((b) => (
										<Badge key={b} variant="secondary" className="text-xs">
											{b}
										</Badge>
									))}
								</div>
							) : null}
						</div>
					</Link>
				))}
			</div>
		</section>
	);
}
