import {
	NotifPreference,
	UserNotification,
	WebPushSubscription,
} from '../../db/mongodb';

export type NotifEventType =
	| 'news_published'
	| 'event_ongoing'
	| 'comment_reply'
	| 'feedback_reply'
	| 'bug_reply';

const EVENT_TO_PREF_KEY: Record<NotifEventType, string> = {
	news_published: 'news',
	event_ongoing: 'event',
	comment_reply: 'commentReply',
	feedback_reply: 'feedbackReply',
	bug_reply: 'bugReply',
};

export interface NotifPayload {
	title: string;
	description?: string;
	actionUrl?: string;
	entityType?: string;
	entityId?: string;
	entityTitle?: string;
	/** Absolute or relative URL to a thumbnail image (berita/event). */
	image?: string;
	/** Small icon override (fallback: site logo). */
	icon?: string;
	/** Short tag shown in some browsers (e.g. "Berita", "Event"). */
	tag?: string;
}

export interface NotifRecipient {
	userId: string;
	email?: string;
	isAnonymous?: boolean;
	tenantSlug?: string;
	guestKeyHash?: string;
}

export interface NotifActor {
	userId: string;
	name: string;
}

function notifLog(tag: string, data: Record<string, unknown>) {
	console.log(`[notif-orchestrator] ${tag}:`, JSON.stringify(data));
}

async function getWebPushClient(): Promise<any> {
	const mod: any = await import('web-push');
	const client = mod?.default || mod;
	if (
		!client ||
		typeof client.setVapidDetails !== 'function' ||
		typeof client.sendNotification !== 'function'
	) {
		throw new Error('web-push module loaded with unexpected shape');
	}
	return client;
}

async function getUserPreference(
	userId: string,
): Promise<
	Record<string, { inApp: boolean; webPush: boolean; email: boolean }>
> {
	const pref: any = await NotifPreference.findOne({ userId }).lean();
	if (!pref) {
		return {
			news: { inApp: true, webPush: true, email: false },
			event: { inApp: true, webPush: true, email: false },
			commentReply: { inApp: true, webPush: true, email: false },
			feedbackReply: { inApp: true, webPush: true, email: false },
			bugReply: { inApp: true, webPush: true, email: true },
		};
	}
	return pref;
}

async function sendInAppNotification(
	eventType: NotifEventType,
	actor: NotifActor,
	recipient: NotifRecipient,
	payload: NotifPayload,
	NotifModel?: any,
): Promise<void> {
	const Model = NotifModel || UserNotification;
	await Model.create({
		userId: recipient.userId,
		type: eventType,
		title: payload.title,
		description: payload.description || '',
		entityType: payload.entityType || '',
		entityId: payload.entityId || null,
		entityTitle: payload.entityTitle || '',
		fromUserId: actor.userId,
		fromUserName: actor.name,
		actionUrl: payload.actionUrl || '',
		image: payload.image || '',
		tag: payload.tag || '',
	});
}

function getVapidConfig() {
	const vapidPublic =
		process.env.VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
	const vapidPrivate =
		process.env.VAPID_PRIVATE_KEY || process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
	const vapidSubject =
		process.env.VAPID_SUBJECT ||
		process.env.WEB_PUSH_SUBJECT ||
		'mailto:admin@himatif-encoder.com';
	return { vapidPublic, vapidPrivate, vapidSubject };
}

function buildPushPayload(payload: NotifPayload): string {
	return JSON.stringify({
		title: payload.title,
		body: payload.description || '',
		url: payload.actionUrl || '/',
		icon: payload.icon || '',
		image: payload.image || '',
		tag: payload.tag || '',
	});
}

function shouldDeactivateSubscription(statusCode?: number): boolean {
	// 401/403: auth invalid (often VAPID mismatch)
	// 404/410: endpoint expired/unregistered
	// 422: subscription payload no longer accepted by push service
	return [401, 403, 404, 410, 422].includes(Number(statusCode));
}

function endpointSuffix(endpoint: string): string {
	if (!endpoint) return 'unknown-endpoint';
	return endpoint.slice(Math.max(0, endpoint.length - 48));
}

function shouldDeactivateByVapidMismatch(sub: any, currentVapidPublic?: string): boolean {
	const subVapid = String(sub?.vapidPublicKey || '');
	const current = String(currentVapidPublic || '');
	if (!current) return false;
	if (!subVapid) return false; // legacy rows without fingerprint are handled by HTTP status checks.
	return subVapid !== current;
}

