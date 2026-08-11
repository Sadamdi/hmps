# HMPS Project — Documentation Hub

> Pusat dokumentasi untuk **HMPS Project — HIMATIF ENCODER**.  
> Platform informasi resmi HMPS Teknik Informatika UIN Malang.  
> **Current version:** lihat [`version/versions.md`](./version/versions.md).

---

## Struktur Dokumentasi

```text
docs/
├── README.md
├── CHANGELOG.md                 → pointer ke version/changelogs
├── version/
│   ├── versions.md              → index semua versi (Current)
│   ├── version-template.md
│   ├── changelogs/CHANGELOG.md
│   └── release/X.Y.Z.md
├── SOP/                         → 01 … 12
├── architecture/
├── features/                    → 12 kategori + summary/template
├── api/
├── todo/
├── openapi.json
├── api-docs.html
└── swagger-ui/
```

---

## Tech Stack

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
| AI | Gemini chat + OpenAI-compatible paths + permission-aware tools |
| Docs | OpenAPI JSON + generated static HTML + SemVer release notes |

---

## Quick Links

| Dokumen | Deskripsi |
|---------|-----------|
| [Versions](./version/versions.md) | Index versi + policy bump per unit kerja |
| [Changelog (all)](./version/changelogs/CHANGELOG.md) | Ringkasan semua versi |
| [Version template](./version/version-template.md) | Template release note |
| [Development Workflow](./SOP/01-development-workflow.md) | Alur kerja sampai version bump |
| [Code Standards](./SOP/02-code-standards.md) | Standar TypeScript / React / Express / Mongo |
| [Git Branching](./SOP/03-git-branching-strategy.md) | Branch & commit convention |
| [Code Review](./SOP/04-code-review.md) | Checklist review |
| [Testing](./SOP/05-testing-strategy.md) | `npm run check` + manual smoke |
| [API Design](./SOP/06-api-design.md) | Prefix, response honesty, pagination |
| [Deployment](./SOP/07-deployment.md) | Build, `ops/deploy-server.sh`, auto-deploy, env, smoke |
| [Error Handling](./SOP/08-error-handling.md) | Error + system-errors monitoring |
| [Frontend Architecture](./SOP/09-frontend-architecture.md) | Pola React/Vite |
| [Backend Service/Storage](./SOP/10-backend-service-storage.md) | Routes/services/models |
| [Documentation Maintenance](./SOP/11-documentation-maintenance.md) | Docs + versioning wajib |
| [Runtime Security Ops](./SOP/12-runtime-security-operations.md) | Middleware, cron, push, scanner |
| [Application Architecture](./architecture/application-architecture.md) | Pola arsitektur aktual |
| [Project Structure](./architecture/project-structure.md) | Struktur folder |
| [Multi Tenant](./architecture/multi-tenant.md) | `/api/c/:slug/*` |
| [Feature Summary](./features/feature-summary.md) | Ringkasan 12 kategori fitur |
| [API Endpoints](./api/endpoints.md) | Daftar endpoint utama |
| [Master To-Do](./todo/master-todo.md) | Checklist maintenance |

---

## Feature Categories

| # | Category |
|---|----------|
| 01 | [Auth & Access](./features/01-auth-access/00-README.md) |
| 02 | [Public Content & CMS](./features/02-public-content/00-README.md) |
| 03 | [Events & Library](./features/03-events-library/00-README.md) |
| 04 | [Organization & Prodi](./features/04-organization-prodi/00-README.md) |
| 05 | [Community Tenant](./features/05-community-tenant/00-README.md) |
| 06 | [Store / Toko](./features/06-store-toko/00-README.md) |
| 07 | [Media & Assets](./features/07-media-assets/00-README.md) |
| 08 | [Collaboration, Feedback & Sharing](./features/08-collaboration-feedback/00-README.md) |
| 09 | [AI Chat & Notifications](./features/09-ai-notifications/00-README.md) |
| 10 | [Ops, Security & Maintenance](./features/10-ops-security/00-README.md) |
| 11 | [Auxiliary Runtime](./features/11-auxiliary-runtime/00-README.md) |
| 12 | [Runtime Infrastructure](./features/12-runtime-infrastructure/00-README.md) |

---

## Cara Menggunakan Docs

1. Mulai dari `AGENTS.md` di root repo.
2. Cek versi Current di `docs/version/versions.md`.
3. Untuk fitur: baca category README + feature doc terkait.
4. Untuk API: `endpoints.md` + OpenAPI; regenerasi HTML dengan `npm run docs:api-html`.
5. Setelah selesai unit kerja: bump SemVer memakai `version-template.md` (SOP 11).

Terakhir diperbarui: 2026-08-12
