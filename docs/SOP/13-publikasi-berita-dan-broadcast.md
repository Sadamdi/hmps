# SOP 13 — Publikasi Berita, Event, Galeri, dan Broadcast WA/Status

SOP ini menjelaskan alur biasa setelah sebuah kegiatan selesai: dari data kegiatan sampai berita terbit di web dan tersebar lewat WhatsApp. Contoh acuan: berita **R.O.A.R 2026** dan **Kunjungan Industri Yogyakarta 2026**.

## 1. Urutan kerja

1. **Kumpulkan data kegiatan** (tanggal, waktu, tempat, peserta, rangkaian acara, evaluasi). Data yang kosong ditulis apa adanya, jangan dikarang.
2. **Pilih foto** dari Drive dokumentasi. Ambil foto yang tajam dan relevan, potong rasio 3:2 (ukuran isi 1620x1080). Foto bersama seluruh peserta dipakai sebagai thumbnail.
3. **Buat berita** (dashboard > Berita > Berita Baru) memakai akun divisi Media dan Informasi:
   - Tiga baris pembuka `🗓 Tanggal`, `🕖 Waktu`, `📍 Tempat`.
   - Isi dibagi dengan heading **h3** supaya Table of Contents muncul otomatis di sisi kiri.
   - Foto satu per paragraf, atribut `width=404 height=269`, tanpa style tambahan, seperti berita ROAR.
   - Tag baku: `Himatif Encoder`, `periode 2026`, `Teknik Informatika`, `mahasiswa`, `UIN Malang`, `event`, ditambah tag kegiatan.
   - Lampiran: link folder Drive dokumentasi.
4. **Buat galeri** (dashboard > Galeri > Upload Media): judul `Galeri <Kegiatan>`, tanggal kegiatan, deskripsi singkat, tag, **Berita terkait**, dan tempel link folder Drive (mode folder embed). Folder Drive harus "Siapa pun yang punya link".
5. **Buat event** (dashboard > Events > tahun > Tambah Event): judul `<Kegiatan> — <Nama lengkap>`, deskripsi **sama dengan isi berita**, tanggal mulai dan selesai, thumbnail yang sama, pilih **Galeri** dan **Berita** terkait, lalu aktifkan Publikasikan. Relasi berita, galeri, dan event berlaku dua arah.
6. **Sesuaikan tanggal terbit dan pembaca bila perlu.** Tanggal di halaman publik memakai `createdAt`. Untuk kegiatan yang beritanya terbit belakangan, owner dapat mengubah `createdAt` (jam konvensi `14:00 UTC`) dan `viewCount` langsung di koleksi `berita` MongoDB. Ini pekerjaan owner/teknis, bukan fitur dashboard.
7. **Cek halaman publik**: judul, Table of Contents, foto termuat, lampiran, tanggal.

> Tombol **Copy ke Berita** pada kartu event menyalin event menjadi draf berita. Arah sebaliknya (berita menjadi event) belum ada, jadi event dibuat manual dengan menyalin isi berita.

## 2. Teks WhatsApp

Setelah berita terbit, kirim dua teks pendek: satu untuk **grup**, satu untuk **status**. Pola mengikuti pesan R.O.A.R:

### 2.1 Pesan grup

```text
🏆 JUDUL BERITA DALAM HURUF KAPITAL 🏆

Kota, tanggal — satu atau dua kalimat inti kegiatan (siapa, di mana, berapa peserta/tim).

Kalimat apresiasi atau ajakan singkat. 🙌

📖 Baca berita selengkapnya di web resmi HIMATIF:
https://himatif-encoder.com/berita/<slug-berita>
```

Aturan:
- Maksimal 2 paragraf pendek sebelum link. Satu emoji pembuka dan penutup judul.
- Jangan mengarang kutipan, nama, atau angka yang tidak ada di data.
- Link harus link berita yang sudah terbit, bukan link dashboard.

### 2.2 Status WA

```text
JUDUL SINGKAT 🎓
Satu kalimat inti. 
📖 himatif-encoder.com/berita/<slug-berita>
```

Maksimal sekitar 3 baris, pakai link tanpa `https://` agar ringkas.

### 2.3 Contoh Kunjungan Industri Yogyakarta 2026

Grup:

```text
🚌 KUNJUNGAN INDUSTRI KE YOGYAKARTA: MAHASISWA TI BELAJAR TEKNOLOGI PENDIDIKAN DI BALAI TEKKOMDIK DIY 🚌

Yogyakarta, 22-23 Oktober 2026 — 50 mahasiswa Teknik Informatika UIN Malang bersama 2 dosen pendamping berkunjung ke Balai Tekkomdik DIY. Peserta berkeliling studio JB Radio, JB TV, dan Podcast Studio untuk melihat langsung pengelolaan teknologi pendidikan di DIY.

Terima kasih untuk seluruh peserta dan dosen pendamping. 🙌

📖 Baca berita selengkapnya di web resmi HIMATIF:
https://himatif-encoder.com/berita/kunjungan-industri-ke-yogyakarta-mahasiswa-teknik-informatik
```

Status:

```text
Kunjungan Industri ke Yogyakarta 🚌
50 mahasiswa TI belajar teknologi pendidikan di Balai Tekkomdik DIY.
📖 himatif-encoder.com/berita/kunjungan-industri-ke-yogyakarta-mahasiswa-teknik-informatik
```

## 3. Laporan Word ke program studi

Laporan ke program studi memakai format laporan kegiatan prodi: sampul, Daftar Isi, BAB I Pendahuluan, BAB II Pelaksanaan Kegiatan, BAB III Penutup, Lampiran foto (2 foto per baris). Jangan menulis susunan panitia atau data lain yang belum ada. Word dapat memperbarui Daftar Isi lewat Update Field.

## 4. Checklist cepat

- [ ] Data kegiatan lengkap, nama dosen dicek ke situs prodi
- [ ] Berita terbit (h3 untuk TOC, foto 404x269, tag baku, lampiran Drive)
- [ ] Galeri terbit (folder embed, berita terkait)
- [ ] Event terbit (isi sama dengan berita, galeri dan berita terkait)
- [ ] Tanggal terbit sesuai tanggal kegiatan
- [ ] Teks grup dan status siap, link berita dicek terbuka
