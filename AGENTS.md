# HMPS Project — HIMATIF ENCODER AI Agent Instructions

> **MANDATORY**: File ini dibaca oleh AI agent di setiap conversation.
> Semua aturan di sini WAJIB dipatuhi tanpa pengecualian.

---

## 🤖 Identitas Proyek

- **Nama**: HMPS Project — HIMATIF ENCODER
- **Tipe**: Full-Stack Web Application
- **Domain**: Platform informasi resmi HMPS Teknik Informatika UIN Malang
- **Website**: https://himatif-encoder.com
- **Contact**: himatif.encoder@gmail.com
- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Express.js + TypeScript
- **Database**: MongoDB + Mongoose
- **Auth**: JWT cookie + session tracking (`sid`) + role/permission control
- **Multi-Tenant**: Community shell dan tenant API via `/api/c/:slug/*`
- **Media**: Multer, image processing, local uploads, Google Drive integration
- **AI**: Gemini chat dengan permission-aware tool-calling
- **API Docs**: OpenAPI static docs di `docs/openapi.json` dan `docs/api-docs.html`
- **AI Context**: Code Review Graph (MCP-based)

---

## 📖 WAJIB BACA SEBELUM PLANNING / CODING

Setiap kali merencanakan atau mengimplementasikan fitur, **WAJIB** baca:

1. `docs/SOP/01-development-workflow.md` — Alur kerja pengembangan
2. `docs/SOP/02-code-standards.md` — Naming convention & code style
3. `docs/SOP/06-api-design.md` — Standar API design
4. `docs/SOP/08-error-handling.md` — Error handling patterns
5. `docs/SOP/09-frontend-architecture.md` — Pola frontend React/Vite HMPS
6. `docs/SOP/10-backend-service-storage.md` — Pola backend service/storage HMPS
7. `docs/SOP/11-documentation-maintenance.md` — Aturan maintenance docs/feature/API
8. `docs/SOP/12-runtime-security-operations.md` — Middleware, runtime security, scheduler, ops
9. `docs/SOP/07-deployment.md` — Deploy production (`ops/deploy-server.sh`, auto-deploy)
10. `docs/architecture/application-architecture.md` — Pola arsitektur aplikasi
11. `docs/architecture/project-structure.md` — Struktur folder
12. `docs/architecture/dependency-graph.md` — Dependency graph & AI context
13. `docs/architecture/multi-tenant.md` — Aturan multi-tenant/community
14. `docs/features/feature-summary.md` — Cek fitur yang sudah ada
15. `docs/api/endpoints.md` — Cek endpoint yang sudah didefinisikan
16. `docs/todo/master-todo.md` — Cek progress saat ini
17. `docs/version/versions.md` — Versi Current + policy bump per unit kerja

### Skills Lokal yang Tersedia

Gunakan skills di `.agents/skills/` sesuai konteks:

| Skill | Kapan Digunakan |
|-------|-----------------|
| `read-sop` | Awal setiap sesi planning/coding |
| `create-feature` | Membuat fitur baru end-to-end |
| `frontend-feature` | Membuat/mengubah React pages, components, hooks, lib, tenant UI |
| `backend-feature` | Membuat/mengubah Express routes, services, storage, runtime helper |
| `create-endpoint` | Menambah endpoint API baru |
| `mongoose-repository` | Membuat/ubah model, schema, dan data access Mongoose |
| `write-tests` | Menulis atau memperbaiki test |
| `error-handling` | Implementasi error handling konsisten |
| `code-review` | Review kode sebelum merge/push |
| `debug-issue` | Debugging & troubleshooting |
| `tenant-feature` | Fitur yang harus berjalan di main + community tenant |
| `media-upload` | Upload file, image processing, Google Drive, dan media URL |
| `runtime-security-ops` | Middleware, cache, scheduler, backup/restore, web push, Swagger, runtime config |
| `docs-maintenance` | Update/audit docs, feature summary, feature docs, SOP, README, API docs |

