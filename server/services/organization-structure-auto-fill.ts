import type { Express } from 'express';
import sharp from 'sharp';
import { GEMINI_MODELS, initGeminiClient } from '../config/gemini-config';
import { getConfiguredSlots } from '../config/gemini-keys';
import { DEFAULT_MEMBER_IMAGE_PATH } from '../constants/default-image';
import type { TenantStorageType } from '../tenant-storage';

export type MemberRef = { id: string; name: string };
export type PositionRef = { name: string; order?: number };

/** Bentuk lama (tetap didukung saat parse) */
export type GeminiExtractShape = {
	assignments: Array<{
		memberName: string;
		positionName: string;
		period: string;
		confidence?: number;
	}>;
	unmatchedMemberNames: string[];
	unrecognizedPositionNames: string[];
};

export type GeminiPeriodEntry = {
	startYear?: number;
	endYear?: number;
	period?: string;
	evidence?: string;
};

export type GeminiDivisionEntry = {
	name: string;
	evidence?: string;
};

export type AssignmentRoleType =
	| 'BPH'
	| 'DIVISION_HEAD'
	| 'DIVISION_MEMBER'
	| 'UNKNOWN';

export type GeminiAssignmentV2 = {
	memberName: string;
	rawRoleLabel: string;
	divisionName?: string | null;
	roleType: AssignmentRoleType | string;
	period?: string;
	confidence?: number;
	evidence?: string;
};

export type GeminiExtractShapeV2 = {
	periods?: GeminiPeriodEntry[];
	divisions?: GeminiDivisionEntry[];
	assignments: GeminiAssignmentV2[];
	unmatchedMemberNames: string[];
	unrecognizedPositionNames: string[];
};

export type WorkingRow = {
	memberName: string;
	period: string;
	rawRoleLabel: string;
	roleType: string;
	divisionNameRaw?: string;
	matchedDivisionId?: string;
	matchedDivisionDisplay?: string;
	tentativePosition: string | null;
	issueCodes: string[];
};

export type OrgAutoFillConflict = {
	code: string;
	detail: string;
	meta?: Record<string, unknown>;
};

export type OrgAutoFillQuestionOption = {
	value: string;
	label: string;
};

export type OrgAutoFillQuestion = {
	id: string;
	type:
		| 'select_period'
		| 'resolve_duplicate_bph'
		| 'map_division'
		| 'pick_position'
		| 'confirm_period';
	title: string;
	description?: string;
	options?: OrgAutoFillQuestionOption[];
	/** untuk resolve_duplicate_bph */
	fields?: Array<{
		key: string;
		label: string;
		options: OrgAutoFillQuestionOption[];
	}>;
	context?: Record<string, unknown>;
};

export type OrgAutoFillPreviewData = {
	version: 1;
	extracted: GeminiExtractShapeV2;
	context: {
		periodHint?: string;
		seedMembers: MemberRef[];
		seedPositions: PositionRef[];
		knownPeriods: string[];
	};
	workingRows: WorkingRow[];
	questionIds: string[];
};

export type OrgAutoFillPreviewResult = {
	mode: 'preview';
	summary: string;
	questions: OrgAutoFillQuestion[];
	conflicts: OrgAutoFillConflict[];
	previewData: OrgAutoFillPreviewData;
	draftRows: Array<{
		memberName: string;
		period: string;
		suggestedPosition: string | null;
		needsClarification: boolean;
		issues: string[];
	}>;
};

const DEFAULT_MEMBER_IMAGE = DEFAULT_MEMBER_IMAGE_PATH;

const MAX_PDF_PAGES_SHARP =
	Number.parseInt(process.env.ORG_AUTO_FILL_MAX_PDF_PAGES || '10', 10) || 10;

function normalizeName(s: string): string {
	return s
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/[^a-z0-9\s\u00c0-\u024f-]/gi, '')
		.trim();
}

/** Rapikan label divisi dari nama display (hilangkan prefix "Divisi" berlebihan). */
function divisionLabelForPosition(divisionDisplay: string): string {
	let s = divisionDisplay.trim();
	s = s.replace(/^divisi\s+/i, '').trim();
	return s;
}

/** Perbaiki pola posisi yang sering salah dari ekstraksi (mis. "Anggota Divisi Divisi Media"). */
function sanitizePositionName(pos: string): string {
	let p = pos.trim().replace(/\s+/g, ' ');
	p = p.replace(/^(Anggota Divisi)\s+Divisi\s+/i, '$1 ');
	p = p.replace(/^(Ketua Divisi)\s+Divisi\s+/i, '$1 ');
	p = p.replace(/\bDivisi\s+Divisi\b/gi, 'Divisi');
	return p;
}

function parseDivisionSuffixFromPosition(
	pos: string | null | undefined,
): string | null {
	if (!pos) return null;
	const s = sanitizePositionName(pos);
	const m =
		s.match(/^Ketua Divisi\s+(.+)$/i) ||
		s.match(/^Anggota Divisi\s+(.+)$/i);
	return m ? divisionLabelForPosition(m[1]) : null;
}

function isDivisionHeadPositionLabel(pos: string): boolean {
	const t = sanitizePositionName(pos);
	return /^ketua\s+divisi\s+/i.test(t);
}

function isDivisionMemberPositionLabel(pos: string): boolean {
	const n = normalizeName(sanitizePositionName(pos));
	return n.includes('anggota') && n.includes('divisi');
}

function normalizePeriodString(s: string | undefined | null): string {
	if (!s || typeof s !== 'string') return '';
	return s.trim().replace(/\s+/g, ' ');
}

/**
 * Normalisasi ke format YYYY-YYYY+1 bila dokumen hanya menyebut satu tahun.
 */
export function normalizePeriodCanonical(
	raw: string | undefined | null,
	opts?: { hint?: string; knownPeriods?: string[] },
): string {
	let s = normalizePeriodString(raw);
	const hint = normalizePeriodString(opts?.hint);
	const known = opts?.knownPeriods ?? [];

	const singleYear = s.match(/^(\d{4})$/);
	if (singleYear) {
		const y = Number.parseInt(singleYear[1], 10);
		return `${y}-${y + 1}`;
	}

	const range = s.match(/^(\d{4})\s*[-/]\s*(\d{4})$/);
	if (range) {
		return `${range[1]}-${range[2]}`;
	}

	if (!s && hint) {
		return normalizePeriodCanonical(hint, { knownPeriods: known });
	}
	if (!s && known.length === 1) {
		return normalizePeriodCanonical(known[0], { knownPeriods: known });
	}

	return s;
}

function resolveDocumentMime(
	file: Express.Multer.File,
): { mime: string; isPdf: boolean; isWord: boolean; isImage: boolean } {
	const raw = (file.mimetype || '').toLowerCase();
	const name = (file.originalname || '').toLowerCase();
	const isPdf = raw.includes('pdf') || name.endsWith('.pdf');
	const isWord =
		raw.includes('wordprocessingml') ||
		raw.includes('msword') ||
		name.endsWith('.docx') ||
		name.endsWith('.doc');
	const isImage = raw.startsWith('image/');
	let mime = raw;
	if (isPdf) mime = 'application/pdf';
	else if (name.endsWith('.docx'))
		mime =
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
	else if (name.endsWith('.doc')) mime = 'application/msword';
	return { mime, isPdf, isWord, isImage };
}

function findMemberId(
	members: MemberRef[],
	extractedName: string,
): string | null {
	const n = normalizeName(extractedName);
	if (!n) return null;
	for (const m of members) {
		if (normalizeName(m.name) === n) return m.id;
	}
	for (const m of members) {
		const mn = normalizeName(m.name);
		if (mn.includes(n) || n.includes(mn)) return m.id;
	}
	return null;
}

function findCanonicalPosition(
	positions: PositionRef[],
	extracted: string,
): string | null {
	const n = normalizeName(extracted);
	if (!n) return null;
	for (const p of positions) {
		if (normalizeName(p.name) === n) return p.name;
	}
	for (const p of positions) {
		const pn = normalizeName(p.name);
		if (pn.includes(n) || n.includes(pn)) return p.name;
	}
	return null;
}

