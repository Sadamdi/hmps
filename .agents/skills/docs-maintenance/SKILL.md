---
name: docs-maintenance
description: Use when adding, auditing, or updating HMPS docs/features/SOP/API documentation.
---

# docs-maintenance

## When to Use

Use for documentation updates under `docs/**`, `README.md`, `AGENTS.md`, and `.agents/skills/**`.

## Required References

- `docs/SOP/11-documentation-maintenance.md`
- `docs/version/versions.md`
- `docs/version/version-template.md`
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
7. After the work unit is finished: bump SemVer, write `docs/version/release/X.Y.Z.md`, update `versions.md` + `changelogs/CHANGELOG.md`, sync `package.json` and OpenAPI `info.version`.
8. Never document secret values or credential JSON contents.
9. Run coverage rules from SOP 11 and `npm run check` if relevant.

## Quality Checklist

- [ ] No invented request/response payloads.
- [ ] Source files referenced.
- [ ] Category indexes current.
- [ ] Feature summary current.
- [ ] Endpoint docs/OpenAPI current if API contract changed.
- [ ] Version Current bumped and release note complete.
- [ ] SOP claims match codebase (scripts, models location, response shape honesty).
