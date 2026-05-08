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

## Sebelum Push

- `npm run check`.
- Cek diff untuk `.env`, credential, uploads, backup dump.
- Update docs jika endpoint/behavior berubah.
- Pastikan tenant-aware change tidak memecah main path.
