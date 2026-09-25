# Feature: Media Sosial (YouTube / Instagram) — v2

**Author**: HMPS Project Team  
**Created**: 2026-07-16 · **Updated**: 2026-09-25 (4.27.0)  
**Status**: Active  
**Contract Confidence**: Verified from code + uji fetch nyata (2026-09-25)  
**Category**: 07-media-assets  
**Tenant-Aware**: Yes (storage per tenant via `/api/c/:slug/social-feed…`; cron harian mencakup semua komunitas aktif)  
**Permission Scope**: Public read + `social_feed.view|edit|sync` untuk kelola  

---

## Deskripsi

Section YouTube & Instagram di beranda (main dan komunitas) + halaman "Lihat semua" `/youtube` dan `/instagram` (sejajar `/berita`, `/events`, `/library`; `/media/*` lama di-redirect dengan query tetap). Data diambil server sekali sehari (**00:00 WIB**) atau lewat tombol **Fetch sekarang**, disimpan di dokumen Settings masing-masing storage, dan tidak pernah hilang saat sumber gagal (keep-on-fail).

**Arsip penuh (4.27.0):** fetch pertama per platform (`cache.backfilledAt[platform]` kosong) atau tombol **Ambil ulang semua isi akun** mengambil **seluruh** isi akun (IG ±1.200 post, YT seluruh tab via continuation). Fetch harian hanya memeriksa N terbaru (`fetchLimits`, label "Cek …" di dashboard) lalu **menggabung** dengan arsip — item lama tidak dibuang. Backfill penuh membuang item yang sudah dihapus di sumber (kecuali link manual IG). Backfill manual berjalan di background (HTTP 202).

Sumber: `shared/social-feed.ts`, `server/services/social-feed.ts`, `server/routes/social-feed.ts`, `server/division-permissions.ts`, `client/src/components/public/social-feed-sections.tsx`, `client/src/components/public/social/*`, `client/src/pages/media/*`, `client/src/components/dashboard/social-feed-settings-panel.tsx`.

---

## YouTube

- Kanal default `https://www.youtube.com/c/HimatifEncoder` (bisa diganti; `/c/`, `/@handle`, `/channel/UC…` didukung — channel id dari `<link rel="canonical">`).
- Fetch harian memeriksa per kategori (default): **video 10, shorts 10, live 5** (`fetchLimits`); arsip menyimpan semua (uji 2026-09-25: 119 item — 58 video, 11 shorts, 50 live, semua bertanggal, ±2 menit).
- Sumber berurutan: youtubei.js InnerTube → scrape tab HTML (`/videos`, `/streams`, `/shorts`) → RSS (terakhir).
- **Tanggal terbit pasti** dari halaman watch (`<meta itemprop="datePublished">`), hanya untuk item baru (item lama memakai cache).
- Koreksi kategori: `isLiveContent` → live; Shorts > 180 dtk → video. Tab `/shorts` hanya menerima ID bertaut `/shorts/ID` (channel tanpa tab Shorts dialihkan ke beranda channel — sebelumnya menyebabkan video biasa salah berlabel Shorts).
- Satu video hanya di satu kategori (prioritas live > short > video). Tab "Semua" = gabungan urut terbaru; live yang sedang berlangsung selalu di depan.

## Instagram

Instagram memblokir **daftar post** tanpa login dari IP mana pun (diuji 2026-09-25: `web_profile_info` 429, GraphQL `require_login`, HTML profil tanpa shortcode, viewer pihak ketiga mati). Halaman **embed per post** (`/p/{code}/embed/captioned/`) tetap publik. Maka rantainya:

0. **instagrapi (utama, v4.26.0)** — `server/services/instagram-instagrapi.ts` menjalankan `python3 ops/instagram/ig_feed.py <username> <limit>` (API mobile Instagram, akun dummy). Mengembalikan kode, jenis (post/reel/carousel), caption, thumbnail, tanggal; item ini tidak perlu enrich embed.
1. `web_profile_info` — fallback bila instagrapi gagal; memakai cookie sesi yang sama.
2. Scrape HTML profil/reels (murah, jarang berhasil).
3. **Link manual** dari dashboard (maks 200) — selalu berhasil.
4. Item cache lama selalu dipertahankan.

Setiap shortcode baru di-enrich via embed: gambar (disimpan ke `uploads/social/instagram/`), caption → judul, tipe (`GraphImage`/`GraphSidecar` → post, carousel ditandai; `GraphVideo`/`clips` → reel). **Penting:** embed harus diminta dengan UA sederhana (`Mozilla/5.0`); dengan UA browser lengkap IG mengirim shell aplikasi JS tanpa data. Tanggal dihitung dari shortcode (`media id >> 23` + epoch IG 1314220021721 ms) — akurat tanpa request tambahan.

### Sesi akun dummy & auto refresh

