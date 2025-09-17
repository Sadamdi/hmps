import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import fs from 'fs';
import { createServer, type Server } from 'http';
import path from 'path';
import {
	authenticate,
	authorize,
	canManageRole,
	createSessionRecord,
	generateToken,
	hashPassword,
	requirePermission,
	verifyPassword,
} from './auth';
import { mongoStorage } from './mongo-storage'; // Use mongoStorage instead of storage
import chatRouter from './routes/chat';
import {
	cleanupArticleImages,
	deleteFile,
	extractImageUrlsFromContent,
	uploadArticleImage,
	uploadHandler,
	uploadMiddleware,
	uploadOrganizationMemberImage,
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

// Helper function to check article permissions
async function checkArticlePermission(
	user: UserWithRole,
	article: any,
	action: 'edit' | 'delete' | 'publish'
): Promise<boolean> {
	try {
		console.log(
			`🔍 Checking ${action} permission for user:`,
			user.role,
			user._id
		);
		console.log(`📄 Article author:`, article.authorId);

		// Get user's role and permissions
		const userRole = await mongoStorage.getRoleByName(user.role);
		if (!userRole) {
			console.log('❌ User role not found:', user.role);
			return false;
		}

		const permissions = userRole.permissions;
		const isOwner = user._id.toString() === article.authorId.toString();

		console.log(`👤 User permissions:`, permissions);
		console.log(`🔐 Is owner:`, isOwner);
		console.log(`🔍 User ID:`, user._id.toString());
		console.log(`🔍 Article Author ID:`, article.authorId.toString());

		// Check specific permissions
		switch (action) {
			case 'edit':
				// Can edit if has articles.edit permission and it's their own article
				// OR has articles.edit_others permission
				const canEdit =
					(permissions.includes('articles.edit') && isOwner) ||
					permissions.includes('articles.edit_others');
				console.log(`✏️ Can edit:`, canEdit);
				return canEdit;

			case 'delete':
				// Can delete if has articles.delete permission and it's their own article
				// OR has articles.delete_others permission
				const canDelete =
					(permissions.includes('articles.delete') && isOwner) ||
					permissions.includes('articles.delete_others');
				console.log(`🗑️ Can delete:`, canDelete);
				return canDelete;

			case 'publish':
				// Can publish if has articles.publish permission
				const canPublish = permissions.includes('articles.publish');
				console.log(`📢 Can publish:`, canPublish);
				return canPublish;

			default:
				return false;
		}
	} catch (error) {
		console.error('Error checking article permission:', error);
		return false;
	}
}

// Helper function to check library permissions
async function checkLibraryPermission(
	user: UserWithRole,
	libraryItem: any,
	action: 'edit' | 'delete'
): Promise<boolean> {
	try {
		console.log(
			`🔍 Checking library ${action} permission for user:`,
			user.role,
			user._id
		);
		console.log(`📚 Library item author:`, libraryItem.authorId);

		const userRole = await mongoStorage.getRoleByName(user.role);
		if (!userRole) {
			console.log('❌ User role not found:', user.role);
			return false;
		}

		const permissions = userRole.permissions;
		const isOwner = user._id.toString() === libraryItem.authorId.toString();

		console.log(`👤 User permissions:`, permissions);
		console.log(`🔐 Is owner:`, isOwner);
		console.log(`🔍 User ID:`, user._id.toString());
		console.log(`🔍 Library Author ID:`, libraryItem.authorId.toString());

		switch (action) {
			case 'edit':
				const canEdit =
					(permissions.includes('library.edit') && isOwner) ||
					permissions.includes('library.edit_others');
				console.log(`✏️ Can edit library:`, canEdit);
				return canEdit;

			case 'delete':
				const canDelete =
					(permissions.includes('library.delete') && isOwner) ||
					permissions.includes('library.delete_others');
				console.log(`🗑️ Can delete library:`, canDelete);
				return canDelete;

			default:
				return false;
		}
	} catch (error) {
		console.error('Error checking library permission:', error);
		return false;
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

				// Find user by username
				const user = await mongoStorage.getUserByUsername(username);
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
							{ $set: { revokedAt: new Date() } }
						);
					}
				} catch (e) {
					console.warn('Session retention maintenance (login) failed:', e);
				}
			} catch (error) {
				console.error('Login error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
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
					{ $set: { revokedAt: new Date() } }
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
					{ $set: { revokedAt: new Date() } }
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
				{ $set: { revokedAt: new Date() } }
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
				user.password
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

	// Edit user profile route
	app.put('/api/auth/profile', authenticate, async (req, res) => {
		try {
			const userId = (req.user as UserWithRole)?._id;
			const { username, name, email } = req.body;

			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			// Get current user
			const currentUser = await mongoStorage.getUserById(userId);
			if (!currentUser) {
				return res.status(404).json({ message: 'User not found' });
			}

			// Check for unique username (excluding current user)
			if (username && username !== currentUser.username) {
				const userWithSameUsername = await mongoStorage.getUserByUsername(
					username
				);
				if (
					userWithSameUsername &&
					userWithSameUsername._id.toString() !== userId
				) {
					return res.status(400).json({ message: 'Username already exists' });
				}
			}

			// Check for unique email (excluding current user)
			if (email && email !== currentUser.email) {
				const userWithSameEmail = await mongoStorage
					.getAllUsers()
					.then((users) =>
						users.find(
							(user) => user.email === email && user._id.toString() !== userId
						)
					);
				if (userWithSameEmail) {
					return res.status(400).json({ message: 'Email already exists' });
				}
			}

			// Update user profile
			const updateData: any = {};
			if (username) updateData.username = username;
			if (name) updateData.name = name;
			if (email) updateData.email = email;

			const updatedUser = await mongoStorage.updateUser(userId, updateData);

			// Return user info without password
			const { password: _, ...userWithoutPassword } = updatedUser;
			res.json(userWithoutPassword);
		} catch (error) {
			console.error('Profile update error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

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
		}
	);

	// User management routes
	app.get('/api/users', authenticate, async (req, res) => {
		try {
			const requesterRole = await mongoStorage.getRoleByName(
				(req.user as any)?.role || ''
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

			let users = await mongoStorage.getAllUsers();
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
		}
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
						(r?.name || '').toString() === requesterRoleName.toString()
				);
				const requesterLevel =
					typeof requesterRole?.level === 'number' ? requesterRole.level : 999;
				const targetRoleObj = allRoles.find(
					(r: any) =>
						(r?.name || '').toString() === (existingUser.role || '').toString()
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
		}
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
						(r?.name || '').toString() === requesterRoleName.toString()
				);
				const requesterLevel =
					typeof requesterRole?.level === 'number' ? requesterRole.level : 999;
				const targetRoleObj = allRoles.find(
					(r: any) =>
						(r?.name || '').toString() === (existingUser.role || '').toString()
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
		}
	);

	// Upload images for article content
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

				// Get articleId from request body untuk folder organization
				const articleId = req.body.articleId;

				if (!articleId) {
					return res.status(400).json({ message: 'Article ID is required' });
				}

				// Process the uploaded image (compress + WebP) under uploads/articles/{articleId}
				const imageUrl = await uploadArticleImage(
					req.file,
					undefined,
					articleId,
					false
				);

				// Return the URL to be used in the article content
				res.json({ url: imageUrl });
			} catch (error) {
				console.error('Upload content image error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
	);

	// Articles routes
	app.get('/api/articles', async (req, res) => {
		try {
			const allArticles = await mongoStorage.getPublishedArticles();
			res.json(allArticles);
		} catch (error) {
			console.error('Get articles error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Related articles (PLACE BEFORE /api/articles/:id/:slug to avoid 302 redirect)
	app.get('/api/articles/:id/related', async (req, res) => {
		try {
			const articleId = req.params.id;
			const limit = Math.max(
				1,
				Math.min(5, parseInt((req.query.limit as string) || '2'))
			);

			const base = await mongoStorage.getArticleById(articleId);
			if (!base) {
				return res.status(404).json({ message: 'Article not found' });
			}

			const { RecommendationService } = await import(
				'./services/recommendation'
			);
			const relatedDocs = await RecommendationService.getRelatedById(
				String(base._id),
				limit
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
				}))
			);
		} catch (error) {
			console.error('Get related articles error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/articles/manage', authenticate, async (req, res) => {
		try {
			// Get user permissions
			const userRole = await mongoStorage.getRoleByName(
				(req.user as UserWithRole)?.role || ''
			);
			const permissions = userRole?.permissions || [];

			// Filter by permissions
			let articles;
			if (permissions.includes('articles.view_others')) {
				// Can see all articles
				articles = await mongoStorage.getAllArticles();
			} else if (permissions.includes('articles.view')) {
				// Can only see their own articles
				articles = await mongoStorage.getArticlesByAuthorId(
					(req.user as UserWithRole)?._id || ''
				);
			} else {
				// No articles view permission
				return res
					.status(403)
					.json({ message: 'You do not have permission to view articles' });
			}

			res.json(articles);
		} catch (error) {
			console.error('Get articles management error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Hybrid route: /artikel/:id/:slug (for SEO-friendly URLs)
	app.get('/api/articles/:id/:slug', async (req, res) => {
		try {
			const articleId = req.params.id;
			const slug = req.params.slug;

			const article = await mongoStorage.getArticleById(articleId);

			if (!article) {
				return res.status(404).json({ message: 'Article not found' });
			}

			// If article is not published, only authenticated users can view it
			if (!article.published && !req.user) {
				return res.status(404).json({ message: 'Article not found' });
			}

			// Verify slug matches (optional validation)
			if (article.slug && article.slug !== slug) {
				// Redirect to correct slug if different
				return res.redirect(`/artikel/${articleId}/${article.slug}`);
			}

			res.json(article);
		} catch (error) {
			console.error('Get article by ID and slug error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Get article by slug for SEO-friendly URLs (MUST BE BEFORE /:id route)
	app.get('/api/articles/slug/:slug', async (req, res) => {
		try {
			const slug = req.params.slug;
			const article = await mongoStorage.getArticleBySlug(slug);

			if (!article) {
				return res.status(404).json({ message: 'Article not found' });
			}

			// If article is not published, only authenticated users can view it
			if (!article.published && !req.user) {
				return res.status(404).json({ message: 'Article not found' });
			}

			res.json(article);
		} catch (error) {
			console.error('Get article by slug error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/articles/:id', async (req, res) => {
		try {
			const articleId = req.params.id;
			const article = await mongoStorage.getArticleById(articleId);

			if (!article) {
				return res.status(404).json({ message: 'Article not found' });
			}

			// If article is not published, only authenticated users can view it
			if (!article.published && !req.user) {
				return res.status(404).json({ message: 'Article not found' });
			}

			res.json(article);
		} catch (error) {
			console.error('Get article error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Related articles by similarity (tags + simple text overlap)
	app.get('/api/articles/:id/related', async (req, res) => {
		try {
			const articleId = req.params.id;
			const limit = Math.max(
				1,
				Math.min(5, parseInt((req.query.limit as string) || '2'))
			);

			const base = await mongoStorage.getArticleById(articleId);
			if (!base) {
				return res.status(404).json({ message: 'Article not found' });
			}

			// Use RecommendationService (TF-IDF)
			const { RecommendationService } = await import(
				'./services/recommendation'
			);
			const relatedDocs = await RecommendationService.getRelatedById(
				String(base._id),
				limit
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
				}))
			);
		} catch (error) {
			console.error('Get related articles error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Related by slug as convenience
	app.get('/api/articles/slug/:slug/related', async (req, res) => {
		try {
			const slug = req.params.slug;
			const article = await mongoStorage.getArticleBySlug(slug);
			if (!article)
				return res.status(404).json({ message: 'Article not found' });
			// Use RecommendationService as well
			const { RecommendationService } = await import(
				'./services/recommendation'
			);
			const limit = Math.max(
				1,
				Math.min(5, parseInt((req.query.limit as string) || '2'))
			);
			const relatedDocs = await RecommendationService.getRelatedById(
				String(article._id),
				limit
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
				}))
			);
		} catch (error) {
			console.error('Get related articles by slug error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.post(
		'/api/articles',
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
					(req.user as UserWithRole)?.role || ''
				);
				if (!userRole || !userRole.permissions.includes('articles.create')) {
					return res.status(403).json({
						message: 'You do not have permission to create articles',
					});
				}

				// Check publish permission if trying to publish
				if (published === 'true') {
					if (!userRole.permissions.includes('articles.publish')) {
						return res.status(403).json({
							message: 'You do not have permission to publish articles',
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

				let imageUrl = '/uploads/default-article-image.jpg';
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
				const existingArticles = await mongoStorage.getPublishedArticles();
				const existingSlugs = existingArticles.map(
					(article: any) => article.slug || ''
				);
				const slug = generateUniqueSlug(title.trim(), existingSlugs);

				// Create article first to get articleId
				const newArticle = await mongoStorage.createArticle({
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

				// If local file uploaded (not GDrive), process thumbnail into uploads/articles/{articleId}
				const articleId = (newArticle._id || newArticle.id)?.toString();
				let finalArticle = newArticle;
				if (!gdriveUrl && req.file && articleId) {
					try {
						const processedThumbUrl = await uploadArticleImage(
							req.file,
							undefined,
							articleId,
							false
						);
						finalArticle = await mongoStorage.updateArticle(articleId, {
							image: processedThumbUrl,
							imageSource: 'local',
						});
						imageUrl = processedThumbUrl;
					} catch (thumbErr) {
						console.error(
							'Thumbnail processing after create failed:',
							thumbErr
						);
					}
				}

				// Migrate temp content images to article folder if any (replace URLs in content)
				if (articleId) {
					try {
						const tempIdMatch = (content || '').match(
							/\/uploads\/articles\/(temp-[^/]+)\//
						);
						if (tempIdMatch && tempIdMatch[1]) {
							const tempId = tempIdMatch[1];
							const tempDir = path.join(
								process.cwd(),
								'uploads',
								'articles',
								tempId
							);
							const targetDir = path.join(
								process.cwd(),
								'uploads',
								'articles',
								articleId
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
								new RegExp(`/uploads/articles/${tempId}/`, 'g'),
								`/uploads/articles/${articleId}/`
							);
							if (updatedContent !== content) {
								finalArticle = await mongoStorage.updateArticle(articleId, {
									content: updatedContent,
								});
								content = updatedContent;
							}
						}
					} catch (migrateErr) {
						console.warn(
							'Optional migration from temp folder failed:',
							migrateErr
						);
					}
				}

				// Cleanup unused images in article folder (keep content images + thumbnail if local)
				if (articleId) {
					const usedImageUrls = extractImageUrlsFromContent(content);
					if (imageUrl && imageUrl.startsWith('/uploads/')) {
						usedImageUrls.push(imageUrl);
					}
					await cleanupArticleImages(articleId.toString(), usedImageUrls);
				}

				res.status(201).json(finalArticle);
			} catch (error) {
				console.error('Create article error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
	);

	app.put(
		'/api/articles/:id',
		authenticate,
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				const articleId = req.params.id;

				// Validate articleId - prevent 'undefined' issues
				if (!articleId || articleId === 'undefined') {
					return res.status(400).json({ message: 'Invalid article ID' });
				}

				const { title, excerpt, content, published } = req.body;

				// Get existing article
				const existingArticle = await mongoStorage.getArticleById(articleId);
				if (!existingArticle) {
					return res.status(404).json({ message: 'Article not found' });
				}

				// Check permissions using new permission system
				const canEdit = await checkArticlePermission(
					req.user as UserWithRole,
					existingArticle,
					'edit'
				);

				if (!canEdit) {
					return res.status(403).json({
						message: 'You do not have permission to edit this article',
					});
				}

				// Check publish permission if trying to publish
				if (published === 'true') {
					const canPublish = await checkArticlePermission(
						req.user as UserWithRole,
						existingArticle,
						'publish'
					);

					if (!canPublish) {
						return res.status(403).json({
							message: 'You do not have permission to publish articles',
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

				// Process image if uploaded (store inside uploads/articles/{articleId})
				if (req.file) {
					// Hapus gambar lama jika ada dan berbeda dari default
					const oldImageUrl =
						existingArticle.image !== '/uploads/default-article-image.jpg'
							? existingArticle.image
							: undefined;

					const imageUrl = await uploadArticleImage(
						req.file,
						oldImageUrl,
						articleId,
						false
					);
					updates.image = imageUrl;
					updates.imageSource = 'local';
				}

				// Update article
				const updatedArticle = await mongoStorage.updateArticle(
					articleId,
					updates
				);

				// Cleanup unused images in article folder after update (keep thumbnail too)
				if (typeof content === 'string') {
					const usedImageUrls = extractImageUrlsFromContent(content);
					const thumbnailUrl = (
						updates.image && updates.image.startsWith('/uploads/')
							? updates.image
							: existingArticle.image || ''
					).toString();
					if (thumbnailUrl && thumbnailUrl.startsWith('/uploads/')) {
						usedImageUrls.push(thumbnailUrl);
					}
					await cleanupArticleImages(articleId, usedImageUrls);
				}

				res.json(updatedArticle);
			} catch (error) {
				console.error('Update article error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
	);

	app.delete('/api/articles/:id', authenticate, async (req, res) => {
		try {
			const articleId = req.params.id;

			// Validate articleId - prevent 'undefined' issues
			if (!articleId || articleId === 'undefined') {
				return res.status(400).json({ message: 'Invalid article ID' });
			}

			// Get existing article
			const existingArticle = await mongoStorage.getArticleById(articleId);
			if (!existingArticle) {
				return res.status(404).json({ message: 'Article not found' });
			}

			// Check permissions using new permission system
			const canDelete = await checkArticlePermission(
				req.user as UserWithRole,
				existingArticle,
				'delete'
			);

			if (!canDelete) {
				return res.status(403).json({
					message: 'You do not have permission to delete this article',
				});
			}

			// Delete article
			await mongoStorage.deleteArticle(articleId);

			// Cleanup entire article folder (uploads/articles/{articleId})
			await cleanupArticleImages(articleId, []); // Empty array means delete all

			// Also cleanup attached_assets/articles/{articleId} if exists (legacy/misplaced)
			try {
				const assetsDir = path.join(
					process.cwd(),
					'attached_assets',
					'articles',
					articleId
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

			res.json({ message: 'Article deleted successfully' });
		} catch (error) {
			console.error('Delete article error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Library routes
	app.get('/api/library', async (req, res) => {
		try {
			const allItems = await mongoStorage.getAllLibraryItems();
			res.json(allItems);
		} catch (error) {
			console.error('Get library items error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/library/manage', authenticate, async (req, res) => {
		try {
			// Get user permissions
			const userRole = await mongoStorage.getRoleByName(
				(req.user as UserWithRole)?.role || ''
			);
			const permissions = userRole?.permissions || [];

			// Filter by permissions
			let items;
			if (permissions.includes('library.view_others')) {
				// Can see all items
				items = await mongoStorage.getAllLibraryItems();
			} else if (permissions.includes('library.view')) {
				// Can only see their own items
				items = await mongoStorage.getLibraryItemsByAuthorId(
					(req.user as UserWithRole)?._id || ''
				);
			} else {
				// No library view permission
				return res.status(403).json({
					message: 'You do not have permission to view library items',
				});
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
						files.map((file) => uploadHandler(file, true))
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
		}
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
					'edit'
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
								error
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
						files.map((file) => uploadHandler(file, true))
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
					updates
				);

				res.json(updatedItem);
			} catch (error) {
				console.error('Update library item error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
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
				'delete'
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
		}
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
		}
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
					positions
				);
				res.status(201).json(result);
			} catch (error) {
				console.error('Create positions error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
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
					targetPeriod
				);
				res.status(201).json(result);
			} catch (error) {
				console.error('Copy positions error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
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
		}
	);

	app.get('/api/organization/members', async (req, res) => {
		try {
			const { period } = req.query;

			if (!period) {
				// Get latest period if not specified
				const periods = await mongoStorage.getOrganizationPeriods();
				const latestPeriod = periods.length > 0 ? periods[0] : null;

				if (!latestPeriod) {
					return res.json([]);
				}

				const members = await mongoStorage.getOrganizationMembersByPeriod(
					latestPeriod
				);
				return res.json(members);
			}

			const members = await mongoStorage.getOrganizationMembersByPeriod(
				period as string
			);
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
		}
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
				const existingMember = await mongoStorage.getOrganizationMemberById(
					memberId
				);
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
							'GDrive accessibility check failed, continuing update'
						);
					}

					updates.imageUrl = gdriveUrl;
				} else if (req.file) {
					// Process the uploaded image with WebP conversion, compression and cleanup of old file
					const imageUrl = await uploadOrganizationMemberImage(
						req.file,
						oldImageUrl || undefined
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
					updates
				);

				res.json(updatedMember);
			} catch (error) {
				console.error('Update organization member error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
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
				const existingMember = await mongoStorage.getOrganizationMemberById(
					memberId
				);
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
		}
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
				const updatedSettings = await mongoStorage.updateSettings(req.body);
				res.json(updatedSettings);
			} catch (error) {
				console.error('Update settings error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
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
		}
	);

	// Public stats (no auth required for public home page)
	app.get('/api/stats', async (req, res) => {
		try {
			const articleCount = await mongoStorage.getArticlesCount();
			const libraryCount = await mongoStorage.getLibraryItemsCount();
			const memberCount = await mongoStorage.getOrganizationMembersCount();

			res.json({
				articles: articleCount,
				libraryItems: libraryCount,
				organizationMembers: memberCount,
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
				(req.user as UserWithRole)?.role || ''
			);
			const permissions = userRole?.permissions || [];

			if (!permissions.includes('dashboard.stats')) {
				return res.status(403).json({
					message: 'You do not have permission to view dashboard statistics',
				});
			}

			const [articleCount, libraryCount, memberCount] = await Promise.all([
				mongoStorage.getArticlesCount(),
				mongoStorage.getLibraryItemsCount(),
				mongoStorage.getOrganizationMembersCount(),
			]);

			res.json({
				totalArticles: articleCount,
				totalMediaItems: libraryCount,
				totalMembers: memberCount,
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
					oldFileUrl
				);
				res.json({ url: imageUrl });
			} catch (error) {
				console.error('Upload logo error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
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

	// SPA Routing - Handle all frontend routes
	// This ensures that routes like /dashboard, /articles, etc. work correctly
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
		}
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
					requesterRoleName.toLowerCase()
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
						`level_${level}`
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
		}
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
						(r?.name || '').toString() === currentUserRoleName.toString()
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
		}
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
					(req.user as UserWithRole)?.role || ''
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
		}
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
		}
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
		}
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
		}
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
		}
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
					new Set(availablePositions)
				);

				res.json(uniqueAvailablePositions);
			} catch (error) {
				console.error('Error getting available positions:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
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
		}
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
		}
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
		}
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
		}
	);

	// Get current user permissions
	app.get('/api/auth/permissions', authenticate, async (req, res) => {
		try {
			const permissions = await mongoStorage.getUserPermissions(
				(req.user as UserWithRole)?._id || ''
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
				(req.user as UserWithRole)?._id || ''
			);
			res.json({ permissions });
		} catch (error) {
			console.error('Error refreshing user permissions:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	const server = createServer(app);
	return server;
}
