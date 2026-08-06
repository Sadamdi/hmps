# SOP 03 — Git Branching Strategy HMPS

## Branch Naming

- `feature/<module>-<short-name>` untuk fitur.
- `fix/<module>-<short-name>` untuk bugfix.
- `docs/<short-name>` untuk dokumentasi.
- `chore/<short-name>` untuk maintenance.

Contoh:

```text
feature/store-campaign-bundle
fix/tenant-media-scope
docs/feature-inventory
chore/update-openapi-html
```

## Commit

Gunakan conventional commit:

```text
feat(store): add bundle checkout validation
fix(auth): revoke stale session after password change
docs(features): update HMPS feature inventory
```

## Default Branch

- Default branch: `main` (remote `origin`).
- Naming/conventional commit adalah **konvensi tim**; belum ada CI GitHub Actions yang memaksa di repo ini.

## Sebelum Push

- `npm run check`.
- Cek diff untuk `.env`, credential JSON, uploads, backup dump.
- Update docs jika endpoint/behavior berubah (SOP 11).
- Bump `docs/version/` untuk unit kerja yang selesai + sync `package.json` / OpenAPI version.
- Pastikan tenant-aware change tidak memecah main path.
- Di Windows, jika git menolak repo ("dubious ownership"), gunakan `git -c safe.directory=<path>` atau minta owner menambahkan safe.directory — jangan commit secret sebagai workaround.
