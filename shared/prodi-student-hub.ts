/** Static student hub defaults for Prodi page (TI UIN Malang). */

export type ProdiPortalLink = {
	label: string;
	url: string;
	desc: string;
	group?: 'daily' | 'maba' | 'graduate' | 'research';
};

export type ProdiStudentGuide = {
	id: string;
	title: string;
	summary: string;
	audience?: string;
	steps?: { order: number; title: string; body: string; ctaLabel?: string; ctaUrl?: string }[];
	links?: { label: string; url: string; desc?: string }[];
	tips?: string[];
	warnings?: string[];
	exampleEmail?: string;
	nimExample?: string;
};

export const PRODI_EXAMPLE_NIM = '240605110000';
export const PRODI_EXAMPLE_EMAIL = `${PRODI_EXAMPLE_NIM}@student.uin-malang.ac.id`;

export const DEFAULT_STUDENT_PORTALS: ProdiPortalLink[] = [
	{
		label: 'SIAKAD',
		url: 'https://siakad.uin-malang.ac.id/',
		desc: 'KRS, nilai, herregistrasi, jadwal, wisuda online',
		group: 'daily',
	},
	{
		label: 'LMS',
		url: 'https://lms.uin-malang.ac.id/',
		desc: 'E-learning / materi kuliah',
		group: 'daily',
	},
	{
		label: 'MIU / SIAM',
		url: 'https://miu.uin-malang.ac.id/',
		desc: 'Login SSO mahasiswa & dosen',
		group: 'daily',
	},
	{
		label: 'Student Finance',
		url: 'https://studentfinance.uin-malang.ac.id/',
		desc: 'UKT, penyesuaian UKT, bebas tanggungan',
		group: 'daily',
	},
	{
		label: 'Layanan Akademik',
		url: 'https://akademik.uin-malang.ac.id/layanan-akademik/',
		desc: 'Surat aktif, cuti, SKL, alur wisuda',
		group: 'daily',
	},
	{
		label: 'Dumas',
		url: 'https://dumas.uin-malang.ac.id/',
		desc: 'Pengaduan layanan kampus',
		group: 'daily',
	},
	{
		label: 'Ma\'had (MSAA)',
		url: 'https://msaa.uin-malang.ac.id/',
		desc: 'Portal Ma\'had Al-Jami\'ah — penting maba tahun 1',
		group: 'maba',
	},
	{
		label: 'PMB',
		url: 'https://pmb.uin-malang.ac.id/',
		desc: 'Penerimaan mahasiswa baru (referensi)',
		group: 'maba',
	},
	{
		label: 'SIKU',
		url: 'https://siku.uin-malang.ac.id/',
		desc: 'Sistem informasi kemahasiswaan / surat',
		group: 'daily',
	},
	{
		label: 'SAINTEK Dokumen',
		url: 'https://saintek.uin-malang.ac.id/dokumen/',
		desc: 'Yudisium, SK, dokumen fakultas',
		group: 'graduate',
	},
	{
		label: 'CDC',
		url: 'https://cdc.uin-malang.ac.id/',
		desc: 'Career Development Center',
		group: 'graduate',
	},
	{
		label: 'Alumni',
		url: 'https://alumni.uin-malang.ac.id/',
		desc: 'Portal alumni UIN Malang',
		group: 'graduate',
	},
	{
		label: 'PDDIKTI',
		url: 'https://pddikti.kemdiktisaintek.go.id/',
		desc: 'Cek status mahasiswa publik (nama/NIM di situs resmi)',
		group: 'daily',
	},
];

