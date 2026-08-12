# Master To-Do — HMPS Project

> Terakhir diperbarui: 2026-08-12 · App version: `4.15.3` — lihat `docs/version/versions.md`

---

## Legenda Status

| Simbol | Arti |
|--------|------|
| ✅ | Sudah selesai / sudah ada di codebase |
| 🔧 | Sudah ada tapi perlu perbaikan / upgrade |
| ❌ | Belum ada / belum diimplementasi |
| 📝 | Docs only — belum ada implementasi |

---

## 1 · Auth & Access (01-auth-access)

### Backend API

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Login / Logout | `POST /api/auth/login`, `POST /api/auth/logout` |
| ✅ | Session Management | `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id`, `POST /api/auth/logout-all` |
| ✅ | Forgot Password (OTP) | `POST /api/auth/forgot`, `POST /api/auth/verify-otp`, `POST /api/auth/reset-password` |
| ✅ | Email Change OTP | `POST /api/auth/email-change/request`, `POST /api/auth/email-change/verify` |
| ✅ | User CRUD | `GET/POST/PUT/DELETE /api/users`, `POST /api/users/:id/email`, `POST /api/users/:id/password` |
| ✅ | Roles CRUD | `GET/POST/PUT/DELETE /api/roles`, `POST /api/roles/create-with-shift`, `GET /api/roles/assignable` |
| ✅ | Permissions | `GET /api/permissions`, `GET /api/permissions/grouped` |
| ✅ | Divisions | `GET/POST/PUT/DELETE /api/divisions`, `POST /api/divisions/batch`, `PATCH /api/divisions/:id/deactivate` |
| ✅ | Auth check & profile | `GET /api/auth/check`, `GET /api/auth/user`, `PUT /api/auth/profile` |

### Frontend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Login page | `/login` — `LoginForm` component |
| ✅ | Forgot password page | `/forgot-password` — `ForgotPassword` component |
| ✅ | Dashboard Users | `/dashboard/users` — CRUD users |
| ✅ | Dashboard Roles | `/dashboard/roles` — CRUD roles |
| ✅ | Dashboard Profil | `/dashboard/profil` — profile management |
| ✅ | Permission guard hook | `use-permission-guard.ts` |
| ✅ | Permission refresh hook | `use-permission-refresh.ts` |
| ✅ | ProtectedRoute | `components/auth/protected-route` |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Two-Factor Auth (2FA/TOTP) | Saat ini hanya OTP email, belum ada TOTP/authenticator app |
| ❌ | OAuth / SSO (Google/Microsoft) | Login hanya username+password |
| ❌ | Audit log viewer (UI) | Activity model ada tapi belum ada dashboard page khusus audit log |
| 🔧 | Division management page | Divisions API ada, tapi management mungkin embedded di settings |
| ❌ | User invitation flow | Belum ada kirim undangan via email ke user baru |
| ❌ | Bulk user import (CSV/Excel) | Belum ada |

---

## 2 · Public Content & CMS (02-public-content)

### Backend API

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Berita CRUD + publish | `GET/POST/PUT/DELETE /api/berita`, publish/unpublish, slug lookup |
| ✅ | Berita attachments | Upload image, gallery links, related content |
| ✅ | Dashboard stats | `GET /api/dashboard/stats`, `/api/dashboard/activity` |
| ✅ | Settings CRUD | `GET/PUT /api/settings`, homepage config, navbar, filosofi |
| ✅ | Public stats | `GET /api/stats` |
| ✅ | SSR / Sitemap | Server-side rendering untuk SEO, `/sitemap.xml` |

### Frontend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Homepage | `/` — Home page dengan hero, berita, stats |
| ✅ | Berita listing | `/berita` — public berita list |
| ✅ | Berita detail | `/berita/:id/:slug` — detail page |
| ✅ | Profil page | `/profil` — profil HMPS, filosofi, visi misi |
| ✅ | Dashboard index | `/dashboard` — admin dashboard stats |
| ✅ | Dashboard Berita | `/dashboard/berita` — CMS berita |
| ✅ | Dashboard Settings | `/dashboard/settings` — site settings |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Artikel/Blog terpisah dari Berita | `pages/artikel` ada tapi hanya alias/redirect ke berita detail |
| ❌ | Content versioning / draft history | Belum ada riwayat revisi berita |
| ❌ | Scheduled publishing | Belum bisa jadwalkan berita publish otomatis di waktu tertentu |
| ❌ | Content preview mode | Belum ada preview mode untuk draft sebelum publish |
| ❌ | SEO meta per-page customization (dashboard) | Meta tag ada di SSR tapi belum bisa diedit per-berita dari dashboard |
| ❌ | Announcement / banner system | Belum ada fitur announcement bar |

