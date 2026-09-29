/**
 * Daftar bank & dompet digital Indonesia untuk dropdown "Kanal bayar" toko.
 * `code` = kode bank BI (transfer antarbank) bila diketahui pasti; brand digital memakai kode bank induknya.
 * Admin tetap bisa memilih "Lainnya" dan menulis nama sendiri.
 */
export type PaymentProviderType = 'bank' | 'ewallet';
export type PaymentProviderGroup =
	| 'Bank BUMN'
	| 'Bank Swasta'
	| 'Bank Digital'
	| 'Bank Syariah'
	| 'Bank Daerah (BPD)'
	| 'Bank Asing & Campuran'
	| 'E-Wallet'
	| 'Uang Elektronik (Kartu)';

export interface PaymentProvider {
	id: string;
	name: string;
	type: PaymentProviderType;
	group: PaymentProviderGroup;
	code?: string;
	aliases?: string[];
}

const b = (id: string, name: string, group: PaymentProviderGroup, code?: string, aliases?: string[]): PaymentProvider => ({
	id,
	name,
	type: 'bank',
	group,
	code,
	aliases,
});
const w = (id: string, name: string, aliases?: string[], group: PaymentProviderGroup = 'E-Wallet'): PaymentProvider => ({
	id,
	name,
	type: 'ewallet',
	group,
	aliases,
});

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
	// Bank BUMN (Himbara)
	b('bri', 'Bank Rakyat Indonesia (BRI)', 'Bank BUMN', '002', ['BRI', 'BRImo']),
	b('mandiri', 'Bank Mandiri', 'Bank BUMN', '008', ['Livin']),
	b('bni', 'Bank Negara Indonesia (BNI)', 'Bank BUMN', '009', ['BNI', 'wondr']),
	b('btn', 'Bank Tabungan Negara (BTN)', 'Bank BUMN', '200', ['BTN']),
	b('bsi', 'Bank Syariah Indonesia (BSI)', 'Bank BUMN', '451', ['BSI', 'BYOND']),
	b('raya', 'Bank Raya Indonesia', 'Bank Digital', '494', ['Raya', 'BRI Agro']),
	b('mandiri-taspen', 'Bank Mandiri Taspen (Mantap)', 'Bank Swasta', '564', ['Mantap']),

	// Bank swasta nasional
	b('bca', 'Bank Central Asia (BCA)', 'Bank Swasta', '014', ['BCA', 'myBCA', 'KlikBCA']),
	b('cimb', 'CIMB Niaga', 'Bank Swasta', '022', ['OCTO']),
	b('danamon', 'Bank Danamon', 'Bank Swasta', '011', ['D-Bank']),
	b('permata', 'Bank Permata', 'Bank Swasta', '013', ['PermataMobile']),
	b('maybank', 'Maybank Indonesia', 'Bank Swasta', '016'),
	b('panin', 'Panin Bank', 'Bank Swasta', '019'),
	b('ocbc', 'Bank OCBC Indonesia', 'Bank Swasta', '028', ['OCBC NISP', 'Nyala']),
	b('uob', 'Bank UOB Indonesia', 'Bank Swasta', '023', ['TMRW']),
	b('mega', 'Bank Mega', 'Bank Swasta', '426', ['M-Smile']),
	b('sinarmas', 'Bank Sinarmas', 'Bank Swasta', '153', ['SimobiPlus']),
	b('smbc', 'SMBC Indonesia (ex BTPN)', 'Bank Swasta', '213', ['BTPN', 'Jenius']),
	b('mayapada', 'Bank Mayapada', 'Bank Swasta', '097'),
	b('kbbank', 'KB Bank (ex Bukopin)', 'Bank Swasta', '441', ['Bukopin', 'KB Bukopin']),
	b('mnc', 'MNC Bank', 'Bank Swasta', '485', ['MotionBank']),
	b('arthagraha', 'Bank Artha Graha Internasional', 'Bank Swasta', '037'),
	b('ganesha', 'Bank Ganesha', 'Bank Swasta', '161'),
	b('victoria', 'Bank Victoria International', 'Bank Swasta', '566'),
	b('index', 'Bank Index Selindo', 'Bank Swasta', '555'),
	b('capital', 'Bank Capital Indonesia', 'Bank Swasta', '054'),
	b('maspion', 'Bank Maspion', 'Bank Swasta', '157'),
	b('mestika', 'Bank Mestika Dharma', 'Bank Swasta', '151'),
	b('nobu', 'Bank Nationalnobu', 'Bank Swasta', '503', ['Nobu']),
	b('sampoerna', 'Bank Sahabat Sampoerna', 'Bank Swasta', '523'),
	b('multiarta', 'Bank Multiarta Sentosa', 'Bank Swasta', '548'),
	b('ina', 'Bank Ina Perdana', 'Bank Swasta', '513'),
	b('primamaster', 'Bank Prima Master', 'Bank Swasta', '520'),
	b('jtrust', 'Bank JTrust Indonesia', 'Bank Swasta', '095'),
	b('oke', 'Bank Oke Indonesia', 'Bank Swasta', '466'),

	// Bank digital
	b('jago', 'Bank Jago', 'Bank Digital', '542', ['Jago']),
	b('seabank', 'SeaBank Indonesia', 'Bank Digital', '535', ['SeaBank']),
	b('blu', 'blu by BCA Digital', 'Bank Digital', '501', ['blu', 'BCA Digital']),
	b('allo', 'Allo Bank', 'Bank Digital', '567'),
	b('bnc', 'Bank Neo Commerce (neobank)', 'Bank Digital', '490', ['neobank', 'BNC']),
	b('superbank', 'Superbank', 'Bank Digital', '562'),
	b('krom', 'Krom Bank', 'Bank Digital', '459'),
	b('amar', 'Bank Amar (Tunaiku)', 'Bank Digital', '531', ['Tunaiku']),
	b('linebank', 'LINE Bank (Hana Bank)', 'Bank Digital', '484', ['Hana', 'KEB Hana']),
	b('hibank', 'Hibank', 'Bank Digital'),
	b('saqu', 'Bank Saqu', 'Bank Digital'),
	b('aladin', 'Bank Aladin Syariah', 'Bank Digital', '947', ['Aladin']),

	// Bank syariah
	b('bcasyariah', 'BCA Syariah', 'Bank Syariah', '536'),
	b('btpnsyariah', 'Bank BTPN Syariah', 'Bank Syariah', '547'),
	b('muamalat', 'Bank Muamalat', 'Bank Syariah', '147'),
	b('megasyariah', 'Bank Mega Syariah', 'Bank Syariah', '506'),
	b('panindubai', 'Panin Dubai Syariah', 'Bank Syariah', '517'),
	b('victoriasyariah', 'Bank Victoria Syariah', 'Bank Syariah', '405'),
	b('bjbsyariah', 'Bank BJB Syariah', 'Bank Syariah', '425'),
	b('kbsyariah', 'KB Bank Syariah (ex Bukopin Syariah)', 'Bank Syariah', '521'),
	b('acehsyariah', 'Bank Aceh Syariah', 'Bank Syariah', '116'),
	b('ntbsyariah', 'Bank NTB Syariah', 'Bank Syariah', '128'),
	b('cimbsyariah', 'CIMB Niaga Syariah', 'Bank Syariah', '022'),
	b('permatasyariah', 'Permata Syariah', 'Bank Syariah', '013'),
	b('danamonsyariah', 'Danamon Syariah', 'Bank Syariah', '011'),
	b('maybanksyariah', 'Maybank Syariah', 'Bank Syariah', '016'),
	b('ocbcsyariah', 'OCBC Syariah', 'Bank Syariah', '028'),
	b('btnsyariah', 'BTN Syariah', 'Bank Syariah', '200'),

	// Bank pembangunan daerah
	b('jatim', 'Bank Jatim', 'Bank Daerah (BPD)', '114'),
	b('jateng', 'Bank Jateng', 'Bank Daerah (BPD)', '113'),
	b('bjb', 'Bank BJB (Jabar Banten)', 'Bank Daerah (BPD)', '110', ['BJB']),
	b('dki', 'Bank DKI', 'Bank Daerah (BPD)', '111'),
	b('bpddiy', 'BPD DIY', 'Bank Daerah (BPD)', '112'),
	b('bali', 'Bank BPD Bali', 'Bank Daerah (BPD)', '129'),
	b('sumut', 'Bank Sumut', 'Bank Daerah (BPD)', '117'),
	b('nagari', 'Bank Nagari', 'Bank Daerah (BPD)', '118'),
	b('riaukepri', 'Bank Riau Kepri Syariah', 'Bank Daerah (BPD)', '119'),
	b('jambi', 'Bank Jambi', 'Bank Daerah (BPD)', '115'),
	b('sumselbabel', 'Bank Sumsel Babel', 'Bank Daerah (BPD)', '120'),
	b('lampung', 'Bank Lampung', 'Bank Daerah (BPD)', '121'),
	b('kalsel', 'Bank Kalsel', 'Bank Daerah (BPD)', '122'),
	b('kalbar', 'Bank Kalbar', 'Bank Daerah (BPD)', '123'),
	b('kaltimtara', 'Bank Kaltimtara', 'Bank Daerah (BPD)', '124'),
	b('kalteng', 'Bank Kalteng', 'Bank Daerah (BPD)', '125'),
	b('sulselbar', 'Bank Sulselbar', 'Bank Daerah (BPD)', '126'),
	b('sulutgo', 'Bank SulutGo', 'Bank Daerah (BPD)', '127'),
	b('ntt', 'Bank NTT', 'Bank Daerah (BPD)', '130'),
	b('malukumalut', 'Bank Maluku Malut', 'Bank Daerah (BPD)', '131'),
	b('papua', 'Bank Papua', 'Bank Daerah (BPD)', '132'),
	b('bengkulu', 'Bank Bengkulu', 'Bank Daerah (BPD)', '133'),
	b('sulteng', 'Bank Sulteng', 'Bank Daerah (BPD)', '134'),
	b('sultra', 'Bank Sultra', 'Bank Daerah (BPD)', '135'),
	b('banten', 'Bank Banten', 'Bank Daerah (BPD)', '137'),

	// Bank asing & campuran
	b('hsbc', 'HSBC Indonesia', 'Bank Asing & Campuran', '087'),
	b('citibank', 'Citibank', 'Bank Asing & Campuran', '031'),
	b('dbs', 'Bank DBS Indonesia', 'Bank Asing & Campuran', '046', ['digibank']),
	b('stanchart', 'Standard Chartered', 'Bank Asing & Campuran', '050'),
	b('commonwealth', 'Bank Commonwealth', 'Bank Asing & Campuran', '950'),
	b('woori', 'Bank Woori Saudara', 'Bank Asing & Campuran', '212'),
	b('shinhan', 'Bank Shinhan Indonesia', 'Bank Asing & Campuran', '152'),
	b('ccb', 'China Construction Bank Indonesia', 'Bank Asing & Campuran', '036'),
	b('icbc', 'ICBC Indonesia', 'Bank Asing & Campuran', '164'),
	b('boc', 'Bank of China', 'Bank Asing & Campuran', '069'),
	b('qnb', 'QNB Indonesia', 'Bank Asing & Campuran', '167'),
	b('mizuho', 'Bank Mizuho Indonesia', 'Bank Asing & Campuran', '048'),
	b('mufg', 'MUFG Bank', 'Bank Asing & Campuran', '042'),
	b('resona', 'Bank Resona Perdania', 'Bank Asing & Campuran', '047'),
	b('ibk', 'Bank IBK Indonesia', 'Bank Asing & Campuran', '945'),

	// Dompet digital
	w('gopay', 'GoPay', ['Gojek']),
	w('ovo', 'OVO'),
	w('dana', 'DANA'),
	w('shopeepay', 'ShopeePay', ['Shopee']),
	w('linkaja', 'LinkAja', ['LinkAja Syariah']),
	w('isaku', 'i.saku', ['Indomaret']),
	w('sakuku', 'Sakuku (BCA)'),
	w('doku', 'DOKU Wallet'),
	w('astrapay', 'AstraPay'),
	w('ottocash', 'OttoCash'),
	w('paytren', 'Paytren'),
	w('speedcash', 'SpeedCash'),
	w('truemoney', 'TrueMoney'),
	w('flip', 'Flip'),
	w('jeniuspay', 'Jenius Pay'),
	w('kredivo', 'Kredivo'),
	w('akulaku', 'Akulaku'),

	// Uang elektronik berbasis kartu
	w('emoney', 'Mandiri e-money', undefined, 'Uang Elektronik (Kartu)'),
	w('tapcash', 'BNI TapCash', undefined, 'Uang Elektronik (Kartu)'),
	w('brizzi', 'BRI Brizzi', undefined, 'Uang Elektronik (Kartu)'),
	w('flazz', 'BCA Flazz', undefined, 'Uang Elektronik (Kartu)'),
];

export const PAYMENT_PROVIDER_GROUP_ORDER: PaymentProviderGroup[] = [
	'Bank BUMN',
	'Bank Swasta',
	'Bank Digital',
	'Bank Syariah',
	'Bank Daerah (BPD)',
	'Bank Asing & Campuran',
	'E-Wallet',
	'Uang Elektronik (Kartu)',
];

export function findPaymentProvider(id: unknown): PaymentProvider | null {
	return PAYMENT_PROVIDERS.find((p) => p.id === String(id || '')) || null;
}

export function searchPaymentProviders(q: string, type?: PaymentProviderType): PaymentProvider[] {
	const s = q.trim().toLowerCase();
	return PAYMENT_PROVIDERS.filter(
		(p) =>
			(!type || p.type === type) &&
			(!s ||
				p.name.toLowerCase().includes(s) ||
				(p.code || '').includes(s) ||
				(p.aliases || []).some((a) => a.toLowerCase().includes(s))),
	);
}
