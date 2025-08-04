// Utility functions for the application

/**
 * Generate SEO-friendly slug from title
 * @param title - The article title
 * @returns SEO-friendly slug
 */
export function generateSlug(title: string): string {
	return (
		title
			.toLowerCase()
			.trim()
			// Replace special characters with hyphens
			.replace(/[^\w\s-]/g, '')
			// Replace spaces and underscores with hyphens
			.replace(/[\s_]+/g, '-')
			// Remove multiple consecutive hyphens
			.replace(/-+/g, '-')
			// Remove leading and trailing hyphens
			.replace(/^-+|-+$/g, '')
			// Limit length to 60 characters
			.substring(0, 60)
	);
}

/**
 * Generate unique slug by appending number if duplicate exists
 * @param title - The article title
 * @param existingSlugs - Array of existing slugs
 * @returns Unique slug
 */
export function generateUniqueSlug(
	title: string,
	existingSlugs: string[]
): string {
	let slug = generateSlug(title);
	let counter = 1;
	let uniqueSlug = slug;

	while (existingSlugs.includes(uniqueSlug)) {
		uniqueSlug = `${slug}-${counter}`;
		counter++;
	}

	return uniqueSlug;
}

/**
 * Format date to Indonesian locale
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateToIndonesian(date: Date | string): string {
	const dateObj = typeof date === 'string' ? new Date(date) : date;
	return dateObj.toLocaleDateString('id-ID', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

/**
 * Estimate reading time for content
 * @param content - Article content
 * @returns Reading time in minutes
 */
export function estimateReadingTime(content: string): number {
	const wordsPerMinute = 200;
	const textContent = content.replace(/<[^>]*>/g, '');
	const wordCount = textContent.split(/\s+/).length;
	return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Extract meta description from content
 * @param content - Article content
 * @param maxLength - Maximum length (default: 160)
 * @returns Meta description
 */
export function extractMetaDescription(
	content: string,
	maxLength: number = 160
): string {
	const textContent = content.replace(/<[^>]*>/g, '');
	const words = textContent.split(/\s+/);
	let description = '';

	for (const word of words) {
		if ((description + ' ' + word).length <= maxLength) {
			description += (description ? ' ' : '') + word;
		} else {
			break;
		}
	}

	return description.trim() + (description.length === maxLength ? '...' : '');
}
