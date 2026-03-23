import crypto from 'crypto';
import { Router } from 'express';
import { Berita, Comment, Event, Library } from '../../db/mongodb';
import { authenticate, authenticateOptional, requirePermission } from '../auth';
import { commentRateLimiter } from '../middleware/public-rate-limit';
import { mongoStorage } from '../mongo-storage';

const router = Router();

const GUEST_PEPPER = process.env.GUEST_KEY_PEPPER || 'hmps-comment-pepper';

function hashGuestKey(secret: string): string {
	return crypto.createHmac('sha256', GUEST_PEPPER).update(secret).digest('hex');
}

async function verifyTargetExists(
	targetType: string,
	targetId: string,
	requirePublished: boolean,
): Promise<boolean> {
	try {
		if (targetType === 'berita') {
			const doc: any = await Berita.findById(targetId).lean();
			return doc ? (!requirePublished || doc.published === true) : false;
		}
		if (targetType === 'event') {
			const doc: any = await Event.findById(targetId).lean();
			return doc ? (!requirePublished || doc.published === true) : false;
		}
		if (targetType === 'library') {
			const doc: any = await Library.findById(targetId).lean();
			return !!doc;
		}
	} catch {
		return false;
	}
	return false;
}

async function collectDescendantIds(rootId: string): Promise<string[]> {
	const ids: string[] = [];
	let queue = [rootId];
	while (queue.length > 0) {
		const children = await Comment.find({ parentId: { $in: queue } })
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

		const comments = await Comment.find({
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
		const count = await Comment.countDocuments({
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

		const exists = await verifyTargetExists(targetType, targetId, true);
		if (!exists) {
			return res.status(404).json({ message: 'Target entity not found or not published' });
		}

		if (parentId) {
			const parent = await Comment.findById(parentId).lean();
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

		const comment = await Comment.create({
			targetType,
			targetId,
			parentId: parentId || null,
			userId,
			guestKeyHash,
			displayName: finalDisplayName,
			isAnonymous: !!isAnonymous,
			body: body.trim(),
		});

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

		const comment: any = await Comment.findById(id);
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

		const comment: any = await Comment.findById(id);
		if (!comment) {
			return res.status(404).json({ message: 'Comment not found' });
		}

		const user = req.user as any;
		let authorized = false;

		// Check moderator permission (effective permissions with overrides)
		if (user) {
			const effectivePerms = await mongoStorage.getUserPermissions(String(user._id));
			if (effectivePerms.includes('comments.manage')) {
				authorized = true;
			}
		}

		// Check ownership
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

		// Cascade: delete all descendant replies
		const descendantIds = await collectDescendantIds(id);
		if (descendantIds.length > 0) {
			await Comment.deleteMany({ _id: { $in: descendantIds } });
		}
		await Comment.findByIdAndDelete(id);

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

			const comments = await Comment.find(filter)
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
