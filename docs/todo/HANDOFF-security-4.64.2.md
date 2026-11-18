# HANDOFF — Security Patch v4.64.2 (HMPS / himatif-encoder.com)

> Prompt handoff untuk agent berikutnya. Ditulis 2026-11-19.
> Semua klaim di sini berasal dari eksekusi nyata, bukan rencana. Yang gagal ditulis apa adanya.

---

## 1. Konteks & otorisasi

- **Pemilik proyek:** Sulthan Adam Rahmadi (mahasiswa, pengurus HIMATIF Encoder UIN Malang).
- **Repo lokal:** `D:\Adam_Project\hmps_new`
- **Target live:** `https://himatif-encoder.com` (Express + React Vite + MongoDB, di belakang Cloudflare Tunnel)
- **Remote:** `origin` = `github.com/himatifencoder/web-himatif-encoder.git`
- **Otorisasi:** aplikasi milik user sendiri. Pentest dilakukan read-only atas permintaan eksplisit. Patch dikerjakan atas persetujuan eksplisit user.
- **Bahasa kerja:** Indonesia. User memakai istilah "publish berita", "attachment", "prodi", "owner", "dashboard".

## 2. Aturan wajib proyek (dari `AGENTS.md`)

Baca `AGENTS.md` di root repo SEBELUM mengubah apa pun. Poin yang paling sering dilanggar agent:

1. Setiap unit kerja selesai **wajib bump SemVer** + isi `docs/version/release/X.Y.Z.md` lengkap (jangan ringkas), update `docs/version/versions.md`, `docs/version/changelogs/CHANGELOG.md`, `package.json`, `docs/openapi.json` `info.version`.
2. **Dilarang** menulis nama model AI (Claude/Cursor/Copilot) sebagai author/contributor di README, AGENTS, release notes, atau trailer commit.
3. **Dilarang** commit `.env`, credential JSON, backup DB, `node_modules/`, `dist/`.
4. Endpoint baru wajib: validasi input (Zod), auth/permission middleware, response format standar, dan update docs.
5. Jalankan `npm run check` (tsc) setelah perubahan; `npm run build` sebelum merge.
6. Middleware security didokumentasikan di `docs/SOP/12-runtime-security-operations.md`.
7. Klien IP **wajib** lewat `getTrustedClientIp` (`server/lib/client-ip.ts`) — jangan baca hop pertama `X-Forwarded-For` (pernah jadi bypass rate-limit Sep 2026).

## 3. State git saat handoff

```
branch aktif : security/patches-4.64.2
HEAD         : 794be71
main         : 4ea43b0 (v4.64.1) — TIDAK disentuh
working tree : clean
status push  : BELUM DI-PUSH. 11 commit hanya ada di lokal.
               origin/main..HEAD = 0 behind / 11 ahead
```

### Daftar commit (lama → baru)

```
f22c77f docs(security): plan patch v4.64.2 hasil pentest read-only
65c09ba fix(auth): anti-enumerasi email di forgot-password + test route non-produksi
897e5c6 fix(auth): role owner terkunci di backend, hierarki role dua arah
393325d fix(security): tutup SSRF pada /api/prodi/preview
407992e fix(chat): sesi bertanda tangan + anggaran harian LLM
92dfb7d fix(gdrive): batasi proxy Drive ke file yang dipakai konten publik
b32d897 fix(otp): pepper pada hash OTP dan generator bebas bias
c4387d9 fix(security): allowlist api-protection jadi exact/prefix/pattern
6435dcf fix(security): larang loopback/internal pada proxy preview Drive
6e1d271 chore(release): v4.64.2 — dokumen rilis, changelog, versi, SOP
794be71 docs(security): status eksekusi + hasil gerbang regresi v4.64.2
```

### Rollback

```bash
cd D:/Adam_Project/hmps_new
git checkout main                      # batal total, kembali v4.64.1 bersih
git checkout main -- <satu-file>       # cabut satu patch saja
git diff main..HEAD --stat             # lihat semua perubahan
```

## 4. Temuan pentest & apa yang sudah diperbaiki

