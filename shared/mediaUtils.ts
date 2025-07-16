/**
 * Google Drive URL validation patterns
 */
const GDRIVE_URL_PATTERNS = [
	/^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
	/^https:\/\/drive\.google\.com\/folders\/([a-zA-Z0-9-_]+)/,
	/^https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/,
];

/**
 * Extract file ID from Google Drive URL
 */
export function extractGDriveFileId(url: string): string | null {
	for (const pattern of GDRIVE_URL_PATTERNS) {
		const match = url.match(pattern);
		if (match) {
			return match[1];
		}
	}
	return null;
}

/**
 * Check if URL is a valid Google Drive link
 */
export function isGoogleDriveUrl(url: string): boolean {
	return GDRIVE_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Detect media source type from URL
 */
export function detectMediaSource(src: string) {
	// Improved Google Drive detection with better patterns
	const gdrivePatterns = [
		/drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/, // file links
		/drive\.google\.com\/folders\/([a-zA-Z0-9-_]+)/, // folder links
		/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9-_]+)/, // folder with /drive/
		/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9-_]+)/, // export links
	];

	for (const pattern of gdrivePatterns) {
		const match = src.match(pattern);
		if (match) {
			return {
				type: 'gdrive' as const,
				fileId: match[1],
				isFolder: src.includes('/folders/') || src.includes('/drive/folders/'),
			};
		}
	}

	// Local file
	return {
		type: 'local' as const,
		fileId: null,
		isFolder: false,
	};
}

/**
 * Validate Google Drive URL and provide user-friendly error messages
 */
export function validateGoogleDriveUrl(url: string) {
	// Extended pattern to support all Google Drive URL formats
	const driveUrlPattern =
		/^https:\/\/drive\.google\.com\/(file\/d\/|folders\/|drive\/folders\/|open\?id=)/;

	if (!driveUrlPattern.test(url)) {
		return {
			isValid: false,
			error: 'Invalid Google Drive URL format',
			suggestion: 'Please use a valid Google Drive share link (file or folder)',
		};
	}

	// Check for file vs folder
	const isFolderPattern = /\/(folders\/|drive\/folders\/)/;
	const isFolder = isFolderPattern.test(url);

	if (isFolder) {
		// Extract folder ID for validation
		const folderIdMatch = url.match(
			/\/(folders\/|drive\/folders\/)([a-zA-Z0-9-_]+)/
		);
		if (!folderIdMatch || !folderIdMatch[2]) {
			return {
				isValid: false,
				error: 'Could not extract folder ID from URL',
				suggestion:
					'Make sure the folder URL is complete and properly formatted',
			};
		}
	} else {
		// Extract file ID for validation
		const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
		if (!fileIdMatch || !fileIdMatch[1]) {
			return {
				isValid: false,
				error: 'Could not extract file ID from URL',
				suggestion: 'Make sure the file URL is complete and properly formatted',
			};
		}
	}

	return {
		isValid: true,
		isFolder,
		type: isFolder ? 'folder' : 'file',
	};
}

/**
 * Get file type from Google Drive mime type
 */
export function getFileTypeFromMimeType(
	mimeType: string
): 'image' | 'video' | 'other' {
	if (mimeType.startsWith('image/')) {
		return 'image';
	}
	if (mimeType.startsWith('video/')) {
		return 'video';
	}
	return 'other';
}

/**
 * Check if mime type is supported for display
 */
export function isSupportedMediaType(mimeType: string): boolean {
	const supportedTypes = [
		// Images - Extended support
		'image/jpeg',
		'image/jpg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/svg+xml',
		'image/bmp',
		'image/tiff',
		'image/heic',
		'image/heif',
		'image/avif',
		'image/ico',
		'image/x-icon',
		// Videos - Extended support
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
		'video/x-msvideo',
		'video/x-ms-wmv',
	];

	return supportedTypes.includes(mimeType.toLowerCase());
}

/**
 * Get file type from extension (fallback method)
 */
export function getFileTypeFromExtension(
	filename: string
): 'image' | 'video' | 'other' {
	const extension = filename.split('.').pop()?.toLowerCase();

	const imageExtensions = [
		'jpg',
		'jpeg',
		'png',
		'gif',
		'webp',
		'bmp',
		'tiff',
		'tif',
		'svg',
		'heic',
		'heif',
		'avif',
		'ico',
		'jfif',
		'pjpeg',
		'pjp',
	];

	const videoExtensions = [
		'mp4',
		'webm',
		'ogg',
		'ogv',
		'avi',
		'mov',
		'wmv',
		'flv',
		'mkv',
		'm4v',
		'3gp',
		'3g2',
		'qt',
		'asf',
		'rm',
		'rmvb',
		'vob',
		'ts',
	];

	if (imageExtensions.includes(extension || '')) {
		return 'image';
	} else if (videoExtensions.includes(extension || '')) {
		return 'video';
	}

	return 'other';
}

export function getMediaType(src: string): 'image' | 'video' | 'unknown' {
	const extension = src.split('.').pop()?.toLowerCase();

	// Extended image formats including iPhone photos
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
		'ico',
		'jfif',
	];

	// Extended video formats
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
		'qt',
		'asf',
		'rm',
		'rmvb',
	];

	if (extension && imageExtensions.includes(extension)) {
		return 'image';
	}

	if (extension && videoExtensions.includes(extension)) {
		return 'video';
	}

	return 'unknown';
}
