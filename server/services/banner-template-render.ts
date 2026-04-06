/**
 * Render banner WebP di server (tanpa Photopea): baca PSD template, ubah teks/foto/warna,
 * lalu flatten dengan urutan layer yang cocok dengan `tamplate_benner.psd`.
 */
import type { Color, Layer, Psd } from 'ag-psd';
import { readPsd } from 'ag-psd';
import 'ag-psd/initialize-canvas.js';
import {
	createCanvas,
	ImageData,
	CanvasRenderingContext2D as NodeCanvas2D,
	registerFont,
} from 'canvas';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Font teks banner: urutan pertama yang ada di `attached_assets/fonts/` dipakai.
 * Taruh salah satu: Helvetica-BoldOblique (prioritas), Vipnagorgialla, Owners Wide Black Italic, Montserrat, dll.
 */
const _fontsDir = path.join(process.cwd(), 'attached_assets', 'fonts');

type BannerFontFn = (sizePx: number) => string;

const BANNER_FONT_SETUPS: ReadonlyArray<{
	files: readonly string[];
	register: (fontPath: string) => void;
	makeFont: BannerFontFn;
}> = [
	/* Helvetica Bold Oblique — file di repo: Helvetica-BoldOblique.ttf */
	{
		files: [
			'Helvetica-BoldOblique.ttf',
			'Helvetica-BoldOblique.otf',
			'Helvetica-Bold-Oblique.otf',
			'Helvetica-Bold-Oblique.ttf',
		],
		register: (p) =>
			registerFont(p, {
				family: 'BannerTemplateText',
				weight: 'bold',
				style: 'italic',
			}),
		makeFont: (fsz) => `italic 900 ${fsz}px "BannerTemplateText", sans-serif`,
	},
	{
		files: ['Vipnagorgialla-BoldItalic.ttf', 'Vipnagorgialla-BoldItalic.otf'],
		register: (p) =>
			registerFont(p, {
				family: 'BannerTemplateText',
				weight: 'bold',
				style: 'italic',
			}),
		makeFont: (fsz) => `italic 900 ${fsz}px "BannerTemplateText", sans-serif`,
	},
	{
		files: [
			'OwnersWide-BlackItalic.ttf',
			'OwnersWideBlackItalic.ttf',
			'Owners-Wide-Black-Italic.otf',
		],
		register: (p) =>
			registerFont(p, {
				family: 'BannerTemplateText',
				weight: 'bold',
				style: 'italic',
			}),
		makeFont: (fsz) => `italic 900 ${fsz}px "BannerTemplateText", sans-serif`,
	},
	{
		files: [
			'Montserrat-ExtraBold.ttf',
			'Montserrat-ExtraBold.otf',
			'MontserratExtraBold.ttf',
		],
		register: (p) =>
			registerFont(p, {
				family: 'BannerTemplateText',
				weight: 'bold',
				style: 'normal',
			}),
		/* italic di string = oblique sintetis + shear canvas — lebih miring di preview */
		makeFont: (fsz) => `italic 900 ${fsz}px "BannerTemplateText", sans-serif`,
	},
	{
		files: ['banner-template.ttf', 'banner-template.otf'],
		register: (p) =>
			registerFont(p, {
				family: 'BannerTemplateText',
				weight: 'bold',
				style: 'italic',
			}),
		makeFont: (fsz) => `italic 900 ${fsz}px "BannerTemplateText", sans-serif`,
	},
];

let makeBannerFont: BannerFontFn | null = null;
for (const setup of BANNER_FONT_SETUPS) {
	for (const fname of setup.files) {
		const fp = path.join(_fontsDir, fname);
		if (!fs.existsSync(fp)) continue;
		try {
			setup.register(fp);
			makeBannerFont = setup.makeFont;
			console.log('[banner-render] Font teks:', fp);
			break;
		} catch (e) {
			console.warn('[banner-render] Gagal registerFont:', fp, e);
		}
	}
	if (makeBannerFont) break;
}

