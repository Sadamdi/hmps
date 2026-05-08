# Events & Library

## Purpose

Events & Library feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-event-years.md](./01-event-years.md) | 01-event-years.md |
| [02-events-public-cms.md](./02-events-public-cms.md) | 02-events-public-cms.md |
| [03-event-berita-relations.md](./03-event-berita-relations.md) | 03-event-berita-relations.md |
| [04-library-public-cms.md](./04-library-public-cms.md) | 04-library-public-cms.md |
| [05-library-folder-files.md](./05-library-folder-files.md) | 05-library-folder-files.md |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — Events & Library |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `event-years` | 7 | Event period/year lifecycle and event count helpers. |
| `events` | 12 | Event listing, detail, year/slug lookup, and berita attachment/copy flows. |
| `library` | 8 | Library folder/file public and admin surfaces. |

## Endpoint Family Coverage

### event-years

| Method | Path |
|--------|------|
| `GET` | `/api/event-years` |
| `POST` | `/api/event-years` |
| `DELETE` | `/api/event-years/{id}` |
| `PATCH` | `/api/event-years/{id}` |
| `PATCH` | `/api/event-years/{id}/activate` |
| `PATCH` | `/api/event-years/{id}/deactivate` |
| `GET` | `/api/event-years/{id}/events-count` |

### events

| Method | Path |
|--------|------|
| `GET` | `/api/events` |
| `POST` | `/api/events` |
| `DELETE` | `/api/events/{id}` |
| `GET` | `/api/events/{id}` |
| `PATCH` | `/api/events/{id}` |
| `POST` | `/api/events/{id}/attach-berita` |
| `DELETE` | `/api/events/{id}/attach-berita/{beritaId}` |
| `POST` | `/api/events/{id}/copy-to-berita` |
| `GET` | `/api/events/active-home` |
| `GET` | `/api/events/by-year/{year}` |
| `GET` | `/api/events/published` |
| `GET` | `/api/events/year/{year}/slug/{slug}` |

### library

| Method | Path |
|--------|------|
| `GET` | `/api/library` |
| `POST` | `/api/library` |
| `DELETE` | `/api/library/{id}` |
| `GET` | `/api/library/{id}` |
| `PUT` | `/api/library/{id}` |
| `GET` | `/api/library/{libraryId}/folder/{folderId}/files` |
| `GET` | `/api/library/manage` |
| `GET` | `/api/library/slug/{slug}` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
