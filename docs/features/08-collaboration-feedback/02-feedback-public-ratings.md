# Feedback Public Ratings

**Status**: Active | **Contract Confidence**: Verified from route scan  | **Category**: collaboration feedback

---

## Deskripsi

Fitur **Feedback Public Ratings** terdokumentasi ulang dari audit code HMPS New, bukan dari payload template. Endpoint, parameter, body field, dan status response di bawah berasal dari static scan terhadap route handler di `server/routes.ts` dan `server/routes/*.ts` dan hanya membaca file HMPS New.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai fitur **Feedback Public Ratings** melalui UI terkait agar kebutuhan operasional atau informasi terpenuhi.
2. Sebagai maintainer, saya ingin mengetahui endpoint dan source file aktual agar perubahan tidak salah kontrak.
3. Sebagai reviewer, saya ingin melihat field request/response yang terdeteksi dari code agar tidak mengandalkan contoh generik.

---

## UI / User Flow

| Item | Value |
|------|-------|
| UI routes/surfaces | `feedback widgets` |
| Frontend source | `client/src/App.tsx`, `client/src/pages/**`, targeted components/hooks |
| Backend source | Route table below |

Flow umum:

1. UI membuka route/surface di atas.
2. UI mengirim request ke endpoint yang relevan.
3. Backend melakukan validasi, auth/permission, dan tenant resolver bila endpoint tenant-aware.
4. Handler memanggil storage/service/model terkait.
5. Response dikembalikan sesuai handler aktual.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| GET | `/api/store/public/gdrive-image/:fileId` | `server/routes/store.ts#L486` | params: fileId | 400, 404, 500 |
| GET | `/api/store/public/settings` | `server/routes/store.ts#L525` | none observed in handler window | 500, 200/json |
| GET | `/api/store/public/categories` | `server/routes/store.ts#L550` | none observed in handler window | 500, 200/json |
| GET | `/api/store/public/regional/provinces` | `server/routes/store.ts#L565` | none observed in handler window | 500, 200/json |
| GET | `/api/store/public/regional/provinces/:code/regencies` | `server/routes/store.ts#L577` | params: code | 500, 200/json |
| GET | `/api/store/public/regional/regencies/:code/districts` | `server/routes/store.ts#L587` | params: code | 500, 200/json |
| GET | `/api/store/public/regional/districts/:code/villages` | `server/routes/store.ts#L597` | params: code | 500, 200/json |
| GET | `/api/store/public/campaigns` | `server/routes/store.ts#L668` | none observed in handler window | 500, 200/json |
| GET | `/api/store/public/bundles` | `server/routes/store.ts#L684` | none observed in handler window | 500, 200/json |
| GET | `/api/store/public/bundles/:slug` | `server/routes/store.ts#L698` | params: slug | 404, 500, 200/json |
| GET | `/api/store/public/products` | `server/routes/store.ts#L712` | query: q, category, page, limit, sort | 500, 200/json |
| GET | `/api/store/public/products/:slug` | `server/routes/store.ts#L770` | params: slug | 404, 500, 200/json |
| GET | `/public` | `server/routes/feedback.ts` | query: `limit` (optional, default 40) | 500, 200/json array |
| GET | `/ratings` | `server/routes/feedback.ts` | none observed in handler window | 500, 200/json |
| PATCH | `/own/:id` | `server/routes/feedback.ts` | params: id; body: body; header `x-guest-key` | 400, 401, 404, 403, 500, 200/json |
| DELETE | `/own/:id` | `server/routes/feedback.ts` | params: id; header `x-guest-key` | 401, 404, 403, 500, 200/json |
| GET | `/manage/ratings` | `server/routes/feedback.ts` | auth | 500, 200/json |

---

## Observed Request Shape

- `PATCH /own/:id` body fields observed: `body`

> [!IMPORTANT]
> Field di atas adalah hasil static scan sekitar route handler. Untuk perubahan implementasi, buka source file dan line yang tercantum untuk memastikan validasi lengkap, default value, dan transformasi data.

---

## Observed Response Shape

Static scan menemukan pola response berikut:

