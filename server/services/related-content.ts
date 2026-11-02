/**
 * Rekomendasi konten terkait (event, galeri) memakai TF-IDF + cosine similarity.
 * Dihitung per request dari kandidat tenant yang sudah difilter `published`,
 * sehingga tidak ada cache global lintas tenant.
 */

const STOPWORDS = new Set(
	'id ini itu dan yang untuk pada dari dengan oleh atau ke di sebagai tentang lebih agar bukan telah akan sudah juga karena namun tetapi serta para kami kamu mereka nbsp amp'.split(
		/\s+/,
	),
);

export const MIN_RELATED_SCORE = 0.04;

export function stripHtml(input: string): string {
	return String(input || '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function makeExcerpt(input: string, max = 160): string {
	const text = stripHtml(input);
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function tokenize(text: string): string[] {
	return stripHtml(text)
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export interface RelatedInput {
	title?: string;
	body?: string;
	tags?: string[];
}

export function buildTokens(doc: RelatedInput): string[] {
	const title = tokenize(doc.title || '');
	return [
		...title,
		...title,
		...title,
		...tokenize(doc.body || ''),
		...(doc.tags || []).flatMap((t) => Array(10).fill(String(t).toLowerCase())),
	];
}

function vectorize(
	tokens: string[],
	idf: Map<string, number>,
): Map<string, number> {
	const tf = new Map<string, number>();
	for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
	const vec = new Map<string, number>();
	tf.forEach((f, t) => vec.set(t, (idf.get(t) || 0) * (1 + Math.log(f))));
	return vec;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
	let dot = 0;
	let na = 0;
	let nb = 0;
	a.forEach((v) => (na += v * v));
	b.forEach((v) => (nb += v * v));
	const [small, big] = a.size <= b.size ? [a, b] : [b, a];
	small.forEach((v, k) => {
		const w = big.get(k);
		if (w) dot += v * w;
	});
	const denom = Math.sqrt(na) * Math.sqrt(nb);
	return denom === 0 ? 0 : dot / denom;
}

/**
 * Urutkan kandidat berdasarkan kemiripan dengan `base`. Hanya kandidat dengan
 * skor di atas ambang yang dikembalikan, jadi tidak ada isian tidak relevan.
 */
export function rankRelated<T>(
	base: RelatedInput,
	candidates: T[],
	toInput: (c: T) => RelatedInput,
	limit: number,
): T[] {
	if (candidates.length === 0) return [];
	const baseTokens = buildTokens(base);
	const docTokens = candidates.map((c) => buildTokens(toInput(c)));

	const df = new Map<string, number>();
	for (const tokens of [baseTokens, ...docTokens]) {
		new Set(tokens).forEach((t) => df.set(t, (df.get(t) || 0) + 1));
	}
	const n = docTokens.length + 1;
	const idf = new Map<string, number>();
	df.forEach((d, t) => idf.set(t, Math.log((n + 1) / (d + 1)) + 1));

	const baseVec = vectorize(baseTokens, idf);
	return candidates
		.map((c, i) => ({ c, s: cosine(baseVec, vectorize(docTokens[i], idf)) }))
		.filter((x) => x.s >= MIN_RELATED_SCORE)
		.sort((x, y) => y.s - x.s)
		.slice(0, limit)
		.map((x) => x.c);
}
