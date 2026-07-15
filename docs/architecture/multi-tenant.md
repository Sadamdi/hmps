# Multi-Tenant Architecture — HMPS Community

## Contexts

| Context | UI | API | Storage |
|---------|----|-----|---------|
| Main HMPS | `/...` | `/api/...` | main DB/storage |
| Community Tenant | `/:slug/*` | `/api/c/:slug/*` | tenant DB/storage |

## Flow

```mermaid
sequenceDiagram
  participant UI as Community UI
  participant API as Express
  participant Resolver as Tenant Resolver
  participant Storage as Tenant Storage
  participant DB as Tenant DB
  UI->>API: /api/c/:slug/...
  API->>Resolver: validate slug
  Resolver->>Storage: attach tenant context/models
  Storage->>DB: scoped query
  DB-->>UI: tenant-safe data
```

## Rules

- Slug must be resolved by server, not trusted from request body.
- Tenant database name/model set comes from trusted registry.
- Main and tenant data must not be mixed accidentally.
- Global-only operations must explicitly reject tenant context.
- Tenant deletion/restore flows require OTP or owner-level authorization.

## Home / provisioning defaults

- New tenants seed `homeConfig` from `DEFAULT_TENANT_HOME_CONFIG` (no Prodi) via `initializeTenantSettings` in `server/tenant-storage.ts`.
- `navbarBrand` uses full community name (not truncated to 10 chars).
- Public home (`client/src/pages/index.tsx`): if tenant and `homeConfig.blocks` is empty, fallback to `DEFAULT_TENANT_HOME_CONFIG`, **not** main `DEFAULT_HOME_CONFIG`.
- Shared feedback/security code paths apply equally to `/api/feedback` and `/api/c/:slug/feedback`.

## Tenant-Aware Feature Checklist

- [ ] Works on main path if expected.
- [ ] Works on `/api/c/:slug/*` if expected.
- [ ] Invalid slug returns safe error.
- [ ] Tenant A cannot read/write Tenant B data.
- [ ] Upload paths and media URLs are scoped safely.
- [ ] Notifications/chat/sharing do not cross tenant boundary.
- [ ] Empty tenant `homeConfig` does not render main-only sections (e.g. Prodi).

## Key Files

- `server/middleware/tenant-resolver.ts`
- `server/tenant-storage.ts`
- `db/tenant.ts`
- `client/src/pages/community/index.tsx`
- `client/src/pages/index.tsx`
- `shared/schema.ts` (`DEFAULT_TENANT_HOME_CONFIG`)
- `server/routes.ts`
