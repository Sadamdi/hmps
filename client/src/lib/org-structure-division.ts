/**
 * Label divisi untuk filter & diagram struktur — tidak mengandalkan daftar divisi hardcoded.
 */

const norm = (s: string) =>
	s
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/[^a-z0-9\s\u00c0-\u024f-]/gi, '')
		.trim();

/** Alias umum nama divisi (tenant) → label kanonik tampilan */
const DIVISION_ALIASES: Record<string, string> = {
	medinfo: 'Medinfo',
	'med info': 'Medinfo',
	media: 'Media Informasi',
	'media informasi': 'Media Informasi',
	'public relation': 'Public Relation',
	pr: 'Public Relation',
	'seni olahraga': 'Seni dan Olahraga',
	senor: 'Seni dan Olahraga',
};

function stripLeadingDivisi(label: string): string {
	return label.replace(/^divisi\s+/i, '').trim();
}

/** Suffix setelah "Ketua Divisi" / "Anggota Divisi" (sudah dirapikan). */
export function parseDivisionSuffixFromPosition(position: string): string | null {
	const p = position.trim().replace(/\s+/g, ' ');
	const normalized = p
		.replace(/^Anggota\s*Divisi\s*Divisi\s+/i, 'Anggota Divisi ')
		.replace(/^Ketua\s*Divisi\s*Divisi\s+/i, 'Ketua Divisi ');
	const m =
		normalized.match(/^Ketua Divisi\s+(.+)$/i) ||
		normalized.match(/^Anggota Divisi\s+(.+)$/i);
	if (!m) return null;
	let rest = m[1].trim();
	rest = rest.replace(/^Divisi\s+/i, '').trim();
	return rest || null;
}

function canonicalDivisionLabel(raw: string): string {
	const s = stripLeadingDivisi(raw.trim());
	const k = norm(s);
	return DIVISION_ALIASES[k] ?? s;
}

/** Grup filter / badge: BPH, nama divisi, atau Lainnya */
export function getDivisionFromPosition(position: string): string {
	const p = position.trim();
	const pNorm = norm(p);
	if (
		pNorm.includes(norm('Ketua Himpunan')) ||
		pNorm.includes(norm('Wakil Ketua Himpunan')) ||
		/Sekretaris\s+Himpunan/i.test(p) ||
		/Bendahara\s+Himpunan/i.test(p)
	) {
		return 'BPH';
	}

	const suf = parseDivisionSuffixFromPosition(p);
	if (suf) {
		return canonicalDivisionLabel(suf);
	}

	/* Fallback: cocokkan token panjang di posisi (nama divisi bebas) */
	const n = norm(p);
	const tokens = [
		'Senor',
		'Public Relation',
		'Religius',
		'Technopreneurship',
		'Medinfo',
		'Intelektual',
		'Media',
	];
	for (const t of tokens) {
		if (n.includes(norm(t))) {
			return canonicalDivisionLabel(t);
		}
	}

	return 'Lainnya';
}

/** Kumpulan label divisi unik dari anggota (selain BPH/Lainnya), untuk urutan diagram */
export function collectDivisionLabelsFromMembers(
	positions: string[],
): string[] {
	const set = new Set<string>();
	for (const pos of positions) {
		const g = getDivisionFromPosition(pos);
		if (g !== 'BPH' && g !== 'Lainnya') set.add(g);
	}
	return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
}
