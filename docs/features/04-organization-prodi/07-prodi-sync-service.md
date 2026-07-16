# Prodi Sync Service

**Status**: Active | **Contract Confidence**: Partial from service scan | **Category**: organization prodi

---

## Deskripsi

Sinkronisasi data prodi dari sumber remote/internal untuk dosen, curriculum, lab, akreditasi, **kalender akademik UIN**, hub skripsi/PKL TI, feed pengumuman, serta seed panduan portal mahasiswa (NIM, email, SKKM, SKPI, Ma'had).

Scope sync: `all | profile | lecturers | curriculum | labs | accreditation | academicCalendar | studentResources`.

Student resources gagal secara terisolasi — tidak menggagalkan sync profil/kurikulum.

### Kalender PDF
- File disimpan di `uploads/prodi/calendar/` (path relatif project root / `uploadDir`, bukan `cwd`).
- Sync di **server production** wajib agar unduh/pratinjau tidak 404.
- Jika `pdfUrl` di Mongo ada tapi file hilang, sync mengunduh ulang. UI publik HEAD-check lokal lalu fallback ke `sourcePdfUrl`.
- Jika unduh Odoo gagal (IP/token), unggah manual via dashboard atau `POST /api/prodi/calendar/upload` (`prodi.sync`, multipart `file` + `yearStart`).

### Pengumuman
- Kategori: `thesis | wisuda | ukt | kalender | lainnya`.
- Max **50 item per kategori** saat sync; UI publik **10/halaman** + pagination (termasuk filter Semua).
- Auto-fetch: cron per jam; interval default **1 hari** (`announcementSyncIntervalDays`) menjalankan refresh **student hub penuh** (kalender + skripsi + PKL + pengumuman), dapat diubah di dashboard Prodi → tab Pengumuman.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai **Prodi Sync Service** sesuai flow aplikasi.
2. Sebagai maintainer, saya ingin source file dan endpoint fitur ini eksplisit agar tidak hilang saat refactor.
3. Sebagai reviewer, saya ingin contract yang belum pasti ditandai partial, bukan dikarang.
4. Sebagai mahasiswa TI, saya ingin kalender akademik, portal, skripsi/PKL, dan panduan NIM di halaman Prodi.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| POST | `/api/prodi/sync/run` | `server/routes.ts` | `{ scope, overwrite? }` | sync result / needsConfirm |
| POST | `/api/prodi/calendar/upload` | `server/routes.ts` | multipart `file`, `yearStart`, `yearEnd?` | `{ ok, pdfUrl, yearStart, yearEnd }` |
| GET | `/api/prodi` | public | — | content + `studentHub` defaults |

---

## Observed Request Shape

```json
{ "scope": "studentResources", "overwrite": false }
```

Valid scopes: all, profile, lecturers, curriculum, labs, accreditation, academicCalendar, studentResources.

---

## Observed Response Shape

Returns sync summary including `calendarYears`, `announcementCount`, `pklTemplates`, `studentResourcesOk` when relevant.

---

## Technical Design / Sources

- `server/services/prodi-sync.ts`
- `server/services/prodi-student-resources.ts`
- `shared/prodi-student-hub.ts`
- `client/src/pages/prodi.tsx`
- `client/src/components/prodi/student-hub-sections.tsx`
- `client/src/pages/dashboard/prodi.tsx`

---

## Business Rules From Code / Project Standards

1. Validate input before execution.
2. Enforce auth/permission server-side when protected.
3. Use tenant context only from server-side resolver for tenant-aware operations.
4. Never expose secrets, OTP, token, credential, backup URI, API key, password hash, or raw stack trace.

---

## Test Scenarios

| # | Scenario | Input/Action | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Happy path | valid request/call | success response/result from source |
| 2 | Unauthorized | missing auth where protected | 401/403 safe error |
| 3 | Invalid input | missing/invalid required field | safe error |
| 4 | Regression | `npm run check` | TypeScript passes |

---

## Unknown / To Verify

- Confirm exact runtime response body before publishing external API examples.
- Confirm client-side transforms before changing payload shape.
