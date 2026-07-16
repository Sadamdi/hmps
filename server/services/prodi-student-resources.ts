import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import {
	DEFAULT_PKL_HUB,
	DEFAULT_SKRIPSI_HUB,
	DEFAULT_STUDENT_GUIDES,
	DEFAULT_STUDENT_PORTALS,
	buildDefaultStudentHub,
} from '../../shared/prodi-student-hub';
import { uploadDir } from '../upload';

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SIAKAD = 'https://siakad.uin-malang.ac.id/index.php';
const TI_PENGUMUMAN_FEED = 'https://informatika.uin-malang.ac.id/category/pengumuman/feed/';
const UIN_PENGUMUMAN_FEED = 'https://uin-malang.ac.id/blog/pengumuman-3/feed';
const TI_SKRIPSI = 'https://informatika.uin-malang.ac.id/thesis-skripsi-s1/';
const TI_PKL = 'https://informatika.uin-malang.ac.id/internship-pkl/';

const UPLOADS_CALENDAR = path.join(uploadDir, 'prodi', 'calendar');

/** Curated university-wide calendar PDF mirrors (audited). Key = start year. */
const CURATED_CALENDAR_PDFS: Record<number, { academicYear: string; url: string; sourceKind: string }> = {
	2022: {
		academicYear: '2022/2023',
		url: 'https://pips.uin-malang.ac.id/wp-content/uploads/2025/08/Kalender-Akademik-2022-2023-ok.pdf',
		sourceKind: 'faculty_mirror',
	},
	2023: {
		academicYear: '2023/2024',
		url: 'https://mpi.uin-malang.ac.id/wp-content/uploads/2025/08/Kalender-Akademik-2023-2024.pdf',
		sourceKind: 'faculty_mirror',
	},
	2024: {
		academicYear: '2024/2025',
		url: 'https://pips.uin-malang.ac.id/wp-content/uploads/2025/08/Kalender-Akademik-2024-2025.pdf',
		sourceKind: 'faculty_mirror',
	},
	2025: {
		academicYear: '2025/2026',
		url: 'https://old.uin-malang.ac.id/+/c/1.4.25.9563?r=Kalender+Akademik+2025+-+2026',
		sourceKind: 'official_mirror',
	},
};

export type AcademicCalendarEntry = {
	academicYear: string;
	title: string;
	announcementUrl?: string;
	sourcePdfUrl: string;
	pdfUrl: string;
	highlights: string[];
	rectorDecision?: string;
	sourceKind: string;
	syncedAt: string;
};

export type AnnouncementCategory = 'thesis' | 'wisuda' | 'ukt' | 'kalender' | 'lainnya';

export type StudentAnnouncement = {
	title: string;
	url: string;
	source: string;
	publishedAt: string;
	category: AnnouncementCategory;
	excerpt?: string;
};

export type StudentHubSyncResult = {
	ok: boolean;
	error?: string;
	calendarYears: number[];
	calendarSkipped: number[];
	announcementCount: number;
	skripsiOk: boolean;
	pklTemplates: number;
};

