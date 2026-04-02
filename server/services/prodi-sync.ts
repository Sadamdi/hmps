import * as cheerio from 'cheerio';
import { mongoStorage } from '../mongo-storage';
import fs from 'fs';
import path from 'path';
import { processImage } from '../image-processor';
import { deleteFile } from '../upload';

const SOURCES = {
	profile: 'https://informatika.uin-malang.ac.id/undergraduate-s1/',
	lecturers: 'https://informatika.uin-malang.ac.id/lecturer-and-staff/',
	curriculum: 'https://informatika.uin-malang.ac.id/curriculum/',
	teachingLab: 'https://informatika.uin-malang.ac.id/teaching-laboratory/',
	researchLab: 'https://informatika.uin-malang.ac.id/research-laboratory/',
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

async function parseCurriculum(): Promise<any> {
	const $ = await fetchPage(SOURCES.curriculum);
	const root = getContentRoot($);
	if (!root.length) return {};

	const graduateProfile: any[] = [];
	const knowledgeGroups: string[] = [];
	let structureSummary = '';
	const semesters: any[] = [];
	const optionalSubjects: any[] = [];

	let currentSection = '';

	function ensureSemester(num: number) {
		if (!semesters.find((s: any) => s.semester === num)) {
			semesters.push({ semester: num, totalSks: '', subjects: [] });
		}
		currentSection = 'semester';
	}

	parseCurriculumAccordionPanels($, root, semesters, optionalSubjects, ensureSemester);

	console.log(
		`Curriculum accordion parse result: ${semesters.length} semesters (${semesters.map((s: any) => `sem${s.semester}:${s.subjects?.length ?? 0}`).join(', ')}), optionalSubjects=${optionalSubjects.length}`,
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
					$el.find('tr').each((_j, tr) => {
						const cells = $(tr).find('td');
						if (cells.length >= 2) {
							const no = cleanText(cells.eq(0));
							if (/^no\.?$/i.test(no)) return;
							graduateProfile.push({
								no,
								description: cleanText(cells.eq(1)),
								profession: cells.length >= 3 ? cleanText(cells.eq(2)) : '',
							});
						}
					});
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
	return { graduateProfile, knowledgeGroups, structureSummary, semesters, optionalSubjects };
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

export type ProdiSyncScope = 'all' | 'profile' | 'lecturers' | 'curriculum' | 'labs';

export type ProdiSyncScopedResult = ProdiSyncSummary & {
	curriculumYearAction?: 'created' | 'overwritten' | 'needs_confirm';
	curriculumTargetYear?: number;
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
	let teachingLabs: any[] | null = null;
	let researchLabs: any[] | null = null;
	let curriculumYearAction: 'created' | 'overwritten' | 'needs_confirm' | undefined;
	let curriculumTargetYear: number | undefined;

	const doProfile = scope === 'all' || scope === 'profile';
	const doLecturers = scope === 'all' || scope === 'lecturers';
	const doCurriculum = scope === 'all' || scope === 'curriculum';
	const doLabs = scope === 'all' || scope === 'labs';

	try {
		await mongoStorage.setProdiSyncStatus('syncing');
		console.log(`🔄 Starting prodi sync (scope=${scope})...`);

		const tasks: Promise<any>[] = [];
		const taskNames: string[] = [];

		if (doProfile) { tasks.push(parseProfile().catch(e => { console.error('Profile parse error:', e); return null; })); taskNames.push('profile'); }
		if (doLecturers) { tasks.push(parseLecturerList().catch(e => { console.error('Lecturer list parse error:', e); return null; })); taskNames.push('lecturers'); }
		if (doCurriculum) { tasks.push(parseCurriculum().catch(e => { console.error('Curriculum parse error:', e); return null; })); taskNames.push('curriculum'); }
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
			else if (name === 'curriculum') curriculum = results[ri++];
			else if (name === 'teachingLab') teachingLabs = results[ri++];
			else if (name === 'researchLab') researchLabs = results[ri++];
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
		if (doCurriculum && curriculum) {
			await crawlRpsResources(curriculum);
		}

		// Cache images
		const existingDoc = await mongoStorage.getProdiContent();
		const existingContent = existingDoc?.content ?? {};
		const overridesDoc = existingDoc?.overrides ?? {};
		const cachedDestUrls = new Set<string>();

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

		// Curriculum goes through year-based storage
		if (doCurriculum && curriculum) {
			const targetYear = mongoStorage.resolveAcademicYearByDate(new Date());
			curriculumTargetYear = targetYear;

			const result = await mongoStorage.upsertProdiCurriculumByYear(
				targetYear,
				{ ...curriculum, source: 'sync' },
				{ overwrite: options?.overwrite },
			);
			curriculumYearAction = result.action;

			if (result.action === 'needs_confirm') {
				// Don't apply curriculum; return early with needs_confirm
				// Still apply other sections if they were requested
				if (Object.keys(crawledContent).length > 0) {
					await mongoStorage.applyAutoSyncData(crawledContent, { forceFields });
				}
				await mongoStorage.setProdiSyncStatus('idle');
				const summary = buildSummary(profile, lecturerData, curriculum, teachingLabs, researchLabs, true);
				return {
					...summary,
					curriculumYearAction: 'needs_confirm',
					curriculumTargetYear: targetYear,
				};
			}

			// Also update legacy content.curriculum for backwards compat
			crawledContent.curriculum = curriculum;
			forceFields.push('curriculum.semesters', 'curriculum.optionalSubjects', 'curriculum.subjectRpsResources');
		}

		if (Object.keys(crawledContent).length > 0) {
			await mongoStorage.applyAutoSyncData(crawledContent, { forceFields });
		}

		const validation = validateCrawledContent(profile, lecturerData, curriculum, teachingLabs, researchLabs);

		if (validation.criticalMissing.length > 0 && scope === 'all') {
			const reason = `Crawler menghasilkan data kosong untuk bagian krusial: ${validation.criticalMissing.join(', ')}. Periksa struktur HTML situs sumber atau koneksi jaringan.`;
			await mongoStorage.setProdiSyncStatus('error', reason);
			const summary = buildSummary(profile, lecturerData, curriculum, teachingLabs, researchLabs, false, reason);
			return { ...summary, curriculumYearAction, curriculumTargetYear };
		}

		await mongoStorage.setProdiSyncStatus('idle');
		const summary = buildSummary(profile, lecturerData, curriculum, teachingLabs, researchLabs, true);
		console.log(`✅ Prodi sync (scope=${scope}) completed`, summary);
		return { ...summary, curriculumYearAction, curriculumTargetYear };
	} catch (error: any) {
		console.error('Prodi sync failed:', error);
		const msg = error?.message || 'Unknown error';
		await mongoStorage.setProdiSyncStatus('error', msg);
		return { ...buildSummary(profile, lecturerData, curriculum, teachingLabs, researchLabs, false, msg), curriculumYearAction, curriculumTargetYear };
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
