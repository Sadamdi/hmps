# 📚 HMPS Project — Documentation Hub

> Pusat dokumentasi untuk **HMPS Project — HIMATIF ENCODER**.
> Platform informasi resmi HMPS Teknik Informatika UIN Malang.

---

## 📁 Struktur Dokumentasi

```text
docs/
├── README.md
├── SOP/
│   ├── 01-development-workflow.md
│   ├── 02-code-standards.md
│   ├── 03-git-branching-strategy.md
│   ├── 04-code-review.md
│   ├── 05-testing-strategy.md
│   ├── 06-api-design.md
│   ├── 07-deployment.md
│   └── 08-error-handling.md
├── architecture/
│   ├── application-architecture.md
│   ├── project-structure.md
│   ├── dependency-graph.md
│   └── multi-tenant.md
├── features/
│   ├── feature-summary.md
│   └── feature-template.md
├── api/
│   ├── endpoints.md
│   └── swagger-guide.md
├── todo/
│   └── master-todo.md
├── CHANGELOG.md
├── openapi.json
├── api-docs.html
└── swagger-ui/
```

---

## 🚀 Tech Stack

| Area | Teknologi |
|------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Radix UI |
| Routing | Wouter |
| Data Fetching | TanStack React Query |
| Forms | React Hook Form + Zod |
| Backend | Express.js + TypeScript |
| Database | MongoDB + Mongoose |
| Auth | JWT cookie, session tracking, role/permission control |
| Media | Multer, image processing, local uploads, Google Drive |
| AI | Gemini chat + permission-aware tool-calling |
| Docs | OpenAPI JSON + generated static HTML |

---

## 🔗 Quick Links

| Dokumen | Deskripsi |
|---------|-----------|
| [Development Workflow](./SOP/01-development-workflow.md) | Alur kerja dari planning sampai verifikasi |
| [Code Standards](./SOP/02-code-standards.md) | Standar TypeScript, React, Express, MongoDB |
| [API Design](./SOP/06-api-design.md) | Kontrak endpoint, auth, response, pagination |
| [Error Handling](./SOP/08-error-handling.md) | Pola error backend/frontend |
| [Application Architecture](./architecture/application-architecture.md) | Pola arsitektur aktual HMPS |
| [Project Structure](./architecture/project-structure.md) | Struktur folder dan tanggung jawab |
| [Multi Tenant](./architecture/multi-tenant.md) | Aturan community tenant `/api/c/:slug/*` |
| [Feature Summary](./features/feature-summary.md) | Ringkasan fitur yang ada |
| [API Endpoints](./api/endpoints.md) | Daftar endpoint utama |
| [System Error Monitoring](./features/08-collaboration-feedback/06-system-error-monitoring.md) | Bug otomatis (capture server/client + analisis AI) |
| [Master To-Do](./todo/master-todo.md) | Checklist dokumentasi dan maintenance |
| [Changelog](./CHANGELOG.md) | Riwayat versi & perubahan dokumentasi |

---

## 📖 Cara Menggunakan Docs

1. Sebelum coding, baca SOP yang relevan.
2. Sebelum fitur baru, cek feature summary dan endpoints.
3. Untuk fitur tenant-aware, baca multi-tenant docs.
4. Update docs setiap menambah endpoint, permission, fitur, atau behavior publik.
5. Untuk AI agent, ikuti `AGENTS.md` dan project-local skills di `.agents/skills/`.

---

*Terakhir diperbarui: 2026-06-28*
