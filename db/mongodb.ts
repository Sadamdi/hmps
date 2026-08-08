import mongoose from 'mongoose';

// Konek ke MongoDB
const connectDB = async () => {
	try {
		// Untuk produksi, gunakan MongoDB Atlas
		// Contoh URI: mongodb+srv://username:password@cluster.mongodb.net/hmti_informatika
		const MONGODB_URI = process.env.MONGODB_URI;

		if (!MONGODB_URI) {
			throw new Error('MONGODB_URI is not defined in environment variables.');
		}

		let parsedUri: URL;
		try {
			parsedUri = new URL(MONGODB_URI);
		} catch {
			throw new Error('MONGODB_URI tidak valid (gagal parse URL).');
		}

		const explicitDbName = process.env.MONGODB_DB_NAME?.trim() || '';
		const dbNameFromUri = parsedUri.pathname.replace(/^\/+/, '').trim();
		const resolvedDbName = explicitDbName || dbNameFromUri;
		if (!resolvedDbName) {
			throw new Error(
				'MONGODB_URI tidak menyertakan nama database. Tambahkan path DB pada URI (contoh: /himatifwebmain) atau set MONGODB_DB_NAME.',
			);
		}

		console.log(
			`Connecting to MongoDB (${parsedUri.hostname}/${resolvedDbName})...`,
		);

		mongoose.set('bufferTimeoutMS', 60_000);

		const maxPool = parseInt(process.env.MONGO_MAX_POOL_SIZE || '14', 10);
		const pool = Number.isFinite(maxPool) && maxPool > 0 ? maxPool : 14;

		await mongoose.connect(MONGODB_URI, {
			dbName: resolvedDbName,
			serverSelectionTimeoutMS: 5000,
			connectTimeoutMS: 10000,
			socketTimeoutMS: 120_000,
			maxPoolSize: pool,
			minPoolSize: Math.min(2, pool),
			maxConnecting: Math.min(3, pool),
		});

		console.log(`Connected to MongoDB database: ${resolvedDbName}`);
		return true;
	} catch (error) {
		console.error('MongoDB connection error:', error);
		console.error(`
    PETUNJUK: 
    
    Untuk menggunakan MongoDB, Anda memerlukan koneksi MongoDB yang aktif.
    
    1. Untuk pengguna Windows lokal:
       - Instal MongoDB dari https://www.mongodb.com/try/download/community
       - Mulai layanan MongoDB
       - Gunakan URI: mongodb://127.0.0.1:27017/hmti_informatika
    
    2. Untuk pengguna MongoDB Atlas (direkomendasikan):
       - Daftar di https://www.mongodb.com/cloud/atlas
       - Buat cluster gratis
       - Gunakan URI connection string dari MongoDB Atlas
       - Contoh: mongodb+srv://username:password@cluster.mongodb.net/hmti_informatika
    
    Tambahkan MONGODB_URI ke file .env Anda.
    `);

		throw error; // Re-throw error instead of falling back to PostgreSQL
	}
};

// Model User
const userSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	name: { type: String, required: true },
	email: { type: String, required: true },
	// Nama role mengacu ke dokumen Role (koleksi roles), bukan enum statis — mendukung role kustom
	role: {
		type: String,
		required: true,
		default: 'division_head',
	},
	division: { type: String, default: '' },
	/** Nama divisi/unit untuk tampilan publik (berbeda dari slug `division`) */
	divisionLabel: { type: String, default: '' },
	permissionOverrides: {
		allow: [{ type: String }],
		deny: [{ type: String }],
	},
	tokenVersion: { type: Number, default: 0 },
	lastLogin: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

// Model Session
const sessionSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	sessionId: { type: String, required: true, unique: true },
	userAgent: { type: String, default: '' },
	ip: { type: String, default: '' },
	device: { type: String, default: '' }, // Mobile / Desktop / Tablet
	os: { type: String, default: '' },
	browser: { type: String, default: '' },
	location: { type: String, default: '' }, // City, Region, Country
	createdAt: { type: Date, default: Date.now },
	lastActive: { type: Date, default: Date.now },
	revokedAt: { type: Date, default: null },
});

