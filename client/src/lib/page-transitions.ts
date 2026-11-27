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

function fallbackFade() {
	const el = document.getElementById('root');
	if (!el || typeof el.animate !== 'function') return;
	// Hanya opacity (tanpa transform) agar header sticky dan elemen fixed tidak terganggu.
	el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
}

export function initPageTransitions() {
	if (typeof window === 'undefined' || (window as any).__pageTransitions) return;
	(window as any).__pageTransitions = true;
	const doc = document as Document & { startViewTransition?: (cb: () => Promise<void> | void) => unknown };
	if (typeof doc.startViewTransition !== 'function') return;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	let active = false;

	const wrap = (orig: Nav): Nav =>
		function (this: History, data, unused, url) {
			const next = pathOf(url);
			const same = next === window.location.pathname;
			// Saat transisi masih berjalan (mis. halaman baru langsung menyinkronkan filter ke URL), jangan mulai transisi kedua.
			if (active || same || next == null || reduced.matches || document.hidden) return orig.call(this, data, unused, url);
			active = true;
			const vt = doc.startViewTransition!(
				() =>
					new Promise<void>((resolve) => {
						orig.call(history, data, unused, url);
						let done = false;
						const finish = () => {
							if (!done) {
								done = true;
								resolve();
							}
						};
						// Tunggu sebentar sampai halaman baru siap (biasanya instan karena kode sudah di-prefetch), maks 0,4 dtk;
						// lewat dari itu transisi tetap jalan dan kerangka halaman (skeleton) + progress bar yang tampil.
						// Pakai setTimeout (bukan requestAnimationFrame): selama view transition menyiapkan snapshot,
						// rendering ditahan sehingga rAF tidak berjalan dan transisi akan dibatalkan browser karena timeout.
						const t0 = performance.now();
						let ticks = 0;
						const check = () => {
							ticks++;
							const loading = document.querySelector('[data-route-loading]');
							if ((!loading && ticks >= 2) || performance.now() - t0 > 400) return finish();
							window.setTimeout(check, 16);
						};
						window.setTimeout(check, 16);
					}),
			) as { finished?: Promise<unknown>; ready?: Promise<unknown> } | undefined;
			// Jangan biarkan transisi yang dilewati/dibatalkan muncul sebagai error di konsol.
			// Bila browser membatalkan transisi (terjadi di sebagian HP), halaman baru tetap masuk dengan fade lembut.
			vt?.ready?.catch(() => fallbackFade());
			const done = () => {
				active = false;
			};
			if (vt?.finished) vt.finished.then(done, done);
			else done();
		};

	history.pushState = wrap(history.pushState);
}
