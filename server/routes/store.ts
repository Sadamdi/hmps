import crypto from 'crypto';
import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import {
	channelGroupKey,
	channelTitle,
	channelsForProduct,
	computeOrderPaymentPlan,
	derivePaymentState,
	amountForKind,
	effectiveDpRule,
	normalizeDpSettingsInput,
	normalizePaymentChannelsInput,
	readDpSettings,
	STORE_PAYMENT_STATUS_LABEL,
	STORE_PAYMENT_STATUSES,
	type DpRule,
	type StorePaymentChannel,
} from '../../shared/store-payment';
import { authenticate } from '../auth';
import * as mainDbModels from '../../db/mongodb';
import { mongoStorage } from '../mongo-storage';
import {
	effectiveProductCurrency,
	formatStoreMoney,
	normalizeProductCurrencyOverride,
	normalizeStoreCurrency,
} from '../../shared/store-currency';
import {
	capQtyByStock,
	getStoreStockAvailable,
	isStoreStockUnlimited,
	lineSubtotalForProduct,
	normalizePriceTiersInput,
} from '../../shared/store-pricing';
import {
	activeVariants,
	findVariant,
	hasVariants,
	normalizeVariantsInput,
	productAsVariant,
	variantLineKey,
} from '../../shared/store-variants';
import {
	STORE_CLOSED_MESSAGE,
	activeStoreWaAdmins,
	normalizeStoreWaAdmins,
	normalizeWaDigits,
	toPublicWaAdmins,
	waGreeting,
	type StoreWaAdmin,
} from '../../shared/store-wa';
import {
	storeCartRateLimiter,
	storeChatRateLimiter,
	storeCheckoutRateLimiter,
	storeOrderActionRateLimiter,
	storeProofUploadRateLimiter,
	storeShippingQuoteRateLimiter,
} from '../middleware/public-rate-limit';
import { sanitizeRichHtml } from '../utils/input-sanitize';
import {
	computeDiscountedSubtotal,
	computeDiscountedBundleSubtotal,
	isPreOrderOrderable,
	isPreOrderInWindow,
	shouldSkipStockDecrementForPreOrder,
	parseCartLinesFromBody,
	type CartLineInput,
	ensureCartLineKey,
	totalShippingWeightGrams,
	resolveOriginVillageForLines,
	resolveShippingForCheckout,
	type StoreCampaignLike,
} from './store-logic';
import {
	uploadMiddleware,
	uploadStoreProductImage,
	processStorePaymentProof,
	paymentProofUploadMiddleware,
	tenantCtxFromReq,
	deleteFile,
} from '../upload';
import { fetchShippingCost, type ShippingCourierOption } from '../services/shipping-api-co-id';
import { regionalFetch } from '../services/regional-api-co-id';

const router = Router();

const COOKIE_NAME = 'hmps_store_session';
const SESSION_PEPPER = process.env.STORE_SESSION_PEPPER || 'hmps-store-session-pepper';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function resolveModels(req: Request) {
	if ((req as any).tenantModels) return (req as any).tenantModels;
	// Import statis: `require` tidak ada di mode dev (tsx/ESM), hanya jalan di bundle esbuild
	return mainDbModels;
}

function hashSessionKey(secret: string): string {
	return crypto.createHmac('sha256', SESSION_PEPPER).update(secret).digest('hex');
}

/** Isi sortOrder dari createdAt untuk dokumen lama (idempoten). */
async function ensureProductSortOrderBackfill(StoreProduct: any) {
	try {
		await StoreProduct.updateMany(
			{ $or: [{ sortOrder: { $exists: false } }, { sortOrder: null }] },
			[{ $set: { sortOrder: { $toLong: '$createdAt' } } }],
		);
	} catch (e) {
		console.error('sortOrder backfill', e);
	}
}

function stripInvoiceTokenFromOrder(order: any) {
	if (!order || typeof order !== 'object') return order;
	const { invoiceAccessToken: _t, ...rest } = order;
	return rest;
}

async function getEffectivePermissions(req: Request): Promise<string[]> {
	if (!req.user) return [];
	if (req.isTenantRequest && req.tenantModels) {
		const { createTenantStorage } = await import('../tenant-storage');
		return createTenantStorage(req.tenantModels).getUserPermissions(String(req.user._id));
	}
	return mongoStorage.getUserPermissions(String(req.user._id));
}

// ── Notifikasi admin toko (in-app + web push) ──
// Penerima: user dengan permission toko.manage. Daftar di-cache 5 menit per situs/komunitas.
const storeAdminCache = new Map<string, { ids: string[]; at: number }>();

async function storeAdminUserIds(req: Request): Promise<string[]> {
	const key = String((req as any).tenantDbName || 'main');
	const hit = storeAdminCache.get(key);
	if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.ids;
	const isTenant = !!(req.isTenantRequest && req.tenantModels);
	const UserModel: any = isTenant ? req.tenantModels!.User : resolveModels(req).User;
	const users: any[] = await UserModel.find({}).select('_id').limit(500).lean();
	const tenantStorage = isTenant ? (await import('../tenant-storage')).createTenantStorage(req.tenantModels!) : null;
	const ids: string[] = [];
	for (const u of users) {
		const uid = String(u._id);
		const perms: string[] = tenantStorage ? await tenantStorage.getUserPermissions(uid) : await mongoStorage.getUserPermissions(uid);
		if (perms.includes('toko.manage')) ids.push(uid);
	}
	storeAdminCache.set(key, { ids, at: Date.now() });
	return ids;
}

/** Kirim notifikasi ke semua admin toko. Tidak pernah melempar error (tidak menghambat pembeli). */
function notifyStoreAdmins(
	req: Request,
	eventType: 'store_order' | 'store_chat',
	payload: { title: string; description: string; actionUrl: string; tag: string },
) {
	void (async () => {
		try {
			const ids = await storeAdminUserIds(req);
			if (!ids.length) return;
			const { dispatchNotification } = await import('../services/notification-orchestrator');
			const tenantSlug = String((req as any).tenantSlug || '');
			const NotifModel = req.isTenantRequest && req.tenantModels ? (req.tenantModels as any).UserNotification : undefined;
			for (const userId of ids) {
				await dispatchNotification(
					eventType,
					{ userId: ids[0], name: 'Toko' },
					{ userId, tenantSlug },
					{ ...payload, actionUrl: tenantSlug ? `/${tenantSlug}${payload.actionUrl}` : payload.actionUrl, entityType: 'store' },
					{ NotifModel, skipEmail: true },
				);
			}
		} catch (e) {
			console.error('notifyStoreAdmins:', e);
		}
	})();
}

function hasPerm(perms: string[], p: string) {
	return perms.includes(p);
}

async function canAccessStoreDashboard(req: Request): Promise<boolean> {
	const perms = await getEffectivePermissions(req);
	if (hasPerm(perms, 'toko.view') || hasPerm(perms, 'toko.manage')) return true;
	const { StoreProductShare } = resolveModels(req);
	const n = await StoreProductShare.countDocuments({ targetUserId: req.user!._id });
	return n > 0;
}

async function requireStoreDashboard(req: Request, res: Response, next: NextFunction) {
	if (!req.user) return res.status(401).json({ message: 'Authentication required' });
	try {
		if (await canAccessStoreDashboard(req)) return next();
	} catch (e) {
		console.error(e);
	}
	return res.status(403).json({ message: 'Akses toko ditolak' });
}

async function requireTokoManage(req: Request, res: Response, next: NextFunction) {
	if (!req.user) return res.status(401).json({ message: 'Authentication required' });
	const perms = await getEffectivePermissions(req);
	if (hasPerm(perms, 'toko.manage')) return next();
	return res.status(403).json({ message: 'Perlu permission toko.manage' });
}

async function canEditProduct(req: Request, product: any): Promise<boolean> {
	const perms = await getEffectivePermissions(req);
	if (hasPerm(perms, 'toko.manage')) return true;
	const uid = String(req.user!._id);
	if (String(product.authorId) === uid) {
		return hasPerm(perms, 'toko.view') || hasPerm(perms, 'toko.manage');
	}
	const { StoreProductShare } = resolveModels(req);
	const sh = await StoreProductShare.findOne({
		productId: product._id,
		targetUserId: req.user!._id,
		accessLevel: 'edit',
	}).lean();
	return !!sh;
}

async function canViewProductAdmin(req: Request, product: any): Promise<boolean> {
	if (await canEditProduct(req, product)) return true;
	const perms = await getEffectivePermissions(req);
	if (hasPerm(perms, 'toko.manage')) return true;
	if (hasPerm(perms, 'toko.view')) return true;
	const { StoreProductShare } = resolveModels(req);
	const sh = await StoreProductShare.findOne({
		productId: product._id,
		targetUserId: req.user!._id,
	}).lean();
	return !!sh;
}

function slugify(text: string): string {
	const s = String(text || '')
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return s || 'produk';
}

/** Body API: angka ≥ 0 = stok terbatas; kosong / < 0 = tak terbatas */
function parseProductStock(body: any): number {
	if (body?.stock === undefined || body?.stock === null || body?.stock === '') return -1;
	const n = Number(body.stock);
	if (!Number.isFinite(n)) return -1;
	if (n < 0) return -1;
	return Math.floor(n);
}

/** undefined = jangan ubah; null = hapus kategori */
async function resolveCategoryIdForWrite(
	StoreProductCategory: any,
	raw: unknown,
): Promise<mongoose.Types.ObjectId | null | undefined> {
	if (raw === undefined) return undefined;
	if (raw === null || raw === '') return null;
	const id = String(raw).trim();
	if (!mongoose.Types.ObjectId.isValid(id)) return null;
	const doc = await StoreProductCategory.findById(id).select('_id').lean();
	if (!doc) return null;
	return doc._id as mongoose.Types.ObjectId;
}

/**
 * Pilih admin WA untuk pesanan. `adminId` dari pembeli hanya dipakai bila termasuk admin aktif.
 * Hasil: admin terpilih, atau error `STORE_CLOSED` (0 aktif) / `CHOOSE_ADMIN` (>1 aktif, belum pilih).
 */
function pickStoreWaAdmin(
	settings: any,
	product: any | undefined,
	adminId: unknown,
):
	| { ok: true; admin: StoreWaAdmin }
	| { ok: false; status: number; body: Record<string, unknown> } {
	const list = activeStoreWaAdmins(settings, product);
	if (!list.length) {
		return {
			ok: false,
			status: 409,
			body: { message: STORE_CLOSED_MESSAGE, error: { code: 'STORE_CLOSED' } },
		};
	}
	if (list.length === 1) return { ok: true, admin: list[0] };
	const chosen = list.find((a) => a.id === String(adminId || ''));
	if (chosen) return { ok: true, admin: chosen };
	return {
		ok: false,
		status: 409,
		body: {
			message: 'Pilih admin tujuan',
			error: { code: 'CHOOSE_ADMIN' },
			admins: toPublicWaAdmins(list),
		},
	};
}

function applyTemplate(tpl: string, vars: Record<string, string>): string {
	let out = tpl || '';
	for (const [k, v] of Object.entries(vars)) {
		out = out.split(`{{${k}}}`).join(v);
	}
	return out;
}

function publicBaseUrl(req: Request): string {
	const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
	const host = req.get('host') || 'localhost';
	const tenant = (req as any).tenantSlug as string | undefined;
	const path = tenant ? `/${tenant}` : '';
	return `${proto}://${host}${path}`;
}

function defaultLayoutBlocks() {
	return [
		{
			id: 'hero',
			type: 'hero',
			visible: true,
			order: 0,
			props: { title: 'Toko', subtitle: 'Katalog produk kami' },
		},
		{
			id: 'grid',
			type: 'product_grid',
			visible: true,
			order: 1,
			props: {},
		},
	];
}

function normalizeStorePath(pathValue: unknown): string {
	const raw = String(pathValue || '/toko').trim();
	if (!raw) return '/toko';
	const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
	const compact = withSlash.replace(/\/{2,}/g, '/');
	if (compact === '/') return '/toko';
	return compact.endsWith('/') ? compact.slice(0, -1) : compact;
}

async function ensureSettings(req: Request) {
	const { StoreSettings } = resolveModels(req);
	let doc = await StoreSettings.findOne({ key: 'default' }).lean();
	if (!doc) {
		await StoreSettings.create({
			key: 'default',
			layoutBlocks: defaultLayoutBlocks(),
		});
		doc = await StoreSettings.findOne({ key: 'default' }).lean();
	}
	return doc;
}

async function listActiveCampaigns(req: Request): Promise<StoreCampaignLike[]> {
	const { StoreDiscountCampaign } = resolveModels(req);
	return (await StoreDiscountCampaign.find({ isActive: true }).sort({ priority: -1 }).lean()) as StoreCampaignLike[];
}

function normalizeStoreShippingInDoc(s: any) {
	if (!s || typeof s !== 'object') {
		return {
			enabled: false,
			globalOriginVillageCode: '',
			defaultWeightGrams: 1000,
			defaultCouriers: [] as string[],
		};
	}
	const d = s.shipping;
	if (!d || typeof d !== 'object') {
		return {
			enabled: false,
			globalOriginVillageCode: '',
			defaultWeightGrams: 1000,
			defaultCouriers: [] as string[],
		};
	}
	return {
		enabled: !!d.enabled,
		globalOriginVillageCode: String(d.globalOriginVillageCode || '').trim(),
		defaultWeightGrams: Math.max(1, Math.floor(Number(d.defaultWeightGrams) || 1000)),
		defaultCouriers: Array.isArray(d.defaultCouriers) ? d.defaultCouriers.map((x: any) => String(x)) : [],
	};
}

function parseProductDiscountFromBody(body: any): any {
	if (!body || !body.discountOverride || typeof body.discountOverride !== 'object') return undefined;
	return body.discountOverride;
}

function maxProductOrderQty(p: any, now: Date): number {
	if (!isPreOrderOrderable(p, now)) return 0;
	const preWin =
		p.isPreOrder &&
		isPreOrderInWindow(
			{
				isPreOrder: true,
				preOrderOpenAt: p.preOrderOpenAt,
				preOrderCloseAt: p.preOrderCloseAt,
			},
			now,
		);
	if (preWin) {
		if (isStoreStockUnlimited(p.stock)) return 9999;
		const a = getStoreStockAvailable(p.stock);
		if (a === null) return 9999;
		if (a === 0) return 99;
		return a;
	}
	if (isStoreStockUnlimited(p.stock)) return 9999;
	return getStoreStockAvailable(p.stock) ?? 0;
}

/**
 * Validasi isi bundling terhadap produk saat ini. Mengembalikan pesan error (untuk admin/pembeli)
 * bila ada isi yang tidak valid: produk hilang/belum terbit, produk bervarian tanpa varian dipilih,
 * atau varian sudah dihapus/nonaktif.
 */
function bundleItemProblem(p: any, variantId: string): string | null {
	if (!p || !p.published) return 'Isi bundling tidak valid (produk hilang atau belum terbit)';
	if (hasVariants(p)) {
		if (!variantId) return `Bundling belum lengkap: pilih varian untuk ${p.name}`;
		if (!findVariant(p, variantId)) return `Varian ${p.name} pada bundling sudah tidak tersedia`;
	}
	return null;
}

async function maxBundleQty(req: Request, b: any, now: Date): Promise<number> {
	const { StoreProduct } = resolveModels(req);
	let m = 9999;
	for (const it of b.items || []) {
		const p0 = await StoreProduct.findById(it.productId).lean();
		if (!p0 || !p0.published) return 0;
		// Produk bervarian: stok & status dihitung dari varian yang dibundel
		const p = productAsVariant(p0 as any, findVariant(p0, it.variantId));
		const need = Math.max(1, Math.floor(Number(it.qty) || 1));
		const maxEach = Math.floor(maxProductOrderQty(p, now) / need);
		m = Math.min(m, maxEach);
	}
	return m;
}

/**
 * Rincian isi bundling untuk tampilan publik: komponen (nama, varian, qty, foto), harga normal bila
 * dibeli satuan, dan hemat. Produk hilang/varian rusak ditandai `valid:false` (bundel tidak bisa dibeli).
 */
/** Thumbnail bundling: kosong, hasil upload toko (/uploads/...), atau URL https. */
function safeBundleThumb(v: unknown): string {
	const s = String(v || '').trim().slice(0, 500);
	return s.startsWith('/uploads/') || s.startsWith('/attached_assets/') || /^https:\/\//i.test(s) ? s : '';
}

async function describeBundle(req: Request, b: any, now: Date) {
	const { StoreProduct } = resolveModels(req);
	const components: any[] = [];
	let normalTotal = 0;
	let valid = true;
	for (const it of b.items || []) {
		const p0: any = await StoreProduct.findById(it.productId).lean();
		if (bundleItemProblem(p0, String(it.variantId || ''))) {
			valid = false;
			continue;
		}
		const v = findVariant(p0, it.variantId);
		const p = productAsVariant(p0, v);
		const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
		const unit = Number(p.price) || 0;
		normalTotal += unit * qty;
		components.push({
			productId: String(p0._id),
			slug: p0.slug,
			name: p0.name,
			variantLabel: v?.label || '',
			qty,
			unitPrice: unit,
			thumbnail: v?.thumbnail || p0.thumbnail || '',
		});
	}
	const cap = valid ? await maxBundleQty(req, b, now) : 0;
	const price = Number(b.bundlePrice) || 0;
	return {
		components,
		normalTotal,
		saving: Math.max(0, normalTotal - price),
		available: valid && cap > 0,
		maxQty: cap,
	};
}

/**
 * Ambil / kembalikan stok produk atau varian. Stok -1 = tak terbatas (tidak diubah).
 * Varian disimpan di `variants[]` produk, jadi update memakai operator posisi `$`.
 */
async function takeStock(StoreProduct: any, productId: any, variantId: string, qty: number): Promise<'ok' | 'unlimited' | 'short'> {
	const pdoc: any = await StoreProduct.findById(productId).lean();
	if (!pdoc) return 'short';
	if (variantId) {
		const v = (pdoc.variants || []).find((x: any) => x.id === variantId);
		if (!v) return 'short';
		if (isStoreStockUnlimited(v.stock)) return 'unlimited';
		const r = await StoreProduct.updateOne(
			{ _id: productId, variants: { $elemMatch: { id: variantId, stock: { $gte: qty } } } },
			{ $inc: { 'variants.$.stock': -qty } },
		);
		return r.modifiedCount === 1 ? 'ok' : 'short';
	}
	if (isStoreStockUnlimited(pdoc.stock)) return 'unlimited';
	const r = await StoreProduct.updateOne({ _id: productId, stock: { $gte: qty } }, { $inc: { stock: -qty } });
	return r.modifiedCount === 1 ? 'ok' : 'short';
}

async function giveStock(StoreProduct: any, productId: any, variantId: string, qty: number) {
	if (variantId) {
		await StoreProduct.updateOne(
			{ _id: productId, variants: { $elemMatch: { id: variantId, stock: { $gte: 0 } } } },
			{ $inc: { 'variants.$.stock': qty } },
		);
		return;
	}
	await StoreProduct.updateOne({ _id: productId, stock: { $gte: 0 } }, { $inc: { stock: qty } });
}

function mergeStockOpsByProduct(ops: { id: any; variantId?: string; qty: number; skip: boolean }[]) {
	const m = new Map<string, { id: any; variantId?: string; qty: number; skip: boolean }>();
	for (const o of ops) {
		const k = `${o.id}:${o.variantId || ''}`;
		const ex = m.get(k);
		if (ex) {
			ex.qty += o.qty;
			ex.skip = ex.skip && o.skip;
		} else {
			m.set(k, { id: o.id, variantId: o.variantId || '', qty: o.qty, skip: o.skip });
		}
	}
	return Array.from(m.values());
}