// Model Role (untuk custom roles)
const roleSchema = new mongoose.Schema({
	name: { type: String, required: true, unique: true },
	displayName: { type: String, required: true },
	description: { type: String, default: '' },
	level: { type: Number, required: true }, // 1 = owner, 2 = admin, 3 = chair, etc.
	permissions: [{ type: String }], // Array of permission strings
	isActive: { type: Boolean, default: true },
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

// Model Permission (untuk mendefinisikan semua permissions yang tersedia)
const permissionSchema = new mongoose.Schema({
	name: { type: String, required: true, unique: true },
	displayName: { type: String, required: true },
	description: { type: String, default: '' },
	category: { type: String, required: true }, // 'dashboard', 'berita', 'users', etc.
	isActive: { type: Boolean, default: true },
	createdAt: { type: Date, default: Date.now },
});

// Model Berita
const beritaSchema = new mongoose.Schema({
	title: { type: String, required: true },
	slug: { type: String, required: true, unique: true }, // SEO-friendly URL
	excerpt: { type: String, required: true },
	content: { type: String, required: true },
	image: { type: String, required: true },
	imageSource: { type: String, default: 'local' },
	gdriveFileId: { type: String, default: '' },
	tags: [{ type: String }], // Array of tags
	published: { type: Boolean, default: false },
	viewCount: { type: Number, default: 0 },
	authorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	author: { type: String, required: true },
	sourceEventId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Event',
		default: null,
	},
	relatedGalleryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Library' }],
	attachments: [
		{
			name: { type: String, required: true },
			url: { type: String, required: true },
			type: { type: String, default: 'file' },
			source: {
				type: String,
				enum: ['local', 'gdrive', 'url'],
				default: 'local',
			},
		},
	],
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

beritaSchema.index({ slug: 1 });
beritaSchema.index({ published: 1, createdAt: -1 });

// Model Library
const librarySchema = new mongoose.Schema({
	title: { type: String, required: true },
	description: { type: String, default: '' },
	fullDescription: { type: String, default: '' },
	images: [{ type: String }],
	imageSources: [{ type: String }],
	gdriveFileIds: [{ type: String }],
	/** Sejajar images: 'image' | 'video' untuk campuran foto/video */
	mediaKinds: [{ type: String, enum: ['image', 'video'] }],
	type: { type: String, enum: ['photo', 'video'], default: 'photo' },
	published: { type: Boolean, default: true },
	activityDate: { type: Date, default: null },
	relatedEventIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
	relatedBeritaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Berita' }],
	/** Folder Drive yang ditampilkan sebagai embed di publik (tanpa ekspansi file di server) */
	gdriveEmbedFolders: [
		{
			folderId: { type: String, default: '' },
			url: { type: String, default: '' },
		},
	],
	tags: [{ type: String }],
	viewCount: { type: Number, default: 0 },
	authorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

librarySchema.index({ activityDate: -1, createdAt: -1 });

// Model Organization
const organizationSchema = new mongoose.Schema({
	name: { type: String, required: true },
	position: { type: String, required: true },
	period: { type: String, required: true },
	imageUrl: { type: String, required: true },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

// Model Settings
const settingsSchema = new mongoose.Schema({
	siteName: { type: String, default: 'HMTI UIN Malang' },
	siteTagline: { type: String, default: 'Salam Satu Saudara Informatika' },
	siteDescription: {
		type: String,
		default:
			'Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang',
	},
	navbarBrand: { type: String, default: 'HMTI' },
	aboutUs: { type: String, default: '' },
	aboutVideoUrl: { type: String, default: '' },
	aboutVideoGdriveUrl: { type: String, default: '' },
	visionMission: { type: String, default: '' },
	contactEmail: { type: String, default: 'hmti@uin-malang.ac.id' },
	address: {
		type: String,
		default:
			'Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang',
	},
	enableRegistration: { type: Boolean, default: false },
	maintenanceMode: { type: Boolean, default: false },
	footerText: {
		type: String,
		default:
			'© 2023 Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.',
	},
	logoUrl: {
		type: String,
		default:
			'/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp',
	},
	chairpersonPhoto: { type: String, default: '' },
	viceChairpersonPhoto: { type: String, default: '' },
	chairpersonName: { type: String, default: '' },
	viceChairpersonName: { type: String, default: '' },
	chairpersonTitle: { type: String, default: 'Ketua Himpunan' },
	viceChairpersonTitle: { type: String, default: 'Wakil Ketua' },
	divisionLogos: {
		intelektual: { type: String, default: '' },
		public_relation: { type: String, default: '' },
		religius: { type: String, default: '' },
		technopreneurship: { type: String, default: '' },
		senor: { type: String, default: '' },
		medinfo: { type: String, default: '' },
	},
	divisionNames: {
		intelektual: { type: String, default: 'Intelektual' },
		public_relation: { type: String, default: 'Public Relation' },
		religius: { type: String, default: 'Religius' },
		technopreneurship: { type: String, default: 'Technopreneurship' },
		senor: { type: String, default: 'Senor' },
		medinfo: { type: String, default: 'Medinfo' },
	},
	divisionHeads: {
		intelektual: {
			name: { type: String, default: '' },
			photo: { type: String, default: '' },
		},
		public_relation: {
			name: { type: String, default: '' },
			photo: { type: String, default: '' },
		},
		religius: {
			name: { type: String, default: '' },
			photo: { type: String, default: '' },
		},
		technopreneurship: {
			name: { type: String, default: '' },
			photo: { type: String, default: '' },
		},
		senor: {
			name: { type: String, default: '' },
			photo: { type: String, default: '' },
		},
		medinfo: {
			name: { type: String, default: '' },
			photo: { type: String, default: '' },
		},
	},
	divisionColors: {
		senor: { type: String, default: 'rgba(255, 152, 0, 0.75)' },
		religius: { type: String, default: 'rgba(76, 175, 80, 0.75)' },
		public_relation: { type: String, default: 'rgba(156, 39, 176, 0.75)' },
		medinfo: { type: String, default: 'rgba(0, 188, 212, 0.75)' },
		technopreneurship: { type: String, default: 'rgba(33, 150, 243, 0.75)' },
		intelektual: { type: String, default: 'rgba(89, 58, 69, 0.75)' },
		leadership: { type: String, default: 'rgba(33, 150, 243, 0.75)' },
	},
	socialLinks: {
		facebook: {
			type: String,
			default: 'https://www.facebook.com/himatif.encoder/',
		},
		tiktok: {
			type: String,
			default: 'https://www.tiktok.com/@himatif.encoder',
		},
		instagram: {
			type: String,
			default: 'https://www.instagram.com/himatif.encoder/',
		},
		youtube: {
			type: String,
			default: 'https://www.youtube.com/@himatifencoder',
		},
	},
	/** Home YT/IG feed toggles + URLs (see shared/social-feed.ts) */
	socialFeedConfig: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
	/** Cached scraped feed items (server-only write via sync) */
	socialFeedCache: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
	lastSocialFeedSyncAt: { type: Date, default: null },
	links: {
		uinMalang: {
			type: String,
			default: 'https://uin-malang.ac.id/',
		},
		fakultasSainsTeknologi: {
			type: String,
			default: 'https://saintek.uin-malang.ac.id/',
		},
		jurusanTeknikInformatika: {
			type: String,
			default: 'https://informatika.uin-malang.ac.id/',
		},
		perpustakaan: {
			type: String,
			default: 'https://library.uin-malang.ac.id/',
		},
	},
	quickLinks: {
		type: [
			{
				label: { type: String, required: true },
				url: { type: String, required: true },
			},
		],
		default: undefined,
	},
	mapsLocationInput: { type: String, default: '' },
	mapsEmbedUrl: { type: String, default: '' },
	/** Domain tambahan yang diizinkan untuk iframe embed (mis. "canva.com") */
	embedAllowedHosts: [{ type: String }],
	eventsAutoScrollEnabled: { type: Boolean, default: true },
	eventsAllowMultipleYearsOnHome: { type: Boolean, default: false },
	homeConfig: {
		blocks: [
			{
				id: { type: String, required: true },
				kind: { type: String, enum: ['section', 'subItem'], required: true },
				visible: { type: Boolean, default: true },
				renderMode: {
					type: String,
					enum: ['summary', 'full'],
					default: 'summary',
				},
			},
		],
		navbar: [
			{
				id: { type: String, required: true },
				visible: { type: Boolean, default: true },
			},
		],
		navbarGroups: {
			type: [
				{
					id: { type: String, required: true },
					label: { type: String, required: true },
					visible: { type: Boolean, default: true },
					members: [{ type: String }],
					allowNestedChildren: { type: Boolean, default: true },
				},
			],
			default: [],
		},
		showDashboardLink: { type: Boolean, default: true },
	},
	// Halaman lengkap Tentang Kami (sejarah, track record, lambang)
	aboutPageIntro: {
		type: String,
		default:
			'<p>HIMATIF "Encoder" didirikan atas kesepakatan bersama antar-pengurus Himpunan Mahasiswa Program Studi Teknik Informatika Universitas Islam Negeri Maulana Malik Ibrahim Malang, pada tanggal 18 Mei 2013 di Pasuruan dan disahkan di Pasuruan pada tanggal 18 Mei 2013 untuk jangka waktu yang tidak ditentukan. Sebelum itu organisasi ini masih sebuah himpunan persiapan.</p><p>HIMATIF "Encoder" terdiri dari beberapa divisi yang memiliki tugas dan wewenang masing-masing. Sejak 2013 hingga 2017 nama per-divisi yang ada masih berubah ubah, hingga pada tahun 2018 nama-nama divisi tersebut menjadi tetap hingga sekarang. Pada tahun 2021 terdapat perubahan nama atau penyebutan. Hal tersebut sesuai Surat Ketetapan Direktorat Jenderal Pendidikan Islam Kemenag RI yang menetapkan tentang perubahan nomenklatur pada awalnya "Jurusan" menjadi "Program Studi". Oleh karena itu pada periode tersebut dilakukan MUBES (Musyawarah Besar) untuk mengganti nomenklatur sekaligus logo yang masih terdapat kata "Jurusan".</p>',
	},
	aboutPageTrackRecord: {
		type: [
			{
				year: { type: String },
				chairpersonName: { type: String },
				divisions: [{ type: String }],
			},
		],
		default: [
			{
				year: '2013',
				chairpersonName: 'Willdan Pramanda W.',
				divisions: [
					'Public Relation',
					'Multimedia',
					'Jaringan & Hardware',
					'Keagamaan',
					'Pemrograman',
					'Softskill',
				],
			},
			{
				year: '2014',
				chairpersonName: 'Saiful Rizal',
				divisions: [
					'Public Relation',
					'Multimedia',
					'Jaringan',
					'Keagamaan',
					'Pemrograman',
					'Softskill',
				],
			},
			{
				year: '2015',
				chairpersonName: 'M. Fairuz Zumar Rounnaqi',
				divisions: [
					'Public Relation',
					'Multimedia',
					'Jaringan',
					'Open Source',
					'Pemrograman',
					'Softskill & Jurnalistik',
					'Keagamaan & Enterpreneurship',
				],
			},
			{
				year: '2016',
				chairpersonName: 'M. Wildan Taufiqurrahman',
				divisions: [
					'Public Relation',
					'Multimedia',
					'Intelektual',
					'Softskill',
					'Jurnalistik',
					'Technopreneurship',
					'Religius',
				],
			},
			{
				year: '2017',
				chairpersonName: 'Zakiya Ramadhan',
				divisions: [
					'Public Relation',
					'Multimedia',
					'Intelektual',
					'Softskill',
					'Jurnalistik',
					'Technopreneurship',
					'Religius',
				],
			},
			{
				year: '2018',
				chairpersonName: 'Muhammad Fahmi Abidin',
				divisions: [
					'Public Relation',
					'Intelektual',
					'Softskill',
					'Jurnalistik',
					'Technopreneurship',
					'Religius',
				],
			},
			{
				year: '2019',
				chairpersonName: 'Aqilarik Nugra Rezkanintio',
				divisions: [
					'Public Relation',
					'Intelektual',
					'Seni dan Olahraga',
					'Media dan Informasi',
					'Technopreneurship',
					'Religius',
				],
			},
			{
				year: '2020',
				chairpersonName: 'M. Ibram Gusti Childrabahti',
				divisions: [
					'Public Relation',
					'Intelektual',
					'Seni dan Olahraga',
					'Media dan Informasi',
					'Technopreneurship',
					'Religius',
				],
			},
			{
				year: '2021',
				chairpersonName: 'Bisyri Syamsuri',
				divisions: [
					'Public Relation',
					'Intelektual',
					'Seni dan Olahraga',
					'Media dan Informasi',
					'Technopreneurship',
					'Religius',
				],
			},
			{
				year: '2022',
				chairpersonName: 'Rafi Aulia Prasetya',
				divisions: [
					'Public Relation',
					'Intelektual',
					'Seni dan Olahraga',
					'Media dan Informasi',
					'Technopreneurship',
					'Religius',
				],
			},
			{
				year: '2023',
				chairpersonName: 'M. Reyhan Aditya Hendrawan',
				divisions: [
					'Public Relation',
					'Intelektual',
					'Seni dan Olahraga',
					'Media dan Informasi',
					'Technopreneurship',
					'Religius',
				],
			},
			{
				year: '2024',
				chairpersonName: 'Mohammad Aulia Syamsul Hadi',
				divisions: [
					'Public Relation',
					'Intelektual',
					'Seni dan Olahraga',
					'Media dan Informasi',
					'Technopreneurship',
					'Religius',
				],
			},
		],
	},
	aboutPageLambang: {
		type: [
			{
				key: { type: String },
				title: { type: String },
				description: { type: String },
				imageUrl: { type: String, default: '' },
			},
		],
		default: [
			{
				key: 'Lingkaran',
				title: 'Lingkaran',
				description:
					'Lingkaran menandakan bahwa jurusan Teknik Informatika memiliki solidaritas tanpa ujung.',
				imageUrl: '/attached_assets/filosofi/Lingkaran.png',
			},
			{
				key: 'Bidikan',
				title: 'Bidikan',
				description:
					'Merepresentasikan bahwa Himpunan memiliki sebuah tujuan yang jelas untuk dicapai, dengan mengedepankan karakter yang dinamis dan kuat.',
				imageUrl: '/attached_assets/filosofi/Bidikan.png',
			},
			{
				key: 'Tulisan TI Berbentuk Puzzle',
				title: 'Tulisan TI Berbentuk Puzzle',
				description:
					'Merepresentasikan penyelesaian setiap masalah dengan langkah-langkah yang harus diambil dengan benar.',
				imageUrl: '/attached_assets/filosofi/Tulisan TI Berbentuk Puzzle.png',
			},
			{
				key: 'Mata',
				title: 'Mata',
				description:
					'Fokus menghadapi masa depan dengan penuh perhitungan dan percaya diri.',
				imageUrl: '/attached_assets/filosofi/Mata.png',
			},
			{
				key: 'Kurung Kurawal',
				title: 'Kurung Kurawal',
				description:
					'Menandakan elemen penting dalam pembentuk gambar mata yang memiliki arti fokus, loyal, dan memiliki jiwa tanggung jawab.',
				imageUrl: '/attached_assets/filosofi/Kurung Kurawal.png',
			},
			{
				key: 'Grafik Linier',
				title: 'Grafik Linier',
				description:
					'Menandakan Himpunan yang selalu berkembang, namun tetap adil.',
				imageUrl: '/attached_assets/filosofi/Grafik Linier.png',
			},
			{
				key: 'Biru 81BFE8',
				title: 'Biru',
				description:
					'Bermakna intelektual, loyalitas, dan tanggung jawab. Hex Color: 81BFE8',
				imageUrl: '/attached_assets/filosofi/Biru 81BFE8.png',
			},
			{
				key: 'Jingga E75B1D',
				title: 'Jingga',
				description:
					'Melambangkan kehangatan dan kenyamanan. Hex Color: E75B1D.',
				imageUrl: '/attached_assets/filosofi/Jingga E75B1D.png',
			},
			{
				key: 'Abu Abu A1A5A6',
				title: 'Abu-abu',
				description:
					'Menggambarkan keseriusan, kestabilan, kemandirian, dan memberikan kesan tanggung jawab. Hex Color: A1A5A6.',
				imageUrl: '/attached_assets/filosofi/Abu Abu A1A5A6.png',
			},
			{
				key: 'Putih FFFFFF',
				title: 'Putih',
				description:
					'Melambangkan kebebasan dan keterbukaan. Hex Color: FFFFFF.',
				imageUrl: '/attached_assets/filosofi/Putih FFFFFF.png',
			},
		],
	},
	homeImageBannerSlots: {
		type: [
			{
				id: { type: String, required: true },
				label: { type: String, required: true },
				order: { type: Number, required: true },
			},
		],
		default: undefined,
	},
	feedbackSubmitEnabled: { type: Boolean, default: true },
	feedbackCardsEnabled: { type: Boolean, default: true },
	feedbackCardsAutoScrollEnabled: { type: Boolean, default: true },
	feedbackPublicTypeFilter: { type: String, default: 'all' },
	feedbackPublicTypeFilterIds: { type: [String], default: [] },
	feedbackFormConfig: { type: mongoose.Schema.Types.Mixed, default: null },
	// Metadata backup bulanan (anti double-run)
	lastMonthlyBackupAt: { type: Date, default: null },
	lastMonthlyBackupKey: { type: String, default: '' },
});

// Position Schema - untuk mengelola position per tahun
const positionSchema = new mongoose.Schema({
	period: { type: String, required: true },
	positions: [
		{
			name: { type: String, required: true },
			order: { type: Number, required: true },
		},
	],
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

// Division Schema - per periode kepengurusan (sama seperti jabatan per periode)
const divisionSchema = new mongoose.Schema({
	name: { type: String, required: true },
	period: { type: String, default: '' },
	displayName: { type: String, required: true },
	description: { type: String, default: '' },
	positions: [{ type: String }], // Array of position names in this division
	sortOrder: { type: Number, default: 0 },
	color: { type: String, default: '#3B82F6' },
	logo: { type: String, default: '' },
	isActive: { type: Boolean, default: true },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});
divisionSchema.index({ period: 1, name: 1 }, { unique: true });

// Model EventYear — container event per tahun
const eventYearSchema = new mongoose.Schema(
	{
		year: { type: Number, required: true, unique: true },
		isActiveOnHome: { type: Boolean, default: false },
	},
	{ timestamps: true },
);

// Model Event — event utama & sub-event (nested via parentId)
const eventSchema = new mongoose.Schema(
	{
		yearId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'EventYear',
			required: true,
		},
		parentId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Event',
			default: null,
		},
		title: { type: String, required: true },
		description: { type: String, default: '' },
		thumbnail: { type: String, default: '' },
		thumbnailSource: {
			type: String,
			enum: ['local', 'gdrive'],
			default: 'local',
		},
		gdriveFileId: { type: String, default: '' },
		startDate: { type: Date, required: true },
		endDate: { type: Date, required: true },
		month: { type: Number, required: true, min: 1, max: 12 },
		attachments: [
			{
				name: { type: String, required: true },
				url: { type: String, required: true },
				type: { type: String, default: 'file' },
				source: {
					type: String,
					enum: ['local', 'gdrive', 'url'],
					default: 'local',
				},
			},
		],
		published: { type: Boolean, default: false },
		viewCount: { type: Number, default: 0 },
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		relatedBerita: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Berita',
			},
		],
		sourceBeritaId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Berita',
			default: null,
		},
		relatedGalleryIds: [
			{ type: mongoose.Schema.Types.ObjectId, ref: 'Library' },
		],
	},
	{ timestamps: true },
);

eventSchema.index({ yearId: 1, month: 1 });
eventSchema.index({ parentId: 1 });

// Model HomeImages — per-year home page banner/image sets
const homeImagesSchema = new mongoose.Schema(
	{
		year: { type: Number, required: true, unique: true },
		isActive: { type: Boolean, default: false },
		desktopMode: {
			type: String,
			enum: ['bennerfull', 'combined'],
			default: 'combined',
		},
		desktopBannerSource: {
			type: String,
			enum: ['classic', 'fullBackground'],
			default: 'classic',
		},
		bennerfull: { type: String, default: '' },
		orang: { type: String, default: '' },
		desktopBackground: { type: String, default: '' },
		banners: { type: mongoose.Schema.Types.Mixed, default: {} },
		people: { type: mongoose.Schema.Types.Mixed, default: {} },
	},
	{ timestamps: true },
);

// Model OtpChallenge — reusable OTP verification
const otpChallengeSchema = new mongoose.Schema({
	purpose: { type: String, required: true },
	email: { type: String, required: true },
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
	requestIp: { type: String, default: '' },
	codeHash: { type: String, required: true },
	attempts: { type: Number, default: 0 },
	maxAttempts: { type: Number, default: 5 },
	consumedAt: { type: Date, default: null },
	verifiedAt: { type: Date, default: null },
	resetTokenHash: { type: String, default: null },
	resetTokenExpiresAt: { type: Date, default: null },
	expiresAt: { type: Date, required: true },
	createdAt: { type: Date, default: Date.now },
});

otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpChallengeSchema.index({ email: 1, createdAt: -1 });
otpChallengeSchema.index({ requestIp: 1, createdAt: -1 });

// Model PostSharing — per-post access control (invite / request workflow)
const postSharingSchema = new mongoose.Schema(
	{
		entityType: {
			type: String,
			required: true,
			enum: ['berita', 'events', 'library'],
		},
		entityId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
		kind: {
			type: String,
			required: true,
			enum: ['invite', 'request'],
		},
		requesterId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		targetId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		permission: {
			type: String,
			required: true,
			enum: ['view', 'edit'],
		},
		status: {
			type: String,
			required: true,
			enum: ['pending', 'approved', 'declined', 'expired', 'revoked'],
			default: 'pending',
		},
		decidedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		decidedAt: { type: Date, default: null },
		expiresAt: { type: Date, required: true },
	},
	{ timestamps: true },
);

postSharingSchema.index({ entityType: 1, entityId: 1, status: 1 });
postSharingSchema.index({ targetId: 1, status: 1 });
postSharingSchema.index({ requesterId: 1, status: 1 });
postSharingSchema.index({ expiresAt: 1 });

// Model UserNotification — per-user notifications (sharing, approvals, etc.)
const userNotificationSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		type: {
			type: String,
			required: true,
			enum: [
				'sharing_invite',
				'sharing_request',
				'sharing_request_updated',
				'sharing_approved',
				'sharing_declined',
				'sharing_revoked',
				'sharing_expired',
				'bug_reply',
				'news_published',
				'event_ongoing',
				'comment_reply',
				'feedback_reply',
			],
		},
		title: { type: String, required: true },
		description: { type: String, default: '' },
		entityType: {
			type: String,
			enum: ['berita', 'events', 'event', 'library', 'feedback', 'bug', ''],
			default: null,
		},
		entityId: {
			type: mongoose.Schema.Types.ObjectId,
			default: null,
		},
		entityTitle: { type: String, default: '' },
		sharingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'PostSharing',
			default: null,
		},
		fromUserId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		fromUserName: { type: String, default: '' },
		read: { type: Boolean, default: false },
		actionUrl: { type: String, default: '' },
		image: { type: String, default: '' },
		tag: { type: String, default: '' },
	},
	{ timestamps: true },
);

userNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
userNotificationSchema.index({ userId: 1, createdAt: -1 });

// ProdiContent Schema — singleton document holding crawled prodi data
const lecturerDetailSchema = new mongoose.Schema(
	{
		name: { type: String, default: '' },
		nip: { type: String, default: '' },
		nidn: { type: String, default: '' },
		nidnUrl: { type: String, default: '' },
		email: { type: String, default: '' },
		education: { type: String, default: '' },
		knowledgeGroup: { type: String, default: '' },
		profileUrl: { type: String, default: '' },
		photoUrl: { type: String, default: '' },
		workingDaysHours: { type: String, default: '' },
		googleScholar: { type: String, default: '' },
		scopusId: { type: String, default: '' },
		scopusUrl: { type: String, default: '' },
		orcidId: { type: String, default: '' },
		orcidUrl: { type: String, default: '' },
		sintaId: { type: String, default: '' },
		sintaUrl: { type: String, default: '' },
		repositoryUrl: { type: String, default: '' },
	},
	{ _id: false },
);

const lecturerGroupSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		lecturers: [lecturerDetailSchema],
	},
	{ _id: false },
);

