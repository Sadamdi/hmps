/**
 * Katalog & decoder NIM UIN Maulana Malik Ibrahim Malang.
 *
 * Sumber struktur (Pedoman Pascasarjana 2026 + observasi MSAA S1):
 *   Digit 1–2  : tahun masuk / pendaftaran (YY)
 *   Digit 3–4  : kode Fakultas / unit Pascasarjana (FF)
 *   Digit 5–6  : kode Program Studi (PP)
 *   Digit 7    : jenjang (1=S1, 2=S2, 3=S3; lainnya jarang/belum resmi dipublikasikan)
 *   Digit 8    : semester masuk (1=ganjil, 2=genap — pola pedoman Pascasarjana)
 *   Digit 9–12 : nomor urut
 *
 * S1 modern hampir selalu berakhiran segmen "11" (jenjang 1 + semester 1).
 * Kode PP S1 di bawah berasal dari daftar mahasantri MSAA publik.
 * Kode PP S2/S3/profesi: pedoman menyebut ada kode prodi, tetapi tabel angka
 *   resmi tidak dipublikasikan penuh di PDF yang diekstrak — prodi tetap
 *   dicantumkan di katalog kampus; decoder bilang "belum terpetakan" jika digit PP
 *   tidak cocok.
 */

export type UinJenjang = 'S1' | 'S2' | 'S3' | 'Profesi' | 'Unknown';

export type UinFacultyCode = {
	code: string;
	name: string;
	shortName: string;
};

export type UinProdiCode = {
	facultyCode: string;
	prodiCode: string;
	name: string;
	jenjang: UinJenjang;
	/** true = digit PP terobservasi publik / terkonfirmasi pola MSAA */
	codeConfirmed: boolean;
};

/** Semua unit akademik yang punya kode FF di NIM modern (gap 08 = Pascasarjana). */
export const UIN_FACULTY_CODES: Record<string, UinFacultyCode> = {
	'01': {
		code: '01',
		name: 'Fakultas Ilmu Tarbiyah dan Keguruan (FITK)',
		shortName: 'FITK / Tarbiyah',
	},
	'02': {
		code: '02',
		name: 'Fakultas Syariah (termasuk pola NIM modern untuk IAT/Hadis)',
		shortName: 'Syariah',
	},
	'03': {
		code: '03',
		name: 'Fakultas Humaniora',
		shortName: 'Humaniora',
	},
	'04': {
		code: '04',
		name: 'Fakultas Psikologi',
		shortName: 'Psikologi',
	},
	'05': {
		code: '05',
		name: 'Fakultas Ekonomi',
		shortName: 'Ekonomi',
	},
	'06': {
		code: '06',
		name: 'Fakultas Sains dan Teknologi (SAINTEK)',
		shortName: 'SAINTEK',
	},
	'07': {
		code: '07',
		name: 'Fakultas Kedokteran dan Ilmu Kesehatan (FKIK)',
		shortName: 'FKIK',
	},
	'08': {
		code: '08',
		name: 'Program Pascasarjana (unit Pascasarjana / Kampus 2)',
		shortName: 'Pascasarjana',
	},
	'09': {
		code: '09',
		name: 'Fakultas Teknik',
		shortName: 'Teknik',
	},
};

/**
 * Mapping digit PP yang dipakai decoder.
 * S1: codeConfirmed dari MSAA. S2/S3/Profesi: entri katalog tanpa digit
 * tetap ada di UIN_CAMPUS_PROGRAM_CATALOG; di sini hanya yang punya/perkiraan digit.
 */
