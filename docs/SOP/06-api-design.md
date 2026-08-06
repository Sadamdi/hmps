# SOP 06 — API Design HMPS

## Prefix

| Scope | Prefix |
|-------|--------|
| Main API | `/api/*` |
| Tenant API | `/api/c/:slug/*` (rewrite via tenant resolver) |
| Store API | `/api/store/*` |
| AI enhance | `/api/ai/*` |
| Social feed | `/api/social-feed/*` |
| System errors | `/api/system-errors/*` |
| Comments | `/api/comments/*` |
| Public assets | `/uploads`, `/attached_assets` |

## Route Requirements

- Validate params/query/body sebelum DB call.
- Protected endpoint wajib auth dan permission middleware/helper.
- Tenant-aware endpoint wajib resolve slug server-side.
- Upload endpoint wajib validate file.
- New endpoint wajib update `docs/api/endpoints.md` dan (jika publik/stabil) `docs/openapi.json`.
- Setelah unit kerja selesai, bump versi di `docs/version/`.

## Response Convention

### De-facto (mayoritas endpoint existing)

Banyak handler mengembalikan bentuk sederhana:

```json
{ "message": "..." }
```

atau payload domain langsung (object/array) dengan status HTTP sebagai sinyal utama.

### Target untuk endpoint baru

Endpoint **baru** sebaiknya memakai envelope:

```json
{
  "success": true,
  "message": "OK",
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": { "code": "VALIDATION_ERROR", "details": [] }
}
```

Jangan ubah massal response endpoint lama tanpa migration plan. Dokumentasikan observed contract apa adanya di feature docs.

## Pagination & Query

- Pola umum list: `page`, `limit` (sering di-cap, mis. 100).
- Search/`q` harus aman (regex escape/limit) jika dipakai.
- `sortBy` / `sortOrder` **bukan** standar global API; beberapa resource memakai field sort di dokumen DB atau query khusus — cek handler aktual.

## Special Cases

- Store cart/order endpoint harus konsisten dengan pricing utilities (`shared/store-*`).
- Feedback/comment guest endpoint harus cek `x-guest-key` bila ownership diperlukan.
- Notification SSE harus menjaga connection lifecycle dan tenant scope.
- Chat / AI keys (Gemini, OpenAI-compatible) tetap server-side.
- System-errors: `POST /report` publik + rate limit; admin/owner endpoints terproteksi.
- Social-feed scrape harus soft-fail dan cache-aware agar public page tidak 500.
