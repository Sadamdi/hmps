import crypto from 'crypto';
import type { Request } from 'express';
import { Router } from 'express';
import { Berita, Comment, Event, Library } from '../../db/mongodb';
import { authenticate, authenticateOptional, requirePermission } from '../auth';
import { commentRateLimiter } from '../middleware/public-rate-limit';
import { mongoStorage } from '../mongo-storage';

const router = Router();

function resolveModels(req: Request) {
	const tm = (req as any).tenantModels;
	return {
		Comment: tm?.Comment || Comment,
		Berita: tm?.Berita || Berita,
		Event: tm?.Event || Event,
		Library: tm?.Library || Library,
	};
}
function resolveStorage(req: Request): any {
	return (req as any).tenantStorage || mongoStorage;
}

const GUEST_PEPPER = process.env.GUEST_KEY_PEPPER || 'hmps-comment-pepper';

function hashGuestKey(secret: string): string {
	return crypto.createHmac('sha256', GUEST_PEPPER).update(secret).digest('hex');
}

async function verifyTargetExists(
	models: ReturnType<typeof resolveModels>,
	targetType: string,
	targetId: string,
	requirePublished: boolean,
): Promise<boolean> {
	try {
		if (targetType === 'berita') {
			const doc: any = await models.Berita.findById(targetId).lean();
			return doc ? (!requirePublished || doc.published === true) : false;
		}
		if (targetType === 'event') {
			const doc: any = await models.Event.findById(targetId).lean();
			return doc ? (!requirePublished || doc.published === true) : false;
		}
		if (targetType === 'library') {
			const doc: any = await models.Library.findById(targetId).lean();
			return !!doc;
		}
	} catch {
		return false;
	}
	return false;
}

async function collectDescendantIds(CommentModel: any, rootId: string): Promise<string[]> {
	const ids: string[] = [];
	let queue = [rootId];
	while (queue.length > 0) {
		const children = await CommentModel.find({ parentId: { $in: queue } })
			.select('_id')
			.lean();
		const childIds = children.map((c: any) => c._id.toString());
		ids.push(...childIds);
		queue = childIds;
	}
	return ids;
}