---

## 🏗️ Tech Stack Detail

### Frontend

| Komponen | Teknologi |
|----------|-----------|
| Framework | React 18 via Vite |
| Language | TypeScript |
| Styling | Tailwind CSS + custom CSS tokens |
| UI Components | Radix UI primitives + local components |
| Routing | Wouter |
| Server State | TanStack React Query |
| Forms | React Hook Form + Zod |
| Icons | Lucide React / React Icons |

### Backend

| Komponen | Teknologi |
|----------|-----------|
| Runtime | Node.js |
| Server | Express.js + TypeScript (`tsx` dev runtime) |
| Database | MongoDB |
| ODM | Mongoose |
| Auth | JWT, cookies, session tracking, bcryptjs |
| Upload | Multer + image processing |
| Email/OTP | Nodemailer + OTP flow |
| Security | Helmet, HPP, rate limit, anti-spoofing, input validation |
| Scheduler | node-cron maintenance jobs |
| API Docs | OpenAPI JSON + generated HTML |

---

## 🧱 Aturan Arsitektur HMPS

Proyek ini belum memakai Clean Architecture murni seperti E-Commerce Go backend. Gunakan pola aktual berikut:

```text
client/src/       → React UI, pages, hooks, components, lib
server/routes.ts  → Route registration dan endpoint orchestration
server/routes/    → Modular route files untuk fitur tertentu
server/services/  → Business logic dan integrasi external service
server/*storage*  → Data access/storage abstraction
server/models/    → Mongo/Mongoose-related models
shared/           → Shared schema, types, constants, utilities
```

### Dependency Rules

- ✅ UI component boleh memanggil hooks/services frontend, bukan endpoint logic langsung tersebar.
- ✅ Backend route handler boleh orchestrate request/response, auth, validation, dan service call.
- ✅ Business logic reusable harus masuk `server/services/` atau storage layer.
- ✅ Data access Mongo/Mongoose harus terpusat di model/storage/service yang relevan.
- ✅ Shared schema hanya berisi kontrak/type/util yang aman dipakai frontend dan backend.
- ❌ Jangan taruh secret atau credential di frontend/shared.
- ❌ Jangan commit `.env`, service account JSON, token, atau backup sensitif.
- ❌ Jangan hardcode API URL; gunakan config/environment.
- ❌ Jangan bypass tenant resolver untuk fitur tenant-aware.

---

## ⚛️ Aturan Frontend

### Struktur Folder Frontend

```text
client/src/
├── components/  → Reusable UI components
├── pages/       → Page-level routes
├── hooks/       → Custom hooks dan React Query hooks
├── lib/         → API client, utilities, auth helpers
├── utils/       → Helper functions
├── constants/   → Constant data/config
├── App.tsx      → Route composition
└── main.tsx     → Entry point
```

### Frontend Rules

- ✅ Gunakan TypeScript type yang jelas; hindari `any` kecuali terpaksa dan diberi alasan.
- ✅ Gunakan React Query untuk server state.
- ✅ Buat custom hook untuk flow data yang dipakai lebih dari satu tempat.
- ✅ Gunakan komponen UI yang sudah ada sebelum membuat baru.
- ✅ Jaga responsive design dan aksesibilitas dasar.
- ❌ Jangan taruh API call besar langsung di presentational component.
- ❌ Jangan expose secret key di `VITE_*`.
- ❌ Jangan inline style untuk styling utama jika bisa memakai class/token.

---

## 🚏 Aturan Backend

### Backend Rules

