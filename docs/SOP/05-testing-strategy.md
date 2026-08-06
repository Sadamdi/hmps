# SOP 05 — Testing Strategy HMPS

## Reality Check

Saat ini **tidak ada** automated test suite (`*.test` / `*.spec`) dan **tidak ada** script `test` di `package.json`. Baseline verifikasi adalah TypeScript check + manual smoke.

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
| Store | product list/detail, cart, checkout, order detail, admin product; dynamic store navbar path |
| Upload | valid file, invalid mimetype, oversize, cleanup failure |
| Feedback/Comments | public submit, moderation, guest ownership |
| Sharing | invite/request/decision/revoke |
| Notifications | SSE stream, preferences, webpush subscribe |
| Chat / AI | new chat, message, permission-aware tool call; `/api/ai` enhance bila diubah |
| Social feed | home YT/IG feed load + soft-fail |
| Prodi | student hub, calendar PDF, sync/repair paths |
| System errors | client report + owner dashboard list/analyze (owner-only) |
| Banner render | sidecar health jika proses dipakai di env |
| Backup | request OTP + confirm restore in safe local env only |

## Regression Rule

Bug fix harus punya minimal:

- repro steps,
- root cause,
- expected behavior,
- verification performed (`npm run check` + smoke area terkait).

## Future (belum wajib)

Menambah runner (Vitest/Jest) dan smoke API automated boleh direncanakan terpisah; sampai ada, jangan dokumentasikan seolah suite sudah ada.
