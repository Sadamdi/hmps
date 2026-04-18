import { cn } from '@/lib/utils';
import { Link } from 'wouter';

export type BreadcrumbItem = { label: string; href?: string };

export function PageBreadcrumb({
	items,
	className,
}: {
	items: BreadcrumbItem[];
	className?: string;
}) {
	if (!items.length) return null;
	return (
		<nav aria-label="Breadcrumb" className={cn('text-sm mb-4', className)}>
			<ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
				{items.map((item, i) => {
					const isLast = i === items.length - 1;
					return (
						<li key={`${item.label}-${i}`} className="inline-flex items-center gap-2">
							{i > 0 && (
								<span className="text-muted-foreground" aria-hidden>
									/
								</span>
							)}
							{isLast ? (
								<span className="font-semibold text-foreground">{item.label}</span>
							) : item.href ? (
								<Link
									href={item.href}
									className="text-muted-foreground hover:text-foreground transition-colors">
									{item.label}
								</Link>
							) : (
								<span className="text-muted-foreground">{item.label}</span>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
