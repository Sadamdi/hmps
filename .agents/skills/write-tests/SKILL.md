---
name: write-tests
description: Use when adding verification for HMPS changes.
---

# write-tests

## When to Use

Use when adding verification for HMPS changes.

## HMPS Workflow

Map changed flows to smoke matrix: auth, dashboard, tenant, upload, store, collaboration, chat, backup. Run `npm run check`; add targeted tests/manual steps for success, validation, permission, tenant boundary, and cleanup failure where relevant.

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
