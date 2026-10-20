# SOP 12 — Runtime Security & Operations HMPS

## Scope

SOP ini berlaku untuk middleware security, rate limit, cache, scheduler, backup/restore, web push, file scanner, Vite dev runtime, Swagger/OpenAPI, banner-render sidecar, and infrastructure helpers.

## Runtime Security Rules

1. Fail closed for auth, permission, tenant resolver, upload validation, and suspicious traffic.
2. Do not expose internal middleware rule details to clients.
3. Respect trusted proxy/network configuration when reading client IP. **Wajib pakai `getTrustedClientIp` (`server/lib/client-ip.ts`)** — urutan `CF-Connecting-IP` → (hanya bila peer = proxy lokal) hop **paling kanan** `X-Forwarded-For`/`X-Real-IP` → socket. **Dilarang** membaca hop pertama `X-Forwarded-For` langsung: nilainya diisi client dan terbukti (27–28 Sep 2026) bisa mem-bypass rate limit login. Origin produksi hanya bisa diakses lewat Cloudflare Tunnel.
4. Login dilindungi dua lapis: `loginLimiter` (5/menit per IP tepercaya+device) **dan** throttle per akun `server/middleware/account-login-throttle.ts` (10 gagal / 15 menit per username/email → 429 `ACCOUNT_LOGIN_THROTTLED`, tercatat `reason: locked`). Throttle per akun tidak bisa dimatikan dari settings.
5. Tidak ada password bawaan untuk akun baru (registrasi komunitas): kosong/lemah → password acak 14 karakter ditampilkan sekali ke pendaftar.
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

### DDoS concurrent connection limits

File: `server/middleware/ddos-protection.ts`.

- Counters are **in-flight requests** per IP and per device fingerprint (`UA|Accept-Language|Accept-Encoding|IP`), not TCP sockets.
- Defaults: `DDOS_MAX_CONCURRENT_PER_IP=120`, `DDOS_MAX_CONCURRENT_PER_DEVICE=64` (env override).
- Slot release must use `finish` + `close` with single-release guard — early returns after acquire must not leak counters.
- Sweep every 5 minutes clears stuck concurrent maps (do **not** use `Date.now() % interval === 0`).
- Lightweight SPA GETs (vapid-key, health, settings, home-images, berita, events/active-home, stats, organization/periods, store/public/settings) may skip **concurrent slot only**; tier rate limits still apply.
- Concurrent 503 is anti-abuse, **not** API openness. Access control remains in `api-protection.ts` (Origin/Referer/auth) + JWT/permission on routes.
- Symptom of false-positive: one browser profile hits 503 while another profile/device works — often many tabs/DevTools + leaked counters until restart/sweep.

### First-load SPA empty sections

- Cold home load fires many parallel `/api/*` GETs. Nginx `limit_conn` / `limit_req` too tight → intermittent 503 → React Query with `retry: false` showed empty UI.
- Client: retry transient 429/502/503/504; home sections must show error+retry, not “Belum ada data”.
- Nginx (repo `nginx-himatif-encoder.conf`): API `limit_conn` ~32, rate ~20r/s; SSE `/api/notifications/stream` uses separate `hmps_conn_sse` zone. **Reload nginx on server after deploy** (`nginx -t && systemctl reload nginx`) — auto-deploy app does not always reload nginx.

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

## Upload File Safety (daftar putih)

File "konten aktif" yang disajikan dari origin yang sama dengan situs dapat menjalankan JavaScript (stored XSS) atau berbahaya bagi server. Kebijakan ini harus berjalan tanpa campur tangan manusia.

**Prinsip: daftar putih, bukan daftar hitam.** Ekstensi harus ada di `EXTENSIONS` (`server/lib/upload-policy.ts`) DAN isi file (magic bytes) harus sesuai jenisnya. Yang tidak dikenal ditolak.

| Jenis | Ekstensi yang diizinkan | Cek isi |
|-------|-------------------------|---------|
| Gambar | jpg, jpeg, png, webp, gif, avif, heic, heif, bmp, tif, tiff | magic gambar; halaman gambar diproses ulang ke WebP |
| Video | mp4, m4v, mov, webm | `ftyp`/`moov`/EBML |
| Audio | mp3, m4a, aac, wav, ogg, oga, opus, flac | header |
| Dokumen | pdf, doc, docx, xls, xlsx, ppt, pptx, odt, ods, odp, rtf | `%PDF`, OLE, ZIP, `{\rtf` |
| Teks | txt, md, csv | tanpa byte NUL, bukan markup aktif |
| Arsip | zip, rar, 7z | magic arsip |
| Proyek | psd, blend, glb, pkt (Packet Tracer) | magic (pkt tanpa) |

