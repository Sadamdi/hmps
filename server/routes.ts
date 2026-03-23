import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import fs from 'fs';
import { createServer, type Server } from 'http';
import path from 'path';
import {
	authenticate,
	authenticateOptional,
	authorize,
	canManageRole,
	createSessionRecord,
	generateToken,
	hashPassword,
	requirePermission,
	verifyPassword,
} from './auth';
import {
	confirmWithResetToken,
	createOtpChallenge,
	OtpError,
	RateLimitError,
	verifyAndIssueResetToken,
	verifyOtpChallenge,
} from './services/otp';
import { isProcessableImage, processImage } from './image-processor';
import {
	getMiddlewareSettings,
	updateMiddlewareSettings,
} from './models/middleware-settings';
import { mongoStorage } from './mongo-storage'; // Use mongoStorage instead of storage
import chatRouter from './routes/chat';
import commentRouter from './routes/comments';
import feedbackRouter from './routes/feedback';
import sharingRouter, { expirePendingShares } from './routes/sharing';
import { PostSharing } from '../db/mongodb';
import {
	cleanupBeritaImages,
	deleteFile,
	extractImageUrlsFromContent,
	uploadBeritaImage,
	uploadFilosofiImage,
	uploadHandler,
	uploadMiddleware,
	uploadOrganizationMemberImage,
	uploadProdiLabPhoto,
	uploadProdiLecturerPhoto,
	uploadProdiOrganizationStructureImage,
} from './upload';

// Import security middleware
import {
	loginLimiter,
	loginSchema,
	uploadLimiter,
	validateFileUpload,
	validateInput,
} from './security';

// Define user type to match MongoDB schema
interface UserWithRole {
	_id: string;
	username: string;
	name: string;
	email: string;
	role: string;
	division?: string;
	password?: string;
	createdAt?: Date;
	updatedAt?: Date;
	lastLogin?: Date;
}

function getPaginationParams(query: any) {
	const pageRaw = query?.page;
	const limitRaw = query?.limit;
	const page = Math.max(1, parseInt(String(pageRaw || '1'), 10));
	const limit = Math.min(
		100,
		Math.max(1, parseInt(String(limitRaw || '10'), 10)),
	);
	const isPaginated = pageRaw !== undefined || limitRaw !== undefined;
	return { page, limit, isPaginated };
}

async function hasApprovedSharing(
	entityType: string,
	entityId: string,
	userId: string,
	requiredPermission: 'view' | 'edit',
): Promise<boolean> {
	const filter: any = {
		entityType,
		entityId,
		targetId: userId,
		status: 'approved',
	};
	if (requiredPermission === 'edit') {
		filter.permission = 'edit';
	}
	const count = await PostSharing.countDocuments(filter);
	if (count > 0) return true;

	// Event sharing cascades to descendants: sharing on parent event grants access to sub-events.
	if (entityType === 'events') {
		let current = await mongoStorage.getEventById(entityId);
		while (current && (current as any).parentId) {
			const parentId = String((current as any).parentId);
			const parentFilter: any = {
				entityType: 'events',
				entityId: parentId,
				targetId: userId,
				status: 'approved',
			};
			if (requiredPermission === 'edit') {
				parentFilter.permission = 'edit';
			}
			const parentShareCount = await PostSharing.countDocuments(parentFilter);
			if (parentShareCount > 0) return true;
			current = await mongoStorage.getEventById(parentId);
		}
	}

	return false;
}

async function checkBeritaPermission(
	user: UserWithRole,
	berita: any,
	action: 'edit' | 'delete' | 'publish',
): Promise<boolean> {
	try {
		const userRole = await mongoStorage.getRoleByName(user.role);
		if (!userRole) return false;

		const permissions = userRole.permissions;
		const isOwner = user._id.toString() === (berita.authorId || '').toString();
		const beritaId = String(berita._id || berita.id);

		switch (action) {
			case 'edit':
				if (
					(permissions.includes('berita.edit') && isOwner) ||
					permissions.includes('berita.edit_others')
				)
					return true;
				return hasApprovedSharing('berita', beritaId, user._id.toString(), 'edit');
			case 'delete':
				if (
					(permissions.includes('berita.delete') && isOwner) ||
					permissions.includes('berita.delete_others')
				)
					return true;
				return hasApprovedSharing('berita', beritaId, user._id.toString(), 'edit');
			case 'publish':
				return permissions.includes('berita.publish');
			default:
				return false;
		}
	} catch (error) {
		console.error('Error checking berita permission:', error);
		return false;
	}
}

// Helper function to check event permissions (own vs others)
async function checkEventPermission(
	user: UserWithRole,
	event: any,
	action: 'view' | 'edit' | 'delete' | 'publish',
): Promise<boolean> {
	try {
		const userRole = await mongoStorage.getRoleByName(user.role);
		if (!userRole) return false;

		const permissions = userRole.permissions;
		const isOwner =
			user._id.toString() === (event.createdBy || '').toString();
		const eventId = String(event._id || event.id);

		switch (action) {
			case 'view':
				if (
					(permissions.includes('events.view') && isOwner) ||
					permissions.includes('events.view_others')
				)
					return true;
				return hasApprovedSharing('events', eventId, user._id.toString(), 'view');
			case 'edit':
				if (
					(permissions.includes('events.edit') && isOwner) ||
					permissions.includes('events.edit_others')
				)
					return true;
				return hasApprovedSharing('events', eventId, user._id.toString(), 'edit');
			case 'delete':
				if (
					(permissions.includes('events.delete') && isOwner) ||
					permissions.includes('events.delete_others')
				)
					return true;
				return hasApprovedSharing('events', eventId, user._id.toString(), 'edit');
			case 'publish':
				return permissions.includes('events.publish');
			default:
				return false;
		}
	} catch (error) {
		console.error('Error checking event permission:', error);
		return false;
	}
}

async function canViewBerita(
	user: UserWithRole | undefined,
	berita: any,
): Promise<boolean> {
	if (!user) return false;
	if (berita.published) return true;
	const userRole = await mongoStorage.getRoleByName(user.role);
	if (!userRole) return false;
	const permissions = userRole.permissions;
	const isOwner = user._id.toString() === (berita.authorId || '').toString();
	if (
		(permissions.includes('berita.view') && isOwner) ||
		permissions.includes('berita.view_others')
	)
		return true;
	const beritaId = String(berita._id || berita.id);
	return hasApprovedSharing('berita', beritaId, user._id.toString(), 'view');
}

// Helper function to check library permissions
async function checkLibraryPermission(
	user: UserWithRole,
	libraryItem: any,
	action: 'edit' | 'delete',
): Promise<boolean> {
	try {
		const userRole = await mongoStorage.getRoleByName(user.role);
		if (!userRole) return false;

		const permissions = userRole.permissions;
		const isOwner =
			user._id.toString() === (libraryItem.authorId || '').toString();
		const itemId = String(libraryItem._id || libraryItem.id);

		switch (action) {
			case 'edit':
				if (
					(permissions.includes('library.edit') && isOwner) ||
					permissions.includes('library.edit_others')
				)
					return true;
				return hasApprovedSharing('library', itemId, user._id.toString(), 'edit');
			case 'delete':
				if (
					(permissions.includes('library.delete') && isOwner) ||
					permissions.includes('library.delete_others')
				)
					return true;
				return hasApprovedSharing('library', itemId, user._id.toString(), 'edit');
			default:
				return false;
		}
	} catch (error) {
		console.error('Error checking library permission:', error);
		return false;
	}
}

import { User } from '../db/mongodb';

async function getEffectiveAuthors(
	entityType: string,
	entityId: string,
	originalAuthorName: string,
): Promise<string[]> {
	const authors = [originalAuthorName];
	try {
		const shares = await PostSharing.find({
			entityType,
			entityId,
			status: 'approved',
		}).lean();
		if (shares.length > 0) {
			const targetIds = shares.map((s) => s.targetId);
			const users = await User.find(
				{ _id: { $in: targetIds } },
				'name',
			).lean();
			for (const u of users) {
				if (u.name && !authors.includes(u.name)) {
					authors.push(u.name);
				}
			}
		}
	} catch {}
	return authors;
}

async function enrichBeritaWithAuthors(items: any[]): Promise<any[]> {
	for (const item of items) {
		const id = String(item._id || item.id);
		const authors = await getEffectiveAuthors(
			'berita',
			id,
			item.author || 'Unknown',
		);
		item.authorsDisplay = authors.join(' + ');
		item.authors = authors;
	}
	return items;
}

async function getEffectiveAuthorsByAuthorId(
	entityType: string,
	entityId: string,
	originalAuthorId?: string,
): Promise<string[]> {
	const authors: string[] = [];

	try {
		if (originalAuthorId) {
			const originalAuthor = (await User.findById(
				originalAuthorId,
				'name',
			).lean()) as any;
			if (originalAuthor?.name && !authors.includes(originalAuthor.name)) {
				authors.push(originalAuthor.name);
			}
		}

		const shares = await PostSharing.find({
			entityType,
			entityId,
			status: 'approved',
		}).lean();

		if (shares.length > 0) {
			const targetIds = shares.map((s) => s.targetId);
			const users = (await User.find(
				{ _id: { $in: targetIds } },
				'name',
			).lean()) as any[];
			for (const u of users) {
				if (u?.name && !authors.includes(u.name)) authors.push(u.name);
			}
		}
	} catch {}

	return authors;
}

async function enrichEventsWithAuthors(items: any[]): Promise<any[]> {
	for (const item of items) {
		const id = String(item._id || item.id);
		const originalAuthorId = item.createdBy ? String(item.createdBy) : undefined;
		const authors = await getEffectiveAuthorsByAuthorId('events', id, originalAuthorId);
		item.authorsDisplay = authors.join(' + ');
		item.authors = authors;
	}
	return items;
}

async function enrichLibraryWithAuthors(items: any[]): Promise<any[]> {
	for (const item of items) {
		const id = String(item._id || item.id);
		const originalAuthorId = item.authorId ? String(item.authorId) : undefined;
		const authors = await getEffectiveAuthorsByAuthorId('library', id, originalAuthorId);
		item.authorsDisplay = authors.join(' + ');
		item.authors = authors;
	}
	return items;
}

async function enrichEventTreeWithAuthors(item: any): Promise<void> {
	if (!item) return;
	const id = String(item._id || item.id);
	const originalAuthorId = item.createdBy ? String(item.createdBy) : undefined;
	const authors = await getEffectiveAuthorsByAuthorId('events', id, originalAuthorId);
	item.authorsDisplay = authors.join(' + ');
	item.authors = authors;

	if (Array.isArray(item.children) && item.children.length > 0) {
		for (const child of item.children) {
			await enrichEventTreeWithAuthors(child);
		}
	}
}

