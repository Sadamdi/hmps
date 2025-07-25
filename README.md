# 🎓 HMPS Project - HIMATIF ENCODER

<div align="center">

![HMPS Logo](public/logo.png)

**Platform Informasi Resmi Himpunan Mahasiswa Teknik Informatika UIN Malang**
*Periode 2025-2026*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

## 📖 Tentang Project

Project ini adalah **aplikasi web fullstack** yang dibangun untuk Himpunan Mahasiswa Program Studi (HMPS) Teknik Informatika UIN Malang. Aplikasi ini merupakan platform informasi resmi **HIMATIF ENCODER** yang menyediakan berbagai informasi seputar kegiatan, prestasi, dan perkembangan Program Studi Teknik Informatika UIN Malang.

Melalui platform ini, kami berupaya untuk memberikan akses informasi yang **transparan dan terupdate** kepada seluruh mahasiswa Teknik Informatika UIN Malang serta masyarakat umum yang ingin mengetahui lebih lanjut tentang Program Studi Teknik Informatika UIN Malang.

---

## ✨ Fitur Unggulan

<table>
<tr>
<td width="50%">

### 🔐 **Sistem Autentikasi & Autorisasi**
- 👤 Login multi-role (Owner, Admin, Chair, Vice Chair, Division Head)
- 🛡️ Manajemen profil pengguna lengkap
- 🔑 Sistem reset password terintegrasi
- 🎫 JWT-based authentication dengan refresh token
- 🚧 Role-based access control yang ketat

### 📊 **Dashboard Admin Real-time**
- 📈 Statistik dan analitik kegiatan live
- 👥 Manajemen pengguna advanced
- 🔍 Monitoring aktivitas sistem real-time
- ⚙️ Pengaturan sistem yang fleksibel
- 📝 Log aktivitas terperinci dengan timeline

### 👨‍🎓 **Manajemen Organisasi**
- ➕ Pengelolaan struktur organisasi
- ✅ Sistem verifikasi anggota
- 📚 Riwayat keanggotaan lengkap
- 🏷️ Status dan badge keanggotaan

</td>
<td width="50%">

### 📰 **Sistem Konten & Media**
- 📝 Editor artikel dengan TinyMCE WYSIWYG
- 📸 Upload dan manajemen media library
- 🔍 Pencarian konten yang powerful
- 📅 Kalender kegiatan interaktif
- 🗃️ Arsip digital terorganisir

### 🎨 **User Experience Modern**
- 📱 Responsive design untuk semua device
- 🌙 Dark/Light mode (coming soon)
- ⚡ Loading yang cepat dengan caching
- 🔔 Notifikasi real-time
- 🎯 Navigation yang intuitif

### 🔧 **Fitur Developer**
- 📚 API documentation lengkap
- 🛠️ Backup otomatis
- 📊 Performance monitoring
- 🔒 Security middleware comprehensive
- 🧪 Testing suite terintegrasi

</td>
</tr>
</table>

---

## 🏗️ Arsitektur Teknologi

### 🎨 **Frontend Stack**
```javascript
// Modern React dengan TypeScript
├── React 18 + TypeScript
├── React Query (TanStack Query) - State Management
├── Wouter - Lightweight Routing
├── Radix UI - Accessible Components
├── Tailwind CSS - Utility-first CSS
├── React Hook Form - Form Handling
├── Zod - Schema Validation
├── Lucide React - Beautiful Icons
└── Vite - Ultra Fast Build Tool
```

### ⚙️ **Backend Stack**
```javascript
// Robust Express.js Backend
├── Express.js + TypeScript
├── MongoDB - Primary Database
├── Drizzle ORM - Type-safe Database
├── JWT - Authentication & Authorization
├── Multer - File Upload Handling
├── Bcrypt - Password Hashing
├── Rate Limiting - API Protection
└── ESBuild - Fast Production Build
```

### 🗄️ **Database & Infrastructure**
```javascript
// Scalable Database Design
├── MongoDB - Document Database
├── Schema Validation - Data Integrity
├── Indexing - Performance Optimization
├── Backup Strategy - Data Safety
├── Data Encryption - Security
└── Real-time Sync - Live Updates
```

---

## 📁 Struktur Project

