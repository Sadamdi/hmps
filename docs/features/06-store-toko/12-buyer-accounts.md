# Akun & Dashboard Pembeli

## Ringkasan

Pembeli toko bisa (opsional) punya akun untuk menyimpan riwayat pesanan, membuka pesanan dari perangkat mana pun, dan mengisi checkout otomatis. Akun pembeli **terpisah total** dari akun pengurus (staf).

## Desain

| Aspek | Keputusan |
|-------|-----------|
| Model | `Customer` + `CustomerSession` di DB utama (`db/mongodb.ts`), bukan `User` |
| Cakupan | Satu akun untuk semua toko (Encoder Store + toko komunitas). Pesanan di DB mana pun ditautkan lewat `StoreOrder.buyerId` |
| Sesi | Cookie `buyerToken` (httpOnly, SameSite=Lax), JWT `aud: buyer` dengan kunci turunan `JWT_SECRET + "::buyer"`, `sid` + `tokenVersion` |
| Isolasi | Token pembeli tidak lolos `authenticate` staf dan sebaliknya; pembeli tidak punya role/permission → tidak bisa membuka dashboard/admin, tidak muncul di User/Role Management |
| Pengurus | Boleh punya akun pembeli sendiri (email boleh sama), login terpisah |
| Login | Email + password (verifikasi OTP email) atau Google (Firebase, `server/services/google-login.ts`) |
| Wajib? | Tidak. Checkout tamu tetap jalan; checkout & beli-langsung menampilkan ajakan masuk |

## Klaim pesanan lama (otomatis saat daftar/masuk/ganti email)

Hanya dengan bukti kepemilikan, di toko utama dan semua toko komunitas aktif (`claimOrdersForCustomer`):
1. Pesanan dari perangkat yang sama (cookie `hmps_store_session`).
2. Pesanan dengan `customerEmail` = email akun yang sudah terverifikasi.
3. Manual: tempel link invoice (`orderNo` + token `inv`) di Dashboard → Pesanan saya.

Tidak pernah berdasarkan nomor HP (belum terverifikasi). Pesanan yang sudah milik akun lain tidak dipindah (409).

## Halaman

| Path | Isi |
|------|-----|
| `{toko}/masuk`, `{toko}/daftar` | Masuk/daftar (Google, email+password), verifikasi OTP, lupa password |
| `{toko}/akun` | Ringkasan (pesanan aktif, menunggu bayar, sisa pelunasan DP), Pesanan saya (filter + klaim link invoice), Profil & keamanan (nama/WA, ganti email via OTP, atur/ganti password via OTP) |

Header toko menampilkan tombol **Masuk** / nama akun. Checkout dan dialog beli-langsung memakai `StoreBuyerPrompt` (ajakan masuk; bila sudah masuk: banner + isi otomatis nama/WA/email).

## API

Lihat `docs/api/endpoints.md` bagian `/api/buyer`. Rate limit `buyer-auth` (30/10 menit per IP) + batas OTP bawaan (`server/services/otp.ts`: cooldown 60 dtk, kuota per email/IP).

## Keamanan

- Password bcrypt; OTP 6 digit, 10 menit, maks 5 percobaan.
- Reset password menaikkan `tokenVersion` dan mencabut semua sesi.
- Lupa password tidak membocorkan apakah email terdaftar.
- Semua query pesanan pembeli memakai `buyerId` dari sesi server.
- `/me` tidak pernah mengirim hash password/token.

## Sumber

- `server/services/buyer-auth.ts`, `server/routes/buyer.ts`
- `server/routes/store.ts` (`findOwnedOrder`, `/my-orders`, `/orders/:orderNo`, checkout `buyerId`)
- `client/src/hooks/use-buyer.ts`, `client/src/pages/toko/masuk.tsx`, `client/src/pages/toko/akun.tsx`, `client/src/components/toko/store-buyer-prompt.tsx`

## Fase 2 (4.43.0)

| Fitur | Detail |
|-------|--------|
| Alamat tersimpan | Maks 5, tepat satu utama; alamat utama terisi otomatis di checkout "Diantar" + tombol pilih alamat |
| Favorit | Favorit perangkat digabung ke akun per toko (`main` / slug komunitas), tersimpan lintas perangkat |
| Chat penjual | `StoreChat.buyerId`: percakapan ikut akun (dibuka dari perangkat lain); chat tamu yang dilanjutkan setelah masuk ikut ditautkan |
| Sesi aktif | Daftar perangkat, keluarkan satu/semua perangkat lain |
| Admin **Pelanggan** | Tab di Dashboard Toko (bukan User Management): daftar pembeli yang pernah memesan di toko INI, total belanja, metode login, detail pesanan, blokir/buka blokir |

### Permission & role

| Permission | Akses |
|------------|-------|
| `toko.customers.view` | Lihat pelanggan (email/HP disamarkan). `toko.manage` juga boleh melihat |
| `toko.customers.manage` | Data lengkap + blokir/buka blokir (hanya dari toko utama karena akun berlaku di semua toko) |

Pembeli **tidak** punya role staf dan tidak muncul di Role/User Management. Owner otomatis mendapat permission baru.

