# Content Enhance AI (Dashboard)

**Status**: Active | **Category**: AI / Dashboard

## Deskripsi

Tombol **Enhance dengan AI** di form publish dashboard. AI memperbaiki teks yang sudah diisi (judul, excerpt, konten HTML, dll.) dengan gaya konten HMPS dari sampel database (`content-style-profile`).

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