const milestoneSchema = new mongoose.Schema(
	{
		year: { type: String, default: '' },
		description: { type: String, default: '' },
	},
	{ _id: false },
);

const managementPersonSchema = new mongoose.Schema(
	{
		name: { type: String, default: '' },
		position: { type: String, default: '' },
		profileUrl: { type: String, default: '' },
		photoUrl: { type: String, default: '' },
		workingDaysHours: { type: String, default: '' },
		email: { type: String, default: '' },
		nip: { type: String, default: '' },
		nidn: { type: String, default: '' },
		education: { type: String, default: '' },
		knowledgeGroup: { type: String, default: '' },
		googleScholar: { type: String, default: '' },
		scopusUrl: { type: String, default: '' },
		orcidUrl: { type: String, default: '' },
		sintaUrl: { type: String, default: '' },
		repositoryUrl: { type: String, default: '' },
	},
	{ _id: false },
);

const managementPeriodSchema = new mongoose.Schema(
	{
		period: { type: String, default: '' },
		isCurrent: { type: Boolean, default: false },
		members: [managementPersonSchema],
	},
	{ _id: false },
);

const curriculumSubjectSchema = new mongoose.Schema(
	{
		no: { type: String, default: '' },
		code: { type: String, default: '' },
		name: { type: String, default: '' },
		sks: { type: String, default: '' },
		prerequisite: { type: String, default: '' },
		rpsUrl: { type: String, default: '' },
	},
	{ _id: false },
);

