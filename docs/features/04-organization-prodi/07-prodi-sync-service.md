# Prodi Sync Service

**Status**: Active | **Contract Confidence**: Partial from service scan | **Category**: organization prodi

---

## Deskripsi

Sinkronisasi data prodi dari sumber remote/internal untuk dosen, curriculum, lab, dan media akademik.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai **Prodi Sync Service** sesuai flow aplikasi.
2. Sebagai maintainer, saya ingin source file dan endpoint fitur ini eksplisit agar tidak hilang saat refactor.
3. Sebagai reviewer, saya ingin contract yang belum pasti ditandai partial, bukan dikarang.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| POST | `/api/prodi/sync/run` | `server/routes.ts` | sync trigger body if any | sync result |

---

## Observed Request Shape

Verify exact trigger options in route.

---

## Observed Response Shape

Returns sync summary/result or safe external fetch error.

---

## Technical Design / Sources

- `server/services/prodi-sync.ts`
- `server/routes.ts`
- `client/src/pages/dashboard/prodi.tsx`

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
