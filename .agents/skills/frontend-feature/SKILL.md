---
name: frontend-feature
description: Use when creating or changing HMPS React/Vite frontend pages, components, hooks, or client utilities.
---

# frontend-feature

## When to Use

Use for changes under `client/src/**` including pages, components, hooks, lib helpers, tenant frontend behavior, public widgets, dashboard UI, store UI, auth UI, comments/feedback/sharing UI, and notification UI.

## Required References

- `docs/SOP/09-frontend-architecture.md`
- `docs/SOP/02-code-standards.md`
- `docs/features/feature-summary.md`
- Relevant feature doc under `docs/features/`
- `client/src/App.tsx` when routes change

## Workflow

1. Identify whether the UI is public, dashboard, tenant, store, auth, media, or collaboration.
2. Reuse existing components before creating new ones.
3. Keep API calls in hooks/lib helpers when flow is shared or complex.
4. Use TanStack Query for server state.
5. Implement loading, error, empty, success, and permission states.
6. Keep tenant API rewrite/context safe; never trust client tenant for server authorization.
7. Update feature docs and route inventory when user-facing behavior changes.
8. Run `npm run check`.

## Safety Checklist

- [ ] Props/types are explicit.
- [ ] No secrets in `VITE_*` or client code.
- [ ] Protected route is backed by server auth/permission.
- [ ] Tenant context does not bypass backend resolver.
- [ ] Upload/rich content uses existing safe helpers.
- [ ] Feature docs updated.

