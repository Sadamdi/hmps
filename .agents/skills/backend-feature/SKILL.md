---
name: backend-feature
description: Use when creating or changing HMPS Express backend routes, services, storage, models, or runtime helpers.
---

# backend-feature

## When to Use

Use for backend changes under `server/**`, `db/**`, or backend-facing shared contracts.

## Required References

- `docs/SOP/10-backend-service-storage.md`
- `docs/SOP/06-api-design.md`
- `docs/SOP/08-error-handling.md`
- `docs/features/feature-summary.md`
- `docs/api/endpoints.md`
- Relevant feature doc under `docs/features/`

## Workflow

1. Determine layer: route, service, storage, model, middleware, config, runtime helper.
2. Validate params/query/body/files before DB or external calls.
3. Enforce auth, permission, ownership, and tenant context server-side.
4. Keep reusable business logic in services/storage/helpers.
5. Return safe response; do not leak stack traces or secrets.
6. Cleanup temp files on upload failure.
7. Update feature docs, endpoints docs, OpenAPI if contract changes.
8. Run `npm run check`.

## Safety Checklist

- [ ] Auth/permission enforced server-side.
- [ ] Tenant context resolved by server middleware/storage.
- [ ] Query limits/pagination considered.
- [ ] Sensitive fields excluded from responses/logs.
- [ ] External integration errors are safe.
- [ ] Docs updated.

