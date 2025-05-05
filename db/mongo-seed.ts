import { connectDB, User, Article, Library, Organization, Settings } from './mongodb';
import { hashPassword } from '../server/auth';

async function seedDatabase() {
  console.log('Starting to seed the database...');
  
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Check if we already have users to avoid duplicating data
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('Database already has data. Skipping seed process.');
      return;
    }
    
    // Seed users
    const defaultPassword = await hashPassword('owner123');
    const divisionHeadPassword = await hashPassword('division123');
    
    // Create users
    const owner = await User.create({
      username: 'owner',
      password: defaultPassword,
      name: 'System Owner',
      email: 'owner@example.com',
      role: 'owner'
    });
    
    const admin = await User.create({
      username: 'admin',
      password: await hashPassword('admin123'),
      name: 'Administrator',
      email: 'admin@example.com',
      role: 'admin'
    });
    
    const chair = await User.create({
      username: 'chair',
      password: await hashPassword('chair123'),
      name: 'Chairperson',
      email: 'chair@example.com',
      role: 'chair'
    });
    
    const viceChair = await User.create({
      username: 'vicechair',
      password: await hashPassword('vicechair123'),
      name: 'Vice Chairperson',
      email: 'vicechair@example.com',
      role: 'vice_chair'
    });
    
    // Create division heads
    const divisions = [
      'academic',
      'publicity',
      'development',
      'events',
      'media',
      'finance'
    ];
    
    const divisionHeads = await Promise.all(
      divisions.map(division => 
        User.create({
          username: division,
          password: divisionHeadPassword,
          name: `${division.charAt(0).toUpperCase() + division.slice(1)} Division Head`,
          email: `${division}@example.com`,
          role: 'division_head',
          division: division
        })
      )
    );
    
    console.log('Users created');
    
    // Create sample article
    await Article.create({
      title: 'Workshop Machine Learning untuk Pemula',
      excerpt: 'Acara workshop pengenalan machine learning untuk mahasiswa informatika',
      content: `
        <h2>Workshop Machine Learning untuk Pemula</h2>
        <p>Himpunan Mahasiswa Teknik Informatika UIN Malang dengan bangga mempersembahkan workshop pengenalan machine learning.</p>
        <p>Workshop ini akan membahas:</p>
        <ul>
          <li>Dasar-dasar Machine Learning</li>
          <li>Supervised vs Unsupervised Learning</li>
          <li>Praktik langsung dengan Python dan scikit-learn</li>
        </ul>
        <p>Acara ini terbuka untuk seluruh mahasiswa jurusan Teknik Informatika dari semua semester.</p>
        <p>Pendaftaran dibuka sampai tanggal 30 Oktober 2023. Hubungi panitia untuk informasi lebih lanjut.</p>
      `,
      image: '/uploads/machine-learning-workshop.jpg',
      published: true,
      authorId: chair._id,
      author: chair.name,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('Sample article created');
    
    // Create sample library items
    await Library.create({
      title: 'Lomba Coding Competition 2023',
      description: 'Dokumentasi kegiatan lomba coding competition yang diselenggarakan oleh HMTI',
      fullDescription: 'Pada tahun 2023, HMTI UIN Malang menyelenggarakan lomba coding competition yang diikuti oleh berbagai universitas di Malang. Acara ini bertujuan untuk meningkatkan kemampuan programming mahasiswa dan mempererat silaturahmi antar mahasiswa informatika.',
      images: [
        '/uploads/coding-competition-1.jpg',
        '/uploads/coding-competition-2.jpg',
        '/uploads/coding-competition-3.jpg'
      ],
      type: 'photo',
      authorId: divisionHeads[0]._id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('Sample library item created');
    
    // Create organization structure
    const positions = [
      { name: 'Reza Mahendra', position: 'Ketua Himpunan', imageUrl: '/uploads/ketua.jpg' },
      { name: 'Anisa Putri', position: 'Wakil Ketua', imageUrl: '/uploads/wakil-ketua.jpg' },
      { name: 'Budi Santoso', position: 'Kepala Divisi Akademik', imageUrl: '/uploads/akademik.jpg' },
      { name: 'Dina Rahmawati', position: 'Kepala Divisi Humas', imageUrl: '/uploads/humas.jpg' },
      { name: 'Eko Prasetyo', position: 'Kepala Divisi Pengembangan', imageUrl: '/uploads/pengembangan.jpg' },
      { name: 'Fita Anggraini', position: 'Kepala Divisi Acara', imageUrl: '/uploads/acara.jpg' },
      { name: 'Galih Ramadhan', position: 'Kepala Divisi Media', imageUrl: '/uploads/media.jpg' },
      { name: 'Hana Nur', position: 'Kepala Divisi Keuangan', imageUrl: '/uploads/keuangan.jpg' }
    ];
    
    await Promise.all(
      positions.map(member => 
        Organization.create({
          ...member,
          period: '2023-2024',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      )
    );
    
    console.log('Organization structure created');
    
    // Create default settings
    await Settings.create({
      siteName: 'HMTI UIN Malang',
      siteTagline: 'Salam Satu Saudara Informatika',
      siteDescription: 'Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang',
      contactEmail: 'hmti@uin-malang.ac.id',
      address: 'Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang',
      enableRegistration: false,
      maintenanceMode: false,
      footerText: '© 2023 Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.',
      socialLinks: {
        facebook: 'https://facebook.com/hmtiuinmalang',
        twitter: 'https://twitter.com/hmtiuinmalang',
        instagram: 'https://instagram.com/hmtiuinmalang',
        youtube: 'https://youtube.com/channel/hmtiuinmalang'
      }
    });
    
    console.log('Default settings created');
    
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run seed 
seedDatabase().then(() => {
  console.log('Seed script complete');
  process.exit(0);
}).catch(err => {
  console.error('Seed script failed:', err);
  process.exit(1);
});

export default seedDatabase;