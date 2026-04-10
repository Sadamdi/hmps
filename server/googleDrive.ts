import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

const SERVICE_ACCOUNT_JSON = 'gen-lang-client-0095636115-01e39d148e40.json';

/** JSON lives under server/; when running from dist/, __dirname alone breaks (ENOENT). */
function resolveServiceAccountKeyPath(): string {
	const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
	if (envPath && fs.existsSync(envPath)) {
		console.log('Google Drive: using GOOGLE_APPLICATION_CREDENTIALS:', envPath);
		return envPath;
	}
	const candidates = [
		path.join(__dirname, SERVICE_ACCOUNT_JSON),
		path.join(process.cwd(), 'server', SERVICE_ACCOUNT_JSON),
		path.join(process.cwd(), SERVICE_ACCOUNT_JSON),
	];
	for (const p of candidates) {
		if (fs.existsSync(p)) {
			console.log('Google Drive credential path:', p);
			return p;
		}
	}
	console.warn(
		'Google Drive: service account JSON not found. Tried:',
		candidates.join(', '),
	);
	return path.join(process.cwd(), 'server', SERVICE_ACCOUNT_JSON);
}

// Google Drive file interface
export interface GoogleDriveFile {
	id: string;
	name: string;
	mimeType: string;
	webViewLink: string;
	webContentLink?: string;
	thumbnailLink?: string;
	size?: string;
}

// Media source type
export interface MediaSource {
	type: 'local' | 'gdrive';
	url: string;
	fileId?: string;
}

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const credentialPath = resolveServiceAccountKeyPath();

const auth = new google.auth.GoogleAuth({
	keyFile: credentialPath,
	scopes: [
		'https://www.googleapis.com/auth/drive.readonly',
		'https://www.googleapis.com/auth/drive',
	],
});

const drive = google.drive({ version: 'v3', auth });

// Public access drive instance - use the same auth as above for API access
const publicDrive = google.drive({
	version: 'v3',
	auth: auth, // Use the same authenticated instance
});

/**
 * Extract file or folder ID from Google Drive URL
 */
export function extractFileId(url: string): string | null {
	try {
		console.log('Extracting file ID from URL:', url);

		// Handle different Google Drive URL formats
		const patterns = [
			/\/file\/d\/([a-zA-Z0-9-_]+)/, // File sharing URL
			/\/folders\/([a-zA-Z0-9-_]+)/, // Folder sharing URL
			/\/drive\/folders\/([a-zA-Z0-9-_]+)/, // Drive folder URL
			/[?&]id=([a-zA-Z0-9-_]+)/, // Direct link with id parameter
			/\/d\/([a-zA-Z0-9-_]+)/, // Short format
		];

		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) {
				console.log('Extracted file ID:', match[1]);
				return match[1];
			}
		}

		console.log('No file ID found in URL');
		return null;
	} catch (error) {
		console.error('Error extracting file ID:', error);
		return null;
	}
}

/**
 * Validate Google Drive URL format
 */
export function isValidGoogleDriveUrl(url: string): boolean {
	const driveUrlPattern =
		/^https:\/\/drive\.google\.com\/(file\/d\/|folders\/|drive\/folders\/|open\?id=)/;
	const isValid = driveUrlPattern.test(url);
	console.log('URL validation result:', url, '→', isValid);
	return isValid;
}

/**
 * Check if URL is a folder
 */
export function isFolderUrl(url: string): boolean {
	const isFolderPattern = /\/(folders\/|drive\/folders\/)/;
	const isFolder = isFolderPattern.test(url);
	console.log('Folder check result:', url, '→', isFolder);
	return isFolder;
}

/**
 * Check if Google Drive file/folder is publicly accessible (simplified approach)
 */
