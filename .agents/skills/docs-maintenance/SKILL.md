---
name: docs-maintenance
description: Use when adding, auditing, or updating HMPS docs/features/SOP/API documentation.
---

# docs-maintenance

## When to Use

Use for documentation updates under `docs/**`, `README.md`, `AGENTS.md`, and `.agents/skills/**`.

## Required References

- `docs/SOP/11-documentation-maintenance.md`
- `docs/features/feature-summary.md`
- `docs/features/feature-template.md`
- `docs/api/endpoints.md`
- `docs/architecture/project-structure.md`

## Workflow

1. Verify current code first; do not copy stale docs.
2. Map route/page/service/runtime files to correct feature category.
3. Use `feature-template.md` for new feature docs.
4. Mark uncertain contract as `Partial`, `Unknown`, or `Needs runtime verification`.
5. Update category README and feature summary counts.
6. Update README navigation if docs entry point changes.
7. Never document secret values or credential JSON contents.
8. Run coverage scripts/checks when available and `npm run check` if relevant.

## Quality Checklist

- [ ] No invented request/response payloads.
- [ ] Source files referenced.
- [ ] Category indexes current.
- [ ] Feature summary current.
- [ ] Endpoint docs/OpenAPI current if API contract changed.

