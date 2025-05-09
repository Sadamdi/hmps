import { db } from "./index";
import * as schema from "@shared/schema";
import { hashPassword } from "../server/auth";

async function seed() {
  try {
    console.log("Starting database seeding...");

    // Create default users
    const hashedOwnerPassword = await hashPassword("owner123");
    const hashedAdminPassword = await hashPassword("admin123");
    const hashedChairPassword = await hashPassword("chair123");
    const hashedViceChairPassword = await hashPassword("vicechair123");
    
    // Check if users already exist
    const existingOwner = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, "owner")
    });

    if (!existingOwner) {
      console.log("Creating default users...");
      
      // Create owner account
      await db.insert(schema.users).values({
        username: "owner",
        password: hashedOwnerPassword,
        name: "System Owner",
        email: "owner@hmti-uinmalang.ac.id",
        role: "owner",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Create admin account
      await db.insert(schema.users).values({
        username: "admin",
        password: hashedAdminPassword,
        name: "System Admin",
        email: "admin@hmti-uinmalang.ac.id",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Create chair account
      await db.insert(schema.users).values({
        username: "chair",
        password: hashedChairPassword,
        name: "Ahmad Fauzan",
        email: "chair@hmti-uinmalang.ac.id",
        role: "chair",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Create vice chair account
      await db.insert(schema.users).values({
        username: "vicechair",
        password: hashedViceChairPassword,
        name: "Sarah Azzahra",
        email: "vicechair@hmti-uinmalang.ac.id",
        role: "vice_chair",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Create division head accounts
      const divisionHeads = [
        {
          username: "academic",
          password: await hashPassword("academic123"),
          name: "Reza Mahendra",
          email: "academic@hmti-uinmalang.ac.id",
          role: "division_head"
        },
        {
          username: "publicity",
          password: await hashPassword("publicity123"),
          name: "Dina Fitria",
          email: "publicity@hmti-uinmalang.ac.id",
          role: "division_head"
        },
        {
          username: "development",
          password: await hashPassword("development123"),
          name: "Iqbal Ramadhan",
          email: "development@hmti-uinmalang.ac.id",
          role: "division_head"
        },
        {
          username: "events",
          password: await hashPassword("events123"),
          name: "Maya Indah",
          email: "events@hmti-uinmalang.ac.id",
          role: "division_head"
        },
        {
          username: "media",
          password: await hashPassword("media123"),
          name: "Budi Santoso",
          email: "media@hmti-uinmalang.ac.id",
          role: "division_head"
        },
        {
          username: "finance",
          password: await hashPassword("finance123"),
          name: "Nadia Putri",
          email: "finance@hmti-uinmalang.ac.id",
          role: "division_head"
        }
      ];
      
      for (const divHead of divisionHeads) {
        await db.insert(schema.users).values({
          ...divHead,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      console.log("Default users created successfully");
    } else {
      console.log("Default users already exist, skipping creation");
    }

    // Check if organization structure exists
    const existingOrgStructure = await db.query.organization.findFirst();
    
    if (!existingOrgStructure) {
      console.log("Creating organization structure...");
      
      const organizationMembers = [
        {
          name: "Ahmad Fauzan",
          position: "Ketua Himpunan",
          period: "2023-2024",
          imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop"
        },
        {
          name: "Sarah Azzahra",
          position: "Wakil Ketua Himpunan",
          period: "2023-2024",
          imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop"
        },
        {
          name: "Reza Mahendra",
          position: "Ketua Divisi Akademik",
          period: "2023-2024",
          imageUrl: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&h=400&fit=crop"
        },
        {
          name: "Dina Fitria",
          position: "Ketua Divisi Humas",
          period: "2023-2024",
          imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop"
        },
        {
          name: "Iqbal Ramadhan",
          position: "Ketua Divisi Pengembangan",
          period: "2023-2024",
          imageUrl: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop"
        },
        {
          name: "Maya Indah",
          position: "Ketua Divisi Kegiatan",
          period: "2023-2024",
          imageUrl: "https://images.unsplash.com/photo-1590031905470-a1a1feacbb0b?w=400&h=400&fit=crop"
        },
        {
          name: "Budi Santoso",
          position: "Ketua Divisi Media",
          period: "2023-2024",
          imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop"
        },
        {
          name: "Nadia Putri",
          position: "Ketua Divisi Dana & Usaha",
          period: "2023-2024",
          imageUrl: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=400&h=400&fit=crop"
        }
      ];
      
      for (const member of organizationMembers) {
        await db.insert(schema.organization).values({
          ...member,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      console.log("Organization structure created successfully");
    } else {
      console.log("Organization structure already exists, skipping creation");
    }

    // Check if articles exist
    const existingArticle = await db.query.articles.findFirst();
    
    if (!existingArticle) {
      console.log("Creating sample articles...");
      
      // Get admin user for authorship
      const adminUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.username, "admin")
      });
      
      const chairUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.username, "chair")
      });
      
      const developmentUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.username, "development")
      });
      
      if (adminUser && chairUser && developmentUser) {
        const sampleArticles = [
          {
            title: "Workshop Machine Learning untuk Pemula",
            excerpt: "Divisi Akademik mengadakan workshop Machine Learning bagi mahasiswa yang ingin memulai karir di bidang AI.",
            content: `<h2>Workshop Machine Learning untuk Pemula</h2>
              <p>Divisi Akademik Himpunan Mahasiswa Teknik Informatika UIN Malang dengan bangga mempersembahkan Workshop Machine Learning untuk Pemula yang akan diadakan pada:</p>
              <ul>
                <li>Tanggal: 20 September 2023</li>
                <li>Waktu: 09.00 - 16.00 WIB</li>
                <li>Tempat: Laboratorium Komputer, Gedung Fakultas Sains dan Teknologi</li>
              </ul>
              <p>Workshop ini ditujukan bagi mahasiswa yang tertarik untuk mempelajari dasar-dasar machine learning dan penerapannya dalam dunia nyata. Peserta akan dibimbing langsung oleh praktisi industri yang berpengalaman dalam bidang AI dan machine learning.</p>
              <p>Materi yang akan dibahas meliputi:</p>
              <ol>
                <li>Pengenalan Konsep Dasar Machine Learning</li>
                <li>Persiapan Data dan Preprocessing</li>
                <li>Algoritma Supervised Learning</li>
                <li>Algoritma Unsupervised Learning</li>
                <li>Evaluasi Model dan Tuning</li>
                <li>Implementasi Model dalam Aplikasi Sederhana</li>
              </ol>
              <p>Kuota terbatas hanya untuk 30 peserta. Segera daftarkan diri Anda melalui link pendaftaran yang tersedia di bio Instagram @hmtiuinmalang.</p>
              <p>Jangan lewatkan kesempatan berharga ini untuk meningkatkan skill dan kompetensi Anda di bidang yang sedang berkembang pesat ini!</p>`,
            image: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&auto=format&fit=crop",
            published: true,
            authorId: adminUser.id,
            author: adminUser.name || adminUser.username,
            createdAt: new Date("2023-09-15T10:30:00"),
            updatedAt: new Date("2023-09-15T10:30:00")
          },
          {
            title: "Kunjungan Industri ke Google Indonesia",
            excerpt: "Himpunan Informatika mengadakan kunjungan industri ke kantor Google Indonesia di Jakarta.",
            content: `<h2>Kunjungan Industri ke Google Indonesia</h2>
              <p>Himpunan Mahasiswa Teknik Informatika UIN Malang dengan bangga mengumumkan kunjungan industri yang akan dilaksanakan ke kantor Google Indonesia di Jakarta pada tanggal 10 Oktober 2023.</p>
              <p>Kunjungan ini merupakan bagian dari program kerja HMTI untuk mendekatkan mahasiswa dengan dunia industri teknologi. Google Indonesia telah bersedia menerima kunjungan dari 25 mahasiswa teknik informatika UIN Malang untuk mengikuti berbagai kegiatan, termasuk:</p>
              <ul>
                <li>Tour kantor Google Indonesia</li>
                <li>Sesi sharing dengan engineer Google</li>
                <li>Workshop singkat tentang teknologi terkini yang dikembangkan Google</li>
                <li>Networking dengan professional di bidang teknologi</li>
              </ul>
              <p>Pendaftaran akan dibuka tanggal 15 September 2023 dengan syarat minimal IPK 3.00 dan aktif dalam kegiatan himpunan. Biaya keikutsertaan sebesar Rp 750.000 sudah termasuk transportasi dan akomodasi selama di Jakarta.</p>
              <p>Jangan lewatkan kesempatan langka ini untuk melihat langsung bagaimana perusahaan teknologi kelas dunia beroperasi dan membangun koneksi yang berharga untuk masa depan karier Anda.</p>
              <p>Untuk informasi lebih lanjut, silakan hubungi panitia kunjungan industri melalui WhatsApp atau kunjungi sekretariat HMTI.</p>`,
            image: "https://images.unsplash.com/photo-1617042375876-a13e36732a04?w=600&auto=format&fit=crop",
            published: true,
            authorId: chairUser.id,
            author: chairUser.name || chairUser.username,
            createdAt: new Date("2023-09-05T14:00:00"),
            updatedAt: new Date("2023-09-05T14:00:00")
          },
          {
            title: "Webinar: Karir di Bidang Cybersecurity",
            excerpt: "Divisi Pengembangan mengadakan webinar mengenai peluang karir di bidang keamanan siber.",
            content: `<h2>Webinar: Karir di Bidang Cybersecurity</h2>
              <p>Divisi Pengembangan HMTI UIN Malang dengan bangga mempersembahkan webinar bertema "Karir di Bidang Cybersecurity: Peluang dan Tantangan" yang akan dilaksanakan pada:</p>
              <ul>
                <li>Hari/Tanggal: Sabtu, 25 Agustus 2023</li>
                <li>Waktu: 19.00 - 21.00 WIB</li>
                <li>Platform: Zoom Meeting</li>
              </ul>
              <p>Webinar ini akan menghadirkan pembicara Bapak Ahmad Rizky, seorang Security Engineer di salah satu perusahaan fintech terkemuka di Indonesia. Beliau akan berbagi pengalaman dan wawasan mengenai:</p>
              <ol>
                <li>Prospek karir di bidang keamanan siber</li>
                <li>Keterampilan yang dibutuhkan untuk menjadi profesional cybersecurity</li>
                <li>Sertifikasi dan jalur pendidikan yang relevan</li>
                <li>Tips memasuki dunia kerja cybersecurity</li>
                <li>Tren dan perkembangan terkini di industri keamanan siber</li>
              </ol>
              <p>Webinar ini terbuka untuk seluruh mahasiswa UIN Malang dan masyarakat umum. Pendaftaran GRATIS namun terbatas hanya untuk 100 peserta.</p>
              <p>Setiap peserta akan mendapatkan:</p>
              <ul>
                <li>E-sertifikat kehadiran</li>
                <li>Materi presentasi</li>
                <li>Rekaman webinar</li>
              </ul>
              <p>Jangan lewatkan kesempatan untuk belajar dari praktisi berpengalaman dan memperluas wawasan Anda tentang dunia cybersecurity!</p>`,
            image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&auto=format&fit=crop",
            published: true,
            authorId: developmentUser.id,
            author: developmentUser.name || developmentUser.username,
            createdAt: new Date("2023-08-20T19:00:00"),
            updatedAt: new Date("2023-08-20T19:00:00")
          }
        ];
        
        for (const article of sampleArticles) {
          await db.insert(schema.articles).values(article);
        }
        
        console.log("Sample articles created successfully");
      }
    } else {
      console.log("Articles already exist, skipping creation");
    }

    // Check if library items exist
    const existingLibraryItem = await db.query.library.findFirst();
    
    if (!existingLibraryItem) {
      console.log("Creating sample library items...");
      
      // Get users for authorship
      const adminUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.username, "admin")
      });
      
      if (adminUser) {
        const sampleLibraryItems = [
          {
            title: "Dokumentasi Kemah IT 2023",
            description: "Kumpulan foto kegiatan Kemah IT yang diadakan di Batu pada 20-22 Juli 2023.",
            fullDescription: "Dokumentasi lengkap kegiatan Kemah IT 2023 yang diadakan di Batu pada tanggal 20-22 Juli 2023. Kegiatan ini diikuti oleh 80 mahasiswa Teknik Informatika angkatan 2022 dan 15 panitia dari angkatan 2021. Acara ini bertujuan untuk mempererat tali persaudaraan dan mengasah softskill di bidang IT.",
            images: [
              "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=600&auto=format&fit=crop"
            ],
            type: "photo",
            authorId: adminUser.id,
            createdAt: new Date("2023-07-25T15:20:00"),
            updatedAt: new Date("2023-07-25T15:20:00")
          },
          {
            title: "Workshop UI/UX Design",
            description: "Video workshop UI/UX Design bersama praktisi dari Tokopedia.",
            fullDescription: "Video lengkap workshop UI/UX Design yang diadakan secara daring pada 8 Agustus 2023. Workshop ini menghadirkan pembicara Bapak Irfan Maulana, Senior UI/UX Designer dari Tokopedia, yang membagikan pengalaman dan tips dalam mendesain antarmuka pengguna yang efektif dan menarik.",
            images: [
              "https://images.unsplash.com/photo-1551817958-d9d86fb29431?w=600&auto=format&fit=crop"
            ],
            type: "video",
            authorId: adminUser.id,
            createdAt: new Date("2023-08-10T09:15:00"),
            updatedAt: new Date("2023-08-10T09:15:00")
          },
          {
            title: "Lomba Coding Competition 2023",
            description: "Foto-foto keseruan Lomba Coding Competition tingkat universitas.",
            fullDescription: "Dokumentasi Lomba Coding Competition 2023 yang diselenggarakan oleh Himpunan Mahasiswa Teknik Informatika pada tanggal 3-4 September 2023. Lomba ini diikuti oleh 25 tim dari berbagai fakultas di UIN Malang, dengan total hadiah sebesar Rp 5.000.000. Tema lomba tahun ini adalah \"Teknologi untuk Kesejahteraan Masyarakat\".",
            images: [
              "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&auto=format&fit=crop",
              "https://images.unsplash.com/photo-1534665482403-a909d0d97c67?w=600&auto=format&fit=crop"
            ],
            type: "photo",
            authorId: adminUser.id,
            createdAt: new Date("2023-09-05T13:40:00"),
            updatedAt: new Date("2023-09-05T13:40:00")
          }
        ];
        
        for (const item of sampleLibraryItems) {
          await db.insert(schema.library).values(item);
        }
        
        console.log("Sample library items created successfully");
      }
    } else {
      console.log("Library items already exist, skipping creation");
    }

    // Check if settings exist
    const existingSettings = await db.query.settings.findFirst();
    
    if (!existingSettings) {
      console.log("Creating default settings...");
      
      const defaultSettings = {
        siteName: "HMTI UIN Malang",
        siteTagline: "Salam Satu Saudara Informatika",
        siteDescription: "Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang",
        aboutUs: `<h2>Tentang Himpunan Mahasiswa Teknik Informatika</h2>
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
        <p>Melalui berbagai kegiatan seperti seminar, workshop, kompetisi, dan kerja sama dengan industri, HMTI berupaya untuk mempersiapkan anggotanya agar siap menghadapi dunia kerja dan berkontribusi pada masyarakat.</p>`,
        visionMission: `<h2>Visi HMTI UIN Malang</h2>
        <p>Menjadi himpunan mahasiswa yang unggul, profesional, dan berkontribusi dalam pengembangan ilmu pengetahuan dan teknologi informatika yang berbasis pada nilai-nilai Islam.</p>
        
        <h2>Misi HMTI UIN Malang</h2>
        <ol>
          <li>Meningkatkan kualitas akademik dan profesionalisme anggota dalam bidang teknologi informatika</li>
          <li>Mengembangkan iklim penelitian dan inovasi di bidang informatika</li>
          <li>Membangun kerjasama dengan berbagai pihak untuk meningkatkan kompetensi anggota</li>
          <li>Menyelenggarakan kegiatan yang bermanfaat bagi pengembangan anggota dan masyarakat</li>
          <li>Menanamkan nilai-nilai Islam dalam setiap kegiatan himpunan</li>
        </ol>`,
        contactEmail: "hmti@uin-malang.ac.id",
        address: "Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang",
        enableRegistration: false,
        maintenanceMode: false,
        footerText: "© 2023 Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.",
        socialLinks: {
          facebook: "https://facebook.com/hmtiuinmalang",
          twitter: "https://twitter.com/hmtiuinmalang",
          instagram: "https://instagram.com/hmtiuinmalang",
          youtube: "https://youtube.com/channel/hmtiuinmalang"
        }
      };
      
      await db.insert(schema.settings).values(defaultSettings);
      
      console.log("Default settings created successfully");
    } else {
      console.log("Settings already exist, skipping creation");
    }

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
