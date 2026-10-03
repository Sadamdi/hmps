# SSR Meta + Sitemap (image/video)

**Status**: Active | **Contract Confidence**: High (handler in `server/index.ts`) | **Category**: public content

---

## Deskripsi

Dynamic sitemap dan SSR meta injection agar berita, event, galeri, dan toko bisa diindeks mesin pencari — termasuk **Google Images / Bing Visual / video search** via ekstensi sitemap `image:` / `video:` dan JSON-LD media.

---

## Observed Endpoints

| Method | Endpoint | Source | Notes |
|--------|----------|--------|-------|
| GET | `/sitemap.xml` | `server/index.ts` | URL set + `xmlns:image` + `xmlns:video` |
| GET | `/robots.txt` | `public/robots.txt` (static) | Points to sitemap; allows `/uploads/` |
| GET | `/berita/:slugOrId` | SSR prerender | NewsArticle + ImageObject + truncated title |
| GET | `/events/:year/:eventId` | SSR prerender | Event + ImageObject |
| GET | `/library/:id` | SSR prerender | ImageGallery (multi-image) + VideoObject |
| GET | `/toko/:slug` | SSR prerender | Product OG |
| GET | `/`, `/toko`, listing pages | `serveHtmlWithMeta` | Page meta + Organization/WebSite on home |

Helper: `server/services/seo-sitemap.ts` (`buildSitemapXml`, `seoDocumentTitle`, `libraryVideosFromImages`, …).

---

## Sitemap contents

| Source | URL pattern | Media in sitemap |
|--------|-------------|------------------|
| Base pages | `/`, `/berita`, `/events`, `/library`, `/toko`, `/profil`, … | — |
| Berita published | `/berita/{slug}` | cover `image` |
| Event published | `/events/{year}/{slug}` | `thumbnail` |
| Library published | `/library/{slug}` | up to 10 images; YouTube/mp4 as `video:` |
| Store published | `/toko/{slug}` | `thumbnail` |

---

## Business rules

1. Only **published** content enters the sitemap.
2. Media URLs must be absolute `https://himatif-encoder.com/...` (or external https).
3. Document `<title>` truncated ~60 chars (`seoDocumentTitle`) to avoid Bing “Title too long”.
4. Ranking #1 cannot be guaranteed by sitemap alone — content quality, backlinks, and crawl freshness still apply.
5. After deploy: re-submit sitemap in GSC / Bing / Yandex; IndexNow batch optional.
6. On publish of berita / library / event: `notifyPublicContent` pings **IndexNow** (search discovery) and optionally **Facebook Graph scrape** (share preview cache). Hub pages (`/`, `/berita`, `/events`, `/library`, `/profil`, `/kelembagaan`, `/prodi`, `/toko`) are included with debounce.
7. Berita SSR `og:image` for local covers uses JPEG share URL `/api/og/berita/{hash}.jpg` (WhatsApp-friendly); page content still shows original WebP.
8. Facebook Debugger scrape ≠ WhatsApp cache refresh; IndexNow/Facebook scrape do **not** guarantee Google ranking for competitive keywords.

### Env (ops)

| Env | Role |
|-----|------|
| `INDEXNOW_ENABLED` / `INDEXNOW_KEY` / `INDEXNOW_HOST` | Existing IndexNow |
| `FACEBOOK_SCRAPE_ENABLED` | `true` to enable Meta scrape on publish |
| `FACEBOOK_GRAPH_ACCESS_TOKEN` | Graph API token (no-op if empty) |
| `PUBLIC_NOTIFY_HUB_DEBOUNCE_MS` | Optional debounce for hub-page pings (default 5m) |

---

## Source References

- `server/index.ts` — `/sitemap.xml`, prerender routes, `/api/og/berita/:hash`
- `server/services/seo-sitemap.ts`
- `server/services/indexnow.ts`
- `server/services/facebook-scrape.ts`
- `server/services/public-content-notify.ts`
- `server/services/og-meta.ts`
- `public/robots.txt`
- `docs/api/endpoints.md`

---

## Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `GET /sitemap.xml` | XML with `xmlns:image` and berita `<image:image>` when cover exists |
| 2 | Library with YouTube | `<video:video>` + VideoObject JSON-LD on page |
| 3 | Long berita title | `<title>` ≤ ~60 chars with brand suffix |
| 4 | `npm run check` | Pass |
