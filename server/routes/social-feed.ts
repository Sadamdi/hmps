import type { Request } from 'express';
import { Router } from 'express';
import {
	DEFAULT_SOCIAL_FEED_CACHE,
	normalizeSocialFeedConfig,
	type SocialFeedConfig,
} from '../../shared/social-feed';
import { authenticate, requirePermission } from '../auth';
import { mongoStorage } from '../mongo-storage';
import {
	publicSocialFeedPayload,
	runSocialFeedSync,
} from '../services/social-feed';

const router = Router();

function resolveStorage(req: Request): any {
	return (req as any).tenantStorage || mongoStorage;
}

function leanSettings(settings: any) {
	if (!settings) return {};
	return typeof settings.toObject === 'function' ? settings.toObject() : settings;
}

router.get('/', async (req, res) => {
	try {
		const settings = leanSettings(await resolveStorage(req).getSettings());
		const config = normalizeSocialFeedConfig(settings.socialFeedConfig);
		const cache = settings.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;
		res.json({
			success: true,
			data: publicSocialFeedPayload(config, cache),
		});
	} catch (error) {
		console.error('GET /api/social-feed error:', error);
		res.status(500).json({
			success: false,
			message: 'Gagal memuat social feed',
			error: { code: 'SOCIAL_FEED_READ_FAILED' },
		});
	}
});

router.get(
	'/manage',
	authenticate,
	requirePermission('social_feed.view'),
	async (req, res) => {
		try {
			const settings = leanSettings(await resolveStorage(req).getSettings());
			const config = normalizeSocialFeedConfig(settings.socialFeedConfig);
			const cache = settings.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;
			res.json({
				success: true,
				data: {
					config,
					cache,
					lastSocialFeedSyncAt: settings.lastSocialFeedSyncAt || null,
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
	},
);

router.put(
	'/manage',
	authenticate,
	requirePermission('social_feed.edit'),
	async (req, res) => {
		try {
			const body = req.body || {};
			const incoming =
				body.config && typeof body.config === 'object' ? body.config : body;
			const config = normalizeSocialFeedConfig(incoming as Partial<SocialFeedConfig>);

			const storage = resolveStorage(req);
			const updated = await storage.updateSettings({ socialFeedConfig: config });
			const lean = leanSettings(updated);
			const cache = lean.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;

			res.json({
				success: true,
				message: 'Pengaturan social feed disimpan',
				data: {
					config: normalizeSocialFeedConfig(lean.socialFeedConfig),
					cache,
					preview: publicSocialFeedPayload(config, cache),
				},
			});
		} catch (error) {
			console.error('PUT /api/social-feed/manage error:', error);
			res.status(500).json({
				success: false,
				message: 'Gagal menyimpan pengaturan social feed',
				error: { code: 'SOCIAL_FEED_MANAGE_WRITE_FAILED' },
			});
		}
	},
);

router.post(
	'/sync',
	authenticate,
	requirePermission('social_feed.sync'),
	async (req, res) => {
		try {
			const storage = resolveStorage(req);
			const settings = leanSettings(await storage.getSettings());
			const config = normalizeSocialFeedConfig(
				req.body?.config
					? { ...settings.socialFeedConfig, ...req.body.config }
					: settings.socialFeedConfig,
			);
			const previous = settings.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;
			const result = await runSocialFeedSync(config, previous);

			await storage.updateSettings({
				socialFeedConfig: config,
				socialFeedCache: result.cache,
				lastSocialFeedSyncAt: new Date(),
			});

			res.json({
				success: result.ok,
				message: result.ok
					? 'Sync social feed selesai'
					: 'Sync selesai dengan peringatan (cache lama dipertahankan bila gagal)',
				data: {
					config,
					cache: result.cache,
					preview: publicSocialFeedPayload(config, result.cache),
					error: result.error || null,
				},
			});
		} catch (error: any) {
			console.error('POST /api/social-feed/sync error:', error);
			res.status(500).json({
				success: false,
				message: error?.message || 'Gagal sync social feed',
				error: { code: 'SOCIAL_FEED_SYNC_FAILED' },
			});
		}
	},
);

export default router;
