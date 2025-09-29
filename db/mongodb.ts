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

		console.log('Connecting to MongoDB...');

		// Tambahkan opsi untuk mencegah timeout koneksi
		await mongoose.connect(MONGODB_URI, {
			serverSelectionTimeoutMS: 5000, // 5 detik
			connectTimeoutMS: 10000, // 10 detik
		});

		console.log('Connected to MongoDB');
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
	role: {
		type: String,
		enum: ['owner', 'admin', 'chair', 'vice_chair', 'bph', 'division_head'],
		default: 'division_head',
	},
	division: { type: String, default: '' },
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
	category: { type: String, required: true }, // 'dashboard', 'articles', 'users', etc.
	isActive: { type: Boolean, default: true },
	createdAt: { type: Date, default: Date.now },
});

// Model Article
const articleSchema = new mongoose.Schema({
	title: { type: String, required: true },
	slug: { type: String, required: true, unique: true }, // SEO-friendly URL
	excerpt: { type: String, required: true },
	content: { type: String, required: true },
	image: { type: String, required: true },
	imageSource: { type: String, default: 'local' },
	gdriveFileId: { type: String, default: '' },
	tags: [{ type: String }], // Array of tags
	published: { type: Boolean, default: false },
	authorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	author: { type: String, required: true },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

// Index untuk slug
articleSchema.index({ slug: 1 });

// Model Library
const librarySchema = new mongoose.Schema({
	title: { type: String, required: true },
	description: { type: String, required: true },
	fullDescription: { type: String, required: true },
	images: [{ type: String }],
	type: { type: String, enum: ['photo', 'video'], default: 'photo' },
	authorId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

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

// Division Schema - untuk mengelola divisions dan posisi di dalamnya
const divisionSchema = new mongoose.Schema({
	name: { type: String, required: true, unique: true },
	displayName: { type: String, required: true },
	description: { type: String, default: '' },
	positions: [{ type: String }], // Array of position names in this division
	color: { type: String, default: '#3B82F6' },
	logo: { type: String, default: '' },
	isActive: { type: Boolean, default: true },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

// Create models
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Article =
	mongoose.models.Article || mongoose.model('Article', articleSchema);
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

// Create Position model
export const Position =
	mongoose.models.Position || mongoose.model('Position', positionSchema);

// Create Division model
export const Division =
	mongoose.models.Division || mongoose.model('Division', divisionSchema);

export {
	Article,
	Library,
	Organization,
	Permission,
	Role,
	Session,
	Settings,
	User,
	connectDB,
};
