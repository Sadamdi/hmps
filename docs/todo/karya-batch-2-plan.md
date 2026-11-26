# Rencana Batch 2 — Karya TI, Login Satu Pintu, OTP + Link

Status: **selesai di 4.66.0** (lihat docs/version/release/4.66.0.md) · Disusun 2026-11-26 · Basis: v4.65.1 (`077af02`)
Target versi: **4.66.0** (MINOR: fitur & endpoint baru, tanpa breaking API).

Urutan kerja dipilih supaya fondasi keamanan (OTP + link) jadi dulu, lalu dipakai fitur lain.
Owner menyetujui ("gas") 2026-11-26; semua bagian A–N dikerjakan di 4.66.0. Catatan: permintaan owner kemudian menjadikan link berlaku untuk SEMUA alur OTP (bukan hanya sebagian seperti draf bagian A).

---

## 0. Status semua permintaan (per 2026-11-26)

| # | Permintaan | Status |
|---|---|---|
| 1 | Login khusus mahasiswa TI (Google / email), tolak non-UIN/TI + peringatan hubungi admin | Selesai (4.65.0) |
| 2 | Profil, portofolio, publik/privat, indeks Google | Selesai, **ada bug profil kosong → bagian M** |
| 3 | Integrasi repo GitHub/GitLab/Bitbucket, LinkedIn, IG di profil | Backend selesai; **UI masih berlabel GitHub saja → bagian J** |
| 4 | Upload media + batas ukuran, saran YouTube/Drive, kuota 100 MB per mahasiswa | Selesai (4.65.0) |
| 5 | Owner bisa buat akun mahasiswa (disarankan email UIN) | Selesai (4.65.0) |
| 6 | Dashboard admin karya: owner/ketua/wakil/medinfo, suspend/hapus karya, suspend/blokir akun sementara/permanen, review manual/otomatis | Selesai (4.65.0) |
| 7 | Tag & pencarian di /karya | Selesai dasar; **halaman tag publik → bagian G** |
| 8 | Bisa disembunyikan/digabung dari Settings Beranda | Selesai (4.65.0) |
| 9 | Desain sesuai web HIMA, tema gelap & terang | Selesai (4.65.0); komponen baru → bagian L |
| 10 | Urutan default Karya TI setelah Toko, sebelum Media, bisa diubah | Selesai (4.65.1) |
| 11 | Merge & sinkron repo HIMA ↔ Sadamdi | Selesai (Sadamdi/hmps#2 merged, isi identik) |
| 12 | OTP + link untuk semua OTP, sekali pakai, expired, hash | Rencana → A |
| 13 | Aktivasi akun via email (link/OTP); Google otomatis terverifikasi; belum aktivasi → karya terkunci privat | Rencana → B |
| 14 | Ganti password wajib OTP + info alasan & masa berlaku | Rencana → C |
| 15 | Perangkat yang masuk: cek detail & revoke | Dasar sudah ada; diperkaya → D |
| 16 | Login satu pintu /login, daftar pilih jenis akun, redirect dashboard otomatis, menu profil kanan atas | Rencana → E |
| 17 | Deskripsi rich text seperti berita | Rencana → F |
| 18 | Tag karya seperti sistem tag berita (terpisah) | Rencana → G |
| 19 | Karya terkait otomatis (algoritma) | Rencana → H |
| 20 | Penanda wajib/opsional di form | Rencana → I |
| 21 | Repo: "lihat di GitHub/GitLab/…", platform open source lain | Rencana → J |
| 22 | Thumbnail opsional/otomatis/template | Rencana → K |
| 23 | Profil publik tetap tampil walau belum ada karya | Rencana → M |
| 24 | Cek bug serupa di karya & bagian lain | Rencana → N |

---

## M. Profil publik tampil walau belum ada karya (bug laporan owner)

**Penyebab:** di 4.65.0 profil sengaja hanya tampil bila punya ≥ 1 karya *tayang* — di tiga tempat:
- API `GET /api/karya/public/students/:username` (`server/routes/karya.ts`, cek `if (!rows.length)` → 404)
- SSR `/karya/mahasiswa/:username` (`karyaSeoStudent`, `if (!count) return null` → noindex)
- Sitemap (`karyaSitemapEntries` hanya profil pemilik karya tayang)

Akibatnya profil yang sudah diset **Publik** tetap "Profil tidak ditemukan".

**Perbaikan:**
- Profil tampil bila `profilePublic = true`, akun aktif, tidak disuspend/diblokir — **tanpa syarat karya**. Bagian portofolio menampilkan kondisi kosong ("Belum ada karya yang tayang").
- Akun yang **belum aktivasi email** (bagian B): profil tetap privat sampai aktivasi (mencegah akun asal-asalan tampil).
- SEO: profil tanpa karya tetap tampil untuk pengunjung, tapi `noindex` sampai punya ≥ 1 karya tayang **atau** profil terisi minimal (nama + headline/bio) — supaya Google tidak mengindeks ratusan profil kosong. Masuk sitemap mengikuti aturan yang sama.
- Teks di dashboard ("Tampil … setelah ada karya yang tayang") diperbarui sesuai aturan baru, plus tombol "Lihat profil publik" yang memberi tahu bila profil masih privat/belum aktivasi.

**Privasi NIM di URL:** username default sekarang = NIM (contoh `/karya/mahasiswa/240605110109`), sehingga NIM terlihat publik. Perbaikan:
- Username default dibuat dari nama (`ani-rahmawati`, unik), bukan NIM; akun yang sudah ada & masih memakai NIM sebagai username diberi saran ganti di dashboard (tidak diubah paksa agar link yang sudah dibagikan tidak putus; username lama tetap dialihkan 301 ke yang baru bila diganti).
- NIM tidak pernah ditampilkan di halaman publik/JSON-LD (sudah begitu; hanya angkatan).

---

## N. Audit aturan tampil publik (cek bug serupa)

Diperiksa & diuji satu per satu (uji otomatis di DB memori):

| Kasus | Harapan |
|---|---|
| Karya publik, mode review **manual**, belum disetujui | Tidak tampil publik; dashboard menjelaskan "Menunggu review" (bukan error) |
| Karya publik, mode **otomatis** | Langsung tampil |
| Karya **privat** | 404 + noindex; pemilik bisa melihat lewat tombol "Pratinjau" (baru) |
| Karya disembunyikan admin | 404 publik; pemilik melihat catatan admin |
| Akun disuspend/diblokir | Profil & karya 404, shortlink mati |
| Akun belum aktivasi | Karya terkunci privat, profil privat |
| Profil publik tanpa karya | Tampil (bagian M) |
| Profil privat dengan karya publik | Profil 404, karya tetap tampil (penulis ditampilkan tanpa link profil) |
| Fitur dimatikan admin | /karya, section beranda, profil, shortlink tertutup |
| Cache daftar publik 30 dtk | Turunkan ke 10 dtk + `stale-while-revalidate`; setelah admin menyetujui, data langsung segar di dashboard |

Tambahan: **tombol "Pratinjau"** di dashboard mahasiswa untuk melihat tampilan karya/profil seperti publik walau masih privat/pending (hanya untuk pemilik, `noindex`).

---

## A. OTP + link verifikasi untuk SEMUA alur OTP

**Permintaan:** setiap email OTP juga berisi link. Mahasiswa/pembeli/pengurus boleh pakai salah satu; begitu salah satu dipakai, keduanya hangus. Keduanya punya masa berlaku. Semua disimpan aman (hash).

**Kondisi sekarang (`server/services/otp.ts`):** 1 dokumen `OtpChallenge` per permintaan, kode 6 digit di-hash HMAC-SHA256 + pepper, maks 5 percobaan, TTL default 10 menit, sekali pakai (`consumedAt`), limit per email/IP. 13 purpose: `forgot_password`, `change_password`, `change_email`, `restore_backup`, `delete_community`, `buyer_*` (5), `karya_*` (3).

**Desain:**
- Tambah ke `OtpChallenge`: `linkTokenHash` (HMAC-SHA256 dengan pepper yang sama), `linkUsedAt`.
- `createOtpChallenge` membuat **kode 6 digit + token link 32 byte acak** dalam challenge yang sama. Token mentah hanya ada di email, tidak pernah disimpan.
- Link: `https://himatif-encoder.com/verifikasi?c=<challengeId>&t=<token>`. Halaman ini **tidak langsung mengeksekusi** saat dibuka (mencegah pemindai link email/antivirus menghanguskan token); pengguna menekan tombol "Konfirmasi", baru `POST /api/verify/link` dipanggil.
- Satu fungsi verifikasi `consumeChallenge({ challengeId, code | token, purpose })` dengan update atomik `findOneAndUpdate({ _id, consumedAt: null, expiresAt > now }, { $set: { consumedAt } })` → kode dan link otomatis hangus bersamaan, aman dari race (dua tab).
- Masa berlaku per purpose (ditampilkan di email & UI):

| Purpose | OTP & link berlaku |
|---|---|
| Aktivasi akun (mahasiswa/pembeli) | **24 jam** (link & kode sama) |
| Ganti/lupa password, ganti email | 10 menit |
| Hapus akun, hapus komunitas, restore backup | 10 menit |

- Purpose yang butuh lanjutan setelah verifikasi (ganti password, lupa password) memakai pola `verifyAndIssueResetToken` yang sudah ada: link/OTP benar → token reset sekali pakai 10 menit → form password baru.
- Purpose aksi berbahaya (`restore_backup`, `delete_community`) **tetap wajib OTP saja** (link tidak dikirim) karena butuh sesi pengurus aktif; dicatat di docs.
- Template email (`server/services/email.ts`): kode besar + tombol link + teks "Berlaku sampai HH:MM WIB (N menit). Kode dan link hanya bisa dipakai sekali; memakai salah satunya membatalkan yang lain. Abaikan bila bukan kamu."
- Rate limit, cooldown 60 dtk, dan maks 5 percobaan tetap. Percobaan token link salah ikut menambah `attempts`.

**Catatan "link permanen":** link aktivasi tidak dibuat permanen (risiko keamanan); diganti **24 jam + tombol "Kirim ulang aktivasi"** di halaman masuk dan dashboard. Ini kompromi yang biasa dipakai layanan besar.

---

## B. Aktivasi akun & kunci privat

- **Daftar via email** (mahasiswa & pembeli): akun dibuat `status: active, emailVerified: false`, langsung bisa masuk, email aktivasi (OTP + link, 24 jam) dikirim otomatis.
- **Login Google:** otomatis `emailVerified: true` (sudah begitu sekarang).
- **Akun buatan admin:** `emailVerified: false`; terverifikasi saat masuk Google atau saat aktivasi/atur password lewat OTP/link.
- **Kunci privat:** selama `emailVerified: false`:
  - karya hanya bisa disimpan **Privat**; pilihan Publik terkunci dengan ikon gembok + alasan ("Verifikasi email dulu untuk mempublikasikan karya");
  - server menolak `visibility: public` → `403 EMAIL_NOT_VERIFIED` (jangan andalkan UI saja);
  - shortlink tidak bisa dibuat;
  - banner di dashboard: "Akunmu belum terverifikasi. [Kirim ulang email aktivasi] · berlaku 24 jam".
- Endpoint: `POST /api/karya/auth/activation/resend`, `POST /api/karya/auth/activation/verify` (kode) + link umum dari bagian A.
- **Perubahan alur:** daftar email tidak lagi memblokir login sebelum OTP (sekarang wajib OTP dulu). Ini mengikuti permintaan "langsung bisa, tapi publik dikunci".

---

## C. Ganti password wajib OTP/link

- Form: password lama (bila punya) + password baru + konfirmasi → **kirim OTP + link ke email** → masukkan kode atau klik link → password diganti, semua sesi lain dicabut.
- Penjelasan di UI: "Demi keamanan, perubahan password harus dikonfirmasi dari email kampusmu. Kode berlaku 10 menit."
- Password baru disimpan sementara sebagai **hash bcrypt** di challenge (`pendingPasswordHash`), bukan teks biasa; dipasang saat verifikasi berhasil.
- Berlaku untuk mahasiswa; pembeli & pengurus mengikuti bila tidak memecah alur lama (pengurus sudah pakai `change_password` OTP).

---

## D. Perangkat yang masuk (revoke)

Sekarang sudah ada daftar + cabut, tapi minim info. Diperkaya:
- Browser + versi, OS, jenis perangkat (parse user-agent di server, simpan saat login), IP disamarkan sebagian (mis. `36.72.x.x`), negara/kota (geoip yang sudah ada), waktu masuk & aktif terakhir.
- Tombol "Keluarkan" per perangkat dan "Keluarkan semua perangkat lain".
- Email notifikasi "Login baru dari Chrome di Windows" bila perangkat belum pernah dipakai (opsional, bisa dimatikan).
- Berlaku untuk mahasiswa dan pembeli (pengurus sudah punya halaman sesi sendiri).

---

## E. Login satu pintu `/login` dan `/daftar`

**Tujuan:** satu halaman masuk untuk pengurus, pembeli, dan mahasiswa; otomatis menuju dashboard yang cocok tanpa bentrok.

**Riset kondisi sekarang:** pengurus `/login` (cookie `authToken`), pembeli `/toko/masuk` (`buyerToken`), mahasiswa `/karya/masuk` (`studentToken`). Sudah ada mekanisme `unified-google` + `login-targets` untuk pengurus↔pembeli.

**Desain:**
- **Sesi tetap terpisah** (3 cookie, 3 kunci JWT, 3 tabel sesi). Ini kunci agar tidak bentrok dan akun mahasiswa/pembeli tidak pernah bisa membuka API admin.
- `/login`: satu form (email/username + password) + "Masuk dengan Google". Server `POST /api/auth/identify` (read-only, tanpa membocorkan email terdaftar) mengembalikan jenis akun yang cocok **setelah** password/Google valid:
  - 1 akun cocok → langsung masuk dan diarahkan;
  - lebih dari 1 (mis. email yang sama sebagai pembeli dan mahasiswa) → kartu pilihan "Masuk sebagai: Pengurus / Mahasiswa TI / Pembeli";
  - email UIN TI tanpa akun → tawarkan daftar mahasiswa; email lain tanpa akun → tawarkan daftar pembeli.
- `/daftar`: pilih jenis akun dulu — **Mahasiswa TI** (khusus email kampus, dicek langsung) atau **Pembeli Toko**. Pengurus tidak bisa daftar sendiri (tetap lewat kode registrasi/admin).
- **Tujuan setelah masuk** (tidak mengubah URL dashboard yang sudah ada, agar link & bookmark lama tidak rusak):

| Akun | Tujuan |
|---|---|
| Pengurus | `/dashboard` (tetap) |
| Mahasiswa TI | `/karya/saya` |
| Pembeli | `/toko/akun` |
| Ada `?next=` internal | ke `next` bila sesuai jenis akun |

- `/toko/masuk`, `/karya/masuk`, `/toko/daftar`, `/karya/daftar` tetap ada sebagai **redirect** ke `/login?as=…` / `/daftar?as=…` supaya link lama aman.
- Tidak membuat `/dashboard/karya` untuk mahasiswa (sudah dipakai admin) — menghindari bentrok route & guard.

**Menu profil kanan atas navbar** (seperti di toko): avatar + nama; isi menu menyesuaikan sesi aktif:
- Mahasiswa: Karya saya, Profil publik, Akun & keamanan, Keluar
- Pembeli: Pesanan, Akun, Keluar
- Pengurus: Dashboard, Profil, Keluar
- Bila ada lebih dari satu sesi aktif di browser: bagian "Ganti peran". Tombol "Login" hanya tampil bila tidak ada sesi apa pun.

**Risiko & mitigasi:** perubahan di halaman login pengurus berisiko mengunci admin → pengurus tetap bisa login dengan username (bukan hanya email); endpoint `/api/auth/login` lama tidak diubah; uji regresi login pengurus/pembeli/mahasiswa + Google untuk ketiganya sebelum deploy.

---

## F. Deskripsi rich text (seperti berita)

- Editor TinyMCE yang sama (`client/src/components/dashboard/rich-text-editor.tsx`) dengan toolbar dibatasi: heading, bold/italic, daftar, kutipan, kode, link, gambar.
- Gambar di editor diunggah ke `uploads/karya/<studentId>/` dan **ikut kuota 100 MB**.
- Server membersihkan HTML dengan `sanitizeCmsHtml` (sudah dipakai berita); link luar otomatis `rel="noopener nofollow ugc"`.
- Halaman detail merender HTML yang sudah disanitasi (komponen render berita yang ada).
- Deskripsi lama (teks biasa) tetap tampil (dibungkus paragraf).

---

## G. Tag karya (sistem seperti tag berita, terpisah)

- Halaman publik `/karya/tag/:tag` (SSR meta + masuk sitemap bila ≥ 2 karya): daftar karya bertag itu + tag terkait.
- Di detail karya, tag bisa diklik → halaman tag.
- Di `/karya`, tag populer ditampilkan sebagai tab (pola `pickWeightedTags` berita).
- Input tag di editor berupa **chip dengan saran** dari tag yang sudah ada (menghindari "React" vs "reactjs" ganda), maks 8.
- Tag karya disimpan terpisah dari tag berita (koleksi berbeda) sehingga tidak tercampur.

---

## H. Karya terkait otomatis

Skor untuk setiap kandidat karya publik (bukan karya itu sendiri):

```
skor = 3 × jumlah tag sama
     + 2 × kategori sama
     + 2 × bahasa repo sama
     + 1 × pembuat sama (maks 2 karya per pembuat)
     + 1 × angkatan sama
     + kesegaran (0–1, makin baru makin tinggi)
     + 0.5 × unggulan
```

- Ambil 6 teratas; karya terkait yang dipilih manual oleh mahasiswa selalu tampil lebih dulu.
- Dihitung di server (`GET /api/karya/public/projects/:slug` mengembalikan `relatedAuto`), di-cache 10 menit per karya.

---

## I. Form: penanda wajib / opsional

- **Wajib:** Judul, Kategori. Untuk Publik: minimal satu dari ringkasan / deskripsi / media / repo (agar tidak tayang kosong).
- Semua kolom lain diberi label "(opsional)" dan teks bantuan singkat.
- Validasi tampil per kolom (merah + pesan), bukan hanya pesan umum di bawah.

---

## J. Integrasi repo: label per platform + "lihat selengkapnya"

**Temuan:** backend sudah mendukung GitHub, GitLab, Bitbucket, tetapi UI selalu memakai ikon & teks GitHub ("Mulai dari GitHub", ikon GitHub di kartu repo). Akan diperbaiki:
- Judul kartu editor: "Mulai dari repo (GitHub, GitLab, Bitbucket, Codeberg)"; logo ketiga/keempat platform tampil.
- Ikon & label sesuai host di editor, detail karya, dan panel admin.
- Tombol "Lihat di GitHub / GitLab / Bitbucket / Codeberg" di detail karya, plus bintang, fork, bahasa, lisensi, dan tanggal update.
- Tambah **Codeberg** (API Gitea, publik) sebagai platform open source keempat.
- README repo **tidak** disalin ke situs (hindari konten pihak ketiga & hak cipta); cukup ringkasan + tombol ke repo.

---

## K. Thumbnail / sampul

Prioritas sampul otomatis (mahasiswa tetap bisa memilih manual):
1. Gambar yang diunggah dan ditandai sampul
2. Gambar preview repo (Open Graph GitHub/GitLab bila tersedia)
3. Thumbnail video YouTube
4. **Sampul template otomatis**: kartu bergaya web HIMA berisi judul, kategori, ikon, nama pembuat; warna mengikuti tema (gelap: navy + aksen cyan; terang: putih + aksen biru), dibuat di server (SVG → WebP, disimpan & di-cache) sehingga juga dipakai untuk `og:image` Google/WhatsApp.

Di editor: pratinjau sampul + pilihan "Pakai sampul otomatis" atau unggah sendiri.

---

## L. Tema terang & gelap

- Semua komponen baru memakai token tema yang sudah ada (`bg-card`, `text-foreground`, `border-border`, `primary`) — tanpa warna mati kecuali badge status yang punya varian `dark:`.
- Sampul template (K) dibuat dua varian.
- Uji visual setiap halaman baru di kedua tema sebelum deploy.

---

## Urutan eksekusi & verifikasi

0. M + N (bug profil kosong & audit tampil publik) — paling dulu karena sudah dirasakan pengguna
1. A (OTP + link) → B (aktivasi, kunci privat) → C (ganti password OTP) → D (perangkat)
2. J, I (cepat, UX form & repo) → F (rich text) → G (tag) → H (terkait) → K (sampul) → L (cek tema)
3. E (login satu pintu + menu profil) terakhir karena menyentuh login pengurus; diuji paling ketat.
4. Per tahap: `npm run check`, uji API di MongoDB memori (bukan Atlas), uji UI terang/gelap.
5. Docs: feature 13 + auth docs, endpoints, OpenAPI, SOP bila alur login berubah, release 4.66.0, changelog.
6. Commit atas nama Adam tanpa atribusi AI → push HIMA (auto-deploy) → smoke produksi → PR ke `Sadamdi/hmps` + merge agar tetap sinkron.

## Keputusan yang perlu konfirmasi

1. Link aktivasi 24 jam + tombol kirim ulang (bukan link permanen) — **disarankan**.
2. Akun email boleh langsung masuk sebelum aktivasi, tapi karya terkunci privat — sesuai permintaan.
3. Dashboard tetap di URL sekarang (`/dashboard`, `/karya/saya`, `/toko/akun`) dengan `/login` sebagai satu pintu — **disarankan** dibanding memindah ke `/dashboard/admin` dsb. (memindah URL admin berisiko memutus link, bookmark, dan permission guard yang ada).
4. Tambah Codeberg sebagai platform keempat.
5. Profil publik tanpa karya: tampil untuk pengunjung, tapi `noindex` sampai ada karya tayang atau profil terisi — **disarankan** (bagian M).
6. Username default dari nama (bukan NIM); akun lama disarankan ganti, tidak dipaksa — **disarankan** (bagian M).
