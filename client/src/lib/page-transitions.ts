/**
 * Transisi antarhalaman yang ringan memakai View Transitions API (snapshot oleh browser, dianimasikan di GPU).
 *
 * Wouter berpindah halaman lewat history.pushState/replaceState; navigasi itu dibungkus
 * document.startViewTransition sehingga konten lama memudar dan konten baru masuk halus.
 * Header (.site-header) diberi view-transition-name tersendiri agar tetap diam.
 *
 * Tautan biasa (<a href>) dan softNavigate() juga berpindah tanpa muat ulang agar ikut beranimasi; tombol kembali/maju ikut.
 *
 * Animasi tidak aktif bila: browser tidak mendukung, prefers-reduced-motion, perpindahan hanya query/hash pada path yang sama,
 * atau tab sedang tersembunyi. Pada kondisi itu navigasi berjalan instan seperti biasa.
 */
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

/** Awalan halaman situs utama yang aman dipindah tanpa muat ulang (komunitas lain tetap muat ulang penuh). */
const SPA_ROOTS = ['', 'berita', 'profil', 'kelembagaan', 'prodi', 'events', 'library', 'youtube', 'instagram', 'toko', 'ruang-mahasiswa', 'communities', 'verifikasi', 'daftar'];

function isSoftTarget(u: URL): boolean {
	if (u.origin !== window.location.origin || /\.[a-z0-9]{2,5}$/i.test(u.pathname)) return false;
	const to = u.pathname.split('/')[1] || '';
	const from = window.location.pathname.split('/')[1] || '';
	// Di situs utama: hanya halaman yang dikenal. Di dalam komunitas: hanya sesama komunitas yang sama.
	if (SPA_ROOTS.includes(from)) return SPA_ROOTS.includes(to);
	return to === from && !['login', 'register', 'dashboard', 'api'].includes(to);
}

/** Pindah halaman secara halus; jatuh ke muat ulang biasa bila tujuannya bukan halaman aplikasi. */
export function softNavigate(url: string) {
	const u = new URL(url, window.location.href);
	if (!isSoftTarget(u) || u.pathname === window.location.pathname) {
		window.location.href = url;
		return;
	}
	history.pushState(null, '', u.pathname + u.search + u.hash);
}

function onLinkClick(e: MouseEvent) {
	if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
	const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
	if (!a || a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
	const u = new URL(a.href, window.location.href);
	if (!isSoftTarget(u) || u.pathname === window.location.pathname) return;
	e.preventDefault();
	history.pushState(null, '', u.pathname + u.search + u.hash);
}

export function initPageTransitions() {
	if (typeof window === 'undefined' || (window as any).__pageTransitions) return;
	(window as any).__pageTransitions = true;
	window.addEventListener('click', onLinkClick);
	const doc = document as Document & { startViewTransition?: (cb: () => Promise<void> | void) => unknown };
	if (typeof doc.startViewTransition !== 'function') return;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	const root = document.documentElement;
	let active = false;
	let current = window.location.pathname;

	const skip = () => active || reduced.matches || document.hidden;

	/** Jalankan `apply` (mengganti halaman) di dalam view transition. */
	const run = (apply: () => void) => {
		active = true;
		// Selama transisi, elemen yang sudah di layar tampil langsung (reveal.ts) agar tidak ada animasi dobel.
		root.setAttribute('data-vt', '');
		const vt = doc.startViewTransition!(
			() =>
				new Promise<void>((resolve) => {
					apply();
					// Tunggu sampai halaman baru siap (biasanya instan karena kode sudah di-prefetch), maks 0,4 dtk.
					// Pakai setTimeout (bukan requestAnimationFrame): selama view transition menyiapkan snapshot,
					// rendering ditahan sehingga rAF tidak berjalan dan transisi akan dibatalkan browser karena timeout.
					const t0 = performance.now();
					let ticks = 0;
					const check = () => {
						ticks++;
						const loading = document.querySelector('[data-route-loading]');
						if ((!loading && ticks >= 2) || performance.now() - t0 > 400) return resolve();
						window.setTimeout(check, 16);
					};
					window.setTimeout(check, 16);
				}),
		) as { finished?: Promise<unknown>; ready?: Promise<unknown> } | undefined;
		// Bila browser membatalkan transisi (terjadi di sebagian HP), halaman baru tetap masuk dengan fade lembut.
		vt?.ready?.catch(() => fallbackFade());
		const done = () => {
			active = false;
			root.removeAttribute('data-vt');
		};
		if (vt?.finished) vt.finished.then(done, done);
		else done();
	};

	const orig = history.pushState;
	history.pushState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
		const next = pathOf(url);
		const changes = next != null && next !== window.location.pathname;
		const go = () => {
			orig.call(history, data, unused, url);
			current = window.location.pathname;
			// Halaman baru mulai dari atas (tanpa hash), tanpa efek gulir.
			if (changes && !window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
		};
		if (!changes || skip()) return go();
		run(go);
	};

	// Tombol kembali/maju: tahan popstate asli, lalu teruskan di dalam transisi.
	const replayed = new WeakSet<Event>();
	window.addEventListener(
		'popstate',
		(e) => {
			if (replayed.has(e)) return;
			const changes = window.location.pathname !== current;
			current = window.location.pathname;
			if (!changes || skip()) return;
			e.stopImmediatePropagation();
			run(() => {
				const again = new PopStateEvent('popstate', { state: e.state });
				replayed.add(again);
				window.dispatchEvent(again);
			});
		},
		true,
	);

	const replace = history.replaceState;
	history.replaceState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
		replace.call(history, data, unused, url);
		current = window.location.pathname;
	};
}
