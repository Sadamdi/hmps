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
	mainOnly,
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
import { mongoStorage } from './mongo-storage';
import type { Request } from 'express';
import {
	applyOrganizationStructureAutoFill,
	previewOrganizationStructureAutoFill,
} from './services/organization-structure-auto-fill';
import {
	getDefaultBannerTemplatePath,
	renderBannerTemplateWebp,
} from './services/banner-template-render';
import {
	deriveBannerColorsFromTheme,
	DEFAULT_THEME_COLOR,
} from './services/banner-theme-derive';

/**
 * Returns tenant storage for tenant requests, otherwise mongoStorage.
 * Use this in route handlers to make them multi-tenant aware.
 */
function resolveStorage(req: Request): any {
	return req.tenantStorage || mongoStorage;
}

function resolveModels(req: Request): any {
	if (req.tenantModels) return req.tenantModels;
	// Lazy-require main models to avoid circular deps
	return require('../db/mongodb');
}
import {
	attachLibraryDisplayFields,
	removeLibraryFromAllRelations,
	syncBeritaGalleryLinksOnSave,
	syncEventGalleryLinksOnSave,
	syncLibraryLinksOnSave,
} from './library-relations';
import chatRouter from './routes/chat';
import commentRouter from './routes/comments';
import feedbackRouter from './routes/feedback';
import sharingRouter, { expirePendingShares } from './routes/sharing';
import { PostSharing } from '../db/mongodb';
import {
	cleanupBeritaImages,
	cleanupTempDir,
	DEFAULT_BERITA_IMAGE_PATH,
	deleteFile,
	extractImageUrlsFromContent,
	promoteTempFile,
	TEMP_UPLOAD_TTL_MS,
	uploadBeritaImage,
	uploadFilosofiImage,
	uploadHandler,
	uploadMiddleware,
	uploadOrganizationMemberImage,
	uploadProdiLabPhoto,
	uploadProdiLecturerPhoto,
	uploadProdiOrganizationStructureImage,
	uploadTempOnboarding,
	resolveTenantPaths,
	tenantCtxFromReq,
	PROJECT_ROOT,
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
	req?: Request,
): Promise<boolean> {
	const SharingModel = (req as any)?.tenantModels?.PostSharing || PostSharing;
	const storage = req ? resolveStorage(req) : mongoStorage;
	const filter: any = {
		entityType,
		entityId,
		targetId: userId,
		status: 'approved',
	};
	if (requiredPermission === 'edit') {
		filter.permission = 'edit';
	}
	const count = await SharingModel.countDocuments(filter);
	if (count > 0) return true;

	if (entityType === 'events') {
		let current = await storage.getEventById(entityId);
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
			const parentShareCount = await SharingModel.countDocuments(parentFilter);
			if (parentShareCount > 0) return true;
			current = await storage.getEventById(parentId);
		}
	}

	return false;
}

