import DOMPurify from 'dompurify';

/**
 * Sanitasi HTML saat DIRENDER (lapisan kedua setelah sanitizer server). Melindungi konten lama yang sudah
 * tersimpan dan jalur tulis mana pun yang terlewat. Semua `dangerouslySetInnerHTML` untuk konten CMS
 * wajib lewat `safeHtml`.
 */
const FORBIDDEN_TAGS = ['style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'script', 'svg', 'math'];
const BAD_STYLE = /url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:|-moz-binding/i;

let hooked = false;
function ensureHooks() {
	if (hooked) return;
	hooked = true;
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (!(node instanceof Element)) return;
		const style = node.getAttribute('style');
		if (style && BAD_STYLE.test(style)) node.removeAttribute('style');
		if (node.tagName === 'A') {
			if (node.getAttribute('target') === '_blank') node.setAttribute('rel', 'noopener noreferrer');
			else node.removeAttribute('target');
		}
	});
}

export function safeHtml(html: string | null | undefined): string {
	if (!html) return '';
	if (typeof window === 'undefined') return '';
	ensureHooks();
	return DOMPurify.sanitize(String(html), {
		USE_PROFILES: { html: true },
		FORBID_TAGS: FORBIDDEN_TAGS,
		ADD_ATTR: ['target'],
		ALLOW_DATA_ATTR: true,
		ALLOW_ARIA_ATTR: true,
	}) as unknown as string;
}
