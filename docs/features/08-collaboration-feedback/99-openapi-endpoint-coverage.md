# OpenAPI Endpoint Coverage — Collaboration, Feedback & Sharing

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the Collaboration, Feedback & Sharing category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## comments

Comment public/admin management and count endpoints.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/comments/` | targetId, x-guest-key | - |
| `POST` | `/api/comments/` | - | `targetId`, `parentId`, `body`, `displayName`, `isAnonymous`, `guestSecret` |
| `DELETE` | `/api/comments/{id}` | id*, x-guest-key | - |
| `PATCH` | `/api/comments/{id}` | id* | `body`, `guestSecret` |
| `GET` | `/api/comments/count` | targetId | - |
| `GET` | `/api/comments/manage` | targetId | - |

---

## feedback

Feedback public/own/manage/config/rating/bug-report flows.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `POST` | `/api/feedback/` | x-guest-key | `ratings`, `extraFields`, `gdriveLinks`, `mediaLinks`, `type`, `body`, `isAnonymous`, `senderName`, `senderNim`, `senderEmail` |
| `POST` | `/api/feedback/bug-report` | - | `gdriveLinks` |
| `DELETE` | `/api/feedback/bug-report/{id}` | id* | - |
| `POST` | `/api/feedback/bug-report/{id}/reply` | id* | `message` |
| `PATCH` | `/api/feedback/bug-report/{id}/status` | id* | `status` |
| `GET` | `/api/feedback/bug-report/count` | - | - |
| `GET` | `/api/feedback/bug-report/list` | status, page, limit | - |
| `GET` | `/api/feedback/config` | - | - |
| `GET` | `/api/feedback/manage` | type, hasReply, page, limit | - |
| `DELETE` | `/api/feedback/manage/{id}` | id* | - |
| `PATCH` | `/api/feedback/manage/{id}` | id* | `target`, `type` |
| `POST` | `/api/feedback/manage/{id}/decision` | id* | `comment` |
| `POST` | `/api/feedback/manage/{id}/reply` | id* | `#/components/schemas/GenericRequestBody` |
| `PATCH` | `/api/feedback/manage/{id}/visibility` | id* | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/feedback/manage/config` | - | - |
| `PATCH` | `/api/feedback/manage/config` | - | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/feedback/manage/counts-by-target` | - | - |
| `PATCH` | `/api/feedback/manage/footer-display` | - | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/feedback/manage/ratings` | - | - |
| `DELETE` | `/api/feedback/own/{id}` | id*, x-guest-key | - |
| `PATCH` | `/api/feedback/own/{id}` | id*, x-guest-key | `body` |
| `GET` | `/api/feedback/public` | x-guest-key | - |
| `GET` | `/api/feedback/ratings` | - | - |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
