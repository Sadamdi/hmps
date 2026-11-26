#  Feature: Karya Mahasiswa TI (portofolio, akun mahasiswa, shortlink)

**Author**: HMPS Project Team  
**Created**: 2026-11-26  
**Status**: Active  
**Contract Confidence**: Verified from code  
**Category**: 13-karya-mahasiswa  
**Tenant-Aware**: No — situs utama saja (blok beranda & navbar `karya` disaring dari tenant; slug `karya`/`go` dicadangkan)  
**Permission Scope**: Public / Mahasiswa (akun terpisah) / Admin (`karya.view`, `karya.manage`)  
**Since version**: 4.65.0  
**Last documented version**: 4.66.1  

---

## Deskripsi

Mahasiswa Teknik Informatika UIN Malang membuat akun sendiri (Google kampus atau email + password), mengisi profil portofolio, menambah karya (dari repo GitHub/GitLab/Bitbucket publik, link YouTube/Google Drive/demo, atau unggahan gambar/video), mengatur karya publik/privat, dan membuat shortlink `/go/:slug`. Karya publik masuk antrean review pengurus (mode manual, default) atau langsung tayang (mode otomatis). Karya yang tayang tampil di beranda (section "Karya Mahasiswa TI"), `/karya`, profil `/karya/mahasiswa/:username`, dan sitemap Google.

Sumber audit:

| Lapisan | File |
|---------|------|
| Kontrak bersama | `shared/karya.ts` (aturan email/NIM, batas media, kategori, parser URL repo/YouTube/Drive, slug, tag) |
| Model | `server/models/karya.ts` (`KaryaStudent`, `KaryaStudentSession`, `KaryaProject`, `KaryaShortlink`, `KaryaSettings`) |
| Auth mahasiswa | `server/services/karya-auth.ts` |
| Repo & Drive | `server/services/karya-repo.ts` |
| Route | `server/routes/karya.ts` (mount `/api/karya` di `server/routes.ts`) |
| Upload | `server/upload.ts` → `karyaMediaMiddleware`, `uploadKaryaMedia`, `deleteKaryaMediaFile` |
| SSR/SEO/shortlink | `server/index.ts` → `/go/:slug`, `/karya/:slug`, `/karya/mahasiswa/:username`, sitemap |
| Permission | `server/mongo-storage.ts` (seed `karya.view`/`karya.manage`; role `chair`, `vice_chair`, `medinfo`), `server/division-permissions.ts` (divisi Medinfo) |
| Frontend publik | `client/src/pages/karya/index.tsx`, `[slug].tsx`, `mahasiswa/[username].tsx`, `client/src/components/public/karya-section.tsx`, `client/src/components/karya/*` |
| Frontend mahasiswa | `client/src/pages/karya/masuk.tsx`, `saya.tsx`, `editor.tsx`, `client/src/hooks/use-karya.ts` |
| Dashboard admin | `client/src/pages/dashboard/karya.tsx` (menu sidebar "Karya Mahasiswa") |

---

## User Stories

1. Sebagai mahasiswa TI (angkatan berapa pun), saya ingin masuk dengan Google kampus atau email `NIM@student.uin-malang.ac.id`, agar bisa memajang karya.
2. Sebagai mahasiswa, saya ingin menempel URL repo publik dan otomatis mendapat judul, deskripsi, topik, dan demo.
3. Sebagai mahasiswa, saya ingin memilih karya publik (diindeks Google) atau privat (hanya saya).
4. Sebagai pengunjung, saya ingin mencari karya berdasarkan kata kunci, tag, kategori, dan angkatan.
5. Sebagai pengurus (owner/ketua/wakil/Medinfo), saya ingin mereview, menyembunyikan, menghapus karya, serta suspend/blokir akun.
6. Sebagai owner, saya ingin membuat akun mahasiswa (disarankan email UIN; email lain dengan pengecualian eksplisit).

---

## UI / User Flow

| Item | Value |
|------|-------|
| Publik | `/` section `#karya`, `/karya`, `/karya/:slug`, `/karya/mahasiswa/:username`, `/go/:slug` |
| Mahasiswa | `/karya/masuk`, `/karya/daftar`, `/karya/saya` (tab Karya saya / Profil / Shortlink / Akun & keamanan), `/karya/saya/baru`, `/karya/saya/edit/:id` |
| Admin | `/dashboard/karya` (tab Karya / Akun mahasiswa / Shortlink / Pengaturan) |
| Pengaturan tampilan beranda | Settings → Beranda: blok `karya` (sembunyikan/urutkan) + item navbar `karya` "Karya TI" (sembunyikan/gabung grup) |

Alur status karya:

