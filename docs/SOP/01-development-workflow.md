# SOP 01 — Development Workflow HMPS

## Prinsip Kerja

HMPS adalah monolith full-stack TypeScript dengan banyak fitur runtime: public site, dashboard, tenant community, store module, upload/media, chat AI, notification stream, backup/restore, dan scheduler. Setiap perubahan harus memperhatikan dampak lintas modul.

## Wajib Sebelum Coding

1. Baca `AGENTS.md`.
2. Jika tersedia, gunakan `code-review-graph` MCP sebelum scan file manual.
3. Cek:
   - `docs/features/feature-summary.md`
   - `docs/api/endpoints.md`
   - architecture docs yang relevan
   - SOP yang relevan
4. Identifikasi apakah perubahan menyentuh:
   - auth/permission,
   - tenant/community,
   - upload/media,
   - store/toko,
   - backup/restore,
   - chat/notifications.

## Workflow Fitur

1. **Discovery**: pahami route, page, storage, permission, tenant path.
2. **Design**: tentukan API contract, UI state, data shape, docs yang harus berubah.
3. **Backend**: validasi input, auth/permission, service/storage, safe error.
4. **Frontend**: page/component/hook/API helper, loading/error/empty/success state.
5. **Docs**: update feature docs, endpoints, OpenAPI jika perlu.
6. **Verification**: `npm run check`, manual smoke test, review tenant/media/security.

## Definition of Done

- TypeScript check lolos.
- Tidak ada secret/runtime artifact ter-commit.
- Endpoint baru terdokumentasi.
- Permission dan tenant behavior eksplisit.
- Upload cleanup dan validation aman jika ada media.
