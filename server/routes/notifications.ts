import { Router } from 'express';
import crypto from 'crypto';
import { NotifPreference, WebPushSubscription } from '../../db/mongodb';
import { authenticate, authenticateOptional } from '../auth';

const router = Router();
const GUEST_PEPPER = process.env.GUEST_KEY_PEPPER || 'hmps-comment-pepper';
function hashGuestKey(secret: string): string {
	return crypto.createHmac('sha256', GUEST_PEPPER).update(secret).digest('hex');
}

const DEFAULT_CHANNEL = { inApp: true, webPush: true, email: false };

router.get('/preferences', authenticate, async (req, res) => {
	try {
		const user = req.user as any;
		let pref = await NotifPreference.findOne({ userId: user._id }).lean();
		if (!pref) {
			pref = {
				news: { ...DEFAULT_CHANNEL },
				event: { ...DEFAULT_CHANNEL },
				commentReply: { ...DEFAULT_CHANNEL },
				feedbackReply: { ...DEFAULT_CHANNEL },
				bugReply: { inApp: true, webPush: true, email: true },
			} as any;
		}
		res.json(pref);
	} catch (error) {
		console.error('Error fetching notification preferences:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.patch('/preferences', authenticate, async (req, res) => {
	try {
		const user = req.user as any;
		const { news, event, commentReply, feedbackReply, bugReply } = req.body;
		const update: Record<string, any> = {};

		for (const [key, val] of Object.entries({
			news,
			event,
			commentReply,
			feedbackReply,
			bugReply,
		})) {
			if (val && typeof val === 'object') {
				for (const ch of ['inApp', 'webPush', 'email'] as const) {
					if (typeof (val as any)[ch] === 'boolean') {
						update[`${key}.${ch}`] = (val as any)[ch];
					}
				}
			}
		}

		if (Object.keys(update).length === 0) {
			return res
				.status(400)
				.json({ message: 'Tidak ada field valid untuk diperbarui' });
		}

		const pref = await NotifPreference.findOneAndUpdate(
			{ userId: user._id },
			{ $set: update },
			{ upsert: true, new: true },
		).lean();
		res.json(pref);
	} catch (error) {
		console.error('Error updating notification preferences:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.post('/webpush/subscribe', authenticateOptional, async (req, res) => {
	try {
		const { endpoint, keys, preferences, guestSecret } = req.body;
		if (!endpoint || !keys?.p256dh || !keys?.auth) {
			return res
				.status(400)
				.json({ message: 'endpoint dan keys (p256dh, auth) diperlukan' });
		}

		const tenantSlug = (req as any).tenantSlug || '';
		const userId = (req as any).user?._id || null;
		const currentVapidPublic =
			process.env.VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '';
		const guestKeyHash =
			typeof guestSecret === 'string' && guestSecret.trim()
				? hashGuestKey(guestSecret.trim())
				: '';
		const sanitizeWebPushPref = (src: any) => {
			const keys = ['news', 'event', 'commentReply', 'feedbackReply', 'bugReply'] as const;
			const out: Record<string, { webPush: boolean }> = {};
			for (const key of keys) {
				const val = src?.[key]?.webPush;
				if (typeof val === 'boolean') out[key] = { webPush: val };
			}
			return out;
		};
		const normalizedPrefs = sanitizeWebPushPref(preferences);
		await WebPushSubscription.findOneAndUpdate(
			{ endpoint },
			{
				$set: {
					userId,
					guestKeyHash,
					keys,
					userAgent: req.headers['user-agent'] || '',
					tenantSlug,
					vapidPublicKey: currentVapidPublic,
					isActive: true,
					lastSeenAt: new Date(),
					...(Object.keys(normalizedPrefs).length > 0
						? { preferences: normalizedPrefs }
						: {}),
				},
			},
			{ upsert: true },
		);

		// Keep guest subscriptions clean: one active endpoint per guest identity + tenant.
		// This prevents legacy/stale endpoints from staying active forever.
		if (guestKeyHash) {
			await WebPushSubscription.updateMany(
				{
					guestKeyHash,
					tenantSlug,
					isActive: true,
					endpoint: { $ne: endpoint },
				},
				{ $set: { isActive: false } },
			);
		}
		res.json({ message: 'Subscribed' });
	} catch (error) {
		console.error('Error subscribing web push:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.delete('/webpush/unsubscribe', authenticateOptional, async (req, res) => {
	try {
		const { endpoint } = req.body;
		if (!endpoint) {
			return res.status(400).json({ message: 'endpoint diperlukan' });
		}
		await WebPushSubscription.updateOne(
			{ endpoint },
			{ $set: { isActive: false } },
		);
		res.json({ message: 'Unsubscribed' });
	} catch (error) {
		console.error('Error unsubscribing web push:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.get('/webpush/vapid-key', (_req, res) => {
	const publicKey =
		process.env.VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '';
	res.json({ publicKey });
});

export default router;
