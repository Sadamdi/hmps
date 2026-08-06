# SOP 02 — Code Standards HMPS

## TypeScript General

- Gunakan type eksplisit untuk payload, response, dan props.
- Hindari `any`; jika tidak bisa dihindari, batasi scope dan beri alasan.
- Gunakan `camelCase` untuk variable/function dan `PascalCase` untuk type/component/class.
- Jangan import server-only module ke frontend/shared.

## Frontend

- Routing ada di `client/src/App.tsx` memakai Wouter.
- Page-level component berada di `client/src/pages/`.
- Reusable component berada di `client/src/components/` (`dashboard/`, `public/`, `auth/`, dll.).
- Server state pakai TanStack React Query (sering di page/component; hooks tipis untuk guard/refresh).
- API call yang kompleks sebaiknya lewat helper di `client/src/lib/` atau hook reusable.
- Setiap async UI wajib punya loading, error, empty, success state.
- Dashboard route harus protected dan tetap mengandalkan backend permission.
- Tenant API rewrite lewat helper tenant yang sudah ada; store path publik bisa dinamis dari settings.

## Backend

- `server/routes.ts` masih menjadi orchestration utama.
- Route modular di `server/routes/`: `store`, `store-logic`, `chat`, `comments`, `feedback`, `sharing`, `notifications`, `social-feed`, `ai-enhance`, `system-errors`.
- Route handler harus: validate → authorize → execute → respond.
- Business logic reusable masuk `server/services/`, `server/*storage*`, atau helper domain terkait (`server/auth.ts`, `server/upload.ts`, `server/googleDrive.ts`, `server/image-processor.ts`, `server/security.ts`).
- Jangan return raw error/stack trace.
- Jangan simpan secret di `shared/` atau frontend.

## MongoDB / Storage

- Schema/model utama: `db/mongodb.ts` + tipe di `shared/schema.ts`.
- Model tambahan tipis di `server/models/` (mis. activity, chat, middleware-settings) — jangan asumsikan semua model ada di folder ini.
- Storage: `server/mongo-storage.ts`, `server/tenant-storage.ts`, dan helper storage terkait.
- Query tenant-aware wajib lewat tenant model/storage atau filter context yang valid.
- Jangan expose `password`, OTP, token, secret, credential, atau internal session fields.
- Tambahkan index untuk slug, owner, tenant, createdAt, dan lookup intensif.

## Store/Toko

- Store route mounted di `/api/store`.
- Public store endpoint harus safe untuk unauthenticated user.
- Admin store endpoint wajib permission.
- Pricing/discount/currency logic harus konsisten dengan `shared/store-*` utilities.

## Media

- Upload harus validate mimetype/size.
- Path public harus disanitasi.
- Cleanup file sementara saat gagal.
- Integrasi Drive/scanner mengikuti skill `media-upload` dan service terkait.
