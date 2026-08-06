# Release vX.Y.Z — [Judul singkat unit kerja]

> Salin file ini ke `docs/version/release/X.Y.Z.md` setiap selesai mengerjakan sesuatu.  
> **WAJIB isi SEMUA section.** Jangan biarkan kosong / "TBD" / ringkas satu baris.  
> Kontrak API harus dari code/OpenAPI — jangan mengarang payload.

| Field | Value |
|-------|-------|
| Version | `X.Y.Z` |
| Status | Current / Released |
| Released | YYYY-MM-DD |
| Bump type | MAJOR / MINOR / PATCH |
| Bump reason | Satu–dua kalimat kenapa bump ini (bukan hanya judul) |
| Commit range | `aaaaaaa`..`bbbbbbb` (atau single hash) |
| Commit count | N |
| Diff stats | ~N files, +X / -Y (dari `git diff --shortstat`) |
| Primary authors | Nama / GitHub |
| Contributors | opsional |
| Related PR / issue | opsional |
| Related feature docs | `docs/features/...` |
| Breaking change? | Yes / No — jika Yes, jelaskan migrasi |

## Summary

Paragraf 2–5 kalimat: konteks masalah, apa yang dikerjakan, hasil untuk user/admin/ops, dan risiko utama.

## Highlights

- Poin utama 1 (user-facing atau platform)
- Poin utama 2
- Poin utama 3
- Poin utama 4 (opsional)
- Poin utama 5 (opsional)

## Features (detail)

Jelaskan setiap fitur/perubahan bermakna (bukan hanya bullet commit):

### Feature / Change A — [nama]
- **Masalah / tujuan:** …
- **Perilaku baru:** …
- **Siapa terdampak:** public / auth / admin / owner / tenant
- **Permission:** …
- **Tenant-aware:** Yes / No / Conditional
- **Source:** `path/to/file.ts`

### Feature / Change B — [nama]
- …

## User-facing impact

- Halaman/route yang berubah: `/…`
- Perubahan UX (loading, empty, error, CTA, navbar, dashboard tab, dll.)
- Apa yang perlu di-smoke test manual

## Added

- Fitur / endpoint / page / service / model / job baru (spesifik)

## Changed

- Behavior existing yang berubah (sebelum → sesudah bila relevan)

## Fixed

- Bug + gejala singkat + root cause singkat

## Security

- Auth/permission/tenant/upload/rate-limit/input hardening  
- Atau tulis `N/A` dengan alasan

## Ops / Tooling

- Deploy, PM2, cron, scripts, monitoring, SEO tooling, dll.  
- Atau `N/A`

## Docs

- Daftar file docs yang diupdate (feature, endpoints, OpenAPI, SOP, architecture, todo, version)

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

| Method | Path | Auth / permission | Change | Observed request | Observed response |
|--------|------|-------------------|--------|------------------|-------------------|
| GET | `/api/...` | public / auth + perm | added/changed/removed | query/body fields dari code | status + shape dari code |

Jika **none**: tulis satu baris eksplisit di tabel (`— | — | — | none | — | —`).

Wajib sync:

1. `docs/api/endpoints.md`
2. `docs/openapi.json` (+ `npm run docs:api-html`)
3. Feature doc + category `00-README` / `99-openapi-*` bila ada

## Frontend / Backend surface

### Frontend
- Routes/pages: …
- Components/hooks/lib: …
- Query keys / invalidation: …

### Backend
- Routes: `server/routes.ts` / `server/routes/*.ts`
- Services/storage/models: …
- Middleware/cron/sidecar: …

## File impact (sample)

| Path | Why relevant |
|------|----------------|
| `path` | … |

## Data / schema notes

- Perubahan `db/mongodb.ts` / `shared/schema.ts` / indexes / migrasi
- Atau `N/A`

## Configuration / env notes

- Nama env baru/berubah (**jangan** tulis nilai secret)
- Atau `N/A`

## Verification

- [ ] `npm run check`
- [ ] Smoke manual area terkait (main **dan** tenant bila relevan)
- [ ] Upload/media cleanup dicek bila ada file
- [ ] `package.json` version = X.Y.Z
- [ ] `docs/openapi.json` `info.version` = X.Y.Z
- [ ] `docs/version/versions.md` Current diupdate
- [ ] Section baru di `docs/version/changelogs/CHANGELOG.md`
- [ ] Feature/API docs terupdate jika behavior berubah

## Commit index (lengkap)

| Date | Hash | Author | Subject |
|------|------|--------|---------|
| YYYY-MM-DD | `hash` | author | subject |

## Notes / Known gaps

- Limitasi, follow-up, partial contracts (`Needs runtime verification`), debt teknis

---

## Checklist bump (wajib)

1. Tentukan MAJOR / MINOR / PATCH (SOP 11).
2. Buat file release dari template ini — **lengkap**.
3. Update `versions.md` (Current) + `changelogs/CHANGELOG.md`.
4. Sync version di `package.json` + OpenAPI.
5. Update feature/API/SOP docs yang terdampak.
6. Jangan merge/selesai unit kerja tanpa release note lengkap.
