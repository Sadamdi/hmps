# OpenAPI Endpoint Coverage — Events & Library

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the Events & Library category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## event-years

Event period/year lifecycle and event count helpers.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/event-years` | - | - |
| `POST` | `/api/event-years` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/event-years/{id}` | id* | - |
| `PATCH` | `/api/event-years/{id}` | id* | `#/components/schemas/GenericRequestBody` |
| `PATCH` | `/api/event-years/{id}/activate` | id* | `#/components/schemas/GenericRequestBody` |
| `PATCH` | `/api/event-years/{id}/deactivate` | id* | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/event-years/{id}/events-count` | id* | - |

---

## events

Event listing, detail, year/slug lookup, and berita attachment/copy flows.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/events` | parentId | - |
| `POST` | `/api/events` | - | `parentId` |
| `DELETE` | `/api/events/{id}` | id* | - |
| `GET` | `/api/events/{id}` | id*, children | - |
| `PATCH` | `/api/events/{id}` | id* | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/events/{id}/attach-berita` | id* | `beritaId`, `copyFiles` |
| `DELETE` | `/api/events/{id}/attach-berita/{beritaId}` | id*, beritaId* | - |
| `POST` | `/api/events/{id}/copy-to-berita` | id* | `copyAttachments` |
| `GET` | `/api/events/active-home` | - | - |
| `GET` | `/api/events/by-year/{year}` | year*, parentOnly | - |
| `GET` | `/api/events/published` | - | - |
| `GET` | `/api/events/year/{year}/slug/{slug}` | year*, slug*, children | - |

---

## library

Library folder/file public and admin surfaces.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/library` | - | - |
| `POST` | `/api/library` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/library/{id}` | id* | - |
| `GET` | `/api/library/{id}` | id* | - |
| `PUT` | `/api/library/{id}` | id* | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/library/{libraryId}/folder/{folderId}/files` | libraryId*, folderId* | - |
| `GET` | `/api/library/manage` | - | - |
| `GET` | `/api/library/slug/{slug}` | slug* | - |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
