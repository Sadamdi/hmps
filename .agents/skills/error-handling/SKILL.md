---
name: error-handling
description: Use when implementing/reviewing error paths.
---

# error-handling

## When to Use

Use when implementing/reviewing error paths.

## HMPS Workflow

Follow `docs/SOP/08-error-handling.md`. Fail closed for auth/tenant/upload/security. Map errors to status codes. Log context without password, OTP, JWT, Gemini key, Google credential, SMTP password, or backup URI. Cleanup uploaded files on failure.

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
