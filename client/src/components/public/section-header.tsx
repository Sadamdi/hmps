import type { ReactNode, Ref } from 'react';

type PublicSectionHeaderProps = {
	/** Label di pill (mis. "Berita", "Instagram") */
	eyebrow: string;
	/** Judul utama section */
	title: string;
	/** Deskripsi di bawah garis */
	description?: string;
	/** Ikon di dalam pill */
	icon?: ReactNode;
	className?: string;
	headingRef?: Ref<HTMLDivElement>;
	/** Untuk animasi reveal existing */
	visible?: boolean;
	/** Aksi di bawah deskripsi (CTA, link profil, dll.) */
	actions?: ReactNode;
};

/**
 * Pola heading beranda yang seragam:
 * pill (icon + label) → judul → garis cyan → deskripsi
 */
export function PublicSectionHeader({
	eyebrow,
	title,
	description,
	icon,
	className = '',
	headingRef,
	visible = true,
	actions,
}: PublicSectionHeaderProps) {
	const show = visible;
	return (
		<div ref={headingRef} className={`text-center mb-8 sm:mb-12 ${className}`}>
			<span
				className={`inline-flex items-center gap-2 px-3 py-1 mb-3 sm:mb-4 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase ${
					show ? 'reveal-heading' : 'opacity-0'
				}`}>
				{icon ? <span className="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span> : null}
				{eyebrow}
			</span>
			<h2
				className={`text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3 sm:mb-4 ${
					show ? 'reveal-heading reveal-heading-delay-1' : 'opacity-0'
				}`}>
				{title}
			</h2>
			<div
				className={`mx-auto w-28 sm:w-32 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent mb-3 sm:mb-4 ${
					show ? 'reveal-heading reveal-heading-delay-1' : 'opacity-0'
				}`}
			/>
			{description ? (
				<p
					className={`text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-6 sm:leading-7 ${
						show ? 'reveal-heading reveal-heading-delay-2' : 'opacity-0'
					}`}>
					{description}
				</p>
			) : null}
			{actions ? <div className="mt-4 flex justify-center">{actions}</div> : null}
		</div>
	);
}
