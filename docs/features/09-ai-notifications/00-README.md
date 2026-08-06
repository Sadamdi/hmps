# AI Chat & Notifications

## Purpose

AI Chat & Notifications feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-gemini-chat-sessions.md](./01-gemini-chat-sessions.md) | 01-gemini-chat-sessions.md |
| [02-ai-tools-recommendations.md](./02-ai-tools-recommendations.md) | 02-ai-tools-recommendations.md |
| [03-notification-stream.md](./03-notification-stream.md) | 03-notification-stream.md |
| [04-preferences-webpush.md](./04-preferences-webpush.md) | 04-preferences-webpush.md |
| [05-chat-service.md](./05-chat-service.md) | Chat Service |
| [06-recommendation-service.md](./06-recommendation-service.md) | Recommendation Service |
| [07-notification-orchestrator-service.md](./07-notification-orchestrator-service.md) | Notification Orchestrator & Stream Services |
| [09-content-enhance-ai.md](./09-content-enhance-ai.md) | Content enhance via `/api/ai/enhance-content` |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — AI Chat & Notifications |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `chat` | 8 | Gemini chat sessions, messages, history, admin/debug endpoints. |
| `notifications` | 8 | Notification stream, preferences, and web push subscriptions. |
| `ai` | 1 | Content enhance endpoint. |

## Endpoint Family Coverage

### chat

| Method | Path |
|--------|------|
| `DELETE` | `/api/chat/` |
| `DELETE` | `/api/chat/{id}` |
| `GET` | `/api/chat/{id}/messages` |
| `GET` | `/api/chat/all` |
| `GET` | `/api/chat/debug/apikeys` |
| `GET` | `/api/chat/history` |
| `POST` | `/api/chat/message` |
| `POST` | `/api/chat/new` |

### notifications

| Method | Path |
|--------|------|
| `GET` | `/api/notifications/preferences` |
| `PATCH` | `/api/notifications/preferences` |
| `GET` | `/api/notifications/stream` |
| `GET` | `/api/notifications/stream/stats` |
| `POST` | `/api/notifications/webpush/subscribe` |
| `GET` | `/api/notifications/webpush/subscription-status` |
| `DELETE` | `/api/notifications/webpush/unsubscribe` |
| `GET` | `/api/notifications/webpush/vapid-key` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