```text
simpan draf / privat ─────────────► draft (Privat)
kirim + publik + reviewMode=manual ─► pending ─(admin approve)─► approved (tayang)
kirim + publik + reviewMode=auto ───► approved
admin "Minta revisi" ───────────────► revision (catatan wajib) → mahasiswa edit → pending
admin "Suspend" ────────────────────► hidden (catatan wajib; mahasiswa tetap bisa edit, status tetap hidden)
admin "Pulihkan" ───────────────────► pending (publik) / draft (privat)
edit karya approved lalu kirim (manual) → pending sampai disetujui ulang
```

---

## Pembaruan 4.66.0 (batch 2)

### OTP + link sekali pakai (semua alur OTP situs)
- Setiap email OTP (pengurus, pembeli, mahasiswa, backup, komunitas) berisi **kode 6 digit + link** `/verifikasi?c=<challengeId>&t=<token>`. Kode dan token di-HMAC (pepper `OTP_PEPPER`/turunan), dicocokkan waktu-konstan, dan dikonsumsi **atomik**: memakai salah satu → keduanya hangus; dua permintaan serentak → hanya satu lolos. Maks 5 percobaan, limit per email/IP dan cooldown 60 dtk tetap.
- Masa berlaku: aktivasi akun 24 jam; lainnya 10 menit. Ditulis di email (jam WIB) dan di halaman verifikasi.
- `/verifikasi` tidak mengeksekusi apa pun saat dibuka (aman dari pemindai link email); `GET /api/verify/info` hanya mengembalikan tujuan, jenis akun, email tersamar, dan status.
- Alur yang diselesaikan langsung di `/verifikasi`: aktivasi & reset password mahasiswa/pembeli, konfirmasi ganti password mahasiswa, hapus akun (butuh sesi), ganti email pembeli (butuh sesi), lupa password pengurus.
- Alur yang butuh form asal (ganti password/email pengurus, restore backup, hapus komunitas, tautan pembeli↔pengurus): link mengisi kode otomatis di tab asal (`client/src/lib/otp-link-prefill.ts`, localStorage + event `storage`, 15 menit, sekali pakai).
- Template email seragam `server/services/email-layout.ts` (header brand, lencana tujuan, kode, tombol + tautan cadangan, tabel detail: akun, nama, jenis akun, tujuan, waktu permintaan, asal permintaan IP tersamar + lokasi, berlaku sampai; peringatan keamanan; versi teks). Dipakai juga untuk email balasan feedback/bug (isi kini di-escape).

### Aktivasi & kunci privat
- **Kirim ulang verifikasi (4.66.1):** link/kode tidak valid, kedaluwarsa, dipakai, terkunci, atau sudah diganti → tombol "Kirim ulang verifikasi" di `/verifikasi` (pilih Mahasiswa/Pembeli bila jenis tidak diketahui) memanggil `POST /api/karya/auth/activation/resend-public` atau `POST /api/buyer/register/resend` (jawaban generik). Login toko yang tertahan `EMAIL_UNVERIFIED` juga menampilkan tombol ini dan langsung membuka isian kode. Setiap permintaan kode baru membatalkan kode & link lama (tujuan + email sama; `supersededAt`, state `replaced`).
- Daftar email → langsung masuk dengan `emailVerified: false` + email aktivasi. Google = otomatis terverifikasi (sesi lama yang dibuat sebelum verifikasi dicabut).
- Belum aktivasi: karya hanya Privat (`403 EMAIL_NOT_VERIFIED` di server), profil tidak publik, shortlink ditolak. Banner aktivasi + kirim ulang di Ruang Mahasiswa.

### Ganti password & perangkat
- Ganti password 2 langkah: password lama + baru → kode/link ke email (password baru disimpan sementara sebagai bcrypt di challenge) → konfirmasi → semua sesi dicabut.
- Daftar perangkat: browser, OS, jenis, lokasi, IP tersamar, waktu masuk & aktif terakhir, keluarkan per perangkat / semua lainnya.

### Profil & tampil publik
- Profil tampil bila Publik + aktif + terverifikasi, **tanpa syarat karya**; kosong → `noindex` sampai ada karya tayang atau profil terisi (nama + headline / bio ≥ 40 karakter).
- Username default dari nama (bukan NIM); ganti username → username lama dialihkan 301 (maks 5 riwayat, tidak bisa diambil akun lain). Dashboard menyarankan ganti bila username masih NIM.
- Profil privat: karya publik tetap tampil, tanpa link ke profil.
- Pratinjau pemilik: `/karya/saya/pratinjau/:id` (tampilan publik untuk karya privat/pending).
- Cache daftar publik 10 dtk + stale-while-revalidate 30 dtk.

