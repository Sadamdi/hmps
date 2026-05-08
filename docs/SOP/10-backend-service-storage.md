# SOP 10 — Backend Service & Storage HMPS

## Scope

SOP ini berlaku untuk backend Express, route orchestration, services, storage, Mongo/Mongoose models, runtime helpers, scheduler, and integrations.

## Backend Layer Rules

| Layer | Location | Rule |
|-------|----------|------|
| Main route orchestration | `server/routes.ts` | Existing large route registry; keep handler safe and documented |
| Modular routes | `server/routes/*.ts` | Use for larger feature routers: store/chat/comments/feedback/sharing/notifications |
| Business services | `server/services/**` | Reusable business logic and external integration wrappers |
| Storage/data access | `server/mongo-storage.ts`, `server/*storage*`, `db/**` | Centralize DB access and tenant-aware queries |
| Mongoose models | `server/models/**`, `db/mongodb.ts` | Schema/model definitions and indexes |
| Runtime helpers | `server/lib/**`, `server/middleware/**`, `server/config/**` | Cross-cutting infra; no UI assumptions |

## Route Handler Pattern

Use this sequence:

1. Resolve context: auth, tenant, user/session.
2. Validate params/query/body/files.
3. Check permission/ownership.
4. Execute service/storage operation.
5. Return safe response.
6. Log activity/security event if sensitive.
7. Cleanup temp files on failure.

## Storage Rules

1. Tenant-aware operations must use server-resolved tenant context.
2. Never trust tenant slug/context from client without resolver.
3. Do not return password hash, OTP, session token, API key, credential path, or backup URI.
4. Add query limits/pagination for list/search endpoints.
5. Ensure slug/owner/tenant/createdAt lookup paths have suitable indexes when relevant.

## Service Rules

1. External integrations must return safe errors.
2. Gemini, SMTP, Google credential, Mongo backup URI must stay server-side.
3. Long-running work should be isolated in service/helper functions.
4. Scheduler jobs must be idempotent where possible.
5. Backup/restore and community delete flows require OTP or explicit confirmation path.

## Documentation Required

Update:

- `docs/features/<category>/<feature>.md`,
- category `00-README.md`,
- `docs/features/feature-summary.md`,
- `docs/api/endpoints.md`,
- `docs/openapi.json` when public contract changes.