| File / env (server `/var/www/hmps`) | Fungsi |
|---|---|
| `.instagram-session.json` (gitignore, chmod 600) | Export cookie browser akun dummy (array `{name,value}`) — bootstrap sesi. Kirim manual via `scp`, **jangan commit**. |
| `.instagram-instagrapi.json` (gitignore) | State instagrapi (cookie + device). Ditulis ulang setiap sync → cookie yang dirotasi Instagram otomatis tersimpan. |
| `INSTAGRAM_DUMMY_USERNAME` / `INSTAGRAM_DUMMY_PASSWORD` | Login ulang otomatis (device sama) bila sesi mati. Checkpoint/2FA tidak di-bypass → error dicatat, owner login manual lalu export ulang cookie. |
| `INSTAGRAM_SESSION_ID` / `INSTAGRAM_CSRF_TOKEN` | Alternatif bootstrap tanpa file. |
| `INSTAGRAM_INSTAGRAPI=off`, `INSTAGRAM_PYTHON` | Matikan bridge / override binary Python. |

Setup server sekali: `pip3 install -r ops/instagram/requirements.txt`. Status aman (tanpa nilai cookie) ada di `GET /api/social-feed/manage` → `data.instagramSession` (`configured`, `source`, `lastLoginError`, `instagrapiError`).

Hanya **post & reel** yang disimpan/ditampilkan. Urutan = profil asli: **pinned dulu** (`pinned`, `pinnedRank` dari `timeline_pinned_user_ids`), lalu terbaru (`taken_at` asli). Thumbnail disimpan WebP lebar 480 (`uploads/social/instagram/{code}.webp`, ±27 KB) agar arsip ribuan post tetap ringan. Profil akun (`cache.profiles.instagram`: avatar lokal `_avatar.webp`, nama, bio, jumlah post/pengikut/mengikuti, verified) ikut diperbarui tiap sync. Status `blocked` dicatat bila daftar otomatis gagal.

---

## UI / User Flow

| Item | Value |
|------|-------|
| Beranda | Section `youtube` / `instagram` (`homeConfig.blocks`) |
| Detail | `/youtube?kind=all\|video\|short\|live`, `/instagram?kind=all\|post\|reel` (juga `/:slug/youtube`, `/:slug/instagram`; `/media/*` → redirect) |
| Navbar | Item YouTube/Instagram: *Di beranda* (`/#youtube`), *Lihat semua*, *Buka di …* (URL dari config dashboard; item hilang bila platform nonaktif). Ikut grup merge `homeConfig.navbarGroups` (mis. grup "Media") seperti Berita/Galeri. |
| Dashboard | `/dashboard/settings` tab Media Sosial Beranda |

- **YouTube beranda**: tab Semua/Video/Shorts/Live (hanya yang berisi, dengan hitungan), video unggulan (live bila sedang live, selain itu terbaru; tidak di tab Shorts), grid `homeLimit` (8) → **Lebih banyak** (+`loadMoreStep` 8 = 16) → **Lihat semua** ke `/youtube`. Badge **Baru** (≤7 hari, `isNewSocialItem`).
- **Instagram beranda**: gaya profil aplikasi IG di HP — header profil asli (avatar, @handle + verified, nama, bio, post/pengikut/mengikuti, tombol Ikuti; fallback ikon bila profil belum tersinkron), tab ikon Post/Reels, grid 3 kolom rapat **3:4 seragam** (baris rata saat post & reel bercampur), badge **Pinned** & **Baru**, ikon carousel/reel, 9 → Lebih banyak (18) → Lihat semua.
- **Halaman detail**: `ArchiveHeader` + tab mono + `Pagination` (YT 12/halaman, IG 18/halaman), `?kind=` tersinkron ke URL.
- **Dashboard**: kartu status per platform (fetch terakhir relatif + WIB, hasil, metode, item baru, jumlah per kategori, peringatan blokir, status sesi dummy IG — boolean saja), **Fetch sekarang** per platform & semua, jadwal berikutnya, pengaturan (URL, jenis konten, batas simpan, batas tampil & langkah "lebih banyak", embed unggulan, badge live), pengelola link manual IG, tabel **log** 20 fetch terakhir.

---

