---
name: debug-issue
description: Use when investigating HMPS bugs.
---

# debug-issue

## When to Use

Use when investigating HMPS bugs.

## HMPS Workflow

Reproduce the bug, identify module and route/page. Use graph tools if available. Trace UI -> API -> service/storage -> DB/external dependency. Check tenant context, auth/session, upload path, store pricing, chat key fallback, or notification stream depending on bug. Document root cause and verification.

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
- [ ] 
pm run check or equivalent verification is run when code changes.