/** Kanal bayar + DP per produk (shared/store-payment.ts) */
const PRODUCT_PAYMENT_KEYS = ['paymentChannelMode', 'paymentChannelIds', 'dpMode', 'dpPercent', 'dpAmount', 'dpSettleBy'];
function parseProductPaymentFromBody(body: any) {
	const dpMode = ['percent', 'amount', 'full'].includes(body.dpMode) ? body.dpMode : 'default';
	const settle = body.dpSettleBy ? new Date(String(body.dpSettleBy)) : null;
	return {
		paymentChannelMode: body.paymentChannelMode === 'custom' ? 'custom' : 'global',
		paymentChannelIds: Array.isArray(body.paymentChannelIds)
			? Array.from(new Set(body.paymentChannelIds.map((x: unknown) => String(x).slice(0, 40)))).slice(0, 20)
			: [],
		dpMode,
		dpPercent: dpMode === 'percent' ? Math.min(99, Math.max(1, Math.round(Number(body.dpPercent) || 30))) : 0,
		dpAmount: dpMode === 'amount' ? Math.max(0, Math.round(Number(body.dpAmount) || 0)) : 0,
		dpSettleBy: settle && !Number.isNaN(settle.getTime()) ? settle : null,
	};
}

function parsePreOrderFromBody(body: any) {
	return {
		isPreOrder: body.isPreOrder === true,
		preOrderOpenAt: body.preOrderOpenAt ? new Date(String(body.preOrderOpenAt)) : null,
		preOrderCloseAt: body.preOrderCloseAt ? new Date(String(body.preOrderCloseAt)) : null,
		estimatedReadyAt: body.estimatedReadyAt ? new Date(String(body.estimatedReadyAt)) : null,
		preOrderDiscountPercent: Math.min(100, Math.max(0, Number(body.preOrderDiscountPercent) || 0)),
		preOrderAllowAfterClose: body.preOrderAllowAfterClose === true,
		preOrderTimeline: Array.isArray(body.preOrderTimeline)
			? body.preOrderTimeline
					.filter((r: any) => r && typeof r === 'object')
					.map((r: any) => ({
						key: String(r.key || ''),
						label: String(r.label || ''),
						at: r.at ? new Date(String(r.at)) : null,
						note: String(r.note || ''),
					}))
					.slice(0, 20)
			: [],
	};
}

async function getOrCreateGuestSession(req: Request, res: Response) {
	const { GuestStoreSession } = resolveModels(req);
	let token = req.cookies?.[COOKIE_NAME] as string | undefined;
	let needSetCookie = false;
	if (!token || token.length < 16) {
		token = crypto.randomBytes(32).toString('hex');
		needSetCookie = true;
	}
	const sessionKeyHash = hashSessionKey(token);
	const now = new Date();
	const expireAt = new Date(now.getTime() + SEVEN_DAYS_MS);

	let doc = await GuestStoreSession.findOne({ sessionKeyHash }).exec();
	if (!doc) {
		doc = await GuestStoreSession.create({
			sessionKeyHash,
			cartItems: [],
			checkoutDraft: {},
			expireAt,
		});
	} else {
		doc.expireAt = expireAt;
		doc.updatedAt = now;
		await doc.save();
	}

	if (needSetCookie) {
		res.cookie(COOKIE_NAME, token, {
			httpOnly: true,
			sameSite: 'lax',
			maxAge: SEVEN_DAYS_MS,
			secure: process.env.NODE_ENV === 'production',
		});
	}

	return { doc, sessionKeyHash, rawToken: token };
}

function validateVideo(url: string): { ok: boolean; type: '' | 'youtube' | 'gdrive' | 'public' } {
	if (!url || !String(url).trim()) return { ok: true, type: '' };
	const u = url.trim();
	if (/youtube\.com|youtu\.be/i.test(u)) return { ok: true, type: 'youtube' };
	if (/drive\.google\.com/i.test(u)) return { ok: true, type: 'gdrive' };
	if (/^https?:\/\//i.test(u) && /\.(mp4|webm|ogg|mov)(?:$|[?#])/i.test(u)) {
		return { ok: true, type: 'public' };
	}
	return { ok: false, type: '' };
}

function stripHtml(s: string): string {
	return String(s || '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 220);
}

function normalizeUrlString(v: unknown): string {
	return String(v || '').trim();
}

function sanitizeDriveFileId(v: unknown): string {
	const raw = String(v || '').trim();
	const m = raw.match(/^[a-zA-Z0-9_-]{10,}$/);
	return m ? m[0] : '';
}

function normalizeStoreGalleryInput(input: unknown) {
	if (!Array.isArray(input)) return [] as Array<{
		url: string;
		source: 'local' | 'gdrive';
		gdriveFileId: string;
	}>;
	return input
		.map((raw: any) => {
			const url = normalizeUrlString(typeof raw === 'string' ? raw : raw?.url);
			if (!url) return null;
			const source =
				raw?.source === 'gdrive' || url.includes('drive.google.com') ? 'gdrive' : 'local';
			return {
				url,
				source: source as 'local' | 'gdrive',
				gdriveFileId: normalizeUrlString(raw?.gdriveFileId),
			};
		})
		.filter((it) => !!it)
		.slice(0, 10);
}

function getProductMediaUrls(product: any): string[] {
	const urls: string[] = [];
	const thumb = normalizeUrlString(product?.thumbnail);
	if (thumb) urls.push(thumb);
	if (Array.isArray(product?.gallery)) {
		for (const g of product.gallery) {
			const u = normalizeUrlString(g?.url);
			if (u) urls.push(u);
		}
	}
	// Foto varian ikut dihitung agar tidak terhapus sebagai media yatim saat produk diedit
	if (Array.isArray(product?.variants)) {
		for (const v of product.variants) {
			const u = normalizeUrlString(v?.thumbnail);
			if (u) urls.push(u);
		}
	}
	return urls;
}

function sanitizeTenantSlug(raw: string): string {
	return String(raw || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, '_');
}

function isStoreUploadUrlForRequest(req: Request, rawUrl: unknown): boolean {
	const url = normalizeUrlString(rawUrl);
	if (!url.startsWith('/uploads/')) return false;
	if (req.isTenantRequest) {
		const safe = sanitizeTenantSlug(String((req as any).tenantSlug || ''));
		if (!safe) return false;
		return url.startsWith(`/uploads/community/${safe}/store/`);
	}
	return url.startsWith('/uploads/store/');
}

async function cleanupRemovedStoreMedia(
	req: Request,
	beforeUrls: string[],
	afterUrls: string[],
): Promise<void> {
	const keep = new Set(afterUrls.map(normalizeUrlString).filter(Boolean));
	const removed = beforeUrls
		.map(normalizeUrlString)
		.filter((u) => !!u && !keep.has(u))
		.filter((u) => isStoreUploadUrlForRequest(req, u));
	for (const u of removed) {
		try {
			await deleteFile(u);
		} catch (e) {
			console.warn('[store] cleanupRemovedStoreMedia failed:', u, e);
		}
	}
}

// ── Public ──

router.get('/public/gdrive-image/:fileId', async (req, res) => {
	try {
		const fileId = sanitizeDriveFileId(req.params.fileId);
		if (!fileId) return res.status(400).json({ message: 'File ID tidak valid' });

		const candidateUrls = [
			`https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
			`https://drive.google.com/uc?export=view&id=${fileId}`,
			`https://lh3.googleusercontent.com/d/${fileId}=s2000`,
		];

		for (const url of candidateUrls) {
			try {
				const r = await fetch(url, {
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					},
				});
				if (!r.ok) continue;
				const contentType = String(r.headers.get('content-type') || '').toLowerCase();
				if (!contentType.startsWith('image/')) continue;
				const arr = await r.arrayBuffer();
				if (!arr.byteLength) continue;
				res.setHeader('Content-Type', contentType);
				res.setHeader('Cache-Control', 'public, max-age=3600');
				return res.send(Buffer.from(arr));
			} catch {
				// lanjut fallback berikutnya
			}
		}

		return res.status(404).json({ message: 'Gambar Google Drive tidak dapat dimuat' });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal memuat gambar Google Drive' });
	}
});

router.get('/public/settings', async (req, res) => {
	try {
		const doc: any = await ensureSettings(req);
		const s = doc || {};
		const ship = normalizeStoreShippingInDoc(s);
		res.json({
			navbarLabel: s.navbarLabel || 'Toko',
			navbarPath: s.navbarPath || '/toko',
			taxPercent: typeof s.taxPercent === 'number' ? s.taxPercent : 0,
			taxEnabled: !!s.taxEnabled,
			whatsappContactName: s.whatsappContactName || '',
			// Hanya id + nama admin yang aktif (nomor tidak dikirim ke publik)
			waAdmins: toPublicWaAdmins(activeStoreWaAdmins(s)),
			storeOpen: activeStoreWaAdmins(s).length > 0,
			storeAddress: s.storeAddress || '',
			defaultCurrency: normalizeStoreCurrency(s.defaultCurrency),
			layoutBlocks: Array.isArray(s.layoutBlocks) ? s.layoutBlocks : defaultLayoutBlocks(),
			shipping: {
				enabled: ship.enabled,
				hasGlobalOrigin: !!ship.globalOriginVillageCode,
			},
			// Ringkasan kanal bayar (tanpa nomor rekening; detail lengkap ada di invoice pesanan)
			paymentChannels: ((s.paymentChannels || []) as StorePaymentChannel[])
				.filter((c) => c.active)
				.map((c) => ({ id: c.id, type: c.type, title: channelTitle(c) })),
			dp: (({ enabled, mode, percent, amount, cancelPolicyText }) => ({ enabled, mode, percent, amount, cancelPolicyText }))(
				readDpSettings(s),
			),
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat pengaturan toko' });
	}
});

router.get('/public/categories', async (req, res) => {
	try {
		const { StoreProductCategory } = resolveModels(req);
		const list = await StoreProductCategory.find({})
			.sort({ order: 1, name: 1 })
			.select('name slug order')
			.lean();
		res.json(list);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat kategori' });
	}
});

// Wilayah (proxy) — hanya panggil jika ONGKIR_API terset
router.get('/public/regional/provinces', async (_req, res) => {
	try {
		if (!(process.env.ONGKIR_API || '').trim()) {
			return res.json({ is_success: true, data: { provinces: [] } });
		}
		const j = await regionalFetch('/regional/indonesia/provinces');
		return res.json(j);
	} catch (e: any) {
		console.error(e);
		return res.status(500).json({ message: e?.message || 'Wilayah: gagal' });
	}
});
router.get('/public/regional/provinces/:code/regencies', async (req, res) => {
	try {
		if (!(process.env.ONGKIR_API || '').trim()) return res.json({ data: { regencies: [] } });
		const j = await regionalFetch(`/regional/indonesia/provinces/${encodeURIComponent(req.params.code)}/regencies`);
		return res.json(j);
	} catch (e: any) {
		console.error(e);
		return res.status(500).json({ message: e?.message || 'Gagal' });
	}
});
router.get('/public/regional/regencies/:code/districts', async (req, res) => {
	try {
		if (!(process.env.ONGKIR_API || '').trim()) return res.json({ data: { districts: [] } });
		const j = await regionalFetch(`/regional/indonesia/regencies/${encodeURIComponent(req.params.code)}/districts`);
		return res.json(j);
	} catch (e: any) {
		console.error(e);
		return res.status(500).json({ message: e?.message || 'Gagal' });
	}
});
router.get('/public/regional/districts/:code/villages', async (req, res) => {
	try {
		if (!(process.env.ONGKIR_API || '').trim()) return res.json({ data: { villages: [] } });
		const j = await regionalFetch(`/regional/indonesia/districts/${encodeURIComponent(req.params.code)}/villages`);
		return res.json(j);
	} catch (e: any) {
		console.error(e);
		return res.status(500).json({ message: e?.message || 'Gagal' });
	}
});

/** Estimasi ongkir: body destinationVillageCode + item lines (sama format checkout) */
/**
 * Pratinjau pembayaran keranjang (sebelum checkout): apakah boleh DP, nominal DP/sisa, tenggat,
 * jumlah pesanan hasil pemisahan kanal bayar, dan teks kebijakan batal. Hitungan sama dengan checkout.
 */
router.post('/payment-preview', storeCartRateLimiter, async (req, res) => {
	try {
		const { StoreProduct, StoreBundle } = resolveModels(req);
		const parsed = parseCartLinesFromBody(req.body?.items);
		if (!parsed.ok) return res.status(400).json({ message: parsed.message });
		const settings: any = await ensureSettings(req);
		const now = new Date();
		const campaigns = await listActiveCampaigns(req);
		const allChannels = (settings.paymentChannels || []) as StorePaymentChannel[];
		const active = allChannels.filter((c) => c.active);
		const shippingCost = Math.max(0, Math.round(Number(req.body?.shippingCost) || 0));
		const groups = new Map<string, { channels: StorePaymentChannel[]; lines: { lineSubtotal: number; qty: number; dpRule: DpRule | null }[] }>();
		const itemRules: { key: string; name: string; dp: DpRule }[] = [];
		for (const l of parsed.lines) {
			let lineSubtotal = 0;
			let rule: DpRule | null = null;
			let channels = active;
			if (l.lineKind === 'product') {
				const p0: any = await StoreProduct.findById(l.productId).lean();
				if (!p0 || !p0.published) continue;
				const p = productAsVariant(p0, findVariant(p0, (l as any).variantId));
				if (!isPreOrderOrderable(p, now)) continue;
				lineSubtotal = computeDiscountedSubtotal(p as any, l.qty, campaigns, now).lineSubtotal;
				rule = effectiveDpRule(p0, settings, isPreOrderInWindow(p as any, now));
				channels = channelsForProduct(p0, allChannels);
				itemRules.push({ key: ensureCartLineKey(l as any), name: p0.name, dp: rule });
			} else {
				const b: any = await StoreBundle.findById(l.bundleId).lean();
				if (!b || !b.published || !b.isActive) continue;
				lineSubtotal = computeDiscountedBundleSubtotal(String(b._id), b.bundlePrice, l.qty, campaigns, now).lineSubtotal;
			}
			const key = channelGroupKey(channels);
			const g = groups.get(key) || { channels, lines: [] };
			g.lines.push({ lineSubtotal, qty: l.qty, dpRule: rule });
			groups.set(key, g);
		}
		const taxPercent = settings.taxEnabled ? Number(settings.taxPercent || 0) : 0;
		const plans = Array.from(groups.values()).map((g, i) => {
			const subtotal = g.lines.reduce((s, l) => s + l.lineSubtotal, 0);
			const taxAmount = settings.taxEnabled ? Math.round((subtotal * taxPercent) / 100) : 0;
			const ship = i === 0 ? shippingCost : 0;
			const total = subtotal + taxAmount + ship;
			const dp = computeOrderPaymentPlan(g.lines, { shippingCost: ship, taxAmount, total }, 'dp');
			return {
				channels: g.channels.map((c) => ({ id: c.id, type: c.type, title: channelTitle(c) })),
				total,
				dpAllowed: dp.plan === 'dp',
				dpAmount: dp.plan === 'dp' ? dp.dpAmount : total,
				balanceDue: dp.balanceDue,
				settleBy: dp.settleBy,
			};
		});
		const dpSettings = readDpSettings(settings);
		res.json({
			payOnWeb: active.length > 0,
			orderCount: plans.length,
			orders: plans,
			dpAllowed: plans.some((p) => p.dpAllowed),
			total: plans.reduce((s, p) => s + p.total, 0),
			dpTotal: plans.reduce((s, p) => s + p.dpAmount, 0),
			balanceTotal: plans.reduce((s, p) => s + p.balanceDue, 0),
			settleBy: plans.map((p) => p.settleBy).filter(Boolean).sort()[0] || null,
			items: itemRules,
			cancelPolicyText: dpSettings.cancelPolicyText,
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menghitung pembayaran' });
	}
});

router.post('/shipping/quote', storeShippingQuoteRateLimiter, async (req, res) => {
	try {
		const { StoreProduct, StoreBundle } = resolveModels(req);
		const settings: any = await ensureSettings(req);
		const sh = normalizeStoreShippingInDoc(settings);
		const b = req.body || {};
		const dest = String(b.destinationVillageCode || '').trim();
		const parsed = parseCartLinesFromBody(b.items);
		if (!parsed.ok) return res.status(400).json({ message: parsed.message });
		if (!/^\d{10}$/.test(dest)) {
			return res.status(400).json({ message: 'Kode kelurahan tujuan 10 digit wajib' });
		}
		const w = await totalShippingWeightGrams(parsed.lines, {
			StoreProduct,
			StoreBundle,
			defaultWeightGrams: sh.defaultWeightGrams,
		});
		if (w <= 0) {
			return res.json({ cost: 0, couriers: [], weightGrams: 0, etd: '' });
		}
		const pMap = new Map<string, any>();
		const bMap = new Map<string, any>();
		for (const l of parsed.lines) {
			if (l.lineKind === 'product') {
				const p = await StoreProduct.findById(l.productId).lean();
				if (p) pMap.set(String(p._id), p);
			} else {
				const u = await StoreBundle.findById(l.bundleId).lean();
				if (u) bMap.set(String(u._id), u);
			}
		}
		const origin = resolveOriginVillageForLines(parsed.lines, pMap, bMap, sh.globalOriginVillageCode);
		if (!/^\d{10}$/.test(origin)) {
			return res.status(400).json({ message: 'Kode kelurahan asal toko belum diatur' });
		}
		const r = await fetchShippingCost({
			originVillageCode: origin,
			destinationVillageCode: dest,
			weightGrams: w,
		});
		let list: ShippingCourierOption[] = r.couriers;
		if (sh.defaultCouriers.length) {
			const allow = sh.defaultCouriers.map((c: string) => c.toLowerCase());
			const f = list.filter((c) => allow.includes(c.courierCode.toLowerCase()));
			if (f.length) list = f;
		}
		return res.json({
			weightGrams: w,
			originVillageCode: origin,
			couriers: list,
			cheapest: list.length ? list.reduce((a, c) => (c.price < a.price ? c : a)) : null,
		});
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal estimasi ongkir' });
	}
});

/** Kampanye diskon aktif — dipakai storefront untuk tampilkan harga promo (tanpa usage sensitif) */
router.get('/public/campaigns', async (req, res) => {
	try {
		const { StoreDiscountCampaign } = resolveModels(req);
		const list = await StoreDiscountCampaign.find({ isActive: true })
			.sort({ priority: -1, createdAt: -1 })
			.select(
				'name scope productIds mode discountType discountValue startAt endAt dailyStart dailyEnd usageLimit usageCount oneTimeCompleted priority isActive',
			)
			.lean();
		return res.json(list);
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal memuat promo' });
	}
});

router.get('/public/bundles', async (req, res) => {
	try {
		const { StoreBundle } = resolveModels(req);
		const list = await StoreBundle.find({ published: true, isActive: true })
			.sort({ sortOrder: 1, createdAt: -1 })
			.limit(50)
			.select('slug name shortDescription bundlePrice thumbnail items sortOrder')
			.lean();
		const now = new Date();
		const items = await Promise.all(list.map(async (b: any) => ({ ...b, ...(await describeBundle(req, b, now)) })));
		return res.json({ items });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal memuat bundling' });
	}
});
router.get('/public/bundles/:slug', async (req, res) => {
	try {
		const { StoreBundle, StoreProduct } = resolveModels(req);
		const b = await StoreBundle.findOne({ slug: req.params.slug, published: true, isActive: true })
			.lean();
		if (!b) return res.status(404).json({ message: 'Bundling tidak ditemukan' });
		return res.json({ ...b, ...(await describeBundle(req, b, new Date())) });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal memuat bundling' });
	}
});

router.get('/public/products', async (req, res) => {
	try {
		const { StoreProduct, StoreProductCategory } = resolveModels(req);
		await ensureProductSortOrderBackfill(StoreProduct);

		const q = String(req.query.q || '').trim();
		const catParam = String(req.query.category || '').trim();
		const filter: any = { published: true };
		const qRx = q
			? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
			: null;
		const textOr = qRx
			? [{ name: qRx }, { shortDescription: qRx }]
			: null;

		if (catParam === '__none') {
			filter.$and = [
				{ $or: [{ categoryId: null }, { categoryId: { $exists: false } }] },
				...(textOr ? [{ $or: textOr }] : []),
			];
		} else if (catParam) {
			const cat = await StoreProductCategory.findOne({ slug: catParam }).select('_id').lean();
			if (!cat) {
				return res.json({ items: [], total: 0, page: 1, limit: 9 });
			}
			filter.categoryId = cat._id;
			if (textOr) filter.$or = textOr;
		} else if (textOr) {
			filter.$or = textOr;
		}

		// Favorit (disimpan di browser): ?ids=a,b,c
		const idsParam = String(req.query.ids || '').trim();
		if (idsParam) {
			const ids = idsParam
				.split(',')
				.map((x) => x.trim())
				.filter((x) => mongoose.Types.ObjectId.isValid(x))
				.slice(0, 200);
			filter._id = { $in: ids };
		}
		const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '9'), 10) || 9));
		const skip = (page - 1) * limit;

		const sortMode = String(req.query.sort || '').trim().toLowerCase();
		const sortSpec: Record<string, 1 | -1> =
			sortMode === 'latest'
				? { createdAt: -1 }
				: { sortOrder: 1, createdAt: -1 };

		const total = await StoreProduct.countDocuments(filter);
		const list = await StoreProduct.find(filter)
			.sort(sortSpec)
			.skip(skip)
			.limit(limit)
			.populate({ path: 'categoryId', select: 'name slug' })
			.select(
				'slug name shortDescription price priceTiers priceTierMultiples stock currency thumbnail published createdAt updatedAt categoryId isPreOrder preOrderOpenAt preOrderCloseAt estimatedReadyAt preOrderDiscountPercent preOrderAllowAfterClose isFreeShipping originVillageCodeOverride shippingWeightGrams disableGlobalDiscount discountOverride preOrderTimeline dpMode dpPercent dpAmount dpSettleBy paymentChannelMode paymentChannelIds',
			)
			.lean();
		res.json({ items: list, total, page, limit });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat produk' });
	}
});

