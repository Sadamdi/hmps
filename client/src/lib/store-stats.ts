/** Statistik tampil toko: favorit & dilihat (server dedupe; di sini hanya fire-and-forget). */
export type StatsKind = 'product' | 'bundle';

export function postFavorite(apiBase: string, kind: StatsKind, id: string, on: boolean) {
	void fetch(`${apiBase}/store/public/favorite`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ kind, id, on }),
	}).catch(() => null);
}

const viewedThisPage = new Set<string>();

/** Catat tampilan; satu kali per halaman-muat per target (server tetap dedupe 30 menit). */
export function postView(apiBase: string, kind: StatsKind, id: string) {
	if (!id || viewedThisPage.has(`${kind}:${id}`)) return;
	viewedThisPage.add(`${kind}:${id}`);
	void fetch(`${apiBase}/store/public/view`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ kind, id }),
	}).catch(() => null);
}

/** 1.234 → "1,2 rb", 1.500.000 → "1,5 jt". */
export function formatCount(n: number | undefined | null): string {
	const v = Math.max(0, Math.floor(Number(n) || 0));
	if (v < 1000) return String(v);
	if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0).replace('.', ',').replace(/,0$/, '')} rb`;
	return `${(v / 1_000_000).toFixed(1).replace('.', ',').replace(/,0$/, '')} jt`;
}
