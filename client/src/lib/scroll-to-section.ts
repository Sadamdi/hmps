/**
 * Smooth scroll ke section beranda yang tahan terhadap layout shift.
 *
 * Section beranda banyak yang lazy (Suspense, gambar, AOS refresh), sehingga tinggi halaman
 * berubah saat animasi berjalan. `scrollIntoView` sekali jalan lalu berhenti di posisi basi
 * ("scroll lalu stuck"). Helper ini mengukur ulang target setelah scroll berhenti dan
 * mengoreksi beberapa kali, serta langsung mundur bila pengguna scroll sendiri.
 */

const MAX_DURATION_MS = 2500;
const SETTLE_MS = 140;
const MAX_CORRECTIONS = 4;

let activeCancel: (() => void) | null = null;

function targetTop(el: HTMLElement): number {
	const margin = parseFloat(getComputedStyle(el).scrollMarginTop || '0') || 0;
	const max = document.documentElement.scrollHeight - window.innerHeight;
	return Math.max(0, Math.min(max, el.getBoundingClientRect().top + window.scrollY - margin));
}

export function scrollToSection(id: string): boolean {
	const el = document.getElementById(id);
	if (!el) return false;

	activeCancel?.();
	const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';

	let cancelled = false;
	let corrections = 0;
	let lastY = window.scrollY;
	let lastMoveAt = performance.now();
	const startedAt = lastMoveAt;
	let raf = 0;

	const cleanup = () => {
		cancelled = true;
		cancelAnimationFrame(raf);
		window.removeEventListener('wheel', onUserInput);
		window.removeEventListener('touchstart', onUserInput);
		window.removeEventListener('keydown', onKey);
		if (activeCancel === cleanup) activeCancel = null;
	};
	// Pengguna mengambil alih → berhenti mengoreksi (tidak pernah "melawan" scroll manual)
	const onUserInput = () => cleanup();
	const onKey = (e: KeyboardEvent) => {
		if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) cleanup();
	};
	window.addEventListener('wheel', onUserInput, { passive: true });
	window.addEventListener('touchstart', onUserInput, { passive: true });
	window.addEventListener('keydown', onKey);
	activeCancel = cleanup;

	window.scrollTo({ top: targetTop(el), behavior });

	const tick = (now: number) => {
		if (cancelled) return;
		if (now - startedAt > MAX_DURATION_MS) return cleanup();
		const y = window.scrollY;
		if (Math.abs(y - lastY) > 0.5) {
			lastY = y;
			lastMoveAt = now;
		} else if (now - lastMoveAt > SETTLE_MS) {
			// Scroll berhenti: cek apakah target bergeser karena konten di atasnya baru dimuat
			const top = targetTop(el);
			if (Math.abs(top - y) <= 4 || corrections >= MAX_CORRECTIONS) return cleanup();
			corrections++;
			lastMoveAt = now;
			window.scrollTo({ top, behavior });
		}
		raf = requestAnimationFrame(tick);
	};
	raf = requestAnimationFrame(tick);
	return true;
}
