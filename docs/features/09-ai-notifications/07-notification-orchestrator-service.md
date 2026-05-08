# Notification Orchestrator & Stream Services

**Status**: Active | **Contract Confidence**: Partial from route/service scan | **Category**: ai notifications

---

## Deskripsi

Broadcast notification, SSE lifecycle, tenant-aware notification context, dan event-triggered notification.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai **Notification Orchestrator & Stream Services** sesuai flow aplikasi.
2. Sebagai maintainer, saya ingin source file dan endpoint fitur ini eksplisit agar tidak hilang saat refactor.
3. Sebagai reviewer, saya ingin contract yang belum pasti ditandai partial, bukan dikarang.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| GET | `/api/notifications/stream` | `server/routes/notifications.ts` | SSE connection | event stream |
| GET | `/api/notifications/stream/stats` | `server/routes/notifications.ts` | none observed | stream stats |

---

## Observed Request Shape

SSE uses request context. Broadcast uses service payload.

---

## Observed Response Shape

SSE events/stats or service broadcast result.

---

## Technical Design / Sources

- `server/services/notification-orchestrator.ts`
- `server/services/notification-stream.ts`
- `server/routes/notifications.ts`

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
