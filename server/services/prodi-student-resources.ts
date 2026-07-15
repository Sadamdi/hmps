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

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SIAKAD = 'https://siakad.uin-malang.ac.id/index.php';
const PENGUMUMAN_INDEX = 'https://uin-malang.ac.id/blog/pengumuman-3';
const TI_PENGUMUMAN_FEED = 'https://informatika.uin-malang.ac.id/category/pengumuman/feed/';
const UIN_PENGUMUMAN_FEED = 'https://uin-malang.ac.id/blog/pengumuman-3/feed';
const TI_SKRIPSI = 'https://informatika.uin-malang.ac.id/thesis-skripsi-s1/';
const TI_PKL = 'https://informatika.uin-malang.ac.id/internship-pkl/';

const UPLOADS_CALENDAR = path.join(process.cwd(), 'uploads', 'prodi', 'calendar');

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

	$('a').each((_, el) => {
		const text = $(el).text().replace(/\s+/g, ' ').trim();
		const href = $(el).attr('href') || '';
		const parentText = $(el).parent().text().replace(/\s+/g, ' ').trim();
		if (/kalender akademik/i.test(text) || /kalender akademik/i.test(parentText)) {
			if (href && !announcementUrl) {
				announcementUrl = absUrl(href, SIAKAD);
			}
			const years = parseYearFromAcademicLabel(parentText || text);
			if (years) academicYearLabel = years.label;
		}
	});

	$('.berita_login li, .quote-phrase').each((_, el) => {
		const t = $(el).text().replace(/\s+/g, ' ').trim();
		if (t.length > 20 && t.length < 500) highlights.push(t.replace(/^"+|"+$/g, ''));
	});

	return { announcementUrl, highlights: highlights.slice(0, 12), academicYearLabel };
}

async function discoverAnnouncementUrls(): Promise<{ url: string; label: string }[]> {
	const found: { url: string; label: string }[] = [];
	const pages = [PENGUMUMAN_INDEX, `${PENGUMUMAN_INDEX}/page/2`];
	for (const page of pages) {
		try {
			const html = await fetchText(page);
			const $ = cheerio.load(html);
			$('a[href*="kalender-akademik"]').each((_, el) => {
				const href = absUrl($(el).attr('href') || '', page);
				const label = $(el).text().replace(/\s+/g, ' ').trim() || href;
				if (/kalender-akademik-tahun-akademik/i.test(href) && !found.some((f) => f.url === href)) {
					found.push({ url: href.replace('/post/', '/'), label });
				}
			});
		} catch (err) {
			console.warn('Pengumuman index scrape failed:', page, err);
		}
	}
	return found;
}

async function extractPdfFromAnnouncement(announcementUrl: string): Promise<{
	pdfUrl?: string;
	title: string;
	rectorDecision?: string;
}> {
	const html = await fetchText(announcementUrl);
	const $ = cheerio.load(html);
	const title = $('h1').first().text().replace(/\s+/g, ' ').trim() || 'Kalender Akademik';
	let rectorDecision: string | undefined;
	const bodyText = $('.o_wblog_post_content_field, article, main').text();
	const dec = bodyText.match(/Nomor\s*:\s*([^\n]+)/i);
	if (dec) rectorDecision = dec[1].replace(/\s+/g, ' ').trim();

	let pdfUrl: string | undefined;
	$('a[href]').each((_, el) => {
		if (pdfUrl) return;
		const href = ($(el).attr('href') || '').replace(/&amp;/g, '&');
		if (!href) return;
		const full = absUrl(href, announcementUrl);
		if (
			/\.pdf(\?|$)/i.test(full) ||
			/old\.uin-malang\.ac\.id/i.test(full) ||
			(/\/web\/content\//i.test(full) && /download=true/i.test(full)) ||
			/uin-malang\.ac\.id\/\+\/c\//i.test(full)
		) {
			pdfUrl = full;
		}
	});
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
	const local = await downloadPdfToLocal(opts.sourcePdfUrl, opts.start, opts.end);
	if (!local) return false;
	const key = String(opts.start);
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

export async function syncAcademicCalendars(
	existing: Record<string, AcademicCalendarEntry> = {},
): Promise<{ map: Record<string, AcademicCalendarEntry>; found: number[]; skipped: number[] }> {
	const map: Record<string, AcademicCalendarEntry> = { ...existing };
	const found: number[] = [];
	const attempted = new Set<number>();

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
		if (map[String(start)]?.pdfUrl) continue;
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

function parseRssItems(xml: string, source: 'ti' | 'uin'): { title: string; url: string; source: string; publishedAt: string }[] {
	const $ = cheerio.load(xml, { xmlMode: true });
	const items: { title: string; url: string; source: string; publishedAt: string }[] = [];
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
		if (title && url) items.push({ title, url, source, publishedAt });
	});
	return items;
}

function filterAnnouncements(items: { title: string; url: string; source: string; publishedAt: string }[]) {
	const tiRe = /thesis|periodization|seminar|skripsi|sidang|kompre|ujian/i;
	const uinRe = /wisuda|kalender akademik|ukt|uang kuliah/i;
	return items
		.filter((i) => (i.source === 'ti' ? tiRe.test(i.title) : uinRe.test(i.title)))
		.slice(0, 20);
}

export async function syncAnnouncementsFeed(): Promise<
	{ title: string; url: string; source: string; publishedAt: string }[]
> {
	const all: { title: string; url: string; source: string; publishedAt: string }[] = [];
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

export async function syncSkripsiHub(existing?: any) {
	const hub = { ...DEFAULT_SKRIPSI_HUB, ...(existing || {}) };
	try {
		const html = await fetchText(TI_SKRIPSI);
		const $ = cheerio.load(html);
		const pdfs: string[] = [];
		$('a[href]').each((_, el) => {
			const href = absUrl(($(el).attr('href') || '').replace(/&amp;/g, '&'), TI_SKRIPSI);
			if (/drive\.google\.com|docs\.google\.com|\.pdf/i.test(href)) pdfs.push(href);
		});
		if (pdfs[0] && !hub.sopPdf) hub.sopPdf = pdfs[0];
		hub.hubUrl = TI_SKRIPSI;
		hub.syncedAt = new Date().toISOString();
	} catch (err) {
		console.warn('Skripsi hub scrape failed:', err);
		hub.syncedAt = new Date().toISOString();
		hub.syncError = String((err as Error)?.message || err);
	}
	return hub;
}

export async function syncPklHub(existing?: any) {
	const hub = {
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
			const name = $(el).text().replace(/\s+/g, ' ').trim() || 'Dokumen';
			if (/drive\.google\.com|docs\.google\.com/i.test(href)) {
				if (!templates.some((t) => t.url === href)) templates.push({ name: name.slice(0, 80), url: href });
			}
		});
		if (templates.length) hub.templates = templates.slice(0, 12);
		hub.hubUrl = TI_PKL;
		hub.syncedAt = new Date().toISOString();
	} catch (err) {
		console.warn('PKL hub scrape failed:', err);
		hub.syncedAt = new Date().toISOString();
		hub.syncError = String((err as Error)?.message || err);
	}
	return hub;
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

	// Refresh static portals + guides from code defaults (katalog NIM / panduan)
	hub.portals = DEFAULT_STUDENT_PORTALS;
	hub.guides = DEFAULT_STUDENT_GUIDES;

	return { hub, summary };
}