async function handleWebPushError(
	sub: any,
	err: any,
	stats: { failed: number; expired: number },
	context: string,
) {
	const statusCode = Number(err?.statusCode || 0);
	const suffix = endpointSuffix(String(sub?.endpoint || ''));
	if (shouldDeactivateSubscription(statusCode)) {
		await WebPushSubscription.updateOne(
			{ _id: sub?._id },
			{ $set: { isActive: false } },
		);
		stats.expired++;
		notifLog('webpush-deactivated', {
			context,
			statusCode,
			endpointSuffix: suffix,
		});
		return;
	}
	stats.failed++;
	notifLog('webpush-failed', {
		context,
		statusCode,
		endpointSuffix: suffix,
		message: String(err?.message || ''),
	});
}

async function sendWebPush(
	recipient: NotifRecipient,
	payload: NotifPayload,
): Promise<{ sent: number; failed: number; expired: number }> {
	const stats = { sent: 0, failed: 0, expired: 0 };
	const subs = await WebPushSubscription.find({
		userId: recipient.userId,
		isActive: true,
	}).lean();

	if (subs.length === 0) return stats;

	const { vapidPublic, vapidPrivate, vapidSubject } = getVapidConfig();
	if (!vapidPublic || !vapidPrivate) return stats;

	try {
		const webpush = await getWebPushClient();
		webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

		const pushPayload = buildPushPayload(payload);
		const pushOptions = { TTL: 12 * 60 * 60, urgency: 'high' as const };

		for (const sub of subs) {
			try {
				if (shouldDeactivateByVapidMismatch(sub, vapidPublic)) {
					await WebPushSubscription.updateOne(
						{ _id: (sub as any)._id },
						{ $set: { isActive: false } },
					);
					stats.expired++;
					notifLog('webpush-deactivated', {
						context: 'dispatch-user-vapid-mismatch',
						endpointSuffix: endpointSuffix(String((sub as any).endpoint || '')),
					});
					continue;
				}
				await webpush.sendNotification(
					{ endpoint: (sub as any).endpoint, keys: (sub as any).keys },
					pushPayload,
					pushOptions,
				);
				stats.sent++;
			} catch (err: any) {
				await handleWebPushError(sub, err, stats, 'dispatch-user');
			}
		}
	} catch (err) {
		console.error('Web push send error:', err);
	}
	return stats;
}

async function sendWebPushToGuest(
	guestKeyHash: string,
	payload: NotifPayload,
	eventType: NotifEventType,
	tenantSlug?: string,
): Promise<{ sent: number; failed: number; expired: number; skipped: number }> {
	const stats = { sent: 0, failed: 0, expired: 0, skipped: 0 };
	if (!guestKeyHash) return stats;
	const filter: Record<string, any> = {
		guestKeyHash,
		isActive: true,
		userId: null,
	};
	if (tenantSlug) filter.tenantSlug = tenantSlug;
	const subs = await WebPushSubscription.find(filter).lean();
	if (subs.length === 0) return stats;
	const { vapidPublic, vapidPrivate, vapidSubject } = getVapidConfig();
	if (!vapidPublic || !vapidPrivate) return stats;
	try {
		const webpush = await getWebPushClient();
		webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
		const pushPayload = buildPushPayload(payload);
		const pushOptions = { TTL: 12 * 60 * 60, urgency: 'high' as const };
		const prefKey = EVENT_TO_PREF_KEY[eventType];
		for (const sub of subs) {
			const topicChannel = (sub as any)?.preferences?.[prefKey] || {
				webPush: true,
			};
			if (!topicChannel.webPush) {
				stats.skipped++;
				continue;
			}
			try {
				if (shouldDeactivateByVapidMismatch(sub, vapidPublic)) {
					await WebPushSubscription.updateOne(
						{ _id: (sub as any)._id },
						{ $set: { isActive: false } },
					);
					stats.expired++;
					notifLog('webpush-deactivated', {
						context: 'dispatch-guest-vapid-mismatch',
						endpointSuffix: endpointSuffix(String((sub as any).endpoint || '')),
					});
					continue;
				}
				await webpush.sendNotification(
					{ endpoint: (sub as any).endpoint, keys: (sub as any).keys },
					pushPayload,
					pushOptions,
				);
				stats.sent++;
			} catch (err: any) {
				await handleWebPushError(sub, err, stats, 'dispatch-guest');
			}
		}
	} catch (err) {
		console.error('Web push guest send error:', err);
	}
	return stats;
}

async function sendEmailNotification(
	recipient: NotifRecipient,
	payload: NotifPayload,
	_actor: NotifActor,
): Promise<void> {
	if (!recipient.email || recipient.isAnonymous) return;

	try {
		const { sendFeedbackReplyEmail } = await import('./email');
		await sendFeedbackReplyEmail({
			to: recipient.email,
			senderName: '',
			feedbackBody: payload.description || payload.title,
			replyMessage: payload.title,
			adminName: _actor.name,
		});
	} catch (err) {
		console.error('Email notification failed (non-blocking):', err);
	}
}

