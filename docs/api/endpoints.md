# 🔗 API Endpoints — HMPS Project HIMATIF ENCODER

> Endpoint inventory berdasarkan `server/routes.ts`, modular routers, store router, dan public SSR routes.  
> **App version:** lihat [`docs/version/versions.md`](../version/versions.md) (**4.14.7**). Terakhir sync docs: 2026-08-12.

---

## Base URL

```text
Main API    : http://localhost:5000/api
Tenant API  : http://localhost:5000/api/c/:slug
Store API   : http://localhost:5000/api/store
Public SSR  : http://localhost:5000/<route>
```

## Auth & Context Notes

- Auth menggunakan JWT cookie + session tracking.
- Dashboard/admin endpoint wajib permission server-side.
- Guest/public collaboration flow dapat memakai `x-guest-key`.
- Tenant-aware endpoint berjalan via `/api/c/:slug/*` setelah tenant resolver.
- Store endpoint mounted di `/api/store`.

---

## Endpoint Groups

| Group | Prefix | Notes |
|-------|--------|-------|
| Auth | `/api/auth` | login, session, OTP, profile, permission |
| Users/Roles/Permissions/Divisions | `/api/users`, `/api/roles`, `/api/permissions`, `/api/divisions` | identity admin |
| Berita | `/api/berita` | public + CMS + event relations |
| Library | `/api/library` | public + CMS + folder files |
| Events | `/api/events`, `/api/event-years` | archive, active home, CMS |
| Organization | `/api/organization` | periods, positions, members, auto-fill |
| Prodi | `/api/prodi` | public, manage, curriculum, media, sync |
| Settings/Home | `/api/settings`, `/api/info`, `/api/home-images` | site config, tenant/main identity, home assets |
| Social Feed | `/api/social-feed` | public YT/IG (beranda + items paginasi) + manage/logs/sync |
| Dashboard | `/api/stats`, `/api/dashboard` | stats/activity |
| Upload/GDrive | `/api/upload`, `/api/gdrive` | media and Drive integration |
| Community | `/api/communities`, `/api/registration`, `/api/register`, `/api/community` | registration + lifecycle |
| Store/Toko | `/api/store` | products, cart, orders, admin toko |
| Chat | `/api/chat` | Gemini chat |
| Comments | `/api/comments` | public/manage comments |
| Feedback | `/api/feedback` | feedback, moderation, bug reports |
| System Errors | `/api/system-errors` | bug otomatis (capture server/client, owner dashboard) |
| Sharing | `/api/sharing` | invite/request/access notifications |
| Notifications | `/api/notifications` | SSE/preferences/webpush |
| Ops | `/api/backups`, `/api/assets`, `/api/admin` | backup, cleanup, migration |

---

## Auth

```text
GET  /api/auth/login-targets
POST /api/auth/login
POST /api/auth/login/google       # public + loginLimiter: Firebase ID token Google → sesi (email terdaftar saja; 4.29.0)
GET  /api/auth/firebase-config    # public: config publik Firebase Web SDK (enabled?) (4.29.0)
POST /api/auth/logout
POST /api/auth/revoke-all-sessions
GET  /api/auth/me
GET  /api/auth/sessions
POST /api/auth/sessions/revoke
PUT  /api/auth/profile
POST /api/auth/change-password
POST /api/auth/change-password/request-otp
POST /api/auth/change-password/confirm
POST /api/auth/forgot-password/request-otp
POST /api/auth/forgot-password/verify-otp
POST /api/auth/forgot-password/confirm
POST /api/auth/change-email/request-otp
POST /api/auth/change-email/confirm
GET  /api/auth/permissions
POST /api/auth/refresh-permissions
```

## Users, Roles, Permissions, Divisions

```text
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
POST   /api/users/:id/password
POST   /api/users/:id/email
PUT    /api/users/:id/role
GET    /api/users/:id/permission-overrides
PUT    /api/users/:id/permission-overrides
GET    /api/roles
GET    /api/roles/levels
GET    /api/roles/assignable
POST   /api/roles
POST   /api/roles/create-with-shift
PUT    /api/roles/:id
DELETE /api/roles/:id
GET    /api/permissions
POST   /api/permissions
POST   /api/admin/permissions/recompute-owner
GET    /api/divisions
GET    /api/divisions/available-positions
POST   /api/divisions
POST   /api/divisions/copy
PUT    /api/divisions/:id
PUT    /api/divisions/order
DELETE /api/divisions/:id
```

## Berita

