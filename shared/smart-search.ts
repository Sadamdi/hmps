/**
 * Pencarian pintar untuk daftar publik (berita, galeri, event).
 * - Tanda baca & huruf besar/kecil diabaikan: "roar" menemukan "R.O.A.R" dan "ROAR 2026".
 * - Pemisah di dalam kata diabaikan: "esport" menemukan "e-sport".
 * - Toleran salah ketik (Damerau-Levenshtein): "spartivl" menemukan "Spartival".
 * - Semua kata di kueri harus cocok (AND); skor lebih tinggi untuk kecocokan judul.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

/** "r.o.a.r" / "r-o-a-r" / "r_o_a_r" → "roar" (urutan >= 3 karakter tunggal). */
function collapseLetterRuns(s: string): string {
	return s.replace(
		/(^|[^a-z0-9])((?:[a-z0-9][.\-_]){2,}[a-z0-9])(?=$|[^a-z0-9])/g,
		(_m, pre: string, run: string) => pre + run.replace(/[.\-_]/g, ''),
	);
}

/** Pecah teks menjadi token alfanumerik (huruf kecil, tanpa aksen/tanda baca). */
export function searchTokens(input: string): string[] {
	const base = String(input ?? '')
		.normalize('NFD')
		.replace(COMBINING_MARKS, '')
		.toLowerCase()
		.replace(/['’`]/g, '');
	return collapseLetterRuns(base)
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.split(' ')
		.filter(Boolean);
}

/** Jarak edit Damerau-Levenshtein (OSA) dengan batas `max`; > max → max + 1. */
export function editDistance(a: string, b: string, max: number): number {
	if (a === b) return 0;
	const la = a.length;
	const lb = b.length;
	if (Math.abs(la - lb) > max) return max + 1;
	let prev2: number[] = [];
	let prev: number[] = Array.from({ length: lb + 1 }, (_, j) => j);
	for (let i = 1; i <= la; i++) {
		const cur: number[] = [i];
		let rowMin = i;
		for (let j = 1; j <= lb; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				v = Math.min(v, prev2[j - 2] + 1);
			}
			cur[j] = v;
			if (v < rowMin) rowMin = v;
		}
		if (rowMin > max) return max + 1;
		prev2 = prev;
		prev = cur;
	}
	return prev[lb];
}

function maxTypos(len: number): number {
	if (len < 4) return 0;
	return len <= 6 ? 1 : 2;
}

/** Skor satu kata kueri terhadap token dokumen (0 = tidak cocok). */
function scoreToken(qt: string, tokens: string[], squashed: string): number {
	let best = 0;
	for (const t of tokens) {
		if (t === qt) return 1;
		if (qt.length >= 2 && t.startsWith(qt)) best = Math.max(best, 0.9);
	}
	if (best > 0) return best;
	// Digabung/dipisah tanda hubung: "esport" ~ "e sport".
	if (qt.length >= 4 && squashed.includes(qt)) return 0.75;
	const typos = maxTypos(qt.length);
	if (typos === 0) return 0;
	for (const t of tokens) {
		const d = editDistance(qt, t, typos);
		if (d <= typos) best = Math.max(best, 0.55 - 0.1 * d);
		// Ketikan belum selesai: bandingkan dengan awalan token.
		if (qt.length >= 5 && t.length > qt.length) {
			const dp = editDistance(qt, t.slice(0, qt.length), 1);
			if (dp <= 1) best = Math.max(best, 0.5 - 0.1 * dp);
		}
	}
	return best;
}

/** Rata-rata skor seluruh kata kueri; 0 bila ada kata yang tidak cocok. Kueri kosong = 1. */
export function smartMatchScore(query: string, text: string): number {
	const qts = searchTokens(query);
	if (qts.length === 0) return 1;
	const tokens = searchTokens(text);
	if (tokens.length === 0) return 0;
	const squashed = tokens.join('');
	let total = 0;
	for (const qt of qts) {
		const s = scoreToken(qt, tokens, squashed);
		if (s === 0) return 0;
		total += s;
	}
	return total / qts.length;
}

/** Skor gabungan judul + isi; kecocokan judul diberi bobot ekstra. 0 = tidak cocok. */
export function smartSearchScore(query: string, title: string, body = ''): number {
	if (searchTokens(query).length === 0) return 1;
	const all = smartMatchScore(query, `${title} ${body}`);
	if (all === 0) return 0;
	return all + 1.5 * smartMatchScore(query, title);
}

/** Saring + urutkan menurut relevansi; kueri kosong mengembalikan `items` apa adanya. */
export function smartSearch<T>(
	items: T[],
	query: string,
	getTitle: (item: T) => string,
	getBody: (item: T) => string = () => '',
): T[] {
	if (searchTokens(query).length === 0) return items;
	return items
		.map((item, index) => ({
			item,
			index,
			score: smartSearchScore(query, getTitle(item), getBody(item)),
		}))
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map((x) => x.item);
}