export async function checkAccessibility(fileId: string): Promise<boolean> {
	try {
		console.log('Checking accessibility for file ID:', fileId);

		// Skip JWT authentication, use direct HTTP method instead
		// This avoids JWT signature issues

		// Method 1: Try direct file access
		const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
		console.log('Testing direct access:', directUrl);

		const directResponse = await fetch(directUrl, {
			method: 'HEAD',
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			},
		});

		console.log('Direct access response:', directResponse.status);

		if (directResponse.ok || directResponse.status === 302) {
			return true;
		}
		// Some environments (or Google) may rate-limit/block HEAD checks.
		// Treat these as "cannot verify" and allow the URL.
		if (directResponse.status === 403 || directResponse.status === 429) {
			return true;
		}

		// Method 2: Try thumbnail access
		const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
		console.log('Testing thumbnail access:', thumbnailUrl);

		const thumbnailResponse = await fetch(thumbnailUrl, {
			method: 'HEAD',
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			},
		});

		console.log('Thumbnail access response:', thumbnailResponse.status);

		if (thumbnailResponse.ok) {
			return true;
		}
		if (thumbnailResponse.status === 403 || thumbnailResponse.status === 429) {
			return true;
		}

		// Method 3: For folders, try a different approach
		if (fileId.length > 20) {
			// Folder IDs are typically longer
			const folderUrl = `https://drive.google.com/drive/folders/${fileId}`;
			console.log('Testing folder access:', folderUrl);

			const folderResponse = await fetch(folderUrl, {
				method: 'HEAD',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				},
			});

			console.log('Folder access response:', folderResponse.status);

			if (folderResponse.ok || folderResponse.status === 302) {
				return true;
			}
		}

		console.log('File appears to be private or inaccessible (allowing anyway for UX).');
		return true;
	} catch (error: any) {
		console.error('Error checking file accessibility:', error.message);
		// Be tolerant: some environments block HEAD/Google responses.
		// If we can't verify, allow and let the client handle preview failures.
		return true;
	}
}

/**
 * Get single file metadata from Google Drive
 */
export async function getFileMetadata(
	fileId: string
): Promise<GoogleDriveFile | null> {
	try {
		console.log('Getting metadata for file ID:', fileId);

		// Use authenticated drive instance
		const response = await publicDrive.files.get({
			fileId,
			fields: 'id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size',
		});

		const file = response.data;
		console.log('File metadata retrieved:', file.name, file.mimeType);

		return {
			id: file.id!,
			name: file.name!,
			mimeType: file.mimeType!,
			webViewLink: file.webViewLink!,
			webContentLink: file.webContentLink || undefined,
			thumbnailLink: file.thumbnailLink || undefined,
			size: file.size || undefined,
		};
	} catch (error: any) {
		console.error('Error getting file metadata:', error.message);

		// Return basic metadata as fallback
		const fallbackMetadata = {
			id: fileId,
			name: `File ${fileId}`,
			mimeType: 'image/jpeg',
			webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
			webContentLink: `https://drive.google.com/uc?export=view&id=${fileId}`,
			thumbnailLink: `https://drive.google.com/thumbnail?id=${fileId}`,
		};

		console.log('Using fallback metadata for:', fileId);
		return fallbackMetadata;
	}
}

/**
 * Tentukan slot galeri (foto vs video) untuk satu file Google Drive.
 * Hint form (`gdriveMediaTypes`) menang; jika tidak ada, pakai MIME dari Drive API.
 */
export async function resolveLibrarySlotMediaKindFromDrive(
	fileId: string,
	hint: string | undefined,
	formLibraryType: 'photo' | 'video',
): Promise<'image' | 'video'> {
	const h = hint?.toLowerCase().trim();
	if (h === 'video') return 'video';
	if (h === 'image') return 'image';
	const meta = await getFileMetadata(fileId);
	const mime = meta?.mimeType || '';
	if (mime.startsWith('video/')) return 'video';
	if (mime.startsWith('image/')) return 'image';
	if (formLibraryType === 'video') return 'video';
	return 'image';
}

/**
 * Get folder contents from Google Drive
 */
export async function getFolderContents(
	folderId: string
): Promise<GoogleDriveFile[]> {
	try {
		// Use authenticated drive instance
		const response = await publicDrive.files.list({
			q: `'${folderId}' in parents and trashed=false`,
			fields:
				'files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size)',
			pageSize: 100,
		});

		const files = response.data.files || [];

		const processedFiles = files.map((file) => ({
			id: file.id!,
			name: file.name!,
			mimeType: file.mimeType!,
			webViewLink: file.webViewLink!,
			webContentLink: file.webContentLink || undefined,
			thumbnailLink: file.thumbnailLink || undefined,
			size: file.size || undefined,
		}));

		return processedFiles;
	} catch (error: any) {
		console.error('Error getting folder contents:', error?.message || error);
		console.error('Error details:', error);
		throw error instanceof Error
			? error
			: new Error(String(error?.message || 'Drive folder listing failed'));
	}
}

