# Sharing Notifications & Summary

**Status**: Active | **Contract Confidence**: Verified from route scan | **Category**: collaboration feedback

---

## Deskripsi

Sharing summary, notifications, mark-read, dan user search untuk invite/request access.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai **Sharing Notifications & Summary** sesuai flow aplikasi.
2. Sebagai maintainer, saya ingin source file dan endpoint fitur ini eksplisit agar tidak hilang saat refactor.
3. Sebagai reviewer, saya ingin contract yang belum pasti ditandai partial, bukan dikarang.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| GET | `/api/sharing/my-summary` | `server/routes/sharing.ts` | session user | summary data |
| GET | `/api/sharing/notifications` | `server/routes/sharing.ts` | session user | notification list |
| POST | `/api/sharing/notifications/read` | `server/routes/sharing.ts` | verify handler | mark-read result |
| GET | `/api/sharing/users/search` | `server/routes/sharing.ts` | query search | user search result |

---

## Observed Request Shape

Verify exact query/body in `server/routes/sharing.ts`.

---

## Observed Response Shape

Returns summary/list/read/user-search results.

---

## Technical Design / Sources

- `server/routes/sharing.ts`
- `server/services/notification-orchestrator.ts`

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
