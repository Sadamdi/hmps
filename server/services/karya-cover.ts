/**
 * Sampul template otomatis untuk karya tanpa gambar: kartu bergaya web Himatif Encoder (judul, kategori, pembuat),
 * dua varian tema (gelap: navy + cyan, terang: putih + biru). SVG dirender ke PNG 1200×630 dengan sharp
 * (ukuran og:image standar) dan di-cache di memori per (slug, updatedAt, tema).
 */
import sharp from 'sharp';
import { karyaCategoryLabel } from '../../shared/karya';

const cache = new Map<string, Buffer>();

function esc(v: string): string {
	return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Bungkus judul ke maks 3 baris (~26 karakter per baris). */
function wrap(title: string, width = 26, maxLines = 3): string[] {
	const words = String(title || '').split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let cur = '';
	for (const w of words) {
		if ((cur + ' ' + w).trim().length > width && cur) {
			lines.push(cur);
			cur = w;
		} else cur = (cur + ' ' + w).trim();
		if (lines.length === maxLines) break;
	}
	if (lines.length < maxLines && cur) lines.push(cur);
	if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
	return lines.slice(0, maxLines);
}

export async function renderKaryaCover(o: { key: string; title: string; category: string; author: string; angkatan: number | null; theme: 'light' | 'dark' }): Promise<Buffer> {
	const hit = cache.get(o.key);
	if (hit) return hit;
	const dark = o.theme === 'dark';
	const bg = dark ? '#06091f' : '#ffffff';
	const bg2 = dark ? '#0f1430' : '#eff6ff';
	const fg = dark ? '#ffffff' : '#0f172a';
	const muted = dark ? '#94a3b8' : '#475569';
	const accent = dark ? '#38bdf8' : '#2563eb';
	const cat = karyaCategoryLabel(o.category || 'lainnya');
	const lines = wrap(o.title);
	const titleSvg = lines.map((l, i) => `<text x="80" y="${270 + i * 78}" font-size="64" font-weight="700" fill="${fg}" font-family="Arial, Helvetica, sans-serif">${esc(l)}</text>`).join('');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
<linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#06b6d4"/></linearGradient>
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${accent}" stroke-opacity="${dark ? 0.08 : 0.07}" stroke-width="1"/></pattern>
</defs>
<rect width="1200" height="630" fill="url(#g)"/>
<rect width="1200" height="630" fill="url(#grid)"/>
<rect x="0" y="0" width="1200" height="10" fill="url(#a)"/>
<circle cx="1050" cy="150" r="190" fill="${accent}" fill-opacity="${dark ? 0.08 : 0.06}"/>
<text x="1040" y="205" font-size="150" font-weight="700" fill="${accent}" fill-opacity="0.35" text-anchor="middle" font-family="'Courier New', monospace">&lt;/&gt;</text>
<rect x="80" y="110" rx="22" ry="22" width="${60 + cat.length * 18}" height="44" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-opacity="0.5"/>
<text x="${110}" y="140" font-size="22" font-weight="700" letter-spacing="3" fill="${accent}" font-family="Arial, Helvetica, sans-serif">${esc(cat.toUpperCase())}</text>
${titleSvg}
<text x="80" y="540" font-size="28" fill="${muted}" font-family="Arial, Helvetica, sans-serif">${esc(o.author)}${o.angkatan ? ` · Angkatan ${o.angkatan}` : ''}</text>
<text x="80" y="580" font-size="22" font-weight="700" fill="${accent}" font-family="Arial, Helvetica, sans-serif">Karya Mahasiswa TI · Himatif Encoder</text>
</svg>`;
	const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
	cache.set(o.key, png);
	if (cache.size > 300) cache.clear();
	return png;
}
