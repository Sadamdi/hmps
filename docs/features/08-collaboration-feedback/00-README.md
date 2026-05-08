# Collaboration, Feedback & Sharing

## Purpose

Collaboration, Feedback & Sharing feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-comments.md](./01-comments.md) | 01-comments.md |
| [02-feedback-public-ratings.md](./02-feedback-public-ratings.md) | 02-feedback-public-ratings.md |
| [03-feedback-moderation-config.md](./03-feedback-moderation-config.md) | 03-feedback-moderation-config.md |
| [04-bug-reports.md](./04-bug-reports.md) | 04-bug-reports.md |
| [05-sharing-workflow.md](./05-sharing-workflow.md) | 05-sharing-workflow.md |
| [06-sharing-notifications-summary.md](./06-sharing-notifications-summary.md) | Sharing Notifications & Summary |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — Collaboration, Feedback & Sharing |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `comments` | 6 | Comment public/admin management and count endpoints. |
| `feedback` | 23 | Feedback public/own/manage/config/rating/bug-report flows. |

## Endpoint Family Coverage

### comments

| Method | Path |
|--------|------|
| `GET` | `/api/comments/` |
| `POST` | `/api/comments/` |
| `DELETE` | `/api/comments/{id}` |
| `PATCH` | `/api/comments/{id}` |
| `GET` | `/api/comments/count` |
| `GET` | `/api/comments/manage` |

### feedback

| Method | Path |
|--------|------|
| `POST` | `/api/feedback/` |
| `POST` | `/api/feedback/bug-report` |
| `DELETE` | `/api/feedback/bug-report/{id}` |
| `POST` | `/api/feedback/bug-report/{id}/reply` |
| `PATCH` | `/api/feedback/bug-report/{id}/status` |
| `GET` | `/api/feedback/bug-report/count` |
| `GET` | `/api/feedback/bug-report/list` |
| `GET` | `/api/feedback/config` |
| `GET` | `/api/feedback/manage` |
| `DELETE` | `/api/feedback/manage/{id}` |
| `PATCH` | `/api/feedback/manage/{id}` |
| `POST` | `/api/feedback/manage/{id}/decision` |
| `POST` | `/api/feedback/manage/{id}/reply` |
| `PATCH` | `/api/feedback/manage/{id}/visibility` |
| `GET` | `/api/feedback/manage/config` |
| `PATCH` | `/api/feedback/manage/config` |
| `GET` | `/api/feedback/manage/counts-by-target` |
| `PATCH` | `/api/feedback/manage/footer-display` |
| `GET` | `/api/feedback/manage/ratings` |
| `DELETE` | `/api/feedback/own/{id}` |
| `PATCH` | `/api/feedback/own/{id}` |
| `GET` | `/api/feedback/public` |
| `GET` | `/api/feedback/ratings` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
