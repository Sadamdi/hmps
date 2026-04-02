import type { Request } from 'express';
import { Router } from 'express';
import { authenticate } from '../auth';
import { Berita, Event, Library, PostSharing, UserNotification, User } from '../../db/mongodb';
import { mongoStorage } from '../mongo-storage';
import type { SharingEntityType } from '../../shared/schema';

const router = Router();

function resolveModels(req: Request) {
	const tm = (req as any).tenantModels;
	return {
		Berita: tm?.Berita || Berita,
		Event: tm?.Event || Event,
		Library: tm?.Library || Library,
		PostSharing: tm?.PostSharing || PostSharing,
		UserNotification: tm?.UserNotification || UserNotification,
		User: tm?.User || User,
	};
}
function resolveStorage(req: Request): any {
	return (req as any).tenantStorage || mongoStorage;
}

const EXPIRY_DAYS = 3;

function expiresAt(): Date {
	const d = new Date();
	d.setDate(d.getDate() + EXPIRY_DAYS);
	return d;
}

interface AuthUser {
	_id: string;
	username: string;
	name: string;
	role: string;
}

async function getEntityOwnerIds(
	storage: any,
	SharingModel: any,
	entityType: SharingEntityType,
	entityId: string,
): Promise<string[]> {
	const ownerIds: string[] = [];
	if (entityType === 'berita') {
		const item = await storage.getBeritaById(entityId);
		if (item?.authorId) ownerIds.push(String(item.authorId));
	} else if (entityType === 'events') {
		const item = await storage.getEventById(entityId);
		if (item?.createdBy) ownerIds.push(String(item.createdBy));
	} else if (entityType === 'library') {
		const item = await storage.getLibraryItemById(entityId);
		if (item?.authorId) ownerIds.push(String(item.authorId));
	}

	let effectiveEntityIds = [entityId];
	if (entityType === 'events') {
		const chain: string[] = [entityId];
		let current = await storage.getEventById(entityId);
		while (current && (current as any).parentId) {
			const parentId = String((current as any).parentId);
			chain.push(parentId);
			current = await storage.getEventById(parentId);
		}
		effectiveEntityIds = chain;
	}

	const editShares = await SharingModel.find({
		entityType,
		entityId:
			effectiveEntityIds.length > 1
				? { $in: effectiveEntityIds }
				: entityId,
		status: 'approved',
		permission: 'edit',
	}).lean();
	for (const s of editShares) {
		const tid = String(s.targetId);
		if (!ownerIds.includes(tid)) ownerIds.push(tid);
	}
	return ownerIds;
}

async function getEntityBaseOwnerIds(
	storage: any,
	entityType: SharingEntityType,
	entityId: string,
): Promise<string[]> {
	const ownerIds: string[] = [];
	if (entityType === 'berita') {
		const item = await storage.getBeritaById(entityId);
		if (item?.authorId) ownerIds.push(String(item.authorId));
	} else if (entityType === 'events') {
		const item = await storage.getEventById(entityId);
		if (item?.createdBy) ownerIds.push(String(item.createdBy));
	} else if (entityType === 'library') {
		const item = await storage.getLibraryItemById(entityId);
		if (item?.authorId) ownerIds.push(String(item.authorId));
	}
	return ownerIds;
}

async function getEntityTitle(
	storage: any,
	entityType: SharingEntityType,
	entityId: string,
): Promise<string> {
	if (entityType === 'berita') {
		const item = await storage.getBeritaById(entityId);
		return item?.title || 'Berita';
	} else if (entityType === 'events') {
		const item = await storage.getEventById(entityId);
		return item?.title || 'Event';
	} else if (entityType === 'library') {
		const item = await storage.getLibraryItemById(entityId);
		return item?.title || 'Galeri';
	}
	return '';
}

async function createNotification(NotifModel: any, data: {
	userId: string;
	type: string;
	title: string;
	description?: string;
	entityType?: string;
	entityId?: string;
	entityTitle?: string;
	sharingId?: string;
	fromUserId?: string;
	fromUserName?: string;
	actionUrl?: string;
}) {
	const notif = new NotifModel(data);
	await notif.save();
	return notif;
}