function legacyToV2(parsed: GeminiExtractShape): GeminiExtractShapeV2 {
	return {
		periods: [],
		divisions: [],
		assignments: (parsed.assignments || []).map((a) => ({
			memberName: a.memberName,
			rawRoleLabel: a.positionName,
			roleType: 'UNKNOWN',
			period: a.period,
			confidence: a.confidence,
		})),
		unmatchedMemberNames: parsed.unmatchedMemberNames || [],
		unrecognizedPositionNames: parsed.unrecognizedPositionNames || [],
	};
}

function parseGeminiJsonV2(raw: string): GeminiExtractShapeV2 {
	let text = raw.trim();
	const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fence) text = fence[1].trim();
	const parsed = JSON.parse(text) as GeminiExtractShapeV2 & GeminiExtractShape;

	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Respons AI bukan objek JSON');
	}

	if (Array.isArray((parsed as GeminiExtractShape).assignments)) {
		const first = (parsed as GeminiExtractShape).assignments[0] as
			| { positionName?: string; rawRoleLabel?: string }
			| undefined;
		if (first && first.positionName != null && first.rawRoleLabel == null) {
			return legacyToV2(parsed as GeminiExtractShape);
		}
	}

	if (!Array.isArray(parsed.assignments)) parsed.assignments = [];
	for (const a of parsed.assignments) {
		if (a && typeof a.period === 'string') {
			a.period = normalizePeriodString(a.period);
		} else if (a) {
			(a as GeminiAssignmentV2).period = '';
		}
		if (a && !(a as GeminiAssignmentV2).rawRoleLabel) {
			(a as any).rawRoleLabel = (a as any).positionName || '';
		}
		if (a && !(a as GeminiAssignmentV2).roleType) {
			(a as GeminiAssignmentV2).roleType = 'UNKNOWN';
		}
	}
	if (!Array.isArray(parsed.periods)) parsed.periods = [];
	if (!Array.isArray(parsed.divisions)) parsed.divisions = [];
	if (!Array.isArray(parsed.unmatchedMemberNames))
		parsed.unmatchedMemberNames = [];
	if (!Array.isArray(parsed.unrecognizedPositionNames))
		parsed.unrecognizedPositionNames = [];
	return parsed as GeminiExtractShapeV2;
}

function buildInlineDataPart(
	buffer: Buffer,
	mimeType: string,
): { inlineData: { mimeType: string; data: string } } {
	return {
		inlineData: {
			mimeType: mimeType,
			data: buffer.toString('base64'),
		},
	};
}

async function buildSharpPdfImageParts(
	fileBuffer: Buffer,
): Promise<Array<{ inlineData: { mimeType: string; data: string } }>> {
	const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> =
		[];
	for (let page = 0; page < MAX_PDF_PAGES_SHARP; page++) {
		try {
			const png = await sharp(fileBuffer, { page, density: 144 })
				.resize({ width: 1400, withoutEnlargement: true })
				.png()
				.toBuffer();
			imageParts.push({
				inlineData: {
					mimeType: 'image/png',
					data: png.toString('base64'),
				},
			});
		} catch {
			break;
		}
	}
	if (imageParts.length === 0) {
		throw new Error(
			'PDF tidak bisa dirender ke gambar (sharp). Pastikan libvips mendukung PDF atau unggah gambar.',
		);
	}
	return imageParts;
}

function buildExtractionPromptV2(opts: {
	hintPeriod?: string;
	knownPeriods: string[];
	seedMembers: MemberRef[];
	seedPositions: PositionRef[];
	isFallbackImages?: boolean;
}): string {
	const {
		hintPeriod,
		knownPeriods,
		seedMembers,
		seedPositions,
		isFallbackImages,
	} = opts;

	const schemaHint = `{
  "periods": [ { "startYear": 2026, "endYear": 2027, "period": "2026-2027", "evidence": "string" } ],
  "divisions": [ { "name": "nama divisi di dokumen", "evidence": "string" } ],
  "assignments": [
    {
      "memberName": "string",
      "rawRoleLabel": "teks jabatan persis dari dokumen",
      "divisionName": "nama divisi jika relevan atau null",
      "roleType": "BPH" | "DIVISION_HEAD" | "DIVISION_MEMBER" | "UNKNOWN",
      "period": "string atau kosong",
      "confidence": 0.0,
      "evidence": "string"
    }
  ],
  "unmatchedMemberNames": [ "string" ],
  "unrecognizedPositionNames": [ "string" ]
}`;

	return `Anda mengekstrak struktur organisasi dari dokumen surat penugasan / tabel pengurus.

${isFallbackImages ? 'Catatan: dokumen disajikan sebagai serangkaian gambar hasil render PDF.' : ''}

Periode hint dari admin (boleh kosong): ${JSON.stringify(hintPeriod || '')}
Daftar periode yang sudah ada di database: ${JSON.stringify(knownPeriods)}
Daftar anggota yang diketahui UI (opsional): ${JSON.stringify(seedMembers.map((m) => m.name))}
Daftar posisi yang diketahui UI (opsional): ${JSON.stringify(seedPositions.map((p) => p.name))}

Aturan penting:
1) Isi "periods" jika dokumen menyebut periode kepengurusan (boleh lebih dari satu). Gunakan evidence singkat.
2) Isi "divisions" dengan nama divisi/seksi yang terlihat sebagai header atau pengelompokan di dokumen.
3) Untuk SETIAP baris orang di dokumen, isi assignments dengan:
   - memberName: nama lengkap
   - rawRoleLabel: teks jabatan seperti di dokumen
   - roleType:
     - BPH untuk Ketua/Wakil/Sekretaris/Bendahara tingkat himpunan (bukan divisi)
     - DIVISION_HEAD untuk ketua divisi/seksi/koordinator divisi
     - DIVISION_MEMBER untuk anggota/staf divisi
     - UNKNOWN jika tidak yakin
   - divisionName: isi nama divisi jika baris tersebut berada di bawah divisi tertentu
4) Bedakan jelas: "Wakil Ketua" / "Wakil Ketua Himpunan" adalah WAKIL, bukan Ketua. "Ketua" tanpa kata "wakil" di depannya untuk tingkat himpunan adalah BPH ketua (bukan divisi).
5) Untuk divisi, jangan mengulang kata "Divisi" dua kali di label (hindari "Anggota Divisi Divisi X"; gunakan nama divisi saja di divisionName).
6) Jika hintPeriod ada dan dokumen tidak menyebut tahun jelas, gunakan hint tersebut pada field period per baris atau pada periods.
7) Jika dokumen hanya menyebut satu tahun (mis. 2026), tetap isi period sebagai "2026" atau "2026-2027" sesuai teks — server akan menormalisasi.
8) Jangan mengarang nama yang tidak terbaca; gunakan unmatchedMemberNames jika perlu.

Kembalikan HANYA JSON valid tanpa markdown:
${schemaHint}`;
}

async function callGeminiWithModelFallback(
	prompt: string,
	parts: Array<
		{ text: string } | { inlineData: { mimeType: string; data: string } }
	>,
): Promise<string> {
	const slots = getConfiguredSlots();
	if (!slots.length) {
		throw new Error('GEMINI_API_KEY_1 (atau slot lain) belum dikonfigurasi');
	}
	const gemini = initGeminiClient(slots[0].secret);
	const mergedParts: Array<
		| { text: string }
		| { inlineData: { mimeType: string; data: string } }
	> = [{ text: prompt }, ...parts];
	let lastErr: unknown;
	const models = GEMINI_MODELS.length ? GEMINI_MODELS : ['gemini-2.5-flash'];
	for (const modelName of models) {
		try {
			const model = gemini.getGenerativeModel({ model: modelName });
			const result = await model.generateContent({
				contents: [{ role: 'user', parts: mergedParts as any }],
			});
			const text = result.response.text();
			if (text && String(text).trim()) return text;
		} catch (e) {
			lastErr = e;
		}
	}
	const msg =
		lastErr instanceof Error
			? lastErr.message
			: 'Semua model Gemini gagal (coba lagi atau periksa kunci API).';
	throw new Error(msg);
}

