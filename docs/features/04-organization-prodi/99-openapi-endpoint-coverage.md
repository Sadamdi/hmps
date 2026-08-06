# OpenAPI Endpoint Coverage — Organization & Prodi

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the Organization & Prodi category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## organization

Organization members, periods, positions, and public structure surfaces.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/organization/members` | - | - |
| `POST` | `/api/organization/members` | - | `gdriveUrl`, `position`, `period` |
| `DELETE` | `/api/organization/members/{id}` | id* | - |
| `GET` | `/api/organization/members/{id}` | id* | - |
| `PUT` | `/api/organization/members/{id}` | id* | `gdriveUrl`, `position`, `period` |
| `GET` | `/api/organization/periods` | - | - |
| `POST` | `/api/organization/periods` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/organization/periods/{period}` | period* | - |
| `GET` | `/api/organization/positions` | - | - |
| `POST` | `/api/organization/positions` | - | `positions` |
| `DELETE` | `/api/organization/positions/{period}` | period* | - |
| `GET` | `/api/organization/positions/{period}` | period* | - |
| `POST` | `/api/organization/positions/copy` | - | `targetPeriod` |
| `POST` | `/api/organization/structure-auto-fill` | - | `period`, `members`, `positions` |
| `POST` | `/api/organization/structure-auto-fill/apply` | - | `answers` |
| `POST` | `/api/organization/structure/copy` | - | `targetPeriod`, `overwrite` |

---

## prodi

Study program profile, lecturers, curriculum, lab, and sync data.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/prodi` | - | - |
| `GET` | `/api/prodi/curriculum/{year}` | year* | - |
| `POST` | `/api/prodi/curriculum/year` | - | `copyFromYear` |
| `GET` | `/api/prodi/manage` | - | - |
| `PUT` | `/api/prodi/manage` | - | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/prodi/preview` | - | - |
| `POST` | `/api/prodi/sync/run` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/prodi/upload/photo/lab` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/prodi/upload/photo/member` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/prodi/upload/photo/org-structure` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/prodi/calendar/upload` | - | calendar PDF upload fields (verify in `server/routes.ts` / prodi handlers) |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
