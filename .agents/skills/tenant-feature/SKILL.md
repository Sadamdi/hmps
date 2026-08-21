---
name: tenant-feature
description: Use for features that must work in community tenant context.
---

# tenant-feature

## When to Use

Use for features that must work in community tenant context.

## HMPS Workflow

Read `docs/architecture/multi-tenant.md`. Use trusted tenant resolver, never request body context. Test main and `/api/c/:slug/*`, invalid slug, cross-tenant isolation, scoped uploads, notifications, sharing, and restore behavior.

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
