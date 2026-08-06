# HMPS Versions

**Current version:** `4.11.0`  
**Policy:** setiap selesai satu unit kerja (satu tugas/fitur/fix batch yang di-ship), bump SemVer dan tulis release note di folder ini.

## Structure

```text
docs/version/
├── versions.md              ← index ini
├── version-template.md      ← template wajib untuk release baru
├── changelogs/
│   ├── README.md            ← panduan + link
│   └── CHANGELOG.md         ← semua versi (Keep a Changelog)
└── release/
    ├── 1.0.0.md
    └── ...
```

## How to bump (wajib setelah selesai mengerjakan)

1. Tentukan bump:
   - **MAJOR** (`X.0.0`): breaking API/auth/tenant atau platform shift besar
   - **MINOR** (`x.Y.0`): fitur baru / endpoint baru / tugas besar non-breaking
   - **PATCH** (`x.y.Z`): bugfix, hardening, docs sync kecil
2. Salin [`version-template.md`](./version-template.md) → `release/<new-version>.md` dan isi lengkap.
3. Update baris **Current** di file ini.
4. Tambah section di [`changelogs/CHANGELOG.md`](./changelogs/CHANGELOG.md).
5. Sync `package.json` `version` dan `docs/openapi.json` `info.version`.
6. Update `AGENTS.md` / feature docs / endpoints jika behavior berubah (SOP 11).

## All versions

