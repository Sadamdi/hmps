import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Nomor indeks arsip: 1 → "01", 71 → "71". */
export function formatArchiveIndex(n: number) {
	return String(n).padStart(2, '0');
}

/** Label nomor indeks di pojok kartu. `overlay` = di atas gambar. */
export function ArchiveIndex({
	n,
	overlay = false,
	className,
}: {
	n: number;
	overlay?: boolean;
	className?: string;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				'archive-index',
				overlay
					? 'absolute left-2 top-2 z-[3] rounded-md bg-background/85 px-1.5 py-0.5 text-foreground ring-1 ring-border/70'
					: 'text-primary',
				className,
			)}>
			{formatArchiveIndex(n)}
		</span>
	);
}

/**
 * Item grid dengan transisi layout: saat filter berubah, kartu yang tersisa
 * bergeser ke posisi baru, bukan berkedip. Stagger masuk di-cap 240ms.
 * Sengaja tanpa animasi exit: exit yang tertahan (tab tidak di-paint) bisa
 * membuat kartu halaman lama ikut tampil bersama halaman baru.
 */
export function ArchiveGridItem({
	children,
	order,
	className,
}: {
	children: ReactNode;
	order: number;
	className?: string;
}) {
	const reduced = useReducedMotion();
	if (reduced) return <div className={className}>{children}</div>;
	return (
		<motion.div
			layout="position"
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: 0.32,
				ease: [0.22, 1, 0.36, 1],
				delay: Math.min(order * 0.04, 0.24),
			}}
			className={className}>
			{children}
		</motion.div>
	);
}