const semesterSchema = new mongoose.Schema(
	{
		semester: { type: Number, required: true },
		totalSks: { type: String, default: '' },
		subjects: [curriculumSubjectSchema],
	},
	{ _id: false },
);

const rpsResourceLinkSchema = new mongoose.Schema(
	{
		label: { type: String, default: '' },
		url: { type: String, default: '' },
	},
	{ _id: false },
);

const subjectRpsResourceSchema = new mongoose.Schema(
	{
		slug: { type: String, required: true },
		subjectName: { type: String, default: '' },
		materiPpt: [rpsResourceLinkSchema],
		linkFile: [rpsResourceLinkSchema],
		parsedAt: { type: Date },
	},
	{ _id: false },
);

const accreditationItemSchema = new mongoose.Schema(
	{
		group: { type: String, default: '' },
		title: { type: String, default: '' },
		downloadUrl: { type: String, default: '' },
		yearLabel: { type: String, default: '' },
		isPrimary: { type: Boolean, default: false },
	},
	{ _id: false },
);

const accreditationLevelSchema = new mongoose.Schema(
	{
		title: { type: String, default: '' },
		sourceUrl: { type: String, default: '' },
		groups: [{ type: String }],
		items: [accreditationItemSchema],
		lastSyncedAt: { type: Date, default: null },
		lastError: { type: String, default: '' },
	},
	{ _id: false },
);

const curriculumYearEntrySchema = new mongoose.Schema(
	{
		academicYear: { type: Number, required: true },
		/** Study level: undergraduate (s1) or master (s2). Legacy rows default to s1. */
		level: { type: String, enum: ['s1', 's2'], default: 's1' },
		periodLabel: { type: String, default: '' },
		graduateProfile: [{ type: mongoose.Schema.Types.Mixed }],
		knowledgeGroups: [{ type: String }],
		structureSummary: { type: String, default: '' },
		semesters: [semesterSchema],
		optionalSubjects: [curriculumSubjectSchema],
		subjectRpsResources: [subjectRpsResourceSchema],
		guidebookUrl: { type: String, default: '' },
		curriculumUrl: { type: String, default: '' },
		officialUrl: { type: String, default: '' },
		source: { type: String, enum: ['sync', 'manual'], default: 'sync' },
		updatedAt: { type: Date, default: Date.now },
	},
	{ _id: false },
);

const laboratorySchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		description: { type: String, default: '' },
		imageUrl: { type: String, default: '' },
		imageUrls: { type: [String], default: [] },
	},
	{ _id: false },
);

