# SOP 05 — Testing Strategy HMPS

## Baseline

```bash
npm run check
```

## Manual Smoke Matrix

| Area | Flow |
|------|------|
| Auth | login, me, logout, revoke session, OTP password |
| Dashboard | protected access, permission-denied state |
| Berita | public list/detail, create/update/delete |
| Events/Library | public detail and dashboard CRUD |
| Tenant | main path + `/api/c/:slug/*`, invalid slug, cross-tenant isolation |
| Store | product list/detail, cart, checkout, order detail, admin product |
| Upload | valid file, invalid mimetype, oversize, cleanup failure |
| Feedback/Comments | public submit, moderation, guest ownership |
| Sharing | invite/request/decision/revoke |
| Notifications | SSE stream, preferences, webpush subscribe |
| Chat | new chat, message, permission-aware tool call |
| Backup | request OTP + confirm restore in safe local env only |

## Regression Rule

Bugfix harus punya minimal:

- repro steps,
- root cause,
- expected behavior,
- verification performed.
