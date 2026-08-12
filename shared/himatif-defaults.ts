/** Default chrome/copy Himatif — dipakai web utama dan fallback tenant yang belum di-setup. */
export const HIMATIF_SITE_NAME = 'Himatif Encoder';
export const HIMATIF_TAGLINE =
	'Himpunan Mahasiswa Teknik Informatika · Fakultas Sains dan Teknologi UIN Maulana Malik Ibrahim Malang';
export const HIMATIF_CONTACT_EMAIL = 'himatif.encoder@gmail.com';
export const HIMATIF_ADDRESS =
	'Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang';
export const HIMATIF_LOGO_PATH =
	'/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp';

export const HIMATIF_SOCIAL_LINKS = {
	facebook: 'https://www.facebook.com/himatif.encoder/',
	instagram: 'https://www.instagram.com/himatif.encoder/',
	tiktok: 'https://www.tiktok.com/@himatif.encoder',
	youtube: 'https://www.youtube.com/@himatifencoder',
	twitter: '',
};

export const HIMATIF_QUICK_LINKS = [
	{ label: 'UIN Malang', url: 'https://uin-malang.ac.id/' },
	{ label: 'Fakultas Sains dan Teknologi', url: 'https://saintek.uin-malang.ac.id/' },
	{ label: 'Jurusan Teknik Informatika', url: 'https://informatika.uin-malang.ac.id/' },
	{ label: 'Perpustakaan', url: 'https://library.uin-malang.ac.id/' },
];

export const HIMATIF_VISION =
	'Mewujudkan Himpunan Mahasiswa Teknik Informatika yang berintegritas, progresif, dan adaptif sebagai wadah kolaborasi yang responsif, transparan, partisipatif, menjunjung tinggi nilai kekeluargaan, menciptakan lingkungan yang harmonis, inovatif, dan berorientasi pada kemajuan berkelanjutan.';

export const HIMATIF_MISSION = [
	'Meningkatkan lingkungan yang kondusif untuk dialog terbuka, penguatan solidaritas, dan pengamalan kepedulian kolektif, dengan semangat kebersamaan untuk mendukung hubungan yang harmonis dan produktif antar anggota.',
	'Mengintegrasikan nilai-nilai budaya lokal, nasional, dan profesionalisme dalam setiap program kerja, menumbuhkan kesadaran akan tanggung jawab sosial, meningkatkan kompetensi akademik, soft skills, kepemimpinan, dan inovasi teknologi melalui berbagai kegiatan produktif.',
	'Mengoptimalkan peran Himpunan sebagai wadah pemberdayaan anggota dengan memberikan perhatian terhadap aspirasi, memfasilitasi pengembangan diri, dan menciptakan jaringan kolaborasi yang efektif dengan berbagai pihak untuk mendorong kontribusi aktif dalam pembangunan dan pengembangan organisasi.',
];

export const HIMATIF_ABOUT_HTML =
	'<p>HIMATIF Encoder adalah Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang. Wadah pengembangan akademik, organisasi, kepemimpinan mahasiswa TI, dan kegiatan teknologi di Fakultas Sains dan Teknologi UIN Malang.</p>';

export function httpUrlOrEmpty(value?: string | null): string {
	const v = String(value || '').trim();
	return v.startsWith('http') ? v : '';
}

export function withHimatifSocial(social?: {
	facebook?: string;
	instagram?: string;
	tiktok?: string;
	youtube?: string;
	twitter?: string;
} | null) {
	return {
		facebook: httpUrlOrEmpty(social?.facebook) || HIMATIF_SOCIAL_LINKS.facebook,
		instagram: httpUrlOrEmpty(social?.instagram) || HIMATIF_SOCIAL_LINKS.instagram,
		tiktok: httpUrlOrEmpty(social?.tiktok) || HIMATIF_SOCIAL_LINKS.tiktok,
		youtube: httpUrlOrEmpty(social?.youtube) || HIMATIF_SOCIAL_LINKS.youtube,
		twitter: httpUrlOrEmpty(social?.twitter) || HIMATIF_SOCIAL_LINKS.twitter,
	};
}

export function withHimatifQuickLinks(
	quickLinks?: Array<{ label?: string; url?: string }> | null,
	legacy?: {
		uinMalang?: string;
		fakultasSainsTeknologi?: string;
		jurusanTeknikInformatika?: string;
		perpustakaan?: string;
	} | null,
): Array<{ label: string; url: string }> {
	const fromQuick = (quickLinks || [])
		.map((l) => ({ label: String(l?.label || '').trim(), url: String(l?.url || '').trim() }))
		.filter((l) => l.label && l.url);
	if (fromQuick.length) return fromQuick;
	const fromLegacy = [
		{ label: 'UIN Malang', url: String(legacy?.uinMalang || '').trim() },
		{ label: 'Fakultas Sains dan Teknologi', url: String(legacy?.fakultasSainsTeknologi || '').trim() },
		{ label: 'Jurusan Teknik Informatika', url: String(legacy?.jurusanTeknikInformatika || '').trim() },
		{ label: 'Perpustakaan', url: String(legacy?.perpustakaan || '').trim() },
	].filter((l) => l.url);
	if (fromLegacy.length) return fromLegacy;
	return [...HIMATIF_QUICK_LINKS];
}
