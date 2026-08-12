import AOS from 'aos';
import { useEffect } from 'react';

/** Pastikan elemen [data-aos] lazy-mount ter-animate setelah masuk DOM. */
export function useAosRefreshOnMount() {
	useEffect(() => {
		const refresh = () => AOS.refreshHard();
		const raf = requestAnimationFrame(refresh);
		const t1 = window.setTimeout(refresh, 120);
		const t2 = window.setTimeout(refresh, 600);
		return () => {
			cancelAnimationFrame(raf);
			window.clearTimeout(t1);
			window.clearTimeout(t2);
		};
	}, []);
}