export async function extractAssignmentsWithGemini(
	fileBuffer: Buffer,
	file: Express.Multer.File,
	opts: {
		hintPeriod?: string;
		knownPeriods: string[];
		seedMembers: MemberRef[];
		seedPositions: PositionRef[];
	},
): Promise<GeminiExtractShapeV2> {
	const { mime, isPdf, isWord, isImage } = resolveDocumentMime(file);
	const { hintPeriod, knownPeriods, seedMembers, seedPositions } = opts;

	const basePrompt = buildExtractionPromptV2({
		hintPeriod,
		knownPeriods,
		seedMembers,
		seedPositions,
		isFallbackImages: false,
	});

	const primaryParts: Array<{
		inlineData: { mimeType: string; data: string };
	}> = [];

	if (isPdf) {
		primaryParts.push(buildInlineDataPart(fileBuffer, 'application/pdf'));
	} else if (isWord) {
		primaryParts.push(buildInlineDataPart(fileBuffer, mime));
	} else if (isImage) {
		primaryParts.push(
			buildInlineDataPart(
				fileBuffer,
				mime.startsWith('image/') ? mime : 'image/jpeg',
			),
		);
	} else {
		throw new Error(
			'Format tidak didukung. Unggah gambar, PDF, atau Word (.doc/.docx).',
		);
	}

	let text: string;
	try {
		text = await callGeminiWithModelFallback(basePrompt, primaryParts);
		const parsed = parseGeminiJsonV2(text);
		if (parsed.assignments.length > 0) return parsed;
		throw new Error('assignments kosong');
	} catch (firstErr) {
		if (!isPdf) throw firstErr;
		try {
			const imgParts = await buildSharpPdfImageParts(fileBuffer);
			const fbPrompt = buildExtractionPromptV2({
				hintPeriod,
				knownPeriods,
				seedMembers,
				seedPositions,
				isFallbackImages: true,
			});
			text = await callGeminiWithModelFallback(fbPrompt, imgParts);
			return parseGeminiJsonV2(text);
		} catch {
			throw firstErr;
		}
	}
}

export type AutoFillDetail = {
	memberId: string;
	name: string;
	position: string;
	period: string;
	status: 'created' | 'updated' | 'unchanged' | 'skipped';
	reason?: string;
};

export type AutoFillResult = {
	updated: number;
	createdMembers: number;
	createdPositions: number;
	skipped: number;
	details: AutoFillDetail[];
	raw: GeminiExtractShapeV2;
};

function orgDocsToMemberRefs(docs: any[]): MemberRef[] {
	return (docs || []).map((d) => ({
		id: String(d._id ?? d.id),
		name: String(d.name ?? ''),
	}));
}

function orgDocsToPositionRefs(positions: PositionRef[]): PositionRef[] {
	return positions.map((p) => ({ name: p.name, order: p.order }));
}

type DivisionDoc = {
	_id: any;
	name?: string;
	displayName?: string;
	positions?: string[];
};

function pickDivision(
	raw: string | undefined | null,
	divisions: DivisionDoc[],
): { id: string; displayName: string; score: number } | null {
	if (!raw || !String(raw).trim()) return null;
	const n = normalizeName(String(raw));
	let best: { id: string; displayName: string; score: number } | null = null;
	for (const d of divisions) {
		const disp = String(d.displayName || d.name || '');
		const dn = normalizeName(disp);
		const slug = normalizeName(String(d.name || ''));
		if (!dn && !slug) continue;
		let score = 0;
		if (n === dn || n === slug) score = 100;
		else if (dn && (n.includes(dn) || dn.includes(n))) score = 80;
		else if (slug && (n.includes(slug) || slug.includes(n))) score = 70;
		if (score > 0 && (!best || score > best.score)) {
			best = {
				id: String(d._id),
				displayName: disp || String(d.name),
				score,
			};
		}
	}
	return best;
}

function bphKeywords(
	raw: string,
): 'ketua' | 'wakil' | 'sekretaris' | 'bendahara' | null {
	const x = normalizeName(raw);
	if (/divisi/.test(x)) return null;
	/* Wakil harus sebelum ketua agar "Wakil Ketua" tidak terbaca sebagai ketua saja */
	if (/wakil/.test(x) && /ketua/.test(x)) return 'wakil';
	if (/^wakil\b/.test(x) || /\bwakil\b/.test(x)) return 'wakil';
	if (/\bketua\b/.test(x)) return 'ketua';
	if (/sekretaris/.test(x)) return 'sekretaris';
	if (/bendahara/.test(x)) return 'bendahara';
	if (/ketua/.test(x) && /himpunan/.test(x)) return 'ketua';
	return null;
}

function findBestBphPosition(
	kind: NonNullable<ReturnType<typeof bphKeywords>>,
	validPositions: string[],
): string | null {
	const vp = validPositions || [];
	const norm = (s: string) => normalizeName(s);
	for (const p of vp) {
		const pn = norm(p);
		if (kind === 'ketua' && pn.includes('ketua') && !pn.includes('wakil') && !pn.includes('divisi')) {
			return p;
		}
	}
	if (kind === 'ketua') {
		for (const p of vp) {
			const pn = norm(p);
			if (pn.includes('ketua') && pn.includes('himpunan') && !pn.includes('wakil')) return p;
		}
	}
	if (kind === 'wakil') {
		for (const p of vp) {
			const pn = norm(p);
			if (pn.includes('wakil') && pn.includes('ketua')) return p;
		}
	}
	if (kind === 'sekretaris') {
		for (const p of vp) {
			if (norm(p).includes('sekretaris') && !norm(p).includes('divisi')) return p;
		}
	}
	if (kind === 'bendahara') {
		for (const p of vp) {
			if (norm(p).includes('bendahara') && !norm(p).includes('divisi')) return p;
		}
	}
	return null;
}

function findDivisionPosition(
	kind: 'head' | 'member',
	divisionDisplay: string,
	validPositions: string[],
): string | null {
	const label = divisionLabelForPosition(divisionDisplay.trim());
	const labelNorm = normalizeName(label);
	const headNeedle = normalizeName(`Ketua Divisi ${label}`);
	for (const p of validPositions) {
		const pn = normalizeName(p);
		if (kind === 'head') {
			if (
				pn.includes('ketua') &&
				pn.includes('divisi') &&
				(pn.includes(labelNorm) || headNeedle === pn)
			) {
				return p;
			}
		} else {
			if (
				pn.includes('anggota') &&
				pn.includes('divisi') &&
				pn.includes(labelNorm)
			) {
				return p;
			}
		}
	}
	if (kind === 'head') return `Ketua Divisi ${label}`;
	return `Anggota Divisi ${label}`;
}

function inferRoleType(a: GeminiAssignmentV2): string {
	const rt = String(a.roleType || 'UNKNOWN').toUpperCase();
	if (['BPH', 'DIVISION_HEAD', 'DIVISION_MEMBER', 'UNKNOWN'].includes(rt)) return rt;
	return 'UNKNOWN';
}

async function postNormalizeWorkingRows(
	rows: WorkingRow[],
	ctx: {
		getPositionsForPeriod: (period: string) => Promise<PositionRef[]>;
	},
): Promise<void> {
	for (const r of rows) {
		if (r.tentativePosition) {
			r.tentativePosition = sanitizePositionName(r.tentativePosition);
		}
		if (
			r.tentativePosition &&
			/wakil/i.test(r.rawRoleLabel) &&
			/ketua/i.test(r.rawRoleLabel) &&
			!isDivisionHeadPositionLabel(r.tentativePosition)
		) {
			r.tentativePosition = 'Wakil Ketua Himpunan';
		}
		const period = r.period;
		if (!period || !r.tentativePosition) continue;
		const posList = orgDocsToPositionRefs(
			(await ctx.getPositionsForPeriod(period)) as PositionRef[],
		);
		const validNames = posList.map((p) => p.name);
		const k = bphKeywords(r.tentativePosition);
		if (k === 'ketua') {
			r.tentativePosition =
				findBestBphPosition('ketua', validNames) || 'Ketua Himpunan';
		} else if (k === 'wakil') {
			r.tentativePosition =
				findBestBphPosition('wakil', validNames) || 'Wakil Ketua Himpunan';
		} else if (k === 'sekretaris') {
			r.tentativePosition =
				findBestBphPosition('sekretaris', validNames) || 'Sekretaris Himpunan';
		} else if (k === 'bendahara') {
			r.tentativePosition =
				findBestBphPosition('bendahara', validNames) || 'Bendahara Himpunan';
		}
	}
	await enforceDivisionHeadsFromTopOrder(rows, ctx);
}

