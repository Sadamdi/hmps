# Public UI Components

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: auxiliary runtime

---

## Deskripsi

Dokumentasi komponen publik lintas fitur: AI chat widget, comments, notification prompt, dan store public components.

---

## User Stories

1. Sebagai maintainer HMPS, saya ingin tahu utility/component/hook pendukung yang mempengaruhi flow fitur.
2. Sebagai developer, saya ingin menaruh perubahan frontend di layer yang tepat dan tidak menduplikasi logic.
3. Sebagai reviewer, saya ingin coverage docs mencakup bukan hanya API route tetapi juga frontend support layer.

---

## Observed Sources

| Area | Source | Role |
|------|--------|------|
| AI chat | `client/src/components/public/ai-chat.tsx` | Public AI chat widget/surface |
| Comment thread | `client/src/components/public/comment-thread.tsx` | Threaded comments UI |
| Notification prompt | `client/src/components/public/notification-prompt.tsx` | Web push/SSE preference prompt |
| Store product card | `client/src/components/public/store-product-card.tsx` | Public product tile/card |
| Store public header | `client/src/components/public/store-public-header.tsx` | Storefront header/nav |
| Store order status | `client/src/components/public/store-order-status.tsx` | Public order status display |

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
