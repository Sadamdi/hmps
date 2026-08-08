import * as cheerio from 'cheerio';
import { mongoStorage } from '../mongo-storage';
import fs from 'fs';
import path from 'path';
import { processImage } from '../image-processor';
import { deleteFile } from '../upload';

const SOURCES = {
	profile: 'https://informatika.uin-malang.ac.id/undergraduate-s1/',
	// Official page renamed from lecturer-and-staff (404) → lecturer-staff
	lecturers: 'https://informatika.uin-malang.ac.id/lecturer-staff/',
	curriculumIndex: 'https://informatika.uin-malang.ac.id/curriculum-for-undergraduate/',
	curriculumLegacy: 'https://informatika.uin-malang.ac.id/curriculum/',
	teachingLab: 'https://informatika.uin-malang.ac.id/teaching-laboratory/',
	researchLab: 'https://informatika.uin-malang.ac.id/research-laboratory/',
	accreditationS1: 'https://informatika.uin-malang.ac.id/accreditation-certificate-for-undergraduate-s1/',
	// Old /accreditation-certificate-for-master-s2/ removed from WP (404). Live source is Master Study profile.
	accreditationS2: 'https://informatika.uin-malang.ac.id/master-study-s2/',
	curriculum2024: 'https://informatika.uin-malang.ac.id/curriculum-2024-dan-rps/',
	curriculumMasterIndex: 'https://informatika.uin-malang.ac.id/curriculum-for-master/',
	curriculumMaster2022: 'https://informatika.uin-malang.ac.id/curriculum-2022/',
	/** HTML page still 404; official OBE PDF used as guidebook fallback */
	curriculumMaster2024Pdf:
		'https://informatika.uin-malang.ac.id/wp-content/uploads/2025/08/Kurikulum-OBE-Magister-Informatika-2024-rev.pdf',
	curriculumMaster2024Page:
		'https://informatika.uin-malang.ac.id/curriculum-2024-for-master/',
};

const BASE_URL = 'https://informatika.uin-malang.ac.id';
const UPLOADS_PRODI_BASE = '/uploads/prodi';

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let syncing = false;

export type ProdiSyncSummary = {
	ok: boolean;
	error?: string;
	profileHistoryLen: number;
	missionCount: number;
	objectivesCount: number;
	lecturerLinks: number;
	semestersCount: number;
	optionalSubjectsCount: number;
	teachingLabs: number;
	researchLabs: number;
};

