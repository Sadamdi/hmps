# Client Hooks & Utilities

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: auxiliary runtime

---

## Deskripsi

Dokumentasi hook dan client utility yang belum memiliki feature doc tersendiri tetapi mempengaruhi UX, API, media, activity, tenant, dan display logic.

---

## User Stories

1. Sebagai maintainer HMPS, saya ingin tahu utility/component/hook pendukung yang mempengaruhi flow fitur.
2. Sebagai developer, saya ingin menaruh perubahan frontend di layer yang tepat dan tidak menduplikasi logic.
3. Sebagai reviewer, saya ingin coverage docs mencakup bukan hanya API route tetapi juga frontend support layer.

---

## Observed Sources

| Area | Source | Role |
|------|--------|------|
| App loading | `client/src/hooks/use-app-loading.ts` | Global/loading state helper |
| Error handler | `client/src/hooks/use-error-handler.ts` | Client error handling helper |
| Mobile detection | `client/src/hooks/use-mobile.tsx` | Responsive/mobile helper |
| Pagination | `client/src/hooks/use-pagination.ts` | Pagination state helper |
| Reveal animation | `client/src/hooks/use-reveal-animation.ts` | Animation/reveal hook |
| Toast | `client/src/hooks/use-toast.ts` | Toast state helper |
| Activity logger | `client/src/lib/activity-logger.ts` | Client activity logging helper |
| Query client | `client/src/lib/queryClient.ts` | TanStack Query API client setup |
| Guest identity | `client/src/lib/guest-identity.ts` | Guest ownership/identity helper |
| Library display | `client/src/lib/library-display.ts` | Library render/display helper |
| Store cart fly | `client/src/lib/store-cart-fly.ts` | Store cart micro-interaction helper |
| Crop image | `client/src/lib/cropImage.ts` | Client image crop utility |
| Banner layers | `client/src/lib/banner-template-layers.ts` | Banner template layer definitions |
| Photopea normalize | `client/src/lib/normalize-psd-for-photopea.ts` | PSD normalization helper |
| Org division helper | `client/src/lib/org-structure-division.ts` | Organization structure grouping helper |
| YouTube embed | `client/src/lib/youtube-embed.ts` | Safe YouTube embed helper |
| Shared utils | `shared/utils.ts` | Shared helper functions safe for frontend/backend |

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
