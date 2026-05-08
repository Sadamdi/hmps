# Ops, Security & Maintenance

## Purpose

Ops, Security & Maintenance feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-security-middleware.md](./01-security-middleware.md) | 01-security-middleware.md |
| [02-runtime-middleware-settings.md](./02-runtime-middleware-settings.md) | 02-runtime-middleware-settings.md |
| [03-backup-restore.md](./03-backup-restore.md) | 03-backup-restore.md |
| [04-cleanup-migration.md](./04-cleanup-migration.md) | 04-cleanup-migration.md |
| [05-api-docs-swagger.md](./05-api-docs-swagger.md) | 05-api-docs-swagger.md |
| [06-deployment-scheduler.md](./06-deployment-scheduler.md) | 06-deployment-scheduler.md |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — Ops, Security & Maintenance |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `admin` | 2 | Admin maintenance endpoints. |
| `backups` | 4 | Database backup/restore/list/download operations. |
| `test` | 1 | Diagnostics/test endpoints. |

## Endpoint Family Coverage

### admin

| Method | Path |
|--------|------|
| `POST` | `/api/admin/migrate-community-media` |
| `POST` | `/api/admin/permissions/recompute-owner` |

### backups

| Method | Path |
|--------|------|
| `GET` | `/api/backups/monthly` |
| `POST` | `/api/backups/now` |
| `POST` | `/api/backups/restore/confirm` |
| `POST` | `/api/backups/restore/request-otp` |

### test

| Method | Path |
|--------|------|
| `GET` | `/api/test/protection` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
