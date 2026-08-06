# SOP 12 — Runtime Security & Operations HMPS

## Scope

SOP ini berlaku untuk middleware security, rate limit, cache, scheduler, backup/restore, web push, file scanner, Vite dev runtime, Swagger/OpenAPI, banner-render sidecar, and infrastructure helpers.

## Runtime Security Rules

1. Fail closed for auth, permission, tenant resolver, upload validation, and suspicious traffic.
2. Do not expose internal middleware rule details to clients.
3. Respect trusted proxy/network configuration when reading client IP.
4. Cache only public-safe data unless explicitly scoped and protected.
5. Keep service account and API credentials **out of git**. Jangan commit JSON credential di `server/` atau root.
6. Global input hardening harus tetap mempertahankan flow publik yang sah (feedback, register, dll.).

## Middleware Rules

- `server/security.ts` orchestrates global security behavior.
- `server/middleware/**` modules must be documented under runtime infrastructure if added.
- Registration code attempts should resist brute force.
- Public rate limit must not break normal public browsing.
- Load shedding must return safe responses under pressure.
- Tenant resolver must not trust client-supplied tenant context.

## Scheduler & Backup Rules

1. Backup jobs must be idempotent and log safe metadata only.
2. Restore requires OTP confirmation.
3. Prodi sync and cleanup jobs must not delete active referenced media.
4. Maintenance jobs must avoid tenant/main data mixups.
5. Cron jobs hidup di process main (`server/index.ts`) — jangan asumsikan worker terpisah kecuali memang di-deploy.

## Web Push / Notification Rules

1. Service worker payload should be minimal.
2. Subscription endpoints must validate auth/tenant context.
3. Do not store secret in service worker or public JS.
4. Update notification feature docs if payload or preference behavior changes.

## File Scanner / Upload Ops

- Jika ClamAV / `file-scanner` aktif, dokumentasikan dependency runtime dan failure mode (fail closed vs soft).
- Upload tetap wajib mimetype/size/path sanitize + cleanup.

## Banner Render Sidecar

- Process terpisah: `server/banner-render-service.ts` (`npm run dev:banner-render` / `start:banner-render`).
- Pastikan health/ops tercakup saat deploy yang memakai banner template render.

## System Error Monitoring

- Capture best-effort; jangan ganggu request utama.
- Owner-only management endpoints; public report rate-limited.
- AI analysis keys server-side only.

## API Docs Runtime

1. Keep Swagger/OpenAPI aligned with endpoints; sync `info.version` dengan app version.
2. Do not expose internal-only endpoints as public stable API unless intended.
3. Static docs should not include secrets or local credential paths.
4. Regenerate HTML via `npm run docs:api-html` setelah OpenAPI berubah.

## Operational Verification

- Run `npm run check`.
- Smoke test affected public/admin/tenant paths.
- Verify no sensitive runtime file was added to git.
- Verify logs do not include credential or token values.
- Bump `docs/version/` setelah unit kerja ops/security selesai.