export const DEFAULT_STUDENT_GUIDES: ProdiStudentGuide[] = [
	{
		id: 'activate-status',
		title: 'Aktifkan status SIAKAD',
		summary:
			'Status Non_Aktif biasanya karena UKT belum lunas atau herregistrasi belum selesai. Tanpa status Aktif, KRS dan beberapa layanan terkunci.',
		audience: 'Semua semester (awal tiap semester)',
		steps: [
			{
				order: 1,
				title: 'Cek status di SIAKAD',
				body: 'Login SIAKAD dan lihat badge status di sidebar/home.',
				ctaLabel: 'Buka SIAKAD',
				ctaUrl: 'https://siakad.uin-malang.ac.id/',
			},
			{
				order: 2,
				title: 'Cek / bayar UKT',
				body: 'Jalur reguler: lunasi UKT. Jika sedang penyesuaian UKT, tunggu hasil sebelum bayar.',
				ctaLabel: 'Student Finance',
				ctaUrl: 'https://studentfinance.uin-malang.ac.id/',
			},
			{
				order: 3,
				title: 'Ikuti jadwal herregistrasi',
				body: 'Sesuaikan dengan kalender akademik / berita di SIAKAD.',
				ctaLabel: 'Kalender di Prodi',
				ctaUrl: '/prodi?tab=kalender',
			},
			{
				order: 4,
				title: 'Beasiswa / kendala khusus',
				body: 'Jalur beasiswa: hubungi kemahasiswaan bila status belum aktif setelah proses beasiswa.',
				ctaLabel: 'SIKU',
				ctaUrl: 'https://siku.uin-malang.ac.id/',
			},
		],
		warnings: [
			'Jangan bagikan PIN SIAKAD ke siapapun.',
			'HMPS tidak menyimpan nilai, KRS, atau data pembayaranmu.',
		],
	},
	{
		id: 'student-email',
		title: 'Email Mahasiswa UIN',
		summary: 'Setiap mahasiswa mendapat email institusi berpola NIM@student.uin-malang.ac.id untuk LMS, notifikasi, dan layanan kampus.',
		audience: 'Maba & yang belum aktivasi',
		exampleEmail: PRODI_EXAMPLE_EMAIL,
		steps: [
			{
				order: 1,
				title: 'Aktivasi via SIAKAD',
				body: 'Login SIAKAD → Profil Mahasiswa / tombol aktivasi email di Home.',
				ctaLabel: 'SIAKAD Profil',
				ctaUrl: 'https://siakad.uin-malang.ac.id/uin-ProfilMhs',
			},
			{
				order: 2,
				title: 'Tambah akun di Gmail',
				body: `Add account dengan alamat seperti ${PRODI_EXAMPLE_EMAIL}.`,
				ctaLabel: 'Gmail',
				ctaUrl: 'https://gmail.com/',
			},
			{
				order: 3,
				title: 'Ubah password email',
				body: 'Segera ganti password default. Jangan membagikan password.',
			},
		],
		links: [
			{
				label: 'FAQ Email UIN (Dokumen)',
				url: 'https://docs.google.com/document/d/1NEaMOyad0p_WWnW9SoCVqBTWuHYq-VJqsScVsdTqwbU/edit?usp=sharing',
			},
		],
		warnings: ['HMPS tidak meminta atau menyimpan password email / PIN SIAKAD.'],
	},
	{
		id: 'nim-decoder',
		title: 'Arti digit NIM (S1 TI)',
		summary:
			'NIM modern S1 Teknik Informatika UIN Malang umumnya 12 digit. Decoder di halaman Portal memecah angkatan, fakultas, prodi, dan nomor urut secara lokal di browser.',
		audience: 'Semua mahasiswa TI',
		nimExample: PRODI_EXAMPLE_NIM,
		tips: [
			`Contoh: ${PRODI_EXAMPLE_NIM} → angkatan 2024, SAINTEK (06), TI (05), segmen 11, urut 0000.`,
			'Format NIM lama (8 digit) mungkin berbeda; decoder utama untuk 12 digit modern.',
			'NIM tidak dikirim ke server HMPS saat kamu mengetik di decoder.',
		],
	},
	{
		id: 'skkm',
		title: 'SKKM — Kredit Kegiatan',
		summary:
			'Catat kegiatan non-akademik (organisasi, lomba, kepanitiaan) di SIAKAD agar terakumulasi sebagai SKKM — penting dipantau sebelum yudisium.',
		audience: 'Semester 1–akhir',
		steps: [
			{
				order: 1,
				title: 'Buka menu SKKM di SIAKAD',
				body: 'Login lalu pilih Kredit Kegiatan SKKM.',
				ctaLabel: 'SIAKAD SKKM',
				ctaUrl: 'https://siakad.uin-malang.ac.id/uin-InputSKKM',
			},
			{
				order: 2,
				title: 'Input kegiatan + bukti',
				body: 'Isi data kegiatan dan unggah bukti sesuai ketentuan, lalu tunggu verifikasi.',
			},
		],
		tips: ['Simpan sertifikat dari awal semester.', 'Jangan menunda input sampai semester akhir.'],
	},
	{
		id: 'skpi',
		title: 'SKPI — Pendamping Ijazah',
		summary:
			'Data prestasi, sertifikasi, dan organisasi yang tercantum sebagai pendamping ijazah. Diisi lewat SIAKAD menjelang kelulusan.',
		audience: 'Semester akhir (mulai kumpulkan bukti lebih awal)',
		steps: [
			{
				order: 1,
				title: 'Buka SKPI di SIAKAD',
				body: 'Menu Pendamping Ijazah SKPI.',
				ctaLabel: 'SIAKAD SKPI',
				ctaUrl: 'https://siakad.uin-malang.ac.id/uin-InputSKPI',
			},
			{
				order: 2,
				title: 'Lengkapi & verifikasi',
				body: 'Isi kategori yang diminta, unggah bukti, pastikan terverifikasi sebelum daftar wisuda.',
				ctaLabel: 'Daftar Wisuda',
				ctaUrl: 'https://siakad.uin-malang.ac.id/uin-DftrWisuda',
			},
		],
	},
	{
		id: 'mahad',
		title: "Ma'had Al-Jami'ah (MSAA)",
		summary:
			"Pembinaan keagamaan & asrama tahun pertama. Informasi resmi di portal MSAA; nilai ma'had ada di SIAKAD setelah login.",
		audience: 'Maba (utama)',
		links: [
			{
				label: 'Portal MSAA',
				url: 'https://msaa.uin-malang.ac.id/',
				desc: 'Pengumuman dan kegiatan ma\'had',
			},
			{
				label: "Nilai Mahad (SIAKAD)",
				url: 'https://siakad.uin-malang.ac.id/uin-NilaiMahad',
				desc: 'Lihat nilai setelah login',
			},
		],
		tips: [
			'Cek tata tertib & jadwal di MSAA.',
			"Pantau nilai ma'had di SIAKAD tiap periode.",
		],
	},
	{
		id: 'research-journals',
		title: 'Akses jurnal (riset)',
		summary: 'Tautan akses jurnal yang ditampilkan di home SIAKAD — berguna untuk tugas, PKL, dan skripsi.',
		audience: 'Semester menengah–akhir',
		links: [
			{ label: 'Springer Link', url: 'https://link.springer.com/', desc: 'Jurnal & buku ilmiah' },
			{ label: 'Emerald Insight', url: 'https://www.emerald.com/insight/', desc: 'Jurnal bisnis, manajemen, IT' },
			{ label: 'Cambridge Core', url: 'https://www.cambridge.org/core/', desc: 'Jurnal & buku Cambridge' },
		],
		tips: ['Jika diminta login institusi, gunakan email mahasiswa / akses kampus.'],
	},
];