async function fetchPage(url: string): Promise<cheerio.CheerioAPI> {
	const res = await fetch(url, {
		headers: {
			'User-Agent': UA,
			Accept: 'text/html,application/xhtml+xml',
		},
		signal: AbortSignal.timeout(45_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	const html = await res.text();
	return cheerio.load(html);
}

function cleanText(el: cheerio.Cheerio<any>): string {
	return el.text().replace(/\s+/g, ' ').trim();
}

/** WordPress / theme: konten sering dibungkus div, bukan direct children .entry-content */
function getContentRoot($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
	const candidates = [
		'article .entry-content',
		'.entry-content',
		'article .post-content',
		'.post-content',
		'.page-content',
		'main .site-content',
		'main article',
		'main',
		'#content',
		'.content-area',
	];
	for (const sel of candidates) {
		const el = $(sel).first();
		if (el.length && cleanText(el).length > 80) return el;
	}
	for (const sel of candidates) {
		const el = $(sel).first();
		if (el.length) return el;
	}
	const body = $('body');
	if (body.length) {
		body.find('header, nav, footer, script, style, .site-header, .site-footer').remove();
		return body;
	}
	return $(':root');
}

function normalizeHref(href: string | undefined | null): string {
	const raw = (href || '').toString().trim();
	if (!raw) return '';
	if (raw.startsWith('/')) return `${BASE_URL}${raw}`;
	return raw;
}

function slugFromProfileUrlBackend(profileUrl: string): string {
	const normalized = profileUrl.replace(/\/+$/, '');
	const parts = normalized.split('/');
	return parts[parts.length - 1] || '';
}

function assignNonEmpty(target: any, source: any): void {
	if (!source || typeof source !== 'object') return;
	for (const [key, val] of Object.entries(source)) {
		if (val === '' || val === null || val === undefined) continue;
		target[key] = val;
	}
}

function isLocalProdiAssetUrl(url: string | undefined | null): boolean {
	if (!url) return false;
	return url.startsWith('/uploads/') || url.startsWith('/attached_assets/');
}

function localFilePathFromUrl(url: string): string {
	// url format: /uploads/... or /attached_assets/...
	const rel = url.replace(/^\//, '');
	return path.join(process.cwd(), rel);
}

async function cacheRemoteImageToLocalWebp(
	remoteUrl: string,
	destUrl: string,
	oldLocalUrl?: string,
): Promise<string> {
	try {
		const normalizedRemoteUrl = normalizeHref(remoteUrl);
		if (!normalizedRemoteUrl) return '';

		// Requirement: delete old file first (only if old URL is local)
		if (oldLocalUrl && isLocalProdiAssetUrl(oldLocalUrl)) {
			await deleteFile(oldLocalUrl);
		}

		const res = await fetch(normalizedRemoteUrl, {
			headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
			signal: AbortSignal.timeout(45_000),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status} for image ${normalizedRemoteUrl}`);

		const ab = await res.arrayBuffer();
		const buf = Buffer.from(ab);

		const processed = await processImage(buf, { quality: 80, maxWidth: 1920, maxHeight: 1080, format: 'webp' });

		// Write to disk
		const destPath = localFilePathFromUrl(destUrl);
		const destDir = path.dirname(destPath);
		if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

		await fs.promises.writeFile(destPath, processed);
		return destUrl;
	} catch (err) {
		console.warn(`Failed caching prodi image: ${remoteUrl} -> ${destUrl}`, err);
		return remoteUrl;
	}
}

/**
 * Elemen blok berurutan dokumen; hindari p di dalam li dan tabel bersarang.
 */
function orderedBlockElements($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>): cheerio.Cheerio<any> {
	return root.find('h1,h2,h3,h4,h5,h6,p,ul,ol,table,figure').filter((_i, el: any) => {
		const $el = $(el);
		const tag = (el.tagName || '').toLowerCase();
		if (tag === 'p' && $el.closest('li').length) return false;
		if (tag !== 'table' && tag !== 'figure' && $el.parents('table').length) return false;
		if (tag === 'table' && $el.parents('figure').length) return false;
		return true;
	});
}

function romanToInt(s?: string): number {
	if (!s) return 0;
	const upper = s.toUpperCase().replace(/[^IVXLCDM]/g, '');
	const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
	let result = 0;
	for (let i = 0; i < upper.length; i++) {
		const curr = map[upper[i]] || 0;
		const next = map[upper[i + 1]] || 0;
		result += curr < next ? -curr : curr;
	}
	return result;
}

function parseSemesterNumberFromHeading(text: string): number {
	const m = text.match(/semester\s+([ivxlcdm]+|\d+)/i);
	if (!m) return 0;
	const token = m[1];
	if (/^\d+$/.test(token)) return parseInt(token, 10);
	return romanToInt(token);
}

// ─── Profile parser ───

async function parseProfile(): Promise<any> {
	const $ = await fetchPage(SOURCES.profile);
	const root = getContentRoot($);
	if (!root.length) return {};

	let history = '';
	let vision = '';
	const mission: string[] = [];
	const objectives: string[] = [];
	let strategy = '';
	const milestones: any[] = [];
	const managements: any[] = [];
	let organizationStructureImageUrl = '';
	let organizationStructureDescription = '';

	let currentSection = '';
	let currentMgmtPeriod: { period: string; isCurrent: boolean; members: any[] } | null = null;

	const profileNodes = root.find('h1,h2,h3,h4,h5,h6,p,ul,ol,table,figure,div,a,img').toArray();
	for (const el of profileNodes) {
		const $el = $(el);
		const tag = (el.tagName || '').toLowerCase();
		const text = cleanText($el);
		const lower = text.toLowerCase();

		if (/^h[1-6]$/.test(tag)) {
			if (lower.includes('history')) {
				currentSection = 'history';
			} else if (lower.includes('vision')) {
				currentSection = 'vision';
			} else if (lower.includes('mission')) {
				currentSection = 'mission';
			} else if (lower.includes('objective')) {
				currentSection = 'objectives';
			} else if (lower.includes('strategy')) {
				currentSection = 'strategy';
			} else if (lower.includes('organization structure')) {
				currentSection = 'orgStructure';
			} else if (lower.includes('milestone')) {
				currentSection = 'milestones';
			} else if (lower.includes('past management') || lower.includes('current management')) {
				currentSection = 'managements';
				if (lower.includes('current management')) {
					if (currentMgmtPeriod) {
						currentMgmtPeriod.isCurrent = true;
					}
				}
			} else if (currentSection === 'managements') {
				const periodMatch = text.match(/Periode\s+(\d{4}\s*[-–—]\s*\d{4})/i) || text.match(/^(\d{4}\s*[-–—]\s*\d{4})$/);
				if (periodMatch) {
					currentMgmtPeriod = { period: periodMatch[1].trim(), isCurrent: false, members: [] };
					managements.push(currentMgmtPeriod);
				}
			}
			continue;
		}

		if (currentSection === 'managements' && ['p', 'div', 'span'].includes(tag)) {
			if (lower.includes('current management') && text.length < 80) {
				if (currentMgmtPeriod) currentMgmtPeriod.isCurrent = true;
			}
		}

		if (currentSection === 'managements' && tag === 'a' && currentMgmtPeriod) {
			const hrefRaw = $el.attr('href') || '';
			const href = normalizeHref(hrefRaw);
			if (href && href.startsWith(BASE_URL)) {
				let fullText = cleanText($el);
				const $p = $el.closest('p,div,li');
				if ($p.length) {
					const ptxt = cleanText($p);
					if (ptxt.length > fullText.length && ptxt.length < 300) fullText = ptxt;
				}
				const nameMatch = fullText.match(/^(.+?)\s+(Head of|Secretary of|Head|Secretary|Ketua|Sekretaris)/i);
				const name = nameMatch ? nameMatch[1].trim() : fullText.split(/\s+(Head|Secretary)/i)[0].trim();
				const posMatch = fullText.match(/(Head of[\w\s]+Department|Secretary of[\w\s]+Department|Head of|Secretary of|Head|Secretary|Ketua|Sekretaris)[\w\s,.]*/i);
				const position = posMatch ? posMatch[0].trim() : '';
				let photoUrl = '';
				const $bgEl = $el.find('.elementor-cta__bg, [style*="background-image"]').first();
				if ($bgEl.length) {
					const bgMatch = ($bgEl.attr('style') || '').match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
					if (bgMatch) photoUrl = normalizeHref(bgMatch[1]);
				}
				if (!photoUrl) {
					const $img = $el.find('img[src]').first();
					if ($img.length) photoUrl = normalizeHref($img.attr('src') || '');
				}
				if (name && name.length > 2) {
					currentMgmtPeriod.members.push({ name, position, profileUrl: href.replace(/\/+$/, ''), photoUrl });
				}
			}
			continue;
		}

		if (currentSection === 'orgStructure' && tag === 'img') {
			if (!organizationStructureImageUrl) {
				organizationStructureImageUrl = normalizeHref($el.attr('src') || $el.attr('data-src') || '');
			}
			continue;
		}

		if (currentSection === 'orgStructure' && tag === 'figure') {
			if (!organizationStructureImageUrl) {
				const $img = $el.find('img[src], img[data-src]').first();
				if ($img.length) {
					organizationStructureImageUrl = normalizeHref($img.attr('src') || $img.attr('data-src') || '');
				}
			}
			continue;
		}

		if (currentSection === 'orgStructure' && tag === 'div') {
			if (!organizationStructureImageUrl) {
				const $img = $el.find('img[src], img[data-src]').first();
				if ($img.length) {
					organizationStructureImageUrl = normalizeHref($img.attr('src') || $img.attr('data-src') || '');
				}
				if (!organizationStructureImageUrl) {
					const $bgEl = $el.find('[style*="background-image"]').addBack('[style*="background-image"]').first();
					if ($bgEl.length) {
						const bgMatch = ($bgEl.attr('style') || '').match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
						if (bgMatch) organizationStructureImageUrl = normalizeHref(bgMatch[1]);
					}
				}
			}
			if (!organizationStructureDescription) {
				const descText = cleanText($el.find('p').first());
				if (descText && descText.length > 5) organizationStructureDescription = descText;
			}
			continue;
		}

		if (currentSection === 'orgStructure' && tag === 'p') {
			if (!organizationStructureDescription) {
				if (text && text.length > 5) organizationStructureDescription = text;
			}
			continue;
		}

		switch (currentSection) {
			case 'history':
				if (tag === 'p' && text) history += (history ? '\n\n' : '') + text;
				break;
			case 'vision':
				if (tag === 'p' && text) vision += (vision ? '\n\n' : '') + text;
				break;
			case 'mission':
				if (tag === 'ul' || tag === 'ol') {
					$el.find('> li').each((_j, li) => {
						const t = cleanText($(li));
						if (t) mission.push(t);
					});
				} else if (tag === 'p' && text) mission.push(text);
				break;
			case 'objectives':
				if (tag === 'ul' || tag === 'ol') {
					$el.find('> li').each((_j, li) => {
						const t = cleanText($(li));
						if (t) objectives.push(t);
					});
				} else if (tag === 'p' && text) objectives.push(text);
				break;
			case 'strategy':
				if (tag === 'ul' || tag === 'ol') {
					$el.find('> li').each((_j, li) => {
						const t = cleanText($(li));
						if (t) strategy += (strategy ? '\n' : '') + t;
					});
				} else if (tag === 'p' && text) strategy += (strategy ? '\n\n' : '') + text;
				break;
			case 'milestones':
				if (tag === 'ul' || tag === 'ol') {
					$el.find('> li').each((_j, li) => {
						const t = cleanText($(li));
						const m = t.match(/^(\d{4})\s*[:–-]\s*(.*)/);
						if (m) milestones.push({ year: m[1], description: m[2].trim() });
						else if (t) milestones.push({ year: '', description: t });
					});
				}
				break;
		}
	}

	return { history, vision, mission, objectives, strategy, milestones, managements, organizationStructureImageUrl, organizationStructureDescription };
}

// ─── Lecturers parser ───

interface LecturerGroup {
	name: string;
	lecturers: any[];
}

async function parseLecturerList(): Promise<{ headAndSecretary: any[]; groups: LecturerGroup[]; staff: any[] }> {
	const $ = await fetchPage(SOURCES.lecturers);
	const root = getContentRoot($);
	if (!root.length) return { headAndSecretary: [], groups: [], staff: [] };

	const headAndSecretary: any[] = [];
	const groups: LecturerGroup[] = [];
	const staff: any[] = [];

	let section: 'head' | 'group' | 'staff' = 'head';
	let expectGroupName = false;
	const seenHrefs = new Set<string>();

	const SKIP_TAGS = new Set([
		'script', 'style', 'noscript', 'meta', 'link', 'svg', 'path',
		'img', 'br', 'hr', 'input', 'button', 'form', 'select', 'option',
		'textarea', 'label', 'iframe', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
	]);

	const allNodes = root.find('*').toArray();
	for (const el of allNodes) {
		const $el = $(el);
		const tag = ((el as any).tagName || (el as any).name || '').toLowerCase();
		if (SKIP_TAGS.has(tag)) continue;

		const text = cleanText($el);
		const lower = text.toLowerCase();

		if (/^h[1-6]$/.test(tag)) {
			if (lower.includes('lecturer and staff') || lower.includes('lecturer & staff')) continue;
			if (lower.includes('head and secretary') || lower.includes('head & secretary')) {
				section = 'head';
				expectGroupName = false;
				continue;
			}
			if (lower.includes('administration staff') || lower.includes('laboratory staff')) {
				section = 'staff';
				expectGroupName = false;
				continue;
			}
			if (lower.includes('knowledge group')) {
				expectGroupName = true;
				continue;
			}
			if (expectGroupName && text.length > 2 && !lower.includes('search') && !lower.includes('login') && !lower.includes('siam') && !lower.includes('miu')) {
				groups.push({ name: text, lecturers: [] });
				section = 'group';
				expectGroupName = false;
				continue;
			}
			continue;
		}

		if (['p', 'div', 'strong', 'span'].includes(tag) && lower.includes('knowledge group') && text.length < 60) {
			expectGroupName = true;
			continue;
		}

		if (tag === 'a') {
			const hrefRaw = $el.attr('href') || '';
			const href = normalizeHref(hrefRaw);
			if (!href || !href.startsWith(BASE_URL)) continue;

			const hrefKey = href.replace(/\/+$/, '');
			if (seenHrefs.has(hrefKey)) continue;
			if (lower.includes('search') || lower.includes('login') || lower.includes('miu') || lower.includes('siam')) continue;
			const lecturersPageKey = SOURCES.lecturers.replace(/\/+$/, '');
			if (hrefKey === lecturersPageKey || hrefKey === lecturersPageKey.replace(/\/+$/, '')) continue;
			seenHrefs.add(hrefKey);

			let rawText = text;
			const $parent = $el.closest('p,div,li');
			if ($parent.length) {
				const ptxt = cleanText($parent);
				if (ptxt.length > rawText.length && ptxt.length < 300) rawText = ptxt;
			}
			if (!rawText || rawText.length < 3) continue;

			const nipMatch = rawText.match(/NIP(?:PPK)?[.:]?\s*([\d\s]+)/i);
			const nip = nipMatch ? nipMatch[1].replace(/\s+/g, ' ').trim() : '';
			const namePart = rawText.replace(/NIP(?:PPK)?[.:]?\s*[\d\s]+/i, '').trim();
			const nameAndPos = namePart.split(/(Head of|Secretary of|Head|Secretary|Ketua|Sekretaris)/i);
			const name = nameAndPos[0].trim();
			const position = nameAndPos.length > 1 ? nameAndPos.slice(1).join('').trim() : '';

			let photoUrl = '';
			const $container = $el.closest('div,figure,article,li');
			if ($container.length) {
				const $img = $container.find('img[src]').first();
				if ($img.length) photoUrl = normalizeHref($img.attr('src') || '');
				if (!photoUrl) {
					const $bgEl = $container.find('.elementor-cta__bg, [style*="background-image"]').first();
					if ($bgEl.length) {
						const bgMatch = ($bgEl.attr('style') || '').match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
						if (bgMatch) photoUrl = normalizeHref(bgMatch[1]);
					}
				}
			}

			const row: any = { name, nip, profileUrl: hrefKey, position, photoUrl };
			if (section === 'head') headAndSecretary.push(row);
			else if (section === 'staff') staff.push(row);
			else if (groups.length) groups[groups.length - 1].lecturers.push(row);
		}
	}

	return { headAndSecretary, groups, staff };
}

async function fetchLecturerDetail(profileUrl: string): Promise<any> {
	try {
		const $ = await fetchPage(profileUrl);
		const root = getContentRoot($);

		// --- Photo: Elementor image-box first, then generic WP selectors ---
		let photoUrl = '';
		const $elPhoto = root.find('.elementor-image-box-img img, .elementor-widget-image-box img').first();
		if ($elPhoto.length) {
			photoUrl = normalizeHref($elPhoto.attr('src') || $elPhoto.attr('data-src') || '');
		}
		if (!photoUrl) {
			const $wpPhoto = root.find('img.wp-post-image, .entry-content img, .post-thumbnail img, article img').first();
			photoUrl = normalizeHref($wpPhoto.attr('src') || $wpPhoto.attr('data-src') || '');
		}

		// --- Email & Working Days/Hours from Elementor icon-box widgets ---
		let email = '';
		let workingDaysHours = '';
		root.find('.elementor-icon-box-description').each((_i, el) => {
			const txt = $(el).text().replace(/\s+/g, ' ').trim();
			if (/e-?mail\s*address/i.test(txt)) {
				const m = txt.match(/e-?mail\s*address\s*[:\s]\s*(\S+@\S+)/i);
				if (m) email = m[1].trim();
			}
			if (/working\s+days?\/?hours?/i.test(txt)) {
				const m = txt.match(/working\s+days?\/?hours?\s*[:\s]\s*([\s\S]+)/i);
				if (m) workingDaysHours = m[1].replace(/\s+/g, ' ').trim();
			}
		});

		// --- NIP, NIDN, Education, Knowledge Group from labeled heading+p pairs ---
		let nip = '';
		let nidn = '';
		let nidnUrl = '';
		let education = '';
		let knowledgeGroup = '';

		const headings = root.find('h3, h4').toArray();
		for (const h of headings) {
			const $h = $(h);
			const label = cleanText($h).toLowerCase();
			const $next = $h.nextAll('p').first();
			const nextText = $next.length ? cleanText($next) : '';

			if (label === 'nip' && nextText) {
				nip = nextText.replace(/\s+/g, ' ').trim();
			} else if (label === 'nidn' && nextText) {
				nidn = nextText.replace(/\s+/g, ' ').trim();
				const link = $next.find('a[href*="pddikti"]').attr('href');
				if (link) nidnUrl = link;
			} else if (label === 'education' && nextText) {
				education = nextText.replace(/\s+/g, ' ').trim();
			} else if (label === 'knowledge group' && nextText) {
				knowledgeGroup = nextText.replace(/\s+/g, ' ').trim();
			}
		}

		if (!knowledgeGroup) {
			const $desc = root.find('.elementor-image-box-description').first();
			if ($desc.length) knowledgeGroup = cleanText($desc);
		}

		// --- Academic links from .process-step blocks ---
		let googleScholar = '';
		let scopusUrl = '';
		let scopusId = '';
		let orcidUrl = '';
		let orcidId = '';
		let sintaUrl = '';
		let sintaId = '';
		let repositoryUrl = '';

		root.find('.process-step').each((_i, el) => {
			const $step = $(el);
			const title = cleanText($step.find('.step-item-title, h4')).toLowerCase();
			const $link = $step.find('.process-step-desc a[href]').first();
			const href = $link.attr('href') || '';

			if (title.includes('google scholar') && href) {
				googleScholar = href;
			} else if (title.includes('scopus') && href) {
				scopusUrl = href;
				const idM = title.match(/scopus\s*id[.:\s]*([\d]+)/i);
				if (idM) scopusId = idM[1];
			} else if (title.includes('orcid') && href) {
				orcidUrl = href;
				const idM = title.match(/orcid\s*id[.:\s]*([\d-]+)/i);
				if (idM) orcidId = idM[1];
			} else if (title.includes('sinta') && href) {
				sintaUrl = href;
				const idM = title.match(/sinta\s*id[.:\s]*([\d]+)/i);
				if (idM) sintaId = idM[1];
			} else if (title.includes('repository') && href) {
				repositoryUrl = href;
			}
		});

		// --- Fallback: regex on fullText for pages without Elementor markup ---
		const fullText = root.text();

		if (!email) {
			const m = fullText.match(/E-?mail\s*(?:Address)?[:\s]+([^\s]+@[^\s]+)/i);
			if (m) email = m[1].trim();
		}
		if (!nip) {
			const m = fullText.match(/NIP[:\s]+([\d\s]+)/i);
			if (m) nip = m[1].replace(/\s+/g, ' ').trim();
		}
		if (!nidn) {
			const m = fullText.match(/NIDN[:\s]+([\d\s]+)/i);
			if (m) nidn = m[1].replace(/\s+/g, ' ').trim();
		}
		if (!education) {
			const m = fullText.match(/Education[:\s]+([\s\S]*?)(?=Knowledge Group|Google Scholar|Scopus|$)/i);
			if (m) education = m[1].replace(/\s+/g, ' ').trim();
		}
		if (!knowledgeGroup) {
			const m = fullText.match(/Knowledge Group[:\s]+([\s\S]*?)(?=Google Scholar|Scopus|ORCID|SINTA|University|$)/i);
			if (m) knowledgeGroup = m[1].replace(/\s+/g, ' ').trim();
		}
		if (!workingDaysHours) {
			const m = fullText.match(/Working\s+Days?\/?Hours?[:\s]+([\s\S]*?)(?=NIP|NIDN|Education|$)/i);
			if (m) workingDaysHours = m[1].replace(/\s+/g, ' ').trim();
		}

		if (!nidnUrl) nidnUrl = root.find('a[href*="pddikti"]').attr('href') || '';
		if (!googleScholar) googleScholar = root.find('a[href*="scholar.google"]').attr('href') || '';
		if (!scopusUrl) scopusUrl = root.find('a[href*="scopus.com"]').attr('href') || '';
		if (!orcidUrl) orcidUrl = root.find('a[href*="orcid.org"]').attr('href') || '';
		if (!sintaUrl) sintaUrl = root.find('a[href*="sinta"]').attr('href') || '';
		if (!repositoryUrl) repositoryUrl = root.find('a[href*="repository"]').attr('href') || '';

		if (!scopusId) {
			const m = fullText.match(/Scopus\s*ID[.:\s]*([\d]+)/i);
			if (m) scopusId = m[1];
		}
		if (!orcidId) {
			const m = fullText.match(/ORCID\s*ID[.:\s]*([\d-]+)/i);
			if (m) orcidId = m[1];
		}
		if (!sintaId) {
			const m = fullText.match(/SINTA\s*ID[.:\s]*([\d]+)/i);
			if (m) sintaId = m[1];
		}

		return {
			email, nip, nidn, nidnUrl,
			education, knowledgeGroup, workingDaysHours,
			photoUrl,
			googleScholar, scopusId, scopusUrl,
			orcidId, orcidUrl, sintaId, sintaUrl,
			repositoryUrl,
		};
	} catch (err) {
		console.warn(`Failed to fetch lecturer detail ${profileUrl}:`, err);
		return {};
	}
}

// ─── Curriculum: map table columns from header row ───

function normalizeHeaderCell(s: string): string {
	return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function mapCurriculumHeaderRow($: cheerio.CheerioAPI, $row: cheerio.Cheerio<any>): Record<string, number> {
	const map: Record<string, number> = {};
	$row.find('th,td').each((i, cell) => {
		const key = normalizeHeaderCell(cleanText($(cell)));
		if (!key) return;
		if (key === 'no' || key.startsWith('no ')) map.no = i;
		else if (key.includes('code')) map.code = i;
		else if (key.includes('subject') || key.includes('mata kuliah') || key.includes('course')) map.name = i;
		else if (key === 'sks' || key.includes('credit')) map.sks = i;
		else if (key.includes('prereq') || key.includes('prasyarat')) map.prerequisite = i;
		else if (key.includes('rps')) map.rps = i;
	});
	return map;
}

function detectSemesterFromTable($: cheerio.CheerioAPI, $table: cheerio.Cheerio<any>): number {
	const cap = cleanText($table.find('caption').first());
	if (cap) {
		const lower = cap.toLowerCase();
		if (lower.includes('semester')) {
			const num = parseSemesterNumberFromHeading(cap);
			if (num > 0) return num;
		}
	}
	// Beberapa tabel mungkin tidak menaruh "Semester V" di sel pertama.
	// Cari sel mana pun yang mengandung kata "Semester".
	const candidates = $table.find('th,td').toArray();
	for (const cell of candidates) {
		const t = cleanText($(cell));
		if (!t) continue;
		const lower = t.toLowerCase();
		if (lower.includes('semester')) {
			const num = parseSemesterNumberFromHeading(t);
			if (num > 0) return num;
		}
	}
	return 0;
}

function parseCurriculumTable(
	$: cheerio.CheerioAPI,
	$table: cheerio.Cheerio<any>,
	target: { subjects: any[]; totalSks: string },
) {
	const rows = $table.find('tr').toArray();
	if (!rows.length) return;

	let colMap: Record<string, number> | null = null;
	let hasSemesterColumn = false;

	for (const tr of rows) {
		const $tr = $(tr);
		const cells = $tr.find('th,td');
		if (cells.length < 2) continue;
		const first = normalizeHeaderCell(cleanText(cells.first()));

		if (first.includes('semester')) {
			hasSemesterColumn = true;
			colMap = {};
			cells.each((i, cell) => {
				if (i === 0) return;
				const key = normalizeHeaderCell(cleanText($(cell)));
				const dataIdx = i - 1;
				if (key === 'no' || key.startsWith('no ')) colMap!.no = dataIdx;
				else if (key.includes('code')) colMap!.code = dataIdx;
				else if (key.includes('subject') || key.includes('mata kuliah') || key.includes('course')) colMap!.name = dataIdx;
				else if (key === 'sks' || key.includes('credit')) colMap!.sks = dataIdx;
				else if (key.includes('prereq') || key.includes('prasyarat')) colMap!.prerequisite = dataIdx;
				else if (key.includes('rps')) colMap!.rps = dataIdx;
			});
			break;
		}

		if (first === 'no' || (first.includes('no') && cleanText(cells.eq(1)).toLowerCase().includes('code'))) {
			colMap = mapCurriculumHeaderRow($, $tr);
			break;
		}
	}
	if (!colMap || Object.keys(colMap).length < 2) {
		colMap = hasSemesterColumn
			? { no: 0, code: 1, name: 2, sks: 3, prerequisite: 4 }
			: { no: 0, code: 1, name: 2, sks: 3, prerequisite: 4, rps: 5 };
	}

	const get = (cells: cheerio.Cheerio<any>, k: string) => {
		const idx = colMap![k];
		if (idx === undefined) return '';
		return cleanText(cells.eq(idx));
	};

	for (const tr of rows) {
		const $tr = $(tr);
		const cells = $tr.find('td');
		if (!cells.length || cells.length < 2) continue;

		const first = cleanText(cells.eq(0)).toLowerCase();
		if (first === 'no' || first.includes('semester') || first.startsWith('__')) continue;
		if (/^subject\s+merdeka$/i.test(first.trim())) continue;
		if (first === 'total' || cleanText(cells.eq(0)).match(/^total$/i)) {
			const sksIdx = colMap.sks !== undefined ? colMap.sks : 3;
			let totalVal = cleanText(cells.eq(sksIdx));
			if (!totalVal) {
				for (let ci = 1; ci < cells.length; ci++) {
					const cv = cleanText(cells.eq(ci)).replace(/\D/g, '');
					if (cv) { totalVal = cv; break; }
				}
			}
			target.totalSks = totalVal || '';
			continue;
		}

		const code = get(cells, 'code');
		const name = get(cells, 'name');
		const no = get(cells, 'no');
		const sks = get(cells, 'sks');
		if (!name && !code) continue;
		if (/^no$/i.test(no) && /^code$/i.test(code)) continue;

		const sub: any = {
			no: no || '',
			code: code || '',
			name: name || '',
			sks: sks || '',
			prerequisite: get(cells, 'prerequisite') || '',
		};
		const rpsIdx = colMap.rps;
		if (rpsIdx !== undefined) {
			const rpsCell = cells.eq(rpsIdx);
			const rpsLink = rpsCell.find('a').attr('href');
			if (rpsLink) sub.rpsUrl = normalizeHref(rpsLink);
		} else {
			const rpsLink = cells.last().find('a[href*="informatika"]').attr('href');
			if (rpsLink) sub.rpsUrl = normalizeHref(rpsLink);
		}
		target.subjects.push(sub);
	}
}

/** Teks ringkas dari `<summary>` panel accordion (native details atau Elementor). */
function getDetailsSummaryText($: cheerio.CheerioAPI, $det: cheerio.Cheerio<any>): string {
	const $sum = $det.children('summary').first();
	if ($sum.length) return cleanText($sum);
	const $titleDiv = $det.find('.e-n-accordion-item-title-text').first();
	if ($titleDiv.length) return cleanText($titleDiv);
	const $deepSum = $det.find('summary').first();
	if ($deepSum.length) return cleanText($deepSum);
	return '';
}

/** Panel kurikulum per-semester, optional subjects, atau guidebook (yang harus di-skip di loop utama). */
function isCurriculumAccordionDetails($: cheerio.CheerioAPI, $det: cheerio.Cheerio<any>): boolean {
	if (!$det?.length) return false;
	const summaryText = getDetailsSummaryText($, $det);
	if (!summaryText) return false;
	const lower = summaryText.toLowerCase();
	if (
		lower.includes('list of optional subjects') ||
		lower.includes('list of optional') ||
		lower.includes('optional subject') ||
		lower.includes('guidebook')
	) {
		return true;
	}
	const semNum = parseSemesterNumberFromHeading(summaryText);
	return semNum > 0 && lower.includes('semester');
}

/**
 * Parse kurikulum dari struktur accordion (native `<details>` atau Elementor
 * `.e-n-accordion-item`) agar mata kuliah tidak tercampur ke semester terakhir.
 */
function parseCurriculumAccordionPanels(
	$: cheerio.CheerioAPI,
	root: cheerio.Cheerio<any>,
	semesters: any[],
	optionalSubjects: any[],
	ensureSemester: (num: number) => void,
) {
	let panels = root.find('details').toArray();
	if (!panels.length) panels = root.find('.e-n-accordion-item').toArray();

	for (const detEl of panels) {
		const $det = $(detEl);
		const summaryText = getDetailsSummaryText($, $det);
		if (!summaryText) continue;
		const lower = summaryText.toLowerCase();

		if (
			lower.includes('list of optional subjects') ||
			lower.includes('list of optional') ||
			lower.includes('optional subject')
		) {
			$det.find('table').each((___, tbl) => {
				parseCurriculumTable($, $(tbl), { subjects: optionalSubjects, totalSks: '' });
			});
			continue;
		}

		const semNum = parseSemesterNumberFromHeading(summaryText);
		if (semNum <= 0 || !lower.includes('semester')) continue;

		ensureSemester(semNum);
		const target = semesters.find((s: any) => s.semester === semNum);
		if (!target) continue;

		target.subjects = [];
		target.totalSks = '';
		$det.find('table').each((___, tbl) => {
			parseCurriculumTable($, $(tbl), target);
		});
	}
}

function parseCurriculumAccordionMeta(
	$: cheerio.CheerioAPI,
	root: cheerio.Cheerio<any>,
): { graduateProfile: any[]; knowledgeGroups: string[]; structureSummary: string; guidebookUrl: string } {
	const graduateProfile: any[] = [];
	const knowledgeGroups: string[] = [];
	let structureSummary = '';
	let guidebookUrl = '';

	let panels = root.find('details').toArray();
	if (!panels.length) panels = root.find('.e-n-accordion-item').toArray();

	for (const detEl of panels) {
		const $det = $(detEl);
		const summaryText = getDetailsSummaryText($, $det);
		if (!summaryText) continue;
		const lower = summaryText.toLowerCase();

		if (lower.includes('guidebook')) {
			const href = normalizeHref($det.find('a[href]').first().attr('href') || '');
			if (href) guidebookUrl = href;
			continue;
		}

		if (lower.includes('graduate profile')) {
			$det.find('table').each((_j, tbl) => {
				graduateProfile.push(...parseGraduateProfileTable($, $(tbl)));
			});
			if (!graduateProfile.length) {
				$det.find('ul > li, ol > li').each((_j, li) => {
					const t = cleanText($(li));
					if (t) graduateProfile.push({ description: t });
				});
			}
			continue;
		}

		if (lower.includes('knowledge group')) {
			$det.find('ol > li, ul > li').each((_j, li) => {
				const t = cleanText($(li));
				if (t) knowledgeGroups.push(t);
			});
			continue;
		}

		if (lower.includes('structure of curriculum')) {
			$det.find('p').each((_j, p) => {
				const t = cleanText($(p));
				if (t) structureSummary += (structureSummary ? '\n' : '') + t;
			});
			$det.find('ul > li, ol > li').each((_j, li) => {
				const t = cleanText($(li));
				if (t) structureSummary += '\n• ' + t;
			});
			continue;
		}
	}

	return { graduateProfile, knowledgeGroups, structureSummary, guidebookUrl };
}

function parseGraduateProfileTable($: cheerio.CheerioAPI, $table: cheerio.Cheerio<any>): any[] {
	const rows: any[] = [];
	let carryProfession = '';
	const readCell = ($cell: cheerio.Cheerio<any>): string => {
		if (!$cell.length) return '';
		const items = $cell.find('li').toArray().map((li) => cleanText($(li))).filter(Boolean);
		if (items.length > 0) return items.map((x) => `• ${x}`).join('\n');
		return cleanText($cell);
	};

	$table.find('tr').each((_i, tr) => {
		const $tr = $(tr);
		const cells = $tr.find('th,td');
		if (cells.length < 2) return;

		const no = cleanText(cells.eq(0));
		if (!no || /^no\.?$/i.test(no) || !/^\d+$/i.test(no)) return;

		const description = cleanText(cells.eq(1));
		if (!description) return;

		let profession = '';
		// Pada tabel 2020 kolom profession memakai rowspan.
		if (cells.length >= 4) profession = readCell(cells.eq(3)) || readCell(cells.eq(2));
		else if (cells.length === 3) profession = readCell(cells.eq(2));
		if (!profession && carryProfession) profession = carryProfession;
		if (profession) carryProfession = profession;

		rows.push({ no, description, profession });
	});

	return rows;
}

type CurriculumIndexEntry = { year: number; url: string; level: 's1' | 's2' };

const ROMAN_SEMESTER: Record<string, number> = {
	i: 1,
	ii: 2,
	iii: 3,
	iv: 4,
	v: 5,
	vi: 6,
	vii: 7,
	viii: 8,
};

function parseSemesterNumberLabel(text: string): number | null {
	const t = (text || '').trim();
	const arabic = t.match(/semester\s*(\d{1,2})/i);
	if (arabic) {
		const n = parseInt(arabic[1], 10);
		return Number.isFinite(n) ? n : null;
	}
	const roman = t.match(/semester\s*([ivx]+)/i);
	if (roman) return ROMAN_SEMESTER[roman[1].toLowerCase()] ?? null;
	return null;
}

/** Master curriculum pages use plain SEMESTER tables (not Elementor accordion). */
function parseMasterSemesterTables(
	$: cheerio.CheerioAPI,
	root: cheerio.Cheerio<any>,
	semesters: any[],
	optionalSubjects: any[],
) {
	const ensure = (num: number) => {
		if (!semesters.find((s: any) => s.semester === num)) {
			semesters.push({ semester: num, totalSks: '', subjects: [] });
		}
	};

	let inferredSem = 0;
	root.find('table').each((_ti, tbl) => {
		const $tbl = $(tbl);
		const $figure = $tbl.closest('figure');
		const $anchor = $figure.length ? $figure : $tbl;
		const before = cleanText(
			$anchor.prevAll('h1,h2,h3,h4,h5,p,div,strong').first(),
		);
		const caption = cleanText($tbl.find('caption').first());
		const nearby = `${before} ${caption}`.slice(0, 240);
		let semNum = parseSemesterNumberLabel(nearby);
		if (semNum == null) {
			// Tables are ordered SEMESTER I, II, III… when labels sit in previous <p><strong>
			inferredSem += 1;
			semNum = inferredSem;
		} else {
			inferredSem = semNum;
		}

		$tbl.find('tr').each((_ri, tr) => {
			const cells = $(tr)
				.find('td,th')
				.toArray()
				.map((c) => cleanText($(c)));
			if (cells.length < 3) return;
			const joined = cells.join(' ').toLowerCase().replace(/\s+/g, '');
			if (
				/^no$/i.test(cells[0]) &&
				/code|subject/i.test(cells.join(' '))
			) {
				return;
			}
			if (/^total$/i.test(joined) || /^total\d+$/i.test(joined) || /^t\s*o\s*t\s*a\s*l/i.test(cells[0])) {
				const sks =
					cells.find((c) => /^\d+(\.\d+)?$/.test(c.replace(/\s+/g, ''))) ||
					'';
				if (semNum != null && sks) {
					ensure(semNum);
					const row = semesters.find((s: any) => s.semester === semNum);
					if (row && !row.totalSks) row.totalSks = sks.replace(/\s+/g, '');
				}
				return;
			}

			// Expected: No | Code | Name | SKS | Prerequisite
			let code = '';
			let name = '';
			let sks = '';
			let prerequisite = '';
			if (cells.length >= 5) {
				code = cells[1];
				name = cells[2];
				sks = cells[3];
				prerequisite = cells[4];
			} else if (cells.length === 4) {
				if (/^\d+$/.test(cells[0])) {
					code = cells[1];
					name = cells[2];
					sks = cells[3];
				} else {
					code = cells[0];
					name = cells[1];
					sks = cells[2];
					prerequisite = cells[3];
				}
			} else {
				code = cells[0];
				name = cells[1];
				sks = cells[2] || '';
			}

			if (!name || name.length < 3) return;
			if (/^subjects?\s*name$/i.test(name)) return;
			const $nameLink = $(tr).find('td a[href], th a[href]').first();
			const rpsUrl = normalizeHref($nameLink.attr('href') || '');
			const subject: any = {
				code: code && !/^no$/i.test(code) ? code : '',
				name,
				sks: sks || '',
				prerequisite: prerequisite || '',
			};
			if (rpsUrl && /\.pdf($|\?)/i.test(rpsUrl)) subject.rpsUrl = rpsUrl;

			// Elective slots stay inside the semester; also mirror into optionalSubjects.
			if (/mk\s*pilihan/i.test(name) || /sesuai kode mk pilihan/i.test(code)) {
				optionalSubjects.push(subject);
			}
			ensure(semNum);
			const row = semesters.find((s: any) => s.semester === semNum);
			row.subjects.push(subject);
		});
	});
}

async function parseCurriculumIndexEntries(): Promise<CurriculumIndexEntry[]> {
	const byYear = new Map<number, string>();
	// Index cards currently use href="#"; keep known official detail URLs seeded.
	byYear.set(2020, SOURCES.curriculumLegacy);
	byYear.set(2024, SOURCES.curriculum2024);

	try {
		const $ = await fetchPage(SOURCES.curriculumIndex);
		const root = getContentRoot($);
		if (root.length) {
			root.find('a[href]').each((_i, a) => {
				const $a = $(a);
				const hrefRaw = ($a.attr('href') || '').trim();
				const href = normalizeHref(hrefRaw);
				const txt = cleanText($a);
				const cardTxt = cleanText($a.closest('.curriculum-card, .card, article, li, div').first());
				const parentTxt = cleanText($a.closest('h1,h2,h3,h4,h5,h6,p,div').first());
				const merged = `${txt} ${parentTxt} ${cardTxt}`.trim();
				const yearFromText = merged.match(/curriculum\s*(\d{4})/i);
				const yearFromUrl = href.match(/curriculum-(\d{4})/i);
				const year = parseInt((yearFromText?.[1] || yearFromUrl?.[1] || ''), 10);
				if (!Number.isFinite(year) || year < 2000 || year > 2100) return;
				if (!href || href.endsWith('#') || href.includes('/#') || !href.startsWith(BASE_URL)) {
					// Year discovered from card label; keep seeded/known URL.
					return;
				}
				byYear.set(year, href);
			});

			root.find('h1,h2,h3,h4,.card-content').each((_i, el) => {
				const txt = cleanText($(el));
				const m = txt.match(/curriculum\s*(\d{4})/i);
				if (!m) return;
				const year = parseInt(m[1], 10);
				if (!Number.isFinite(year) || year < 2000 || year > 2100) return;
				if (!byYear.has(year)) {
					if (year === 2024) byYear.set(year, SOURCES.curriculum2024);
					else if (year === 2020) byYear.set(year, SOURCES.curriculumLegacy);
				}
			});
		}
	} catch (err) {
		console.warn('Curriculum index parse warning:', err);
	}

	return Array.from(byYear.entries())
		.map(([year, url]) => ({ year, url, level: 's1' as const }))
		.sort((a, b) => a.year - b.year);
}

async function parseCurriculumMasterIndexEntries(): Promise<CurriculumIndexEntry[]> {
	const byYear = new Map<number, string>();
	byYear.set(2022, SOURCES.curriculumMaster2022);
	// Prefer live HTML page when it exists; else keep PDF URL as sync target marker.
	byYear.set(2024, SOURCES.curriculumMaster2024Page);

	try {
		const $ = await fetchPage(SOURCES.curriculumMasterIndex);
		const root = getContentRoot($);
		if (root.length) {
			root.find('a[href]').each((_i, a) => {
				const href = normalizeHref($(a).attr('href') || '');
				if (!href || !href.startsWith(BASE_URL) || href.endsWith('#')) return;
				const txt = `${cleanText($(a))} ${cleanText($(a).closest('div,li,p').first())}`;
				const m = txt.match(/curriculum\s*(\d{4})/i) || href.match(/curriculum-(\d{4})/i);
				if (!m) return;
				const year = parseInt(m[1], 10);
				if (!Number.isFinite(year) || year < 2000 || year > 2100) return;
				byYear.set(year, href);
			});
		}
	} catch (err) {
		console.warn('Master curriculum index parse warning:', err);
	}

	return Array.from(byYear.entries())
		.map(([year, url]) => ({ year, url, level: 's2' as const }))
		.sort((a, b) => a.year - b.year);
}

async function parseCurriculumFromUrl(curriculumUrl: string): Promise<any> {
	// Master 2024 HTML still 404 — ship PDF guidebook entry instead of failing the year.
	if (
		curriculumUrl === SOURCES.curriculumMaster2024Page ||
		curriculumUrl === SOURCES.curriculumMaster2024Pdf ||
		/\.pdf($|\?)/i.test(curriculumUrl)
	) {
		return {
			graduateProfile: [],
			knowledgeGroups: [],
			structureSummary:
				'Kurikulum OBE Magister Informatika 2024. Halaman web detail belum tersedia di situs resmi TI; unduh buku kurikulum PDF sebagai referensi utama.',
			semesters: [],
			optionalSubjects: [],
			guidebookUrl: SOURCES.curriculumMaster2024Pdf,
			curriculumUrl: SOURCES.curriculumMasterIndex,
			officialUrl: SOURCES.curriculumMasterIndex,
		};
	}

	let $: cheerio.CheerioAPI;
	try {
		$ = await fetchPage(curriculumUrl);
	} catch (err: any) {
		if (
			curriculumUrl.includes('curriculum-2024-for-master') ||
			/HTTP 404/.test(String(err?.message || ''))
		) {
			return parseCurriculumFromUrl(SOURCES.curriculumMaster2024Pdf);
		}
		throw err;
	}
	const root = getContentRoot($);
	if (!root.length) return {};

	const graduateProfile: any[] = [];
	const knowledgeGroups: string[] = [];
	let structureSummary = '';
	const semesters: any[] = [];
	const optionalSubjects: any[] = [];
	let guidebookUrl = '';

	let currentSection = '';

	function ensureSemester(num: number) {
		if (!semesters.find((s: any) => s.semester === num)) {
			semesters.push({ semester: num, totalSks: '', subjects: [] });
		}
		currentSection = 'semester';
	}

	parseCurriculumAccordionPanels($, root, semesters, optionalSubjects, ensureSemester);
	const accordionMeta = parseCurriculumAccordionMeta($, root);
	if (accordionMeta.graduateProfile.length > 0) graduateProfile.push(...accordionMeta.graduateProfile);
	if (accordionMeta.knowledgeGroups.length > 0) knowledgeGroups.push(...accordionMeta.knowledgeGroups);
	if (accordionMeta.structureSummary.trim()) structureSummary = accordionMeta.structureSummary.trim();
	if (accordionMeta.guidebookUrl) guidebookUrl = accordionMeta.guidebookUrl;

	if (semesters.length === 0) {
		parseMasterSemesterTables($, root, semesters, optionalSubjects);
	}

	// Collect guidebook PDF links (master pages)
	if (!guidebookUrl) {
		root.find('a[href]').each((_i, a) => {
			if (guidebookUrl) return;
			const href = normalizeHref($(a).attr('href') || '');
			const label = cleanText($(a));
			if (/\.pdf($|\?)/i.test(href) && /kurikulum|curriculum|obe|guidebook|buku/i.test(`${label} ${href}`)) {
				guidebookUrl = href;
			}
		});
	}

	// Intro paragraph as structure summary for master pages
	if (!structureSummary.trim()) {
		const intro = cleanText(root.find('p').first());
		if (intro.length > 40) structureSummary = intro.slice(0, 800);
	}

	console.log(
		`Curriculum parse result: ${semesters.length} semesters (${semesters.map((s: any) => `sem${s.semester}:${s.subjects?.length ?? 0}`).join(', ')}), optionalSubjects=${optionalSubjects.length}`,
	);

	orderedBlockElements($, root).each((_i, el: any) => {
		const $el = $(el);
		const $parentAccordion = $el.closest('details, .e-n-accordion-item');
		if ($parentAccordion.length) {
			return;
		}
		const tag = (el.tagName || '').toLowerCase();
		const text = cleanText($el);
		const lower = text.toLowerCase();

		if (/^h[1-6]$/.test(tag)) {
			if (lower.includes('graduate profile')) currentSection = 'graduateProfile';
			else if (lower.includes('knowledge group')) currentSection = 'knowledgeGroups';
			else if (lower.includes('structure of curriculum')) currentSection = 'structure';
			else if (lower.includes('distribution of subject') || lower.includes('distribution of subjects'))
				currentSection = 'none';
			return;
		}

		switch (currentSection) {
			case 'graduateProfile':
				if (tag === 'table') {
					graduateProfile.push(...parseGraduateProfileTable($, $el));
				} else if (tag === 'ul' || tag === 'ol') {
					$el.find('> li').each((_j, li) => {
						const t = cleanText($(li));
						if (t) graduateProfile.push({ description: t });
					});
				}
				break;

			case 'knowledgeGroups':
				if (tag === 'ol' || tag === 'ul') {
					$el.find('> li').each((_j, li) => {
						const t = cleanText($(li));
						if (t) knowledgeGroups.push(t);
					});
				}
				break;

			case 'structure':
				if (tag === 'p' && text) structureSummary += (structureSummary ? '\n' : '') + text;
				if (tag === 'ul' || tag === 'ol') {
					$el.find('> li').each((_j, li) => {
						const t = cleanText($(li));
						if (t) structureSummary += '\n• ' + t;
					});
				}
				break;
		}
	});

	semesters.sort((a: any, b: any) => a.semester - b.semester);
	return {
		graduateProfile,
		knowledgeGroups,
		structureSummary,
		semesters,
		optionalSubjects,
		guidebookUrl,
		curriculumUrl,
	};
}

// ─── Subject RPS resources parser ───

function slugFromRpsUrl(rpsUrl: string): string {
	try {
		const u = new URL(rpsUrl, BASE_URL);
		const parts = u.pathname.split('/').filter(Boolean);
		return (parts[parts.length - 1] || '').toLowerCase().trim();
	} catch {
		return '';
	}
}

async function parseSubjectRpsResources(
	rpsUrl: string,
	subjectName: string,
): Promise<{ slug: string; subjectName: string; materiPpt: { label: string; url: string }[]; linkFile: { label: string; url: string }[]; parsedAt: Date } | null> {
	const slug = slugFromRpsUrl(rpsUrl);
	if (!slug) return null;

	const $ = await fetchPage(rpsUrl);
	const root = getContentRoot($);
	if (!root.length) return { slug, subjectName, materiPpt: [], linkFile: [], parsedAt: new Date() };

	const materiPpt: { label: string; url: string }[] = [];
	const linkFile: { label: string; url: string }[] = [];
	const seenMateriUrls = new Set<string>();

	root.find('table').each((_i, tbl) => {
		$(tbl).find('a[href]').each((_j, a) => {
			const $a = $(a);
			const label = cleanText($a).trim();
			const href = ($a.attr('href') || '').trim();
			if (!href || !label) return;
			if (/materi\s*\d*/i.test(label) && !seenMateriUrls.has(href)) {
				seenMateriUrls.add(href);
				materiPpt.push({ label, url: href });
			}
		});
	});

	root.find('a[href]').each((_i, a) => {
		const $a = $(a);
		const label = cleanText($a).trim();
		const href = ($a.attr('href') || '').trim();
		if (!href) return;

		const isPresentationLink = /docs\.google\.com\/presentation/i.test(href) ||
			/\/presentation\/d\//i.test(href);
		const isMateriLabel = /materi\s*\d*/i.test(label);

		if ((isMateriLabel || isPresentationLink) && !seenMateriUrls.has(href)) {
			seenMateriUrls.add(href);
			const finalLabel = isMateriLabel ? label : `Materi ${materiPpt.length + 1}`;
			materiPpt.push({ label: finalLabel, url: href });
		}

		if (/link\s*file/i.test(label) || (/drive\.google\.com\/file\/d\//i.test(href) && !isMateriLabel)) {
			const fileLabel = label || 'Link File';
			if (!linkFile.some((f) => f.url === href)) {
				linkFile.push({ label: fileLabel, url: href });
			}
		}
	});

	return { slug, subjectName, materiPpt, linkFile, parsedAt: new Date() };
}

/** Parse satu koleksi <details> (accordion lab) menjadi array lab. */
function parseLabsFromDetails(
	$: cheerio.CheerioAPI,
	$details: cheerio.Cheerio<any>,
	extractLabName: (t: string) => string,
	collectImgUrls: ($container: cheerio.Cheerio<any>) => string[],
): any[] {
	const labs: any[] = [];
	$details.each((_i, det) => {
		const $det = $(det);
		const $summary = $det.find('summary').first();
		const nameRaw = cleanText($summary.find('h5, h4, h3, .e-n-accordion-item-title-text').first());
		const name = extractLabName(nameRaw) || nameRaw.trim();
		if (!name) return;

		const imageUrls = collectImgUrls($det);

		let description = '';
		$det.find('.elementor-image-box-description').each((_j, el) => {
			const t = $(el).text().replace(/\s+/g, ' ').trim();
			if (t && !description.includes(t)) description += (description ? '\n\n' : '') + t;
		});
		if (!description) {
			$det.find('.toggle-content p, .elementor-widget-text-editor p').each((_j, el) => {
				const t = $(el).text().replace(/\s+/g, ' ').trim();
				if (t && !description.includes(t)) description += (description ? '\n\n' : '') + t;
			});
		}
		if (!description) {
			$det.find('p').each((_j, el) => {
				const t = $(el).text().replace(/\s+/g, ' ').trim();
				if (t.length > 20 && !description.includes(t)) description += (description ? '\n\n' : '') + t;
			});
		}

		labs.push({
			name,
			description: description.trim(),
			imageUrl: imageUrls[0] || '',
			imageUrls,
		});
	});
	return labs;
}

/** Fallback teaching: heading h4/h5 \"… Laboratory\" + widget sibling berikutnya (tanpa <details>). */
function parseTeachingLabsFromHeadings(
	$: cheerio.CheerioAPI,
	extractLabName: (t: string) => string,
	pageTitle: string,
): any[] {
	const labs: any[] = [];
	const selectors =
		'main h4, main h5, article h4, article h5, .elementor-widget-heading h4, .elementor-widget-heading h5, .e-n-accordion-item-title-text, summary h5';
	$(selectors).each((_i, el) => {
		const $h = $(el);
		if ($h.closest('nav,header,footer,.site-header,.site-footer').length) return;

		const nameRaw = cleanText($h);
		const name = extractLabName(nameRaw) || nameRaw.trim();
		if (!name) return;
		const lower = name.toLowerCase();
		if (lower === pageTitle || lower === 'teaching laboratory') return;

		const $widget = $h.closest('.elementor-widget, .elementor-element');
		const $row = $widget.length ? $widget : $h.parent();

		let description = '';
		const seenUrl = new Set<string>();
		const imageUrls: string[] = [];

		let $w = $row.next();
		let guard = 0;
		while ($w.length && guard++ < 40) {
			const $nextLabTitle = $w.find('.elementor-widget-heading h4, .elementor-widget-heading h5, .e-n-accordion-item-title-text').first();
			if ($nextLabTitle.length) {
				const nt = cleanText($nextLabTitle);
				const nnext = extractLabName(nt) || nt.trim();
				if (nnext && nnext !== name && /\blaboratory\b/i.test(nt)) break;
			}

			$w.find('.elementor-image-box-description, .toggle-content p, .elementor-widget-text-editor p').each((___, p) => {
				const t = $(p).text().replace(/\s+/g, ' ').trim();
				if (t.length > 15 && !description.includes(t)) description += (description ? '\n\n' : '') + t;
			});
			$w.find('img[src],img[data-src]').each((___, img) => {
				const u = normalizeHref($(img).attr('src') || $(img).attr('data-src') || '');
				if (u && !seenUrl.has(u)) {
					seenUrl.add(u);
					imageUrls.push(u);
				}
			});
			$w = $w.next();
		}

		labs.push({
			name,
			description: description.trim(),
			imageUrl: imageUrls[0] || '',
			imageUrls,
		});
	});

	const byName = new Map<string, any>();
	for (const l of labs) {
		const k = l.name.toLowerCase().trim();
		if (!byName.has(k)) byName.set(k, l);
	}
	return Array.from(byName.values());
}

// ─── Laboratories parser ───

async function parseLaboratories(type: 'teaching' | 'research'): Promise<any[]> {
	const url = type === 'teaching' ? SOURCES.teachingLab : SOURCES.researchLab;
	const $ = await fetchPage(url);
	const root = getContentRoot($);
	if (!root.length) return [];

	const pageTitle =
		type === 'teaching' ? 'teaching laboratory' : 'research laboratory';

	const extractLabName = (t: string): string => {
		const raw = t || '';
		if (!raw) return '';
		const m = raw.match(/(.+?\bLaboratory\b)/i);
		if (!m) return '';
		const name = m[1].trim();
		const lower = name.toLowerCase();
		if (lower === pageTitle) return '';
		if (type === 'teaching' && lower.includes('teaching laboratory')) return '';
		if (type === 'research' && lower.includes('research laboratory')) return '';
		return name;
	};

	const collectImgUrls = ($container: cheerio.Cheerio<any>): string[] => {
		const urls: string[] = [];
		const seen = new Set<string>();
		$container.find('img[src],img[data-src]').each((_i, img) => {
			const $img = $(img);
			const src = normalizeHref($img.attr('src') || $img.attr('data-src') || '');
			if (src && !seen.has(src)) {
				seen.add(src);
				urls.push(src);
			}
		});
		return urls;
	};

	// ── Teaching: accordion <details> di root → fallback body → semua <details> dengan summary "Laboratory" → heading-only
	const detailsSelector = 'details.e-n-accordion-item, details[class*="accordion"]';
	const detailsBodySelector =
		'details.e-n-accordion-item, details[class*="accordion"], .e-n-accordion details, div.e-n-accordion details';

	const detRoot = root.find(detailsSelector);
	const detBody = $('body').find(detailsBodySelector);
	const detWide = $('body')
		.find('details')
		.filter((_i, d) => /\blaboratory\b/i.test(cleanText($(d).find('summary').first())));

	if (type === 'teaching') {
		let labs: any[] = [];
		if (detRoot.length > 0) {
			labs = parseLabsFromDetails($, detRoot, extractLabName, collectImgUrls);
		}
		if (labs.length === 0 && detBody.length > 0) {
			labs = parseLabsFromDetails($, detBody, extractLabName, collectImgUrls);
		}
		if (labs.length === 0 && detWide.length > 0) {
			labs = parseLabsFromDetails($, detWide, extractLabName, collectImgUrls);
		}
		if (labs.length === 0) {
			labs = parseTeachingLabsFromHeadings($, extractLabName, pageTitle);
		}

		console.warn(
			`[prodi-sync] teaching laboratories: details root=${detRoot.length} body=${detBody.length} wide=${detWide.length} → labs=${labs.length}`,
		);

		if (labs.length > 0) return labs;
	} else {
		// Research: tetap hanya subtree konten (accordion jarang)
		if (detRoot.length > 0) {
			const labs = parseLabsFromDetails($, detRoot, extractLabName, collectImgUrls);
			if (labs.length > 0) return labs;
		}
	}

	// ── Generic block-walking parser (research & fallback) ──
	const labs: any[] = [];
	let currentName = '';
	let currentDesc = '';
	let currentImageUrls: string[] = [];

	const flush = () => {
		if (currentName) {
			labs.push({
				name: currentName,
				description: currentDesc.trim(),
				imageUrl: currentImageUrls[0] || '',
				imageUrls: [...currentImageUrls],
			});
		}
		currentName = '';
		currentDesc = '';
		currentImageUrls = [];
	};

	const addImage = (src: string) => {
		const normalized = normalizeHref(src);
		if (normalized && !currentImageUrls.includes(normalized)) currentImageUrls.push(normalized);
	};

	const blockEls = root.find('h1,h2,h3,h4,h5,h6,p,div,strong,td,th,ul,ol,figure,img').toArray();
	for (const el of blockEls) {
		const $el = $(el);
		const tag = ((el as any).tagName || (el as any).name || '').toLowerCase();

		if ($el.closest('nav,header,footer,.site-header,.site-footer').length) continue;

		const text = cleanText($el);
		const lower = text.toLowerCase();

		const looksLikeLabName =
			lower.includes('laboratory') &&
			!lower.includes('laboratory aims') &&
			!lower.includes('laboratory is equipped');

		if (/^h[1-6]$/.test(tag)) {
			if (
				lower.length < 4 ||
				lower.includes('search') ||
				lower.includes('login') ||
				lower.includes('siam') ||
				lower.includes('miu') ||
				lower.includes('powered')
			) continue;

			if (
				lower === pageTitle ||
				(lower.includes('teaching laboratory') && type === 'teaching') ||
				(lower.includes('research laboratory') && type === 'research')
			) {
				flush();
				continue;
			}

			if (lower.includes('laboratory') || (/^h[3-6]$/.test(tag) && text.length > 4)) {
				const extracted = extractLabName(text);
				flush();
				currentName = extracted || text;
				const $container = $el.closest('div,figure,article,li,td,th,tr');
				if ($container.length) {
					$container.find('img[src],img[data-src]').each((_i, img) => {
						addImage($(img).attr('src') || $(img).attr('data-src') || '');
					});
				}
			}
			continue;
		}

		if (looksLikeLabName) {
			const extracted = extractLabName(text);
			if (!extracted) continue;
			if (extracted === currentName) continue;

			flush();
			currentName = extracted;
			currentDesc = '';
			currentImageUrls = [];

			const $container = $el.closest('div,figure,article,li,td,th,tr');
			if ($container.length) {
				$container.find('img[src],img[data-src]').each((_i, img) => {
					addImage($(img).attr('src') || $(img).attr('data-src') || '');
				});
			}
			continue;
		}

		if (tag === 'img' && currentName) {
			addImage($el.attr('src') || $el.attr('data-src') || '');
			continue;
		}

		if (tag === 'figure' && currentName) {
			$el.find('img').each((_i, img) => {
				addImage($(img).attr('src') || $(img).attr('data-src') || '');
			});
			continue;
		}

		if (tag === 'div') {
			if (!currentName) continue;
			if ($el.find('h1,h2,h3,h4,h5,h6').length) continue;
			$el.find('img').each((_i, img) => {
				addImage($(img).attr('src') || $(img).attr('data-src') || '');
			});
			const ownText = $el.clone().children('div,figure,ul,ol,h1,h2,h3,h4,h5,h6').remove().end().text().replace(/\s+/g, ' ').trim();
			if (ownText.length > 20 && !currentDesc.includes(ownText)) {
				currentDesc += (currentDesc ? '\n\n' : '') + ownText;
			}
			continue;
		}

		if ((tag === 'td' || tag === 'th') && currentName && text) {
			if (!looksLikeLabName && text.length > 30 && !currentDesc.includes(text)) {
				currentDesc += (currentDesc ? '\n\n' : '') + text;
			}
			continue;
		}

		if (tag === 'p' && currentName && text) {
			if (!currentDesc.includes(text)) {
				currentDesc += (currentDesc ? '\n\n' : '') + text;
			}
		} else if ((tag === 'ul' || tag === 'ol') && !currentName) {
			$el.find('> li').each((_j, li) => {
				const t = cleanText($(li));
				if (t) labs.push({ name: t, description: '', imageUrl: '', imageUrls: [] });
			});
		} else if ((tag === 'ul' || tag === 'ol') && currentName) {
			$el.find('> li').each((_j, li) => {
				const t = cleanText($(li));
				if (t) currentDesc += (currentDesc ? '\n' : '') + '• ' + t;
			});
		}
	}

	flush();
	return labs;
}

function countLecturerLinks(data: { headAndSecretary: any[]; groups: LecturerGroup[]; staff: any[] } | null): number {
	if (!data) return 0;
	let n = data.headAndSecretary.length + data.staff.length;
	for (const g of data.groups) n += g.lecturers.length;
	return n;
}

type AccreditationItem = {
	group: string;
	title: string;
	downloadUrl: string;
	yearLabel: string;
	isPrimary: boolean;
};

type AccreditationLevel = {
	title: string;
	sourceUrl: string;
	groups: string[];
	items: AccreditationItem[];
	lastSyncedAt: Date | null;
	lastError: string;
};

function looksLikeDocumentUrl(url: string): boolean {
	const u = (url || '').toLowerCase();
	return (
		u.includes('drive.google.com') ||
		u.endsWith('.pdf') ||
		u.endsWith('.jpg') ||
		u.endsWith('.jpeg') ||
		u.endsWith('.png') ||
		u.endsWith('.webp')
	);
}

function parseYearLabel(text: string): string {
	const m = (text || '').match(/(19|20)\d{2}(?:\s*[-–]\s*(19|20)\d{2})?/);
	return m ? m[0].replace(/\s+/g, '') : '';
}

async function parseAccreditationLevel(sourceUrl: string, fallbackTitle: string): Promise<AccreditationLevel> {
	const $ = await fetchPage(sourceUrl);
	const root = getContentRoot($);
	const groups: string[] = [];
	const items: AccreditationItem[] = [];

	const heading =
		cleanText(root.find('h1,h2').first()) ||
		fallbackTitle;

	root.find('table').each((_ti, tbl) => {
		const $tbl = $(tbl);
		const rows = $tbl.find('tr').toArray();
		if (!rows.length) return;

		let titleIdx = 0;
		let downloadIdx = 1;
		for (const tr of rows.slice(0, 2)) {
			const cells = $(tr).find('th,td');
			const labels = cells.toArray().map((c) => cleanText($(c)).toLowerCase());
			const ti = labels.findIndex((x) => x.includes('title'));
			const di = labels.findIndex((x) => x.includes('download'));
			if (ti >= 0) titleIdx = ti;
			if (di >= 0) downloadIdx = di;
		}

		let currentGroup = '';
		for (const tr of rows) {
			const cells = $(tr).find('td,th');
			if (cells.length < 1) continue;

			const titleCell = cells.eq(titleIdx);
			const title = cleanText(titleCell);
			const linkInDownload = cells.eq(downloadIdx).find('a[href]').attr('href') || '';
			const linkInTitle = titleCell.find('a[href]').attr('href') || '';
			const rawUrl = normalizeHref(linkInDownload || linkInTitle);

			if (!title) continue;
			if (title.toLowerCase() === 'title') continue;
			if (title.toLowerCase() === 'download') continue;

			const isGroupRow = !rawUrl && (titleCell.find('strong').length > 0 || /^[A-Z0-9\s:().-]+$/.test(title));
			if (isGroupRow) {
				currentGroup = title;
				if (!groups.includes(currentGroup)) groups.push(currentGroup);
				continue;
			}

			if (!looksLikeDocumentUrl(rawUrl) && !rawUrl) continue;
			items.push({
				group: currentGroup,
				title,
				downloadUrl: rawUrl,
				yearLabel: parseYearLabel(title || currentGroup),
				isPrimary: /sertifikat akreditasi|sk sertifikat/i.test(title),
			});
		}
	});

	// fallback jika struktur table berubah (mis. Master Study profile page).
	if (items.length === 0) {
		root.find('a[href]').each((_i, a) => {
			const $a = $(a);
			const url = normalizeHref($a.attr('href') || '');
			if (!url || !looksLikeDocumentUrl(url)) return;
			const linkTitle = cleanText($a);
			const contextTitle = cleanText($a.closest('tr,li,p,div').first());
			const title = linkTitle || contextTitle;
			if (!title) return;
			const blob = `${title} ${url}`.toLowerCase();
			const accredLike =
				/akredit|lam.?infokom|sertifikat|file_sk|file_sertifikat|sk\/lam|baik sekali/.test(blob);
			// On profile-style pages, skip unrelated PDFs (visi-misi, RPS, etc.).
			if (sourceUrl.includes('master-study') && !accredLike) return;
			items.push({
				group: accredLike ? 'Akreditasi PRODI' : '',
				title,
				downloadUrl: url,
				yearLabel: parseYearLabel(title) || parseYearLabel(contextTitle),
				isPrimary: /sertifikat|sk sertifikat|lam.?infokom|file_sertifikat|file_sk/i.test(blob),
			});
		});
	}

	return {
		title: heading || fallbackTitle,
		sourceUrl,
		groups,
		items,
		lastSyncedAt: new Date(),
		lastError: '',
	};
}

function mergeAccreditationLevel(
	incoming: AccreditationLevel,
	previous: AccreditationLevel | null | undefined,
): AccreditationLevel {
	if (!previous?.items?.length) return incoming;
	const byUrl = new Map<string, AccreditationItem>();
	for (const it of previous.items) {
		if (it?.downloadUrl) byUrl.set(it.downloadUrl, it);
	}
	for (const it of incoming.items) {
		if (it?.downloadUrl) byUrl.set(it.downloadUrl, it);
	}
	const groups = Array.from(new Set([...(previous.groups || []), ...(incoming.groups || [])]));
	return {
		...incoming,
		groups,
		items: Array.from(byUrl.values()),
		lastError: '',
	};
}

async function discoverAccreditationS3Url(): Promise<string> {
	const seeds = [SOURCES.accreditationS1, SOURCES.accreditationS2, BASE_URL];
	const candidates = new Set<string>();
	for (const seed of seeds) {
		try {
			const $ = await fetchPage(seed);
			$('a[href]').each((_i, a) => {
				const href = normalizeHref($(a).attr('href') || '');
				if (!href.startsWith(BASE_URL)) return;
				const low = href.toLowerCase();
				if (!low.includes('accreditation')) return;
				if (low.includes('undergraduate-s1') || low.includes('master-s2')) return;
				if (/(s3|doctor|doctoral|phd)/i.test(low)) candidates.add(href);
			});
		} catch {
			// ignore single-source failure
		}
	}
	return Array.from(candidates)[0] || '';
}

function validateCrawledContent(
	profile: any,
	lecturerData: { headAndSecretary: any[]; groups: LecturerGroup[]; staff: any[] } | null,
	curriculum: any,
	teachingLabs: any[] | null,
	researchLabs: any[] | null,
): { criticalMissing: string[] } {
	const historyLen = (profile?.history || '').trim().length;
	const mission = profile?.mission?.length || 0;
	const objectives = profile?.objectives?.length || 0;
	const lec = countLecturerLinks(lecturerData);
	const sem = curriculum?.semesters?.length || 0;
	const opt = curriculum?.optionalSubjects?.length || 0;
	const tLab = teachingLabs?.length || 0;
	const rLab = researchLabs?.length || 0;

	const visionLen = (profile?.vision || '').trim().length;
	const strategyLen = (profile?.strategy || '').trim().length;
	const milestonesLen = profile?.milestones?.length || 0;
	const mgmtLen = profile?.managements?.length || 0;
	const hasProfile =
		historyLen > 50 ||
		visionLen > 20 ||
		strategyLen > 10 ||
		mission > 0 ||
		objectives > 0 ||
		milestonesLen > 0 ||
		mgmtLen > 0;
	// Ringkasan counts untuk debug cepat
	console.log(
		`Prodi sync summary: lecturers=${lec}, semesters=${sem}, optionalSubjects=${opt}, teachingLabs=${tLab}, researchLabs=${rLab}, managementPeriods=${mgmtLen}`,
	);

	const criticalMissing: string[] = [];
	if (lec === 0) criticalMissing.push(`dosen (${lec})`);
	if (sem === 0) criticalMissing.push(`kurikulum (${sem} semester)`);

	const missingNonCritical: string[] = [];
	if (tLab === 0) missingNonCritical.push('teachingLabs');
	if (!hasProfile) missingNonCritical.push('profil');
	if (rLab === 0) missingNonCritical.push('research labs');
	if (missingNonCritical.length > 0) {
		console.warn(`⚠️ Prodi sync: beberapa section non-krusial kosong: ${missingNonCritical.join(', ')}`);
	}

	return { criticalMissing };
}

function buildSummary(
	profile: any,
	lecturerData: { headAndSecretary: any[]; groups: LecturerGroup[]; staff: any[] } | null,
	curriculum: any,
	teachingLabs: any[] | null,
	researchLabs: any[] | null,
	ok: boolean,
	error?: string,
): ProdiSyncSummary {
	return {
		ok,
		error,
		profileHistoryLen: (profile?.history || '').trim().length,
		missionCount: profile?.mission?.length ?? 0,
		objectivesCount: profile?.objectives?.length ?? 0,
		lecturerLinks: countLecturerLinks(lecturerData),
		semestersCount: curriculum?.semesters?.length ?? 0,
		optionalSubjectsCount: curriculum?.optionalSubjects?.length ?? 0,
		teachingLabs: teachingLabs?.length ?? 0,
		researchLabs: researchLabs?.length ?? 0,
	};
}

function findOldLecturerPhotoUrl(existingContent: any, slug: string): string | undefined {
	try {
		const lecturers = existingContent?.lecturers;
		const candidates: any[] = [];
		if (lecturers?.headAndSecretary) candidates.push(...lecturers.headAndSecretary);
		if (lecturers?.staff) candidates.push(...lecturers.staff);
		if (lecturers?.groups) {
			for (const g of lecturers.groups) {
				if (g?.lecturers) candidates.push(...g.lecturers);
			}
		}
		const hit = candidates.find((p) => slugFromProfileUrlBackend(p?.profileUrl || '') === slug);
		return hit?.photoUrl;
	} catch {
		return undefined;
	}
}

// ─── Scoped sync types ───

export type ProdiSyncScope =
	| 'all'
	| 'profile'
	| 'lecturers'
	| 'curriculum'
	| 'labs'
	| 'accreditation'
	| 'academicCalendar'
	| 'studentResources';

export type ProdiSyncScopedResult = ProdiSyncSummary & {
	curriculumYearAction?: 'created' | 'overwritten' | 'needs_confirm';
	curriculumTargetYear?: number;
	curriculumProcessedYears?: number[];
	curriculumCreatedYears?: number[];
	curriculumOverwrittenYears?: number[];
	curriculumNeedsConfirmYears?: number[];
	calendarYears?: number[];
	calendarSkipped?: number[];
	announcementCount?: number;
	pklTemplates?: number;
	studentResourcesOk?: boolean;
};

// ─── Scoped sync orchestrator ───

export async function runProdiSyncScoped(
	scope: ProdiSyncScope = 'all',
	options?: { overwrite?: boolean },
): Promise<ProdiSyncScopedResult> {
	if (syncing) {
		return {
			ok: false,
			error: 'already_running',
			profileHistoryLen: 0, missionCount: 0, objectivesCount: 0,
			lecturerLinks: 0, semestersCount: 0, optionalSubjectsCount: 0,
			teachingLabs: 0, researchLabs: 0,
		};
	}
	syncing = true;

	let profile: any = null;
	let lecturerData: { headAndSecretary: any[]; groups: LecturerGroup[]; staff: any[] } | null = null;
	let curriculum: any = null;
	let curriculumByYearParsed: {
		year: number;
		url: string;
		level?: 's1' | 's2';
		payload: any;
	}[] = [];
	let teachingLabs: any[] | null = null;
	let researchLabs: any[] | null = null;
	let accreditation: any = null;
	let curriculumYearAction: 'created' | 'overwritten' | 'needs_confirm' | undefined;
	let curriculumTargetYear: number | undefined;
	let curriculumProcessedYears: number[] = [];
	let curriculumCreatedYears: number[] = [];
	let curriculumOverwrittenYears: number[] = [];
	let curriculumNeedsConfirmYears: number[] = [];

	const doProfile = scope === 'all' || scope === 'profile';
	const doLecturers = scope === 'all' || scope === 'lecturers';
	const doCurriculum = scope === 'all' || scope === 'curriculum';
	const doLabs = scope === 'all' || scope === 'labs';
	const doAccreditation = scope === 'all' || scope === 'accreditation';
	const doStudentResources =
		scope === 'all' || scope === 'academicCalendar' || scope === 'studentResources';

	let calendarYears: number[] = [];
	let calendarSkipped: number[] = [];
	let announcementCount = 0;
	let pklTemplates = 0;
	let studentResourcesOk = true;

	try {
		await mongoStorage.setProdiSyncStatus('syncing');
		console.log(`🔄 Starting prodi sync (scope=${scope})...`);

		const tasks: Promise<any>[] = [];
		const taskNames: string[] = [];

		if (doProfile) { tasks.push(parseProfile().catch(e => { console.error('Profile parse error:', e); return null; })); taskNames.push('profile'); }
		if (doLecturers) { tasks.push(parseLecturerList().catch(e => { console.error('Lecturer list parse error:', e); return null; })); taskNames.push('lecturers'); }
		if (doCurriculum) {
			tasks.push(
				(async () => {
					const [s1Entries, s2Entries] = await Promise.all([
						parseCurriculumIndexEntries(),
						parseCurriculumMasterIndexEntries(),
					]);
					const entries = [...s1Entries, ...s2Entries];
					const parsed: { year: number; url: string; level: 's1' | 's2'; payload: any }[] = [];
					for (const entry of entries) {
						try {
							const payload = await parseCurriculumFromUrl(entry.url);
							parsed.push({
								year: entry.year,
								url: entry.url,
								level: entry.level,
								payload: { ...payload, level: entry.level },
							});
						} catch (err) {
							console.error(
								`Curriculum parse error for ${entry.level} year ${entry.year}:`,
								err,
							);
						}
					}
					return parsed;
				})().catch(e => { console.error('Curriculum parse error:', e); return []; }),
			);
			taskNames.push('curriculum');
		}
		if (doLabs) {
			tasks.push(parseLaboratories('teaching').catch(e => { console.error('Teaching lab parse error:', e); return null; }));
			tasks.push(parseLaboratories('research').catch(e => { console.error('Research lab parse error:', e); return null; }));
			taskNames.push('teachingLab', 'researchLab');
		}

		const results = await Promise.all(tasks);
		let ri = 0;
		for (const name of taskNames) {
			if (name === 'profile') profile = results[ri++];
			else if (name === 'lecturers') lecturerData = results[ri++];
			else if (name === 'curriculum') curriculumByYearParsed = results[ri++] || [];
			else if (name === 'teachingLab') teachingLabs = results[ri++];
			else if (name === 'researchLab') researchLabs = results[ri++];
		}

		if (doCurriculum && curriculumByYearParsed.length > 0) {
			const s1Sorted = [...curriculumByYearParsed]
				.filter((x: any) => (x.level || 's1') === 's1')
				.sort((a, b) => b.year - a.year);
			curriculum = (s1Sorted[0] || curriculumByYearParsed[0]).payload;
		}

		// Enrich lecturer details
		if (doLecturers && lecturerData) {
			await enrichLecturerDetails(lecturerData);
		}

		// Enrich management members in profile
		if (doProfile && profile?.managements?.length) {
			await enrichManagementMembers(profile);
		}

		// Crawl RPS resources
		if (doCurriculum && curriculumByYearParsed.length) {
			for (const row of curriculumByYearParsed) {
				await crawlRpsResources(row.payload);
			}
		}

		// Cache images
		const existingDoc = await mongoStorage.getProdiContent();
		const existingContent = existingDoc?.content ?? {};
		const overridesDoc = existingDoc?.overrides ?? {};
		const cachedDestUrls = new Set<string>();

		if (doAccreditation) {
			const s3ManualUrl = (existingContent?.accreditation?.s3ManualUrl || '').trim();
			const discoveredS3Url = s3ManualUrl || await discoverAccreditationS3Url();
			const emptyLevel = (title: string, sourceUrl: string): AccreditationLevel => ({
				title,
				sourceUrl,
				groups: [],
				items: [],
				lastSyncedAt: null,
				lastError: '',
			});
			const safeParseLevel = async (url: string, title: string): Promise<AccreditationLevel> => {
				try {
					return await parseAccreditationLevel(url, title);
				} catch (err: any) {
					const prev =
						title.includes('Master')
							? existingContent?.accreditation?.s2
							: title.includes('Undergraduate')
								? existingContent?.accreditation?.s1
								: null;
					console.warn(`Accreditation parse soft-fail (${title}):`, err?.message || err);
					return {
						...(prev && typeof prev === 'object' ? prev : emptyLevel(title, url)),
						title,
						sourceUrl: url,
						lastSyncedAt: new Date(),
						lastError: err?.message || 'Failed to sync accreditation level',
					};
				}
			};
			const [s1Raw, s2Raw] = await Promise.all([
				safeParseLevel(SOURCES.accreditationS1, 'Accreditation Certificate For Undergraduate (S1)'),
				safeParseLevel(SOURCES.accreditationS2, 'Accreditation Certificate For Master (S2)'),
			]);
			// Master page is profile-style (few live links); merge keeps historical certificate rows.
			const s1 = mergeAccreditationLevel(s1Raw, existingContent?.accreditation?.s1);
			const s2 = mergeAccreditationLevel(s2Raw, existingContent?.accreditation?.s2);
			let s3: AccreditationLevel = emptyLevel(
				'Accreditation Certificate For Doctoral (S3)',
				discoveredS3Url,
			);
			if (discoveredS3Url) {
				s3 = mergeAccreditationLevel(
					await safeParseLevel(discoveredS3Url, 'Accreditation Certificate For Doctoral (S3)'),
					existingContent?.accreditation?.s3,
				);
			}
			accreditation = {
				s1,
				s2,
				s3,
				s3ManualUrl,
				lastSyncAt: new Date(),
			};
		}

		if (doProfile) {
			await cacheProfileImages(profile, existingContent, overridesDoc, cachedDestUrls);
		}
		if (doLecturers && lecturerData) {
			await cacheLecturerImages(lecturerData, existingContent, overridesDoc, cachedDestUrls);
		}
		if (doLabs) {
			await cacheLabImages(teachingLabs, researchLabs, existingContent, overridesDoc, cachedDestUrls);
		}

		// Build crawled content and apply
		const crawledContent: any = {};
		const forceFields: string[] = [];

		if (doProfile && profile) crawledContent.profile = profile;
		if (doLecturers && lecturerData) crawledContent.lecturers = lecturerData;
		if (doLabs) {
			crawledContent.laboratories = {
				teaching: teachingLabs || [],
				research: researchLabs || [],
			};
			forceFields.push('laboratories.teaching', 'laboratories.research');
		}
		if (doAccreditation && accreditation) {
			crawledContent.accreditation = accreditation;
		}

		// Student hub (calendar / portals / guides / skripsi / PKL / RSS) — isolated failures
		if (doStudentResources) {
			try {
				const { runStudentResourcesSync } = await import('./prodi-student-resources');
				const existingHub = existingContent?.studentHub || {};
				const { hub, summary: hubSummary } = await runStudentResourcesSync(existingHub);
				if (scope === 'academicCalendar') {
					crawledContent.studentHub = {
						...existingHub,
						academicCalendars: hub.academicCalendars,
						portals: existingHub.portals?.length ? existingHub.portals : hub.portals,
						guides: existingHub.guides?.length ? existingHub.guides : hub.guides,
					};
				} else {
					crawledContent.studentHub = hub;
				}
				forceFields.push(
					'studentHub.academicCalendars',
					'studentHub.announcements',
					'studentHub.skripsiHub',
					'studentHub.pklHub',
				);
				// portals/guides: only seed when empty inside runStudentResourcesSync — not force-written
				if (!existingHub.portals?.length) forceFields.push('studentHub.portals');
				if (!existingHub.guides?.length) forceFields.push('studentHub.guides');
				calendarYears = hubSummary.calendarYears || [];
				calendarSkipped = hubSummary.calendarSkipped || [];
				announcementCount = hubSummary.announcementCount || 0;
				pklTemplates = hubSummary.pklTemplates || 0;
				studentResourcesOk = hubSummary.ok !== false;
				if (hubSummary.error) console.warn('Student resources warning:', hubSummary.error);
			} catch (err: any) {
				console.error('Student resources sync isolated failure:', err);
				studentResourcesOk = false;
				// Do not fail the whole sync
			}
		}

		// Curriculum goes through year-based storage (S1 + S2)
		if (doCurriculum && curriculumByYearParsed.length) {
			const sortedByYear = [...curriculumByYearParsed].sort((a, b) => {
				const la = (a as any).level === 's2' ? 1 : 0;
				const lb = (b as any).level === 's2' ? 1 : 0;
				if (la !== lb) return la - lb;
				return a.year - b.year;
			});
			curriculumProcessedYears = sortedByYear.map((x) => x.year);
			let latestSuccessPayload: any = null;
			for (const row of sortedByYear) {
				const year = row.year;
				const level = ((row as any).level || 's1') as 's1' | 's2';
				curriculumTargetYear = year;
				const periodLabel =
					level === 's2' ? `${year}-${year + 2}` : `${year}-${year + 4}`;
				const syncPayload = {
					...row.payload,
					level,
					periodLabel: row.payload?.periodLabel || periodLabel,
					officialUrl:
						row.payload?.officialUrl ||
						(level === 's2'
							? SOURCES.curriculumMasterIndex
							: SOURCES.curriculumIndex),
					curriculumUrl:
						row.payload?.curriculumUrl || row.url || '',
					guidebookUrl: row.payload?.guidebookUrl || '',
					source: 'sync' as const,
				};
				const result = await mongoStorage.upsertProdiCurriculumByYear(
					year,
					syncPayload,
					{ overwrite: options?.overwrite, level },
				);
				if (result.action === 'needs_confirm') {
					curriculumNeedsConfirmYears.push(year);
					continue;
				}
				if (result.action === 'created') curriculumCreatedYears.push(year);
				if (result.action === 'overwritten') curriculumOverwrittenYears.push(year);
				if (level === 's1') latestSuccessPayload = syncPayload;
			}

			if (curriculumNeedsConfirmYears.length > 0) {
				curriculumYearAction = 'needs_confirm';
			} else if (curriculumOverwrittenYears.length > 0) {
				curriculumYearAction = 'overwritten';
			} else if (curriculumCreatedYears.length > 0) {
				curriculumYearAction = 'created';
			}

			// Update legacy content.curriculum dengan payload terbaru yang sukses di-upsert.
			if (latestSuccessPayload) {
				crawledContent.curriculum = latestSuccessPayload;
				forceFields.push(
					'curriculum.semesters',
					'curriculum.optionalSubjects',
					'curriculum.subjectRpsResources',
					'curriculum.graduateProfile',
					'curriculum.knowledgeGroups',
					'curriculum.structureSummary',
					'curriculum.guidebookUrl',
					'curriculum.curriculumUrl',
					'curriculum.periodLabel',
				);
			}
		}

		if (curriculumNeedsConfirmYears.length > 0 && options?.overwrite !== true) {
			if (Object.keys(crawledContent).length > 0) {
				await mongoStorage.applyAutoSyncData(crawledContent, { forceFields });
			}
			await mongoStorage.setProdiSyncStatus('idle');
			const summary = buildSummary(profile, lecturerData, curriculum, teachingLabs, researchLabs, true);
			return {
				...summary,
				curriculumYearAction: 'needs_confirm',
				curriculumTargetYear: curriculumNeedsConfirmYears[0],
				curriculumProcessedYears,
				curriculumCreatedYears,
				curriculumOverwrittenYears,
				curriculumNeedsConfirmYears,
				calendarYears,
				calendarSkipped,
				announcementCount,
				pklTemplates,
				studentResourcesOk,
			};
		}

		if (Object.keys(crawledContent).length > 0) {
			await mongoStorage.applyAutoSyncData(crawledContent, { forceFields });
		}

		if (doStudentResources) {
			try {
				const fresh = await mongoStorage.getProdiContent();
				(fresh as any).lastAnnouncementSyncAt = new Date();
				await fresh.save();
			} catch {
				/* ignore */
			}
		}

		const validation = validateCrawledContent(profile, lecturerData, curriculum, teachingLabs, researchLabs);

		if (validation.criticalMissing.length > 0 && scope === 'all') {
			const reason = `Crawler menghasilkan data kosong untuk bagian krusial: ${validation.criticalMissing.join(', ')}. Periksa struktur HTML situs sumber atau koneksi jaringan.`;
			await mongoStorage.setProdiSyncStatus('error', reason);
			const summary = buildSummary(profile, lecturerData, curriculum, teachingLabs, researchLabs, false, reason);
			return {
				...summary,
				curriculumYearAction,
				curriculumTargetYear,
				curriculumProcessedYears,
				curriculumCreatedYears,
				curriculumOverwrittenYears,
				curriculumNeedsConfirmYears,
				calendarYears,
				calendarSkipped,
				announcementCount,
				pklTemplates,
				studentResourcesOk,
			};
		}

		await mongoStorage.setProdiSyncStatus('idle');
		const summary = buildSummary(profile, lecturerData, curriculum, teachingLabs, researchLabs, true);
		console.log(`✅ Prodi sync (scope=${scope}) completed`, summary);
		return {
			...summary,
			curriculumYearAction,
			curriculumTargetYear,
			curriculumProcessedYears,
			curriculumCreatedYears,
			curriculumOverwrittenYears,
			curriculumNeedsConfirmYears,
			calendarYears,
			calendarSkipped,
			announcementCount,
			pklTemplates,
			studentResourcesOk,
		};
	} catch (error: any) {
		console.error('Prodi sync failed:', error);
		const msg = error?.message || 'Unknown error';
		await mongoStorage.setProdiSyncStatus('error', msg);
		return {
			...buildSummary(profile, lecturerData, curriculum, teachingLabs, researchLabs, false, msg),
			curriculumYearAction,
			curriculumTargetYear,
			curriculumProcessedYears,
			curriculumCreatedYears,
			curriculumOverwrittenYears,
			curriculumNeedsConfirmYears,
			calendarYears,
			calendarSkipped,
			announcementCount,
			pklTemplates,
			studentResourcesOk: false,
		};
	} finally {
		syncing = false;
	}
}

// ─── Helper functions for scoped sync ───

async function enrichLecturerDetails(lecturerData: { headAndSecretary: any[]; groups: LecturerGroup[]; staff: any[] }) {
	const allLecturers: { groupIdx: number; lecIdx: number }[] = [];
	lecturerData.groups.forEach((group, gi) => {
		group.lecturers.forEach((_lec, li) => {
			allLecturers.push({ groupIdx: gi, lecIdx: li });
		});
	});

	const BATCH = 3;
	for (let i = 0; i < allLecturers.length; i += BATCH) {
		const batch = allLecturers.slice(i, i + BATCH);
		const details = await Promise.all(
			batch.map(({ groupIdx, lecIdx }) =>
				fetchLecturerDetail(lecturerData.groups[groupIdx].lecturers[lecIdx].profileUrl),
			),
		);
		for (let j = 0; j < batch.length; j++) {
			const { groupIdx, lecIdx } = batch[j];
			assignNonEmpty(lecturerData.groups[groupIdx].lecturers[lecIdx], details[j]);
		}
		if (i + BATCH < allLecturers.length) await new Promise((r) => setTimeout(r, 500));
	}

	for (const person of [...lecturerData.headAndSecretary, ...lecturerData.staff]) {
		if (person.profileUrl) {
			const detail = await fetchLecturerDetail(person.profileUrl);
			assignNonEmpty(person, detail);
			await new Promise((r) => setTimeout(r, 300));
		}
	}
}

async function enrichManagementMembers(profile: any) {
	for (const mgmt of profile.managements) {
		for (const member of mgmt.members || []) {
			if (member.profileUrl) {
				try {
					const detail = await fetchLecturerDetail(member.profileUrl);
					assignNonEmpty(member, detail);
					await new Promise((r) => setTimeout(r, 300));
				} catch (err) {
					console.warn(`Failed enriching management member ${member.name}:`, err);
				}
			}
		}
	}
}

async function crawlRpsResources(curriculum: any) {
	if (!curriculum?.semesters?.length && !curriculum?.optionalSubjects?.length) return;
	const allSubjects: any[] = [
		...(curriculum.semesters || []).flatMap((s: any) => s.subjects || []),
		...(curriculum.optionalSubjects || []),
	];
	const rpsUrlSet = new Set<string>();
	const rpsEntries: { rpsUrl: string; name: string }[] = [];
	for (const sub of allSubjects) {
		if (sub.rpsUrl && !rpsUrlSet.has(sub.rpsUrl)) {
			rpsUrlSet.add(sub.rpsUrl);
			rpsEntries.push({ rpsUrl: sub.rpsUrl, name: sub.name || '' });
		}
	}
	if (!rpsEntries.length) return;

	console.log(`🔗 Crawling RPS resources for ${rpsEntries.length} subjects…`);
	const subjectRpsResources: any[] = [];
	const RPS_BATCH = 3;
	for (let i = 0; i < rpsEntries.length; i += RPS_BATCH) {
		const batch = rpsEntries.slice(i, i + RPS_BATCH);
		const results = await Promise.all(
			batch.map(({ rpsUrl, name }) =>
				parseSubjectRpsResources(rpsUrl, name).catch((err) => {
					console.warn(`Failed to parse RPS for ${rpsUrl}:`, err);
					return null;
				}),
			),
		);
		for (const r of results) {
			if (r && r.slug) subjectRpsResources.push(r);
		}
		if (i + RPS_BATCH < rpsEntries.length) await new Promise((r) => setTimeout(r, 500));
	}
	curriculum.subjectRpsResources = subjectRpsResources;
	console.log(`✅ Parsed RPS resources: ${subjectRpsResources.length} subjects with materials`);
}

async function cacheProfileImages(
	profile: any,
	existingContent: any,
	overridesDoc: any,
	cachedDestUrls: Set<string>,
) {
	if (!profile) return;
	const profileOverrides = overridesDoc?.profile ?? {};
	const cacheManagements = profileOverrides?.managements !== true;

	const cacheLecturerPhotoFn = makeCacheLecturerPhotoFn(existingContent, cachedDestUrls);

	if (cacheManagements && profile?.managements?.length) {
		for (const mgmt of profile.managements) {
			for (const member of mgmt.members || []) {
				await cacheLecturerPhotoFn(member);
			}
		}
	}

	if (profile?.organizationStructureImageUrl && profileOverrides?.organizationStructureImageUrl !== true) {
		const orgUrl = profile.organizationStructureImageUrl;
		if (!(orgUrl.startsWith('/') && (orgUrl.includes('/uploads/') || orgUrl.includes('/attached_assets/')))) {
			const destUrl = `${UPLOADS_PRODI_BASE}/organization-structure.webp`;
			const oldLocal = existingContent?.profile?.organizationStructureImageUrl;
			const newUrl = await cacheRemoteImageToLocalWebp(orgUrl, destUrl, isLocalProdiAssetUrl(oldLocal) ? oldLocal : undefined);
			profile.organizationStructureImageUrl = newUrl || destUrl;
		}
	}
}

async function cacheLecturerImages(
	lecturerData: { headAndSecretary: any[]; groups: LecturerGroup[]; staff: any[] },
	existingContent: any,
	overridesDoc: any,
	cachedDestUrls: Set<string>,
) {
	const lecturerOverrides = overridesDoc?.lecturers ?? {};
	const cacheHeadAndSecretary = lecturerOverrides?.headAndSecretary !== true;
	const cacheGroups = lecturerOverrides?.groups !== true;
	const cacheStaff = lecturerOverrides?.staff !== true;

	const cacheLecturerPhotoFn = makeCacheLecturerPhotoFn(existingContent, cachedDestUrls);

	if (cacheHeadAndSecretary) {
		for (const p of lecturerData.headAndSecretary) await cacheLecturerPhotoFn(p);
	}
	if (cacheStaff) {
		for (const p of lecturerData.staff) await cacheLecturerPhotoFn(p);
	}
	if (cacheGroups) {
		for (const g of lecturerData.groups) {
			for (const p of g.lecturers) await cacheLecturerPhotoFn(p);
		}
	}
}

function makeCacheLecturerPhotoFn(existingContent: any, cachedDestUrls: Set<string>) {
	return async (person: any) => {
		if (!person?.photoUrl) return;
		if (person.photoUrl.startsWith('/') && (person.photoUrl.includes('/uploads/') || person.photoUrl.includes('/attached_assets/'))) return;

		const slug = slugFromProfileUrlBackend(person.profileUrl || '');
		if (!slug) return;
		const destUrl = `${UPLOADS_PRODI_BASE}/lecturers/${slug}.webp`;
		if (cachedDestUrls.has(destUrl) && fs.existsSync(localFilePathFromUrl(destUrl))) {
			person.photoUrl = destUrl;
			return;
		}

		const oldLocalUrl = findOldLecturerPhotoUrl(existingContent, slug);
		const newUrl = await cacheRemoteImageToLocalWebp(person.photoUrl, destUrl, oldLocalUrl);
		person.photoUrl = newUrl || destUrl;
		cachedDestUrls.add(destUrl);
	};
}

async function cacheLabImages(
	teachingLabs: any[] | null,
	researchLabs: any[] | null,
	existingContent: any,
	overridesDoc: any,
	cachedDestUrls: Set<string>,
) {
	const labsOverrides = overridesDoc?.laboratories ?? {};
	const cacheTeachingLabs = labsOverrides?.teaching !== true;
	const cacheResearchLabs = labsOverrides?.research !== true;

	const cacheLabImage = async (lab: any, type: 'teaching' | 'research', labIndex: number) => {
		const urls: string[] = lab.imageUrls?.length ? lab.imageUrls : (lab.imageUrl ? [lab.imageUrl] : []);
		if (!urls.length) return;

		const cachedUrls: string[] = [];
		const oldLab = existingContent?.laboratories?.[type]?.[labIndex];
		const oldImageUrls: string[] = oldLab?.imageUrls?.length ? oldLab.imageUrls : (oldLab?.imageUrl ? [oldLab.imageUrl] : []);

		for (let imgIdx = 0; imgIdx < urls.length; imgIdx++) {
			const src = urls[imgIdx];
			if (src.startsWith('/') && (src.includes('/uploads/') || src.includes('/attached_assets/'))) {
				cachedUrls.push(src);
				continue;
			}

			const destUrl = `${UPLOADS_PRODI_BASE}/labs/${type}/${labIndex}-${imgIdx}.webp`;
			if (cachedDestUrls.has(destUrl) && fs.existsSync(localFilePathFromUrl(destUrl))) {
				cachedUrls.push(destUrl);
				continue;
			}

			const oldLocalUrl = oldImageUrls[imgIdx];
			const newUrl = await cacheRemoteImageToLocalWebp(src, destUrl, isLocalProdiAssetUrl(oldLocalUrl) ? oldLocalUrl : undefined);
			cachedUrls.push(newUrl || destUrl);
			cachedDestUrls.add(destUrl);
		}

		lab.imageUrls = cachedUrls;
		lab.imageUrl = cachedUrls[0] || '';
	};

	if (teachingLabs && cacheTeachingLabs) {
		for (let i = 0; i < teachingLabs.length; i++) await cacheLabImage(teachingLabs[i], 'teaching', i);
	}
	if (researchLabs && cacheResearchLabs) {
		for (let i = 0; i < researchLabs.length; i++) await cacheLabImage(researchLabs[i], 'research', i);
	}
}

// ─── Main sync orchestrator (backwards compat — delegates to scoped) ───

export async function runProdiSync(): Promise<ProdiSyncSummary> {
	return runProdiSyncScoped('all', { overwrite: true });
}
