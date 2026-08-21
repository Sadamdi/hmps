---
name: create-endpoint
description: Use when adding/changing Express endpoints.
---

# create-endpoint

## When to Use

Use when adding/changing Express endpoints.

## HMPS Workflow

Check `docs/SOP/06-api-design.md`. Decide prefix: `/api`, `/api/c/:slug`, or `/api/store`. Validate params/query/body, enforce auth/permission, handle tenant context, return safe errors, update `docs/api/endpoints.md` and OpenAPI if applicable.

## Required References

- AGENTS.md
- docs/features/feature-summary.md
- docs/api/endpoints.md
- docs/SOP/01-development-workflow.md
- docs/SOP/02-code-standards.md
- docs/SOP/06-api-design.md
- docs/SOP/08-error-handling.md
- docs/architecture/application-architecture.md
- docs/architecture/multi-tenant.md when tenant-aware

## HMPS Safety Checklist

- [ ] Auth and permission are server-enforced.
- [ ] Tenant context is trusted and scoped.
- [ ] Upload/media paths are validated if files are involved.
- [ ] Secrets stay server-side and out of logs.
- [ ] Feature/API docs are updated when behavior changes.
- [ ] `npm run check` or equivalent verification is run when code changes.