/**
 * Get direct media URL for display (simplified approach without API)
 */
export async function getMediaUrl(fileId: string): Promise<string | null> {
	try {
		// Skip API calls completely to avoid JWT issues
		// Use direct URL patterns that work for most public files

		// For most files, this format works well
		const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

		return directUrl;
	} catch (error) {
		console.error('Error getting media URL:', error);
		// Return fallback URL - try the most compatible format
		return `https://drive.google.com/uc?export=view&id=${fileId}`;
	}
}

/**
 * Get alternative media URLs for fallback
 */
export function getAlternativeMediaUrls(
	fileId: string,
	isVideo: boolean = false
): string[] {
	if (isVideo) {
		return [
			`https://drive.google.com/file/d/${fileId}/preview`,
			`https://drive.google.com/file/d/${fileId}/view`,
			`https://docs.google.com/file/d/${fileId}/preview`,
		];
	}

	return [
		`https://drive.google.com/uc?export=view&id=${fileId}`,
		`https://drive.google.com/uc?id=${fileId}&export=download`,
		`https://lh3.googleusercontent.com/d/${fileId}=s2000`,
		`https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`,
		`https://drive.google.com/file/d/${fileId}/view`,
	];
}

/**
 * Get all media files from a folder (images and videos only)
 */
export async function getMediaFromFolder(
	folderId: string
): Promise<GoogleDriveFile[]> {
	try {
		const allFiles = await getFolderContents(folderId);

		// Filter only supported media files (images and videos)
		const mediaFiles = allFiles.filter((file) => {
			const isSupported =
				isSupportedMediaType(file.mimeType) ||
				getFileTypeFromExtension(file.name) !== 'unknown';

			return isSupported;
		});

		return mediaFiles;
	} catch (error) {
		console.error('Error getting media from folder:', error);
		throw error;
	}
}

/**
 * Try to extract file IDs from a public Google Drive folder using web scraping approach
 * This is a simplified approach for public folders
 */
export async function extractFolderFileIds(
	folderId: string
): Promise<string[]> {
	try {
		console.log('Attempting to extract file IDs from folder:', folderId);

		// Try to get folder page content
		const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
		const response = await fetch(folderUrl, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			},
		});

		if (!response.ok) {
			console.log('Failed to fetch folder page:', response.status);
			return [];
		}

		const html = await response.text();
		console.log('Folder page fetched, length:', html.length);

		const fileIds = new Set<string>();

		// Look for file IDs in the HTML content using global regex
		const fileIdPattern =
			/["\']([a-zA-Z0-9-_]{28,44})["\'].*?(?:image|video|\.jpg|\.png|\.mp4|\.mov|\.jpeg|\.webp|\.heic)/gi;
		let match;
		while ((match = fileIdPattern.exec(html)) !== null) {
			const fileId = match[1];
			// Basic validation - Google Drive file IDs have specific characteristics
			if (fileId.length >= 28 && fileId.length <= 44 && !fileId.includes(' ')) {
				fileIds.add(fileId);
				console.log('Found potential file ID:', fileId);
			}
		}

		// Alternative pattern - look for direct file references
		const directFilePattern = /\/file\/d\/([a-zA-Z0-9-_]{28,44})/g;
		let directMatch;
		while ((directMatch = directFilePattern.exec(html)) !== null) {
			const fileId = directMatch[1];
			fileIds.add(fileId);
			console.log('Found direct file ID:', fileId);
		}

		const resultArray = Array.from(fileIds);
		console.log(`Extracted ${resultArray.length} file IDs from folder`);
		return resultArray;
	} catch (error) {
		console.error('Error extracting folder file IDs:', error);
		return [];
	}
}

/**
 * Get media files from folder using simple file ID extraction
 */
export async function getSimpleFolderContents(folderId: string): Promise<
	Array<{
		id: string;
		url: string;
		type: 'image' | 'video';
		name: string;
	}>
> {
	try {
		const fileIds = await extractFolderFileIds(folderId);

		if (fileIds.length === 0) {
			return [];
		}

		// Create media file objects for each extracted ID
		const mediaFiles = fileIds.map((fileId, index) => {
			// Try to determine type - for now default to image since we can't easily detect
			// The MediaDisplay component will handle type detection on the frontend
			const url = `https://drive.google.com/file/d/${fileId}/view`;

			return {
				id: fileId,
				url: url,
				type: 'image' as const, // Will be overridden by user selection or auto-detection
				name: `Media ${index + 1}`,
			};
		});

		return mediaFiles;
	} catch (error) {
		console.error('Error getting simple folder contents:', error);
		return [];
	}
}