## Fase 3 (4.44.0)

| Fitur | Detail |
|-------|--------|
| AI Enco mode pembeli | Tool `buyer_list_orders` & `buyer_get_order` (`server/services/buyer-ai-tools.ts`): read-only, hanya pesanan akun yang login di toko konteks aktif. `buyerId` diisi route chat dari cookie `buyerToken` yang diverifikasi server (nilai dari client dibuang); argumen model tidak bisa mengganti pemilik. Tool hanya ditawarkan bila pembeli login. |
| Preferensi notifikasi | `notifyPrefs.orderStatus` (kabar status) & `paymentReminders` (pengingat bayar/pelunasan). Email transaksi inti (pesanan diterima, bukti diterima/ditolak, verifikasi, pembatalan) selalu dikirim |
| Hapus akun | OTP ke email akun → email/nama/HP/alamat/favorit/password/Google dihapus (email jadi `deleted-<id>@deleted.invalid`), status `deleted`, semua sesi dicabut. Pesanan tetap di toko (data pemesan di pesanan tidak diubah) |
| Role preset **Admin Toko** | `admin_toko` (sekali dibuat, migrasi `store-admin-role-v1`): `dashboard.view`, `toko.view`, `toko.manage`, `toko.customers.view`, tanpa berita/user/settings. Owner bebas mengubah di Role Management |

## Pintu login tunggal (4.45.0)

Satu tempat masuk untuk pengurus dan pembeli (`/login`, `{toko}/masuk`, tombol Login/nama akun di navbar). Backend tetap terpisah (cookie `authToken` vs `buyerToken`).

| Cara masuk | Alur |
|------------|------|
| Google | `POST /api/auth/google/identify` → pengurus saja: dashboard; pembeli saja: akun; **keduanya**: dialog "Masuk sebagai Pengurus / Pembeli"; belum punya akun: **onboarding** (nama bisa diubah, email terkunci dari Google, password + konfirmasi) lewat `/api/buyer/google/complete` — akun baru dibuat hanya setelah onboarding selesai |
| Email + password | Mengandung `@`: coba akun pembeli dulu, bila tidak cocok coba login pengurus. Jika password pembeli benar dan email itu juga pengurus (`alsoStaff`), tampil pilihan peran |
| Username + password | Login pengurus |

- Navbar: bila pembeli masuk, tombol **Login** berubah menjadi nama akun (menuju halaman Akun).
- Kartu **Perangkat yang masuk**: IP, perkiraan lokasi (negara, dari IP), waktu masuk, aktif terakhir, akun dibuat, login sebelumnya, keluarkan perangkat lain / keluar dari perangkat ini.
- `Customer.prevLoginAt` menyimpan login sebelum sesi berjalan.
- `identify` memakai limiter sendiri (30/menit per IP), tidak menghabiskan kuota login pengurus.
- Pengujian Google tanpa akun nyata: token `test:<email>|<nama>|<uid>|<padding>` hanya diterima bila `NODE_ENV!=production`, `GOOGLE_LOGIN_TEST_MODE=1`, dan `STORE_EMAIL_OUTBOX` di-set (tidak aktif di server nyata).

## Satu identitas: pindah peran (4.46.0)

Cookie pengurus (`authToken`) dan pembeli (`buyerToken`) tetap terpisah dan boleh aktif bersamaan; UI membaca keduanya.

| Dari → ke | Cara | Syarat |
|-----------|------|--------|
| Pengurus → pembeli | Menu pengurus "Akun pembeli", atau kartu di checkout / halaman masuk toko → `POST /api/buyer/from-staff` | Sesi pengurus valid dan punya email. Akun pembeli dibuat otomatis (nama, no HP, **hash password disalin**), `staffLinked: true`. Tidak ada OTP. Pesanan lama **tidak** diklaim lewat email pada pembuatan ini (hanya lewat perangkat). |
| Pembeli → pengurus | Menu pembeli "Masuk sebagai pengurus" → `POST /api/auth/switch-to-staff` | Email pembeli terverifikasi dan sama dengan akun pengurus. Memakai logika yang sama dengan login Google pengurus (409 bila ada di beberapa konteks → pilih di /login). Pengurus **tidak bisa** dibuat dari sisi pembeli (hanya lewat dashboard). |

- `GET /api/buyer/me` mengembalikan `alsoStaff` (cache 60 dtk) untuk menampilkan menu pindah.
- Password sama: saat pengurus mengganti/mereset password, akun pembeli `staffLinked` ikut berganti (satu arah) dan sesi pembeli lama dicabut. Akun pembeli berdiri sendiri tidak disentuh.
- Navbar: pembeli mendapat menu (akun saya, masuk sebagai pengurus, keluar), bukan lagi tautan tunggal; pengurus mendapat item "Akun pembeli".
- Halaman login pengurus menaut ke "Daftar sebagai pembeli".

## Catatan

- Login Google pembeli memakai Firebase yang sama dengan login pengurus; belum diuji dengan akun Google sungguhan.
- Role preset hanya dibuat di situs utama (toko komunitas memakai role komunitas masing-masing).
