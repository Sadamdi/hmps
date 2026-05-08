# SOP 06 — API Design HMPS

## Prefix

| Scope | Prefix |
|-------|--------|
| Main API | `/api/*` |
| Tenant API | `/api/c/:slug/*` |
| Store API | `/api/store/*` |
| Public assets | `/uploads`, `/attached_assets` |

## Route Requirements

- Validate params/query/body sebelum DB call.
- Protected endpoint wajib auth dan permission middleware/helper.
- Tenant-aware endpoint wajib resolve slug server-side.
- Upload endpoint wajib validate file.
- New endpoint wajib update `docs/api/endpoints.md`.

## Response Convention

Endpoint baru sebaiknya memakai:

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

Jangan ubah massal response endpoint lama tanpa migration plan.

## Pagination & Query

- `page`, `limit`, `q`, `sortBy`, `sortOrder`.
- Batas maksimum limit harus ada untuk list besar.
- Search regex harus aman dan diberi limit.

## Special Cases

- Store cart/order endpoint harus konsisten dengan pricing utilities.
- Feedback/comment guest endpoint harus cek `x-guest-key` bila ownership diperlukan.
- Notification SSE harus menjaga connection lifecycle dan tenant scope.
- Chat endpoint harus menjaga secret Gemini tetap server-side.