export async function registerRoutes(app: Express): Promise<Server> {
	// Use cookie parser for handling JWT tokens
	app.use(cookieParser());

	// Initialize default data
	try {
		await mongoStorage.initializeDefaultPermissions();
		await mongoStorage.initializeDefaultRoles();
		await mongoStorage.initializeDefaultDivisions();
	} catch (error) {
		console.error('Failed to initialize default data:', error);
	}

	// Google Drive API routes
	app.post('/api/gdrive/check-access', async (req, res) => {
		try {
			const { url } = req.body;

			if (!url) {
				return res.status(400).json({ message: 'URL is required' });
			}

			const {
				extractFileId,
				checkAccessibility,
				isValidGoogleDriveUrl,
				isFolderUrl,
			} = await import('./googleDrive');

			if (!isValidGoogleDriveUrl(url)) {
				return res.status(400).json({
					accessible: false,
					message: 'Invalid Google Drive URL format',
				});
			}

			const fileId = extractFileId(url);
			if (!fileId) {
				return res.status(400).json({
					accessible: false,
					message: 'Could not extract file ID from URL',
				});
			}

			const accessible = await checkAccessibility(fileId);

			// Use the new folder detection function
			const isFolder = isFolderUrl(url);

			res.json({
				accessible,
				isFolder,
				fileId,
				authConfigured: true, // We have auth configured
			});
		} catch (error) {
			console.error('Check Google Drive access error:', error);
			res
				.status(500)
				.json({ accessible: false, message: 'Internal server error' });
		}
	});

	app.post('/api/gdrive/media-url', async (req, res) => {
		try {
			const { fileId, url, mediaType: userSpecifiedType } = req.body;

			if (!fileId && !url) {
				return res.status(400).json({ message: 'File ID or URL is required' });
			}

			const {
				getMediaUrl,
				getFileMetadata,
				getMediaFromFolder,
				extractFileId,
				isSupportedMediaType,
				getFileTypeFromExtension,
				isFolderUrl,
			} = await import('./googleDrive');

			let actualFileId = fileId;
			if (!actualFileId && url) {
				actualFileId = extractFileId(url);
			}

			if (!actualFileId) {
				return res.status(400).json({ message: 'Could not extract file ID' });
			}

			// Use the new folder detection function
			const isFolder = url && isFolderUrl(url);

			if (isFolder) {
				// Handle folder - try simple extraction approach
				console.log('Processing folder:', actualFileId);

				try {
					const { getSimpleFolderContents } = await import('./googleDrive');

					// Try to extract file IDs from folder
					const folderFiles = await getSimpleFolderContents(actualFileId);

					if (folderFiles.length > 0) {
						console.log(`Found ${folderFiles.length} files in folder`);

						// Convert to proper format with media URLs
						const mediaWithUrls = folderFiles.map((file, index) => {
							// Generate proper media URL based on auto-detected or default type
							let mediaUrl: string;
							const detectedType = userSpecifiedType || 'image'; // Default to image

							if (detectedType === 'video') {
								mediaUrl = `https://drive.google.com/file/d/${file.id}/preview`;
							} else {
								mediaUrl = `https://lh3.googleusercontent.com/d/${file.id}=s2000`;
							}

							return {
								id: file.id,
								name: `${detectedType === 'video' ? 'Video' : 'Image'} ${
									index + 1
								}`,
								url: mediaUrl,
								type: detectedType,
								mimeType: detectedType === 'video' ? 'video/mp4' : 'image/jpeg',
							};
						});

						return res.json({
							type: 'folder',
							files: mediaWithUrls,
							count: mediaWithUrls.length,
							message: `Found ${mediaWithUrls.length} media files in folder`,
							metadata: {
								folderId: actualFileId,
								folderUrl: `https://drive.google.com/drive/folders/${actualFileId}`,
							},
						});
					} else {
						// No files found - return guidance
						return res.json({
							type: 'folder',
							accessible: true,
							files: [],
							count: 0,
							message:
								'Folder is accessible but no media files were found. For best results, please copy individual file links.',
							instruction:
								'Open the folder → Right-click each file → Get link → Paste those links individually',
							folderUrl: `https://drive.google.com/drive/folders/${actualFileId}`,
							isFolder: true,
						});
					}
				} catch (error) {
					console.log('Folder extraction failed:', error);
					return res.status(400).json({
						message:
							'Cannot extract folder contents. Please use individual file links instead.',
						type: 'folder',
						isFolder: true,
						suggestion:
							'Copy individual file share links instead of folder link',
						instruction:
							'Open the folder → Right-click each file → Get link → Paste those links individually',
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}
			} else {
				// Handle single file

				// For single files, use user-specified type if provided, otherwise guess
				let mediaType = userSpecifiedType || 'image'; // Use user choice or default
				let mimeType = 'image/jpeg'; // Default

				// Set appropriate mimeType based on mediaType
				if (mediaType === 'video') {
					mimeType = 'video/mp4';
				}

				// Try to get some basic info by testing the URL (for logging)
				try {
					const testUrl = `https://drive.google.com/file/d/${actualFileId}/view`;
					const testResponse = await fetch(testUrl, {
						method: 'HEAD',
						headers: {
							'User-Agent':
								'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
						},
					});

					// Only auto-detect if user didn't specify type
					if (!userSpecifiedType && url) {
						if (
							url.includes('video') ||
							url.toLowerCase().includes('mp4') ||
							url.toLowerCase().includes('mov')
						) {
							mediaType = 'video';
							mimeType = 'video/mp4';
						}
					}
				} catch (e) {
					console.log('Could not test URL, using user choice or defaults');
				}

				// Generate appropriate URL based on media type
				let mediaUrl: string;
				if (mediaType === 'video') {
					// For videos, use preview format for better compatibility
					mediaUrl = `https://drive.google.com/file/d/${actualFileId}/preview`;
				} else {
					// For images, use lh3.googleusercontent.com which is more reliable
					mediaUrl = `https://lh3.googleusercontent.com/d/${actualFileId}=s2000`;
				}

				if (!mediaUrl) {
					return res
						.status(404)
						.json({ message: 'Could not generate media URL' });
				}

				// Create basic metadata
				const metadata = {
					id: actualFileId,
					name: `${mediaType === 'video' ? 'Video' : 'Image'} ${actualFileId}`,
					mimeType: mimeType,
					webViewLink: `https://drive.google.com/file/d/${actualFileId}/view`,
					webContentLink: mediaUrl,
				};

				res.json({
					type: mediaType,
					url: mediaUrl,
					metadata,
					files: [
						{
							id: actualFileId,
							name: `${
								mediaType === 'video' ? 'Video' : 'Image'
							} ${actualFileId}`,
							url: mediaUrl,
							type: mediaType,
							mimeType: mimeType,
						},
					],
				});
			}
		} catch (error) {
			console.error('Get Google Drive media URL error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Authentication routes
	app.post(
		'/api/auth/login',
		loginLimiter,
		validateInput(loginSchema),
		async (req, res) => {
			try {
				const { username, password } = req.body;

				if (!username || !password) {
					return res
						.status(400)
						.json({ message: 'Username and password are required' });
				}

				const user = await mongoStorage.getUserByUsernameOrEmail(username);
				if (!user) {
					return res
						.status(401)
						.json({ message: 'Invalid username or password' });
				}

				// Verify password
				const isPasswordValid = await verifyPassword(password, user.password);
				if (!isPasswordValid) {
					return res
						.status(401)
						.json({ message: 'Invalid username or password' });
				}

				// Update last login
				await mongoStorage.updateUser(user._id, { lastLogin: new Date() });

				// Create server-side session record
				const sessionId = await createSessionRecord(req, String(user._id));

				// Generate token and set cookie (include tokenVersion)
				const token = generateToken({ ...(user as any), sessionId } as any);
				res.cookie('authToken', token, {
					httpOnly: true,
					secure: process.env.NODE_ENV === 'production',
					maxAge: 24 * 60 * 60 * 1000, // 24 hours
				});

				// Return user info (without password)
				const { password: _, ...userWithoutPassword } = user;
				res.json(userWithoutPassword);

				// Session retention: purge revoked >7 days and ensure max 10 sessions
				try {
					const { Session } = await import('../db/mongodb');
					const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
					await Session.deleteMany({
						userId: user._id,
						revokedAt: { $lte: sevenDaysAgo },
					});
					const activeSessions = await Session.find({ userId: user._id })
						.sort({ createdAt: -1 })
						.lean();
					if (activeSessions.length > 10) {
						const toRevoke = activeSessions.slice(10);
						const ids = toRevoke.map((s: any) => s._id);
						await Session.updateMany(
							{ _id: { $in: ids }, revokedAt: null },
							{ $set: { revokedAt: new Date() } },
						);
					}
				} catch (e) {
					console.warn('Session retention maintenance (login) failed:', e);
				}
			} catch (error) {
				console.error('Login error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post('/api/auth/logout', (req, res) => {
		res.clearCookie('authToken');
		res.json({ message: 'Logged out successfully' });
	});

	// Revoke all sessions for current user
	app.post('/api/auth/revoke-all-sessions', authenticate, async (req, res) => {
		try {
			const userId = (req.user as UserWithRole)?._id;

			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			// Increment tokenVersion to invalidate all existing tokens
			try {
				const { User } = await import('../db/mongodb');
				await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
			} catch (e) {
				await mongoStorage.updateUser(userId, {
					tokenVersion: ((req.user as any)?.tokenVersion || 0) + 1,
				});
			}

			// Mark all sessions revoked
			try {
				const { Session } = await import('../db/mongodb');
				await Session.updateMany(
					{ userId },
					{ $set: { revokedAt: new Date() } },
				);
			} catch (e) {
				console.warn('Failed to revoke session records:', e);
			}

			// Clear current session cookie
			res.clearCookie('authToken');

			// Log activity
			try {
				const { logActivity } = await import('./models/activity');
				const activityData = {
					type: 'user' as 'user',
					action: 'update' as 'update',
					title: 'Revoke All Sessions',
					description: `User ${
						(req.user as UserWithRole)?.username
					} revoked all sessions`,
					userId: (req.user as any)?._id,
					userName: (req.user as any)?.name || (req.user as any)?.username,
					userRole: (req.user as any)?.role,
				};
				await logActivity(activityData);
			} catch (error) {
				console.warn('Failed to log revoke sessions activity:', error);
			}

			res.json({
				message: 'All sessions revoked successfully. You have been logged out.',
			});
		} catch (error) {
			console.error('Error revoking sessions:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/auth/me', authenticate, (req, res) => {
		const { password, ...userWithoutPassword } = req.user as UserWithRole;
		res.json(userWithoutPassword);
	});

	// Sessions: list active sessions for current user
	app.get('/api/auth/sessions', authenticate, async (req, res) => {
		try {
			const { Session } = await import('../db/mongodb');
			// Maintenance: purge revoked >7 days and cap at 10 by auto-revoking oldest
			const userId = (req.user as any)?._id;
			const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			await Session.deleteMany({ userId, revokedAt: { $lte: sevenDaysAgo } });
			const all = await Session.find({ userId }).sort({ createdAt: -1 });
			if (all.length > 10) {
				const toRevoke = all.slice(10);
				const ids = toRevoke.map((s: any) => s._id);
				await Session.updateMany(
					{ _id: { $in: ids }, revokedAt: null },
					{ $set: { revokedAt: new Date() } },
				);
			}
			const sessions = await Session.find({ userId })
				.sort({ createdAt: -1 })
				.limit(10)
				.lean();
			res.json(sessions);
		} catch (e) {
			console.error('Failed to list sessions:', e);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Sessions: revoke single session by sessionId
	app.post('/api/auth/sessions/revoke', authenticate, async (req, res) => {
		try {
			const { sessionId } = req.body || {};
			if (!sessionId)
				return res.status(400).json({ message: 'sessionId required' });
			const { Session } = await import('../db/mongodb');
			const sess = await Session.findOne({
				sessionId,
				userId: (req.user as any)?._id,
			});
			if (!sess) return res.status(404).json({ message: 'Session not found' });
			await Session.updateOne(
				{ _id: sess._id },
				{ $set: { revokedAt: new Date() } },
			);
			res.json({ message: 'Session revoked' });
		} catch (e) {
			console.error('Failed to revoke session:', e);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post('/api/auth/change-password', authenticate, async (req, res) => {
		try {
			const { currentPassword, newPassword } = req.body;
			const userId = (req.user as UserWithRole)?._id;

			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			// Get user with password
			const user = await mongoStorage.getUserById(userId);
			if (!user) {
				return res.status(404).json({ message: 'User not found' });
			}

			// Verify current password
			const isPasswordValid = await verifyPassword(
				currentPassword,
				user.password,
			);
			if (!isPasswordValid) {
				return res
					.status(400)
					.json({ message: 'Current password is incorrect' });
			}

			// Update password (password akan di-hash di updateUser function)
			await mongoStorage.updateUser(userId, { password: newPassword });

			res.json({ message: 'Password updated successfully' });
		} catch (error) {
			console.error('Password change error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// ══════════════════════════════════════════════════════════════
	// OTP-BASED PASSWORD FLOWS
	// ══════════════════════════════════════════════════════════════

	function getRequestIp(req: any): string {
		return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
			|| req.socket?.remoteAddress
			|| '';
	}

	// --- Forgot password (no auth required) ---
	app.post('/api/auth/forgot-password/request-otp', async (req, res) => {
		try {
			const { email } = req.body;
			if (!email || typeof email !== 'string') {
				return res.status(400).json({ message: 'Email diperlukan' });
			}

			const { User } = await import('../db/mongodb');
			const user = await User.findOne({ email: email.trim().toLowerCase() }).lean() as any;
			if (!user) {
				return res.json({ message: 'Jika email terdaftar, kode OTP telah dikirim.' });
			}

			const { challengeId } = await createOtpChallenge({
				purpose: 'forgot_password',
				email: user.email,
				userId: user._id.toString(),
				ttlMinutes: 10,
				requestIp: getRequestIp(req),
				username: user.username,
			});

			res.json({ message: 'Kode OTP telah dikirim ke email.', challengeId });
		} catch (error: any) {
			if (error instanceof RateLimitError) {
				return res.status(429).json({ message: error.message, retryAfterSeconds: error.retryAfterSeconds });
			}
			console.error('Forgot password OTP error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post('/api/auth/forgot-password/verify-otp', async (req, res) => {
		try {
			const { challengeId, otpCode } = req.body;
			if (!challengeId || !otpCode) {
				return res.status(400).json({ message: 'challengeId dan otpCode diperlukan' });
			}

			const result = await verifyAndIssueResetToken({
				challengeId,
				code: otpCode,
				purpose: 'forgot_password',
				resetTokenTtlMinutes: 10,
			});

			res.json({
				message: 'Kode OTP valid.',
				resetToken: result.resetToken,
				resetTokenExpiresInSeconds: result.resetTokenExpiresInSeconds,
			});
		} catch (error: any) {
			if (error instanceof OtpError) {
				return res.status(400).json({ message: error.message });
			}
			console.error('Forgot password verify-otp error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post('/api/auth/forgot-password/confirm', async (req, res) => {
		try {
			const { challengeId, resetToken, newPassword } = req.body;
			if (!challengeId || !resetToken || !newPassword) {
				return res.status(400).json({ message: 'challengeId, resetToken, dan newPassword diperlukan' });
			}
			if (typeof newPassword !== 'string' || newPassword.length < 8) {
				return res.status(400).json({ message: 'Password minimal 8 karakter' });
			}

			const result = await confirmWithResetToken({
				challengeId,
				resetToken,
				purpose: 'forgot_password',
			});

			const { User } = await import('../db/mongodb');
			const user = await User.findOne({ email: result.email }).lean() as any;
			if (!user) {
				return res.status(404).json({ message: 'User tidak ditemukan' });
			}

			await mongoStorage.updateUser(user._id.toString(), { password: newPassword });

			res.json({ message: 'Password berhasil direset' });
		} catch (error: any) {
			if (error instanceof OtpError) {
				return res.status(400).json({ message: error.message });
			}
			console.error('Forgot password confirm error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// --- Change password with OTP (authenticated) ---
	app.post('/api/auth/change-password/request-otp', authenticate, async (req, res) => {
		try {
			const userId = (req.user as UserWithRole)?._id;
			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			const user = await mongoStorage.getUserById(userId);
			if (!user) {
				return res.status(404).json({ message: 'User tidak ditemukan' });
			}

			const { challengeId } = await createOtpChallenge({
				purpose: 'change_password',
				email: user.email,
				userId: userId.toString(),
				ttlMinutes: 10,
				requestIp: getRequestIp(req),
				username: (user as any).username,
			});

			res.json({ message: 'Kode OTP telah dikirim ke email.', challengeId });
		} catch (error: any) {
			if (error instanceof RateLimitError) {
				return res.status(429).json({ message: error.message, retryAfterSeconds: error.retryAfterSeconds });
			}
			console.error('Change password OTP error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post('/api/auth/change-password/confirm', authenticate, async (req, res) => {
		try {
			const { challengeId, otpCode, currentPassword, newPassword } = req.body;
			if (!challengeId || !otpCode || !newPassword) {
				return res.status(400).json({ message: 'challengeId, otpCode, dan newPassword diperlukan' });
			}
			if (typeof newPassword !== 'string' || newPassword.length < 8) {
				return res.status(400).json({ message: 'Password minimal 8 karakter' });
			}

			const userId = (req.user as UserWithRole)?._id;
			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			const user = await mongoStorage.getUserById(userId);
			if (!user) {
				return res.status(404).json({ message: 'User tidak ditemukan' });
			}

			if (currentPassword) {
				const isPasswordValid = await verifyPassword(currentPassword, user.password);
				if (!isPasswordValid) {
					return res.status(400).json({ message: 'Password saat ini salah' });
				}
			}

			await verifyOtpChallenge({
				challengeId,
				code: otpCode,
				purpose: 'change_password',
			});

			await mongoStorage.updateUser(userId, { password: newPassword });

			res.json({ message: 'Password berhasil diubah' });
		} catch (error: any) {
			if (error instanceof OtpError) {
				return res.status(400).json({ message: error.message });
			}
			console.error('Change password confirm error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// --- Admin edit password (no OTP, requires permission + hierarchy) ---
	app.post(
		'/api/users/:id/password',
		authenticate,
		requirePermission('users.edit_password'),
		async (req, res) => {
			try {
				const { id } = req.params;
				const { newPassword } = req.body;

				if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
					return res.status(400).json({ message: 'Password minimal 8 karakter' });
				}

				const requester = req.user as UserWithRole;
				const targetUser = await mongoStorage.getUserById(id);
				if (!targetUser) {
					return res.status(404).json({ message: 'User tidak ditemukan' });
				}

				if (targetUser._id.toString() === requester._id.toString()) {
					return res.status(400).json({ message: 'Gunakan fitur change password untuk akun sendiri' });
				}

				// Hierarchy check via Role.level from DB
				const { Role } = await import('../db/mongodb');
				const requesterRole = await Role.findOne({ name: requester.role }).lean() as any;
				const targetRole = await Role.findOne({ name: targetUser.role }).lean() as any;

				const requesterLevel = requesterRole?.level ?? 999;
				const targetLevel = targetRole?.level ?? 999;

				if (requesterLevel >= targetLevel) {
					return res.status(403).json({
						message: 'Anda hanya bisa mengubah password user dengan role di bawah Anda',
					});
				}

				await mongoStorage.updateUser(id, { password: newPassword });

				res.json({ message: 'Password user berhasil diubah' });
			} catch (error) {
				console.error('Admin edit password error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Edit user profile route (email change is handled separately via OTP)
	app.put('/api/auth/profile', authenticate, async (req, res) => {
		try {
			const userId = (req.user as UserWithRole)?._id;
			const { username, name } = req.body;

			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			const currentUser = await mongoStorage.getUserById(userId);
			if (!currentUser) {
				return res.status(404).json({ message: 'User not found' });
			}

			if (username && username !== currentUser.username) {
				const userWithSameUsername =
					await mongoStorage.getUserByUsername(username);
				if (
					userWithSameUsername &&
					userWithSameUsername._id.toString() !== userId
				) {
					return res.status(400).json({ message: 'Username already exists' });
				}
			}

			const updateData: any = {};
			if (username) updateData.username = username;
			if (name) updateData.name = name;

			const updatedUser = await mongoStorage.updateUser(userId, updateData);

			const { password: _, ...userWithoutPassword } = updatedUser;
			res.json(userWithoutPassword);
		} catch (error) {
			console.error('Profile update error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// --- Change email with OTP (authenticated, self only) ---
	app.post('/api/auth/change-email/request-otp', authenticate, async (req, res) => {
		try {
			const userId = (req.user as UserWithRole)?._id;
			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			const user = await mongoStorage.getUserById(userId);
			if (!user) {
				return res.status(404).json({ message: 'User tidak ditemukan' });
			}

			const { challengeId } = await createOtpChallenge({
				purpose: 'change_email',
				email: user.email,
				userId: userId.toString(),
				ttlMinutes: 10,
				requestIp: getRequestIp(req),
				username: (user as any).username,
			});

			res.json({ message: 'Kode OTP telah dikirim ke email saat ini.', challengeId });
		} catch (error: any) {
			if (error instanceof RateLimitError) {
				return res.status(429).json({ message: error.message, retryAfterSeconds: error.retryAfterSeconds });
			}
			console.error('Change email OTP error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post('/api/auth/change-email/confirm', authenticate, async (req, res) => {
		try {
			const { challengeId, otpCode, newEmail } = req.body;
			if (!challengeId || !otpCode || !newEmail) {
				return res.status(400).json({ message: 'challengeId, otpCode, dan newEmail diperlukan' });
			}
			if (typeof newEmail !== 'string' || !newEmail.includes('@')) {
				return res.status(400).json({ message: 'Format email tidak valid' });
			}

			const userId = (req.user as UserWithRole)?._id;
			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			await verifyOtpChallenge({
				challengeId,
				code: otpCode,
				purpose: 'change_email',
			});

			const { User } = await import('../db/mongodb');
			const emailTaken = await User.findOne({ email: newEmail.trim().toLowerCase(), _id: { $ne: userId } }).lean();
			if (emailTaken) {
				return res.status(400).json({ message: 'Email sudah digunakan oleh user lain' });
			}

			await mongoStorage.updateUser(userId, { email: newEmail.trim().toLowerCase() });

			res.json({ message: 'Email berhasil diubah' });
		} catch (error: any) {
			if (error instanceof OtpError) {
				return res.status(400).json({ message: error.message });
			}
			console.error('Change email confirm error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// --- Admin edit email user lain (no OTP, requires permission + hierarchy) ---
	app.post(
		'/api/users/:id/email',
		authenticate,
		requirePermission('users.edit_email'),
		async (req, res) => {
			try {
				const { id } = req.params;
				const { newEmail } = req.body;

				if (!newEmail || typeof newEmail !== 'string' || !newEmail.includes('@')) {
					return res.status(400).json({ message: 'Format email tidak valid' });
				}

				const requester = req.user as UserWithRole;
				const targetUser = await mongoStorage.getUserById(id);
				if (!targetUser) {
					return res.status(404).json({ message: 'User tidak ditemukan' });
				}

				if (targetUser._id.toString() === requester._id.toString()) {
					return res.status(400).json({ message: 'Gunakan fitur change email untuk akun sendiri' });
				}

				const { Role } = await import('../db/mongodb');
				const requesterRole = await Role.findOne({ name: requester.role }).lean() as any;
				const targetRole = await Role.findOne({ name: targetUser.role }).lean() as any;

				const requesterLevel = requesterRole?.level ?? 999;
				const targetLevel = targetRole?.level ?? 999;

				if (requesterLevel >= targetLevel) {
					return res.status(403).json({
						message: 'Anda hanya bisa mengubah email user dengan role di bawah Anda',
					});
				}

				const { User } = await import('../db/mongodb');
				const emailTaken = await User.findOne({ email: newEmail.trim().toLowerCase(), _id: { $ne: targetUser._id } }).lean();
				if (emailTaken) {
					return res.status(400).json({ message: 'Email sudah digunakan oleh user lain' });
				}

				await mongoStorage.updateUser(id, { email: newEmail.trim().toLowerCase() });

				res.json({ message: 'Email user berhasil diubah' });
			} catch (error) {
				console.error('Admin edit email error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Edit user role and division (admin only)
	app.put(
		'/api/users/:id/role',
		authenticate,
		authorize(['owner', 'admin', 'ketua', 'wakil_ketua']),
		async (req, res) => {
			try {
				const userId = req.params.id;
				const { role, division } = req.body;

				if (!userId || userId === 'undefined') {
					return res.status(400).json({ message: 'Invalid user ID' });
				}

				// Check if user exists
				const existingUser = await mongoStorage.getUserById(userId);
				if (!existingUser) {
					return res.status(404).json({ message: 'User not found' });
				}

				// Update role and division
				const updateData: any = {};
				if (role) updateData.role = role;
				if (division !== undefined) updateData.division = division;

				const updatedUser = await mongoStorage.updateUser(userId, updateData);

				// Return user info without password
				const { password: _, ...userWithoutPassword } = updatedUser;
				res.json(userWithoutPassword);
			} catch (error) {
				console.error('Role update error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// User management routes
	app.get('/api/users', authenticate, async (req, res) => {
		try {
			const requesterRole = await mongoStorage.getRoleByName(
				(req.user as any)?.role || '',
			);
			const permissions: string[] = requesterRole?.permissions || [];

			if (
				!permissions.includes('users.view') &&
				!permissions.includes('users.view_others')
			) {
				return res
					.status(403)
					.json({ message: 'You do not have permission to view users' });
			}

			const { page, limit, isPaginated } = getPaginationParams(req.query);
			let users = await mongoStorage.getAllUsers(
				isPaginated ? { page, limit } : undefined,
			);
			if (
				permissions.includes('users.view') &&
				!permissions.includes('users.view_others')
			) {
				const myId = (req.user as any)?._id?.toString();
				users = users.filter((u: any) => u._id?.toString() === myId);
			}

			// Remove passwords from response
			const usersWithoutPasswords = users.map((user: any) => {
				const { password, ...userWithoutPassword } = user;
				return userWithoutPassword;
			});

			if (isPaginated) {
				const total = await mongoStorage.getAllUsers();
				return res.json({
					data: usersWithoutPasswords,
					meta: {
						page,
						limit,
						total: total.length,
						totalPages: Math.ceil(total.length / limit),
					},
				});
			}

			res.json(usersWithoutPasswords);
		} catch (error) {
			console.error('Get users error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/users',
		authenticate,
		requirePermission('users.create'),
		async (req, res) => {
			try {
				const { username, password, name, email, role, division } = req.body;
				if (!username || !password || !name || !email || !role) {
					return res.status(400).json({
						message: 'Username, password, name, email, and role are required',
					});
				}
				const existingUser = await mongoStorage.getUserByUsername(username);
				if (existingUser) {
					return res.status(400).json({ message: 'Username already exists' });
				}
				const hashedPassword = await hashPassword(password);
				const newUser = await mongoStorage.createUser({
					username,
					password: hashedPassword,
					name,
					email,
					role,
					division: division || undefined,
				});
				const { password: _, ...userWithoutPassword } = newUser;
				res.status(201).json(userWithoutPassword);
			} catch (error) {
				console.error('Create user error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/users/:id',
		authenticate,
		requirePermission('users.edit'),
		async (req, res) => {
			try {
				const userId = req.params.id;
				const { username, name, email, role, division } = req.body;
				if (!userId || userId === 'undefined') {
					return res.status(400).json({ message: 'Invalid user ID' });
				}
				const existingUser = await mongoStorage.getUserById(userId);
				if (!existingUser) {
					return res.status(404).json({ message: 'User not found' });
				}
				// Hierarchy guard: requester may only modify users with strictly lower level
				const requesterRoleName = (req.user as any)?.role || '';
				const allRoles = await mongoStorage.getAllRoles();
				const requesterRole = allRoles.find(
					(r: any) =>
						(r?.name || '').toString() === requesterRoleName.toString(),
				);
				const requesterLevel =
					typeof requesterRole?.level === 'number' ? requesterRole.level : 999;
				const targetRoleObj = allRoles.find(
					(r: any) =>
						(r?.name || '').toString() === (existingUser.role || '').toString(),
				);
				const targetLevel =
					typeof targetRoleObj?.level === 'number' ? targetRoleObj.level : 999;
				if (!(targetLevel > requesterLevel)) {
					return res.status(403).json({
						message: 'You cannot modify a user at the same or higher level',
					});
				}

				const updates: any = {};
				if (username) updates.username = username;
				if (name) updates.name = name;
				if (email) updates.email = email;
				if (role) updates.role = role;
				if (division !== undefined) updates.division = division;
				const updatedUser = await mongoStorage.updateUser(userId, updates);
				const { password: _, ...userWithoutPassword } = updatedUser;
				res.json(userWithoutPassword);
			} catch (error) {
				console.error('Update user error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete(
		'/api/users/:id',
		authenticate,
		requirePermission('users.delete'),
		async (req, res) => {
			try {
				const userId = req.params.id;
				if (!userId || userId === 'undefined') {
					return res.status(400).json({ message: 'Invalid user ID' });
				}
				const existingUser = await mongoStorage.getUserById(userId);
				if (!existingUser) {
					return res.status(404).json({ message: 'User not found' });
				}

				// Hierarchy guard and self-protection
				const requesterRoleName = (req.user as any)?.role || '';
				const allRoles = await mongoStorage.getAllRoles();
				const requesterRole = allRoles.find(
					(r: any) =>
						(r?.name || '').toString() === requesterRoleName.toString(),
				);
				const requesterLevel =
					typeof requesterRole?.level === 'number' ? requesterRole.level : 999;
				const targetRoleObj = allRoles.find(
					(r: any) =>
						(r?.name || '').toString() === (existingUser.role || '').toString(),
				);
				const targetLevel =
					typeof targetRoleObj?.level === 'number' ? targetRoleObj.level : 999;
				if (!(targetLevel > requesterLevel)) {
					return res.status(403).json({
						message: 'You cannot delete a user at the same or higher level',
					});
				}
				if (
					(req.user as any)?._id?.toString() === existingUser._id?.toString()
				) {
					return res
						.status(400)
						.json({ message: 'Cannot delete your own account' });
				}
				await mongoStorage.deleteUser(userId);
				res.json({ message: 'User deleted successfully' });
			} catch (error) {
				console.error('Delete user error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Upload images for berita content
	app.post(
		'/api/upload/content-image',
		authenticate,
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				// Check if image was uploaded
				if (!req.file) {
					return res.status(400).json({ message: 'Image is required' });
				}

				const beritaId = req.body.beritaId || req.body.beritaId;

				if (!beritaId) {
					return res.status(400).json({ message: 'Berita ID is required' });
				}

				const imageUrl = await uploadBeritaImage(
					req.file,
					undefined,
					beritaId,
					false,
				);

				res.json({ url: imageUrl });
			} catch (error) {
				console.error('Upload content image error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Berita routes
	app.get('/api/berita', async (req, res) => {
		try {
			const { page, limit, isPaginated } = getPaginationParams(req.query);
			const allBerita = await mongoStorage.getPublishedBerita(
				isPaginated ? { page, limit } : undefined,
			);
			await enrichBeritaWithAuthors(allBerita);
			if (isPaginated) {
				const total = await mongoStorage.getBeritaCount();
				return res.json({
					data: allBerita,
					meta: {
						page,
						limit,
						total,
						totalPages: Math.ceil(total / limit),
					},
				});
			}
			res.json(allBerita);
		} catch (error) {
			console.error('Get berita error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Events linked to a berita (PLACE BEFORE /api/berita/:id/:slug)
	app.get('/api/berita/:id/events', authenticateOptional, async (req, res) => {
		try {
			const { id } = req.params;
			let events = await mongoStorage.getEventsByBeritaId(id);
			if (!req.user) {
				events = events.filter((e: any) => e.published);
			}
			res.json(events);
		} catch (error) {
			console.error('Get berita events error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Related berita (PLACE BEFORE /api/berita/:id/:slug to avoid 302 redirect)
	app.get('/api/berita/:id/related', async (req, res) => {
		try {
			const beritaId = req.params.id;
			const limit = Math.max(
				1,
				Math.min(5, parseInt((req.query.limit as string) || '2')),
			);

			const base = await mongoStorage.getBeritaById(beritaId);
			if (!base) {
				return res.status(404).json({ message: 'Berita not found' });
			}

			const { RecommendationService } =
				await import('./services/recommendation');
			const relatedDocs = await RecommendationService.getRelatedById(
				String(base._id),
				limit,
			);

			res.json(
				relatedDocs.map((r: any) => ({
					_id: r._id,
					title: r.title,
					excerpt: r.excerpt,
					image: r.image,
					author: r.author,
					createdAt: r.createdAt,
					slug: r.slug,
					tags: r.tags || [],
				})),
			);
		} catch (error) {
			console.error('Get related berita error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/berita/manage', authenticate, async (req, res) => {
		try {
			await expirePendingShares();

			const userId = (req.user as UserWithRole)?._id || '';
			const userRole = await mongoStorage.getRoleByName(
				(req.user as UserWithRole)?.role || '',
			);
			const permissions = userRole?.permissions || [];

			let beritaList: any[];
			if (permissions.includes('berita.view_others')) {
				beritaList = await mongoStorage.getAllBerita();
			} else if (
				permissions.includes('berita.view') ||
				permissions.includes('berita.edit') ||
				permissions.includes('berita.create')
			) {
				beritaList = await mongoStorage.getBeritaByAuthorId(userId);
			} else {
				beritaList = [];
			}

			const now = new Date();
			const sharedAccess = await PostSharing.find({
				entityType: 'berita',
				targetId: userId,
				status: 'approved',
			}).lean();
			const pendingAccess = await PostSharing.find({
				entityType: 'berita',
				status: 'pending',
				expiresAt: { $gt: now },
				targetId: userId,
			}).lean();

			const mergeSharedBerita = async (accessList: typeof sharedAccess) => {
				if (accessList.length === 0) return;
				const existingIds = new Set(
					beritaList.map((b: any) => String(b._id)),
				);
				const sharedIds = accessList
					.map((s) => String(s.entityId))
					.filter((id) => !existingIds.has(id));
				for (const sid of sharedIds) {
					const item = await mongoStorage.getBeritaById(sid);
					if (item) beritaList.push(item);
				}
			};
			await mergeSharedBerita(sharedAccess);
			await mergeSharedBerita(pendingAccess);

			const approvedPermissionMap = new Map<string, 'view' | 'edit'>();
			for (const s of sharedAccess) {
				const eid = String(s.entityId);
				const perm = s.permission === 'edit' ? 'edit' : 'view';
				if (!approvedPermissionMap.has(eid) || perm === 'edit') {
					approvedPermissionMap.set(eid, perm);
				}
			}
			const pendingIdSet = new Set(pendingAccess.map((s) => String(s.entityId)));
			beritaList = beritaList.map((item: any) => {
				const eid = String(item._id);
				const sharingPermission = approvedPermissionMap.get(eid);
				const sharingStatus = pendingIdSet.has(eid)
					? 'pending'
					: sharingPermission
						? 'approved'
						: undefined;
				return {
					...item,
					_sharingPermission: sharingPermission,
					_sharingStatus: sharingStatus,
				};
			});

			if (
				beritaList.length === 0 &&
				sharedAccess.length === 0 &&
				pendingAccess.length === 0
			) {
				const hasAnyPerm =
					permissions.includes('berita.view') ||
					permissions.includes('berita.edit') ||
					permissions.includes('berita.create');
				if (!hasAnyPerm) {
					return res
						.status(403)
						.json({ message: 'You do not have permission to view berita' });
				}
			}

			res.json(beritaList);
		} catch (error) {
			console.error('Get berita management error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Hybrid route: /berita/:id/:slug (for SEO-friendly URLs)
	app.get(
		'/api/berita/:id/:slug',
		authenticateOptional,
		async (req, res) => {
			try {
				const beritaId = req.params.id;
				const slug = req.params.slug;

				const beritaItem = await mongoStorage.getBeritaById(beritaId);

				if (!beritaItem) {
					return res.status(404).json({ message: 'Berita not found' });
				}

				// Published: anyone can view
				if (beritaItem.published) {
					// continue to response below
				} else {
					// Draft: only owner or users with berita.view_others
					const canView = await canViewBerita(
						req.user as UserWithRole | undefined,
						beritaItem,
					);
					if (!canView) {
						return res.status(403).json({
							message: 'You do not have permission to view this berita',
						});
					}
				}

			// Increment view count for analytics
			try {
				const currentViews =
					typeof (beritaItem as any).viewCount === 'number'
						? (beritaItem as any).viewCount
						: 0;
				const nextViews = currentViews + 1;
				await mongoStorage.updateBerita(String(beritaItem._id || beritaId), {
					viewCount: nextViews,
				});
				(beritaItem as any).viewCount = nextViews;
			} catch (incError) {
				console.warn('Failed to increment viewCount (id+slug):', incError);
			}

			// Verify slug matches (optional validation)
			if (beritaItem.slug && beritaItem.slug !== slug) {
				// Redirect to correct slug if different
				return res.redirect(`/berita/${beritaId}/${beritaItem.slug}`);
			}

			await enrichBeritaWithAuthors([beritaItem]);
			res.json(beritaItem);
		} catch (error) {
			console.error('Get berita by ID and slug error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
		},
	);

	// Get berita by slug for SEO-friendly URLs (MUST BE BEFORE /:id route)
	app.get(
		'/api/berita/slug/:slug',
		authenticateOptional,
		async (req, res) => {
			try {
				const slug = req.params.slug;
				const beritaItem = await mongoStorage.getBeritaBySlug(slug);

				if (!beritaItem) {
					return res.status(404).json({ message: 'Berita not found' });
				}

				if (!beritaItem.published) {
					const canView = await canViewBerita(
						req.user as UserWithRole | undefined,
						beritaItem,
					);
					if (!canView) {
						return res.status(403).json({
							message: 'You do not have permission to view this berita',
						});
					}
				}

			// Increment view count for analytics
			try {
				const currentViews =
					typeof (beritaItem as any).viewCount === 'number'
						? (beritaItem as any).viewCount
						: 0;
				const nextViews = currentViews + 1;
				await mongoStorage.updateBerita(String(beritaItem._id), {
					viewCount: nextViews,
				});
				(beritaItem as any).viewCount = nextViews;
			} catch (incError) {
				console.warn('Failed to increment viewCount (slug):', incError);
			}

			await enrichBeritaWithAuthors([beritaItem]);
			res.json(beritaItem);
		} catch (error) {
			console.error('Get berita by slug error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
		},
	);

	app.get('/api/berita/:id', authenticateOptional, async (req, res) => {
		try {
			const beritaId = req.params.id;
			const beritaItem = await mongoStorage.getBeritaById(beritaId);

			if (!beritaItem) {
				return res.status(404).json({ message: 'Berita not found' });
			}

			if (!beritaItem.published) {
				const canView = await canViewBerita(
					req.user as UserWithRole | undefined,
					beritaItem,
				);
				if (!canView) {
					return res.status(403).json({
						message: 'You do not have permission to view this berita',
					});
				}
			}

			// Increment view count for analytics
			try {
				const currentViews =
					typeof (beritaItem as any).viewCount === 'number'
						? (beritaItem as any).viewCount
						: 0;
				const nextViews = currentViews + 1;
				await mongoStorage.updateBerita(String(beritaItem._id || beritaId), {
					viewCount: nextViews,
				});
				(beritaItem as any).viewCount = nextViews;
			} catch (incError) {
				console.warn('Failed to increment viewCount (id):', incError);
			}

			await enrichBeritaWithAuthors([beritaItem]);
			res.json(beritaItem);
		} catch (error) {
			console.error('Get berita error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Related berita by similarity (tags + simple text overlap)
	app.get('/api/berita/:id/related', async (req, res) => {
		try {
			const beritaId = req.params.id;
			const limit = Math.max(
				1,
				Math.min(5, parseInt((req.query.limit as string) || '2')),
			);

			const base = await mongoStorage.getBeritaById(beritaId);
			if (!base) {
				return res.status(404).json({ message: 'Berita not found' });
			}

			// Use RecommendationService (TF-IDF)
			const { RecommendationService } =
				await import('./services/recommendation');
			const relatedDocs = await RecommendationService.getRelatedById(
				String(base._id),
				limit,
			);

			// Remove legacy in-route scoring; RecommendationService result is used

			res.json(
				relatedDocs.map((r: any) => ({
					_id: r._id,
					title: r.title,
					excerpt: r.excerpt,
					image: r.image,
					author: r.author,
					createdAt: r.createdAt,
					slug: r.slug,
					tags: r.tags || [],
				})),
			);
		} catch (error) {
			console.error('Get related berita error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Related by slug as convenience
	app.get('/api/berita/slug/:slug/related', async (req, res) => {
		try {
			const slug = req.params.slug;
			const beritaItem = await mongoStorage.getBeritaBySlug(slug);
			if (!beritaItem)
				return res.status(404).json({ message: 'Berita not found' });
			// Use RecommendationService as well
			const { RecommendationService } =
				await import('./services/recommendation');
			const limit = Math.max(
				1,
				Math.min(5, parseInt((req.query.limit as string) || '2')),
			);
			const relatedDocs = await RecommendationService.getRelatedById(
				String(beritaItem._id),
				limit,
			);
			res.json(
				relatedDocs.map((r: any) => ({
					_id: r._id,
					title: r.title,
					excerpt: r.excerpt,
					image: r.image,
					author: r.author,
					createdAt: r.createdAt,
					slug: r.slug,
					tags: r.tags || [],
				})),
			);
		} catch (error) {
			console.error('Get related berita by slug error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/berita',
		authenticate,
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				// Extract form data with proper validation
				let title = req.body.title || '';
				let excerpt = req.body.excerpt || '';
				let content = req.body.content || '';
				let published = req.body.published;
				let gdriveUrl = req.body.gdriveUrl || '';
				let tags = [];

				// Parse tags from JSON string
				if (req.body.tags) {
					try {
						tags = JSON.parse(req.body.tags);
					} catch (error) {
						console.error('Error parsing tags:', error);
						tags = [];
					}
				}

				// Check create permission
				const userRole = await mongoStorage.getRoleByName(
					(req.user as UserWithRole)?.role || '',
				);
				if (!userRole || !userRole.permissions.includes('berita.create')) {
					return res.status(403).json({
						message: 'You do not have permission to create berita',
					});
				}

				// Check publish permission if trying to publish
				if (published === 'true') {
					if (!userRole.permissions.includes('berita.publish')) {
						return res.status(403).json({
							message: 'You do not have permission to publish berita',
						});
					}
				}

				// Validate required fields
				if (!title || title.trim() === '') {
					return res.status(400).json({ message: 'Title is required' });
				}

				if (!excerpt || excerpt.trim() === '') {
					return res.status(400).json({ message: 'Excerpt is required' });
				}

				if (!content || content.trim() === '') {
					return res.status(400).json({ message: 'Content is required' });
				}

				const authorId = (req.user as UserWithRole)?._id;
				const authorName =
					(req.user as UserWithRole)?.name ||
					(req.user as UserWithRole)?.username;

				if (!authorId || !authorName) {
					return res.status(401).json({ message: 'Authentication required' });
				}

				let imageUrl = '/uploads/default-berita-image.jpg';
				let imageSource = 'local';
				let gdriveFileId = null;

				// Handle Google Drive URL if provided
				if (gdriveUrl && gdriveUrl.trim() !== '') {
					const { extractFileId, checkAccessibility, isValidGoogleDriveUrl } =
						await import('./googleDrive');

					if (!isValidGoogleDriveUrl(gdriveUrl)) {
						return res
							.status(400)
							.json({ message: 'Invalid Google Drive URL format' });
					}

					const fileId = extractFileId(gdriveUrl);
					if (!fileId) {
						return res.status(400).json({
							message: 'Could not extract file ID from Google Drive URL',
						});
					}

					const accessible = await checkAccessibility(fileId);
					if (!accessible) {
						return res.status(400).json({
							message:
								'Google Drive file is private and cannot be accessed by the server',
						});
					}

					imageUrl = gdriveUrl;
					imageSource = 'gdrive';
					gdriveFileId = fileId;
				}

				// Generate unique slug from title
				const { generateUniqueSlug } = await import('../shared/utils');
				const existingBeritas = await mongoStorage.getPublishedBerita();
				const existingSlugs = existingBeritas.map(
					(b: any) => b.slug || '',
				);
				const slug = generateUniqueSlug(title.trim(), existingSlugs);

				const newBerita = await mongoStorage.createBerita({
					title: title.trim(),
					slug,
					excerpt: excerpt.trim(),
					content: content.trim(),
					image: imageUrl,
					imageSource,
					gdriveFileId,
					tags,
					published: published === 'true',
					authorId,
					author: authorName,
				});

				// If local file uploaded (not GDrive), process thumbnail into uploads/berita/{beritaId}
				const beritaId = (newBerita._id || newBerita.id)?.toString();
				let finalBerita = newBerita;
				if (!gdriveUrl && req.file && beritaId) {
					try {
						const processedThumbUrl = await uploadBeritaImage(
							req.file,
							undefined,
							beritaId,
							false,
						);
						finalBerita = await mongoStorage.updateBerita(beritaId, {
							image: processedThumbUrl,
							imageSource: 'local',
						});
						imageUrl = processedThumbUrl;
					} catch (thumbErr) {
						console.error(
							'Thumbnail processing after create failed:',
							thumbErr,
						);
					}
				}

				// Migrate temp content images to berita folder if any (replace URLs in content)
				if (beritaId) {
					try {
						const tempIdMatch = (content || '').match(
							/\/uploads\/berita\/(temp-[^/]+)\//,
						);
						if (tempIdMatch && tempIdMatch[1]) {
							const tempId = tempIdMatch[1];
							const tempDir = path.join(
								process.cwd(),
								'uploads',
								'berita',
								tempId,
							);
							const targetDir = path.join(
								process.cwd(),
								'uploads',
								'berita',
								beritaId,
							);
							if (fs.existsSync(tempDir)) {
								if (!fs.existsSync(targetDir))
									fs.mkdirSync(targetDir, { recursive: true });
								for (const f of fs.readdirSync(tempDir)) {
									fs.renameSync(path.join(tempDir, f), path.join(targetDir, f));
								}
								try {
									fs.rmdirSync(tempDir);
								} catch {}
							}

							// Replace URLs in content
							const updatedContent = (content || '').replace(
								new RegExp(`/uploads/berita/${tempId}/`, 'g'),
								`/uploads/berita/${beritaId}/`,
							);
							if (updatedContent !== content) {
								finalBerita = await mongoStorage.updateBerita(beritaId, {
									content: updatedContent,
								});
								content = updatedContent;
							}
						}
					} catch (migrateErr) {
						console.warn(
							'Optional migration from temp folder failed:',
							migrateErr,
						);
					}
				}

				// Cleanup unused images in berita folder
				if (beritaId) {
					const usedImageUrls = extractImageUrlsFromContent(content);
					if (imageUrl && imageUrl.startsWith('/uploads/')) {
						usedImageUrls.push(imageUrl);
					}
					await cleanupBeritaImages(beritaId.toString(), usedImageUrls);
				}

				res.status(201).json(finalBerita);
			} catch (error) {
				console.error('Create berita error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/berita/:id',
		authenticate,
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				const beritaId = req.params.id;

				// Validate beritaId - prevent 'undefined' issues
				if (!beritaId || beritaId === 'undefined') {
					return res.status(400).json({ message: 'Invalid berita ID' });
				}

				const { title, excerpt, content, published } = req.body;

				// Parse tags (optional) from JSON string, similar to create handler
				let tags: string[] | undefined = undefined;
				if (req.body.tags) {
					try {
						const parsed = JSON.parse(req.body.tags);
						if (Array.isArray(parsed)) {
							tags = parsed;
						}
					} catch (error) {
						console.error('Error parsing tags on update:', error);
					}
				}

				// Get existing berita
				const existingBerita = await mongoStorage.getBeritaById(beritaId);
				if (!existingBerita) {
					return res.status(404).json({ message: 'Berita not found' });
				}

				// Check permissions using new permission system
				const canEdit = await checkBeritaPermission(
					req.user as UserWithRole,
					existingBerita,
					'edit',
				);

				if (!canEdit) {
					return res.status(403).json({
						message: 'You do not have permission to edit this berita',
					});
				}

				// Check publish permission if trying to publish
				if (published === 'true') {
					const canPublish = await checkBeritaPermission(
						req.user as UserWithRole,
						existingBerita,
						'publish',
					);

					if (!canPublish) {
						return res.status(403).json({
							message: 'You do not have permission to publish berita',
						});
					}
				}

				// Process updates
				const updates: any = {
					title,
					excerpt,
					content,
					published: published === 'true',
					updatedAt: new Date(),
				};

				if (Array.isArray(tags)) {
					updates.tags = tags;
				}

				// Process image if uploaded (store inside uploads/berita/{beritaId})
				if (req.file) {
					// Hapus gambar lama jika ada dan berbeda dari default
					const oldImageUrl =
						existingBerita.image !== '/uploads/default-berita-image.jpg'
							? existingBerita.image
							: undefined;

					const imageUrl = await uploadBeritaImage(
						req.file,
						oldImageUrl,
						beritaId,
						false,
					);
					updates.image = imageUrl;
					updates.imageSource = 'local';
				}

				// Update berita
				const updatedBerita = await mongoStorage.updateBerita(
					beritaId,
					updates,
				);

				// Cleanup unused images in berita folder after update
				if (typeof content === 'string') {
					const usedImageUrls = extractImageUrlsFromContent(content);
					const thumbnailUrl = (
						updates.image && updates.image.startsWith('/uploads/')
							? updates.image
							: existingBerita.image || ''
					).toString();
					if (thumbnailUrl && thumbnailUrl.startsWith('/uploads/')) {
						usedImageUrls.push(thumbnailUrl);
					}
					await cleanupBeritaImages(beritaId, usedImageUrls);
				}

				res.json(updatedBerita);
			} catch (error) {
				console.error('Update berita error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete('/api/berita/:id', authenticate, async (req, res) => {
		try {
			const beritaId = req.params.id;

			// Validate beritaId - prevent 'undefined' issues
			if (!beritaId || beritaId === 'undefined') {
				return res.status(400).json({ message: 'Invalid berita ID' });
			}

			// Get existing berita
			const existingBerita = await mongoStorage.getBeritaById(beritaId);
			if (!existingBerita) {
				return res.status(404).json({ message: 'Berita not found' });
			}

			// Check permissions using new permission system
			const canDelete = await checkBeritaPermission(
				req.user as UserWithRole,
				existingBerita,
				'delete',
			);

			if (!canDelete) {
				return res.status(403).json({
					message: 'You do not have permission to delete this berita',
				});
			}

			// Delete berita
			await mongoStorage.deleteBerita(beritaId);

			// Cleanup entire berita folder (uploads/berita/{beritaId})
			await cleanupBeritaImages(beritaId, []); // Empty array means delete all

			// Also cleanup attached_assets/berita/{beritaId} if exists (legacy/misplaced)
			try {
				const assetsDir = path.join(
					process.cwd(),
					'attached_assets',
					'berita',
					beritaId,
				);
				if (fs.existsSync(assetsDir)) {
					for (const f of fs.readdirSync(assetsDir)) {
						const p = path.join(assetsDir, f);
						try {
							fs.unlinkSync(p);
						} catch {}
					}
					try {
						fs.rmdirSync(assetsDir);
					} catch {}
				}
			} catch (cleanupErr) {
				console.warn('Optional cleanup of attached_assets failed:', cleanupErr);
			}

			res.json({ message: 'Berita deleted successfully' });
		} catch (error) {
			console.error('Delete berita error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Library routes
	app.get('/api/library', async (req, res) => {
		try {
			const { page, limit, isPaginated } = getPaginationParams(req.query);
			const allItems = await mongoStorage.getAllLibraryItems(
				isPaginated ? { page, limit } : undefined,
			);

			// Enrich byline multi-owner untuk kartu library.
			try {
				await enrichLibraryWithAuthors(allItems);
			} catch (e) {
				console.warn('Failed to enrich library authors:', e);
			}

			if (isPaginated) {
				const total = await mongoStorage.getLibraryItemsCount();
				return res.json({
					data: allItems,
					meta: {
						page,
						limit,
						total,
						totalPages: Math.ceil(total / limit),
					},
				});
			}
			res.json(allItems);
		} catch (error) {
			console.error('Get library items error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/library/manage', authenticate, async (req, res) => {
		try {
			await expirePendingShares();

			const userId = (req.user as UserWithRole)?._id || '';
			const userRole = await mongoStorage.getRoleByName(
				(req.user as UserWithRole)?.role || '',
			);
			const permissions = userRole?.permissions || [];

			let items: any[];
			if (permissions.includes('library.view_others')) {
				items = await mongoStorage.getAllLibraryItems();
			} else if (
				permissions.includes('library.view') ||
				permissions.includes('library.edit') ||
				permissions.includes('library.create')
			) {
				items = await mongoStorage.getLibraryItemsByAuthorId(userId);
			} else {
				items = [];
			}

			const now = new Date();
			const sharedAccess = await PostSharing.find({
				entityType: 'library',
				targetId: userId,
				status: 'approved',
			}).lean();
			const pendingAccess = await PostSharing.find({
				entityType: 'library',
				status: 'pending',
				expiresAt: { $gt: now },
				targetId: userId,
			}).lean();

			const mergeSharedLibrary = async (accessList: typeof sharedAccess) => {
				if (accessList.length === 0) return;
				const existingIds = new Set(items.map((i: any) => String(i._id)));
				for (const s of accessList) {
					const eid = String(s.entityId);
					if (!existingIds.has(eid)) {
						const item = await mongoStorage.getLibraryItemById(eid);
						if (item) {
							items.push(item);
							existingIds.add(eid);
						}
					}
				}
			};
			await mergeSharedLibrary(sharedAccess);
			await mergeSharedLibrary(pendingAccess);

			const approvedPermissionMap = new Map<string, 'view' | 'edit'>();
			for (const s of sharedAccess) {
				const eid = String(s.entityId);
				const perm = s.permission === 'edit' ? 'edit' : 'view';
				if (!approvedPermissionMap.has(eid) || perm === 'edit') {
					approvedPermissionMap.set(eid, perm);
				}
			}
			const pendingIdSet = new Set(pendingAccess.map((s) => String(s.entityId)));
			items = items.map((item: any) => {
				const eid = String(item._id || item.id);
				const sharingPermission = approvedPermissionMap.get(eid);
				const sharingStatus = pendingIdSet.has(eid)
					? 'pending'
					: sharingPermission
						? 'approved'
						: undefined;
				return {
					...item,
					_sharingPermission: sharingPermission,
					_sharingStatus: sharingStatus,
				};
			});

			if (
				items.length === 0 &&
				sharedAccess.length === 0 &&
				pendingAccess.length === 0
			) {
				const hasAnyPerm =
					permissions.includes('library.view') ||
					permissions.includes('library.edit') ||
					permissions.includes('library.create');
				if (!hasAnyPerm) {
					return res.status(403).json({
						message: 'You do not have permission to view library items',
					});
				}
			}

			res.json(items);
		} catch (error) {
			console.error('Get library management error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/library/:id', async (req, res) => {
		try {
			const itemId = req.params.id;
			const item = await mongoStorage.getLibraryItemById(itemId);

			if (!item) {
				return res.status(404).json({ message: 'Library item not found' });
			}

			res.json(item);
		} catch (error) {
			console.error('Get library item error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/library',
		authenticate,
		requirePermission('library.create'),
		uploadMiddleware.array('images', 10),
		async (req, res) => {
			try {
				// Extract form data with proper validation
				let title = req.body.title || '';
				let description = req.body.description || '';
				let fullDescription = req.body.fullDescription || '';
				let type = req.body.type || 'photo';
				let gdriveUrls = req.body.gdriveUrls || [];

				// Validate required fields
				if (!title || title.trim() === '') {
					return res.status(400).json({ message: 'Title is required' });
				}

				if (!description || description.trim() === '') {
					return res.status(400).json({ message: 'Description is required' });
				}

				if (!fullDescription || fullDescription.trim() === '') {
					return res
						.status(400)
						.json({ message: 'Full description is required' });
				}

				const authorId = (req.user as UserWithRole)?._id;

				if (!authorId) {
					return res.status(401).json({ message: 'Authentication required' });
				}

				let imageUrls: string[] = [];
				let imageSources: string[] = [];
				let gdriveFileIds: string[] = [];

				// Handle Google Drive URLs if provided
				if (gdriveUrls && gdriveUrls.length > 0) {
					const {
						extractFileId,
						checkAccessibility,
						isValidGoogleDriveUrl,
						getSimpleFolderContents,
						isFolderUrl,
					} = await import('./googleDrive');

					for (const url of gdriveUrls) {
						if (!url || url.trim() === '') continue;

						if (!isValidGoogleDriveUrl(url)) {
							return res
								.status(400)
								.json({ message: `Invalid Google Drive URL format: ${url}` });
						}

						const fileId = extractFileId(url);
						if (!fileId) {
							return res.status(400).json({
								message: `Could not extract file ID from Google Drive URL: ${url}`,
							});
						}

						const accessible = await checkAccessibility(fileId);
						if (!accessible) {
							return res.status(400).json({
								message: `Google Drive file is private and cannot be accessed: ${url}`,
							});
						}

						// Check if it's a folder and get contents
						const isFolder = isFolderUrl(url);
						if (isFolder) {
							console.log('Processing folder for library creation:', fileId);
							try {
								const folderFiles = await getSimpleFolderContents(fileId);
								console.log(`Found ${folderFiles.length} files in folder`);

								for (const file of folderFiles) {
									// Store the original Google Drive file URLs
									imageUrls.push(file.url);
									imageSources.push('gdrive');
									gdriveFileIds.push(file.id);
								}
							} catch (folderError) {
								console.error('Error processing folder:', folderError);
								// If folder processing fails, add the folder URL itself as fallback
								imageUrls.push(url);
								imageSources.push('gdrive');
								gdriveFileIds.push(fileId);
							}
						} else {
							// Single file
							imageUrls.push(url);
							imageSources.push('gdrive');
							gdriveFileIds.push(fileId);
						}
					}
				}

				// Handle uploaded files if provided
				const files = req.files as Express.Multer.File[];
				if (files && files.length > 0) {
					const uploadedUrls = await Promise.all(
						files.map((file) => uploadHandler(file, true)),
					);

					imageUrls.push(...uploadedUrls);
					imageSources.push(...uploadedUrls.map(() => 'local'));
					gdriveFileIds.push(...uploadedUrls.map(() => ''));
				}

				// Use default image if no images provided
				if (imageUrls.length === 0) {
					imageUrls = ['/uploads/default-library-image.jpg'];
					imageSources = ['local'];
					gdriveFileIds = [''];
				}

				// Create library item with Google Drive support
				const newItem = await mongoStorage.createLibraryItem({
					title: title.trim(),
					description: description.trim(),
					fullDescription: fullDescription.trim(),
					images: imageUrls,
					imageSources,
					gdriveFileIds,
					type: type,
					authorId,
				});

				res.status(201).json(newItem);
			} catch (error) {
				console.error('Create library item error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/library/:id',
		authenticate,
		uploadMiddleware.array('images', 10),
		async (req, res) => {
			try {
				const itemId = req.params.id;

				// Extract form data with proper validation
				let title = req.body.title || '';
				let description = req.body.description || '';
				let fullDescription = req.body.fullDescription || '';
				let type = req.body.type || 'photo';
				let gdriveUrls = req.body.gdriveUrls || [];
				let gdriveMediaTypes = req.body.gdriveMediaTypes || [];

				// Get existing item
				const existingItem = await mongoStorage.getLibraryItemById(itemId);
				if (!existingItem) {
					return res.status(404).json({ message: 'Library item not found' });
				}

				// Check permissions using permission system
				const canEdit = await checkLibraryPermission(
					req.user as UserWithRole,
					existingItem,
					'edit',
				);

				if (!canEdit) {
					return res
						.status(403)
						.json({ message: 'You do not have permission to edit this item' });
				}

				// Process updates
				const updates: any = {
					title: title.trim(),
					description: description.trim(),
					fullDescription: fullDescription.trim(),
					type: type || 'photo',
					updatedAt: new Date(),
				};

				let imageUrls: string[] = [];
				let imageSources: string[] = [];
				let gdriveFileIds: string[] = [];

				// Handle Google Drive URLs if provided
				if (gdriveUrls && gdriveUrls.length > 0) {
					const {
						extractFileId,
						checkAccessibility,
						isValidGoogleDriveUrl,
						getSimpleFolderContents,
						isFolderUrl,
					} = await import('./googleDrive');

					for (let i = 0; i < gdriveUrls.length; i++) {
						const url = gdriveUrls[i];
						if (!url || url.trim() === '') continue;

						if (!isValidGoogleDriveUrl(url)) {
							return res
								.status(400)
								.json({ message: `Invalid Google Drive URL format: ${url}` });
						}

						const fileId = extractFileId(url);
						if (!fileId) {
							return res.status(400).json({
								message: `Could not extract file ID from Google Drive URL: ${url}`,
							});
						}

						// For edit, we may skip accessibility check for existing URLs
						// to avoid breaking existing media if temporary access issues
						try {
							const accessible = await checkAccessibility(fileId);
							if (!accessible) {
								console.warn(`File may be temporarily inaccessible: ${url}`);
								// Continue anyway for existing items
							}
						} catch (error) {
							console.warn(
								'Accessibility check failed, continuing anyway:',
								error,
							);
						}

						// Check if it's a folder and get contents
						const isFolder = isFolderUrl(url);
						if (isFolder) {
							console.log('Processing folder for library update:', fileId);
							try {
								const folderFiles = await getSimpleFolderContents(fileId);
								console.log(`Found ${folderFiles.length} files in folder`);

								for (const file of folderFiles) {
									imageUrls.push(file.url);
									imageSources.push('gdrive');
									gdriveFileIds.push(file.id);
								}
							} catch (folderError) {
								console.error('Error processing folder:', folderError);
								// If folder processing fails, add the folder URL itself as fallback
								imageUrls.push(url);
								imageSources.push('gdrive');
								gdriveFileIds.push(fileId);
							}
						} else {
							// Single file
							imageUrls.push(url);
							imageSources.push('gdrive');
							gdriveFileIds.push(fileId);
						}
					}
				}

				// Handle uploaded files if provided
				const files = req.files as Express.Multer.File[];
				if (files && files.length > 0) {
					const uploadedUrls = await Promise.all(
						files.map((file) => uploadHandler(file, true)),
					);

					imageUrls.push(...uploadedUrls);
					imageSources.push(...uploadedUrls.map(() => 'local'));
					gdriveFileIds.push(...uploadedUrls.map(() => ''));
				}

				// Update images, imageSources, and gdriveFileIds
				if (imageUrls.length > 0) {
					updates.images = imageUrls;
					updates.imageSources = imageSources;
					updates.gdriveFileIds = gdriveFileIds;
				} else if (existingItem.images && existingItem.images.length > 0) {
					// Keep existing images if no new ones provided
					updates.images = existingItem.images;
					updates.imageSources =
						existingItem.imageSources || existingItem.images.map(() => 'local');
					updates.gdriveFileIds =
						existingItem.gdriveFileIds || existingItem.images.map(() => '');
				}

				// Update library item
				const updatedItem = await mongoStorage.updateLibraryItem(
					itemId,
					updates,
				);

				res.json(updatedItem);
			} catch (error) {
				console.error('Update library item error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete('/api/library/:id', authenticate, async (req, res) => {
		try {
			const itemId = req.params.id;

			// Validate itemId - prevent 'undefined' issues
			if (!itemId || itemId === 'undefined') {
				return res.status(400).json({ message: 'Invalid library item ID' });
			}

			// Get existing item
			const existingItem = await mongoStorage.getLibraryItemById(itemId);
			if (!existingItem) {
				return res.status(404).json({ message: 'Library item not found' });
			}

			// Check permissions using permission system
			const canDelete = await checkLibraryPermission(
				req.user as UserWithRole,
				existingItem,
				'delete',
			);

			if (!canDelete) {
				return res
					.status(403)
					.json({ message: 'You do not have permission to delete this item' });
			}

			// Delete library item
			await mongoStorage.deleteLibraryItem(itemId);

			res.json({ message: 'Library item deleted successfully' });
		} catch (error) {
			console.error('Delete library item error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Organization routes
	app.get('/api/organization/periods', async (req, res) => {
		try {
			const periods = await mongoStorage.getOrganizationPeriods();
			res.json(periods);
		} catch (error) {
			console.error('Get organization periods error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/organization/periods',
		authenticate,
		requirePermission('organization.manage_periods'),
		async (req, res) => {
			try {
				const { period } = req.body;

				if (!period || !/^\d{4}-\d{4}$/.test(period)) {
					return res.status(400).json({
						message:
							'Invalid period format. Please use YYYY-YYYY format (e.g., 2025-2026)',
					});
				}

				// Check if period already exists
				const existingPeriods = await mongoStorage.getOrganizationPeriods();
				if (existingPeriods.includes(period)) {
					return res.status(400).json({
						message: `Period "${period}" already exists`,
					});
				}

				// Create period in dedicated collection
				await mongoStorage.createOrganizationPeriod(period);

				res
					.status(201)
					.json({ message: `Period "${period}" created successfully` });
			} catch (error) {
				console.error('Create organization period error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete(
		'/api/organization/periods/:period',
		authenticate,
		requirePermission('organization.manage_periods'),
		async (req, res) => {
			try {
				const period = decodeURIComponent(req.params.period);

				// Check if period has any members
				const membersInPeriod =
					await mongoStorage.getOrganizationMembersByPeriod(period);
				if (membersInPeriod.length > 0) {
					return res.status(400).json({
						message: `Cannot delete period "${period}" because it has ${membersInPeriod.length} member(s). Please remove all members first.`,
					});
				}

				// Delete the period from dedicated collection
				await mongoStorage.deleteOrganizationPeriod(period);

				res.json({ message: `Period "${period}" deleted successfully` });
			} catch (error) {
				console.error('Delete organization period error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Position management endpoints
	app.get('/api/organization/positions/:period', async (req, res) => {
		try {
			const { period } = req.params;
			const positions = await mongoStorage.getPositionsByPeriod(period);
			res.json(positions);
		} catch (error) {
			console.error('Get positions error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/organization/positions', async (req, res) => {
		try {
			const positions = await mongoStorage.getAllPositions();
			res.json(positions);
		} catch (error) {
			console.error('Get all positions error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/organization/positions',
		authenticate,
		requirePermission('organization.manage_positions'),
		async (req, res) => {
			try {
				const { period, positions } = req.body;
				const result = await mongoStorage.createPositionsForPeriod(
					period,
					positions,
				);
				res.status(201).json(result);
			} catch (error) {
				console.error('Create positions error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/organization/positions/copy',
		authenticate,
		requirePermission('organization.manage_positions'),
		async (req, res) => {
			try {
				const { sourcePeriod, targetPeriod } = req.body;
				const result = await mongoStorage.copyPositionsFromPeriod(
					sourcePeriod,
					targetPeriod,
				);
				res.status(201).json(result);
			} catch (error) {
				console.error('Copy positions error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete(
		'/api/organization/positions/:period',
		authenticate,
		requirePermission('organization.manage_positions'),
		async (req, res) => {
			try {
				const { period } = req.params;
				await mongoStorage.deletePositionsForPeriod(period);
				res.status(204).send();
			} catch (error) {
				console.error('Delete positions error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.get('/api/organization/members', async (req, res) => {
		try {
			const { period } = req.query;
			const { page, limit, isPaginated } = getPaginationParams(req.query);

			if (!period) {
				// Get latest period if not specified
				const periods = await mongoStorage.getOrganizationPeriods();
				const latestPeriod = periods.length > 0 ? periods[0] : null;

				if (!latestPeriod) {
					return res.json([]);
				}

				const members = await mongoStorage.getOrganizationMembersByPeriod(
					latestPeriod,
					isPaginated ? { page, limit } : undefined,
				);
				if (isPaginated) {
					const allMembers =
						await mongoStorage.getOrganizationMembersByPeriod(latestPeriod);
					return res.json({
						data: members,
						meta: {
							page,
							limit,
							total: allMembers.length,
							totalPages: Math.ceil(allMembers.length / limit),
						},
					});
				}
				return res.json(members);
			}

			const members = await mongoStorage.getOrganizationMembersByPeriod(
				period as string,
				isPaginated ? { page, limit } : undefined,
			);
			if (isPaginated) {
				const allMembers = await mongoStorage.getOrganizationMembersByPeriod(
					period as string,
				);
				return res.json({
					data: members,
					meta: {
						page,
						limit,
						total: allMembers.length,
						totalPages: Math.ceil(allMembers.length / limit),
					},
				});
			}
			res.json(members);
		} catch (error) {
			console.error('Get organization members error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/organization/members/:id', async (req, res) => {
		try {
			const memberId = req.params.id;
			const member = await mongoStorage.getOrganizationMemberById(memberId);

			if (!member) {
				return res
					.status(404)
					.json({ message: 'Organization member not found' });
			}

			res.json(member);
		} catch (error) {
			console.error('Get organization member error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/organization/members',
		authenticate,
		requirePermission('organization.manage_members'),
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				const { name, position, period } = req.body;
				const gdriveUrl = (req.body.gdriveUrl || '').toString();

				// Determine image source: prefer valid gdriveUrl, else uploaded file, else default
				let imageUrl = '/uploads/default-member-image.jpg';

				if (gdriveUrl && gdriveUrl.trim() !== '') {
					const { extractFileId, checkAccessibility, isValidGoogleDriveUrl } =
						await import('./googleDrive');

					if (!isValidGoogleDriveUrl(gdriveUrl)) {
						return res
							.status(400)
							.json({ message: 'Invalid Google Drive URL format' });
					}

					const fileId = extractFileId(gdriveUrl);
					if (!fileId) {
						return res.status(400).json({
							message: 'Could not extract file ID from Google Drive URL',
						});
					}

					const accessible = await checkAccessibility(fileId);
					if (!accessible) {
						return res.status(400).json({
							message:
								'Google Drive file is private and cannot be accessed by the server',
						});
					}

					imageUrl = gdriveUrl;
				} else if (req.file) {
					// Process the uploaded image with WebP conversion and compression
					imageUrl = await uploadOrganizationMemberImage(req.file);
				}

				// Create organization member
				const newMember = await mongoStorage.createOrganizationMember({
					name,
					position,
					period,
					imageUrl,
				});

				res.status(201).json(newMember);
			} catch (error) {
				console.error('Create organization member error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/organization/members/:id',
		authenticate,
		requirePermission('organization.manage_members'),
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				const memberId = req.params.id;
				const { name, position, period } = req.body;
				const gdriveUrl = (req.body.gdriveUrl || '').toString();

				// Get existing member
				const existingMember =
					await mongoStorage.getOrganizationMemberById(memberId);
				if (!existingMember) {
					return res
						.status(404)
						.json({ message: 'Organization member not found' });
				}

				// Process updates
				const updates: any = {
					name,
					position,
					period,
					updatedAt: new Date(),
				};

				// Track old image for cleanup
				let oldImageUrl: string | null = null;
				const currentImageUrl = existingMember.imageUrl;

				// Only cleanup if it's a local server file (not GDrive or default)
				if (
					currentImageUrl &&
					!currentImageUrl.includes('drive.google.com') &&
					!currentImageUrl.includes('default-member-image.jpg') &&
					(currentImageUrl.startsWith('/uploads/') ||
						currentImageUrl.startsWith('/attached_assets/'))
				) {
					oldImageUrl = currentImageUrl;
				}

				// Prefer Google Drive URL if provided and valid; otherwise process uploaded image
				if (gdriveUrl && gdriveUrl.trim() !== '') {
					const { extractFileId, checkAccessibility, isValidGoogleDriveUrl } =
						await import('./googleDrive');

					if (!isValidGoogleDriveUrl(gdriveUrl)) {
						return res
							.status(400)
							.json({ message: 'Invalid Google Drive URL format' });
					}

					const fileId = extractFileId(gdriveUrl);
					if (!fileId) {
						return res.status(400).json({
							message: 'Could not extract file ID from Google Drive URL',
						});
					}

					try {
						const accessible = await checkAccessibility(fileId);
						if (!accessible) {
							console.warn('GDrive file may be inaccessible during update');
						}
					} catch (e) {
						console.warn(
							'GDrive accessibility check failed, continuing update',
						);
					}

					updates.imageUrl = gdriveUrl;
				} else if (req.file) {
					// Process the uploaded image with WebP conversion, compression and cleanup of old file
					const imageUrl = await uploadOrganizationMemberImage(
						req.file,
						oldImageUrl || undefined,
					);
					updates.imageUrl = imageUrl;
					oldImageUrl = null; // uploadOrganizationMemberImage already handled cleanup
				}

				// Manual cleanup of old image if switching to GDrive
				if (oldImageUrl && gdriveUrl && gdriveUrl.trim() !== '') {
					try {
						await deleteFile(oldImageUrl);
					} catch (cleanupError) {
						console.warn('Failed to cleanup old image file:', cleanupError);
					}
				}

				// Update organization member
				const updatedMember = await mongoStorage.updateOrganizationMember(
					memberId,
					updates,
				);

				res.json(updatedMember);
			} catch (error) {
				console.error('Update organization member error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete(
		'/api/organization/members/:id',
		authenticate,
		requirePermission('organization.manage_members'),
		async (req, res) => {
			try {
				const memberId = req.params.id;

				// Validate memberId - prevent 'undefined' issues
				if (!memberId || memberId === 'undefined') {
					return res
						.status(400)
						.json({ message: 'Invalid organization member ID' });
				}

				// Check if member exists
				const existingMember =
					await mongoStorage.getOrganizationMemberById(memberId);
				if (!existingMember) {
					return res
						.status(404)
						.json({ message: 'Organization member not found' });
				}

				// Cleanup member's image file if it's a local server file
				if (
					existingMember.imageUrl &&
					!existingMember.imageUrl.includes('drive.google.com') &&
					!existingMember.imageUrl.includes('default-member-image.jpg') &&
					(existingMember.imageUrl.startsWith('/uploads/') ||
						existingMember.imageUrl.startsWith('/attached_assets/'))
				) {
					try {
						await deleteFile(existingMember.imageUrl);
					} catch (cleanupError) {
						console.warn('Failed to cleanup member image file:', cleanupError);
					}
				}

				// Delete organization member
				await mongoStorage.deleteOrganizationMember(memberId);

				res.json({ message: 'Organization member deleted successfully' });
			} catch (error) {
				console.error('Delete organization member error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Settings routes
	app.get('/api/settings', async (req, res) => {
		try {
			const settings = await mongoStorage.getSettings();
			res.json(settings);
		} catch (error) {
			console.error('Get settings error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.put(
		'/api/settings',
		authenticate,
		authorize(['owner', 'admin']),
		async (req, res) => {
			try {
				const body = { ...req.body };

				// Auto-convert mapsLocationInput → mapsEmbedUrl
				if (typeof body.mapsLocationInput === 'string') {
					const input = body.mapsLocationInput.trim();

					if (!input) {
						body.mapsEmbedUrl = '';
					} else if (/^https?:\/\//i.test(input)) {
						let resolvedUrl = input;

						// Resolve shortlinks like maps.app.goo.gl via server-side follow
						try {
							const r = await fetch(input, {
								method: 'HEAD',
								redirect: 'follow',
							});
							resolvedUrl = r.url || input;
						} catch {
							resolvedUrl = input;
						}

						// Convert google maps share link to embed URL
						const isGoogleMaps =
							resolvedUrl.includes('google.com/maps') ||
							resolvedUrl.includes('maps.google.com');

						if (isGoogleMaps) {
							if (resolvedUrl.includes('/maps/embed')) {
								// Already embed format
								body.mapsEmbedUrl = resolvedUrl;
							} else {
								// Extract coordinates or query from link
								const placeMatch = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
								const queryMatch = resolvedUrl.match(/[?&]q=([^&]+)/);
								const placeNameMatch = resolvedUrl.match(/\/maps\/place\/([^/@?]+)/);

								if (placeMatch) {
									const lat = placeMatch[1];
									const lng = placeMatch[2];
									body.mapsEmbedUrl = `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
								} else if (queryMatch) {
									body.mapsEmbedUrl = `https://www.google.com/maps?q=${queryMatch[1]}&output=embed`;
								} else if (placeNameMatch) {
									const placeName = decodeURIComponent(placeNameMatch[1].replace(/\+/g, ' '));
									body.mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(placeName)}&output=embed`;
								} else {
									body.mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(resolvedUrl)}&output=embed`;
								}
							}
						} else {
							// Non-Google Maps URL: use as-is (admin responsibility)
							body.mapsEmbedUrl = resolvedUrl;
						}
					} else {
						// Plain text address
						body.mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(input)}&output=embed`;
					}
				}

				const updatedSettings = await mongoStorage.updateSettings(body);
				res.json(updatedSettings);
			} catch (error) {
				console.error('Update settings error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/settings/home-config',
		authenticate,
		requirePermission('home_settings.edit'),
		async (req, res) => {
			try {
				const { blocks, navbar, showDashboardLink } = req.body;
				const updatePayload: Record<string, any> = {};

				if (Array.isArray(blocks)) {
					const validKinds = ['section', 'subItem'];
					const validModes = ['summary', 'full'];
					const sanitized = blocks
						.filter((b: any) => b && typeof b.id === 'string' && validKinds.includes(b.kind))
						.map((b: any) => ({
							id: b.id,
							kind: b.kind,
							visible: typeof b.visible === 'boolean' ? b.visible : true,
							...(b.kind === 'subItem' && validModes.includes(b.renderMode) ? { renderMode: b.renderMode } : { renderMode: 'summary' }),
						}));
					updatePayload['homeConfig.blocks'] = sanitized;
				}

				if (Array.isArray(navbar)) {
					const sanitized = navbar
						.filter((n: any) => n && typeof n.id === 'string')
						.map((n: any) => ({
							id: n.id,
							visible: typeof n.visible === 'boolean' ? n.visible : true,
						}));
					updatePayload['homeConfig.navbar'] = sanitized;
				}

				if (typeof showDashboardLink === 'boolean') {
					updatePayload['homeConfig.showDashboardLink'] = showDashboardLink;
				}

				const updatedSettings = await mongoStorage.updateSettings(updatePayload);
				res.json(updatedSettings);
			} catch (error) {
				console.error('Update home config error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/settings/reset',
		authenticate,
		authorize(['owner']),
		async (req, res) => {
			try {
				const settings = await mongoStorage.resetSettings();
				res.json(settings);
			} catch (error) {
				console.error('Reset settings error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// ── Prodi Content endpoints ──

	app.get('/api/prodi', async (_req, res) => {
		try {
			const content = await mongoStorage.getProdiContentPublic();
			res.json(content);
		} catch (error) {
			console.error('Get prodi content error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get(
		'/api/prodi/manage',
		authenticate,
		requirePermission('prodi.view'),
		async (_req, res) => {
			try {
				const doc = await mongoStorage.getProdiContent();
				res.json(doc);
			} catch (error) {
				console.error('Get prodi manage error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/prodi/manage',
		authenticate,
		requirePermission('prodi.edit'),
		async (req, res) => {
			try {
				const updated = await mongoStorage.updateProdiContent(req.body);
				res.json(updated);
			} catch (error) {
				console.error('Update prodi manage error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/prodi/upload/photo/member',
		authenticate,
		requirePermission('prodi.edit'),
		uploadLimiter,
		uploadMiddleware.single('image'),
		validateFileUpload,
		async (req, res) => {
			try {
				let slug = String(req.body?.slug || '').trim();
				const oldPhotoUrl = String(req.body?.oldPhotoUrl || '').trim() || undefined;
				if (!slug) {
					const profileUrl = String(req.body?.profileUrl || '').trim();
					const last = profileUrl.replace(/\/+$/, '').split('/').pop() || '';
					slug = last;
				}
				if (!slug) {
					return res.status(400).json({ message: 'slug atau profile URL wajib untuk unggah foto' });
				}
				const url = await uploadProdiLecturerPhoto(req.file!, slug, oldPhotoUrl);
				res.json({ url });
			} catch (error: any) {
				console.error('Prodi member photo upload error:', error);
				res.status(500).json({
					message: error?.message || 'Gagal mengunggah foto',
				});
			}
		},
	);

	app.post(
		'/api/prodi/upload/photo/lab',
		authenticate,
		requirePermission('prodi.edit'),
		uploadLimiter,
		uploadMiddleware.single('image'),
		validateFileUpload,
		async (req, res) => {
			try {
				const typeRaw = String(req.body?.type || '').trim().toLowerCase();
				const type = typeRaw === 'research' ? 'research' : 'teaching';
				const labIndex = parseInt(String(req.body?.labIndex ?? ''), 10);
				const imgIndex = parseInt(String(req.body?.imgIndex ?? ''), 10);
				const oldPhotoUrl = String(req.body?.oldPhotoUrl || '').trim() || undefined;
				if (!Number.isFinite(labIndex) || labIndex < 0) {
					return res.status(400).json({ message: 'labIndex tidak valid' });
				}
				if (!Number.isFinite(imgIndex) || imgIndex < 0) {
					return res.status(400).json({ message: 'imgIndex tidak valid' });
				}
				const url = await uploadProdiLabPhoto(req.file!, type, labIndex, imgIndex, oldPhotoUrl);
				res.json({ url });
			} catch (error: any) {
				console.error('Prodi lab photo upload error:', error);
				res.status(500).json({
					message: error?.message || 'Gagal mengunggah gambar lab',
				});
			}
		},
	);

	app.post(
		'/api/prodi/upload/photo/org-structure',
		authenticate,
		requirePermission('prodi.edit'),
		uploadLimiter,
		uploadMiddleware.single('image'),
		validateFileUpload,
		async (req, res) => {
			try {
				const oldPhotoUrl = String(req.body?.oldPhotoUrl || '').trim() || undefined;
				const url = await uploadProdiOrganizationStructureImage(
					req.file!,
					oldPhotoUrl,
				);
				res.json({ url });
			} catch (error: any) {
				console.error('Prodi org structure photo upload error:', error);
				res.status(500).json({
					message: error?.message || 'Gagal mengunggah gambar struktur',
				});
			}
		},
	);

	app.post(
		'/api/prodi/sync/run',
		authenticate,
		requirePermission('prodi.sync'),
		async (_req, res) => {
			try {
				const doc = await mongoStorage.getProdiContent();
				if (doc.syncStatus === 'syncing') {
					return res.status(409).json({ message: 'Sync sedang berjalan' });
				}
				const { runProdiSync } = await import('./services/prodi-sync');
				const summary = await runProdiSync();
				if (!summary.ok) {
					return res.status(500).json({
						message: summary.error || 'Sinkronisasi gagal',
						summary,
					});
				}
				res.json({ message: 'Sinkronisasi selesai', summary });
			} catch (error) {
				console.error('Prodi sync trigger error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// ── Backup & Restore (owner-only) ──
	const {
		listAvailableBackups,
		restoreFromSnapshot,
	} = await import('./services/db-backup');

	app.get(
		'/api/backups/monthly',
		authenticate,
		authorize(['owner']),
		async (_req, res) => {
			try {
				const list = await listAvailableBackups();
				res.json(list);
			} catch (error: any) {
				console.error('List backups error:', error);
				res.status(500).json({ message: error?.message || 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/backups/restore/request-otp',
		authenticate,
		authorize(['owner']),
		async (req, res) => {
			try {
				const user = req.user as UserWithRole;
				const { User } = await import('../db/mongodb');
				const u = await User.findById(user._id).lean() as any;
				if (!u?.email) {
					return res.status(400).json({ message: 'Email tidak ditemukan' });
				}
				const { challengeId } = await createOtpChallenge({
					purpose: 'restore_backup',
					email: u.email,
					userId: (user._id as any)?.toString?.() || user._id,
					ttlMinutes: 10,
					requestIp: getRequestIp(req),
					username: user.username,
				});
				res.json({ challengeId });
			} catch (error: any) {
				if (error instanceof OtpError || error instanceof RateLimitError) {
					return res.status(400).json({ message: error.message });
				}
				console.error('Request OTP for restore error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/backups/restore/confirm',
		authenticate,
		authorize(['owner']),
		async (req, res) => {
			try {
				const { snapshotKey, challengeId, code } = req.body;
				if (!snapshotKey || !challengeId || !code) {
					return res.status(400).json({
						message: 'snapshotKey, challengeId, dan code wajib diisi',
					});
				}
				await verifyOtpChallenge({
					challengeId,
					code: String(code).trim(),
					purpose: 'restore_backup',
				});
				const result = await restoreFromSnapshot(snapshotKey);
				if (!result.success) {
					return res.status(400).json({ message: result.error || 'Restore gagal' });
				}
				res.json({ message: 'Database berhasil di-restore dari backup' });
			} catch (error: any) {
				if (error instanceof OtpError) {
					return res.status(400).json({ message: error.message });
				}
				console.error('Restore confirm error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// ── Home Images routes ──

	// Seed default data on startup
	mongoStorage
		.seedDefaultHomeImages()
		.catch((err: any) => console.warn('HomeImages seed skipped:', err.message));

	// Public: get active year images
	app.get('/api/home-images/active', async (_req, res) => {
		try {
			const data = await mongoStorage.getActiveHomeImages();
			res.json(data || {});
		} catch (error) {
			console.error('Get active home images error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Auth: list all years
	app.get('/api/home-images', authenticate, async (_req, res) => {
		try {
			const list = await mongoStorage.getAllHomeImages();
			res.json(list);
		} catch (error) {
			console.error('Get all home images error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Create a new year
	app.post(
		'/api/home-images',
		authenticate,
		requirePermission('settings.edit'),
		async (req, res) => {
			try {
				const { year } = req.body;
				if (!year || typeof year !== 'number') {
					return res.status(400).json({ message: 'Valid year is required' });
				}
				const existing = await mongoStorage.getHomeImagesByYear(year);
				if (existing) {
					return res
						.status(409)
						.json({ message: `Year ${year} already exists` });
				}
				const doc = await mongoStorage.createHomeImages({
					year,
					isActive: false,
				});
				res.status(201).json(doc);
			} catch (error) {
				console.error('Create home images error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Update year metadata (desktopMode etc.)
	app.put(
		'/api/home-images/:year',
		authenticate,
		requirePermission('settings.edit'),
		async (req, res) => {
			try {
				const year = parseInt(req.params.year, 10);
				const doc = await mongoStorage.updateHomeImages(year, req.body);
				if (!doc) return res.status(404).json({ message: 'Year not found' });
				res.json(doc);
			} catch (error) {
				console.error('Update home images error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Delete a year
	app.delete(
		'/api/home-images/:year',
		authenticate,
		requirePermission('settings.edit'),
		async (req, res) => {
			try {
				const year = parseInt(req.params.year, 10);
				const doc = await mongoStorage.getHomeImagesByYear(year);
				if (!doc) return res.status(404).json({ message: 'Year not found' });
				if (doc.isActive) {
					return res
						.status(400)
						.json({ message: 'Cannot delete the active year' });
				}
				await mongoStorage.deleteHomeImages(year);
				res.json({ message: 'Deleted' });
			} catch (error) {
				console.error('Delete home images error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Set active year
	app.post(
		'/api/home-images/:year/set-active',
		authenticate,
		requirePermission('settings.edit'),
		async (req, res) => {
			try {
				const year = parseInt(req.params.year, 10);
				const doc = await mongoStorage.setActiveHomeImages(year);
				if (!doc) return res.status(404).json({ message: 'Year not found' });
				res.json(doc);
			} catch (error) {
				console.error('Set active home images error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Copy images from one year to another
	app.post(
		'/api/home-images/:year/copy',
		authenticate,
		requirePermission('settings.edit'),
		async (req, res) => {
			try {
				const sourceYear = parseInt(req.params.year, 10);
				const { targetYear, overwrite } = req.body;
				if (!targetYear || typeof targetYear !== 'number') {
					return res
						.status(400)
						.json({ message: 'Valid targetYear is required' });
				}
				const doc = await mongoStorage.copyHomeImages(
					sourceYear,
					targetYear,
					!!overwrite,
				);
				res.json(doc);
			} catch (error: any) {
				console.error('Copy home images error:', error);
				res.status(400).json({ message: error.message || 'Copy failed' });
			}
		},
	);

	// Upload image for a specific slot
	app.post(
		'/api/home-images/:year/upload/:slot',
		authenticate,
		requirePermission('settings.edit'),
		uploadLimiter,
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				const year = parseInt(req.params.year, 10);
				const slot = req.params.slot;

				const validSlots = [
					'bennerfull',
					'orang',
					'public_relation',
					'technopreneurship',
					'intelektual',
					'wakil_ketua',
					'ketua',
					'medinfo',
					'religius',
					'senor',
				];
				if (!validSlots.includes(slot)) {
					return res.status(400).json({ message: `Invalid slot: ${slot}` });
				}

				const existing = await mongoStorage.getHomeImagesByYear(year);
				if (!existing) {
					return res.status(404).json({ message: 'Year not found' });
				}

				if (!req.file) {
					return res.status(400).json({ message: 'Image file is required' });
				}

				if (!isProcessableImage(req.file.mimetype)) {
					return res.status(400).json({ message: 'File type not supported' });
				}

				// Process image → webp
				const processedBuffer = await processImage(req.file.buffer, {
					quality: 82,
					maxWidth:
						slot === 'bennerfull' ? 3840 : slot === 'orang' ? 3840 : 1920,
					maxHeight:
						slot === 'bennerfull' ? 2160 : slot === 'orang' ? 2160 : 2400,
					format: 'webp',
				});

				// Save to attached_assets/benner/{year}/
				const assetsDir = path.join(
					process.cwd(),
					'attached_assets',
					'benner',
					String(year),
				);
				if (!fs.existsSync(assetsDir)) {
					fs.mkdirSync(assetsDir, { recursive: true });
				}
				const fileName = `${slot}.webp`;
				const filePath = path.join(assetsDir, fileName);
				// Hapus file lama jika memang file milik slot+tahun ini (biar hemat storage)
				try {
					const resolvedBase = path.resolve(assetsDir);
					const resolvedFile = path.resolve(filePath);
					if (
						resolvedFile.startsWith(resolvedBase) &&
						fs.existsSync(filePath)
					) {
						fs.unlinkSync(filePath);
					}
				} catch (e) {
					console.warn('Could not delete old home image file:', e);
				}
				fs.writeFileSync(filePath, processedBuffer);

				const url = `/attached_assets/benner/${year}/${fileName}`;
				const doc = await mongoStorage.updateHomeImageSlot(year, slot, url);
				res.json(doc);
			} catch (error) {
				console.error('Upload home image error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Delete image for a specific slot (clear DB + delete file if owned)
	app.delete(
		'/api/home-images/:year/slot/:slot',
		authenticate,
		requirePermission('settings.edit'),
		async (req, res) => {
			try {
				const year = parseInt(req.params.year, 10);
				const slot = req.params.slot;

				const validSlots = [
					'bennerfull',
					'orang',
					'public_relation',
					'technopreneurship',
					'intelektual',
					'wakil_ketua',
					'ketua',
					'medinfo',
					'religius',
					'senor',
				];
				if (!validSlots.includes(slot)) {
					return res.status(400).json({ message: `Invalid slot: ${slot}` });
				}

				const existing = await mongoStorage.getHomeImagesByYear(year);
				if (!existing)
					return res.status(404).json({ message: 'Year not found' });

				const assetsDir = path.join(
					process.cwd(),
					'attached_assets',
					'benner',
					String(year),
				);
				const fileName = `${slot}.webp`;
				const filePath = path.join(assetsDir, fileName);
				try {
					const resolvedBase = path.resolve(assetsDir);
					const resolvedFile = path.resolve(filePath);
					if (
						resolvedFile.startsWith(resolvedBase) &&
						fs.existsSync(filePath)
					) {
						fs.unlinkSync(filePath);
					}
				} catch (e) {
					console.warn('Could not delete home image file:', e);
				}

				const doc = await mongoStorage.updateHomeImageSlot(year, slot, '');
				res.json(doc);
			} catch (error) {
				console.error('Delete home image slot error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Middleware Settings endpoints
	app.get(
		'/api/settings/middleware',
		authenticate,
		async (req, res, next) => {
			try {
				// Emergency permission check for owner
				const { user } = req as any;
				if (user.role === 'owner') {
					const userRole = await mongoStorage.getRoleByName('owner');
					const allPermissions = await mongoStorage.getAllPermissions();

					if (!userRole?.permissions?.includes('middleware.manage')) {
						console.log(
							'🚨 Emergency: Owner missing middleware.manage permission, fixing...',
						);
						const allPermissionNames = allPermissions.map((p: any) => p.name);
						const { Role } = await import('../db/mongodb');
						await Role.updateOne(
							{ name: 'owner' },
							{
								$set: {
									permissions: allPermissionNames,
									updatedAt: new Date(),
								},
							},
						);
						console.log('✅ Fixed owner permissions');
					}
				}

				// Now check permission normally
				return requirePermission('middleware.manage')(req, res, next);
			} catch (error) {
				console.error('Middleware settings permission check error:', error);
				return res.status(500).json({ message: 'Internal server error' });
			}
		},
		async (req, res) => {
			try {
				const settings = await getMiddlewareSettings();
				res.json(settings);
			} catch (error) {
				console.error('Get middleware settings error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/settings/middleware',
		authenticate,
		async (req, res, next) => {
			try {
				// Emergency permission check for owner
				const { user } = req as any;
				if (user.role === 'owner') {
					const userRole = await mongoStorage.getRoleByName('owner');
					const allPermissions = await mongoStorage.getAllPermissions();

					if (!userRole?.permissions?.includes('middleware.manage')) {
						console.log(
							'🚨 Emergency: Owner missing middleware.manage permission, fixing...',
						);
						const allPermissionNames = allPermissions.map((p: any) => p.name);
						const { Role } = await import('../db/mongodb');
						await Role.updateOne(
							{ name: 'owner' },
							{
								$set: {
									permissions: allPermissionNames,
									updatedAt: new Date(),
								},
							},
						);
						console.log('✅ Fixed owner permissions');
					}
				}

				// Now check permission normally
				return requirePermission('middleware.manage')(req, res, next);
			} catch (error) {
				console.error('Middleware settings permission check error:', error);
				return res.status(500).json({ message: 'Internal server error' });
			}
		},
		async (req, res) => {
			try {
				const { user } = req as any;

				// Extract updatedBy from request body and use user._id instead
				const { updatedBy, ...settingsData } = req.body;
				const settings = await updateMiddlewareSettings(settingsData, user._id);
				res.json(settings);
			} catch (error) {
				console.error('Update middleware settings error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Public stats (no auth required for public home page)
	app.get('/api/stats', async (req, res) => {
		try {
			const beritaCount = await mongoStorage.getBeritaCount();
			const libraryCount = await mongoStorage.getLibraryItemsCount();
			const activeMemberCount =
				await mongoStorage.getOrganizationActiveMembersCount();

			res.json({
				berita: beritaCount,
				libraryItems: libraryCount,
				organizationMembers: activeMemberCount,
			});
		} catch (error) {
			console.error('Get stats error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Real-time dashboard stats
	app.get('/api/dashboard/stats', authenticate, async (req, res) => {
		try {
			// Check if user has dashboard stats permission
			const userRole = await mongoStorage.getRoleByName(
				(req.user as UserWithRole)?.role || '',
			);
			const permissions = userRole?.permissions || [];

			if (!permissions.includes('dashboard.stats')) {
				return res.status(403).json({
					message: 'You do not have permission to view dashboard statistics',
				});
			}

			const [beritaCount, libraryCount, activeMemberCount, alumniMemberCount] =
				await Promise.all([
					mongoStorage.getBeritaCount(),
					mongoStorage.getLibraryItemsCount(),
					mongoStorage.getOrganizationActiveMembersCount(),
					mongoStorage.getOrganizationAlumniMembersCount(),
				]);

			res.json({
				totalBerita: beritaCount,
				totalMediaItems: libraryCount,
				activeMemberCount,
				alumniMemberCount,
			});
		} catch (error) {
			console.error('Get dashboard stats error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Recent activities
	app.get('/api/dashboard/activities', authenticate, async (req, res) => {
		try {
			// Import Activity functions
			const { getRecentActivities } = await import('./models/activity');
			const limit = parseInt(req.query.limit as string) || 10;
			const type = req.query.type as string;

			const activities = await getRecentActivities(limit, type);

			res.json(activities || []);
		} catch (error) {
			console.error('Get activities error:', error);
			res
				.status(500)
				.json({ message: 'Internal server error', error: String(error) });
		}
	});

	// Activity logging endpoint (internal use)
	app.post('/api/dashboard/log-activity', authenticate, async (req, res) => {
		try {
			const { logActivity } = await import('./models/activity');
			const activityData = {
				...req.body,
				userId: (req.user as any)?._id,
				userName: (req.user as any)?.name || (req.user as any)?.username,
				userRole: (req.user as any)?.role,
			};

			const activity = await logActivity(activityData);

			res.json(activity);
		} catch (error) {
			console.error('Log activity error:', error);
			res
				.status(500)
				.json({ message: 'Internal server error', error: String(error) });
		}
	});

	// Endpoint upload gambar filosofi (menggantikan file di attached_assets/filosofi)
	app.post(
		'/api/upload/filosofi',
		authenticate,
		uploadLimiter,
		uploadMiddleware.single('file'),
		validateFileUpload,
		async (req, res) => {
			try {
				if (!req.file) {
					return res.status(400).json({ message: 'File is required' });
				}
				const key = (req.body.key || '').toString().trim();
				if (!key) {
					return res
						.status(400)
						.json({ message: 'Key is required (e.g. Lingkaran, Bidikan)' });
				}
				const url = await uploadFilosofiImage(req.file, key);
				res.json({ url });
			} catch (error) {
				console.error('Upload filosofi error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Endpoint upload logo himpunan & logo divisi
	app.post(
		'/api/upload',
		authenticate,
		uploadLimiter,
		uploadMiddleware.single('file'),
		validateFileUpload,
		async (req, res) => {
			try {
				if (!req.file) {
					return res.status(400).json({ message: 'File is required' });
				}

				// Ambil URL file lama untuk dihapus jika ada
				const oldFileUrl = req.body.oldFileUrl;

				// Tentukan kategori berdasarkan context (default organization untuk logo)
				const category = req.body.category || 'organization';

				// Simpan di attached_assets dengan kategori yang sesuai
				const imageUrl = await uploadHandler(
					req.file,
					true,
					category,
					oldFileUrl,
				);
				res.json({ url: imageUrl });
			} catch (error) {
				console.error('Upload logo error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Folder contents endpoint - kept for potential future use
	app.post('/api/gdrive/folder-contents', async (req, res) => {
		try {
			const { folderId, url } = req.body;

			if (!folderId && !url) {
				return res.status(400).json({
					message: 'Either folderId or url is required',
				});
			}

			const {
				extractFileId,
				getFolderContents,
				isValidGoogleDriveUrl,
				isFolderUrl,
			} = await import('./googleDrive');

			let targetFolderId = folderId;

			if (url && !folderId) {
				if (!isValidGoogleDriveUrl(url)) {
					return res.status(400).json({
						message: 'Invalid Google Drive URL format',
					});
				}

				if (!isFolderUrl(url)) {
					return res.status(400).json({
						message: 'URL must be a folder URL',
					});
				}

				targetFolderId = extractFileId(url);
				if (!targetFolderId) {
					return res.status(400).json({
						message: 'Could not extract folder ID from URL',
					});
				}
			}

			const contents = await getFolderContents(targetFolderId);

			res.json({
				contents,
				folderId: targetFolderId,
			});
		} catch (error) {
			console.error('Get folder contents error:', error);
			res.status(500).json({
				message: 'Internal server error',
			});
		}
	});

	// Test route untuk API protection
	app.get('/api/test/protection', (req, res) => {
		res.json({
			message: 'This route should be protected by API protection middleware',
		});
	});

	app.use('/api/chat', chatRouter);
	app.use('/api/comments', commentRouter);
	app.use('/api/feedback', feedbackRouter);
	app.use('/api/sharing', sharingRouter);

	// SPA Routing - Handle all frontend routes
	// This ensures that routes like /dashboard, /berita, etc. work correctly
	app.get('*', (req, res, next) => {
		// Skip API routes
		if (req.path.startsWith('/api/')) {
			return next();
		}

		// Skip static files
		if (req.path.includes('.')) {
			return next();
		}

		// For all other routes, serve the main app
		// This will be handled by Vite middleware in development
		// or static file serving in production
		next();
	});

	// Role Management API endpoints
	app.get(
		'/api/roles',
		authenticate,
		requirePermission('roles.view'),
		async (req, res) => {
			try {
				const roles = await mongoStorage.getAllRoles();
				res.json(roles);
			} catch (error) {
				console.error('Error getting roles:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Public (authenticated) role levels: expose minimal info for UI hierarchy and filtering
	app.get('/api/roles/levels', authenticate, async (req, res) => {
		try {
			const roles = await mongoStorage.getAllRoles();
			const minimal = roles
				.filter((r: any) => typeof r?.level === 'number')
				.map((r: any) => ({
					_id: r._id,
					name: r.name,
					displayName: r.displayName,
					level: r.level,
				}));
			res.json(minimal);
		} catch (error) {
			console.error('Error getting role levels:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Roles that current user is allowed to assign (no need roles.view)
	// Returned with requesterLevel to support consistent client-side logic
	app.get('/api/roles/assignable', authenticate, async (req, res) => {
		try {
			const allRoles = await mongoStorage.getAllRoles();
			const requesterRoleName = ((req.user as any)?.role || '').toString();

			// Cari role user saat ini secara case-insensitive
			let requesterRole = allRoles.find(
				(r: any) =>
					(r?.name || '').toString().toLowerCase() ===
					requesterRoleName.toLowerCase(),
			);

			// Fallback: gunakan storage lookup bila tidak ketemu di cache lokal
			if (!requesterRole) {
				try {
					requesterRole = await mongoStorage.getRoleByName(requesterRoleName);
				} catch (_) {
					// ignore
				}
			}

			const requesterLevel =
				typeof (requesterRole as any)?.level === 'number'
					? (requesterRole as any).level
					: 999;

			const roles = allRoles
				.filter((r: any) => typeof r?.level === 'number')
				.filter((r: any) => r.level > requesterLevel)
				.sort((a: any, b: any) => a.level - b.level);

			res.json({ roles, requesterLevel });
		} catch (error) {
			console.error('Error getting assignable roles:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/roles',
		authenticate,
		requirePermission('roles.create'),
		async (req, res) => {
			try {
				const { name, displayName, description, level, permissions } = req.body;

				// Validate required fields
				if (!name || !displayName || !level) {
					return res
						.status(400)
						.json({ message: 'Name, displayName, and level are required' });
				}

				// Check if user can create this role level
				if (
					!canManageRole(
						(req.user as UserWithRole)?.role || '',
						`level_${level}`,
					)
				) {
					return res
						.status(403)
						.json({ message: 'You cannot create roles at this level' });
				}

				const roleData = {
					name,
					displayName,
					description: description || '',
					level,
					permissions: permissions || [],
					createdBy: (req.user as UserWithRole)?._id || '',
				};

				const role = await mongoStorage.createRole(roleData);
				res.status(201).json(role);
			} catch (error) {
				console.error('Error creating role:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Create role with automatic level shifting (requires only roles.create)
	app.post(
		'/api/roles/create-with-shift',
		authenticate,
		requirePermission('roles.create'),
		async (req, res) => {
			try {
				const { name, displayName, description, level, permissions } = req.body;

				if (!name || !displayName || !level) {
					return res
						.status(400)
						.json({ message: 'Name, displayName, and level are required' });
				}

				// Get current user level
				// Cari role user secara akurat berdasarkan nama role di user
				const currentUserRoleName = (req.user as any)?.role || '';
				const allRolesForLevel = await mongoStorage.getAllRoles();
				const foundUserRole = allRolesForLevel.find(
					(r: any) =>
						(r?.name || '').toString() === currentUserRoleName.toString(),
				);
				const userLevel =
					typeof foundUserRole?.level === 'number' ? foundUserRole.level : 999;

				// Only allow creating roles below the user's level (higher numeric)
				if (typeof level !== 'number' || level <= userLevel) {
					return res.status(403).json({
						message:
							'You can only create roles with a lower privilege (greater level number) than your own',
					});
				}

				// Shift roles at and below the desired level: level >= desired -> level + 1 (descending order to avoid conflicts)
				const allRoles = await mongoStorage.getAllRoles();
				const toShift = allRoles
					.filter((r: any) => typeof r.level === 'number' && r.level >= level)
					.sort((a: any, b: any) => (b.level || 0) - (a.level || 0));

				for (const r of toShift) {
					await mongoStorage.updateRole(String(r._id), {
						level: (r.level as number) + 1,
					});
				}

				// Finally, create the new role at desired level
				const roleData = {
					name,
					displayName,
					description: description || '',
					level,
					permissions: permissions || [],
					createdBy: (req.user as any)?._id || '',
				};

				const role = await mongoStorage.createRole(roleData);
				res.status(201).json(role);
			} catch (error) {
				console.error('Create role with shift error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/roles/:id',
		authenticate,
		requirePermission('roles.edit'),
		async (req, res) => {
			try {
				const { id } = req.params;
				const { displayName, description, permissions, level } = req.body;

				// Get current role to check level
				const currentRole = await mongoStorage.getRoleByName(
					(req.user as UserWithRole)?.role || '',
				);
				if (!currentRole) {
					return res
						.status(404)
						.json({ message: 'Current user role not found' });
				}

				const updateData: any = {
					displayName,
					description,
					permissions,
					updatedAt: new Date(),
				};

				// Only update level if provided
				if (level !== undefined) {
					updateData.level = level;
				}

				const role = await mongoStorage.updateRole(id, updateData);
				if (!role) {
					return res.status(404).json({ message: 'Role not found' });
				}

				res.json(role);
			} catch (error) {
				console.error('Error updating role:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete(
		'/api/roles/:id',
		authenticate,
		requirePermission('roles.delete'),
		async (req, res) => {
			try {
				const { id } = req.params;

				const role = await mongoStorage.deleteRole(id);
				if (!role) {
					return res.status(404).json({ message: 'Role not found' });
				}

				res.json({ message: 'Role deleted successfully' });
			} catch (error) {
				console.error('Error deleting role:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Permission Management API endpoints
	app.get(
		'/api/permissions',
		authenticate,
		requirePermission('roles.view'),
		async (req, res) => {
			try {
				const permissions = await mongoStorage.getAllPermissions();
				res.json(permissions);
			} catch (error) {
				console.error('Error getting permissions:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/permissions',
		authenticate,
		requirePermission('roles.create'),
		async (req, res) => {
			try {
				const { name, displayName, description, category } = req.body;

				if (!name || !displayName || !category) {
					return res
						.status(400)
						.json({ message: 'Name, displayName, and category are required' });
				}

				const permissionData = {
					name,
					displayName,
					description: description || '',
					category,
				};

				const permission = await mongoStorage.createPermission(permissionData);
				res.status(201).json(permission);
			} catch (error) {
				console.error('Error creating permission:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Division Management API endpoints
	app.get(
		'/api/divisions',
		authenticate,
		// requirePermission('divisions.view'), // Temporarily disabled
		async (req, res) => {
			try {
				const divisions = await mongoStorage.getAllDivisions();
				res.json(divisions);
			} catch (error) {
				console.error('Error getting divisions:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Get available positions (positions that are not assigned to any division)
	app.get(
		'/api/divisions/available-positions',
		authenticate,
		async (req, res) => {
			try {
				const divisions = await mongoStorage.getAllDivisions();
				const allAssignedPositions = new Set();

				// Collect all assigned positions
				divisions.forEach((division: any) => {
					if (division.positions) {
						division.positions.forEach((position: string) => {
							allAssignedPositions.add(position);
						});
					}
				});

				// Get all positions from organization positions
				const allPositions = await mongoStorage.getAllPositions();
				const availablePositions = [];

				// Find positions that are not assigned to any division
				for (const periodData of allPositions) {
					if (periodData.positions) {
						for (const position of periodData.positions) {
							if (!allAssignedPositions.has(position.name)) {
								availablePositions.push(position.name);
							}
						}
					}
				}

				// Remove duplicates
				const uniqueAvailablePositions = Array.from(
					new Set(availablePositions),
				);

				res.json(uniqueAvailablePositions);
			} catch (error) {
				console.error('Error getting available positions:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/divisions',
		authenticate,
		// requirePermission('divisions.create'), // Temporarily disabled
		async (req, res) => {
			try {
				const { name, displayName, description, positions, color, logo } =
					req.body;

				if (!name || !displayName) {
					return res.status(400).json({
						message: 'Name and displayName are required',
					});
				}

				// Check if division already exists
				const existingDivision = await mongoStorage.getDivisionByName(name);
				if (existingDivision) {
					return res.status(400).json({
						message: 'Division with this name already exists',
					});
				}

				const division = await mongoStorage.createDivision({
					name,
					displayName,
					description: description || '',
					positions: positions || [],
					color: color || '#3B82F6',
					logo: logo || '',
				});

				res.status(201).json(division);
			} catch (error) {
				console.error('Error creating division:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/divisions/:id',
		authenticate,
		// requirePermission('divisions.edit'), // Temporarily disabled
		async (req, res) => {
			try {
				const { id } = req.params;
				const { displayName, description, positions, color, logo } = req.body;

				const updateData: any = {
					displayName,
					description,
					positions,
					color,
					logo,
					updatedAt: new Date(),
				};

				const division = await mongoStorage.updateDivision(id, updateData);
				if (!division) {
					return res.status(404).json({ message: 'Division not found' });
				}

				res.json(division);
			} catch (error) {
				console.error('Error updating division:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete(
		'/api/divisions/:id',
		authenticate,
		requirePermission('divisions.delete'),
		async (req, res) => {
			try {
				const { id } = req.params;

				const division = await mongoStorage.deleteDivision(id);
				if (!division) {
					return res.status(404).json({ message: 'Division not found' });
				}

				res.json({ message: 'Division deleted successfully' });
			} catch (error) {
				console.error('Error deleting division:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// User Role Assignment API
	app.put(
		'/api/users/:id/role',
		authenticate,
		requirePermission('roles.assign'),
		async (req, res) => {
			try {
				const { id } = req.params;
				const { role } = req.body;

				if (!role) {
					return res.status(400).json({ message: 'Role is required' });
				}

				// Check if user can assign this role
				if (!canManageRole((req.user as UserWithRole)?.role || '', role)) {
					return res
						.status(403)
						.json({ message: 'You cannot assign this role' });
				}

				const user = await mongoStorage.updateUser(id, { role });
				if (!user) {
					return res.status(404).json({ message: 'User not found' });
				}

				res.json(user);
			} catch (error) {
				console.error('Error assigning role:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Get current user permissions
	app.get('/api/auth/permissions', authenticate, async (req, res) => {
		try {
			const permissions = await mongoStorage.getUserPermissions(
				(req.user as UserWithRole)?._id || '',
			);
			res.json({ permissions });
		} catch (error) {
			console.error('Error getting user permissions:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Refresh user permissions (for after role changes)
	app.post('/api/auth/refresh-permissions', authenticate, async (req, res) => {
		try {
			const permissions = await mongoStorage.getUserPermissions(
				(req.user as UserWithRole)?._id || '',
			);
			res.json({ permissions });
		} catch (error) {
			console.error('Error refreshing user permissions:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Owner-only: recompute owner role permissions (add any newly defined permissions)
	app.post(
		'/api/admin/permissions/recompute-owner',
		authenticate,
		async (req, res) => {
			try {
				const user = req.user as UserWithRole;
				if (user.role !== 'owner') {
					return res
						.status(403)
						.json({ message: 'Only owner can run this action' });
				}
				const allPerms = await mongoStorage.getAllPermissions();
				const allNames = allPerms.map((p: any) => p.name);
				const { Role } = await import('../db/mongodb');
				await Role.updateOne(
					{ name: 'owner' },
					{ $set: { permissions: allNames, updatedAt: new Date() } },
				);
				res.json({
					message: `Owner role updated with ${allNames.length} permissions`,
					permissions: allNames,
				});
			} catch (error) {
				console.error('Error recomputing owner permissions:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// ══════════════════════════════════════════════════════════════
	// EVENT YEAR API
	// ══════════════════════════════════════════════════════════════

	app.get('/api/event-years', async (_req, res) => {
		try {
			const years = await mongoStorage.getAllEventYears();
			res.json(years);
		} catch (error) {
			console.error('Error getting event years:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/event-years',
		authenticate,
		requirePermission('events.years_admin'),
		async (req, res) => {
			try {
				const { year } = req.body;
				if (!year || typeof year !== 'number') {
					return res.status(400).json({ message: 'Year (number) is required' });
				}
				const doc = await mongoStorage.createEventYear({
					year,
					isActiveOnHome: false,
				});
				res.status(201).json(doc);
			} catch (error: any) {
				if (error?.code === 11000) {
					return res.status(409).json({ message: 'Year already exists' });
				}
				console.error('Error creating event year:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.patch(
		'/api/event-years/:id',
		authenticate,
		requirePermission('events.years_admin'),
		async (req, res) => {
			try {
				const { id } = req.params;
				const doc = await mongoStorage.updateEventYear(id, req.body);
				if (!doc)
					return res.status(404).json({ message: 'Event year not found' });
				res.json(doc);
			} catch (error) {
				console.error('Error updating event year:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.patch(
		'/api/event-years/:id/activate',
		authenticate,
		requirePermission('events.years_admin'),
		async (req, res) => {
			try {
				const { id } = req.params;
				// Check multi-year mode from settings
				const settings = await mongoStorage.getSettings();
				const multiYear = settings?.eventsAllowMultipleYearsOnHome === true;
				let doc;
				if (multiYear) {
					// Multi-year: just toggle ON this year without deactivating others
					doc = await mongoStorage.toggleEventYearActive(id, true);
				} else {
					// Single-year: deactivate all, then activate this one
					doc = await mongoStorage.setActiveEventYear(id);
				}
				if (!doc)
					return res.status(404).json({ message: 'Event year not found' });
				res.json(doc);
			} catch (error) {
				console.error('Error activating event year:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.patch(
		'/api/event-years/:id/deactivate',
		authenticate,
		requirePermission('events.years_admin'),
		async (req, res) => {
			try {
				const { id } = req.params;
				const doc = await mongoStorage.toggleEventYearActive(id, false);
				if (!doc)
					return res.status(404).json({ message: 'Event year not found' });
				res.json(doc);
			} catch (error) {
				console.error('Error deactivating event year:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete(
		'/api/event-years/:id',
		authenticate,
		requirePermission('events.years_admin'),
		async (req, res) => {
			try {
				const { id } = req.params;
				await mongoStorage.deleteEventYear(id);
				res.json({ message: 'Event year deleted' });
			} catch (error) {
				console.error('Error deleting event year:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// ══════════════════════════════════════════════════════════════
	// EVENT API
	// ══════════════════════════════════════════════════════════════

	app.get('/api/events/published', async (_req, res) => {
		try {
			const events = await mongoStorage.getPublishedEventsAllYears();
			res.json(events);
		} catch (error) {
			console.error('Error getting published events:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/events/active-home', async (_req, res) => {
		try {
			const data = await mongoStorage.getEventsForHome();
			if (!data) return res.json({ year: null, events: [] });
			// Enrich byline multi-owner untuk event cards.
			try {
				if (Array.isArray((data as any).events)) {
					for (const ev of (data as any).events) {
						await enrichEventTreeWithAuthors(ev);
					}
				}
				if (Array.isArray((data as any).years)) {
					for (const y of (data as any).years) {
						if (Array.isArray(y.events)) {
							for (const ev of y.events) {
								await enrichEventTreeWithAuthors(ev);
							}
						}
					}
				}
			} catch (e) {
				console.warn('Failed to enrich event authors:', e);
			}

			res.json(data);
		} catch (error) {
			console.error('Error getting active home events:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/events/by-year/:year', async (req, res) => {
		try {
			const year = parseInt(req.params.year, 10);
			if (isNaN(year)) return res.status(400).json({ message: 'Invalid year' });
			const parentOnly = req.query.parentOnly === 'true';
			const data = await mongoStorage.getEventsByYear(year, parentOnly);
			if (!data) return res.status(404).json({ message: 'Year not found' });
			res.json(data);
		} catch (error) {
			console.error('Error getting events by year:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/events', authenticate, async (req, res) => {
		try {
			await expirePendingShares();

			const { yearId, parentId } = req.query;
			if (!yearId)
				return res.status(400).json({ message: 'yearId is required' });
			const pId =
				parentId === 'null' || parentId === ''
					? null
					: (parentId as string | undefined);

			const userId = (req.user as UserWithRole)._id;
			const userRole = await mongoStorage.getRoleByName(
				(req.user as UserWithRole).role || '',
			);
			const permissions = userRole?.permissions || [];

			let authorIdFilter: string | null = null;
			let includeSharedIds: string[] = [];
			const approvedPermissionMap = new Map<string, 'view' | 'edit'>();
			let pendingIdSet = new Set<string>();

			if (!permissions.includes('events.view_others')) {
				if (
					permissions.includes('events.view') ||
					permissions.includes('events.edit') ||
					permissions.includes('events.create')
				) {
					authorIdFilter = userId;
				}

				const now = new Date();
				const sharedApproved = await PostSharing.find({
					entityType: 'events',
					targetId: userId,
					status: 'approved',
				}).lean();
				const sharedPending = await PostSharing.find({
					entityType: 'events',
					status: 'pending',
					expiresAt: { $gt: now },
					targetId: userId,
				}).lean();
				includeSharedIds = Array.from(
					new Set([
						...sharedApproved.map((s) => String(s.entityId)),
						...sharedPending.map((s) => String(s.entityId)),
					]),
				);
				for (const s of sharedApproved) {
					const eid = String(s.entityId);
					const perm = s.permission === 'edit' ? 'edit' : 'view';
					if (!approvedPermissionMap.has(eid) || perm === 'edit') {
						approvedPermissionMap.set(eid, perm);
					}
				}
				pendingIdSet = new Set(
					sharedPending.map((s) => String(s.entityId)),
				);

				// If current parent (or any ancestor) is shared, sub-event list under it should be accessible too.
				if (
					pId &&
					(await hasApprovedSharing(
						'events',
						String(pId),
						userId.toString(),
						'view',
					))
				) {
					authorIdFilter = null;
				}

				if (!authorIdFilter && includeSharedIds.length === 0) {
					return res.status(403).json({
						message: 'You do not have permission to view events',
					});
				}
			}

			const events = await mongoStorage.getEventsByYearId(
				yearId as string,
				pId,
				authorIdFilter,
			);

			if (includeSharedIds.length > 0) {
				const existingIds = new Set(events.map((e: any) => String(e._id)));
				for (const sid of includeSharedIds) {
					if (!existingIds.has(sid)) {
						const ev = await mongoStorage.getEventById(sid);
						if (ev && String((ev as any).yearId) === yearId) {
							const matchParent = pId === null
								? !(ev as any).parentId
								: String((ev as any).parentId) === pId;
							if (matchParent) events.push(ev);
						}
					}
				}
			}

			const resolveEffectivePermission = async (
				eventItem: any,
			): Promise<'view' | 'edit' | undefined> => {
				let current: any = eventItem;
				while (current) {
					const id = String(current._id || current.id);
					const perm = approvedPermissionMap.get(id);
					if (perm) return perm;
					if (!(current as any).parentId) break;
					current = await mongoStorage.getEventById(
						String((current as any).parentId),
					);
				}
				return undefined;
			};

			const resolveHasPending = async (eventItem: any): Promise<boolean> => {
				let current: any = eventItem;
				while (current) {
					const id = String(current._id || current.id);
					if (pendingIdSet.has(id)) return true;
					if (!(current as any).parentId) break;
					current = await mongoStorage.getEventById(
						String((current as any).parentId),
					);
				}
				return false;
			};

			const enrichedEvents: any[] = [];
			for (const ev of events as any[]) {
				const sharingPermission = await resolveEffectivePermission(ev);
				const hasPending = await resolveHasPending(ev);
				enrichedEvents.push({
					...ev,
					_sharingPermission: sharingPermission,
					_sharingStatus: hasPending
						? 'pending'
						: sharingPermission
							? 'approved'
							: undefined,
				});
			}

			res.json(enrichedEvents);
		} catch (error) {
			console.error('Error getting events:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/events/:id', async (req, res) => {
		try {
			const { id } = req.params;
			const withChildren = req.query.children === 'true';
			const event = withChildren
				? await mongoStorage.getEventWithChildren(id)
				: await mongoStorage.getEventById(id);
			if (!event) return res.status(404).json({ message: 'Event not found' });

			// Increment view count (fire-and-forget)
			try {
				const currentViews = typeof (event as any).viewCount === 'number' ? (event as any).viewCount : 0;
				const nextViews = currentViews + 1;
				await mongoStorage.updateEvent(id, { viewCount: nextViews });
				(event as any).viewCount = nextViews;
			} catch (incError) {
				console.warn('Failed to increment event viewCount:', incError);
			}

			// Enrich byline multi-owner untuk event detail modal.
			try {
				await enrichEventTreeWithAuthors(event);
			} catch (e) {
				console.warn('Failed to enrich event authors:', e);
			}

			res.json(event);
		} catch (error) {
			console.error('Error getting event:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/events',
		authenticate,
		requirePermission('events.create'),
		uploadMiddleware.fields([
			{ name: 'thumbnail', maxCount: 1 },
			{ name: 'attachmentFiles', maxCount: 10 },
		]),
		async (req, res) => {
			try {
				const user = req.user as UserWithRole;
				const files = req.files as
					| { [fieldname: string]: Express.Multer.File[] }
					| undefined;
				const body = req.body;

				let thumbnail = '';
				let thumbnailSource: 'local' | 'gdrive' = 'local';

				if (files?.thumbnail?.[0]) {
					const { uploadHandler: doUpload } = await import('./upload');
					thumbnail = await doUpload(files.thumbnail[0], false, 'events');
					thumbnailSource = 'local';
				} else if (body.thumbnailGdrive) {
					thumbnail = body.thumbnailGdrive;
					thumbnailSource = 'gdrive';
				}

				let attachments: any[] = [];
				if (body.attachments) {
					try {
						attachments = JSON.parse(body.attachments);
					} catch {
						/* ignore */
					}
				}

				if (files?.attachmentFiles) {
					const { uploadHandler: doUpload } = await import('./upload');
					for (const f of files.attachmentFiles) {
						const url = await doUpload(f, false, 'events');
						attachments.push({
							name: f.originalname,
							url,
							type: f.mimetype,
							source: 'local' as const,
						});
					}
				}

				const startDate = new Date(body.startDate);
				const month = startDate.getMonth() + 1;

				let relatedBerita: string[] = [];
				if (body.relatedBeritaIds) {
					try {
						relatedBerita = JSON.parse(body.relatedBeritaIds);
					} catch {
						/* ignore */
					}
				}

				const eventData = {
					yearId: body.yearId,
					parentId: body.parentId || null,
					title: body.title,
					description: body.description || '',
					thumbnail,
					thumbnailSource,
					gdriveFileId: body.gdriveFileId || '',
					startDate,
					endDate: new Date(body.endDate),
					month,
					attachments,
					published: body.published === 'true' || body.published === true,
					createdBy: user._id,
					relatedBerita,
				};

				const event = await mongoStorage.createEvent(eventData);
				res.status(201).json(event);
			} catch (error) {
				console.error('Error creating event:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.patch(
		'/api/events/:id',
		authenticate,
		uploadMiddleware.fields([
			{ name: 'thumbnail', maxCount: 1 },
			{ name: 'attachmentFiles', maxCount: 10 },
		]),
		async (req, res) => {
			try {
				const { id } = req.params;
				const existingEvent = await mongoStorage.getEventById(id);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });

				const body = req.body;
				const canEdit = await checkEventPermission(
					req.user as UserWithRole,
					existingEvent,
					'edit',
				);
				if (!canEdit) {
					return res.status(403).json({
						message: 'You do not have permission to edit this event',
					});
				}
				if (
					body.published === 'true' ||
					body.published === true
				) {
					const canPublish = await checkEventPermission(
						req.user as UserWithRole,
						existingEvent,
						'publish',
					);
					if (!canPublish) {
						return res.status(403).json({
							message:
								'You do not have permission to publish events',
						});
					}
				}

				const files = req.files as
					| { [fieldname: string]: Express.Multer.File[] }
					| undefined;

				const updateData: any = {};

				if (body.title !== undefined) updateData.title = body.title;
				if (body.description !== undefined)
					updateData.description = body.description;
				if (body.published !== undefined)
					updateData.published =
						body.published === 'true' || body.published === true;

				if (files?.thumbnail?.[0]) {
					const { uploadHandler: doUpload } = await import('./upload');
					const existing = await mongoStorage.getEventById(id);
					updateData.thumbnail = await doUpload(
						files.thumbnail[0],
						false,
						'events',
						existing?.thumbnail,
					);
					updateData.thumbnailSource = 'local';
				} else if (body.thumbnailGdrive) {
					updateData.thumbnail = body.thumbnailGdrive;
					updateData.thumbnailSource = 'gdrive';
				}

				if (body.startDate) {
					updateData.startDate = new Date(body.startDate);
					updateData.month = updateData.startDate.getMonth() + 1;
				}
				if (body.endDate) updateData.endDate = new Date(body.endDate);

				if (body.attachments) {
					try {
						updateData.attachments = JSON.parse(body.attachments);
					} catch {
						/* ignore */
					}
				}

				if (files?.attachmentFiles) {
					const { uploadHandler: doUpload } = await import('./upload');
					if (!updateData.attachments) {
						const existing = await mongoStorage.getEventById(id);
						updateData.attachments = existing?.attachments || [];
					}
					for (const f of files.attachmentFiles) {
						const url = await doUpload(f, false, 'events');
						updateData.attachments.push({
							name: f.originalname,
							url,
							type: f.mimetype,
							source: 'local' as const,
						});
					}
				}

				if (body.relatedBeritaIds !== undefined) {
					try {
						updateData.relatedBerita = JSON.parse(body.relatedBeritaIds);
					} catch {
						/* ignore */
					}
				}

				const event = await mongoStorage.updateEvent(id, updateData);
				if (!event) return res.status(404).json({ message: 'Event not found' });
				res.json(event);
			} catch (error) {
				console.error('Error updating event:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.delete('/api/events/:id', authenticate, async (req, res) => {
		try {
			const { id } = req.params;
			const event = await mongoStorage.getEventById(id);
			if (!event)
				return res.status(404).json({ message: 'Event not found' });

			const canDelete = await checkEventPermission(
				req.user as UserWithRole,
				event,
				'delete',
			);
			if (!canDelete) {
				return res.status(403).json({
					message: 'You do not have permission to delete this event',
				});
			}

			if (event.thumbnail && event.thumbnailSource === 'local') {
				try {
					const { deleteFile: delFile } = await import('./upload');
					await delFile(event.thumbnail);
				} catch {
					/* ignore */
				}
			}
			for (const att of event.attachments || []) {
				if (att.source === 'local') {
					try {
						const { deleteFile: delFile } = await import('./upload');
						await delFile(att.url);
					} catch {
						/* ignore */
					}
				}
			}

			await mongoStorage.deleteEvent(id);
			res.json({ message: 'Event deleted' });
		} catch (error) {
			console.error('Error deleting event:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// ── Copy Event → Berita ──
	app.post(
		'/api/events/:id/copy-to-berita',
		authenticate,
		async (req, res) => {
			try {
				const { id } = req.params;
				const user = req.user as UserWithRole;
				const event = await mongoStorage.getEventById(id);
				if (!event)
					return res.status(404).json({ message: 'Event not found' });
				const canView = await checkEventPermission(
					user,
					event,
					'view',
				);
				if (!canView) {
					return res.status(403).json({
						message:
							'You do not have permission to view this event',
					});
				}
				const { copyAttachments } = req.body;
				const beritaItem = await mongoStorage.copyEventToBerita(
					id,
					String(user._id),
					user.name || user.username,
					{
						copyAttachments:
							copyAttachments === true || copyAttachments === 'true',
					},
				);
				res.status(201).json(beritaItem);
			} catch (error: any) {
				console.error('Error copying event to berita:', error);
				res
					.status(500)
					.json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// ── Copy Berita → Event ──
	app.post(
		'/api/berita/:id/copy-to-event',
		authenticate,
		requirePermission('events.create'),
		async (req, res) => {
			try {
				const { id } = req.params;
				const user = req.user as UserWithRole;
				const { year, parentEventId, copyAttachments } = req.body;
				const result = await mongoStorage.copyBeritaToEvent(
					id,
					String(user._id),
					{
						year: year ? parseInt(year, 10) : undefined,
						parentEventId: parentEventId || undefined,
						copyAttachments:
							copyAttachments === true || copyAttachments === 'true',
					},
				);
				res.status(201).json(result);
			} catch (error: any) {
				console.error('Error copying berita to event:', error);
				res
					.status(500)
					.json({ message: error.message || 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/events/:id/attach-berita',
		authenticate,
		async (req, res) => {
			try {
				const { id } = req.params;
				const user = req.user as UserWithRole;
				const existingEvent = await mongoStorage.getEventById(id);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });
				const canEdit = await checkEventPermission(
					user,
					existingEvent,
					'edit',
				);
				if (!canEdit) {
					return res.status(403).json({
						message:
							'You do not have permission to edit this event',
					});
				}
				const { beritaId, copyFiles } = req.body;
				if (!beritaId)
					return res.status(400).json({ message: 'beritaId required' });
				const event = await mongoStorage.attachBeritaToEvent(id, beritaId, {
					copyFiles: copyFiles === true || copyFiles === 'true',
				});
				if (!event) return res.status(404).json({ message: 'Event not found' });
				res.json(event);
			} catch (error: any) {
				console.error('Error attaching berita to event:', error);
				res
					.status(500)
					.json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// ── Detach Berita from Event ──
	app.delete(
		'/api/events/:id/attach-berita/:beritaId',
		authenticate,
		async (req, res) => {
			try {
				const { id, beritaId } = req.params;
				const user = req.user as UserWithRole;
				const existingEvent = await mongoStorage.getEventById(id);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });
				const canEdit = await checkEventPermission(
					user,
					existingEvent,
					'edit',
				);
				if (!canEdit) {
					return res.status(403).json({
						message:
							'You do not have permission to edit this event',
					});
				}
				const event = await mongoStorage.detachBeritaFromEvent(id, beritaId);
				if (!event) return res.status(404).json({ message: 'Event not found' });
				res.json(event);
			} catch (error: any) {
				console.error('Error detaching berita from event:', error);
				res
					.status(500)
					.json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// ── Attach Event to Berita (same effect: update event.relatedBerita) ──
	app.post(
		'/api/berita/:id/attach-event',
		authenticate,
		async (req, res) => {
			try {
				const { id: beritaId } = req.params;
				const user = req.user as UserWithRole;
				const { eventId, copyFiles } = req.body;
				if (!eventId)
					return res.status(400).json({ message: 'eventId required' });
				const existingEvent = await mongoStorage.getEventById(eventId);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });
				const canEdit = await checkEventPermission(
					user,
					existingEvent,
					'edit',
				);
				if (!canEdit) {
					return res.status(403).json({
						message:
							'You do not have permission to edit this event',
					});
				}
				const event = await mongoStorage.attachBeritaToEvent(
					eventId,
					beritaId,
					{
						copyFiles: copyFiles === true || copyFiles === 'true',
					},
				);
				if (!event) return res.status(404).json({ message: 'Event not found' });
				res.json(event);
			} catch (error: any) {
				console.error('Error attaching event to berita:', error);
				res
					.status(500)
					.json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// ── Detach Event from Berita ──
	app.delete(
		'/api/berita/:id/attach-event/:eventId',
		authenticate,
		async (req, res) => {
			try {
				const { id: beritaId, eventId } = req.params;
				const user = req.user as UserWithRole;
				const existingEvent = await mongoStorage.getEventById(eventId);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });
				const canEdit = await checkEventPermission(
					user,
					existingEvent,
					'edit',
				);
				if (!canEdit) {
					return res.status(403).json({
						message:
							'You do not have permission to edit this event',
					});
				}
				const event = await mongoStorage.detachBeritaFromEvent(
					eventId,
					beritaId,
				);
				if (!event) return res.status(404).json({ message: 'Event not found' });
				res.json(event);
			} catch (error: any) {
				console.error('Error detaching event from berita:', error);
				res
					.status(500)
					.json({ message: error.message || 'Internal server error' });
			}
		},
	);

	const server = createServer(app);
	return server;
}