export type BannerServerRenderInput = {
	templatePsdPath: string;
	personName: string;
	divisionText: string;
	bgHex: string;
	accentHex: string;
	/** Kotak di belakang teks nama (layer Rectangle 1) */
	nameStripeHex: string;
	/** Kabut / overlay bawah (utama: Rectangle 2 — semi-transparan di template) */
	fogHex: string;
	showNameDivision: boolean;
	photoBuffer?: Buffer | null;
	/** Logo mengganti layer "Logo Techno"; dipakai hanya jika showLogo + buffer ada */
	logoBuffer?: Buffer | null;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const h = hex.replace(/^#/, '');
	if (h.length !== 6) throw new Error('Warna harus #RRGGBB');
	const n = parseInt(h, 16);
	if (Number.isNaN(n)) throw new Error('Format warna tidak valid');
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function findLayerByNames(
	children: Layer[] | undefined,
	names: string[],
): Layer | undefined {
	if (!children) return undefined;
	for (const n of names) {
		const hit = children.find((c) => c.name === n);
		if (hit) return hit;
	}
	return undefined;
}

/** Gradient map PSD bisa pakai RGB atau FRGB (float 0–1); ag-psd union `Color` tidak selalu punya `.r`. */
function colorStopToRgb888(c: Color): { r: number; g: number; b: number } {
	if ('fr' in c && 'fg' in c && 'fb' in c) {
		return {
			r: Math.round(c.fr * 255),
			g: Math.round(c.fg * 255),
			b: Math.round(c.fb * 255),
		};
	}
	if ('r' in c && 'g' in c && 'b' in c) {
		return {
			r: Math.round(c.r),
			g: Math.round(c.g),
			b: Math.round(c.b),
		};
	}
	if ('k' in c && typeof (c as { k: number }).k === 'number') {
		const k = Math.round((c as { k: number }).k);
		return { r: k, g: k, b: k };
	}
	return { r: 0, g: 0, b: 0 };
}

function gradientMapRgb(
	r: number,
	g: number,
	b: number,
	s0: { r: number; g: number; b: number },
	s1: { r: number; g: number; b: number },
): { r: number; g: number; b: number } {
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	const u = Math.max(0, Math.min(1, lum));
	return {
		r: s0.r + (s1.r - s0.r) * u,
		g: s0.g + (s1.g - s0.g) * u,
		b: s0.b + (s1.b - s0.b) * u,
	};
}

function applyGradientMapPass(
	ctx: NodeCanvas2D,
	width: number,
	height: number,
	gmLayer: Layer,
) {
	const adj = gmLayer.adjustment;
	if (!adj || adj.type !== 'gradient map' || !adj.colorStops?.length) return;
	const op = gmLayer.opacity ?? 1;
	const a = colorStopToRgb888(adj.colorStops[0].color);
	const b = colorStopToRgb888(adj.colorStops[adj.colorStops.length - 1].color);
	const img = ctx.getImageData(0, 0, width, height);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) {
		const g = gradientMapRgb(d[i], d[i + 1], d[i + 2], a, b);
		d[i] = Math.round(d[i] * (1 - op) + g.r * op);
		d[i + 1] = Math.round(d[i + 1] * (1 - op) + g.g * op);
		d[i + 2] = Math.round(d[i + 2] * (1 - op) + g.b * op);
	}
	ctx.putImageData(img, 0, 0);
}

const INK_ALPHA_THRESH = 22;
const LAYER_INK_PAD = 3;
const LOGO_CLEAR_PAD = 8;
/** Skala vs fontSize PSD — mengisi strip seperti referensi (teks besar) */
const BANNER_FONT_SIZE_MULT = 2.75;
const FSZ_CAP = 980;
/** Shear horizontal setelah transform PSD; nilai negatif = miring ke arah berlawanan dari shear positif */
const ITALIC_SHEAR = -0.45;
const NUDGE_PX = 10;
/**
 * Jarak antar huruf dalam satu string (tracking), px ditambah setelah lebar glyph —
 * nama tidak dempet. Diskalakan dengan ukuran font.
 */
const BANNER_LETTER_TRACKING_MIN = 10;
const BANNER_LETTER_TRACKING_FRAC = 0.292;

type DocRect = { left: number; top: number; right: number; bottom: number };

/** Batas piksel non-transparan di bitmap layer (lokal), untuk logo = area gambar nyata bukan seluruh kotak contain */
function getOpaquePixelBoundsLocal(canvas: {
	width: number;
	height: number;
	getContext: (mode: '2d') => unknown;
}): { minX: number; minY: number; maxX: number; maxY: number } | null {
	const w = canvas.width;
	const h = canvas.height;
	const ctx = canvas.getContext('2d') as NodeCanvas2D | null;
	if (!ctx) return null;
	const img = ctx.getImageData(0, 0, w, h);
	const d = img.data;
	let minX = w;
	let minY = h;
	let maxX = -1;
	let maxY = -1;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			if (d[i + 3] > INK_ALPHA_THRESH) {
				if (x < minX) minX = x;
				if (y < minY) minY = y;
				if (x > maxX) maxX = x;
				if (y > maxY) maxY = y;
			}
		}
	}
	if (maxX < 0) return null;
	return { minX, minY, maxX, maxY };
}