export type NimDecodeResult = {
	ok: boolean;
	raw: string;
	year?: number;
	facultyCode?: string;
	facultyName?: string;
	prodiCode?: string;
	prodiName?: string;
	programSegment?: string;
	serial?: string;
	isTiModern?: boolean;
	message?: string;
};

/** Client-safe NIM decoder for modern 12-digit TI pattern YY060511NNNN */
export function decodeTiNim(input: string): NimDecodeResult {
	const raw = (input || '').replace(/\D/g, '');
	if (!raw) return { ok: false, raw: '', message: 'Masukkan NIM (angka).' };
	if (raw.length !== 12) {
		return {
			ok: false,
			raw,
			message:
				raw.length < 12
					? 'NIM modern biasanya 12 digit. Format lama (lebih pendek) tidak di-decode penuh.'
					: 'Panjang NIM tidak sesuai pola 12 digit modern.',
		};
	}
	const year = Number(raw.slice(0, 2));
	const facultyCode = raw.slice(2, 4);
	const prodiCode = raw.slice(4, 6);
	const programSegment = raw.slice(6, 8);
	const serial = raw.slice(8, 12);
	const isTiModern = facultyCode === '06' && prodiCode === '05';
	return {
		ok: true,
		raw,
		year: 2000 + year,
		facultyCode,
		facultyName:
			facultyCode === '06' ? 'Fakultas Sains dan Teknologi (SAINTEK)' : `Kode fakultas ${facultyCode}`,
		prodiCode,
		prodiName:
			prodiCode === '05' ? 'Teknik Informatika' : `Kode prodi ${prodiCode}`,
		programSegment,
		serial,
		isTiModern,
		message: isTiModern
			? 'Pola cocok dengan NIM S1 TI modern (terobservasi dari data publik prodi).'
			: 'Bukan pola TI modern (06+05). Segmen tetap ditampilkan apa adanya.',
	};
}

export const DEFAULT_SKRIPSI_HUB = {
	hubUrl: 'https://informatika.uin-malang.ac.id/thesis-skripsi-s1/',
	pedomanPdf:
		'https://saintek.uin-malang.ac.id/wp-content/uploads/2025/08/PEDOMAN-BIMBINGAN-DAN-PENULISAN-SKRIPSI.pdf',
	steps: [
		'Praproposal',
		'Seminar Proposal',
		'Ujian Komprehensif',
		'Seminar Hasil',
		'Sidang Skripsi',
		'Yudisium',
	],
	registrationHints: [
		'Pendaftaran tahapan skripsi biasanya melalui tautan di halaman hub skripsi TI.',
		'Jadwal periodisasi & ujian diumumkan di kategori Pengumuman situs TI.',
	],
};

export const DEFAULT_PKL_HUB = {
	hubUrl: 'https://informatika.uin-malang.ac.id/internship-pkl/',
	templates: [] as { name: string; url: string }[],
};

export function buildDefaultStudentHub(partial?: any) {
	return {
		portals: partial?.portals?.length ? partial.portals : DEFAULT_STUDENT_PORTALS,
		guides: partial?.guides?.length ? partial.guides : DEFAULT_STUDENT_GUIDES,
		academicCalendars: partial?.academicCalendars || {},
		announcements: partial?.announcements || [],
		skripsiHub: partial?.skripsiHub || { ...DEFAULT_SKRIPSI_HUB },
		pklHub: partial?.pklHub || { ...DEFAULT_PKL_HUB },
	};
}