router.get('/public/products/:slug', async (req, res) => {
	try {
		const { StoreProduct } = resolveModels(req);
		const p = await StoreProduct.findOne({
			slug: req.params.slug,
			published: true,
		})
			.populate({ path: 'categoryId', select: 'name slug' })
			.lean();
		if (!p) return res.status(404).json({ message: 'Produk tidak ditemukan' });
		const settings: any = await ensureSettings(req);
		const active = activeStoreWaAdmins(settings, p);
		// Nomor admin tidak dikirim ke publik; hanya id + nama admin yang aktif
		const { whatsappAdmins: _wa, whatsappPhoneOverride: _wp, ...rest } = p as any;
		const now = new Date();
		const { StoreBundle } = resolveModels(req);
		const inBundles: any[] = await StoreBundle.find({ published: true, isActive: true, 'items.productId': (p as any)._id })
			.sort({ sortOrder: 1, createdAt: -1 })
			.limit(6)
			.select('slug name shortDescription bundlePrice thumbnail items')
			.lean();
		const bundles = (await Promise.all(inBundles.map(async (b) => ({ ...b, ...(await describeBundle(req, b, now)) })))).filter(
			(b) => b.available,
		);
		const channels = channelsForProduct(p, (settings.paymentChannels || []) as StorePaymentChannel[]);
		res.json({
			...rest,
			bundles,
			waAdmins: toPublicWaAdmins(active),
			storeOpen: active.length > 0,
			// Ringkasan pembayaran untuk halaman produk (DP pre-order + kanal bayar tanpa nomor)
			paymentInfo: {
				dp: effectiveDpRule(p, settings, isPreOrderInWindow(p as any, now)),
				channels: channels.map((c) => ({ id: c.id, type: c.type, title: channelTitle(c) })),
			},
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat produk' });
	}
});

// ── Admin: akses ──

router.get('/admin/access-summary', authenticate, async (req, res) => {
	try {
		const perms = await getEffectivePermissions(req);
		const { StoreProductShare } = resolveModels(req);
		const shareCount = await StoreProductShare.countDocuments({ targetUserId: req.user!._id });
		res.json({
			hasTokoView: hasPerm(perms, 'toko.view'),
			hasTokoManage: hasPerm(perms, 'toko.manage'),
			hasProductShare: shareCount > 0,
			canOpenDashboard:
				hasPerm(perms, 'toko.view') ||
				hasPerm(perms, 'toko.manage') ||
				shareCount > 0,
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat ringkasan akses' });
	}
});

router.get('/admin/settings', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const doc: any = await ensureSettings(req);
		res.json(doc);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat pengaturan' });
	}
});

router.get('/admin/categories', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreProductCategory } = resolveModels(req);
		const list = await StoreProductCategory.find({}).sort({ order: 1, name: 1 }).lean();
		res.json(list);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat kategori' });
	}
});

router.post('/admin/categories', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreProductCategory } = resolveModels(req);
		const name = String(req.body?.name || '').trim();
		if (!name) return res.status(400).json({ message: 'Nama kategori wajib' });

		let baseSlug = slugify(String(req.body?.slug || name));
		let slug = baseSlug;
		let n = 0;
		while (await StoreProductCategory.findOne({ slug }).lean()) {
			n += 1;
			slug = `${baseSlug}-${n}`;
		}

		const order = Number(req.body?.order);
		const doc = await StoreProductCategory.create({
			name,
			slug,
			order: Number.isFinite(order) ? order : 0,
		});
		res.status(201).json(doc.toObject());
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal membuat kategori' });
	}
});

router.patch('/admin/categories/:id', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreProductCategory } = resolveModels(req);
		const cat = await StoreProductCategory.findById(req.params.id);
		if (!cat) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
		const body = req.body || {};
		if (body.name !== undefined) {
			const name = String(body.name || '').trim();
			if (!name) return res.status(400).json({ message: 'Nama wajib' });
			cat.name = name;
		}
		if (body.slug !== undefined) {
			let ns = slugify(String(body.slug || ''));
			if (!ns) return res.status(400).json({ message: 'Slug tidak valid' });
			let slug = ns;
			let n = 0;
			while (await StoreProductCategory.findOne({ slug, _id: { $ne: cat._id } }).lean()) {
				n += 1;
				slug = `${ns}-${n}`;
			}
			cat.slug = slug;
		}
		if (body.order !== undefined) {
			const order = Number(body.order);
			if (Number.isFinite(order)) cat.order = order;
		}
		await cat.save();
		res.json(cat.toObject());
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memperbarui kategori' });
	}
});

router.delete('/admin/categories/:id', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreProductCategory, StoreProduct } = resolveModels(req);
		const id = req.params.id;
		const cat = await StoreProductCategory.findById(id);
		if (!cat) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
		await StoreProduct.updateMany({ categoryId: id }, { $set: { categoryId: null } });
		await StoreProductCategory.deleteOne({ _id: id });
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menghapus kategori' });
	}
});

router.post(
	'/admin/upload-product-image',
	authenticate,
	requireStoreDashboard,
	uploadMiddleware.single('image'),
	async (req, res) => {
		try {
			if (!req.file) return res.status(400).json({ message: 'Gambar wajib' });
			const url = await uploadStoreProductImage(req.file, undefined, tenantCtxFromReq(req as any));
			res.json({ url });
		} catch (e) {
			console.error(e);
			res.status(500).json({ message: 'Gagal mengunggah gambar' });
		}
	},
);

router.post('/admin/uploads/cleanup', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const urlsIn = Array.isArray(req.body?.urls) ? req.body.urls : [];
		const urls = urlsIn
			.map((u: unknown) => normalizeUrlString(u))
			.filter(Boolean)
			.filter((u: string) => isStoreUploadUrlForRequest(req, u));
		let deleted = 0;
		for (const u of urls) {
			try {
				await deleteFile(u);
				deleted += 1;
			} catch (e) {
				console.warn('[store] cleanup upload failed:', u, e);
			}
		}
		res.json({ ok: true, deleted });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal membersihkan upload toko' });
	}
});

router.put('/admin/settings', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreSettings } = resolveModels(req);
		const body = req.body || {};
		const layoutBlocks = Array.isArray(body.layoutBlocks)
			? body.layoutBlocks.map((b: any, i: number) => ({
					id: String(b.id || `blk-${i}`),
					type: String(b.type || 'block'),
					visible: b.visible !== false,
					order: typeof b.order === 'number' ? b.order : i,
					props: typeof b.props === 'object' && b.props ? b.props : {},
				}))
			: undefined;

		const update: any = {
			updatedAt: new Date(),
		};
		const allowed = [
			'navbarLabel',
			'navbarPath',
			'whatsappPhone',
			'whatsappContactName',
			'defaultBuyMessageTemplate',
			'checkoutMessageTemplate',
			'taxPercent',
			'taxEnabled',
			'storeAddress',
			'defaultCurrency',
		];
		if (body.googleSheetId !== undefined) {
			const { extractSpreadsheetId } = await import('../services/store-sheet-sync');
			const raw = String(body.googleSheetId || '').trim();
			const id = raw ? extractSpreadsheetId(raw) : '';
			if (raw && !id) return res.status(400).json({ message: 'Link Google Sheet tidak valid' });
			update.googleSheetId = id;
		}
		if (body.googleSheetSyncEnabled !== undefined) update.googleSheetSyncEnabled = !!body.googleSheetSyncEnabled;
		if (body.paymentChannels !== undefined) {
			const r = normalizePaymentChannelsInput(body.paymentChannels);
			if (!r.ok) return res.status(400).json({ message: r.message, error: { code: 'PAYMENT_CHANNEL_INVALID' } });
			for (const c of r.channels) {
				if (c.qrisImageUrl && !isStoreUploadUrlForRequest(req, c.qrisImageUrl)) {
					return res.status(400).json({ message: 'Gambar QRIS harus diupload lewat dashboard toko' });
				}
			}
			update.paymentChannels = r.channels;
		}
		if (body.dp !== undefined) update.dp = normalizeDpSettingsInput(body.dp);
		const legacyOnly =
			Array.isArray(body.whatsappAdmins) &&
			body.whatsappAdmins.length === 0 &&
			!!normalizeWaDigits(body.whatsappPhone);
		// Draft lama (daftar kosong tapi nomor lama ada) → jangan hapus nomor lama
		if (body.whatsappAdmins !== undefined && !legacyOnly) {
			const admins = normalizeStoreWaAdmins(body.whatsappAdmins);
			update.whatsappAdmins = admins;
			// Field lama tetap diisi admin pertama (kompatibel dengan kode/data lama)
			update.whatsappPhone = admins[0]?.phone || '';
			update.whatsappContactName = admins[0]?.name || '';
			delete body.whatsappPhone;
			delete body.whatsappContactName;
		}
		if (body.navbarPath !== undefined) {
			// Path toko = segmen pertama URL situs utama; jangan bentrok dengan route sistem/komunitas
			const p = normalizeStorePath(body.navbarPath);
			const seg = p.slice(1);
			if (!/^[A-Za-z0-9_-]{2,40}$/.test(seg)) {
				return res.status(400).json({
					message: 'Path toko harus satu segmen (huruf, angka, - atau _), mis. /toko',
					error: { code: 'STORE_PATH_INVALID' },
				});
			}
			const { isReservedTenantSlug } = await import('@shared/tenant-paths');
			if (seg.toLowerCase() !== 'toko' && isReservedTenantSlug(seg.toLowerCase())) {
				return res.status(400).json({
					message: `Path /${seg} sudah dipakai halaman sistem`,
					error: { code: 'STORE_PATH_RESERVED' },
				});
			}
			const { Community } = await import('../../db/mongodb');
			const clash = await Community.findOne({
				slug: new RegExp(`^${seg.replace(/[-]/g, '\\-')}$`, 'i'),
			}).lean();
			if (clash) {
				return res.status(400).json({
					message: `Path /${seg} sudah dipakai komunitas`,
					error: { code: 'STORE_PATH_TAKEN' },
				});
			}
			body.navbarPath = p;
		}
		for (const k of allowed) {
			if (body[k] !== undefined) {
				if (k === 'defaultCurrency') {
					update[k] = normalizeStoreCurrency(body[k]);
				} else {
					update[k] = body[k];
				}
			}
		}
		if (body.shipping !== undefined && typeof body.shipping === 'object') {
			const sh = body.shipping as Record<string, unknown>;
			update.shipping = {
				enabled: !!sh.enabled,
				globalOriginVillageCode: String(sh.globalOriginVillageCode || '').trim(),
				defaultWeightGrams: Math.max(1, Math.floor(Number(sh.defaultWeightGrams) || 1000)),
				defaultCouriers: Array.isArray(sh.defaultCouriers) ? sh.defaultCouriers.map((x) => String(x)) : [],
			};
		}
		if (layoutBlocks) update.layoutBlocks = layoutBlocks;

		const doc = await StoreSettings.findOneAndUpdate(
			{ key: 'default' },
			{
				$set: update,
				$setOnInsert: {
					key: 'default',
					...(layoutBlocks ? {} : { layoutBlocks: defaultLayoutBlocks() }),
				},
			},
			{ upsert: true, new: true },
		).lean();
		res.json(doc);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menyimpan pengaturan' });
	}
});

// ── Admin: diskon kampanye ──
router.get('/admin/campaigns', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreDiscountCampaign } = resolveModels(req);
		const list = await StoreDiscountCampaign.find({}).sort({ priority: -1, createdAt: -1 }).lean();
		return res.json(list);
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal memuat campaign' });
	}
});
router.post('/admin/campaigns', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreDiscountCampaign } = resolveModels(req);
		const b = req.body || {};
		const name = String(b.name || '').trim();
		if (!name) return res.status(400).json({ message: 'Nama wajib' });
		const mode = b.mode;
		if (!['recurring_daily_window', 'scheduled_range', 'one_time_flash'].includes(String(mode))) {
			return res.status(400).json({ message: 'Mode tidak valid' });
		}
		const scope = b.scope === 'product' ? 'product' : 'global';
		const pids = Array.isArray(b.productIds) ? b.productIds : [];
		const oids: mongoose.Types.ObjectId[] = [];
		for (const id of pids) {
			if (mongoose.Types.ObjectId.isValid(String(id))) oids.push(new mongoose.Types.ObjectId(String(id)));
		}
		if (scope === 'product' && !oids.length) {
			return res.status(400).json({ message: 'Pilih produk untuk scope produk' });
		}
		const doc = await StoreDiscountCampaign.create({
			name,
			scope,
			productIds: oids,
			mode,
			discountType: b.discountType === 'fixed' ? 'fixed' : 'percent',
			discountValue: Math.max(0, Number(b.discountValue) || 0),
			startAt: b.startAt ? new Date(String(b.startAt)) : null,
			endAt: b.endAt ? new Date(String(b.endAt)) : null,
			dailyStart: String(b.dailyStart || ''),
			dailyEnd: String(b.dailyEnd || ''),
			usageLimit: b.usageLimit != null && b.usageLimit !== '' ? Math.max(0, Math.floor(Number(b.usageLimit))) : null,
			usageCount: 0,
			oneTimeCompleted: false,
			priority: Math.floor(Number(b.priority) || 0),
			isActive: b.isActive !== false,
		});
		return res.status(201).json(doc.toObject());
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal membuat campaign' });
	}
});
router.patch('/admin/campaigns/:id', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreDiscountCampaign } = resolveModels(req);
		const c = await StoreDiscountCampaign.findById(req.params.id);
		if (!c) return res.status(404).json({ message: 'Tidak ditemukan' });
		const b = req.body || {};
		if (b.name !== undefined) c.name = String(b.name).trim();
		if (b.isActive !== undefined) c.isActive = !!b.isActive;
		if (b.mode !== undefined && ['recurring_daily_window', 'scheduled_range', 'one_time_flash'].includes(String(b.mode))) {
			c.mode = b.mode;
		}
		if (b.scope === 'product' || b.scope === 'global') c.scope = b.scope;
		if (b.productIds !== undefined) {
			const pids = Array.isArray(b.productIds) ? b.productIds : [];
			c.productIds = pids
				.map((x: any) => (mongoose.Types.ObjectId.isValid(String(x)) ? new mongoose.Types.ObjectId(String(x)) : null))
				.filter(Boolean) as any;
		}
		if (b.discountType !== undefined) c.discountType = b.discountType === 'fixed' ? 'fixed' : 'percent';
		if (b.discountValue !== undefined) c.discountValue = Math.max(0, Number(b.discountValue) || 0);
		if (b.startAt !== undefined) c.startAt = b.startAt ? new Date(String(b.startAt)) : null;
		if (b.endAt !== undefined) c.endAt = b.endAt ? new Date(String(b.endAt)) : null;
		if (b.dailyStart !== undefined) c.dailyStart = String(b.dailyStart);
		if (b.dailyEnd !== undefined) c.dailyEnd = String(b.dailyEnd);
		if (b.priority !== undefined) c.priority = Math.floor(Number(b.priority) || 0);
		if (b.usageLimit !== undefined) c.usageLimit = b.usageLimit != null && b.usageLimit !== '' ? Math.max(0, Math.floor(Number(b.usageLimit))) : null;
		if (b.oneTimeCompleted !== undefined) c.oneTimeCompleted = !!b.oneTimeCompleted;
		await c.save();
		return res.json(c.toObject());
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal memperbarui campaign' });
	}
});
router.delete('/admin/campaigns/:id', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreDiscountCampaign } = resolveModels(req);
		const r = await StoreDiscountCampaign.findByIdAndDelete(req.params.id);
		if (!r) return res.status(404).json({ message: 'Tidak ditemukan' });
		return res.json({ ok: true });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal hapus' });
	}
});