/** Kotak logo di koordinat dokumen dari piksel terlihat — hindari memakai seluruh layer (contain membuat kotak besar). */
function logoInkRectInDocument(logoLayer: Layer): DocRect | undefined {
	if (!logoLayer.canvas) return undefined;
	const local = getOpaquePixelBoundsLocal(logoLayer.canvas);
	if (!local) return undefined;
	const lx = logoLayer.left ?? 0;
	const ly = logoLayer.top ?? 0;
	const pad = 4;
	return {
		left: lx + local.minX - pad,
		top: ly + local.minY - pad,
		right: lx + local.maxX + 1 + pad,
		bottom: ly + local.maxY + 1 + pad,
	};
}

function getInkBounds(
	ctx: NodeCanvas2D,
	width: number,
	height: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
	const img = ctx.getImageData(0, 0, width, height);
	const d = img.data;
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;
	for (let y = 0; y < height; y++) {
		const row = y * width * 4;
		for (let x = 0; x < width; x++) {
			const i = row + x * 4;
			if (d[i + 3] > INK_ALPHA_THRESH) {
				if (x < minX) minX = x;
				if (y < minY) minY = y;
				if (x > maxX) maxX = x;
				if (y > maxY) maxY = y;
			}
		}
	}
	if (maxX < 0) return null;
	return { minX, minY, maxX, maxY };
}

function inkFitsLayer(
	ink: { minX: number; minY: number; maxX: number; maxY: number },
	lx: number,
	ly: number,
	lw: number,
	lh: number,
	pad: number,
): boolean {
	return (
		ink.minX >= lx - pad &&
		ink.maxX <= lx + lw + pad &&
		ink.minY >= ly - pad &&
		ink.maxY <= ly + lh + pad
	);
}

function rectsOverlap(a: DocRect, b: DocRect): boolean {
	return !(
		a.right < b.left ||
		a.left > b.right ||
		a.bottom < b.top ||
		a.top > b.bottom
	);
}

/**
 * node-canvas + Pango sering mengabaikan "bold" di string font untuk family custom / fallback —
 * gambar ulang dengan offset kecil agar teks terlihat tebal (faux bold).
 * Per huruf + tracking agar jarak nama tidak dempet.
 * Offset diskalakan dengan fontSize; naikkan BANNER_FAUX_BOLD_FRAC untuk tampilan lebih gemuk.
 */
const BANNER_FAUX_BOLD_FRAC = 0.052;
const BANNER_FAUX_BOLD_MIN_PX = 0.95;

