# OpenAPI Endpoint Coverage — AI Chat & Notifications

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the AI Chat & Notifications category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## chat

Gemini chat sessions, messages, history, admin/debug endpoints.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `DELETE` | `/api/chat/` | - | - |
| `DELETE` | `/api/chat/{id}` | id* | - |
| `GET` | `/api/chat/{id}/messages` | id* | - |
| `GET` | `/api/chat/all` | - | - |
| `GET` | `/api/chat/debug/apikeys` | - | - |
| `GET` | `/api/chat/history` | - | - |
| `POST` | `/api/chat/message` | - | `pageContext`, `message`, `chatId` |
| `POST` | `/api/chat/new` | - | `#/components/schemas/GenericRequestBody` |

---

## notifications

Notification stream, preferences, and web push subscriptions.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/notifications/preferences` | - | - |
| `PATCH` | `/api/notifications/preferences` | - | `event`, `commentReply`, `feedbackReply`, `bugReply` |
| `GET` | `/api/notifications/stream` | guestSecret | - |
| `GET` | `/api/notifications/stream/stats` | - | - |
| `POST` | `/api/notifications/webpush/subscribe` | user-agent | `keys`, `preferences`, `guestSecret` |
| `GET` | `/api/notifications/webpush/subscription-status` | endpoint | - |
| `DELETE` | `/api/notifications/webpush/unsubscribe` | - | - |
| `GET` | `/api/notifications/webpush/vapid-key` | - | - |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
