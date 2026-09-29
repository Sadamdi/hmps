/**
 * Admin WhatsApp toko: beberapa nomor dengan nama & saklar on/off.
 *
 * - Global: `StoreSettings.whatsappAdmins`. Data lama (`whatsappPhone` + `whatsappContactName`)
 *   otomatis dibaca sebagai admin pertama bila daftar masih kosong.
 * - Per produk: `StoreProduct.whatsappAdmins` = daftar override sendiri (format sama). Kosong = pakai
 *   global. Override lama (`whatsappPhoneOverride`) dibaca sebagai admin pertama override.
 * - 0 admin aktif → toko tutup; 1 → langsung; >1 → pembeli memilih.
 */

export type StoreWaAdmin = { id: string; name: string; phone: string; active: boolean };
export type StoreWaAdminPublic = { id: string; name: string };

export const STORE_CLOSED_MESSAGE = 'Mohon maaf, toko sedang tutup.';

export function normalizeWaDigits(raw: unknown): string {
	let d = String(raw || '').replace(/\D/g, '');
	if (d.startsWith('0')) d = `62${d.slice(1)}`;
	return d;
}

export function normalizeStoreWaAdmins(raw: unknown): StoreWaAdmin[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: StoreWaAdmin[] = [];
	raw.slice(0, 10).forEach((a: any, i: number) => {
		const phone = normalizeWaDigits(a?.phone);
		if (!phone) return;
		let id = String(a?.id || '').trim().slice(0, 40) || `admin-${i + 1}`;
		while (seen.has(id)) id = `${id}-${i}`;
		seen.add(id);
		out.push({
			id,
			name: String(a?.name || '').trim().slice(0, 60) || `Admin ${out.length + 1}`,
			phone,
			active: a?.active !== false,
		});
	});
	return out;
}

/** Daftar admin global; fallback ke field lama bila daftar kosong. */
export function globalStoreWaAdmins(settings: any): StoreWaAdmin[] {
	const list = normalizeStoreWaAdmins(settings?.whatsappAdmins);
	if (list.length) return list;
	const phone = normalizeWaDigits(settings?.whatsappPhone);
	return phone
		? [{ id: 'admin-1', name: String(settings?.whatsappContactName || '').trim() || 'Admin 1', phone, active: true }]
		: [];
}

/** Admin AKTIF untuk sebuah produk (atau global bila `product` kosong). */
export function activeStoreWaAdmins(settings: any, product?: any): StoreWaAdmin[] {
	if (product) {
		const own = productStoreWaAdmins(product);
		// Produk punya override → pakai override saja (termasuk bila semua off = produk "tutup")
		if (own.length) return own.filter((a) => a.active);
	}
	return globalStoreWaAdmins(settings).filter((a) => a.active);
}

/** Daftar override admin produk; fallback ke override lama satu nomor. */
export function productStoreWaAdmins(product: any): StoreWaAdmin[] {
	const list = normalizeStoreWaAdmins(product?.whatsappAdmins);
	if (list.length) return list;
	const phone = normalizeWaDigits(product?.whatsappPhoneOverride);
	return phone
		? [{ id: 'admin-1', name: String(product?.whatsappContactNameOverride || '').trim() || 'Admin 1', phone, active: true }]
		: [];
}

export function toPublicWaAdmins(list: StoreWaAdmin[]): StoreWaAdminPublic[] {
	return list.map((a) => ({ id: a.id, name: a.name || 'Admin' }));
}

/** Sapaan pembuka pesan: "Permisi Kak {nama}," */
export function waGreeting(admin: StoreWaAdmin | undefined): string {
	const n = String(admin?.name || '').trim();
	return n ? `Permisi Kak ${n}, ` : 'Permisi Kak, ';
}