---

## 3 · Events & Library (03-events-library)

### Backend API

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Event Years CRUD | `GET/POST/PUT/DELETE /api/event-years`, years listing |
| ✅ | Events CRUD + nested events | Full CRUD, parent-child hierarchy, publish/unpublish |
| ✅ | Event attachments | Upload thumbnail, attachments, description media |
| ✅ | Library CRUD | `GET/POST/PUT/DELETE /api/library`, folder/file management |
| ✅ | Library relations | Related events, related berita, gallery links |
| ✅ | Author enrichment | Co-author display via sharing system |

### Frontend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Events index | `/events` — timeline/overview |
| ✅ | Events per year | `/events/:year` — events filtered by year |
| ✅ | Event detail | `/events/:year/:eventId` — full detail |
| ✅ | Events all | `/events/all` — all events listing |
| ✅ | Library listing | `/library` — browse library |
| ✅ | Library detail | `/library/:id` — detail item |
| ✅ | Dashboard Events | `/dashboard/events` — admin manage events |
| ✅ | Dashboard Library | `/dashboard/library` — admin manage library |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Event RSVP / Registration | User belum bisa daftar/RSVP ke event |
| ❌ | Event calendar view | Belum ada tampilan kalender |
| ❌ | Event reminder/notification | Belum ada reminder otomatis sebelum event |
| ❌ | Library search & filter | Search mungkin basic, belum ada filter by type/tag |
| ❌ | Library file preview (PDF/image) | Belum ada inline preview untuk file library |

---

## 4 · Organization & Prodi (04-organization-prodi)

### Backend API

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Organization periods & positions | CRUD periods, positions, structure |
| ✅ | Organization members | CRUD members, photo upload, member images |
| ✅ | Structure copy & auto-fill | Copy structure antar period, auto-fill from template |
| ✅ | Prodi CRUD | Public & manage endpoints, curriculum, labs, lecturers |
| ✅ | Prodi sync service | Sync data prodi dari external source |
| ✅ | Organization auto-fill service | Service untuk auto-fill structure |
| ✅ | Prodi student hub | Academic calendar sync, portals/guides, calendar PDF repair/upload, NIM decoder |

### Frontend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Kelembagaan page | `/kelembagaan` — public view organization |
| ✅ | Prodi page | `/prodi` — public view program studi |
| ✅ | Prodi student hub UI | Dashboard/public surfaces for calendar, portals, guides |
| ✅ | Dosen detail | `/prodi/dosen/:slug` — lecturer detail |
| ✅ | Curriculum detail | `/prodi/curriculum/:slug` — curriculum detail |
| ✅ | Lab detail | `/prodi/laboratorium/:type/:index` — lab detail |
| ✅ | Dashboard Kelembagaan | `/dashboard/kelembagaan` — manage organization |
| ✅ | Dashboard Prodi | `/dashboard/prodi` — manage prodi data |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Organization chart visual | Belum ada bagan organisasi interaktif (org chart diagram) |
| ❌ | Member portfolio/profile page | Anggota belum punya profile page individual |
| 🔧 | Prodi accreditation info | Field/UI akreditasi sudah ada di sync — pastikan docs & completeness |
| ❌ | Alumni directory | Belum ada fitur database alumni |

---

## 5 · Community Tenant (05-community-tenant)

### Backend API

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Community listing | `GET /api/communities` |
| ✅ | Community shell | `GET /api/c/:slug/info`, tenant resolver |
| ✅ | Registration codes | CRUD registration codes, OTP verify |
| ✅ | Registration submit flow | Public register, verify, community selection |
| ✅ | Registration admin | Admin manage registrations, approve/reject |
| ✅ | Tenant API & storage | Isolated storage, tenant DB, tenant models |
| ✅ | Delete/OTP repair | Community delete, OTP repair tools |

