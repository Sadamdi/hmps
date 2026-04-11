/** Cache string JSON singkat (TTL + LRU sederhana) untuk meringankan Mongo saat traffic tinggi. */
export class ShortJsonCache {
	private map = new Map<string, { value: string; exp: number }>();

	constructor(
		private readonly ttlMs: number,
		private readonly maxKeys: number,
	) {}

	get(key: string): string | undefined {
		const e = this.map.get(key);
		if (!e) return undefined;
		if (Date.now() > e.exp) {
			this.map.delete(key);
			return undefined;
		}
		return e.value;
	}

	set(key: string, value: string): void {
		while (this.map.size >= this.maxKeys) {
			const first = this.map.keys().next().value as string | undefined;
			if (first === undefined) break;
			this.map.delete(first);
		}
		this.map.set(key, {
			value,
			exp: Date.now() + this.ttlMs,
		});
	}
}