export const UIN_PRODI_CODES: UinProdiCode[] = [
	// ── FITK 01 · S1 ──
	{ facultyCode: '01', prodiCode: '01', name: 'Pendidikan Agama Islam', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '01', prodiCode: '02', name: 'Pendidikan Ilmu Pengetahuan Sosial', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '01', prodiCode: '03', name: 'Pendidikan Guru Madrasah Ibtidaiyah (PGMI)', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '01', prodiCode: '04', name: 'Pendidikan Bahasa Arab', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '01', prodiCode: '05', name: 'Pendidikan Islam Anak Usia Dini (PIAUD)', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '01', prodiCode: '06', name: 'Manajemen Pendidikan Islam', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '01', prodiCode: '07', name: 'Tadris Bahasa Inggris', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '01', prodiCode: '08', name: 'Tadris Matematika', jenjang: 'S1', codeConfirmed: true },

	// ── Syariah 02 · S1 ──
	{ facultyCode: '02', prodiCode: '01', name: 'Hukum Keluarga Islam (Ahwal Syakhshiyyah)', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '02', prodiCode: '02', name: 'Hukum Ekonomi Syariah (Muamalah)', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '02', prodiCode: '03', name: 'Hukum Tata Negara (Siyasah)', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '02', prodiCode: '04', name: "Ilmu Al-Qur'an dan Tafsir", jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '02', prodiCode: '05', name: 'Ilmu Hadis', jenjang: 'S1', codeConfirmed: true },

	// ── Humaniora 03 · S1 ──
	{ facultyCode: '03', prodiCode: '01', name: 'Bahasa dan Sastra Arab', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '03', prodiCode: '02', name: 'Sastra Inggris', jenjang: 'S1', codeConfirmed: true },

	// ── Psikologi 04 · S1 ──
	{ facultyCode: '04', prodiCode: '01', name: 'Psikologi', jenjang: 'S1', codeConfirmed: true },

	// ── Ekonomi 05 · S1 ──
	{ facultyCode: '05', prodiCode: '01', name: 'Manajemen', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '05', prodiCode: '02', name: 'Akuntansi', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '05', prodiCode: '03', name: 'Perbankan Syariah', jenjang: 'S1', codeConfirmed: true },

	// ── SAINTEK 06 · S1 ──
	{ facultyCode: '06', prodiCode: '01', name: 'Matematika', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '06', prodiCode: '02', name: 'Biologi', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '06', prodiCode: '03', name: 'Kimia', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '06', prodiCode: '04', name: 'Fisika', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '06', prodiCode: '05', name: 'Teknik Informatika', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '06', prodiCode: '06', name: 'Teknik Arsitektur', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '06', prodiCode: '07', name: 'Perpustakaan dan Sains Informasi', jenjang: 'S1', codeConfirmed: true },

	// ── FKIK 07 · S1 (07-02 belum muncul di sampel MSAA publik) ──
	{ facultyCode: '07', prodiCode: '01', name: 'Pendidikan Dokter', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '07', prodiCode: '03', name: 'Farmasi', jenjang: 'S1', codeConfirmed: true },

	// ── Teknik 09 · S1 (PMB masih menaruh di bawah SAINTEK; NIM modern MSAA = 09) ──
	{ facultyCode: '09', prodiCode: '01', name: 'Teknik Sipil', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '09', prodiCode: '02', name: 'Teknik Lingkungan', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '09', prodiCode: '03', name: 'Teknik Mesin', jenjang: 'S1', codeConfirmed: true },
	{ facultyCode: '09', prodiCode: '04', name: 'Teknik Elektro', jenjang: 'S1', codeConfirmed: true },
];

export type CampusProgram = {
	facultyCode: string;
	jenjang: UinJenjang;
	name: string;
	/** Digit PP bila diketahui; null = ada di kampus tapi kode digit belum publik */
	prodiCode: string | null;
	note?: string;
};

/**
 * Katalog program yang diselenggarakan kampus (PMB + situs fakultas + Pascasarjana).
 * Dipakai panduan UI — lengkap S1/S2/S3/Profesi meski digit PP belum semua diketahui.
 */
