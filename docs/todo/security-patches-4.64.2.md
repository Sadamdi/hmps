# Plan — Security Patches v4.64.2 (PATCH)

> Hasil pentest read-only 2026-11-18. Branch: `security/patches-4.64.2`
> Base commit: `4ea43b0` (v4.64.1)
> Aturan: **1 temuan = 1 patch terpisah**, `npm run check` setelah tiap patch, smoke test 12 halaman sebelum merge.

## Gerbang regresi (WAJIB hijau sebelum merge)

### Halaman publik
| Route | Kriteria lulus |
|-------|-----------------|
| `/` | hero + berita + event + galeri tampil (bukan "Belum ada data") |
| `/berita` | list berita terisi |
| `/berita/<slug>` | konten + komentar terbaca |
| `/events` | list event terisi |
| `/library` | list galeri terisi |
| `/prodi` | **preview dokumen masih bisa dimuat** (paling kena SSRF fix) |
| `/profil` | profil himpunan tampil |
| `/kelembagaan` | struktur pengurus tampil |
| `/toko` | produk + settings tampil |
| `/login` | form muncul |
| `/dashboard` | redirect ke login, bukan 500 |
| `/ontakiuinmalang` | tenant shell tampil |

### API publik tanpa auth (harus tetap 200)
- `GET /api/stats`
- `GET /api/berita?limit=1`
- `GET /api/store/public/settings`
- `GET /api/communities`
- `GET /api/info`

### Gate teknis
- `npm run check` (tsc) bersih
- `GET /api/auth/me` tanpa cookie → 401 (bukan 403, bukan 500)

---

## P0-A — Chat gate: lapis bukti yang tidak bisa dipalsukan

**Masalah:** `requireTrustedChatOrigin` + safety-net `api-protection.ts` sama-sama membaca `Origin` / `Sec-Fetch-Site` yang dikirim klien. Curl dengan 3 header palsu → 200, LLM jalan.

**Perubahan:**
- `server/routes/chat.ts`
  - Mint cookie `chatSession` (UUID + HMAC `NEXTAUTH`-style, HttpOnly, SameSite=Lax, Secure di produksi) pada `GET /api/chat/all` / `POST /api/chat/new`.
  - `POST /api/chat/message` wajib: signature cookie valid **ATAU** `authToken` JWT valid (staf login).
  - Tetap pertahankan `requireTrustedChatOrigin` sebagai lapis kedua, bukan satu-satunya.
- Signature pakai `CHAT_SESSION_SECRET` (fallback `JWT_SECRET` + suffix — tidak menambah env baru wajib).

**Verifikasi:**
- Browser normal kirim pesan → dibalas (cookie ada karena buka halaman chat dulu)
- Curl + header palsu tanpa cookie → 403
- Curl + cookie hasil `/api/chat/all` → 200 (itu perilaku sah tamu)

**Risiko:** 🟡 Sedang. Kalau user buka chat langsung tanpa GET pertama, cookie belum ada → bisa 403. Mitigasi: `POST /api/chat/message` **menerbitkan** cookie bila belum ada (first-message mint), jadi UX tidak berubah.

---

## P0-B — Cap biaya LLM harian

**Masalah:** Bypass chat = tagihan API keys Gemini/OpenAI. Sekarang tidak ada cap per hari.

**Perubahan:**
- `server/middleware/public-rate-limit.ts` (atau file baru `server/middleware/llm-budget.ts`)
  - Counter harian per IP (default 40 pesan/hari) + counter global harian (default 2000).
  - Balas `429 {"error":{"code":"LLM_DAILY_QUOTA_EXCEEDED"}}` dengan `retryAfterSeconds` sampai tengah malam WIB.
  - `alwaysOn: true` — tidak ikut mati saat toggle dashboard dimatikan.
- Env opsional: `LLM_DAILY_PER_IP`, `LLM_DAILY_GLOBAL`.

**Verifikasi:** loop pesan, pastikan 429 muncul setelah limit; 3 pesan pertama tetap jalan.

**Risiko:** 🟢 Rendah.

---

## P1-A — SSRF `/api/prodi/preview`

**Masalah:** `fetch(parsed.toString(), { redirect: 'follow' })` tanpa allowlist host. Terbukti bisa nyentuh `127.0.0.1:5000`.

**Perubahan:** `server/routes.ts` — handler `/api/prodi/preview`
- `redirect: 'manual'` (jangan ikuti redirect)
- Allowlist host dari `PRODI_PREVIEW_ALLOWED_HOSTS` (default: `drive.google.com`, `docs.google.com`, `informatika.uin-malang.ac.id`, `uin-malang.ac.id`, `himatif-encoder.com`)
- Tolak IP literal & hostname tanpa titik (mencegah `localhost`, `127.1`, `[::1]`)
- Batas ukuran body: 15 MB
- Hanya `http:`/`https:` (sudah ada)