async function fetchText(url: string, timeoutMs = 45_000): Promise<string> {
	const res = await fetch(url, {
		headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml,*/*' },
		signal: AbortSignal.timeout(timeoutMs),
		redirect: 'follow',
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return res.text();
}

function absUrl(href: string, base: string): string {
	try {
		return new URL(href, base).toString();
	} catch {
		return href;
	}
}

function ensureCalendarDir() {
	if (!fs.existsSync(UPLOADS_CALENDAR)) fs.mkdirSync(UPLOADS_CALENDAR, { recursive: true });
}

function calendarDiskPathFromUrl(pdfUrl: string): string | null {
	if (!pdfUrl?.startsWith('/uploads/')) return null;
	const rel = pdfUrl.replace(/^\/uploads\//, '').replace(/\.\./g, '');
	return path.join(uploadDir, rel);
}

export function localCalendarFileExists(pdfUrl?: string): boolean {
	if (!pdfUrl) return false;
	const disk = calendarDiskPathFromUrl(pdfUrl);
	return !!(disk && fs.existsSync(disk) && fs.statSync(disk).size > 10_000);
}

async function downloadPdfToLocal(remoteUrl: string, yearStart: number, yearEnd: number): Promise<string | null> {
	ensureCalendarDir();
	const res = await fetch(remoteUrl, {
		headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
		signal: AbortSignal.timeout(60_000),
		redirect: 'follow',
	});
	if (!res.ok) return null;
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length < 10_000) return null;
	const head = buf.subarray(0, 5).toString('utf8');
	const ct = (res.headers.get('content-type') || '').toLowerCase();
	if (!head.startsWith('%PDF') && !ct.includes('pdf')) return null;
	const filename = `kalender-${yearStart}-${yearEnd}.pdf`;
	const disk = path.join(UPLOADS_CALENDAR, filename);
	fs.writeFileSync(disk, buf);
	return `/uploads/prodi/calendar/${filename}`;
}

function parseYearFromAcademicLabel(text: string): { start: number; end: number; label: string } | null {
	const m = text.match(/(20\d{2})\s*[\/\-]\s*(20\d{2})/);
	if (!m) return null;
	return { start: Number(m[1]), end: Number(m[2]), label: `${m[1]}/${m[2]}` };
}

async function discoverFromSiakad(): Promise<{
	announcementUrl?: string;
	highlights: string[];
	academicYearLabel?: string;
}> {
	const html = await fetchText(SIAKAD);
	const $ = cheerio.load(html);
	const highlights: string[] = [];
	let announcementUrl: string | undefined;
	let academicYearLabel: string | undefined;
	$('a[href]').each((_, el) => {
		const text = $(el).text().replace(/\s+/g, ' ').trim();
		const href = ($(el).attr('href') || '').replace(/&amp;/g, '&');
		if (/kalender akademik/i.test(text)) {
			if (href && !announcementUrl) {
				announcementUrl = absUrl(href, SIAKAD);
				academicYearLabel = text;
			}
		}
		if (/wisuda|herregistrasi|ukt|yudisium|semester/i.test(text) && text.length < 120) {
			highlights.push(text);
		}
	});
	return { announcementUrl, highlights: highlights.slice(0, 12), academicYearLabel };
}

async function discoverAnnouncementUrls(): Promise<{ url: string; label: string }[]> {
	const html = await fetchText('https://uin-malang.ac.id/blog/pengumuman-3');
	const $ = cheerio.load(html);
	const out: { url: string; label: string }[] = [];
	$('a[href]').each((_, el) => {
		const text = $(el).text().replace(/\s+/g, ' ').trim();
		const href = absUrl(($(el).attr('href') || '').replace(/&amp;/g, '&'), 'https://uin-malang.ac.id/');
		if (/kalender akademik/i.test(text) && /pengumuman/i.test(href)) {
			out.push({ url: href, label: text });
		}
	});
	return out.slice(0, 8);
}

async function extractPdfFromAnnouncement(announcementUrl: string): Promise<{
	pdfUrl?: string;
	title: string;
	rectorDecision?: string;
}> {
	const html = await fetchText(announcementUrl);
	const $ = cheerio.load(html);
	const title = $('h1, .entry-title, title').first().text().replace(/\s+/g, ' ').trim() || 'Kalender Akademik';
	let pdfUrl: string | undefined;
	let rectorDecision: string | undefined;
	$('a[href]').each((_, el) => {
		const href = absUrl(($(el).attr('href') || '').replace(/&amp;/g, '&'), announcementUrl);
		const text = $(el).text().replace(/\s+/g, ' ').trim();
		if (!pdfUrl && (/kalender/i.test(text) || /\.pdf/i.test(href) || /download/i.test(text))) {
			if (/\.pdf|content\/\d+|old\.uin-malang|drive\.google/i.test(href)) pdfUrl = href;
		}
	});
	const body = $('article, .entry-content, main').first().text().replace(/\s+/g, ' ').trim();
	const m = body.match(/Keputusan\s+Rektor[^.…]{0,120}/i) || body.match(/Nomor\s*[:.]?\s*\d+[^.…]{0,80}/i);
	if (m) rectorDecision = m[0].slice(0, 200);
	return { pdfUrl, title, rectorDecision };
}

async function upsertCalendarEntry(
	map: Record<string, AcademicCalendarEntry>,
	opts: {
		start: number;
		end: number;
		label: string;
		title: string;
		sourcePdfUrl: string;
		announcementUrl?: string;
		highlights?: string[];
		rectorDecision?: string;
		sourceKind: string;
	},
): Promise<boolean> {
	const key = String(opts.start);
	const existing = map[key];
	if (existing?.pdfUrl && localCalendarFileExists(existing.pdfUrl) && existing.sourcePdfUrl === opts.sourcePdfUrl) {
		return true;
	}
	const local = await downloadPdfToLocal(opts.sourcePdfUrl, opts.start, opts.end);
	if (!local) {
		// Keep metadata with source URL so UI can fall back to remote download
		if (opts.sourcePdfUrl) {
			map[key] = {
				academicYear: opts.label,
				title: opts.title,
				announcementUrl: opts.announcementUrl,
				sourcePdfUrl: opts.sourcePdfUrl,
				pdfUrl: existing?.pdfUrl && localCalendarFileExists(existing.pdfUrl) ? existing.pdfUrl : '',
				highlights: opts.highlights || existing?.highlights || [],
				rectorDecision: opts.rectorDecision || existing?.rectorDecision,
				sourceKind: opts.sourceKind,
				syncedAt: new Date().toISOString(),
			};
		}
		return false;
	}
	map[key] = {
		academicYear: opts.label,
		title: opts.title,
		announcementUrl: opts.announcementUrl,
		sourcePdfUrl: opts.sourcePdfUrl,
		pdfUrl: local,
		highlights: opts.highlights || [],
		rectorDecision: opts.rectorDecision,
		sourceKind: opts.sourceKind,
		syncedAt: new Date().toISOString(),
	};
	return true;
}

async function repairMissingLocalPdfs(map: Record<string, AcademicCalendarEntry>): Promise<number[]> {
	const repaired: number[] = [];
	for (const [key, entry] of Object.entries(map)) {
		if (entry?.pdfUrl && localCalendarFileExists(entry.pdfUrl)) continue;
		let sourcePdfUrl = entry?.sourcePdfUrl || '';
		let title = entry?.title;
		let rectorDecision = entry?.rectorDecision;
		if (entry?.announcementUrl) {
			try {
				const meta = await extractPdfFromAnnouncement(entry.announcementUrl);
				if (meta.pdfUrl) sourcePdfUrl = meta.pdfUrl;
				if (meta.title) title = meta.title;
				if (meta.rectorDecision) rectorDecision = meta.rectorDecision;
			} catch (err) {
				console.warn('Refresh calendar PDF from announcement failed:', entry.announcementUrl, err);
			}
		}
		if (!sourcePdfUrl) continue;
		const years = parseYearFromAcademicLabel(entry.academicYear) || {
			start: Number(key),
			end: Number(key) + 1,
			label: entry.academicYear,
		};
		const ok = await upsertCalendarEntry(map, {
			start: years.start,
			end: years.end,
			label: years.label,
			title: title || entry.title,
			sourcePdfUrl,
			announcementUrl: entry.announcementUrl,
			highlights: entry.highlights,
			rectorDecision,
			sourceKind: entry.sourceKind || 'repair',
		});
		if (ok) repaired.push(years.start);
	}
	return repaired;
}

export async function syncAcademicCalendars(
	existing: Record<string, AcademicCalendarEntry> = {},
): Promise<{ map: Record<string, AcademicCalendarEntry>; found: number[]; skipped: number[] }> {
	const map: Record<string, AcademicCalendarEntry> = { ...existing };
	const found: number[] = [];
	const attempted = new Set<number>();

	try {
		found.push(...(await repairMissingLocalPdfs(map)));
	} catch (err) {
		console.warn('Calendar repair pass failed:', err);
	}

	let highlights: string[] = [];
	try {
		const siakad = await discoverFromSiakad();
		highlights = siakad.highlights;
		if (siakad.announcementUrl) {
			const years = parseYearFromAcademicLabel(siakad.academicYearLabel || siakad.announcementUrl);
			const meta = await extractPdfFromAnnouncement(siakad.announcementUrl);
			if (meta.pdfUrl && years) {
				attempted.add(years.start);
				const ok = await upsertCalendarEntry(map, {
					start: years.start,
					end: years.end,
					label: years.label,
					title: meta.title,
					sourcePdfUrl: meta.pdfUrl,
					announcementUrl: siakad.announcementUrl,
					highlights,
					rectorDecision: meta.rectorDecision,
					sourceKind: 'official',
				});
				if (ok) found.push(years.start);
			}
		}
	} catch (err) {
		console.warn('SIAKAD calendar discovery failed:', err);
	}

	try {
		const anns = await discoverAnnouncementUrls();
		for (const ann of anns) {
			const years = parseYearFromAcademicLabel(ann.label + ' ' + ann.url);
			if (!years || attempted.has(years.start)) continue;
			attempted.add(years.start);
			try {
				const meta = await extractPdfFromAnnouncement(ann.url);
				if (!meta.pdfUrl) continue;
				const ok = await upsertCalendarEntry(map, {
					start: years.start,
					end: years.end,
					label: years.label,
					title: meta.title,
					sourcePdfUrl: meta.pdfUrl,
					announcementUrl: ann.url,
					highlights: years.start === Math.max(...(found.length ? found : [0])) ? highlights : [],
					rectorDecision: meta.rectorDecision,
					sourceKind: 'official',
				});
				if (ok) found.push(years.start);
			} catch (err) {
				console.warn('Announcement calendar failed:', ann.url, err);
			}
		}
	} catch (err) {
		console.warn('Announcement list failed:', err);
	}

	for (const [yearStr, curated] of Object.entries(CURATED_CALENDAR_PDFS)) {
		const start = Number(yearStr);
		if (map[String(start)]?.pdfUrl && localCalendarFileExists(map[String(start)].pdfUrl)) continue;
		attempted.add(start);
		const end = start + 1;
		try {
			const ok = await upsertCalendarEntry(map, {
				start,
				end,
				label: curated.academicYear,
				title: `Kalender Akademik ${curated.academicYear}`,
				sourcePdfUrl: curated.url,
				sourceKind: curated.sourceKind,
				highlights: [],
			});
			if (ok) found.push(start);
		} catch (err) {
			console.warn('Curated calendar failed:', start, err);
		}
	}

	const skipped: number[] = [];
	for (let y = 2000; y <= 2026; y++) {
		if (!map[String(y)]) skipped.push(y);
	}

	return { map, found: Array.from(new Set(found)).sort((a, b) => a - b), skipped };
}

function categorizeAnnouncement(title: string): AnnouncementCategory {
	if (/thesis|skripsi|seminar|sidang|kompre|periodization|ujian/i.test(title)) return 'thesis';
	if (/wisuda/i.test(title)) return 'wisuda';
	if (/ukt|uang kuliah|herregistrasi|bebas tanggungan/i.test(title)) return 'ukt';
	if (/kalender akademik/i.test(title)) return 'kalender';
	return 'lainnya';
}

function parseRssItems(xml: string, source: 'ti' | 'uin'): StudentAnnouncement[] {
	const $ = cheerio.load(xml, { xmlMode: true });
	const items: StudentAnnouncement[] = [];
	$('item, entry').each((_, el) => {
		const title = $(el).find('title').first().text().replace(/\s+/g, ' ').trim();
		let url =
			$(el).find('link').first().attr('href') ||
			$(el).find('link').first().text() ||
			$(el).find('guid').first().text() ||
			'';
		url = url.trim();
		const publishedAt =
			$(el).find('pubDate, published, updated').first().text().trim() || new Date().toISOString();
		const excerpt = $(el)
			.find('description, summary, content')
			.first()
			.text()
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 280);
		if (title && url) {
			items.push({
				title,
				url,
				source,
				publishedAt,
				category: categorizeAnnouncement(title),
				excerpt: excerpt || undefined,
			});
		}
	});
	return items;
}

const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = [
	'thesis',
	'wisuda',
	'ukt',
	'kalender',
	'lainnya',
];
/** Max items kept per category filter (UI also caps at this). */
export const ANNOUNCEMENT_MAX_PER_CATEGORY = 50;

function filterAnnouncements(items: StudentAnnouncement[]): StudentAnnouncement[] {
	const tiRe = /thesis|periodization|seminar|skripsi|sidang|kompre|ujian|pkl|internship/i;
	const uinRe = /wisuda|kalender akademik|ukt|uang kuliah|herregistrasi|yudisium/i;
	const relevant = items
		.filter((i) =>
			i.source === 'ti' ? tiRe.test(i.title) : uinRe.test(i.title) || i.category !== 'lainnya',
		)
		.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

	const buckets = new Map<AnnouncementCategory, StudentAnnouncement[]>();
	for (const cat of ANNOUNCEMENT_CATEGORIES) buckets.set(cat, []);
	for (const item of relevant) {
		const cat = item.category || 'lainnya';
		const bucket = buckets.get(cat)!;
		if (bucket.length < ANNOUNCEMENT_MAX_PER_CATEGORY) bucket.push(item);
	}
	return ANNOUNCEMENT_CATEGORIES.flatMap((cat) => buckets.get(cat) || []);
}

const JUNK_SECTION_RE =
	/miu\s*login|siam\s*login|powered\s*by|theme\s*version|ptipd|^\s*organization\s*$|^\s*profile\s*$|lecturer and staff|^\s*dokumen\s*$|^\s*en_?us\s*$|^\s*id\s*$|^\s*ar\s*$|^\s*zh\s*$/i;

function isJunkSectionHeading(heading: string): boolean {
	return JUNK_SECTION_RE.test(heading.trim());
}

function isJunkLinkLabel(label: string): boolean {
	const t = label.replace(/\s+/g, ' ').trim();
	if (!t || t.length < 2) return true;
	if (JUNK_SECTION_RE.test(t)) return true;
	if (/^(home|beranda|menu|search|cari|login|logout|register)$/i.test(t)) return true;
	return false;
}

/** Drop theme/nav junk from already-stored hub payloads (public + after sync). */
export function sanitizeHubResource(hub: any): any {
	if (!hub || typeof hub !== 'object') return hub;
	const next = { ...hub };
	if (Array.isArray(next.sections)) {
		next.sections = next.sections.filter(
			(s: any) => s?.heading && !isJunkSectionHeading(String(s.heading)),
		);
	}
	if (Array.isArray(next.actionLinks)) {
		next.actionLinks = next.actionLinks.filter(
			(l: any) => l?.url && l?.label && !isJunkLinkLabel(String(l.label)),
		);
	}
	if (Array.isArray(next.documents)) {
		next.documents = next.documents.filter(
			(d: any) => d?.url && d?.name && !isJunkLinkLabel(String(d.name)),
		);
	}
	if (Array.isArray(next.templates)) {
		next.templates = next.templates
			.filter((t: any) => t?.url && t?.name)
			.map((t: any) => ({
				...t,
				name: String(t.name)
					.replace(/\s*\[DOWNLOAD HERE\]\s*/gi, '')
					.replace(/\s*:\s*$/, '')
					.trim() || 'Dokumen PKL',
			}));
	}
	return next;
}

export async function syncAnnouncementsFeed(): Promise<StudentAnnouncement[]> {
	const all: StudentAnnouncement[] = [];
	try {
		const tiXml = await fetchText(TI_PENGUMUMAN_FEED);
		all.push(...parseRssItems(tiXml, 'ti'));
	} catch (err) {
		console.warn('TI RSS failed:', err);
	}
	try {
		const uinXml = await fetchText(UIN_PENGUMUMAN_FEED);
		all.push(...parseRssItems(uinXml, 'uin'));
	} catch (err) {
		console.warn('UIN Atom failed:', err);
	}
	return filterAnnouncements(all);
}

function extractPageSections($: cheerio.CheerioAPI, base: string) {
	const $scope = $('main, article, .entry-content, .site-main, #content, .post-content').first();
	const heads = ($scope.length ? $scope : $.root()).find('h2, h3');

	const sections: { heading: string; body: string; links: { label: string; url: string }[] }[] = [];
	heads.each((_, el) => {
		const heading = $(el).text().replace(/\s+/g, ' ').trim();
		if (!heading || heading.length > 120 || isJunkSectionHeading(heading)) return;
		const bodyParts: string[] = [];
		const links: { label: string; url: string }[] = [];
		let node = $(el).next();
		let guard = 0;
		while (node.length && !node.is('h2, h3') && guard < 12) {
			const text = node.text().replace(/\s+/g, ' ').trim();
			if (text && text.length < 500 && !isJunkSectionHeading(text.slice(0, 80))) {
				bodyParts.push(text);
			}
			node.find('a[href]').addBack('a[href]').each((__, a) => {
				const label = $(a).text().replace(/\s+/g, ' ').trim() || 'Tautan';
				if (isJunkLinkLabel(label)) return;
				const url = absUrl(($(a).attr('href') || '').replace(/&amp;/g, '&'), base);
				if (url && !links.some((l) => l.url === url)) links.push({ label: label.slice(0, 100), url });
			});
			node = node.next();
			guard++;
		}
		if (!bodyParts.length && !links.length) return;
		sections.push({
			heading,
			body: bodyParts.join(' ').slice(0, 600),
			links: links.slice(0, 10),
		});
	});
	return sections.slice(0, 12);
}

export async function syncSkripsiHub(existing?: any) {
	const hub: any = { ...DEFAULT_SKRIPSI_HUB, ...(existing || {}) };
	try {
		const html = await fetchText(TI_SKRIPSI);
		const $ = cheerio.load(html);
		const docs: { name: string; url: string }[] = [];
		const links: { label: string; url: string }[] = [];
		$('a[href]').each((_, el) => {
			const label = $(el).text().replace(/\s+/g, ' ').trim() || 'Dokumen';
			if (isJunkLinkLabel(label)) return;
			if (
				/organization|lecturer|laborator|curriculum|collaboration|management|undergraduate|graduate|profile|roadmap|publication|regulation|scopus|startup|start-up|software|apps|mbkm|mikrotik|product pkl|intellectual/i.test(
					label,
				)
			) {
				return;
			}
			const href = absUrl(($(el).attr('href') || '').replace(/&amp;/g, '&'), TI_SKRIPSI);
			if (!href || href === TI_SKRIPSI || href.startsWith(`${TI_SKRIPSI}#`)) return;
			if (/drive\.google\.com|docs\.google\.com|\.pdf(\?|$)/i.test(href)) {
				if (!docs.some((d) => d.url === href)) docs.push({ name: label.slice(0, 100), url: href });
			} else if (
				/periodization|seminar|thesis|skripsi|registration|daftar|form|sidang|kompre|proposal/i.test(
					label,
				)
			) {
				if (!links.some((l) => l.url === href)) links.push({ label: label.slice(0, 100), url: href });
			}
		});
		if (docs[0]) hub.sopPdf = docs[0].url;
		if (docs.length) hub.documents = docs.slice(0, 15);
		if (links.length) hub.actionLinks = links.slice(0, 15);
		hub.sections = extractPageSections($, TI_SKRIPSI);
		hub.hubUrl = TI_SKRIPSI;
		hub.syncedAt = new Date().toISOString();
		delete hub.syncError;
	} catch (err) {
		console.warn('Skripsi hub scrape failed:', err);
		hub.syncedAt = new Date().toISOString();
		hub.syncError = String((err as Error)?.message || err);
	}
	return sanitizeHubResource(hub);
}

export async function syncPklHub(existing?: any) {
	const hub: any = {
		...DEFAULT_PKL_HUB,
		...(existing || {}),
		templates: [...(existing?.templates || [])],
	};
	try {
		const html = await fetchText(TI_PKL);
		const $ = cheerio.load(html);
		const templates: { name: string; url: string }[] = [];
		$('a[href]').each((_, el) => {
			const href = absUrl(($(el).attr('href') || '').replace(/&amp;/g, '&'), TI_PKL);
			let name = $(el).text().replace(/\s+/g, ' ').trim();
			if (/^download here$/i.test(name) || !name) {
				const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
				name = parentText.slice(0, 80) || 'Dokumen PKL';
			}
			name = name.replace(/\s*\[DOWNLOAD HERE\]\s*/gi, '').replace(/\s*:\s*$/, '').trim();
			if (isJunkLinkLabel(name)) return;
			if (/drive\.google\.com|docs\.google\.com|\.pdf/i.test(href)) {
				if (!templates.some((t) => t.url === href)) templates.push({ name: name.slice(0, 100), url: href });
			}
		});
		if (templates.length) hub.templates = templates.slice(0, 20);
		hub.sections = extractPageSections($, TI_PKL);
		hub.hubUrl = TI_PKL;
		hub.syncedAt = new Date().toISOString();
		delete hub.syncError;
	} catch (err) {
		console.warn('PKL hub scrape failed:', err);
		hub.syncedAt = new Date().toISOString();
		hub.syncError = String((err as Error)?.message || err);
	}
	return sanitizeHubResource(hub);
}

export { buildDefaultStudentHub };

export async function runStudentResourcesSync(existingHub?: any): Promise<{
	hub: ReturnType<typeof buildDefaultStudentHub>;
	summary: StudentHubSyncResult;
}> {
	const hub = buildDefaultStudentHub(existingHub);
	const summary: StudentHubSyncResult = {
		ok: true,
		calendarYears: [],
		calendarSkipped: [],
		announcementCount: 0,
		skripsiOk: false,
		pklTemplates: 0,
	};

	try {
		const cal = await syncAcademicCalendars(hub.academicCalendars || {});
		hub.academicCalendars = cal.map;
		summary.calendarYears = cal.found;
		summary.calendarSkipped = cal.skipped;
	} catch (err: any) {
		console.error('Calendar sync error:', err);
		summary.ok = false;
		summary.error = err?.message || 'calendar_failed';
	}

	try {
		hub.announcements = await syncAnnouncementsFeed();
		summary.announcementCount = hub.announcements.length;
	} catch (err) {
		console.warn('Announcements sync error:', err);
	}

	try {
		hub.skripsiHub = await syncSkripsiHub(hub.skripsiHub);
		summary.skripsiOk = !hub.skripsiHub.syncError;
	} catch (err) {
		console.warn('Skripsi sync error:', err);
	}

	try {
		hub.pklHub = await syncPklHub(hub.pklHub);
		summary.pklTemplates = hub.pklHub.templates?.length || 0;
	} catch (err) {
		console.warn('PKL sync error:', err);
	}

	hub.portals = DEFAULT_STUDENT_PORTALS;
	hub.guides = DEFAULT_STUDENT_GUIDES;

	return { hub, summary };
}

/** Lightweight announcements-only sync for daily cron */
export async function runAnnouncementsOnlySync(existingHub?: any) {
	const hub = buildDefaultStudentHub(existingHub);
	hub.announcements = await syncAnnouncementsFeed();
	return hub;
}
