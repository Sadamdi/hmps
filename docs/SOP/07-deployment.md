# SOP 07 — Deployment HMPS

## Build & Run

```bash
npm run build
npm start
```

Build menghasilkan frontend Vite dan backend bundled ke `dist/` (termasuk `banner-render-service`).

### Proses terkait

| Process | Dev | Prod |
|---------|-----|------|
| Main app | `npm run dev` | `npm start` (port **5000**) |
| Banner render sidecar | `npm run dev:banner-render` | `npm run start:banner-render` |

### Production deploy (aktual)

| Jalur | Path | Perilaku |
|-------|------|----------|
| Manual | `cd /var/www/hmps && bash ops/deploy-server.sh` | Backup media/`.env` → `git reset --hard origin/main` → restore. **Docs/skills/ops saja:** jangan stop app. **Runtime/lockfile:** stop → `npm install --include=dev` → build → restart + healthcheck `:5000` |
| Auto watcher | PM2 `hmps-auto-deploy` → `/root/auto-deploy.js` (di luar repo app) | Tiap ~30s: (1) `ops/auto-push-media.sh` (media aman → GitHub) (2) jika `origin/main` lebih baru → `ops/deploy-server.sh` |
| Reboot | systemd `pm2-root.service` + `pm2 save` | Resurrect `hmps-app`, `himatif-banner`, `hmps-auto-deploy` |

VPS ~2 GB RAM / 0 swap: jangan `npm ci` sambil app masih jalan.

**Wajib `--include=dev`:** `dist/index.js` meng-import paket `vite` (devDependency). `npm install` dengan `NODE_ENV=production` memangkas vite → `vite: not found` + proses PM2 “online” tanpa listen `:5000` → Cloudflare **502**.

Auto-deploy **tidak** menyimpan secret; pakai `/var/www/hmps/.env` + credential git server. Script `*.sh` harus **LF**.

Tidak ada Docker/CI resmi di repo saat ini. Catatan ops lokal (gitignore): `docs/ops/`.

## Scripts di `package.json` (status)

| Script | Status |
|--------|--------|
| `dev`, `build`, `start`, `check`, `docs:api-html` | Aktif / dipakai |
| `dev:banner-render`, `start:banner-render` | Aktif |
| `generate-sitemap`, `generate-favicon`, `deploy-seo` | Tercantum di package.json — **file script bisa hilang**; verifikasi sebelum dipakai di deploy |

## Required Env (tema)

- `NODE_ENV=production`
- `MONGODB_URI`
- `JWT_SECRET`
- Email/SMTP untuk OTP
- Gemini / OpenAI-compatible keys untuk chat & error-monitor AI (sesuai fitur aktif)
- Google Drive credential path jika Drive aktif
- Backup cluster URI jika backup aktif
- VAPID / webpush keys jika push aktif
- ClamAV / file-scanner settings jika scanner aktif
- Trusted proxy / network settings sesuai `server/security.ts` & middleware

Jangan commit nilai secret. Credential JSON service account tidak boleh masuk source control.

## Runtime Requirements

- App server listen port `5000` behind reverse proxy (`nginx-himatif-encoder.conf`).
- Upload directories writable.
- `docs/openapi.json` dan static docs tersedia bila dipublish.
- Scheduler/cron berjalan pada process main app yang memang menjalankan jobs di `server/index.ts`.
- Jika banner-render dipakai production, pastikan process sidecar ikut di-PM2/systemd.

## Security

- HTTPS dan secure cookies di production.
- Jangan deploy dengan fallback secret.
- Review `nginx-himatif-encoder.conf`.
- Lindungi service account JSON dan backup dump di luar repo.

## Post-Deploy Smoke

- `/sitemap.xml`
- login/logout
- public berita/events/library + home social feed
- dashboard protected route
- tenant community route
- upload small image
- store product/cart route
- owner system-errors dashboard (jika monitoring aktif)
- banner-render health (jika sidecar aktif)
