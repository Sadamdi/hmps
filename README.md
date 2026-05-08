# ðŸŽ“ HMPS Project - HIMATIF ENCODER

<div align="center">

![HMPS Logo](attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp)

**Platform Informasi Resmi Himpunan Mahasiswa Teknik Informatika UIN Malang**
*Periode 2025-2026*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

## ðŸ“– Tentang Project

Project ini adalah **aplikasi web fullstack** yang dibangun untuk Himpunan Mahasiswa Program Studi (HMPS) Teknik Informatika UIN Malang. Aplikasi ini merupakan platform informasi resmi **HIMATIF ENCODER** yang menyediakan berbagai informasi seputar kegiatan, prestasi, dan perkembangan Program Studi Teknik Informatika UIN Malang.

Melalui platform ini, kami berupaya untuk memberikan akses informasi yang **transparan dan terupdate** kepada seluruh mahasiswa Teknik Informatika UIN Malang serta masyarakat umum yang ingin mengetahui lebih lanjut tentang Program Studi Teknik Informatika UIN Malang.

---

## âœ¨ Fitur Unggulan

<table>
<tr>
<td width="50%">

### ðŸ” **Sistem Autentikasi & Autorisasi**
- ðŸ‘¤ Login multi-role
- ðŸ›¡ï¸ Manajemen profil pengguna lengkap
- ðŸ”‘ Sistem reset password terintegrasi
- ðŸŽ« JWT-based authentication token dengan session tracking & revocation
- ðŸš§ Role-based access control yang ketat

### ðŸ“Š **Dashboard Admin Real-time**
- ðŸ“ˆ Statistik dan analitik kegiatan live
- ðŸ‘¥ Manajemen pengguna advanced
- ðŸ” Monitoring aktivitas sistem real-time
- âš™ï¸ Pengaturan sistem yang fleksibel
- ðŸ“ Log aktivitas terperinci dengan timeline

### ðŸ‘¨â€ðŸŽ“ **Manajemen Organisasi**
- âž• Pengelolaan struktur organisasi
- âœ… Sistem verifikasi anggota
- ðŸ“š Riwayat keanggotaan lengkap
- ðŸ·ï¸ Status dan badge keanggotaan

</td>
<td width="50%">

### ðŸ“° **Sistem Konten & Media**
- ðŸ“ Editor berita dengan TinyMCE WYSIWYG
- ðŸ“¸ Upload dan manajemen media library
- ðŸ” Pencarian konten yang powerful
- ðŸ—ƒï¸ Arsip digital terorganisir

### ðŸŽ¨ **User Experience Modern**
- ðŸ“± Responsive design untuk semua device
- âš¡ Loading yang cepat dengan caching
- ðŸ”” Notifikasi real-time
- ðŸŽ¯ Navigation yang intuitif

### ðŸ”§ **Fitur Developer**
- ðŸ“š API documentation lengkap
- ðŸ› ï¸ Backup otomatis
- ðŸ“Š Performance monitoring
- ðŸ”’ Security middleware comprehensive
- ðŸ¤– Integrasi AI Chat (Gemini + tool-calling berbasis permission)

</td>
</tr>
</table>

---

## ðŸ—ï¸ Arsitektur Teknologi

### ðŸŽ¨ **Frontend Stack**
```javascript
// Modern React dengan TypeScript
â”œâ”€â”€ React 18 + TypeScript
â”œâ”€â”€ React Query (TanStack Query) - State Management
â”œâ”€â”€ Wouter - Lightweight Routing
â”œâ”€â”€ Radix UI - Accessible Components
â”œâ”€â”€ Tailwind CSS - Utility-first CSS
â”œâ”€â”€ React Hook Form - Form Handling
â”œâ”€â”€ Zod - Schema Validation
â”œâ”€â”€ Lucide React - Beautiful Icons
â””â”€â”€ Vite - Ultra Fast Build Tool
```

