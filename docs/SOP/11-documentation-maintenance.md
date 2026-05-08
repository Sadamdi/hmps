# SOP 11 — Documentation Maintenance HMPS

## Scope

SOP ini mengatur cara menjaga dokumentasi HMPS tetap code-accurate setelah perubahan frontend/backend/runtime.

## Source of Truth Order

1. Current codebase implementation.
2. `docs/features/feature-summary.md`.
3. Feature docs under `docs/features/<category>/`.
4. `docs/api/endpoints.md` and OpenAPI files.
5. SOP and architecture docs.

## Required Updates by Change Type

| Change | Required Docs |
|--------|---------------|
| New endpoint | feature doc, category README, endpoints.md, OpenAPI if public/stable |
| Endpoint request/response change | feature doc observed contract, endpoints.md, OpenAPI |
| New frontend route/page | feature doc or auxiliary route inventory, feature summary |
| New component/hook/lib affecting feature | feature doc or auxiliary runtime doc |
| New service/model/storage | feature doc technical design and feature summary coverage |
| New middleware/config/runtime helper | runtime infrastructure doc and feature summary |
| Tenant behavior change | tenant feature doc and multi-tenant architecture doc |
| Upload/media behavior change | media feature doc and security/error notes |
| Auth/permission behavior change | auth feature doc and endpoints/security notes |

## Feature Doc Quality Rules

1. Do not invent request/response examples.
2. Use observed contract from route/schema/service when possible.
3. Mark uncertain contract as `Partial`, `Unknown`, or `Needs runtime verification`.
4. Include source file references.
5. Include security/tenant/media notes when relevant.
6. Keep category indexes current.

## Coverage Audit Checklist

After large changes, verify:

- Express routes are mapped.
- Frontend pages are mapped.
- Services/models/storage are mapped.
- Runtime middleware/config/helpers are mapped.
- README navigation still points to correct docs.
- `npm run check` passes if code or TypeScript-aware docs references changed.

## Do Not Document Secrets

Never include values/content of:

- `.env`,
- service account JSON,
- JWT secret,
- Gemini key,
- SMTP password,
- backup URI,
- tokens or OTP.