// ── Admin: bundling ──
router.get('/admin/bundles', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreBundle } = resolveModels(req);
		const list = await StoreBundle.find({})
			.sort({ sortOrder: 1, createdAt: -1 })
			.populate('items.productId', 'name slug published stock')
			.lean();
		return res.json(list);
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal memuat bundling' });
	}
});
router.get('/admin/bundles/:id', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreBundle } = resolveModels(req);
		const b = await StoreBundle.findById(req.params.id).populate('items.productId').lean();
		if (!b) return res.status(404).json({ message: 'Tidak ditemukan' });
		return res.json(b);
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal' });
	}
});
router.post('/admin/bundles', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreBundle, StoreProduct } = resolveModels(req);
		const b = req.body || {};
		const name = String(b.name || '').trim();
		if (!name) return res.status(400).json({ message: 'Nama wajib' });
		let baseSlug = slugify(String(b.slug || name));
		let slug = baseSlug;
		let n = 0;
		while (await StoreBundle.findOne({ slug }).lean()) {
			n += 1;
			slug = `${baseSlug}-${n}`;
		}
		const bundlePrice = Number(b.bundlePrice);
		if (!Number.isFinite(bundlePrice) || bundlePrice < 0) {
			return res.status(400).json({ message: 'Harga bundle tidak valid' });
		}
		const itemsIn = Array.isArray(b.items) ? b.items : [];
		if (!itemsIn.length) return res.status(400).json({ message: 'Pilih isi bundling' });
		const items: { productId: mongoose.Types.ObjectId; qty: number; variantId: string }[] = [];
		for (const row of itemsIn) {
			if (!row || typeof row !== 'object') continue;
			const pid = (row as any).productId;
			const q = Math.max(1, Math.floor(Number((row as any).qty) || 1));
			if (!mongoose.Types.ObjectId.isValid(String(pid))) continue;
			const p = await StoreProduct.findById(pid).lean();
			if (!p) continue;
			if (!p.published) return res.status(400).json({ message: `Produk belum terbit: ${p.name}` });
			const variantId = String((row as any).variantId || '').slice(0, 40);
			if (hasVariants(p) && !findVariant(p, variantId)) {
				return res.status(400).json({ message: `Pilih varian untuk ${p.name} di isi paket` });
			}
			items.push({ productId: p._id as any, qty: q, variantId: hasVariants(p) ? variantId : '' });
		}
		if (!items.length) return res.status(400).json({ message: 'Tidak ada item valid' });
		const maxSort = (await StoreBundle.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean()) as {
			sortOrder?: number;
		} | null;
		const nextSort = typeof maxSort?.sortOrder === 'number' ? maxSort.sortOrder + 1 : Date.now();
		const doc = await StoreBundle.create({
			slug,
			name,
			shortDescription: String(b.shortDescription || '').slice(0, 500),
			bundlePrice,
			items,
			weightGramsOverride: b.weightGramsOverride != null ? Math.max(1, Math.floor(Number(b.weightGramsOverride))) : null,
			isFreeShipping: !!b.isFreeShipping,
			published: !!b.published,
			isActive: b.isActive !== false,
			thumbnail: safeBundleThumb(b.thumbnail),
			sortOrder: nextSort,
			authorId: req.user!._id,
		});
		return res.status(201).json(doc.toObject());
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal membuat bundling' });
	}
});
router.patch('/admin/bundles/:id', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreBundle, StoreProduct } = resolveModels(req);
		const doc = await StoreBundle.findById(req.params.id);
		if (!doc) return res.status(404).json({ message: 'Tidak ditemukan' });
		const b = req.body || {};
		if (b.slug !== undefined) {
			let ns = slugify(String(b.slug));
			const clash = await StoreBundle.findOne({ slug: ns, _id: { $ne: doc._id } }).lean();
			if (clash) return res.status(400).json({ message: 'Slug terpakai' });
			doc.slug = ns;
		}
		if (b.name !== undefined) doc.name = String(b.name).trim();
		if (b.shortDescription !== undefined) doc.shortDescription = String(b.shortDescription).slice(0, 500);
		if (b.bundlePrice !== undefined) {
			const x = Number(b.bundlePrice);
			if (Number.isFinite(x) && x >= 0) doc.bundlePrice = x;
		}
		if (b.items !== undefined) {
			const itemsIn = Array.isArray(b.items) ? b.items : [];
			const items: { productId: mongoose.Types.ObjectId; qty: number; variantId: string }[] = [];
			for (const row of itemsIn) {
				if (!row || typeof row !== 'object') continue;
				const pid = (row as any).productId;
				const q = Math.max(1, Math.floor(Number((row as any).qty) || 1));
				if (!mongoose.Types.ObjectId.isValid(String(pid))) continue;
				const p = await StoreProduct.findById(pid).lean();
				if (!p) continue;
				if (!p.published) return res.status(400).json({ message: `Produk belum terbit: ${p.name}` });
				const variantId = String((row as any).variantId || '').slice(0, 40);
				if (hasVariants(p) && !findVariant(p, variantId)) {
					return res.status(400).json({ message: `Pilih varian untuk ${p.name} di isi paket` });
				}
				items.push({ productId: p._id as any, qty: q, variantId: hasVariants(p) ? variantId : '' });
			}
			if (items.length) doc.items = items as any;
		}
		if (b.thumbnail !== undefined) doc.thumbnail = safeBundleThumb(b.thumbnail);
		if (b.published !== undefined) doc.published = !!b.published;
		if (b.isActive !== undefined) doc.isActive = !!b.isActive;
		if (b.isFreeShipping !== undefined) doc.isFreeShipping = !!b.isFreeShipping;
		if (b.weightGramsOverride !== undefined) {
			doc.weightGramsOverride =
				b.weightGramsOverride != null && b.weightGramsOverride !== ''
					? Math.max(1, Math.floor(Number(b.weightGramsOverride)))
					: null;
		}
		doc.updatedAt = new Date();
		await doc.save();
		return res.json(doc.toObject());
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal memperbarui bundling' });
	}
});
router.delete('/admin/bundles/:id', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreBundle } = resolveModels(req);
		const r = await StoreBundle.findByIdAndDelete(req.params.id);
		if (!r) return res.status(404).json({ message: 'Tidak ditemukan' });
		return res.json({ ok: true });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Gagal hapus' });
	}
});

router.get('/admin/products', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreProduct, StoreProductShare } = resolveModels(req);
		await ensureProductSortOrderBackfill(StoreProduct);
		const perms = await getEffectivePermissions(req);
		const uid = req.user!._id;

		let filter: any = {};
		if (hasPerm(perms, 'toko.manage') || hasPerm(perms, 'toko.view')) {
			filter = {};
		} else {
			const shares = await StoreProductShare.find({ targetUserId: uid }).select('productId').lean();
			const ids = shares.map((s: any) => s.productId);
			if (!ids.length) {
				return res.json({ items: [], total: 0, page: 1, limit: 9 });
			}
			filter = { _id: { $in: ids } };
		}

		const forReorder =
			String(req.query.forReorder || '') === '1' && hasPerm(perms, 'toko.manage');
		const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
		const limit = forReorder
			? 5000
			: Math.min(50, Math.max(1, parseInt(String(req.query.limit || '9'), 10) || 9));
		const skip = forReorder ? 0 : (page - 1) * limit;

		const total = await StoreProduct.countDocuments(filter);
		let q = StoreProduct.find(filter)
			.sort({ sortOrder: 1, createdAt: -1 })
			.populate({ path: 'categoryId', select: 'name slug' });
		if (!forReorder) q = q.skip(skip).limit(limit);
		else q = q.limit(5000);
		const list = await q.lean();
		res.json({
			items: list,
			total,
			page: forReorder ? 1 : page,
			limit: forReorder ? list.length : limit,
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat produk' });
	}
});

router.patch('/admin/products/reorder', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreProduct } = resolveModels(req);
		await ensureProductSortOrderBackfill(StoreProduct);
		const idsIn = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
		const ids = idsIn.map((x: any) => String(x || '').trim()).filter(Boolean);
		if (!ids.length) return res.status(400).json({ message: 'orderedIds wajib' });
		if (!ids.every((id: string) => mongoose.Types.ObjectId.isValid(id))) {
			return res.status(400).json({ message: 'ID produk tidak valid' });
		}
		const found = await StoreProduct.find({ _id: { $in: ids } }).select('_id').lean();
		if (found.length !== ids.length) {
			return res.status(400).json({ message: 'Beberapa produk tidak ditemukan' });
		}
		const bulk = ids.map((id: string, i: number) => ({
			updateOne: {
				filter: { _id: id },
				update: { $set: { sortOrder: i } },
			},
		}));
		await StoreProduct.bulkWrite(bulk);
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menyimpan urutan' });
	}
});

router.get('/admin/products/:id', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreProduct } = resolveModels(req);
		const p = await StoreProduct.findById(req.params.id).populate('categoryId', 'name slug').lean();
		if (!p) return res.status(404).json({ message: 'Produk tidak ditemukan' });
		if (!(await canViewProductAdmin(req, p))) {
			return res.status(403).json({ message: 'Tidak ada akses ke produk ini' });
		}
		res.json(p);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat produk' });
	}
});

router.post('/admin/products', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreProduct, StoreProductCategory } = resolveModels(req);
		const body = req.body || {};
		const name = String(body.name || '').trim();
		if (!name) return res.status(400).json({ message: 'Nama wajib diisi' });

		let baseSlug = slugify(body.slug || name);
		let slug = baseSlug;
		let n = 0;
		while (await StoreProduct.findOne({ slug }).lean()) {
			n += 1;
			slug = `${baseSlug}-${n}`;
		}

		const price = Number(body.price);
		if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: 'Harga tidak valid' });

		const thumbnail = String(body.thumbnail || '').trim();
		if (!thumbnail) return res.status(400).json({ message: 'Thumbnail wajib' });

		const gallery = normalizeStoreGalleryInput(body.gallery);
		const vid = validateVideo(String(body.videoUrl || ''));
		if (!vid.ok) return res.status(400).json({ message: 'Video harus link YouTube, Google Drive, atau URL video publik (.mp4/.webm/.mov)' });

		const priceTiers = normalizePriceTiersInput(body.priceTiers);
		const stock = parseProductStock(body);

		let categoryId: mongoose.Types.ObjectId | null = null;
		if (body.categoryId !== undefined && body.categoryId !== null && String(body.categoryId).trim() !== '') {
			const cid = await resolveCategoryIdForWrite(StoreProductCategory, body.categoryId);
			if (cid == null) return res.status(400).json({ message: 'Kategori tidak valid' });
			categoryId = cid;
		}

		const maxSort = (await StoreProduct.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean()) as {
			sortOrder?: number;
		} | null;
		const nextSortOrder =
			typeof maxSort?.sortOrder === 'number' ? maxSort.sortOrder + 1 : Date.now();

		const po = parsePreOrderFromBody(body);
		const dOv = parseProductDiscountFromBody(body);
		const doc = await StoreProduct.create({
			slug,
			name,
			shortDescription: String(body.shortDescription || '').slice(0, 500),
			descriptionHtml: sanitizeRichHtml(String(body.descriptionHtml || '')),
			price,
			priceTiers,
			stock,
			categoryId,
			currency: normalizeProductCurrencyOverride(body.currency),
			shippingWeightGrams:
				body.shippingWeightGrams != null && body.shippingWeightGrams !== ''
					? Math.max(1, Math.floor(Number(body.shippingWeightGrams)))
					: null,
			originVillageCodeOverride: String(body.originVillageCodeOverride || '').trim(),
			isFreeShipping: !!body.isFreeShipping,
			disableGlobalDiscount: !!body.disableGlobalDiscount,
			discountOverride: dOv || null,
			isPreOrder: po.isPreOrder,
			preOrderOpenAt: po.preOrderOpenAt,
			preOrderCloseAt: po.preOrderCloseAt,
			estimatedReadyAt: po.estimatedReadyAt,
			preOrderDiscountPercent: po.preOrderDiscountPercent,
			preOrderAllowAfterClose: po.preOrderAllowAfterClose,
			preOrderTimeline: po.preOrderTimeline,
			...parseProductPaymentFromBody(body),
			thumbnail,
			thumbnailSource: body.thumbnailSource === 'gdrive' ? 'gdrive' : 'local',
			thumbnailGdriveFileId: String(body.thumbnailGdriveFileId || ''),
			gallery,
			videoUrl: String(body.videoUrl || ''),
			videoType: vid.type,
			whatsappPhoneOverride: String(body.whatsappPhoneOverride || ''),
			whatsappContactNameOverride: String(body.whatsappContactNameOverride || ''),
			whatsappAdmins: normalizeStoreWaAdmins(body.whatsappAdmins),
			variantGroupName: String(body.variantGroupName || '').trim().slice(0, 40),
			variants: normalizeVariantsInput(body.variants),
			buyMessageTemplateOverride: String(body.buyMessageTemplateOverride || ''),
			storeAddressOverride: String(body.storeAddressOverride || ''),
			published: !!body.published,
			sortOrder: nextSortOrder,
			authorId: req.user!._id,
		});
		res.status(201).json(doc.toObject());
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal membuat produk' });
	}
});

router.patch('/admin/products/:id', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreProduct, StoreProductCategory } = resolveModels(req);
		const p = await StoreProduct.findById(req.params.id);
		if (!p) return res.status(404).json({ message: 'Produk tidak ditemukan' });
		if (!(await canEditProduct(req, p))) {
			return res.status(403).json({ message: 'Tidak dapat mengedit produk ini' });
		}

		const body = req.body || {};
		const oldMediaUrls = getProductMediaUrls(p);
		const perms = await getEffectivePermissions(req);
		if (!hasPerm(perms, 'toko.manage')) {
			const allowedFields = new Set([
				'name',
				'shortDescription',
				'descriptionHtml',
				'price',
				'priceTiers',
				'priceTierMultiples',
				'stock',
				'currency',
				'thumbnail',
				'thumbnailSource',
				'thumbnailGdriveFileId',
				'gallery',
				'videoUrl',
				'videoType',
				'whatsappPhoneOverride',
				'whatsappContactNameOverride',
				'whatsappAdmins',
				'variantGroupName',
				'variants',
				'buyMessageTemplateOverride',
				'storeAddressOverride',
				'published',
				'categoryId',
				'shippingWeightGrams',
				'originVillageCodeOverride',
				'isFreeShipping',
				'isPreOrder',
				'preOrderOpenAt',
				'preOrderCloseAt',
				'estimatedReadyAt',
				'preOrderDiscountPercent',
				'preOrderAllowAfterClose',
				'preOrderTimeline',
				...PRODUCT_PAYMENT_KEYS,
			]);
			for (const k of Object.keys(body)) {
				if (!allowedFields.has(k)) delete (body as any)[k];
			}
		}

		if (body.slug !== undefined && hasPerm(perms, 'toko.manage')) {
			const ns = slugify(String(body.slug));
			const clash = await StoreProduct.findOne({ slug: ns, _id: { $ne: p._id } }).lean();
			if (clash) return res.status(400).json({ message: 'Slug sudah dipakai' });
			p.slug = ns;
		}
		if (body.name !== undefined) p.name = String(body.name).trim();
		if (body.shortDescription !== undefined) p.shortDescription = String(body.shortDescription).slice(0, 500);
		if (body.descriptionHtml !== undefined) p.descriptionHtml = sanitizeRichHtml(String(body.descriptionHtml));
		if (body.price !== undefined) {
			const price = Number(body.price);
			if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: 'Harga tidak valid' });
			p.price = price;
		}
		if (body.priceTiers !== undefined) {
			p.priceTiers = normalizePriceTiersInput(body.priceTiers);
		}
		if (body.priceTierMultiples !== undefined) {
			p.priceTierMultiples = !!body.priceTierMultiples;
		}
		if (body.stock !== undefined) {
			p.stock = parseProductStock(body);
		}
		if (body.categoryId !== undefined) {
			const cid = await resolveCategoryIdForWrite(StoreProductCategory, body.categoryId);
			const clearing =
				body.categoryId === null || String(body.categoryId ?? '').trim() === '';
			if (!clearing && cid === null) {
				return res.status(400).json({ message: 'Kategori tidak valid' });
			}
			p.categoryId = cid ?? null;
		}
		if (body.currency !== undefined) p.currency = normalizeProductCurrencyOverride(body.currency);
		if (body.thumbnail !== undefined) p.thumbnail = String(body.thumbnail).trim();
		if (body.thumbnailSource !== undefined) p.thumbnailSource = body.thumbnailSource === 'gdrive' ? 'gdrive' : 'local';
		if (body.thumbnailGdriveFileId !== undefined) p.thumbnailGdriveFileId = String(body.thumbnailGdriveFileId || '');
		if (body.gallery !== undefined) p.gallery = normalizeStoreGalleryInput(body.gallery);
		if (body.videoUrl !== undefined) {
			const vid = validateVideo(String(body.videoUrl));
			if (!vid.ok) return res.status(400).json({ message: 'Video harus link YouTube, Google Drive, atau URL video publik (.mp4/.webm/.mov)' });
			p.videoUrl = String(body.videoUrl);
			p.videoType = vid.type;
		}
		if (body.whatsappPhoneOverride !== undefined) p.whatsappPhoneOverride = String(body.whatsappPhoneOverride || '');
		if (body.whatsappContactNameOverride !== undefined) {
			p.whatsappContactNameOverride = String(body.whatsappContactNameOverride || '');
		}
		if (body.whatsappAdmins !== undefined) {
			p.whatsappAdmins = normalizeStoreWaAdmins(body.whatsappAdmins);
			// override lama digantikan daftar override baru
			p.whatsappPhoneOverride = '';
			p.whatsappContactNameOverride = '';
		}
		if (body.variantGroupName !== undefined) p.variantGroupName = String(body.variantGroupName || '').trim().slice(0, 40);
		if (body.variants !== undefined) p.variants = normalizeVariantsInput(body.variants);
		if (body.buyMessageTemplateOverride !== undefined) {
			p.buyMessageTemplateOverride = String(body.buyMessageTemplateOverride || '');
		}
		if (body.storeAddressOverride !== undefined) p.storeAddressOverride = String(body.storeAddressOverride || '');
		if (body.published !== undefined) p.published = !!body.published;
		if (body.shippingWeightGrams !== undefined) {
			p.shippingWeightGrams =
				body.shippingWeightGrams != null && body.shippingWeightGrams !== ''
					? Math.max(1, Math.floor(Number(body.shippingWeightGrams)))
					: null;
		}
		if (body.originVillageCodeOverride !== undefined) {
			p.originVillageCodeOverride = String(body.originVillageCodeOverride || '').trim();
		}
		if (body.isFreeShipping !== undefined) p.isFreeShipping = !!body.isFreeShipping;
		if (body.disableGlobalDiscount !== undefined) p.disableGlobalDiscount = !!body.disableGlobalDiscount;
		if (body.discountOverride !== undefined) {
			p.discountOverride = parseProductDiscountFromBody({ discountOverride: body.discountOverride });
		}
		const preKeys = new Set([
			'isPreOrder',
			'preOrderOpenAt',
			'preOrderCloseAt',
			'estimatedReadyAt',
			'preOrderDiscountPercent',
			'preOrderAllowAfterClose',
			'preOrderTimeline',
		]);
		if (Object.keys(body).some((k) => preKeys.has(k))) {
			const merged = { ...p.toObject(), ...body };
			const po = parsePreOrderFromBody(merged);
			p.isPreOrder = po.isPreOrder;
			p.preOrderOpenAt = po.preOrderOpenAt;
			p.preOrderCloseAt = po.preOrderCloseAt;
			p.estimatedReadyAt = po.estimatedReadyAt;
			p.preOrderDiscountPercent = po.preOrderDiscountPercent;
			p.preOrderAllowAfterClose = po.preOrderAllowAfterClose;
			p.preOrderTimeline = po.preOrderTimeline;
		}
		if (Object.keys(body).some((k) => PRODUCT_PAYMENT_KEYS.includes(k))) {
			Object.assign(p, parseProductPaymentFromBody({ ...p.toObject(), ...body }));
		}

		p.updatedAt = new Date();
		await p.save();
		await cleanupRemovedStoreMedia(req, oldMediaUrls, getProductMediaUrls(p));
		res.json(p.toObject());
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memperbarui produk' });
	}
});

router.delete('/admin/products/:id', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreProduct, StoreProductShare } = resolveModels(req);
		const old = await StoreProduct.findById(req.params.id).lean();
		await StoreProductShare.deleteMany({ productId: req.params.id });
		const r = await StoreProduct.findByIdAndDelete(req.params.id);
		if (!r) return res.status(404).json({ message: 'Produk tidak ditemukan' });
		if (old) {
			await cleanupRemovedStoreMedia(req, getProductMediaUrls(old), []);
		}
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menghapus produk' });
	}
});

router.get('/admin/products/:id/shares', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreProductShare, User } = resolveModels(req);
		const list = await StoreProductShare.find({ productId: req.params.id })
			.populate('targetUserId', 'name username email')
			.lean();
		res.json(list);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat sharing' });
	}
});

router.post('/admin/products/:id/shares', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreProduct, StoreProductShare, User } = resolveModels(req);
		const product = await StoreProduct.findById(req.params.id);
		if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });

		const targetUsername = String(req.body?.username || '').trim().toLowerCase();
		const accessLevel = req.body?.accessLevel === 'edit' ? 'edit' : 'view';
		if (!targetUsername) return res.status(400).json({ message: 'Username wajib' });

		const user = await User.findOne({ username: targetUsername }).lean();
		if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

		const doc = await StoreProductShare.findOneAndUpdate(
			{ productId: product._id, targetUserId: user._id },
			{
				$set: {
					accessLevel,
					createdBy: req.user!._id,
					updatedAt: new Date(),
				},
			},
			{ upsert: true, new: true },
		).populate('targetUserId', 'name username email');

		res.status(201).json(doc);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menyimpan sharing' });
	}
});

router.delete('/admin/shares/:shareId', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreProductShare } = resolveModels(req);
		await StoreProductShare.findByIdAndDelete(req.params.shareId);
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menghapus sharing' });
	}
});

router.get('/admin/orders', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const list = await StoreOrder.find({}).sort({ createdAt: -1 }).limit(200).lean();
		res.json(list);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat order' });
	}
});

async function restoreOrderStock(StoreProduct: any, order: any) {
	for (const d of order?.stockDecrements || []) {
		if (!d?.productId || !(Number(d.qty) > 0)) continue;
		await giveStock(StoreProduct, d.productId, String(d.variantId || ''), Number(d.qty));
	}
}

async function retakeOrderStock(StoreProduct: any, order: any): Promise<boolean> {
	const done: { productId: any; variantId: string; qty: number }[] = [];
	for (const d of order?.stockDecrements || []) {
		const qty = Number(d?.qty) || 0;
		if (!d?.productId || qty <= 0) continue;
		const vid = String(d.variantId || '');
		const r = await takeStock(StoreProduct, d.productId, vid, qty);
		if (r === 'short') {
			for (const x of done) await giveStock(StoreProduct, x.productId, x.variantId, x.qty);
			return false;
		}
		if (r === 'ok') done.push({ productId: d.productId, variantId: vid, qty });
	}
	return true;
}

