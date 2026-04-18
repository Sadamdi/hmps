import { animate, motionValue } from 'framer-motion';

/**
 * Animasi ikon kecil dari elemen sumber ke anchor keranjang (#store-cart-anchor).
 * No-op jika elemen tidak ada (mis. header belum mount).
 */
export function flyStoreCartIcon(fromEl: HTMLElement | null): void {
	if (typeof window === 'undefined' || !fromEl) return;
	const toEl = document.getElementById('store-cart-anchor');
	if (!toEl) return;

	const from = fromEl.getBoundingClientRect();
	const to = toEl.getBoundingClientRect();
	const size = 28;
	const startX = from.left + from.width / 2 - size / 2;
	const startY = from.top + from.height / 2 - size / 2;
	const endX = to.left + to.width / 2 - size / 2;
	const endY = to.top + to.height / 2 - size / 2;

	const el = document.createElement('div');
	el.setAttribute('aria-hidden', 'true');
	el.className =
		'pointer-events-none fixed z-[100] flex items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground shadow-lg';
	el.style.width = `${size}px`;
	el.style.height = `${size}px`;
	el.style.left = `${startX}px`;
	el.style.top = `${startY}px`;
	el.innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
	document.body.appendChild(el);

	const x = motionValue(startX);
	const y = motionValue(startY);
	const scale = motionValue(1);
	const opacity = motionValue(1);
	const unsubX = x.on('change', (v) => {
		el.style.left = `${v}px`;
	});
	const unsubY = y.on('change', (v) => {
		el.style.top = `${v}px`;
	});
	const unsubS = scale.on('change', (v) => {
		el.style.transform = `scale(${v})`;
	});
	const unsubO = opacity.on('change', (v) => {
		el.style.opacity = String(v);
	});

	const ease = [0.22, 0.61, 0.36, 1] as const;
	void Promise.all([
		animate(x, endX, { duration: 0.55, ease }),
		animate(y, endY, { duration: 0.55, ease }),
		animate(scale, 0.75, { duration: 0.55, ease }),
		animate(opacity, 0.65, { duration: 0.55, ease }),
	]).then(() => {
		unsubX();
		unsubY();
		unsubS();
		unsubO();
		el.remove();
		toEl.animate(
			[{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
			{ duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
		);
	});
}
