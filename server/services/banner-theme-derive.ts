/**
 * Derivasi palet banner dari satu "warna tema".
 *
 * Referensi: template PSD `tamplate_benner.psd` memakai:
 *   - Gradient Map 1 stop 0 = #6b2896 (gelap/ungu), stop 1 = #4b78c8 (terang/biru)
 *   - Rectangle 1 (strip nama) ≈ #5953af
 *   - Rectangle 2/3 (kabut bawah) ≈ #6b2896 (serupa GM stop 0)
 *
 * Algoritme: hitung pergeseran hue dari GM-stop-0 referensi ke warna tema yang dipilih,
 * lalu terapkan shift yang sama ke semua warna referensi — mempertahankan jarak relatif
 * antar elemen persis seperti di PSD asli.
 */

/* --- HSL helpers (0-360 / 0-1 / 0-1) --- */

function rgbToHsl(
	r: number,
	g: number,
	b: number,
): { h: number; s: number; l: number } {
	const R = r / 255;
	const G = g / 255;
	const B = b / 255;
	const max = Math.max(R, G, B);
	const min = Math.min(R, G, B);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = 0;
	if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
	else if (max === G) h = ((B - R) / d + 2) / 6;
	else h = ((R - G) / d + 4) / 6;
	return { h: h * 360, s, l };
}

function hslToRgb(
	h: number,
	s: number,
	l: number,
): { r: number; g: number; b: number } {
	const H = ((h % 360) + 360) % 360;
	if (s === 0) {
		const v = Math.round(l * 255);
		return { r: v, g: v, b: v };
	}
	const hue2rgb = (p: number, q: number, t: number) => {
		let tt = t;
		if (tt < 0) tt += 1;
		if (tt > 1) tt -= 1;
		if (tt < 1 / 6) return p + (q - p) * 6 * tt;
		if (tt < 1 / 2) return q;
		if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
		return p;
	};
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const hN = H / 360;
	return {
		r: Math.round(hue2rgb(p, q, hN + 1 / 3) * 255),
		g: Math.round(hue2rgb(p, q, hN) * 255),
		b: Math.round(hue2rgb(p, q, hN - 1 / 3) * 255),
	};
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const h = hex.replace(/^#/, '');
	const n = parseInt(h, 16);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
	const c = (x: number) =>
		Math.max(0, Math.min(255, Math.round(x)))
			.toString(16)
			.padStart(2, '0');
	return `#${c(r)}${c(g)}${c(b)}`;
}

/* --- Konstanta referensi template PSD --- */

const REF_GM_STOP0 = '#6b2896'; // Gradient Map stop 0 (gelap)
const REF_GM_STOP1 = '#4b78c8'; // Gradient Map stop 1 (terang)
const REF_STRIPE = '#5953af'; // Rectangle 1 (strip nama)
const REF_FOG = '#6b2896'; // Rectangle 2/3 (kabut — warna mirip GM stop 0)

/** Geser hue suatu warna referensi (hex) sebesar Δh derajat; saturasi/lightness dipertahankan. */
function shiftHue(refHex: string, deltaH: number): string {
	const rgb = hexToRgb(refHex);
	const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
	const shifted = hslToRgb(hsl.h + deltaH, hsl.s, hsl.l);
	return rgbToHex(shifted.r, shifted.g, shifted.b);
}

export interface DerivedBannerColors {
	bgHex: string;
	accentHex: string;
	nameStripeHex: string;
	fogHex: string;
}

/**
 * Dari satu `themeHex` (#RRGGBB), turunkan empat warna banner.
 *
 * `themeHex` dipakai sebagai Gradient Map stop-0 (warna gelap).
 * Tiga warna lainnya di-shift-hue agar jarak relatif sama seperti template.
 */
export function deriveBannerColorsFromTheme(
	themeHex: string,
): DerivedBannerColors {
	const themeRgb = hexToRgb(themeHex);
	const themeHsl = rgbToHsl(themeRgb.r, themeRgb.g, themeRgb.b);

	const refRgb = hexToRgb(REF_GM_STOP0);
	const refHsl = rgbToHsl(refRgb.r, refRgb.g, refRgb.b);

	const deltaH = themeHsl.h - refHsl.h;

	return {
		bgHex: themeHex,
		accentHex: shiftHue(REF_GM_STOP1, deltaH),
		nameStripeHex: shiftHue(REF_STRIPE, deltaH),
		fogHex: shiftHue(REF_FOG, deltaH),
	};
}

/** Default "warna tema" = GM stop 0 template. */
export const DEFAULT_THEME_COLOR = REF_GM_STOP0;
