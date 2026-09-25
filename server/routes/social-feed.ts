import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import {
	DEFAULT_SOCIAL_FEED_CACHE,
	normalizeSocialFeedConfig,
	type SocialFeedLogEntry,
	type SocialPlatform,
} from '../../shared/social-feed';
import { authenticate, requirePermission } from '../auth';
import { mongoStorage } from '../mongo-storage';
import { lastInstagrapiError } from '../services/instagram-instagrapi';
import { instagramSessionStatus } from '../services/instagram-session';
import {
	persistSocialFeedSync,
	publicSocialFeedItems,
	publicSocialFeedPayload,
	runSocialFeedSync,
} from '../services/social-feed';

const router = Router();

function resolveStorage(req: Request): any {
	return (req as any).tenantStorage || mongoStorage;
}

function storageKey(req: Request): string {
	return req.tenantSlug ? `tenant:${req.tenantSlug}` : 'main';
}

function leanSettings(settings: any) {
	if (!settings) return {};
	return typeof settings.toObject === 'function' ? settings.toObject() : settings;
}

function readLogs(settings: any): SocialFeedLogEntry[] {
	return Array.isArray(settings?.socialFeedLogs) ? settings.socialFeedLogs : [];
}

/** Waktu cron harian berikutnya (02:30 WIB = 19:30 UTC). */
function nextScheduledSync(now = new Date()): string {
	const next = new Date(now);
	next.setUTCHours(19, 30, 0, 0);
	if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
	return next.toISOString();
}

// ---------- Public ----------

router.get('/', async (req, res) => {
	try {
		const settings = leanSettings(await resolveStorage(req).getSettings());
		const cache = settings.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;
		res.json({ success: true, data: publicSocialFeedPayload(settings.socialFeedConfig, cache) });
	} catch (error) {
		console.error('GET /api/social-feed error:', error);
		res.status(500).json({
			success: false,
			message: 'Gagal memuat social feed',
			error: { code: 'SOCIAL_FEED_READ_FAILED' },
		});
	}
});

const itemsQuery = z.object({
	platform: z.enum(['youtube', 'instagram']),
	kind: z.string().max(10).optional().default('all'),
	offset: z.coerce.number().int().min(0).max(1000).optional().default(0),
	limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});

router.get('/items', async (req, res) => {
	const parsed = itemsQuery.safeParse(req.query);
	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			message: 'Parameter tidak valid',
			error: { code: 'VALIDATION_ERROR', details: parsed.error.issues.map((i) => i.message) },
		});
	}
	try {
		const { platform, kind, offset, limit } = parsed.data;
		const settings = leanSettings(await resolveStorage(req).getSettings());
		const cache = settings.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;
		const result = publicSocialFeedItems(settings.socialFeedConfig, cache, platform, kind, offset, limit);
		res.json({
			success: true,
			message: 'OK',
			data: result.items,
			meta: {
				offset,
				limit,
				total: result.total,
				counts: result.counts,
				profileUrl: result.profileUrl,
				username: result.username,
				enabled: result.enabled,
				syncedAt: result.syncedAt,
			},
		});
	} catch (error) {
		console.error('GET /api/social-feed/items error:', error);
		res.status(500).json({
			success: false,
			message: 'Gagal memuat item social feed',
			error: { code: 'SOCIAL_FEED_ITEMS_FAILED' },
		});
	}
});

// ---------- Dashboard ----------

router.get('/manage', authenticate, requirePermission('social_feed.view'), async (req, res) => {
	try {
		const settings = leanSettings(await resolveStorage(req).getSettings());
		const config = normalizeSocialFeedConfig(settings.socialFeedConfig);
		const cache = settings.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;
		res.json({
			success: true,
			data: {
				config,
				cache,
				status: cache.status || {},
				lastSocialFeedSyncAt: settings.lastSocialFeedSyncAt || null,
				nextScheduledSyncAt: nextScheduledSync(),
				/** Hanya boolean — nilai cookie tidak pernah dikirim ke klien */
				instagramSessionConfigured: instagramSessionStatus().configured,
				instagramSession: { ...instagramSessionStatus(), instagrapiError: lastInstagrapiError },
				logs: readLogs(settings).slice(0, 20),
				preview: publicSocialFeedPayload(config, cache),
			},
		});
	} catch (error) {
		console.error('GET /api/social-feed/manage error:', error);
		res.status(500).json({
			success: false,
			message: 'Gagal memuat pengaturan social feed',
			error: { code: 'SOCIAL_FEED_MANAGE_READ_FAILED' },
		});
	}
});

