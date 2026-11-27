/**
 * Transisi antarhalaman yang ringan memakai View Transitions API (snapshot oleh browser, dianimasikan di GPU).
 *
 * Wouter berpindah halaman lewat history.pushState/replaceState; navigasi itu dibungkus
 * document.startViewTransition sehingga konten lama memudar dan konten baru masuk halus.
 * Header (.site-header) diberi view-transition-name tersendiri agar tetap diam.
 *
 * Tidak aktif bila: browser tidak mendukung, prefers-reduced-motion, perpindahan hanya query/hash pada path yang sama,
 * atau tab sedang tersembunyi. Pada kondisi itu navigasi berjalan instan seperti biasa.
 */
type Nav = (data: unknown, unused: string, url?: string | URL | null) => void;

function pathOf(url?: string | URL | null): string | null {
	if (url == null) return null;
	try {
		return new URL(String(url), window.location.href).pathname;
	} catch {
		return null;
	}
}

export function initPageTransitions() {
	if (typeof window === 'undefined' || (window as any).__pageTransitions) return;
	(window as any).__pageTransitions = true;
	const doc = document as Document & { startViewTransition?: (cb: () => Promise<void> | void) => unknown };
	if (typeof doc.startViewTransition !== 'function') return;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

	const wrap = (orig: Nav): Nav =>
		function (this: History, data, unused, url) {
			const next = pathOf(url);
			const same = next === window.location.pathname;
			if (same || next == null || reduced.matches || document.hidden) return orig.call(this, data, unused, url);
			doc.startViewTransition!(
				() =>
					new Promise<void>((resolve) => {
						orig.call(history, data, unused, url);
						// Tunggu React menggambar halaman baru (2 frame), batasi agar tidak pernah menggantung.
						let done = false;
						const finish = () => {
							if (!done) {
								done = true;
								resolve();
							}
						};
						requestAnimationFrame(() => requestAnimationFrame(finish));
						window.setTimeout(finish, 120);
					}),
			);
		};

	history.pushState = wrap(history.pushState);
}
