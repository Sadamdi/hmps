import { mongoStorage } from '../mongo-storage';

type BeritaLite = {
	_id?: string;
	title?: string;
	excerpt?: string;
	content?: string;
	tags?: string[];
	author?: string;
	createdAt?: string | Date;
	image?: string;
	slug?: string;
};

/**
 * RecommendationService: TF-IDF + Cosine Similarity with in-memory cache
 */
export class RecommendationService {
	private static cacheTimestamp = 0;
	private static beritaList: BeritaLite[] = [];
	private static vectors: Map<string, Map<string, number>> = new Map();
	private static idf: Map<string, number> = new Map();
	private static vocab: Set<string> = new Set();
	private static readonly REFRESH_MS = 10 * 60 * 1000; // 10 minutes

	private static tokenize(text: string): string[] {
		if (!text) return [];
		const stop = new Set(
			'id ini itu dan yang untuk pada dari dengan oleh atau ke di sebagai tentang lebih agar bukan telah akan sudah juga karena namun tetapi serta para kami kamu mereka bukanlah'.split(
				/\s+/
			)
		);
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, ' ')
			.split(/\s+/)
			.filter((w) => w && w.length > 2 && !stop.has(w));
	}

	private static async ensureIndex(): Promise<void> {
		const now = Date.now();
		if (now - this.cacheTimestamp < this.REFRESH_MS && this.beritaList.length > 0)
			return;

		let all = await mongoStorage.getPublishedBerita();
		try {
			const allAny = await mongoStorage.getAllBerita();
			if (Array.isArray(allAny) && allAny.length > 0) {
				const seen = new Set(
					(all || []).map((a: any) => String(a._id || a.id))
				);
				for (const a of allAny) {
					const k = String(a._id || a.id);
					if (!seen.has(k)) {
						all = [...(all || []), a];
						seen.add(k);
					}
				}
			}
		} catch (_) {}
		this.beritaList = (all || []).map((a: any) => ({
			_id: String(a._id || a.id || ''),
			title: a.title || '',
			excerpt: a.excerpt || '',
			content: a.content || '',
			tags: Array.isArray(a.tags) ? a.tags : [],
			author: a.author || '',
			createdAt: a.createdAt,
			image: a.image || '',
			slug: a.slug || '',
		}));

		// Build vocab and DF
		this.vocab = new Set();
		const df = new Map<string, number>();
		const docsTokens: string[][] = [];
		for (const a of this.beritaList) {
			const tokens = [
				// Boost title
				...this.tokenize(a.title || ''),
				...this.tokenize(a.title || ''),
				...this.tokenize(a.title || ''),
				...this.tokenize(a.excerpt || ''),
				...this.tokenize(a.content || ''),
				// Strong weight tags
				...(a.tags || []).flatMap((t) =>
					Array(10).fill(String(t).toLowerCase())
				),
			];
			const unique = new Set(tokens);
			unique.forEach((t) => {
				this.vocab.add(t);
				df.set(t, (df.get(t) || 0) + 1);
			});
			docsTokens.push(tokens);
		}

		const N = this.beritaList.length || 1;
		this.idf = new Map();
		this.vocab.forEach((t) => {
			const d = df.get(t) || 0;
			this.idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
		});

		// Build TF-IDF vectors
		this.vectors = new Map();
		for (let i = 0; i < this.beritaList.length; i++) {
			const tokens = docsTokens[i];
			const tf = new Map<string, number>();
			for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
			const vec = new Map<string, number>();
			tf.forEach((f, t) => {
				const weight = (this.idf.get(t) || 0) * (1 + Math.log(f));
				vec.set(t, weight);
			});
			this.vectors.set(String(this.beritaList[i]._id), vec);
		}

		this.cacheTimestamp = now;
	}

	private static cosine(
		a: Map<string, number>,
		b: Map<string, number>
	): number {
		let dot = 0;
		let na = 0;
		let nb = 0;
		a.forEach((va) => (na += va * va));
		b.forEach((vb) => (nb += vb * vb));
		// iterate smaller
		const small = a.size <= b.size ? a : b;
		const big = a.size <= b.size ? b : a;
		small.forEach((v, k) => {
			const w = big.get(k);
			if (w) dot += v * w;
		});
		const denom = Math.sqrt(na) * Math.sqrt(nb);
		return denom === 0 ? 0 : dot / denom;
	}

	static async getRelatedById(id: string, limit = 2): Promise<BeritaLite[]> {
		await this.ensureIndex();
		const base = this.beritaList.find((a) => String(a._id) === String(id));
		let baseVec = base ? this.vectors.get(String(base._id)) : undefined;
		if (!baseVec) {
			// Build temporary vector if base not in cache (e.g., unpublished)
			try {
				const dbBase = await mongoStorage.getBeritaById(id);
				if (dbBase) {
					const tokens = [
						...this.tokenize(dbBase.title || ''),
						...this.tokenize(dbBase.title || ''),
						...this.tokenize(dbBase.title || ''),
						...this.tokenize(dbBase.excerpt || ''),
						...this.tokenize(dbBase.content || ''),
						...(Array.isArray(dbBase.tags) ? dbBase.tags : []).flatMap(
							(t: any) => Array(10).fill(String(t).toLowerCase())
						),
					];
					const tf = new Map<string, number>();
					for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
					baseVec = new Map<string, number>();
					tf.forEach((f, t) => {
						const weight = (this.idf.get(t) || 0) * (1 + Math.log(f));
						baseVec!.set(t, weight);
					});
				}
			} catch (_) {}
		}
		if (!baseVec) return [];
		const scored = this.beritaList
			.filter((a) => String(a._id) !== String(id))
			.map((a) => ({
				a,
				s: this.cosine(
					baseVec as Map<string, number>,
					this.vectors.get(String(a._id)) || new Map()
				),
			}))
			.sort((x, y) => y.s - x.s);

		let related = scored.slice(0, limit).map((x) => x.a);
		if (related.length < limit || (scored[0]?.s || 0) === 0) {
			const sameAuthor = scored
				.filter(
					(x) => String(x.a.author) === String((base as any)?.author || '')
				)
				.map((x) => x.a);
			related = related.concat(
				sameAuthor
					.filter((a) => !related.find((r) => String(r._id) === String(a._id)))
					.slice(0, limit - related.length)
			);
		}
		if (related.length < limit) {
			const latest = this.beritaList
				.filter(
					(a) =>
						String(a._id) !== String(base?._id || id) &&
						!related.find((r) => String(r._id) === String(a._id))
				)
				.sort(
					(a, b) =>
						new Date(b.createdAt || 0).getTime() -
						new Date(a.createdAt || 0).getTime()
				)
				.slice(0, limit - related.length);
			related = related.concat(latest);
		}
		if (related.length === 0) {
			related = this.beritaList
				.filter((a) => String(a._id) !== String(id))
				.slice(0, limit);
		}
		return related.slice(0, limit);
	}

	static invalidate(): void {
		this.cacheTimestamp = 0;
	}
}
