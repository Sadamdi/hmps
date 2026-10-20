/**
 * Sanitizer HTML untuk konten CMS (berita, event, profil, produk, dll.) berbasis DAFTAR PUTIH (`sanitize-html`).
 *
 * Daftar tag/atribut disusun dari inventaris konten produksi (10.7 ribu dokumen): formatting dasar, tabel,
 * gambar, tautan, dan atribut `data-*` hasil salin-tempel (editor, Elementor, asisten AI). Semua yang
 * lain dibuang: script, iframe/object/embed, form/input/button, svg/math, atribut `on*`, `id`/`name`
 * (mencegah DOM clobbering), URL `javascript:`/`data:` selain gambar, dan CSS dengan `url()`/`expression`.
 *
 * Teks biasa (tanpa tag) dikembalikan apa adanya agar tidak ter-escape ganda.
 */
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
	'p', 'br', 'hr', 'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav', 'center',
	'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins', 'sub', 'sup', 'small', 'big', 'mark', 'code', 'pre',
	'kbd', 'samp', 'var', 'blockquote', 'q', 'cite', 'abbr', 'acronym', 'address', 'time', 'bdi', 'bdo', 'wbr',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'ul', 'ol', 'li', 'dl', 'dt', 'dd',
	'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
	'a', 'img', 'figure', 'figcaption', 'picture', 'source',
	'details', 'summary', 'video', 'audio', 'track',
];

const GLOBAL_ATTRS = ['class', 'style', 'dir', 'lang', 'title', 'align', 'data-*', 'aria-*', 'role'];

