# SOP 01 — Development Workflow HMPS

## Prinsip Kerja

HMPS adalah monolith full-stack TypeScript dengan banyak fitur runtime: public site, dashboard, tenant community, store module, upload/media, chat AI, notification stream, social feed, Prodi student hub, system error monitoring, backup/restore, banner-render sidecar, dan scheduler. Setiap perubahan harus memperhatikan dampak lintas modul.

## Wajib Sebelum Coding

1. Baca `AGENTS.md`.
2. Jika tersedia, gunakan `code-review-graph` MCP sebelum scan file manual (fallback Grep/Read jika MCP tidak loaded).
3. Cek:
   - `docs/features/feature-summary.md`
   - `docs/api/endpoints.md`
   - `docs/version/versions.md` (versi Current)
   - architecture docs yang relevan
   - SOP yang relevan
4. Identifikasi apakah perubahan menyentuh:
   - auth/permission,
   - tenant/community,
   - upload/media,
   - store/toko,
   - backup/restore,
   - chat/AI enhance/notifications,
   - social-feed,
   - Prodi student hub / sync,
   - system-errors monitoring,
   - banner-render service.

## Workflow Fitur

1. **Discovery**: pahami route, page, storage, permission, tenant path.
2. **Design**: tentukan API contract, UI state, data shape, docs + version bump yang harus berubah.
3. **Backend**: validasi input, auth/permission, service/storage, safe error.
4. **Frontend**: page/component/hook/API helper, loading/error/empty/success state.
5. **Docs**: update feature docs, endpoints, OpenAPI jika perlu.
6. **Version**: setelah unit kerja selesai, bump SemVer + isi `docs/version/release/` + changelog (SOP 11).
7. **Verification**: `npm run check`, manual smoke test, review tenant/media/security.

## Definition of Done

- TypeScript check lolos (`npm run check`).
- Tidak ada secret/runtime artifact ter-commit.
- Endpoint baru terdokumentasi (endpoints + OpenAPI bila publik/stabil).
- Permission dan tenant behavior eksplisit.
- Upload cleanup dan validation aman jika ada media.
- Versi di-bump dan release note di `docs/version/` terisi.
- `package.json` + `docs/openapi.json` `info.version` selaras dengan Current.
