import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import { createServer, type Server } from 'http';
import {
	authenticate,
	authorize,
	generateToken,
	hashPassword,
	verifyPassword,
} from './auth';
import { mongoStorage } from './mongo-storage'; // Use mongoStorage instead of storage
import chatRouter from './routes/chat';
import {
	cleanupArticleImages,
	extractImageUrlsFromContent,
	uploadHandler,
	uploadMiddleware,
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

export async function registerRoutes(app: Express): Promise<Server> {
	// Use cookie parser for handling JWT tokens
	app.use(cookieParser());

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
								mediaUrl = `https://drive.google.com/uc?export=view&id=${file.id}`;
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
				console.log('Processing single file:', actualFileId);
				console.log('User specified media type:', userSpecifiedType);

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

					console.log('File access test status:', testResponse.status);

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

				console.log('Final media type determined:', mediaType);

				// Generate appropriate URL based on media type
				let mediaUrl: string;
				if (mediaType === 'video') {
					// For videos, use preview format for better compatibility
					mediaUrl = `https://drive.google.com/file/d/${actualFileId}/preview`;
				} else {
					// For images, use export view format
					mediaUrl = `https://drive.google.com/uc?export=view&id=${actualFileId}`;
				}

				if (!mediaUrl) {
					return res
						.status(404)
						.json({ message: 'Could not generate media URL' });
				}

				console.log('Generated media URL:', mediaUrl, 'for type:', mediaType);

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

				// Generate token and set cookie
				const token = generateToken(user);
				res.cookie('authToken', token, {
					httpOnly: true,
					secure: process.env.NODE_ENV === 'production',
					maxAge: 24 * 60 * 60 * 1000, // 24 hours
				});

				// Return user info (without password)
				const { password: _, ...userWithoutPassword } = user;
				res.json(userWithoutPassword);
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

	app.get('/api/auth/me', authenticate, (req, res) => {
		const { password, ...userWithoutPassword } = req.user as UserWithRole;
		res.json(userWithoutPassword);
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

			// Hash new password
			const hashedPassword = await hashPassword(newPassword);

			// Update password
			await mongoStorage.updateUser(userId, { password: hashedPassword });

			res.json({ message: 'Password updated successfully' });
		} catch (error) {
			console.error('Password change error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// User management routes
	app.get(
		'/api/users',
		authenticate,
		authorize(['owner', 'admin']),
		async (req, res) => {
			try {
				const allUsers = await mongoStorage.getAllUsers();

				// Remove passwords from response
				const usersWithoutPasswords = allUsers.map((user) => {
					const { password, ...userWithoutPassword } = user;
					return userWithoutPassword;
				});

				res.json(usersWithoutPasswords);
			} catch (error) {
				console.error('Get users error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		}
	);

	app.post(
		'/api/users',
		authenticate,
		authorize(['owner', 'admin']),
		async (req, res) => {
			try {
				const { username, password, name, email, role, division } = req.body;

				// Validate required fields
				if (!username || !password || !name || !email || !role) {
					return res.status(400).json({
						message: 'Username, password, name, email, and role are required',
					});
				}

				// Check if username already exists
				const existingUser = await mongoStorage.getUserByUsername(username);
				if (existingUser) {
					return res.status(400).json({ message: 'Username already exists' });
				}

				// Hash password
				const hashedPassword = await hashPassword(password);

				// Create user
				const newUser = await mongoStorage.createUser({
					username,
					password: hashedPassword,
					name,
					email,
					role,
					division: division || undefined,
				});

				// Remove password from response
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
		authorize(['owner']),
		async (req, res) => {
			try {
				const userId = req.params.id;
				const { username, name, email, role, division } = req.body;

				// Validate userId - prevent 'undefined' issues
				if (!userId || userId === 'undefined') {
					return res.status(400).json({ message: 'Invalid user ID' });
				}

				// Check if user exists
				const existingUser = await mongoStorage.getUserById(userId);
				if (!existingUser) {
					return res.status(404).json({ message: 'User not found' });
				}

				// Check for unique username and email (excluding current user)
				if (username && username !== existingUser.username) {
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

				// Email uniqueness check disabled for now

				// Prepare updates
				const updates: any = {};
				if (username) updates.username = username;
				if (name) updates.name = name;
				if (email) updates.email = email;
				if (role) updates.role = role;
				if (division) updates.division = division;

				// Update user
				const updatedUser = await mongoStorage.updateUser(userId, updates);

				// Remove password from response
				const { password, ...userWithoutPassword } = updatedUser;
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
		authorize(['owner']),
		async (req, res) => {
			try {
				const userId = req.params.id;

				// Validate userId - prevent 'undefined' issues
				if (!userId || userId === 'undefined') {
					return res.status(400).json({ message: 'Invalid user ID' });
				}

				console.log('Deleting user with ID:', userId);

				// Check if user exists
				const existingUser = await mongoStorage.getUserById(userId);
				if (!existingUser) {
					return res.status(404).json({ message: 'User not found' });
				}

				// Prevent deleting own account
				if (userId === (req.user as UserWithRole)?._id) {
					return res
						.status(400)
						.json({ message: 'Cannot delete your own account' });
				}

				// Delete user
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

				// Process the uploaded image - use articles category with articleId subfolder
				const imageUrl = await uploadHandler(
					req.file,
					false,
					'articles',
					undefined,
					articleId
				);

				// Return the URL to be used in the article content
				console.log('📸 Content image uploaded:', { articleId, imageUrl });
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

	app.get('/api/articles/manage', authenticate, async (req, res) => {
		try {
			// Filter by user role
			let articles;
			if (
				['owner', 'admin', 'chair', 'vice_chair'].includes(
					(req.user as UserWithRole)?.role || ''
				)
			) {
				// These roles can see all articles
				articles = await mongoStorage.getAllArticles();
			} else {
				// Division heads can only see their own articles
				articles = await mongoStorage.getArticlesByAuthorId(
					(req.user as UserWithRole)?._id || ''
				);
			}

			res.json(articles);
		} catch (error) {
			console.error('Get articles management error:', error);
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

	app.post(
		'/api/articles',
		authenticate,
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				console.log('Article create request body:', req.body);

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
				} else if (req.file) {
					// Process the uploaded image if available - store in attached_assets/articles
					imageUrl = await uploadHandler(req.file, true, 'articles');
				}

				// Create article with Google Drive support
				const newArticle = await mongoStorage.createArticle({
					title: title.trim(),
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

				// Cleanup unused images in article folder
				const articleId = newArticle._id || newArticle.id;
				if (articleId) {
					const usedImageUrls = extractImageUrlsFromContent(content);
					console.log('🧹 Cleaning up article images:', {
						articleId,
						usedImageUrls,
					});
					await cleanupArticleImages(articleId.toString(), usedImageUrls);
				}

				res.status(201).json(newArticle);
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

				// Check permissions
				const canEdit =
					(req.user as UserWithRole)?.role === 'owner' ||
					(req.user as UserWithRole)?.role === 'admin' ||
					(req.user as UserWithRole)?.role === 'chair' ||
					(req.user as UserWithRole)?.role === 'vice_chair' ||
					(req.user as UserWithRole)?._id ===
						existingArticle.authorId.toString();

				if (!canEdit) {
					return res.status(403).json({
						message: 'You do not have permission to edit this article',
					});
				}

				// Process updates
				const updates: any = {
					title,
					excerpt,
					content,
					published: published === 'true',
					updatedAt: new Date(),
				};

				// Process image if uploaded
				if (req.file) {
					// Hapus gambar lama jika ada dan berbeda dari default
					const oldImageUrl =
						existingArticle.image !== '/uploads/default-article-image.jpg'
							? existingArticle.image
							: undefined;

					const imageUrl = await uploadHandler(
						req.file,
						true,
						'articles',
						oldImageUrl
					);
					updates.image = imageUrl;
				}

				// Update article
				const updatedArticle = await mongoStorage.updateArticle(
					articleId,
					updates
				);

				// Cleanup unused images in article folder after update
				if (content) {
					const usedImageUrls = extractImageUrlsFromContent(content);
					console.log('🧹 Cleaning up article images (update):', {
						articleId,
						usedImageUrls,
					});
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

			// Check permissions
			const canDelete =
				(req.user as UserWithRole)?.role === 'owner' ||
				(req.user as UserWithRole)?.role === 'admin' ||
				(req.user as UserWithRole)?.role === 'chair' ||
				(req.user as UserWithRole)?.role === 'vice_chair' ||
				(req.user as UserWithRole)?._id === existingArticle.authorId.toString();

			if (!canDelete) {
				return res.status(403).json({
					message: 'You do not have permission to delete this article',
				});
			}

			// Delete article
			await mongoStorage.deleteArticle(articleId);

			// Cleanup entire article folder
			console.log('🗑️ Deleting article folder:', articleId);
			await cleanupArticleImages(articleId, []); // Empty array means delete all

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
			// Filter by user role
			let items;
			if (
				['owner', 'admin', 'chair', 'vice_chair'].includes(
					(req.user as UserWithRole)?.role || ''
				)
			) {
				// These roles can see all items
				items = await mongoStorage.getAllLibraryItems();
			} else {
				// Division heads can only see their own items
				items = await mongoStorage.getLibraryItemsByAuthorId(
					(req.user as UserWithRole)?._id || ''
				);
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
				console.log('Library item create request body:', req.body);

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
					console.log(
						'No images provided for library item, using default image'
					);
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
				console.log('Library item update request body:', req.body);

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

				// Check permissions
				const canEdit =
					(req.user as UserWithRole)?.role === 'owner' ||
					(req.user as UserWithRole)?.role === 'admin' ||
					(req.user as UserWithRole)?.role === 'chair' ||
					(req.user as UserWithRole)?.role === 'vice_chair' ||
					(req.user as UserWithRole)?._id === existingItem.authorId.toString();

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

				console.log('Updating library item with:', {
					id: itemId,
					imageUrls: updates.images,
					imageSources: updates.imageSources,
					gdriveFileIds: updates.gdriveFileIds,
				});

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

			// Check permissions
			const canDelete =
				(req.user as UserWithRole)?.role === 'owner' ||
				(req.user as UserWithRole)?.role === 'admin' ||
				(req.user as UserWithRole)?.role === 'chair' ||
				(req.user as UserWithRole)?.role === 'vice_chair' ||
				(req.user as UserWithRole)?._id === existingItem.authorId.toString();

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
		authorize(['owner', 'admin', 'chair', 'vice_chair']),
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				const { name, position, period } = req.body;

				// Check if image was uploaded - use default if not
				let imageUrl = '/uploads/default-member-image.jpg';

				if (req.file) {
					// Process the uploaded image
					imageUrl = await uploadHandler(req.file);
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
		authorize(['owner', 'admin', 'chair', 'vice_chair']),
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				const memberId = req.params.id;
				const { name, position, period } = req.body;

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

				// Process image if uploaded
				if (req.file) {
					const imageUrl = await uploadHandler(req.file);
					updates.imageUrl = imageUrl;
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
		authorize(['owner', 'admin', 'chair', 'vice_chair']),
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

	// Debug endpoint for testing
	app.get('/api/debug/test', authenticate, async (req, res) => {
		try {
			res.json({
				message: 'Authentication working',
				user: {
					id: (req.user as any)?._id,
					name: (req.user as any)?.name || (req.user as any)?.username,
					role: (req.user as any)?.role,
				},
			});
		} catch (error) {
			console.error('Debug test error:', error);
			res
				.status(500)
				.json({ message: 'Debug test failed', error: String(error) });
		}
	});

	// Test activity creation endpoint
	app.post(
		'/api/debug/create-test-activity',
		authenticate,
		async (req, res) => {
			try {
				const { logActivity } = await import('./models/activity');

				const testActivity = await logActivity({
					type: 'article',
					action: 'create',
					title: 'Test activity - ' + new Date().toLocaleString('id-ID'),
					description: 'Test activity created from debug endpoint',
					userId: (req.user as any)?._id,
					userName: (req.user as any)?.name || (req.user as any)?.username,
					userRole: (req.user as any)?.role,
					entityId: 'debug-test',
					entityTitle: 'Debug Test Article',
				});

				console.log('✅ Test activity created:', testActivity._id);
				res.json({
					success: true,
					activity: testActivity,
					message: 'Test activity created successfully',
				});
			} catch (error) {
				console.error('❌ Test activity creation failed:', error);
				res.status(500).json({
					success: false,
					message: 'Failed to create test activity',
					error: String(error),
				});
			}
		}
	);

	// Recent activities
	app.get('/api/dashboard/activities', authenticate, async (req, res) => {
		try {
			// Import Activity functions
			const { getRecentActivities } = await import('./models/activity');
			const limit = parseInt(req.query.limit as string) || 10;
			const type = req.query.type as string;

			console.log(`Getting recent activities: limit=${limit}, type=${type}`);
			const activities = await getRecentActivities(limit, type);
			console.log(`Found ${activities?.length || 0} activities`);

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

			console.log('Logging activity:', activityData.title);
			const activity = await logActivity(activityData);
			console.log('Activity logged successfully:', activity._id);

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
			const { folderId } = req.body;

			if (!folderId) {
				return res.status(400).json({ message: 'Folder ID is required' });
			}

			const { getMediaFromFolder } = await import('./googleDrive');

			try {
				const files = await getMediaFromFolder(folderId);
				res.json({ files });
			} catch (error) {
				// Return error message for folder access
				res.status(400).json({
					message:
						'Folder content listing requires API setup. Please use individual file links.',
					suggestion: 'Copy individual file share links instead of folder link',
				});
			}
		} catch (error) {
			console.error('Get Google Drive folder contents error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.use('/api/chat', chatRouter);

	const server = createServer(app);
	return server;
}
