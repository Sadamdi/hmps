# Media & Assets

## Purpose

Media & Assets feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-general-upload.md](./01-general-upload.md) | 01-general-upload.md |
| [02-editor-content-media.md](./02-editor-content-media.md) | 02-editor-content-media.md |
| [03-prodi-organization-media.md](./03-prodi-organization-media.md) | 03-prodi-organization-media.md |
| [04-home-images-banner-render.md](./04-home-images-banner-render.md) | 04-home-images-banner-render.md |
| [05-google-drive.md](./05-google-drive.md) | 05-google-drive.md |
| [06-file-scanner-cleanup.md](./06-file-scanner-cleanup.md) | 06-file-scanner-cleanup.md |
| [07-asset-cleanup-service.md](./07-asset-cleanup-service.md) | Asset Cleanup Service |
| [08-file-scanner-service.md](./08-file-scanner-service.md) | File Scanner Service |
| [09-banner-theme-render-services.md](./09-banner-theme-render-services.md) | Banner Theme & Render Services |
| [10-home-social-feed.md](./10-home-social-feed.md) | Home YouTube/Instagram auto-scrape feed |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — Media & Assets |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `assets` | 1 | Asset cleanup/orphan maintenance. |
| `gdrive` | 3 | Google Drive media operations. |
| `home-images` | 12 | Home/banner image slots, person slots, render, active year, and copy flows. |
| `upload` | 5 | General upload endpoints. |
| `social-feed` | 4 | Home YT/IG feed public cache + manage/sync. |

## Endpoint Family Coverage

### assets

| Method | Path |
|--------|------|
| `POST` | `/api/assets/cleanup-orphans` |

### gdrive

| Method | Path |
|--------|------|
| `POST` | `/api/gdrive/check-access` |
| `POST` | `/api/gdrive/folder-contents` |
| `POST` | `/api/gdrive/media-url` |

### home-images

| Method | Path |
|--------|------|
| `GET` | `/api/home-images` |
| `POST` | `/api/home-images` |
| `DELETE` | `/api/home-images/{year}` |
| `PUT` | `/api/home-images/{year}` |
| `POST` | `/api/home-images/{year}/banner-render` |
| `POST` | `/api/home-images/{year}/copy` |
| `DELETE` | `/api/home-images/{year}/person/{slot}` |
| `POST` | `/api/home-images/{year}/set-active` |
| `DELETE` | `/api/home-images/{year}/slot/{slot}` |
| `POST` | `/api/home-images/{year}/upload-person/{slot}` |
| `POST` | `/api/home-images/{year}/upload/{slot}` |
| `GET` | `/api/home-images/active` |

### upload

| Method | Path |
|--------|------|
| `POST` | `/api/upload` |
| `POST` | `/api/upload/berita-attachment` |
| `POST` | `/api/upload/content-image` |
| `POST` | `/api/upload/event-content-image` |
| `POST` | `/api/upload/filosofi` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
