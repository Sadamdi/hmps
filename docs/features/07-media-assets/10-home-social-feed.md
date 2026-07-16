# Feature: Home Social Feed (YouTube / Instagram)

**Author**: HMPS Project Team  
**Created**: 2026-07-16  
**Status**: Active  
**Contract Confidence**: Verified from code  
**Category**: 07-media-assets  
**Tenant-Aware**: Conditional (uses `resolveStorage` / tenant settings when on `/api/c/:slug`)  
**Permission Scope**: Public read + `social_feed.view|edit|sync` for manage  

---

## Deskripsi

Auto-scrape feed beranda: YouTube `@HimatifEncoder` (RSS channelId via `externalId`/canonical — bukan `channelId` pertama yang sering salah; Shorts via tab `/shorts`; Live badge) dan Instagram `himatif.encoder` (web_profile_info + HTML `/user/p|reel/CODE` + `@bochilteam/scraper-instagram` enrich; fallback URL manual / `INSTAGRAM_SESSION_ID`).

Filter tipe konten di Settings + chip filter di beranda: YT Video/Shorts/Live; IG Post/Reels/Live/Story.

Navbar: item `youtube` / `instagram` ada di `ALL_NAVBAR_ITEMS` — bisa digabung ke merge group **Media** di tab Beranda.

Hasil di-cache di Settings (`socialFeedConfig` / `socialFeedCache`), ditampilkan sebagai thumbnail card 1–5 item dengan link-out. Sync terjadwal (cron) + tombol manual; gagal scrape tidak menghapus cache terakhir (keep-on-fail).

Sumber: `shared/social-feed.ts`, `server/services/social-feed.ts`, `server/routes/social-feed.ts`, `client/src/components/public/social-feed-sections.tsx`, `client/src/components/dashboard/social-feed-settings-panel.tsx`.

---

## User Stories

1. Sebagai pengunjung, saya ingin melihat post/video terbaru Himatif di beranda tanpa embed banyak iframe.
2. Sebagai Medinfo / ketua, saya ingin mengatur tampil/sembunyi, jumlah item, URL, dan sync tanpa izin `settings.edit` penuh.
3. Sebagai sistem, saya ingin scrape terjadwal dengan keep-on-fail.

---

## UI / User Flow

| Item | Value |
|------|-------|
| UI routes/surfaces | `/` (sections `youtube` / `instagram`), `/dashboard/settings` tab Media Sosial Beranda |
| Frontend source | `client/src/components/public/social-feed-sections.tsx`, `client/src/pages/index.tsx`, `client/src/components/dashboard/social-feed-settings-panel.tsx` |
| Backend source | `server/routes/social-feed.ts`, `server/services/social-feed.ts`, cron di `server/index.ts` |

1. Cron / Sync sekarang → tulis `socialFeedCache`.
2. Home block visible → fetch `GET /api/social-feed` → grid thumbnail.
3. Klik card → `target=_blank` ke URL asli.
4. Settings → toggle enabled / maxItems / URL / sync.

---

## API Contract

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/api/social-feed` | Public | — |
| GET | `/api/social-feed/manage` | Auth | `social_feed.view` |
| PUT | `/api/social-feed/manage` | Auth | `social_feed.edit` |
| POST | `/api/social-feed/sync` | Auth | `social_feed.sync` |

Public response `data`: `{ config, youtube[], instagram[], live, syncedAt }` (tanpa HTML oEmbed mentah).

`GET /api/settings` **tidak** mengekspos `socialFeedConfig` / `socialFeedCache` / `lastSocialFeedSyncAt` (dicegah overwrite dari form Settings umum).

---

## Permissions

| Permission | Roles (seed / upsert) |
|------------|------------------------|
| `social_feed.view` | owner (all), admin, chair, vice_chair, division_head |
| `social_feed.edit` | same |
| `social_feed.sync` | same |

Home section visibility: `homeConfig.blocks` ids `youtube` / `instagram` (Settings → Beranda).

---

## Security Notes

- Host allowlist: youtube.com, youtu.be, instagram.com, CDN thumb relevan.
- Timeout fetch; User-Agent jelas; thumbnail IG/YT di-cache lokal ke `/uploads/social/...`.
- Cron failure isolated (tidak crash server).

---

## Related Docs

- [07-prodi-sync-service.md](../04-organization-prodi/07-prodi-sync-service.md) — filosofi keep-on-fail sync serupa
- [docs/api/endpoints.md](../../api/endpoints.md)