| Version | Date | Title | Bump | Commits | Status |
|---------|------|-------|------|---------|--------|
| [`4.11.0`](./release/4.11.0.md) | 2026-08-06 | Versioning system, SOP sync & docs audit | MINOR | 0 | **Current** |
| [`4.10.0`](./release/4.10.0.md) | 2026-07-16 | Home YT/IG social feed | MINOR | 7 | Released |
| [`4.9.0`](./release/4.9.0.md) | 2026-07-15 | Prodi student hub & input security | MINOR | 6 | Released |
| [`4.8.1`](./release/4.8.1.md) | 2026-07-05 | Deploy scripts & PM2 ops tooling | PATCH | 4 | Released |
| [`4.8.0`](./release/4.8.0.md) | 2026-06-28 | Error monitoring with AI analysis | MINOR | 3 | Released |
| [`4.7.1`](./release/4.7.1.md) | 2026-05-13 | SEO refresh | PATCH | 3 | Released |
| [`4.7.0`](./release/4.7.0.md) | 2026-05-08 | Formal project docs & AI context | MINOR | 6 | Released |
| [`4.6.0`](./release/4.6.0.md) | 2026-05-01 | Store/Toko refinements | MINOR | 6 | Released |
| [`4.5.2`](./release/4.5.2.md) | 2026-04-26 | Embeds & navbar polish after editor work | PATCH | 16 | Released |
| [`4.5.1`](./release/4.5.1.md) | 2026-04-25 | TinyMCE upload & berita file attachments | PATCH | 11 | Released |
| [`4.5.0`](./release/4.5.0.md) | 2026-04-21 | Notification system overhaul | MINOR | 8 | Released |
| [`4.4.1`](./release/4.4.1.md) | 2026-04-20 | Store middleware & DB lag fixes | PATCH | 5 | Released |
| [`4.4.0`](./release/4.4.0.md) | 2026-04-18 | Store katalog & theme toggle | MINOR | 3 | Released |
| [`4.3.1`](./release/4.3.1.md) | 2026-04-14 | Protection, sync & tenant hardening cluster | PATCH | 40 | Released |
| [`4.3.0`](./release/4.3.0.md) | 2026-04-10 | Hero motion, feedback uploads & AI UI | MINOR | 9 | Released |
| [`4.2.0`](./release/4.2.0.md) | 2026-04-08 | Tenant AI fixes & Prodi akreditasi | MINOR | 10 | Released |
| [`4.1.1`](./release/4.1.1.md) | 2026-04-07 | Berita/gallery/events routing & komunitas fixes | PATCH | 12 | Released |
| [`4.1.0`](./release/4.1.0.md) | 2026-04-05 | Home banner, gallery & rich embeds | MINOR | 13 | Released |
| [`4.0.0`](./release/4.0.0.md) | 2026-04-03 | Community tenants & registration | MAJOR | 7 | Released |
| [`3.6.0`](./release/3.6.0.md) | 2026-03-23 | Comments, DB key logic & permission settings | MINOR | 10 | Released |
| [`3.5.0`](./release/3.5.0.md) | 2026-03-22 | Prodi pages & Spyro updates | MINOR | 5 | Released |
| [`3.4.0`](./release/3.4.0.md) | 2026-03-20 | Backup, section settings & sharing access | MINOR | 9 | Released |
| [`3.3.0`](./release/3.3.0.md) | 2026-03-18 | Email OTP auth & Berita rename | MINOR | 14 | Released |
| [`3.2.0`](./release/3.2.0.md) | 2026-03-17 | Events page & view counters | MINOR | 6 | Released |
| [`3.1.0`](./release/3.1.0.md) | 2026-03-16 | Mobile nav, maps, 404 & stats UX | MINOR | 10 | Released |
| [`3.0.0`](./release/3.0.0.md) | 2026-03-15 | Big UI relaunch & sitewide AI agent | MAJOR | 12 | Released |
| [`2.15.1`](./release/2.15.1.md) | 2025-10-15 | Pre-hiatus interim update | PATCH | 1 | Released |
| [`2.15.0`](./release/2.15.0.md) | 2025-10-04 | Security middleware stack | MINOR | 18 | Released |
| [`2.14.1`](./release/2.14.1.md) | 2025-09-29 | Logo, middleware settings & license | PATCH | 4 | Released |
| [`2.14.0`](./release/2.14.0.md) | 2025-09-17 | Sessions, revoke, article suggestions & security | MINOR | 13 | Released |
| [`2.13.0`](./release/2.13.0.md) | 2025-09-16 | Permission matrix & user management overhaul | MINOR | 27 | Released |
| [`2.12.0`](./release/2.12.0.md) | 2025-09-14 | Roles, permissions & chat personalization | MINOR | 10 | Released |
| [`2.11.0`](./release/2.11.0.md) | 2025-09-07 | Spyro AI & dashboard motion UI | MINOR | 6 | Released |
| [`2.10.1`](./release/2.10.1.md) | 2025-09-05 | Org member Drive uploads & size limits | PATCH | 7 | Released |
| [`2.10.0`](./release/2.10.0.md) | 2025-08-22 | Performance, SEO & auto sitemap | MINOR | 9 | Released |
| [`2.9.0`](./release/2.9.0.md) | 2025-08-06 | SEO kickoff & Vite tooling fixes | MINOR | 4 | Released |
| [`2.8.0`](./release/2.8.0.md) | 2025-08-04 | PostgreSQL removal & allowlist | MINOR | 2 | Released |
| [`2.7.0`](./release/2.7.0.md) | 2025-08-03 | Periods management, loading UX & DDoS tiers | MINOR | 7 | Released |
| [`2.6.0`](./release/2.6.0.md) | 2025-07-30 | Article tags import & API hardening | MINOR | 4 | Released |
| [`2.5.0`](./release/2.5.0.md) | 2025-07-26 | Mobile hero, TinyMCE uploads & dashboard alerts | MINOR | 7 | Released |
| [`2.4.0`](./release/2.4.0.md) | 2025-07-19 | Google Drive media & article pipeline | MINOR | 9 | Released |
| [`2.3.2`](./release/2.3.2.md) | 2025-07-07 | Parallax polish | PATCH | 1 | Released |
| [`2.3.1`](./release/2.3.1.md) | 2025-06-13 | Project README & misc June sync | PATCH | 2 | Released |
| [`2.3.0`](./release/2.3.0.md) | 2025-06-05 | Gemini AI campus assistant | MINOR | 1 | Released |
| [`2.2.0`](./release/2.2.0.md) | 2025-06-01 | Hero, maintenance mode & parallax | MINOR | 4 | Released |
| [`2.1.1`](./release/2.1.1.md) | 2025-05-25 | Org structure fixes & env setup | PATCH | 4 | Released |
| [`2.1.0`](./release/2.1.0.md) | 2025-05-09 | About, vision & branded home redesign | MINOR | 15 | Released |
| [`2.0.1`](./release/2.0.1.md) | 2025-05-05 | Post-Mongo content & session hardening | PATCH | 18 | Released |
| [`2.0.0`](./release/2.0.0.md) | 2025-05-05 | MongoDB platform migration | MAJOR | 3 | Released |
| [`1.1.0`](./release/1.1.0.md) | 2025-05-05 | Auth, org structure, settings & editor | MINOR | 12 | Released |
| [`1.0.0`](./release/1.0.0.md) | 2025-05-05 | Initial complete site bootstrap | MAJOR | 2 | Released |

## History note

- Versi `1.0.0`–`4.10.0` di-backfill dari **425** git commits (`2025-05-05` → `2026-07-16`).
- Gap tanpa commit: **2025-10-16 → 2026-03-13**.
- `4.11.0` adalah work unit dokumentasi/versioning/SOP sync (`2026-08-06`).

Terakhir diperbarui: 2026-08-06
