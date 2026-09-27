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

Alur aman (auto + manual):

1. **Media baru di server** → `ops/auto-push-media.sh` commit+push (author Adam).
2. **Code baru di GitHub** → `git fetch` + `reset --hard origin/main` + restore media/`.env`.
3. **Hanya docs/skills/ops** → jangan stop app, jangan npm/build.
4. **Runtime baru** (`client/` `server/` `shared/` `db/` `public/` / lockfile) → backup `dist` → stop app (`hmps-app`, `himatif-banner`) **+ stop `clamav-daemon`** → `npm install --include=dev` → build → start `clamav-daemon` & tunggu socket `/var/run/clamav/clamd.ctl` siap (maks 180s) → restart app + healthcheck `:5000`. Jika build/health gagal → restore `dist` lama (hindari 404/502); clamd tetap dinyalakan lagi. **Tidak pernah di-stop:** `ssh`, `cloudflared` (jalur masuk situs), `nginx`, `pm2-root`, `hmps-auto-deploy`, akses remote. Selama build situs memang 502 (~3–4 menit) — kelompokkan perubahan runtime dalam satu push.

| Jalur | Path | Perilaku |
|-------|------|----------|
| Manual | `cd /var/www/hmps && bash ops/deploy-server.sh` | Langkah 2–4 di atas |
| Auto watcher | PM2 `hmps-auto-deploy` → `/root/auto-deploy.js` | Tiap ~30s: langkah 1 lalu deploy jika `origin/main` lebih baru **atau** dist stale (`.deploy-built-head` ≠ HEAD) |
| Reboot | systemd `pm2-root.service` + `pm2 save` | Resurrect `hmps-app`, `himatif-banner`, `hmps-auto-deploy` |

VPS ~2 GB RAM, **container OpenVZ**: `swapon` ditolak (`Operation not permitted`) walau `/swapfile` 2GB ada — swap hanya bisa lewat panel/provider VPS. `ops/ensure-swap.sh` tetap dipanggil tiap deploy (hanya warning). Karena itu `clamd` (±1GB) di-stop saat build (`HMPS_STOP_SERVICES`, default `clamav-daemon`). Build retry 2x + `NODE_OPTIONS=--max-old-space-size=1280`. Jangan `npm ci` sambil app masih jalan.

**Dist stale (4.16.4+):** bila build gagal, trap restore dist lama → site tetap jalan tapi bundle lama. Auto-deploy **retry tiap 30s** sampai `.deploy-built-head` = HEAD. Update watcher: `bash ops/install-auto-deploy.sh` (salin `ops/auto-deploy.js` → `/root/auto-deploy.js`).

**Wajib vite di `dependencies` + `--include=dev`:** `dist/index.js` dan `server/vite.ts` meng-import `vite`. Sejak 4.15.1 `vite`/`esbuild` ada di `dependencies`, tapi `NODE_ENV=production` dari PM2 tetap bisa memangkas bin lama. Script deploy meng-`unset NODE_ENV`, cek `node_modules/.bin/vite` **executable**, force-install vite jika bin hilang, dan FATAL sebelum build. Auto-deploy child env: `NODE_ENV=development` + `NPM_CONFIG_PRODUCTION=false`.

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