function slugifyDivisionName(displayName: string): string {
	return displayName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

function isBphPosition(position: string): boolean {
	const n = normalizeName(position);
	if (n.includes('divisi')) return false;
	if (n.includes('himpunan')) return true;
	return (
		(n.includes('ketua') && !n.includes('wakil')) ||
		(n.includes('wakil') && n.includes('ketua')) ||
		n.includes('sekretaris') ||
		n.includes('bendahara')
	);
}

async function syncDivisionPositionsForPeriod(
	rows: WorkingRow[],
	period: string,
	storage: TenantStorageType,
): Promise<void> {
	const divisions = (await storage.getAllDivisions(period)) as DivisionDoc[];
	const buckets = new Map<string, Set<string>>();
	const labels = new Map<string, string>();

	const upsertBucket = (label: string, position: string) => {
		const key = normalizeName(label);
		if (!key) return;
		if (!buckets.has(key)) buckets.set(key, new Set<string>());
		if (!labels.has(key)) labels.set(key, label);
		buckets.get(key)!.add(sanitizePositionName(position));
	};

	for (const r of rows) {
		const pos = r.tentativePosition ? sanitizePositionName(r.tentativePosition) : '';
		if (!pos) continue;
		const divSuffix = parseDivisionSuffixFromPosition(pos);
		if (divSuffix) {
			const label = r.matchedDivisionDisplay || divisionLabelForPosition(divSuffix);
			upsertBucket(label, pos);
			continue;
		}
		if (isBphPosition(pos)) {
			upsertBucket('BPH', pos);
		}
	}

	for (const [key, setPositions] of Array.from(buckets.entries())) {
		const desiredPositions = Array.from(setPositions);
		if (!desiredPositions.length) continue;
		const label = labels.get(key) || key;
		let target =
			divisions.find((d) => normalizeName(String(d.displayName || d.name || '')) === key) ||
			null;
		if (!target && label !== 'BPH') {
			const picked = pickDivision(label, divisions);
			if (picked?.id) {
				target = divisions.find((d) => String(d._id) === String(picked.id)) || null;
			}
		}

		if (!target) {
			const baseSlug = label === 'BPH' ? 'bph' : slugifyDivisionName(label);
			let uniqueSlug = baseSlug || `divisi_${Date.now()}`;
			let i = 1;
			while (divisions.some((d) => normalizeName(String(d.name || '')) === normalizeName(uniqueSlug))) {
				uniqueSlug = `${baseSlug}_${i++}`;
			}
			const created = await storage.createDivision({
				name: uniqueSlug,
				period,
				displayName: label,
				description: label === 'BPH' ? 'Badan Pengurus Harian' : '',
				positions: desiredPositions,
				color: '#3B82F6',
			});
			target = {
				_id: (created as any)._id,
				name: uniqueSlug,
				displayName: label,
				positions: desiredPositions,
			};
			divisions.push(target);
			continue;
		}

		const current = Array.isArray(target.positions) ? target.positions : [];
		const merged = Array.from(new Set([...current, ...desiredPositions]));
		if (merged.length === current.length) continue;
		await storage.updateDivision(String(target._id), { positions: merged });
		target.positions = merged;
	}
}

async function syncDivisionPositionsFromRows(
	rows: WorkingRow[],
	storage: TenantStorageType,
): Promise<void> {
	let periodList = Array.from(
		new Set(rows.map((r) => r.period).filter((p) => p && p !== '_none_')),
	);
	if (periodList.length === 0) {
		const fb = (await storage.getOrganizationPeriods())[0];
		if (fb) periodList = [fb];
	}
	for (const period of periodList) {
		await syncDivisionPositionsForPeriod(
			rows.filter((r) => r.period === period),
			period,
			storage,
		);
	}
}

async function enforceDivisionHeadsFromTopOrder(
	rows: WorkingRow[],
	ctx: {
		getPositionsForPeriod: (period: string) => Promise<PositionRef[]>;
	},
): Promise<void> {
	const periodMap = groupByPeriod(rows);
	const periodPositionsCache = new Map<string, string[]>();
	for (const [period, list] of Array.from(periodMap.entries())) {
		if (!period || period === '_none_') continue;
		if (!periodPositionsCache.has(period)) {
			const posList = orgDocsToPositionRefs(
				(await ctx.getPositionsForPeriod(period)) as PositionRef[],
			);
			periodPositionsCache.set(
				period,
				posList.map((p) => p.name),
			);
		}
		const validNames = periodPositionsCache.get(period) || [];
		const divisions = new Map<
			string,
			{ label: string; hasHead: boolean; members: WorkingRow[] }
		>();

		for (const r of list) {
			const tp = r.tentativePosition;
			if (!tp) continue;
			const suffix = parseDivisionSuffixFromPosition(tp);
			if (!suffix) continue;
			const normKey = normalizeName(divisionLabelForPosition(suffix));
			if (!normKey) continue;
			if (!divisions.has(normKey)) {
				divisions.set(normKey, {
					label: r.matchedDivisionDisplay || divisionLabelForPosition(suffix),
					hasHead: false,
					members: [],
				});
			}
			const bucket = divisions.get(normKey)!;
			if (isDivisionHeadPositionLabel(tp)) {
				bucket.hasHead = true;
				continue;
			}
			if (isDivisionMemberPositionLabel(tp)) {
				bucket.members.push(r);
			}
		}

		for (const bucket of Array.from(divisions.values())) {
			if (bucket.hasHead || bucket.members.length === 0) continue;
			const headPos =
				findDivisionPosition('head', bucket.label, validNames) ||
				sanitizePositionName(`Ketua Divisi ${bucket.label}`);
			const memberPos =
				findDivisionPosition('member', bucket.label, validNames) ||
				sanitizePositionName(`Anggota Divisi ${bucket.label}`);

			const pickedHead = bucket.members[0];
			pickedHead.tentativePosition = sanitizePositionName(headPos);
			pickedHead.issueCodes = pickedHead.issueCodes.filter(
				(c) => c !== 'unknown_role',
			);

			for (let i = 1; i < bucket.members.length; i++) {
				bucket.members[i].tentativePosition = sanitizePositionName(memberPos);
				bucket.members[i].issueCodes = bucket.members[i].issueCodes.filter(
					(c) => c !== 'unknown_role',
				);
			}
		}
	}
}

function buildWorkingRows(
	extracted: GeminiExtractShapeV2,
	ctx: {
		periodHint?: string;
		knownPeriods: string[];
		divisions: DivisionDoc[];
		getPositionsForPeriod: (period: string) => Promise<PositionRef[]>;
	},
): Promise<WorkingRow[]> {
	return (async () => {
		const rows: WorkingRow[] = [];
		for (const a of extracted.assignments) {
			const issueCodes: string[] = [];
			let period = normalizePeriodCanonical(a.period, {
				hint: ctx.periodHint,
				knownPeriods: ctx.knownPeriods,
			});
			if (!period && extracted.periods?.length) {
				const p0 = extracted.periods[0];
				const y = p0.startYear ?? (p0.period ? Number.parseInt(String(p0.period).slice(0, 4), 10) : NaN);
				if (!Number.isNaN(y)) {
					period = normalizePeriodCanonical(String(y), {
						hint: ctx.periodHint,
						knownPeriods: ctx.knownPeriods,
					});
				}
			}
			if (!period) issueCodes.push('unknown_period');

			const posList = period
				? orgDocsToPositionRefs(
						(await ctx.getPositionsForPeriod(period)) as PositionRef[],
					)
				: [];
			const validNames = posList.map((p) => p.name);

			let tentativePosition: string | null = null;
			const roleType = inferRoleType(a);
			const raw = (a.rawRoleLabel || '').trim() || (a as any).positionName || '';

			let matchedDiv: ReturnType<typeof pickDivision> = null;
			if (a.divisionName) {
				matchedDiv = pickDivision(a.divisionName, ctx.divisions);
			}
			if (!matchedDiv && raw) {
				matchedDiv = pickDivision(raw, ctx.divisions);
			}

			if (
				roleType === 'DIVISION_HEAD' ||
				roleType === 'DIVISION_MEMBER'
			) {
				if (!matchedDiv) {
					issueCodes.push('unknown_division');
				} else {
					tentativePosition = findDivisionPosition(
						roleType === 'DIVISION_HEAD' ? 'head' : 'member',
						matchedDiv.displayName,
						validNames,
					);
				}
			} else if (roleType === 'BPH') {
				const k = bphKeywords(raw);
				if (k) {
					tentativePosition =
						findBestBphPosition(k, validNames) ||
						(k === 'ketua'
							? 'Ketua Himpunan'
							: k === 'wakil'
								? 'Wakil Ketua Himpunan'
								: k === 'sekretaris'
									? 'Sekretaris Himpunan'
									: 'Bendahara Himpunan');
				} else {
					tentativePosition = findCanonicalPosition(posList, raw);
				}
			} else {
				/* UNKNOWN: coba cocokkan ke posisi ada, lalu heuristik BPH/divisi */
				tentativePosition = findCanonicalPosition(posList, raw);
				if (!tentativePosition) {
					const k = bphKeywords(raw);
					if (k) {
						tentativePosition =
							findBestBphPosition(k, validNames) ||
							(k === 'ketua'
								? 'Ketua Himpunan'
								: k === 'wakil'
									? 'Wakil Ketua Himpunan'
									: k === 'sekretaris'
										? 'Sekretaris Himpunan'
										: 'Bendahara Himpunan');
					} else if (matchedDiv) {
						const headLike = /ketua|koordinator|kepala/i.test(raw);
						tentativePosition = findDivisionPosition(
							headLike ? 'head' : 'member',
							matchedDiv.displayName,
							validNames,
						);
					} else if (/divisi|seksi|bidang/i.test(normalizeName(raw))) {
						issueCodes.push('unknown_role');
					} else {
						issueCodes.push('unknown_role');
					}
				}
			}

			if (!period) {
				tentativePosition = tentativePosition;
			}

			rows.push({
				memberName: (a.memberName || '').trim() || 'Tanpa nama',
				period: period || '',
				rawRoleLabel: raw,
				roleType,
				divisionNameRaw: a.divisionName ? String(a.divisionName) : undefined,
				matchedDivisionId: matchedDiv?.id,
				matchedDivisionDisplay: matchedDiv?.displayName,
				tentativePosition,
				issueCodes,
			});
		}
		await postNormalizeWorkingRows(rows, ctx);
		return rows;
	})();
}

function groupByPeriod(rows: WorkingRow[]): Map<string, WorkingRow[]> {
	const m = new Map<string, WorkingRow[]>();
	for (const r of rows) {
		const p = r.period || '_none_';
		if (!m.has(p)) m.set(p, []);
		m.get(p)!.push(r);
	}
	return m;
}

function normalizeNameForDedupe(s: string): string {
	return normalizeName(s);
}

function detectDuplicateBph(rows: WorkingRow[]): OrgAutoFillQuestion[] {
	const questions: OrgAutoFillQuestion[] = [];

	for (const [period, list] of Array.from(groupByPeriod(rows).entries())) {
		if (!period || period === '_none_') continue;
		const ketuaRows = list.filter((r: WorkingRow) => {
			if (!r.tentativePosition) return false;
			const n = normalizeName(r.tentativePosition);
			if (n.includes('divisi')) return false;
			if (n.includes('wakil') && n.includes('ketua')) return false;
			if (n.includes('sekretaris') || n.includes('bendahara')) return false;
			if (!n.includes('ketua')) return false;
			return true;
		});
		if (ketuaRows.length > 1) {
			const names = ketuaRows.map((r: WorkingRow) => r.memberName);
			const opts = names.map((n: string) => ({ value: n, label: n }));
			questions.push({
				id: `dup_ketua_${period}`,
				type: 'resolve_duplicate_bph',
				title: `Lebih dari satu kandidat Ketua Himpunan (periode ${period})`,
				description:
					'Pilih siapa Ketua Himpunan dan siapa Wakil Ketua Himpunan. Nama yang tidak dipilih akan tetap dengan jabatan lain jika ada di dokumen.',
				fields: [
					{
						key: 'ketua',
						label: 'Ketua Himpunan',
						options: opts,
					},
					{
						key: 'wakil',
						label: 'Wakil Ketua Himpunan',
						options: opts,
					},
				],
				context: { period, names },
			});
		}

		const wakilRows = list.filter(
			(r: WorkingRow) =>
				r.tentativePosition &&
				normalizeName(r.tentativePosition).includes('wakil') &&
				normalizeName(r.tentativePosition).includes('ketua'),
		);
		if (wakilRows.length > 1) {
			const names = wakilRows.map((r: WorkingRow) => r.memberName);
			const opts = names.map((n: string) => ({ value: n, label: n }));
			questions.push({
				id: `dup_wakil_${period}`,
				type: 'resolve_duplicate_bph',
				title: `Lebih dari satu kandidat Wakil Ketua (periode ${period})`,
				description: 'Pilih satu sebagai Wakil Ketua Himpunan.',
				options: opts,
				context: { period, names, role: 'wakil' },
			});
		}
	}
	return questions;
}

function detectMissingDivisionHeads(rows: WorkingRow[]): OrgAutoFillQuestion[] {
	const qs: OrgAutoFillQuestion[] = [];
	for (const [period, list] of Array.from(groupByPeriod(rows).entries())) {
		if (!period || period === '_none_') continue;
		const headsByKey = new Set<string>();
		const membersByKey = new Map<string, WorkingRow[]>();
		for (const r of list) {
			const tp = r.tentativePosition;
			if (!tp) continue;
			const suf = parseDivisionSuffixFromPosition(tp);
			if (!suf) continue;
			const key = normalizeName(divisionLabelForPosition(suf));
			if (isDivisionHeadPositionLabel(tp)) {
				headsByKey.add(key);
			} else if (isDivisionMemberPositionLabel(tp)) {
				if (!membersByKey.has(key)) membersByKey.set(key, []);
				membersByKey.get(key)!.push(r);
			}
		}
		for (const [key, mems] of Array.from(membersByKey.entries())) {
			if (headsByKey.has(key)) continue;
			if (mems.length === 0) continue;
			const first = mems[0];
			const rawSuf = parseDivisionSuffixFromPosition(first.tentativePosition || '');
			const divLabel =
				first.matchedDivisionDisplay ||
				(rawSuf ? divisionLabelForPosition(rawSuf) : key);
			const id = `div_head_${period}_${key.replace(/[^a-z0-9]+/gi, '_')}`;
			if (qs.some((q) => q.id === id)) continue;
			qs.push({
				id,
				type: 'pick_position',
				title: `Pilih Ketua Divisi untuk "${divLabel}" (periode ${period})`,
				description:
					'Dokumen tidak memuat ketua divisi yang jelas. Pilih satu nama sebagai Ketua Divisi; yang lain tetap Anggota Divisi.',
				options: mems.map((m: WorkingRow) => ({
					value: m.memberName,
					label: m.memberName,
				})),
				context: { period, divisionLabel: divLabel, divisionKey: key },
			});
		}
	}
	return qs;
}

function detectPeriodQuestion(
	rows: WorkingRow[],
	knownPeriods: string[],
	hint?: string,
): OrgAutoFillQuestion | null {
	const needs = rows.some((r) => !r.period || r.issueCodes.includes('unknown_period'));
	if (!needs) return null;
	const suggested = normalizePeriodCanonical(hint, { knownPeriods });
	const opts: OrgAutoFillQuestionOption[] = [];
	for (const p of knownPeriods) {
		opts.push({ value: p, label: p });
	}
	if (suggested && !opts.some((o) => o.value === suggested)) {
		opts.unshift({ value: suggested, label: `${suggested} (dari hint/normalisasi)` });
	}
	return {
		id: 'confirm_period_global',
		type: 'confirm_period',
		title: 'Konfirmasi periode kepengurusan',
		description:
			'Periode tidak terdeteksi dengan jelas dari dokumen. Pilih periode yang benar (akan dinormalisasi ke format YYYY-YYYY+1 bila hanya tahun tunggal).',
		options: opts.length ? opts : [{ value: suggested || '2026-2027', label: suggested || '2026-2027' }],
		context: { hint },
	};
}

const CREATE_NEW_DIVISION_SENTINEL = '__create_new__';

function detectDivisionQuestions(
	rows: WorkingRow[],
	divisions: DivisionDoc[],
): OrgAutoFillQuestion[] {
	const qs: OrgAutoFillQuestion[] = [];
	for (const r of rows) {
		if (!r.issueCodes.includes('unknown_division') || !r.divisionNameRaw) continue;
		const id = `map_division_${normalizeNameForDedupe(r.divisionNameRaw)}`.replace(
			/[^a-z0-9_]/gi,
			'_',
		);
		if (qs.some((q) => q.id === id)) continue;
		const existingOpts: OrgAutoFillQuestionOption[] = divisions.map((d) => ({
			value: String(d._id),
			label: String(d.displayName || d.name),
		}));
		const createOpt: OrgAutoFillQuestionOption = {
			value: CREATE_NEW_DIVISION_SENTINEL,
			label: `+ Buat divisi baru "${r.divisionNameRaw}"`,
		};
		qs.push({
			id,
			type: 'map_division',
			title: `Petakan divisi "${r.divisionNameRaw}"`,
			description:
				'Pilih divisi sistem yang sesuai, atau buat divisi baru dari label dokumen.',
			options: [...existingOpts, createOpt],
			context: { raw: r.divisionNameRaw },
		});
	}
	return qs;
}

function detectAmbiguousPeriodQuestion(
	extracted: GeminiExtractShapeV2,
	knownPeriods: string[],
): OrgAutoFillQuestion | null {
	const periods = extracted.periods || [];
	if (periods.length <= 1) return null;
	const opts: OrgAutoFillQuestionOption[] = periods.map((p) => {
		const py = p.startYear ?? (p.period ? parseInt(String(p.period).slice(0, 4), 10) : NaN);
		const canon = !Number.isNaN(py)
			? normalizePeriodCanonical(String(py), { knownPeriods })
			: normalizePeriodCanonical(p.period || '', { knownPeriods });
		return {
			value: canon || String(p.period),
			label: `${canon || p.period} (${p.evidence || 'tanpa evidence'})`,
		};
	});
	return {
		id: 'select_period_from_doc',
		type: 'select_period',
		title: 'Dokumen menyebut beberapa periode',
		description: 'Pilih periode yang ingin dipakai untuk impor struktur ini.',
		options: opts,
	};
}

function isKetuaHimpunanOnly(pos: string): boolean {
	const n = normalizeName(pos);
	return (
		n.includes('ketua') &&
		n.includes('himpunan') &&
		!n.includes('wakil') &&
		!n.includes('divisi')
	);
}

function applyDuplicateKetuaAnswers(
	rows: WorkingRow[],
	period: string,
	ketuaName: string,
	wakilName: string,
	validPositions: string[],
): void {
	const list = rows.filter((r) => r.period === period);
	const ketuaPos =
		findBestBphPosition('ketua', validPositions) || 'Ketua Himpunan';
	const wakilPos =
		findBestBphPosition('wakil', validPositions) || 'Wakil Ketua Himpunan';
	const anggotaFallback =
		validPositions.find((p) => normalizeName(p).includes('anggota')) || null;
	for (const r of list) {
		if (normalizeNameForDedupe(r.memberName) === normalizeNameForDedupe(ketuaName)) {
			r.tentativePosition = ketuaPos;
			r.issueCodes = r.issueCodes.filter((c) => c !== 'unknown_role');
		} else if (
			normalizeNameForDedupe(r.memberName) === normalizeNameForDedupe(wakilName)
		) {
			r.tentativePosition = wakilPos;
			r.issueCodes = r.issueCodes.filter((c) => c !== 'unknown_role');
		} else if (r.tentativePosition && isKetuaHimpunanOnly(r.tentativePosition)) {
			if (anggotaFallback) {
				r.tentativePosition = anggotaFallback;
				r.issueCodes = r.issueCodes.filter((c) => c !== 'unknown_role');
			} else {
				r.tentativePosition = null;
				if (!r.issueCodes.includes('unknown_role')) r.issueCodes.push('unknown_role');
			}
		}
	}
}

function mergeAnswersIntoRows(
	rows: WorkingRow[],
	answers: Record<string, unknown>,
	questions: OrgAutoFillQuestion[],
	extracted: GeminiExtractShapeV2,
	ctx: {
		knownPeriods: string[];
		divisions: DivisionDoc[];
		getPositionsForPeriod: (period: string) => Promise<PositionRef[]>;
		storage: TenantStorageType;
	},
): Promise<WorkingRow[]> {
	return (async () => {
		const out = rows.map((r) => ({ ...r, issueCodes: [...r.issueCodes] }));
		const createdDivisionsCache = new Map<string, DivisionDoc>();

		const globalPeriod = answers['confirm_period_global'] as string | undefined;
		const selectedDocPeriod = answers['select_period_from_doc'] as string | undefined;
		if (typeof globalPeriod === 'string' && globalPeriod.trim()) {
			const canon = normalizePeriodCanonical(globalPeriod.trim(), {
				knownPeriods: ctx.knownPeriods,
			});
			for (const r of out) {
				if (!r.period) r.period = canon;
				if (r.period) {
					r.issueCodes = r.issueCodes.filter((c) => c !== 'unknown_period');
				}
			}
		}
		if (typeof selectedDocPeriod === 'string' && selectedDocPeriod.trim()) {
			const canon = normalizePeriodCanonical(selectedDocPeriod.trim(), {
				knownPeriods: ctx.knownPeriods,
			});
			for (const r of out) {
				r.period = canon;
				r.issueCodes = r.issueCodes.filter((c) => c !== 'unknown_period');
			}
		}

		for (const q of questions) {
			if (q.type === 'resolve_duplicate_bph' && q.id.startsWith('dup_ketua_')) {
				const period = (q.context?.period as string) || '';
				const a = answers[q.id] as { ketua?: string; wakil?: string } | undefined;
				if (a?.ketua && a?.wakil && period) {
					const posList = orgDocsToPositionRefs(
						(await ctx.getPositionsForPeriod(period)) as PositionRef[],
					);
					const validNames = posList.map((p) => p.name);
					applyDuplicateKetuaAnswers(out, period, a.ketua, a.wakil, validNames);
				}
			}
			if (q.type === 'resolve_duplicate_bph' && q.id.startsWith('dup_wakil_')) {
				const period = (q.context?.period as string) || '';
				const pick = answers[q.id] as string | undefined;
				if (pick && period) {
					const posList = orgDocsToPositionRefs(
						(await ctx.getPositionsForPeriod(period)) as PositionRef[],
					);
					const validNames = posList.map((p) => p.name);
					const wakilPos =
						findBestBphPosition('wakil', validNames) || 'Wakil Ketua Himpunan';
					for (const r of out) {
						if (r.period !== period) continue;
						if (normalizeNameForDedupe(r.memberName) === normalizeNameForDedupe(pick)) {
							r.tentativePosition = wakilPos;
						}
					}
				}
			}
			if (q.type === 'map_division') {
				const divId = answers[q.id] as string | undefined;
				if (!divId) continue;
				const rawLabel = String(q.context?.raw || '');

				let resolvedDivId: string;
				let resolvedDivDisplay: string;

				if (divId === CREATE_NEW_DIVISION_SENTINEL) {
					const displayName = rawLabel.trim().replace(/\s+/g, ' ');
					const slug = displayName
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '_')
						.replace(/^_|_$/g, '');
					const uniqueSlug = ctx.divisions.some((d) => d.name === slug)
						? `${slug}_${Date.now()}`
						: slug;

					if (!createdDivisionsCache.has(normalizeName(rawLabel))) {
						const canonicalLabel = divisionLabelForPosition(displayName);
						const created = await ctx.storage.createDivision({
							name: uniqueSlug,
							displayName,
							description: '',
							positions: [
								sanitizePositionName(`Ketua Divisi ${canonicalLabel}`),
								sanitizePositionName(`Anggota Divisi ${canonicalLabel}`),
							],
							color: '#3B82F6',
						});
						const newDiv: DivisionDoc = {
							_id: (created as any)._id,
							name: uniqueSlug,
							displayName,
						};
						ctx.divisions.push(newDiv);
						createdDivisionsCache.set(normalizeName(rawLabel), newDiv);
					}
					const cached = createdDivisionsCache.get(normalizeName(rawLabel))!;
					resolvedDivId = String(cached._id);
					resolvedDivDisplay = String(cached.displayName || cached.name);
				} else {
					const div = ctx.divisions.find((d) => String(d._id) === divId);
					if (!div) continue;
					resolvedDivId = divId;
					resolvedDivDisplay = String(div.displayName || div.name);
				}

				for (const r of out) {
					if (!r.divisionNameRaw || normalizeName(r.divisionNameRaw) !== normalizeName(rawLabel)) continue;
					if (!r.issueCodes.includes('unknown_division')) continue;
					r.matchedDivisionId = resolvedDivId;
					r.matchedDivisionDisplay = resolvedDivDisplay;
					r.issueCodes = r.issueCodes.filter((c) => c !== 'unknown_division');
					const rawPk =
						r.period ||
						(typeof globalPeriod === 'string' && globalPeriod.trim()
							? normalizePeriodCanonical(globalPeriod.trim(), {
									knownPeriods: ctx.knownPeriods,
								})
							: '');
					const posList = orgDocsToPositionRefs(
						(await ctx.getPositionsForPeriod(rawPk)) as PositionRef[],
					);
					const headLike = /ketua|koordinator|kepala/i.test(r.rawRoleLabel);
					r.tentativePosition = findDivisionPosition(
						headLike ? 'head' : 'member',
						resolvedDivDisplay,
						posList.map((p) => p.name),
					);
					r.issueCodes = r.issueCodes.filter((c) => c !== 'unknown_role');
				}
			}
			if (q.type === 'pick_position' && q.id.startsWith('div_head_')) {
				const pick = answers[q.id] as string | undefined;
				const period = q.context?.period as string | undefined;
				const divisionKey = q.context?.divisionKey as string | undefined;
				const divLabel = String(q.context?.divisionLabel || '');
				if (!pick || !period || !divisionKey) continue;
				const posList = orgDocsToPositionRefs(
					(await ctx.getPositionsForPeriod(period)) as PositionRef[],
				);
				const validNames = posList.map((p) => p.name);
				const headPos = findDivisionPosition('head', divLabel, validNames);
				for (const r of out) {
					if (r.period !== period) continue;
					const tp = r.tentativePosition;
					if (!tp || !isDivisionMemberPositionLabel(tp)) continue;
					const suf = parseDivisionSuffixFromPosition(tp);
					if (!suf) continue;
					const k = normalizeName(divisionLabelForPosition(suf));
					if (k !== normalizeName(divisionKey)) continue;
					if (normalizeNameForDedupe(r.memberName) === normalizeNameForDedupe(pick)) {
						r.tentativePosition = headPos || sanitizePositionName(`Ketua Divisi ${divLabel}`);
					}
				}
			}
		}

		for (const r of out) {
			if (r.period) {
				r.issueCodes = r.issueCodes.filter((c) => c !== 'unknown_period');
			}
			if (r.tentativePosition) {
				r.issueCodes = r.issueCodes.filter((c) => c !== 'unknown_role');
			}
		}
		await enforceDivisionHeadsFromTopOrder(out, {
			getPositionsForPeriod: ctx.getPositionsForPeriod,
		});

		return out;
	})();
}

