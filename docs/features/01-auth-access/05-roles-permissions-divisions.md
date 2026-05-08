# Roles Permissions Divisions

**Status**: Active | **Contract Confidence**: Verified from route scan  | **Category**: auth access

---

## Deskripsi

Fitur **Roles Permissions Divisions** terdokumentasi ulang dari audit code HMPS New, bukan dari payload template. Endpoint, parameter, body field, dan status response di bawah berasal dari static scan terhadap route handler di `server/routes.ts` dan `server/routes/*.ts` dan hanya membaca file HMPS New.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai fitur **Roles Permissions Divisions** melalui UI terkait agar kebutuhan operasional atau informasi terpenuhi.
2. Sebagai maintainer, saya ingin mengetahui endpoint dan source file aktual agar perubahan tidak salah kontrak.
3. Sebagai reviewer, saya ingin melihat field request/response yang terdeteksi dari code agar tidak mengandalkan contoh generik.

---

## UI / User Flow

| Item | Value |
|------|-------|
| UI routes/surfaces | `/dashboard/roles` |
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
| GET | `/api/roles` | `server/routes.ts#L7336` | none observed in handler window | 500, 200/json |
| GET | `/api/roles/levels` | `server/routes.ts#L7352` | none observed in handler window | 500, 200/json |
| GET | `/api/roles/assignable` | `server/routes.ts#L7372` | none observed in handler window | 500, 200/json |
| POST | `/api/roles` | `server/routes.ts#L7409` | body: name, displayName, description, level, permissions | 201, 500 |
| POST | `/api/roles/create-with-shift` | `server/routes.ts#L7455` | body: name, displayName, description, level, permissions | 403, 201, 500 |
| PUT | `/api/roles/:id` | `server/routes.ts#L7517` | params: id; body: displayName, description, permissions, level | 404, 500, 200/json |
| DELETE | `/api/roles/:id` | `server/routes.ts#L7561` | params: id | 404, 500, 200/json |
| GET | `/api/permissions` | `server/routes.ts#L7583` | none observed in handler window | 500, 200/json |
| POST | `/api/permissions` | `server/routes.ts#L7598` | body: name, displayName, description, category | 201, 500 |
| GET | `/api/divisions` | `server/routes.ts#L7630` | query: period | 500, 200/json |
| GET | `/api/divisions/available-positions` | `server/routes.ts#L7650` | query: period | 400, 500, 200/json |
| POST | `/api/divisions/copy` | `server/routes.ts#L7696` | body: sourcePeriod, targetPeriod | 500, 200/json |
| POST | `/api/divisions` | `server/routes.ts#L7717` | body: name, displayName, description, positions, color, logo, period: bodyPeriod, | 400, 201, 500 |
| PUT | `/api/divisions/:id` | `server/routes.ts#L7793` | params: id; body: displayName, description, positions, color, logo | 404, 400, 500, 200/json |
| PUT | `/api/divisions/order` | `server/routes.ts#L7840` | body: period, orders | 400, 500, 200/json |
| DELETE | `/api/divisions/:id` | `server/routes.ts#L7875` | params: id | 404, 500, 200/json |

---

## Observed Request Shape

- `POST /api/roles` body fields observed: `name`
- `POST /api/roles/create-with-shift` body fields observed: `name`
- `PUT /api/roles/:id` body fields observed: `displayName`
- `POST /api/permissions` body fields observed: `name`
- `POST /api/divisions/copy` body fields observed: `sourcePeriod`
- `POST /api/divisions` body fields observed: `name`
- `PUT /api/divisions/:id` body fields observed: `displayName`
- `PUT /api/divisions/order` body fields observed: `period, orders`

> [!IMPORTANT]
> Field di atas adalah hasil static scan sekitar route handler. Untuk perubahan implementasi, buka source file dan line yang tercantum untuk memastikan validasi lengkap, default value, dan transformasi data.

---

## Observed Response Shape

Static scan menemukan pola response berikut:

- Status JSON yang terdeteksi: `200/json, 201, 400, 403, 404, 500`
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
| Auth | Verify handler/middleware in source lines listed above |
| Permission | Verify permission key/check in handler before changing behavior |
| Tenant | Use `/api/c/:slug/*` resolver/storage when feature is tenant-aware |
| Upload | Validate MIME/size/path and cleanup temporary files |
| Logging | Log user/resource/tenant/action without secrets |

---

## Test Scenarios

| # | Scenario | Input/Action | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Happy path | valid UI/API request | handler returns success response shown by source |
| 2 | Validation error | missing/invalid observed fields | safe 400/validation-style error if handler validates |
| 3 | Unauthorized | no/invalid session on protected route | 401 or 403 based on handler/middleware |
| 4 | Not found | invalid id/slug | 404 or safe message based on handler |
| 5 | Tenant boundary | wrong community slug/context | no cross-tenant data access |
| 6 | Regression | `npm run check` | TypeScript passes |

---

## Source References

- Feature doc: `01-auth-access/05-roles-permissions-divisions.md`
- UI: `/dashboard/roles`
- Endpoint sources: `server/routes.ts`
- Endpoint inventory: `docs/api/endpoints.md`
- Feature summary: `docs/features/feature-summary.md`

---

## Unknown / To Verify

- Exact full response body per endpoint should be confirmed in the listed handler before publishing external API docs.
- Some handlers build response objects through storage/service return values; inspect service/model before changing contracts.
- Client-side payload may include transformed fields not visible from backend static scan.


