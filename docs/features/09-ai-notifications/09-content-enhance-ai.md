# Content Enhance AI (Dashboard)

**Status**: Active | **Category**: AI / Dashboard

## Deskripsi

Tombol **Enhance dengan AI** di form publish dashboard. AI memperbaiki teks yang sudah diisi (judul, excerpt, konten HTML, dll.) dengan gaya konten HMPS dari sampel database (`content-style-profile`).

### Skeleton HTML berita (Medinfo)

Profile `berita` (4.14+) mewajibkan urutan:

1. Tepat 3 baris meta `<p><strong>emoji Label:</strong> …</p>` — selalu 🗓 Tanggal / 🕖 Waktu / 📍 Tempat (prestasi/kompetisi mengisi ketiga field itu, bukan Prestasi/Lingkup/Tim)
2. Paragraf pembuka menyebut Himatif Encoder / ENCODER
3. Section `<h3>` (Latar Belakang, Pelaksanaan Kegiatan, dll.)
4. Gambar hanya `<p><img></p>` di antara section — bukan di atas meta

Berlaku untuk Enhance AI dan Spyro tool `create_berita_draft` / `update_berita`.

### Cakupan field berita

| Jalur | Judul | Excerpt | Tags | Konten HTML | Cover image |
|-------|-------|---------|------|-------------|-------------|
| Enhance AI (editor) | ✅ | ✅ | ✅ (koma) | ✅ | ❌ (upload manual / URL di tool Spyro) |
| Spyro `create_berita_draft` | ✅ | ✅ | ✅ | ✅ | ✅ opsional (`image` URL / GDrive / `/uploads/...`) |
| Spyro `update_berita` | ✅ | ✅ | ✅ | ✅ | ✅ opsional |

Cover file upload multipart tetap lewat Dashboard; AI tidak mengunggah file biner.

## Endpoint

`POST /api/ai/enhance-content` — auth wajib, permission per entity type.

## UX

1. Admin isi field di modal/form
2. Klik **Enhance dengan AI**
3. Preview before/after per field + alasan
4. Approve/decline per field → terapkan ke form lokal
5. Simpan manual (tidak auto-submit)

## Provider

OpenAI-compatible utama → Gemini fallback (`runAiTextCompletion`).

## Tool calling (Spyro chat)

- 42 tools dieksekusi via `executeToolCall` (provider-agnostic)
- OpenAI loop: truncate tool results, final synthesis tanpa tools, fallback Gemini jika respons lemah
- Style profile di-inject ke history saat write tools tersedia

## Halaman terintegrasi

Berita, Events, Library, Toko (produk), Profil, Kelembagaan, Prodi, Feedback config, Registrasi komunitas, Bug report dialog.
