/**
 * Proxy baca wilayah Indonesia (api.co.id) — header x-api-co-id
 */

const BASE = 'https://use.api.co.id';

function head(): Record<string, string> {
	const k = (process.env.ONGKIR_API || '').trim();
	if (!k) return {};
	return { 'x-api-co-id': k, Accept: 'application/json' };
}

export async function regionalFetch(path: string, search: Record<string, string> = {}): Promise<unknown> {
	const u = new URL(`${BASE}${path.startsWith('/') ? path : `/${path}`}`);
	for (const [k, v] of Object.entries(search)) u.searchParams.set(k, v);
	const r = await fetch(u.toString(), { headers: head(), signal: AbortSignal.timeout(20_000) });
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error((j as { message?: string })?.message || r.statusText);
	return j;
}
