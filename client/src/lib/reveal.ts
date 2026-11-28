/**
 * Animasi masuk ringan pengganti AOS.
 *
 * - Membaca atribut lama `data-aos` (fade, fade-up, fade-left, fade-right, zoom-in), `data-aos-delay`, `data-aos-duration`
 *   sehingga markup halaman tidak perlu diubah.
 * - IntersectionObserver (dihitung browser, tanpa listener scroll) + MutationObserver ringan untuk elemen yang
 *   muncul belakangan (lazy section) — tidak ada hitung ulang posisi seluruh elemen.
 * - Hanya opacity + transform (komposit GPU). Elemen yang sudah terlihat saat dimuat langsung tampil tanpa animasi.
 * - `prefers-reduced-motion` → semua langsung tampil.
 *
 * Status disimpan di atribut data-aos-in / data-aos-done (bukan className) karena React menimpa className saat render ulang.
 *
 * API `refresh()` / `refreshHard()` tetap ada agar pemanggil lama aman (kini hanya memindai elemen baru).
 */
const SEL = '[data-aos]';
let io: IntersectionObserver | null = null;
let mo: MutationObserver | null = null;
const seen = new WeakSet<Element>();

function reduced(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function show(el: HTMLElement, animate: boolean) {
	if (!animate) {
		el.setAttribute('data-aos-in', 'i');
		return;
	}
	const d = Number(el.dataset.aosDelay || 0);
	const dur = Number(el.dataset.aosDuration || 0);
	if (d) el.style.transitionDelay = `${Math.min(d * 0.4, 120)}ms`;
	if (dur) el.style.transitionDuration = `${Math.min(dur, 480)}ms`;
	el.setAttribute('data-aos-in', '1');
	// Lepas will-change setelah selesai agar tidak menahan layer GPU.
	window.setTimeout(() => el.setAttribute('data-aos-done', ''), (d || 0) + (dur || 380) + 60);
}

function track(el: Element) {
	if (seen.has(el)) return;
	seen.add(el);
	const h = el as HTMLElement;
	if (!h.dataset.aos) return; // data-aos="" = tanpa animasi
	// Di dalam dialog/popover, atau di dalam elemen yang sudah beranimasi: tampil langsung (tidak dobel).
	if (!io || reduced() || h.closest('[role="dialog"],[data-radix-popper-content-wrapper]') || h.parentElement?.closest(SEL + ':not([data-aos=""])')) return show(h, false);
	// Semua elemen (termasuk yang langsung terlihat) dianimasikan saat pertama masuk layar;
	// IntersectionObserver langsung memicu yang sudah terlihat, berurutan sesuai urutan DOM.
	io.observe(h);
}

/**
 * Animasi otomatis untuk komponen yang belum punya data-aos: judul section, item grid, dan blok konten section.
 * Dilewati: header/nav/hero, dialog/popover, elemen fixed/sticky, elemen yang sudah punya animasi sendiri,
 * dan elemen di dalam elemen yang sudah beranimasi (agar tidak dobel). Tandai [data-no-reveal] untuk mengecualikan.
 */
const AUTO = [
	'section h2',
	'main h2',
	'[class*="grid"] > *',
	'section > div > *:not(:first-child)',
	'main > *',
	'main > div > *',
	'[class*="page-shell"] > *',
].join(',');
const SKIP = 'header,nav,footer [class*="grid"] > *,form,table,[role="dialog"],[data-radix-popper-content-wrapper],[data-no-reveal],#home,#hero,[data-hero]';

function autoTag(el: Element) {
	const h = el as HTMLElement;
	if (h.hasAttribute('data-aos') || h.closest(SKIP) || h.parentElement?.closest(SEL)) return;
	if (h.querySelector(SEL)) return; // anaknya sudah beranimasi sendiri
	const cs = getComputedStyle(h);
	if (cs.position === 'fixed' || cs.position === 'sticky' || cs.animationName !== 'none' || cs.display === 'none' || cs.display === 'contents') return;
	// Terlalu kecil, atau pembungkus besar (lebih tinggi dari layar) → biarkan anak-anaknya yang beranimasi satu per satu.
	if (h.offsetHeight < 24 || h.offsetHeight > window.innerHeight * 0.9) return;
	h.setAttribute('data-aos', 'fade-up');
}

/** Gambar tanpa mode decode → async, agar decode foto besar tidak memblokir scroll/animasi. */
function asyncImages(root: ParentNode) {
	if (root instanceof HTMLImageElement && !root.hasAttribute('decoding')) root.decoding = 'async';
	root.querySelectorAll?.('img:not([decoding])').forEach((i) => ((i as HTMLImageElement).decoding = 'async'));
}

function scan(root: ParentNode = document) {
	asyncImages(root);
	if (!reduced()) {
		if (root instanceof Element && root.matches(AUTO)) autoTag(root);
		root.querySelectorAll?.(AUTO).forEach(autoTag);
	}
	if (root instanceof Element && root.matches(SEL)) track(root);
	root.querySelectorAll?.(SEL).forEach(track);
}

export function initReveal() {
	if (typeof window === 'undefined' || io) return;
	document.documentElement.classList.add('reveal-ready');
	if (!('IntersectionObserver' in window) || reduced()) {
		io = null;
		scan();
		return;
	}
	io = new IntersectionObserver(
		(entries) => {
			// Elemen yang masuk bersamaan diberi jeda bertahap kecil (maks 6 × 45 ms) agar muncul berurutan, bukan serentak.
			let i = 0;
			for (const e of entries) {
				if (!e.isIntersecting) {
					// Sudah terlewat di atas layar (mis. section lazy dimuat saat lompat via navbar): tampil tanpa animasi.
					if (e.boundingClientRect.bottom < 0) {
						io?.unobserve(e.target);
						show(e.target as HTMLElement, false);
					}
					continue;
				}
				io?.unobserve(e.target);
				const el = e.target as HTMLElement;
				if (!el.dataset.aosDelay) el.dataset.aosDelay = String(Math.min(i, 6) * 45 / 0.4);
				i++;
				// Saat transisi halaman berjalan, halaman baru sudah dianimasikan utuh: jangan animasikan dobel.
				show(el, !document.documentElement.hasAttribute('data-vt'));
			}
		},
		{ rootMargin: '0px 0px 4% 0px', threshold: 0 },
	);
	scan();
	mo = new MutationObserver((list) => {
		for (const m of list) {
			if (m.type === 'attributes') track(m.target as Element);
			else m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n as Element));
		}
	});
	// Jaring pengaman: saat scroll berhenti (bukan tiap frame), tampilkan elemen di layar yang belum muncul.
	let tm = 0;
	const sweep = () => {
		document.querySelectorAll<HTMLElement>(SEL + ':not([data-aos=""]):not([data-aos-in])').forEach((el) => {
			const r = el.getBoundingClientRect();
			if (r.width && r.top < window.innerHeight && r.bottom > 0) {
				io?.unobserve(el);
				seen.add(el);
				show(el, true);
			} else if (r.width && r.bottom <= 0) {
				io?.unobserve(el);
				seen.add(el);
				show(el, false);
			}
		});
	};
	const onScroll = () => {
		window.clearTimeout(tm);
		tm = window.setTimeout(sweep, 140);
	};
	window.addEventListener('scroll', onScroll, { passive: true });
	window.setTimeout(sweep, 1200);
	// attributes: data-aos yang baru ditambahkan pada elemen yang sudah ada (mis. setelah data dimuat).
	mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-aos'] });
}

/** Kompatibel dengan pemanggilan AOS lama. */
export const refreshReveal = () => scan();

const Reveal = { init: initReveal, refresh: refreshReveal, refreshHard: refreshReveal };
export default Reveal;
