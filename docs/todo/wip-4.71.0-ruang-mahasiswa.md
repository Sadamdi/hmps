# WIP 4.71.0 — Ruang Mahasiswa, kontributor, profil 2 tab (BELUM RILIS)

Branch: `wip/4.71.0-ruang-mahasiswa` (belum di-merge ke `main`, belum deploy). Produksi = **4.70.0**.
Tanggal: 2026-11-27. Typecheck (`npm run check`) **lolos** pada commit WIP ini. Belum diuji di DB memori/browser.

## Sudah dikerjakan di branch ini (kode ada, perlu uji)

1. **Kontributor karya**
   - `server/services/karya-contributors.ts` (baru): resolve input (username/link Karya TI, username/link GitHub),
     contributor repo GitHub (tanpa bot), tautan otomatis ke akun Karya TI via `social.github`,
     `syncProjectContributors`, `syncStaleContributors` (scheduler 6 jam, 15 karya/putaran), `linkStudentToContributions`.
   - Model: `contributors[]`, `contributorsSyncedAt` di `KaryaProject` + index.
   - Endpoint: `POST /me/contributors/resolve`, `POST /me/projects/:id/contributors/sync`, `GET /me/contributions`,
     `POST /me/contributions/:id/visibility`, `POST /admin/contributors/sync` (backfill karya lama).
   - Repo preview mengembalikan `contributors`; detail publik `contributors`; profil publik memuat karya sebagai kontributor (`asContributor`).
   - UI: `client/src/components/karya/contributors-editor.tsx` (editor), "Tim pembuat" di detail, badge "Kontributor" + avatar bertumpuk di kartu, bagian "Karya tempat kamu jadi kontributor" (sembunyikan dari profil) di dashboard.
2. **Profil publik 2 tab** (`pages/karya/mahasiswa/[username].tsx` → `ProfileMain`): Ringkasan (README + Sedang aktif + Terpopuler) dan Portofolio (cari, filter kategori, urut terakhir aktif/terpopuler/terbaru). Kartu punya `viewCount`, `activeAt`.
3. **Migrasi alamat → Ruang Mahasiswa** (sumber tunggal `shared/student-space-paths.ts`):
   - Publik: `/ruang-mahasiswa/karya`, `/ruang-mahasiswa/karya/:slug`, `/ruang-mahasiswa/karya/tag/:tag`, `/ruang-mahasiswa/mahasiswa/:username`.
   - Dashboard: `/ruang-mahasiswa/dashboard`, `/ruang-mahasiswa/dashboard/karya/baru|edit/:id|pratinjau/:id`, `/ruang-mahasiswa/dashboard/pratinjau-profil`.
   - Masuk/daftar: `/ruang-mahasiswa/masuk`, `/ruang-mahasiswa/daftar`. Shortlink `/go/:slug` tetap.
   - Server: 301 `/karya*` & `/mahasiswa*` → alamat baru (`legacyStudentSpacePath`), SEO prerender & canonical & JSON-LD & sitemap pindah, halaman dashboard/masuk/daftar noindex. Klien: `LegacyStudentRedirect`.
   - Breadcrumb: Beranda / Ruang Mahasiswa / Dashboard; … / Dashboard / Karya / Baru|Edit; … / Ruang Mahasiswa / Karya / Judul; … / Ruang Mahasiswa / Mahasiswa / Nama.
   - Navbar item "Karya TI" → "Ruang Mahasiswa" (Karya mahasiswa, Profil mahasiswa, Dashboard/Masuk). Tenant slug `ruang-mahasiswa`, `mahasiswa` dicadangkan.
4. **TinyMCE mode gelap**: `client/src/index.css` — menubar/toolbar/menu/statusbar/dialog mengikuti token tema (dulu selalu terang).

## Lanjutan (urut) saat owner bilang "gas lanjut"

1. **Uji branch ini**: server uji DB memori (`.claude/launch.json` → `karya-test`), tulis `test-471.mjs`:
   kontributor (resolve Karya/GitHub, sync repo, tautan akun, sembunyikan), 301 alamat lama (jalan di mode produksi), profil 2 tab, kategori buatan.
   Cek browser HP 375 px + desktop, mode gelap & terang: dashboard, editor (TinyMCE), detail, profil, daftar.
2. **Dashboard mahasiswa "Karya saya" jadi kartu** bergaya berita: thumbnail sampul, kategori, status, dilihat, tanggal, aksi (Lihat/Edit/Hapus/Pratinjau). (Permintaan owner, screenshot daftar karya polos.)
3. **Dashboard admin Karya dirombak** (`client/src/pages/dashboard/karya.tsx`): kartu bersampul, deskripsi **dirender** (bukan HTML mentah — pakai `RichHtmlWithEmbeds` dalam kotak tinggi terbatas + "Lihat selengkapnya"), filter/sort lebih jelas, aksi review rapi, detail di drawer. Backend: list admin kirim ringkasan teks + cover, paginasi.
4. **Audit keamanan menyeluruh** (owner minta "perkuat all security"): rate-limit & authz endpoint baru (kontributor, embed, profil import), IDOR (contributions/visibility, admin), SSRF (embed analysis, repo/GitHub fetch), XSS (README/descriptions sanitize, `RichHtmlWithEmbeds`, iframe sandbox), open-redirect (`next` param), CSP, header, upload. Pakai skill `owasp-audit`/`api-audit`; perbaiki temuan.
5. **Rilis 4.71.0**: docs (release note, CHANGELOG, versions, feature 13, endpoints, OpenAPI), bump `package.json`/`openapi`, merge branch → `main`, push (auto-deploy), sync PR ke `Sadamdi/hmps`, cek prod (301, SEO, sitemap, profil, mobile).
   Setelah deploy: jalankan backfill kontributor sebagai owner: `POST /api/karya/admin/contributors/sync {"limit":100,"force":true}`.
6. **Video tutorial** (tanpa suara; SFX + ilustrasi/teks): proyek `D:\Adam_Project\karya-tutorial-video` (Remotion 4.0.542 + Playwright 1.56.1, Chromium `C:/Users/A16/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe`).
   Perekam `scripts/record.mjs` (seed via API, kursor terlihat, marks.json) — **perlu diperbarui ke alamat /ruang-mahasiswa** dan bug: `ctx.request.get('/api/karya/me/projects')` mengembalikan HTML (ganti ke `page.request` dengan cookie halaman, atau ambil id dari URL editor).
   Alur video: Ruang Mahasiswa → daftar → aktivasi → onboarding (impor GitHub) → profil/README → karya baru dari repo (kategori, tag, tautan, kontributor) → kirim → tayang → profil publik (Ringkasan/Portofolio). Musik/SFX meniru `Kelilink/documents/promo-video/make_music_v2.py`/`make_sfx.py`.
   Hasil MP4 → owner upload YouTube → isi link di Dashboard → Karya → Pengaturan (YouTube + Drive fallback).
7. **Broadcast WA** rilis (SOP 13), tema "portofolio gratis untuk mahasiswa TI", link `himatif-encoder.com/ruang-mahasiswa/karya`.

## Catatan

- Navbar prod sudah: Beranda · Tentang HMTI (Profil+Kelembagaan) · Prodi · Encoder Store · Karya TI · Media · Komunitas (diterapkan lewat `PUT /api/settings/home-config`). Setelah 4.71.0 label "Karya TI" otomatis "Ruang Mahasiswa" (dari kode navbar).
- Username Adam masih NIM; onboarding akan muncul → impor GitHub `Sadamdi`.
- Media auto-push server gagal (`could not read Username`) — kredensial git server, di luar rilis ini.
