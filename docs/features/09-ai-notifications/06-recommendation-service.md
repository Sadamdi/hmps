# Recommendation Service

**Status**: Active | **Contract Confidence**: Partial from service scan | **Category**: ai notifications

---

## Deskripsi

Internal recommendation service untuk AI/tooling atau rekomendasi berbasis konteks.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai **Recommendation Service** sesuai flow aplikasi.
2. Sebagai maintainer, saya ingin source file dan endpoint fitur ini eksplisit agar tidak hilang saat refactor.
3. Sebagai reviewer, saya ingin contract yang belum pasti ditandai partial, bukan dikarang.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| N/A | Internal service | `server/services/recommendation.ts` | service input | recommendation result |

---

## Observed Request Shape

No direct HTTP body.

---

## Observed Response Shape

Returns recommendation objects.

---

## Technical Design / Sources

- `server/services/recommendation.ts`
- `server/services/ai-tools.ts`

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