export async function dispatchNotification(
	eventType: NotifEventType,
	actor: NotifActor,
	recipient: NotifRecipient,
	payload: NotifPayload,
	options?: { NotifModel?: any; skipEmail?: boolean },
): Promise<void> {
	const prefKey = EVENT_TO_PREF_KEY[eventType];
	const prefs = await getUserPreference(recipient.userId);
	const topicPref = (prefs as any)[prefKey] || {
		inApp: true,
		webPush: true,
		email: false,
	};

	notifLog('dispatch', {
		eventType,
		recipientId: recipient.userId,
		prefKey,
		channels: topicPref,
	});

	if (topicPref.inApp) {
		try {
			await sendInAppNotification(
				eventType,
				actor,
				recipient,
				payload,
				options?.NotifModel,
			);
			notifLog('dispatch-inapp', { eventType, recipientId: recipient.userId, ok: true });
		} catch (err) {
			console.error(`In-app notification failed for ${eventType}:`, err);
		}
	}

	if (topicPref.webPush) {
		try {
			const stats = await sendWebPush(recipient, payload);
			notifLog('dispatch-webpush', { eventType, recipientId: recipient.userId, ...stats });
		} catch (err) {
			console.error(`Web push failed for ${eventType}:`, err);
		}
	}

	if (topicPref.email && !options?.skipEmail) {
		try {
			await sendEmailNotification(recipient, payload, actor);
		} catch (err) {
			console.error(`Email notification failed for ${eventType}:`, err);
		}
	}
}

export async function broadcastNotification(
	eventType: NotifEventType,
	actor: NotifActor,
	payload: NotifPayload,
	options?: { tenantSlug?: string },
): Promise<void> {
	const prefKey = EVENT_TO_PREF_KEY[eventType];

	const subFilter: Record<string, any> = { isActive: true };
	if (options?.tenantSlug) {
		subFilter.tenantSlug = options.tenantSlug;
	}

	const allSubs = await WebPushSubscription.find(subFilter).lean();
	const { vapidPublic, vapidPrivate, vapidSubject } = getVapidConfig();

	notifLog('broadcast-start', {
		eventType,
		totalActiveSubs: allSubs.length,
		hasVapid: !!(vapidPublic && vapidPrivate),
		tenantSlug: options?.tenantSlug || 'all',
	});

	if (allSubs.length === 0 || !vapidPublic || !vapidPrivate) return;

	const stats = { sent: 0, skipped: 0, expired: 0, failed: 0 };

	try {
		const webpush = await getWebPushClient();
		webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

		const pushPayload = buildPushPayload(payload);
		const pushOptions = { TTL: 12 * 60 * 60, urgency: 'high' as const };

		for (const sub of allSubs) {
			try {
				const userId = (sub as any).userId;
				let topicChannel: any = { webPush: true };

				if (userId) {
					const subPref: any = await NotifPreference.findOne({ userId }).lean();
					topicChannel = subPref?.[prefKey] || topicChannel;
				} else {
					topicChannel = (sub as any)?.preferences?.[prefKey] || topicChannel;
				}

				if (!topicChannel.webPush) {
					stats.skipped++;
					continue;
				}

				if (shouldDeactivateByVapidMismatch(sub, vapidPublic)) {
					await WebPushSubscription.updateOne(
						{ _id: (sub as any)._id },
						{ $set: { isActive: false } },
					);
					stats.expired++;
					notifLog('webpush-deactivated', {
						context: 'broadcast-vapid-mismatch',
						endpointSuffix: endpointSuffix(String((sub as any).endpoint || '')),
					});
					continue;
				}

				await webpush.sendNotification(
					{ endpoint: (sub as any).endpoint, keys: (sub as any).keys },
					pushPayload,
					pushOptions,
				);
				stats.sent++;
			} catch (err: any) {
				await handleWebPushError(sub, err, stats, 'broadcast');
			}
		}
	} catch (err) {
		console.error('Broadcast web push error:', err);
	}

	notifLog('broadcast-done', { eventType, ...stats });
}

export async function dispatchGuestNotification(
	eventType: NotifEventType,
	guestKeyHash: string,
	payload: NotifPayload,
	options?: { tenantSlug?: string },
): Promise<void> {
	try {
		const stats = await sendWebPushToGuest(
			guestKeyHash,
			payload,
			eventType,
			options?.tenantSlug,
		);
		notifLog('dispatch-guest-webpush', {
			eventType,
			tenantSlug: options?.tenantSlug || 'all',
			...stats,
		});
	} catch (err) {
		console.error(`Guest web push failed for ${eventType}:`, err);
	}
}
