/**
 * Helpers for XML sitemap (image/video extensions) and SEO document titles.
 * Used by dynamic /sitemap.xml and SSR meta injection.
 */

export type SitemapImage = {
	loc: string;
	title?: string;
	caption?: string;
};

export type SitemapVideo = {
	thumbnailLoc: string;
	title: string;
	description: string;
	contentLoc?: string;
	playerLoc?: string;
	publicationDate?: string;
};

export type SitemapUrlEntry = {
	loc: string;
	lastmod?: string;
	changefreq?: string;
	priority?: string;
	images?: SitemapImage[];
	videos?: SitemapVideo[];
};

const SITE_HOST = 'https://himatif-encoder.com';

export function absoluteMediaUrl(
	raw?: string | null,
	host: string = SITE_HOST,
): string | null {
	if (!raw || typeof raw !== 'string') return null;
	const v = raw.trim();
	if (!v) return null;
	if (v.startsWith('http://') || v.startsWith('https://')) return v;
	if (v.startsWith('//')) return `https:${v}`;
	return `${host}${v.startsWith('/') ? v : `/${v}`}`;
}

/** Keep <title> ~60 chars (Bing/Google SERP). */
export function seoDocumentTitle(
	pageTitle: string,
	brand = 'Himatif Encoder',
	maxLen = 60,
): string {
	const suffix = ` | ${brand}`;
	const t = String(pageTitle || '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!t) return brand.slice(0, maxLen);
	if (t.length + suffix.length <= maxLen) return `${t}${suffix}`;
	const budget = Math.max(12, maxLen - suffix.length - 1);
	let cut = t.slice(0, budget);
	const sp = cut.lastIndexOf(' ');
	if (sp > 20) cut = cut.slice(0, sp);
	return `${cut}…${suffix}`;
}

export function xmlEscape(s: string): string {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function extractYoutubeId(url: string): string | null {
	const m = String(url || '').match(
		/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
	);
	return m?.[1] || null;
}

export function youtubeThumbnail(videoId: string): string {
	return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Prefer crawlable first-party / https image URLs; skip empty / data: */
export function collectImageUrls(
	candidates: Array<string | null | undefined>,
	host: string = SITE_HOST,
	limit = 10,
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const c of candidates) {
		const abs = absoluteMediaUrl(c, host);
		if (!abs) continue;
		if (abs.startsWith('data:')) continue;
		if (seen.has(abs)) continue;
		seen.add(abs);
		out.push(abs);
		if (out.length >= limit) break;
	}
	return out;
}

export function buildSitemapXml(entries: SitemapUrlEntry[]): string {
	const body = entries
		.map((u) => {
			const lines = [
				'  <url>',
				`    <loc>${xmlEscape(u.loc)}</loc>`,
			];
			if (u.lastmod) lines.push(`    <lastmod>${xmlEscape(u.lastmod)}</lastmod>`);
			if (u.changefreq)
				lines.push(`    <changefreq>${xmlEscape(u.changefreq)}</changefreq>`);
			if (u.priority)
				lines.push(`    <priority>${xmlEscape(u.priority)}</priority>`);
			for (const img of u.images || []) {
				lines.push('    <image:image>');
				lines.push(`      <image:loc>${xmlEscape(img.loc)}</image:loc>`);
				if (img.title)
					lines.push(`      <image:title>${xmlEscape(img.title)}</image:title>`);
				if (img.caption)
					lines.push(
						`      <image:caption>${xmlEscape(img.caption)}</image:caption>`,
					);
				lines.push('    </image:image>');
			}
			for (const vid of u.videos || []) {
				lines.push('    <video:video>');
				lines.push(
					`      <video:thumbnail_loc>${xmlEscape(vid.thumbnailLoc)}</video:thumbnail_loc>`,
				);
				lines.push(`      <video:title>${xmlEscape(vid.title)}</video:title>`);
				lines.push(
					`      <video:description>${xmlEscape(vid.description)}</video:description>`,
				);
				if (vid.contentLoc)
					lines.push(
						`      <video:content_loc>${xmlEscape(vid.contentLoc)}</video:content_loc>`,
					);
				if (vid.playerLoc)
					lines.push(
						`      <video:player_loc>${xmlEscape(vid.playerLoc)}</video:player_loc>`,
					);
				if (vid.publicationDate)
					lines.push(
						`      <video:publication_date>${xmlEscape(vid.publicationDate)}</video:publication_date>`,
					);
				lines.push('    </video:video>');
			}
			lines.push('  </url>');
			return lines.join('\n');
		})
		.join('\n');

	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
		`        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n` +
		`        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
		`${body}\n` +
		`</urlset>`
	);
}

export function libraryVideosFromImages(
	title: string,
	description: string,
	images: string[],
	mediaKinds: string[] | undefined,
	pubDate?: string,
	host: string = SITE_HOST,
): SitemapVideo[] {
	const videos: SitemapVideo[] = [];
	const kinds = Array.isArray(mediaKinds) ? mediaKinds : [];
	for (let i = 0; i < images.length; i++) {
		const raw = images[i];
		const kind = kinds[i] || '';
		const abs = absoluteMediaUrl(raw, host);
		if (!abs) continue;
		const yt = extractYoutubeId(abs);
		const looksVideo =
			kind === 'video' ||
			!!yt ||
			/\.(mp4|webm|mov)(\?|$)/i.test(abs) ||
			/drive\.google\.com|youtube\.com|youtu\.be/i.test(abs);
		if (!looksVideo) continue;
		if (yt) {
			videos.push({
				thumbnailLoc: youtubeThumbnail(yt),
				title: title.slice(0, 100),
				description: (description || title).slice(0, 2048),
				playerLoc: `https://www.youtube.com/embed/${yt}`,
				publicationDate: pubDate,
			});
		} else if (/\.(mp4|webm|mov)(\?|$)/i.test(abs)) {
			const thumb =
				collectImageUrls(images, host, 1)[0] ||
				`${host}/attached_assets/himatif-logo.png`;
			videos.push({
				thumbnailLoc: thumb,
				title: title.slice(0, 100),
				description: (description || title).slice(0, 2048),
				contentLoc: abs,
				publicationDate: pubDate,
			});
		}
		if (videos.length >= 5) break;
	}
	return videos;
}