function fillBannerTextBold(
	ctx: NodeCanvas2D,
	text: string,
	x: number,
	y: number,
	fontSize: number,
) {
	const o = Math.max(BANNER_FAUX_BOLD_MIN_PX, fontSize * BANNER_FAUX_BOLD_FRAC);
	const h = o * 0.5;
	const d = o * 0.72;
	const m = o * 0.45;
	const offsets: ReadonlyArray<readonly [number, number]> = [
		[0, 0],
		[h, 0],
		[-h, 0],
		[0, h],
		[0, -h],
		[o, 0],
		[-o, 0],
		[0, o],
		[0, -o],
		[m, m],
		[-m, m],
		[m, -m],
		[-m, -m],
		[d, d],
		[-d, d],
		[d, -d],
		[-d, -d],
	];
	const tracking = Math.max(
		BANNER_LETTER_TRACKING_MIN,
		fontSize * BANNER_LETTER_TRACKING_FRAC,
	);
	let advance = 0;
	for (const ch of Array.from(text)) {
		const ox = x + advance;
		for (const [dx, dy] of offsets) {
			ctx.fillText(ch, ox + dx, y + dy);
		}
		advance += ctx.measureText(ch).width + tracking;
	}
}

type RasterizeTextRole = 'name' | 'division';

/**
 * Teks PSD: cari ukuran font **maksimum** yang masih muat di kotak layer (binary search),
 * hanya dengan geser tx/ty. Divisi: geser ke bawah penuh agar tidak kena logo — tidak prioritas mengecilkan font.
 * Potret boleh tertimpa teks di komposisi (seperti referensi MEDINFO); tidak ada penghindaran wajah di sini.
 */
