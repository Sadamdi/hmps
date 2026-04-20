import crypto from 'crypto';
import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { authenticate } from '../auth';
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
	uploadMiddleware,
	uploadStoreProductImage,
	tenantCtxFromReq,
	deleteFile,
} from '../upload';

const router = Router();

const COOKIE_NAME = 'hmps_store_session';
const SESSION_PEPPER = process.env.STORE_SESSION_PEPPER || 'hmps-store-session-pepper';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function resolveModels(req: Request) {
	if ((req as any).tenantModels) return (req as any).tenantModels;
	return require('../../db/mongodb');
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

function normalizeWaDigits(phone: string): string {
	return String(phone || '').replace(/\D/g, '');
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
		res.json({
			navbarLabel: s.navbarLabel || 'Toko',
			navbarPath: s.navbarPath || '/toko',
			taxPercent: typeof s.taxPercent === 'number' ? s.taxPercent : 0,
			taxEnabled: !!s.taxEnabled,
			whatsappContactName: s.whatsappContactName || '',
			storeAddress: s.storeAddress || '',
			defaultCurrency: normalizeStoreCurrency(s.defaultCurrency),
			layoutBlocks: Array.isArray(s.layoutBlocks) ? s.layoutBlocks : defaultLayoutBlocks(),
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
				'slug name shortDescription price priceTiers priceTierMultiples stock currency thumbnail published createdAt updatedAt categoryId',
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
		res.json(p);
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
		for (const k of allowed) {
			if (body[k] !== undefined) {
				if (k === 'defaultCurrency') {
					update[k] = normalizeStoreCurrency(body[k]);
				} else {
					update[k] = body[k];
				}
			}
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

		const doc = await StoreProduct.create({
			slug,
			name,
			shortDescription: String(body.shortDescription || '').slice(0, 500),
			descriptionHtml: String(body.descriptionHtml || ''),
			price,
			priceTiers,
			stock,
			categoryId,
			currency: normalizeProductCurrencyOverride(body.currency),
			thumbnail,
			thumbnailSource: body.thumbnailSource === 'gdrive' ? 'gdrive' : 'local',
			thumbnailGdriveFileId: String(body.thumbnailGdriveFileId || ''),
			gallery,
			videoUrl: String(body.videoUrl || ''),
			videoType: vid.type,
			whatsappPhoneOverride: String(body.whatsappPhoneOverride || ''),
			whatsappContactNameOverride: String(body.whatsappContactNameOverride || ''),
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
				'buyMessageTemplateOverride',
				'storeAddressOverride',
				'published',
				'categoryId',
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
		if (body.descriptionHtml !== undefined) p.descriptionHtml = String(body.descriptionHtml);
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
		if (body.buyMessageTemplateOverride !== undefined) {
			p.buyMessageTemplateOverride = String(body.buyMessageTemplateOverride || '');
		}
		if (body.storeAddressOverride !== undefined) p.storeAddressOverride = String(body.storeAddressOverride || '');
		if (body.published !== undefined) p.published = !!body.published;

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

const STORE_ORDER_STATUSES = ['pending', 'confirmed', 'paid', 'completed', 'cancelled'] as const;

router.patch('/admin/orders/:orderNo', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const orderNo = String(req.params.orderNo || '').trim();
		const status = String((req.body as any)?.status || '').trim();
		if (!orderNo) return res.status(400).json({ message: 'Nomor pesanan wajib' });
		if (!STORE_ORDER_STATUSES.includes(status as any)) {
			return res.status(400).json({ message: 'Status tidak valid' });
		}
		const order = await StoreOrder.findOneAndUpdate(
			{ orderNo },
			{ $set: { status, updatedAt: new Date() } },
			{ new: true },
		).lean();
		if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
		res.json(order);
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memperbarui pesanan' });
	}
});

router.delete('/admin/orders/:orderNo', authenticate, requireTokoManage, async (req, res) => {
	try {
		const { StoreOrder } = resolveModels(req);
		const orderNo = String(req.params.orderNo || '').trim();
		if (!orderNo) return res.status(400).json({ message: 'Nomor pesanan wajib' });
		const r = await StoreOrder.deleteOne({ orderNo });
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
		const { GuestStoreSession, StoreProduct } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const settings: any = await ensureSettings(req);
		const defCur = normalizeStoreCurrency(settings?.defaultCurrency);
		const items: any[] = [];
		for (const row of doc.cartItems || []) {
			const p = await StoreProduct.findById(row.productId).lean();
			if (!p || !p.published) continue;
			const cur = effectiveProductCurrency(p, defCur);
			const qty = Math.max(1, Math.floor(Number(row.qty) || 1));
			const lineSubtotal = lineSubtotalForProduct(p, qty);
			const unitPrice = lineSubtotal / qty;
			items.push({
				productId: String(p._id),
				slug: p.slug,
				name: p.name,
				price: unitPrice,
				unitPrice,
				lineSubtotal,
				currency: cur,
				thumbnail: p.thumbnail,
				qty,
				stockAvailable: getStoreStockAvailable(p.stock),
			});
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

router.post('/cart/items', async (req, res) => {
	try {
		const { GuestStoreSession, StoreProduct } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const productId = req.body?.productId;
		const qty = Math.max(1, parseInt(String(req.body?.qty || '1'), 10) || 1);
		const p = await StoreProduct.findById(productId).lean();
		if (!p || !p.published) return res.status(400).json({ message: 'Produk tidak tersedia' });

		const settings: any = await ensureSettings(req);
		const defCur = normalizeStoreCurrency(settings?.defaultCurrency);
		const newCur = effectiveProductCurrency(p, defCur);
		const cart = doc.cartItems || [];
		if (cart.length) {
			const first = await StoreProduct.findById(cart[0].productId).lean();
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

		const idx = cart.findIndex((c: any) => String(c.productId) === String(productId));
		const mergedQty = idx >= 0 ? cart[idx].qty + qty : qty;
		const capped = capQtyByStock(p.stock, mergedQty);
		const avail = getStoreStockAvailable(p.stock);
		if (avail !== null && capped < 1) {
			return res.status(400).json({ message: 'Stok habis untuk produk ini' });
		}
		if (capped < mergedQty) {
			return res.status(400).json({
				message: `Stok hanya tersisa ${avail}`,
			});
		}
		const nextQty = Math.max(1, capped);
		if (idx >= 0) cart[idx].qty = nextQty;
		else cart.push({ productId: p._id, qty: nextQty });

		doc.cartItems = cart;
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menambah ke keranjang' });
	}
});

router.patch('/cart/items/:productId', async (req, res) => {
	try {
		const { GuestStoreSession, StoreProduct } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const qtyRaw = parseInt(String(req.body?.qty ?? '1'), 10);
		const cart = doc.cartItems || [];
		const idx = cart.findIndex((c: any) => String(c.productId) === req.params.productId);
		if (idx < 0) return res.status(404).json({ message: 'Item tidak ada di keranjang' });
		if (!Number.isFinite(qtyRaw) || qtyRaw < 1) {
			doc.cartItems = cart.filter((c: any) => String(c.productId) !== req.params.productId);
			await doc.save();
			return res.json({ ok: true });
		}
		const p = await StoreProduct.findById(req.params.productId).lean();
		if (!p || !p.published) return res.status(400).json({ message: 'Produk tidak tersedia' });
		const capped = capQtyByStock(p.stock, qtyRaw);
		const avail = getStoreStockAvailable(p.stock);
		if (avail !== null && capped < 1) {
			return res.status(400).json({ message: 'Stok habis untuk produk ini' });
		}
		if (capped < qtyRaw) {
			return res.status(400).json({ message: `Stok hanya tersisa ${capped}` });
		}
		cart[idx].qty = Math.max(1, capped);
		doc.cartItems = cart;
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal memperbarui keranjang' });
	}
});

router.delete('/cart/items/:productId', async (req, res) => {
	try {
		const { GuestStoreSession } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		doc.cartItems = (doc.cartItems || []).filter(
			(c: any) => String(c.productId) !== req.params.productId,
		);
		await doc.save();
		res.json({ ok: true });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal menghapus item' });
	}
});

router.post('/cart/draft', async (req, res) => {
	try {
		const { GuestStoreSession } = resolveModels(req);
		const { doc } = await getOrCreateGuestSession(req, res);
		const b = req.body || {};
		doc.checkoutDraft = {
			customerName: String(b.customerName || ''),
			customerPhone: String(b.customerPhone || ''),
			fulfillment: b.fulfillment === 'delivery' ? 'delivery' : b.fulfillment === 'pickup' ? 'pickup' : '',
			shippingAddress: String(b.shippingAddress || ''),
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
				'orderNo invoiceAccessToken items subtotal total taxAmount taxPercent fulfillment customerName customerPhone shippingAddress status createdAt',
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

router.post('/checkout', async (req, res) => {
	try {
		const { StoreProduct, StoreOrder } = resolveModels(req);
		const body = req.body || {};
		const itemsIn = Array.isArray(body.items) ? body.items : [];
		if (!itemsIn.length) return res.status(400).json({ message: 'Keranjang kosong' });

		const customerName = String(body.customerName || '').trim();
		const customerPhone = String(body.customerPhone || '').trim();
		const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup';
		const shippingAddress = String(body.shippingAddress || '').trim();

		if (!customerName || !customerPhone) {
			return res.status(400).json({ message: 'Nama dan nomor WA wajib' });
		}
		if (fulfillment === 'delivery' && !shippingAddress) {
			return res.status(400).json({ message: 'Alamat pengiriman wajib untuk pengiriman' });
		}

		const settings: any = await ensureSettings(req);
		const globalWa = normalizeWaDigits(settings.whatsappPhone || '');
		if (!globalWa) return res.status(400).json({ message: 'Nomor WhatsApp toko belum diatur' });

		const defCur = normalizeStoreCurrency(settings.defaultCurrency);

		const lines: any[] = [];
		let subtotal = 0;
		for (const row of itemsIn) {
			const pid = row.productId;
			const qty = Math.max(1, parseInt(String(row.qty || 1), 10) || 1);
			const p = await StoreProduct.findById(pid).lean();
			if (!p || !p.published) continue;
			const currency = effectiveProductCurrency(p, defCur);
			const lineSubtotal = lineSubtotalForProduct(p, qty);
			const unitPrice = lineSubtotal / qty;
			subtotal += lineSubtotal;
			lines.push({
				productId: p._id,
				name: p.name,
				slug: p.slug,
				qty,
				unitPrice,
				lineSubtotal,
				currency,
				_stock: p.stock,
			});
		}
		if (!lines.length) return res.status(400).json({ message: 'Tidak ada produk valid' });

		const decremented: { id: any; qty: number }[] = [];
		try {
			for (const line of lines) {
				if (isStoreStockUnlimited(line._stock)) continue;
				const r = await StoreProduct.updateOne(
					{ _id: line.productId, stock: { $gte: line.qty } },
					{ $inc: { stock: -line.qty } },
				);
				if (r.modifiedCount !== 1) {
					throw new Error('STOCK');
				}
				decremented.push({ id: line.productId, qty: line.qty });
			}
		} catch (e) {
			for (const d of decremented.reverse()) {
				await StoreProduct.updateOne({ _id: d.id }, { $inc: { stock: d.qty } });
			}
			if ((e as Error).message === 'STOCK') {
				return res.status(400).json({ message: 'Stok tidak mencukupi untuk salah satu produk' });
			}
			throw e;
		}

		const orderCurrencies = new Set(lines.map((l) => l.currency));
		if (orderCurrencies.size > 1) {
			return res.status(400).json({
				message:
					'Checkout memakai beberapa mata uang sekaligus. Kosongkan keranjang dan beli per mata uang.',
			});
		}
		const orderCur = lines[0].currency || defCur;

		const taxPercent = settings.taxEnabled ? Number(settings.taxPercent || 0) : 0;
		const taxAmount = settings.taxEnabled ? Math.round((subtotal * taxPercent) / 100) : 0;
		const total = subtotal + taxAmount;

		const orderNo = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`;
		const invoiceAccessToken = crypto.randomBytes(24).toString('hex');

		const base = publicBaseUrl(req);
		const storePath = normalizeStorePath(settings?.navbarPath);
		const invoiceUrl = `${base}${storePath}/order/${encodeURIComponent(orderNo)}?inv=${encodeURIComponent(invoiceAccessToken)}`;
		const itemsText = lines
			.map(
				(l) =>
					`• ${l.name} x${l.qty} — ${formatStoreMoney(l.lineSubtotal, l.currency)} (${base}${storePath}/${l.slug})`,
			)
			.join('\n');

		const storeAddr =
			lines.length === 1
				? String((await StoreProduct.findById(lines[0].productId).lean())?.storeAddressOverride || '') ||
					settings.storeAddress ||
					''
				: settings.storeAddress || '';

		const tplBase = String(settings.checkoutMessageTemplate || '');
		const tpl = tplBase.includes('{{invoiceUrl}}')
			? tplBase
			: `${tplBase}${tplBase.trim() ? '\n\n' : ''}Lihat invoice: {{invoiceUrl}}`;
		const msg = applyTemplate(tpl, {
			items: itemsText,
			subtotal: formatStoreMoney(subtotal, orderCur),
			taxPercent: String(taxPercent),
			tax: formatStoreMoney(taxAmount, orderCur),
			total: formatStoreMoney(total, orderCur),
			fulfillment: fulfillment === 'delivery' ? 'Diantar' : 'Ambil di tempat',
			address:
				fulfillment === 'delivery'
					? shippingAddress
					: storeAddr || '(ambil di toko)',
			customerName,
			customerPhone,
			orderNo,
			invoiceUrl,
		});

		const { doc: sessDoc, sessionKeyHash } = await getOrCreateGuestSession(req, res);

		const orderItems = lines.map(({ _stock, ...rest }: any) => rest);
		const order = await StoreOrder.create({
			orderNo,
			invoiceAccessToken,
			guestSessionKeyHash: sessionKeyHash,
			items: orderItems,
			subtotal,
			taxPercent,
			taxAmount,
			total,
			fulfillment,
			customerName,
			customerPhone,
			shippingAddress: fulfillment === 'delivery' ? shippingAddress : '',
			storeAddressSnapshot: storeAddr,
			whatsappPhoneUsed: globalWa,
			whatsappMessageSnapshot: msg,
			status: 'pending',
		});

		const cart = sessDoc.cartItems || [];
		for (const line of lines) {
			const pid = String(line.productId);
			const q = Math.max(1, Math.floor(Number(line.qty) || 1));
			const idx = cart.findIndex((c: any) => String(c.productId) === pid);
			if (idx < 0) continue;
			cart[idx].qty = Math.max(0, Math.floor(Number(cart[idx].qty) || 0) - q);
			if (cart[idx].qty <= 0) cart.splice(idx, 1);
		}
		sessDoc.cartItems = cart;
		await sessDoc.save();

		const waUrl = `https://wa.me/${globalWa}?text=${encodeURIComponent(msg)}`;

		res.json({
			order: stripInvoiceTokenFromOrder(order.toObject()),
			whatsappUrl: waUrl,
			invoiceUrl,
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Checkout gagal' });
	}
});

router.post('/direct-checkout', async (req, res) => {
	try {
		const { StoreProduct, StoreOrder } = resolveModels(req);
		const body = req.body || {};
		const productId = body.productId;
		const qty = Math.max(1, parseInt(String(body.qty || 1), 10) || 1);

		const customerName = String(body.customerName || '').trim();
		const customerPhone = String(body.customerPhone || '').trim();
		const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup';
		const shippingAddress = String(body.shippingAddress || '').trim();

		if (!customerName || !customerPhone) {
			return res.status(400).json({ message: 'Nama dan nomor WA wajib' });
		}
		if (fulfillment === 'delivery' && !shippingAddress) {
			return res.status(400).json({ message: 'Alamat pengiriman wajib untuk pengiriman' });
		}

		const p = await StoreProduct.findById(productId).lean();
		if (!p || !p.published) {
			return res.status(400).json({ message: 'Produk tidak tersedia' });
		}

		const settings: any = await ensureSettings(req);
		const itemWa = normalizeWaDigits(p.whatsappPhoneOverride || '');
		const globalWa = normalizeWaDigits(settings.whatsappPhone || '');
		const waNumber = itemWa || globalWa;
		if (!waNumber) {
			return res.status(400).json({ message: 'Nomor WhatsApp belum diatur' });
		}

		const defCur = normalizeStoreCurrency(settings.defaultCurrency);
		const currency = effectiveProductCurrency(p, defCur);
		const lineSubtotal = lineSubtotalForProduct(p, qty);
		const unitPrice = lineSubtotal / qty;
		const subtotal = lineSubtotal;

		if (!isStoreStockUnlimited(p.stock)) {
			const r = await StoreProduct.updateOne(
				{ _id: p._id, stock: { $gte: qty } },
				{ $inc: { stock: -qty } },
			);
			if (r.modifiedCount !== 1) {
				return res.status(400).json({ message: 'Stok tidak mencukupi' });
			}
		}

		const taxPercent = settings.taxEnabled ? Number(settings.taxPercent || 0) : 0;
		const taxAmount = settings.taxEnabled ? Math.round((subtotal * taxPercent) / 100) : 0;
		const total = subtotal + taxAmount;

		const orderNo = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`;
		const invoiceAccessToken = crypto.randomBytes(24).toString('hex');

		const base = publicBaseUrl(req);
		const storePath = normalizeStorePath(settings?.navbarPath);
		const invoiceUrl = `${base}${storePath}/order/${encodeURIComponent(orderNo)}?inv=${encodeURIComponent(invoiceAccessToken)}`;
		const productUrl = `${base}${storePath}/${p.slug}`;
		const itemsText = `• ${p.name} x${qty} — ${formatStoreMoney(lineSubtotal, currency)} (${productUrl})`;

		const storeAddr = String(p.storeAddressOverride || '').trim() || settings.storeAddress || '';

		const tplBase = String(settings.checkoutMessageTemplate || '');
		const tpl = tplBase.includes('{{invoiceUrl}}')
			? tplBase
			: `${tplBase}${tplBase.trim() ? '\n\n' : ''}Lihat invoice: {{invoiceUrl}}`;
		const msg = applyTemplate(tpl, {
			items: itemsText,
			subtotal: formatStoreMoney(subtotal, currency),
			taxPercent: String(taxPercent),
			tax: formatStoreMoney(taxAmount, currency),
			total: formatStoreMoney(total, currency),
			fulfillment: fulfillment === 'delivery' ? 'Diantar' : 'Ambil di tempat',
			address:
				fulfillment === 'delivery'
					? shippingAddress
					: storeAddr || '(ambil di toko)',
			customerName,
			customerPhone,
			orderNo,
			invoiceUrl,
		});

		const { doc: sessDoc, sessionKeyHash } = await getOrCreateGuestSession(req, res);

		const order = await StoreOrder.create({
			orderNo,
			invoiceAccessToken,
			guestSessionKeyHash: sessionKeyHash,
			items: [
				{
					productId: p._id,
					name: p.name,
					slug: p.slug,
					qty,
					unitPrice,
					lineSubtotal,
					currency,
				},
			],
			subtotal,
			taxPercent,
			taxAmount,
			total,
			fulfillment,
			customerName,
			customerPhone,
			shippingAddress: fulfillment === 'delivery' ? shippingAddress : '',
			storeAddressSnapshot: storeAddr,
			whatsappPhoneUsed: waNumber,
			whatsappMessageSnapshot: msg,
			status: 'pending',
		});

		sessDoc.checkoutDraft = {
			customerName,
			customerPhone,
			fulfillment,
			shippingAddress: fulfillment === 'delivery' ? shippingAddress : '',
		};
		await sessDoc.save();

		const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;

		res.json({
			order: stripInvoiceTokenFromOrder(order.toObject()),
			whatsappUrl: waUrl,
			invoiceUrl,
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Checkout langsung gagal' });
	}
});

router.post('/buy-link', async (req, res) => {
	try {
		const { StoreProduct } = resolveModels(req);
		const productId = req.body?.productId;
		const qty = Math.max(1, parseInt(String(req.body?.qty || 1), 10) || 1);
		const p = await StoreProduct.findById(productId).lean();
		if (!p || !p.published) return res.status(400).json({ message: 'Produk tidak tersedia' });

		const settings: any = await ensureSettings(req);
		const itemWa = normalizeWaDigits(p.whatsappPhoneOverride || '');
		const globalWa = normalizeWaDigits(settings.whatsappPhone || '');
		const wa = itemWa || globalWa;
		if (!wa) return res.status(400).json({ message: 'Nomor WhatsApp belum diatur' });

		const base = publicBaseUrl(req);
		const storePath = normalizeStorePath(settings?.navbarPath);
		const url = `${base}${storePath}/${p.slug}`;
		const tpl =
			p.buyMessageTemplateOverride?.trim() ||
			settings.defaultBuyMessageTemplate ||
			'Halo, saya tertarik membeli:\n\n{{productName}}\nHarga: {{price}}\nJumlah: {{qty}}\nLink: {{url}}';

		const defCur = normalizeStoreCurrency(settings.defaultCurrency);
		const itemCur = effectiveProductCurrency(p, defCur);
		const lineTotal = lineSubtotalForProduct(p, qty);
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

		const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
		res.json({ whatsappUrl: waUrl, message: msg });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Gagal membuat link WhatsApp' });
	}
});

export default router;