async function expirePendingShares(SharingModel: any, NotifModel: any, storage: any) {
	const now = new Date();
	const expired = await SharingModel.find({
		status: 'pending',
		expiresAt: { $lte: now },
	}).lean();

	if (expired.length > 0) {
		await SharingModel.updateMany(
			{ status: 'pending', expiresAt: { $lte: now } },
			{ $set: { status: 'expired' } },
		);

		for (const share of expired) {
			const entityTitle = await getEntityTitle(
				storage,
				share.entityType as SharingEntityType,
				String(share.entityId),
			);
			const notifyUserId =
				share.kind === 'invite'
					? String(share.targetId)
					: String(share.requesterId);
			await createNotification(NotifModel, {
				userId: notifyUserId,
				type: 'sharing_expired',
				title: `Permintaan sharing kedaluwarsa`,
				description: `Permintaan ${share.permission} untuk "${entityTitle}" telah kedaluwarsa setelah ${EXPIRY_DAYS} hari.`,
				entityType: share.entityType,
				entityId: String(share.entityId),
				entityTitle,
				sharingId: String(share._id),
			});
		}
	}
}

// NOTE: handler GET /api/sharing/:entityType/:entityId dipindahkan ke bawah
// supaya tidak bentrok dengan route fixed seperti `/users/search`.