```text
GET    /api/berita
GET    /api/berita/manage
GET    /api/berita/:id
GET    /api/berita/:id/:slug
GET    /api/berita/:id([a-fA-F0-9]{24})/:slug
GET    /api/berita/slug/:slug
GET    /api/berita/:id/events
GET    /api/berita/slug/:slug/events
GET    /api/berita/:id/related
GET    /api/berita/slug/:slug/related
POST   /api/berita
PUT    /api/berita/:id
DELETE /api/berita/:id
POST   /api/berita/:id/copy-to-event
POST   /api/berita/:id/attach-event
DELETE /api/berita/:id/attach-event/:eventId
```

## Library

```text
GET    /api/library
GET    /api/library/manage
GET    /api/library/:id
GET    /api/library/slug/:slug
GET    /api/library/:libraryId/folder/:folderId/files
POST   /api/library
PUT    /api/library/:id
DELETE /api/library/:id
```

## Events

```text
GET    /api/event-years
GET    /api/event-years/:id/events-count
POST   /api/event-years
PATCH  /api/event-years/:id
PATCH  /api/event-years/:id/activate
PATCH  /api/event-years/:id/deactivate
DELETE /api/event-years/:id
GET    /api/events/published
GET    /api/events/active-home
GET    /api/events/by-year/:year
GET    /api/events/year/:year/slug/:slug
GET    /api/events
GET    /api/events/:id
POST   /api/events
PATCH  /api/events/:id
DELETE /api/events/:id
POST   /api/events/:id/copy-to-berita
POST   /api/events/:id/attach-berita
DELETE /api/events/:id/attach-berita/:beritaId
```

## Organization

```text
GET    /api/organization/periods
POST   /api/organization/periods
DELETE /api/organization/periods/:period
GET    /api/organization/positions
GET    /api/organization/positions/:period
POST   /api/organization/positions
POST   /api/organization/positions/copy
POST   /api/organization/structure/copy
POST   /api/organization/structure-auto-fill
POST   /api/organization/structure-auto-fill/apply
DELETE /api/organization/positions/:period
GET    /api/organization/members
GET    /api/organization/members/:id
POST   /api/organization/members
PUT    /api/organization/members/:id
DELETE /api/organization/members/:id
```

## Prodi

```text
GET  /api/prodi
GET  /api/prodi/preview
GET  /api/prodi/manage
GET  /api/prodi/curriculum/:year
PUT  /api/prodi/manage
POST /api/prodi/curriculum/year
POST /api/prodi/upload/photo/member
POST /api/prodi/upload/photo/lab
POST /api/prodi/upload/photo/org-structure
POST /api/prodi/sync/run
POST /api/prodi/calendar/upload
```

Notes (4.13.0+): `GET /api/prodi` returns `curriculumByLevel.{s1,s2}` and `curriculumMeta.levels`; flat `curriculumByYear` remains S1-only for compatibility. `POST /api/prodi/curriculum/year` accepts optional `level` (`s1`|`s2`). Sync scope `curriculum` crawls undergraduate + master years.

## Settings, Home Images, Dashboard

```text
GET    /api/info              # { slug, name, isTenant } — via /api/c/:slug/info on tenant
GET    /api/settings
PUT    /api/settings
PUT    /api/settings/home-config
PUT    /api/settings/home-image-slots
POST   /api/settings/reset
GET    /api/settings/middleware   # mainOnly + owner only (+ middleware.manage)
PUT    /api/settings/middleware   # mainOnly + owner only; toggles allEnabled + per-module flags
GET    /api/home-images/active
GET    /api/home-images
POST   /api/home-images
PUT    /api/home-images/:year
DELETE /api/home-images/:year
POST   /api/home-images/:year/set-active
POST   /api/home-images/:year/copy
POST   /api/home-images/:year/upload/:slot
POST   /api/home-images/:year/upload-person/:slot
POST   /api/home-images/:year/banner-render
DELETE /api/home-images/:year/slot/:slot
DELETE /api/home-images/:year/person/:slot
GET    /api/stats
GET    /api/dashboard/stats
GET    /api/dashboard/activities
POST   /api/dashboard/log-activity
GET    /api/dashboard/visitor-stats
GET    /api/dashboard/active-visitors
GET    /api/dashboard/engagement-heatmap
GET    /api/dashboard/berita-leaderboard   # ?range=1d|3d|7d|30d|all&metric=views|comments
GET    /api/dashboard/system-health
GET    /api/og/drive/:fileId           # thumbnail og:image galeri Drive (publik, hanya file galeri published, cache 7 hari)
GET    /api/og/berita/:hash            # JPEG share-safe cover berita lokal untuk WhatsApp/Facebook (cache 7 hari)
GET    /api/dashboard/processes        # ?sort=cpu|memBytes|diskReadRate|diskPercent|sockets|threads|uptimeSec|pid|name&dir=asc|desc&limit=5..100 · perm overview.process_monitor (default Owner) · situs utama saja
GET    /api/dashboard/security-monitor
GET    /api/dashboard/login-attempts
GET    /api/dashboard/content-performance
```

