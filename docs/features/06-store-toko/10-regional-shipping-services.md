# Regional & Shipping Services

**Status**: Active | **Contract Confidence**: Verified from route/service scan | **Category**: store toko

---

## Deskripsi

Integrasi regional API dan shipping quote untuk checkout toko.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai **Regional & Shipping Services** sesuai flow aplikasi.
2. Sebagai maintainer, saya ingin source file dan endpoint fitur ini eksplisit agar tidak hilang saat refactor.
3. Sebagai reviewer, saya ingin contract yang belum pasti ditandai partial, bukan dikarang.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| GET | `/api/store/public/regional/provinces` | `server/routes/store.ts` | none | province list |
| GET | `/api/store/public/regional/provinces/:code/regencies` | `server/routes/store.ts` | params: code | regency list |
| GET | `/api/store/public/regional/regencies/:code/districts` | `server/routes/store.ts` | params: code | district list |
| GET | `/api/store/public/regional/districts/:code/villages` | `server/routes/store.ts` | params: code | village list |
| POST | `/api/store/shipping/quote` | `server/routes/store.ts` | checkout/shipping body | quote result |

---

## Observed Request Shape

Regional endpoints use `code` params. Shipping quote body should be verified in route.

---

## Observed Response Shape

Returns normalized regional list or shipping quote result.

---

## Technical Design / Sources

- `server/services/regional-api-co-id.ts`
- `server/services/shipping-api-co-id.ts`
- `server/routes/store.ts`

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