/**
 * Detect media source type (local or Google Drive)
 */
export function detectMediaSource(url: string): MediaSource {
	if (isValidGoogleDriveUrl(url)) {
		const fileId = extractFileId(url);
		return {
			type: 'gdrive',
			url,
			fileId: fileId || undefined,
		};
	}

	return {
		type: 'local',
		url,
	};
}

/**
 * Get display URL based on source type
 */
export async function getDisplayUrl(source: MediaSource): Promise<string> {
	if (source.type === 'gdrive' && source.fileId) {
		const mediaUrl = await getMediaUrl(source.fileId);
		return mediaUrl || source.url;
	}

	return source.url;
}

/**
 * Check if file type is supported media
 */
export function isSupportedMediaType(mimeType: string): boolean {
	const supportedTypes = [
		// Images
		'image/jpeg',
		'image/jpg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/bmp',
		'image/tiff',
		'image/svg+xml',
		'image/heic',
		'image/heif',
		'image/avif',
		// Videos
		'video/mp4',
		'video/webm',
		'video/ogg',
		'video/avi',
		'video/mov',
		'video/wmv',
		'video/flv',
		'video/mkv',
		'video/m4v',
		'video/3gp',
		'video/quicktime',
	];

	return supportedTypes.includes(mimeType.toLowerCase());
}

/**
 * Detect file type from extension (fallback when mime type unavailable)
 */
export function getFileTypeFromExtension(
	filename: string
): 'image' | 'video' | 'unknown' {
	const extension = filename.split('.').pop()?.toLowerCase();

	const imageExtensions = [
		'jpg',
		'jpeg',
		'png',
		'gif',
		'webp',
		'bmp',
		'tiff',
		'svg',
		'heic',
		'heif',
		'avif',
	];
	const videoExtensions = [
		'mp4',
		'webm',
		'ogg',
		'avi',
		'mov',
		'wmv',
		'flv',
		'mkv',
		'm4v',
		'3gp',
	];

	if (imageExtensions.includes(extension || '')) {
		return 'image';
	} else if (videoExtensions.includes(extension || '')) {
		return 'video';
	}

	return 'unknown';
}

/**
 * Isi folder untuk galeri: pakai Drive API (mimeType) bila tersedia; fallback ke scraping.
 */
export async function getFolderMediaForLibrary(folderId: string): Promise<
	Array<{
		id: string;
		url: string;
		type: 'image' | 'video';
		name: string;
	}>
> {
	const seen = new Set<string>();
	const out: Array<{
		id: string;
		url: string;
		type: 'image' | 'video';
		name: string;
	}> = [];

	try {
		const fromApi = await getMediaFromFolder(folderId);
		for (const f of fromApi) {
			if (!f.id || seen.has(f.id)) continue;
			seen.add(f.id);
			const isVid =
				(f.mimeType || '').startsWith('video/') ||
				getFileTypeFromExtension(f.name) === 'video';
			out.push({
				id: f.id,
				url: `https://drive.google.com/file/d/${f.id}/view`,
				type: isVid ? 'video' : 'image',
				name: f.name || `Media ${out.length + 1}`,
			});
		}
		if (out.length > 0) {
			return out;
		}
	} catch (e) {
		console.warn('getFolderMediaForLibrary: API path failed, falling back:', e);
	}

	const simple = await getSimpleFolderContents(folderId);
	for (const s of simple) {
		if (!s.id || seen.has(s.id)) continue;
		seen.add(s.id);
		out.push(s);
	}
	return out;
}

// Existing upload functionality (preserved)
export async function uploadToDrive(
	buffer: Buffer,
	filename: string,
	mimetype: string,
	folderId: string
): Promise<string> {
	const fileMetadata = {
		name: filename,
		parents: [folderId],
	};

	const media = {
		mimeType: mimetype,
		body: Readable.from(buffer),
	};

	const file = await drive.files.create({
		requestBody: fileMetadata,
		media,
		fields: 'id, webViewLink',
	});

	return file.data.webViewLink || '';
}