function rasterizeTextOnLayer(
	psd: Psd,
	layer: Layer,
	newText: string,
	opts?: { role: RasterizeTextRole; logoDoc?: DocRect },
) {
	if (!layer.canvas || !layer.text) return;
	const t0 = layer.text.transform;
	if (!t0 || t0.length < 6) return;

	const displayText = newText.trim().toUpperCase();
	if (!displayText) return;

	const W = psd.width;
	const H = psd.height;
	const lx = layer.left ?? 0;
	const ly = layer.top ?? 0;
	const lw = layer.canvas.width;
	const lh = layer.canvas.height;

	const st = layer.text.style;
	const fszMax = Math.min(
		Math.max((st?.fontSize ?? 120) * BANNER_FONT_SIZE_MULT, 24),
		FSZ_CAP,
	);
	const minFsz = 8;
	const fauxI = st?.fauxItalic ? 'italic ' : '';
	const fc = st?.fillColor;
	const fillStyle =
		fc && 'r' in fc
			? `rgb(${Math.round(fc.r)},${Math.round(fc.g)},${Math.round(fc.b)})`
			: '#ffffff';

	const makeFont = (fs: number) =>
		makeBannerFont
			? makeBannerFont(fs)
			: `${fauxI ? fauxI : 'italic '}bold ${fs}px Arial, sans-serif`;

	const doc = createCanvas(W, H);
	const dctx = doc.getContext('2d') as NodeCanvas2D | null;
	if (!dctx) return;

	const draw = (fs: number, tx: number, ty: number) => {
		dctx.setTransform(1, 0, 0, 1, 0, 0);
		dctx.clearRect(0, 0, W, H);
		dctx.setTransform(t0[0], t0[1], t0[2], t0[3], tx, ty);
		dctx.transform(1, 0, ITALIC_SHEAR, 1, 0, 0);
		dctx.font = makeFont(fs);
		dctx.fillStyle = fillStyle;
		dctx.textBaseline = 'alphabetic';
		fillBannerTextBold(dctx, displayText, 0, 0, fs);
		dctx.setTransform(1, 0, 0, 1, 0, 0);
	};

	const role = opts?.role ?? 'name';
	const logo = opts?.logoDoc;

	const toDocRect = (ink: {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
	}): DocRect => ({
		left: ink.minX,
		top: ink.minY,
		right: ink.maxX,
		bottom: ink.maxY,
	});

	/** Hanya translasi: muat di kotak layer + divisi tidak overlap logo. */
	const tryLayout = (fs: number): { tx: number; ty: number } | null => {
		let tx = t0[4];
		let ty = t0[5];
		for (let iter = 0; iter < 120; iter++) {
			draw(fs, tx, ty);
			const ink = getInkBounds(dctx, W, H);
			if (!ink) return null;

			const inkR = toDocRect(ink);
			const fits = inkFitsLayer(ink, lx, ly, lw, lh, LAYER_INK_PAD);
			const overLogo =
				Boolean(logo) && role === 'division' && rectsOverlap(inkR, logo!);

			if (fits && !overLogo) return { tx, ty };

			if (overLogo) {
				const push = logo!.bottom + LOGO_CLEAR_PAD - ink.minY;
				if (push > 0.5) {
					ty += push;
					continue;
				}
				tx -= NUDGE_PX;
				continue;
			}

			if (!fits) {
				let dx = 0;
				let dy = 0;
				if (ink.minX < lx - LAYER_INK_PAD) dx = lx - LAYER_INK_PAD - ink.minX;
				else if (ink.maxX > lx + lw + LAYER_INK_PAD)
					dx = lx + lw + LAYER_INK_PAD - ink.maxX;
				if (ink.minY < ly - LAYER_INK_PAD) dy = ly - LAYER_INK_PAD - ink.minY;
				else if (ink.maxY > ly + lh + LAYER_INK_PAD)
					dy = ly + lh + LAYER_INK_PAD - ink.maxY;
				if (dx !== 0 || dy !== 0) {
					tx += dx;
					ty += dy;
					continue;
				}
				return null;
			}
		}
		return null;
	};

	const hi0 = Math.floor(fszMax);
	const lo0 = Math.floor(minFsz);
	let best: { tx: number; ty: number; fsz: number } | null = null;
	let lo = lo0;
	let hi = hi0;
	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		const r = tryLayout(mid);
		if (r) {
			best = { tx: r.tx, ty: r.ty, fsz: mid };
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	let fsz = minFsz;
	let tx = t0[4];
	let ty = t0[5];
	if (best) {
		fsz = best.fsz;
		tx = best.tx;
		ty = best.ty;
	} else {
		let found = false;
		for (let f = hi0; f >= lo0; f -= 2) {
			const r = tryLayout(f);
			if (r) {
				fsz = f;
				tx = r.tx;
				ty = r.ty;
				found = true;
				break;
			}
		}
		if (!found) {
			const r = tryLayout(minFsz);
			if (r) {
				fsz = minFsz;
				tx = r.tx;
				ty = r.ty;
			}
		}
	}

	draw(fsz, tx, ty);

	const sx = Math.max(0, lx);
	const sy = Math.max(0, ly);
	const ex = Math.min(W, lx + lw);
	const ey = Math.min(H, ly + lh);
	const cw = Math.max(0, ex - sx);
	const ch = Math.max(0, ey - sy);
	if (cw <= 0 || ch <= 0) return;

	const crop = dctx.getImageData(sx, sy, cw, ch);
	const lctx = layer.canvas.getContext('2d') as NodeCanvas2D | null;
	if (!lctx) return;
	lctx.clearRect(0, 0, lw, lh);
	const dx = sx - lx;
	const dy = sy - ly;
	lctx.putImageData(crop, dx, dy);
}

async function replaceRasterLayerFromImage(
	layer: Layer,
	image: Buffer,
	fit: 'cover' | 'contain',
) {
	if (!layer.canvas) return;
	const w = layer.canvas.width;
	const h = layer.canvas.height;
	const pipeline = sharp(image).ensureAlpha();
	const resized =
		fit === 'contain'
			? pipeline.resize(w, h, {
					fit: 'contain',
					position: 'centre',
					background: { r: 0, g: 0, b: 0, alpha: 0 },
				})
			: pipeline.resize(w, h, { fit: 'cover', position: 'centre' });
	const raw = await resized.raw().toBuffer({ resolveWithObject: true });
	if (raw.info.width !== w || raw.info.height !== h || raw.info.channels < 3) {
		throw new Error('Gagal menyesuaikan ukuran gambar ke layer');
	}
	const ctx = layer.canvas.getContext('2d') as NodeCanvas2D | null;
	if (!ctx) return;
	const rgba = new Uint8ClampedArray(w * h * 4);
	const src = raw.data;
	const nch = raw.info.channels;
	for (let i = 0, p = 0; i < w * h; i++, p += nch) {
		const o = i * 4;
		rgba[o] = src[p];
		rgba[o + 1] = src[p + 1];
		rgba[o + 2] = src[p + 2];
		rgba[o + 3] = nch >= 4 ? src[p + 3] : 255;
	}
	ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
}

/** Urutan flatten template: layer 0,1 → gradient map → 3..n−1; latar diisi warna BG dulu. */
function flattenTemplatePsd(
	psd: Psd,
	bgRgb: { r: number; g: number; b: number },
): Buffer {
	const w = psd.width;
	const h = psd.height;
	const layers = psd.children ?? [];
	const gmIndex = layers.findIndex(
		(l) => l.adjustment?.type === 'gradient map',
	);
	if (gmIndex < 0) throw new Error('Gradient Map tidak ditemukan di template');

	const canvas = createCanvas(w, h);
	const ctx = canvas.getContext('2d') as NodeCanvas2D | null;
	if (!ctx) throw new Error('Canvas 2D tidak tersedia');
	ctx.fillStyle = `rgb(${bgRgb.r},${bgRgb.g},${bgRgb.b})`;
	ctx.fillRect(0, 0, w, h);

	for (let i = 0; i < layers.length; i++) {
		if (i === gmIndex) {
			applyGradientMapPass(ctx, w, h, layers[gmIndex]);
			continue;
		}
		const L = layers[i];
		if (L.hidden) continue;
		if (!L.canvas) continue;
		ctx.globalAlpha = L.opacity ?? 1;
		ctx.globalCompositeOperation = 'source-over';
		ctx.drawImage(L.canvas as never, L.left!, L.top!);
		ctx.globalAlpha = 1;
	}

	return canvas.toBuffer('image/png');
}

function fillLayerCanvasSolid(
	layer: Layer | undefined,
	rgb: { r: number; g: number; b: number },
) {
	if (!layer?.canvas) return;
	const c = layer.canvas;
	const ctx = c.getContext('2d') as NodeCanvas2D | null;
	if (!ctx) return;
	ctx.save();
	ctx.globalCompositeOperation = 'source-over';
	ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
	ctx.fillRect(0, 0, c.width, c.height);
	ctx.restore();
}

/** Ganti warna isi piksel tanpa mengubah alpha (penting untuk kabut semi-transparan di Rectangle 2/3). */
function fillLayerRgbPreservingAlpha(
	layer: Layer | undefined,
	rgb: { r: number; g: number; b: number },
) {
	if (!layer?.canvas) return;
	const c = layer.canvas;
	const ctx = c.getContext('2d') as NodeCanvas2D | null;
	if (!ctx) return;
	const img = ctx.getImageData(0, 0, c.width, c.height);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) {
		if (d[i + 3] === 0) continue;
		d[i] = rgb.r;
		d[i + 1] = rgb.g;
		d[i + 2] = rgb.b;
	}
	ctx.putImageData(img, 0, 0);
}

