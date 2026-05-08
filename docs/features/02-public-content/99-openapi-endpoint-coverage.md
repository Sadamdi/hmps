# OpenAPI Endpoint Coverage — Public Content & CMS

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the Public Content & CMS category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## berita

News/content listing, detail lookup, related content, and event attachment/copy flows.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/berita` | - | - |
| `POST` | `/api/berita` | - | `title`, `excerpt`, `content`, `published`, `gdriveUrl`, `tags`, `relatedGalleryIds`, `attachments` |
| `DELETE` | `/api/berita/{id}` | id* | - |
| `GET` | `/api/berita/{id}` | id* | - |
| `PUT` | `/api/berita/{id}` | id* | `tags`, `relatedGalleryIds`, `attachments`, `title`, `excerpt`, `content`, `published` |
| `GET` | `/api/berita/{id}([a-fA-F0-9]{24})/{slug}` | id*, 24*, slug* | - |
| `POST` | `/api/berita/{id}/attach-event` | id* | `eventId`, `copyFiles` |
| `DELETE` | `/api/berita/{id}/attach-event/{eventId}` | id*, eventId* | - |
| `POST` | `/api/berita/{id}/copy-to-event` | id* | `year`, `parentEventId`, `copyAttachments` |
| `GET` | `/api/berita/{id}/events` | id* | - |
| `GET` | `/api/berita/{id}/related` | id*, limit | - |
| `GET` | `/api/berita/manage` | - | - |
| `GET` | `/api/berita/slug/{slug}` | slug* | - |
| `GET` | `/api/berita/slug/{slug}/events` | slug* | - |
| `GET` | `/api/berita/slug/{slug}/related` | slug*, limit | - |

---

## dashboard

Dashboard content support endpoints.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/dashboard/activities` | limit, type | - |
| `POST` | `/api/dashboard/log-activity` | - | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/dashboard/stats` | - | - |

---

## settings

Site settings and dashboard/public configuration.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/settings` | - | - |
| `PUT` | `/api/settings` | - | `#/components/schemas/GenericRequestBody` |
| `PUT` | `/api/settings/home-config` | - | `navbar`, `navbarGroups`, `showDashboardLink` |
| `PUT` | `/api/settings/home-image-slots` | - | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/settings/middleware` | - | - |
| `PUT` | `/api/settings/middleware` | - | `updatedBy` |
| `POST` | `/api/settings/reset` | - | `#/components/schemas/GenericRequestBody` |

---

## stats

Public statistics.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/stats` | - | - |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