## Social Feed (YouTube / Instagram beranda)

```text
GET  /api/social-feed              # public: slice beranda per kategori + counts + live (4.25.0; profiles + pinned 4.27.0)
GET  /api/social-feed/items        # public: paginasi ?platform=youtube|instagram&kind=&offset=&limit= (4.25.0; profiles + pinned 4.27.0)
GET  /api/social-feed/manage       # auth + social_feed.view (config, cache, status, logs, jadwal, instagramSession 4.26.0)
GET  /api/social-feed/manage/logs  # auth + social_feed.view (4.25.0)
PUT  /api/social-feed/manage       # auth + social_feed.edit (config v2, Zod)
POST /api/social-feed/sync         # auth + social_feed.sync, body {platform?, full?}, cooldown 60 dtk → 429; backfill → 202 (4.27.0)
```

## Upload & Google Drive

```text
POST /api/upload
POST /api/upload/content-image
POST /api/upload/event-content-image
POST /api/upload/berita-attachment
POST /api/upload/filosofi
POST /api/gdrive/check-access
POST /api/gdrive/media-url
POST /api/gdrive/folder-contents
GET  /api/gdrive/stream/:fileId
GET  /api/test/protection
```

## Community Registration & Lifecycle

```text
GET    /api/communities
GET    /api/registration/codes
POST   /api/registration/codes
PATCH  /api/registration/codes/:id
DELETE /api/registration/codes/:id
DELETE /api/registration/codes/:id/permanent
GET    /api/registration/communities
GET    /api/registration/communities/health
POST   /api/register/validate-code
POST   /api/register/upload
POST   /api/register/community
PUT    /api/registration/communities/:id
DELETE /api/registration/communities/:id
POST   /api/registration/communities/:id/repair
POST   /api/registration/communities/:id/request-delete-otp
POST   /api/registration/communities/:id/verify-delete-otp
POST   /api/community/request-delete-otp
POST   /api/community/verify-delete-otp
DELETE /api/community
```

## Store / Toko — `/api/store`

```text
GET    /public/settings
GET    /public/products
GET    /public/products/:slug
GET    /public/categories
GET    /public/campaigns
GET    /public/bundles
GET    /public/bundles/:slug
GET    /public/gdrive-image/:fileId
GET    /public/regional/provinces
GET    /public/regional/provinces/:code/regencies
GET    /public/regional/regencies/:code/districts
GET    /public/regional/districts/:code/villages
GET    /cart
POST   /cart/items
PATCH  /cart/items/:productId
DELETE /cart/items/:productId
POST   /cart/bundles                             # body: bundleId, qty, selections[{itemIndex,variantId}] (isi paket mode "pilih ukuran")
PATCH  /cart/bundles/:bundleId                   # ?lineKey= untuk baris dengan pilihan ukuran tertentu
DELETE /cart/bundles/:bundleId                   # ?lineKey=
POST   /cart/draft
POST   /checkout
POST   /direct-checkout
POST   /buy-link
POST   /shipping/quote
GET    /my-orders
GET    /orders/:orderNo
POST   /payment-preview                          # hitung DP/sisa & pemisahan pesanan per kanal bayar (sebelum checkout)
POST   /orders/:orderNo/payment-proof            # pembeli upload bukti bayar (gambar ≤5MB → WebP di DB); ?inv= / sesi
GET    /orders/:orderNo/payment-proof/:paymentId # pembeli lihat bukti sendiri (private, no-store)
POST   /orders/:orderNo/email                     # pembeli menambah/mengganti email (kabar pesanan); ?inv= / sesi
POST   /orders/:orderNo/cancel                   # batal sendiri bila belum bayar; selain itu permintaan batal ke admin
GET    /admin/orders/:orderNo/payment-proof/:paymentId   # admin lihat bukti
PATCH  /admin/orders/:orderNo/payments/:paymentId        # admin verify|reject{reason}[, amount]
POST   /admin/orders/:orderNo/payments                   # admin catat pembayaran manual (terverifikasi)
GET    /admin/preorders                                  # daftar pesanan pre-order (?paymentStatus=&overdue=1)
GET    /admin/access-summary
GET    /admin/settings
PUT    /admin/settings
GET    /admin/products
POST   /admin/products
GET    /admin/products/:id
PATCH  /admin/products/:id
DELETE /admin/products/:id
PATCH  /admin/products/reorder
GET    /admin/products/:id/shares
POST   /admin/products/:id/shares
DELETE /admin/shares/:shareId
GET    /admin/categories
POST   /admin/categories
PATCH  /admin/categories/:id
DELETE /admin/categories/:id
GET    /admin/bundles
POST   /admin/bundles
GET    /admin/bundles/:id
PATCH  /admin/bundles/:id
DELETE /admin/bundles/:id
GET    /admin/campaigns
POST   /admin/campaigns
PATCH  /admin/campaigns/:id
DELETE /admin/campaigns/:id
GET    /admin/orders
PATCH  /admin/orders/:orderNo
DELETE /admin/orders
DELETE /admin/orders/:orderNo
POST   /admin/upload-product-image
POST   /admin/uploads/cleanup
```

