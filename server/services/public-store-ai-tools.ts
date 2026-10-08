/**
 * Tool AI PUBLIK untuk toko (tanpa login, tanpa permission): hanya data yang memang tampil di halaman toko publik.
 * Dibatasi ke toko konteks aktif (situs utama atau komunitas), produk terbit & tidak dihapus. Tidak pernah
 * mengembalikan nomor WhatsApp admin, nomor rekening, data pembeli, atau pesanan.
 */
import { StoreDiscountCampaign as MainCampaign, StoreBundle as MainBundle, StoreProduct as MainProduct, StoreReview as MainReview, StoreSettings as MainSettings } from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';
import { activeStoreWaAdmins } from '../../shared/store-wa';
import { channelsForProduct, channelTitle } from '../../shared/store-payment';
import { effectiveProductCurrency, formatStoreMoney, normalizeStoreCurrency } from '../../shared/store-currency';
import { activeVariants } from '../../shared/store-variants';

export const PUBLIC_STORE_TOOL_DEFS = [
	{
		name: 'search_store_products',
		description:
			'Cari/ambil daftar produk toko (katalog publik) beserta harga, stok, dan tautan. Boleh dipanggil oleh siapa pun, tanpa login. Gunakan untuk "berapa harga ...", "ada produk apa saja", "produk termurah", dsb. Tanpa keyword = produk terbaru. Hanya produk yang terbit di toko konteks aktif.',
		parameters: {
			type: 'object',
			properties: {
				keyword: { type: 'string', description: 'Kata kunci nama/deskripsi produk (opsional).' },
				limit: { type: 'number', description: 'Maks produk (default 12, maks 30).' },
				sort: { type: 'string', enum: ['latest', 'price_asc', 'price_desc', 'popular'], description: 'Urutan (default latest).' },
			},
			required: [],
		},
	},
	{
		name: 'get_store_product_detail',
		description:
			'Detail lengkap satu produk toko publik: harga (termasuk tier grosir), varian, stok, pre-order/DP, deskripsi, rating & jumlah ulasan, favorit/dilihat, paket bundling yang memuatnya, admin kontak (nama saja), metode pembayaran, dan tautan. Boleh tanpa login. Parameter slug dari search_store_products atau dari URL halaman produk.',
		parameters: { type: 'object', properties: { slug: { type: 'string', description: 'Slug produk, mis. kaos-encoder.' } }, required: ['slug'] },
	},
	{
		name: 'get_store_bundles',
		description: 'Daftar paket bundling toko publik (harga paket, isi, hemat, ketersediaan). Boleh tanpa login.',
		parameters: { type: 'object', properties: { keyword: { type: 'string' }, limit: { type: 'number' } }, required: [] },
	},
	{
		name: 'get_store_promos',
		description: 'Promo/diskon toko yang sedang aktif (nama promo, potongan, berlaku untuk semua produk atau produk tertentu, jadwal). Boleh tanpa login. Gunakan untuk "ada diskon/promo apa?".',
		parameters: { type: 'object', properties: {}, required: [] },
	},
	{
		name: 'get_store_info',
		description:
			'Info umum toko publik: nama menu toko, apakah toko buka, mata uang, metode pembayaran yang tersedia (tanpa nomor rekening), admin kontak (nama saja), alamat pengambilan, pajak, pengiriman aktif/tidak, dan cara pesan. Boleh tanpa login.',
		parameters: { type: 'object', properties: {}, required: [] },
	},
] as const;

export const PUBLIC_STORE_TOOL_NAMES = new Set<string>(PUBLIC_STORE_TOOL_DEFS.map((t) => t.name));