### Frontend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Register page | `/register` — public registration |
| ✅ | Communities listing | `/communities` — browse communities |
| ✅ | Community shell | `/:slug/*` — tenant SPA shell |
| ✅ | Dashboard Registration | `/dashboard/registration` — admin manage |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Community settings page (per-tenant) | Tenant admin belum bisa ubah settings community dari UI |
| 🔧 | Community branding (logo, color) | Logo navbar/favicon/SEO memakai `settings.logoUrl` (4.15.0). Color theme custom masih belum. |
| ❌ | Community member list/directory | Belum ada halaman list member community |
| ❌ | Cross-community content sharing | Belum bisa share konten antar community |
| ❌ | Community analytics dashboard | Belum ada statistik per community |

---

## 6 · Store / Toko (06-store-toko)

### Backend API

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Public storefront & settings | `GET /api/store/public/settings`, public product listing |
| ✅ | Products CRUD | Full product management, categories, images |
| ✅ | Bundles & campaigns | Bundle products, pricing campaigns |
| ✅ | Cart & bundle cart | Cart management, bundle cart |
| ✅ | Checkout & buy link | Checkout flow, buy link generation |
| ✅ | Orders & invoices | Order management, invoice generation |
| ✅ | Shipping & regional | Shipping calculation, regional API |
| ✅ | Admin store operations | Admin manage store, analytics |
| ✅ | Store media & shares | Product images, sharing |
| ✅ | Regional/shipping services | External API integration (co.id) |

### Frontend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Toko index | `/toko` — storefront |
| ✅ | Product detail | `/toko/:slug` — product page |
| ✅ | Cart page | `/toko/cart` — shopping cart |
| ✅ | Orders history | `/toko/orders` — order history |
| ✅ | Order invoice | `/toko/order/:orderNo` — invoice detail |
| ✅ | Dashboard Toko | `/dashboard/toko` — admin store management |
| ✅ | Dynamic store path | Custom navbar path via settings |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Payment gateway integration | Belum ada integrasi payment (Midtrans/Xendit/dll) |
| ❌ | Product reviews/ratings | Belum ada ulasan produk dari pembeli |
| ❌ | Wishlist | Belum ada fitur wishlist |
| ❌ | Inventory stock tracking | Stock management mungkin basic |
| ❌ | Order tracking/status update notification | Notifikasi update status order |
| ❌ | Voucher/coupon system | Campaign ada tapi belum ada voucher/kupon code |
| ❌ | Product variant (size/color) | Belum ada variant system |

---

## 7 · Media & Assets (07-media-assets)

### Backend API

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | General upload | Upload middleware, temp upload, file validation |
| ✅ | Editor content media | Berita/event content images via editor |
| ✅ | Prodi/organization media | Lecturer photo, member image, lab photo |
| ✅ | Home images & banner render | Home carousel images, dynamic banner generation |
| ✅ | Google Drive integration | Upload to GDrive, link management |
| ✅ | File scanner & cleanup | Scan files, cleanup unused uploads |
| ✅ | Asset cleanup service | Scheduled asset cleanup |
| ✅ | Banner theme/render services | Banner template rendering |
| ✅ | Home social feed (YT/IG) | `GET /api/social-feed` + manage/sync; scrape cache soft-fail |

### Frontend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Home social feed sections | Public home YT/IG blocks + dashboard settings panel |
| ✅ | MediaDisplay component | Universal media display (image, video, embed) |
| ✅ | GDriveLinkInput | Google Drive link input component |
| ✅ | GDriveFallback | Fallback component for GDrive |
| ✅ | LocalAssets | Local asset display |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Media library browser (UI) | Belum ada galeri/browser untuk semua uploaded media |
| ❌ | Image cropping/editing (UI) | Belum ada crop/edit sebelum upload |
| ❌ | Video upload & streaming | Upload video langsung (bukan embed saja) |
| ❌ | CDN integration | Belum ada CDN untuk static assets |
| ❌ | Bulk upload | Belum bisa upload multiple files sekaligus dengan progress |

---

## 8 · Collaboration, Feedback & Sharing (08-collaboration-feedback)

### Backend API

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Comments | CRUD comments untuk berita, events, library |
| ✅ | Feedback public/ratings | Public form + ratings; XSS reject; cards not auto-published; public list capped |
| ✅ | Feedback moderation/config | Admin moderation + pagination; footer display toggles |
| ✅ | Bug reports | Bug report submission & management (manual oleh user) |
| ✅ | System error monitoring (Bug Otomatis) | Capture otomatis server 5xx + error client, dedup, analisis AI OpenAI→Gemini. `GET/PATCH/POST/DELETE /api/system-errors/*` |
| ✅ | Sharing workflow | Share content (berita/events/library) antar user, approve/reject |
| ✅ | Sharing notifications | Notification on share actions |