**Tidak pernah diizinkan:** svg, html/xhtml, xml, js, php/phar, asp/jsp, executable, makro Office (docm/xlsm/pptm), `.htaccess`, ekstensi tak dikenal, file tanpa ekstensi. Ekstensi web/skrip dicek di SEMUA segmen nama (`a.php.jpg` ditolak).

Lapisan:

1. `uploadMiddleware` (`server/upload.ts`) membungkus multer dengan `guardMulter` (`server/lib/upload-safety.ts`) untuk semua rute upload staf. Penolakan: `400 UNSAFE_FILE_TYPE` dengan alasan dan daftar jenis yang diizinkan.
2. Upload chat publik hanya gambar (magic bytes), maks 10 MB, file sementara selalu dihapus.
3. Penyajian: `activeContentServeGuard` — file aktif lama disajikan sebagai unduhan + CSP sandbox; `.php`/`.phar` dan ekstensi di luar daftar (di `/uploads`) dipaksa `application/octet-stream`; `/uploads/_quarantine` tidak pernah disajikan.
4. Penyapu `server/services/upload-sweeper.ts` (saat server mulai, lalu tiap 24 jam): memindahkan file di luar daftar putih ke `uploads/_quarantine/swept/<tanggal>/` (BUKAN menghapus) dan menandai rekaman `FileUpload` (`infected`, `policy:blocked-file-type`). Folder karantina di-`.gitignore`. Aman dijalankan berulang; `UPLOAD_SWEEP_DRY_RUN=1` hanya mencatat. Hapus isi karantina secara manual bila sudah tidak perlu.
5. Menambah jenis file baru: tambah baris di `EXTENSIONS` + pemeriksa isi, uji, catat di tabel ini. Jangan membuat `multer()` baru tanpa `guardMulter`.

### Antivirus (ClamAV) — dimatikan secara default

ClamAV tidak mendeteksi ancaman yang relevan (SVG/XSS/XXE/penyamaran ekstensi bukan malware; produksi: 391 file clean, 0 infected) dan memakai ±1 GB RAM di VPS 2 GB (pernah memicu OOM saat build). `ops/deploy-server.sh` menonaktifkan `clamav-daemon` secara permanen (`HMPS_DISABLE_CLAMAV=0` untuk mempertahankannya). Aplikasi berjalan normal tanpa clamd (status file `skipped`); kode `file-scanner` tetap ada dan otomatis dipakai bila clamd dijalankan.

### Password bawaan

`server/lib/weak-passwords.ts` memuat password umum/bawaan (`admin123`, dll.). `hashPassword` menolaknya (error `WEAK_PASSWORD`, 400), dan login dengan password itu ditolak `403 PASSWORD_RESET_REQUIRED` — akun yang masih memakainya harus direset owner/admin (atau Lupa Password). Seed dev memakai `hashPassword(pw, { allowWeak: true })`.

### HTML rich-text (dua lapis, daftar putih)

1. **Server, saat simpan:** `server/utils/cms-html.ts` (`sanitizeCmsHtml`, pustaka `sanitize-html`). Dipakai otomatis untuk kunci body `CMS_HTML_KEYS` (`content`, `description`, `fullDescription`, `descriptionHtml`, `aboutUs`, `visionMission`, `history`, `rich_html`) oleh `sanitizeObjectStrings` dan `sanitizeRichHtml`. Hanya tag/atribut/CSS dari inventaris konten produksi yang diizinkan; script, iframe/object/embed, form/input, svg/math, `on*`, `id`/`name`, URL `javascript:`/`data:` selain gambar, dan CSS dengan `url()`/`expression` dibuang. Teks tanpa tag tidak diubah.
2. **Klien, saat render:** `client/src/lib/safe-html.ts` (`safeHtml`, DOMPurify). SEMUA `dangerouslySetInnerHTML` untuk konten CMS wajib memakainya; ini juga melindungi konten lama yang sudah tersimpan.
3. Field baru berisi HTML: tambahkan kuncinya ke `CMS_HTML_KEYS` dan bungkus render dengan `safeHtml`. Menambah tag/atribut: ubah `ALLOWED_TAGS`/`allowedAttributes` di kedua tempat dan uji dengan korpus payload (komentar XSS 3 Juli 2026 pernah tersimpan di DB sebagai teks; tidak dieksekusi karena komentar dirender sebagai teks React).
4. Tetap jangan melonggarkan CSP (`script-src-attr 'none'`). `stripUnsafeHtml` (penelusur atribut) tetap berlaku untuk semua string lain.
