---
name: code-review
description: Use before merging/pushing HMPS changes.
---

# code-review

## When to Use

Use before merging/pushing HMPS changes.

## HMPS Workflow

Use code-review-graph MCP first when available; fall back to Grep/Read if the MCP server errors. Review correctness, auth/permission, tenant isolation, upload cleanup, store pricing/order state, notification leakage, chat tool permission, docs updates, and `npm run check` result. Do not add AI tools as contributors.

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
