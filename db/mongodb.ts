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
		enum: ['owner', 'admin', 'chair', 'vice_chair', 'division_head'],
		default: 'division_head',
	},
	division: { type: String, default: '' },
	lastLogin: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
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
	logoUrl: { type: String, default: '/logo.png' },
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
		facebook: { type: String, default: 'https://www.facebook.com/himatif.encoder/' },
		tiktok: { type: String, default: 'https://www.tiktok.com/@himatif.encoder' },
		instagram: { type: String, default: 'https://www.instagram.com/himatif.encoder/' },
		youtube: {
			type: String,
			default: 'https://www.youtube.com/@himatifencoder',
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

// Create Position model
export const Position =
	mongoose.models.Position || mongoose.model('Position', positionSchema);

export { Article, connectDB, Library, Organization, Settings, User };

