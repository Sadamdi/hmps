import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

// Define Settings schema
const SettingsSchema = new mongoose.Schema({
  siteName: { type: String, required: true },
  siteTagline: { type: String, required: true },
  siteDescription: { type: String, required: true },
  aboutUs: { type: String, default: '' },
  visionMission: { type: String, default: '' },
  contactEmail: { type: String, required: true },
  address: { type: String, required: true },
  enableRegistration: { type: Boolean, default: false },
  maintenanceMode: { type: Boolean, default: false },
  footerText: { type: String, required: true },
  socialLinks: {
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' }
  }
});

const Settings = mongoose.model('Settings', SettingsSchema);

async function updateMongoSettings() {
  try {
    console.log('Connecting to MongoDB...');
    
    if (!MONGODB_URI) {
      console.error('MONGODB_URI is not defined. Exiting...');
      process.exit(1);
    }
    
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');
    
    console.log('Updating MongoDB settings...');
    
    // Get existing settings
    const existingSettings = await Settings.findOne();
    
    if (!existingSettings) {
      console.log('No settings found in MongoDB');
      process.exit(1);
    }
    
    // Update settings with new fields
    existingSettings.aboutUs = `<h2>Tentang Himpunan Mahasiswa Teknik Informatika</h2>
    <p>Himpunan Mahasiswa Teknik Informatika (HMTI) UIN Malang adalah organisasi mahasiswa yang berfokus pada pengembangan potensi akademik, minat, dan bakat mahasiswa Teknik Informatika. Didirikan pada tahun 2010, HMTI telah menjadi wadah bagi mahasiswa informatika untuk mengembangkan diri melalui berbagai kegiatan akademik dan non-akademik.</p>
    <p>HMTI memiliki berbagai divisi yang aktif mengadakan kegiatan sesuai dengan fokus masing-masing, termasuk:</p>
    <ul>
      <li>Divisi Akademik - Berfokus pada kegiatan pengembangan kemampuan akademik</li>
      <li>Divisi Humas - Menjalin kerjasama dengan berbagai pihak eksternal</li>
      <li>Divisi Pengembangan - Mengembangkan skill dan soft skill anggota</li>
      <li>Divisi Kegiatan - Mengkoordinasi berbagai acara dan kegiatan himpunan</li>
      <li>Divisi Media - Mengelola publikasi dan dokumentasi kegiatan</li>
      <li>Divisi Dana & Usaha - Mengelola pendanaan dan usaha himpunan</li>
    </ul>
    <p>Melalui berbagai kegiatan seperti seminar, workshop, kompetisi, dan kerja sama dengan industri, HMTI berupaya untuk mempersiapkan anggotanya agar siap menghadapi dunia kerja dan berkontribusi pada masyarakat.</p>`;
    
    existingSettings.visionMission = `<h2>Visi HMTI UIN Malang</h2>
    <p>Menjadi himpunan mahasiswa yang unggul, profesional, dan berkontribusi dalam pengembangan ilmu pengetahuan dan teknologi informatika yang berbasis pada nilai-nilai Islam.</p>
    
    <h2>Misi HMTI UIN Malang</h2>
    <ol>
      <li>Meningkatkan kualitas akademik dan profesionalisme anggota dalam bidang teknologi informatika</li>
      <li>Mengembangkan iklim penelitian dan inovasi di bidang informatika</li>
      <li>Membangun kerjasama dengan berbagai pihak untuk meningkatkan kompetensi anggota</li>
      <li>Menyelenggarakan kegiatan yang bermanfaat bagi pengembangan anggota dan masyarakat</li>
      <li>Menanamkan nilai-nilai Islam dalam setiap kegiatan himpunan</li>
    </ol>`;
    
    await existingSettings.save();
    
    console.log('MongoDB settings updated successfully');
    
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('MongoDB connection closed');
    
  } catch (error) {
    console.error('Error updating MongoDB settings:', error);
  }
}

updateMongoSettings();