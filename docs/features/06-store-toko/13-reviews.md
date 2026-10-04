# Ulasan & rating produk toko

Pembeli menilai produk setelah pesanan **selesai**. Berlaku di toko utama dan toko komunitas (model per toko lewat `resolveModels`).

## Aturan

- Hanya pembeli **berakun** yang pesanannya berstatus `completed` (pemilik pesanan = `buyerId`). Tamu diminta masuk.
- **1 pesanan × 1 produk = 1 ulasan** (indeks unik `orderNo + productId`). Boleh **edit** dan **hapus**; setelah dihapus boleh menulis ulang untuk pesanan yang sama. Produk bundle tidak diulas (hanya baris produk).
- Rating 1–5 wajib; komentar opsional (maks 1000 karakter, tag HTML dibuang, ditampilkan sebagai teks).
- **Privasi:** hanya `authorLabel` yang tampil publik: "Nama D." atau, bila "Samarkan namaku", "S*****n". Email, no HP, dan nomor pesanan tidak pernah dikirim ke publik. Admin melihat nama pemesan + nomor pesanan.

## Media (foto & video)

| Batas | Nilai |
|-------|-------|
| Foto | maks 4 per ulasan, 8 MB per file (JPG/PNG/WebP/HEIC) |
| Video | maks 1 per ulasan, 30 MB (MP4/WebM/MOV) |
| Request | maks 5 file |

- Upload lewat jalur yang sama dengan media lain: file masuk memori (multer), **foto diproses ulang ke WebP 1600px** (membuang metadata dan payload tersembunyi), **video divalidasi tipe + magic bytes** (ftyp / EBML) lalu disimpan apa adanya.
- Disimpan **lokal** di `uploads/store/reviews/` (komunitas: `uploads/community/<slug>/store/reviews/`) dan didaftarkan ke pemindai ClamAV (`registerUploadedFile`, kategori `store-review`). Media yang berstatus `infected` otomatis disaring dari respons publik.
- Saat ulasan dihapus/media diganti, file lama dihapus dari disk. Upload yang gagal di tengah jalan dibersihkan.
- Durasi video belum divalidasi (tidak ada ffprobe); batasnya ukuran file.

## Tampilan

- Halaman produk: rata-rata bintang di bawah judul (tautan ke `#ulasan`), bagian "Ulasan pembeli" berisi ringkasan + distribusi bintang, filter (semua / 5–1★ / dengan foto-video), urutan (terbaru / tertinggi / terendah). Daftar **5 ulasan per muatan** di dalam kotak setinggi tetap yang bisa di-scroll; scroll sampai bawah atau tombol "Muat lebih banyak" memuat berikutnya.
- Dashboard pembeli (Pesanan saya): pesanan selesai punya tombol **Ulasan produk** (dialog per produk: tulis / edit / hapus).
- Foto dibuka dalam lightbox, video diputar di dialog.

## Moderasi (Dashboard Toko → Ulasan)

- Permission baru `toko.reviews.manage` (atau `toko.manage`; preset Admin Toko sudah punya `toko.manage`).
- Filter Semua / Dilaporkan / Disembunyikan, cari produk/nomor pesanan, **sembunyikan** (dengan alasan), tampilkan, hapus permanen (termasuk file), lihat alasan laporan. Editor biasa saja (tanpa rich text).
- Ulasan tersembunyi tidak tampil publik dan tidak dihitung di rating; pemilik masih melihatnya (ditandai) dan mengeditnya tidak membuka kembali.
- **Laporan**: siapa pun (tamu boleh), alasan baku + catatan 200 karakter, 1 laporan per pelapor per ulasan, tidak bisa melaporkan ulasan sendiri. Laporan pertama memberi notifikasi ke admin toko. Data laporan kedaluwarsa otomatis 180 hari.

## Keamanan

- Semua tulis/ubah/hapus difilter `buyerId` dari sesi server (bukan dari klien); ulasan orang lain → 404.
- Limiter: tulis/ubah/hapus 40/jam per IP (20 per perangkat), laporan 20/jam per IP.
- Pembeli tidak bisa membuka endpoint moderasi (401/403).
