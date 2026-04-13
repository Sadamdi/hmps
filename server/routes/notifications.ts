import { Router } from 'express';
import { authenticate } from '../auth';
import { NotifPreference, WebPushSubscription } from '../../db/mongodb';

const router = Router();

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

		for (const [key, val] of Object.entries({ news, event, commentReply, feedbackReply, bugReply })) {
			if (val && typeof val === 'object') {
				for (const ch of ['inApp', 'webPush', 'email'] as const) {
					if (typeof (val as any)[ch] === 'boolean') {
						update[`${key}.${ch}`] = (val as any)[ch];
					}
				}
			}
		}

		if (Object.keys(update).length === 0) {
			return res.status(400).json({ message: 'Tidak ada field valid untuk diperbarui' });
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

router.post('/webpush/subscribe', authenticate, async (req, res) => {
	try {
		const user = req.user as any;
		const { endpoint, keys } = req.body;
		if (!endpoint || !keys?.p256dh || !keys?.auth) {
			return res.status(400).json({ message: 'endpoint dan keys (p256dh, auth) diperlukan' });
		}

		const tenantSlug = (req as any).tenantSlug || '';
		await WebPushSubscription.findOneAndUpdate(
			{ endpoint },
			{
				$set: {
					userId: user._id,
					keys,
					userAgent: req.headers['user-agent'] || '',
					tenantSlug,
					isActive: true,
					lastSeenAt: new Date(),
				},
			},
			{ upsert: true },
		);
		res.json({ message: 'Subscribed' });
	} catch (error) {
		console.error('Error subscribing web push:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.delete('/webpush/unsubscribe', authenticate, async (req, res) => {
	try {
		const { endpoint } = req.body;
		if (!endpoint) {
			return res.status(400).json({ message: 'endpoint diperlukan' });
		}
		await WebPushSubscription.updateOne({ endpoint }, { $set: { isActive: false } });
		res.json({ message: 'Unsubscribed' });
	} catch (error) {
		console.error('Error unsubscribing web push:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.get('/webpush/vapid-key', (_req, res) => {
	const publicKey = process.env.VAPID_PUBLIC_KEY || '';
	res.json({ publicKey });
});

export default router;
