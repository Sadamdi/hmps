/**
 * Tombol "ke atas" melayang (kiri bawah, sejajar tombol Enco di kanan bawah).
 * Muncul hanya setelah halaman di-scroll setengah atau sudah dekat bagian bawah; menggulir halus ke atas.
 * Berlaku di semua halaman (kecuali halaman yang terlalu pendek untuk di-scroll).
 */
import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

export function ScrollToTopButton() {
	const [location] = useLocation();
	const [show, setShow] = useState(false);

	useEffect(() => {
		let raf = 0;
		const check = () => {
			raf = 0;
			const doc = document.documentElement;
			const scrollable = doc.scrollHeight - window.innerHeight;
			if (scrollable < 400) return setShow(false);
			const y = window.scrollY;
			const half = y >= scrollable * 0.5;
			const nearBottom = y + window.innerHeight >= doc.scrollHeight - 120;
			setShow(y > 200 && (half || nearBottom));
		};
		const onScroll = () => {
			if (!raf) raf = requestAnimationFrame(check);
		};
		check();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
			if (raf) cancelAnimationFrame(raf);
		};
	}, [location]);

	/** Gulir halus ber-easing (easeInOutCubic) — durasi menyesuaikan jarak, bisa disela scroll pengguna. */
	const toTop = () => {
		const start = window.scrollY;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || start < 1) return window.scrollTo(0, 0);
		const dur = Math.min(1100, 600 + start * 0.12);
		const t0 = performance.now();
		const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
		let cancelled = false;
		const cancel = () => {
			cancelled = true;
		};
		window.addEventListener('wheel', cancel, { passive: true, once: true });
		window.addEventListener('touchstart', cancel, { passive: true, once: true });
		const step = (now: number) => {
			if (cancelled) return;
			const k = Math.min(1, (now - t0) / dur);
			window.scrollTo(0, Math.round(start * (1 - ease(k))));
			if (k < 1) requestAnimationFrame(step);
			else {
				window.removeEventListener('wheel', cancel);
				window.removeEventListener('touchstart', cancel);
			}
		};
		requestAnimationFrame(step);
	};

	return (
		<div
			className={`fixed bottom-6 left-3 z-40 pb-[env(safe-area-inset-bottom)] transition-all duration-300 sm:left-6 print:hidden ${
				show ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
			}`}
			aria-hidden={!show}>
			<button
				type="button"
				onClick={toTop}
				tabIndex={show ? 0 : -1}
				aria-label="Gulir ke atas"
				title="Ke atas"
				className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/85 text-foreground shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:h-14 sm:w-14">
				<ArrowUp className="h-5 w-5 sm:h-6 sm:w-6" />
			</button>
		</div>
	);
}
