# Frontend Auth Guards & Session UI

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: auxiliary runtime

---

## Deskripsi

Dokumentasi support layer frontend untuk login form, protected route, profile editor, permission refresh, dan tenant auth/context.

---

## User Stories

1. Sebagai maintainer HMPS, saya ingin tahu utility/component/hook pendukung yang mempengaruhi flow fitur.
2. Sebagai developer, saya ingin menaruh perubahan frontend di layer yang tepat dan tidak menduplikasi logic.
3. Sebagai reviewer, saya ingin coverage docs mencakup bukan hanya API route tetapi juga frontend support layer.

---

## Observed Sources

| Area | Source | Role |
|------|--------|------|
| Auth form | `client/src/components/auth/login-form.tsx` | Login UI and auth submit flow |
| Protected route | `client/src/components/auth/protected-route.tsx` | Client-side route guard UX |
| Profile editor | `client/src/components/dashboard/user-profile-editor.tsx` | Profile editing UI |
| Permission guard | `client/src/hooks/use-permission-guard.ts` | Permission UX helper |
| Permission refresh | `client/src/hooks/use-permission-refresh.ts` | Refresh current permissions after role/permission changes |
| Tenant auth | `client/src/lib/tenant-auth.tsx` | Tenant authentication helper/context |
| Tenant context | `client/src/lib/tenant-context.tsx` | Tenant slug/context helper |
| Tenant API rewrite | `client/src/lib/tenant-api-rewrite.ts` | Rewrite API calls into `/api/c/:slug/*` when tenant context applies |

---

## Request / Response Contract

Tidak ada kontrak HTTP langsung. File di dokumen ini adalah frontend/shared support layer yang dipakai oleh page, component, atau API helper.

---

## Business Rules

1. Jangan memindahkan logic API besar ke presentational component.
2. Shared/client utility tidak boleh mengandung secret server-side.
3. Auth/tenant helper harus tetap mengandalkan validasi backend.
4. Hook async harus menyediakan loading/error/success state melalui caller.
5. Update feature doc kategori terkait jika utility ini mengubah behavior user-facing.

---

## Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Import path berubah | Semua caller ikut update dan `npm run check` pass |
| 2 | Auth/tenant helper berubah | Main dan tenant flow tetap tidak bocor data |
| 3 | UI support behavior berubah | Page terkait tetap responsive dan aman |

---

## Unknown / To Verify

- Exact caller graph sebaiknya dicek dengan code-review graph sebelum refactor besar.
