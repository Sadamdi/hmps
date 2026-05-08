# SOP 02 — Code Standards HMPS

## TypeScript General

- Gunakan type eksplisit untuk payload, response, dan props.
- Hindari `any`; jika tidak bisa dihindari, batasi scope dan beri alasan.
- Gunakan `camelCase` untuk variable/function dan `PascalCase` untuk type/component/class.
- Jangan import server-only module ke frontend/shared.

## Frontend

- Routing ada di `client/src/App.tsx` memakai Wouter.
- Page-level component berada di `client/src/pages/`.
- Reusable component berada di `client/src/components/`.
- Server state pakai TanStack React Query.
- API call yang kompleks harus lewat helper/hook, bukan tersebar di UI component.
- Setiap async UI wajib punya loading, error, empty, success state.
- Dashboard route harus protected dan tetap mengandalkan backend permission.

## Backend

- `server/routes.ts` masih menjadi orchestration utama; route modular baru boleh masuk `server/routes/` bila fitur cukup besar.
- Route handler harus: validate → authorize → execute → respond.
- Business logic reusable masuk `server/services/`, `server/*storage*`, atau helper domain terkait.
- Jangan return raw error/stack trace.
- Jangan simpan secret di `shared/` atau frontend.

## MongoDB / Storage

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
