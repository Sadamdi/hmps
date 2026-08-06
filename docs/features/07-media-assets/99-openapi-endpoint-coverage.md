# OpenAPI Endpoint Coverage — Media & Assets

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the Media & Assets category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## assets

Asset cleanup/orphan maintenance.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `POST` | `/api/assets/cleanup-orphans` | - | `#/components/schemas/GenericRequestBody` |

---

## gdrive

Google Drive media operations.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `POST` | `/api/gdrive/check-access` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/gdrive/folder-contents` | - | `url` |
| `POST` | `/api/gdrive/media-url` | - | `url`, `mediaType` |

---

## home-images

Home/banner image slots, person slots, render, active year, and copy flows.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/home-images` | - | - |
| `POST` | `/api/home-images` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/home-images/{year}` | year* | - |
| `PUT` | `/api/home-images/{year}` | year* | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/home-images/{year}/banner-render` | year* | `personName`, `divisionText`, `themeColor`, `showDivisionName`, `showLogo` |
| `POST` | `/api/home-images/{year}/copy` | year* | `overwrite` |
| `DELETE` | `/api/home-images/{year}/person/{slot}` | year*, slot* | - |
| `POST` | `/api/home-images/{year}/set-active` | year* | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/home-images/{year}/slot/{slot}` | year*, slot* | - |
| `POST` | `/api/home-images/{year}/upload-person/{slot}` | year*, slot* | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/home-images/{year}/upload/{slot}` | year*, slot* | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/home-images/active` | - | - |

---

## upload

General upload endpoints.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `POST` | `/api/upload` | - | `oldFileUrl`, `category` |
| `POST` | `/api/upload/berita-attachment` | - | `beritaId` |
| `POST` | `/api/upload/content-image` | - | `beritaId` |
| `POST` | `/api/upload/event-content-image` | - | `eventId`, `parentEventId` |
| `POST` | `/api/upload/filosofi` | - | `key` |

---

## social-feed

Home YouTube/Instagram auto-scrape feed.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/social-feed` | - | - |
| `GET` | `/api/social-feed/manage` | - | - |
| `PUT` | `/api/social-feed/manage` | - | config fields (verify in `server/routes/social-feed.ts`) |
| `POST` | `/api/social-feed/sync` | - | - |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
