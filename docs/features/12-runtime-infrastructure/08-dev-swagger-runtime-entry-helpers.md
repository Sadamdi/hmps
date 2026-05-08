# Dev Server, Swagger & Runtime Entry Helpers

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: runtime infrastructure

---

## Deskripsi

Runtime helper untuk entry server, Vite integration, Swagger/OpenAPI serving, upload pipeline, Google Drive, image processor, tenant storage, dan default image constant server-side.

---

## Observed Sources

| Module | Source | Role |
|--------|--------|------|
| Server entry | `server/index.ts` | Express bootstrap, static serving, scheduler/runtime hooks |
| Vite integration | `server/vite.ts` | Dev server and frontend integration |
| Swagger helper | `server/swagger.ts` | OpenAPI/static API docs integration |
| Upload pipeline | `server/upload.ts` | Upload path, validation, file handling helpers |
| Google Drive | `server/googleDrive.ts` | Google Drive media integration |
| Image processor | `server/image-processor.ts` | Image transform/compression pipeline |
| Tenant storage | `server/tenant-storage.ts` | Tenant data access surface |
| Server default image | `server/constants/default-image.ts` | Server-side default/fallback image constant |

---

## Sensitive File Note

A filesystem audit detected Google service-account JSON style files under `server/`. Do not document their contents, do not expose them in examples, and do not commit new credentials. If they are real credentials, move them to secure environment/secret storage and rotate them.

---

## Business Rules

1. Runtime entry changes must preserve port/listen behavior and scheduler startup.
2. Swagger/OpenAPI docs must match current endpoints.
3. Upload/image/Drive helpers must validate path, MIME, size, and cleanup failed files.
4. Tenant storage must never bypass tenant resolver or leak main/other tenant data.

---

## Related Feature Docs

- `07-media-assets/01-general-upload.md`
- `07-media-assets/05-google-drive.md`
- `10-ops-security/05-api-docs-swagger.md`
- `10-ops-security/06-deployment-scheduler.md`
- `05-community-tenant/05-tenant-api-storage.md`
