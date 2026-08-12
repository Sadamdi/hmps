# Changelog — HMPS Project (HIMATIF ENCODER)

Mengikuti [Keep a Changelog](https://keepachangelog.com/). Tanggal `YYYY-MM-DD`.  
SemVer per **unit kerja**. Detail lengkap: [release/](../release/) · Template: [version-template.md](../version-template.md).

---

## [Unreleased]

_Tidak ada. Setelah selesai mengerjakan, pindahkan item ke versi baru._

---

## [4.16.3] — 2026-08-12

**Deploy: paksa rebuild jika dist stale** · PATCH · [Full release notes](../release/4.16.3.md)

### Highlights
- Cegah auto-deploy stuck: git baru tapi bundle lama setelah build gagal + restore dist

---

## [4.16.2] — 2026-08-12

**Fix AOS invisible sections + navbar/about regressions** · PATCH · [Full release notes](../release/4.16.2.md)

### Highlights
- Section hilang setelah loading (struktur, galeri, event, berita detail) — diperbaiki
- Menu mobile kembali kanan atas; tentang kami galeri melayang; berita kartu unified

---

## [4.16.1] — 2026-08-12

**Mobile grid galeri/toko + teks tentang ringkas** · PATCH · [Full release notes](../release/4.16.1.md)

### Highlights
- Galeri & toko home: grid 2 kolom compact di mobile (bukan 1 kolom besar)
- Tentang kami & profil: clamp teks lebih pendek sebelum expand

---

## [4.16.0] — 2026-08-12

**Full platform UX redesign** · MINOR · [Full release notes](../release/4.16.0.md)

### Highlights
- Berita mobile 2×2 compact; tentang/profil collapsible; FAB anti-overlap
- Loading fail-safe 3s + AOS off mobile; dashboard shell + kelembagaan manual-first

---

## [4.15.3] — 2026-08-12

**Tenant empty chrome fallback Himatif** · PATCH · [Full release notes](../release/4.15.3.md)

### Highlights
- Tenant belum di-setup tidak lagi hero gelap + footer kosong
- Hero/footer/about/visi/tagline kosong memakai default Himatif; identitas tenant tetap

---

## [4.15.2] — 2026-08-12

**Tenant breadcrumb + hero fallback** · PATCH · [Full release notes](../release/4.15.2.md)

### Highlights
- Breadcrumb Login tenant tidak lagi double-slug (`/:slug/:slug`)
- Hero tenant tanpa banner tidak jatuh ke logo Himatif (main tetap pakai default)

---

## [4.15.1] — 2026-08-12

**Tenant route gate + vite deploy harden** · PATCH · [Full release notes](../release/4.15.1.md)

### Highlights
- Path tenant tidak lagi tertahan di store-path gate Himatif (spinner / homepage salah)
- Slug komunitas tidak valid tetap 404, tidak auto-redirect ke beranda Himatif
- `vite`/`esbuild` di `dependencies` + deploy cek bin executable + auto-deploy unset `NODE_ENV=production` saat npm install

---

## [4.15.0] — 2026-08-12

**Tenant URL, SEO, logo, dan isolasi auth** · MINOR · [Full release notes](../release/4.15.0.md)

### Highlights
- Canonical/og/sitemap/SSR tenant memakai `/{slug}/...` dan logo komunitas
- Login/beranda tenant tidak spinner abadi (timeout auth + skip loading screen Himatif)
- JWT Himatif tidak lagi dianggap login di tenant
- Register menolak slug reserved; `/api/info` identitas main/tenant

---

## [4.14.7] — 2026-08-12

**Safe rebuild + contributor history rewrite** · PATCH · [Full release notes](../release/4.14.7.md)

### Highlights
- Backup `dist` sebelum build; restore jika gagal (hindari 404/502)
- Rewrite author historis + force-push: hanya Sadamdi dan addid-cloud
- Alur auto: push media baru → pull code baru → rebuild hanya jika runtime

---

## [4.14.6] — 2026-08-12

**Deploy skip docs-only + vite install harden** · PATCH · [Full release notes](../release/4.14.6.md)

### Highlights
- Push docs/skills tidak lagi stop PM2 / rebuild
- `npm install --include=dev` agar vite tidak terhapus (akar 502)
- Healthcheck `:5000` setelah restart; media commit memakai identity Adam

---

## [4.14.5] — 2026-08-12

**Docs, branding, contributors, and agent sync** · PATCH · [Full release notes](../release/4.14.5.md)

### Highlights
- README contact: `https://himatif-encoder.com` + `himatif.encoder@gmail.com`; hapus blurb 11 kategori
- Default `contactEmail` app/seed ke Gmail resmi (bukan `hmti@uin-malang.ac.id`)
- Living docs + SOP 07 selaras ops aktual; contributor resmi hanya @Sadamdi + @addid-cloud

---

## [4.14.4] — 2026-08-08

**Media SEO: image/video sitemap + richer schema** · PATCH · [Full release notes](../release/4.14.4.md)

### Highlights
- Sitemap dinamis dengan ekstensi `image:` / `video:` (berita, event, galeri, toko)
- JSON-LD ImageObject / VideoObject + title SERP ~60 karakter
- robots.txt allow media publik; Organization/WebSite di homepage

---

## [4.14.3] — 2026-08-08

**Nginx CSP fix + official berita import** · PATCH · [Full release notes](../release/4.14.3.md)

### Highlights
- CSP hanya dari Node agar embed allowlist efektif
- Kartu tautan untuk situs yang menolak iframe (wreckit.id)
- Import 9 berita prestasi/seminar dari Prodi TI

---

## [4.14.2] — 2026-08-08

**Embed allowlist, tag merge pass-2, AI berita fields** · PATCH · [Full release notes](../release/4.14.2.md)

### Highlights
- Embed: wreckit.id + maps/wp.com CDN di allowlist owner
- Tag merge: teknik/informatika/encoder/raker dll. (58→52)
- Enhance + Spyro berita: tags; Spyro cover URL opsional

---

## [4.14.1] — 2026-08-08

**WrecK-IT meta Tanggal/Waktu/Tempat + tags scroll all** · PATCH · [Full release notes](../release/4.14.1.md)

### Highlights
- WrecK-IT: meta 🗓 Tanggal / 🕖 Waktu / 📍 Tempat
- Existing tags: scroll semua (tanpa potong 20)
- AI skeleton berita selalu Tanggal/Waktu/Tempat

---

## [4.14.0] — 2026-08-08

**Berita Medinfo skeleton, AI style, tags UI, tag merge** · MINOR · [Full release notes](../release/4.14.0.md)

### Highlights
- AI berita mengikuti skeleton meta + h3 Medinfo
- Existing tags: collapse, search, max 20
- Production tag merge (case/sinonim)

---

## [4.13.0] — 2026-08-08

**Kurikulum S2 (level s1/s2) + sync magister** · MINOR · [Full release notes](../release/4.13.0.md)

### Highlights
- Model kurikulum per `level` S1/S2
- Sync magister 2022 (HTML) + 2024 (PDF OBE)
- UI switcher S1/S2 di `/prodi` dan dashboard

---

## [4.12.1] — 2026-08-08

**Prodi sync: S2 accreditation + curriculum index** · PATCH · [Full release notes](../release/4.12.1.md)

### Highlights
- Akreditasi S2 source → `/master-study-s2/` (halaman certificate lama 404)
- Merge item akreditasi historis + crawl baru
- Seed kurikulum S1 2020 + 2024 meski index card `href="#"`

### Commits
lihat git log setelah release

---

## [4.12.0] — 2026-08-06

**Rich release notes + full docs/API inventory sync** · MINOR · [Full release notes](../release/4.12.0.md)

### Highlights
- Template + all historical releases enriched
- Docs/API/OpenAPI/feature indexes synced to codebase
- Current version 4.12.0

### Commits
0 commit(s): `ac6cb5f`..`HEAD`

---

## [4.11.0] — 2026-08-06

**Versioning system, SOP sync & docs audit** · MINOR · [Full release notes](../release/4.11.0.md)

### Highlights
- docs(version): add SemVer per work unit, sync SOP with codebase

### Commits
1 commit(s): `ac6cb5f`..`ac6cb5f`

---

## [4.10.0] — 2026-07-16

**Home YT/IG social feed** · MINOR · [Full release notes](../release/4.10.0.md)

### Highlights
- Clean Prodi student-hub scrapes and add announcement pagination.
- Add home YT/IG social feed scrape and harden Prodi student-hub sync.
- Fix YT channel resolve, harden IG scrape, and add medsos navbar items.
- Rewrite social feed filters with youtubei.js tab scrape and fair mix.
- Harden YT tab scrape filters and soft-fail IG keep-cache.

### Commits
7 commit(s): `7cb681a`..`c3253a1`

---

## [4.9.0] — 2026-07-15

**Prodi student hub & input security** · MINOR · [Full release notes](../release/4.9.0.md)

### Highlights
- Harden global input security, clear feedback spam path, and fix tenant home defaults.
- Add Prodi student hub: academic calendar sync, portals, and guides.
- Expand UIN NIM decoder to full campus catalog (S1-S3/profesi).
- Fix Prodi calendar PDF on prod and expand student-hub dashboard.
- Refresh expired calendar PDF tokens from announcement pages on repair.

### Commits
6 commit(s): `2309f5e`..`dfccfb8`

---

## [4.8.1] — 2026-07-05

**Deploy scripts & PM2 ops tooling** · PATCH · [Full release notes](../release/4.8.1.md)

### Highlights
- chore(ops): script deploy server + sync media
- fix(ops): pm2 restart hmps-app + himatif-banner
- Update
- Enchance tools

### Commits
4 commit(s): `ec7b56b`..`28791b6`

---

## [4.8.0] — 2026-06-28

**Error monitoring with AI analysis** · MINOR · [Full release notes](../release/4.8.0.md)

### Highlights
- feat(monitoring): bug otomatis server 5xx + error tampilan ke dashboard owner + AI analysis
- fix(monitoring): OpenAI-compatible jadi AI utama, Gemini fallback + perbaikan dari audit
- feat(monitoring): perluas capture ke semua endpoint (main+tenant) + log lebih lengkap

### Commits
3 commit(s): `751d8d5`..`37cc9f5`

---

## [4.7.1] — 2026-05-13

**SEO refresh** · PATCH · [Full release notes](../release/4.7.1.md)

### Highlights
- Update SEO
- Update seo
- Update seo

### Commits
3 commit(s): `1932a98`..`0ac1992`

---

## [4.7.0] — 2026-05-08

**Formal project docs & AI context** · MINOR · [Full release notes](../release/4.7.0.md)

### Highlights
- Update Docs
- Update docs
- Update master to do
- Update AI
- Update

### Commits
6 commit(s): `5f4fd20`..`9d1e964`

---

## [4.6.0] — 2026-05-01

**Store/Toko refinements** · MINOR · [Full release notes](../release/4.6.0.md)

### Highlights
- Update Store
- Update File
- Update
- Update Toko
- Update Mark

### Commits
6 commit(s): `2b1f582`..`6c62a46`

---

## [4.5.2] — 2026-04-26

**Embeds & navbar polish after editor work** · PATCH · [Full release notes](../release/4.5.2.md)

### Highlights
- fix embed
- Update
- UPdate
- Update
- Update

### Commits
16 commit(s): `4b37f67`..`f45826c`

---

## [4.5.1] — 2026-04-25

**TinyMCE upload & berita file attachments** · PATCH · [Full release notes](../release/4.5.1.md)

### Highlights
- Update tinymce
- Update tinymce fix bug
- Update fix bug
- add image
- Update fix bug

### Commits
11 commit(s): `8965bbe`..`c926b99`

---

## [4.5.0] — 2026-04-21

**Notification system overhaul** · MINOR · [Full release notes](../release/4.5.0.md)

### Highlights
- Update Notif
- Update notif bug
- Fix notif
- Update Notif System
- Update Notif System

### Commits
8 commit(s): `8340138`..`07f10b7`

---

## [4.4.1] — 2026-04-20

**Store middleware & DB lag fixes** · PATCH · [Full release notes](../release/4.4.1.md)

### Highlights
- Update
- Fix middleware
- Update
- Fix DB LAG
- Fix Lag

### Commits
5 commit(s): `2516f00`..`2bc8805`

---

## [4.4.0] — 2026-04-18

**Store katalog & theme toggle** · MINOR · [Full release notes](../release/4.4.0.md)

### Highlights
- BIG Update, Add Store Katalog
- Change ui toogle light dark mode
- Fix cant login

### Commits
3 commit(s): `308cc77`..`0c4d7bd`

---

## [4.3.1] — 2026-04-14

**Protection, sync & tenant hardening cluster** · PATCH · [Full release notes](../release/4.3.1.md)

### Highlights
- Update fix bug
- Update fix
- update
- sync
- Fix User Management

### Commits
40 commit(s): `10a0f80`..`6029638`

---

## [4.3.0] — 2026-04-10

**Hero motion, feedback uploads & AI UI** · MINOR · [Full release notes](../release/4.3.0.md)

### Highlights
- Add Smoothly Animation on Hero Section
- Add Image feedback on dashboard
- Fix uplaod feedback
- fix animation hero
- Fix Bug Animation Hero

### Commits
9 commit(s): `e808512`..`e983308`

---

## [4.2.0] — 2026-04-08

**Tenant AI fixes & Prodi akreditasi** · MINOR · [Full release notes](../release/4.2.0.md)

### Highlights
- Fix Bug
- update
- update
- fix ai komunitas
- fix ai komunitas

### Commits
10 commit(s): `5829f14`..`4a03177`

---

## [4.1.1] — 2026-04-07

**Berita/gallery/events routing & komunitas fixes** · PATCH · [Full release notes](../release/4.1.1.md)

### Highlights
- Update berita routing
- Update Routing for Galery and Events
- Fix some Bug
- Fix Something
- Fix bug

### Commits
12 commit(s): `55654e8`..`c67c32d`

---

## [4.1.0] — 2026-04-05

**Home banner, gallery & rich embeds** · MINOR · [Full release notes](../release/4.1.0.md)

### Highlights
- Add Home Banner Editor
- Update Context Spyro AI
- Update Galery Checkpoint 1
- Update Galery Checkpoint 2
- Update Embed All External Link on Description Berita, Galery, Events

### Commits
13 commit(s): `71f69c6`..`36d7040`

---

## [4.0.0] — 2026-04-03

**Community tenants & registration** · MAJOR · [Full release notes](../release/4.0.0.md)

### Highlights
- Big Update, add Comunity and Add Register and Fixing many bugs
- remore something
- Fixing Bug
- Fix Bug
- fix bug home image preview

### Commits
7 commit(s): `b179ca6`..`f65ac38`

---

## [3.6.0] — 2026-03-23

**Comments, DB key logic & permission settings** · MINOR · [Full release notes](../release/3.6.0.md)

### Highlights
- Update Logic Key
- Update Fix
- Update logic db
- Update db
- Add Comment

### Commits
10 commit(s): `cf04be8`..`7c462bc`

---

## [3.5.0] — 2026-03-22

**Prodi pages & Spyro updates** · MINOR · [Full release notes](../release/3.5.0.md)

### Highlights
- Add Page Prodi
- Update Prodi
- Update fix bug
- Update Spyro AI
- Fix Up

### Commits
5 commit(s): `322c7f9`..`d30ac20`

---

## [3.4.0] — 2026-03-20

**Backup, section settings & sharing access** · MINOR · [Full release notes](../release/3.4.0.md)

### Highlights
- Add Perm
- Add Backup
- Update
- Add Section Setting
- Add Button Struktur Orga

### Commits
9 commit(s): `a10b02d`..`f1586cb`

---

## [3.3.0] — 2026-03-18

**Email OTP auth & Berita rename** · MINOR · [Full release notes](../release/3.3.0.md)

### Highlights
- Add OTP
- Fix Bug
- Add Email OTP
- Add Email Login
- Update Database

### Commits
14 commit(s): `0e35509`..`8a4ffd5`

---

## [3.2.0] — 2026-03-17

**Events page & view counters** · MINOR · [Full release notes](../release/3.2.0.md)

### Highlights
- Update Site Setting Home Card
- Add Event Page
- Add ViewCount
- Update ViewCount
- Add Animation on Event

### Commits
6 commit(s): `b4fa251`..`ecff47e`

---

## [3.1.0] — 2026-03-16

**Mobile nav, maps, 404 & stats UX** · MINOR · [Full release notes](../release/3.1.0.md)

### Highlights
- Add Navbar Animation Mobile
- Update[
- Update Dashboard and navbar
- Add Gmaps
- update

### Commits
10 commit(s): `1f5e99d`..`43fdb12`

---

## [3.0.0] — 2026-03-15

**Big UI relaunch & sitewide AI agent** · MAJOR · [Full release notes](../release/3.0.0.md)

### Highlights
- Big UI Update
- Fix Navbar and animation loading
- Add AI Agent on All Page
- Update AI
- Fix Animation

### Commits
12 commit(s): `2eebef4`..`1995ddf`

---

## [2.15.1] — 2025-10-15

**Pre-hiatus interim update** · PATCH · [Full release notes](../release/2.15.1.md)

### Highlights
- New Update

### Commits
1 commit(s): `c9e5691`..`c9e5691`

---

## [2.15.0] — 2025-10-04

**Security middleware stack** · MINOR · [Full release notes](../release/2.15.0.md)

### Highlights
- Middleware
- Middleware
- Middleware
- Middleware
- Middleware

### Commits
18 commit(s): `ba30c95`..`915da45`

---

## [2.14.1] — 2025-09-29

**Logo, middleware settings & license** · PATCH · [Full release notes](../release/2.14.1.md)

### Highlights
- Optimize
- Logo
- Middleware Setting
- License

### Commits
4 commit(s): `5260005`..`0e0223c`

---

## [2.14.0] — 2025-09-17

**Sessions, revoke, article suggestions & security** · MINOR · [Full release notes](../release/2.14.0.md)

### Highlights
- Article Upload Fix
- Suggestion Article
- User Profile Role
- Fitur Revoke
- Session

### Commits
13 commit(s): `eabd229`..`302a3ce`

---

## [2.13.0] — 2025-09-16

**Permission matrix & user management overhaul** · MINOR · [Full release notes](../release/2.13.0.md)

### Highlights
- Permission Update
- Permission Update
- Setting Permission
- Setting dashboard
- Setting dashboard

### Commits
27 commit(s): `828dd98`..`96b4a33`

---

## [2.12.0] — 2025-09-14

**Roles, permissions & chat personalization** · MINOR · [Full release notes](../release/2.12.0.md)

### Highlights
- Organization, Role update
- Fix Permission
- Fix Role Permission
- Change About me
- Footer

### Commits
10 commit(s): `36ffd26`..`567956f`

---

## [2.11.0] — 2025-09-07

**Spyro AI & dashboard motion UI** · MINOR · [Full release notes](../release/2.11.0.md)

### Highlights
- Spyro AI
- Setting Changes
- Setting Changes
- Add Animation on Organization Member
- Sidebar dashboard UI changes

### Commits
6 commit(s): `85c8248`..`090480b`

---

## [2.10.1] — 2025-09-05

**Org member Drive uploads & size limits** · PATCH · [Full release notes](../release/2.10.1.md)

### Highlights
- Add Gdrive Link For Organization Member
- Fix Organization Member Upload & Reduce File With Lossless
- Limit File
- Limit Upload
- Limit Increase to 100mb

### Commits
7 commit(s): `102e784`..`db2f366`

---

## [2.10.0] — 2025-08-22

**Performance, SEO & auto sitemap** · MINOR · [Full release notes](../release/2.10.0.md)

### Highlights
- Performance Improve
- Performance Improve + Seo changes
- Article Issue
- Article Issue 2
- Seo Optimize

### Commits
9 commit(s): `b02cc11`..`1833523`

---

## [2.9.0] — 2025-08-06

**SEO kickoff & Vite tooling fixes** · MINOR · [Full release notes](../release/2.9.0.md)

### Highlights
- SEO Add
- Article Change
- Fixing Vite
- Fixin

### Commits
4 commit(s): `d613607`..`f6bcf00`

---

## [2.8.0] — 2025-08-04

**PostgreSQL removal & allowlist** · MINOR · [Full release notes](../release/2.8.0.md)

### Highlights
- Removing All PostgreSQL
- add allowlist

### Commits
2 commit(s): `4cdecd9`..`1517868`

---

## [2.7.0] — 2025-08-03

**Periods management, loading UX & DDoS tiers** · MINOR · [Full release notes](../release/2.7.0.md)

### Highlights
- Fix TypeScript errors in mongo-storage.ts and mongodb.ts
- Add Loading Screen, Add Periods Management, Fixing Bugs, Smooth Parralax With Delay Scroll
- Fixing Struktur Organisasi
- Fixing Struktur Organisasi
- Fixing Cross Multiplatform

### Commits
7 commit(s): `174c4f0`..`2a0f04b`

---

## [2.6.0] — 2025-07-30

**Article tags import & API hardening** · MINOR · [Full release notes](../release/2.6.0.md)

### Highlights
- Add Artikel Pages & Tags Features, Import All Article from Old Web to New Web
- Add animated floating image gallery to About page
- Add Ddos & Sql Protection
- Add API Protection & Warning Pages

### Commits
4 commit(s): `ba7e85e`..`584c203`

---

## [2.5.0] — 2025-07-26

**Mobile hero, TinyMCE uploads & dashboard alerts** · MINOR · [Full release notes](../release/2.5.0.md)

### Highlights
- Update Google Drive configuration and cleanup old credentials
- Resolve merge conflicts: integrate enhanced Google Drive features with updated credentials
- Add mobile banner slideshow and assets to hero
- Merge branch 'main' of https://github.com/Sadamdi/hmps
- Path Attachment & Uploads, Article using from service Tiny

### Commits
9 commit(s): `8ce99ee`..`7baf975`

---

## [2.4.0] — 2025-07-19

**Google Drive media & article pipeline** · MINOR · [Full release notes](../release/2.4.0.md)

### Highlights
- Changes article and libary upload with gdrive link
- Changes article and libary upload with gdrive link
- artikel
- Merge branch 'main' of https://github.com/Sadamdi/hmps
- cleanup: Remove unused imports and functions

### Commits
9 commit(s): `cea4d26`..`b6b56bc`

---

## [2.3.2] — 2025-07-07

**Parallax polish** · PATCH · [Full release notes](../release/2.3.2.md)

### Highlights
- parallax jadi

### Commits
1 commit(s): `7b4c7c9`..`7b4c7c9`

---

## [2.3.1] — 2025-06-13

**Project README & misc June sync** · PATCH · [Full release notes](../release/2.3.1.md)

### Highlights
- Initial changes
- Add Readme

### Commits
2 commit(s): `2153ba1`..`8cac550`

---

## [2.3.0] — 2025-06-05

**Gemini AI campus assistant** · MINOR · [Full release notes](../release/2.3.0.md)

### Highlights
- Working Gemini AI untuk seputar UIN

### Commits
1 commit(s): `76c1eb6`..`76c1eb6`

---

## [2.2.0] — 2025-06-01

**Hero, maintenance mode & parallax** · MINOR · [Full release notes](../release/2.2.0.md)

### Highlights
- update hero section
- Maintenance Mode
- Perubahan Parallax
- Cheat Dino wkwkwk

### Commits
4 commit(s): `8be3a91`..`0cac258`

---

## [2.1.1] — 2025-05-25

**Org structure fixes & env setup** · PATCH · [Full release notes](../release/2.1.1.md)

### Highlights
- First
- A1
- fix bug struktur organisasi
- add env

### Commits
4 commit(s): `1cb92d7`..`f454ab7`

---

## [2.1.0] — 2025-05-09

**About, vision & branded home redesign** · MINOR · [Full release notes](../release/2.1.0.md)

### Highlights
- Add organization details and vision to the website, editable via dashboard
- Display organizational information fetched dynamically from the database
- Add About Us and Vision Mission sections to the website navigation
- Add descriptions detailing the organization's goals and activities
- Enable admins to modify the website's content through a dedicated editor

### Commits
15 commit(s): `1bc0bce`..`0b1e9dc`

---

## [2.0.1] — 2025-05-05

**Post-Mongo content & session hardening** · PATCH · [Full release notes](../release/2.0.1.md)

### Highlights
- Ensure updates to settings and content reflect correctly on the website
- Ensure content settings are consistently applied and IDs are handled correctly
- Ensure the site reflects the most current settings and configurations
- Improve content creation and editing with better error handling and defaults
- Make website settings update in real-time across the entire platform

### Commits
18 commit(s): `ae06c7e`..`2fc3519`

---

## [2.0.0] — 2025-05-05

**MongoDB platform migration** · MAJOR · [Full release notes](../release/2.0.0.md)

### Highlights
- Migrate database to MongoDB for improved data management and scalability
- Improve settings page and database connection reliability on different systems
- Set up the application to connect to a remote MongoDB database

### Commits
3 commit(s): `e8e4b49`..`7e88ece`

---

## [1.1.0] — 2025-05-05

**Auth, org structure, settings & editor** · MINOR · [Full release notes](../release/1.1.0.md)

### Highlights
- Record the exact date and time users log in to the website platform
- Improve the handling of dates when saving user, article, and media data
- Improve security of user login system and ensure data integrity
- Improve the appearance and navigation of main website sections
- Show organizational structure with interactive charts and period selection

### Commits
12 commit(s): `cbce500`..`7b2a49a`

---

## [1.0.0] — 2025-05-05

**Initial complete site bootstrap** · MAJOR · [Full release notes](../release/1.0.0.md)

### Highlights
- Set up a complete organizational website with key features

### Commits
1 commit(s): `818c386`..`b204e9b`

---
