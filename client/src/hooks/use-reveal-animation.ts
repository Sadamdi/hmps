import { useEffect, useRef, useState } from 'react';

/**
 * useRevealAnimation
 * - Membuka animasi reveal (fade/slide) saat node masuk viewport.
 * - Hardening: kalau node sudah di dalam viewport saat effect jalan (mis. section
 *   di-render langsung terlihat, atau user scroll cepat), tetap dianggap visible
 *   tanpa harus menunggu IntersectionObserver fire.
 * - Fallback timeout 800ms: kalau observer somehow tidak pernah trigger
 *   (mis. tab inactive, rootMargin aneh, threshold tidak terpenuhi, atau
 *   section masih di luar viewport saat user pertama kali load halaman),
 *   paksa visible setelah 800ms. Lebih baik reveal sebelum masuk viewport
 *   daripada stuck opacity-0 selamanya — section header yang menghilang
 *   adalah bug UX yang fatal, sedangkan reveal yang sedikit lebih cepat
 *   dari yang ideal hanya masalah kosmetik.
 * - Fallback tambahan 2500ms: pengaman terakhir kalau 800ms pertama tidak
 *   sempat terpasang karena ada re-render/race dengan dependencies lain.
 */
export function useRevealAnimation(threshold = 0.05) {
	const ref = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		if (isVisible) return;
		const node = ref.current;
		if (!node) return;

		// Cek viewport langsung: kalau node sudah terlihat pada saat mount,
		// langsung set visible supaya tidak ketergantungan observer callback.
		try {
			const rect = node.getBoundingClientRect();
			const vh = window.innerHeight || document.documentElement.clientHeight;
			const vw = window.innerWidth || document.documentElement.clientWidth;
			if (rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw) {
				setIsVisible(true);
				return;
			}
		} catch {
			// getBoundingClientRect bisa throw di SSR, abaikan.
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{ threshold }
		);

		observer.observe(node);

		// Fallback safety net 1 (800ms): paksa visible tanpa peduli posisi viewport.
		// IntersectionObserver kadang tidak fire kalau node di luar viewport dan
		// rootMargin default tidak cukup, atau kalau ada bug browser tertentu.
		const fallback = window.setTimeout(() => {
			setIsVisible((prev) => prev || true);
		}, 800);

		// Fallback safety net 2 (2500ms): pengaman terakhir kalau effect sempat
		// di-cleanup (mis. isVisible berubah) sebelum observer sempat mount.
		const fallbackHard = window.setTimeout(() => {
			setIsVisible((prev) => prev || true);
		}, 2500);

		return () => {
			observer.disconnect();
			window.clearTimeout(fallback);
			window.clearTimeout(fallbackHard);
		};
	}, [threshold, isVisible]);

	return { ref, isVisible };
}