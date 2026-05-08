# Swagger / OpenAPI Guide

HMPS menyimpan dokumentasi API statis di folder `docs/`.

## Files

| File | Fungsi |
|------|--------|
| `docs/openapi.json` | Spesifikasi OpenAPI utama |
| `docs/api-docs.html` | HTML viewer sederhana |
| `docs/swagger-ui/` | Asset Swagger UI |
| `scripts/generate-api-docs-html.mjs` | Generator HTML docs |

## Generate HTML

```bash
npm run docs:api-html
```

## Kapan Update

Update OpenAPI/HTML ketika:

- endpoint baru ditambahkan,
- request/response berubah,
- permission/auth behavior berubah,
- endpoint deprecated/dihapus.

## Checklist

- [ ] Endpoint ada di `docs/api/endpoints.md`.
- [ ] OpenAPI path/schema sesuai implementasi.
- [ ] Auth/cookie/permission dicatat.
- [ ] Contoh response tidak memuat data sensitif.
