# Changelog — HMPS Project (HIMATIF ENCODER)

Mengikuti gaya [Keep a Changelog](https://keepachangelog.com/). Tanggal format `YYYY-MM-DD`.

---

## [Unreleased]

### Added — System Error Monitoring (Bug Otomatis)
- **Model baru** `SystemError` (`db/mongodb.ts`) + tipe `SystemErrorItem` (`shared/schema.ts`) untuk menyimpan bug yang ditangkap otomatis (server 5xx + error tampilan client), dengan dedup berbasis fingerprint dan agregasi `count`/`firstSeenAt`/`lastSeenAt`.
- **Service** `server/services/error-monitor.ts`: `captureServerError`, `captureClientError`, dan `analyzeError` (analisis AI Gemini → fallback OpenAI, membaca konteks kode di sekitar `file:line`).
- **Hook server**: global error handler + listener `unhandledRejection` di `server/index.ts` (best-effort, tidak mengganggu request; `uncaughtException` sengaja tidak dipasang agar perilaku crash bawaan tak berubah).
- **Capture client**: `client/src/lib/error-monitor.ts` (listener `error` + `unhandledrejection`, throttle & dedup) dan `ErrorBoundary` (`client/src/components/error-boundary.tsx`) dipasang di `client/src/main.tsx`.
- **REST API** `/api/system-errors/*`: `POST /report` (publik + optional auth, rate-limited), serta owner-only `GET /list`, `GET /count`, `GET /:id`, `PATCH /:id/status`, `POST /:id/analyze`, `DELETE /:id`.
- **Dashboard**: tab **Bug Otomatis (Sistem)** di `/dashboard/feedback` (owner-only) dengan filter status/sumber, badge severity, jumlah kemunculan, panel analisis AI, dan kontrol status.
- **Konfigurasi**: env `ERROR_MONITOR_ENABLED`, `ERROR_MONITOR_AI_ENABLED` (default aktif).

### Docs
- Dokumen fitur baru: `docs/features/08-collaboration-feedback/06-system-error-monitoring.md`.
- Pembaruan: `docs/features/08-collaboration-feedback/00-README.md`, `docs/features/feature-summary.md`, `docs/api/endpoints.md`, `docs/todo/master-todo.md`.
- OpenAPI: `docs/openapi.json` ditambah 7 operasi `system-errors` (total **278**) dan `docs/api-docs.html` di-regenerate (`npm run docs:api-html`).

### Verifikasi
- `npm run check` (TypeScript) lulus tanpa error.
- Pipeline diuji end-to-end (capture → dedup → analisis Gemini `gemini-2.5-flash` → cleanup) via skrip self-test sementara yang sudah dihapus.

---

> Sebelum entri ini, riwayat perubahan tidak dilacak secara formal di repo. Changelog dimulai pada 2026-06-28.