- Status JSON yang terdeteksi: `200/json, 400, 401, 403, 404, 500`
- Banyak endpoint existing HMPS masih memakai campuran `{ message }`, array langsung, object langsung, atau `{ success, data }` tergantung handler.
- Jangan menulis contoh response final kecuali sudah dicek pada handler spesifik.

Recommended response untuk endpoint baru tetap mengikuti SOP API:

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

---

## Technical Design

### Frontend Surface

| Concern | Actual Pattern |
|---------|----------------|
| Routing | Wouter route composition in `client/src/App.tsx` |
| Server State | TanStack React Query / API helper where implemented |
| UI States | Loading, empty, error, success state expected for async surfaces |
| Permission UX | UI guard is convenience only; backend remains source of truth |

### Backend Surface

| Concern | Actual Pattern |
|---------|----------------|
| Route orchestration | `server/routes.ts` for core modules; `server/routes/*.ts` for modular features |
| Business logic | `server/services/**`, storage helpers, or route-local orchestration |
| Data access | `server/mongo-storage.ts`, `server/tenant-storage.ts`, `db/mongodb.ts`, `server/models/**` |
| Contracts | Mixed existing response style; new work should follow `docs/SOP/06-api-design.md` |

---

## Business Rules From Project Standards

1. Validate params/query/body before database or external service calls.
2. Enforce auth and permission on protected/dashboard/admin routes server-side.
3. For tenant-aware behavior, trust tenant context only from server resolver.
4. Never expose password hashes, OTP, JWT/session token, Gemini key, Google credential, SMTP password, backup URI, or raw stack trace.
5. Update `docs/api/endpoints.md`, OpenAPI docs, and this feature doc when endpoint behavior changes.

---

## Security & Tenant Notes

| Concern | Required Handling |
|---------|-------------------|
| Auth | Public submit/public cards; manage requires `feedback.view` / `feedback.manage` |
| Permission | Visibility publish is admin-only; new submits start with `isVisibleCard: false` |
| Tenant | Same handlers via `/api/c/:slug/feedback/*` |
| Upload | Feedback media validated via upload helpers |
| Input security | `sanitizePlainText` / `sanitizeRichHtml` on write; post-body sanitize middleware rejects XSS probes on public writes |
| Rate limit | `feedbackRateLimiter`: IP + device (no IP in fingerprint) + guestKey caps (~20/IP/h, ~10/guestKey/h) |
| Public list | `GET /public` capped (default 40); footer fetch skipped when cards disabled |
| Admin list | Dashboard always sends `page`/`limit` (default 20) |
| Logging | `ipHash` stored on create (HMAC), not raw IP |

---

## Test Scenarios

| # | Scenario | Input/Action | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Happy path | valid UI/API request | handler returns success response shown by source |
| 2 | Validation error | missing/invalid observed fields | safe 400/validation-style error if handler validates |
| 3 | Unauthorized | no/invalid session on protected route | 401 or 403 based on handler/middleware |
| 4 | Not found | invalid id/slug | 404 or safe message based on handler |
| 5 | Tenant boundary | wrong community slug/context | no cross-tenant data access |
| 6 | XSS probe submit | body/extraFields with `alert(` / event handlers | 400 `XSS_REJECTED` / pola tidak diizinkan |
| 7 | Guest-key flood | same `x-guest-key`, rotating IP | 429 after guestKey window cap |
| 8 | Regression | `npm run check` | TypeScript passes |

---

## Source References

- Feature doc: `08-collaboration-feedback/02-feedback-public-ratings.md`
- UI: `client/src/components/public/footer.tsx`
- Endpoint sources: `server/routes/feedback.ts`, `server/utils/input-sanitize.ts`, `server/middleware/public-rate-limit.ts`
- Endpoint inventory: `docs/api/endpoints.md`
- Feature summary: `docs/features/feature-summary.md`

---

## Unknown / To Verify

- Exact full response body per endpoint should be confirmed in the listed handler before publishing external API docs.
- Some handlers build response objects through storage/service return values; inspect service/model before changing contracts.
- Client-side payload may include transformed fields not visible from backend static scan.


