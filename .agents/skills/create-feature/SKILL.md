---
name: create-feature
description: Use when building a new HMPS feature end-to-end.
---

# create-feature

## When to Use

Use when building a new HMPS feature end-to-end.

## HMPS Workflow

Create or update a feature doc from `docs/features/feature-template.md`. Define UI routes, API endpoints, permission, tenant behavior, data model/storage, docs updates, and verification. Implement backend and frontend using existing HMPS patterns.

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
- [ ] Official contributors remain @Sadamdi and @addid-cloud only (no AI author/Co-authored-by).
- [ ] `npm run check` or equivalent verification is run when code changes.
