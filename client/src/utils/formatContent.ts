/**
 * Format content untuk display di frontend
 * Menangani line breaks dan spasi multiple
 */
export function formatContentForDisplay(content: string): string {
	if (!content) return '';

	// Jika sudah ada HTML tags, langsung return
	if (
		content.includes('<p>') ||
		content.includes('<div>') ||
		content.includes('<br>')
	) {
		return content;
	}

	// Convert plain text ke HTML
	return (
		content
			// Replace multiple spaces dengan &nbsp;
			.replace(/ {2,}/g, (match) => '&nbsp;'.repeat(match.length))
			// Replace line breaks dengan <br>
			.replace(/\n/g, '<br>')
			// Wrap paragraphs
			.split('<br><br>')
			.map((paragraph) => (paragraph.trim() ? `<p>${paragraph}</p>` : ''))
			.filter(Boolean)
			.join('\n')
	);
}

/**
 * Strip HTML tags untuk preview text
 */
export function stripHtmlTags(html: string): string {
	return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
}

/**
 * Truncate content untuk excerpt
 */
export function truncateContent(
	content: string,
	maxLength: number = 150
): string {
	const plainText = stripHtmlTags(content);
	if (plainText.length <= maxLength) return plainText;

	return plainText.substring(0, maxLength).trim() + '...';
}
