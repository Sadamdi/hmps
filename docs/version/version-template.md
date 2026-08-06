# Release vX.Y.Z — [Judul singkat unit kerja]

> Salin file ini ke `docs/version/release/X.Y.Z.md` setiap selesai mengerjakan sesuatu, lalu isi semua section. Jangan biarkan placeholder.

| Field | Value |
|-------|-------|
| Version | `X.Y.Z` |
| Status | Current / Released |
| Released | YYYY-MM-DD |
| Bump type | MAJOR / MINOR / PATCH |
| Bump reason | Satu kalimat kenapa bump ini |
| Commit range | `aaaaaaa`..`bbbbbbb` (atau single hash) |
| Commit count | N |
| Primary authors | Nama / GitHub handle |
| Related PR / issue | opsional |

## Summary

1–3 kalimat: apa yang dikerjakan di unit kerja ini dan mengapa.

## Highlights

- Poin utama 1
- Poin utama 2
- Poin utama 3

## Added

- Fitur / endpoint / page / service baru

## Changed

- Perubahan behavior yang sudah ada

## Fixed

- Bug yang diperbaiki

## Security

- Hardening / auth / tenant / upload (isi `N/A` jika tidak ada)

## Docs

- File docs yang diupdate (feature, endpoints, OpenAPI, SOP, dll.)

## Feature areas touched

- [ ] Auth & Access
- [ ] Public Content & CMS
- [ ] Events & Library
- [ ] Organization & Prodi
- [ ] Community Tenant
- [ ] Store / Toko
- [ ] Media & Assets
- [ ] Collaboration / Feedback / Sharing
- [ ] AI Chat & Notifications
- [ ] Ops / Security / Monitoring
- [ ] Runtime / Docs / Tooling

## API / OpenAPI impact

| Method | Path | Change |
|--------|------|--------|
| — | — | none / added / changed / removed |

Jika ada perubahan kontrak publik: update `docs/api/endpoints.md` + `docs/openapi.json` + regenerate `docs/api-docs.html`.

## Verification

- [ ] `npm run check`
- [ ] Smoke manual area terkait
- [ ] `package.json` version = X.Y.Z
- [ ] `docs/openapi.json` `info.version` = X.Y.Z
- [ ] `docs/version/versions.md` Current diupdate
- [ ] Section baru di `docs/version/changelogs/CHANGELOG.md`

## Commit index

| Date | Hash | Author | Subject |
|------|------|--------|---------|
| YYYY-MM-DD | `hash` | author | subject |

## Notes / Known gaps

- ...

---

## Checklist bump (wajib)

1. Tentukan MAJOR / MINOR / PATCH sesuai SOP 11.
2. Buat file release dari template ini.
3. Update `versions.md` (Current).
4. Update `changelogs/CHANGELOG.md`.
5. Sync version di `package.json` + OpenAPI.
6. Update feature/API docs bila behavior berubah.