## API Contract

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/api/social-feed` | Public | — |
| GET | `/api/social-feed/items?platform=&kind=&offset=&limit=` | Public | — |
| GET | `/api/social-feed/manage` | Auth | `social_feed.view` |
| GET | `/api/social-feed/manage/logs?limit=` | Auth | `social_feed.view` |
| PUT | `/api/social-feed/manage` | Auth | `social_feed.edit` |
| POST | `/api/social-feed/sync` | Auth | `social_feed.sync` |

- `GET /api/social-feed` → `data: { config{youtube,instagram (+homeLimit, loadMoreStep, username)}, youtube[], instagram[], youtubeByKind{video,short,live}, instagramByKind{post,reel}, counts{youtube,instagram}, live, profiles{youtube?,instagram?}, syncedAt }`. Tiap daftar maks `homeLimit + loadMoreStep`. Field lama `youtube`/`instagram` tetap (tab Semua).
- `GET /api/social-feed/items` → `{ success, message, data: Item[], meta: { offset, limit, total, counts, profileUrl, username, enabled, profile, syncedAt } }`. `limit` 1–48, `offset` 0–20000; 400 `VALIDATION_ERROR` bila `platform` tidak valid.
- `GET /manage` → `{ config, cache, status, lastSocialFeedSyncAt, nextScheduledSyncAt, instagramSessionConfigured, logs[20], preview }`.
- `PUT /manage` → body `{ config }` (atau langsung config). URL profil divalidasi host (youtube.com / instagram.com); angka di-clamp oleh `normalizeSocialFeedConfig`. 400 `VALIDATION_ERROR`.
- `POST /sync` → body `{ platform?: 'youtube'|'instagram', full?: boolean }` (kosong = keduanya). Bila `full` atau platform belum pernah backfill → **202** `data.backfill=true`, proses di background (409 `SOCIAL_FEED_BACKFILL_RUNNING` bila masih berjalan). Cooldown 60 dtk per storage → 429 `SOCIAL_FEED_SYNC_COOLDOWN`. `success=false` bila salah satu platform gagal (data lama dipertahankan).
- Item: `{ id, platform, kind, title, url, thumbnailUrl, publishedAt, firstSeenAt, isLive?, isCarousel?, pinned?, pinnedRank? }` (caption tidak dikirim ke publik).

`GET/PUT /api/settings` tidak mengekspos/menerima `socialFeedConfig`, `socialFeedCache`, `lastSocialFeedSyncAt`, `socialFeedLogs`.

## Data

Dokumen Settings (skema sama untuk main & tenant): `socialFeedConfig` (v2, config lama ≤4.24 dibaca otomatis), `socialFeedCache` (+ `status` per platform), `lastSocialFeedSyncAt`, `socialFeedLogs` (maks 50, terbaru dulu), `appliedMigrations`.

## Scheduler

`server/index.ts`: `cron '0 0 * * *'` (00:00 WIB) zona `Asia/Jakarta` — main lalu tiap komunitas `status: active` (jeda 15 dtk), guard agar tidak tumpang tindih. Log `trigger: 'cron'`.

---

## Permissions

| Siapa | Main | Tenant |
|-------|------|--------|
| owner | semua (otomatis) | semua (otomatis) |
| admin, chair (ketua), vice_chair (wakil) | `social_feed.*` (backfill tiap startup) | — (role tidak ada) |
| role `medinfo` | `social_feed.*` — dibuat oleh migrasi bila belum ada (salinan izin division_head) | — |
| user dengan divisi Medinfo (`division`/`divisionLabel` = medinfo / "Media dan Informasi") | `social_feed.*` via `server/division-permissions.ts` | sama |
| bph | dicabut (migrasi sekali) | ya (bawaan tenant: semua kecuali delete/`settings.edit`) |
| division_head | dicabut (migrasi sekali) | tidak |

Migrasi `social-feed-roles-v2` berjalan sekali (penanda di `Settings.appliedMigrations`), jadi pemberian manual owner sesudahnya tidak ditimpa. Override per-user (`permissionOverrides.deny`) tetap menang.

---

## Security Notes

- Host allowlist untuk unduh thumbnail (youtube/ytimg/instagram/fbcdn/cdninstagram); disimpan lokal `/uploads/social/…`.
- Cookie sesi IG hanya di env server; dashboard hanya menerima boolean `instagramSessionConfigured`. Gunakan **akun dummy**, bukan akun resmi.
- Cooldown sync manual 60 dtk per storage; cron tidak tumpang tindih; kegagalan terisolasi (tidak crash server).
- Validasi Zod untuk `items`, `manage`, `sync`.

---

## Test Scenarios

1. Sync YouTube `/c/HimatifEncoder` → ≤10 video, ≤10 shorts, ≤5 live, semua ber-`publishedAt`; sync kedua `newCount = 0`.
2. IG tanpa sesi → status `blocked`, item dari link manual ter-enrich (tipe, carousel, caption, tanggal).
3. Beranda: tab YT, Lebih banyak 8→16, Lihat semua → `/media/youtube?kind=…`; IG tab Post/Reels.
4. `/media/youtube` pagination 12/halaman; `/media/instagram?kind=reel` membuka tab Reels.
5. Fetch sekarang dua kali < 60 dtk → 429.
6. Tenant `/:slug` → data & pengaturan terpisah.

---

## Related Docs

- [07-prodi-sync-service.md](../04-organization-prodi/07-prodi-sync-service.md) — filosofi keep-on-fail sync serupa
- [docs/api/endpoints.md](../../api/endpoints.md)