const STORE_ORDER_STATUSES = ['pending', 'confirmed', 'preorder', 'paid', 'shipped', 'completed', 'cancelled'] as const;
const STORE_PAYMENT_METHODS = ['', 'transfer', 'qris', 'cash', 'ewallet'];

router.patch('/admin/orders/:orderNo', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const orderNo = String(req.params.orderNo || '').trim();
		const body = (req.body || {}) as Record<string, unknown>;
		if (!orderNo) return res.status(400).json({ message: 'Nomor pesanan wajib' });
		const { StoreProduct } = resolveModels(req);
		const current: any = await StoreOrder.findOne({ orderNo }).lean();
		if (!current) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		// Status opsional: admin juga bisa hanya mengubah metode bayar / tanggal bayar / catatan
		const status = body.status === undefined ? current.status : String(body.status || '').trim();
		if (!STORE_ORDER_STATUSES.includes(status as any)) {
			return res.status(400).json({ message: 'Status tidak valid' });
		}
		const set: Record<string, unknown> = { status, updatedAt: new Date() };
		if (body.paymentMethod !== undefined) {
			const pm = String(body.paymentMethod || '');
			if (!STORE_PAYMENT_METHODS.includes(pm)) return res.status(400).json({ message: 'Metode bayar tidak valid' });
			set.paymentMethod = pm;
		}
		if (body.paidAt !== undefined) {
			const d = body.paidAt ? new Date(String(body.paidAt)) : null;
			if (d && Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Tanggal bayar tidak valid' });
			set.paidAt = d;
		}
		if (body.adminNote !== undefined) set.adminNote = String(body.adminNote || '').slice(0, 1000);
		// Dana dikembalikan (kebijakan tim) / tandai permintaan batal sudah ditangani
		if (body.paymentStatus === 'refunded') set.paymentStatus = 'refunded';
		if (body.clearCancelRequest === true) {
			set.cancelRequestedAt = null;
			set.cancelRequestReason = '';
		}
		// Tanggal bayar otomatis saat pertama kali ditandai Dibayar
		if (['paid', 'shipped', 'completed'].includes(status) && !current.paidAt && set.paidAt === undefined) {
			set.paidAt = new Date();
		}
		if (status === 'cancelled' && current.status !== 'cancelled') {
			// Dibatalkan/ditolak → stok dikembalikan (sekali saja)
			if (!current.stockRestoredAt) {
				await restoreOrderStock(StoreProduct, current);
				set.stockRestoredAt = new Date();
			}
		} else if (status !== 'cancelled' && current.status === 'cancelled' && current.stockRestoredAt) {
			// Dibuka lagi → ambil stok lagi; gagal bila stok sudah tidak cukup
			const ok = await retakeOrderStock(StoreProduct, current);
			if (!ok) return res.status(400).json({ message: 'Stok tidak mencukupi untuk membuka kembali pesanan' });
			set.stockRestoredAt = null;
		}
		const order = await StoreOrder.findOneAndUpdate({ orderNo }, { $set: set }, { new: true }).lean();
		queueSheetSync(req, orderNo, { stock: status === 'cancelled' || current.status === 'cancelled' });
		res.json(order);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memperbarui pesanan' });
	}
});

// ── Pembayaran: bukti bayar, verifikasi admin, pembatalan (shared/store-payment.ts) ──

/** Pesanan milik pembeli: token invoice (?inv= / body.inv) atau cookie sesi yang sama. */
async function findOwnedOrder(req: Request, res: Response, orderNo: string): Promise<any | null> {
	const { StoreOrder } = resolveModels(req);
	const inv = String(req.query.inv || (req.body as any)?.inv || '').trim();
	if (inv.length >= 32) {
		const o = await StoreOrder.findOne({ orderNo, invoiceAccessToken: inv });
		if (o) return o;
	}
	const { sessionKeyHash } = await getOrCreateGuestSession(req, res);
	return StoreOrder.findOne({ orderNo, guestSessionKeyHash: sessionKeyHash });
}

/** Terapkan status bayar hasil hitung ulang + status pesanan otomatis (tidak pernah memundurkan status). */
function applyDerivedPayment(order: any) {
	const st = derivePaymentState(order);
	order.amountPaid = st.amountPaid;
	order.balanceDue = st.balanceDue;
	if (order.paymentStatus !== 'refunded') order.paymentStatus = st.paymentStatus;
	const early = ['pending', 'confirmed'].includes(order.status);
	if (st.paymentStatus === 'paid') {
		if (!order.paidAt) order.paidAt = new Date();
		if (early || (order.status === 'preorder' && !order.hasPreOrderItems)) {
			order.status = order.hasPreOrderItems ? 'preorder' : 'paid';
		}
	} else if (st.paymentStatus === 'dp_verified' || st.paymentStatus === 'balance_awaiting_verification') {
		if (early) order.status = 'preorder';
	}
	return st;
}

const PROOF_MAX_PER_KIND = 5;

router.post('/orders/:orderNo/payment-proof', storeProofUploadRateLimiter, (req, res) => {
	paymentProofUploadMiddleware.single('image')(req, res, async (err: any) => {
		try {
			if (err) {
				const tooBig = err?.code === 'LIMIT_FILE_SIZE';
				return res.status(400).json({ message: tooBig ? 'Ukuran gambar maksimal 5 MB' : 'Upload gagal' });
			}
			const orderNo = String(req.params.orderNo || '').trim();
			const order = await findOwnedOrder(req, res, orderNo);
			if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
			if (order.status === 'cancelled') return res.status(400).json({ message: 'Pesanan sudah dibatalkan' });
			if (!req.file) return res.status(400).json({ message: 'Pilih foto bukti bayar' });

			const st = derivePaymentState(order);
			if (!st.nextKind) {
				return res.status(409).json({
					message: st.paymentStatus === 'paid' ? 'Pesanan sudah lunas' : 'Bukti sebelumnya masih menunggu verifikasi admin',
				});
			}
			const sameKind = (order.payments || []).filter((p: any) => p.kind === st.nextKind).length;
			if (sameKind >= PROOF_MAX_PER_KIND) {
				return res.status(429).json({ message: 'Batas upload bukti tercapai. Hubungi admin lewat WhatsApp.' });
			}
			const snap: any[] = order.paymentChannelsSnapshot || [];
			const channelId = String((req.body as any)?.channelId || '');
			if (channelId && !snap.some((c) => c.id === channelId)) {
				return res.status(400).json({ message: 'Metode bayar tidak valid' });
			}

			let image: Buffer;
			try {
				image = await processStorePaymentProof(req.file);
			} catch {
				return res.status(400).json({ message: 'File harus berupa gambar (JPG/PNG/WebP/HEIC)' });
			}
			const paymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
			const { StorePaymentProof } = resolveModels(req);
			await StorePaymentProof.create({ orderNo, paymentId, mimeType: 'image/webp', size: image.length, data: image });
			order.payments.push({
				id: paymentId,
				kind: st.nextKind,
				amount: amountForKind(order, st.nextKind, st.amountPaid),
				proofUrl: `db:${paymentId}`,
				method: 'proof',
				channelId,
				uploadedAt: new Date(),
				status: 'submitted',
			});
			applyDerivedPayment(order);
			order.updatedAt = new Date();
			await order.save();
			queueSheetSync(req, orderNo);
			notifyStoreAdmins(req, 'store_order', {
				title: `Bukti bayar ${orderNo}`,
				description: `${order.customerName} mengirim bukti ${st.nextKind === 'dp' ? 'DP' : st.nextKind === 'balance' ? 'pelunasan' : 'pembayaran'} — cek & verifikasi`,
				actionUrl: '/dashboard/toko?tab=orders',
				tag: 'toko',
			});
			res.json(stripInvoiceTokenFromOrder(order.toObject()));
		} catch (e) {
			console.error(e);
			res.status(500).json({ message: 'Gagal mengirim bukti bayar' });
		}
	});
});

async function sendProofFile(req: Request, res: Response, order: any) {
	const paymentId = String(req.params.paymentId || '');
	const pay = (order?.payments || []).find((p: any) => p.id === paymentId);
	if (!pay?.proofUrl) return res.status(404).json({ message: 'Bukti tidak ditemukan' });
	const { StorePaymentProof } = resolveModels(req);
	const doc: any = await StorePaymentProof.findOne({ orderNo: order.orderNo, paymentId }).lean();
	if (!doc?.data) return res.status(404).json({ message: 'Bukti tidak ditemukan' });
	res.set('Cache-Control', 'private, no-store');
	res.set('X-Content-Type-Options', 'nosniff');
	res.set('Content-Disposition', `inline; filename="bukti-${order.orderNo}-${paymentId}.webp"`);
	const buf = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data.buffer || doc.data);
	return res.type('image/webp').send(buf);
}

router.get('/orders/:orderNo/payment-proof/:paymentId', async (req, res) => {
	try {
		const order = await findOwnedOrder(req, res, String(req.params.orderNo || '').trim());
		if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		return sendProofFile(req, res, order);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat bukti' });
	}
});

router.get('/admin/orders/:orderNo/payment-proof/:paymentId', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const order = await StoreOrder.findOne({ orderNo: String(req.params.orderNo || '').trim() }).lean();
		if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		return sendProofFile(req, res, order);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat bukti' });
	}
});

/**
 * Pembeli membatalkan: belum ada pembayaran → batal langsung (stok kembali).
 * Sudah ada bukti/pembayaran → hanya menjadi permintaan pembatalan ke admin (kebijakan tim).
 */
router.post('/orders/:orderNo/cancel', storeOrderActionRateLimiter, async (req, res) => {
	try {
		const { StoreProduct } = resolveModels(req);
		const orderNo = String(req.params.orderNo || '').trim();
		const order = await findOwnedOrder(req, res, orderNo);
		if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		if (order.status === 'cancelled') return res.status(400).json({ message: 'Pesanan sudah dibatalkan' });
		const reason = String((req.body as any)?.reason || '').trim().slice(0, 300);
		const hasPayment = (order.payments || []).some((p: any) => p.status !== 'rejected');
		const canSelfCancel = !hasPayment && ['pending', 'confirmed'].includes(order.status);
		if (canSelfCancel) {
			order.status = 'cancelled';
			if (!order.stockRestoredAt) {
				await restoreOrderStock(StoreProduct, order);
				order.stockRestoredAt = new Date();
			}
			order.adminNote = `${order.adminNote ? `${order.adminNote}\n` : ''}Dibatalkan pembeli${reason ? `: ${reason}` : ''}`.slice(0, 1000);
			await order.save();
			queueSheetSync(req, orderNo, { stock: true });
			notifyStoreAdmins(req, 'store_order', {
				title: `Pesanan ${orderNo} dibatalkan pembeli`,
				description: reason || `${order.customerName} membatalkan sebelum membayar`,
				actionUrl: '/dashboard/toko?tab=orders',
				tag: 'toko',
			});
			return res.json({ cancelled: true, order: stripInvoiceTokenFromOrder(order.toObject()) });
		}
		if (order.cancelRequestedAt) return res.status(409).json({ message: 'Permintaan pembatalan sudah dikirim ke admin' });
		order.cancelRequestedAt = new Date();
		order.cancelRequestReason = reason;
		await order.save();
		notifyStoreAdmins(req, 'store_order', {
			title: `Permintaan batal ${orderNo}`,
			description: `${order.customerName} (${order.customerPhone}) minta pembatalan${reason ? `: ${reason}` : ''} — pesanan sudah ada pembayaran`,
			actionUrl: '/dashboard/toko?tab=orders',
			tag: 'toko',
		});
		return res.json({ cancelled: false, requested: true, order: stripInvoiceTokenFromOrder(order.toObject()) });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memproses pembatalan' });
	}
});

/** Admin: verifikasi / tolak bukti bayar. */
router.patch('/admin/orders/:orderNo/payments/:paymentId', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const orderNo = String(req.params.orderNo || '').trim();
		const order: any = await StoreOrder.findOne({ orderNo });
		if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		const pay = (order.payments || []).find((p: any) => p.id === String(req.params.paymentId || ''));
		if (!pay) return res.status(404).json({ message: 'Pembayaran tidak ditemukan' });
		const action = String(req.body?.action || '');
		const who = String((req.user as any)?.name || (req.user as any)?.username || 'admin');
		if (action === 'verify') {
			// Admin boleh mengoreksi nominal sesuai uang yang benar-benar masuk
			if (req.body?.amount !== undefined) {
				const amt = Math.round(Number(req.body.amount));
				if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'Nominal tidak valid' });
				pay.amount = amt;
			}
			pay.status = 'verified';
			pay.rejectReason = '';
		} else if (action === 'reject') {
			const reason = String(req.body?.reason || '').trim().slice(0, 300);
			if (!reason) return res.status(400).json({ message: 'Alasan penolakan wajib diisi' });
			pay.status = 'rejected';
			pay.rejectReason = reason;
		} else {
			return res.status(400).json({ message: 'Aksi tidak valid' });
		}
		pay.verifiedBy = who;
		pay.verifiedAt = new Date();
		const stamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
		order.adminNote = `${order.adminNote ? `${order.adminNote}\n` : ''}[${stamp}] ${who}: ${action === 'verify' ? 'verifikasi' : 'tolak'} ${pay.kind} ${formatStoreMoney(pay.amount, 'IDR')}${pay.rejectReason ? ` — ${pay.rejectReason}` : ''}`.slice(-1000);
		order.markModified('payments');
		applyDerivedPayment(order);
		await order.save();
		queueSheetSync(req, orderNo);
		res.json(order.toObject());
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memperbarui pembayaran' });
	}
});

/** Admin: catat pembayaran manual (tunai / transfer yang dikonfirmasi di luar web) — langsung terverifikasi. */
router.post('/admin/orders/:orderNo/payments', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const orderNo = String(req.params.orderNo || '').trim();
		const order: any = await StoreOrder.findOne({ orderNo });
		if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		const amount = Math.round(Number(req.body?.amount));
		if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Nominal tidak valid' });
		const st = derivePaymentState(order);
		const kind = ['dp', 'full', 'balance'].includes(req.body?.kind) ? req.body.kind : st.nextKind || 'balance';
		const who = String((req.user as any)?.name || (req.user as any)?.username || 'admin');
		order.payments.push({
			id: `pay_${crypto.randomBytes(6).toString('hex')}`,
			kind,
			amount,
			proofUrl: '',
			method: 'manual',
			channelId: String(req.body?.channelId || '').slice(0, 40),
			uploadedAt: new Date(),
			status: 'verified',
			rejectReason: String(req.body?.note || '').slice(0, 300),
			verifiedBy: who,
			verifiedAt: new Date(),
		});
		applyDerivedPayment(order);
		await order.save();
		queueSheetSync(req, orderNo);
		res.json(order.toObject());
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal mencatat pembayaran' });
	}
});

/** Admin: daftar pesanan berisi item pre-order (riwayat PO, status DP/lunas, kontak). */
router.get('/admin/preorders', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const filter: Record<string, unknown> = { hasPreOrderItems: true };
		const ps = String(req.query.paymentStatus || '');
		if (ps && (STORE_PAYMENT_STATUSES as readonly string[]).includes(ps)) filter.paymentStatus = ps;
		if (req.query.overdue === '1') {
			filter.settleBy = { $lt: new Date() };
			filter.paymentStatus = { $nin: ['paid', 'refunded'] };
		}
		if (req.query.includeCancelled !== '1') filter.status = { $ne: 'cancelled' };
		const list = await StoreOrder.find(filter).sort({ createdAt: -1 }).limit(500).lean();
		res.json(list.map((o: any) => stripInvoiceTokenFromOrder(o)));
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat pre-order' });
	}
});

// ── Sinkron Google Sheet (cermin database) ──

/**
 * Kolom pembayaran untuk Excel/Sheet. Pesanan lama (sebelum fitur pembayaran) tidak punya
 * riwayat bayar: status Dibayar/Dikirim/Selesai dianggap lunas.
 */
function paymentExportFields(o: any) {
	const legacyPaid = !(o.payments || []).length && ['paid', 'shipped', 'completed'].includes(o.status);
	const total = Number(o.total) || 0;
	const snap: any[] = o.paymentChannelsSnapshot || [];
	const usedIds = new Set((o.payments || []).filter((p: any) => p.status === 'verified').map((p: any) => p.channelId));
	const used = snap.filter((c) => usedIds.has(c.id));
	return {
		paymentPlan: o.paymentPlan || 'full',
		channelTitle: (used.length ? used : snap).map((c) => channelTitle(c)).join(', '),
		dpAmount: Number(o.dpAmount) || 0,
		amountPaid: legacyPaid ? total : Number(o.amountPaid) || 0,
		balanceDue: legacyPaid ? 0 : o.balanceDue != null ? Number(o.balanceDue) : total,
		paymentStatus: legacyPaid ? 'paid' : o.paymentStatus || 'unpaid',
		settleBy: o.settleBy || null,
		hasPreOrderItems: !!o.hasPreOrderItems,
	};
}

function sheetOrderFrom(req: Request, o: any, settings: any) {
	const base = publicBaseUrl(req);
	const storePath = normalizeStorePath(settings?.navbarPath);
	return {
		orderNo: o.orderNo,
		createdAt: o.createdAt,
		customerName: o.customerName,
		customerPhone: o.customerPhone,
		fulfillment: o.fulfillment,
		shippingAddress: o.shippingAddress,
		whatsappAdminName: o.whatsappAdminName,
		shippingCost: o.shippingCost,
		taxAmount: o.taxAmount,
		status: o.status,
		paymentMethod: o.paymentMethod,
		paidAt: o.paidAt,
		adminNote: o.adminNote,
		invoiceUrl: `${base}${storePath}/order/${encodeURIComponent(o.orderNo)}?inv=${encodeURIComponent(o.invoiceAccessToken || '')}`,
		...paymentExportFields(o),
		items: (o.items || []).map((it: any) => ({
			name: it.name,
			variantLabel: it.variantLabel || '',
			qty: it.qty,
			unitPrice: it.unitPrice,
		})),
	};
}

async function stockRowsFor(req: Request) {
	const { StoreProduct } = resolveModels(req);
	const products: any[] = await StoreProduct.find({}).select('name stock variants').sort({ name: 1 }).lean();
	return products.flatMap((p) => {
		const vs = activeVariants(p);
		if (vs.length) {
			return vs.map((v) => ({ product: `${p.name} (${v.label})`, stock: isStoreStockUnlimited(v.stock) ? null : Number(v.stock) }));
		}
		return [{ product: p.name, stock: isStoreStockUnlimited(p.stock) ? null : Number(p.stock) }];
	});
}

/** Kirim pesanan (+ stok terbaru) ke Google Sheet bila diatur. Tidak pernah menghambat respons. */
function queueSheetSync(req: Request, orderNo: string, opts: { stock?: boolean } = {}) {
	void (async () => {
		try {
			const settings: any = await ensureSettings(req);
			const sheetId = String(settings?.googleSheetId || '');
			if (!sheetId || settings?.googleSheetSyncEnabled === false) return;
			const { StoreOrder } = resolveModels(req);
			const o: any = await StoreOrder.findOne({ orderNo }).lean();
			const { syncOrderToSheet, syncStockToSheet } = await import('../services/store-sheet-sync');
			if (o) await syncOrderToSheet(sheetId, sheetOrderFrom(req, o, settings));
			if (opts.stock) await syncStockToSheet(sheetId, await stockRowsFor(req));
		} catch (e) {
			console.error('queueSheetSync:', e);
		}
	})();
}

/** Tulis ulang semua pesanan + stok ke Google Sheet (route resync & skrip ops). count -1 = sheet belum diatur. */
async function resyncStoreSheet(req: any): Promise<{ ok: boolean; count: number; message?: string }> {
	const settings: any = await ensureSettings(req);
	const id = String(settings?.googleSheetId || '');
	if (!id) return { ok: false, count: -1, message: 'Google Sheet belum diatur' };
	const { StoreOrder } = resolveModels(req);
	const { syncOrderToSheet, syncStockToSheet, getSheetSyncStatus } = await import('../services/store-sheet-sync');
	const orders: any[] = await StoreOrder.find({}).sort({ createdAt: 1 }).limit(5000).lean();
	for (const o of orders) await syncOrderToSheet(id, sheetOrderFrom(req, o, settings));
	await syncStockToSheet(id, await stockRowsFor(req));
	const st = getSheetSyncStatus(id);
	if (st.lastError && (!st.lastOkAt || st.lastErrorAt! > st.lastOkAt)) return { ok: false, count: orders.length, message: st.lastError };
	return { ok: true, count: orders.length };
}

