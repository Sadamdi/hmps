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
- Feed TI + UIN digeser **hingga 5 halaman** (`?paged=N`) dengan dedupe URL; excerpt hingga **~800 karakter** (ditampilkan penuh di UI).
- Auto-fetch: cron per jam; interval default **1 hari** (`announcementSyncIntervalDays`) menjalankan refresh **student hub penuh** (kalender + skripsi + PKL + pengumuman), dapat diubah di dashboard Prodi → tab Pengumuman.
- Cron hub **menghormati `autoSyncEnabled`** (sama seperti sync bulanan).
- **Keep-on-fail**: pengumuman kosong/gagal → keep list lama; skripsi/PKL error → keep field rich (`intro`/`subjects`/flowchart/dll); portals/guides **tidak di-force** jika sudah ada data manual.

### Hub Skripsi / PKL (konten penuh)
- Scrape halaman Elementor resmi TI (`thesis-skripsi-s1`, `internship-pkl`), bukan hanya link PDF.
- Field tersimpan di `content.studentHub.skripsiHub` / `pklHub`:
  - `intro` — paragraf pembuka
  - `subjects[]` — nama, kode, SKS, prerequisite, `objectives[]`, `activities[]` (skripsi)
  - `flowchartImageUrl` — cache lokal di `uploads/prodi/skripsi/` atau `uploads/prodi/pkl/` (+ `flowchartSourceUrl` remote)
  - `notes[]` — catatan tambahan (PKL, mis. final report)
  - `documents` / `templates` / `actionLinks` / `sopPdf` — tautan form & dokumen
- UI publik (`HubResourceSection`) menampilkan intro → subjects → gambar alur → tahapan → dokumen.
- Dashboard editor memungkinkan koreksi manual intro/subjects/flowchart setelah sync.
- Portal & panduan mahasiswa tetap curated (`DEFAULT_STUDENT_PORTALS` / `DEFAULT_STUDENT_GUIDES`), bukan scrape penuh situs layanan akademik.

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

### Official URL map (recheck 2026-08-08)

| Scope | Live source | Notes |
|-------|-------------|--------|
| Lecturers | `/lecturer-staff/` | old `/lecturer-and-staff/` = 404 |
| Curriculum S1 index | `/curriculum-for-undergraduate/` | cards use `href="#"`; sync seeds `curriculum/` (2020) + `curriculum-2024-dan-rps/` (2024) |
| Curriculum detail 2024 | `/curriculum-2024-dan-rps/` | Terbaru di situs resmi |
| Curriculum S2 index | `/curriculum-for-master/` | entries keyed by `level: s2` + year |
| Curriculum S2 2022 | `/curriculum-2022/` | table parser SEMESTER I–III |
| Curriculum S2 2024 | PDF OBE (HTML page still 404) | `Kurikulum-OBE-Magister-Informatika-2024-rev.pdf` as guidebook |
| Accreditation S1 | `/accreditation-certificate-for-undergraduate-s1/` + directory | Unggul 2024 LAM INFOKOM |
| Accreditation S2 | `/master-study-s2/` | `/accreditation-certificate-for-master-s2/` **removed (404)**; Baik Sekali LAM INFOKOM 2025; merge keeps historical rows |
| Curriculum Master | `/curriculum-for-master/` → `/curriculum-2022/` | link `curriculum-2024-for-master` still 404 on official site |
| Calendar | UIN `web/content` / faculty mirrors | 2026/2027 curated |

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
