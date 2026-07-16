/** Static student hub defaults for Prodi page (TI UIN Malang). */

export type { NimDecodeResult, CampusProgram, UinJenjang } from './uin-nim-codes';
export {
	decodeUinMalangNim,
	decodeTiNim,
	UIN_FACULTY_CODES,
	UIN_PRODI_CODES,
	UIN_CAMPUS_PROGRAM_CATALOG,
	listProdiByFaculty,
	listCampusPrograms,
} from './uin-nim-codes';

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
		label: 'SETIA',
		url: 'https://setia.uin-malang.ac.id/',
		desc: 'Pendaftaran tahapan akademik / layanan setia (praproposal dll)',
		group: 'daily',
	},
	{
		label: 'LP2M (KKM/KKN)',
		url: 'https://lp2m.uin-malang.ac.id/',
		desc: 'Pengabdian masyarakat — KKM/KKN reguler & kolaborasi',
		group: 'daily',
	},
	{
		label: 'SIPEMAS',
		url: 'https://sipemas.uin-malang.ac.id/',
		desc: 'Portal pendaftaran KKM/pengabdian (periode tertentu)',
		group: 'daily',
	},
	{
		label: 'Magister Informatika (S2)',
		url: 'https://informatika.uin-malang.ac.id/id/master-study-s2/',
		desc: 'Profil program Magister Informatika FST',
		group: 'graduate',
	},
	{
		label: 'Master Thesis (S2)',
		url: 'https://informatika.uin-malang.ac.id/en/master-thesis/',
		desc: 'Hub tesis magister Informatika',
		group: 'graduate',
	},
	{
		label: 'Pascasarjana UIN',
		url: 'https://pasca.uin-malang.ac.id/',
		desc: 'Unit Pascasarjana Kampus 2 (S2/S3 lintas prodi)',
		group: 'graduate',
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
		title: 'Arti digit NIM (UIN Malang — S1 hingga S3)',
		summary:
			'NIM modern 12 digit (Pedoman Pascasarjana 2026 + observasi S1 MSAA): YY + FF (fakultas/Pascasarjana) + PP (prodi) + digit jenjang (1=S1, 2=S2, 3=S3) + digit semester masuk + NNNN. Katalog di Portal memuat semua prodi kampus (S1, magister fakultas, Pascasarjana, doktor, profesi). Kode digit PP S2/S3/profesi yang belum publik ditandai “tidak ditemukan / belum terpetakan”.',
		audience: 'Semua mahasiswa UIN (S1–S3 & profesi)',
		nimExample: PRODI_EXAMPLE_NIM,
		tips: [
			`S1 TI: ${PRODI_EXAMPLE_NIM} → 2024 · SAINTEK (06) · TI (05) · jenjang 1 · semester 1 · urut 0000.`,
			'Fakultas FF: 01 FITK, 02 Syariah, 03 Humaniora, 04 Psikologi, 05 Ekonomi, 06 SAINTEK, 07 FKIK, 08 Pascasarjana, 09 Teknik.',
			'Jika FF tidak ada di 01–09 → “Fakultas tidak ditemukan”. Jika PP tidak cocok → “Prodi tidak ditemukan” + daftar program unit tersebut.',
			'Magister fakultas, S2/S3 Pascasarjana, PPG, Profesi Dokter/Apoteker ada di katalog; konfirmasi digit resmi di SIAKAD bila PP belum terpetakan.',
			'NIM tidak dikirim ke server HMPS saat mengetik di decoder (hanya di browser).',
		],
		links: [
			{ label: 'PMB — Program Studi', url: 'https://pmb.uin-malang.ac.id/program-studi/', desc: 'Daftar resmi S1/S2/S3/profesi' },
			{ label: 'Pascasarjana UIN Malang', url: 'https://pasca.uin-malang.ac.id/', desc: 'Unit Pascasarjana (Kampus 2)' },
			{ label: 'SIAKAD', url: 'https://siakad.uin-malang.ac.id/', desc: 'Sumber kebenaran data mahasiswa' },
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
	{
		id: 'kkm',
		title: 'KKM / KKN (pengabdian)',
		summary:
			'Kuliah Kerja Mahasiswa (KKM, sering disebut KKN) dikelola LP2M UIN Malang — terpisah dari PKL Prodi TI. Biasanya syarat minimal ~100 SKS; jadwal & kuota diumumkan per periode.',
		audience: 'Semester menengah (cek syarat SKS di pengumuman LP2M)',
		steps: [
			{
				order: 1,
				title: 'Cek pengumuman LP2M',
				body: 'Baca periode KKM reguler / internasional / kolaborasi di situs LP2M.',
				ctaLabel: 'Buka LP2M',
				ctaUrl: 'https://lp2m.uin-malang.ac.id/',
			},
			{
				order: 2,
				title: 'Daftar via portal resmi',
				body: 'Pendaftaran biasanya lewat SIAM atau SIPEMAS sesuai pengumuman periode tersebut.',
				ctaLabel: 'SIAM',
				ctaUrl: 'https://siam.uin-malang.ac.id/',
			},
			{
				order: 3,
				title: 'Unduh pedoman',
				body: 'Ikuti buku pedoman KKM tahun berjalan (link di posting LP2M) dan pantau pembagian kelompok.',
			},
		],
		tips: [
			'KKM ≠ PKL: PKL diatur Prodi TI; KKM diatur LP2M tingkat universitas.',
			'Simpan bukti kegiatan untuk SKKM/SKPI.',
		],
		links: [
			{ label: 'LP2M', url: 'https://lp2m.uin-malang.ac.id/', desc: 'Pengumuman KKM/KKN' },
			{ label: 'SIPEMAS', url: 'https://sipemas.uin-malang.ac.id/', desc: 'Portal pengabdian (periode tertentu)' },
		],
	},
];

export type ProdiHubSubject = {
	name: string;
	code?: string;
	credits?: string;
	prerequisite?: string;
	objectives: string[];
	activities: string[];
};

export type ProdiHubInfoNotice = {
	title: string;
	body: string;
	sourceLabel?: string;
	sourceUrl?: string;
	disclaimer?: string;
};

export const DEFAULT_SKRIPSI_HUB = {
	hubUrl: 'https://informatika.uin-malang.ac.id/thesis-skripsi-s1/',
	pedomanPdf:
		'https://saintek.uin-malang.ac.id/wp-content/uploads/2025/08/PEDOMAN-BIMBINGAN-DAN-PENULISAN-SKRIPSI.pdf',
	saintekPedomanPdf:
		'https://saintek.uin-malang.ac.id/wp-content/uploads/2025/08/Cetak-Pedoman-Skripsi-2022-Saintek.pdf',
	intro: '' as string,
	subjects: [] as ProdiHubSubject[],
	flowchartImageUrl: '' as string,
	infoNotices: [
		{
			title: 'Penyetaraan karya ilmiah (SAINTEK)',
			body:
				'Pedoman Skripsi/TA Fakultas Sains dan Teknologi (2022) mengatur bahwa artikel jurnal minimal Sinta 2 (atau prestasi lomba tertentu) dapat disetarakan sebagai Skripsi/TA, dengan syarat tetap diseminasi/ujian dan diubah ke format skripsi. Ini berbeda dari kebijakan “lulus tanpa skripsi” di Fakultas Ekonomi.',
			sourceLabel: 'Pedoman Skripsi/TA SAINTEK 2022 (§3.8)',
			sourceUrl:
				'https://saintek.uin-malang.ac.id/wp-content/uploads/2025/08/Cetak-Pedoman-Skripsi-2022-Saintek.pdf',
			disclaimer:
				'Bukan aturan khusus TI saja — berlaku tingkat fakultas SAINTEK. Selalu konfirmasi ke admin/prodi sebelum mendaftar jalur penyetaraan.',
		},
		{
			title: 'Magister Informatika (S2)',
			body:
				'Program Magister Informatika memiliki hub tesis tersendiri. Syarat yudisium master mencakup publikasi (SINTA/SCOPUS/WoS) sesuai ketentuan prodi magister — bukan jalur “tanpa tesis”.',
			sourceLabel: 'Master Thesis TI',
			sourceUrl: 'https://informatika.uin-malang.ac.id/en/master-thesis/',
		},
	] as ProdiHubInfoNotice[],
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
	intro: '' as string,
	subjects: [] as ProdiHubSubject[],
	flowchartImageUrl: '' as string,
	notes: [] as string[],
	templates: [] as { name: string; url: string }[],
};

export function buildDefaultStudentHub(partial?: any) {
	const skripsiHub = { ...DEFAULT_SKRIPSI_HUB, ...(partial?.skripsiHub || {}) };
	if (!Array.isArray(skripsiHub.infoNotices) || skripsiHub.infoNotices.length === 0) {
		skripsiHub.infoNotices = DEFAULT_SKRIPSI_HUB.infoNotices;
	}
	const pklHub = { ...DEFAULT_PKL_HUB, ...(partial?.pklHub || {}) };
	return {
		portals: partial?.portals?.length ? partial.portals : DEFAULT_STUDENT_PORTALS,
		guides: partial?.guides?.length ? partial.guides : DEFAULT_STUDENT_GUIDES,
		academicCalendars: partial?.academicCalendars || {},
		announcements: Array.isArray(partial?.announcements) ? partial.announcements : [],
		skripsiHub: sanitizeStoredHub(skripsiHub),
		pklHub: sanitizeStoredHub(pklHub),
	};
}

const JUNK_HUB_RE =
	/miu\s*login|siam\s*login|powered\s*by|theme\s*version|ptipd|^\s*organization\s*$|^\s*profile\s*$|lecturer and staff|^\s*dokumen\s*$|^\s*en_?us\s*$|^\s*id\s*$|^\s*ar\s*$|^\s*zh\s*$/i;

function sanitizeSubjectList(list: unknown): ProdiHubSubject[] {
	if (!Array.isArray(list)) return [];
	return list
		.map((s: any) => ({
			name: String(s?.name || '').replace(/\s+/g, ' ').trim(),
			code: s?.code ? String(s.code).trim() : undefined,
			credits: s?.credits ? String(s.credits).trim() : undefined,
			prerequisite: s?.prerequisite ? String(s.prerequisite).trim() : undefined,
			objectives: Array.isArray(s?.objectives)
				? s.objectives.map((x: unknown) => String(x || '').trim()).filter(Boolean)
				: [],
			activities: Array.isArray(s?.activities)
				? s.activities.map((x: unknown) => String(x || '').trim()).filter(Boolean)
				: [],
		}))
		.filter((s) => s.name && !JUNK_HUB_RE.test(s.name));
}

function sanitizeStoredHub(hub: any): any {
	if (!hub || typeof hub !== 'object') return hub;
	const next = { ...hub };
	if (typeof next.intro === 'string') {
		next.intro = next.intro.replace(/\s+/g, ' ').trim();
		if (JUNK_HUB_RE.test(next.intro.slice(0, 80))) next.intro = '';
	}
	if (typeof next.flowchartImageUrl === 'string') {
		next.flowchartImageUrl = next.flowchartImageUrl.trim();
	}
	next.subjects = sanitizeSubjectList(next.subjects);
	if (Array.isArray(next.infoNotices)) {
		next.infoNotices = next.infoNotices
			.map((n: any) => ({
				title: String(n?.title || '').trim(),
				body: String(n?.body || '').replace(/\s+/g, ' ').trim(),
				sourceLabel: n?.sourceLabel ? String(n.sourceLabel).trim() : undefined,
				sourceUrl: n?.sourceUrl ? String(n.sourceUrl).trim() : undefined,
				disclaimer: n?.disclaimer ? String(n.disclaimer).trim() : undefined,
			}))
			.filter((n: ProdiHubInfoNotice) => n.title && n.body);
	}
	if (Array.isArray(next.notes)) {
		next.notes = next.notes
			.map((n: unknown) => String(n || '').replace(/\s+/g, ' ').trim())
			.filter((n: string) => n && !JUNK_HUB_RE.test(n.slice(0, 80)));
	}
	if (Array.isArray(next.sections)) {
		next.sections = next.sections.filter(
			(s: any) => s?.heading && !JUNK_HUB_RE.test(String(s.heading).trim()),
		);
	}
	if (Array.isArray(next.actionLinks)) {
		next.actionLinks = next.actionLinks.filter(
			(l: any) => l?.url && l?.label && !JUNK_HUB_RE.test(String(l.label).trim()),
		);
	}
	if (Array.isArray(next.templates)) {
		next.templates = next.templates.map((t: any) => ({
			...t,
			name: String(t?.name || '')
				.replace(/\s*\[DOWNLOAD HERE\]\s*/gi, '')
				.replace(/\s*:\s*$/, '')
				.trim() || 'Dokumen PKL',
		}));
	}
	return next;
}