### Karya
- Wajib: Judul + Kategori; karya publik wajib punya minimal satu isi (ringkasan/deskripsi/media/repo/link) → `CONTENT_REQUIRED`. Label wajib/opsional di form.
- Deskripsi rich text (TinyMCE yang sama dengan berita, mengikuti tema terang/gelap), disanitasi `sanitizeCmsHtml`, gambar lewat `POST /me/content-image` (ikut kuota). Deskripsi lama (teks) tetap tampil.
- Repo: GitHub, GitLab, Bitbucket, **Codeberg**; ikon & label per platform; lisensi; tombol "Lihat selengkapnya di …"; gambar pratinjau repo.
- Tag: input chip + saran dari tag yang ada; halaman `/karya/tag/:tag` (SSR `CollectionPage`, sitemap bila ≥ 2 karya).
- Karya terkait otomatis: skor 3×tag sama + 2×kategori + 2×bahasa repo + 1×pembuat + 1×angkatan + kesegaran + 0,5×unggulan; maks 2 per pembuat; cache 10 menit; karya terkait manual tetap didahulukan.
- Sampul: unggahan dipilih → gambar repo → thumbnail YouTube → **sampul template otomatis** PNG 1200×630 (`/api/karya/cover/:slug?theme=dark|light`, `server/services/karya-cover.ts`), juga dipakai og:image.

### Login satu pintu
- `/login` untuk pengurus, mahasiswa TI, dan pembeli. Email+password: `POST /api/karya/auth/password-targets` (tanpa sesi) → mahasiswa/pembeli/keduanya (pilih) → bila tidak cocok, login pengurus seperti biasa. Google: `/api/auth/google/identify` kini juga `isStudent`/`studentEligible`; lebih dari satu peran → dialog "Masuk sebagai: Mahasiswa TI / Pengurus / Pembeli".
- Sesi tetap terpisah (3 cookie, 3 kunci JWT) → tidak bentrok; URL dashboard tidak dipindah (`/dashboard`, `/karya/saya`, `/toko/akun`).
- `/daftar`: pilih Mahasiswa TI atau Pembeli. Menu profil mahasiswa di kanan atas navbar (Karya saya, Profil publik, Edit profil, Akun & keamanan, Akun toko bila ada, Keluar).

## Aturan akses & keamanan

- **Kelayakan daftar mandiri**: domain `student.uin-malang.ac.id`, local-part 12 digit, digit 3–6 ∈ `KARYA_PRODI_CODES` (default `0605`). Ditolak → `403 NOT_TI_STUDENT` dengan pesan "hanya mahasiswa TI … hubungi administrator (himatif.encoder@gmail.com)". Login Google memakai petunjuk `hd=student.uin-malang.ac.id`, validasi tetap di server (email dari token Google, bukan dari client).
- **Akun buatan admin**: `POST /admin/students`; email non-UIN wajib `allowNonUin: true`, akun tidak mendapat lencana `verifiedTi`. Akun dibuat tanpa password; mahasiswa mengatur lewat OTP email atau Google.
- **Sesi**: cookie httpOnly `studentToken` 7 hari, JWT kunci turunan `JWT_SECRET::student`, `aud: student`; sesi dicatat (`KaryaStudentSession`), maks 10 aktif, dicabut saat logout/ganti password/suspend/blokir; perubahan browser/OS mencabut sesi. Token mahasiswa tidak pernah lolos `authenticate` pengurus atau `authenticateBuyer`.
- **Suspend / blokir**: `suspendedUntil` (1–365 hari) atau `status=blocked`; login ditolak dengan alasan; karya akun itu hilang dari publik, profil 404, shortlink mati.
- **Throttle login**: per akun+IP dan per akun lintas IP (sama dengan login pembeli/pengurus); log `LoginAttempt.scope = 'student'`.
- **Kepemilikan**: semua `/me/*` memfilter `studentId` dari sesi; ID di path divalidasi ObjectId.
- **Repo**: URL API dibangun server dari owner/name tervalidasi (host tetap, `redirect: 'error'`, timeout 8 dtk) — repo privat ditolak (`REPO_NOT_PUBLIC`). Opsional `GITHUB_TOKEN` untuk batas rate lebih tinggi.
- **Link**: wajib https; YouTube harus ID video valid; Google Drive dicek bisa dibuka publik; tautan sosial hanya host resmi (github.com, gitlab.com, linkedin.com, instagram.com).
- **Upload**: 1 file per request, gambar ≤5 MB (maks 8/karya, diproses ulang ke WebP 1920px — metadata dibuang), video MP4/WebM/MOV ≤30 MB (maks 1/karya, dicek magic bytes), kuota total 100 MB per mahasiswa (`storageUsedBytes`), semua didaftarkan ke pemindai file. Disimpan di `uploads/karya/<studentId>/`; penghapusan hanya di folder milik akun itu.
- **Shortlink**: slug `a-z0-9-` 3–40, kata cadangan ditolak, target https, tidak boleh ke `/go/*`; default perlu persetujuan admin; redirect 302 + `X-Robots-Tag: noindex`.
- **Rate limit**: auth 30/10 menit per IP, tulis 120/10 menit, repo-preview 30/10 menit, publik 120/menit.
- **API protection**: allowlist `/api/karya/auth`, `/api/karya/public`, `/api/karya/me`; `/api/karya/admin` tetap butuh konteks frontend + `authenticate` + permission.

