# Berita Cms

**Status**: Active | **Contract Confidence**: Verified from route scan  | **Category**: public content

---

## Deskripsi

Fitur **Berita Cms** terdokumentasi ulang dari audit code HMPS New, bukan dari payload template. Endpoint, parameter, body field, dan status response di bawah berasal dari static scan terhadap route handler di `server/routes.ts` dan `server/routes/*.ts` dan hanya membaca file HMPS New.

### Editor notes (4.14+)

- **Existing tags** di `BeritaEditor`: default tertutup; saat dibuka ada pencarian, max 20 chip, scroll.
- **Konten HTML** gaya Medinfo (meta 2–3 baris + pembuka ENCODER + `h3` + gambar di antara section) dipakai AI enhance/Spyro; lihat `09-content-enhance-ai.md`.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai fitur **Berita Cms** melalui UI terkait agar kebutuhan operasional atau informasi terpenuhi.
2. Sebagai maintainer, saya ingin mengetahui endpoint dan source file aktual agar perubahan tidak salah kontrak.
3. Sebagai reviewer, saya ingin melihat field request/response yang terdeteksi dari code agar tidak mengandalkan contoh generik.

---

## UI / User Flow

| Item | Value |
|------|-------|
| UI routes/surfaces | `/berita, /dashboard/berita` |
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
| GET | `/api/berita` | `server/routes.ts#L2480` | none observed in handler window | 500 |
| GET | `/api/berita/:id/events` | `server/routes.ts#L2531` | params: id | 500, 200/json |
| GET | `/api/berita/slug/:slug/events` | `server/routes.ts#L2546` | params: slug | 404, 500, 200/json |
| GET | `/api/berita/:id/related` | `server/routes.ts#L2569` | params: id; query: limit | 404, 500, 200/json |
| GET | `/api/berita/manage` | `server/routes.ts#L2607` | none observed in handler window | 500, 200/json |
| GET | `/api/berita/:id([a-fA-F0-9]{24})/:slug` | `server/routes.ts#L2714` | params: id, slug | 404, 403, 500, 200/json |
| GET | `/api/berita/slug/:slug` | `server/routes.ts#L2768` | params: slug | 404, 403, 500, 200/json |
| GET | `/api/berita/:id` | `server/routes.ts#L2814` | params: id | 404, 403, 500, 200/json |
| GET | `/api/berita/:id/related` | `server/routes.ts#L2863` | params: id; query: limit | 404, 500, 200/json |
| GET | `/api/berita/slug/:slug/related` | `server/routes.ts#L2904` | params: slug; query: limit | 404, 500, 200/json |
| POST | `/api/berita` | `server/routes.ts#L2939` | body: title, excerpt, content, published, gdriveUrl, tags, relatedGalleryIds | 400, 403, 401 |
| PUT | `/api/berita/:id` | `server/routes.ts#L3314` | params: id; body: title, excerpt, content, published, tags, relatedGalleryIds, attachments | 400, 404, 403, 500, 200/json |
| DELETE | `/api/berita/:id` | `server/routes.ts#L3593` | params: id | 400, 404, 403, 500, 200/json |
| POST | `/api/berita/:id/copy-to-event` | `server/routes.ts#L9145` | params: id; body: year, parentEventId, copyAttachments | 201 |
| POST | `/api/berita/:id/attach-event` | `server/routes.ts#L9245` | params: id: beritaId; body: eventId, copyFiles | 400, 404, 403, 200/json |
| DELETE | `/api/berita/:id/attach-event/:eventId` | `server/routes.ts#L9281` | params: id: beritaId, eventId | 404, 403, 200/json |

---

## Observed Request Shape

- `POST /api/berita` body fields observed: `title, excerpt, content, published, gdriveUrl`
- `PUT /api/berita/:id` body fields observed: `title, tags, relatedGalleryIds, attachments`
- `POST /api/berita/:id/copy-to-event` body fields observed: `year`
- `POST /api/berita/:id/attach-event` body fields observed: `eventId`

> [!IMPORTANT]
> Field di atas adalah hasil static scan sekitar route handler. Untuk perubahan implementasi, buka source file dan line yang tercantum untuk memastikan validasi lengkap, default value, dan transformasi data.

---

## Observed Response Shape

Static scan menemukan pola response berikut:

- Status JSON yang terdeteksi: `200/json, 201, 400, 401, 403, 404, 500`
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

- Feature doc: `02-public-content/02-berita-cms.md`
- UI: `/berita, /dashboard/berita`
- Endpoint sources: `server/routes.ts`
- Endpoint inventory: `docs/api/endpoints.md`
- Feature summary: `docs/features/feature-summary.md`

---

## Unknown / To Verify

- Exact full response body per endpoint should be confirmed in the listed handler before publishing external API docs.
- Some handlers build response objects through storage/service return values; inspect service/model before changing contracts.
- Client-side payload may include transformed fields not visible from backend static scan.


