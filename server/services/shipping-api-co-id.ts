/**
 * Cek ongkis via api.co.id (header x-api-co-id, env ONGKIR_API).
 * Berat API: kilogram; internal kita pakai gram di DB.
 */

const BASE = 'https://use.api.co.id';

export type ShippingCourierOption = {
	courierCode: string;
	courierName: string;
	price: number;
	etd: string;
	weight: number;
	raw?: unknown;
};

function apiKey(): string {
	return (process.env.ONGKIR_API || '').trim();
}

function header(): Record<string, string> {
	const k = apiKey();
	if (!k) return {};
	return { 'x-api-co-id': k };
}

/**
 * @param weightGrams - akan diubah ke kg (min 0.001)
 */
export async function fetchShippingCost(params: {
	originVillageCode: string;
	destinationVillageCode: string;
	weightGrams: number;
}): Promise<{ couriers: ShippingCourierOption[]; raw?: unknown }> {
	const key = apiKey();
	if (!key) {
		return { couriers: [], raw: { message: 'ONGKIR_API tidak diset' } };
	}
	const wKg = Math.max(0.001, (Number(params.weightGrams) || 100) / 1000);
	const url = new URL(`${BASE}/expedition/shipping-cost`);
	url.searchParams.set('origin_village_code', String(params.originVillageCode).trim());
	url.searchParams.set('destination_village_code', String(params.destinationVillageCode).trim());
	url.searchParams.set('weight', String(wKg));

	const r = await fetch(url.toString(), { headers: { ...header() }, signal: AbortSignal.timeout(20_000) });
	const j = (await r.json().catch(() => ({}))) as {
		is_success?: boolean;
		data?: { couriers?: unknown[]; weight?: number };
		message?: string;
	};
	if (!r.ok) {
		return { couriers: [], raw: j };
	}
	const data = j?.data;
	const list = Array.isArray(data?.couriers) ? data.couriers : [];
	const out: ShippingCourierOption[] = [];
	for (const row of list) {
		if (!row || typeof row !== 'object') continue;
		const o = row as Record<string, unknown>;
		const code = String(o.courier_code || o.courierCode || '');
		const name = String(o.courier_name || o.courierName || code);
		const price = Math.round(Number(o.price) || 0);
		if (!code || !Number.isFinite(price) || price <= 0) continue;
		const etd = String(o.estimation || o.estimation_text || o.etd || '');
		out.push({
			courierCode: code,
			courierName: name,
			price,
			etd,
			weight: Number(o.weight) || wKg,
			raw: row,
		});
	}
	return { couriers: out, raw: j };
}

export function findCourier(
	list: ShippingCourierOption[],
	courierCode: string,
): ShippingCourierOption | null {
	const c = String(courierCode || '').trim().toLowerCase();
	if (!c) return null;
	return list.find((x) => x.courierCode.toLowerCase() === c) || null;
}
