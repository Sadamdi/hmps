# Public Content & CMS

## Purpose

Public Content & CMS feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-homepage-settings-stats.md](./01-homepage-settings-stats.md) | 01-homepage-settings-stats.md |
| [02-berita-cms.md](./02-berita-cms.md) | 02-berita-cms.md |
| [03-profil-page.md](./03-profil-page.md) | 03-profil-page.md |
| [04-ssr-sitemap.md](./04-ssr-sitemap.md) | 04-ssr-sitemap.md |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — Public Content & CMS |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `berita` | 15 | News/content listing, detail lookup, related content, and event attachment/copy flows. |
| `dashboard` | 3 | Dashboard content support endpoints. |
| `settings` | 7 | Site settings and dashboard/public configuration. |
| `stats` | 1 | Public statistics. |

## Endpoint Family Coverage

### berita

| Method | Path |
|--------|------|
| `GET` | `/api/berita` |
| `POST` | `/api/berita` |
| `DELETE` | `/api/berita/{id}` |
| `GET` | `/api/berita/{id}` |
| `PUT` | `/api/berita/{id}` |
| `GET` | `/api/berita/{id}([a-fA-F0-9]{24})/{slug}` |
| `POST` | `/api/berita/{id}/attach-event` |
| `DELETE` | `/api/berita/{id}/attach-event/{eventId}` |
| `POST` | `/api/berita/{id}/copy-to-event` |
| `GET` | `/api/berita/{id}/events` |
| `GET` | `/api/berita/{id}/related` |
| `GET` | `/api/berita/manage` |
| `GET` | `/api/berita/slug/{slug}` |
| `GET` | `/api/berita/slug/{slug}/events` |
| `GET` | `/api/berita/slug/{slug}/related` |

### dashboard

| Method | Path |
|--------|------|
| `GET` | `/api/dashboard/activities` |
| `POST` | `/api/dashboard/log-activity` |
| `GET` | `/api/dashboard/stats` |

### settings

| Method | Path |
|--------|------|
| `GET` | `/api/settings` |
| `PUT` | `/api/settings` |
| `PUT` | `/api/settings/home-config` |
| `PUT` | `/api/settings/home-image-slots` |
| `GET` | `/api/settings/middleware` |
| `PUT` | `/api/settings/middleware` |
| `POST` | `/api/settings/reset` |

### stats

| Method | Path |
|--------|------|
| `GET` | `/api/stats` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
