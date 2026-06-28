# System Error Monitoring (Bug Otomatis)

**Status**: Active | **Contract Confidence**: Verified from code | **Category**: collaboration feedback
**Tenant-Aware**: Global (ditangkap lintas-tenant, disimpan di main DB) | **Permission Scope**: Owner (kelola) / Public (lapor dari client)

---

## Deskripsi

**System Error Monitoring** adalah pelaporan bug **otomatis oleh sistem** — pelengkap fitur [Bug Reports](./04-bug-reports.md) yang dikirim manual oleh user. Ketika terjadi bug **nyata** di server (kegagalan 5xx) atau di tampilan/browser (runtime error, unhandled promise rejection, atau crash render React), sistem secara otomatis membuat laporan lengkap ke koleksi `SystemError` dan menampilkannya di dashboard owner (`/dashboard/feedback` → tab **Bug Otomatis**).

Setiap laporan berisi: IP klien, akun (bila login), peran, email, perangkat/OS/browser, route, file:baris, fungsi, stack trace, environment, komunitas/tenant, jumlah kemunculan, dan **analisis AI** (ringkasan, dugaan penyebab, saran perbaikan) yang dihasilkan pipeline OpenAI-compatible → Gemini yang sudah ada.

Cakupan sengaja dibatasi agar dashboard tidak banjir:
- **Server**: hanya status `>= 500` (kegagalan nyata). 4xx, 429, 503, dan request abort **diabaikan**.
- **Client**: runtime error, unhandled rejection, dan crash render React.
- Error identik **dikelompokkan** (dedup) berdasarkan fingerprint; kemunculan berulang hanya menambah `count` + `lastSeenAt`.

---

## User Stories

1. Sebagai **owner**, saya ingin tahu bug yang benar-benar terjadi di produksi tanpa menunggu laporan user, agar bisa cepat memperbaiki.
2. Sebagai **owner**, saya ingin tiap bug otomatis disertai konteks lengkap (siapa, di mana, kapan, file/baris) dan analisis AI, agar tidak perlu menebak penyebabnya.
3. Sebagai **maintainer**, saya ingin error dikelompokkan agar 1 bug yang muncul 1000× tidak membuat 1000 baris.

---

## UI / User Flow

| Item | Value |
|------|-------|
| UI routes/surfaces | `/dashboard/feedback` → tab **Bug Otomatis** (owner-only) |
| Frontend source | `client/src/pages/dashboard/feedback.tsx`, `client/src/lib/error-monitor.ts`, `client/src/components/error-boundary.tsx`, `client/src/main.tsx` |
| Backend source | `server/services/error-monitor.ts`, `server/routes/system-errors.ts`, `server/index.ts` (global error handler + process listeners) |

**Flow server (otomatis):**
1. Sebuah handler melempar error → global error handler (`server/index.ts`) menangkapnya.
2. `captureServerError(err, req, { statusCode })` dipanggil best-effort; difilter `status >= 500`.
3. Fingerprint dihitung; dilakukan `findOneAndUpdate` upsert (dedup).
4. Bila dokumen **baru**, `analyzeError()` berjalan fire-and-forget (OpenAI → Gemini).

Selain global error handler, listener `unhandledRejection` juga menangkap promise rejection yang tak tertangani. Handler `uncaughtException` **sengaja tidak dipasang** agar tidak mengubah perilaku crash bawaan Node (menelan exception sinkron bisa meninggalkan proses dalam keadaan tak menentu).

**Flow client (otomatis):**
1. `installGlobalErrorMonitor()` di `main.tsx` memasang listener `error` + `unhandledrejection`; `ErrorBoundary` membungkus `<App/>`.
2. Error di-throttle + dedup di client, lalu `POST /api/system-errors/report`.
3. Server melengkapi IP/akun/perangkat dan menjalankan pipeline yang sama.