const prodiContentSchema = new mongoose.Schema(
	{
		autoSyncEnabled: { type: Boolean, default: true },
		lastAutoSyncAt: { type: Date, default: null },
		lastManualSyncAt: { type: Date, default: null },
		/** How often to refresh student announcements (RSS). Default 1 day. */
		announcementSyncIntervalDays: { type: Number, default: 1, min: 1, max: 30 },
		lastAnnouncementSyncAt: { type: Date, default: null },
		syncStatus: {
			type: String,
			enum: ['idle', 'syncing', 'error'],
			default: 'idle',
		},
		lastSyncError: { type: String, default: '' },

		overrides: { type: mongoose.Schema.Types.Mixed, default: {} },

		content: {
			profile: {
				history: { type: String, default: '' },
				vision: { type: String, default: '' },
				mission: [{ type: String }],
				objectives: [{ type: String }],
				strategy: { type: String, default: '' },
				milestones: [milestoneSchema],
				managements: [managementPeriodSchema],
				organizationStructureImageUrl: { type: String, default: '' },
				organizationStructureDescription: { type: String, default: '' },
			},
			lecturers: {
				headAndSecretary: [managementPersonSchema],
				groups: [lecturerGroupSchema],
				staff: [lecturerDetailSchema],
			},
			curriculum: {
				periodLabel: { type: String, default: '' },
				graduateProfile: [{ type: mongoose.Schema.Types.Mixed }],
				knowledgeGroups: [{ type: String }],
				structureSummary: { type: String, default: '' },
				semesters: [semesterSchema],
				optionalSubjects: [curriculumSubjectSchema],
				subjectRpsResources: [subjectRpsResourceSchema],
				guidebookUrl: { type: String, default: '' },
				curriculumUrl: { type: String, default: '' },
				officialUrl: { type: String, default: '' },
			},
			laboratories: {
				teaching: [laboratorySchema],
				research: [laboratorySchema],
			},
			accreditation: {
				s1: { type: accreditationLevelSchema, default: () => ({}) },
				s2: { type: accreditationLevelSchema, default: () => ({}) },
				s3: { type: accreditationLevelSchema, default: () => ({}) },
				s3ManualUrl: { type: String, default: '' },
				lastSyncAt: { type: Date, default: null },
			},
			/** Student hub: calendars, portals, guides, skripsi/PKL, announcements */
			studentHub: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
		},

		curriculumByYear: [curriculumYearEntrySchema],

		sources: {
			profileUrl: {
				type: String,
				default: 'https://informatika.uin-malang.ac.id/undergraduate-s1/',
			},
			lecturerUrl: {
				type: String,
				default: 'https://informatika.uin-malang.ac.id/lecturer-and-staff/',
			},
			curriculumUrl: {
				type: String,
				default: 'https://informatika.uin-malang.ac.id/curriculum/',
			},
			teachingLabUrl: {
				type: String,
				default: 'https://informatika.uin-malang.ac.id/teaching-laboratory/',
			},
			researchLabUrl: {
				type: String,
				default: 'https://informatika.uin-malang.ac.id/research-laboratory/',
			},
		},
	},
	{ timestamps: true },
);

prodiContentSchema.pre('save', async function (next) {
	if (this.isNew) {
		const Model = this.constructor as any;
		await Model.deleteMany({ _id: { $ne: this._id } });
	}
	next();
});

// Model Feedback — dynamic destinations/types configured per tenant
const feedbackReplySchema = new mongoose.Schema(
	{
		adminId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		adminName: { type: String, required: true },
		message: { type: String, required: true },
		repliedAt: { type: Date, default: Date.now },
	},
	{ _id: false },
);

const feedbackSchema = new mongoose.Schema(
	{
		target: { type: String, required: true },
		type: { type: String, required: true },
		body: { type: String, required: true },
		isAnonymous: { type: Boolean, default: false },
		senderName: { type: String, default: '' },
		senderNim: { type: String, default: '' },
		senderEmail: { type: String, default: '' },
		isVisibleCard: { type: Boolean, default: false },
		guestKeyHash: { type: String, default: null },
		ipHash: { type: String, default: null },
		media: [
			{
				url: { type: String, required: true },
				originalName: { type: String, default: '' },
				mimeType: { type: String, default: '' },
				size: { type: Number, default: 0 },
			},
		],
		gdriveLinks: [{ type: String }],
		mediaLinks: [
			{
				url: { type: String, required: true },
				provider: { type: String, default: '' },
				title: { type: String, default: '' },
				description: { type: String, default: '' },
				thumbnail: { type: String, default: '' },
				mimeHint: { type: String, default: '' },
			},
		],
		reply: { type: feedbackReplySchema, default: null },
		suggestionStatus: {
			type: String,
			enum: ['pending', 'accepted', 'rejected'],
			default: 'pending',
		},
		suggestionDecisionComment: { type: String, default: '' },
		suggestionDecidedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		suggestionDeciderName: { type: String, default: '' },
		suggestionDecidedAt: { type: Date, default: null },
		ratings: { type: mongoose.Schema.Types.Mixed, default: {} },
		extraFields: { type: mongoose.Schema.Types.Mixed, default: {} },
		destinationLabel: { type: String, default: '' },
		typeLabel: { type: String, default: '' },
	},
	{ timestamps: true },
);

feedbackSchema.index({ target: 1, type: 1, createdAt: -1 });
feedbackSchema.index({ isVisibleCard: 1, createdAt: -1 });
feedbackSchema.index({ type: 1, suggestionStatus: 1 });

// Model BugReport — laporan bug dari dashboard (disimpan di DB utama saja)
const bugReportAttachmentSchema = new mongoose.Schema(
	{
		url: { type: String, required: true },
		originalName: { type: String, default: '' },
		mimeType: { type: String, default: '' },
		size: { type: Number, default: 0 },
	},
	{ _id: false },
);

const bugReportReplySchema = new mongoose.Schema(
	{
		message: { type: String, required: true },
		repliedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		repliedByName: { type: String, required: true },
		repliedAt: { type: Date, default: Date.now },
	},
	{ _id: false },
);

const bugReportSchema = new mongoose.Schema(
	{
		description: { type: String, required: true },
		attachments: [bugReportAttachmentSchema],
		gdriveLinks: [{ type: String }],
		reporterUserId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		reporterName: { type: String, required: true },
		reporterUsername: { type: String, required: true },
		reporterEmail: { type: String, required: true },
		sourceCommunitySlug: { type: String, default: '' },
		sourceCommunityName: { type: String, default: '' },
		status: {
			type: String,
			enum: ['open', 'replied', 'closed'],
			default: 'open',
		},
		reply: { type: bugReportReplySchema, default: null },
	},
	{ timestamps: true },
);

bugReportSchema.index({ status: 1, createdAt: -1 });
bugReportSchema.index({ reporterUserId: 1 });

// Model SystemError — laporan bug OTOMATIS dari sistem (server 5xx + error tampilan client).
// Dikelompokkan/dedup berdasarkan fingerprint; dianalisis AI (OpenAI→Gemini). Owner-only.
const systemErrorAiAnalysisSchema = new mongoose.Schema(
	{
		summary: { type: String, default: '' },
		likelyCause: { type: String, default: '' },
		suggestedFix: { type: String, default: '' },
		severity: { type: String, default: '' },
		model: { type: String, default: '' },
		analyzedAt: { type: Date, default: null },
	},
	{ _id: false },
);

const systemErrorSchema = new mongoose.Schema(
	{
		// Identitas & pengelompokan
		fingerprint: { type: String, required: true },
		source: { type: String, enum: ['server', 'client'], required: true },
		severity: {
			type: String,
			enum: ['low', 'medium', 'high', 'critical'],
			default: 'medium',
		},
		// Detail error
		name: { type: String, default: '' }, // mis. TypeError, ReferenceError
		message: { type: String, default: '' },
		stack: { type: String, default: '' },
		file: { type: String, default: '' },
		line: { type: Number, default: 0 },
		column: { type: Number, default: 0 },
		functionName: { type: String, default: '' },
		// Konteks request / lokasi
		route: { type: String, default: '' }, // path API atau route client
		page: { type: String, default: '' }, // halaman tempat error terjadi (Referer / route client)
		httpMethod: { type: String, default: '' },
		statusCode: { type: Number, default: 0 },
		// Identitas pengguna (null bila tamu)
		userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
		username: { type: String, default: '' },
		userRole: { type: String, default: '' },
		userEmail: { type: String, default: '' },
		// Jaringan & perangkat
		ip: { type: String, default: '' },
		userAgent: { type: String, default: '' },
		device: { type: String, default: '' },
		browser: { type: String, default: '' },
		os: { type: String, default: '' },
		// Tenant
		isTenant: { type: Boolean, default: false },
		communitySlug: { type: String, default: '' },
		communityName: { type: String, default: '' },
		// Agregasi kemunculan
		count: { type: Number, default: 1 },
		firstSeenAt: { type: Date, default: Date.now },
		lastSeenAt: { type: Date, default: Date.now },
		// Pengelolaan
		status: {
			type: String,
			enum: ['new', 'investigating', 'resolved', 'ignored'],
			default: 'new',
		},
		environment: { type: String, default: '' },
		metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
		aiAnalysis: { type: systemErrorAiAnalysisSchema, default: null },
	},
	{ timestamps: true },
);

systemErrorSchema.index({ fingerprint: 1 });
systemErrorSchema.index({ status: 1, lastSeenAt: -1 });
systemErrorSchema.index({ severity: 1, lastSeenAt: -1 });
systemErrorSchema.index({ source: 1, lastSeenAt: -1 });
systemErrorSchema.index({ communitySlug: 1, lastSeenAt: -1 });