```
📦 HMPS Project
├── 🎨 client/                     # Frontend React Application
│   ├── 📂 src/
│   │   ├── 🧩 components/        # Reusable UI Components
│   │   │   ├── 🎛️ dashboard/    # Dashboard Components
│   │   │   ├── 🌐 public/       # Public Site Components
│   │   │   └── 🎨 ui/           # Base UI Components (Radix)
│   │   ├── 📄 pages/            # Page Components & Routes
│   │   ├── 🪝 hooks/            # Custom React Hooks
│   │   ├── 🛠️ lib/             # Utility Libraries
│   │   ├── 🎯 utils/            # Helper Functions
│   │   └── 📊 main.tsx          # App Entry Point
├── ⚙️ server/                    # Backend Express Application
│   ├── 🎮 routes.ts             # API Routes Definition
│   ├── 🔐 auth.ts               # Authentication Logic
│   ├── 📊 models/               # Database Models
│   ├── 🛡️ middleware/           # Custom Middleware
│   ├── 🔧 services/             # Business Logic
│   └── ⚡ index.ts              # Server Entry Point
├── 🗄️ db/                       # Database Configuration
│   ├── 📋 schema.ts             # Database Schema
│   ├── 🔗 mongodb.ts            # MongoDB Connection
│   └── 🌱 seed.ts               # Database Seeding
├── 🤝 shared/                   # Shared Code (Frontend + Backend)
│   ├── 📝 schema.ts             # Shared Type Definitions
│   └── 🛠️ utils/               # Shared Utilities
├── 🌐 public/                   # Static Assets
├── 📁 attached_assets/          # User Uploaded Files
│   ├── 📰 articles/            # Article Images
│   ├── 🏢 organization/        # Organization Assets
│   ├── 📚 content/             # Content Images
│   └── 🖼️ general/            # General Media
└── 📜 scripts/                  # Utility Scripts
```

---

## 🚀 Quick Start

### 📋 Prerequisites

Pastikan Anda telah menginstall:
- **Node.js** (v18.0.0 atau lebih tinggi)
- **npm** atau **yarn**
- **MongoDB** (local atau cloud)

### ⚡ Installation

```bash
# 1️⃣ Clone repository
git clone https://github.com/Sadamdi/hmps.git
cd hmps

# 2️⃣ Install dependencies
npm install

# 3️⃣ Setup environment variables
cp .env.example .env
# Edit .env dengan konfigurasi Anda

# 4️⃣ Setup database
npm run db:seed

# 5️⃣ Start development server
npm run dev
```

### 🌍 Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/hmps
DISABLE_MONGODB=false

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# API Configuration
PORT=5000
NODE_ENV=development

