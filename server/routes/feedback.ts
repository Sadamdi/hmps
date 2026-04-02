import crypto from 'crypto';
import type { Request } from 'express';
import { Router } from 'express';
import { authenticate, requirePermission } from '../auth';
import { feedbackRateLimiter } from '../middleware/public-rate-limit';
import { mongoStorage } from '../mongo-storage';
import { sendFeedbackReplyEmail, sendFeedbackDecisionEmail } from '../services/email';
import { uploadMiddleware, uploadFeedbackImage } from '../upload';

const router = Router();

function resolveStorage(req: Request): any {
	return (req as any).tenantStorage || mongoStorage;
}

const GUEST_PEPPER = process.env.GUEST_KEY_PEPPER || 'hmps-comment-pepper';

function hashGuestKey(secret: string): string {
	return crypto.createHmac('sha256', GUEST_PEPPER).update(secret).digest('hex');
}

// ── Public endpoints ──

// POST /api/feedback — submit feedback (multipart/form-data)
router.post('/', feedbackRateLimiter, uploadMiddleware.array('media', 10), async (req, res) => {
	try {
		const { target, type, body, isAnonymous: isAnonRaw, senderName, senderNim, senderEmail } = req.body;
		const isAnonymous = isAnonRaw === 'true' || isAnonRaw === true;

		let ratings: any = {};
		try {
			ratings = typeof req.body.ratings === 'string' ? JSON.parse(req.body.ratings) : (req.body.ratings || {});
		} catch { ratings = {}; }

		if (!target || !type || !body?.trim()) {
			return res.status(400).json({ message: 'target, type, dan body wajib diisi' });
		}

		const validTargets = ['web', 'himatif_encoder', 'prodi_ti_umalang'];
		const validTypes = ['saran', 'kritik'];
		if (!validTargets.includes(target)) return res.status(400).json({ message: 'target tidak valid' });
		if (!validTypes.includes(type)) return res.status(400).json({ message: 'type harus saran atau kritik' });

		if (!isAnonymous) {
			if (!senderName?.trim()) return res.status(400).json({ message: 'Nama wajib diisi untuk feedback non-anonim' });
			if (!senderNim?.trim()) return res.status(400).json({ message: 'NIM wajib diisi untuk feedback non-anonim' });
			if (!senderEmail?.trim()) return res.status(400).json({ message: 'Email wajib diisi untuk feedback non-anonim' });
		}

		const sanitizedRatings = {
			fasilitasTI: Math.min(5, Math.max(0, Number(ratings?.fasilitasTI) || 0)),
			website: Math.min(5, Math.max(0, Number(ratings?.website) || 0)),
			teknikInformatika: Math.min(5, Math.max(0, Number(ratings?.teknikInformatika) || 0)),
			himatifEncoder: Math.min(5, Math.max(0, Number(ratings?.himatifEncoder) || 0)),
		};

		const mediaFiles = (req.files as Express.Multer.File[]) || [];
		const media: { url: string; originalName: string }[] = [];
		for (const file of mediaFiles) {
			try {
				const result = await uploadFeedbackImage(file);
				media.push(result);
			} catch (err) {
				console.error('Failed to process feedback media:', err);
			}
		}

		const guestKey = req.headers['x-guest-key'] as string | undefined;
		const guestKeyHash = guestKey ? hashGuestKey(guestKey) : null;

		const feedback = await resolveStorage(req).createFeedback({
			target,
			type,
			body: body.trim(),
			isAnonymous,
			senderName: isAnonymous ? '' : senderName.trim(),
			senderNim: isAnonymous ? '' : senderNim.trim(),
			senderEmail: isAnonymous ? '' : senderEmail.trim().toLowerCase(),
			ratings: sanitizedRatings,
			media,
			guestKeyHash,
			isVisibleCard: true,
		});

		res.status(201).json({ message: 'Feedback berhasil dikirim', _id: feedback._id });
	} catch (error) {
		console.error('Error creating feedback:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// GET /api/feedback/public — visible feedback cards for public display
router.get('/public', async (req, res) => {
	try {
		const storage = resolveStorage(req);
		const settings: any = await storage.getSettings();
		const typeFilter = settings?.feedbackPublicTypeFilter || 'all';
		const cards = await storage.getVisibleFeedbackCardsFiltered(typeFilter);

		const guestKey = req.headers['x-guest-key'] as string | undefined;
		const guestHash = guestKey ? hashGuestKey(guestKey) : null;

		const sanitized = cards.map((c: any) => {
			const isOwn = !!(guestHash && c.guestKeyHash === guestHash);
			return {
				_id: c._id,
				target: c.target,
				type: c.type,
				body: c.body,
				isAnonymous: c.isAnonymous,
				senderName: c.isAnonymous ? '' : c.senderName,
				media: (c.media || []).map((m: any) => ({ url: m.url, originalName: m.originalName })),
				reply: c.reply ? { adminName: c.reply.adminName, message: c.reply.message, repliedAt: c.reply.repliedAt } : null,
				suggestionStatus: c.type === 'saran' ? (c.suggestionStatus || 'pending') : undefined,
				suggestionDecisionComment: c.type === 'saran' ? (c.suggestionDecisionComment || '') : undefined,
				suggestionDeciderName: c.type === 'saran' ? (c.suggestionDeciderName || '') : undefined,
				isOwn,
				createdAt: c.createdAt,
			};
		});
		res.json(sanitized);
	} catch (error) {
		console.error('Error fetching public feedback:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// GET /api/feedback/ratings — public rating averages
router.get('/ratings', async (req, res) => {
	try {
		const averages = await resolveStorage(req).getFeedbackRatingAverages();
		res.json(averages);
	} catch (error) {
		console.error('Error fetching rating averages:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Own endpoints (guest can edit/delete own feedback) ──

// PATCH /api/feedback/own/:id — edit own feedback
router.patch('/own/:id', feedbackRateLimiter, async (req, res) => {
	try {
		const guestKey = req.headers['x-guest-key'] as string | undefined;
		if (!guestKey) return res.status(401).json({ message: 'x-guest-key header required' });

		const storage = resolveStorage(req);
		const feedback = await storage.getFeedbackById(req.params.id);
		if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

		if (!feedback.guestKeyHash || hashGuestKey(guestKey) !== feedback.guestKeyHash) {
			return res.status(403).json({ message: 'Not authorized' });
		}

		const { body } = req.body;
		const updateData: any = {};
		if (body !== undefined) updateData.body = body.trim();

		const updated = await storage.updateFeedback(req.params.id, updateData);
		res.json(updated);
	} catch (error) {
		console.error('Error editing own feedback:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// DELETE /api/feedback/own/:id — delete own feedback
router.delete('/own/:id', feedbackRateLimiter, async (req, res) => {
	try {
		const guestKey = req.headers['x-guest-key'] as string | undefined;
		if (!guestKey) return res.status(401).json({ message: 'x-guest-key header required' });

		const storage = resolveStorage(req);
		const feedback = await storage.getFeedbackById(req.params.id);
		if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

		if (!feedback.guestKeyHash || hashGuestKey(guestKey) !== feedback.guestKeyHash) {
			return res.status(403).json({ message: 'Not authorized' });
		}

		await storage.deleteFeedback(req.params.id);
		res.json({ message: 'Feedback deleted' });
	} catch (error) {
		console.error('Error deleting own feedback:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Dashboard endpoints (require auth + permission) ──

// GET /api/feedback/manage — list all feedback for dashboard
router.get(
	'/manage',
	authenticate,
	requirePermission('feedback.view'),
	async (req, res) => {
		try {
			const { target, type, hasReply, page, limit } = req.query;
			const options: any = {};
			if (target) options.target = target as string;
			if (type) options.type = type as string;
			if (hasReply === 'true') options.hasReply = true;
			if (hasReply === 'false') options.hasReply = false;
			if (page) options.page = parseInt(page as string, 10);
			if (limit) options.limit = parseInt(limit as string, 10);

			const storage = resolveStorage(req);
			const feedback = await storage.getAllFeedback(options);
			const count = await storage.getFeedbackCount({ target: options.target, type: options.type });
			res.json({ items: feedback, total: count });
		} catch (error) {
			console.error('Error fetching managed feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

// GET /api/feedback/manage/ratings — rating summary for dashboard
router.get(
	'/manage/ratings',
	authenticate,
	requirePermission('feedback.view'),
	async (req, res) => {
		try {
			const averages = await resolveStorage(req).getFeedbackRatingAverages();
			res.json(averages);
		} catch (error) {
			console.error('Error fetching rating summary:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

// PATCH /api/feedback/manage/:id/visibility — toggle card visibility
router.patch(
	'/manage/:id/visibility',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const { visible } = req.body;
			if (typeof visible !== 'boolean') {
				return res.status(400).json({ message: 'visible (boolean) required' });
			}
			const updated = await resolveStorage(req).toggleFeedbackVisibility(req.params.id, visible);
			if (!updated) return res.status(404).json({ message: 'Feedback not found' });
			res.json(updated);
		} catch (error) {
			console.error('Error toggling feedback visibility:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

// POST /api/feedback/manage/:id/reply — admin reply to feedback
router.post(
	'/manage/:id/reply',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const { message } = req.body;
			if (!message?.trim()) {
				return res.status(400).json({ message: 'message wajib diisi' });
			}

			const user = req.user as any;
			const storage = resolveStorage(req);
			const feedback = await storage.getFeedbackById(req.params.id);
			if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

			const updated = await storage.replyToFeedback(req.params.id, {
				adminId: user._id.toString(),
				adminName: user.name || user.username,
				message: message.trim(),
			});

			if (!feedback.isAnonymous && feedback.senderEmail) {
				try {
					await sendFeedbackReplyEmail({
						to: feedback.senderEmail,
						senderName: feedback.senderName,
						feedbackBody: feedback.body,
						replyMessage: message.trim(),
						adminName: user.name || user.username,
					});
				} catch (emailErr) {
					console.error('Failed to send feedback reply email:', emailErr);
				}
			}

			res.json(updated);
		} catch (error) {
			console.error('Error replying to feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

// POST /api/feedback/manage/:id/decision — accept or reject a suggestion (saran only)
router.post(
	'/manage/:id/decision',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const { status, comment } = req.body;
			if (!status || !['accepted', 'rejected'].includes(status)) {
				return res.status(400).json({ message: 'status harus accepted atau rejected' });
			}

			const storage = resolveStorage(req);
			const feedback = await storage.getFeedbackById(req.params.id);
			if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

			if (feedback.type !== 'saran') {
				return res.status(400).json({ message: 'Accept/reject hanya berlaku untuk Saran' });
			}

			const user = req.user as any;
			const updated = await storage.decideSuggestion(req.params.id, {
				status,
				comment: (comment || '').trim(),
				decidedBy: user._id.toString(),
				deciderName: user.name || user.username,
			});

			if (!feedback.isAnonymous && feedback.senderEmail) {
				try {
					await sendFeedbackDecisionEmail({
						to: feedback.senderEmail,
						senderName: feedback.senderName,
						feedbackBody: feedback.body,
						decision: status as 'accepted' | 'rejected',
						decisionComment: (comment || '').trim(),
						adminName: user.name || user.username,
					});
				} catch (emailErr) {
					console.error('Failed to send feedback decision email:', emailErr);
				}
			}

			res.json(updated);
		} catch (error) {
			console.error('Error deciding feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

// PATCH /api/feedback/manage/:id — edit feedback
router.patch(
	'/manage/:id',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const { body, target, type } = req.body;
			const updateData: any = {};
			if (body !== undefined) updateData.body = body;
			if (target !== undefined) updateData.target = target;
			if (type !== undefined) updateData.type = type;

			const updated = await resolveStorage(req).updateFeedback(req.params.id, updateData);
			if (!updated) return res.status(404).json({ message: 'Feedback not found' });
			res.json(updated);
		} catch (error) {
			console.error('Error updating feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

// DELETE /api/feedback/manage/:id — delete feedback
router.delete(
	'/manage/:id',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			await resolveStorage(req).deleteFeedback(req.params.id);
			res.json({ message: 'Feedback deleted' });
		} catch (error) {
			console.error('Error deleting feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

export default router;