// POST /api/sharing/:entityType/:entityId/invite
router.post('/:entityType/:entityId/invite', authenticate, async (req, res) => {
	try {
		const m = resolveModels(req);
		const storage = resolveStorage(req);
		await expirePendingShares(m.PostSharing, m.UserNotification, storage);

		const { entityType, entityId } = req.params;
		const { targetUserId, permission } = req.body;
		const user = req.user as AuthUser;

		if (!targetUserId || !permission) {
			return res.status(400).json({ message: 'targetUserId and permission are required' });
		}
		if (!['view', 'edit'].includes(permission)) {
			return res.status(400).json({ message: 'permission must be view or edit' });
		}

		const ownerIds = await getEntityOwnerIds(
			storage, m.PostSharing,
			entityType as SharingEntityType,
			entityId,
		);
		if (!ownerIds.includes(String(user._id))) {
			return res.status(403).json({ message: 'Only owners can invite' });
		}

		if (targetUserId === String(user._id)) {
			return res.status(400).json({ message: 'Cannot invite yourself' });
		}

		const targetUser = await m.User.findById(targetUserId, 'name username').lean();
		if (!targetUser) {
			return res.status(404).json({ message: 'Target user not found' });
		}

		const existingApproved = await m.PostSharing.find({
			entityType,
			entityId,
			targetId: targetUserId,
			status: 'approved',
		}).sort({ createdAt: -1 });
		if (existingApproved.length > 0) {
			const baseOwnerIds = await getEntityBaseOwnerIds(
				storage,
				entityType as SharingEntityType,
				entityId,
			);
			if (!baseOwnerIds.includes(String(user._id))) {
				return res.status(403).json({
					message: 'Only the original owner can change granted access',
				});
			}

			const now = new Date();
			const primary = existingApproved[0];
			primary.permission = permission;
			primary.requesterId = user._id as any;
			primary.kind = 'invite';
			primary.decidedBy = user._id as any;
			primary.decidedAt = now;
			await primary.save();

			const duplicateIds = existingApproved
				.slice(1)
				.map((s) => s._id)
				.filter(Boolean);
			if (duplicateIds.length > 0) {
				await m.PostSharing.updateMany(
					{ _id: { $in: duplicateIds } },
					{
						$set: {
							status: 'revoked',
							decidedBy: user._id,
							decidedAt: now,
						},
					},
				);
			}
			await m.PostSharing.updateMany(
				{
					entityType,
					entityId,
					targetId: targetUserId,
					status: 'pending',
				},
				{
					$set: {
						status: 'revoked',
						decidedBy: user._id,
						decidedAt: now,
					},
				},
			);

			const entityTitle = await getEntityTitle(
				storage,
				entityType as SharingEntityType,
				entityId,
			);
			await createNotification(m.UserNotification, {
				userId: targetUserId,
				type: 'sharing_approved',
				title: `Akses diperbarui menjadi ${permission} untuk "${entityTitle}"`,
				description: `${user.name} mengubah akses Anda menjadi ${permission === 'edit' ? 'edit' : 'lihat'} untuk "${entityTitle}".`,
				entityType,
				entityId,
				entityTitle,
				sharingId: String(primary._id),
				fromUserId: String(user._id),
				fromUserName: user.name,
			});

			return res.json({
				message: 'Access permission updated',
				sharing: primary,
			});
		}

		const existingPendingInvite = await m.PostSharing.findOne({
			entityType,
			entityId,
			targetId: targetUserId,
			status: 'pending',
			kind: 'invite',
		});
		if (existingPendingInvite) {
			if (existingPendingInvite.permission === permission) {
				return res.status(409).json({ message: 'Invite already pending' });
			}
			existingPendingInvite.permission = permission;
			existingPendingInvite.requesterId = user._id as any;
			existingPendingInvite.expiresAt = expiresAt();
			await existingPendingInvite.save();
			return res.json({
				message: 'Invite updated',
				sharing: existingPendingInvite,
			});
		}

		const share = new m.PostSharing({
			entityType,
			entityId,
			kind: 'invite',
			requesterId: user._id,
			targetId: targetUserId,
			permission,
			status: 'pending',
			expiresAt: expiresAt(),
		});
		await share.save();

		const entityTitle = await getEntityTitle(
			storage,
			entityType as SharingEntityType,
			entityId,
		);

		await createNotification(m.UserNotification, {
			userId: targetUserId,
			type: 'sharing_invite',
			title: `Undangan ${permission} untuk "${entityTitle}"`,
			description: `${user.name} mengundang Anda untuk ${permission === 'edit' ? 'mengedit' : 'melihat'} ${entityType === 'berita' ? 'berita' : entityType === 'events' ? 'event' : 'galeri'} "${entityTitle}".`,
			entityType,
			entityId,
			entityTitle,
			sharingId: String(share._id),
			fromUserId: String(user._id),
			fromUserName: user.name,
			actionUrl: `/dashboard/${entityType === 'events' ? 'events' : entityType === 'berita' ? 'berita' : 'library'}`,
		});

		try {
			const { logActivity } = await import('../models/activity');
			await logActivity({
				type: 'berita',
				action: 'create',
				title: `Sharing invite dikirim`,
				description: `${user.name} mengundang ${(targetUser as any).name} untuk ${permission} "${entityTitle}"`,
				userId: user._id as any,
				userName: user.name,
				userRole: user.role,
				entityId,
				entityTitle,
			});
		} catch {}

		res.status(201).json({ message: 'Invite sent', sharing: share });
	} catch (error) {
		console.error('Create invite error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// POST /api/sharing/:entityType/:entityId/request
router.post(
	'/:entityType/:entityId/request',
	authenticate,
	async (req, res) => {
		try {
			const m = resolveModels(req);
			const storage = resolveStorage(req);
			await expirePendingShares(m.PostSharing, m.UserNotification, storage);

			const { entityType, entityId } = req.params;
			const { permission } = req.body;
			const user = req.user as AuthUser;

			if (!permission || !['view', 'edit'].includes(permission)) {
				return res
					.status(400)
					.json({ message: 'permission must be view or edit' });
			}

			const ownerIds = await getEntityOwnerIds(
				storage, m.PostSharing,
				entityType as SharingEntityType,
				entityId,
			);
			if (ownerIds.includes(String(user._id))) {
				return res
					.status(400)
					.json({ message: 'You already own this content' });
			}

			const pendingRecords = await m.PostSharing.find({
				entityType,
				entityId,
				status: 'pending',
				targetId: user._id,
			});
			const ownPendingRequests = pendingRecords.filter(
				(p: any) =>
					p.kind === 'request' &&
					String(p.requesterId) === String(user._id),
			);
			if (ownPendingRequests.length > 0) {
				const hasDifferentPermission = ownPendingRequests.some(
					(p: any) => p.permission !== permission,
				);
				if (!hasDifferentPermission) {
					return res.status(409).json({
						message: 'Request already pending',
					});
				}

				const ownPendingIds = ownPendingRequests.map((p: any) => p._id);
				const nextExpiry = expiresAt();
				await m.PostSharing.updateMany(
					{ _id: { $in: ownPendingIds } },
					{
						$set: {
							permission,
							expiresAt: nextExpiry,
						},
					},
				);

				const updatedSharing = await m.PostSharing.findById(ownPendingIds[0]);
				const entityTitle = await getEntityTitle(
					storage,
					entityType as SharingEntityType,
					entityId,
				);

				for (const ownerId of ownerIds) {
					await createNotification(m.UserNotification, {
						userId: ownerId,
						type: 'sharing_request_updated',
						title: `Permintaan diubah ke ${permission} untuk "${entityTitle}"`,
						description: `${user.name} mengubah permintaan akses menjadi ${permission === 'edit' ? 'edit' : 'lihat'} untuk ${entityType === 'berita' ? 'berita' : entityType === 'events' ? 'event' : 'galeri'} "${entityTitle}".`,
						entityType,
						entityId,
						entityTitle,
						sharingId: updatedSharing?._id
							? String(updatedSharing._id)
							: undefined,
						fromUserId: String(user._id),
						fromUserName: user.name,
						actionUrl: `/dashboard/${entityType === 'events' ? 'events' : entityType === 'berita' ? 'berita' : 'library'}`,
					});
				}

				return res.json({
					message: 'Request updated',
					sharing: updatedSharing,
				});
			}

			if (pendingRecords.length > 0) {
				return res.status(409).json({
					message: 'A pending invite/request already exists',
				});
			}

			const approvedShares = await m.PostSharing.find({
				entityType,
				entityId,
				targetId: user._id,
				status: 'approved',
			}).lean();
			const hasApprovedEdit = approvedShares.some((s: any) => s.permission === 'edit');
			const hasApprovedView = approvedShares.some((s: any) => s.permission === 'view');

			if (hasApprovedEdit) {
				return res.status(409).json({ message: 'You already have edit access' });
			}
			if (hasApprovedView && permission === 'view') {
				return res.status(409).json({ message: 'You already have access' });
			}

			const primaryOwnerId = ownerIds[0];
			if (!primaryOwnerId) {
				return res.status(404).json({ message: 'No owner found' });
			}

			const share = new m.PostSharing({
				entityType,
				entityId,
				kind: 'request',
				requesterId: user._id,
				targetId: user._id,
				permission,
				status: 'pending',
				expiresAt: expiresAt(),
			});
			await share.save();

			const entityTitle = await getEntityTitle(
				storage,
				entityType as SharingEntityType,
				entityId,
			);

			for (const ownerId of ownerIds) {
				await createNotification(m.UserNotification, {
					userId: ownerId,
					type: 'sharing_request',
					title: `Permintaan ${permission} untuk "${entityTitle}"`,
					description: `${user.name} meminta akses ${permission === 'edit' ? 'edit' : 'lihat'} untuk ${entityType === 'berita' ? 'berita' : entityType === 'events' ? 'event' : 'galeri'} "${entityTitle}".`,
					entityType,
					entityId,
					entityTitle,
					sharingId: String(share._id),
					fromUserId: String(user._id),
					fromUserName: user.name,
					actionUrl: `/dashboard/${entityType === 'events' ? 'events' : entityType === 'berita' ? 'berita' : 'library'}`,
				});
			}

			try {
				const { logActivity } = await import('../models/activity');
				await logActivity({
					type: 'berita',
					action: 'create',
					title: `Sharing request dikirim`,
					description: `${user.name} meminta akses ${permission} untuk "${entityTitle}"`,
					userId: user._id as any,
					userName: user.name,
					userRole: user.role,
					entityId,
					entityTitle,
				});
			} catch {}

			res.status(201).json({ message: 'Request sent', sharing: share });
		} catch (error) {
			console.error('Create request error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

// POST /api/sharing/decision/:sharingId
router.post('/decision/:sharingId', authenticate, async (req, res) => {
	try {
		const m = resolveModels(req);
		const storage = resolveStorage(req);
		await expirePendingShares(m.PostSharing, m.UserNotification, storage);

		const { sharingId } = req.params;
		const { decision } = req.body;
		const user = req.user as AuthUser;

		if (!decision || !['approve', 'decline'].includes(decision)) {
			return res
				.status(400)
				.json({ message: 'decision must be approve or decline' });
		}

		const share = await m.PostSharing.findById(sharingId);
		if (!share) {
			return res.status(404).json({ message: 'Sharing record not found' });
		}
		if (share.status !== 'pending') {
			return res
				.status(400)
				.json({ message: `Cannot decide on a ${share.status} sharing` });
		}

		const ownerIds = await getEntityOwnerIds(
			storage, m.PostSharing,
			share.entityType as SharingEntityType,
			String(share.entityId),
		);

		if (share.kind === 'invite') {
			if (String(share.targetId) !== String(user._id)) {
				return res
					.status(403)
					.json({ message: 'Only the invited user can accept/decline' });
			}
		} else {
			if (!ownerIds.includes(String(user._id))) {
				return res
					.status(403)
					.json({ message: 'Only owners can approve/decline requests' });
			}
		}

		const newStatus = decision === 'approve' ? 'approved' : 'declined';
		share.status = newStatus;
		share.decidedBy = user._id as any;
		share.decidedAt = new Date();
		await share.save();
		if (newStatus === 'approved') {
			const decidedAt = new Date();
			await m.PostSharing.updateMany(
				{
					entityType: share.entityType,
					entityId: share.entityId,
					targetId: share.targetId,
					status: 'approved',
					_id: { $ne: share._id },
				},
				{
					$set: {
						status: 'revoked',
						decidedBy: user._id,
						decidedAt,
					},
				},
			);
			await m.PostSharing.updateMany(
				{
					entityType: share.entityType,
					entityId: share.entityId,
					targetId: share.targetId,
					status: 'pending',
					_id: { $ne: share._id },
				},
				{
					$set: {
						status: 'revoked',
						decidedBy: user._id,
						decidedAt,
					},
				},
			);
		}

		const entityTitle = await getEntityTitle(
			storage,
			share.entityType as SharingEntityType,
			String(share.entityId),
		);

		if (share.kind === 'invite') {
			await createNotification(m.UserNotification, {
				userId: String(share.requesterId),
				type:
					newStatus === 'approved'
						? 'sharing_approved'
						: 'sharing_declined',
				title:
					newStatus === 'approved'
						? `Undangan diterima untuk "${entityTitle}"`
						: `Undangan ditolak untuk "${entityTitle}"`,
				description: `${user.name} ${newStatus === 'approved' ? 'menerima' : 'menolak'} undangan ${share.permission} untuk "${entityTitle}".`,
				entityType: share.entityType,
				entityId: String(share.entityId),
				entityTitle,
				sharingId: String(share._id),
				fromUserId: String(user._id),
				fromUserName: user.name,
			});
		} else {
			await createNotification(m.UserNotification, {
				userId: String(share.requesterId),
				type:
					newStatus === 'approved'
						? 'sharing_approved'
						: 'sharing_declined',
				title:
					newStatus === 'approved'
						? `Permintaan akses disetujui untuk "${entityTitle}"`
						: `Permintaan akses ditolak untuk "${entityTitle}"`,
				description: `${user.name} ${newStatus === 'approved' ? 'menyetujui' : 'menolak'} permintaan ${share.permission} Anda untuk "${entityTitle}".`,
				entityType: share.entityType,
				entityId: String(share.entityId),
				entityTitle,
				sharingId: String(share._id),
				fromUserId: String(user._id),
				fromUserName: user.name,
			});
		}

		try {
			const { logActivity } = await import('../models/activity');
			await logActivity({
				type: 'berita',
				action: 'update',
				title: `Sharing ${newStatus}`,
				description: `${user.name} ${newStatus === 'approved' ? 'menyetujui' : 'menolak'} sharing ${share.permission} untuk "${entityTitle}"`,
				userId: user._id as any,
				userName: user.name,
				userRole: user.role,
				entityId: String(share.entityId),
				entityTitle,
			});
		} catch {}

		res.json({ message: `Sharing ${newStatus}`, sharing: share });
	} catch (error) {
		console.error('Sharing decision error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// DELETE /api/sharing/:entityType/:entityId/access/:userId
router.delete(
	'/:entityType/:entityId/access/:userId',
	authenticate,
	async (req, res) => {
		try {
			const m = resolveModels(req);
			const storage = resolveStorage(req);
			const { entityType, entityId, userId: revokeUserId } = req.params;
			const user = req.user as AuthUser;

			const ownerIds = await getEntityOwnerIds(
				storage, m.PostSharing,
				entityType as SharingEntityType,
				entityId,
			);
			const isSelf = String(user._id) === revokeUserId;
			const isOwner = ownerIds.includes(String(user._id));

			if (!isSelf && !isOwner) {
				return res.status(403).json({
					message: 'Only the owner or the user themselves can revoke access',
				});
			}

			const activeShareFilter: any = {
				entityType,
				entityId,
				status: { $nin: ['revoked', 'declined', 'expired'] },
				$or: [
					{ targetId: revokeUserId },
					{ kind: 'request', requesterId: revokeUserId },
				],
			};
			const activeShares = await m.PostSharing.find(activeShareFilter).sort({
				createdAt: -1,
			});

			if (activeShares.length === 0) {
				return res.status(404).json({ message: 'No active sharing found' });
			}

			const now = new Date();
			await m.PostSharing.updateMany(
				activeShareFilter,
				{
					$set: {
						status: 'revoked',
						decidedBy: user._id,
						decidedAt: now,
					},
				},
			);
			const share = activeShares[0];

			const entityTitle = await getEntityTitle(
				storage,
				entityType as SharingEntityType,
				entityId,
			);

			const notifyUserId = isSelf
				? ownerIds[0]
				: revokeUserId;
			if (notifyUserId) {
				const revokedUser = await m.User.findById(revokeUserId, 'name').lean();
				await createNotification(m.UserNotification, {
					userId: notifyUserId,
					type: 'sharing_revoked',
					title: `Akses dicabut untuk "${entityTitle}"`,
					description: isSelf
						? `${user.name} menghapus aksesnya sendiri untuk "${entityTitle}".`
						: `${user.name} mencabut akses ${(revokedUser as any)?.name || 'user'} untuk "${entityTitle}".`,
					entityType,
					entityId,
					entityTitle,
					sharingId: share?._id ? String(share._id) : undefined,
					fromUserId: String(user._id),
					fromUserName: user.name,
				});
			}

			try {
				const { logActivity } = await import('../models/activity');
				await logActivity({
					type: 'berita',
					action: 'delete',
					title: `Sharing access revoked`,
					description: `Semua akses aktif untuk "${entityTitle}" pada user ini dicabut oleh ${user.name}`,
					userId: user._id as any,
					userName: user.name,
					userRole: user.role,
					entityId,
					entityTitle,
				});
			} catch {}

			res.json({ message: 'Access revoked' });
		} catch (error) {
			console.error('Revoke access error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

// GET /api/sharing/my-summary
router.get('/my-summary', authenticate, async (req, res) => {
	try {
		const m = resolveModels(req);
		const storage = resolveStorage(req);
		await expirePendingShares(m.PostSharing, m.UserNotification, storage);

		const user = req.user as AuthUser;
		const entityType = req.query.entityType as string | undefined;
		const now = new Date();

		const approvedFilter: any = {
			targetId: user._id,
			status: 'approved',
		};
		if (entityType) approvedFilter.entityType = entityType;

		const shares = await m.PostSharing.find(approvedFilter).lean();
		const summary: Record<string, string[]> = {};
		for (const s of shares) {
			if (!summary[s.entityType]) summary[s.entityType] = [];
			const eid = String(s.entityId);
			if (!summary[s.entityType].includes(eid))
				summary[s.entityType].push(eid);
		}

		const pendingFilter: any = {
			status: 'pending',
			expiresAt: { $gt: now },
			targetId: user._id,
		};
		if (entityType) pendingFilter.entityType = entityType;

		const pendingShares = await m.PostSharing.find(pendingFilter).lean();
		const pendingSummary: Record<string, string[]> = {};
		for (const s of pendingShares) {
			if (!pendingSummary[s.entityType]) pendingSummary[s.entityType] = [];
			const eid = String(s.entityId);
			if (!pendingSummary[s.entityType].includes(eid))
				pendingSummary[s.entityType].push(eid);
		}

		const hasApproved = Object.values(summary).some((arr) => arr.length > 0);
		const hasPending = Object.values(pendingSummary).some(
			(arr) => arr.length > 0,
		);

		res.json({
			hasSharedAccess: hasApproved || hasPending,
			hasPendingAccess: hasPending,
			summary,
			pendingSummary,
		});
	} catch (error) {
		console.error('Get sharing summary error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// GET /api/sharing/notifications
router.get('/notifications', authenticate, async (req, res) => {
	try {
		const user = req.user as AuthUser;
		const limit = parseInt(req.query.limit as string) || 20;

		const m = resolveModels(req);
		const notifications = await m.UserNotification.find({ userId: user._id })
			.sort({ createdAt: -1 })
			.limit(limit)
			.lean();

		const unreadCount = await m.UserNotification.countDocuments({
			userId: user._id,
			read: false,
		});

		res.json({ notifications, unreadCount });
	} catch (error) {
		console.error('Get notifications error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// POST /api/sharing/notifications/read
router.post('/notifications/read', authenticate, async (req, res) => {
	try {
		const user = req.user as AuthUser;
		const { notificationIds } = req.body;

		const m = resolveModels(req);
		if (notificationIds && Array.isArray(notificationIds)) {
			await m.UserNotification.updateMany(
				{ _id: { $in: notificationIds }, userId: user._id },
				{ $set: { read: true } },
			);
		} else {
			await m.UserNotification.updateMany(
				{ userId: user._id, read: false },
				{ $set: { read: true } },
			);
		}

		res.json({ message: 'Notifications marked as read' });
	} catch (error) {
		console.error('Mark notifications read error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// GET /api/sharing/users/search
router.get('/users/search', authenticate, async (req, res) => {
	try {
		const q = (req.query.q as string || '').trim();
		if (!q || q.length < 2) {
			return res.json([]);
		}

		const m = resolveModels(req);
		const users = await m.User.find(
			{
				$or: [
					{ name: { $regex: q, $options: 'i' } },
					{ username: { $regex: q, $options: 'i' } },
				],
			},
			'name username role',
		)
			.limit(10)
			.lean();

		res.json(
			users.map((u: any) => ({
				_id: String(u._id),
				name: u.name,
				username: u.username,
				role: u.role,
			})),
		);
	} catch (error) {
		console.error('Search users error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// GET /api/sharing/:entityType/:entityId
router.get('/:entityType/:entityId', authenticate, async (req, res) => {
	try {
		const m = resolveModels(req);
		const storage = resolveStorage(req);
		await expirePendingShares(m.PostSharing, m.UserNotification, storage);

		const { entityType, entityId } = req.params;
		const user = req.user as AuthUser;

		const ownerIds = await getEntityOwnerIds(
			storage, m.PostSharing,
			entityType as SharingEntityType,
			entityId,
		);
		const isOwner = ownerIds.includes(String(user._id));

		const approvedSharesRaw = await m.PostSharing.find({
			entityType,
			entityId,
			status: 'approved',
		})
			.populate('targetId', 'name username')
			.populate('requesterId', 'name username')
			.lean();
		const approvedMap = new Map<string, any>();
		for (const s of approvedSharesRaw as any[]) {
			const key =
				typeof s.targetId === 'object'
					? String(s.targetId._id)
					: String(s.targetId);
			const existing = approvedMap.get(key);
			if (!existing) {
				approvedMap.set(key, s);
				continue;
			}
			const existingTime = new Date(
				existing.decidedAt || existing.updatedAt || existing.createdAt || 0,
			).getTime();
			const nextTime = new Date(
				s.decidedAt || s.updatedAt || s.createdAt || 0,
			).getTime();
			if (nextTime >= existingTime) {
				approvedMap.set(key, s);
			}
		}
		const approvedShares = Array.from(approvedMap.values());

		let pendingShares: any[] = [];
		if (isOwner) {
			pendingShares = await m.PostSharing.find({
				entityType,
				entityId,
				status: 'pending',
			})
				.populate('targetId', 'name username')
				.populate('requesterId', 'name username')
				.lean();
		} else {
			pendingShares = await m.PostSharing.find({
				entityType,
				entityId,
				status: 'pending',
				targetId: user._id,
			})
				.populate('targetId', 'name username')
				.populate('requesterId', 'name username')
				.lean();
		}

		const ownerUsers = await m.User.find(
			{ _id: { $in: ownerIds } },
			'name username',
		).lean();

		res.json({
			owners: ownerUsers.map((u: any) => ({
				_id: String(u._id),
				name: u.name,
				username: u.username,
			})),
			approved: approvedShares.map((s: any) => ({
				_id: String(s._id),
				kind: s.kind,
				permission: s.permission,
				targetId:
					typeof s.targetId === 'object'
						? {
								_id: String(s.targetId._id),
								name: s.targetId.name,
								username: s.targetId.username,
							}
						: s.targetId,
				requesterId:
					typeof s.requesterId === 'object'
						? {
								_id: String(s.requesterId._id),
								name: s.requesterId.name,
								username: s.requesterId.username,
							}
						: s.requesterId,
				createdAt: s.createdAt,
			})),
			pending: pendingShares.map((s: any) => ({
				_id: String(s._id),
				kind: s.kind,
				permission: s.permission,
				status: s.status,
				expiresAt: s.expiresAt,
				targetId:
					typeof s.targetId === 'object'
						? {
								_id: String(s.targetId._id),
								name: s.targetId.name,
								username: s.targetId.username,
							}
						: s.targetId,
				requesterId:
					typeof s.requesterId === 'object'
						? {
								_id: String(s.requesterId._id),
								name: s.requesterId.name,
								username: s.requesterId.username,
							}
						: s.requesterId,
				createdAt: s.createdAt,
			})),
			isOwner,
		});
	} catch (error) {
		console.error('Get sharing info error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// GET /api/sharing/requestable?entityType=berita|events|library&q=...
// Digunakan untuk request sharing ketika user belum punya `*_view_others`:
// endpoint ini hanya mengembalikan data minimal (id + title) agar tidak membocorkan konten.
router.get('/requestable', authenticate, async (req, res) => {
	try {
		const entityType = req.query.entityType as string | undefined;
		const q = (req.query.q as string | undefined)?.trim() || '';

		if (!entityType || !['berita', 'events', 'library'].includes(entityType)) {
			return res.status(400).json({ message: 'Invalid entityType' });
		}
		if (!q || q.length < 2) return res.json([]);

		const limit = parseInt(String(req.query.limit || '10'), 10);
		const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 10;

		const rm = resolveModels(req);

		if (entityType === 'berita') {
			const items = await rm.Berita.find({
				title: { $regex: q, $options: 'i' },
			})
				.limit(safeLimit)
				.select('_id title published')
				.lean();

			return res.json(
				items.map((it: any) => ({
					_id: String(it._id),
					title: it.title,
					published: it.published,
				})),
			);
		}

		if (entityType === 'events') {
			const items = await rm.Event.find({
				title: { $regex: q, $options: 'i' },
			})
				.limit(safeLimit)
				.select('_id title published')
				.lean();

			return res.json(
				items.map((it: any) => ({
					_id: String(it._id),
					title: it.title,
					published: it.published,
				})),
			);
		}

		const items = await rm.Library.find({
			title: { $regex: q, $options: 'i' },
		})
			.limit(safeLimit)
			.select('_id title')
			.lean();

		return res.json(
			items.map((it: any) => ({
				_id: String(it._id),
				title: it.title,
			})),
		);
	} catch (error) {
		console.error('Requestable sharing search error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

export default router;
export { getEntityOwnerIds, expirePendingShares };