async function ensurePositionsExist(
	period: string,
	positionName: string,
	storage: TenantStorageType,
): Promise<boolean> {
	let posList = orgDocsToPositionRefs(
		(await storage.getPositionsByPeriod(period)) as any[],
	);
	const canonicalPos = positionName;
	const exists = posList.some(
		(p) => normalizeName(p.name) === normalizeName(canonicalPos),
	);
	if (!exists) {
		const maxOrder = posList.reduce((m, p) => Math.max(m, p.order ?? 0), 0);
		posList = [...posList, { name: canonicalPos, order: maxOrder + 1 }];
		await storage.createPositionsForPeriod(period, posList);
		return true;
	}
	return false;
}

async function executeWorkingRows(
	rows: WorkingRow[],
	opts: {
		periodHint?: string;
		seedMembers: MemberRef[];
		storage: TenantStorageType;
		rawExtracted: GeminiExtractShapeV2;
	},
): Promise<AutoFillResult> {
	const { storage, seedMembers } = opts;
	let updated = 0;
	let createdMembers = 0;
	let createdPositions = 0;
	let skipped = 0;
	const details: AutoFillDetail[] = [];

	for (const row of rows) {
		let targetPeriod = normalizePeriodCanonical(row.period, {
			hint: opts.periodHint,
			knownPeriods: await storage.getOrganizationPeriods(),
		});
		if (!targetPeriod) {
			skipped++;
			details.push({
				memberId: '',
				name: row.memberName,
				position: row.tentativePosition || '',
				period: '',
				status: 'skipped',
				reason:
					'period tidak terdeteksi — jawab pertanyaan periode atau isi hint di UI',
			});
			continue;
		}

		const canonicalPos = row.tentativePosition
			? sanitizePositionName(row.tentativePosition.trim())
			: '';
		if (!canonicalPos) {
			skipped++;
			details.push({
				memberId: '',
				name: row.memberName,
				position: row.rawRoleLabel,
				period: targetPeriod,
				status: 'skipped',
				reason: 'posisi tidak terpetakan — selesaikan pertanyaan di pratinjau',
			});
			continue;
		}

		const createdPos = await ensurePositionsExist(
			targetPeriod,
			canonicalPos,
			storage,
		);
		if (createdPos) createdPositions++;

		const rawMembers = await storage.getOrganizationMembersByPeriod(
			targetPeriod,
		);
		let memberRefs = orgDocsToMemberRefs(rawMembers as any[]);
		memberRefs = seedMembers.length
			? [...memberRefs, ...seedMembers.filter((s) => !memberRefs.some((m) => m.id === s.id))]
			: memberRefs;

		let memberId = findMemberId(memberRefs, row.memberName);
		let existing: any = memberId
			? await storage.getOrganizationMemberById(memberId)
			: null;

		if (!existing) {
			const created = await storage.createOrganizationMember({
				name: row.memberName.trim() || 'Tanpa nama',
				position: canonicalPos,
				period: targetPeriod,
				imageUrl: DEFAULT_MEMBER_IMAGE,
			});
			createdMembers++;
			const cid = String((created as any)._id ?? (created as any).id);
			details.push({
				memberId: cid,
				name: row.memberName,
				position: canonicalPos,
				period: targetPeriod,
				status: 'created',
			});
			continue;
		}

		if (String((existing as any).period) !== String(targetPeriod)) {
			skipped++;
			details.push({
				memberId: String((existing as any)._id),
				name: row.memberName,
				position: canonicalPos,
				period: targetPeriod,
				status: 'skipped',
				reason: 'anggota ditemukan tetapi period berbeda',
			});
			continue;
		}

		const curPos = String((existing as any).position || '');
		if (curPos === canonicalPos) {
			details.push({
				memberId: String((existing as any)._id),
				name: (existing as any).name || row.memberName,
				position: canonicalPos,
				period: targetPeriod,
				status: 'unchanged',
			});
			continue;
		}

		await storage.updateOrganizationMember(String((existing as any)._id), {
			position: canonicalPos,
		});
		updated++;
		details.push({
			memberId: String((existing as any)._id),
			name: (existing as any).name || row.memberName,
			position: canonicalPos,
			period: targetPeriod,
			status: 'updated',
		});
	}

	await syncDivisionPositionsFromRows(rows, storage);

	return {
		updated,
		createdMembers,
		createdPositions,
		skipped,
		details,
		raw: opts.rawExtracted,
	};
}