| # | Temuan | Severity | Status | File |
|---|--------|----------|--------|------|
| 1 | Chat gate bypass: `Origin`+`Sec-Fetch-Site` palsu → LLM berbayar bisa dipicu siapa pun | Critical (biaya) | **fixed** | `server/routes/chat.ts`, `server/middleware/llm-budget.ts` |
| 2 | SSRF `/api/prodi/preview?url=` bisa ke `127.0.0.1:5000` | High | **fixed** | `server/lib/server-fetch-guard.ts`, `server/routes.ts` |
| 3 | Proxy Google Drive pakai service account tanpa batasan fileId | High | **fixed** | `server/event-attachments.ts`, `server/routes.ts` |
| 4 | Role `owner` bisa diturunkan siapa pun; satu handler tanpa cek hierarki sama sekali | High | **fixed** | `server/auth.ts`, `server/routes.ts` |
| 5 | Enumerasi email di forgot-password (404 vs 200) | Medium | **fixed** | `server/routes.ts`, `client/src/components/auth/forgot-password.tsx` |
| 6 | `api-protection` pakai `path.startsWith()` → sub-route baru mewarisi bypass | Medium | **fixed** | `server/middleware/api-protection.ts` |
| 7 | Hash OTP `sha256(6 digit)` tanpa pepper (bisa diprecompute) | Low | **fixed** | `server/services/otp.ts` |
| 8 | `/api/test/protection` bocor di produksi | Low | **fixed** | `server/routes.ts` |
| 9 | `/api/auth/login-targets` & `/api/store/public/settings` bocor slug/nama admin | Info | **tidak diperbaiki** (diterima) | — |
| 10 | CSP longgar (`unsafe-inline`, `img-src https:`, 50+ `frame-src`) | Info | **tidak diperbaiki** (diterima) | — |

### Detail perubahan kunci

**Chat gate (temuan 1)** — cookie `userId` dulu UUID polos, sekarang `<uuid>.<hmac-sha256>`:
```ts
// server/routes/chat.ts
function chatSessionSecret() {
  return process.env.CHAT_SESSION_SECRET?.trim()
    || `chat-session:${process.env.JWT_SECRET || 'hmti-secret-key-change-in-production'}`;
}
export function readChatSessionUserId(req): string | null  // verifikasi timingSafeEqual
```
- `POST /api/chat/message` menolak tanpa sesi sah → `403 CHAT_SESSION_REQUIRED`
- `GET /api/chat/all`, `POST /api/chat/new`, `GET /api/chat/history` menerbitkan cookie (UX tamu tidak berubah)
- `server/middleware/llm-budget.ts`: `LLM_DAILY_PER_IP` (default 40), `LLM_DAILY_GLOBAL` (default 2000), reset tengah malam WIB, `alwaysOn`.

**Role owner (temuan 4)** — `server/auth.ts` menambah `roleLevelOf`, `isTopRole`, `assertTopRoleImmutable`, `buildRoleLevelMap`, `TOP_ROLE_NAME`, `TOP_ROLE_LEVEL`. Berlaku di:
- `PUT /api/users/:id/role` jalur `authorize([...])` — sebelumnya **tanpa** cek hierarki
- `PUT /api/users/:id/role` jalur `requirePermission('roles.assign')`
- `PUT /api/roles/:id`

**SSRF (temuan 2)** — `guardServerFetchUrl()` + `safeServerFetch()`: allowlist host, tolak IP literal & hostname tanpa titik, `redirect:'manual'` + validasi tiap hop. Allowlist via `SERVER_FETCH_ALLOWED_HOSTS`.

**Drive (temuan 3)** — `isDriveFileIdReferencedByPublicContent(models, fileId)` memeriksa berita/event published + library. `media-url` kini pakai `authenticateOptional`.

## 5. Hasil verifikasi yang SUDAH dilakukan (bukti nyata)

Server lokal: `npx tsx server/index.ts` (port 5000, `NODE_ENV=development`).

| Uji | Hasil |
|-----|-------|
| `npm run check` (tsc) | bersih, exit 0 |
| `npm run build` | sukses 3×, exit 0 (client 416 kB + server 2.2 mb) |
| 11 halaman publik (`/`, `/berita`, `/events`, `/library`, `/prodi`, `/profil`, `/kelembagaan`, `/toko`, `/login`, `/dashboard`, `/ontakiuinmalang`) | **200 semua, 0 gagal** |
| 6 API publik (`/api/info`, `/stats`, `/berita`, `/store/public/settings`, `/communities`, `/events/published`) | **200 semua** |
| 3 endpoint ber-auth (`/auth/me`, `/users`, `/settings/middleware`) | **401 semua** |
| SSRF `127.0.0.1:5000`, `localhost`, `169.254.169.254`, `127.1` | **400 semua** |
| SSRF host sah `informatika.uin-malang.ac.id` | **200** (tidak diblokir) |
| Drive fileId arbitrer | **404** |
| Chat tanpa sesi | **403** |
| Chat dengan sesi bertanda tangan | 200, model membalas |
| Budget LLM `LLM_DAILY_PER_IP=3` | pesan 1–3 → 200, pesan 4 → **429** |
| Forgot-password email tak terdaftar | **200** generik (dulu 404) |
| Komentar uji + hapus | 201 → deleted, list kembali `[]` |
| Error di log server | **0** TypeError/ReferenceError |