function models(tenantDbName?: string | null): { Product: any; Bundle: any; Settings: any; Review: any; Campaign: any } {
	if (tenantDbName) {
		const m: any = getTenantModels(tenantDbName);
		return { Product: m.StoreProduct, Bundle: m.StoreBundle, Settings: m.StoreSettings, Review: m.StoreReview, Campaign: m.StoreDiscountCampaign };
	}
	return { Product: MainProduct, Bundle: MainBundle, Settings: MainSettings, Review: MainReview, Campaign: MainCampaign };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const strip = (html: unknown) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function storePathOf(settings: any): string {
	const raw = String(settings?.navbarPath || '/toko').trim();
	const p = raw.startsWith('/') ? raw : `/${raw}`;
	return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p || '/toko';
}

function stockText(stock: unknown): string {
	if (stock === null || stock === undefined || Number(stock) < 0) return 'tersedia (stok tidak dibatasi)';
	return Number(stock) > 0 ? `tersedia (sisa ${Number(stock)})` : 'habis';
}

async function publishedFilter(extra: Record<string, unknown> = {}) {
	return { published: true, deletedAt: null, ...extra };
}

export async function runPublicStoreTool(
	name: string,
	args: Record<string, unknown>,
	ctx: { tenantDbName?: string | null; tenantSlug?: string | null },
): Promise<Record<string, unknown>> {
	const { Product, Bundle, Settings, Review, Campaign } = models(ctx.tenantDbName);
	const settings: any = (await Settings.findOne({}).lean()) || {};
	const prefix = ctx.tenantSlug ? `/${ctx.tenantSlug}` : '';
	const storePath = storePathOf(settings);
	const defCur = normalizeStoreCurrency(settings.defaultCurrency);
	const link = (slug: string) => `${prefix}${storePath}/${slug}`;

	if (name === 'search_store_products') {
		const limit = Math.min(30, Math.max(1, Number(args.limit) || 12));
		const kw = String(args.keyword || '').trim().slice(0, 80);
		const filter: any = await publishedFilter();
		if (kw) {
			const parts = kw.split(/\s+/).filter(Boolean).slice(0, 5);
			filter.$and = parts.map((w) => ({ $or: [{ name: { $regex: esc(w), $options: 'i' } }, { shortDescription: { $regex: esc(w), $options: 'i' } }, { slug: { $regex: esc(w), $options: 'i' } }] }));
		}
		const sortKey = String(args.sort || 'latest');
		const sort: any = sortKey === 'price_asc' ? { price: 1 } : sortKey === 'price_desc' ? { price: -1 } : sortKey === 'popular' ? { favoriteCount: -1, viewCount: -1 } : { sortOrder: 1, createdAt: -1 };
		const total = await Product.countDocuments(filter);
		const rows: any[] = await Product.find(filter).sort(sort).limit(limit).select('name slug price priceTiers stock currency shortDescription variants variantGroupName isPreOrder favoriteCount viewCount').lean();
		return {
			storeLabel: settings.navbarLabel || 'Toko',
			total,
			shown: rows.length,
			products: rows.map((p) => {
				const cur = effectiveProductCurrency(p, defCur);
				const vs = activeVariants(p);
				const prices = vs.map((v) => (v.price ?? p.price) as number);
				return {
					name: p.name,
					slug: p.slug,
					price: formatStoreMoney(p.price, cur),
					priceRange: prices.length && Math.min(...prices) !== Math.max(...prices) ? `${formatStoreMoney(Math.min(...prices), cur)} – ${formatStoreMoney(Math.max(...prices), cur)}` : undefined,
					variants: vs.length ? { group: p.variantGroupName || 'Varian', options: vs.map((v) => v.label) } : undefined,
					stock: stockText(p.stock),
					preOrder: !!p.isPreOrder,
					summary: String(p.shortDescription || '').slice(0, 140),
					favorites: p.favoriteCount || 0,
					views: p.viewCount || 0,
					publicPath: link(p.slug),
				};
			}),
			note: total > rows.length ? `Hanya ${rows.length} dari ${total} produk ditampilkan; persempit dengan keyword.` : undefined,
		};
	}

	if (name === 'get_store_product_detail') {
		const slug = String(args.slug || '').trim().slice(0, 160).replace(/^.*\//, '');
		if (!slug) return { error: 'slug wajib diisi' };
		const p: any = await Product.findOne(await publishedFilter({ slug })).populate({ path: 'categoryId', select: 'name' }).lean();
		if (!p) return { error: 'Produk tidak ditemukan atau sedang tidak dijual. Gunakan search_store_products untuk mencari.' };
		const cur = effectiveProductCurrency(p, defCur);
		const vs = activeVariants(p);
		const channels = channelsForProduct(p, (settings.paymentChannels || []) as any[]);
		const admins = activeStoreWaAdmins(settings, p).map((a: any) => a.name || 'Admin');
		const bundles: any[] = await Bundle.find(await publishedFilter({ isActive: true, 'items.productId': p._id })).select('name slug bundlePrice').limit(6).lean();
		const agg: any[] = await Review.aggregate([{ $match: { productId: p._id, status: 'visible' } }, { $group: { _id: null, n: { $sum: 1 }, avg: { $avg: '$rating' } } }]);
		const recent: any[] = await Review.find({ productId: p._id, status: 'visible' }).sort({ createdAt: -1 }).limit(3).select('rating comment authorLabel createdAt').lean();
		const tiers = (Array.isArray(p.priceTiers) ? p.priceTiers : []).map((t: any) => `≥${t.minQty} pcs: ${formatStoreMoney(t.unitPrice, cur)}/pcs`);
		return {
			name: p.name,
			slug: p.slug,
			category: p.categoryId?.name || undefined,
			price: formatStoreMoney(p.price, cur),
			tieredPrices: tiers.length ? tiers : undefined,
			variants: vs.length ? { group: p.variantGroupName || 'Varian', options: vs.map((v) => ({ label: v.label, price: formatStoreMoney(v.price ?? p.price, cur), stock: stockText(v.stock) })) } : undefined,
			stock: stockText(p.stock),
			preOrder: p.isPreOrder ? { open: p.preOrderOpenAt || null, close: p.preOrderCloseAt || null, estimatedReady: p.estimatedReadyAt || null } : undefined,
			downPayment: p.dpMode && p.dpMode !== 'off' ? { mode: p.dpMode, percent: p.dpPercent || undefined, amount: p.dpAmount ? formatStoreMoney(p.dpAmount, cur) : undefined } : undefined,
			freeShipping: !!p.isFreeShipping,
			shortDescription: p.shortDescription || '',
			description: strip(p.descriptionHtml).slice(0, 1500),
			rating: agg[0] ? { average: Math.round(agg[0].avg * 10) / 10, count: agg[0].n } : { average: 0, count: 0 },
			recentReviews: recent.map((r) => ({ stars: r.rating, by: r.authorLabel, text: String(r.comment || '').slice(0, 200), at: r.createdAt })),
			favorites: p.favoriteCount || 0,
			views: p.viewCount || 0,
			bundlesContainingThis: bundles.map((b) => ({ name: b.name, price: formatStoreMoney(b.bundlePrice, defCur), publicPath: `${prefix}${storePath}` })),
			contactAdmins: admins,
			paymentMethods: channels.map((c: any) => channelTitle(c)),
			howToOrder: 'Tambah ke keranjang atau Beli sekarang di halaman produk, isi data pemesan; pembayaran dan konfirmasi lewat invoice/WhatsApp admin.',
			publicPath: link(p.slug),
		};
	}

	if (name === 'get_store_bundles') {
		const limit = Math.min(20, Math.max(1, Number(args.limit) || 10));
		const kw = String(args.keyword || '').trim().slice(0, 80);
		const filter: any = await publishedFilter({ isActive: true });
		if (kw) filter.name = { $regex: esc(kw), $options: 'i' };
		const rows: any[] = await Bundle.find(filter).sort({ sortOrder: 1, createdAt: -1 }).limit(limit).populate('items.productId', 'name slug price published stock').lean();
		return {
			count: rows.length,
			bundles: rows.map((b) => {
				const items = (b.items || []).map((i: any) => ({ name: i.productId?.name || 'Produk', qty: i.qty || 1 }));
				const normal = (b.items || []).reduce((s: number, i: any) => s + (Number(i.productId?.price) || 0) * (i.qty || 1), 0);
				return {
					name: b.name,
					price: formatStoreMoney(b.bundlePrice, defCur),
					normalPrice: normal ? formatStoreMoney(normal, defCur) : undefined,
					saving: normal > b.bundlePrice ? formatStoreMoney(normal - b.bundlePrice, defCur) : undefined,
					contents: items,
					favorites: b.favoriteCount || 0,
					views: b.viewCount || 0,
					publicPath: `${prefix}${storePath}`,
				};
			}),
		};
	}

	if (name === 'get_store_promos') {
		const rows: any[] = await Campaign.find({ isActive: true, oneTimeCompleted: { $ne: true } }).sort({ priority: -1 }).limit(20).select('name scope productIds discountType discountValue mode startAt endAt dailyStart dailyEnd').lean();
		const now = new Date();
		const names = new Map<string, string>();
		const ids = rows.flatMap((r) => (r.productIds || []).map(String));
		if (ids.length) for (const p of await Product.find({ _id: { $in: ids } }).select('name').lean()) names.set(String((p as any)._id), (p as any).name);
		const live = rows.filter((r) => (!r.startAt || r.startAt <= now) && (!r.endAt || r.endAt >= now));
		return {
			count: live.length,
			promos: live.map((r) => ({
				name: r.name,
				discount: r.discountType === 'percent' ? `${r.discountValue}%` : formatStoreMoney(r.discountValue, defCur),
				appliesTo: r.scope === 'global' ? 'semua produk' : (r.productIds || []).map((i: any) => names.get(String(i)) || 'produk').slice(0, 10),
				schedule: r.mode === 'recurring_daily_window' ? `setiap hari ${r.dailyStart}–${r.dailyEnd}` : r.endAt ? `sampai ${new Date(r.endAt).toLocaleDateString('id-ID')}` : undefined,
			})),
		};
	}

	if (name === 'get_store_info') {
		const channels = ((settings.paymentChannels || []) as any[]).filter((c) => c.active).map((c) => channelTitle(c));
		const admins = activeStoreWaAdmins(settings).map((a: any) => a.name || 'Admin');
		return {
			storeLabel: settings.navbarLabel || 'Toko',
			publicPath: `${prefix}${storePath}`,
			open: admins.length > 0 ? true : false,
			currency: defCur,
			paymentMethods: channels,
			contactAdmins: admins,
			pickupAddress: settings.storeAddress || undefined,
			tax: settings.taxEnabled ? `${settings.taxPercent}%` : 'tidak ada',
			shipping: settings.shipping?.enabled ? 'tersedia (ongkir dihitung saat checkout)' : 'tidak tersedia (ambil di tempat)',
			howToOrder: 'Pilih produk → Keranjang atau Beli sekarang → isi data → bayar sesuai invoice. Pesanan bisa dilacak di Riwayat atau akun pembeli.',
		};
	}
	return { error: `Tool "${name}" tidak dikenali` };
}