export async function resyncStoreSheetForSite(ctx: { tenantModels?: any; tenantDbName?: string; tenantSlug?: string; host?: string } = {}) {
	const req: any = {
		tenantModels: ctx.tenantModels,
		isTenantRequest: !!ctx.tenantModels,
		tenantDbName: ctx.tenantDbName,
		tenantSlug: ctx.tenantSlug || '',
		protocol: 'https',
		headers: { host: ctx.host || 'himatif-encoder.com' },
		get(h: string) { return h.toLowerCase() === 'host' ? ctx.host || 'himatif-encoder.com' : undefined; },
	};
	return resyncStoreSheet(req);
}

router.get('/admin/sheet-sync', authenticate, requireTokoManage, async (req, res) => {
	const settings: any = await ensureSettings(req);
	const id = String(settings?.googleSheetId || '');
	const { getSheetSyncStatus } = await import('../services/store-sheet-sync');
	res.json({
		googleSheetId: id,
		enabled: !!id && settings?.googleSheetSyncEnabled !== false,
		status: id ? getSheetSyncStatus(id) : null,
	});
});

router.post('/admin/sheet-sync/test', authenticate, requireTokoManage, async (req, res) => {
	const { extractSpreadsheetId, testSheetAccess } = await import('../services/store-sheet-sync');
	const settings: any = await ensureSettings(req);
	const id = extractSpreadsheetId(req.body?.googleSheetId || settings?.googleSheetId);
	if (!id) return res.status(400).json({ message: 'Link / ID Google Sheet tidak valid' });
	const r = await testSheetAccess(id);
	res.status(r.ok ? 200 : 400).json(r);
});

/** Tulis ulang semua pesanan + stok ke sheet (dipakai pertama kali / bila sempat gagal). */
router.post('/admin/sheet-sync/resync', authenticate, requireTokoManage, async (req, res) => {
	try {
		const r = await resyncStoreSheet(req);
		if (!r.ok) return res.status(r.count < 0 ? 400 : 502).json({ message: r.message, count: Math.max(0, r.count) });
		res.json({ ok: true, count: r.count });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Sinkron ulang gagal' });
	}
});

/**
 * Export rekap pesanan ke Excel (format template Rekap Toko).
 * Query: from, to (YYYY-MM-DD, WIB, inklusif), status (kode status, opsional).
 */
router.get('/admin/orders/export.xlsx', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreOrder, StoreProduct } = resolveModels(req);
		const settings: any = await ensureSettings(req);
		const filter: any = {};
		const from = String(req.query.from || '').trim();
		const to = String(req.query.to || '').trim();
		const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
		if (from || to) {
			filter.createdAt = {};
			if (isDate(from)) filter.createdAt.$gte = new Date(`${from}T00:00:00+07:00`);
			if (isDate(to)) filter.createdAt.$lte = new Date(`${to}T23:59:59.999+07:00`);
		}
		const status = String(req.query.status || '').trim();
		if (status && STORE_ORDER_STATUSES.includes(status as any)) filter.status = status;
		const orders: any[] = await StoreOrder.find(filter).sort({ createdAt: 1 }).limit(5000).lean();
		const base = publicBaseUrl(req);
		const storePath = normalizeStorePath(settings?.navbarPath);
		const products: any[] = await StoreProduct.find({}).select('name stock variants').sort({ name: 1 }).lean();
		const stock = products.flatMap((p) => {
			const vs = activeVariants(p);
			if (vs.length) {
				return vs.map((v) => ({ product: `${p.name} (${v.label})`, stock: isStoreStockUnlimited(v.stock) ? null : Number(v.stock) }));
			}
			return [{ product: p.name, stock: isStoreStockUnlimited(p.stock) ? null : Number(p.stock) }];
		});
		const { buildStoreRecapWorkbook } = await import('../services/store-order-export');
		const periodLabel =
			from || to ? `${from || 'awal'} s/d ${to || 'sekarang'}${status ? ` · status ${status}` : ''}` : `Semua pesanan${status ? ` · status ${status}` : ''}`;
		const buf = await buildStoreRecapWorkbook({
			storeName: String(settings?.navbarLabel || 'Toko'),
			periodLabel,
			orders: orders.map((o) => ({
				orderNo: o.orderNo,
				createdAt: o.createdAt,
				customerName: o.customerName,
				customerPhone: o.customerPhone,
				fulfillment: o.fulfillment,
				shippingAddress: o.shippingAddress,
				whatsappAdminName: o.whatsappAdminName,
				shippingCost: o.shippingCost,
				taxAmount: o.taxAmount,
				total: o.total,
				status: o.status,
				paymentMethod: o.paymentMethod,
				paidAt: o.paidAt,
				adminNote: o.adminNote,
				invoiceUrl: `${base}${storePath}/order/${encodeURIComponent(o.orderNo)}?inv=${encodeURIComponent(o.invoiceAccessToken || '')}`,
				...paymentExportFields(o),
				items: (o.items || []).map((it: any) => ({
					name: it.name,
					variantLabel: it.variantLabel || '',
					qty: it.qty,
					unitPrice: it.unitPrice,
					lineSubtotal: it.lineSubtotal,
				})),
			})),
			stock,
		});
		const stamp = new Date().toISOString().slice(0, 10);
		res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		res.setHeader('Content-Disposition', `attachment; filename="rekap-toko-${stamp}.xlsx"`);
		res.setHeader('Cache-Control', 'no-store');
		res.send(buf);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal membuat file Excel' });
	}
});

router.delete('/admin/orders/:orderNo', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const orderNo = String(req.params.orderNo || '').trim();
		if (!orderNo) return res.status(400).json({ message: 'Nomor pesanan wajib' });
		const { StoreProduct } = resolveModels(req);
		const existing: any = await StoreOrder.findOne({ orderNo }).lean();
		if (!existing) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		// Hapus pesanan yang belum selesai/dibatalkan → kembalikan stoknya
		if (!existing.stockRestoredAt && !['completed', 'cancelled'].includes(existing.status)) {
			await restoreOrderStock(StoreProduct, existing);
		}
		const r = await StoreOrder.deleteOne({ orderNo });
		await resolveModels(req).StorePaymentProof.deleteMany({ orderNo });
		if (r.deletedCount !== 1) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menghapus pesanan' });
	}
});

router.delete('/admin/orders', authenticate, requireTokoManage, async (req, res) => {
	try {
		const confirm = (req.body as any)?.confirm === true || String(req.query.confirm) === 'true';
		if (!confirm) {
			return res.status(400).json({ message: 'Konfirmasi wajib: kirim { "confirm": true }' });
		}
		const { StoreOrder } = resolveModels(req);
		const r = await StoreOrder.deleteMany({});
		res.json({ ok: true, deletedCount: r.deletedCount ?? 0 });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menghapus semua pesanan' });
	}
});

// ── Cart (guest) ──

router.get('/cart', async (req, res) => {
	try {
		const { GuestStoreSession, StoreProduct, StoreBundle } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const settings: any = await ensureSettings(req);
		const defCur = normalizeStoreCurrency(settings?.defaultCurrency);
		const now = new Date();
		const campaigns = await listActiveCampaigns(req);
		const items: any[] = [];
		for (const row of doc.cartItems || []) {
			const qty = Math.max(1, Math.floor(Number(row.qty) || 1));
			const lineKind = row.lineKind === 'bundle' || row.bundleId ? 'bundle' : 'product';
			if (lineKind === 'bundle') {
				const b = await StoreBundle.findById(row.bundleId || null).lean();
				if (!b || !b.published || !b.isActive) continue;
				const cur = defCur;
				const pr = computeDiscountedBundleSubtotal(String(b._id), b.bundlePrice, qty, campaigns, now);
				const unitPrice = pr.lineSubtotal / qty;
				items.push({
					lineKind: 'bundle',
					lineKey: ensureCartLineKey({ ...row, lineKind: 'bundle', bundleId: b._id }),
					bundleId: String(b._id),
					slug: b.slug,
					name: b.name,
					price: unitPrice,
					unitPrice,
					lineSubtotal: pr.lineSubtotal,
					compareSubtotal: pr.compareSubtotal,
					promoApplied: pr.applied,
					currency: cur,
					thumbnail: b.thumbnail || '',
					qty,
					stockAvailable: await maxBundleQty(req, b, now),
					components: (await describeBundle(req, b, now)).components,
				});
			} else {
				const p0 = await StoreProduct.findById(row.productId).lean();
				if (!p0 || !p0.published) continue;
				const variant = findVariant(p0, row.variantId);
				// Varian dihapus/nonaktif → baris disembunyikan (pembeli memilih ulang)
				if (hasVariants(p0) && !variant) continue;
				const p = productAsVariant(p0 as any, variant);
				if (!isPreOrderOrderable(p, now)) continue;
				const cur = effectiveProductCurrency(p, defCur);
				const pr = computeDiscountedSubtotal(p as any, qty, campaigns, now);
				const unitPrice = pr.lineSubtotal / qty;
				items.push({
					lineKind: 'product',
					lineKey: variantLineKey(p._id, variant?.id),
					productId: String(p._id),
					variantId: variant?.id || '',
					variantLabel: variant?.label || '',
					slug: p.slug,
					name: p.name,
					price: unitPrice,
					unitPrice,
					lineSubtotal: pr.lineSubtotal,
					compareSubtotal: pr.compareSubtotal,
					promoApplied: pr.applied,
					currency: cur,
					thumbnail: variant?.thumbnail || p.thumbnail,
					qty,
					stockAvailable: maxProductOrderQty(p, now),
					isPreOrder: !!p.isPreOrder,
					preOrder: p.isPreOrder
						? { estimatedReadyAt: p.estimatedReadyAt, timeline: p.preOrderTimeline }
						: null,
				});
			}
		}
		const subtotal = items.reduce((s, it) => s + (it.lineSubtotal ?? 0), 0);
		const taxPercent = settings?.taxEnabled ? Number(settings.taxPercent || 0) : 0;
		const taxAmount = settings?.taxEnabled ? Math.round((subtotal * taxPercent) / 100) : 0;
		const cartCurrency = items.length ? items[0].currency : defCur;
		res.json({
			items,
			subtotal,
			currency: cartCurrency,
			defaultCurrency: defCur,
			taxPercent,
			taxEnabled: !!settings?.taxEnabled,
			taxAmount,
			total: subtotal + taxAmount,
			checkoutDraft: doc.checkoutDraft || {},
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat keranjang' });
	}
});

router.post('/cart/items', storeCartRateLimiter, async (req, res) => {
	try {
		const { GuestStoreSession, StoreProduct } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const productId = req.body?.productId;
		const qty = Math.max(1, parseInt(String(req.body?.qty || '1'), 10) || 1);
		const p0 = await StoreProduct.findById(productId).lean();
		if (!p0 || !p0.published) return res.status(400).json({ message: 'Produk tidak tersedia' });
		const variant = findVariant(p0, req.body?.variantId);
		if (hasVariants(p0) && !variant) {
			return res.status(400).json({ message: 'Pilih varian dulu', error: { code: 'VARIANT_REQUIRED' } });
		}
		const vid = variant?.id || '';
		const p = productAsVariant(p0 as any, variant);
		const now = new Date();
		if (!isPreOrderOrderable(p, now)) {
			return res.status(400).json({ message: 'Produk tidak tersedia untuk dipesan' });
		}

		const settings: any = await ensureSettings(req);
		const defCur = normalizeStoreCurrency(settings?.defaultCurrency);
		const newCur = effectiveProductCurrency(p, defCur);
		const cart = doc.cartItems || [];
		{
			// Produk satuan & bundling boleh dicampur; mata uang dicocokkan dengan produk satuan pertama
			const r0 = cart.find((c: any) => !(c.lineKind === 'bundle' || c.bundleId) && c.productId);
			const first = r0 ? await StoreProduct.findById(r0.productId).lean() : null;
			if (first) {
				const firstCur = effectiveProductCurrency(first, defCur);
				if (firstCur !== newCur) {
					return res.status(400).json({
						message:
							'Keranjang memakai mata uang lain. Kosongkan keranjang dulu atau selesaikan pesanan sebelum menambah produk ini.',
					});
				}
			}
		}

		const idx = cart.findIndex(
			(c: any) =>
				!c.bundleId &&
				c.lineKind !== 'bundle' &&
				String(c.productId) === String(productId) &&
				String(c.variantId || '') === vid,
		);
		const mergedQty = idx >= 0 ? cart[idx].qty + qty : qty;
		const cap = maxProductOrderQty(p, now);
		const nextQty = Math.max(1, Math.min(mergedQty, cap));
		if (nextQty < mergedQty) {
			return res.status(400).json({ message: `Jumlah maksimum yang bisa dipesan: ${cap}` });
		}
		if (idx >= 0) {
			cart[idx].lineKind = 'product';
			cart[idx].productId = p._id;
			(cart[idx] as any).bundleId = null;
			cart[idx].qty = nextQty;
			(cart[idx] as any).variantId = vid;
			(cart[idx] as any).lineKey = variantLineKey(p._id, vid);
		} else {
			cart.push({
				lineKind: 'product',
				productId: p._id,
				bundleId: null,
				variantId: vid,
				qty: nextQty,
				lineKey: variantLineKey(p._id, vid),
			} as any);
		}

		doc.cartItems = cart;
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menambah ke keranjang' });
	}
});

router.post('/cart/bundles', storeCartRateLimiter, async (req, res) => {
	try {
		const { GuestStoreSession, StoreBundle, StoreProduct } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const bid = req.body?.bundleId;
		const qty = Math.max(1, parseInt(String(req.body?.qty || '1'), 10) || 1);
		const b = await StoreBundle.findById(bid).lean();
		if (!b || !b.published || !b.isActive) {
			return res.status(400).json({ message: 'Bundling tidak tersedia' });
		}
		const now = new Date();
		const settings: any = await ensureSettings(req);
		const defCur = normalizeStoreCurrency(settings?.defaultCurrency);
		const cart = doc.cartItems || [];
		for (const it of b.items || []) {
			const p = await StoreProduct.findById(it.productId).lean();
			const problem = bundleItemProblem(p, String(it.variantId || ''));
			if (problem) return res.status(400).json({ message: problem, error: { code: 'BUNDLE_INVALID' } });
		}
		const cap = await maxBundleQty(req, b, now);
		if (cap < 1) {
			return res.status(400).json({ message: 'Stok isi bundling habis', error: { code: 'BUNDLE_OUT_OF_STOCK' } });
		}
		const idx = cart.findIndex((c: any) => String(c.bundleId) === String(b._id));
		const mergedQty = idx >= 0 ? cart[idx].qty + qty : qty;
		const nextQty = Math.max(1, Math.min(mergedQty, cap));
		if (nextQty < mergedQty) {
			return res.status(400).json({ message: `Jumlah maksimum bundling: ${cap}` });
		}
		if (idx >= 0) {
			cart[idx].lineKind = 'bundle';
			(cart[idx] as any).bundleId = b._id;
			(cart[idx] as any).productId = null;
			cart[idx].qty = nextQty;
			(cart[idx] as any).lineKey = `b:${b._id}`;
		} else {
			cart.push({
				lineKind: 'bundle',
				bundleId: b._id,
				productId: null,
				qty: nextQty,
				lineKey: `b:${b._id}`,
			} as any);
		}
		doc.cartItems = cart;
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menambah bundling' });
	}
});

router.patch('/cart/items/:productId', storeCartRateLimiter, async (req, res) => {
	try {
		const { GuestStoreSession, StoreProduct } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const qtyRaw = parseInt(String(req.body?.qty ?? '1'), 10);
		const vid = String(req.body?.variantId ?? req.query.variantId ?? '');
		const cart = doc.cartItems || [];
		const sameLine = (c: any) =>
			!c.bundleId &&
			c.lineKind !== 'bundle' &&
			String(c.productId) === req.params.productId &&
			String(c.variantId || '') === vid;
		const idx = cart.findIndex(sameLine);
		if (idx < 0) return res.status(404).json({ message: 'Item tidak ada di keranjang' });
		if (!Number.isFinite(qtyRaw) || qtyRaw < 1) {
			doc.cartItems = cart.filter((c: any) => !sameLine(c));
			await doc.save();
			return res.json({ ok: true });
		}
		const p0 = await StoreProduct.findById(req.params.productId).lean();
		if (!p0 || !p0.published) return res.status(400).json({ message: 'Produk tidak tersedia' });
		const p = productAsVariant(p0 as any, findVariant(p0, vid));
		const now = new Date();
		if (!isPreOrderOrderable(p, now)) {
			return res.status(400).json({ message: 'Produk tidak tersedia' });
		}
		const cap = maxProductOrderQty(p, now);
		const nextQty = Math.max(1, Math.min(qtyRaw, cap));
		if (nextQty < qtyRaw) {
			return res.status(400).json({ message: `Jumlah maksimum: ${cap}` });
		}
		cart[idx].qty = nextQty;
		doc.cartItems = cart;
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memperbarui keranjang' });
	}
});

router.delete('/cart/items/:productId', storeCartRateLimiter, async (req, res) => {
	try {
		const { GuestStoreSession } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const vid = String(req.query.variantId ?? req.body?.variantId ?? '');
		doc.cartItems = (doc.cartItems || []).filter(
			(c: any) =>
				c.lineKind === 'bundle' ||
				c.bundleId ||
				String(c.productId) !== req.params.productId ||
				String(c.variantId || '') !== vid,
		);
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menghapus item' });
	}
});

router.patch('/cart/bundles/:bundleId', storeCartRateLimiter, async (req, res) => {
	try {
		const { GuestStoreSession, StoreBundle } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const qtyRaw = parseInt(String(req.body?.qty ?? '1'), 10);
		const cart = doc.cartItems || [];
		const idx = cart.findIndex(
			(c: any) => c.lineKind === 'bundle' || (c.bundleId && String(c.bundleId) === req.params.bundleId),
		);
		if (idx < 0) return res.status(404).json({ message: 'Item tidak ada di keranjang' });
		if (!Number.isFinite(qtyRaw) || qtyRaw < 1) {
			doc.cartItems = cart.filter(
				(c: any) => String(c.bundleId) !== String(req.params.bundleId),
			);
			await doc.save();
			return res.json({ ok: true });
		}
		const b = await StoreBundle.findById(req.params.bundleId).lean();
		if (!b || !b.published) return res.status(400).json({ message: 'Bundling tidak tersedia' });
		const now = new Date();
		const cap = await maxBundleQty(req, b, now);
		const nextQty = Math.max(1, Math.min(qtyRaw, cap));
		if (nextQty < qtyRaw) {
			return res.status(400).json({ message: `Jumlah maksimum: ${cap}` });
		}
		cart[idx].qty = nextQty;
		doc.cartItems = cart;
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memperbarui bundling' });
	}
});

router.delete('/cart/bundles/:bundleId', storeCartRateLimiter, async (req, res) => {
	try {
		const { GuestStoreSession } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		doc.cartItems = (doc.cartItems || []).filter(
			(c: any) => String(c.bundleId) !== String(req.params.bundleId),
		);
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menghapus' });
	}
});

router.post('/cart/draft', storeCartRateLimiter, async (req, res) => {
	try {
		const { GuestStoreSession } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const b = req.body || {};
		doc.checkoutDraft = {
			customerName: String(b.customerName || ''),
			customerPhone: String(b.customerPhone || ''),
			fulfillment: b.fulfillment === 'delivery' ? 'delivery' : b.fulfillment === 'pickup' ? 'pickup' : '',
			shippingAddress: String(b.shippingAddress || ''),
			destinationVillageCode: String(b.destinationVillageCode || '').trim(),
			shippingCourierCode: String(b.shippingCourierCode || '').trim(),
			shippingServiceLabel: String(b.shippingServiceLabel || '').trim(),
		};
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menyimpan draft' });
	}
});

router.get('/my-orders', async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const { sessionKeyHash } = await getOrCreateGuestSession(req, res);
		const list = await StoreOrder.find({ guestSessionKeyHash: sessionKeyHash })
			.sort({ createdAt: -1 })
			.limit(50)
			.select(
				'orderNo invoiceAccessToken items subtotal total taxAmount taxPercent shippingCost fulfillment customerName customerPhone shippingAddress status createdAt paymentPlan dpAmount amountPaid balanceDue settleBy paymentStatus checkoutGroupId',
			)
			.lean();
		res.json(list);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat riwayat pesanan' });
	}
});