router.get('/manage/logs', authenticate, requirePermission('social_feed.view'), async (req, res) => {
	try {
		const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
		const settings = leanSettings(await resolveStorage(req).getSettings());
		const logs = readLogs(settings);
		res.json({ success: true, message: 'OK', data: logs.slice(0, limit), meta: { total: logs.length, limit } });
	} catch (error) {
		console.error('GET /api/social-feed/manage/logs error:', error);
		res.status(500).json({
			success: false,
			message: 'Gagal memuat log social feed',
			error: { code: 'SOCIAL_FEED_LOGS_FAILED' },
		});
	}
});

const profileUrl = (hosts: RegExp) =>
	z
		.string()
		.trim()
		.max(300)
		.refine((v) => {
			try {
				const u = new URL(v);
				return ['http:', 'https:'].includes(u.protocol) && hosts.test(u.hostname);
			} catch {
				return false;
			}
		}, 'URL tidak valid untuk platform ini');

const manageBody = z
	.object({
		youtube: z.object({ profileOrChannelUrl: profileUrl(/(^|\.)youtube\.com$/i).optional() }).passthrough().optional(),
		instagram: z
			.object({
				profileOrChannelUrl: profileUrl(/(^|\.)instagram\.com$/i).optional(),
				manualUrls: z.union([z.array(z.string().max(300)).max(300), z.string().max(60000)]).optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

router.put('/manage', authenticate, requirePermission('social_feed.edit'), async (req, res) => {
	const body = req.body || {};
	const incoming = body.config && typeof body.config === 'object' ? body.config : body;
	const parsed = manageBody.safeParse(incoming);
	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			message: parsed.error.issues[0]?.message || 'Pengaturan tidak valid',
			error: { code: 'VALIDATION_ERROR', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
		});
	}
	try {
		const config = normalizeSocialFeedConfig(parsed.data);
		const storage = resolveStorage(req);
		const updated = await storage.updateSettings({ socialFeedConfig: config });
		const lean = leanSettings(updated);
		const cache = lean.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;
		res.json({
			success: true,
			message: 'Pengaturan social feed disimpan',
			data: { config, cache, preview: publicSocialFeedPayload(config, cache) },
		});
	} catch (error) {
		console.error('PUT /api/social-feed/manage error:', error);
		res.status(500).json({
			success: false,
			message: 'Gagal menyimpan pengaturan social feed',
			error: { code: 'SOCIAL_FEED_MANAGE_WRITE_FAILED' },
		});
	}
});

/** Cegah klik beruntun "Fetch sekarang" (scrape eksternal berat). */
const lastManualSync = new Map<string, number>();
const MANUAL_SYNC_COOLDOWN_MS = 60 * 1000;
const syncBody = z.object({ platform: z.enum(['youtube', 'instagram']).optional() }).passthrough();

router.post('/sync', authenticate, requirePermission('social_feed.sync'), async (req, res) => {
	const parsed = syncBody.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ success: false, message: 'Platform tidak valid', error: { code: 'VALIDATION_ERROR' } });
	}
	const key = storageKey(req);
	const last = lastManualSync.get(key) || 0;
	const waitMs = MANUAL_SYNC_COOLDOWN_MS - (Date.now() - last);
	if (waitMs > 0) {
		return res.status(429).json({
			success: false,
			message: `Tunggu ${Math.ceil(waitMs / 1000)} detik sebelum fetch lagi`,
			error: { code: 'SOCIAL_FEED_SYNC_COOLDOWN', details: [{ retryAfterSeconds: Math.ceil(waitMs / 1000) }] },
		});
	}
	lastManualSync.set(key, Date.now());
	try {
		const storage = resolveStorage(req);
		const settings = leanSettings(await storage.getSettings());
		const config = normalizeSocialFeedConfig(settings.socialFeedConfig);
		const previous = settings.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;
		const user: any = (req as any).user;
		const result = await runSocialFeedSync(config, previous, {
			platform: parsed.data.platform as SocialPlatform | undefined,
			trigger: 'manual',
			triggeredBy: user?.name || user?.username || user?.email || undefined,
		});
		const logs = await persistSocialFeedSync(storage, result, settings.socialFeedLogs);
		res.json({
			success: result.ok,
			message: result.ok ? 'Fetch social feed selesai' : 'Fetch selesai dengan kegagalan (data lama dipertahankan)',
			data: {
				config,
				cache: result.cache,
				status: result.cache.status || {},
				logs: logs.slice(0, 20),
				preview: publicSocialFeedPayload(config, result.cache),
				error: result.error || null,
			},
		});
	} catch (error: any) {
		console.error('POST /api/social-feed/sync error:', error);
		res.status(500).json({
			success: false,
			message: 'Gagal fetch social feed',
			error: { code: 'SOCIAL_FEED_SYNC_FAILED' },
		});
	}
});

export default router;
