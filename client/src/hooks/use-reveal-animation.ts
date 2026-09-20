import { useEffect, useRef, useState } from 'react';

/**
 * useRevealAnimation
 * - Membuka animasi reveal (fade/slide) saat node masuk viewport.
 * - Hardening: kalau node sudah di dalam viewport saat effect jalan (mis. section
 *   di-render langsung terlihat, atau user scroll cepat), tetap dianggap visible
 *   tanpa harus menunggu IntersectionObserver fire.
 * - Fallback timeout 800ms: kalau IntersectionObserver somehow tidak pernah
 *   trigger (mis. tab inactive, rootMargin aneh, threshold tidak terpenuhi),
 *   paksa visible agar konten tidak terjebak opacity-0 selamanya.
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

		// Fallback safety net: kalau observer somehow tidak pernah fire
		// (mis. tab inactive lalu user kembali, atau threshold tidak tercapai),
		// paksa visible setelah 800ms agar konten tidak invisible selamanya.
		const fallback = window.setTimeout(() => {
			setIsVisible((prev) => {
				if (prev) return prev;
				try {
					const rect = node.getBoundingClientRect();
					const vh = window.innerHeight || document.documentElement.clientHeight;
					if (rect.top < vh && rect.bottom > 0) {
						return true;
					}
				} catch {
					// ignore
				}
				// Tidak dalam viewport: tetap invisible, observer akan handle.
				return prev;
			});
		}, 800);

		return () => {
			observer.disconnect();
			window.clearTimeout(fallback);
		};
	}, [threshold, isVisible]);

	return { ref, isVisible };
}