// Model Comment — komentar publik pada berita/event/library dengan reply bertingkat
const commentSchema = new mongoose.Schema(
	{
		targetType: {
			type: String,
			enum: ['berita', 'library', 'event'],
			required: true,
		},
		targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
		parentId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Comment',
			default: null,
		},
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		guestKeyHash: { type: String, default: null },
		displayName: { type: String, required: true },
		isAnonymous: { type: Boolean, default: false },
		body: { type: String, required: true },
		editedAt: { type: Date, default: null },
	},
	{ timestamps: true },
);

commentSchema.index({ targetType: 1, targetId: 1, createdAt: 1 });
commentSchema.index({ parentId: 1 });

// ── Store (katalog toko, keranjang guest, order) ──
const storeGalleryItemSchema = new mongoose.Schema(
	{
		url: { type: String, required: true },
		source: { type: String, enum: ['local', 'gdrive'], default: 'local' },
		gdriveFileId: { type: String, default: '' },
	},
	{ _id: false },
);

const storeLayoutBlockSchema = new mongoose.Schema(
	{
		id: { type: String, required: true },
		type: { type: String, required: true },
		visible: { type: Boolean, default: true },
		order: { type: Number, default: 0 },
		props: { type: mongoose.Schema.Types.Mixed, default: {} },
	},
	{ _id: false },
);

const storeSettingsSchema = new mongoose.Schema(
	{
		key: { type: String, default: 'default', unique: true },
		navbarLabel: { type: String, default: 'Toko' },
		navbarPath: { type: String, default: '/toko' },
		whatsappPhone: { type: String, default: '' },
		whatsappContactName: { type: String, default: '' },
		defaultBuyMessageTemplate: {
			type: String,
			default:
				'Halo, saya tertarik membeli:\n\n{{productName}}\nHarga: {{price}}\nJumlah: {{qty}}\nLink: {{url}}',
		},
		checkoutMessageTemplate: {
			type: String,
			default:
				'Halo, saya ingin checkout keranjang:\n\n{{items}}\nSubtotal: {{subtotal}}\nOngkos kirim: {{shippingCost}}\nPajak ({{taxPercent}}%): {{tax}}\nTotal: {{total}}\n\nPengiriman: {{fulfillment}}\nAlamat: {{address}}\nNama: {{customerName}}\nWA: {{customerPhone}}\n\nLihat invoice: {{invoiceUrl}}',
		},
		taxPercent: { type: Number, default: 0 },
		taxEnabled: { type: Boolean, default: false },
		storeAddress: { type: String, default: '' },
		/** Ongkos kirim (api.co.id): kode kelurahan asal, berat default, filter kurir */
		shipping: {
			enabled: { type: Boolean, default: false },
			globalOriginVillageCode: { type: String, default: '' },
			/** Default berat per item jika produk tidak override (gram) */
			defaultWeightGrams: { type: Number, default: 1000, min: 1 },
			/** Kosong = semua kurir yang dikembalikan API; isi = filter (courier_code) */
			defaultCouriers: [{ type: String }],
		},
		/** Mata uang default katalog (ISO 4217, mis. IDR) */
		defaultCurrency: { type: String, default: 'IDR' },
		layoutBlocks: { type: [storeLayoutBlockSchema], default: [] },
	},
	{ timestamps: true },
);

const storePriceTierSchema = new mongoose.Schema(
	{
		minQty: { type: Number, required: true, min: 2 },
		unitPrice: { type: Number, required: true, min: 0 },
		/** per tier: harga grosir per kelipatan minQty vs blok pertama saja */
		applyMultiples: { type: Boolean, default: false },
	},
	{ _id: false },
);

const storeProductCategorySchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		slug: { type: String, required: true, unique: true },
		order: { type: Number, default: 0 },
	},
	{ timestamps: true },
);
storeProductCategorySchema.index({ order: 1, name: 1 });

const storePreOrderTimelineEntrySchema = new mongoose.Schema(
	{
		key: { type: String, default: '' },
		label: { type: String, required: true },
		at: { type: Date, default: null },
		note: { type: String, default: '' },
	},
	{ _id: false },
);

const storeProductDiscountOverrideSchema = new mongoose.Schema(
	{
		mode: {
			type: String,
			enum: ['recurring_daily_window', 'scheduled_range', 'one_time_flash', 'always'],
			default: 'always',
		},
		discountType: { type: String, enum: ['percent', 'fixed'], required: true },
		discountValue: { type: Number, required: true, min: 0 },
		startAt: { type: Date, default: null },
		endAt: { type: Date, default: null },
		/** "HH:mm" zona Asia/Jakarta */
		dailyStart: { type: String, default: '' },
		dailyEnd: { type: String, default: '' },
		usageLimit: { type: Number, default: null },
		usageCount: { type: Number, default: 0 },
		oneTimeCompleted: { type: Boolean, default: false },
	},
	{ _id: false },
);

const storeProductSchema = new mongoose.Schema(
	{
		slug: { type: String, required: true, unique: true },
		name: { type: String, required: true },
		shortDescription: { type: String, default: '' },
		descriptionHtml: { type: String, default: '' },
		price: { type: Number, required: true, min: 0 },
		/** Harga grosir / paket: minQty minimal 2, harga satuan untuk qty ≥ minQty */
		priceTiers: { type: [storePriceTierSchema], default: [] },
		/** true: diskon per kelipatan minQty; false: hanya minQty unit pertama pakai harga grosir */
		priceTierMultiples: { type: Boolean, default: false },
		/** Stok: -1 = tak terbatas (default). ≥ 0 = terlacak & berkurang saat checkout */
		stock: { type: Number, default: -1 },
		categoryId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'StoreProductCategory',
			default: null,
		},
		/** Kosong = pakai defaultCurrency pengaturan toko */
		currency: { type: String, default: '' },
		/** Ongkir: berat (gram) per satuan, kode asal, gratis ongkir */
		shippingWeightGrams: { type: Number, default: null, min: 1 },
		originVillageCodeOverride: { type: String, default: '' },
		isFreeShipping: { type: Boolean, default: false },
		/** Nonaktifkan campaign diskon global untuk produk ini */
		disableGlobalDiscount: { type: Boolean, default: false },
		/** Diskon khusus produk (bukan tier grosir) */
		discountOverride: { type: storeProductDiscountOverrideSchema, default: null },
		/** Pre-order: jadwal, estimasi, timeline */
		isPreOrder: { type: Boolean, default: false },
		preOrderOpenAt: { type: Date, default: null },
		preOrderCloseAt: { type: Date, default: null },
		estimatedReadyAt: { type: Date, default: null },
		/** Diskon pre-order (%) hanya jika waktu order dalam jendela pre-order */
		preOrderDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
		/** Setelah tutup, masih boleh order (harga normal, aturan stok normal) */
		preOrderAllowAfterClose: { type: Boolean, default: false },
		preOrderTimeline: { type: [storePreOrderTimelineEntrySchema], default: [] },
		thumbnail: { type: String, required: true },
		thumbnailSource: { type: String, enum: ['local', 'gdrive'], default: 'local' },
		thumbnailGdriveFileId: { type: String, default: '' },
		gallery: { type: [storeGalleryItemSchema], default: [] },
		videoUrl: { type: String, default: '' },
		videoType: { type: String, enum: ['youtube', 'gdrive', 'public', ''], default: '' },
		whatsappPhoneOverride: { type: String, default: '' },
		whatsappContactNameOverride: { type: String, default: '' },
		buyMessageTemplateOverride: { type: String, default: '' },
		storeAddressOverride: { type: String, default: '' },
		published: { type: Boolean, default: false },
		/** Urutan tampilan katalog (naik); drag-and-drop di dashboard */
		sortOrder: { type: Number, default: 0 },
		authorId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true },
);
storeProductSchema.index({ published: 1, sortOrder: 1, createdAt: -1 });
storeProductSchema.index({ authorId: 1 });
storeProductSchema.index({ categoryId: 1, published: 1 });

const storeDiscountCampaignSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		scope: { type: String, enum: ['global', 'product'], default: 'global' },
		productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StoreProduct' }],
		mode: {
			type: String,
			enum: ['recurring_daily_window', 'scheduled_range', 'one_time_flash'],
			required: true,
		},
		discountType: { type: String, enum: ['percent', 'fixed'], required: true },
		discountValue: { type: Number, required: true, min: 0 },
		startAt: { type: Date, default: null },
		endAt: { type: Date, default: null },
		dailyStart: { type: String, default: '' },
		dailyEnd: { type: String, default: '' },
		usageLimit: { type: Number, default: null },
		usageCount: { type: Number, default: 0 },
		/** one_time_flash: selesai setelah usage limit tercapai */
		oneTimeCompleted: { type: Boolean, default: false },
		priority: { type: Number, default: 0 },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true },
);
storeDiscountCampaignSchema.index({ isActive: 1, priority: -1 });

