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

---

## Source References

- `server/index.ts` — `/sitemap.xml`, prerender routes
- `server/services/seo-sitemap.ts`
- `public/robots.txt`
- `docs/api/endpoints.md`
- `docs/ops/README.md` (SEO / IndexNow ops)

---

## Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `GET /sitemap.xml` | XML with `xmlns:image` and berita `<image:image>` when cover exists |
| 2 | Library with YouTube | `<video:video>` + VideoObject JSON-LD on page |
| 3 | Long berita title | `<title>` ≤ ~60 chars with brand suffix |
| 4 | `npm run check` | Pass |