## Chat, Comments, Feedback, Sharing, Notifications

```text
# /api/chat
GET /all
POST /new
DELETE /:id
GET /:id/messages
GET /history
POST /message
DELETE /
GET /debug/apikeys

# /api/ai
POST /enhance-content   # auth + permission: perbaiki teks form dashboard (before/after JSON)

# /api/comments
GET /
GET /count
GET /manage
POST /                 # commentRateLimiter; body/displayName plain-text sanitized (XSS reject)
PATCH /:id             # body sanitized
DELETE /:id

# /api/feedback
POST /                 # public + feedbackRateLimiter; body/extraFields XSS-rejected; isVisibleCard default false; stores ipHash
GET /public            # query: limit (default 40, max 100); only isVisibleCard=true
GET /ratings
PATCH /own/:id         # guest key; body plain-text sanitized
DELETE /own/:id
GET /manage            # auth feedback.view; query page/limit default 1/20 (max 100)
GET /manage/ratings
GET /manage/counts-by-target
PATCH /manage/:id/visibility
POST /manage/:id/reply
POST /manage/:id/decision
PATCH /manage/:id
DELETE /manage/:id
GET /config
GET /manage/config
PATCH /manage/config
PATCH /manage/footer-display
POST /bug-report
GET /bug-report/count
GET /bug-report/list          # owner: filter status/dateFrom/dateTo/q/sort/page/limit
PATCH /bug-report/:id/status
POST /bug-report/:id/reply
DELETE /bug-report/:id

# Pindah peran (4.46.0)
POST   /api/auth/switch-to-staff  # pembeli (email terverifikasi, juga pengurus) → sesi pengurus; 403 bila bukan pengurus, 409 bila perlu pilih konteks
POST   /api/buyer/from-staff      # pengurus login → buka/buat akun pembeli (email pengurus, password disalin), sesi pembeli terbit

# /api/auth/google/identify  (pintu login tunggal, tanpa sesi)
POST   /api/auth/google/identify  # publik: {idToken} → {email, name, isStaff, isBuyer}; klien memilih alur pengurus/pembeli/pilih/onboarding

# Ulasan produk (4.47.0) — tenant-aware: /api/store/* dan /api/c/:slug/store/*
GET    /api/store/public/products/:id/reviews      # publik: ringkasan bintang + daftar (?page&limit<=20&sort=new|high|low&star=1-5; sort=media = hanya yang ada foto/video) + viewer {canReview, mine}
GET    /api/store/orders/:orderNo/reviews          # pembeli: produk di pesanan + ulasannya
POST   /api/store/orders/:orderNo/reviews          # pembeli (multipart: productId, rating 1-5, comment<=1000, anonymous, media[] maks 4 foto + 1 video); pesanan harus selesai, 1 pesanan x 1 produk = 1 ulasan
PATCH  /api/store/reviews/:id                      # pemilik (multipart; keepMedia = JSON URL yang dipertahankan)
DELETE /api/store/reviews/:id                      # pemilik
POST   /api/store/reviews/:id/report               # publik, 1 laporan per pelapor: {reason: spam|kasar|tidak_relevan|privasi|lainnya, note<=200}
GET    /api/store/admin/reviews                    # toko.reviews.manage / toko.manage (?filter=all|reported|hidden&q&page)
GET    /api/store/admin/reviews/:id/reports
PATCH  /api/store/admin/reviews/:id                # {status: visible|hidden, reason}
DELETE /api/store/admin/reviews/:id

# /api/buyer  (Akun pembeli toko — terpisah dari akun staf; juga /api/c/:slug/buyer/*)
POST   /register              # publik: daftar (nama, email, password, phone?) → OTP email
POST   /register/verify       # publik: {challengeId, code} → login + klaim pesanan lama
POST   /login                 # publik: email + password
POST   /google                # publik: {idToken} Firebase → masuk; bila belum punya akun → {needsOnboarding, email, name} (akun BELUM dibuat)
POST   /google/complete       # publik: {idToken, name, phone?, password, confirmPassword} → buat akun (email dari Google), masuk, klaim pesanan lama
POST   /logout                # cabut sesi saat ini
GET    /me                    # akun yang login (null bila tamu)
PATCH  /me                    # pembeli: nama, phone, notifyPrefs {orderStatus, paymentReminders}
POST   /password/otp          # publik/pembeli: OTP atur ulang password (jawaban sama walau email tak terdaftar)
POST   /password/reset        # publik: {challengeId, code, newPassword} → cabut semua sesi lama
POST   /email/change          # pembeli: {newEmail} → OTP ke email baru
POST   /email/verify          # pembeli: {challengeId, code}
GET    /orders                # pembeli: pesanan di semua toko (utama + komunitas)
POST   /orders/claim          # pembeli: {link} link invoice berisi ?inv=
GET    /sessions              # pembeli: sesi aktif (device, ip, location, createdAt, lastActive, current)
DELETE /sessions/:id          # pembeli: cabut sesi
POST   /sessions/revoke-others # pembeli: keluar dari perangkat lain
GET    /addresses             # pembeli: alamat tersimpan
PUT    /addresses             # pembeli: {addresses[]} maks 5, satu utama
GET    /favorites?store=      # pembeli: favorit per toko (main | slug komunitas)
PUT    /favorites             # pembeli: {store, productIds[]}
POST   /delete/otp            # pembeli: kirim kode konfirmasi hapus akun
POST   /delete                # pembeli: {challengeId, code} → anonimkan akun, keluar semua perangkat

# /api/store/admin/customers  (Pelanggan toko — akun pembeli yang pernah memesan di toko ini)
GET    /                      # toko.customers.view | toko.manage (email/HP disamarkan tanpa toko.customers.manage)
GET    /:id                   # detail + pesanan di toko ini
PATCH  /:id/status            # toko.customers.manage, hanya toko utama: {status: active|blocked} (blokir = keluar semua perangkat)

# /api/system-errors  (Bug Otomatis)
POST   /report            # publik + optional auth, rate-limited (lapor dari client)
GET    /list              # owner: filter status/severity/source/statusCode/excludeStatusCode/isTenant/communitySlug/dateFrom/dateTo/q/sort/page/limit
GET    /count             # owner: ringkasan status, severity, dan byStatusCode (0 = error client)
GET    /:id               # owner: detail
PATCH  /:id/status        # owner: new|investigating|resolved|ignored
POST   /:id/analyze       # owner: jalankan ulang analisis AI
POST   /cleanup-noise    # owner: hapus catatan lama yang bukan bug (404 probe bot, noise browser); {dryRun:true} hanya menghitung
DELETE /:id               # owner: hapus

# /api/sharing
POST /:entityType/:entityId/invite
POST /:entityType/:entityId/request
POST /decision/:sharingId
DELETE /:entityType/:entityId/access/:userId
GET /my-summary
GET /notifications
POST /notifications/read
GET /users/search
GET /:entityType/:entityId
GET /requestable

# /api/notifications
GET /stream
GET /stream/stats
GET /preferences
PATCH /preferences
GET /webpush/vapid-key
GET /webpush/subscription-status
POST /webpush/subscribe
DELETE /webpush/unsubscribe
```

## Ops

```text
GET  /api/backups/monthly
POST /api/backups/now
POST /api/backups/restore/request-otp
POST /api/backups/restore/confirm
POST /api/assets/cleanup-orphans
POST /api/admin/migrate-community-media
```

## Public SSR / SPA Routes

```text
GET /sitemap.xml          # main + active tenant landing/berita; 200 even on generator error
GET /:slug                # tenant SSR shell (active community only)
GET /:slug/berita/:articleSlug
GET /
GET /berita
GET /berita/:id/:slug
GET /berita/:slugOrId
GET /events
GET /events/:year/:eventId
GET /library
GET /library/:id
GET /toko
GET /toko/:slug
GET /profil
GET /kelembagaan
GET /prodi
GET /login
GET /error
GET /^\/dashboard(\/.*)?$/
```

Sitemap helper: `server/services/seo-sitemap.ts` (image/video namespaces for Google/Bing discovery).

---

## OpenAPI

- Static spec: [`../openapi.json`](../openapi.json)
- HTML viewer: [`../api-docs.html`](../api-docs.html)
- Regenerate HTML: `npm run docs:api-html`

---

*Terakhir diperbarui: 2026-08-12*
