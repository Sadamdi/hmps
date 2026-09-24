import { PageBreadcrumb, type BreadcrumbItem } from '@/components/public/page-breadcrumb';
import { useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

export type ArchiveStat = {
	label: string;
	value: number | string;
};

type ArchiveHeaderProps = {
	breadcrumb: BreadcrumbItem[];
	/** Label di pill (mis. "Ruang redaksi") — pola sama dengan PublicSectionHeader */
	eyebrow: string;
	icon?: ReactNode;
	title: string;
	description?: ReactNode;
	/** Baris statistik mono di bawah deskripsi */
	stats?: ArchiveStat[];
	className?: string;
};

/** Count-up singkat sekali saat angka pertama kali tersedia. */
function useCountUp(target: number, enabled: boolean) {
	const [value, setValue] = useState(enabled ? 0 : target);
	useEffect(() => {
		if (!enabled || target <= 0) {
			setValue(target);
			return;
		}
		let raf = 0;
		const start = performance.now();
		const duration = 700;
		const tick = (now: number) => {
			const p = Math.min(1, (now - start) / duration);
			const eased = 1 - Math.pow(1 - p, 3);
			setValue(Math.round(target * eased));
			if (p < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [target, enabled]);
	return value;
}

function StatValue({ value }: { value: number | string }) {
	const reduced = useReducedMotion();
	const numeric = typeof value === 'number' ? value : NaN;
	const counted = useCountUp(Number.isFinite(numeric) ? numeric : 0, !reduced && Number.isFinite(numeric));
	return <>{Number.isFinite(numeric) ? String(counted).padStart(2, '0') : value}</>;
}

/**
 * Header halaman list (Berita / Event / Galeri).
 * Memakai bahasa yang sama dengan PublicSectionHeader di beranda
 * (pill eyebrow + garis cyan), tapi rata kiri dan dengan baris statistik mono.
 */
export function ArchiveHeader({
	breadcrumb,
	eyebrow,
	icon,
	title,
	description,
	stats,
	className = '',
}: ArchiveHeaderProps) {
	return (
		<header className={`archive-grid-bg border-b border-border/70 ${className}`}>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-8 sm:pb-10">
				<PageBreadcrumb items={breadcrumb} />
				<span className="reveal-heading mt-4 sm:mt-6 inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase">
					{icon ? <span className="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span> : null}
					{eyebrow}
				</span>
				<h1 className="reveal-heading reveal-heading-delay-1 mt-3 sm:mt-4 max-w-3xl text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
					{title}
				</h1>
				<div className="reveal-heading reveal-heading-delay-1 mt-4 w-28 sm:w-32 h-px bg-gradient-to-r from-cyan-400/70 via-cyan-400/40 to-transparent" />
				{description ? (
					<p className="reveal-heading reveal-heading-delay-2 mt-4 max-w-2xl text-sm sm:text-base leading-6 sm:leading-7 text-muted-foreground">
						{description}
					</p>
				) : null}
				{stats && stats.length > 0 ? (
					<dl className="reveal-heading reveal-heading-delay-2 mt-6 flex flex-wrap gap-x-6 gap-y-2">
						{stats.map((s) => (
							<div key={s.label} className="flex items-baseline gap-2">
								<dt className="sr-only">{s.label}</dt>
								<dd className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-primary">
									<StatValue value={s.value} />
								</dd>
								<span aria-hidden className="archive-meta">
									{s.label}
								</span>
							</div>
						))}
					</dl>
				) : null}
			</div>
		</header>
	);
}
