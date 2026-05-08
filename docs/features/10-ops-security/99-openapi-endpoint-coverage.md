# OpenAPI Endpoint Coverage — Ops, Security & Maintenance

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the Ops, Security & Maintenance category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## admin

Admin maintenance endpoints.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `POST` | `/api/admin/migrate-community-media` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/admin/permissions/recompute-owner` | - | `#/components/schemas/GenericRequestBody` |

---

## backups

Database backup/restore/list/download operations.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/backups/monthly` | - | - |
| `POST` | `/api/backups/now` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/backups/restore/confirm` | - | `challengeId`, `code` |
| `POST` | `/api/backups/restore/request-otp` | - | `#/components/schemas/GenericRequestBody` |

---

## test

Diagnostics/test endpoints.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/test/protection` | - | - |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
