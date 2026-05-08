# Dashboard Shell & Editor Components

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: auxiliary runtime

---

## Deskripsi

Dokumentasi komponen dashboard lintas fitur: layout, header/sidebar, editor, uploader, role management, sharing, comment, feedback preview, dan delete dialogs.

---

## User Stories

1. Sebagai maintainer HMPS, saya ingin tahu utility/component/hook pendukung yang mempengaruhi flow fitur.
2. Sebagai developer, saya ingin menaruh perubahan frontend di layer yang tepat dan tidak menduplikasi logic.
3. Sebagai reviewer, saya ingin coverage docs mencakup bukan hanya API route tetapi juga frontend support layer.

---

## Observed Sources

| Area | Source | Role |
|------|--------|------|
| Dashboard layout | `client/src/components/dashboard/dashboard-layout.tsx` | Protected dashboard shell |
| Dashboard header | `client/src/components/dashboard/header.tsx` | Top bar, user/notification surface |
| Dashboard sidebar | `client/src/components/dashboard/sidebar.tsx` | Dashboard navigation |
| UI sidebar | `client/src/components/ui/sidebar.tsx` | Reusable sidebar primitive |
| Berita editor | `client/src/components/dashboard/berita-editor.tsx` | Berita form/editor surface |
| Content editor | `client/src/components/dashboard/content-editor.tsx` | Shared rich content editor wrapper |
| Rich text editor | `client/src/components/dashboard/rich-text-editor.tsx` | TinyMCE/editor abstraction |
| Media uploader | `client/src/components/dashboard/media-uploader.tsx` | Dashboard upload component |
| Image upload | `client/src/components/ui/image-upload.tsx` | Reusable image upload UI |
| Organization editor | `client/src/components/dashboard/organization-editor.tsx` | Organization member/period editing UI |
| Org structure editor | `client/src/components/dashboard/organization-structure-editor.tsx` | Organization structure editing UI |
| Role management | `client/src/components/dashboard/role-management.tsx` | Role/permission UI |
| Sharing panel | `client/src/components/dashboard/sharing-panel.tsx` | Content sharing UI |
| Comment panel | `client/src/components/dashboard/comment-panel.tsx` | Comment moderation UI |
| Feedback preview | `client/src/components/dashboard/feedback-form-preview.tsx` | Feedback form preview |
| Bug report dialog | `client/src/components/dashboard/bug-report-dialog.tsx` | Bug report management dialog |
| Banner editor | `client/src/components/dashboard/banner-editor.tsx` | Home/banner visual editor surface |
| Delete confirm | `client/src/components/dashboard/confirm-delete-alert-dialog.tsx` | Safe delete confirmation |
| Tenant delete | `client/src/components/dashboard/tenant-owner-delete-account-section.tsx` | Tenant owner delete OTP UI |
| Hint card | `client/src/components/dashboard/dashboard-hint-card.tsx` | Dashboard helper/hint content |

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

