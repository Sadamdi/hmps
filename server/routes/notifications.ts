import { Router } from 'express';
import crypto from 'crypto';
import { NotifPreference, WebPushSubscription } from '../../db/mongodb';
import { authenticate, authenticateOptional } from '../auth';
import {
	getStreamStats,
	registerStreamClient,
} from '../services/notification-stream';

const router = Router();
const GUEST_PEPPER = process.env.GUEST_KEY_PEPPER || 'hmps-comment-pepper';
function hashGuestKey(secret: string): string {
	return crypto.createHmac('sha256', GUEST_PEPPER).update(secret).digest('hex');
}
function endpointSuffix(endpoint: string): string {
	if (!endpoint) return 'unknown-endpoint';
	return endpoint.slice(Math.max(0, endpoint.length - 48));
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
		console.log(
			'[notif-route] webpush-subscribed:',
			JSON.stringify({
				tenantSlug: tenantSlug || 'main',
				userId: userId ? String(userId) : null,
				hasGuest: !!guestKeyHash,
				endpointSuffix: endpointSuffix(String(endpoint)),
			}),
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
		console.log(
			'[notif-route] webpush-unsubscribed:',
			JSON.stringify({ endpointSuffix: endpointSuffix(String(endpoint)) }),
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

router.get('/webpush/subscription-status', authenticateOptional, async (req, res) => {
	try {
		const endpoint =
			typeof req.query.endpoint === 'string' ? req.query.endpoint.trim() : '';
		if (!endpoint) {
			return res.status(400).json({ message: 'endpoint query diperlukan' });
		}
		const row: any = await WebPushSubscription.findOne({ endpoint }).lean();
		const currentVapid =
			process.env.VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '';
		res.json({
			found: !!row,
			isActive: !!row?.isActive,
			tenantSlug: row?.tenantSlug || '',
			userId: row?.userId ? String(row.userId) : null,
			hasGuest: !!row?.guestKeyHash,
			lastSeenAt: row?.lastSeenAt || null,
			vapidMatchesCurrent: row ? String(row.vapidPublicKey || '') === String(currentVapid) : null,
			endpointSuffix: endpointSuffix(endpoint),
		});
	} catch (error) {
		console.error('Error checking web push subscription status:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

/**
 * Live realtime stream (SSE) for in-tab notifications. This complements the
 * existing web-push delivery which can be throttled by browser/OS when tabs
 * are in the background. When the tab is open we push events immediately via
 * this channel so news/events appear instantly without waiting for the OS.
 */
router.get('/stream', authenticateOptional, (req, res) => {
	const tenantSlug = (req as any).tenantSlug || '';
	const userId = ((req as any).user?._id as string | undefined) || null;
	const guestSecretRaw =
		typeof req.query.guestSecret === 'string'
			? (req.query.guestSecret as string).trim()
			: '';
	const guestKeyHash = guestSecretRaw ? hashGuestKey(guestSecretRaw) : null;

	res.status(200);
	res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
	res.setHeader('Cache-Control', 'no-cache, no-transform');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');
	// Disable idle-socket timeouts so long-lived streams are not cut off.
	if (req.socket && typeof req.socket.setTimeout === 'function') {
		try {
			req.socket.setTimeout(0);
		} catch {
			// ignore
		}
	}
	// Retry hint for browsers (ms) when the connection drops.
	res.write('retry: 5000\n\n');
	if (typeof (res as any).flushHeaders === 'function') {
		try {
			(res as any).flushHeaders();
		} catch {
			// ignore
		}
	}

	const cleanup = registerStreamClient(res, {
		tenantSlug,
		userId,
		guestKeyHash,
	});
	console.log(
		'[notif-route] stream-connected:',
		JSON.stringify({
			tenantSlug: tenantSlug || 'main',
			userId: userId ? String(userId) : null,
			hasGuest: !!guestKeyHash,
		}),
	);

	req.on('close', () => {
		cleanup();
		console.log('[notif-route] stream-disconnected:', JSON.stringify({ reason: 'req-close' }));
	});
	req.on('aborted', () => {
		cleanup();
		console.log('[notif-route] stream-disconnected:', JSON.stringify({ reason: 'req-aborted' }));
	});
	res.on('error', () => {
		cleanup();
		console.log('[notif-route] stream-disconnected:', JSON.stringify({ reason: 'res-error' }));
	});
});

/**
 * Diagnostic endpoint — only reveals aggregate counts (no client data).
 * Useful to confirm from logs that SSE connections are live.
 */
router.get('/stream/stats', (_req, res) => {
	res.json(getStreamStats());
});

export default router;
