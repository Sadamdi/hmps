# HMPS Project

Project ini adalah aplikasi web fullstack yang dibangun untuk Himpunan Mahasiswa Program Studi (HMPS) Teknik Informatika UIN Malang Periode 2025-2026. Aplikasi ini merupakan platform informasi resmi HIMATIF ENCODER yang menyediakan berbagai informasi seputar kegiatan, prestasi, dan perkembangan Program Studi Teknik Informatika UIN Malang. Melalui platform ini, kami berupaya untuk memberikan akses informasi yang transparan dan terupdate kepada seluruh mahasiswa Teknik Informatika UIN Malang serta masyarakat umum yang ingin mengetahui lebih lanjut tentang Program Studi Teknik Informatika UIN Malang.

## 🎯 Fitur Utama

### 1. Sistem Autentikasi & Autorisasi
- Login multi-role (Admin, Pengurus, Anggota)
- Manajemen profil pengguna
- Sistem reset password
- JWT-based authentication
- Role-based access control

### 2. Dashboard Admin
- Statistik dan analitik kegiatan
- Manajemen pengguna
- Monitoring aktivitas sistem
- Pengaturan sistem
- Log aktivitas

### 3. Manajemen Keanggotaan
- Pendaftaran anggota baru
- Verifikasi keanggotaan
- Riwayat keanggotaan
- Status keanggotaan

### 4. Manajemen Kegiatan
- Pembuatan dan pengelolaan kegiatan
- Pendaftaran peserta
- Galeri foto kegiatan
- Laporan kegiatan

### 5. Sistem Informasi
- Pengumuman
- Berita kegiatan
- Dokumentasi
- Arsip digital
- Kalender kegiatan

### 6. Fitur Tambahan
- Pencarian global
- Backup otomatis
- API documentation
- Responsive design

## 🏗️ Arsitektur Sistem

### Frontend
- React 18 dengan TypeScript
- State management dengan React Query
- Routing dengan Wouter
- UI Components dari Radix UI
- Styling dengan Tailwind CSS
- Form handling dengan React Hook Form
- Validasi dengan Zod
- Real-time updates dengan WebSocket

### Backend
- Express.js dengan TypeScript
- Database MongoDB dengan Drizzle ORM
- JWT untuk autentikasi
- WebSocket untuk real-time features
- File upload dengan Multer
- Rate limiting dan security middleware
- API documentation dengan Swagger

### Database
- MongoDB sebagai database utama
- Schema validation
- Indexing untuk performa
- Backup otomatis
- Data encryption

### Infrastruktur
- Vite untuk development
- ESBuild untuk production
- Environment-based configuration
- Logging system
- Error handling
- Performance monitoring

## 📁 Struktur Project

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── utils/        # Utility functions
│   │   ├── types/        # TypeScript types
│   │   ├── api/          # API integration
│   │   ├── store/        # State management
│   │   └── assets/       # Static assets
│   └── index.html        # Entry HTML file
├── server/                # Backend Express application
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Custom middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── config/          # Configuration files
├── db/                   # Database related files
│   ├── migrations/      # Database migrations
│   ├── seeds/          # Seed data
│   └── schema/         # Database schema
├── shared/              # Shared code between frontend and backend
│   ├── types/          # Shared TypeScript types
│   └── constants/      # Shared constants
├── public/             # Public static files
└── attached_assets/    # User uploaded files
```

## 🔧 Scripts yang Tersedia

- `npm run dev` - Menjalankan server development
- `npm run build` - Build aplikasi untuk production
- `npm start` - Menjalankan aplikasi production
- `npm run check` - Type checking
- `npm run db:push` - Menjalankan migrasi database
- `npm run db:seed` - Menjalankan seeder database

## 🔐 Fitur Keamanan

- JWT Authentication dengan refresh token
- Password Hashing dengan bcrypt
- CORS Protection
- Rate Limiting
- Input Validation dengan Zod
- XSS Protection
- CSRF Protection
- SQL Injection Prevention
- File Upload Validation
- Secure Headers
- Audit Logging

## 🎨 UI Components

Project ini menggunakan komponen dari Radix UI yang telah di-styling dengan Tailwind CSS, termasuk:
- Accordion
- Alert Dialog
- Avatar
- Dialog
- Dropdown Menu
- Navigation Menu
- Toast Notifications
- Data Tables
- Forms
- Modals
- Cards
- Charts
- Calendar
- File Upload
- Rich Text Editor

## 📝 Lisensi

MIT License

## 🤝 Kontribusi

1. Fork repository
2. Buat branch fitur (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 👥 Kontributor

### Owner & Lead Developer
- [Sulthan Adam Rahmadi](https://github.com/Sadamdi)
  - Owner & Project Manager
  - Backend Developer
  - Frontend Developer
  - Database Architect
  - System Security Engineer
  - API Designer
  - DevOps Engineer

### Developer
- [Muhammad Alif Mujaddid](https://github.com/addid-cloud)
  - Admin System Developer
  - Frontend Developer
  - Backend Developer
  - UI/UX Designer
  - Content Manager
  - Quality Assurance Engineer 