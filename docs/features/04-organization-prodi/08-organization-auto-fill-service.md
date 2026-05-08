# Organization Auto-Fill Service

**Status**: Active | **Contract Confidence**: Partial from service scan | **Category**: organization prodi

---

## Deskripsi

Auto-fill struktur organisasi/periode/posisi untuk mempercepat setup kelembagaan.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai **Organization Auto-Fill Service** sesuai flow aplikasi.
2. Sebagai maintainer, saya ingin source file dan endpoint fitur ini eksplisit agar tidak hilang saat refactor.
3. Sebagai reviewer, saya ingin contract yang belum pasti ditandai partial, bukan dikarang.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| POST | `/api/organization/structure-auto-fill` | `server/routes.ts` | verify handler | generated plan/result |
| POST | `/api/organization/structure-auto-fill/apply` | `server/routes.ts` | apply payload | applied result |

---

## Observed Request Shape

Verify exact body in route handler.

---

## Observed Response Shape

Returns generated structure proposal or applied data.

---

## Technical Design / Sources

- `server/services/organization-structure-auto-fill.ts`
- `server/routes.ts`
- `client/src/pages/dashboard/kelembagaan.tsx`

---

## Business Rules From Code / Project Standards

1. Validate input before execution.
2. Enforce auth/permission server-side when protected.
3. Use tenant context only from server-side resolver for tenant-aware operations.
4. Never expose secrets, OTP, token, credential, backup URI, API key, password hash, or raw stack trace.

---

## Test Scenarios

| # | Scenario | Input/Action | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Happy path | valid request/call | success response/result from source |
| 2 | Unauthorized | missing auth where protected | 401/403 safe error |
| 3 | Invalid input | missing/invalid required field | safe error |
| 4 | Regression | `npm run check` | TypeScript passes |

---

## Unknown / To Verify

- Confirm exact runtime response body before publishing external API examples.
- Confirm client-side transforms before changing payload shape.
