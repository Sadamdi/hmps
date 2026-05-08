# Web Push Service Worker & Type Declarations

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: runtime infrastructure

---

## Deskripsi

Runtime support untuk web push notification dan TypeScript declaration file yang menjaga integrasi dependency tanpa melemahkan typecheck.

---

## Observed Sources

| Module | Source | Role |
|--------|--------|------|
| Push service worker | `public/sw-push.js` | Service worker penerima web push notification di browser |
| Web push declaration | `server/types/web-push.d.ts` | Type declaration untuk dependency web-push |
| ClamScan declaration | `server/types/clamscan.d.ts` | Type declaration untuk scanning dependency |

---

## Business Rules

1. Service worker tidak boleh menyimpan secret atau token sensitif.
2. Push payload harus tetap minim dan aman jika tampil di notification tray.
3. Type declaration harus hanya menutup gap typing, bukan menyembunyikan unsafe runtime behavior.
4. Jika notification payload berubah, update fitur `09-ai-notifications/04-preferences-webpush.md`.

---

## Related Feature Docs

- `09-ai-notifications/04-preferences-webpush.md`
- `09-ai-notifications/07-notification-orchestrator-service.md`
