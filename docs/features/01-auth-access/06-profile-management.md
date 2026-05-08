# Profile Management

**Status**: Active | **Contract Confidence**: Verified from route scan | **Category**: auth access

---

## Deskripsi

Mengelola profil user login melalui endpoint auth profile.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai **Profile Management** sesuai flow aplikasi.
2. Sebagai maintainer, saya ingin source file dan endpoint fitur ini eksplisit agar tidak hilang saat refactor.
3. Sebagai reviewer, saya ingin contract yang belum pasti ditandai partial, bukan dikarang.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| PUT | `/api/auth/profile` | `server/routes.ts#L1851` | body: `username`, `name`, `divisionLabel` | 401, 404, 400, 500, 200/json |

---

## Observed Request Shape

```json
{
  "username": "new_username",
  "name": "Nama User",
  "divisionLabel": "Divisi"
}
```

---

## Observed Response Shape

Returns updated safe profile/user object or message-style error.

---

## Technical Design / Sources

- `server/routes.ts#L1851`
- profile/account UI surfaces

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