- ✅ Semua endpoint harus validasi input (Zod/schema/helper existing).
- ✅ Semua endpoint yang butuh login wajib memakai auth/permission middleware.
- ✅ Response API harus konsisten dan aman dari data sensitif.
- ✅ Propagate tenant context untuk endpoint yang tenant-aware.
- ✅ File upload wajib validasi mimetype, size, ownership, dan cleanup file gagal.
- ✅ Operasi sensitif harus tercatat di activity/security log bila relevan.
- ❌ Jangan gunakan `context` tenant dari client tanpa validasi server.
- ❌ Jangan skip error handling promise/async.
- ❌ Jangan return stack trace ke client production.
- ❌ Jangan membuat endpoint baru tanpa update docs.

---

## 📝 Urutan Implementasi Fitur Baru

### Backend / API

```text
1. Baca SOP + feature summary + endpoints docs + versions.md
2. Buat/Update Feature Document dari `docs/features/feature-template.md`
3. Definisikan kontrak request/response dan permission
4. Tambahkan schema/model/storage/service jika perlu
5. Tambahkan route handler dan middleware auth/permission
6. Tambahkan tenant handling jika fitur tenant-aware
7. Tambahkan error handling, audit/activity logging bila perlu
8. Update docs: feature summary, endpoints, OpenAPI, todo
9. Jalankan typecheck/test relevan
10. Setelah unit kerja selesai: bump SemVer + isi docs/version/release + changelog
```

### Frontend

```text
1. Definisikan route/page dan state flow
2. Buat API helper/hook bila perlu
3. Buat reusable components
4. Integrasikan page ke routing
5. Tambahkan loading, empty, error, success state
6. Verifikasi responsive UI dan permission state
7. Update docs bila behavior user-facing berubah
8. Setelah unit kerja selesai: bump SemVer + isi docs/version/release + changelog
```

---

## Versioning (wajib tiap selesai mengerjakan)

Setiap **unit kerja** yang selesai (fitur, fix batch, hardening, docs sync berarti) **harus** bump versi. Bukan menunggu rilis besar; satu selesai kerja = satu bump.

| Bump | Kapan |
|------|--------|
| **MAJOR** `X.0.0` | Breaking API/auth/tenant, atau platform shift besar |
| **MINOR** `x.Y.0` | Fitur baru, endpoint baru, tugas besar non-breaking |
| **PATCH** `x.y.Z` | Bugfix, hardening kecil, docs/API sync tanpa fitur baru |

Struktur:

```text
docs/version/
├── versions.md
├── version-template.md
├── changelogs/CHANGELOG.md
└── release/X.Y.Z.md
```

Checklist setelah selesai kerja:

1. Salin `docs/version/version-template.md` → `docs/version/release/<new>.md` dan isi lengkap.
2. Update Current di `docs/version/versions.md`.
3. Tambah section di `docs/version/changelogs/CHANGELOG.md`.
4. Sync `package.json` `version` dan `docs/openapi.json` `info.version`.
5. Update feature/API/SOP docs yang terdampak (SOP 11).

Current version: lihat `docs/version/versions.md`.

---

## 📏 Code Standards Checklist

### TypeScript / Backend

- [ ] File names: `kebab-case.ts` atau mengikuti pola existing
- [ ] Variables/functions: `camelCase`
- [ ] Types/interfaces/classes/components: `PascalCase`
- [ ] Async errors ditangani eksplisit
- [ ] Validasi input sebelum akses database
- [ ] Tidak expose password hash, token, OTP, atau secret
- [ ] Query database diberi filter tenant/ownership jika relevan

### React / Frontend

- [ ] Component names: `PascalCase`
- [ ] Hook names: prefix `use`
- [ ] Props diberi type/interface
- [ ] Loading/error/empty state tersedia untuk data async
- [ ] Route protected sesuai permission
- [ ] Tidak ada hardcoded secret/API base URL

---

## 📦 Standard Response Format

Gunakan response yang konsisten untuk endpoint baru:

```json
// Success
{
  "success": true,
  "message": "...",
  "data": {}
}

// Success List
{
  "success": true,
  "message": "...",
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 100 }
}

// Error
{
  "success": false,
  "message": "...",
  "error": { "code": "ERROR_CODE", "details": [] }
}
```

