# SOP 11 — Documentation Maintenance HMPS

## Scope

SOP ini mengatur cara menjaga dokumentasi HMPS tetap code-accurate setelah perubahan frontend/backend/runtime, **termasuk versioning per unit kerja**.

## Source of Truth Order

1. Current codebase implementation.
2. `docs/features/feature-summary.md`.
3. Feature docs under `docs/features/<category>/`.
4. `docs/api/endpoints.md` and OpenAPI files.
5. `docs/version/` (versions + release notes + changelog).
6. SOP and architecture docs.

## Required Updates by Change Type

| Change | Required Docs |
|--------|---------------|
| New endpoint | feature doc, category README, endpoints.md, OpenAPI if public/stable |
| Endpoint request/response change | feature doc observed contract, endpoints.md, OpenAPI |
| New frontend route/page | feature doc or auxiliary route inventory, feature summary |
| New component/hook/lib affecting feature | feature doc or auxiliary runtime doc |
| New service/model/storage | feature doc technical design and feature summary coverage |
| New middleware/config/runtime helper | runtime infrastructure doc and feature summary |
| Tenant behavior change | tenant feature doc and multi-tenant architecture doc |
| Upload/media behavior change | media feature doc and security/error notes |
| Auth/permission behavior change | auth feature doc and endpoints/security notes |
| **Any finished work unit** | **`docs/version/release/X.Y.Z.md` + `versions.md` + `changelogs/CHANGELOG.md` + sync `package.json` & OpenAPI `info.version`** |
| Script/env/deploy change | SOP 07 + ops notes; verify script files still exist |

## Versioning Policy (per unit kerja)

Setiap selesai mengerjakan **satu unit kerja** (bukan menunggu rilis besar):

1. Tentukan bump SemVer:
   - **MAJOR**: breaking / platform shift
   - **MINOR**: fitur baru / tugas besar non-breaking
   - **PATCH**: fix / hardening / docs sync kecil
2. Salin `docs/version/version-template.md` → `docs/version/release/<version>.md` dan isi lengkap.
3. Update Current di `docs/version/versions.md`.
4. Tambah section di `docs/version/changelogs/CHANGELOG.md`.
5. Sync `package.json` `version` dan `docs/openapi.json` `info.version`.

### GitHub Release automation

Setiap bump versi yang masuk ke `main` otomatis disinkronkan oleh
`.github/workflows/sync-github-release.yml`.

Kontrak:

1. `package.json` version berubah.
2. `docs/version/release/X.Y.Z.md` wajib ada dan heading versinya cocok.
3. Workflow membuat atau memperbarui tag/release `vX.Y.Z`.
4. Push media otomatis atau perubahan docs tanpa bump versi tidak membuat release.
5. Manual/backfill dapat dijalankan dengan:

```bash
python ops/sync-github-releases.py --version X.Y.Z --target HEAD
python ops/sync-github-releases.py --all
```

Workflow menggunakan `GITHUB_TOKEN` bawaan Actions dengan permission
`contents: write`; jangan menyimpan Personal Access Token di repository.

Struktur:

```text
docs/version/
├── versions.md
├── version-template.md
├── changelogs/
│   ├── README.md
│   └── CHANGELOG.md
└── release/
    └── X.Y.Z.md
```

## Feature Doc Quality Rules

1. Do not invent request/response examples.
2. Use observed contract from route/schema/service when possible.
3. Mark uncertain contract as `Partial`, `Unknown`, or `Needs runtime verification`.
4. Include source file references.
5. Include security/tenant/media notes when relevant.
6. Keep category indexes current.
7. Isi field `Since version` / `Last documented version` di feature template bila relevan.

## Honesty Rules

1. Dokumentasikan response shape apa adanya (`{ message }` vs envelope `success`).
2. Jangan klaim automated tests jika belum ada suite.
3. Verifikasi script di `package.json` masih punya file target sebelum menulis langkah deploy.
4. Model utama di `db/mongodb.ts` + `shared/schema.ts`, bukan hanya `server/models/`.

## Coverage Audit Checklist

After large changes, verify:

- Express routes are mapped (termasuk modular: store, chat, comments, feedback, sharing, notifications, social-feed, ai-enhance, system-errors).
- Frontend pages are mapped.
- Services/models/storage are mapped.
- Runtime middleware/config/helpers are mapped.
- README navigation still points to correct docs (termasuk SOP 09–12 dan `docs/version/`).
- Version Current selaras di package + OpenAPI + `versions.md`.
- `npm run check` passes if code or TypeScript-aware docs references changed.

## Contributors in docs

Human contributors resmi hanya [@Sadamdi](https://github.com/Sadamdi) dan [@addid-cloud](https://github.com/addid-cloud). Jangan cantumkan Claude, Cursor, Copilot, atau nama model sebagai author/contributor di README, AGENTS, release notes, atau trailer `Co-authored-by` AI. Commit identity: `Sulthan Adam Rahmadi <sultanadamr@gmail.com>`.

## Do Not Document Secrets

Never include values/content of:

- `.env`,
- service account JSON,
- JWT secret,
- Gemini / OpenAI-compatible key,
- SMTP password,
- backup URI,
- VAPID private keys,
- tokens or OTP.
