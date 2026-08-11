---
name: mongoose-repository
description: Use for MongoDB/Mongoose/storage/query changes.
---

# mongoose-repository

## When to Use

Use for MongoDB/Mongoose/storage/query changes.

## HMPS Workflow

Check `db/mongodb.ts`, `server/mongo-storage.ts`, `server/tenant-storage.ts`, and relevant models. Add schema validation/indexes, avoid sensitive fields, scope tenant/ownership queries, and keep shared types frontend-safe.

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
