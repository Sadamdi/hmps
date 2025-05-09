import mongoose from 'mongoose';

// Variabel untuk mengontrol mode database
export let useMongoDB = true;

// Konek ke MongoDB
const connectDB = async () => {
  try {
    // Jika DISABLE_MONGODB=true, langsung biarkan fallback ke PostgreSQL
    if (process.env.DISABLE_MONGODB === 'true') {
      console.log('MongoDB disabled by configuration. Using PostgreSQL instead.');
      useMongoDB = false;
      return false;
    }
    
    // Untuk produksi, gunakan MongoDB Atlas
    // Contoh URI: mongodb+srv://username:password@cluster.mongodb.net/hmti_informatika
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hmti_informatika';
    
    console.log('Connecting to MongoDB...');
    
    // Tambahkan opsi untuk mencegah timeout koneksi
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 detik
      connectTimeoutMS: 10000, // 10 detik
    });
    
    console.log('MongoDB connected successfully');
    useMongoDB = true;
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
    
    Tambahkan MONGODB_URI ke file .env Anda atau DISABLE_MONGODB=true untuk menggunakan PostgreSQL.
    `);
    
    // Set mode database ke PostgreSQL
    console.log('Menggunakan PostgreSQL sebagai fallback');
    useMongoDB = false;
    return false;
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
    default: 'division_head' 
  },
  division: { type: String, default: '' },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Model Article
const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  excerpt: { type: String, required: true },
  content: { type: String, required: true },
  image: { type: String, required: true },
  published: { type: Boolean, default: false },
  authorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  author: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

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
    required: true 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Model Organization
const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  position: { type: String, required: true },
  period: { type: String, required: true },
  imageUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Model Settings
const settingsSchema = new mongoose.Schema({
  siteName: { type: String, default: 'HMTI UIN Malang' },
  siteTagline: { type: String, default: 'Salam Satu Saudara Informatika' },
  siteDescription: { type: String, default: 'Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang' },
  aboutUs: { type: String, default: '' },
  visionMission: { type: String, default: '' },
  contactEmail: { type: String, default: 'hmti@uin-malang.ac.id' },
  address: { type: String, default: 'Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang' },
  enableRegistration: { type: Boolean, default: false },
  maintenanceMode: { type: Boolean, default: false },
  footerText: { type: String, default: '© 2023 Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.' },
  logoUrl: { type: String, default: '/logo.png' },
  divisionLogos: {
    akademik: { type: String, default: '/uploads/logo-akademik.png' },
    humas: { type: String, default: '/uploads/logo-humas.png' },
    pengembangan: { type: String, default: '/uploads/logo-pengembangan.png' },
    media: { type: String, default: '/uploads/logo-media.png' },
    keuangan: { type: String, default: '/uploads/logo-keuangan.png' },
    acara: { type: String, default: '/uploads/logo-acara.png' }
  },
  divisionColors: {
    akademik: { type: String, default: 'rgba(233, 30, 99, 0.75)' },
    humas: { type: String, default: 'rgba(156, 39, 176, 0.75)' },
    pengembangan: { type: String, default: 'rgba(103, 58, 183, 0.75)' },
    leadership: { type: String, default: 'rgba(33, 150, 243, 0.75)' },
    media: { type: String, default: 'rgba(0, 188, 212, 0.75)' },
    keuangan: { type: String, default: 'rgba(76, 175, 80, 0.75)' },
    acara: { type: String, default: 'rgba(255, 152, 0, 0.75)' }
  },
  socialLinks: {
    facebook: { type: String, default: 'https://facebook.com/hmtiuinmalang' },
    twitter: { type: String, default: 'https://twitter.com/hmtiuinmalang' },
    instagram: { type: String, default: 'https://instagram.com/hmtiuinmalang' },
    youtube: { type: String, default: 'https://youtube.com/channel/hmtiuinmalang' }
  }
});

// Create models
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Article = mongoose.models.Article || mongoose.model('Article', articleSchema);
const Library = mongoose.models.Library || mongoose.model('Library', librarySchema);
const Organization = mongoose.models.Organization || mongoose.model('Organization', organizationSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

export {
  connectDB,
  User,
  Article,
  Library,
  Organization,
  Settings
};