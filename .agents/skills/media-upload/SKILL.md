---
name: media-upload
description: Use for upload, image processing, local media, or Google Drive integration.
---

# media-upload

## When to Use

Use for upload, image processing, local media, or Google Drive integration.

## HMPS Workflow

Use `server/upload.ts`, `image-processor.ts`, `googleDrive.ts`, and file scanner patterns. Validate mimetype/size, sanitize paths, process images safely, cleanup temp files, scope tenant media, and never expose credentials or unvalidated Drive URLs.

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