# External Services
GOOGLE_DRIVE_API_KEY=your-gdrive-api-key
GEMINI_API_KEY=your-gemini-api-key
```

---

## 🔧 Available Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | 🚀 Start development server | Development |
| `npm run build` | 📦 Build for production | Production |
| `npm start` | ▶️ Start production server | Production |
| `npm run check` | 🔍 TypeScript type checking | Development |
| `npm run db:seed` | 🌱 Seed database with sample data | Setup |

---

## 🔐 Security Features

<div align="center">

| Feature | Implementation | Status |
|---------|---------------|--------|
| 🔐 **JWT Authentication** | Access + Refresh Tokens | ✅ Active |
| 🛡️ **Password Security** | Bcrypt Hashing (Salt: 12) | ✅ Active |
| 🚧 **CORS Protection** | Configurable Origins | ✅ Active |
| ⏰ **Rate Limiting** | IP-based Throttling | ✅ Active |
| ✅ **Input Validation** | Zod Schema Validation | ✅ Active |
| 🛡️ **XSS Protection** | Content Security Policy | ✅ Active |
| 🔒 **File Upload Security** | Type & Size Validation | ✅ Active |
| 📝 **Audit Logging** | Activity Tracking | ✅ Active |

</div>

---

## 🎨 UI Components Library

Project ini menggunakan komponen dari **Radix UI** yang telah di-styling dengan **Tailwind CSS**:

<details>
<summary>📋 <strong>Lihat Semua Components</strong></summary>

### 🎛️ **Navigation & Layout**
- `Header` - App Header dengan Notifications
- `Sidebar` - Navigation Sidebar
- `Breadcrumb` - Navigation Breadcrumbs
- `Navigation Menu` - Complex Navigation

### 📝 **Forms & Inputs**
- `Form` - Comprehensive Form Handling
- `Input` - Text Input dengan Validation
- `Textarea` - Multi-line Text Input
- `Select` - Dropdown Selection
- `Checkbox` - Boolean Input
- `Radio Group` - Single Selection
- `Switch` - Toggle Input

### 💬 **Feedback & Overlays**
- `Dialog` - Modal Dialogs
- `Alert Dialog` - Confirmation Dialogs
- `Toast` - Notification Messages
- `Tooltip` - Hover Information
- `Popover` - Floating Content
- `Hover Card` - Rich Hover Content

### 📊 **Data Display**
- `Table` - Data Tables dengan Sorting
- `Card` - Content Cards
- `Badge` - Status Indicators
- `Avatar` - User Avatars
- `Accordion` - Collapsible Content
- `Tabs` - Tabbed Interface

### 🎯 **Media & Rich Content**
- `Rich Text Editor` - TinyMCE Integration
- `Image Upload` - Drag & Drop Upload
- `Media Display` - Image/Video Display
- `Calendar` - Date Selection
- `Chart` - Data Visualization

</details>

---

## 📊 Performance & Monitoring

- ⚡ **Fast Loading**: Optimized bundle dengan code splitting
- 📱 **Mobile Optimized**: Responsive design untuk semua device
- 🔄 **Real-time Updates**: WebSocket integration untuk live data
- 💾 **Smart Caching**: React Query untuk efficient data fetching
- 📈 **Performance Monitoring**: Built-in performance tracking

---

## 🤝 Contributing

Kami sangat menghargai kontribusi dari komunitas! Berikut cara untuk berkontribusi:

### 🎯 **Quick Contribution Guide**

1. **🍴 Fork** repository ini
2. **🌿 Create** branch fitur (`git checkout -b feature/AmazingFeature`)
3. **💻 Commit** perubahan (`git commit -m 'Add some AmazingFeature'`)
4. **📤 Push** ke branch (`git push origin feature/AmazingFeature`)
5. **🔄 Create** Pull Request

### 📝 **Contribution Guidelines**

- Pastikan kode mengikuti **ESLint** dan **Prettier** configuration
- Tulis **test** untuk fitur baru (jika ada)
- Update **documentation** jika diperlukan
- Gunakan **conventional commits** format

---

## 👥 Team & Contributors

<div align="center">

### 🏆 **Core Team**

<table>
<tr>
<td align="center">
<img src="https://github.com/Sadamdi.png" width="100px" alt="Sulthan Adam"/>
<br />
<strong>Sulthan Adam Rahmadi</strong>
<br />
<sub>🚀 <strong>Owner & Lead Developer</strong></sub>
<br />
<sub>
📋 Project Manager<br/>
💻 Full-stack Developer<br/>
🏗️ System Architect<br/>
🔐 Security Engineer<br/>
</sub>
<br />
<a href="https://github.com/Sadamdi">GitHub</a>
</td>
<td align="center">
<img src="https://github.com/addid-cloud.png" width="100px" alt="Muhammad Alif"/>
<br />
<strong>Muhammad Alif Mujaddid</strong>
<br />
<sub>⚡ <strong>Core Developer</strong></sub>
<br />
<sub>
🎨 Frontend Developer<br/>
⚙️ Backend Developer<br/>
🎯 UI/UX Designer<br/>
🧪 QA Engineer<br/>
</sub>
<br />
<a href="https://github.com/addid-cloud">GitHub</a>
</td>
</tr>
</table>

</div>

---

## 📜 License

<div align="center">

**MIT License** 📄

Project ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

---

### 📞 **Contact & Support**

🌐 **Website**: [hmti.uin-malang.ac.id](https://hmti.uin-malang.ac.id)  
📧 **Email**: hmti@uin-malang.ac.id  
📱 **Instagram**: [@hmti_uinmalang](https://instagram.com/hmti_uinmalang)  

---

<sub>Dibuat dengan ❤️ oleh Tim HIMATIF ENCODER untuk kemajuan Program Studi Teknik Informatika UIN Malang</sub>

</div> 