**Flow owner (kelola):** buka tab → filter status/sumber → expand kartu → lihat analisis AI & konteks → ubah status / analisis ulang / hapus.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Auth | Observed Input | Observed Response |
|--------|----------|--------|------|----------------|-------------------|
| POST | `/api/system-errors/report` | `server/routes/system-errors.ts` | Public + optional auth, rate-limited | body: `{ name?, message?, stack?, source?, route?, url?, componentStack?, breadcrumb? }` | `202 { ok: true }` (selalu soft-success) |
| GET | `/api/system-errors/list` | `server/routes/system-errors.ts` | Owner | query: `status?`, `severity?`, `source?`, `page?`, `limit?` | `{ items: SystemErrorItem[], total, page, limit }` |
| GET | `/api/system-errors/count` | `server/routes/system-errors.ts` | Owner | — | `{ total, new, investigating, resolved, ignored, critical, high }` |
| GET | `/api/system-errors/:id` | `server/routes/system-errors.ts` | Owner | path: `id` | `SystemErrorItem` \| `404` |
| PATCH | `/api/system-errors/:id/status` | `server/routes/system-errors.ts` | Owner | body: `{ status: 'new'\|'investigating'\|'resolved'\|'ignored' }` | `SystemErrorItem` |
| POST | `/api/system-errors/:id/analyze` | `server/routes/system-errors.ts` | Owner | path: `id` | `SystemErrorItem` (dengan `aiAnalysis` terbarui) |
| DELETE | `/api/system-errors/:id` | `server/routes/system-errors.ts` | Owner | path: `id` | `{ message }` |

Owner-guard mengikuti pola Bug Report manual: `user.role !== 'owner'` → `403`.

---

## Data Model — `SystemError`

Source: `db/mongodb.ts` (`systemErrorSchema`), tipe `SystemErrorItem` di `shared/schema.ts`.

| Field | Tipe | Catatan |
|-------|------|---------|
| `fingerprint` | string (indexed) | hash `source+name+pesan-ternormalisasi+file/fungsi`; dasar dedup |
| `source` | `'server' \| 'client'` | asal error |
| `severity` | `'low'\|'medium'\|'high'\|'critical'` | diturunkan otomatis; bisa diperbarui AI |
| `name` / `message` / `stack` | string | tipe error, pesan, stack (di-cap 2KB/8KB) |
| `file` / `line` / `column` / `functionName` | string/number | frame teratas hasil parsing stack |
| `route` / `httpMethod` / `statusCode` | string/number | konteks request/route |
| `userId` / `username` / `userRole` / `userEmail` | nullable | akun bila login; null untuk tamu |
| `ip` / `userAgent` / `device` / `browser` / `os` | string | jaringan & perangkat |
| `communitySlug` / `communityName` | string | tenant asal |
| `count` / `firstSeenAt` / `lastSeenAt` | number/Date | agregasi kemunculan |
| `status` | `'new'\|'investigating'\|'resolved'\|'ignored'` | pengelolaan owner |
| `environment` | string | `NODE_ENV` |
| `metadata` | object | breadcrumb / componentStack (client) |
| `aiAnalysis` | object \| null | `{ summary, likelyCause, suggestedFix, severity, model, analyzedAt }` |

Indeks: `{ fingerprint }`, `{ status, lastSeenAt }`, `{ severity, lastSeenAt }`, `{ source, lastSeenAt }`.
Catatan: koleksi disimpan **hanya di main DB** (monitoring global), bukan per-tenant.

---

## Analisis AI

Source: `analyzeError()` di `server/services/error-monitor.ts`.