export async function previewOrganizationStructureAutoFill(opts: {
	file: Express.Multer.File;
	periodHint?: string;
	members?: MemberRef[];
	positions?: PositionRef[];
	storage: TenantStorageType;
}): Promise<OrgAutoFillPreviewResult> {
	const { file, storage } = opts;
	const periodHint = normalizePeriodString(opts.periodHint);
	const seedMembers = opts.members?.length ? opts.members : [];
	const seedPositions = opts.positions?.length ? opts.positions : [];

	const { isPdf, isWord, isImage } = resolveDocumentMime(file);
	if (!isPdf && !isWord && !isImage) {
		throw new Error(
			'Format tidak didukung. Unggah gambar, PDF, atau Word (.doc/.docx).',
		);
	}

	const knownPeriods: string[] = await storage.getOrganizationPeriods();
	const divisionPeriod =
		normalizePeriodCanonical(periodHint || '', { knownPeriods }) ||
		knownPeriods[0] ||
		'';
	const divisions = (await storage.getAllDivisions(
		divisionPeriod || undefined,
	)) as DivisionDoc[];

	const extracted = await extractAssignmentsWithGemini(file.buffer, file, {
		hintPeriod: periodHint || undefined,
		knownPeriods,
		seedMembers,
		seedPositions,
	});

	const getPositionsForPeriod = async (p: string) => {
		const list = await storage.getPositionsByPeriod(p);
		return orgDocsToPositionRefs((list || []) as PositionRef[]);
	};

	const workingRows = await buildWorkingRows(extracted, {
		periodHint: periodHint || undefined,
		knownPeriods,
		divisions,
		getPositionsForPeriod,
	});

	const conflicts: OrgAutoFillConflict[] = [];
	for (const r of workingRows) {
		for (const c of r.issueCodes) {
			conflicts.push({
				code: c,
				detail: `${r.memberName}: ${c}`,
				meta: { memberName: r.memberName },
			});
		}
	}

	let questions: OrgAutoFillQuestion[] = [];

	const ambiguous = detectAmbiguousPeriodQuestion(extracted, knownPeriods);
	if (ambiguous) questions.push(ambiguous);

	const pq = detectPeriodQuestion(workingRows, knownPeriods, periodHint);
	if (pq) questions.push(pq);

	const samplePeriod =
		workingRows.find((r) => r.period)?.period ||
		normalizePeriodCanonical(periodHint, { knownPeriods }) ||
		knownPeriods[0] ||
		'';
	questions = questions.concat(detectDuplicateBph(workingRows));
	questions = questions.concat(detectDivisionQuestions(workingRows, divisions));

	const previewData: OrgAutoFillPreviewData = {
		version: 1,
		extracted,
		context: {
			periodHint: periodHint || undefined,
			seedMembers,
			seedPositions,
			knownPeriods,
		},
		workingRows,
		questionIds: questions.map((q) => q.id),
	};

	const draftRows = workingRows.map((r) => ({
		memberName: r.memberName,
		period: r.period,
		suggestedPosition: r.tentativePosition,
		needsClarification:
			r.issueCodes.length > 0 ||
			questions.some((q) => q.context && (q.context as any).memberName === r.memberName),
		issues: [...r.issueCodes],
	}));

	const summaryLines = [
		`Baris ekstraksi: ${extracted.assignments.length}`,
		`Periode tersirat: ${samplePeriod || '(belum pasti)'}`,
		questions.length
			? `Perlu ${questions.length} konfirmasi sebelum menerapkan.`
			: 'Siap diterapkan tanpa konfirmasi tambahan.',
	];
	const summary = summaryLines.join(' ');

	return {
		mode: 'preview',
		summary,
		questions,
		conflicts,
		previewData,
		draftRows,
	};
}

