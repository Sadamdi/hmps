# Backup Restore

**Status**: Active | **Contract Confidence**: Verified from route scan  | **Category**: ops security

---

## Deskripsi

Fitur **Backup Restore** terdokumentasi ulang dari audit code HMPS New, bukan dari payload template. Endpoint, parameter, body field, dan status response di bawah berasal dari static scan terhadap route handler di `server/routes.ts` dan `server/routes/*.ts` dan hanya membaca file HMPS New.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai fitur **Backup Restore** melalui UI terkait agar kebutuhan operasional atau informasi terpenuhi.
2. Sebagai maintainer, saya ingin mengetahui endpoint dan source file aktual agar perubahan tidak salah kontrak.
3. Sebagai reviewer, saya ingin melihat field request/response yang terdeteksi dari code agar tidak mengandalkan contoh generik.

---

## UI / User Flow

| Item | Value |
|------|-------|
| UI routes/surfaces | `ops/admin endpoints` |
| Frontend source | `client/src/App.tsx`, `client/src/pages/**`, targeted components/hooks |
| Backend source | Route table below |

Flow umum:

1. UI membuka route/surface di atas.
2. UI mengirim request ke endpoint yang relevan.
3. Backend melakukan validasi, auth/permission, dan tenant resolver bila endpoint tenant-aware.
4. Handler memanggil storage/service/model terkait.
5. Response dikembalikan sesuai handler aktual.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| GET | `/api/backups/monthly` | `server/routes.ts#L6052` | none observed in handler window | 200/json |
| POST | `/api/backups/restore/request-otp` | `server/routes.ts#L6072` | none observed in handler window | 400, 500, 200/json |
| POST | `/api/backups/restore/confirm` | `server/routes.ts#L6103` | body: snapshotKey, challengeId, code | 400, 500, 200/json |
| POST | `/api/backups/now` | `server/routes.ts#L6144` | none observed in handler window | 200/json |

---

## Observed Request Shape

- `POST /api/backups/restore/confirm` body fields observed: `snapshotKey`

> [!IMPORTANT]
> Field di atas adalah hasil static scan sekitar route handler. Untuk perubahan implementasi, buka source file dan line yang tercantum untuk memastikan validasi lengkap, default value, dan transformasi data.

---

## Observed Response Shape

Static scan menemukan pola response berikut:

- Status JSON yang terdeteksi: `200/json, 400, 500`
- Banyak endpoint existing HMPS masih memakai campuran `{ message }`, array langsung, object langsung, atau `{ success, data }` tergantung handler.
- Jangan menulis contoh response final kecuali sudah dicek pada handler spesifik.

Recommended response untuk endpoint baru tetap mengikuti SOP API:

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

---

## Technical Design

### Frontend Surface

| Concern | Actual Pattern |
|---------|----------------|
| Routing | Wouter route composition in `client/src/App.tsx` |
| Server State | TanStack React Query / API helper where implemented |
| UI States | Loading, empty, error, success state expected for async surfaces |
| Permission UX | UI guard is convenience only; backend remains source of truth |

### Backend Surface

| Concern | Actual Pattern |
|---------|----------------|
| Route orchestration | `server/routes.ts` for core modules; `server/routes/*.ts` for modular features |
| Business logic | `server/services/**`, storage helpers, or route-local orchestration |
| Data access | `server/mongo-storage.ts`, `server/tenant-storage.ts`, `db/mongodb.ts`, `server/models/**` |
| Contracts | Mixed existing response style; new work should follow `docs/SOP/06-api-design.md` |

---

## Business Rules From Project Standards

1. Validate params/query/body before database or external service calls.
2. Enforce auth and permission on protected/dashboard/admin routes server-side.
3. For tenant-aware behavior, trust tenant context only from server resolver.
4. Never expose password hashes, OTP, JWT/session token, Gemini key, Google credential, SMTP password, backup URI, or raw stack trace.
5. Update `docs/api/endpoints.md`, OpenAPI docs, and this feature doc when endpoint behavior changes.

---

## Security & Tenant Notes

| Concern | Required Handling |
|---------|-------------------|
| Auth | Verify handler/middleware in source lines listed above |
| Permission | Verify permission key/check in handler before changing behavior |
| Tenant | Use `/api/c/:slug/*` resolver/storage when feature is tenant-aware |
| Upload | Validate MIME/size/path and cleanup temporary files |
| Logging | Log user/resource/tenant/action without secrets |

---

## Test Scenarios

| # | Scenario | Input/Action | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Happy path | valid UI/API request | handler returns success response shown by source |
| 2 | Validation error | missing/invalid observed fields | safe 400/validation-style error if handler validates |
| 3 | Unauthorized | no/invalid session on protected route | 401 or 403 based on handler/middleware |
| 4 | Not found | invalid id/slug | 404 or safe message based on handler |
| 5 | Tenant boundary | wrong community slug/context | no cross-tenant data access |
| 6 | Regression | `npm run check` | TypeScript passes |

---

## Source References

- Feature doc: `10-ops-security/03-backup-restore.md`
- UI: `ops/admin endpoints`
- Endpoint sources: `server/routes.ts`
- Endpoint inventory: `docs/api/endpoints.md`
- Feature summary: `docs/features/feature-summary.md`

---

## Unknown / To Verify

- Exact full response body per endpoint should be confirmed in the listed handler before publishing external API docs.
- Some handlers build response objects through storage/service return values; inspect service/model before changing contracts.
- Client-side payload may include transformed fields not visible from backend static scan.



## Retensi & kapasitas (4.57.0)

- Retensi: **situs utama 3 bulan**, **tiap komunitas 2 bulan** (`BACKUP_KEEP_MAIN`, `BACKUP_KEEP_TENANT`). Sebelumnya 12 bulan hanya untuk situs utama dan snapshot komunitas (`bk_t_*`) tidak pernah dipangkas.
- Penyebab masalah: cluster backup (Atlas gratis) dibatasi **500 koleksi TOTAL**; tiap snapshot bulanan membawa 25–45 koleksi. Cluster penuh → backup baru gagal terpotong → pemangkasan lama (yang berjalan sesudah backup sukses) tidak pernah jalan.
- Alur `runMonthlyBackup`: pangkas dulu (sisakan satu slot) → cek kapasitas (`BACKUP_MAX_CLUSTER_COLLECTIONS`, default 480) → salin SECARA UTUH (snapshot parsial dihapus bila gagal) → pangkas lagi. Kunci bulan (`lastMonthlyBackupKey`) hanya dicatat bila semua snapshot lengkap.
- Aturan pangkas (`server/lib/backup-retention.ts`, fungsi murni): simpan N terbaru per grup; snapshot terpotong (< 70% koleksi snapshot lebih lama) dibuang bila ada yang lengkap; backup komunitas yang tidak aktif dan sudah lebih tua dari retensi dibuang; snapshot lengkap terakhir dari situs utama/komunitas aktif tidak pernah dihapus.
- Penjadwal: tanggal 1 jam 02:00, pemeriksaan harian jam 03:30, dan saat server hidup. Idempoten; pulih sendiri bila backup tanggal 1 gagal.
- `BACKUP_PRUNE_DRY_RUN=1` hanya mencatat rencana pemangkasan tanpa menghapus.
- **Jangan menjalankan server lokal/uji dengan `MONGODB_URI_BACKUP` produksi**: server yang hidup menjalankan backup dan pemangkasan terhadap cluster backup.