1. Hanya jalan pada **kemunculan pertama** (dokumen baru) atau saat owner klik **Analisis ulang**.
2. Di-gate `ERROR_MONITOR_AI_ENABLED`, di-throttle (maks 8 panggilan / menit) untuk hemat kuota.
3. Membaca ±15 baris di sekitar `file:line` (best-effort, hanya file lokal di dalam project, bukan `node_modules`) sebagai konteks kode nyata.
4. Memanggil **`runOpenAiChat`** (provider OpenAI-compatible / tokito) sebagai utama; bila gagal, fallback **Gemini** (`gemini-2.5-flash`, rotasi beberapa key via `getConfiguredSlots()`).
5. Output dipaksa JSON `{ summary, likelyCause, suggestedFix, severity }`. AI hanya boleh **menaikkan** severity dokumen (escalate-only), tidak menurunkan, agar kegagalan server nyata (5xx = `high`) tidak tersembunyi bila AI salah menilai ringan.

---

## Configuration

| Env Var | Default | Fungsi |
|---------|---------|--------|
| `ERROR_MONITOR_ENABLED` | `true` | Master switch monitoring (capture). `false`/`0`/`off` mematikan. |
| `ERROR_MONITOR_AI_ENABLED` | `true` | Switch analisis AI saja. |

Menggunakan kembali key `GEMINI_API_KEY_*` dan `OPENAI_API_KEY`/`OPENAI_BASE_URL`/`OPENAI_MODELS` yang sudah ada.

---

## Business Rules From Code

1. Server: hanya `status >= 500` ditangkap; abort (`ECONNABORTED`/`ECONNRESET`/`AbortError`) diabaikan.
2. Monitoring **tidak pernah** melempar error ke jalur request — semua dibungkus try/catch best-effort.
3. Endpoint `/report` selalu balas `202` (soft-success) agar browser tidak retry agresif / membuat loop error.
4. Dedup berbasis fingerprint: error sama → `count++` + `lastSeenAt`, konteks pertama dipertahankan.
5. Throttle ganda: client (10/menit + dedup 5 menit) dan AI server (8/menit).

---

## Security & Tenant Notes

| Concern | Required Handling |
|---------|-------------------|
| Auth | Kelola owner-only (`role === 'owner'`); `/report` publik + optional auth |
| Rate limit | `/report` dibatasi `createPublicRateLimiter('system-error-report', …)` |
| Tenant | Capture lintas-tenant, simpan di main DB; field `communitySlug/Name` menandai asal |
| Data sensitif | Pembacaan konteks kode dibatasi di dalam `process.cwd()` dan menolak `node_modules`; payload di-cap ukurannya |

---

## Test Scenarios

| # | Scenario | Input/Action | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Capture server 5xx | handler throw → 500 | 1 dokumen `SystemError` (source=server) berisi file:baris & konteks |
| 2 | Dedup | error sama dipicu 2× | tetap 1 dokumen, `count=2` |
| 3 | Analisis AI | dokumen baru | `aiAnalysis` terisi (OpenAI, fallback Gemini) |
| 4 | Filter 4xx | handler 400/404 | tidak ada dokumen dibuat |
| 5 | Client error | `window.onerror` / crash React | `POST /report` → dokumen source=client |
| 6 | Owner-guard | non-owner GET `/list` | `403` |

> Pipeline #1–#3 diverifikasi via skrip self-test sementara (capture → dedup → Gemini `gemini-2.5-flash` → cleanup) sebelum rilis.

---

## Source References

- `db/mongodb.ts` — `systemErrorSchema`, model `SystemError`
- `shared/schema.ts` — `SystemErrorItem`, `SystemErrorAiAnalysis`
- `server/services/error-monitor.ts` — capture, dedup, analisis AI
- `server/routes/system-errors.ts` — REST endpoints
- `server/index.ts` — hook global error handler + listener `unhandledRejection`
- `client/src/lib/error-monitor.ts` — capture client + throttle/dedup
- `client/src/components/error-boundary.tsx` — fallback crash render React
- `client/src/pages/dashboard/feedback.tsx` — tab **Bug Otomatis**

---

## Unknown / To Verify

- [ ] Akurasi `file:line` untuk error client pada bundle produksi (minified, tanpa source map) — frame menunjuk posisi bundle.