**Verifikasi:** `/prodi` preview dokumen masih jalan; `?url=http://127.0.0.1:5000/` → 400.

**Risiko:** 🟠 Tinggi — kalau prodi menyimpan URL dokumen dari host lain, preview mati.
**Mitigasi:** allowlist lewat env, dan kalau perlu tambah host tinggal isi env. Log alasan penolakan agar mudah didiagnosis.

---

## P1-B — Auth pada `/api/gdrive/*`

**Masalah:** `/api/gdrive/stream/:fileId` dan `/api/gdrive/media-url` memakai service account tanpa auth. Siapa pun dengan fileId memakai kuota & membaca file.

**Perubahan:** `server/routes.ts`
- `/api/gdrive/media-url` → `authenticateOptional` + batasi `fileId` pada yang direferensikan konten publik (cek `Berita`/`Event`/`Library`), atau tandatangan token berumur pendek.
- `/api/gdrive/stream/:fileId` → verifikasi `fileId` termasuk lampiran publik sebelum streaming.

**Verifikasi:** buka berita dengan video Drive → masih bisa diputar.
**Risiko:** 🟠 Tinggi — video Drive di berita bisa hilang kalau pemeriksaan terlalu ketat.
**Mitigasi:** mulai dengan pemeriksaan "fileId dikenal di salah satu koleksi konten" — longgar tapi menutup ID arbitrer. Kalau ada yang rusak, rollback patch ini saja.

---

## P2-A — `api-protection`: exact match + method

**Masalah:** `ALLOWED_API_ROUTES.some(r => path.startsWith(r))`. `/api/settings` mencakup seluruh sub-path, termasuk `PUT /api/settings/middleware`. Satu route baru di bawah prefix = warisan bypass.

**Perubahan:** `server/middleware/api-protection.ts`
- Struktur allowlist jadi `{ pattern: RegExp, methods: string[] }`
- Exact path atau prefix yang diakhiri `/` saja
- Pertahankan perilaku lama untuk semua route yang sekarang lolos (diuji dengan snapshot)

**Verifikasi:** 12 halaman + 5 API publik. `GET /api/auth/me` tanpa cookie → 401.
**Risiko:** 🔴 Sangat tinggi — seluruh situs bisa 403.
**Mitigasi:** patch terakhir sebelum merge; siapkan rollback satu file.

---

## P2-B — OTP pepper

**Masalah:** `hashCode()` = `sha256(code)` tanpa salt. 6 digit = 1 juta kemungkinan, bisa di-precompute.

**Perubahan:** `server/services/otp.ts`
- `crypto.createHmac('sha256', OTP_PEPPER).update(code)`
- `OTP_PEPPER` fallback ke `GUEST_KEY_PEPPER` bila belum di-set (tidak menambah env wajib)
- Ganti `bytes[i] % 10` → `crypto.randomInt(0, 10)` (hilangkan bias modular)

**Verifikasi:** mint OTP, verifikasi dengan kode salah → tetap "salah"; verifikasi kode benar → sukses.
**Risiko:** 🟢 Rendah. Challenge OTP lama (belum diverifikasi) jadi tidak valid — bisa diterima, TTL-nya 10 menit.

---

## P3 — Information disclosure

**Perubahan:** `server/routes.ts`
1. `/api/test/protection` → hanya aktif bila `NODE_ENV !== 'production'`
2. `/api/auth/forgot-password/request-otp` → selalu `200` dengan pesan generik; status 404 hanya untuk request dengan header debug
3. `/api/auth/login-targets` → tetap publik tapi tanpa `_id`/deskripsi internal (slug + name saja, sudah begitu)
4. `/api/store/public/settings` → hapus `waAdmins[].phone` bila ada; sisakan `name`

**Verifikasi:** forgot-password email palsu → 200 generik; email valid → 200 generik + email terkirim.
**Risiko:** 🟡 Sedang — UX form "email tidak terdaftar" hilang (itu memang tujuannya).

---

## Dokumentasi wajib setelah selesai (AGENTS.md)

- `docs/version/release/4.64.2.md` dari `version-template.md` (isi lengkap)
- Update `docs/version/versions.md` → Current `4.64.2`
- Tambah section di `docs/version/changelogs/CHANGELOG.md`
- Sync `package.json` version + `docs/openapi.json` `info.version`
- Update `docs/SOP/12-runtime-security-operations.md` untuk middleware baru
- Update `docs/api/endpoints.md` bila ada perubahan kontrak

## Rollback

```bash
cd D:/Adam_Project/hmps_new
git checkout main                      # balik ke v4.64.1 bersih
# atau per-patch:
git checkout main -- server/routes/chat.ts
```