const storeBundleItemSchema = new mongoose.Schema(
	{
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'StoreProduct',
			required: true,
		},
		qty: { type: Number, required: true, min: 1 },
	},
	{ _id: false },
);

const storeBundleSchema = new mongoose.Schema(
	{
		slug: { type: String, required: true, unique: true },
		name: { type: String, required: true },
		shortDescription: { type: String, default: '' },
		/** Harga paket */
		bundlePrice: { type: Number, required: true, min: 0 },
		/** Ongkir dihitung 0 (bundle hanya tampil jika isi tidak gratis semua) */
		isFreeShipping: { type: Boolean, default: false },
		items: { type: [storeBundleItemSchema], required: true },
		/** Kosong = jumlahkan berat anak; else override total gram per bundle */
		weightGramsOverride: { type: Number, default: null, min: 1 },
		published: { type: Boolean, default: false },
		isActive: { type: Boolean, default: true },
		sortOrder: { type: Number, default: 0 },
		thumbnail: { type: String, default: '' },
		authorId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true },
);
storeBundleSchema.index({ published: 1, sortOrder: 1, createdAt: -1 });

const storeProductShareSchema = new mongoose.Schema(
	{
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'StoreProduct',
			required: true,
		},
		targetUserId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		accessLevel: { type: String, enum: ['view', 'edit'], required: true },
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true },
);
storeProductShareSchema.index({ productId: 1, targetUserId: 1 }, { unique: true });

const guestStoreSessionSchema = new mongoose.Schema(
	{
		sessionKeyHash: { type: String, required: true, unique: true },
		cartItems: [
			{
				/** p:<productId> | b:<bundleId> */
				lineKey: { type: String, default: '' },
				lineKind: {
					type: String,
					enum: ['product', 'bundle'],
					default: 'product',
				},
				productId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: 'StoreProduct',
					default: null,
				},
				bundleId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: 'StoreBundle',
					default: null,
				},
				qty: { type: Number, required: true, min: 1 },
			},
		],
		checkoutDraft: {
			customerName: { type: String, default: '' },
			customerPhone: { type: String, default: '' },
			fulfillment: { type: String, enum: ['pickup', 'delivery', ''], default: '' },
			shippingAddress: { type: String, default: '' },
			destinationVillageCode: { type: String, default: '' },
			shippingCourierCode: { type: String, default: '' },
			shippingServiceLabel: { type: String, default: '' },
		},
		expireAt: { type: Date, required: true },
	},
	{ timestamps: true },
);
guestStoreSessionSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const storeOrderItemSchema = new mongoose.Schema(
	{
		lineKind: { type: String, enum: ['product', 'bundle'], default: 'product' },
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'StoreProduct',
			default: null,
		},
		bundleId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'StoreBundle',
			default: null,
		},
		name: { type: String, required: true },
		slug: { type: String, required: true },
		qty: { type: Number, required: true },
		unitPrice: { type: Number, required: true },
		lineSubtotal: { type: Number, required: true },
		currency: { type: String, default: '' },
		/** Produk anak (bundle) */
		bundleComponentSnapshot: [
			{
				name: { type: String, default: '' },
				slug: { type: String, default: '' },
				qty: { type: Number, default: 0 },
			},
		],
		preOrderSnapshot: {
			wasPreOrder: { type: Boolean, default: false },
			estimatedReadyAt: { type: Date, default: null },
		},
	},
	{ _id: false },
);

const storeOrderSchema = new mongoose.Schema(
	{
		orderNo: { type: String, required: true, unique: true },
		/** Token acak untuk buka invoice tanpa cookie sesi (mis. dari WA) */
		invoiceAccessToken: { type: String, default: '' },
		guestSessionKeyHash: { type: String, default: '' },
		items: { type: [storeOrderItemSchema], required: true },
		subtotal: { type: Number, required: true },
		taxPercent: { type: Number, default: 0 },
		taxAmount: { type: Number, default: 0 },
		shippingCost: { type: Number, default: 0 },
		shippingCourierCode: { type: String, default: '' },
		shippingServiceLabel: { type: String, default: '' },
		shippingEtd: { type: String, default: '' },
		destinationVillageCode: { type: String, default: '' },
		/** Total: subtotal + tax + shipping */
		total: { type: Number, required: true },
		fulfillment: { type: String, enum: ['pickup', 'delivery'], required: true },
		customerName: { type: String, required: true },
		customerPhone: { type: String, required: true },
		shippingAddress: { type: String, default: '' },
		storeAddressSnapshot: { type: String, default: '' },
		whatsappPhoneUsed: { type: String, default: '' },
		whatsappMessageSnapshot: { type: String, default: '' },
		/** Konsumsi campaign one-time (order-level idempotency) */
		appliedCampaignIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StoreDiscountCampaign' }],
		status: {
			type: String,
			enum: ['pending', 'confirmed', 'paid', 'completed', 'cancelled'],
			default: 'pending',
		},
	},
	{ timestamps: true },
);
storeOrderSchema.index({ createdAt: -1 });
storeOrderSchema.index({ guestSessionKeyHash: 1, createdAt: -1 });

