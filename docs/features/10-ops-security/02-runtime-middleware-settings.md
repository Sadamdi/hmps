# Runtime Middleware Settings

**Status**: Active | **Contract Confidence**: Verified from route scan  | **Category**: ops security

---

## Deskripsi

Fitur **Runtime Middleware Settings** terdokumentasi ulang dari audit code HMPS New, bukan dari payload template. Endpoint, parameter, body field, dan status response di bawah berasal dari static scan terhadap route handler di `server/routes.ts` dan `server/routes/*.ts` dan hanya membaca file HMPS New.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai fitur **Runtime Middleware Settings** melalui UI terkait agar kebutuhan operasional atau informasi terpenuhi.
2. Sebagai maintainer, saya ingin mengetahui endpoint dan source file aktual agar perubahan tidak salah kontrak.
3. Sebagai reviewer, saya ingin melihat field request/response yang terdeteksi dari code agar tidak mengandalkan contoh generik.

---

## UI / User Flow

| Item | Value |
|------|-------|
| UI routes/surfaces | `/dashboard/settings` |
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
| GET | `/api/settings/middleware` | `server/routes.ts` | none (owner + `middleware.manage`) | 403 if non-owner, 500, 200/json |
| PUT | `/api/settings/middleware` | `server/routes.ts` | body: settings flags (server sets `updatedBy` from session) | 403 if non-owner, 500, 200/json |

---

## Observed Request Shape

- `PUT /api/settings/middleware` body flags: `allEnabled`, `apiProtectionEnabled`, `apiRateLimitEnabled`, `ddosProtectionEnabled`, `sqlInjectionProtectionEnabled`, `noSqlInjectionProtectionEnabled`, `antiSpoofingProtectionEnabled`, `dnsLayerProtectionEnabled`, `portScanningProtectionEnabled`
- `updatedBy` from client is ignored; server uses authenticated user id

> [!IMPORTANT]
> Field di atas adalah hasil static scan sekitar route handler. Untuk perubahan implementasi, buka source file dan line yang tercantum untuk memastikan validasi lengkap, default value, dan transformasi data.

---

## Observed Response Shape

Static scan menemukan pola response berikut:

- Status JSON yang terdeteksi: `200/json, 500`
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
| Auth | `mainOnly` + authenticate |
| Permission | Hard-require `role === 'owner'` (API + UI); also `middleware.manage` |
| Tenant | Middleware settings are main-site only |
| Master toggle | `allEnabled === false` disables protected modules that check it |
| Cache | Updating settings clears API protection cache + public rate-limit settings cache |

---

## Test Scenarios

| # | Scenario | Input/Action | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Owner GET/PUT | owner session | 200 with settings |
| 2 | Non-owner | admin/member with or without `middleware.manage` | 403 |
| 3 | Tenant path | `/api/c/:slug/settings/middleware` | not available (`mainOnly`) |
| 4 | Regression | `npm run check` | TypeScript passes |

---

## Source References

- Feature doc: `10-ops-security/02-runtime-middleware-settings.md`
- UI: `/dashboard/settings` (Middleware tab, owner-only)
- Endpoint sources: `server/routes.ts`, `server/models/middleware-settings.ts`
- Endpoint inventory: `docs/api/endpoints.md`
- Feature summary: `docs/features/feature-summary.md`

---

## Unknown / To Verify

- Exact full response body per endpoint should be confirmed in the listed handler before publishing external API docs.
- Some handlers build response objects through storage/service return values; inspect service/model before changing contracts.
- Client-side payload may include transformed fields not visible from backend static scan.


