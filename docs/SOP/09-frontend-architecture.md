# SOP 09 — Frontend Architecture HMPS

## Scope

SOP ini berlaku untuk semua perubahan di `client/src/**`: pages, components, hooks, lib, utils, constants, dan route composition.

## Folder Rules

| Area | Location | Rule |
|------|----------|------|
| Routes/pages | `client/src/pages/**` | Page-level orchestration; jangan taruh business logic besar |
| Reusable UI | `client/src/components/**` | Reusable component, typed props, accessible state |
| Dashboard shell | `client/src/components/dashboard/**` | Dashboard-specific layout/editor/moderation components |
| Public UI | `client/src/components/public/**` | Public widgets: AI chat, comments, notification, store cards |
| Hooks | `client/src/hooks/**` | Reusable state/effect logic; prefix `use` |
| API/client helpers | `client/src/lib/**` | Query client, tenant rewrite, auth/guest/activity helpers |
| Constants/utils | `client/src/constants/**`, `client/src/utils/**` | Pure helpers/constants only |

## React Query Rules

1. Server state should use TanStack React Query.
2. Query keys must include tenant/store/resource context when relevant.
3. Mutations must invalidate/update affected queries explicitly.
4. Avoid duplicated fetch logic inside presentational components.

## Route & Auth Rules

1. `client/src/App.tsx` is the route composition source (termasuk catch-all community `/:slug/*` — urutan route penting).
2. Dashboard pages must be protected in UI and still rely on backend permission.
3. Tenant pages must use tenant context and API rewrite safely (`client/src/lib` tenant helpers).
4. UI permission hiding is UX only; backend remains source of truth.
5. Storefront path publik bisa dinamis dari settings (jangan hardcode hanya `/toko` tanpa cek config).
6. Home social feed (YT/IG) adalah public widget — tangani loading/empty/soft-fail.
7. Page orphan (mis. folder tanpa route aktif) jangan diasumsikan live; verifikasi di `App.tsx`.

## UI State Requirements

Every async page/widget should handle:

- loading state,
- error state,
- empty state,
- success state,
- permission denied or unauthenticated state when applicable.

## Media & Rich Content

1. Use existing upload/editor components before adding new ones.
2. Image/file previews must not trust raw URL blindly.
3. Rich content display must use existing formatting/sanitization utilities.
4. Store/public images should use default/fallback image constants.

## Documentation Required

Update relevant feature docs when changing:

- routes/pages,
- public widgets (termasuk social feed / AI chat / comments / notifications),
- dashboard components,
- tenant behavior,
- auth/permission UI,
- upload/rich content behavior,
- lalu bump `docs/version/` setelah unit kerja selesai.