// GET /api/comments?targetType=...&targetId=...
router.get('/', authenticateOptional, async (req, res) => {
	try {
		const { targetType, targetId } = req.query;
		if (!targetType || !targetId) {
			return res.status(400).json({ message: 'targetType and targetId required' });
		}

		const { Comment: CommentModel } = resolveModels(req);
		const comments = await CommentModel.find({
			targetType: targetType as string,
			targetId: targetId as string,
		})
			.sort({ createdAt: 1 })
			.lean();

		const userId = (req.user as any)?._id?.toString() || null;
		const guestKey = req.headers['x-guest-key'] as string | undefined;
		const guestHash = guestKey ? hashGuestKey(guestKey) : null;

		const sanitized = comments.map((c: any) => {
			const isOwn =
				(userId && c.userId?.toString() === userId) ||
				(!userId && guestHash && c.guestKeyHash === guestHash);
			return {
				_id: c._id,
				targetType: c.targetType,
				targetId: c.targetId,
				parentId: c.parentId,
				userId: c.userId,
				displayName: c.isAnonymous ? 'Anonim' : c.displayName,
				isAnonymous: c.isAnonymous,
				body: c.body,
				editedAt: c.editedAt,
				createdAt: c.createdAt,
				updatedAt: c.updatedAt,
				isOwn: !!isOwn,
			};
		});

		res.json(sanitized);
	} catch (error) {
		console.error('Error fetching comments:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// GET /api/comments/count?targetType=...&targetId=...
router.get('/count', async (req, res) => {
	try {
		const { targetType, targetId } = req.query;
		if (!targetType || !targetId) {
			return res.status(400).json({ message: 'targetType and targetId required' });
		}
		const { Comment: CommentModel } = resolveModels(req);
		const count = await CommentModel.countDocuments({
			targetType: targetType as string,
			targetId: targetId as string,
		});
		res.json({ count });
	} catch (error) {
		console.error('Error counting comments:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// POST /api/comments
router.post('/', commentRateLimiter, authenticateOptional, async (req, res) => {
	try {
		const { targetType, targetId, parentId, body, displayName, isAnonymous, guestSecret } = req.body;

		if (!targetType || !targetId || !body?.trim()) {
			return res.status(400).json({ message: 'targetType, targetId, and body are required' });
		}

		const models = resolveModels(req);
		const exists = await verifyTargetExists(models, targetType, targetId, true);
		if (!exists) {
			return res.status(404).json({ message: 'Target entity not found or not published' });
		}

		if (parentId) {
			const parent = await models.Comment.findById(parentId).lean();
			if (!parent) {
				return res.status(404).json({ message: 'Parent comment not found' });
			}
		}

		const user = req.user as any;
		let userId = null;
		let guestKeyHash = null;
		let finalDisplayName: string;

		if (user) {
			userId = user._id;
			finalDisplayName = isAnonymous ? 'Anonim' : (user.name || user.username);
		} else {
			if (!guestSecret) {
				return res.status(400).json({ message: 'guestSecret is required for guest comments' });
			}
			if (!isAnonymous && !displayName?.trim()) {
				return res.status(400).json({ message: 'displayName is required for non-anonymous guest comments' });
			}
			guestKeyHash = hashGuestKey(guestSecret);
			finalDisplayName = isAnonymous ? 'Anonim' : displayName.trim();
		}

		const comment = await models.Comment.create({
			targetType,
			targetId,
			parentId: parentId || null,
			userId,
			guestKeyHash,
			displayName: finalDisplayName,
			isAnonymous: !!isAnonymous,
			body: body.trim(),
		});

		if (parentId) {
			try {
				const parentComment: any = await models.Comment.findById(parentId).lean();
				if (parentComment?.userId && parentComment.userId.toString() !== (userId?.toString() || '')) {
					const { dispatchNotification } = await import('../services/notification-orchestrator');
					const tenantSlug = (req as any).tenantSlug || '';
					let NotifModel: any;
					if (tenantSlug && (req as any).tenantModels) {
						NotifModel = (req as any).tenantModels.UserNotification;
					}
					const pathPrefix = targetType === 'berita' ? 'berita' : targetType === 'event' ? 'events' : 'library';
					await dispatchNotification(
						'comment_reply',
						{ userId: userId?.toString() || 'guest', name: finalDisplayName },
						{ userId: parentComment.userId.toString(), isAnonymous: parentComment.isAnonymous, tenantSlug },
						{
							title: `${finalDisplayName} membalas komentar Anda`,
							description: body.trim().slice(0, 200),
							actionUrl: `/${pathPrefix}/${targetId}`,
							entityType: targetType,
							entityId: targetId,
							tag: 'komentar',
						},
						{ NotifModel },
					);
				}
			} catch (notifErr) {
				console.error('Comment reply notification failed:', notifErr);
			}
		}

		const result = comment.toObject();
		res.status(201).json({
			...result,
			displayName: result.isAnonymous ? 'Anonim' : result.displayName,
			isOwn: true,
		});
	} catch (error) {
		console.error('Error creating comment:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// PATCH /api/comments/:id — edit own comment
router.patch('/:id', commentRateLimiter, authenticateOptional, async (req, res) => {
	try {
		const { id } = req.params;
		const { body, guestSecret } = req.body;

		if (!body?.trim()) {
			return res.status(400).json({ message: 'body is required' });
		}

		const { Comment: CommentModel } = resolveModels(req);
		const comment: any = await CommentModel.findById(id);
		if (!comment) {
			return res.status(404).json({ message: 'Comment not found' });
		}

		const user = req.user as any;
		let authorized = false;

		if (user && comment.userId?.toString() === user._id.toString()) {
			authorized = true;
		} else if (!comment.userId && guestSecret && comment.guestKeyHash) {
			authorized = hashGuestKey(guestSecret) === comment.guestKeyHash;
		}

		if (!authorized) {
			return res.status(403).json({ message: 'Not authorized to edit this comment' });
		}

		comment.body = body.trim();
		comment.editedAt = new Date();
		await comment.save();

		const result = comment.toObject();
		res.json({
			...result,
			displayName: result.isAnonymous ? 'Anonim' : result.displayName,
			isOwn: true,
		});
	} catch (error) {
		console.error('Error editing comment:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// DELETE /api/comments/:id — owner or moderator (comments.manage)
router.delete('/:id', commentRateLimiter, authenticateOptional, async (req, res) => {
	try {
		const { id } = req.params;
		const guestSecret = req.headers['x-guest-key'] as string | undefined;

		const { Comment: CommentModel } = resolveModels(req);
		const storage = resolveStorage(req);
		const comment: any = await CommentModel.findById(id);
		if (!comment) {
			return res.status(404).json({ message: 'Comment not found' });
		}

		const user = req.user as any;
		let authorized = false;

		if (user) {
			const effectivePerms = await storage.getUserPermissions(String(user._id));
			if (effectivePerms.includes('comments.manage')) {
				authorized = true;
			}
		}

		if (!authorized) {
			if (user && comment.userId?.toString() === user._id.toString()) {
				authorized = true;
			} else if (!comment.userId && guestSecret && comment.guestKeyHash) {
				authorized = hashGuestKey(guestSecret) === comment.guestKeyHash;
			}
		}

		if (!authorized) {
			return res.status(403).json({ message: 'Not authorized to delete this comment' });
		}

		const descendantIds = await collectDescendantIds(CommentModel, id);
		if (descendantIds.length > 0) {
			await CommentModel.deleteMany({ _id: { $in: descendantIds } });
		}
		await CommentModel.findByIdAndDelete(id);

		res.json({ message: 'Comment deleted', deletedCount: 1 + descendantIds.length });
	} catch (error) {
		console.error('Error deleting comment:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// Dashboard: GET /api/comments/manage?targetType=...&targetId=...
// Requires authentication + comments.manage permission
router.get(
	'/manage',
	authenticate,
	requirePermission('comments.manage'),
	async (req, res) => {
		try {
			const { targetType, targetId } = req.query;
			const filter: any = {};
			if (targetType) filter.targetType = targetType;
			if (targetId) filter.targetId = targetId;

			const { Comment: CommentModel } = resolveModels(req);
			const comments = await CommentModel.find(filter)
				.sort({ createdAt: 1 })
				.lean();

			res.json(
				comments.map((c: any) => ({
					_id: c._id,
					targetType: c.targetType,
					targetId: c.targetId,
					parentId: c.parentId,
					userId: c.userId,
					displayName: c.displayName,
					isAnonymous: c.isAnonymous,
					body: c.body,
					editedAt: c.editedAt,
					createdAt: c.createdAt,
					updatedAt: c.updatedAt,
				})),
			);
		} catch (error) {
			console.error('Error fetching managed comments:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

export default router;
