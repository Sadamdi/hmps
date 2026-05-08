---
name: read-sop
description: Use at the start of any HMPS planning/coding session.
---

# read-sop

## When to Use

Use at the start of any HMPS planning/coding session.

## HMPS Workflow

Read `AGENTS.md`, feature summary, endpoints, architecture docs, and SOPs relevant to the task. Identify whether the task touches tenant, upload/media, store, auth, chat, notifications, or backup. Summarize constraints before editing.

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