export const UIN_CAMPUS_PROGRAM_CATALOG: CampusProgram[] = [
	// S1 — mirror confirmed + catatan
	...UIN_PRODI_CODES.filter((p) => p.jenjang === 'S1').map((p) => ({
		facultyCode: p.facultyCode,
		jenjang: 'S1' as const,
		name: p.name,
		prodiCode: p.prodiCode,
	})),

	// S2 di fakultas
	{ facultyCode: '01', jenjang: 'S2', name: 'Magister Pendidikan Matematika', prodiCode: null, note: 'Kode digit PP belum dipublikasikan di sumber terbuka' },
	{ facultyCode: '04', jenjang: 'S2', name: 'Magister Psikologi', prodiCode: null, note: 'Kode digit PP belum dipublikasikan di sumber terbuka' },
	{ facultyCode: '06', jenjang: 'S2', name: 'Magister Biologi', prodiCode: null, note: 'Kode digit PP belum dipublikasikan di sumber terbuka' },
	{ facultyCode: '06', jenjang: 'S2', name: 'Magister Informatika', prodiCode: null, note: 'Kode digit PP belum dipublikasikan di sumber terbuka' },
	{ facultyCode: '07', jenjang: 'S2', name: 'Magister Ilmu Biomedis', prodiCode: null, note: 'Kode digit PP belum dipublikasikan di sumber terbuka' },
	{ facultyCode: '07', jenjang: 'S2', name: 'Magister Farmasi', prodiCode: null, note: 'Kode digit PP belum dipublikasikan di sumber terbuka' },

	// S2 unit Pascasarjana (FF biasanya 08)
	{ facultyCode: '08', jenjang: 'S2', name: 'Magister Manajemen Pendidikan Islam', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S2', name: 'Magister Pendidikan Bahasa Arab', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S2', name: 'Magister Pendidikan Guru Madrasah Ibtidaiyah', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S2', name: 'Magister Pendidikan Agama Islam', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S2', name: 'Magister Al-Ahwal Al-Syakhsiyah', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S2', name: 'Magister Ekonomi Syariah', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S2', name: 'Magister Bahasa dan Sastra Arab', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S2', name: 'Magister Studi Islam', prodiCode: null },

	// S3 unit Pascasarjana
	{ facultyCode: '08', jenjang: 'S3', name: 'Doktor Manajemen Pendidikan Islam', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S3', name: 'Doktor Pendidikan Bahasa Arab', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S3', name: 'Doktor Pendidikan Agama Islam', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S3', name: 'Doktor Hukum Keluarga Islam (Ahwal Syakhshiyah)', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S3', name: 'Doktor Ekonomi Syariah', prodiCode: null },
	{ facultyCode: '08', jenjang: 'S3', name: 'Doktor Studi Islam', prodiCode: null },

	// Profesi
	{ facultyCode: '01', jenjang: 'Profesi', name: 'Pendidikan Profesi Guru (PPG)', prodiCode: null, note: 'Pola digit NIM profesi belum dipublikasikan penuh' },
	{ facultyCode: '07', jenjang: 'Profesi', name: 'Profesi Dokter', prodiCode: null, note: 'Pola digit NIM profesi belum dipublikasikan penuh' },
	{ facultyCode: '07', jenjang: 'Profesi', name: 'Pendidikan Profesi Apoteker', prodiCode: null, note: 'Pola digit NIM profesi belum dipublikasikan penuh' },
];

export const UIN_JENJANG_DIGIT: Record<string, UinJenjang> = {
	'1': 'S1',
	'2': 'S2',
	'3': 'S3',
	'4': 'Profesi',
};

export const UIN_SEMESTER_DIGIT: Record<string, string> = {
	'1': 'Semester ganjil (masuk)',
	'2': 'Semester genap (masuk)',
};

function lookupProdi(
	facultyCode: string,
	prodiCode: string,
	jenjang?: UinJenjang,
): UinProdiCode | undefined {
	return UIN_PRODI_CODES.find(
		(p) =>
			p.facultyCode === facultyCode &&
			p.prodiCode === prodiCode &&
			(!jenjang || jenjang === 'Unknown' || p.jenjang === jenjang),
	);
}

export type NimDecodeResult = {
	ok: boolean;
	raw: string;
	year?: number;
	facultyCode?: string;
	facultyName?: string;
	facultyShortName?: string;
	prodiCode?: string;
	prodiName?: string;
	jenjangDigit?: string;
	jenjang?: UinJenjang;
	semesterDigit?: string;
	semesterLabel?: string;
	/** Legacy: digits 7–8 together */
	programSegment?: string;
	programSegmentLabel?: string;
	serial?: string;
	isTiModern?: boolean;
	knownFaculty?: boolean;
	knownProdi?: boolean;
	message?: string;
	notes?: string[];
	/** Program kampus terkait fakultas+jenjang (untuk hint UI) */
	relatedPrograms?: CampusProgram[];
};

/** Decode NIM 12-digit modern UIN Malang (S1–S3/profesi bila digit terbaca). */
export function decodeUinMalangNim(input: string): NimDecodeResult {
	const raw = (input || '').replace(/\D/g, '');
	if (!raw) return { ok: false, raw: '', message: 'Masukkan NIM (angka).' };

	if (raw.length === 8) {
		return {
			ok: false,
			raw,
			message:
				'NIM 8 digit (format lama). Decoder ini untuk NIM 12 digit modern. Cek SIAKAD untuk detail.',
		};
	}

	if (raw.length !== 12) {
		return {
			ok: false,
			raw,
			message:
				raw.length < 12
					? 'NIM modern biasanya 12 digit. Format lebih pendek tidak di-decode penuh.'
					: 'Panjang NIM tidak sesuai pola 12 digit modern.',
		};
	}

	const year = Number(raw.slice(0, 2));
	const facultyCode = raw.slice(2, 4);
	const prodiCode = raw.slice(4, 6);
	const jenjangDigit = raw.slice(6, 7);
	const semesterDigit = raw.slice(7, 8);
	const programSegment = raw.slice(6, 8);
	const serial = raw.slice(8, 12);

	const faculty = UIN_FACULTY_CODES[facultyCode];
	const jenjang = UIN_JENJANG_DIGIT[jenjangDigit] ?? 'Unknown';
	const semesterLabel = UIN_SEMESTER_DIGIT[semesterDigit];
	const matched = lookupProdi(facultyCode, prodiCode, jenjang === 'Unknown' ? undefined : jenjang);
	// Fallback: S1 table sering dipakai bahkan jika digit jenjang aneh
	const matchedAny = matched || lookupProdi(facultyCode, prodiCode);
	const isTiModern = facultyCode === '06' && prodiCode === '05' && (jenjang === 'S1' || programSegment === '11');

	const relatedPrograms = UIN_CAMPUS_PROGRAM_CATALOG.filter(
		(p) =>
			p.facultyCode === facultyCode &&
			(jenjang === 'Unknown' || p.jenjang === jenjang),
	);

	const notes: string[] = [];
	const knownFaculty = !!faculty;
	const knownProdi = !!matchedAny;

	if (!knownFaculty) {
		notes.push(
			`Fakultas tidak ditemukan: kode ${facultyCode} tidak ada di tabel referensi HMPS (01–09; 08 = Pascasarjana). Periksa digit atau konfirmasi di SIAKAD.`,
		);
	}
	if (knownFaculty && !knownProdi) {
		notes.push(
			`Prodi tidak ditemukan: kode ${prodiCode} pada fakultas ${facultyCode} belum cocok dengan tabel digit terkonfirmasi. Lihat daftar program kampus untuk unit ini di bawah.`,
		);
	}
	if (jenjang === 'Unknown') {
		notes.push(
			`Jenjang (digit ke-7 = ${jenjangDigit}) tidak dikenali. Biasanya 1=S1, 2=S2, 3=S3, 4=Profesi.`,
		);
	}
	if (!semesterLabel) {
		notes.push(
			`Semester masuk (digit ke-8 = ${semesterDigit}) tidak umum (biasanya 1=ganjil, 2=genap).`,
		);
	}
	if ((jenjang === 'S2' || jenjang === 'S3' || jenjang === 'Profesi') && !knownProdi) {
		notes.push(
			'Untuk S2/S3/Profesi, tabel angka kode prodi belum seluruhnya dipublikasikan terbuka; struktur digit tetap dibaca dari Pedoman Pascasarjana 2026.',
		);
	}

	let message: string;
	if (isTiModern) {
		message = 'NIM S1 Teknik Informatika (SAINTEK) — pola modern.';
	} else if (!knownFaculty) {
		message = `Fakultas tidak ditemukan (kode ${facultyCode}). Segmen lain tetap ditampilkan.`;
	} else if (!knownProdi) {
		message = `Fakultas: ${faculty.shortName}. Prodi tidak ditemukan untuk kode ${prodiCode}${jenjang !== 'Unknown' ? ` · jenjang ${jenjang}` : ''}.`;
	} else {
		message = `NIM teridentifikasi: ${faculty.shortName} · ${matchedAny!.name}${jenjang !== 'Unknown' ? ` (${jenjang})` : ''}.`;
	}

	const segmentParts: string[] = [];
	if (jenjang !== 'Unknown') segmentParts.push(jenjang);
	if (semesterLabel) segmentParts.push(semesterLabel);

	return {
		ok: true,
		raw,
		year: 2000 + year,
		facultyCode,
		facultyName: faculty?.name ?? `Kode fakultas ${facultyCode} — tidak ditemukan`,
		facultyShortName: faculty?.shortName,
		prodiCode,
		prodiName: matchedAny?.name ?? `Kode prodi ${prodiCode} — tidak ditemukan`,
		jenjangDigit,
		jenjang,
		semesterDigit,
		semesterLabel: semesterLabel ?? `Digit semester ${semesterDigit}`,
		programSegment,
		programSegmentLabel: segmentParts.length
			? segmentParts.join(' · ')
			: `Segmen ${programSegment}`,
		serial,
		isTiModern,
		knownFaculty,
		knownProdi,
		message,
		notes: notes.length ? notes : undefined,
		relatedPrograms: relatedPrograms.length ? relatedPrograms : undefined,
	};
}

/** @deprecated use decodeUinMalangNim */
export const decodeTiNim = decodeUinMalangNim;

export function listProdiByFaculty(facultyCode: string): UinProdiCode[] {
	return UIN_PRODI_CODES.filter((p) => p.facultyCode === facultyCode);
}

export function listCampusPrograms(opts?: {
	facultyCode?: string;
	jenjang?: UinJenjang;
}): CampusProgram[] {
	return UIN_CAMPUS_PROGRAM_CATALOG.filter((p) => {
		if (opts?.facultyCode && p.facultyCode !== opts.facultyCode) return false;
		if (opts?.jenjang && p.jenjang !== opts.jenjang) return false;
		return true;
	});
}