### Frontend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Dashboard Feedback | `/dashboard/feedback` — manage feedback/bug reports |
| ✅ | Sharing UI | Share dialog integrated in berita/events/library editors |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Public feedback page | Halaman publik untuk lihat/submit feedback (non-dashboard) |
| ❌ | Discussion threads | Belum ada threaded discussions |
| ❌ | @mention system | Belum bisa mention user di komentar |
| ❌ | Real-time collaboration | Belum ada simultaneous editing |

---

## 9 · AI Chat & Notifications (09-ai-notifications)

### Backend API

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Gemini chat sessions | Chat session management, AI conversation |
| ✅ | AI tools & recommendations | Permission-aware tool-calling, content recommendations |
| ✅ | Notification stream (SSE) | Real-time notification delivery via SSE |
| ✅ | Preferences & web push | Notification preferences, VAPID web push |
| ✅ | Chat service | Gemini integration service |
| ✅ | Recommendation service | Content recommendation engine |
| ✅ | Notification orchestrator | Orchestrate notification dispatch |

### Frontend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | NotificationStream | Real-time notification listener |
| ✅ | NotificationPrompt | Web push subscription prompt |
| ✅ | AI Chat (embedded in dashboard) | Chat UI di dashboard |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Public AI chatbot page | Chatbot untuk visitor non-login |
| ❌ | Notification center (full page) | Halaman khusus daftar semua notifikasi |
| ❌ | Email notification digest | Rangkuman notifikasi via email periodik |
| ❌ | AI content generation assistant | AI bantu generate draft berita/deskripsi event |
| ❌ | Chat history export | Export riwayat chat |

---

## 10 · Ops, Security & Maintenance (10-ops-security)

### Backend

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Security middleware | Helmet, HPP, post-body sanitize, public RL (guestKey), anti-spoof/dns toggles |
| ✅ | Runtime middleware settings | Owner-only GET/PUT; `allEnabled` master + per-module flags |
| ✅ | Backup & restore | MongoDB backup/restore via API & scheduler |
| ✅ | Cleanup & migration | DB cleanup, temp file cleanup, migration scripts |
| ✅ | API docs / Swagger | OpenAPI JSON + generated HTML docs |
| ✅ | Deployment & scheduler | node-cron scheduled jobs, prod deployment config |

### Belum Ada / Potensi Upgrade

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ❌ | Health check endpoint | `GET /api/health` — status service + DB |
| ❌ | Performance monitoring (APM) | Belum ada integration (New Relic / Sentry / etc) |
| ✅ | Error tracking dashboard | Bug Otomatis (`SystemError`) — capture server 5xx + error client, dedup, analisis AI, dashboard owner di `/dashboard/feedback` |
| ❌ | Rate limit dashboard | Belum bisa lihat rate limit stats |
| ❌ | Automated DB migration versioning | Belum ada migration version tracking system |
| ❌ | CI/CD pipeline | Belum ada GitHub Actions / CI pipeline |
| ❌ | Docker containerization | Belum ada Dockerfile |
| ❌ | E2E / integration tests | Test masih minimal |

---

## 11 · Auxiliary Runtime (11-auxiliary-runtime)

### Frontend Support Layer

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Error / Not-Found pages | `pages/error.tsx`, `pages/not-found.tsx` |
| ✅ | Artikel detail alias | Redirect ke berita detail |
| ✅ | Store pricing utilities | `shared/store-pricing.ts`, `store-currency.ts`, `store-discounts.ts` |
| ✅ | Embed media utils | `shared/mediaUtils.ts`, `embed-default-hosts.ts` |
| ✅ | Dashboard Spyro context | `shared/dashboard-spyro-context.ts` |
| ✅ | Frontend route inventory | Documented in feature docs |
| ✅ | Frontend auth guards | ProtectedRoute, permission guard hook |
| ✅ | Dashboard shell components | Sidebar, navbar, layout |
| ✅ | Public UI components | LoadingScreen, MaintenanceMode, etc |
| ✅ | Client hooks & utilities | use-toast, use-pagination, use-mobile, etc |

---

## 12 · Runtime Infrastructure (12-runtime-infrastructure)

