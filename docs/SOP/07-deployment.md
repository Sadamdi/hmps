# SOP 07 — Deployment HMPS

## Build & Run

```bash
npm run build
npm start
```

Build menghasilkan frontend Vite dan backend bundled ke `dist/`.

## Required Env

- `NODE_ENV=production`
- `MONGODB_URI`
- `JWT_SECRET`
- Email/SMTP config untuk OTP
- Gemini API keys untuk chat
- Google Drive credential path jika Drive aktif
- Backup cluster URI jika backup aktif

## Runtime Requirements

- App server listen port `5000` behind reverse proxy.
- Upload directories writable.
- `docs/openapi.json` dan static docs tersedia bila dipublish.
- Scheduler berjalan hanya pada process yang memang bertugas menjalankan cron.

## Security

- HTTPS dan secure cookies di production.
- Jangan deploy dengan fallback secret.
- Review `nginx-himatif-encoder.conf`.
- Lindungi service account JSON dan backup dump.

## Post-Deploy Smoke

- `/sitemap.xml`
- login/logout
- public berita/events/library
- dashboard protected route
- tenant community route
- upload small image
- store product/cart route