### âš™ï¸ **Backend Stack**
```javascript
// Robust Express.js Backend
â”œâ”€â”€ Express.js + TypeScript
â”œâ”€â”€ MongoDB + Mongoose (ODM) - Primary Database
â”œâ”€â”€ JWT (cookie) + session tracking (`sid`) - Authentication & Authorization
â”œâ”€â”€ Multer - File Upload Handling
â”œâ”€â”€ bcryptjs - Password Hashing
â”œâ”€â”€ Nodemailer + OTP - Forgot/Reset Password Flow
â”œâ”€â”€ Helmet/HPP + anti-spoofing + anti-injection - Security Middleware
â”œâ”€â”€ Multi-tenant resolver (`/api/c/:slug/*`) + tenant storage
â”œâ”€â”€ Rate Limiting - API Protection
â”œâ”€â”€ Google Drive integration (api/gdrive) - Media sources
â””â”€â”€ ESBuild - Fast Production Build
```

### ðŸ—„ï¸ **Database & Infrastructure**
```javascript
// Scalable Database Design
â”œâ”€â”€ MongoDB - Document Database
â”œâ”€â”€ Mongoose Schemas - Struktur & validasi data
â”œâ”€â”€ Indexes untuk query (contoh: `slug`)
â”œâ”€â”€ Snapshot backup bulanan (cluster backup)
â”œâ”€â”€ Rollback/Restore via OTP (backup restore)
â”œâ”€â”€ Scheduled job (cron) untuk sync & maintenance
â””â”€â”€ Isolated tenant databases untuk komunitas
```

---

## ðŸ“ Struktur Project

```
ðŸ“¦ HMPS Project
â”œâ”€â”€ ðŸŽ¨ client/                     # Frontend React Application
â”‚   â”œâ”€â”€ ðŸ“‚ src/
â”‚   â”‚   â”œâ”€â”€ ðŸ§© components/        # Reusable UI Components
â”‚   â”‚   â”‚   â”œâ”€â”€ ðŸŽ›ï¸ dashboard/    # Dashboard Components
â”‚   â”‚   â”‚   â”œâ”€â”€ ðŸŒ public/       # Public Site Components
â”‚   â”‚   â”‚   â””â”€â”€ ðŸŽ¨ ui/           # Base UI Components (Radix)
â”‚   â”‚   â”œâ”€â”€ ðŸ“„ pages/            # Page Components & Routes
â”‚   â”‚   â”œâ”€â”€ ðŸª hooks/            # Custom React Hooks
â”‚   â”‚   â”œâ”€â”€ ðŸ› ï¸ lib/             # Utility Libraries
â”‚   â”‚   â”œâ”€â”€ ðŸŽ¯ utils/            # Helper Functions
â”‚   â”‚   â””â”€â”€ ðŸ“Š main.tsx          # App Entry Point
â”œâ”€â”€ âš™ï¸ server/                    # Backend Express Application
â”‚   â”œâ”€â”€ âš¡ index.ts              # Server Entry Point
â”‚   â”œâ”€â”€ ðŸŽ® routes.ts             # API Routes Definition
â”‚   â”œâ”€â”€ ðŸ” auth.ts               # Authentication + session logic
â”‚   â”œâ”€â”€ ðŸ›¡ï¸ security.ts          # Helmet/HPP + validation + sanitization
â”‚   â”œâ”€â”€ ðŸ§  mongo-storage.ts      # Data access layer (storage)
â”‚   â”œâ”€â”€ ðŸ§‘â€ðŸ’» services/          # Business logic (backup, OTP, sync, chat, etc.)
â”‚   â”œâ”€â”€ ðŸ› ï¸ middleware/          # Custom security middleware
â”‚   â”œâ”€â”€ ðŸŒ routes/              # Modular routes (chat/comments/feedback/sharing)
â”‚   â”œâ”€â”€ ðŸ§¾ upload.ts            # Upload handlers + image processing
â”‚   â”œâ”€â”€ ðŸ“¦ models/             # Mongo-related models/schemas
â”‚   â””â”€â”€ âš™ï¸ config/             # External service configs (Gemini keys)
â”œâ”€â”€ ðŸ—„ï¸ db/                       # Database & seeding
â”‚   â”œâ”€â”€ ðŸ”— mongodb.ts            # Mongoose connection + schema models
â”‚   â”œâ”€â”€ ðŸ§¾ mongodb-backup.ts    # Backup cluster client (snapshot job)
â”‚   â””â”€â”€ ðŸŒ± mongo-seed.ts        # Seed script (contoh: akun default)
â”œâ”€â”€ ðŸ¤ shared/                   # Shared Code (Frontend + Backend)
â”‚   â”œâ”€â”€ ðŸ“ schema.ts             # Shared Type Definitions
â”‚   â”œâ”€â”€ ðŸ› ï¸ utils.ts             # Shared Utilities
â”‚   â””â”€â”€ ðŸ“Ž mediaUtils.ts        # Shared media helpers
â”œâ”€â”€ ðŸŒ public/                   # Static assets (SEO files, favicon, etc.)
â”œâ”€â”€ ðŸ“ attached_assets/          # Asset yang dipakai di frontend
â”œâ”€â”€ ðŸ“¦ uploads/                  # Upload hasil proses (image/video)
â”œâ”€â”€ ðŸ§  db/tenant.ts              # Layer schema & koneksi multi-tenant
â””â”€â”€ ðŸŒ nginx-himatif-encoder.conf # Reverse proxy & hardening production
```

---

---

## Documentation Navigation

Dokumentasi HMPS sekarang dipisahkan berdasarkan fungsi agar developer tidak perlu menebak lokasi aturan, fitur, atau kontrak API.

| Kebutuhan | Baca Dokumen | Kapan Dipakai |
|----------|--------------|---------------|
| Mulai coding / planning | [`AGENTS.md`](./AGENTS.md) | Aturan wajib agent/dev, skills lokal, SOP wajib baca, dan larangan project |
| Alur development | [`docs/SOP/01-development-workflow.md`](./docs/SOP/01-development-workflow.md) | Sebelum membuat fitur, refactor, endpoint, atau docs baru |
| Standar kode | [`docs/SOP/02-code-standards.md`](./docs/SOP/02-code-standards.md) | Naming, TypeScript style, frontend/backend conventions |
| API design | [`docs/SOP/06-api-design.md`](./docs/SOP/06-api-design.md) | Saat membuat/mengubah endpoint Express |
| Error handling | [`docs/SOP/08-error-handling.md`](./docs/SOP/08-error-handling.md) | Saat menangani async error, validation error, auth error, atau service error |`n| Frontend architecture | [`docs/SOP/09-frontend-architecture.md`](./docs/SOP/09-frontend-architecture.md) | Saat mengubah React pages, components, hooks, tenant UI, atau client utils |`n| Backend service/storage | [`docs/SOP/10-backend-service-storage.md`](./docs/SOP/10-backend-service-storage.md) | Saat mengubah Express routes, services, storage, models, atau runtime helpers |`n| Documentation maintenance | [`docs/SOP/11-documentation-maintenance.md`](./docs/SOP/11-documentation-maintenance.md) | Saat update docs/features/API/OpenAPI/README/skills |`n| Runtime security/ops | [`docs/SOP/12-runtime-security-operations.md`](./docs/SOP/12-runtime-security-operations.md) | Saat mengubah middleware, scheduler, cache, backup, web push, Swagger, runtime config |`n| Arsitektur aplikasi | [`docs/architecture/application-architecture.md`](./docs/architecture/application-architecture.md) | Memahami struktur React + Express + MongoDB + tenant |
| Struktur project | [`docs/architecture/project-structure.md`](./docs/architecture/project-structure.md) | Menentukan file/folder yang tepat untuk perubahan |
| Multi-tenant | [`docs/architecture/multi-tenant.md`](./docs/architecture/multi-tenant.md) | Semua fitur yang berjalan di `/api/c/:slug/*` atau community shell |
| Dependency graph | [`docs/architecture/dependency-graph.md`](./docs/architecture/dependency-graph.md) | Impact analysis dan penggunaan code-review graph |
| Peta seluruh fitur | [`docs/features/feature-summary.md`](./docs/features/feature-summary.md) | Source of truth fitur, feature map/mindmap, route/page/service coverage |
| Template feature doc | [`docs/features/feature-template.md`](./docs/features/feature-template.md) | Saat membuat feature doc baru; wajib observed contract dari code |
| Detail fitur per kategori | [`docs/features/`](./docs/features/) | Breakdown fitur berdasarkan 11 kategori HMPS |
| Endpoint registry | [`docs/api/endpoints.md`](./docs/api/endpoints.md) | Daftar endpoint, auth/permission, dan contract notes |
| OpenAPI static docs | [`docs/openapi.json`](./docs/openapi.json), [`docs/api-docs.html`](./docs/api-docs.html) | Dokumentasi API machine-readable dan HTML docs |
| TODO utama | [`docs/todo/master-todo.md`](./docs/todo/master-todo.md) | Tracking pekerjaan docs/fitur/maintenance berikutnya |

### Feature Docs Coverage

Feature docs saat ini mencakup:

- **11 kategori fitur** di `docs/features/`.
- **88 markdown docs** termasuk index kategori, feature summary, template, dan feature docs.
- Coverage audit terakhir:
  - `284` Express route declarations covered.
  - `39` frontend page files covered.
  - `16` service files covered.
  - Missing route/page/service coverage: `0`.

### Cara Membaca Feature Docs

1. Mulai dari [`docs/features/feature-summary.md`](./docs/features/feature-summary.md) untuk melihat mindmap dan category index.
2. Buka kategori yang sesuai, misalnya Auth, Store, Media, atau Ops/Security.
3. Gunakan feature doc spesifik untuk melihat observed endpoint, request fields, response notes, source file, dan test scenario.
4. Jika contract belum exact, dokumen menandai `Partial` atau `Unknown / To Verify` daripada memberi contoh palsu.

### Saat Menambah Fitur Baru

Wajib update minimal:

- Feature doc di `docs/features/<kategori>/NN-nama-fitur.md`.
- Category README di `docs/features/<kategori>/00-README.md`.
- [`docs/features/feature-summary.md`](./docs/features/feature-summary.md).
- [`docs/api/endpoints.md`](./docs/api/endpoints.md) dan OpenAPI bila endpoint berubah.
- SOP/architecture docs bila ada perubahan pola kerja atau arsitektur.
## ðŸš€ Quick Start

### ðŸ“‹ Prerequisites

Pastikan Anda telah menginstall:
- **Node.js** (v18.0.0 atau lebih tinggi)
- **npm** (lockfile project: `package-lock.json`)
- **MongoDB** (local atau cloud)

### âš¡ Installation

```bash
# 1ï¸âƒ£ Clone repository
git clone https://github.com/Sadamdi/hmps.git
cd hmps

# 2ï¸âƒ£ Install dependencies
npm install

# 3ï¸âƒ£ Setup environment variables
# Buat file `.env` di root project (lihat bagian `ðŸŒ Environment Variables` di bawah)
# Edit `.env` dengan konfigurasi Anda

# 4ï¸âƒ£ Setup database
npx tsx db/mongo-seed.ts

# 5ï¸âƒ£ Start development server
npm run dev
```

### ðŸŒ Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/hmps
DISABLE_MONGODB=false

# Opsional: cluster backup untuk snapshot bulanan
# Jika diset, aplikasi akan connect + ping saat startup untuk job snapshot
MONGODB_URI_BACKUP=mongodb+srv://...

# Authentication (JWT)
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=24h

# OTP / Email (forgot password, change password/email, dan restore backup)
EMAIL=your-email@gmail.com
EMAIL_PW=your-email-password/app-password

# Guest comment/feedback (untuk header `x-guest-key`)
# default: hmps-comment-pepper
GUEST_KEY_PEPPER=hmps-comment-pepper

# Gemini (chat di fitur /api/chat)
# Tambahkan GEMINI_API_KEY_1 â€¦ GEMINI_API_KEY_N sesuai kebutuhan.
GEMINI_API_KEY_1=...
GEMINI_API_KEY_2=...
# Opsional: batas indeks slot yang discan (default 100; bisa sampai 1000)
GEMINI_MAX_KEY_SLOTS=100
# Opsional: cooldown ms setelah quota/rate limit per slot (default 90000)
GEMINI_KEY_COOLDOWN_MS=90000

# TinyMCE (editor berita)
VITE_TINYMCE_API_KEY=your-tiny-api-key

# Opsional: Google Drive API service account path
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json

# Opsional: konfigurasi auto-fill struktur organisasi
ORG_AUTO_FILL_MAX_PDF_PAGES=15

# Opsional (dipakai untuk environment check di beberapa tempat)
NODE_ENV=development
```

---

## ðŸ”§ Available Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | ðŸš€ Start development server | Development |
| `npm run build` | ðŸ“¦ Build for production | Production |
| `npm start` | â–¶ï¸ Start production server | Production |
| `npm run check` | ðŸ” TypeScript type checking | Development |
| `npm run generate-sitemap` | ðŸ—ºï¸ Generate sitemap (file) | SEO |
| `npm run generate-favicon` | ðŸ§· Generate favicon assets | SEO |
| `npm run deploy-seo` | ðŸš€ Deploy SEO assets | SEO |
 
ðŸŒ± Seed database (akun default, kalau koleksi masih kosong): `npx tsx db/mongo-seed.ts`

> âš ï¸ Catatan: script SEO lama (`generate-sitemap`, `generate-favicon`, `deploy-seo`) **sudah tidak dipakai di repo ini**.  
> Sitemap sekarang digenerate dinamis via endpoint server `/sitemap.xml`.
---

## ðŸ” Security Features

<div align="center">

| Feature | Implementation | Status |
|---------|---------------|--------|
| ðŸ” **Authentication (JWT)** | JWT di cookie `authToken` + session check (`sid`) + revocation via `tokenVersion` | âœ… Active |
| ðŸ›¡ï¸ **Password Security** | bcryptjs hash | âœ… Active |
| â›‘ï¸ **Security Middleware** | `helmet`/`hpp` + anti-spoofing + anti-DDoS + DNS layer protection | âœ… Active |
| â° **Rate Limiting** | express-rate-limit + limiter khusus (login/upload/OTP) | âœ… Active |
| âœ… **Input Validation** | Zod schema validation (`validateInput`) | âœ… Active |
| ðŸ§¼ **Sanitization (anti-XSS sederhana)** | `sanitizeInput` (strip script/javascript handler) | âœ… Active |
| ðŸ”’ **File Upload Security** | allowed mimetype + max 100MB + proses gambar (WebP) | âœ… Active |
| ðŸ“ **Audit Logging** | `securityLogger` + aktivitas dashboard | âœ… Active |

</div>

---

## ðŸ“¡ Dokumentasi API

Berikut daftar endpoint aktif (method + path) berdasarkan route server saat ini.  
Catatan:
- ðŸ”’ Endpoint tertentu butuh login + permission.
- ðŸ‘¤ Endpoint guest/public tertentu pakai header `x-guest-key`.
- ðŸ˜ï¸ Semua endpoint di bawah juga bisa berjalan pada konteks komunitas via prefix: `/api/c/:slug/...`.

### ðŸ” Authentication & Session
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/revoke-all-sessions`
- `GET /api/auth/me`
- `GET /api/auth/sessions`
- `POST /api/auth/sessions/revoke`
- `PUT /api/auth/profile`
- `POST /api/auth/change-password`
- `POST /api/auth/change-password/request-otp`
- `POST /api/auth/change-password/confirm`
- `POST /api/auth/forgot-password/request-otp`
- `POST /api/auth/forgot-password/verify-otp`
- `POST /api/auth/forgot-password/confirm`
- `POST /api/auth/change-email/request-otp`
- `POST /api/auth/change-email/confirm`
- `GET /api/auth/permissions`
- `POST /api/auth/refresh-permissions`

### ðŸ‘¤ Users, Roles, Permissions & Divisions
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `POST /api/users/:id/password`
- `POST /api/users/:id/email`
- `PUT /api/users/:id/role`
- `GET /api/roles`
- `GET /api/roles/levels`
- `GET /api/roles/assignable`
- `POST /api/roles`
- `POST /api/roles/create-with-shift`
- `PUT /api/roles/:id`
- `DELETE /api/roles/:id`
- `GET /api/permissions`
- `POST /api/permissions`
- `POST /api/admin/permissions/recompute-owner`
- `GET /api/divisions`
- `GET /api/divisions/available-positions`
- `POST /api/divisions`
- `POST /api/divisions/copy`
- `PUT /api/divisions/:id`
- `PUT /api/divisions/order`
- `DELETE /api/divisions/:id`
- `GET /api/users/:id/permission-overrides`
- `PUT /api/users/:id/permission-overrides`

### ðŸ“° Berita
- `GET /api/berita`
- `GET /api/berita/manage`
- `GET /api/berita/:id`
- `GET /api/berita/:id/:slug`
- `GET /api/berita/:id([a-fA-F0-9]{24})/:slug`
- `GET /api/berita/slug/:slug`
- `GET /api/berita/:id/events`
- `GET /api/berita/slug/:slug/events`
- `GET /api/berita/:id/related`
- `GET /api/berita/slug/:slug/related`
- `POST /api/berita`
- `PUT /api/berita/:id`
- `DELETE /api/berita/:id`
- `POST /api/berita/:id/copy-to-event`
- `POST /api/berita/:id/attach-event`
- `DELETE /api/berita/:id/attach-event/:eventId`

### ðŸ—ƒï¸ Library
- `GET /api/library`
- `GET /api/library/manage`
- `GET /api/library/:id`
- `GET /api/library/slug/:slug`
- `GET /api/library/:libraryId/folder/:folderId/files`
- `POST /api/library`
- `PUT /api/library/:id`
- `DELETE /api/library/:id`

### ðŸ—“ï¸ Events
- `GET /api/event-years`
- `GET /api/event-years/:id/events-count`
- `POST /api/event-years`
- `PATCH /api/event-years/:id`
- `PATCH /api/event-years/:id/activate`
- `PATCH /api/event-years/:id/deactivate`
- `DELETE /api/event-years/:id`
- `GET /api/events/published`
- `GET /api/events/active-home`
- `GET /api/events/by-year/:year`
- `GET /api/events/year/:year/slug/:slug`
- `GET /api/events`
- `GET /api/events/:id`
- `POST /api/events`
- `PATCH /api/events/:id`
- `DELETE /api/events/:id`
- `POST /api/events/:id/copy-to-berita`
- `POST /api/events/:id/attach-berita`
- `DELETE /api/events/:id/attach-berita/:beritaId`

### ðŸ¢ Organization
- `GET /api/organization/periods`
- `POST /api/organization/periods`
- `DELETE /api/organization/periods/:period`
- `GET /api/organization/positions`
- `GET /api/organization/positions/:period`
- `POST /api/organization/positions`
- `POST /api/organization/positions/copy`
- `POST /api/organization/positions/auto-fill`
- `POST /api/organization/structure/copy`
- `POST /api/organization/structure-auto-fill`
- `POST /api/organization/structure-auto-fill/apply`
- `DELETE /api/organization/positions/:period`
- `GET /api/organization/members`
- `GET /api/organization/members/:id`
- `POST /api/organization/members`
- `PUT /api/organization/members/:id`
- `DELETE /api/organization/members/:id`

### ðŸ‘¨â€ðŸŽ“ Prodi & Akademik
- `GET /api/prodi`
- `GET /api/prodi/preview`
- `GET /api/prodi/manage`
- `GET /api/prodi/curriculum/:year`
- `PUT /api/prodi/manage`
- `POST /api/prodi/curriculum/year`
- `POST /api/prodi/upload/photo/member`
- `POST /api/prodi/upload/photo/lab`
- `POST /api/prodi/upload/photo/org-structure`
- `POST /api/prodi/sync/run`

### âš™ï¸ Settings, Home Images & Middleware Settings
- `GET /api/settings`
- `PUT /api/settings`
- `PUT /api/settings/home-config`
- `PUT /api/settings/home-image-slots`
- `POST /api/settings/reset`
- `GET /api/home-images/active`
- `GET /api/home-images`
- `POST /api/home-images`
- `PUT /api/home-images/:year`
- `DELETE /api/home-images/:year`
- `POST /api/home-images/:year/set-active`
- `POST /api/home-images/:year/copy`
- `POST /api/home-images/:year/upload/:slot`
- `POST /api/home-images/:year/upload-person/:slot`
- `POST /api/home-images/:year/banner-render`
- `DELETE /api/home-images/:year/slot/:slot`
- `DELETE /api/home-images/:year/person/:slot`
- `GET /api/settings/middleware`
- `PUT /api/settings/middleware`

### ðŸ§¾ Dashboard, Statistik & Aktivitas
- `GET /api/stats`
- `GET /api/dashboard/stats`
- `GET /api/dashboard/activities`
- `POST /api/dashboard/log-activity`

### ðŸ“¦ Upload, Media & Integrasi Google Drive
- `POST /api/upload/content-image`
- `POST /api/upload/event-content-image`
- `POST /api/upload/filosofi`
- `POST /api/upload`
- `POST /api/gdrive/check-access`
- `POST /api/gdrive/media-url`
- `POST /api/gdrive/folder-contents`
- `GET /api/test/protection`

### ðŸ˜ï¸ Community Registration
- `GET /api/communities`
- `GET /api/registration/codes`
- `POST /api/registration/codes`
- `PATCH /api/registration/codes/:id`
- `DELETE /api/registration/codes/:id`
- `DELETE /api/registration/codes/:id/permanent`
- `GET /api/registration/communities`
- `GET /api/registration/communities/health`
- `POST /api/register/validate-code`
- `POST /api/register/upload`
- `POST /api/register/community`
- `PUT /api/registration/communities/:id`
- `DELETE /api/registration/communities/:id`
- `POST /api/registration/communities/:id/repair`
- `POST /api/registration/communities/:id/request-delete-otp`
- `POST /api/registration/communities/:id/verify-delete-otp`

### ðŸ§© Community Lifecycle (Owner)
- `POST /api/community/request-delete-otp`
- `POST /api/community/verify-delete-otp`
- `DELETE /api/community`

### ðŸ§° Admin Maintenance Utilities
- `POST /api/assets/cleanup-orphans`
- `POST /api/admin/migrate-community-media`

### ðŸ—‚ï¸ Backup & Restore
- `GET /api/backups/monthly`
- `POST /api/backups/now`
- `POST /api/backups/restore/request-otp`
- `POST /api/backups/restore/confirm`

### ðŸ’¬ Chat (Gemini)
- `GET /api/chat/all`
- `POST /api/chat/new`
- `DELETE /api/chat/:id`
- `GET /api/chat/:id/messages`
- `GET /api/chat/history`
- `POST /api/chat/message`
- `DELETE /api/chat`

### ðŸ’¬ Komentar
- `GET /api/comments`
- `GET /api/comments/count`
- `GET /api/comments/manage`
- `POST /api/comments`
- `PATCH /api/comments/:id`
- `DELETE /api/comments/:id`

### ðŸ“¨ Feedback
- `POST /api/feedback`
- `GET /api/feedback/public`
- `GET /api/feedback/ratings`
- `PATCH /api/feedback/own/:id`
- `DELETE /api/feedback/own/:id`
- `GET /api/feedback/manage`
- `GET /api/feedback/manage/ratings`
- `PATCH /api/feedback/manage/:id/visibility`
- `POST /api/feedback/manage/:id/reply`
- `POST /api/feedback/manage/:id/decision`
- `PATCH /api/feedback/manage/:id`
- `DELETE /api/feedback/manage/:id`

### ðŸ¤ Sharing
- `POST /api/sharing/:entityType/:entityId/invite`
- `POST /api/sharing/:entityType/:entityId/request`
- `POST /api/sharing/decision/:sharingId`
- `DELETE /api/sharing/:entityType/:entityId/access/:userId`
- `GET /api/sharing/my-summary`
- `GET /api/sharing/notifications`
- `POST /api/sharing/notifications/read`
- `GET /api/sharing/users/search`
- `GET /api/sharing/:entityType/:entityId`
- `GET /api/sharing/requestable`

---

## ðŸ§  Flow Penting Sistem (Wajib Tau)

### ðŸ§­ Frontend Routing Matrix
- **Public main**: `/`, `/berita`, `/profil`, `/kelembagaan`, `/prodi`, `/events`, `/library`, `/communities`.
- **Auth pages**: `/login`, `/register`, `/forgot-password`.
- **Dashboard main (protected)**: `/dashboard` + subroute `berita`, `library`, `users`, `roles`, `settings`, `profil`, `kelembagaan`, `prodi`, `events`, `feedback`, `registration`.
- **Community shell**: `/:slug` dan `/:slug/*` untuk publik + dashboard tenant (fitur global-only tidak semua tersedia di tenant).

### ðŸ˜ï¸ Multi-tenant Community
- API tenant pakai pola `/api/c/:slug/...` lalu di-resolve middleware jadi context komunitas.
- Tenant pakai database terpisah tapi schema setara dengan main app.
- Frontend community route pakai shell `/:slug/*` untuk halaman publik + dashboard komunitas.
- API request dari halaman tenant otomatis di-rewrite ke `/api/c/:slug/*`.

### ðŸ—‚ï¸ Backup, Restore & OTP Safety
- Snapshot backup bulanan ke backup cluster (jika `MONGODB_URI_BACKUP` diset).
- Restore backup wajib OTP (request OTP dulu, baru confirm restore).
- Ada endpoint manual backup (`POST /api/backups/now`) untuk kebutuhan operasional mendadak.
- Saat startup, server juga auto-check snapshot bulan aktif (bukan hanya nunggu cron).

### â° Scheduler Otomatis
- Cron backup bulanan: setiap tanggal 1 jam 02:00.
- Cron prodi auto-sync: setiap tanggal 1 jam 03:00 (jika auto-sync aktif).
- Job maintenance lain: cleanup data proteksi + cleanup temp upload + cleanup chat files.

### ðŸ¤– AI Chat (Gemini) + Permission-aware Tools
- Endpoint chat ada di `/api/chat/*`.
- Chat menyimpan histori per `userId` cookie + `contextScope` (main/tenant).
- Tool-calling AI dibatasi permission user dari server (bukan trust dari client).
- Mendukung upload gambar di message (`multipart/form-data`) dan fallback API key slot.

### ðŸ’¬ Komentar, Feedback, Sharing (Kolaborasi)
- **Komentar**: threaded comment untuk berita/event/library, guest ownership via `x-guest-key`, plus dashboard moderation.
- **Feedback**: publik bisa kirim feedback + rating + media, admin bisa reply/decision, email notifikasi terkirim untuk non-anonim.
- **Sharing**: invite/request akses view/edit, approval flow, revoke akses, dan notification center user.

### ðŸ”’ Security Runtime Notes
- Middleware security bisa di-toggle via setting middleware (apply bertahap karena ada cache runtime).
- API protection bisa menolak hit API langsung dari browser kalau request tidak sesuai policy.
- `JWT_SECRET` **wajib diisi** di production (jangan andalkan fallback default).
- Seed account default hanya untuk bootstrap lokal; wajib ganti password sebelum deploy.

### ðŸŒ Runtime & Infrastruktur Notes
- Server aplikasi berjalan pada port tetap `5000` (listen `0.0.0.0`) di balik reverse proxy.
- Nginx menyediakan endpoint healthcheck non-API: `/health`.
- `sitemap.xml` digenerate dinamis saat request.
- Path publik runtime: `/uploads` dan `/attached_assets` (dengan CORS khusus untuk asset viewer).

---

## ðŸŽ¨ UI Components Library

Project ini menggunakan komponen dari **Radix UI** yang telah di-styling dengan **Tailwind CSS**:

<details>
<summary>ðŸ“‹ <strong>Lihat Semua Components</strong></summary>

### ðŸŽ›ï¸ **Navigation & Layout**
- `Header` - App Header dengan Notifications
- `Sidebar` - Navigation Sidebar
- `Breadcrumb` - Navigation Breadcrumbs
- `Navigation Menu` - Complex Navigation

### ðŸ“ **Forms & Inputs**
- `Form` - Comprehensive Form Handling
- `Input` - Text Input dengan Validation
- `Textarea` - Multi-line Text Input
- `Select` - Dropdown Selection
- `Checkbox` - Boolean Input
- `Radio Group` - Single Selection
- `Switch` - Toggle Input

### ðŸ’¬ **Feedback & Overlays**
- `Dialog` - Modal Dialogs
- `Alert Dialog` - Confirmation Dialogs
- `Toast` - Notification Messages
- `Tooltip` - Hover Information
- `Popover` - Floating Content
- `Hover Card` - Rich Hover Content

### ðŸ“Š **Data Display**
- `Table` - Data Tables dengan Sorting
- `Card` - Content Cards
- `Badge` - Status Indicators
- `Avatar` - User Avatars
- `Accordion` - Collapsible Content
- `Tabs` - Tabbed Interface

### ðŸŽ¯ **Media & Rich Content**
- `Rich Text Editor` - TinyMCE Integration
- `Image Upload` - Drag & Drop Upload
- `Media Display` - Image/Video Display
- `Calendar` - Date Selection
- `Chart` - Data Visualization

</details>

---

## ðŸ“Š Performance & Monitoring

- âš¡ **Fast Loading**: Optimized bundle dengan code splitting
- ðŸ“± **Mobile Optimized**: Responsive design untuk semua device
- ðŸ’¾ **Smart Caching**: React Query untuk efficient data fetching
- ðŸ—ºï¸ **SEO & Sitemap**: sitemap dinamis + injeksi meta/canonical saat production
- ðŸ§¹ **Maintenance Scheduler**: cleanup gambar/chat + cleanup data protection terjadwal
- ðŸ“ˆ **Monitoring (admin)**: aktivitas terbaru via endpoint dashboard + log security/error

---

## ðŸ¤ Contributing

Kami sangat menghargai kontribusi dari komunitas! Berikut cara untuk berkontribusi:

### ðŸŽ¯ **Quick Contribution Guide**

1. **ðŸ´ Fork** repository ini
2. **ðŸŒ¿ Create** branch fitur (`git checkout -b feature/AmazingFeature`)
3. **ðŸ’» Commit** perubahan (`git commit -m 'Add some AmazingFeature'`)
4. **ðŸ“¤ Push** ke branch (`git push origin feature/AmazingFeature`)
5. **ðŸ”„ Create** Pull Request

### ðŸ“ **Contribution Guidelines**

- Pastikan kode mengikuti **ESLint** dan **Prettier** configuration
- Tulis **test** untuk fitur baru (jika ada)
- Update **documentation** jika diperlukan
- Gunakan **conventional commits** format

---

## ðŸ‘¥ Team & Contributors

<div align="center">

### ðŸ† **Core Team**

<table>
<tr>
<td align="center">
<img src="https://github.com/Sadamdi.png" width="100px" alt="Sulthan Adam"/>
<br />
<strong>Sulthan Adam Rahmadi</strong>
<br />
<sub>ðŸš€ <strong>Owner & Lead Developer</strong></sub>
<br />
<sub>
ðŸ“‹ Project Manager<br/>
ðŸ’» Full-stack Developer<br/>
âš™ï¸ Backend Developer<br/>
ðŸ—ï¸ System Architect<br/>
ðŸ” Security Engineer<br/>
</sub>
<br />
<a href="https://github.com/Sadamdi">GitHub</a>
</td>
<td align="center">
<img src="https://github.com/addid-cloud.png" width="100px" alt="Muhammad Alif"/>
<br />
<strong>Muhammad Alif Mujaddid</strong>
<br />
<sub>âš¡ <strong>Core Developer</strong></sub>
<br />
<sub>
ðŸ’» Admin System Developer<br/>
ðŸŽ¨ Frontend Developer<br/>
âš™ï¸ Backend Developer<br/>
ðŸŽ¯ UI/UX Designer<br/>
ðŸ§ª QA Engineer<br/>
</sub>
<br />
<a href="https://github.com/addid-cloud">GitHub</a>
</td>
</tr>
</table>

</div>

---

## ðŸ“œ License

<div align="center">

**MIT License** ðŸ“„

Project ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

---

### ðŸ“ž **Contact & Support**

ðŸŒ **Website**: [himatif.encoder.com](https://himatif.encoder.com)  
ðŸ“§ **Email**: ti@uin-malang.ac.id  
ðŸ“± **Instagram**: [@himatif.encoder](https://www.instagram.com/himatif.encoder/)  

---

<sub>Dibuat dengan â¤ï¸ oleh Tim HIMATIF ENCODER untuk kemajuan Program Studi Teknik Informatika UIN Malang</sub>

</div> 


> Documentation update: feature docs now include **12 categories** with Runtime Infrastructure coverage for middleware, config, database bootstrap/backup clients, backend helpers, and frontend constants/utilities.


