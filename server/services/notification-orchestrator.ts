import { NotifPreference, UserNotification, WebPushSubscription } from '../../db/mongodb';

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
}

export interface NotifRecipient {
	userId: string;
	email?: string;
	isAnonymous?: boolean;
	tenantSlug?: string;
}

export interface NotifActor {
	userId: string;
	name: string;
}

async function getUserPreference(userId: string): Promise<Record<string, { inApp: boolean; webPush: boolean; email: boolean }>> {
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
	});
}

async function sendWebPush(
	recipient: NotifRecipient,
	payload: NotifPayload,
): Promise<void> {
	const subs = await WebPushSubscription.find({
		userId: recipient.userId,
		isActive: true,
	}).lean();

	if (subs.length === 0) return;

	const vapidPublic = process.env.VAPID_PUBLIC_KEY;
	const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
	const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@himatif-encoder.com';

	if (!vapidPublic || !vapidPrivate) return;

	try {
		const webpush = await import('web-push');
		webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

		const pushPayload = JSON.stringify({
			title: payload.title,
			body: payload.description || '',
			url: payload.actionUrl || '/',
		});

		for (const sub of subs) {
			try {
				await webpush.sendNotification(
					{ endpoint: (sub as any).endpoint, keys: (sub as any).keys },
					pushPayload,
				);
			} catch (err: any) {
				if (err?.statusCode === 410 || err?.statusCode === 404) {
					await WebPushSubscription.updateOne({ _id: (sub as any)._id }, { $set: { isActive: false } });
				}
			}
		}
	} catch (err) {
		console.error('Web push send error:', err);
	}
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
	const topicPref = (prefs as any)[prefKey] || { inApp: true, webPush: true, email: false };

	if (topicPref.inApp) {
		try {
			await sendInAppNotification(eventType, actor, recipient, payload, options?.NotifModel);
		} catch (err) {
			console.error(`In-app notification failed for ${eventType}:`, err);
		}
	}

	if (topicPref.webPush) {
		try {
			await sendWebPush(recipient, payload);
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

	const allSubs = await WebPushSubscription.find({ isActive: true }).lean();
	const vapidPublic = process.env.VAPID_PUBLIC_KEY;
	const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
	const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@himatif-encoder.com';

	if (allSubs.length > 0 && vapidPublic && vapidPrivate) {
		try {
			const webpush = await import('web-push');
			webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

			const pushPayload = JSON.stringify({
				title: payload.title,
				body: payload.description || '',
				url: payload.actionUrl || '/',
			});

			for (const sub of allSubs) {
				try {
					const subPref: any = await NotifPreference.findOne({ userId: (sub as any).userId }).lean();
					const topicChannel = subPref?.[prefKey] || { webPush: true };
					if (!topicChannel.webPush) continue;

					await webpush.sendNotification(
						{ endpoint: (sub as any).endpoint, keys: (sub as any).keys },
						pushPayload,
					);
				} catch (err: any) {
					if (err?.statusCode === 410 || err?.statusCode === 404) {
						await WebPushSubscription.updateOne({ _id: (sub as any)._id }, { $set: { isActive: false } });
					}
				}
			}
		} catch (err) {
			console.error('Broadcast web push error:', err);
		}
	}
}