const NUM_UNIT = /^-?\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh|pt|ch)?$/i;
const AUTO_OR_NUM = /^(?:auto|inherit|initial|-?\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh|pt|ch)?)(?:\s+(?:auto|-?\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh|pt|ch)?)){0,3}$/i;
const COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*[\d.]+\s*)?\)|hsla?\([\d\s.,%]+\)|[a-z]{3,20}|transparent|inherit|currentcolor)$/i;
const KEYWORD = /^[a-z-]{1,30}$/i;
const FONT_FAMILY = /^[\w\s,"'-]{1,120}$/;
const BORDER = /^[\w\s#.,%()-]{1,80}$/;

const ALLOWED_STYLES: Record<string, RegExp[]> = {
	width: [AUTO_OR_NUM], height: [AUTO_OR_NUM], 'max-width': [AUTO_OR_NUM], 'min-width': [AUTO_OR_NUM],
	'max-height': [AUTO_OR_NUM], 'min-height': [AUTO_OR_NUM],
	margin: [AUTO_OR_NUM], 'margin-left': [AUTO_OR_NUM], 'margin-right': [AUTO_OR_NUM], 'margin-top': [AUTO_OR_NUM], 'margin-bottom': [AUTO_OR_NUM],
	padding: [AUTO_OR_NUM], 'padding-left': [AUTO_OR_NUM], 'padding-right': [AUTO_OR_NUM], 'padding-top': [AUTO_OR_NUM], 'padding-bottom': [AUTO_OR_NUM],
	display: [/^(?:block|inline|inline-block|flex|inline-flex|grid|table|table-cell|table-row|none|list-item)$/i],
	'text-align': [/^(?:left|right|center|justify|start|end)$/i],
	'vertical-align': [KEYWORD, NUM_UNIT],
	float: [/^(?:left|right|none)$/i],
	clear: [/^(?:left|right|both|none)$/i],
	'font-size': [NUM_UNIT, KEYWORD], 'font-weight': [/^(?:normal|bold|bolder|lighter|[1-9]00)$/i], 'font-style': [/^(?:normal|italic|oblique)$/i],
	'font-family': [FONT_FAMILY], 'line-height': [NUM_UNIT, /^normal$/i], 'letter-spacing': [NUM_UNIT, /^normal$/i],
	'text-decoration': [KEYWORD], 'text-indent': [NUM_UNIT], 'text-transform': [KEYWORD], 'white-space': [KEYWORD],
	color: [COLOR], 'background-color': [COLOR],
	border: [BORDER], 'border-top': [BORDER], 'border-bottom': [BORDER], 'border-left': [BORDER], 'border-right': [BORDER],
	'border-collapse': [/^(?:collapse|separate)$/i], 'border-spacing': [AUTO_OR_NUM], 'border-radius': [AUTO_OR_NUM], 'border-color': [COLOR], 'border-style': [KEYWORD], 'border-width': [AUTO_OR_NUM],
	'list-style-type': [KEYWORD], 'object-fit': [KEYWORD], 'aspect-ratio': [/^[\d./\s]+$/],
	'overflow-x': [KEYWORD], 'overflow-y': [KEYWORD], overflow: [KEYWORD],
	'flex-basis': [AUTO_OR_NUM], 'content-visibility': [KEYWORD],
	'scroll-snap-type': [/^[\w\s-]{1,30}$/], 'scroll-snap-align': [KEYWORD],
};

const TRUTHY_BOOL_ATTRS = ['open', 'controls', 'loop', 'muted', 'playsinline'];

const OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: ALLOWED_TAGS,
	allowedAttributes: {
		'*': GLOBAL_ATTRS,
		a: ['href', 'target', 'rel', 'download', 'hreflang'],
		img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding', 'fetchpriority', 'usemap'],
		source: ['src', 'srcset', 'sizes', 'type', 'media'],
		video: ['src', 'poster', 'width', 'height', 'preload', ...TRUTHY_BOOL_ATTRS],
		audio: ['src', 'preload', ...TRUTHY_BOOL_ATTRS],
		track: ['src', 'kind', 'srclang', 'label', 'default'],
		td: ['colspan', 'rowspan', 'headers', 'width', 'height', 'valign', 'nowrap'],
		th: ['colspan', 'rowspan', 'headers', 'scope', 'width', 'height', 'valign', 'nowrap'],
		tr: ['valign'],
		table: ['border', 'cellpadding', 'cellspacing', 'width', 'summary'],
		col: ['span', 'width'], colgroup: ['span', 'width'],
		ol: ['start', 'type', 'reversed'], ul: ['type'], li: ['value'],
		blockquote: ['cite'], q: ['cite'], time: ['datetime'], details: ['open'], abbr: ['title'],
	},
	allowedStyles: { '*': ALLOWED_STYLES },
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	allowedSchemesByTag: { img: ['http', 'https', 'data'], source: ['http', 'https'], video: ['http', 'https'], audio: ['http', 'https'], track: ['http', 'https'] },
	allowedSchemesAppliedToAttributes: ['href', 'src', 'cite', 'poster'],
	allowProtocolRelative: false,
	disallowedTagsMode: 'discard',
	nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template', 'iframe', 'object', 'embed', 'applet', 'svg', 'math'],
	transformTags: {
		a: (tagName, attribs) => {
			const out = { ...attribs };
			if (out.target === '_blank') out.rel = 'noopener noreferrer';
			else delete out.target;
			return { tagName, attribs: out };
		},
		img: (tagName, attribs) => {
			// data: hanya untuk gambar raster; svg+xml di data URL tidak boleh.
			if (attribs.src && /^data:/i.test(attribs.src) && !/^data:image\/(?:png|jpe?g|gif|webp|avif);/i.test(attribs.src)) {
				const { src: _drop, ...rest } = attribs;
				return { tagName, attribs: rest };
			}
			return { tagName, attribs };
		},
	},
};

const LOOKS_LIKE_HTML = /<\s*[a-zA-Z!/]/;

/** Sanitasi HTML CMS. Teks tanpa tag dikembalikan apa adanya. */
export function sanitizeCmsHtml(html: string, maxLen = 500_000): string {
	if (!html || typeof html !== 'string') return '';
	const input = html.length > maxLen ? html.slice(0, maxLen) : html;
	if (!LOOKS_LIKE_HTML.test(input)) return input;
	return sanitizeHtml(input, OPTIONS);
}