export async function renderBannerTemplateWebp(
	input: BannerServerRenderInput,
): Promise<Buffer> {
	const {
		templatePsdPath,
		personName,
		divisionText,
		bgHex,
		accentHex,
		nameStripeHex,
		fogHex,
		showNameDivision,
		photoBuffer,
		logoBuffer,
	} = input;

	if (!fs.existsSync(templatePsdPath)) {
		throw new Error(`Template PSD tidak ada: ${templatePsdPath}`);
	}

	const buf = fs.readFileSync(templatePsdPath);
	const psd = readPsd(buf);
	const layers = psd.children ?? [];

	const bg = hexToRgb(bgHex);
	const accent = hexToRgb(accentHex);
	const nameStripe = hexToRgb(nameStripeHex);
	const fog = hexToRgb(fogHex);

	const nameLayer = findLayerByNames(layers, ['ALIFIYA', 'ALFIYA']);
	const divLayer = findLayerByNames(layers, ['TECHNOPRENEURSHIP']);
	const portraitLayer = findLayerByNames(layers, ['7', 'Layer 7', 'Lapisan 7']);
	const logoLayer = layers.find((l) => l.name === 'Logo Techno');
	const gmLayer = layers.find((l) => l.adjustment?.type === 'gradient map');
	const r1 = layers.find((l) => l.name === 'Rectangle 1');
	/** Kabut besar di bawah: Rectangle 2 (bukan Rectangle 3 — itu hanya elemen kecil di template). */
	const r2 = layers.find((l) => l.name === 'Rectangle 2');
	const r3 = layers.find((l) => l.name === 'Rectangle 3');

	if (gmLayer?.adjustment && gmLayer.adjustment.type === 'gradient map') {
		gmLayer.adjustment.colorStops = [
			{
				color: { r: bg.r, g: bg.g, b: bg.b },
				location: 0,
				midpoint: 50,
			},
			{
				color: { r: accent.r, g: accent.g, b: accent.b },
				location: 1,
				midpoint: 50,
			},
		];
	}

	/* Stripe nama: solid. Kabut: Rectangle 2 (+ 3 jika ada) dengan alpha dipertahankan. */
	fillLayerCanvasSolid(r1, nameStripe);
	fillLayerRgbPreservingAlpha(r2, fog);
	fillLayerRgbPreservingAlpha(r3, fog);

	let logoDoc: DocRect | undefined;
	if (logoLayer) {
		if (logoBuffer && logoBuffer.length > 0) {
			logoLayer.hidden = false;
			/* contain = seluruh logo terlihat (tidak ter-crop); transparan di area kosong */
			await replaceRasterLayerFromImage(logoLayer, logoBuffer, 'contain');
			/* Tabrakan teks divisi pakai bbox piksel logo, bukan seluruh kotak layer (contain). */
			logoDoc = logoInkRectInDocument(logoLayer);
		} else {
			logoLayer.hidden = true;
		}
	}

	if (nameLayer) {
		nameLayer.hidden = !showNameDivision;
		if (showNameDivision && personName.trim()) {
			if (!nameLayer.text) nameLayer.text = {} as never;
			const nameU = personName.trim().toUpperCase();
			nameLayer.text.text = nameU;
			rasterizeTextOnLayer(psd, nameLayer, nameU, { role: 'name' });
		}
	}
	if (divLayer) {
		divLayer.hidden = !showNameDivision;
		if (showNameDivision && divisionText.trim()) {
			if (!divLayer.text) divLayer.text = {} as never;
			const divU = divisionText.trim().toUpperCase();
			divLayer.text.text = divU;
			rasterizeTextOnLayer(psd, divLayer, divU, {
				role: 'division',
				logoDoc,
			});
		}
	}

	if (portraitLayer && photoBuffer && photoBuffer.length > 0) {
		await replaceRasterLayerFromImage(portraitLayer, photoBuffer, 'cover');
	}

	const png = flattenTemplatePsd(psd, bg);
	return sharp(png).ensureAlpha().webp({ quality: 88 }).toBuffer();
}

export function getDefaultBannerTemplatePath(): string {
	return path.join(
		process.cwd(),
		'attached_assets',
		'templates',
		'tamplate_benner.psd',
	);
}
