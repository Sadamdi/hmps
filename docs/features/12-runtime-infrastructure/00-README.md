# Runtime Infrastructure

## Purpose

Runtime Infrastructure feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-security-middleware-modules.md](./01-security-middleware-modules.md) | 01-security-middleware-modules.md |
| [02-gemini-runtime-config.md](./02-gemini-runtime-config.md) | 02-gemini-runtime-config.md |
| [03-database-bootstrap-backup-clients.md](./03-database-bootstrap-backup-clients.md) | 03-database-bootstrap-backup-clients.md |
| [04-backend-relation-display-helpers.md](./04-backend-relation-display-helpers.md) | 04-backend-relation-display-helpers.md |
| [05-frontend-constants-formatting.md](./05-frontend-constants-formatting.md) | 05-frontend-constants-formatting.md |
| [06-runtime-cache-query-ip-helpers.md](./06-runtime-cache-query-ip-helpers.md) | 06-runtime-cache-query-ip-helpers.md |
| [07-web-push-service-worker-types.md](./07-web-push-service-worker-types.md) | 07-web-push-service-worker-types.md |
| [08-dev-swagger-runtime-entry-helpers.md](./08-dev-swagger-runtime-entry-helpers.md) | 08-dev-swagger-runtime-entry-helpers.md |
## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
