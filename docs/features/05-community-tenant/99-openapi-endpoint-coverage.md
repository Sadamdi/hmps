# OpenAPI Endpoint Coverage — Community Tenant

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the Community Tenant category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## communities

Public community listing.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/communities` | - | - |

---

## community

Tenant-scoped community API surface.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `DELETE` | `/api/community` | - | - |
| `POST` | `/api/community/request-delete-otp` | x-forwarded-for | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/community/verify-delete-otp` | - | `challengeId`, `otp` |

---

## register

Public community registration request flow.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `POST` | `/api/register/community` | - | `code`, `communityName`, `slug`, `ownerUsername`, `ownerPassword`, `ownerEmail`, `ownerName`, `description`, `contactEmail`, `address`, `socialLinks`, `initialDivisionCount`, `bphPositions`, `autoCreateAccounts`, `accountEntries`, `aboutPageTrackRecord`, `aboutPageLambang`, `logoUrl` |
| `POST` | `/api/register/upload` | - | `code`, `category`, `key` |
| `POST` | `/api/register/validate-code` | - | `code` |

---

## registration

Community registration code and community lifecycle management.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/registration/codes` | - | - |
| `POST` | `/api/registration/codes` | - | `maxUses`, `expiresInHours`, `note` |
| `DELETE` | `/api/registration/codes/{id}` | id* | - |
| `PATCH` | `/api/registration/codes/{id}` | id* | `regenerateCode`, `maxUsesIncrement`, `extendHours`, `note` |
| `DELETE` | `/api/registration/codes/{id}/permanent` | id*, confirmUsedDelete | - |
| `GET` | `/api/registration/communities` | - | - |
| `DELETE` | `/api/registration/communities/{id}` | id* | - |
| `PUT` | `/api/registration/communities/{id}` | id* | `name`, `description`, `ownerUsername`, `ownerEmail`, `status` |
| `POST` | `/api/registration/communities/{id}/repair` | id* | `newPassword` |
| `POST` | `/api/registration/communities/{id}/request-delete-otp` | id*, x-forwarded-for | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/registration/communities/{id}/verify-delete-otp` | id* | `otp` |
| `GET` | `/api/registration/communities/health` | - | - |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