router.get('/orders/:orderNo', async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const orderNo = String(req.params.orderNo || '').trim();
		if (!orderNo) return res.status(400).json({ message: 'Nomor pesanan wajib' });
		const inv = String(req.query.inv || '').trim();

		let order: any = null;
		if (inv.length >= 32) {
			order = await StoreOrder.findOne({ orderNo, invoiceAccessToken: inv }).lean();
		}
		if (!order) {
			const { sessionKeyHash } = await getOrCreateGuestSession(req, res);
			order = await StoreOrder.findOne({
				orderNo,
				guestSessionKeyHash: sessionKeyHash,
			}).lean();
		}
		if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		res.json(stripInvoiceTokenFromOrder(order));
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat pesanan' });
	}
});

// ── Checkout & WA ──

type CheckoutFail = { ok: false; status: number; body: Record<string, unknown> };
type CheckoutOk = {
	ok: true;
	order: any;
	orderCur: string;
	whatsappUrl: string;
	invoiceUrl: string;
	decremented: { id: any; variantId: string; qty: number }[];
	campaignIds: string[];
};
const checkoutFail = (status: number, body: Record<string, unknown>): CheckoutFail => ({ ok: false, status, body });

/**
 * Buat SATU pesanan dari sebagian baris keranjang (satu grup kanal bayar).
 * Ongkir dihitung dari `shippingLines` (seluruh keranjang) dan hanya dibebankan bila `chargeShipping`.
 * Tidak menyentuh keranjang / notifikasi / sheet — itu dilakukan pemanggil setelah semua grup sukses.
 */
async function createCheckoutOrder(
	req: Request,
	res: Response,
	body: Record<string, any>,
	ctx: {
		lines: CartLineInput[];
		shippingLines: CartLineInput[];
		chargeShipping: boolean;
		checkoutGroupId: string;
		channels: StorePaymentChannel[];
		settings: any;
		waAdmin: StoreWaAdmin;
		sessionKeyHash: string;
	},
): Promise<CheckoutOk | CheckoutFail> {
	const { StoreProduct, StoreOrder, StoreBundle } = resolveModels(req);
	const now = new Date();
	const settings = ctx.settings;
	const sh = normalizeStoreShippingInDoc(settings);
	const customerName = String(body.customerName || '').trim();
	const customerPhone = String(body.customerPhone || '').trim();
	const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup';
	const shippingAddress = String(body.shippingAddress || '').trim();
	const destinationVillageCode = String(body.destinationVillageCode || '').trim();
	const shippingCourierCode = String(body.shippingCourierCode || '').trim();
	const requestedPlan: 'full' | 'dp' = body.paymentPlan === 'dp' ? 'dp' : 'full';

	const defCur = normalizeStoreCurrency(settings.defaultCurrency);
	const campaigns = await listActiveCampaigns(req);
	const campaignIds = new Set<string>();
	const orderLines: any[] = [];
	const planLines: { lineSubtotal: number; qty: number; dpRule: DpRule | null }[] = [];
	const stockOps: { id: any; variantId?: string; qty: number; skip: boolean }[] = [];
	let subtotal = 0;

	const pMap = new Map<string, any>();
	const bMap = new Map<string, any>();
	for (const l of ctx.shippingLines) {
		if (l.lineKind === 'product') {
			const p = await StoreProduct.findById(l.productId).lean();
			if (p) pMap.set(String(p._id), p);
		} else {
			const b = await StoreBundle.findById(l.bundleId).lean();
			if (b) bMap.set(String(b._id), b);
		}
	}

	for (const l of ctx.lines) {
		if (l.lineKind === 'product') {
			const p0 = await StoreProduct.findById(l.productId).lean();
			if (!p0 || !p0.published) continue;
			// Produk bervarian wajib memilih varian aktif
			const variant = findVariant(p0, (l as any).variantId);
			if (hasVariants(p0) && !variant) {
				return checkoutFail(400, { message: `Pilih varian untuk ${p0.name}` });
			}
			const p = productAsVariant(p0 as any, variant);
			if (!isPreOrderOrderable(p, now)) continue;
			const qty = l.qty;
			const pr = computeDiscountedSubtotal(p as any, qty, campaigns, now);
			for (const a of pr.applied) {
				if (a.id) campaignIds.add(a.id);
			}
			const unitPrice = pr.lineSubtotal / qty;
			const cur = effectiveProductCurrency(p, defCur);
			subtotal += pr.lineSubtotal;
			const inWindow = isPreOrderInWindow(
				{ isPreOrder: !!p.isPreOrder, preOrderOpenAt: p.preOrderOpenAt, preOrderCloseAt: p.preOrderCloseAt },
				now,
			);
			const preSnap = p.isPreOrder
				? { wasPreOrder: inWindow, estimatedReadyAt: p.estimatedReadyAt || null }
				: { wasPreOrder: false, estimatedReadyAt: null };
			planLines.push({ lineSubtotal: pr.lineSubtotal, qty, dpRule: effectiveDpRule(p0, settings, inWindow) });
			orderLines.push({
				lineKind: 'product',
				productId: p._id,
				bundleId: null,
				name: p.name,
				slug: p.slug,
				variantId: variant?.id || '',
				variantLabel: variant?.label || '',
				qty,
				unitPrice,
				lineSubtotal: pr.lineSubtotal,
				currency: cur,
				bundleComponentSnapshot: [],
				preOrderSnapshot: preSnap,
			});
			stockOps.push({
				id: p._id,
				variantId: variant?.id || '',
				qty,
				skip: shouldSkipStockDecrementForPreOrder(p, now),
			});
		} else {
			const b = await StoreBundle.findById(l.bundleId).lean();
			if (!b || !b.published || !b.isActive) continue;
			const qty = l.qty;
			const pr = computeDiscountedBundleSubtotal(String(b._id), b.bundlePrice, qty, campaigns, now);
			for (const a of pr.applied) {
				if (a.id) campaignIds.add(a.id);
			}
			const unitPrice = pr.lineSubtotal / qty;
			subtotal += pr.lineSubtotal;
			planLines.push({ lineSubtotal: pr.lineSubtotal, qty, dpRule: null });
			const comps: { name: string; slug: string; qty: number }[] = [];
			for (const it of b.items || []) {
				const p = await StoreProduct.findById(it.productId).lean();
				const problem = bundleItemProblem(p, String(it.variantId || ''));
				if (problem) return checkoutFail(400, { message: `${b.name}: ${problem}` });
				const v = findVariant(p, it.variantId);
				const need = Math.max(1, Math.floor(Number(it.qty) || 1)) * qty;
				comps.push({ name: `${p.name}${v ? ` (${v.label})` : ''}`, slug: p.slug, qty: need });
				stockOps.push({
					id: p._id,
					variantId: v?.id || '',
					qty: need,
					skip: shouldSkipStockDecrementForPreOrder(p, now),
				});
			}
			orderLines.push({
				lineKind: 'bundle',
				productId: null,
				bundleId: b._id,
				name: b.name,
				slug: b.slug,
				qty,
				unitPrice,
				lineSubtotal: pr.lineSubtotal,
				currency: defCur,
				bundleComponentSnapshot: comps,
				preOrderSnapshot: { wasPreOrder: false, estimatedReadyAt: null },
			});
		}
	}
	if (!orderLines.length) return checkoutFail(400, { message: 'Tidak ada produk valid' });

	const orderCurrencies = new Set(orderLines.map((l) => l.currency));
	if (orderCurrencies.size > 1) {
		return checkoutFail(400, { message: 'Beberapa mata uang. Kosongkan keranjang dan coba lagi.' });
	}
	const orderCur = orderLines[0].currency || defCur;

	let shippingCost = 0;
	let shippingEtd = '';
	let shipCourier = '';
	let shipLabel = '';
	if (ctx.chargeShipping) {
		const wGrams = await totalShippingWeightGrams(ctx.shippingLines, {
			StoreProduct,
			StoreBundle,
			defaultWeightGrams: sh.defaultWeightGrams,
		});
		const origin = resolveOriginVillageForLines(ctx.shippingLines, pMap, bMap, sh.globalOriginVillageCode);
		const shipRes = await resolveShippingForCheckout({
			fulfillment,
			shippingSettings: {
				enabled: sh.enabled,
				globalOriginVillageCode: sh.globalOriginVillageCode,
				defaultWeightGrams: sh.defaultWeightGrams,
				defaultCouriers: sh.defaultCouriers,
			},
			destinationVillageCode,
			weightGrams: wGrams,
			originVillageCode: origin,
			selectedCourierCode: shippingCourierCode,
		});
		if (!shipRes.ok) return checkoutFail(400, { message: shipRes.message });
		shippingCost = shipRes.cost;
		shippingEtd = shipRes.courier?.etd || '';
		shipCourier = shipRes.courier?.courierCode || shippingCourierCode;
		shipLabel = shipRes.courier ? `${shipRes.courier.courierName}` : '';
	}

	const taxPercent = settings.taxEnabled ? Number(settings.taxPercent || 0) : 0;
	const taxAmount = settings.taxEnabled ? Math.round((subtotal * taxPercent) / 100) : 0;
	const total = subtotal + taxAmount + shippingCost;
	// Nominal DP dihitung di server (nilai dari client diabaikan); ongkir & pajak ikut DP
	const plan = computeOrderPaymentPlan(planLines, { shippingCost, taxAmount, total }, requestedPlan);
	const hasPreOrderItems = orderLines.some((l) => l.preOrderSnapshot?.wasPreOrder);

	const orderNo = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`;
	const invoiceAccessToken = crypto.randomBytes(24).toString('hex');

	const base = publicBaseUrl(req);
	const storePath = normalizeStorePath(settings?.navbarPath);
	const invoiceUrl = `${base}${storePath}/order/${encodeURIComponent(orderNo)}?inv=${encodeURIComponent(invoiceAccessToken)}`;
	const itemsText = orderLines
		.map(
			(l) =>
				`• ${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ''} x${l.qty} — ${formatStoreMoney(l.lineSubtotal, l.currency)} (${base}${storePath}/${l.slug})`,
		)
		.join('\n');

	const storeAddr = settings.storeAddress || '';
	const waAdmin = ctx.waAdmin;
	const waUsed = waAdmin.phone;

	const tplBase = String(settings.checkoutMessageTemplate || '');
	const tpl = tplBase.includes('{{invoiceUrl}}')
		? tplBase
		: `${tplBase}${tplBase.trim() ? '\n\n' : ''}Lihat invoice: {{invoiceUrl}}`;
	const msg = applyTemplate(tpl, {
		items: itemsText,
		subtotal: formatStoreMoney(subtotal, orderCur),
		taxPercent: String(taxPercent),
		tax: formatStoreMoney(taxAmount, orderCur),
		shippingCost: formatStoreMoney(shippingCost, orderCur),
		total: formatStoreMoney(total, orderCur),
		fulfillment: fulfillment === 'delivery' ? 'Diantar' : 'Ambil di tempat',
		address: fulfillment === 'delivery' ? shippingAddress : storeAddr || '(ambil di toko)',
		customerName,
		customerPhone,
		orderNo,
		invoiceUrl,
	});
	const planText =
		plan.plan === 'dp'
			? `\n\nPembayaran: DP ${formatStoreMoney(plan.dpAmount, orderCur)}, sisa ${formatStoreMoney(plan.balanceDue, orderCur)}${plan.settleBy ? ` (lunasi sebelum ${new Date(plan.settleBy).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })})` : ''}`
			: '';
	const msgWithGreeting = `${waGreeting(waAdmin)}${msg}${planText}`;

	const decremented: { id: any; variantId: string; qty: number }[] = [];
	const stockMerged = mergeStockOpsByProduct(stockOps);
	try {
		for (const o of stockMerged) {
			if (o.skip) continue;
			const r = await takeStock(StoreProduct, o.id, o.variantId || '', o.qty);
			if (r === 'short') throw new Error('STOCK');
			if (r === 'ok') decremented.push({ id: o.id, variantId: o.variantId || '', qty: o.qty });
		}
	} catch (e) {
		for (const d of decremented.reverse()) {
			await giveStock(StoreProduct, d.id, d.variantId, d.qty);
		}
		if ((e as Error).message === 'STOCK') return checkoutFail(400, { message: 'Stok tidak mencukupi' });
		throw e;
	}

	const order = await StoreOrder.create({
		orderNo,
		invoiceAccessToken,
		guestSessionKeyHash: ctx.sessionKeyHash,
		items: orderLines,
		subtotal,
		taxPercent,
		taxAmount,
		shippingCost,
		shippingCourierCode: shipCourier,
		shippingServiceLabel: shipLabel,
		shippingEtd,
		destinationVillageCode: fulfillment === 'delivery' ? destinationVillageCode : '',
		total,
		fulfillment,
		customerName,
		customerPhone,
		shippingAddress: fulfillment === 'delivery' ? shippingAddress : '',
		storeAddressSnapshot: storeAddr,
		whatsappPhoneUsed: waUsed,
		whatsappMessageSnapshot: msgWithGreeting,
		whatsappAdminName: waAdmin.name,
		stockDecrements: decremented.map((d) => ({ productId: d.id, variantId: d.variantId, qty: d.qty })),
		status: 'pending',
		checkoutGroupId: ctx.checkoutGroupId,
		// Salinan kanal saat checkout: invoice lama tidak berubah bila pengaturan diubah
		paymentChannelIds: ctx.channels.map((c) => c.id),
		paymentChannelsSnapshot: ctx.channels,
		paymentPlan: plan.plan,
		dpAmount: plan.dpAmount,
		amountPaid: 0,
		balanceDue: total,
		settleBy: plan.settleBy ? new Date(plan.settleBy) : null,
		paymentStatus: 'unpaid',
		hasPreOrderItems,
		appliedCampaignIds: Array.from(campaignIds)
			.filter((x) => mongoose.Types.ObjectId.isValid(x))
			.map((x) => new mongoose.Types.ObjectId(x)),
	});

	return {
		ok: true,
		order,
		orderCur,
		whatsappUrl: `https://wa.me/${waUsed}?text=${encodeURIComponent(msgWithGreeting)}`,
		invoiceUrl,
		decremented,
		campaignIds: Array.from(campaignIds),
	};
}

/** Kurangi baris keranjang sesi sesuai yang sudah di-checkout. */
function removeCheckedOutFromCart(sessDoc: any, lines: CartLineInput[]) {
	const cart = sessDoc.cartItems || [];
	for (const l of lines) {
		const idx =
			l.lineKind === 'product'
				? cart.findIndex(
						(c: any) =>
							!c.bundleId &&
							c.lineKind !== 'bundle' &&
							String(c.productId) === String(l.productId) &&
							String(c.variantId || '') === String((l as any).variantId || ''),
					)
				: cart.findIndex((c: any) => c.lineKind === 'bundle' && c.bundleId && String(c.bundleId) === String(l.bundleId));
		if (idx < 0) continue;
		cart[idx].qty = Math.max(0, Math.floor(Number(cart[idx].qty) || 0) - l.qty);
		if (cart[idx].qty <= 0) cart.splice(idx, 1);
	}
	sessDoc.cartItems = cart;
}