### Jejak di database produksi

Uji lokal membaca `.env` proyek → menyentuh DB `himatifwebmain` (produksi). Yang terjadi:
- 4 sesi chat anonim (cookie UUID, auto-expire 7 hari)
- 1 komentar `probe-4080-verify` di berita `6ae7bdc5fe2d5d6daa51d082` → **sudah dihapus**, terverifikasi list kosong
- 1 email OTP terkirim ke `sultanadamr@gmail.com` (sudah expired)
- 1 OTP challenge dengan 1 attempt gagal (expired sendiri)

**Tidak ada konten, user, role, atau setting yang diubah.**

## 6. Yang BELUM selesai — ini tugas Anda

### 6.1 Test script regresi publish (SEDANG DIKERJAKAN, BELUM SELESAI)

File: `scripts/verify-publish-regression.ts` (belum di-commit, ada di working tree).

Jalankan:
```bash
cd D:/Adam_Project/hmps_new && npx tsx scripts/verify-publish-regression.ts
```

Hasil run pertama: **12 pass / 2 fail**. Keduanya sudah didiagnosis:

1. **FAIL "link Drive folder ditolak"** — skrip saya salah berasumsi. `normalizeBeritaAttachmentArray` **tidak** menolak folder pada percabangan `source` eksplisit; folder hanya ditolak bila `parseDriveFileId` mengembalikan id **dan** `isDriveFolderUrl` true. Perilaku ini **tidak berubah oleh patch** — asumsi tes yang keliru. Sudah saya perbaiki tesnya agar menguji "tidak exception" bukan "harus ditolak".

2. **FAIL "sampel attachment gdrive ditemukan — 0 dokumen"** — skrip memakai `db.collection('beritas')`, padahal nama koleksi eksplisit di schema adalah **`berita`**:
   ```ts
   // db/mongodb.ts:2107
   mongoose.model('Berita', beritaSchema, 'berita');
   ```
   Sudah saya perbaiki di file (belum dijalankan ulang).

**Langkah Anda:** jalankan ulang script, pastikan **14/14 pass**, lalu commit.

Data produksi yang relevan (terverifikasi): `berita` punya record, `events` total=42 dengan 39 punya attachment, `libraries` total=17.

### 6.2 Verifikasi role owner/admin — TIDAK BISA diselesaikan tanpa kredensial

Ini **satu-satunya bagian yang benar-benar belum terbukti end-to-end**. Logika terverifikasi lewat typecheck + pembacaan kode, tapi belum ada request nyata.

Uji manual yang harus dilakukan (butuh login staf):

| Skenario | Ekspektasi |
|---|---|
| Login **owner** → Profil → turunkan diri sendiri ke admin | **403** + pesan "Role pemilik (owner / level tertinggi) tidak dapat diubah…" |
| Login **admin** → Profil → turunkan staf jabatan lebih rendah | **200 / berhasil** (ini yang user mau tetap jalan) |
| Login **admin** → turunkan sesama admin | **403** |
| Login **admin** → naikkan diri jadi owner | **403** |
| `PUT /api/roles/:id` pada role owner | **403** |

Bila ada yang gagal, **cabut patch role saja**:
```bash
git checkout main -- server/auth.ts
git revert 897e5c6
```

### 6.3 Publish berita/event baru — belum diuji end-to-end

User secara spesifik bertanya: *"misal publish event atau berita baru aman kan ya, atau misal attachment dari prodi juga aman kalau ada yang baru"*.