async function checkBeritaPermission(
	user: UserWithRole,
	berita: any,
	action: 'edit' | 'delete' | 'publish',
	req?: Request,
): Promise<boolean> {
	try {
		const storage = req ? resolveStorage(req) : mongoStorage;
		const permissions = await storage.getUserPermissions(String(user._id));
		const isOwner = user._id.toString() === (berita.authorId || '').toString();
		const beritaId = String(berita._id || berita.id);

		switch (action) {
			case 'edit':
				if (
					(permissions.includes('berita.edit') && isOwner) ||
					permissions.includes('berita.edit_others')
				)
					return true;
				return hasApprovedSharing('berita', beritaId, user._id.toString(), 'edit', req);
			case 'delete':
				if (
					(permissions.includes('berita.delete') && isOwner) ||
					permissions.includes('berita.delete_others')
				)
					return true;
				return hasApprovedSharing('berita', beritaId, user._id.toString(), 'edit', req);
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

async function checkEventPermission(
	user: UserWithRole,
	event: any,
	action: 'view' | 'edit' | 'delete' | 'publish',
	req?: Request,
): Promise<boolean> {
	try {
		const storage = req ? resolveStorage(req) : mongoStorage;
		const permissions = await storage.getUserPermissions(String(user._id));
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
				return hasApprovedSharing('events', eventId, user._id.toString(), 'view', req);
			case 'edit':
				if (
					(permissions.includes('events.edit') && isOwner) ||
					permissions.includes('events.edit_others')
				)
					return true;
				return hasApprovedSharing('events', eventId, user._id.toString(), 'edit', req);
			case 'delete':
				if (
					(permissions.includes('events.delete') && isOwner) ||
					permissions.includes('events.delete_others')
				)
					return true;
				return hasApprovedSharing('events', eventId, user._id.toString(), 'edit', req);
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
	req?: Request,
): Promise<boolean> {
	if (!user) return false;
	if (berita.published) return true;
	const storage = req ? resolveStorage(req) : mongoStorage;
	const permissions = await storage.getUserPermissions(String(user._id));
	const isOwner = user._id.toString() === (berita.authorId || '').toString();
	if (
		(permissions.includes('berita.view') && isOwner) ||
		permissions.includes('berita.view_others')
	)
		return true;
	const beritaId = String(berita._id || berita.id);
	return hasApprovedSharing('berita', beritaId, user._id.toString(), 'view', req);
}

async function checkLibraryPermission(
	user: UserWithRole,
	libraryItem: any,
	action: 'edit' | 'delete',
	req?: Request,
): Promise<boolean> {
	try {
		const storage = req ? resolveStorage(req) : mongoStorage;
		const permissions = await storage.getUserPermissions(String(user._id));
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
				return hasApprovedSharing('library', itemId, user._id.toString(), 'edit', req);
			case 'delete':
				if (
					(permissions.includes('library.delete') && isOwner) ||
					permissions.includes('library.delete_others')
				)
					return true;
				return hasApprovedSharing('library', itemId, user._id.toString(), 'edit', req);
			default:
				return false;
		}
	} catch (error) {
		console.error('Error checking library permission:', error);
		return false;
	}
}

async function canViewLibraryItem(
	user: UserWithRole | undefined,
	libraryItem: any,
	req?: Request,
): Promise<boolean> {
	if (libraryItem.published !== false) return true;
	if (!user) return false;
	const storage = req ? resolveStorage(req) : mongoStorage;
	const permissions = await storage.getUserPermissions(String(user._id));
	const isOwner =
		user._id.toString() === (libraryItem.authorId || '').toString();
	if (
		(permissions.includes('library.view') && isOwner) ||
		permissions.includes('library.view_others') ||
		permissions.includes('library.edit') ||
		permissions.includes('library.edit_others')
	)
		return true;
	const itemId = String(libraryItem._id || libraryItem.id);
	return hasApprovedSharing('library', itemId, user._id.toString(), 'view', req);
}

async function getEffectiveAuthors(
	req: Request,
	entityType: string,
	entityId: string,
	originalAuthorName: string,
): Promise<string[]> {
	const authors = [originalAuthorName];
	try {
		const m = resolveModels(req);
		const shares = await m.PostSharing.find({
			entityType,
			entityId,
			status: 'approved',
		}).lean();
		if (shares.length > 0) {
			const targetIds = (shares as { targetId: unknown }[]).map(
				(s) => s.targetId,
			);
			const users = await m.User.find(
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

async function enrichBeritaWithAuthors(
	items: any[],
	req: Request,
): Promise<any[]> {
	for (const item of items) {
		const id = String(item._id || item.id);
		const authors = await getEffectiveAuthors(
			req,
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
	req: Request,
	entityType: string,
	entityId: string,
	originalAuthorId?: string,
): Promise<string[]> {
	const authors: string[] = [];

	try {
		const m = resolveModels(req);
		if (originalAuthorId) {
			const originalAuthor = (await m.User.findById(
				originalAuthorId,
				'name',
			).lean()) as any;
			if (originalAuthor?.name && !authors.includes(originalAuthor.name)) {
				authors.push(originalAuthor.name);
			}
		}

		const shares = await m.PostSharing.find({
			entityType,
			entityId,
			status: 'approved',
		}).lean();

		if (shares.length > 0) {
			const targetIds = (shares as { targetId: unknown }[]).map(
				(s) => s.targetId,
			);
			const users = (await m.User.find(
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

async function enrichEventsWithAuthors(
	items: any[],
	req: Request,
): Promise<any[]> {
	for (const item of items) {
		const id = String(item._id || item.id);
		const originalAuthorId = item.createdBy ? String(item.createdBy) : undefined;
		const authors = await getEffectiveAuthorsByAuthorId(
			req,
			'events',
			id,
			originalAuthorId,
		);
		item.authorsDisplay = authors.join(' + ');
		item.authors = authors;
	}
	return items;
}

async function enrichLibraryWithAuthors(
	items: any[],
	req: Request,
): Promise<any[]> {
	for (const item of items) {
		const id = String(item._id || item.id);
		const originalAuthorId = item.authorId ? String(item.authorId) : undefined;
		const authors = await getEffectiveAuthorsByAuthorId(
			req,
			'library',
			id,
			originalAuthorId,
		);
		item.authorsDisplay = authors.join(' + ');
		item.authors = authors;
	}
	return items;
}

async function enrichLibraryRelations(item: any, req: Request): Promise<void> {
	try {
		const m = resolveModels(req);
		const eids = item.relatedEventIds;
		const bids = item.relatedBeritaIds;
		if (eids?.length) {
			const evs = await m.Event.find({ _id: { $in: eids } })
				.select('title yearId')
				.populate('yearId', 'year')
				.lean();
			item.relatedEventsPreview = (evs || []).map((e: any) => ({
				_id: String(e._id),
				title: e.title,
				year:
					e.yearId && typeof e.yearId === 'object'
						? (e.yearId as { year?: number }).year
						: undefined,
			}));
		} else {
			item.relatedEventsPreview = [];
		}
		if (bids?.length) {
			const bs = await m.Berita.find({ _id: { $in: bids } })
				.select('title slug')
				.lean();
			item.relatedBeritaPreview = (bs || []).map((b: any) => ({
				_id: String(b._id),
				title: b.title,
				slug: b.slug,
			}));
		} else {
			item.relatedBeritaPreview = [];
		}
	} catch (e) {
		console.warn('enrichLibraryRelations:', e);
	}
}

/** Preview galeri + event (batch) untuk daftar berita publik / home */
async function enrichBeritaListRelations(items: any[], req: Request): Promise<void> {
	if (!items?.length) return;
	try {
		const m = resolveModels(req);
		const allGalleryIds = new Set<string>();
		for (const it of items) {
			const gids = it?.relatedGalleryIds;
			if (Array.isArray(gids)) {
				for (const g of gids) {
					if (g) allGalleryIds.add(String(g));
				}
			}
		}
		const galleryMap = new Map<string, { _id: string; title: string }>();
		if (allGalleryIds.size > 0) {
			const libs = await m.Library.find({
				_id: { $in: Array.from(allGalleryIds) },
				published: true,
			})
				.select('title')
				.lean();
			for (const lib of libs || []) {
				galleryMap.set(String(lib._id), {
					_id: String(lib._id),
					title: String(lib.title || ''),
				});
			}
		}

		const beritaIdSet = new Set(
			items.map((it) => String(it._id || it.id)).filter(Boolean),
		);
		const beritaIds = Array.from(beritaIdSet);
		const eventsByBerita = new Map<string, { _id: string; title: string; year?: number }[]>();
		if (beritaIds.length > 0) {
			const events = await m.Event.find({
				relatedBerita: { $in: beritaIds },
				published: true,
			})
				.select('title yearId relatedBerita')
				.populate('yearId', 'year')
				.lean();
			for (const ev of events || []) {
				const rb = (ev as any).relatedBerita || [];
				const bidList = Array.isArray(rb)
					? rb.map((x: any) => String(x._id ?? x))
					: [];
				const year =
					(ev as any).yearId && typeof (ev as any).yearId === 'object'
						? ((ev as any).yearId as { year?: number }).year
						: undefined;
				const preview = {
					_id: String((ev as any)._id),
					title: String((ev as any).title || ''),
					year,
				};
				for (const bid of bidList) {
					if (!beritaIdSet.has(bid)) continue;
					if (!eventsByBerita.has(bid)) eventsByBerita.set(bid, []);
					eventsByBerita.get(bid)!.push(preview);
				}
			}
		}

		for (const it of items) {
			const id = String(it._id || it.id);
			const gids = (it.relatedGalleryIds || []) as unknown[];
			it.relatedGalleryPreview = gids
				.map((g) => galleryMap.get(String(g)))
				.filter(Boolean) as { _id: string; title: string }[];
			it.linkedEventsPreview = eventsByBerita.get(id) || [];
		}
	} catch (e) {
		console.warn('enrichBeritaListRelations:', e);
		for (const it of items) {
			it.relatedGalleryPreview = [];
			it.linkedEventsPreview = [];
		}
	}
}

async function cleanupSingleEventFiles(
	event: any,
	tCtx: { isTenant: boolean; tenantSlug?: string },
): Promise<void> {
	const { deleteFile: delFile, extractImageUrlsFromContent } = await import('./upload');
	if (event.thumbnail && event.thumbnailSource === 'local') {
		await delFile(event.thumbnail).catch(() => {});
	}
	for (const att of event.attachments || []) {
		if (att?.source === 'local' && att?.url) {
			await delFile(att.url).catch(() => {});
		}
	}
	if (event.description) {
		const urls = extractImageUrlsFromContent(event.description);
		for (const url of urls) {
			if (url.startsWith('/uploads/')) {
				await delFile(url).catch(() => {});
			}
		}
	}
}

async function enrichEventTreeWithAuthors(
	item: any,
	req: Request,
): Promise<void> {
	if (!item) return;
	const id = String(item._id || item.id);
	const originalAuthorId = item.createdBy ? String(item.createdBy) : undefined;
	const authors = await getEffectiveAuthorsByAuthorId(
		req,
		'events',
		id,
		originalAuthorId,
	);
	item.authorsDisplay = authors.join(' + ');
	item.authors = authors;

	if (Array.isArray(item.children) && item.children.length > 0) {
		for (const child of item.children) {
			await enrichEventTreeWithAuthors(child, req);
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
				console.log('Processing folder:', actualFileId);

				type DriveMediaRow = {
					id: string;
					name: string;
					mimeType: string;
				};

				const mapFolderFileToResponse = (
					file: DriveMediaRow,
					index: number,
				) => {
					let mediaType: 'image' | 'video';
					if (userSpecifiedType === 'video') {
						mediaType = 'video';
					} else if (userSpecifiedType === 'image') {
						mediaType = 'image';
					} else {
						mediaType = file.mimeType.startsWith('video/')
							? 'video'
							: 'image';
					}

					const mimeType =
						mediaType === 'video'
							? file.mimeType.startsWith('video/')
								? file.mimeType
								: 'video/mp4'
							: file.mimeType.startsWith('image/')
								? file.mimeType
								: 'image/jpeg';

					const mediaUrl =
						mediaType === 'video'
							? `https://drive.google.com/file/d/${file.id}/preview`
							: `https://lh3.googleusercontent.com/d/${file.id}=s2000`;

					return {
						id: file.id,
						name:
							file.name?.trim() ||
							`${mediaType === 'video' ? 'Video' : 'Image'} ${index + 1}`,
						url: mediaUrl,
						type: mediaType,
						mimeType,
					};
				};

				try {
					let mediaRows: DriveMediaRow[] = [];

					try {
						const fromApi = await getMediaFromFolder(actualFileId);
						mediaRows = fromApi.map((f) => ({
							id: f.id,
							name: f.name,
							mimeType: f.mimeType,
						}));
					} catch (folderListErr) {
						console.warn(
							'getMediaFromFolder failed, trying fallback:',
							folderListErr,
						);
					}

					if (mediaRows.length === 0) {
						const { getSimpleFolderContents } = await import('./googleDrive');
						const simple = await getSimpleFolderContents(actualFileId);
						for (const item of simple) {
							const meta = await getFileMetadata(item.id);
							if (!meta) continue;
							if (
								!isSupportedMediaType(meta.mimeType) &&
								getFileTypeFromExtension(meta.name) === 'unknown'
							) {
								continue;
							}
							mediaRows.push({
								id: meta.id,
								name: meta.name,
								mimeType: meta.mimeType,
							});
						}
					}

					if (mediaRows.length > 0) {
						const mediaWithUrls = mediaRows.map((file, index) =>
							mapFolderFileToResponse(file, index),
						);

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
					}

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
				// Handle single file — use Drive API metadata for accurate MIME detection
				let mediaType: string = userSpecifiedType || 'image';
				let mimeType = 'image/jpeg';
				let fileName = `File ${actualFileId}`;

				try {
					const meta = await getFileMetadata(actualFileId);
					if (meta && meta.mimeType) {
						fileName = meta.name || fileName;
						mimeType = meta.mimeType;
						if (!userSpecifiedType) {
							mediaType = meta.mimeType.startsWith('video/') ? 'video' : 'image';
						}
					}
				} catch {
					// Fallback: heuristic from URL
					if (!userSpecifiedType && url) {
						const lower = (url as string).toLowerCase();
						// Jangan pakai /view atau /preview — dipakai Drive untuk foto & video
						if (
							lower.includes('video') ||
							lower.includes('mp4') ||
							lower.includes('mov')
						) {
							mediaType = 'video';
							mimeType = 'video/mp4';
						}
					}
				}

				const mediaUrl = mediaType === 'video'
					? `https://drive.google.com/file/d/${actualFileId}/preview`
					: `https://lh3.googleusercontent.com/d/${actualFileId}=s2000`;

				const metadata = {
					id: actualFileId,
					name: fileName,
					mimeType,
					webViewLink: `https://drive.google.com/file/d/${actualFileId}/view`,
					webContentLink: mediaUrl,
				};

				res.json({
					type: mediaType,
					url: mediaUrl,
					metadata,
					files: [{
						id: actualFileId,
						name: fileName,
						url: mediaUrl,
						type: mediaType,
						mimeType,
					}],
				});
			}
		} catch (error) {
			console.error('Get Google Drive media URL error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Authentication routes (tenant-aware: works for both main and community logins)
	app.post(
		'/api/auth/login',
		loginLimiter,
		validateInput(loginSchema),
		async (req, res) => {
			try {
				const { username, password } = req.body;

				if (!username || !password) {
					return res.status(400).json({ message: 'Username and password are required' });
				}

				// Resolve storage based on tenant context
				let storage: any = mongoStorage;
				let SessionModel: any;
				let tenantDbName: string | undefined;
				if (req.isTenantRequest && req.tenantModels) {
					const { createTenantStorage } = await import('./tenant-storage');
					storage = createTenantStorage(req.tenantModels);
					SessionModel = req.tenantModels.Session;
					tenantDbName = req.tenantDbName;
				} else {
					const { Session } = await import('../db/mongodb');
					SessionModel = Session;
				}

				const user = await storage.getUserByUsernameOrEmail(username);
				if (!user) {
					return res.status(401).json({ message: 'Invalid username or password' });
				}

				const isPasswordValid = await verifyPassword(password, user.password);
				if (!isPasswordValid) {
					return res.status(401).json({ message: 'Invalid username or password' });
				}

				await storage.updateUser(user._id, { lastLogin: new Date() });

				const sessionId = await createSessionRecord(req, String(user._id), SessionModel);

				const token = generateToken({ ...(user as any), sessionId } as any, tenantDbName);
				res.cookie('authToken', token, {
					httpOnly: true,
					secure: process.env.NODE_ENV === 'production',
					maxAge: 24 * 60 * 60 * 1000,
				});

				const { password: _, ...userWithoutPassword } = user;
				let loginTenantSlug: string | undefined;
				if (tenantDbName) {
					try {
						const { Community } = await import('../db/mongodb');
						const community: any = await Community.findOne({ dbName: tenantDbName }).lean();
						loginTenantSlug = community?.slug;
					} catch {}
				}
				res.json({
					...userWithoutPassword,
					authScope: tenantDbName ? 'tenant' : 'main',
					tenantSlug: loginTenantSlug,
				});

				// Session retention
				try {
					const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
					await SessionModel.deleteMany({ userId: user._id, revokedAt: { $lte: sevenDaysAgo } });
					const activeSessions = await SessionModel.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
					if (activeSessions.length > 10) {
						const ids = activeSessions.slice(10).map((s: any) => s._id);
						await SessionModel.updateMany({ _id: { $in: ids }, revokedAt: null }, { $set: { revokedAt: new Date() } });
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

	// Revoke all sessions for current user (tenant-aware)
	app.post('/api/auth/revoke-all-sessions', authenticate, async (req, res) => {
		try {
			const userId = (req.user as UserWithRole)?._id;

			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			// Resolve models based on tenant context
			let UserModel: any;
			let SessionModel: any;
			if (req.isTenantRequest && req.tenantModels) {
				UserModel = req.tenantModels.User;
				SessionModel = req.tenantModels.Session;
			} else {
				const mainDb = await import('../db/mongodb');
				UserModel = mainDb.User;
				SessionModel = mainDb.Session;
			}

			try {
				await UserModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
			} catch (e) {
				await resolveStorage(req).updateUser(userId, {
					tokenVersion: ((req.user as any)?.tokenVersion || 0) + 1,
				});
			}

			try {
				await SessionModel.updateMany(
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

	app.get('/api/auth/me', authenticate, async (req, res) => {
		const { password, ...userWithoutPassword } = req.user as UserWithRole;
		let authScope: 'main' | 'tenant' = 'main';
		let tenantSlug: string | undefined;

		if (req.isTenantRequest && req.tenantDbName) {
			authScope = 'tenant';
			try {
				const { Community } = await import('../db/mongodb');
				const community: any = await Community.findOne({ dbName: req.tenantDbName }).lean();
				tenantSlug = community?.slug;
			} catch {}
		} else if ((req as any)._authTokenTenant) {
			authScope = 'tenant';
			try {
				const { Community } = await import('../db/mongodb');
				const community: any = await Community.findOne({ dbName: (req as any)._authTokenTenant }).lean();
				tenantSlug = community?.slug;
			} catch {}
		}

		res.json({ ...userWithoutPassword, authScope, tenantSlug });
	});

	// Sessions: list active sessions for current user (tenant-aware)
	app.get('/api/auth/sessions', authenticate, async (req, res) => {
		try {
			let SessionModel: any;
			if (req.isTenantRequest && req.tenantModels) {
				SessionModel = req.tenantModels.Session;
			} else {
				const mainDb = await import('../db/mongodb');
				SessionModel = mainDb.Session;
			}
			const userId = (req.user as any)?._id;
			const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			await SessionModel.deleteMany({ userId, revokedAt: { $lte: sevenDaysAgo } });
			const all = await SessionModel.find({ userId }).sort({ createdAt: -1 });
			if (all.length > 10) {
				const toRevoke = all.slice(10);
				const ids = toRevoke.map((s: any) => s._id);
				await SessionModel.updateMany(
					{ _id: { $in: ids }, revokedAt: null },
					{ $set: { revokedAt: new Date() } },
				);
			}
			const sessions = await SessionModel.find({ userId })
				.sort({ createdAt: -1 })
				.limit(10)
				.lean();
			res.json(sessions);
		} catch (e) {
			console.error('Failed to list sessions:', e);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Sessions: revoke single session by sessionId (tenant-aware)
	app.post('/api/auth/sessions/revoke', authenticate, async (req, res) => {
		try {
			const { sessionId } = req.body || {};
			if (!sessionId)
				return res.status(400).json({ message: 'sessionId required' });
			let SessionModel: any;
			if (req.isTenantRequest && req.tenantModels) {
				SessionModel = req.tenantModels.Session;
			} else {
				const mainDb = await import('../db/mongodb');
				SessionModel = mainDb.Session;
			}
			const sess = await SessionModel.findOne({
				sessionId,
				userId: (req.user as any)?._id,
			});
			if (!sess) return res.status(404).json({ message: 'Session not found' });
			await SessionModel.updateOne(
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

			const storage = resolveStorage(req);
			const user = await storage.getUserById(userId);
			if (!user) {
				return res.status(404).json({ message: 'User not found' });
			}

			const isPasswordValid = await verifyPassword(
				currentPassword,
				user.password,
			);
			if (!isPasswordValid) {
				return res
					.status(400)
					.json({ message: 'Current password is incorrect' });
			}

			await storage.updateUser(userId, { password: newPassword });

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

			const models = resolveModels(req);
			const user = await models.User.findOne({ email: email.trim().toLowerCase() }).lean() as any;
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

			const storage = resolveStorage(req);
			const models = resolveModels(req);
			const user = await models.User.findOne({ email: result.email }).lean() as any;
			if (!user) {
				return res.status(404).json({ message: 'User tidak ditemukan' });
			}

			await storage.updateUser(user._id.toString(), { password: newPassword });

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

			const user = await resolveStorage(req).getUserById(userId);
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

			const pwdStorage = resolveStorage(req);
			const user = await pwdStorage.getUserById(userId);
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

			await pwdStorage.updateUser(userId, { password: newPassword });

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

				const storage = resolveStorage(req);
				const requester = req.user as UserWithRole;
				const targetUser = await storage.getUserById(id);
				if (!targetUser) {
					return res.status(404).json({ message: 'User tidak ditemukan' });
				}

				if (targetUser._id.toString() === requester._id.toString()) {
					return res.status(400).json({ message: 'Gunakan fitur change password untuk akun sendiri' });
				}

				const allRoles = await storage.getAllRoles();
				const requesterRole = allRoles.find((r: any) => r.name === requester.role) as any;
				const targetRole = allRoles.find((r: any) => r.name === targetUser.role) as any;

				const requesterLevel = requesterRole?.level ?? 999;
				const targetLevel = targetRole?.level ?? 999;

				if (requesterLevel >= targetLevel) {
					return res.status(403).json({
						message: 'Anda hanya bisa mengubah password user dengan role di bawah Anda',
					});
				}

				await storage.updateUser(id, { password: newPassword });

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
			const storage = resolveStorage(req);
			const userId = (req.user as UserWithRole)?._id;
			const { username, name } = req.body;

			if (!userId) {
				return res.status(401).json({ message: 'Authentication required' });
			}

			const currentUser = await storage.getUserById(userId);
			if (!currentUser) {
				return res.status(404).json({ message: 'User not found' });
			}

			if (username && username !== currentUser.username) {
				const userWithSameUsername = await storage.getUserByUsername(username);
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

			const updatedUser = await storage.updateUser(userId, updateData);

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

			const user = await resolveStorage(req).getUserById(userId);
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

			const changeStorage = resolveStorage(req);
			const emailTaken = await changeStorage.getUserByEmail(newEmail.trim().toLowerCase());
			if (emailTaken && emailTaken._id.toString() !== userId.toString()) {
				return res.status(400).json({ message: 'Email sudah digunakan oleh user lain' });
			}

			await changeStorage.updateUser(userId, { email: newEmail.trim().toLowerCase() });

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

				const storage = resolveStorage(req);
				const requester = req.user as UserWithRole;
				const targetUser = await storage.getUserById(id);
				if (!targetUser) {
					return res.status(404).json({ message: 'User tidak ditemukan' });
				}

				if (targetUser._id.toString() === requester._id.toString()) {
					return res.status(400).json({ message: 'Gunakan fitur change email untuk akun sendiri' });
				}

				const allRoles = await storage.getAllRoles();
				const requesterRole = allRoles.find((r: any) => r.name === requester.role) as any;
				const targetRole = allRoles.find((r: any) => r.name === targetUser.role) as any;

				const requesterLevel = requesterRole?.level ?? 999;
				const targetLevel = targetRole?.level ?? 999;

				if (requesterLevel >= targetLevel) {
					return res.status(403).json({
						message: 'Anda hanya bisa mengubah email user dengan role di bawah Anda',
					});
				}

				const emailTaken = await storage.getUserByEmail(newEmail.trim().toLowerCase());
				if (emailTaken && emailTaken._id.toString() !== targetUser._id.toString()) {
					return res.status(400).json({ message: 'Email sudah digunakan oleh user lain' });
				}

				await storage.updateUser(id, { email: newEmail.trim().toLowerCase() });

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

				const storage = resolveStorage(req);
				const existingUser = await storage.getUserById(userId);
				if (!existingUser) {
					return res.status(404).json({ message: 'User not found' });
				}

				const updateData: any = {};
				if (role) updateData.role = role;
				if (division !== undefined) updateData.division = division;

				const updatedUser = await storage.updateUser(userId, updateData);

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
			const storage = resolveStorage(req);
			const permissions = await storage.getUserPermissions(
				String((req.user as any)?._id),
			);

			if (
				!permissions.includes('users.view') &&
				!permissions.includes('users.view_others')
			) {
				return res
					.status(403)
					.json({ message: 'You do not have permission to view users' });
			}

			const { page, limit, isPaginated } = getPaginationParams(req.query);
			let users = await storage.getAllUsers(
				isPaginated ? { page, limit } : undefined,
			);
			if (
				permissions.includes('users.view') &&
				!permissions.includes('users.view_others')
			) {
				const myId = (req.user as any)?._id?.toString();
				users = users.filter((u: any) => u._id?.toString() === myId);
			}

			const usersWithoutPasswords = users.map((user: any) => {
				const { password, ...userWithoutPassword } = user;
				return userWithoutPassword;
			});

			if (isPaginated) {
				const total = await storage.getAllUsers();
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
				const storage = resolveStorage(req);
				const { username, password, name, email, role, division } = req.body;
				if (!username || !password || !name || !email || !role) {
					return res.status(400).json({
						message: 'Username, password, name, email, and role are required',
					});
				}
				const existingUser = await storage.getUserByUsername(username);
				if (existingUser) {
					return res.status(400).json({ message: 'Username already exists' });
				}
				const hashedPassword = await hashPassword(password);
				const newUser = await storage.createUser({
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
				const storage = resolveStorage(req);
				const userId = req.params.id;
				const { username, name, email, role, division } = req.body;
				if (!userId || userId === 'undefined') {
					return res.status(400).json({ message: 'Invalid user ID' });
				}
				const existingUser = await storage.getUserById(userId);
				if (!existingUser) {
					return res.status(404).json({ message: 'User not found' });
				}
				const requesterRoleName = (req.user as any)?.role || '';
				const allRoles = await storage.getAllRoles();
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
				const updatedUser = await storage.updateUser(userId, updates);
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
				const storage = resolveStorage(req);
				const userId = req.params.id;
				if (!userId || userId === 'undefined') {
					return res.status(400).json({ message: 'Invalid user ID' });
				}
				const existingUser = await storage.getUserById(userId);
				if (!existingUser) {
					return res.status(404).json({ message: 'User not found' });
				}

				const requesterRoleName = (req.user as any)?.role || '';
				const allRoles = await storage.getAllRoles();
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
				await storage.deleteUser(userId);
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
					tenantCtxFromReq(req),
				);

				res.json({ url: imageUrl });
			} catch (error) {
				console.error('Upload content image error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Upload images for event content (description rich-text)
	app.post(
		'/api/upload/event-content-image',
		authenticate,
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				if (!req.file) {
					return res.status(400).json({ message: 'Image is required' });
				}

				const eventId = req.body.eventId;
				const parentEventId = req.body.parentEventId || null;

				if (!eventId) {
					return res.status(400).json({ message: 'Event ID is required' });
				}

				const { uploadEventContentImage } = await import('./upload');
				const imageUrl = await uploadEventContentImage(
					req.file,
					eventId,
					parentEventId,
					tenantCtxFromReq(req),
				);

				res.json({ url: imageUrl });
			} catch (error) {
				console.error('Upload event content image error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Berita routes
	app.get('/api/berita', async (req, res) => {
		try {
			const storage = resolveStorage(req);
			const { page, limit, isPaginated } = getPaginationParams(req.query);
			const allBerita = await storage.getPublishedBerita(
				isPaginated ? { page, limit } : undefined,
			);
			await enrichBeritaWithAuthors(allBerita, req);
			await enrichBeritaListRelations(allBerita, req);
			if (isPaginated) {
				const total = await storage.getBeritaCount();
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
			let events = await resolveStorage(req).getEventsByBeritaId(id);
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

			const base = await resolveStorage(req).getBeritaById(beritaId);
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
			const m = resolveModels(req);
			const storage = resolveStorage(req);
			await expirePendingShares(m.PostSharing, m.UserNotification, storage);

			const userId = (req.user as UserWithRole)?._id || '';
			const permissions = await storage.getUserPermissions(String(userId));

			let beritaList: any[];
			if (permissions.includes('berita.view_others')) {
				beritaList = await storage.getAllBerita();
			} else if (
				permissions.includes('berita.view') ||
				permissions.includes('berita.edit') ||
				permissions.includes('berita.create')
			) {
				beritaList = await storage.getBeritaByAuthorId(userId);
			} else {
				beritaList = [];
			}

			const now = new Date();
			const sharedAccess = await m.PostSharing.find({
				entityType: 'berita',
				targetId: userId,
				status: 'approved',
			}).lean();
			const pendingAccess = await m.PostSharing.find({
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
				const sharedIds = (accessList as { entityId: unknown }[])
					.map((s) => String(s.entityId))
					.filter((id: string) => !existingIds.has(id));
				for (const sid of sharedIds) {
					const item = await resolveStorage(req).getBeritaById(sid);
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
			const pendingIdSet = new Set(
				(pendingAccess as { entityId: unknown }[]).map((s) =>
					String(s.entityId),
				),
			);
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

				const storage = resolveStorage(req);
				const beritaItem = await storage.getBeritaById(beritaId);

				if (!beritaItem) {
					return res.status(404).json({ message: 'Berita not found' });
				}

				if (beritaItem.published) {
				} else {
					const canView = await canViewBerita(
						req.user as UserWithRole | undefined,
						beritaItem,
						req,
					);
					if (!canView) {
						return res.status(403).json({
							message: 'You do not have permission to view this berita',
						});
					}
				}

			try {
				const currentViews =
					typeof (beritaItem as any).viewCount === 'number'
						? (beritaItem as any).viewCount
						: 0;
				const nextViews = currentViews + 1;
				await storage.updateBerita(String(beritaItem._id || beritaId), {
					viewCount: nextViews,
				});
				(beritaItem as any).viewCount = nextViews;
			} catch (incError) {
				console.warn('Failed to increment viewCount (id+slug):', incError);
			}

			await enrichBeritaWithAuthors([beritaItem], req);
			await enrichBeritaListRelations([beritaItem], req);
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
				const storage = resolveStorage(req);
				const beritaItem = await storage.getBeritaBySlug(slug);

				if (!beritaItem) {
					return res.status(404).json({ message: 'Berita not found' });
				}

				if (!beritaItem.published) {
					const canView = await canViewBerita(
						req.user as UserWithRole | undefined,
						beritaItem,
						req,
					);
					if (!canView) {
						return res.status(403).json({
							message: 'You do not have permission to view this berita',
						});
					}
				}

			try {
				const currentViews =
					typeof (beritaItem as any).viewCount === 'number'
						? (beritaItem as any).viewCount
						: 0;
				const nextViews = currentViews + 1;
				await storage.updateBerita(String(beritaItem._id), {
					viewCount: nextViews,
				});
				(beritaItem as any).viewCount = nextViews;
			} catch (incError) {
				console.warn('Failed to increment viewCount (slug):', incError);
			}

			await enrichBeritaWithAuthors([beritaItem], req);
			await enrichBeritaListRelations([beritaItem], req);
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
			const beritaItem = await resolveStorage(req).getBeritaById(beritaId);

			if (!beritaItem) {
				return res.status(404).json({ message: 'Berita not found' });
			}

			if (!beritaItem.published) {
				const canView = await canViewBerita(
					req.user as UserWithRole | undefined,
					beritaItem,
					req,
				);
				if (!canView) {
					return res.status(403).json({
						message: 'You do not have permission to view this berita',
					});
				}
			}

			try {
				const currentViews =
					typeof (beritaItem as any).viewCount === 'number'
						? (beritaItem as any).viewCount
						: 0;
				const nextViews = currentViews + 1;
				await resolveStorage(req).updateBerita(String(beritaItem._id || beritaId), {
					viewCount: nextViews,
				});
				(beritaItem as any).viewCount = nextViews;
			} catch (incError) {
				console.warn('Failed to increment viewCount (id):', incError);
			}

			await enrichBeritaWithAuthors([beritaItem], req);
			await enrichBeritaListRelations([beritaItem], req);
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

			const base = await resolveStorage(req).getBeritaById(beritaId);
			if (!base) {
				return res.status(404).json({ message: 'Berita not found' });
			}

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
			const beritaItem = await resolveStorage(req).getBeritaBySlug(slug);
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

				let relatedGalleryIdsOnCreate: string[] = [];
				if (req.body.relatedGalleryIds) {
					try {
						const g = JSON.parse(req.body.relatedGalleryIds);
						if (Array.isArray(g)) relatedGalleryIdsOnCreate = g.map(String);
					} catch {
						relatedGalleryIdsOnCreate = [];
					}
				}

				// Check create permission
				const storage = resolveStorage(req);
				const createPerms = await storage.getUserPermissions(
					String((req.user as UserWithRole)?._id),
				);
				if (!createPerms.includes('berita.create')) {
					return res.status(403).json({
						message: 'You do not have permission to create berita',
					});
				}

				// Check publish permission if trying to publish
				if (published === 'true') {
					if (!createPerms.includes('berita.publish')) {
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

				let imageUrl = DEFAULT_BERITA_IMAGE_PATH;
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
				const existingBeritas = await storage.getPublishedBerita();
				const existingSlugs = existingBeritas.map(
					(b: any) => b.slug || '',
				);
				const slug = generateUniqueSlug(title.trim(), existingSlugs);

				const newBerita = await storage.createBerita({
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

				const beritaId = (newBerita._id || newBerita.id)?.toString();
				let finalBerita = newBerita;
				const rollbackUrls: string[] = [];
				const tCtxBerita = tenantCtxFromReq(req);

				try {
					// If local file uploaded (not GDrive), process thumbnail into uploads/.../berita/{beritaId}
					if (!gdriveUrl && req.file && beritaId) {
						const processedThumbUrl = await uploadBeritaImage(
							req.file,
							undefined,
							beritaId,
							false,
							tCtxBerita,
						);
						rollbackUrls.push(processedThumbUrl);
						finalBerita = await storage.updateBerita(beritaId, {
							image: processedThumbUrl,
							imageSource: 'local',
						});
						imageUrl = processedThumbUrl;
					}

					// Migrate temp content images to berita folder if any (replace URLs in content)
					if (beritaId) {
						try {
							const tempIdMatch = (content || '').match(
								/\/berita\/(temp-[^/]+)\//,
							);
							if (tempIdMatch && tempIdMatch[1]) {
								const tempId = tempIdMatch[1];
								const rTemp = resolveTenantPaths(
									`berita/${tempId}`,
									false,
									tCtxBerita,
								);
								const rTarget = resolveTenantPaths(
									`berita/${beritaId}`,
									false,
									tCtxBerita,
								);
								const tempDir = rTemp.dir;
								const targetDir = rTarget.dir;
								if (fs.existsSync(tempDir)) {
									if (!fs.existsSync(targetDir))
										fs.mkdirSync(targetDir, { recursive: true });
									for (const f of fs.readdirSync(tempDir)) {
										fs.renameSync(
											path.join(tempDir, f),
											path.join(targetDir, f),
										);
									}
									try {
										fs.rmdirSync(tempDir);
									} catch {}
								}

								const esc = (s: string) =>
									s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
								const updatedContent = (content || '').replace(
									new RegExp(`${esc(rTemp.urlPrefix)}/`, 'g'),
									`${rTarget.urlPrefix}/`,
								);
								if (updatedContent !== content) {
									finalBerita = await storage.updateBerita(beritaId, {
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
						await cleanupBeritaImages(
							beritaId.toString(),
							usedImageUrls,
							tCtxBerita,
						);
					}

					if (beritaId && relatedGalleryIdsOnCreate.length > 0) {
						await storage.updateBerita(beritaId, {
							relatedGalleryIds: relatedGalleryIdsOnCreate,
						});
						await syncBeritaGalleryLinksOnSave(
							resolveModels(req),
							beritaId,
							[],
							relatedGalleryIdsOnCreate,
						);
						const again = await storage.getBeritaById(beritaId);
						if (again) finalBerita = again;
					}

					res.status(201).json(finalBerita);
				} catch (postErr) {
					console.error('Create berita post-processing failed:', postErr);
					if (beritaId) {
						try {
							await storage.deleteBerita(beritaId);
						} catch {}
						try {
							await cleanupBeritaImages(beritaId, [], tCtxBerita);
						} catch {}
						for (const u of rollbackUrls) {
							try {
								await deleteFile(u);
							} catch {}
						}
					}
					return res.status(500).json({ message: 'Internal server error' });
				}
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
				const storage = resolveStorage(req);
				const existingBerita = await storage.getBeritaById(beritaId);
				if (!existingBerita) {
					return res.status(404).json({ message: 'Berita not found' });
				}

				const canEdit = await checkBeritaPermission(
					req.user as UserWithRole,
					existingBerita,
					'edit',
					req,
				);

				if (!canEdit) {
					return res.status(403).json({
						message: 'You do not have permission to edit this berita',
					});
				}

				if (published === 'true') {
					const canPublish = await checkBeritaPermission(
						req.user as UserWithRole,
						existingBerita,
						'publish',
						req,
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

				const prevGalleryBerita = (
					(existingBerita as any).relatedGalleryIds || []
				).map((x: any) => String(x));
				let nextGalleryBerita = prevGalleryBerita;
				if (req.body.relatedGalleryIds !== undefined) {
					try {
						const parsed = JSON.parse(req.body.relatedGalleryIds);
						nextGalleryBerita = Array.isArray(parsed)
							? parsed.map((x: any) => String(x))
							: [];
						updates.relatedGalleryIds = nextGalleryBerita;
					} catch {
						nextGalleryBerita = [];
						updates.relatedGalleryIds = [];
					}
				}

				// Process image if uploaded (store inside uploads/berita/{beritaId})
				if (req.file) {
					// Hapus gambar lama jika ada dan berbeda dari default
					const oldImageUrl =
						existingBerita.image !== DEFAULT_BERITA_IMAGE_PATH
							? existingBerita.image
							: undefined;

					const imageUrl = await uploadBeritaImage(
						req.file,
						oldImageUrl,
						beritaId,
						false,
						tenantCtxFromReq(req),
					);
					updates.image = imageUrl;
					updates.imageSource = 'local';
				}

				// Update berita
				const updatedBerita = await storage.updateBerita(
					beritaId,
					updates,
				);

				if (req.body.relatedGalleryIds !== undefined) {
					await syncBeritaGalleryLinksOnSave(
						resolveModels(req),
						beritaId,
						prevGalleryBerita,
						nextGalleryBerita,
					);
				}

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
					await cleanupBeritaImages(
						beritaId,
						usedImageUrls,
						tenantCtxFromReq(req),
					);
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
			const storage = resolveStorage(req);
			const existingBerita = await storage.getBeritaById(beritaId);
			if (!existingBerita) {
				return res.status(404).json({ message: 'Berita not found' });
			}

			const canDelete = await checkBeritaPermission(
				req.user as UserWithRole,
				existingBerita,
				'delete',
				req,
			);

			if (!canDelete) {
				return res.status(403).json({
					message: 'You do not have permission to delete this berita',
				});
			}

			// Delete berita
			await storage.deleteBerita(beritaId);

			// Cleanup entire berita folder (uploads/berita/{beritaId})
			await cleanupBeritaImages(beritaId, [], tenantCtxFromReq(req)); // Empty array means delete all

			// Also cleanup attached_assets/berita/{beritaId} if exists (legacy/misplaced)
			try {
				const assetsDir = path.join(
					PROJECT_ROOT,
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

	// Library routes (publik: hanya published)
	app.get('/api/library', async (req, res) => {
		try {
			const { page, limit, isPaginated } = getPaginationParams(req.query);
			const pubOpts = isPaginated
				? { page, limit, publishedOnly: true as const }
				: { publishedOnly: true as const };
			const allItems = await resolveStorage(req).getAllLibraryItems(pubOpts);

			for (const item of allItems) {
				attachLibraryDisplayFields(item as Record<string, unknown>);
				await enrichLibraryRelations(item, req);
				// Normalisasi untuk item lama tanpa mediaKinds
				const a = item as any;
				if ((!a.mediaKinds || a.mediaKinds.length === 0) && a.images?.length > 0) {
					a.mediaKinds = a.images.map(() => a.type === 'video' ? 'video' : 'image');
				}
			}

			// Enrich byline multi-owner untuk kartu library.
			try {
				await enrichLibraryWithAuthors(allItems, req);
			} catch (e) {
				console.warn('Failed to enrich library authors:', e);
			}

			if (isPaginated) {
				const total = await resolveStorage(req).getLibraryItemsCount({
					publishedOnly: true,
				});
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
			const m = resolveModels(req);
			const storage = resolveStorage(req);
			await expirePendingShares(m.PostSharing, m.UserNotification, storage);

			const userId = (req.user as UserWithRole)?._id || '';
			const permissions = await storage.getUserPermissions(String(userId));

			let items: any[];
			if (permissions.includes('library.view_others')) {
				items = await storage.getAllLibraryItems();
			} else if (
				permissions.includes('library.view') ||
				permissions.includes('library.edit') ||
				permissions.includes('library.create')
			) {
				items = await storage.getLibraryItemsByAuthorId(userId);
			} else {
				items = [];
			}

			const now = new Date();
			const sharedAccess = await m.PostSharing.find({
				entityType: 'library',
				targetId: userId,
				status: 'approved',
			}).lean();
			const pendingAccess = await m.PostSharing.find({
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
						const item = await storage.getLibraryItemById(eid);
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
			const pendingIdSet = new Set(
				(pendingAccess as { entityId: unknown }[]).map((s) =>
					String(s.entityId),
				),
			);
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

			for (const row of items) {
				attachLibraryDisplayFields(row as Record<string, unknown>);
				await enrichLibraryRelations(row, req);
			}

			res.json(items);
		} catch (error) {
			console.error('Get library management error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/library/:id', authenticateOptional, async (req, res) => {
		try {
			const itemId = req.params.id;
			const item = await resolveStorage(req).getLibraryItemById(itemId);

			if (!item) {
				return res.status(404).json({ message: 'Library item not found' });
			}

			const user = req.user as UserWithRole | undefined;
			const canView = await canViewLibraryItem(user, item, req);
			if (!canView) {
				return res.status(404).json({ message: 'Library item not found' });
			}

			// Increment viewCount (fire-and-forget, like berita/event)
			try {
				const currentViews = typeof (item as any).viewCount === 'number' ? (item as any).viewCount : 0;
				const nextViews = currentViews + 1;
				await resolveStorage(req).updateLibraryItem(itemId, { viewCount: nextViews });
				(item as any).viewCount = nextViews;
			} catch (incError) {
				console.warn('Failed to increment library viewCount:', incError);
			}

			attachLibraryDisplayFields(item as Record<string, unknown>);
			await enrichLibraryRelations(item, req);
			// Normalisasi untuk item lama tanpa mediaKinds
			const a = item as any;
			if ((!a.mediaKinds || a.mediaKinds.length === 0) && a.images?.length > 0) {
				a.mediaKinds = a.images.map(() => a.type === 'video' ? 'video' : 'image');
			}
			try {
				await enrichLibraryWithAuthors([item], req);
			} catch (e) {
				console.warn('Failed to enrich library authors:', e);
			}

			res.json(item);
		} catch (error) {
			console.error('Get library item error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get(
		'/api/library/:libraryId/folder/:folderId/files',
		authenticateOptional,
		async (req, res) => {
			try {
				const { libraryId, folderId } = req.params;
				const storage = resolveStorage(req);
				const { Library } = resolveModels(req);
				const item = await Library.findById(libraryId).lean();
				if (!item) return res.status(404).json({ message: 'Library item not found' });

				const user = req.user as any;
				const isAdmin = !!user;
				if (!isAdmin && !(item as any).published) {
					return res.status(404).json({ message: 'Not found' });
				}

				const embeds: { folderId: string; url: string }[] = (item as any).gdriveEmbedFolders || [];
				if (!embeds.some((e) => e.folderId === folderId)) {
					return res.status(403).json({ message: 'Folder not linked to this library item' });
				}

				const { getFolderContents } = await import('./googleDrive');
				let files;
				try {
					files = await getFolderContents(folderId);
				} catch (driveErr: any) {
					console.error('Get library folder files (Drive API):', driveErr);
					return res.status(503).json({
						message:
							'Layanan Google Drive tidak dapat diakses (kredensial atau kuota). Coba lagi nanti atau buka folder di Drive.',
						folderId,
					});
				}

				const mapped = files.map((f) => ({
					id: f.id,
					name: f.name,
					mimeType: f.mimeType,
					thumbnailLink: f.thumbnailLink || `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`,
				}));

				res.json({ files: mapped, folderId });
			} catch (error) {
				console.error('Get library folder files error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/library',
		authenticate,
		requirePermission('library.create'),
		uploadMiddleware.array('images', 50),
		async (req, res) => {
			try {
				const body = req.body;
				const title = (body.title || '').trim();
				const description = (body.description || '').trim();
				const fullDescription = (body.fullDescription || '').trim();
				let type = (body.type || 'photo') as 'photo' | 'video';
				const published =
					body.published === 'true' ||
					body.published === true ||
					body.published === undefined;
				let activityDate: Date | null = null;
				if (body.activityDate) {
					const d = new Date(body.activityDate);
					if (!Number.isNaN(d.getTime())) activityDate = d;
				}

				const parseGdriveUrlList = (): string[] => {
					const g = body.gdriveUrls;
					if (Array.isArray(g)) return g.map(String).filter((u) => u.trim());
					const out: string[] = [];
					for (const k of Object.keys(body)) {
						const m = k.match(/^gdriveUrls\[(\d+)\]$/);
						if (m) out[Number(m[1])] = body[k];
					}
					const compact = out.filter(Boolean);
					if (compact.length) return compact;
					if (typeof g === 'string' && g.trim()) return [g];
					return [];
				};

				const parseMediaTypeList = (): string[] => {
					const g = body.gdriveMediaTypes;
					if (Array.isArray(g)) return g.map(String);
					const out: string[] = [];
					for (const k of Object.keys(body)) {
						const m = k.match(/^gdriveMediaTypes\[(\d+)\]$/);
						if (m) out[Number(m[1])] = body[k];
					}
					return out.filter(Boolean);
				};

				const parseRelatedIds = (field: string): string[] => {
					const raw = body[field];
					if (!raw) return [];
					if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
					if (typeof raw === 'string') {
						try {
							const j = JSON.parse(raw);
							return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
						} catch {
							return raw
								.split(',')
								.map((s) => s.trim())
								.filter(Boolean);
						}
					}
					return [];
				};

				const relatedEventIds = parseRelatedIds('relatedEventIds');
				const relatedBeritaIds = parseRelatedIds('relatedBeritaIds');
				const embedFoldersOnly =
					body.embedFoldersOnly === 'true' || body.embedFoldersOnly === true;

				const parseTags = (): string[] => {
					const raw = body.tags;
					if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
					if (typeof raw === 'string') {
						try { const j = JSON.parse(raw); if (Array.isArray(j)) return j.map(String).filter(Boolean); } catch { /* ignore */ }
						return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
					}
					return [];
				};
				const tags = parseTags();

				if (!title) {
					return res.status(400).json({ message: 'Title is required' });
				}

				const authorId = (req.user as UserWithRole)?._id;

				if (!authorId) {
					return res.status(401).json({ message: 'Authentication required' });
				}

				const gdriveUrls = parseGdriveUrlList();
				const gdriveMediaTypes = parseMediaTypeList();

				let imageUrls: string[] = [];
				let imageSources: string[] = [];
				let gdriveFileIds: string[] = [];
				let mediaKinds: ('image' | 'video')[] = [];
				const gdriveEmbedFolders: { folderId: string; url: string }[] = [];
				const folderCardPlaceholder =
					'data:image/svg+xml,' +
					encodeURIComponent(
						'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#e2e8f0" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="14">Google Drive folder</text></svg>',
					);

				if (gdriveUrls.length > 0) {
					const {
						extractFileId,
						checkAccessibility,
						isValidGoogleDriveUrl,
						getFolderMediaForLibrary,
						isFolderUrl,
						resolveLibrarySlotMediaKindFromDrive,
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

						const accessible = await checkAccessibility(fileId);
						if (!accessible) {
							return res.status(400).json({
								message: `Google Drive file is private and cannot be accessed: ${url}`,
							});
						}

						const isFolder = isFolderUrl(url);
						if (isFolder) {
							if (embedFoldersOnly) {
								gdriveEmbedFolders.push({
									folderId: fileId,
									url: url.trim(),
								});
								imageUrls.push(folderCardPlaceholder);
								imageSources.push('gdrive');
								gdriveFileIds.push(fileId);
								mediaKinds.push('image');
							} else {
								try {
									const folderFiles = await getFolderMediaForLibrary(fileId);
									for (const file of folderFiles) {
										imageUrls.push(file.url);
										imageSources.push('gdrive');
										gdriveFileIds.push(file.id);
										mediaKinds.push(file.type);
									}
								} catch (folderError) {
									console.error('Error processing folder:', folderError);
									imageUrls.push(url);
									imageSources.push('gdrive');
									gdriveFileIds.push(fileId);
									mediaKinds.push('image');
								}
							}
						} else {
							imageUrls.push(url);
							imageSources.push('gdrive');
							gdriveFileIds.push(fileId);
							const hint = gdriveMediaTypes[i];
							const slotKind = await resolveLibrarySlotMediaKindFromDrive(
								fileId,
								hint,
								type,
							);
							mediaKinds.push(slotKind);
						}
					}
				}

				const files = req.files as Express.Multer.File[];
				if (files && files.length > 0) {
					const tCtx = tenantCtxFromReq(req);
					const uploadedUrls = await Promise.all(
						files.map((file) =>
							uploadHandler(file, true, 'general', undefined, undefined, tCtx),
						),
					);

					for (let i = 0; i < uploadedUrls.length; i++) {
						const file = files[i];
						imageUrls.push(uploadedUrls[i]);
						imageSources.push('local');
						gdriveFileIds.push('');
						const isVid = (file.mimetype || '').startsWith('video/');
						mediaKinds.push(isVid ? 'video' : 'image');
					}
				}

				if (imageUrls.length === 0) {
					return res.status(400).json({
						message: 'At least one media item is required (upload or Google Drive link)',
					});
				}

				while (mediaKinds.length < imageUrls.length) {
					mediaKinds.push('image');
				}
				if (mediaKinds.length > imageUrls.length) {
					mediaKinds = mediaKinds.slice(0, imageUrls.length);
				}

				const anyVideo = mediaKinds.some((k) => k === 'video');
				const allVideo = mediaKinds.every((k) => k === 'video');
				type = allVideo ? 'video' : anyVideo ? 'photo' : type;

				const models = resolveModels(req);
				const newItem = await resolveStorage(req).createLibraryItem({
					title,
					description,
					fullDescription,
					images: imageUrls,
					imageSources,
					gdriveFileIds,
					mediaKinds,
					gdriveEmbedFolders,
					type,
					published,
					activityDate: activityDate || undefined,
					relatedEventIds,
					relatedBeritaIds,
					authorId,
					tags,
				});

				const nid = String((newItem as any)._id || (newItem as any).id);
				await syncLibraryLinksOnSave(
					models,
					nid,
					{ relatedEventIds: [], relatedBeritaIds: [] },
					{ relatedEventIds, relatedBeritaIds },
				);

				attachLibraryDisplayFields(newItem as Record<string, unknown>);
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
		uploadMiddleware.array('images', 50),
		async (req, res) => {
			try {
				const itemId = req.params.id;
				const body = req.body;

				const storage = resolveStorage(req);
				const existingItem = await storage.getLibraryItemById(itemId);
				if (!existingItem) {
					return res.status(404).json({ message: 'Library item not found' });
				}

				const canEdit = await checkLibraryPermission(
					req.user as UserWithRole,
					existingItem,
					'edit',
					req,
				);

				if (!canEdit) {
					return res
						.status(403)
						.json({ message: 'You do not have permission to edit this item' });
				}

				const parseGdriveUrlList = (): string[] => {
					const g = body.gdriveUrls;
					if (Array.isArray(g)) return g.map(String).filter((u) => u.trim());
					const out: string[] = [];
					for (const k of Object.keys(body)) {
						const m = k.match(/^gdriveUrls\[(\d+)\]$/);
						if (m) out[Number(m[1])] = body[k];
					}
					const compact = out.filter(Boolean);
					if (compact.length) return compact;
					if (typeof g === 'string' && g.trim()) return [g];
					return [];
				};

				const parseMediaTypeList = (): string[] => {
					const g = body.gdriveMediaTypes;
					if (Array.isArray(g)) return g.map(String);
					const out: string[] = [];
					for (const k of Object.keys(body)) {
						const m = k.match(/^gdriveMediaTypes\[(\d+)\]$/);
						if (m) out[Number(m[1])] = body[k];
					}
					return out.filter(Boolean);
				};

				const parseRelatedIds = (field: string): string[] => {
					const raw = body[field];
					if (raw === undefined) return [];
					if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
					if (typeof raw === 'string') {
						try {
							const j = JSON.parse(raw);
							return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
						} catch {
							return raw
								.split(',')
								.map((s) => s.trim())
								.filter(Boolean);
						}
					}
					return [];
				};

				const title = (body.title ?? (existingItem as any).title ?? '').trim();
				const description = (body.description ?? (existingItem as any).description ?? '').trim();
				const fullDescription = (body.fullDescription ?? (existingItem as any).fullDescription ?? '').trim();
				let type = (body.type || (existingItem as any).type || 'photo') as
					| 'photo'
					| 'video';
				const published =
					body.published !== undefined
						? body.published === 'true' || body.published === true
						: (existingItem as any).published !== false;
				let activityDate: Date | undefined | null = (existingItem as any).activityDate ?? null;
				if (body.activityDate !== undefined && body.activityDate !== '') {
					const d = new Date(body.activityDate);
					if (!Number.isNaN(d.getTime())) activityDate = d;
				}

				const relatedEventIds = parseRelatedIds('relatedEventIds');
				const relatedBeritaIds = parseRelatedIds('relatedBeritaIds');
				const hasRelE =
					body.relatedEventIds !== undefined && body.relatedEventIds !== '';
				const hasRelB =
					body.relatedBeritaIds !== undefined && body.relatedBeritaIds !== '';
				const embedFoldersOnly =
					body.embedFoldersOnly === 'true' || body.embedFoldersOnly === true;

				const parseTags = (): string[] => {
					const raw = body.tags;
					if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
					if (typeof raw === 'string') {
						try { const j = JSON.parse(raw); if (Array.isArray(j)) return j.map(String).filter(Boolean); } catch { /* ignore */ }
						return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
					}
					return [];
				};

				if (!title) {
					return res.status(400).json({ message: 'Title is required' });
				}

				const updates: any = {
					title,
					description,
					fullDescription,
					type,
					published,
					updatedAt: new Date(),
				};
				if (body.activityDate !== undefined) {
					updates.activityDate = activityDate;
				}
				if (hasRelE) updates.relatedEventIds = relatedEventIds;
				if (hasRelB) updates.relatedBeritaIds = relatedBeritaIds;
				if (body.tags !== undefined) {
					updates.tags = parseTags();
				}

				const gdriveUrls = parseGdriveUrlList();
				const gdriveMediaTypes = parseMediaTypeList();

				let imageUrls: string[] = [];
				let imageSources: string[] = [];
				let gdriveFileIds: string[] = [];
				let mediaKinds: ('image' | 'video')[] = [];
				const gdriveEmbedFolders: { folderId: string; url: string }[] = [];
				const folderCardPlaceholderPut =
					'data:image/svg+xml,' +
					encodeURIComponent(
						'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#e2e8f0" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="14">Google Drive folder</text></svg>',
					);

				if (gdriveUrls.length > 0) {
					const {
						extractFileId,
						checkAccessibility,
						isValidGoogleDriveUrl,
						getFolderMediaForLibrary,
						isFolderUrl,
						resolveLibrarySlotMediaKindFromDrive,
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

						try {
							const accessible = await checkAccessibility(fileId);
							if (!accessible) {
								console.warn(`File may be temporarily inaccessible: ${url}`);
							}
						} catch (error) {
							console.warn(
								'Accessibility check failed, continuing anyway:',
								error,
							);
						}

						const isFolder = isFolderUrl(url);
						if (isFolder) {
							if (embedFoldersOnly) {
								gdriveEmbedFolders.push({
									folderId: fileId,
									url: url.trim(),
								});
								imageUrls.push(folderCardPlaceholderPut);
								imageSources.push('gdrive');
								gdriveFileIds.push(fileId);
								mediaKinds.push('image');
							} else {
								try {
									const folderFiles = await getFolderMediaForLibrary(fileId);
									for (const file of folderFiles) {
										imageUrls.push(file.url);
										imageSources.push('gdrive');
										gdriveFileIds.push(file.id);
										mediaKinds.push(file.type);
									}
								} catch (folderError) {
									console.error('Error processing folder:', folderError);
									imageUrls.push(url);
									imageSources.push('gdrive');
									gdriveFileIds.push(fileId);
									mediaKinds.push('image');
								}
							}
						} else {
							imageUrls.push(url);
							imageSources.push('gdrive');
							gdriveFileIds.push(fileId);
							const hint = gdriveMediaTypes[i];
							const slotKind = await resolveLibrarySlotMediaKindFromDrive(
								fileId,
								hint,
								type,
							);
							mediaKinds.push(slotKind);
						}
					}
				}

				const files = req.files as Express.Multer.File[];
				if (files && files.length > 0) {
					const tCtx = tenantCtxFromReq(req);
					const uploadedUrls = await Promise.all(
						files.map((file) =>
							uploadHandler(file, true, 'general', undefined, undefined, tCtx),
						),
					);

					for (let i = 0; i < uploadedUrls.length; i++) {
						const file = files[i];
						imageUrls.push(uploadedUrls[i]);
						imageSources.push('local');
						gdriveFileIds.push('');
						const isVid = (file.mimetype || '').startsWith('video/');
						mediaKinds.push(isVid ? 'video' : 'image');
					}
				}

				if (imageUrls.length > 0) {
					while (mediaKinds.length < imageUrls.length) {
						mediaKinds.push('image');
					}
					if (mediaKinds.length > imageUrls.length) {
						mediaKinds = mediaKinds.slice(0, imageUrls.length);
					}
					const anyVideo = mediaKinds.some((k) => k === 'video');
					const allVideo = mediaKinds.every((k) => k === 'video');
					updates.type = allVideo ? 'video' : anyVideo ? 'photo' : type;
					updates.images = imageUrls;
					updates.imageSources = imageSources;
					updates.gdriveFileIds = gdriveFileIds;
					updates.mediaKinds = mediaKinds;
					updates.gdriveEmbedFolders = gdriveEmbedFolders;
				} else if (
					(existingItem as any).images &&
					(existingItem as any).images.length > 0
				) {
					updates.images = (existingItem as any).images;
					updates.imageSources =
						(existingItem as any).imageSources ||
						(existingItem as any).images.map(() => 'local');
					updates.gdriveFileIds =
						(existingItem as any).gdriveFileIds ||
						(existingItem as any).images.map(() => '');
					updates.mediaKinds =
						(existingItem as any).mediaKinds ||
						(existingItem as any).images.map(() => 'image');
					updates.gdriveEmbedFolders =
						(existingItem as any).gdriveEmbedFolders || [];
				} else {
					return res.status(400).json({
						message: 'At least one media item is required',
					});
				}

				const updatedItem = await storage.updateLibraryItem(itemId, updates);

				const models = resolveModels(req);
				const prevE = ((existingItem as any).relatedEventIds || []).map((x: any) =>
					String(x),
				);
				const prevB = ((existingItem as any).relatedBeritaIds || []).map((x: any) =>
					String(x),
				);
				const nextE = hasRelE
					? relatedEventIds
					: prevE;
				const nextB = hasRelB
					? relatedBeritaIds
					: prevB;
				await syncLibraryLinksOnSave(
					models,
					String(itemId),
					{ relatedEventIds: prevE, relatedBeritaIds: prevB },
					{ relatedEventIds: nextE, relatedBeritaIds: nextB },
				);

				attachLibraryDisplayFields((updatedItem || {}) as Record<string, unknown>);
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
			const storage = resolveStorage(req);
			const existingItem = await storage.getLibraryItemById(itemId);
			if (!existingItem) {
				return res.status(404).json({ message: 'Library item not found' });
			}

			const canDelete = await checkLibraryPermission(
				req.user as UserWithRole,
				existingItem,
				'delete',
				req,
			);

			if (!canDelete) {
				return res
					.status(403)
					.json({ message: 'You do not have permission to delete this item' });
			}

			const models = resolveModels(req);
			await removeLibraryFromAllRelations(models, itemId);
			await storage.deleteLibraryItem(itemId);

			res.json({ message: 'Library item deleted successfully' });
		} catch (error) {
			console.error('Delete library item error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Organization routes
	app.get('/api/organization/periods', async (req, res) => {
		try {
			const periods = await resolveStorage(req).getOrganizationPeriods();
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
				const storage = resolveStorage(req);
				const { period } = req.body;

				if (!period || !/^\d{4}-\d{4}$/.test(period)) {
					return res.status(400).json({
						message:
							'Invalid period format. Please use YYYY-YYYY format (e.g., 2025-2026)',
					});
				}

				// Check if period already exists
				const existingPeriods = await storage.getOrganizationPeriods();
				if (existingPeriods.includes(period)) {
					return res.status(400).json({
						message: `Period "${period}" already exists`,
					});
				}

				// Create period in dedicated collection
				await storage.createOrganizationPeriod(period);

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
				const storage = resolveStorage(req);
				const period = decodeURIComponent(req.params.period);

				// Check if period has any members
				const membersInPeriod =
					await storage.getOrganizationMembersByPeriod(period);
				if (membersInPeriod.length > 0) {
					return res.status(400).json({
						message: `Cannot delete period "${period}" because it has ${membersInPeriod.length} member(s). Please remove all members first.`,
					});
				}

				// Delete the period from dedicated collection
				await storage.deleteOrganizationPeriod(period);

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
			const positions = await resolveStorage(req).getPositionsByPeriod(period);
			res.json(positions);
		} catch (error) {
			console.error('Get positions error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/organization/positions', async (req, res) => {
		try {
			const positions = await resolveStorage(req).getAllPositions();
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
				const storage = resolveStorage(req);
				const { period, positions } = req.body;
				const result = await storage.createPositionsForPeriod(
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
				const storage = resolveStorage(req);
				const { sourcePeriod, targetPeriod } = req.body;
				const result = await storage.copyPositionsFromPeriod(
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
				const storage = resolveStorage(req);
				const { period } = req.params;
				await storage.deletePositionsForPeriod(period);
				res.status(204).send();
			} catch (error) {
				console.error('Delete positions error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.get('/api/organization/members', async (req, res) => {
		try {
			const storage = resolveStorage(req);
			const { period } = req.query;
			const { page, limit, isPaginated } = getPaginationParams(req.query);

			if (!period) {
				// Get latest period if not specified
				const periods = await resolveStorage(req).getOrganizationPeriods();
				const latestPeriod = periods.length > 0 ? periods[0] : null;

				if (!latestPeriod) {
					return res.json([]);
				}

				const members = await storage.getOrganizationMembersByPeriod(
					latestPeriod,
					isPaginated ? { page, limit } : undefined,
				);
				if (isPaginated) {
					const allMembers =
						await storage.getOrganizationMembersByPeriod(latestPeriod);
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

			const members = await storage.getOrganizationMembersByPeriod(
				period as string,
				isPaginated ? { page, limit } : undefined,
			);
			if (isPaginated) {
				const allMembers = await storage.getOrganizationMembersByPeriod(
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
			const storage = resolveStorage(req);
			const memberId = req.params.id;
			const member = await storage.getOrganizationMemberById(memberId);

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
		'/api/organization/structure-auto-fill',
		authenticate,
		requirePermission('organization.manage_members'),
		uploadMiddleware.single('document'),
		async (req, res) => {
			try {
				const storage = resolveStorage(req);
				if (!req.file?.buffer) {
					return res.status(400).json({
						message:
							'File dokumen diperlukan (gambar, PDF, atau Word .doc/.docx).',
					});
				}
				const periodHint = (req.body.period || '').toString().trim();
				let members: { id: string; name: string }[] | undefined;
				let positions: { name: string; order?: number }[] | undefined;
				const membersRaw = req.body.members;
				const positionsRaw = req.body.positions;
				if (
					membersRaw != null &&
					String(membersRaw).trim() !== ''
				) {
					try {
						members = JSON.parse(membersRaw as string) as {
							id: string;
							name: string;
						}[];
					} catch {
						return res.status(400).json({
							message: 'Field members harus berupa JSON array valid.',
						});
					}
					if (!Array.isArray(members)) {
						return res.status(400).json({
							message: 'members harus berupa array.',
						});
					}
				}
				if (
					positionsRaw != null &&
					String(positionsRaw).trim() !== ''
				) {
					try {
						positions = JSON.parse(positionsRaw as string) as {
							name: string;
							order?: number;
						}[];
					} catch {
						return res.status(400).json({
							message: 'Field positions harus berupa JSON array valid.',
						});
					}
					if (!Array.isArray(positions)) {
						return res.status(400).json({
							message: 'positions harus berupa array.',
						});
					}
				}

				const result = await previewOrganizationStructureAutoFill({
					file: req.file,
					periodHint: periodHint || undefined,
					members,
					positions,
					storage,
				});
				res.json(result);
			} catch (error: any) {
				console.error('Organization structure auto-fill error:', error);
				const msg =
					typeof error?.message === 'string'
						? error.message
						: 'Gagal memproses dokumen.';
				res.status(500).json({ message: msg });
			}
		},
	);

	app.post(
		'/api/organization/structure-auto-fill/apply',
		authenticate,
		requirePermission('organization.manage_members'),
		async (req, res) => {
			try {
				const storage = resolveStorage(req);
				const previewData = req.body?.previewData;
				const answers =
					req.body?.answers && typeof req.body.answers === 'object'
						? (req.body.answers as Record<string, unknown>)
						: {};
				if (!previewData || typeof previewData !== 'object') {
					return res.status(400).json({
						message: 'Field previewData wajib (hasil pratinjau sebelumnya).',
					});
				}
				const result = await applyOrganizationStructureAutoFill({
					previewData,
					answers,
					storage,
				});
				res.json(result);
			} catch (error: any) {
				console.error('Organization structure auto-fill apply error:', error);
				const msg =
					typeof error?.message === 'string'
						? error.message
						: 'Gagal menerapkan struktur.';
				res.status(500).json({ message: msg });
			}
		},
	);

	app.post(
		'/api/organization/members',
		authenticate,
		requirePermission('organization.manage_members'),
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				const storage = resolveStorage(req);
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
					imageUrl = await uploadOrganizationMemberImage(req.file, undefined, tenantCtxFromReq(req));
				}

				// Create organization member
				const newMember = await storage.createOrganizationMember({
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
				const storage = resolveStorage(req);
				const memberId = req.params.id;
				const { name, position, period } = req.body;
				const gdriveUrl = (req.body.gdriveUrl || '').toString();

				// Get existing member
				const existingMember =
					await storage.getOrganizationMemberById(memberId);
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
						tenantCtxFromReq(req),
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
				const updatedMember = await storage.updateOrganizationMember(
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
				const storage = resolveStorage(req);
				const memberId = req.params.id;

				// Validate memberId - prevent 'undefined' issues
				if (!memberId || memberId === 'undefined') {
					return res
						.status(400)
						.json({ message: 'Invalid organization member ID' });
				}

				// Check if member exists
				const existingMember =
					await storage.getOrganizationMemberById(memberId);
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
				await storage.deleteOrganizationMember(memberId);

				res.json({ message: 'Organization member deleted successfully' });
			} catch (error) {
				console.error('Delete organization member error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Settings routes (tenant-aware)
	app.get('/api/settings', async (req, res) => {
		try {
			const storage = resolveStorage(req);
			const settings = await storage.getSettings();
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

				const updatedSettings = await resolveStorage(req).updateSettings(body);
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

				const updatedSettings = await resolveStorage(req).updateSettings(updatePayload);
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
				const settings = await resolveStorage(req).resetSettings();
				res.json(settings);
			} catch (error) {
				console.error('Reset settings error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Manage home image banner slot definitions (order, label, add/remove)
	app.put(
		'/api/settings/home-image-slots',
		authenticate,
		requirePermission('settings.edit'),
		async (req, res) => {
			try {
				const { slots } = req.body;
				if (!Array.isArray(slots)) {
					return res.status(400).json({ message: 'slots must be an array' });
				}
				for (const s of slots) {
					if (!s.id || !s.label || typeof s.order !== 'number') {
						return res.status(400).json({ message: 'Each slot must have id, label, and order' });
					}
				}
				const storage = resolveStorage(req);

				// Detect removed slots and cleanup their HomeImages data + files
				const oldSettings = await storage.getSettings();
				const oldSlotArr: string[] = ((oldSettings as any)?.homeImageBannerSlots || []).map((s: any) => s.id);
				const newSlotSet = new Set(slots.map((s: any) => s.id));
				const removedSlotIds = oldSlotArr.filter((id: string) => !newSlotSet.has(id));

				if (removedSlotIds.length > 0) {
					try {
						const fs = await import('fs');
						const path = await import('path');
						const allYears: any[] = await storage.getAllHomeImages();
						for (const hi of allYears) {
							const unsetFields: Record<string, 1> = {};
							const urlsToDelete: string[] = [];
							for (const slotId of removedSlotIds) {
								if (hi.banners?.[slotId]) {
									urlsToDelete.push(hi.banners[slotId]);
									unsetFields[`banners.${slotId}`] = 1;
								}
								if (hi.people?.[slotId]) {
									urlsToDelete.push(hi.people[slotId]);
									unsetFields[`people.${slotId}`] = 1;
								}
							}
							if (Object.keys(unsetFields).length > 0) {
								const models = resolveModels(req);
								await models.HomeImages.updateOne({ _id: hi._id }, { $unset: unsetFields });
								for (const url of urlsToDelete) {
									try {
										const abs = path.resolve(PROJECT_ROOT, url.replace(/^\//, ''));
										if (fs.existsSync(abs)) fs.unlinkSync(abs);
									} catch {}
								}
							}
						}
					} catch (e) {
						console.warn('Slot removal cleanup error (non-fatal):', e);
					}
				}

				const updated = await storage.updateSettings({ homeImageBannerSlots: slots });
				res.json(updated);
			} catch (error) {
				console.error('Update home image slots error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// ── Prodi Content endpoints ──

	app.get('/api/prodi', async (req, res) => {
		try {
			const content = await resolveStorage(req).getProdiContentPublic();
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
		async (req, res) => {
			try {
				await mongoStorage.ensureCurriculumByYearMigrated();
				const doc = await resolveStorage(req).getProdiContent();
				const result = doc.toObject ? doc.toObject() : JSON.parse(JSON.stringify(doc));
				const years = await mongoStorage.getProdiCurriculumYears();
				const activeYear = mongoStorage.resolveAcademicYearByDate(new Date());
				result.curriculumYears = years;
				result.activeAcademicYear = activeYear;
				result.targetSyncYear = activeYear;
				res.json(result);
			} catch (error) {
				console.error('Get prodi manage error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.get(
		'/api/prodi/curriculum/:year',
		authenticate,
		requirePermission('prodi.view'),
		async (req, res) => {
			try {
				const year = parseInt(req.params.year, 10);
				if (!Number.isFinite(year)) return res.status(400).json({ message: 'Tahun tidak valid' });
				const data = await mongoStorage.getProdiCurriculumByYear(year);
				if (!data) return res.status(404).json({ message: `Kurikulum tahun ${year} tidak ditemukan` });
				res.json(data);
			} catch (error) {
				console.error('Get prodi curriculum by year error:', error);
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
				const { curriculumYear, ...rest } = req.body;
				if (curriculumYear && rest.content?.curriculum) {
					const curPayload = rest.content.curriculum;
					await mongoStorage.upsertProdiCurriculumByYear(
						curriculumYear,
						{ ...curPayload, source: 'manual' },
						{ overwrite: true },
					);
					delete rest.content.curriculum;
					const hasOtherContent = Object.keys(rest.content).length > 0;
					if (!hasOtherContent) delete rest.content;
				}
				const updated = await resolveStorage(req).updateProdiContent(rest);
				res.json(updated);
			} catch (error) {
				console.error('Update prodi manage error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/prodi/curriculum/year',
		authenticate,
		requirePermission('prodi.edit'),
		async (req, res) => {
			try {
				const { academicYear, copyFromYear } = req.body;
				const year = parseInt(String(academicYear), 10);
				if (!Number.isFinite(year) || year < 2000 || year > 2100) {
					return res.status(400).json({ message: 'Tahun harus antara 2000–2100' });
				}
				let payload: any = {
					semesters: [], optionalSubjects: [], graduateProfile: [],
					knowledgeGroups: [], structureSummary: '', subjectRpsResources: [],
					source: 'manual',
				};
				if (copyFromYear) {
					const src = await mongoStorage.getProdiCurriculumByYear(parseInt(String(copyFromYear), 10));
					if (src) {
						payload = {
							semesters: JSON.parse(JSON.stringify(src.semesters ?? [])),
							optionalSubjects: JSON.parse(JSON.stringify(src.optionalSubjects ?? [])),
							graduateProfile: JSON.parse(JSON.stringify(src.graduateProfile ?? [])),
							knowledgeGroups: JSON.parse(JSON.stringify(src.knowledgeGroups ?? [])),
							structureSummary: src.structureSummary ?? '',
							subjectRpsResources: JSON.parse(JSON.stringify(src.subjectRpsResources ?? [])),
							source: 'manual',
						};
					}
				}
				const result = await mongoStorage.upsertProdiCurriculumByYear(year, payload, { overwrite: false });
				if (result.action === 'needs_confirm') {
					return res.status(409).json({ message: `Kurikulum tahun ${year} sudah ada` });
				}
				res.json({ message: `Kurikulum tahun ${year} berhasil dibuat`, year: result.year, action: result.action });
			} catch (error) {
				console.error('Create curriculum year error:', error);
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
				const url = await uploadProdiLecturerPhoto(req.file!, slug, oldPhotoUrl, tenantCtxFromReq(req));
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
				const url = await uploadProdiLabPhoto(req.file!, type, labIndex, imgIndex, oldPhotoUrl, tenantCtxFromReq(req));
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
					tenantCtxFromReq(req),
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
		async (req, res) => {
			try {
				const doc = await resolveStorage(req).getProdiContent();
				if (doc.syncStatus === 'syncing') {
					return res.status(409).json({ message: 'Sync sedang berjalan' });
				}
				const scope = (req.body?.scope || 'all') as string;
				const validScopes = ['all', 'profile', 'lecturers', 'curriculum', 'labs'];
				if (!validScopes.includes(scope)) {
					return res.status(400).json({ message: `Scope tidak valid. Pilih: ${validScopes.join(', ')}` });
				}
				const overwrite = req.body?.overwrite === true;
				const { runProdiSyncScoped } = await import('./services/prodi-sync');
				const result = await runProdiSyncScoped(scope as any, { overwrite });

				if (result.curriculumYearAction === 'needs_confirm') {
					return res.status(200).json({
						message: `Data kurikulum tahun ${result.curriculumTargetYear} sudah ada. Konfirmasi overwrite?`,
						needsConfirm: true,
						curriculumTargetYear: result.curriculumTargetYear,
						summary: result,
					});
				}

				if (!result.ok) {
					return res.status(500).json({
						message: result.error || 'Sinkronisasi gagal',
						summary: result,
					});
				}
				res.json({
					message: `Sinkronisasi (${scope}) selesai`,
					summary: result,
					curriculumTargetYear: result.curriculumTargetYear,
					curriculumYearAction: result.curriculumYearAction,
				});
			} catch (error) {
				console.error('Prodi sync trigger error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// ── Backup & Restore (owner-only) ──
	const {
		listAvailableBackups,
		listAvailableTenantBackups,
		restoreFromSnapshot,
		restoreTenantFromSnapshot,
		runBackupNowMainOverride,
		runBackupNowTenantOverride,
	} = await import('./services/db-backup');

	app.get(
		'/api/backups/monthly',
		authenticate,
		authorize(['owner']),
		async (req, res) => {
			try {
				const tenantDbName = (req as any).tenantDbName as string | undefined;
				const list = tenantDbName
					? await listAvailableTenantBackups(tenantDbName)
					: await listAvailableBackups();
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
				const models = resolveModels(req);
				const u = await models.User.findById(user._id).lean() as any;
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
				const tenantDbName = (req as any).tenantDbName as string | undefined;
				const result = tenantDbName
					? await restoreTenantFromSnapshot(tenantDbName, snapshotKey)
					: await restoreFromSnapshot(snapshotKey);
				if (!result.success) {
					return res.status(400).json({ message: result.error || 'Restore gagal' });
				}
				res.json({
					message: tenantDbName
						? 'Database komunitas berhasil di-restore dari backup'
						: 'Database berhasil di-restore dari backup',
				});
			} catch (error: any) {
				if (error instanceof OtpError) {
					return res.status(400).json({ message: error.message });
				}
				console.error('Restore confirm error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.post(
		'/api/backups/now',
		authenticate,
		authorize(['owner']),
		async (req, res) => {
			try {
				const tenantDbName = (req as any).tenantDbName as string | undefined;
				let result;
				if (tenantDbName) {
					result = await runBackupNowTenantOverride(tenantDbName);
				} else {
					result = await runBackupNowMainOverride();
				}
				if (!result.success) {
					return res.status(500).json({ message: result.error || 'Backup gagal' });
				}
				res.json({
					message: result.replaced ? 'Backup berhasil (override bulan ini)' : 'Backup berhasil',
					scope: tenantDbName ? 'tenant' : 'main',
					snapshotKey: result.snapshotKey,
					replaced: result.replaced,
				});
			} catch (error: any) {
				console.error('Backup now error:', error);
				res.status(500).json({ message: error?.message || 'Internal server error' });
			}
		},
	);

	// ── Orphan Asset Cleanup — DISABLED ──
	// Dinonaktifkan: auto-cleanup bisa false-delete file yang masih valid.
	app.post(
		'/api/assets/cleanup-orphans',
		authenticate,
		authorize(['owner']),
		mainOnly,
		(_req, res) => {
			res.status(410).json({
				message: 'Orphan asset cleanup telah dinonaktifkan untuk mencegah penghapusan file valid.',
				disabled: true,
			});
		},
	);

	// ── Home Images routes ──

	// Seed default data on startup
	mongoStorage
		.seedDefaultHomeImages()
		.catch((err: any) => console.warn('HomeImages seed skipped:', err.message));

	// Public: get active year images
	app.get('/api/home-images/active', async (req, res) => {
		try {
			const data = await resolveStorage(req).getActiveHomeImages();
			res.json(data || {});
		} catch (error) {
			console.error('Get active home images error:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Auth: list all years (auto-ensure current year exists)
	app.get('/api/home-images', authenticate, async (req, res) => {
		try {
			const storage = resolveStorage(req);
			const currentYear = new Date().getFullYear();
			const existing = await storage.getHomeImagesByYear(currentYear);
			if (!existing) {
				await storage.createHomeImages({ year: currentYear, isActive: false });
			}
			const list = await storage.getAllHomeImages();
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
				const storage = resolveStorage(req);
				const { year } = req.body;
				if (!year || typeof year !== 'number') {
					return res.status(400).json({ message: 'Valid year is required' });
				}
				const existing = await storage.getHomeImagesByYear(year);
				if (existing) {
					return res
						.status(409)
						.json({ message: `Year ${year} already exists` });
				}
				const doc = await storage.createHomeImages({
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
				const doc = await resolveStorage(req).updateHomeImages(year, req.body);
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
				const storage = resolveStorage(req);
				const year = parseInt(req.params.year, 10);
				const doc = await storage.getHomeImagesByYear(year);
				if (!doc) return res.status(404).json({ message: 'Year not found' });
				if (doc.isActive) {
					return res
						.status(400)
						.json({ message: 'Cannot delete the active year' });
				}
				await storage.deleteHomeImages(year);
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
				const doc = await resolveStorage(req).setActiveHomeImages(year);
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
				const doc = await resolveStorage(req).copyHomeImages(
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

	/** Render banner WebP di server (ag-psd + canvas), tanpa Photopea */
	app.post(
		'/api/home-images/:year/banner-render',
		authenticate,
		requirePermission('settings.edit'),
		uploadLimiter,
		uploadMiddleware.fields([
			{ name: 'photo', maxCount: 1 },
			{ name: 'logo', maxCount: 1 },
		]),
		async (req, res) => {
			try {
				const year = parseInt(req.params.year, 10);
				const storage = resolveStorage(req);
				const existing = await storage.getHomeImagesByYear(year);
				if (!existing) {
					return res.status(404).json({ message: 'Year not found' });
				}

				const personName = String(req.body.personName ?? '').trim();
				const divisionText = String(req.body.divisionText ?? '').trim();

				let themeRaw = String(
					req.body.themeColor ?? '',
				).trim();
				if (themeRaw && !themeRaw.startsWith('#')) themeRaw = `#${themeRaw}`;

				const palette =
					themeRaw.length === 7
						? deriveBannerColorsFromTheme(themeRaw)
						: deriveBannerColorsFromTheme(DEFAULT_THEME_COLOR);

				const showDivisionName =
					req.body.showDivisionName === 'true' ||
					req.body.showDivisionName === true;
				const showLogo =
					req.body.showLogo === 'true' || req.body.showLogo === true;

				const files = req.files as
					| Record<string, Express.Multer.File[]>
					| undefined;
				const photoBuffer = files?.photo?.[0]?.buffer ?? null;
				const logoBuffer =
					showLogo && files?.logo?.[0]?.buffer
						? files.logo[0].buffer
						: null;

				const webp = await renderBannerTemplateWebp({
					templatePsdPath: getDefaultBannerTemplatePath(),
					personName: personName || 'Alfiya',
					divisionText: divisionText || 'Divisi',
					bgHex: palette.bgHex,
					accentHex: palette.accentHex,
					nameStripeHex: palette.nameStripeHex,
					fogHex: palette.fogHex,
					showNameDivision: showDivisionName,
					photoBuffer,
					logoBuffer,
				});

				res.setHeader('Content-Type', 'image/webp');
				res.send(webp);
			} catch (error: any) {
				console.error('Banner render error:', error);
				res.status(500).json({
					message: error.message || 'Render banner gagal',
				});
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

				const fixedSlots = ['bennerfull', 'orang'];
				const defaultBannerSlots = [
					'public_relation', 'technopreneurship', 'intelektual',
					'wakil_ketua', 'ketua', 'medinfo', 'religius', 'senor',
				];

				const storage = resolveStorage(req);

				let validSlots = [...fixedSlots, ...defaultBannerSlots];
				try {
					const currentSettings = await storage.getSettings();
					const dynSlots = (currentSettings as any)?.homeImageBannerSlots;
					if (Array.isArray(dynSlots) && dynSlots.length > 0) {
						validSlots = [...fixedSlots, ...dynSlots.map((s: any) => s.id)];
					}
				} catch {}

				if (!validSlots.includes(slot)) {
					return res.status(400).json({ message: `Invalid slot: ${slot}` });
				}

				const existing = await storage.getHomeImagesByYear(year);
				if (!existing) {
					return res.status(404).json({ message: 'Year not found' });
				}

				if (!req.file) {
					return res.status(400).json({ message: 'Image file is required' });
				}

				if (!isProcessableImage(req.file.mimetype)) {
					return res.status(400).json({ message: 'File type not supported' });
				}

				// Process image → webp (banner slot quality tuned for small-but-sharp output)
				const isFull = slot === 'bennerfull' || slot === 'orang';
				const processedBuffer = await processImage(req.file.buffer, {
					quality: isFull ? 82 : 85,
					maxWidth: isFull ? 3840 : 1920,
					maxHeight: isFull ? 2160 : 2400,
					format: 'webp',
				});

				const { dir: slotDir, urlPrefix } = resolveTenantPaths(
					`benner/${year}`, true, tenantCtxFromReq(req),
				);
				const fileName = `${slot}.webp`;
				const filePath = path.join(slotDir, fileName);
				try {
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				} catch (e) {
					console.warn('Could not delete old home image file:', e);
				}
				fs.writeFileSync(filePath, processedBuffer);

				const url = `${urlPrefix}/${fileName}`;
				const doc = await storage.updateHomeImageSlot(year, slot, url);
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

				const fixedSlots = ['bennerfull', 'orang'];
				const defaultBannerSlots = [
					'public_relation', 'technopreneurship', 'intelektual',
					'wakil_ketua', 'ketua', 'medinfo', 'religius', 'senor',
				];

				const storage = resolveStorage(req);

				let validSlots = [...fixedSlots, ...defaultBannerSlots];
				try {
					const currentSettings = await storage.getSettings();
					const dynSlots = (currentSettings as any)?.homeImageBannerSlots;
					if (Array.isArray(dynSlots) && dynSlots.length > 0) {
						validSlots = [...fixedSlots, ...dynSlots.map((s: any) => s.id)];
					}
				} catch {}

				if (!validSlots.includes(slot)) {
					return res.status(400).json({ message: `Invalid slot: ${slot}` });
				}

				const existing = await storage.getHomeImagesByYear(year);
				if (!existing)
					return res.status(404).json({ message: 'Year not found' });

				const { dir: slotDir } = resolveTenantPaths(
					`benner/${year}`, true, tenantCtxFromReq(req),
				);
				const fileName = `${slot}.webp`;
				const filePath = path.join(slotDir, fileName);
				try {
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				} catch (e) {
					console.warn('Could not delete home image file:', e);
				}

				const doc = await storage.updateHomeImageSlot(year, slot, '');
				res.json(doc);
			} catch (error) {
				console.error('Delete home image slot error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Upload person image for a specific slot (solo person per division)
	app.post(
		'/api/home-images/:year/upload-person/:slot',
		authenticate,
		requirePermission('settings.edit'),
		uploadLimiter,
		uploadMiddleware.single('image'),
		async (req, res) => {
			try {
				const year = parseInt(req.params.year, 10);
				const slot = req.params.slot;

				const fixedSlots = ['bennerfull', 'orang'];
				const defaultBannerSlots = [
					'public_relation', 'technopreneurship', 'intelektual',
					'wakil_ketua', 'ketua', 'medinfo', 'religius', 'senor',
				];

				const storage = resolveStorage(req);

				let validSlots = [...fixedSlots, ...defaultBannerSlots];
				try {
					const currentSettings = await storage.getSettings();
					const dynSlots = (currentSettings as any)?.homeImageBannerSlots;
					if (Array.isArray(dynSlots) && dynSlots.length > 0) {
						validSlots = [...fixedSlots, ...dynSlots.map((s: any) => s.id)];
					}
				} catch {}

				if (!validSlots.includes(slot)) {
					return res.status(400).json({ message: `Invalid slot: ${slot}` });
				}

				const existing = await storage.getHomeImagesByYear(year);
				if (!existing) {
					return res.status(404).json({ message: 'Year not found' });
				}

				if (!req.file) {
					return res.status(400).json({ message: 'Image file is required' });
				}

				if (!isProcessableImage(req.file.mimetype)) {
					return res.status(400).json({ message: 'File type not supported' });
				}

				const processedBuffer = await processImage(req.file.buffer, {
					quality: 82,
					maxWidth: 3840,
					maxHeight: 2160,
					format: 'webp',
				});

				const { dir: personDir, urlPrefix } = resolveTenantPaths(
					`benner/${year}`, true, tenantCtxFromReq(req),
				);
				const fileName = `person__${slot}.webp`;
				const filePath = path.join(personDir, fileName);
				try {
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				} catch (e) {
					console.warn('Could not delete old person image file:', e);
				}
				fs.writeFileSync(filePath, processedBuffer);

				const url = `${urlPrefix}/${fileName}`;
				const doc = await storage.updateHomeImagePersonSlot(year, slot, url);
				res.json(doc);
			} catch (error) {
				console.error('Upload person image error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Delete person image for a specific slot
	app.delete(
		'/api/home-images/:year/person/:slot',
		authenticate,
		requirePermission('settings.edit'),
		async (req, res) => {
			try {
				const year = parseInt(req.params.year, 10);
				const slot = req.params.slot;

				const fixedSlots = ['bennerfull', 'orang'];
				const defaultBannerSlots = [
					'public_relation', 'technopreneurship', 'intelektual',
					'wakil_ketua', 'ketua', 'medinfo', 'religius', 'senor',
				];

				const storage = resolveStorage(req);

				let validSlots = [...fixedSlots, ...defaultBannerSlots];
				try {
					const currentSettings = await storage.getSettings();
					const dynSlots = (currentSettings as any)?.homeImageBannerSlots;
					if (Array.isArray(dynSlots) && dynSlots.length > 0) {
						validSlots = [...fixedSlots, ...dynSlots.map((s: any) => s.id)];
					}
				} catch {}

				if (!validSlots.includes(slot)) {
					return res.status(400).json({ message: `Invalid slot: ${slot}` });
				}

				const existingDoc = await storage.getHomeImagesByYear(year);
				if (!existingDoc) return res.status(404).json({ message: 'Year not found' });

				const { dir: personDir } = resolveTenantPaths(
					`benner/${year}`, true, tenantCtxFromReq(req),
				);
				const fileName = `person__${slot}.webp`;
				const filePath = path.join(personDir, fileName);
				try {
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				} catch (e) {
					console.warn('Could not delete person image file:', e);
				}

				const doc = await storage.updateHomeImagePersonSlot(year, slot, '');
				res.json(doc);
			} catch (error) {
				console.error('Delete person image slot error:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// ── Migrate community media to tenant-scoped paths ──
	app.post(
		'/api/admin/migrate-community-media',
		authenticate,
		requirePermission('settings.edit'),
		async (req, res) => {
			try {
				const user = (req as any).user;
				if (user.role !== 'owner') {
					return res.status(403).json({ message: 'Owner only' });
				}

				const { Community } = await import('../db/mongodb');
				const { getTenantModels } = await import('../db/tenant');
				const communities = await Community.find({ status: 'active' }).lean() as any[];

				const MEDIA_PREFIXES = ['/attached_assets/', '/uploads/'];

				const needsMigration = (url: string | undefined): boolean => {
					if (!url) return false;
					const isMedia = MEDIA_PREFIXES.some((p) => url.startsWith(p));
					if (!isMedia) return false;
					for (const prefix of MEDIA_PREFIXES) {
						if (url.startsWith(prefix)) {
							const rest = url.slice(prefix.length);
							if (rest.startsWith('community/')) return false;
						}
					}
					return true;
				};

				const migrateUrl = (url: string, slug: string): string => {
					for (const prefix of MEDIA_PREFIXES) {
						if (url.startsWith(prefix)) {
							const rest = url.slice(prefix.length);
							return `${prefix}community/${slug}/${rest}`;
						}
					}
					return url;
				};

				const copyMediaFile = (oldUrl: string, newUrl: string) => {
					try {
						const oldP = path.join(PROJECT_ROOT, oldUrl);
						const newP = path.join(PROJECT_ROOT, newUrl);
						if (!fs.existsSync(oldP)) return;
						const dir = path.dirname(newP);
						if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
						if (!fs.existsSync(newP)) fs.copyFileSync(oldP, newP);
					} catch {}
				};

				const results: { slug: string; migrated: number; errors: string[] }[] = [];

				for (const community of communities) {
					const slug = community.slug as string;
					const dbName = community.dbName as string;
					if (!slug || !dbName) continue;

					let migrated = 0;
					const errors: string[] = [];

					try {
						const models = getTenantModels(dbName);

						// Migrate HomeImages
						const homeImagesDocs = await models.HomeImages.find({}).lean() as any[];
						for (const doc of homeImagesDocs) {
							const updates: Record<string, string> = {};
							for (const field of ['bennerfull', 'orang'] as const) {
								const val = doc[field];
								if (needsMigration(val)) {
									const newVal = migrateUrl(val, slug);
									copyMediaFile(val, newVal);
									updates[field] = newVal;
								}
							}
							if (doc.banners && typeof doc.banners === 'object') {
								for (const [k, v] of Object.entries(doc.banners)) {
									if (needsMigration(v as string)) {
										const nv = migrateUrl(v as string, slug);
										copyMediaFile(v as string, nv);
										updates[`banners.${k}`] = nv;
									}
								}
							}
							if (doc.people && typeof doc.people === 'object') {
								for (const [k, v] of Object.entries(doc.people)) {
									if (needsMigration(v as string)) {
										const nv = migrateUrl(v as string, slug);
										copyMediaFile(v as string, nv);
										updates[`people.${k}`] = nv;
									}
								}
							}
							if (Object.keys(updates).length > 0) {
								await models.HomeImages.updateOne({ _id: doc._id }, { $set: updates });
								migrated += Object.keys(updates).length;
							}
						}

						// Migrate Berita images
						const beritaDocs = await models.Berita.find({}).lean() as any[];
						for (const doc of beritaDocs) {
							const updates: Record<string, any> = {};
							if (needsMigration(doc.image)) {
								const nv = migrateUrl(doc.image, slug);
								copyMediaFile(doc.image, nv);
								updates.image = nv;
							}
							if (doc.images && Array.isArray(doc.images)) {
								const newImages = doc.images.map((img: string) => {
									if (needsMigration(img)) {
										const nv = migrateUrl(img, slug);
										copyMediaFile(img, nv);
										return nv;
									}
									return img;
								});
								if (newImages.some((ni: string, i: number) => ni !== doc.images[i])) {
									updates.images = newImages;
								}
							}
							if (Object.keys(updates).length > 0) {
								await models.Berita.updateOne({ _id: doc._id }, { $set: updates });
								migrated += Object.keys(updates).length;
							}
						}

						// Migrate Library images
						const libraryDocs = await models.Library.find({}).lean() as any[];
						for (const doc of libraryDocs) {
							if (doc.images && Array.isArray(doc.images)) {
								const newImages = doc.images.map((img: string) => {
									if (needsMigration(img)) {
										const nv = migrateUrl(img, slug);
										copyMediaFile(img, nv);
										return nv;
									}
									return img;
								});
								if (newImages.some((ni: string, i: number) => ni !== doc.images[i])) {
									await models.Library.updateOne({ _id: doc._id }, { $set: { images: newImages } });
									migrated++;
								}
							}
						}

						// Migrate Organization member images
						const orgDocs = await models.Organization.find({}).lean() as any[];
						for (const doc of orgDocs) {
							if (needsMigration(doc.imageUrl)) {
								const nv = migrateUrl(doc.imageUrl, slug);
								copyMediaFile(doc.imageUrl, nv);
								await models.Organization.updateOne({ _id: doc._id }, { $set: { imageUrl: nv } });
								migrated++;
							}
						}

						// Migrate Settings logoUrl
						const settingsDoc = await models.Settings.findOne({}).lean() as any;
						if (settingsDoc && needsMigration(settingsDoc.logoUrl)) {
							const nv = migrateUrl(settingsDoc.logoUrl, slug);
							copyMediaFile(settingsDoc.logoUrl, nv);
							await models.Settings.updateOne({ _id: settingsDoc._id }, { $set: { logoUrl: nv } });
							migrated++;
						}

					} catch (e: any) {
						errors.push(e.message || String(e));
					}

					results.push({ slug, migrated, errors });
				}

				res.json({ ok: true, communities: results });
			} catch (error: any) {
				console.error('Migrate community media error:', error);
				res.status(500).json({ message: error.message || 'Migration failed' });
			}
		},
	);

	// Middleware Settings endpoints
	app.get(
		'/api/settings/middleware',
		mainOnly,
		authenticate,
		async (req, res, next) => {
			try {
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
		mainOnly,
		authenticate,
		async (req, res, next) => {
			try {
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
			const storage = resolveStorage(req);
			const beritaCount = await storage.getBeritaCount();
			const libraryCount = await storage.getLibraryItemsCount();
			const activeMemberCount =
				await storage.getOrganizationActiveMembersCount();

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
			const storage = resolveStorage(req);
			// Check if user has dashboard stats permission
			const permissions = await storage.getUserPermissions(
				String((req.user as UserWithRole)?._id),
			);

			if (!permissions.includes('dashboard.stats')) {
				return res.status(403).json({
					message: 'You do not have permission to view dashboard statistics',
				});
			}

			const [beritaCount, libraryCount, activeMemberCount, alumniMemberCount] =
				await Promise.all([
					storage.getBeritaCount(),
					storage.getLibraryItemsCount(),
					storage.getOrganizationActiveMembersCount(),
					storage.getOrganizationAlumniMembersCount(),
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

	// Recent activities (tenant-aware)
	app.get('/api/dashboard/activities', authenticate, async (req, res) => {
		try {
			const limit = parseInt(req.query.limit as string) || 10;
			const type = req.query.type as string;

			if ((req as any).isTenantRequest) {
				const storage = resolveStorage(req);
				const activities = await storage.getRecentActivities(limit, type);
				return res.json(activities || []);
			}

			const { getRecentActivities } = await import('./models/activity');
			const activities = await getRecentActivities(limit, type);
			res.json(activities || []);
		} catch (error) {
			console.error('Get activities error:', error);
			res
				.status(500)
				.json({ message: 'Internal server error', error: String(error) });
		}
	});

	// Activity logging endpoint (tenant-aware)
	app.post('/api/dashboard/log-activity', authenticate, async (req, res) => {
		try {
			const activityData = {
				...req.body,
				userId: (req.user as any)?._id,
				userName: (req.user as any)?.name || (req.user as any)?.username,
				userRole: (req.user as any)?.role,
			};

			if ((req as any).isTenantRequest) {
				const storage = resolveStorage(req);
				const activity = await storage.logActivity(activityData);
				return res.json(activity);
			}

			const { logActivity } = await import('./models/activity');
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
				const url = await uploadFilosofiImage(req.file, key, tenantCtxFromReq(req));
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
					undefined,
					tenantCtxFromReq(req),
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
				const roles = await resolveStorage(req).getAllRoles();
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
			const roles = await resolveStorage(req).getAllRoles();
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
			const storage = resolveStorage(req);
			const allRoles = await storage.getAllRoles();
			const requesterRoleName = ((req.user as any)?.role || '').toString();

			let requesterRole = allRoles.find(
				(r: any) =>
					(r?.name || '').toString().toLowerCase() ===
					requesterRoleName.toLowerCase(),
			);

			if (!requesterRole) {
				try {
					requesterRole = await storage.getRoleByName(requesterRoleName);
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

				const role = await resolveStorage(req).createRole(roleData);
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
				const roleStorage = resolveStorage(req);
				const currentUserRoleName = (req.user as any)?.role || '';
				const allRolesForLevel = await roleStorage.getAllRoles();
				const foundUserRole = allRolesForLevel.find(
					(r: any) =>
						(r?.name || '').toString() === currentUserRoleName.toString(),
				);
				const userLevel =
					typeof foundUserRole?.level === 'number' ? foundUserRole.level : 999;

				if (typeof level !== 'number' || level <= userLevel) {
					return res.status(403).json({
						message:
							'You can only create roles with a lower privilege (greater level number) than your own',
					});
				}

				const allRoles = await roleStorage.getAllRoles();
				const toShift = allRoles
					.filter((r: any) => typeof r.level === 'number' && r.level >= level)
					.sort((a: any, b: any) => (b.level || 0) - (a.level || 0));

				for (const r of toShift) {
					await roleStorage.updateRole(String(r._id), {
						level: (r.level as number) + 1,
					});
				}

				const roleData = {
					name,
					displayName,
					description: description || '',
					level,
					permissions: permissions || [],
					createdBy: (req.user as any)?._id || '',
				};

				const role = await roleStorage.createRole(roleData);
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

				const roleStorage = resolveStorage(req);
				const currentRole = await roleStorage.getRoleByName(
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

				const role = await roleStorage.updateRole(id, updateData);
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

				const role = await resolveStorage(req).deleteRole(id);
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
				const permissions = await resolveStorage(req).getAllPermissions();
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

				const permission = await resolveStorage(req).createPermission(permissionData);
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
				const divisions = await resolveStorage(req).getAllDivisions();
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
				const divisions = await resolveStorage(req).getAllDivisions();
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
				const allPositions = await resolveStorage(req).getAllPositions();
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

				const divStorage = resolveStorage(req);
				const existingDivisions = await divStorage.getAllDivisions();
				if (existingDivisions.some((d: any) => d.name === name)) {
					return res.status(400).json({
						message: 'Division with this name already exists',
					});
				}

				const division = await divStorage.createDivision({
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

				const division = await resolveStorage(req).updateDivision(id, updateData);
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

				const division = await resolveStorage(req).deleteDivision(id);
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

				const user = await resolveStorage(req).updateUser(id, { role });
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

	// ══════════════════════════════════════════════════════════════
	// PERMISSION OVERRIDES PER USER
	// ══════════════════════════════════════════════════════════════

	app.get(
		'/api/users/:id/permission-overrides',
		authenticate,
		requirePermission('roles.edit_other'),
		async (req, res) => {
			try {
				const { id } = req.params;
				const storage = resolveStorage(req);

				const targetUser = await storage.getUserById(id);
				if (!targetUser) {
					return res.status(404).json({ message: 'User not found' });
				}

				if (
					!canManageRole(
						(req.user as UserWithRole)?.role || '',
						targetUser.role,
					)
				) {
					return res.status(403).json({
						message: 'You can only manage overrides for users with a lower role',
					});
				}

				const overrides = await storage.getUserPermissionOverrides(id);
				const basePermissions = await storage.getUserBasePermissions(id);
				res.json({ overrides, basePermissions });
			} catch (error) {
				console.error('Error getting permission overrides:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.put(
		'/api/users/:id/permission-overrides',
		authenticate,
		requirePermission('roles.edit_other'),
		async (req, res) => {
			try {
				const { id } = req.params;
				const storage = resolveStorage(req);
				const { allow, deny } = req.body;

				if (!Array.isArray(allow) || !Array.isArray(deny)) {
					return res
						.status(400)
						.json({ message: 'allow and deny must be arrays of strings' });
				}

				const targetUser = await storage.getUserById(id);
				if (!targetUser) {
					return res.status(404).json({ message: 'User not found' });
				}

				if (
					!canManageRole(
						(req.user as UserWithRole)?.role || '',
						targetUser.role,
					)
				) {
					return res.status(403).json({
						message: 'You can only manage overrides for users with a lower role',
					});
				}

				const allPermissions = await storage.getAllPermissions();
				const validNames = new Set(allPermissions.map((p: any) => p.name));
				const invalidAllow = allow.filter((p: string) => !validNames.has(p));
				const invalidDeny = deny.filter((p: string) => !validNames.has(p));
				if (invalidAllow.length > 0 || invalidDeny.length > 0) {
					return res.status(400).json({
						message: 'Invalid permission names',
						invalidAllow,
						invalidDeny,
					});
				}

				const denySet = new Set(deny);
				const cleanAllow = allow.filter((p: string) => !denySet.has(p));

				if (storage.updateUserPermissionOverrides) {
					await storage.updateUserPermissionOverrides(id, {
						allow: cleanAllow,
						deny,
					});
				} else {
					await storage.updateUser(id, { permissionOverrides: { allow: cleanAllow, deny } });
				}

				const effectivePermissions =
					await storage.getUserPermissions(id);

				res.json({
					message: 'Permission overrides updated',
					overrides: { allow: cleanAllow, deny },
					effectivePermissions,
				});
			} catch (error) {
				console.error('Error updating permission overrides:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	// Get current user permissions (tenant-aware)
	app.get('/api/auth/permissions', authenticate, async (req, res) => {
		try {
			const permissions = await resolveStorage(req).getUserPermissions(
				(req.user as UserWithRole)?._id || '',
			);
			res.json({ permissions });
		} catch (error) {
			console.error('Error getting user permissions:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Refresh user permissions (tenant-aware)
	app.post('/api/auth/refresh-permissions', authenticate, async (req, res) => {
		try {
			const permissions = await resolveStorage(req).getUserPermissions(
				(req.user as UserWithRole)?._id || '',
			);
			res.json({ permissions });
		} catch (error) {
			console.error('Error refreshing user permissions:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	// Owner-only: recompute owner role permissions
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
				const storage = resolveStorage(req);
				const allPerms = await storage.getAllPermissions();
				const allNames = allPerms.map((p: any) => p.name);
				const allRoles = await storage.getAllRoles();
				const ownerRole = allRoles.find((r: any) => r.name === 'owner');
				if (ownerRole) {
					await storage.updateRole(String(ownerRole._id), { permissions: allNames, updatedAt: new Date() });
				}
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

	app.get('/api/event-years', async (req, res) => {
		try {
			const years = await resolveStorage(req).getAllEventYears();
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
				const doc = await resolveStorage(req).createEventYear({
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
				const doc = await resolveStorage(req).updateEventYear(id, req.body);
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
				const storage = resolveStorage(req);
				const settings = await storage.getSettings();
				const multiYear = settings?.eventsAllowMultipleYearsOnHome === true;
				let doc;
				if (multiYear) {
					doc = await storage.toggleEventYearActive(id, true);
				} else {
					doc = await storage.setActiveEventYear(id);
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
				const doc = await resolveStorage(req).toggleEventYearActive(id, false);
				if (!doc)
					return res.status(404).json({ message: 'Event year not found' });
				res.json(doc);
			} catch (error) {
				console.error('Error deactivating event year:', error);
				res.status(500).json({ message: 'Internal server error' });
			}
		},
	);

	app.get(
		'/api/event-years/:id/events-count',
		authenticate,
		async (req, res) => {
			try {
				const { id } = req.params;
				const m = resolveModels(req);
				const total = await m.Event.countDocuments({ yearId: id });
				res.json({ count: total });
			} catch (error) {
				console.error('Error counting events for year:', error);
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
				const storage = resolveStorage(req);
				const tCtx = tenantCtxFromReq(req);
				const { deleteEventFileTree } = await import('./upload');

				const m = resolveModels(req);
				const allEvents: any[] = await m.Event.find({ yearId: id }).lean();

				for (const ev of allEvents) {
					await cleanupSingleEventFiles(ev, tCtx);
					const parentId = ev.parentId ? String(ev.parentId) : null;
					await deleteEventFileTree(String(ev._id), parentId, tCtx).catch(() => {});
				}

				await storage.deleteEventYear(id);
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

	app.get('/api/events/published', async (req, res) => {
		try {
			const events = await resolveStorage(req).getPublishedEventsAllYears();
			res.json(events);
		} catch (error) {
			console.error('Error getting published events:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/events/active-home', async (req, res) => {
		try {
			const data = await resolveStorage(req).getEventsForHome();
			if (!data) return res.json({ year: null, events: [] });
			// Enrich byline multi-owner untuk event cards.
			try {
				if (Array.isArray((data as any).events)) {
					for (const ev of (data as any).events) {
						await enrichEventTreeWithAuthors(ev, req);
					}
				}
				if (Array.isArray((data as any).years)) {
					for (const y of (data as any).years) {
						if (Array.isArray(y.events)) {
							for (const ev of y.events) {
								await enrichEventTreeWithAuthors(ev, req);
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
			const data = await resolveStorage(req).getEventsByYear(year, parentOnly);
			if (!data) return res.status(404).json({ message: 'Year not found' });
			res.json(data);
		} catch (error) {
			console.error('Error getting events by year:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	});

	app.get('/api/events', authenticate, async (req, res) => {
		try {
			const m = resolveModels(req);
			const storage = resolveStorage(req);
			await expirePendingShares(m.PostSharing, m.UserNotification, storage);

			const { yearId, parentId } = req.query;
			if (!yearId)
				return res.status(400).json({ message: 'yearId is required' });
			const pId =
				parentId === 'null' || parentId === ''
					? null
					: (parentId as string | undefined);

			const userId = (req.user as UserWithRole)._id;
			const SharingModel = m.PostSharing;
			const permissions = await storage.getUserPermissions(String(userId));

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
				const sharedApproved = await SharingModel.find({
					entityType: 'events',
					targetId: userId,
					status: 'approved',
				}).lean();
				const sharedPending = await SharingModel.find({
					entityType: 'events',
					status: 'pending',
					expiresAt: { $gt: now },
					targetId: userId,
				}).lean();
				includeSharedIds = Array.from(
					new Set([
						...(sharedApproved as { entityId: unknown }[]).map((s) =>
							String(s.entityId),
						),
						...(sharedPending as { entityId: unknown }[]).map((s) =>
							String(s.entityId),
						),
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
					(sharedPending as { entityId: unknown }[]).map((s) =>
						String(s.entityId),
					),
				);

				// If current parent (or any ancestor) is shared, sub-event list under it should be accessible too.
				if (
					pId &&
					(await hasApprovedSharing(
						'events',
						String(pId),
						userId.toString(),
						'view',
						req,
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

			const events = await storage.getEventsByYearId(
				yearId as string,
				pId,
				authorIdFilter,
			);

			if (includeSharedIds.length > 0) {
				const existingIds = new Set(events.map((e: any) => String(e._id)));
				for (const sid of includeSharedIds) {
					if (!existingIds.has(sid)) {
						const ev = await storage.getEventById(sid);
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
					current = await storage.getEventById(
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
					current = await storage.getEventById(
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

	app.get('/api/events/:id', authenticateOptional, async (req, res) => {
		try {
			const { id } = req.params;
			const withChildren = req.query.children === 'true';
			const storage = resolveStorage(req);
			const event = withChildren
				? await storage.getEventWithChildren(id)
				: await storage.getEventById(id);
			if (!event) return res.status(404).json({ message: 'Event not found' });

			if (!(event as any).published) {
				if (!req.user) {
					return res.status(403).json({
						message: 'You do not have permission to view this event',
					});
				}
				const canView = await checkEventPermission(
					req.user as UserWithRole,
					event,
					'view',
					req,
				);
				if (!canView) {
					return res.status(403).json({
						message: 'You do not have permission to view this event',
					});
				}
			}

			try {
				const currentViews = typeof (event as any).viewCount === 'number' ? (event as any).viewCount : 0;
				const nextViews = currentViews + 1;
				await storage.updateEvent(id, { viewCount: nextViews });
				(event as any).viewCount = nextViews;
			} catch (incError) {
				console.warn('Failed to increment event viewCount:', incError);
			}

			try {
				await enrichEventTreeWithAuthors(event, req);
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
			const uploadedLocalUrls: string[] = [];
			let createdEventId: string | null = null;
			try {
				const user = req.user as UserWithRole;
				const files = req.files as
					| { [fieldname: string]: Express.Multer.File[] }
					| undefined;
				const body = req.body;
				const storage = resolveStorage(req);
				const tCtx = tenantCtxFromReq(req);
				const parentId = body.parentId || null;

				const startDate = new Date(body.startDate);
				const month = startDate.getMonth() + 1;

				let relatedBerita: string[] = [];
				if (body.relatedBeritaIds) {
					try { relatedBerita = JSON.parse(body.relatedBeritaIds); } catch { /* ignore */ }
				}

				let relatedGalleryIds: string[] = [];
				if (body.relatedGalleryIds) {
					try {
						const g = JSON.parse(body.relatedGalleryIds);
						if (Array.isArray(g)) relatedGalleryIds = g.map((x: any) => String(x));
					} catch { /* ignore */ }
				}

				let existingGdriveAtts: any[] = [];
				if (body.attachments) {
					try { existingGdriveAtts = JSON.parse(body.attachments); } catch { /* ignore */ }
				}

				let thumbnailSource: 'local' | 'gdrive' = 'local';
				let thumbnail = '';
				if (body.thumbnailGdrive) {
					thumbnail = body.thumbnailGdrive;
					thumbnailSource = 'gdrive';
				}

				const eventData: any = {
					yearId: body.yearId,
					parentId,
					title: body.title,
					description: body.description || '',
					thumbnail,
					thumbnailSource,
					gdriveFileId: body.gdriveFileId || '',
					startDate,
					endDate: new Date(body.endDate),
					month,
					attachments: existingGdriveAtts,
					published: body.published === 'true' || body.published === true,
					createdBy: user._id,
					relatedBerita,
					relatedGalleryIds,
				};

				const event = await storage.createEvent(eventData);
				createdEventId = String((event as any)._id);

				if (relatedGalleryIds.length > 0) {
					const models = resolveModels(req);
					await syncEventGalleryLinksOnSave(
						models,
						createdEventId,
						[],
						relatedGalleryIds,
					);
				}

				if (files?.thumbnail?.[0]) {
					const { uploadEventThumbnail } = await import('./upload');
					thumbnail = await uploadEventThumbnail(files.thumbnail[0], createdEventId, parentId, undefined, tCtx);
					uploadedLocalUrls.push(thumbnail);
					thumbnailSource = 'local';
					await storage.updateEvent(createdEventId, { thumbnail, thumbnailSource });
				}

				if (files?.attachmentFiles) {
					const { uploadEventAttachment } = await import('./upload');
					const attachments = [...existingGdriveAtts];
					for (const f of files.attachmentFiles) {
						const url = await uploadEventAttachment(f, createdEventId, parentId, tCtx);
						uploadedLocalUrls.push(url);
						attachments.push({
							name: f.originalname,
							url,
							type: f.mimetype,
							source: 'local' as const,
						});
					}
					await storage.updateEvent(createdEventId, { attachments });
				}

				const savedEvent = await storage.getEventById(createdEventId);
				res.status(201).json(savedEvent || event);
			} catch (error) {
				console.error('Error creating event:', error);
				if (createdEventId) {
					try { await resolveStorage(req).deleteEvent(createdEventId); } catch {}
				}
				for (const u of uploadedLocalUrls) {
					try { await deleteFile(u); } catch {}
				}
				if (createdEventId) {
					try {
						const { deleteEventFileTree } = await import('./upload');
						await deleteEventFileTree(createdEventId, req.body.parentId || null, tenantCtxFromReq(req));
					} catch {}
				}
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
				const storage = resolveStorage(req);
				const existingEvent = await storage.getEventById(id);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });

				const body = req.body;
				const canEdit = await checkEventPermission(
					req.user as UserWithRole,
					existingEvent,
					'edit',
					req,
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
						req,
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
					const { uploadEventThumbnail } = await import('./upload');
					const parentId = (existingEvent as any).parentId ? String((existingEvent as any).parentId) : null;
					const oldThumb = (existingEvent as any).thumbnailSource === 'local' ? (existingEvent as any).thumbnail : undefined;
					updateData.thumbnail = await uploadEventThumbnail(
						files.thumbnail[0],
						id,
						parentId,
						oldThumb,
						tenantCtxFromReq(req),
					);
					updateData.thumbnailSource = 'local';
				} else if (body.thumbnailGdrive) {
					updateData.thumbnail = body.thumbnailGdrive;
					updateData.thumbnailSource = 'gdrive';
					if (
						(existingEvent as any).thumbnailSource === 'local' &&
						(existingEvent as any).thumbnail
					) {
						try {
							await deleteFile(String((existingEvent as any).thumbnail));
						} catch {
							/* ignore */
						}
					}
				}

				if (body.startDate) {
					updateData.startDate = new Date(body.startDate);
					updateData.month = updateData.startDate.getMonth() + 1;
				}
				if (body.endDate) updateData.endDate = new Date(body.endDate);

				if (body.attachments) {
					try {
						const parsed = JSON.parse(body.attachments);
						updateData.attachments = parsed;
						if (Array.isArray(parsed)) {
							const newUrls = new Set(
								parsed
									.map((a: any) => String(a?.url || ''))
									.filter(Boolean),
							);
							for (const att of (existingEvent as any).attachments || []) {
								if (
									att?.source === 'local' &&
									att?.url &&
									!newUrls.has(String(att.url))
								) {
									try {
										await deleteFile(String(att.url));
									} catch {
										/* ignore */
									}
								}
							}
						}
					} catch {
						/* ignore */
					}
				}

				if (files?.attachmentFiles) {
					const { uploadEventAttachment } = await import('./upload');
					if (!updateData.attachments) {
						const existing = await storage.getEventById(id);
						updateData.attachments = existing?.attachments || [];
					}
					const parentId = (existingEvent as any).parentId ? String((existingEvent as any).parentId) : null;
					for (const f of files.attachmentFiles) {
						const url = await uploadEventAttachment(f, id, parentId, tenantCtxFromReq(req));
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

				let prevGalleryIds: string[] = (
					(existingEvent as any).relatedGalleryIds || []
				).map((x: any) => String(x));
				let nextGalleryIds = prevGalleryIds;
				if (body.relatedGalleryIds !== undefined) {
					try {
						const parsed = JSON.parse(body.relatedGalleryIds);
						nextGalleryIds = Array.isArray(parsed)
							? parsed.map((x: any) => String(x))
							: [];
						updateData.relatedGalleryIds = nextGalleryIds;
					} catch {
						/* ignore */
					}
				}

				const event = await storage.updateEvent(id, updateData);
				if (body.relatedGalleryIds !== undefined) {
					const models = resolveModels(req);
					await syncEventGalleryLinksOnSave(
						models,
						id,
						prevGalleryIds,
						nextGalleryIds,
					);
				}
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
			const storage = resolveStorage(req);
			const event = await storage.getEventById(id);
			if (!event)
				return res.status(404).json({ message: 'Event not found' });

			const canDelete = await checkEventPermission(
				req.user as UserWithRole,
				event,
				'delete',
				req,
			);
			if (!canDelete) {
				return res.status(403).json({
					message: 'You do not have permission to delete this event',
				});
			}

			const tCtx = tenantCtxFromReq(req);
			const parentId = (event as any).parentId ? String((event as any).parentId) : null;

			const eventWithChildren = await storage.getEventWithChildren(id);
			const children: any[] = (eventWithChildren as any)?.children || [];
			for (const child of children) {
				await cleanupSingleEventFiles(child, tCtx);
				const { deleteEventFileTree } = await import('./upload');
				await deleteEventFileTree(String(child._id), String(event._id), tCtx).catch(() => {});
			}

			await cleanupSingleEventFiles(event, tCtx);
			const { deleteEventFileTree } = await import('./upload');
			await deleteEventFileTree(id, parentId, tCtx).catch(() => {});

			await storage.deleteEvent(id);
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
				const storage = resolveStorage(req);
				const event = await storage.getEventById(id);
				if (!event)
					return res.status(404).json({ message: 'Event not found' });
				const canView = await checkEventPermission(user, event, 'view', req);
				if (!canView) {
					return res.status(403).json({
						message:
							'You do not have permission to view this event',
					});
				}
				const { copyAttachments } = req.body;
				const beritaItem = await storage.copyEventToBerita(
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
				const result = await resolveStorage(req).copyBeritaToEvent(
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
				const storage = resolveStorage(req);
				const existingEvent = await storage.getEventById(id);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });
				const canEdit = await checkEventPermission(user, existingEvent, 'edit', req);
				if (!canEdit) {
					return res.status(403).json({
						message:
							'You do not have permission to edit this event',
					});
				}
				const { beritaId, copyFiles } = req.body;
				if (!beritaId)
					return res.status(400).json({ message: 'beritaId required' });
				const event = await storage.attachBeritaToEvent(id, beritaId, {
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
				const storage = resolveStorage(req);
				const existingEvent = await storage.getEventById(id);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });
				const canEdit = await checkEventPermission(user, existingEvent, 'edit', req);
				if (!canEdit) {
					return res.status(403).json({
						message:
							'You do not have permission to edit this event',
					});
				}
				const event = await storage.detachBeritaFromEvent(id, beritaId);
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
				const storage = resolveStorage(req);
				const existingEvent = await storage.getEventById(eventId);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });
				const canEdit = await checkEventPermission(user, existingEvent, 'edit', req);
				if (!canEdit) {
					return res.status(403).json({
						message:
							'You do not have permission to edit this event',
					});
				}
				const event = await storage.attachBeritaToEvent(
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
				const storage = resolveStorage(req);
				const existingEvent = await storage.getEventById(eventId);
				if (!existingEvent)
					return res.status(404).json({ message: 'Event not found' });
				const canEdit = await checkEventPermission(user, existingEvent, 'edit', req);
				if (!canEdit) {
					return res.status(403).json({
						message:
							'You do not have permission to edit this event',
					});
				}
				const event = await storage.detachBeritaFromEvent(
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

	// ══════════════════════════════════════════════════════════════
	// ── Registration Management Routes (main dashboard) ──
	// ══════════════════════════════════════════════════════════════

	// List all registration codes
	app.get(
		'/api/registration/codes',
		mainOnly,
		authenticate,
		requirePermission('registration.view'),
		async (_req, res) => {
			try {
				const codes = await mongoStorage.getAllRegistrationCodes();
				res.json(codes);
			} catch (error: any) {
				res.status(500).json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// Create a new registration code
	app.post(
		'/api/registration/codes',
		mainOnly,
		authenticate,
		requirePermission('registration.manage'),
		async (req, res) => {
			try {
				const user = req.user as UserWithRole;
				const { type, maxUses, expiresInHours, note } = req.body;
				if (!type || !['community', 'alumni'].includes(type)) {
					return res.status(400).json({ message: 'Tipe registrasi harus community atau alumni' });
				}
				const hours = parseInt(expiresInHours) || 72;
				const code = Array.from({ length: 4 }, () =>
					Math.random().toString(36).substring(2, 6).toUpperCase()
				).join('-');

				const regCode = await mongoStorage.createRegistrationCode({
					code,
					type,
					createdBy: user._id,
					createdByName: user.name || user.username,
					maxUses: parseInt(maxUses) || 1,
					expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
					status: 'active',
					note: note || '',
				});
				res.status(201).json(regCode);
			} catch (error: any) {
				res.status(500).json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// Permanently delete a registration code (must be before /codes/:id revoke)
	app.delete(
		'/api/registration/codes/:id/permanent',
		mainOnly,
		authenticate,
		requirePermission('registration.manage'),
		async (req, res) => {
			try {
				const code = await mongoStorage.getRegistrationCodeById(req.params.id);
				if (!code) return res.status(404).json({ message: 'Kode tidak ditemukan' });
				const currentUses = (code as any).currentUses ?? 0;
				const confirmUsedDelete =
					req.body?.confirmUsedDelete === true ||
					String(req.query.confirmUsedDelete) === 'true';
				if (currentUses > 0 && !confirmUsedDelete) {
					return res.status(400).json({
						message:
							'Kode ini sudah pernah dipakai. Kirim confirmUsedDelete: true untuk menghapus permanen.',
						requiresConfirm: true,
					});
				}
				await mongoStorage.deleteRegistrationCode(req.params.id);
				res.json({ message: 'Kode dihapus permanen' });
			} catch (error: any) {
				res.status(500).json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// Patch / edit registration code
	app.patch(
		'/api/registration/codes/:id',
		mainOnly,
		authenticate,
		requirePermission('registration.manage'),
		async (req, res) => {
			try {
				const {
					code,
					regenerateCode,
					maxUsesIncrement,
					extendHours,
					note,
				} = req.body || {};
				const hasAny =
					(code !== undefined && String(code).trim() !== '') ||
					regenerateCode === true ||
					maxUsesIncrement !== undefined ||
					extendHours !== undefined ||
					note !== undefined;
				if (!hasAny) {
					return res.status(400).json({ message: 'Tidak ada perubahan yang dikirim' });
				}
				const updated = await mongoStorage.patchRegistrationCode(req.params.id, {
					code,
					regenerateCode: regenerateCode === true,
					maxUsesIncrement:
						maxUsesIncrement !== undefined ? Number(maxUsesIncrement) : undefined,
					extendHours: extendHours !== undefined ? Number(extendHours) : undefined,
					note,
				});
				if (!updated) return res.status(404).json({ message: 'Kode tidak ditemukan' });
				res.json(updated);
			} catch (error: any) {
				const msg = error.message || 'Internal server error';
				const client = /sudah|tidak valid|tidak boleh|Format|Gagal membuat/.test(msg);
				res.status(client ? 400 : 500).json({ message: msg });
			}
		},
	);

	// Revoke a registration code (soft — tidak bisa dipakai daftar lagi)
	app.delete(
		'/api/registration/codes/:id',
		mainOnly,
		authenticate,
		requirePermission('registration.manage'),
		async (req, res) => {
			try {
				const code = await mongoStorage.getRegistrationCodeById(req.params.id);
				if (!code) return res.status(404).json({ message: 'Kode tidak ditemukan' });
				if ((code as any).status === 'revoked') {
					return res.status(400).json({ message: 'Kode sudah direvoke' });
				}
				await mongoStorage.updateRegistrationCode(req.params.id, { status: 'revoked' });
				res.json({ message: 'Kode berhasil direvoke' });
			} catch (error: any) {
				res.status(500).json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// List all communities (dengan metadata kode registrasi)
	app.get(
		'/api/registration/communities',
		mainOnly,
		authenticate,
		requirePermission('registration.view'),
		async (_req, res) => {
			try {
				const communities = await mongoStorage.getAllCommunitiesWithRegistrationMeta();
				res.json(communities);
			} catch (error: any) {
				res.status(500).json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// Update a community (owner info, name, etc.) from main dashboard
	app.put(
		'/api/registration/communities/:id',
		mainOnly,
		authenticate,
		requirePermission('registration.manage'),
		async (req, res) => {
			try {
				const community = await mongoStorage.getCommunityById(req.params.id);
				if (!community) return res.status(404).json({ message: 'Komunitas tidak ditemukan' });
				const { name, description, ownerUsername, ownerEmail, status } = req.body;
				const updates: any = {};
				if (name !== undefined) updates.name = name;
				if (description !== undefined) updates.description = description;
				if (ownerUsername !== undefined) updates.ownerUsername = ownerUsername;
				if (ownerEmail !== undefined) updates.ownerEmail = ownerEmail;
				if (status !== undefined) updates.status = status;
				const updated = await mongoStorage.updateCommunity(req.params.id, updates);
				res.json(updated);
			} catch (error: any) {
				res.status(500).json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// Delete a community (requires OTP)
	app.delete(
		'/api/registration/communities/:id',
		mainOnly,
		authenticate,
		requirePermission('registration.manage'),
		async (req, res) => {
			try {
				const { challengeId, resetToken } = req.body || {};
				if (!challengeId || !resetToken) {
					return res.status(400).json({ message: 'OTP konfirmasi diperlukan untuk menghapus komunitas' });
				}
				const community = await mongoStorage.getCommunityById(req.params.id);
				if (!community) return res.status(404).json({ message: 'Komunitas tidak ditemukan' });

				try {
					await confirmWithResetToken({ challengeId, resetToken, purpose: 'delete_community' });
				} catch {
					return res.status(400).json({ message: 'OTP tidak valid atau sudah expired' });
				}

				// Drop the tenant database
				const { getTenantConnection } = await import('../db/tenant');
				const tenantConn = getTenantConnection((community as any).dbName);
				await tenantConn.dropDatabase();

				await mongoStorage.deleteCommunity(req.params.id);
				const { invalidateCommunityCache } = await import('./middleware/tenant-resolver');
				invalidateCommunityCache((community as any).slug);

				res.json({ message: 'Komunitas dan semua datanya berhasil dihapus' });
			} catch (error: any) {
				res.status(500).json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// Public: list active communities (for navbar dropdown)
	app.get('/api/communities', async (_req, res) => {
		try {
			const communities = await mongoStorage.getActiveCommunities();
			const safe = (communities as any[]).map((c: any) => ({
				_id: c._id,
				name: c.name,
				slug: c.slug,
				logoUrl: c.logoUrl,
				description: c.description,
			}));
			res.json(safe);
		} catch (error: any) {
			res.status(500).json({ message: error.message || 'Internal server error' });
		}
	});

	// Request OTP for community deletion
	app.post(
		'/api/registration/communities/:id/request-delete-otp',
		authenticate,
		requirePermission('registration.manage'),
		async (req, res) => {
			try {
				const community = await mongoStorage.getCommunityById(req.params.id);
				if (!community) return res.status(404).json({ message: 'Komunitas tidak ditemukan' });
				const user = req.user as UserWithRole;
				if (!user.email) return res.status(400).json({ message: 'Email tidak ditemukan' });

				const { challengeId } = await createOtpChallenge({
					purpose: 'delete_community',
					email: user.email,
					userId: (user._id as any)?.toString?.() || user._id,
					requestIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '',
				});
				res.json({ challengeId, message: 'OTP telah dikirim ke email Anda' });
			} catch (error: any) {
				if (error instanceof RateLimitError) {
					return res.status(429).json({ message: error.message, retryAfter: error.retryAfterSeconds });
				}
				res.status(500).json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// Verify OTP for community deletion
	app.post(
		'/api/registration/communities/:id/verify-delete-otp',
		authenticate,
		requirePermission('registration.manage'),
		async (req, res) => {
			try {
				const { challengeId, otp } = req.body;
				if (!challengeId || !otp) return res.status(400).json({ message: 'challengeId dan otp diperlukan' });
				const { resetToken } = await verifyAndIssueResetToken({
					challengeId,
					code: otp,
					purpose: 'delete_community',
				});
				res.json({ resetToken });
			} catch (error: any) {
				if (error instanceof OtpError) {
					return res.status(400).json({ message: error.message });
				}
				res.status(500).json({ message: error.message || 'Internal server error' });
			}
		},
	);

	// Public: validate registration code
	app.post('/api/register/validate-code', async (req, res) => {
		try {
			const { code } = req.body;
			if (!code) return res.status(400).json({ valid: false, message: 'Kode diperlukan' });
			const regCode = await mongoStorage.getRegistrationCodeByCode(code);
			if (!regCode) return res.json({ valid: false, message: 'Kode tidak ditemukan' });
			if ((regCode as any).status !== 'active') return res.json({ valid: false, message: 'Kode sudah tidak aktif' });
			if ((regCode as any).expiresAt < new Date()) return res.json({ valid: false, message: 'Kode sudah expired' });
			if ((regCode as any).currentUses >= (regCode as any).maxUses) return res.json({ valid: false, message: 'Kode sudah mencapai batas pemakaian' });
			res.json({ valid: true, type: (regCode as any).type });
		} catch (error: any) {
			res.status(500).json({ valid: false, message: error.message || 'Internal server error' });
		}
	});

	// Public: upload file during onboarding (auth via registration code, no login)
	app.post(
		'/api/register/upload',
		uploadLimiter,
		uploadMiddleware.single('file'),
		validateFileUpload,
		async (req, res) => {
			try {
				if (!req.file) return res.status(400).json({ message: 'File is required' });
				const code = (req.body.code || '').trim();
				if (!code) return res.status(400).json({ message: 'Registration code is required' });

				const regCode = await mongoStorage.getRegistrationCodeByCode(code);
				if (!regCode || (regCode as any).status !== 'active' || (regCode as any).expiresAt < new Date()) {
					return res.status(403).json({ message: 'Kode registrasi tidak valid atau expired' });
				}

				const category = (req.body.category || 'organization') as any;
				const { url, diskPath } = await uploadTempOnboarding(req.file, code, category);

				const { TempUpload } = await import('../db/mongodb');
				await TempUpload.create({
					code,
					url,
					diskPath,
					category,
					key: req.body.key || '',
					expiresAt: new Date(Date.now() + TEMP_UPLOAD_TTL_MS),
				});

				res.json({ url });
			} catch (error: any) {
				console.error('Register upload error:', error);
				res.status(500).json({ message: error.message || 'Upload gagal' });
			}
		},
	);

	// Public: register a new community (onboarding) — atomic with rollback
	app.post('/api/register/community', async (req, res) => {
		try {
			const settings = await mongoStorage.getSettings();
			if (!(settings as any).enableRegistration) {
				return res.status(403).json({ message: 'Registrasi saat ini tidak diaktifkan' });
			}

			const {
				code, communityName, slug, ownerUsername, ownerPassword,
				ownerEmail, ownerName, description, contactEmail, address,
				socialLinks, initialDivisionCount: rawDivCount,
				// Extended onboarding fields
				divisions: customDivisions,
				bphPositions: customBph,
				autoCreateAccounts,
				accountEntries,
				// Optional profile content (structured)
				aboutUs: onboardAboutUs,
				aboutPageTrackRecord: onboardTrackRecord,
				aboutPageLambang: onboardLambang,
				logoUrl: onboardLogoUrl,
			} = req.body;
			const initialDivisionCount = Math.max(1, Math.min(20, parseInt(rawDivCount) || 3));

			if (!code || !communityName || !slug || !ownerUsername || !ownerPassword) {
				return res.status(400).json({ message: 'Nama komunitas, slug, username, dan password owner wajib diisi' });
			}

			if (!/^[a-z0-9_-]+$/.test(slug)) {
				return res.status(400).json({ message: 'URL slug hanya boleh huruf kecil, angka, dash, dan underscore' });
			}
			if (slug.length > 20) {
				return res.status(400).json({ message: 'URL slug maksimal 20 karakter' });
			}
			const reserved = ['api', 'login', 'dashboard', 'register', 'forgot-password', 'error', 'berita', 'profil', 'kelembagaan', 'prodi', 'events', 'communities', 'uploads', 'assets', 'attached_assets'];
			if (reserved.includes(slug)) {
				return res.status(400).json({ message: 'URL slug ini sudah digunakan oleh sistem' });
			}

			const existingCommunity = await mongoStorage.getCommunityBySlug(slug);
			if (existingCommunity) {
				return res.status(400).json({ message: 'URL slug sudah digunakan komunitas lain' });
			}

			const regCode = await mongoStorage.getRegistrationCodeByCode(code);
			if (!regCode || (regCode as any).status !== 'active') {
				return res.status(400).json({ message: 'Kode registrasi tidak valid' });
			}
			if ((regCode as any).expiresAt < new Date()) {
				return res.status(400).json({ message: 'Kode registrasi sudah expired' });
			}

			const dbName = `community_${slug.replace(/-/g, '_')}`;

			const community = await mongoStorage.createCommunity({
				name: communityName,
				slug,
				dbName,
				description: description || '',
				ownerUsername,
				ownerEmail: ownerEmail || '',
				registrationCodeId: (regCode as any)._id,
				status: 'active',
				initialDivisionCount,
				contactEmail: contactEmail || ownerEmail || '',
				address: address || '',
				socialLinks: socialLinks || {},
			});

			const communityId = String((community as any)._id);

			// Provision tenant database — rollback community record if this fails
			try {
				await mongoStorage.redeemRegistrationCode(code, communityId, communityName, ownerEmail || '');

				const { createTenantStorage } = await import('./tenant-storage');
				const { getTenantModels } = await import('../db/tenant');
				const tenantModels = getTenantModels(dbName);
				const tenantStorage = createTenantStorage(tenantModels);

				await tenantStorage.initializeDefaultPermissions();

			const ownerUser = await tenantStorage.createUser({
				username: ownerUsername,
				password: ownerPassword,
				name: ownerName || ownerUsername,
				email: (ownerEmail || '').trim() || `${ownerUsername.toLowerCase()}@no-email.local`,
				role: 'owner',
				division: '',
			});

				await tenantStorage.initializeDefaultRoles(String((ownerUser as any)._id));
				await tenantStorage.initializeDefaultDivisions();

				// Build divisions from custom input or fallback to numbered divisions
				const divList: Array<{ id: string; label: string }> = [];
				if (Array.isArray(customDivisions) && customDivisions.length > 0) {
					for (const d of customDivisions) {
						const id = (d.id || d.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
						const label = d.label || d.name || id;
						if (id) divList.push({ id, label });
					}
				} else {
					for (let i = 1; i <= initialDivisionCount; i++) {
						divList.push({ id: `divisi_${i}`, label: `Divisi ${i}` });
					}
				}

				// Build BPH positions from custom input or use defaults
				const bphList: string[] = Array.isArray(customBph) && customBph.length > 0
					? customBph.map((p: any) => typeof p === 'string' ? p : (p.name || p.label || '')).filter(Boolean)
					: ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara'];

				// Create divisions in DB
				const bannerSlots: { id: string; label: string; order: number }[] = [];
				for (let idx = 0; idx < divList.length; idx++) {
					const div = divList[idx];
					bannerSlots.push({ id: div.id, label: div.label, order: idx });
					try {
						await tenantStorage.createDivision({
							name: div.id,
							displayName: div.label,
							description: '',
							positions: [],
							isActive: true,
						});
					} catch {}
				}

				// Create a default organization period + BPH positions
				try {
					const year = new Date().getFullYear();
					const periodStr = `${year}-${year + 1}`;
					await tenantStorage.createPositionsForPeriod(
						periodStr,
						bphList.map((name: string, idx: number) => ({ name, order: idx })),
					);
				} catch (e) {
					console.warn('BPH position seeding error (non-fatal):', e);
				}

				// Auto-create user accounts for BPH/divisions if opted-in
				const createdAccounts: Array<{ username: string; role: string; defaultPassword: boolean }> = [];
				if (autoCreateAccounts && Array.isArray(accountEntries) && accountEntries.length > 0) {
					for (const entry of accountEntries) {
						const uname = (entry.username || '').trim();
						if (!uname) continue;
						const pw = (entry.password || '').trim() || 'admin123';
						const isDefault = !entry.password || !entry.password.trim();
						const email = (entry.email || '').trim() || `${uname.toLowerCase()}@no-email.local`;
						const role = entry.role || 'bph';
						const division = entry.division || '';
						try {
							const existing = await tenantStorage.getUserByUsername(uname);
							if (existing) continue;
							await tenantStorage.createUser({
								username: uname,
								password: pw,
								name: entry.name || uname,
								email,
								role,
								division,
							});
							createdAccounts.push({ username: uname, role, defaultPassword: isDefault });
						} catch (accErr: any) {
							console.warn(`Account creation failed for ${uname}:`, accErr?.message || accErr);
						}
					}
				}

				await tenantStorage.initializeTenantSettings({
					siteName: communityName,
					siteTagline: description || communityName,
					siteDescription: description || communityName,
					navbarBrand: communityName.length > 10 ? communityName.substring(0, 10) : communityName,
					contactEmail: contactEmail || ownerEmail || '',
					address: address || '',
					socialLinks: socialLinks || {},
					homeImageBannerSlots: bannerSlots,
				});

				// Promote temporary onboarding uploads to final tenant path
				{
					const { TempUpload } = await import('../db/mongodb');
					const tempFiles = await TempUpload.find({ code, consumedAt: null }).lean();

					const urlMap = new Map<string, string>();
					for (const tf of tempFiles as any[]) {
						const newUrl = promoteTempFile(tf.diskPath, tf.url, slug, tf.category || 'organization');
						if (newUrl !== tf.url) urlMap.set(tf.url, newUrl);
					}

					if (tempFiles.length > 0) {
						await TempUpload.updateMany(
							{ code, consumedAt: null },
							{ $set: { consumedAt: new Date() } },
						);
					}

					const resolveUrl = (u: string) => urlMap.get(u) || u;

					// Save profile content + logo from onboarding (with defaults when empty)
					const profileUpdate: Record<string, any> = {};

					profileUpdate.aboutUs = onboardAboutUs || `<p>Selamat datang di <strong>${communityName}</strong>.</p><p>Deskripsi profil komunitas belum diisi. Silakan edit di Dashboard &gt; Profil &gt; Tentang Kami.</p>`;

					if (Array.isArray(onboardTrackRecord) && onboardTrackRecord.length > 0) {
						profileUpdate.aboutPageTrackRecord = onboardTrackRecord;
					} else {
						const yr = new Date().getFullYear();
						profileUpdate.aboutPageTrackRecord = [
							{ year: String(yr), chairpersonName: ownerName || ownerUsername, divisions: divList.map(d => d.label) },
						];
					}

					if (Array.isArray(onboardLambang) && onboardLambang.length > 0) {
						profileUpdate.aboutPageLambang = onboardLambang.map((item: any) => ({
							...item,
							imageUrl: item.imageUrl ? resolveUrl(item.imageUrl) : '',
						}));
					} else {
						profileUpdate.aboutPageLambang = [
							{ key: 'contoh', title: 'Elemen Contoh', description: 'Ganti elemen ini dengan filosofi lambang komunitas Anda melalui Dashboard > Profil.', imageUrl: '' },
						];
					}

					const finalLogoUrl = onboardLogoUrl ? resolveUrl(onboardLogoUrl) : '';
					if (finalLogoUrl) profileUpdate.logoUrl = finalLogoUrl;
					await tenantStorage.updateSettings(profileUpdate);

					cleanupTempDir(code);
				}

				// Final validation: owner must exist in tenant DB
				const verifyOwner = await tenantStorage.getUserByUsername(ownerUsername);
				if (!verifyOwner) {
					throw new Error('Owner verification failed after provisioning');
				}
			} catch (provisionError: any) {
				console.error('Tenant provisioning failed, rolling back community:', provisionError);
				try { await mongoStorage.deleteCommunity(communityId); } catch {}
				try {
					const { RegistrationCode: RegCodeModel } = await import('../db/mongodb');
					await RegCodeModel.updateOne(
						{ code },
						{ $set: { status: 'active' }, $unset: { usedBy: 1, usedAt: 1 }, $inc: { currentUses: -1 } },
					);
				} catch {}
				// Cleanup temporary onboarding uploads on rollback
				try {
					const { TempUpload } = await import('../db/mongodb');
					const tempDocs = await TempUpload.find({ code, consumedAt: null }).lean();
					for (const tf of tempDocs as any[]) {
						if (tf.diskPath && fs.existsSync(tf.diskPath)) {
							try { fs.unlinkSync(tf.diskPath); } catch {}
						}
					}
					await TempUpload.deleteMany({ code });
					cleanupTempDir(code);
				} catch (cleanupErr) {
					console.warn('[register] Temp file cleanup on rollback failed:', cleanupErr);
				}
				return res.status(500).json({ message: `Gagal provisioning komunitas: ${provisionError.message}` });
			}

			res.status(201).json({
				message: 'Komunitas berhasil dibuat!',
				community: { name: communityName, slug, _id: communityId },
			});
		} catch (error: any) {
			console.error('Error registering community:', error);
			res.status(500).json({ message: error.message || 'Gagal membuat komunitas' });
		}
	});

	// Admin: repair a broken community (re-provision tenant owner + roles)
	app.post(
		'/api/registration/communities/:id/repair',
		authenticate,
		requirePermission('registration.manage'),
		async (req, res) => {
			try {
				const community: any = await mongoStorage.getCommunityById(req.params.id);
				if (!community) return res.status(404).json({ message: 'Komunitas tidak ditemukan' });

				const { createTenantStorage } = await import('./tenant-storage');
				const { getTenantModels } = await import('../db/tenant');
				const tenantModels = getTenantModels(community.dbName);
				const tenantStorage = createTenantStorage(tenantModels);

				const existingOwner = await tenantStorage.getUserByUsername(community.ownerUsername);
				if (existingOwner) {
					return res.json({ message: 'Komunitas sudah valid, owner ditemukan', repaired: false });
				}

				await tenantStorage.initializeDefaultPermissions();

				const newPassword = req.body.newPassword || 'TempPass123!';
			const ownerUser = await tenantStorage.createUser({
				username: community.ownerUsername,
				password: newPassword,
				name: community.ownerUsername,
				email: (community.ownerEmail || '').trim() || `${community.ownerUsername.toLowerCase()}@no-email.local`,
				role: 'owner',
				division: '',
			});

				await tenantStorage.initializeDefaultRoles(String(ownerUser._id));
				await tenantStorage.initializeDefaultDivisions();

				const existingSettings = await tenantStorage.getSettings();
				if (!existingSettings?.siteName || existingSettings.siteName === '') {
					await tenantStorage.initializeTenantSettings({
						siteName: community.name,
						siteTagline: community.description || community.name,
						siteDescription: community.description || community.name,
						contactEmail: community.contactEmail || community.ownerEmail,
						address: community.address || '',
						socialLinks: community.socialLinks || {},
					});
				}

				res.json({
					message: `Komunitas ${community.slug} berhasil diperbaiki. Owner telah dibuat ulang.`,
					repaired: true,
					ownerUsername: community.ownerUsername,
					tempPassword: newPassword,
				});
			} catch (error: any) {
				console.error('Repair community error:', error);
				res.status(500).json({ message: error.message || 'Gagal memperbaiki komunitas' });
			}
		},
	);

	// Admin: check health of all communities
	app.get(
		'/api/registration/communities/health',
		authenticate,
		requirePermission('registration.manage'),
		async (_req, res) => {
			try {
				const communities = await mongoStorage.getActiveCommunities();
				const { getTenantModels } = await import('../db/tenant');
				const results: any[] = [];

				for (const community of communities as any[]) {
					try {
						const models = getTenantModels(community.dbName);
						const ownerCount = await models.User.countDocuments({ role: 'owner' });
						const rolesCount = await models.Role.countDocuments();
						const permsCount = await models.Permission.countDocuments();
						const settingsDoc = await models.Settings.findOne().lean();
						results.push({
							slug: community.slug,
							name: community.name,
							dbName: community.dbName,
							healthy: ownerCount > 0 && rolesCount > 0 && permsCount > 0,
							ownerCount,
							rolesCount,
							permsCount,
							hasSettings: !!settingsDoc,
						});
					} catch (e: any) {
						results.push({ slug: community.slug, name: community.name, healthy: false, error: e.message });
					}
				}

				res.json(results);
			} catch (error: any) {
				res.status(500).json({ message: error.message });
			}
		},
	);

	const server = createServer(app);
	return server;
}