---

## SEO

- `/karya/:slug`: SSR meta (title, description, canonical, og/twitter image dari sampul atau thumbnail YouTube) + JSON-LD `CreativeWork` (author Person, `codeRepository`, `programmingLanguage`) + `BreadcrumbList`.
- `/karya/mahasiswa/:username`: SSR meta + JSON-LD `ProfilePage` → `Person` (`affiliation` UIN Malang, `knowsAbout`, `sameAs` tautan sosial).
- Privat / belum disetujui / disembunyikan / akun nonaktif / halaman aplikasi (`masuk`, `daftar`, `saya`) → `<meta name="robots" content="noindex, nofollow">`.
- `/sitemap.xml` menambahkan `/karya` (bila ada karya), setiap karya tayang (priority 0.7) dan profil publik (0.6).

---

## Batas & konfigurasi

| Item | Nilai | Sumber |
|------|-------|--------|
| Kuota unggahan per mahasiswa | 100 MB (semua karya) | `KARYA_LIMITS.quotaBytesPerStudent` |
| Karya per mahasiswa | 30 | `maxProjectsPerStudent` |
| Gambar per karya | 8 × ≤5 MB | `maxImagesPerProject`, `maxImageBytes` |
| Video per karya | 1 × ≤30 MB | `maxVideosPerProject`, `maxVideoBytes` |
| Link / tag / terkait | 10 / 8 / 6 | `KARYA_LIMITS` |
| Shortlink per mahasiswa | 10 | `maxShortlinksPerStudent` |
| Kode prodi | `0605` | env `KARYA_PRODI_CODES` (koma) |
| Mode review | manual (default) / auto | `KaryaSettings.reviewMode` via dashboard |
| Saklar | fitur aktif, pendaftaran, unggah file, review shortlink | `KaryaSettings` via dashboard |

---

## Error codes

`NOT_TI_STUDENT`, `REGISTRATION_CLOSED`, `KARYA_DISABLED`, `EMAIL_REGISTERED`, `EMAIL_UNVERIFIED`, `INVALID_CREDENTIALS`, `ACCOUNT_LOGIN_THROTTLED`, `STUDENT_BLOCKED`, `STUDENT_SUSPENDED`, `STUDENT_AUTH_REQUIRED`, `USERNAME_INVALID`, `USERNAME_TAKEN`, `PROJECT_LIMIT`, `LINK_INVALID`, `DRIVE_NOT_PUBLIC`, `REPO_URL_INVALID`, `REPO_NOT_PUBLIC`, `REPO_RATE_LIMITED`, `REPO_FETCH_FAILED`, `MEDIA_LIMIT`, `FILE_TOO_LARGE`, `QUOTA_EXCEEDED`, `UPLOADS_DISABLED`, `UPLOAD_FAILED`, `SLUG_INVALID`, `SLUG_TAKEN`, `SHORTLINK_LIMIT`, `URL_INVALID`, `NOTE_REQUIRED`, `NOT_PUBLIC`, `NOT_APPROVED`, `NOT_HIDDEN`, `NOT_BLOCKED`, `NOT_TI_EMAIL`, `OTP_INVALID`, `RATE_LIMITED`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL`.

---

## Endpoint

Lihat [`docs/api/endpoints.md` § Karya Mahasiswa TI](../../api/endpoints.md) dan tag `karya` + `verify` di [`docs/openapi.json`](../../openapi.json) (55 + 1 operasi).

---

## Testing

- Typecheck: `npm run check`.
- Uji jalur (DB memori, bukan Atlas): server dev dengan `MONGODB_URI` mongodb-memory-server, `STORE_EMAIL_OUTBOX` (OTP ke file), `GOOGLE_LOGIN_TEST_MODE=1` (token `test:<email>|<nama>|<uid>`).
- Smoke test manual setelah deploy: daftar email TI angkatan lama & baru, tolak email non-UIN/non-TI, karya publik → pending → approve → muncul di beranda + `/sitemap.xml`, karya privat → 404 + noindex, suspend akun → karya hilang & login ditolak, shortlink pending → aktif → redirect.