Yang sudah aman secara analisis:
- `/api/prodi/upload/photo/*` memakai `uploadMiddleware` + `validateFileUpload` — **tidak disentuh patch**. Aman.
- Normalizer attachment (`normalizeEventAttachmentArray`, `normalizeBeritaAttachmentArray`) — **tidak diubah** patch. Aman.
- `POST /api/berita`, `POST /api/events` — tidak disentuh patch.
- Drive `media-url` untuk staf login: pemeriksaan hanya aktif untuk **tamu** → dashboard tetap bebas.

Yang **belum dibuktikan:** publish berita baru dengan attachment Drive, lalu buka di publik dan cek videanya masih jalan. Dan upload foto prodi baru. **Lakukan di browser dengan akun staf**, lalu hapus draft ujinya.

### 6.4 Push & deploy — belum dilakukan

```bash
cd D:/Adam_Project/hmps_new
git push -u origin security/patches-4.64.2   # branch, bukan main
# lalu buka PR ke main, review, merge
```

Deploy produksi = `ops/deploy-server.sh` (lihat SOP 07). **Jangan deploy tanpa persetujuan user.**

## 7. Blocker lingkungan yang akan Anda hadapi

1. **`npm start` GAGAL di mesin ini**: `Cannot find module '../build/Release/canvas.node'` — binary `canvas` tidak ter-compile untuk Node v24. **Pakai `npx tsx server/index.ts`**, bukan `node dist/index.js`.
2. **Port hardcoded 5000** di `server/index.ts`. `process.env.PORT` diabaikan. Pastikan 5000 bebas:
   ```bash
   netstat -ano | grep ":5000.*LISTENING"
   powershell -NoProfile -Command "Stop-Process -Id <PID> -Force"
   ```
3. **DNS-layer protection memblokir `Host: 127.0.0.1` dan `Host: localhost`**. Saat menguji via curl, **wajib kirim `-H "Host: himatif-encoder.com"`**.
4. **`/api/test/protection` balas 200 di development** — itu sesuai desain (`NODE_ENV !== 'production'`). Jangan anggap bug.
5. **`/api/comments/count?targetId=x` → 500** — bug lama (BSON cast, `x` bukan ObjectId). Bukan dari patch. Jangan diperbaiki diam-diam; laporkan dulu.
6. **Node v24.22.1**. `Map.entries()` iteration kena error TS2802 (target lib lama) — pakai `.forEach()`.
7. **File `server/routes.ts` ~12.400 baris, CRLF**. `patch` tool sering gagal match. Gunakan penggantian biner Python (`p.read_bytes()`, cari bytes dengan `\r\n`) atau `git checkout --` lalu tulis ulang.
8. **`.gitignore` memuat `AGENTS.md` dan `scripts/`** — file yang Anda buat di sana mungkin tidak ter-track. Cek `git status` setelah menulis script.

## 8. Instruksi kerja untuk agent berikutnya

1. **Baca dulu:** `AGENTS.md`, `docs/SOP/12-runtime-security-operations.md`, `docs/version/release/4.64.2.md`, `docs/todo/security-patches-4.64.2.md`.
2. **Jangan ubah `main`.** Semua kerja di branch `security/patches-4.64.2` atau branch turunannya.
3. **Selesaikan 6.1** (jalankan script sampai 14/14 pass, commit).
4. **Minta user** menyelesaikan 6.2 dan 6.3 di browser (Anda tidak punya kredensial staf).
5. **Jangan push / deploy** tanpa perintah eksplisit user.
6. Setelah semua hijau: bump tetap `4.64.2` (sudah di-bump), cukup update `docs/version/release/4.64.2.md` bagian Verification dengan hasil akhir.
7. Gaya komunikasi yang user harapkan: **konkret, jujur soal yang gagal, tanpa klaim selesai palsu**. Kalau ada yang tidak bisa diverifikasi, katakan apa adanya dan sebutkan langkah verifikasinya.

## 9. Ringkas satu paragraf

Patch keamanan v4.64.2 sudah selesai ditulis di branch terpisah (11 commit, belum di-push), `npm run check` dan `npm run build` bersih, 20 endpoint/halaman utama lulus smoke test, dan 7 dari 10 temuan pentest tertutup serta terbukti lewat request nyata ke server lokal. Yang tersisa: satu script regresi publish yang perlu dijalankan ulang setelah perbaikan nama koleksi (`berita`, bukan `beritas`), verifikasi role owner/admin yang butuh kredensial staf, uji publish berita/event baru di browser, lalu push branch dan PR. `main` masih utuh di v4.64.1 dan rollback cukup `git checkout main`.