// Community Schema - registry of all communities (stored in main DB only)
const communitySchema = new mongoose.Schema({
	name: { type: String, required: true },
	slug: { type: String, required: true, unique: true },
	dbName: { type: String, required: true, unique: true },
	description: { type: String, default: '' },
	logoUrl: { type: String, default: '' },
	ownerUsername: { type: String, default: '' },
	ownerEmail: { type: String, default: '' },
	registrationCodeId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'RegistrationCode',
		default: null,
	},
	status: {
		type: String,
		enum: ['active', 'inactive', 'suspended'],
		default: 'active',
	},
	initialDivisionCount: { type: Number, default: 3, min: 1, max: 20 },
	socialLinks: {
		facebook: { type: String, default: '' },
		tiktok: { type: String, default: '' },
		instagram: { type: String, default: '' },
		youtube: { type: String, default: '' },
	},
	contactEmail: { type: String, default: '' },
	address: { type: String, default: '' },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

communitySchema.index({ slug: 1 });
communitySchema.index({ status: 1 });

// Registration Code Schema - invitation codes for creating communities
const registrationCodeSchema = new mongoose.Schema({
	code: { type: String, required: true, unique: true },
	type: { type: String, enum: ['community', 'alumni'], required: true },
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	createdByName: { type: String, default: '' },
	maxUses: { type: Number, default: 1 },
	currentUses: { type: Number, default: 0 },
	expiresAt: { type: Date, required: true },
	status: {
		type: String,
		enum: ['active', 'used', 'expired', 'revoked'],
		default: 'active',
	},
	usedBy: [
		{
			communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
			communityName: { type: String, default: '' },
			usedAt: { type: Date, default: Date.now },
			ownerEmail: { type: String, default: '' },
		},
	],
	note: { type: String, default: '' },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

registrationCodeSchema.index({ code: 1 });
registrationCodeSchema.index({ status: 1, expiresAt: 1 });

// Create models
const EventYear =
	mongoose.models.EventYear || mongoose.model('EventYear', eventYearSchema);
const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
const HomeImages =
	mongoose.models.HomeImages || mongoose.model('HomeImages', homeImagesSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Berita =
	mongoose.models.Berita || mongoose.model('Berita', beritaSchema, 'berita');
const Library =
	mongoose.models.Library || mongoose.model('Library', librarySchema);
const Organization =
	mongoose.models.Organization ||
	mongoose.model('Organization', organizationSchema);
const Settings =
	mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);
const Permission =
	mongoose.models.Permission || mongoose.model('Permission', permissionSchema);
const Session =
	mongoose.models.Session || mongoose.model('Session', sessionSchema);
const OtpChallenge =
	mongoose.models.OtpChallenge ||
	mongoose.model('OtpChallenge', otpChallengeSchema);
const PostSharing =
	mongoose.models.PostSharing ||
	mongoose.model('PostSharing', postSharingSchema);
const UserNotification =
	mongoose.models.UserNotification ||
	mongoose.model('UserNotification', userNotificationSchema);
const ProdiContent =
	mongoose.models.ProdiContent ||
	mongoose.model('ProdiContent', prodiContentSchema);
const Comment =
	mongoose.models.Comment || mongoose.model('Comment', commentSchema);
const Feedback =
	mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);

const StoreSettings =
	mongoose.models.StoreSettings ||
	mongoose.model('StoreSettings', storeSettingsSchema);
const StoreProductCategory =
	mongoose.models.StoreProductCategory ||
	mongoose.model('StoreProductCategory', storeProductCategorySchema);
const StoreProduct =
	mongoose.models.StoreProduct || mongoose.model('StoreProduct', storeProductSchema);
const StoreProductShare =
	mongoose.models.StoreProductShare ||
	mongoose.model('StoreProductShare', storeProductShareSchema);
const StoreDiscountCampaign =
	mongoose.models.StoreDiscountCampaign ||
	mongoose.model('StoreDiscountCampaign', storeDiscountCampaignSchema);
const StoreBundle =
	mongoose.models.StoreBundle || mongoose.model('StoreBundle', storeBundleSchema);
const GuestStoreSession =
	mongoose.models.GuestStoreSession ||
	mongoose.model('GuestStoreSession', guestStoreSessionSchema);
const StoreOrder =
	mongoose.models.StoreOrder || mongoose.model('StoreOrder', storeOrderSchema);

const BugReport =
	mongoose.models.BugReport || mongoose.model('BugReport', bugReportSchema);

const SystemError =
	mongoose.models.SystemError ||
	mongoose.model('SystemError', systemErrorSchema);

// Create Position model
export const Position =
	mongoose.models.Position || mongoose.model('Position', positionSchema);

// Create Division model
export const Division =
	mongoose.models.Division || mongoose.model('Division', divisionSchema);

const Community =
	mongoose.models.Community || mongoose.model('Community', communitySchema);
const RegistrationCode =
	mongoose.models.RegistrationCode ||
	mongoose.model('RegistrationCode', registrationCodeSchema);

// Activity schema (imported from models for allSchemas export)
const activitySchema = new mongoose.Schema(
	{
		type: {
			type: String,
			required: true,
			enum: [
				'berita',
				'library',
				'organization',
				'content',
				'settings',
				'user',
				'sharing',
			],
		},
		action: {
			type: String,
			required: true,
			enum: ['create', 'update', 'delete', 'publish', 'unpublish'],
		},
		title: { type: String, required: true },
		description: { type: String },
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		userName: { type: String, required: true },
		userRole: { type: String, required: true },
		entityId: { type: String },
		entityTitle: { type: String },
		metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
		timestamp: { type: Date, default: Date.now },
	},
	{ timestamps: true },
);
activitySchema.index({ timestamp: -1 });
activitySchema.index({ type: 1, timestamp: -1 });

// Temporary onboarding uploads — tracks files uploaded during registration (before login)
const tempUploadSchema = new mongoose.Schema(
	{
		code: { type: String, required: true, index: true },
		url: { type: String, required: true },
		diskPath: { type: String, required: true },
		category: { type: String, default: 'organization' },
		key: { type: String, default: '' },
		consumedAt: { type: Date, default: null },
		expiresAt: { type: Date, required: true },
	},
	{ timestamps: true },
);
tempUploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
tempUploadSchema.index({ code: 1, consumedAt: 1 });

const TempUpload =
	mongoose.models.TempUpload || mongoose.model('TempUpload', tempUploadSchema);

// Model FileUpload — tracks all uploaded files with antivirus scan status
const fileUploadSchema = new mongoose.Schema(
	{
		url: { type: String, required: true },
		quarantinePath: { type: String, default: '' },
		publicPath: { type: String, default: '' },
		originalName: { type: String, default: '' },
		mimeType: { type: String, default: '' },
		size: { type: Number, default: 0 },
		category: { type: String, default: 'general' },
		scanStatus: {
			type: String,
			enum: [
				'pending_scan',
				'scanning',
				'clean',
				'infected',
				'scan_failed',
				'skipped',
			],
			default: 'pending_scan',
		},
		scanEngine: { type: String, default: '' },
		scannedAt: { type: Date, default: null },
		threatName: { type: String, default: '' },
		uploadedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		tenantSlug: { type: String, default: '' },
	},
	{ timestamps: true },
);

fileUploadSchema.index({ scanStatus: 1, createdAt: 1 });
fileUploadSchema.index({ url: 1 }, { unique: true });

const FileUpload =
	mongoose.models.FileUpload || mongoose.model('FileUpload', fileUploadSchema);

// Model NotifPreference — per-user notification preferences per topic/channel
const notifPreferenceSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		news: {
			inApp: { type: Boolean, default: true },
			webPush: { type: Boolean, default: true },
			email: { type: Boolean, default: false },
		},
		event: {
			inApp: { type: Boolean, default: true },
			webPush: { type: Boolean, default: true },
			email: { type: Boolean, default: false },
		},
		commentReply: {
			inApp: { type: Boolean, default: true },
			webPush: { type: Boolean, default: true },
			email: { type: Boolean, default: false },
		},
		feedbackReply: {
			inApp: { type: Boolean, default: true },
			webPush: { type: Boolean, default: true },
			email: { type: Boolean, default: false },
		},
		bugReply: {
			inApp: { type: Boolean, default: true },
			webPush: { type: Boolean, default: true },
			email: { type: Boolean, default: true },
		},
	},
	{ timestamps: true },
);
notifPreferenceSchema.index({ userId: 1 }, { unique: true });

const NotifPreference =
	mongoose.models.NotifPreference ||
	mongoose.model('NotifPreference', notifPreferenceSchema);

// Model WebPushSubscription — browser push subscription per user
const webPushSubscriptionSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		guestKeyHash: { type: String, default: '' },
		endpoint: { type: String, required: true },
		keys: {
			p256dh: { type: String, required: true },
			auth: { type: String, required: true },
		},
		userAgent: { type: String, default: '' },
		tenantSlug: { type: String, default: '' },
		vapidPublicKey: { type: String, default: '' },
		isActive: { type: Boolean, default: true },
		lastSeenAt: { type: Date, default: Date.now },
		preferences: {
			news: { webPush: { type: Boolean, default: true } },
			event: { webPush: { type: Boolean, default: true } },
			commentReply: { webPush: { type: Boolean, default: true } },
			feedbackReply: { webPush: { type: Boolean, default: true } },
			// Untuk visitor anonim tidak ada alur bug-reply, default false.
			bugReply: { webPush: { type: Boolean, default: false } },
		},
	},
	{ timestamps: true },
);
webPushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });
webPushSubscriptionSchema.index({ userId: 1, isActive: 1 });
webPushSubscriptionSchema.index({ guestKeyHash: 1, isActive: 1 });

const WebPushSubscription =
	mongoose.models.WebPushSubscription ||
	mongoose.model('WebPushSubscription', webPushSubscriptionSchema);

// Export all schemas for tenant model factory
export const allSchemas = {
	user: userSchema,
	session: sessionSchema,
	role: roleSchema,
	permission: permissionSchema,
	berita: beritaSchema,
	library: librarySchema,
	organization: organizationSchema,
	settings: settingsSchema,
	position: positionSchema,
	division: divisionSchema,
	eventYear: eventYearSchema,
	event: eventSchema,
	homeImages: homeImagesSchema,
	otpChallenge: otpChallengeSchema,
	postSharing: postSharingSchema,
	userNotification: userNotificationSchema,
	comment: commentSchema,
	feedback: feedbackSchema,
	bugReport: bugReportSchema,
	prodiContent: prodiContentSchema,
	activity: activitySchema,
	storeSettings: storeSettingsSchema,
	storeProductCategory: storeProductCategorySchema,
	storeProduct: storeProductSchema,
	storeProductShare: storeProductShareSchema,
	storeDiscountCampaign: storeDiscountCampaignSchema,
	storeBundle: storeBundleSchema,
	guestStoreSession: guestStoreSessionSchema,
	storeOrder: storeOrderSchema,
};

export {
	Berita,
	BugReport,
	Comment,
	Community,
	Event,
	EventYear,
	Feedback,
	GuestStoreSession,
	FileUpload,
	HomeImages,
	Library,
	NotifPreference,
	Organization,
	OtpChallenge,
	Permission,
	PostSharing,
	ProdiContent,
	RegistrationCode,
	Role,
	Session,
	Settings,
	StoreOrder,
	StoreProduct,
	StoreProductCategory,
	StoreProductShare,
	StoreSettings,
	StoreDiscountCampaign,
	StoreBundle,
	SystemError,
	TempUpload,
	User,
	UserNotification,
	WebPushSubscription,
	connectDB,
};