async function runStoreCheckoutFromBody(req: Request, res: Response, _body: Record<string, unknown>) {
	try {
		const { StoreProduct, StoreOrder, StoreDiscountCampaign } = resolveModels(req);
		const body = (_body || {}) as Record<string, any>;
		const parsed = parseCartLinesFromBody(Array.isArray(body.items) ? body.items : []);
		if (!parsed.ok) return res.status(400).json({ message: parsed.message });

		const customerName = String(body.customerName || '').trim();
		const customerPhone = String(body.customerPhone || '').trim();
		const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup';
		if (!customerName || !customerPhone) {
			return res.status(400).json({ message: 'Nama dan nomor WA wajib' });
		}
		if (fulfillment === 'delivery' && !String(body.shippingAddress || '').trim()) {
			return res.status(400).json({ message: 'Alamat pengiriman wajib untuk pengiriman' });
		}

		const settings: any = await ensureSettings(req);
		const sh = normalizeStoreShippingInDoc(settings);
		const allChannels = (settings.paymentChannels || []) as StorePaymentChannel[];
		const activeChannels = allChannels.filter((c) => c.active);
		// Kebijakan batal wajib disetujui bila toko memakai kanal bayar (alur bayar di web)
		if (activeChannels.length && body.acceptCancelPolicy !== true) {
			return res.status(400).json({
				message: 'Setujui ketentuan pembatalan terlebih dahulu',
				error: { code: 'CANCEL_POLICY_REQUIRED' },
			});
		}
		// Admin WA: satu produk → admin produk (override) / global; keranjang campuran → global.
		// Ditentukan SEBELUM stok dikurangi agar toko tutup / pilih admin tidak membuat pesanan.
		const singleProductLine =
			parsed.lines.length === 1 && parsed.lines[0].lineKind === 'product'
				? await StoreProduct.findById(parsed.lines[0].productId).lean()
				: undefined;
		const pick = pickStoreWaAdmin(settings, singleProductLine || undefined, body.adminId);
		if (!pick.ok) return res.status(pick.status).json(pick.body);
		if (fulfillment === 'delivery' && sh.enabled) {
			if (!/^\d{10}$/.test(String(body.destinationVillageCode || '').trim())) {
				return res.status(400).json({ message: 'Kode kelurahan tujuan 10 digit wajib (ongkir)' });
			}
		}

		// Kelompokkan baris per himpunan kanal bayar → satu pesanan per kelompok
		const groups = new Map<string, { channels: StorePaymentChannel[]; lines: CartLineInput[] }>();
		for (const l of parsed.lines) {
			const p = l.lineKind === 'product' ? await StoreProduct.findById(l.productId).lean() : null;
			const channels = p ? channelsForProduct(p, allChannels) : activeChannels;
			if (activeChannels.length && !channels.length) {
				return res.status(400).json({ message: `Produk ${p?.name || ''} belum punya metode bayar aktif. Hubungi admin toko.` });
			}
			const key = channelGroupKey(channels);
			const g = groups.get(key) || { channels, lines: [] };
			g.lines.push(l);
			groups.set(key, g);
		}

		const { doc: sessDoc, sessionKeyHash } = await getOrCreateGuestSession(req, res);
		const checkoutGroupId = groups.size > 1 ? `CG-${crypto.randomBytes(6).toString('hex')}` : '';
		const created: CheckoutOk[] = [];
		let idx = 0;
		for (const g of Array.from(groups.values())) {
			const r = await createCheckoutOrder(req, res, body, {
				lines: g.lines,
				shippingLines: parsed.lines,
				// Satu pengiriman untuk seluruh keranjang → ongkir dibebankan ke pesanan pertama saja
				chargeShipping: idx === 0,
				checkoutGroupId,
				channels: g.channels,
				settings,
				waAdmin: pick.admin,
				sessionKeyHash,
			}).catch((e) => {
				console.error(e);
				return checkoutFail(500, { message: 'Checkout gagal' });
			});
			idx++;
			if (!r.ok) {
				// Batalkan pesanan grup sebelumnya agar checkout tetap all-or-nothing
				for (const c of created) {
					for (const d of c.decremented) await giveStock(StoreProduct, d.id, d.variantId, d.qty);
					await StoreOrder.deleteOne({ _id: c.order._id });
				}
				return res.status(r.status).json(r.body);
			}
			created.push(r);
		}

		const campaignIds = new Set(created.flatMap((c) => c.campaignIds));
		for (const id of Array.from(campaignIds)) {
			if (!mongoose.Types.ObjectId.isValid(id)) continue;
			await StoreDiscountCampaign.updateOne({ _id: id }, { $inc: { usageCount: 1 } });
			const c = await StoreDiscountCampaign.findById(id).lean();
			if (c && c.mode === 'one_time_flash' && c.usageLimit != null && c.usageCount >= c.usageLimit) {
				await StoreDiscountCampaign.updateOne({ _id: id }, { $set: { oneTimeCompleted: true, isActive: false } });
			}
		}

		removeCheckedOutFromCart(sessDoc, parsed.lines);
		await sessDoc.save();

		for (const c of created) {
			const o = c.order;
			queueSheetSync(req, o.orderNo, { stock: true });
			notifyStoreAdmins(req, 'store_order', {
				title: `Pesanan baru ${o.orderNo}${o.paymentPlan === 'dp' ? ' (DP)' : ''}`,
				description: `${customerName} · ${o.items.map((l: any) => `${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ''} x${l.qty}`).join(', ')} · ${formatStoreMoney(o.total, c.orderCur)}`,
				actionUrl: '/dashboard/toko?tab=orders',
				tag: 'toko',
			});
		}
		const orders = created.map((c) => ({
			...stripInvoiceTokenFromOrder(c.order.toObject()),
			invoiceUrl: c.invoiceUrl,
			whatsappUrl: c.whatsappUrl,
		}));
		res.json({
			order: orders[0],
			orders,
			whatsappUrl: created[0].whatsappUrl,
			invoiceUrl: created[0].invoiceUrl,
			// true → pembeli diarahkan ke invoice untuk bayar (QRIS/transfer) & upload bukti
			payOnWeb: activeChannels.length > 0,
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Checkout gagal' });
	}
}

router.post('/checkout', storeCheckoutRateLimiter, (req, res) => {
	return runStoreCheckoutFromBody(req, res, (req.body || {}) as Record<string, unknown>);
});

/** Checkout satuan: body.productId atau body.bundleId + field sama seperti /checkout */
router.post('/direct-checkout', storeCheckoutRateLimiter, (req, res) => {
	const body = (req.body || {}) as Record<string, unknown> & { productId?: string; bundleId?: string; qty?: number };
	const qty = Math.max(1, parseInt(String(body.qty || 1), 10) || 1);
	if (body.bundleId) {
		return runStoreCheckoutFromBody(req, res, { ...body, items: [{ bundleId: String(body.bundleId), qty }] });
	}
	if (body.productId) {
		return runStoreCheckoutFromBody(req, res, {
			...body,
			items: [{ productId: String(body.productId), variantId: String((body as any).variantId || ''), qty }],
		});
	}
	return res.status(400).json({ message: 'Pilih productId atau bundleId' });
});

router.post('/buy-link', storeCheckoutRateLimiter, async (req, res) => {
	try {
		const { StoreProduct } = resolveModels(req);
		const productId = req.body?.productId;
		const qty = Math.max(1, parseInt(String(req.body?.qty || 1), 10) || 1);
		const p = await StoreProduct.findById(productId).lean();
		if (!p || !p.published) return res.status(400).json({ message: 'Produk tidak tersedia' });

		const settings: any = await ensureSettings(req);
		const pick = pickStoreWaAdmin(settings, p, req.body?.adminId);
		if (!pick.ok) return res.status(pick.status).json(pick.body);
		const wa = pick.admin.phone;

		const base = publicBaseUrl(req);
		const storePath = normalizeStorePath(settings?.navbarPath);
		const url = `${base}${storePath}/${p.slug}`;
		const tpl =
			p.buyMessageTemplateOverride?.trim() ||
			settings.defaultBuyMessageTemplate ||
			'Halo, saya tertarik membeli:\n\n{{productName}}\nHarga: {{price}}\nJumlah: {{qty}}\nLink: {{url}}';

		const defCur = normalizeStoreCurrency(settings.defaultCurrency);
		const itemCur = effectiveProductCurrency(p, defCur);
		const campaigns = await listActiveCampaigns(req);
		const pr = computeDiscountedSubtotal(p as any, qty, campaigns, new Date());
		const lineTotal = pr.lineSubtotal;
		const unitPrice = lineTotal / qty;
		const priceLabel =
			qty > 1
				? `${formatStoreMoney(unitPrice, itemCur)} × ${qty} = ${formatStoreMoney(lineTotal, itemCur)}`
				: formatStoreMoney(unitPrice, itemCur);

		const msg = applyTemplate(tpl, {
			productName: p.name,
			price: priceLabel,
			qty: String(qty),
			url,
			shortDescription: stripHtml(p.shortDescription || ''),
		});

		const text = `${waGreeting(pick.admin)}${msg}`;
		const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
		res.json({ whatsappUrl: waUrl, message: text });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal membuat link WhatsApp' });
	}
});

// ── Chat penjual (pembeli tamu ↔ admin toko), model marketplace ──
// Satu percakapan per pembeli (cookie sesi toko). Tiap "Chat penjual" dari suatu produk menyisipkan
// pesan kartu produk (thumbnail, nama, harga, link) ke percakapan yang sama, jadi satu pembeli bisa
// menanyakan banyak barang. Percakapan dihapus otomatis 7 hari setelah pesan terakhir (TTL expireAt).

const CHAT_TEXT_MAX = 1000;
const CHAT_MESSAGES_MAX = 300;
/** Chat dihapus otomatis 7 hari setelah pesan terakhir (TTL index `expireAt`) */
const STORE_CHAT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cleanChatText(raw: unknown): string {
	return String(raw || '')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
		.trim()
		.slice(0, CHAT_TEXT_MAX);
}

type ChatProductCard = {
	productId: string;
	name: string;
	slug: string;
	thumbnail: string;
	price: number;
	currency: string;
};

function publicChatMessage(m: any) {
	return {
		from: m.from,
		kind: m.kind === 'product' ? 'product' : 'text',
		text: m.text || '',
		senderName: m.from === 'admin' ? m.senderName || 'Admin' : m.senderName || '',
		product: m.kind === 'product' && m.product ? { ...m.product, productId: String(m.product.productId || '') } : null,
		at: m.at,
	};
}

/** Daftar produk unik yang pernah ditanyakan (urut terbaru dulu). */
function askedProducts(chat: any): ChatProductCard[] {
	const seen = new Set<string>();
	const out: ChatProductCard[] = [];
	const msgs = [...(chat?.messages || [])].reverse();
	for (const m of msgs) {
		if (m.kind !== 'product' || !m.product) continue;
		const id = String(m.product.productId || m.product.slug);
		if (seen.has(id)) continue;
		seen.add(id);
		out.push({ ...m.product, productId: String(m.product.productId || '') });
	}
	// Data lama (satu utas per produk) → jadikan kartu juga
	if (!out.length && chat?.productName) {
		out.push({
			productId: chat.productId ? String(chat.productId) : '',
			name: chat.productName,
			slug: chat.productSlug,
			thumbnail: chat.productThumbnail || '',
			price: Number(chat.productPrice) || 0,
			currency: chat.productCurrency || '',
		});
	}
	return out;
}

function chatForBuyer(chat: any, storePath: string) {
	return {
		_id: String(chat._id),
		customerName: chat.customerName,
		status: chat.status,
		unreadForBuyer: chat.unreadForBuyer || 0,
		lastMessageAt: chat.lastMessageAt,
		expireAt: chat.expireAt,
		storePath,
		products: askedProducts(chat),
		messages: (chat.messages || []).map(publicChatMessage),
	};
}

async function productCardFor(req: Request, productId: string): Promise<ChatProductCard | null> {
	const { StoreProduct } = resolveModels(req);
	if (!mongoose.Types.ObjectId.isValid(productId)) return null;
	const p: any = await StoreProduct.findOne({ _id: productId, published: true })
		.select('name slug thumbnail price currency')
		.lean();
	if (!p) return null;
	const settings: any = await ensureSettings(req);
	return {
		productId: String(p._id),
		name: p.name,
		slug: p.slug,
		thumbnail: p.thumbnail || '',
		price: Number(p.price) || 0,
		currency: effectiveProductCurrency(p, normalizeStoreCurrency(settings?.defaultCurrency)),
	};
}

async function findBuyerChat(req: Request, sessionKeyHash: string) {
	const { StoreChat } = resolveModels(req);
	return StoreChat.findOne({ guestSessionKeyHash: sessionKeyHash }).sort({ lastMessageAt: -1 });
}

/** Link WA dari percakapan: admin produk terakhir yang ditanyakan (atau global). */
async function chatWaLink(req: Request, chat: any, adminId: unknown) {
	const { StoreProduct } = resolveModels(req);
	const settings: any = await ensureSettings(req);
	const lastProduct = askedProducts(chat)[0];
	const product = lastProduct?.productId ? await StoreProduct.findById(lastProduct.productId).lean() : null;
	const pick = pickStoreWaAdmin(settings, product || undefined, adminId);
	if (!pick.ok) return { waUrl: null as string | null, pick };
	const base = publicBaseUrl(req);
	const storePath = normalizeStorePath(settings?.navbarPath);
	const lastBuyer = [...(chat?.messages || [])].reverse().find((m: any) => m.from === 'buyer' && m.kind !== 'product');
	const productLine = lastProduct
		? `saya mau tanya tentang *${lastProduct.name}* (${base}${storePath}/${lastProduct.slug}).`
		: 'saya mau tanya tentang produk toko.';
	const text = `${waGreeting(pick.admin)}${productLine}${lastBuyer ? `\n\n${lastBuyer.text}` : ''}`;
	return { waUrl: `https://wa.me/${pick.admin.phone}?text=${encodeURIComponent(text)}`, pick };
}

/** Percakapan pembeli ini (null bila belum pernah chat). */
router.get('/chats/mine', async (req, res) => {
	try {
		const { sessionKeyHash } = await getOrCreateGuestSession(req, res);
		const settings: any = await ensureSettings(req);
		const chat = await findBuyerChat(req, sessionKeyHash);
		if (!chat) return res.json({ chat: null });
		if (req.query.markRead === '1' && chat.unreadForBuyer) {
			chat.unreadForBuyer = 0;
			await chat.save();
		}
		res.json({ chat: chatForBuyer(chat.toObject(), normalizeStorePath(settings?.navbarPath)) });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat chat' });
	}
});

/**
 * Kirim pesan. `productId` (opsional) menyisipkan kartu produk bila produk itu bukan yang terakhir
 * dibahas; `text` boleh kosong bila hanya melampirkan produk.
 */
router.post('/chats', storeChatRateLimiter, async (req, res) => {
	try {
		const { StoreChat } = resolveModels(req);
		const text = cleanChatText(req.body?.text);
		const productId = String(req.body?.productId || '').trim();
		const customerName = String(req.body?.customerName || '').trim().slice(0, 80);
		const card = productId ? await productCardFor(req, productId) : null;
		if (productId && !card) return res.status(404).json({ message: 'Produk tidak ditemukan' });
		if (!text && !card) return res.status(400).json({ message: 'Pesan wajib diisi' });

		const { sessionKeyHash } = await getOrCreateGuestSession(req, res);
		const settings: any = await ensureSettings(req);
		const now = new Date();
		let chat = await findBuyerChat(req, sessionKeyHash);
		if (!chat) {
			if (!customerName) return res.status(400).json({ message: 'Nama wajib diisi' });
			chat = new StoreChat({ guestSessionKeyHash: sessionKeyHash, customerName, messages: [] });
		}
		if (customerName) chat.customerName = customerName;

		const needCard = !!card && askedProducts(chat)[0]?.productId !== card.productId;
		const incoming = (needCard ? 1 : 0) + (text ? 1 : 0);
		if (chat.messages.length + incoming > CHAT_MESSAGES_MAX) {
			return res.status(400).json({ message: 'Percakapan terlalu panjang, lanjutkan lewat WhatsApp' });
		}
		if (needCard) {
			chat.messages.push({ from: 'buyer', kind: 'product', text: '', product: card, senderName: chat.customerName || '', at: now });
		}
		if (text) chat.messages.push({ from: 'buyer', kind: 'text', text, senderName: chat.customerName || '', at: now });
		const wasRead = !chat.unreadForAdmin;
		chat.unreadForAdmin = (chat.unreadForAdmin || 0) + incoming;
		chat.status = 'open';
		chat.lastMessageAt = now;
		chat.expireAt = new Date(now.getTime() + STORE_CHAT_TTL_MS);
		await chat.save();
		// Notifikasi hanya saat admin belum punya pesan belum-dibaca (hindari spam per pesan)
		if (wasRead) {
			notifyStoreAdmins(req, 'store_chat', {
				title: `Chat baru dari ${chat.customerName || 'pembeli'}`,
				description: text ? text.slice(0, 120) : `Menanyakan ${card?.name || 'produk'}`,
				actionUrl: '/dashboard/toko?tab=chat',
				tag: 'toko',
			});
		}
		res.status(201).json({ chat: chatForBuyer(chat.toObject(), normalizeStorePath(settings?.navbarPath)) });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal mengirim pesan' });
	}
});

/** Lanjut ke WhatsApp dari percakapan (409 STORE_CLOSED / CHOOSE_ADMIN seperti checkout). */
router.post('/chats/mine/whatsapp', storeChatRateLimiter, async (req, res) => {
	try {
		const { sessionKeyHash } = await getOrCreateGuestSession(req, res);
		const chat: any = await findBuyerChat(req, sessionKeyHash);
		if (!chat) return res.status(404).json({ message: 'Chat tidak ditemukan' });
		const link = await chatWaLink(req, chat.toObject(), req.body?.adminId);
		if (!link.pick.ok) return res.status(link.pick.status).json(link.pick.body);
		res.json({ whatsappUrl: link.waUrl });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal membuat link WhatsApp' });
	}
});

// Admin
function chatForAdmin(chat: any, storePath: string) {
	const { guestSessionKeyHash: _g, ...rest } = chat;
	return {
		...rest,
		_id: String(chat._id),
		storePath,
		products: askedProducts(chat),
		messages: (chat.messages || []).map(publicChatMessage),
	};
}

router.get('/admin/chats', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreChat } = resolveModels(req);
		// Chat lama (sebelum TTL) tanpa expireAt → isi dari pesan terakhir agar ikut terhapus 7 hari
		await StoreChat.updateMany({ expireAt: { $exists: false } }, [
			{ $set: { expireAt: { $add: [{ $ifNull: ['$lastMessageAt', '$$NOW'] }, STORE_CHAT_TTL_MS] } } },
		]).catch(() => undefined);
		const status = String(req.query.status || '').trim();
		const filter: any = {};
		if (status === 'open' || status === 'closed') filter.status = status;
		const list = await StoreChat.find(filter)
			.sort({ lastMessageAt: -1 })
			.limit(200)
			.select('-guestSessionKeyHash')
			.lean();
		res.json(
			list.map((c: any) => {
				const last = (c.messages || [])[c.messages.length - 1];
				return {
					_id: String(c._id),
					customerName: c.customerName || 'Pembeli',
					status: c.status,
					unreadForAdmin: c.unreadForAdmin || 0,
					lastMessageAt: c.lastMessageAt,
					expireAt: c.expireAt,
					products: askedProducts(c).map((p) => ({ name: p.name, thumbnail: p.thumbnail })),
					lastMessage: last
						? {
								from: last.from,
								text: last.kind === 'product' ? `🛍 ${last.product?.name || 'Produk'}` : String(last.text).slice(0, 140),
							}
						: null,
				};
			}),
		);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat chat' });
	}
});

router.get('/admin/chats/:id', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreChat } = resolveModels(req);
		if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Chat tidak ditemukan' });
		const chat = await StoreChat.findByIdAndUpdate(req.params.id, { $set: { unreadForAdmin: 0 } }, { new: true }).lean();
		if (!chat) return res.status(404).json({ message: 'Chat tidak ditemukan' });
		const settings: any = await ensureSettings(req);
		res.json(chatForAdmin(chat, normalizeStorePath(settings?.navbarPath)));
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memuat chat' });
	}
});

router.post('/admin/chats/:id/messages', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreChat } = resolveModels(req);
		const text = cleanChatText(req.body?.text);
		if (!text) return res.status(400).json({ message: 'Pesan wajib diisi' });
		if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Chat tidak ditemukan' });
		const chat = await StoreChat.findById(req.params.id);
		if (!chat) return res.status(404).json({ message: 'Chat tidak ditemukan' });
		if (chat.messages.length >= CHAT_MESSAGES_MAX) {
			return res.status(400).json({ message: 'Percakapan terlalu panjang' });
		}
		const u: any = req.user || {};
		const now = new Date();
		chat.messages.push({ from: 'admin', kind: 'text', text, senderName: String(u.name || u.username || 'Admin'), at: now });
		chat.unreadForBuyer = (chat.unreadForBuyer || 0) + 1;
		chat.unreadForAdmin = 0;
		chat.lastMessageAt = now;
		chat.expireAt = new Date(now.getTime() + STORE_CHAT_TTL_MS);
		await chat.save();
		const settings: any = await ensureSettings(req);
		res.status(201).json(chatForAdmin(chat.toObject(), normalizeStorePath(settings?.navbarPath)));
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal mengirim balasan' });
	}
});

router.patch('/admin/chats/:id', authenticate, requireStoreDashboard, async (req, res) => {
	try {
		const { StoreChat } = resolveModels(req);
		const status = String(req.body?.status || '');
		if (!['open', 'closed'].includes(status)) return res.status(400).json({ message: 'Status tidak valid' });
		if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Chat tidak ditemukan' });
		const chat = await StoreChat.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true })
			.select('-guestSessionKeyHash')
			.lean();
		if (!chat) return res.status(404).json({ message: 'Chat tidak ditemukan' });
		res.json(chat);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memperbarui chat' });
	}
});

/**
 * Pengingat harian (cron): pesanan berstatus Menunggu > 24 jam → notifikasi admin toko.
 * `ctx` meniru bagian `req` yang dipakai resolveModels/notifyStoreAdmins (main atau tenant).
 */
export async function remindPendingStoreOrders(ctx: {
	tenantModels?: any;
	tenantDbName?: string;
	tenantSlug?: string;
}): Promise<number> {
	const req: any = {
		tenantModels: ctx.tenantModels,
		isTenantRequest: !!ctx.tenantModels,
		tenantDbName: ctx.tenantDbName,
		tenantSlug: ctx.tenantSlug || '',
	};
	const { StoreOrder } = resolveModels(req);
	const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const n = await StoreOrder.countDocuments({ status: 'pending', createdAt: { $lte: cutoff } });
	if (n > 0) {
		notifyStoreAdmins(req, 'store_order', {
			title: `${n} pesanan menunggu lebih dari 24 jam`,
			description: 'Cek pesanan, konfirmasi stok, lalu ubah statusnya di Dashboard → Toko → Pesanan.',
			actionUrl: '/dashboard/toko?tab=orders',
			tag: 'toko',
		});
	}
	// Bukti bayar belum diverifikasi, DP mendekati/lewat tenggat, permintaan batal belum ditangani
	const open = { status: { $ne: 'cancelled' } };
	const waiting = await StoreOrder.countDocuments({
		...open,
		paymentStatus: { $in: ['awaiting_verification', 'balance_awaiting_verification'] },
	});
	const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
	const dueDp = await StoreOrder.countDocuments({
		...open,
		paymentPlan: 'dp',
		paymentStatus: { $nin: ['paid', 'refunded'] },
		settleBy: { $ne: null, $lte: soon },
	});
	const cancelReq = await StoreOrder.countDocuments({ ...open, cancelRequestedAt: { $ne: null } });
	const parts = [
		waiting ? `${waiting} bukti bayar menunggu verifikasi` : '',
		dueDp ? `${dueDp} pesanan DP mendekati/lewat tenggat pelunasan` : '',
		cancelReq ? `${cancelReq} permintaan pembatalan` : '',
	].filter(Boolean);
	if (parts.length) {
		notifyStoreAdmins(req, 'store_order', {
			title: 'Pembayaran toko perlu dicek',
			description: `${parts.join(' · ')}. Buka Dashboard → Toko → Pesanan / Pre-order.`,
			actionUrl: '/dashboard/toko?tab=preorders',
			tag: 'toko',
		});
	}
	return n;
}

export default router;