Jika endpoint existing belum memakai format ini, jangan ubah massal tanpa rencana migrasi. Terapkan untuk endpoint baru atau refactor terencana.

---

## 🚫 JANGAN PERNAH

1. Commit `.env`, credential JSON, backup database, token, atau secret.
2. Commit `node_modules/`, `dist/`, file upload runtime, atau dump database.
3. Hardcode API key Gemini, Google Drive credential, JWT secret, SMTP password.
4. Menambah endpoint sensitif tanpa auth + permission check.
5. Membuat fitur tenant-aware tanpa test main + tenant path.
6. Menaruh business logic besar langsung di React component.
7. Return stack trace atau object error mentah ke user.
8. Menghapus aturan `code-review-graph` dari file ini.
9. Menulis Claude, Cursor, Copilot, atau nama model sebagai author/contributor di README, AGENTS, release notes, atau trailer commit `Co-authored-by` AI.

---

## 🔧 Key Commands

```bash
npm run dev              # Run development server
npm run build            # Build frontend + bundle backend
npm start                # Run production bundle
npm run check            # TypeScript typecheck
npm run docs:api-html    # Generate API docs HTML from OpenAPI
npx tsx db/mongo-seed.ts # Seed default local data
```

> Di Windows PowerShell, jalankan command dari root `hmps_new`.

---

## 🧠 MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Pakai graph **dulu jika MCP available**. Fall back ke Grep/Glob/Read jika server error, tool tidak terdaftar, atau graph tidak menutupi yang dibutuhkan.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

### Graph UI behavior (project preference)

- Keep a `Reset` control in `.code-review-graph/graph.html` that restores full visibility:
  - show all node kinds
  - show all edge kinds (`CALLS`, `IMPORTS_FROM`, `INHERITS`, `CONTAINS`, etc.)
  - clear flow selection, search, collapse state, and community hides
- `Flows` dropdown must act as a strict render filter:
  - when a flow is selected, show only the selected flow subgraph
  - hide non-related nodes/edges (do not only reduce opacity)
  - when flow selection is cleared, show full graph again
- If `code-review-graph visualize` regenerates `graph.html` and removes these behaviors, re-apply them after generation.

---

## 👥 Team

| Member | Role | GitHub |
|--------|------|--------|
| Sulthan Adam Rahmadi | Owner, Lead Developer, Project Manager | [@Sadamdi](https://github.com/Sadamdi) |
| Muhammad Alif Mujaddid | Core Developer, Frontend/Backend, UI/UX | [@addid-cloud](https://github.com/addid-cloud) |

### Aturan contributor (wajib)

- Human contributors resmi **hanya** [@Sadamdi](https://github.com/Sadamdi) dan [@addid-cloud](https://github.com/addid-cloud).
- Jangan tulis Claude, Cursor, Copilot, atau nama model sebagai author/contributor di README, AGENTS, release notes, atau trailer commit `Co-authored-by` AI.
- Commit identity: `Sulthan Adam Rahmadi <sultanadamr@gmail.com>` (jangan email Cursor/Claude).
- Human contributors resmi **hanya** [@Sadamdi](https://github.com/Sadamdi) dan [@addid-cloud](https://github.com/addid-cloud). History di-rewrite 2026-08-12 (4.14.7) agar email lama (Replit, Auto-Deploy Bot, Cursor trailer) tidak muncul. **Jangan rewrite/force-push lagi** kecuali owner minta. Media push: identity Adam.
- `User-agent: ClaudeBot` di `public/robots.txt` adalah crawler, **bukan** contributor.
- Skill `pro-backend` / `pro-frontend` di `.cursor/skills/` adalah guidance umum; skill HMPS di `.agents/skills/` tetap wajib untuk kerja repo ini.

---

*Terakhir diperbarui: 2026-08-12 · Current app version: `4.14.7` — lihat `docs/version/versions.md`*