export async function applyOrganizationStructureAutoFill(opts: {
	previewData: OrgAutoFillPreviewData;
	answers: Record<string, unknown>;
	storage: TenantStorageType;
}): Promise<AutoFillResult> {
	const { previewData, answers, storage } = opts;
	if (!previewData || previewData.version !== 1) {
		throw new Error('previewData tidak valid');
	}

	const { periodHint, knownPeriods } = previewData.context;
	const divisionPeriod =
		normalizePeriodCanonical(periodHint || '', { knownPeriods }) ||
		knownPeriods[0] ||
		'';
	const divisions = (await storage.getAllDivisions(
		divisionPeriod || undefined,
	)) as DivisionDoc[];
	const getPositionsForPeriod = async (p: string) => {
		const list = await storage.getPositionsByPeriod(p);
		return orgDocsToPositionRefs((list || []) as PositionRef[]);
	};

	/* Bangun ulang working rows dari extracted agar konsisten dengan mergeAnswers */
	let rows = await buildWorkingRows(previewData.extracted, {
		periodHint: previewData.context.periodHint,
		knownPeriods: previewData.context.knownPeriods,
		divisions,
		getPositionsForPeriod,
	});

	const questionsReplay: OrgAutoFillQuestion[] = [];
	const ambiguous = detectAmbiguousPeriodQuestion(
		previewData.extracted,
		previewData.context.knownPeriods,
	);
	if (ambiguous) questionsReplay.push(ambiguous);
	const pq = detectPeriodQuestion(
		rows,
		previewData.context.knownPeriods,
		previewData.context.periodHint,
	);
	if (pq) questionsReplay.push(pq);
	questionsReplay.push(...detectDuplicateBph(rows));
	questionsReplay.push(...detectDivisionQuestions(rows, divisions));

	rows = await mergeAnswersIntoRows(rows, answers, questionsReplay, previewData.extracted, {
		knownPeriods: previewData.context.knownPeriods,
		divisions,
		getPositionsForPeriod,
		storage,
	});

	const blocking = rows.filter(
		(r) =>
			!r.period ||
			!r.tentativePosition ||
			r.issueCodes.includes('unknown_period') ||
			r.issueCodes.includes('unknown_role'),
	);
	if (blocking.length) {
		const still = blocking
			.map((r) => `${r.memberName}: ${r.issueCodes.join(',') || 'period/posisi kosong'}`)
			.join('; ');
		throw new Error(
			`Masih ada data yang belum terselesaikan: ${still}. Lengkapi jawaban atau perbaiki dokumen.`,
		);
	}

	return executeWorkingRows(rows, {
		periodHint: previewData.context.periodHint,
		seedMembers: previewData.context.seedMembers,
		storage,
		rawExtracted: previewData.extracted,
	});
}

/** @deprecated gunakan preview + apply */
export async function runOrganizationStructureAutoFill(opts: {
	file: Express.Multer.File;
	periodHint?: string;
	members?: MemberRef[];
	positions?: PositionRef[];
	storage: TenantStorageType;
}): Promise<AutoFillResult> {
	const preview = await previewOrganizationStructureAutoFill(opts);
	if (preview.questions.length > 0) {
		throw new Error(
			'Dokumen memerlukan konfirmasi (konflik periode/jabatan/divisi). Gunakan alur pratinjau dan jawab pertanyaan di UI.',
		);
	}
	return applyOrganizationStructureAutoFill({
		previewData: preview.previewData,
		answers: {},
		storage: opts.storage,
	});
}