### Backend Infrastructure

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Security middleware modules | `server/security.ts`, `server/middleware/` |
| ✅ | Gemini runtime config | AI configuration |
| ✅ | Database bootstrap/backup clients | `db/mongodb.ts`, `db/mongo-seed.ts`, `db/mongodb-backup.ts` |
| ✅ | Backend relation/display helpers | `server/library-relations.ts`, `server/user-display.ts` |
| ✅ | Frontend constants/formatting | Shared constants |
| ✅ | Runtime cache/query/IP helpers | `server/lib/short-cache.ts`, `server/lib/public-json-cache.ts` |
| ✅ | Web push service worker/types | VAPID, service worker registration |
| ✅ | Dev/Swagger/runtime entry helpers | `server/swagger.ts`, `server/vite.ts`, `server/index.ts` |

---

## 13 · Documentation Standardization

| Status | Fitur | Keterangan |
|--------|-------|------------|
| ✅ | Documentation hub | `docs/` structure |
| ✅ | SOP set | `docs/SOP/01-12` |
| ✅ | Architecture docs | `docs/architecture/` |
| ✅ | Feature summary & template | `docs/features/feature-summary.md`, `feature-template.md` |
| ✅ | API endpoint docs & Swagger guide | `docs/api/endpoints.md`, OpenAPI JSON/HTML |
| ✅ | Project-local AI skills | `.agents/skills/` |
| ✅ | Category folders (01-12) | Numbered category folders with README + feature docs |
| ✅ | OpenAPI endpoint coverage | `99-openapi-endpoint-coverage.md` per category |
| ✅ | SemVer versioning per unit kerja | `docs/version/` — versions.md, template, changelogs, release/*.md |
| ✅ | SOP aligned to codebase (2026-08-06) | SOP 01–12 sync: response honesty, models location, banner-render, modular routes |

---

## 14 · Ongoing Maintenance Checklist

| Status | Task |
|--------|------|
| 🔧 | Keep `docs/api/endpoints.md` in sync with `server/routes.ts` and `server/routes/` |
| 🔧 | Keep `docs/features/feature-summary.md` in sync when routes/pages/services change |
| 🔧 | Keep OpenAPI JSON/HTML updated when API changes |
| 🔧 | Add or update numbered feature docs for every new feature |
| 🔧 | Setelah setiap unit kerja: bump `docs/version/` + sync package/OpenAPI version |
| ❌ | Add test documentation once automated tests are expanded |
| 🔧 | Periodically review tenant isolation rules |
| 🔧 | Periodically review upload/media cleanup behavior |
| 🔧 | Audit `.code-review-graph/graph.html` after visualization regeneration |
| 🔧 | Verify `package.json` SEO scripts still have target files before using in deploy |

---

## 15 · Future / Wishlist (Belum Direncanakan)

| Status | Fitur | Kategori | Keterangan |
|--------|-------|----------|------------|
| ❌ | Mobile app (React Native / PWA+) | Cross-platform | Versi mobile native |
| ❌ | Multi-language / i18n | Public Content | Dukungan Bahasa Inggris + Bahasa Indonesia |
| ❌ | Advanced analytics dashboard | Ops | Charts, visitor tracking, content performance |
| ❌ | Email newsletter | Public Content | Subscription & auto-send berita baru |
| ❌ | Social media auto-post on publish | Public Content | Auto-post ke IG/Twitter saat berita publish (home YT/IG feed scrape sudah ✅) |
| ❌ | Form builder (dynamic forms) | Collaboration | Form builder custom untuk survey/pendaftaran |
| ❌ | Calendar integration | Events | Sync ke Google Calendar / iCal |
| ❌ | Document signing | Collaboration | Tanda tangan digital untuk surat/dokumen |
| ❌ | Attendance system | Events | Absensi peserta event via QR / code |
| ❌ | Financial tracking | Store | Laporan keuangan HMPS |
| ❌ | Minutes / meeting notes | Collaboration | Notulensi rapat terintegrasi |

---

## Ringkasan Statistik

| Metrik | Jumlah |
|--------|--------|
| Total fitur yang sudah ada (✅) | **99+** |
| Total fitur yang perlu upgrade (🔧) | **9** |
| Total fitur yang belum ada (❌) | **43+** |
| Total category folders | **12** |
| Total feature docs | **114** |
| Total OpenAPI operations | **294** |
| Total OpenAPI tags | **34** |
| Documented SemVer releases | **58** (`1.0.0` … `4.14.7`) |
| Frontend routes (public) | **20+** |
| Dashboard routes (protected) | **13** |
| Backend modular route files | **10** (`server/routes/`) |
| Custom hooks | **8** |

---

*Terakhir diperbarui: 2026-08-12*
