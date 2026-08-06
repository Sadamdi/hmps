# SOP 10 — Backend Service & Storage HMPS

## Scope

SOP ini berlaku untuk backend Express, route orchestration, services, storage, Mongo/Mongoose models, runtime helpers, scheduler, and integrations.

## Backend Layer Rules

| Layer | Location | Rule |
|-------|----------|------|
| Main route orchestration | `server/routes.ts` | Large route registry; keep handler safe and documented |
| Modular routes | `server/routes/*.ts` | `store`, `store-logic`, `chat`, `comments`, `feedback`, `sharing`, `notifications`, `social-feed`, `ai-enhance`, `system-errors` |
| Business services | `server/services/**` | Reusable logic + external wrappers (chat, OTP, email, Drive-related, shipping, prodi-sync, social-feed, error-monitor, backup, file-scanner, dll.) |
| Storage/data access | `server/mongo-storage.ts`, `server/tenant-storage.ts`, `server/*storage*`, `db/**` | Centralize DB access and tenant-aware queries |
| Primary schemas/models | `db/mongodb.ts`, `shared/schema.ts` | Source of truth for most collections/types |
| Extra models | `server/models/**` | Hanya model tambahan tipis (bukan lokasi utama semua schema) |
| Domain helpers | `server/auth.ts`, `server/upload.ts`, `server/googleDrive.ts`, `server/image-processor.ts`, `server/security.ts`, `server/swagger.ts` | Cross-cutting domain/runtime helpers |
| Sidecar | `server/banner-render-service.ts` | Process terpisah untuk render banner |
| Runtime helpers | `server/lib/**`, `server/middleware/**`, `server/config/**` | Infra; no UI assumptions |

## Route Handler Pattern

1. Resolve context: auth, tenant, user/session.
2. Validate params/query/body/files.
3. Check permission/ownership.
4. Execute service/storage operation.
5. Return safe response (de-facto `{ message }` atau envelope baru).
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
2. Gemini, OpenAI-compatible, SMTP, Google credential, Mongo backup URI must stay server-side.
3. Long-running work should be isolated in service/helper functions.
4. Scheduler jobs must be idempotent where possible.
5. Backup/restore and community delete flows require OTP or explicit confirmation path.
6. Social-feed / Prodi scrape harus soft-fail dan cache-aware.
7. Error-monitor capture harus best-effort.

## Documentation Required

Update:

- `docs/features/<category>/<feature>.md`,
- category `00-README.md`,
- `docs/features/feature-summary.md`,
- `docs/api/endpoints.md`,
- `docs/openapi.json` when public contract changes,
- `docs/version/` after the work unit is finished.
