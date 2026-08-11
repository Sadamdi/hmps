# Tenant vs Main Site — Audit Findings + Fix Plan

**Date:** 2026-08-12  
**Scope:** Live production (`himatif-encoder.com`) + production Mongo + current code  
**Status:** Implemented in `4.15.0` + follow-up `4.15.1` (routing/404/deploy vite)  
**Current app:** `4.15.1`  
**Related:** `docs/architecture/multi-tenant.md`, `docs/todo/master-todo.md` §5, `.agents/skills/tenant-feature`

---

## Verdict

**Data isolation is working. Public URL + SEO + logo are not treated as “situs sendiri”.**

Tenant API (`/api/c/:slug/*`) and tenant Mongo DBs are separate from `himatifwebmain`. Berita yang ditulis di dashboard ONTAKI **tidak** masuk DB Himatif. Yang bikin terasa “error / 404 / ketuker” adalah **URL publik dan meta SEO yang masih mengarah ke path utama** (`/berita/...`, canonical Himatif), plus navbar/SEO yang tidak memakai `logoUrl` tenant.

### Kebijakan fallback (keputusan)

| Konteks | Kalau field dashboard kosong | Boleh diisi dari dashboard? |
|---------|------------------------------|-----------------------------|
| **Web utama** | Default Himatif (ini situs aslinya) | Ya — settings/profil/kelembagaan |
| **Tenant** | **Jangan** jatuh ke copy/logo Himatif. Pakai `siteName` / empty state (“belum diisi”) | Ya — field yang sama. Heading About/title/SEO harus baca `siteName` + `logoUrl`, bukan string hardcoded |

Jadi: fallback Himatif **hanya** untuk main. Tenant yang belum isi visi ≠ otomatis visi Himatif. Logo tenant yang sudah di-upload harus muncul di navbar + favicon + `og:image` / JSON-LD, bukan cuma di halaman login.

### Bug yang dimaksud owner (URL / SEO) — masih ada di kode

Klik di dalam SPA tenant (wouter `Link` + `Router base=/:slug`) biasanya tetap di `/:slug/berita/...`. Yang rusak:

1. **Canonical / og:url / JSON-LD** di `berita/[id].tsx` selalu `https://himatif-encoder.com/berita/{slug}` — Google, share, dan “salin tautan” mengarah ke **web utama**.
2. **SSR** hanya query DB utama di `/berita/:slug`. Buka `/berita/slug-tenant` → 404 Himatif **atau** artikel Himatif lain yang kebetulan slug-nya sama.
3. **`<a href="/kelembagaan">` mentah** di dashboard tenant (bukan wouter Link) buka halaman utama di tab baru.
4. **Sitemap** hanya URL utama; production `/sitemap.xml` sekarang **500**. Tenant tidak muncul di pencarian sebagai situs sendiri.
5. **Navbar** pakai teks `navbarBrand`, **tidak** render `settings.logoUrl`. Logo ONTAKI sudah ada di DB tapi tidak di header/SEO.

---

## What was checked

| Layer | Method |
|-------|--------|
| Code | Tenant resolver, `resolveStorage`, CommunityShell, fetch rewrite, tenant-auth, Settings schema defaults, SSR in `server/index.ts`, navbar/footer/about/vision/profil |
| Live web | Chrome on `/communities`, `/ontakiuinmalang`, `/uinux-malang`, `/uinux-malang/profil`, `/ontakiuinmalang/kelembagaan` + in-page `fetch` of tenant vs main APIs |
| Public API | `/api/communities`, `/api/settings`, `/api/c/:slug/settings`, `/api/berita` vs `/api/c/:slug/berita`, invalid slug, store settings |
| Production DB | `himatifwebmain` + `community_ontakiuinmalang` + `community_uinux_malang` + inactive `community_auroradev26` |

Graph MCP (`code-review-graph`) was unavailable this session; fallback was Grep/Read.

---

## Production inventory

| Context | Status | DB | Users | Berita | Events | Library | Prodi docs |
|---------|--------|----|-------|--------|--------|---------|------------|
| Main `himatifwebmain` | live `/` | himatifwebmain | 15 | 62 | 28 | 5 | (main hub) |
| ONTAKI `/ontakiuinmalang` | active | `community_ontakiuinmalang` | 6 | 0 | 2 | 0 | 1 |
| UINUX `/uinux-malang` | active | `community_uinux_malang` | 6 | 0 | 0 | 0 | 1 |
| Aurora `/auroradev26` | **inactive** (hidden) | `community_auroradev26` | 35 | 5 | 20 | 5 | 1 |

Public listing only returns the two active communities (no `dbName` leaked). Tenant berita APIs return `[]` while main returns the three latest Himatif articles — isolation confirmed.

---

## Findings

Severity: **P0** user-visible / security · **P1** correctness · **P2** hygiene / docs / data

### P0 — Branding copy leak (confirmed live)

Shared pages always write Himatif strings, ignoring `settings.siteName` / tenant context.

| Surface | What visitor sees on tenant | Source |
|---------|-----------------------------|--------|
| Tab title (home) | `Himatif Encoder - Himpunan Mahasiswa…` | `client/src/pages/index.tsx` `document.title` + SSR `/` meta only |
| Tab title (profil / kelembagaan / berita) | `Profil \| Himatif Encoder…` etc. | Hardcoded `useEffect` in those pages |
| About heading | **Himatif Encoder** + FST UIN tagline | `client/src/components/public/about.tsx` hardcoded `<h1>` |
| Visi & misi body | Full Himatif visi/misi | `vision-mission.tsx` `defaultVisionMission` when `settings.visionMission` empty (both live tenants) |
| Struktur subtitle | `Kepengurusan Himpunan Mahasiswa Teknik Informatika` | `structure.tsx` |
| Berita section | `…dari HIMATIF ENCODER` | Home berita block + `berita/index.tsx` |
| Profil page | Heading Himatif; “Tentang HIMATIF Encoder”; “Filosofi Lambang HIMATIF Encoder” | `profil.tsx` |
| Kelembagaan intro | `…Himpunan Mahasiswa Teknik Informatika UIN Malang` | `kelembagaan.tsx` |
| Hero “Orang” image | Default Himatif logo (`i.ibb.co/…/LOGO-HMPS-Himatif-Encoder.png`) | `DEFAULT_IMAGE_URL` when tenant has no home-images |
| Footer address | FST Gedung Gajayana (both tenants have empty `address`) | `footer.tsx` fallback |
| Footer email fallback | `himatif.encoder@gmail.com` | Only if tenant email empty (live tenants already set their own) |
| Canonical / meta description | Always `https://himatif-encoder.com` + Himatif copy | Home `useEffect` + SSR |

**Already correct on live tenants:** navbar brand, hero H1/tagline, footer copyright, contact email, login URL `/:slug/login`, no Prodi nav/block, `aboutUs` body (ONTAKI real copy; UINUX placeholder).

### P0 — Auth cookie fallback (code; security)

Same cookie name `authToken` for main and tenant.

1. `server/auth.ts` `authenticate`: if tenant request and user id is **not** in tenant DB and JWT has **no** `tenant` claim, it loads the **main** user and sets `_authResolvedFromMainInTenant`. Write routes still use `resolveStorage(req)` (tenant DB) with `req.user` = main user.
2. `client/src/lib/tenant-auth.tsx`: if `GET /api/c/:slug/auth/me` fails, it falls back to `GET /api/auth/me` and stores that user as `_crossTenant`. Logout of that session hits main `/api/auth/logout` then `setLocation('/')`.

Impact: a logged-in Himatif admin visiting a tenant dashboard can be treated as an authenticated principal against tenant storage. CrossTenantGuard only redirects when the *main* user already has `tenantSlug` of another community.

### P1 — Resolver `tenantName` always slug

`resolveCommunity()` returns `{ dbName, status }` only. `tenant-resolver.ts` then does `(community as { name?: string }).name || slug` → always slug. Anything that displays `req.tenantName` shows `ontakiuinmalang` instead of the community name.

### P1 — Reserved path list drift (`toko`)

`App.tsx` treats `/toko` as a main route. `tenant-api-rewrite.ts` `RESERVED_FIRST_SEGMENTS` does **not** include `toko` (also thinner than App: missing `register`, `error`, maybe more).

`tenantLoginPathFromPathname('/toko/…')` can return `/toko/login` on a 401. Community slug `toko` would also be ambiguous.

### P1 — Docs claim `GET /api/c/:slug/info` exists

`docs/todo/master-todo.md` marks Community shell `GET /api/c/:slug/info` as done. Live: **404**. CommunityShell actually validates via `GET /api/c/:slug/settings`. Either add the endpoint or fix the todo/docs.

### P0 — URL publik + SEO tenant tidak “situs sendiri”

Ini akar “bikin berita di tenant, buka malah 404 / ke berita Himatif”.

| Path yang benar | Path yang masih tertulis di meta / `<a>` |
|-----------------|------------------------------------------|
| `/ontakiuinmalang/berita/{slug}` | `https://himatif-encoder.com/berita/{slug}` (`berita/[id].tsx` canonical + og:url) |
| `/uinux-malang/kelembagaan` | `<a href="/kelembagaan" target="_blank">` di dashboard kelembagaan |
| `/ontakiuinmalang` di sitemap | Tidak ada; sitemap hanya `/`, `/berita`, … + sekarang 500 |

SSR `app.get('/berita/:slugOrId')` hanya `Berita.findOne` di DB utama. Tidak ada handler `/:slug/berita/:article`. Hard-reload / crawler / share link memakai URL utama.

Navbar tidak memakai `logoUrl` (hanya teks brand). SEO `og:site_name` hardcoded `Himatif Encoder`; favicon tidak diganti per tenant.

### P1 — SSR / SEO not tenant-aware (detail)

`server/index.ts` injects Himatif meta only for `/`, `/berita`, `/profil`, `/kelembagaan`, `/library`, `/toko`, `/prodi`, `/login`. Hard reload of `/:slug` and `/:slug/berita/…` gets the generic SPA `index.html` (Himatif title). Client then overwrites with another Himatif title. Sitemap generation also has **no tenant URLs**; `/sitemap.xml` currently returns **HTTP 500** on production.

### P1 — Shared Settings schema defaults are Himatif

`db/mongodb.ts` Settings defaults include Himatif `aboutPageIntro` and a full Himatif `aboutPageTrackRecord`. Tenant models reuse `allSchemas.settings` (`db/tenant.ts`). `new Settings()` / missing fields can inject Himatif sejarah into a community. `initializeTenantSettings` blanks these, but any later `save()` without explicit empty arrays is unsafe.

### P2 — Tenant `ProdiContent` documents exist

Both active tenant DBs have `ProdiContent` count = 1. UI hides Prodi, but `GET /api/prodi` is tenant-aware via `resolveStorage`. Confirm those docs are empty/default, not a copy of TI prodi hub. Policy: reject or 404 Prodi on tenant, or never seed it.

### P2 — Empty social icons

Tenant `socialLinks` are `""`. Footer still renders four icon links pointing at the current tenant page.

### P2 — UINUX track record data quality

UINUX `aboutPageTrackRecord` = 2025 Moh. Salman Al Farisi / 2024 Taufik Hidayat / 2023 Muhammad Faza Abdillah. This is **not** the current main Himatif list (main 2025–2026 is Faizal / Aziz). Confirm with UINUX owner whether this is their real history or leftover seed. Headings still say Himatif regardless.

### P2 — Gaps already in master-todo (not regressions)

No per-tenant branding theme, no community member directory, no tenant-only settings IA beyond shared dashboard settings. CommunityShell has no `/prodi` or `/dashboard/prodi` (good). Registration stays on main (`/register`).

### Not bugs (working as designed)

| Check | Result |
|-------|--------|
| Settings isolation | Main `Himatif Encoder` vs ONTAKI vs UINUX names/emails |
| Berita isolation | Main 62 published-capable rows; both live tenants 0 |
| Fetch rewrite | On tenant page, `/api/settings` === `/api/c/:slug/settings` |
| Invalid slug | 404 JSON `Komunitas tidak ditemukan` |
| Inactive Aurora | Not in `/communities`; resolver requires `status: 'active'` |
| Upload paths | Tenant media under `attached_assets/community/{slug}/…` |
| Public communities payload | Only `_id, name, slug, logoUrl, description` (no `dbName`) |
| Home Prodi block | Absent on both live tenants (`DEFAULT_TENANT_HOME_CONFIG`) |
| Navbar Prodi | Filtered out in tenant navbar |

---

## Fix plan (implement after approval)

Bump after the unit of work: **MINOR `4.15.0`** if URL/SEO/logo + copy land together.

### Phase A — URL publik + SEO + logo (prioritas owner)

1. Helper `publicPath(path)` / `publicAbsoluteUrl(path)` dari `useTenant().basePath` — semua link berita/event/library/toko/breadcrumb/dashboard “lihat halaman” wajib lewat ini (bukan `<a href="/kelembagaan">`).
2. `berita/[id].tsx`: canonical, og:url, og:site_name, JSON-LD `@id` = `https://himatif-encoder.com{basePath}/berita/{slug}`. Title = `{judul} | {siteName}`. `og:image` = gambar berita; fallback logo tenant lalu logo Himatif hanya di main.
3. SSR: `/:slug`, `/:slug/berita/:articleSlug`, profil/kelembagaan/library/events/toko — resolve community aktif, query **tenant** DB, inject title/description/canonical/logo.
4. Sitemap: perbaiki 500; tambah `/{slug}`, `/{slug}/berita`, `/{slug}/berita/{article}` (dan library/event jika ada) untuk komunitas `active`.
5. Navbar: jika `settings.logoUrl` ada, tampilkan logo + `navbarBrand`; favicon/apple-touch-icon ikut `logoUrl` di tenant.
6. Dashboard kelembagaan (dan tautan “buka publik” lain) pakai `basePath` seperti dashboard profil sudah lakukan.

### Phase A2 — Tenant-aware public copy (dashboard-replaceable, bukan hardcode Himatif)

1. Add a small helper, e.g. `usePublicBrand()` from `settings.siteName` + `useTenant()`:
   - `documentTitle`, `metaDescription`, `aboutHeading`, `orgSubtitle`, `beritaEyebrow`, `structureSubtitle`.
   - Main keeps current Himatif strings as **main-only** defaults.
   - Tenant: use `siteName` / `siteTagline`; if empty, use community name from settings, **never** Himatif.
2. Replace hardcoded headings in `about.tsx`, `profil.tsx`, `kelembagaan.tsx`, `vision-mission.tsx`, `structure.tsx`, `berita/index.tsx`, `[id].tsx`, `index.tsx` title effect, `error.tsx` if shown under tenant.
3. `vision-mission.tsx`: if tenant and `visionMission` empty → empty state (“Visi & misi belum diisi”) **not** Himatif defaults.
4. Footer: if tenant and `address` empty → hide map or “Alamat belum diatur”; do not use FST fallback. Same for email/copyright.
5. Hero: tenant without home-images must not use `DEFAULT_IMAGE_URL` Himatif logo (hide orang slot or use tenant `logoUrl`).
6. Hide social icons when URL empty.

### Phase B — Auth isolation

1. Stop resolving main users on tenant `authenticate` unless an explicit, documented “platform admin impersonation” path exists (default: **401**).
2. Remove `tenant-auth.tsx` fallback to `/api/auth/me`. Cross-tenant main users stay logged out of tenant UI (navbar Login), or show a read-only “masuk sebagai Himatif” chip that cannot call tenant write APIs.
3. Guard write handlers: if `_authResolvedFromMainInTenant`, reject mutating methods.
4. Cookie: consider `authToken` vs `authToken_${slug}` **or** always embed `tenant` claim and refuse mismatch. Prefer claim check first (smaller change).
5. Tests: main login cannot `POST /api/c/:slug/berita`; tenant login cannot hit main dashboard; wrong-tenant JWT 401.

### Phase C — Resolver + reserved slugs

1. Cache `{ dbName, status, name }` in `resolveCommunity`; set `req.tenantName` from `name`.
2. Single shared `RESERVED_FIRST_SEGMENTS` used by App, rewrite helper, and Community slug validation on create (reject `toko`, `prodi`, `register`, `sitemap.xml`, …).
3. `GET /api/c/:slug/info` → `{ slug, name, logoUrl, description }` **or** correct master-todo / OpenAPI.
4. SSR + sitemap sudah di Phase A — jangan dobel.

### Phase D — Schema + data

1. Split tenant Settings defaults: no Himatif intro/track record in `allSchemas.settings` when used via `getTenantModels` (clone schema or override defaults).
2. One-shot data review with owners:
   - UINUX track record names
   - ONTAKI/UINUX empty `visionMission`
   - Tenant `ProdiContent` docs → delete or freeze + API 404 on tenant
3. `initializeTenantSettings`: always `$set` `aboutPageIntro: ''`, `aboutPageTrackRecord: []`, `visionMission: ''`.

### Phase E — Docs / verification

1. Update `docs/architecture/multi-tenant.md` (copy rules, auth cookie, reserved slugs, SSR).
2. Update `docs/todo/master-todo.md` (`/info`, branding row).
3. OpenAPI + `docs/api/endpoints.md` if `/info` is added.
4. Manual QA checklist (below) on main + both live tenants + invalid slug + Aurora inactive.
5. `npm run check`. Bump SemVer + release note.

---

## Suggested implementation order

```text
1. Phase A (URL + SEO + logo)  → 404 / ketuker berita / sitemap / logo header
2. Phase A2 (copy dari settings) → heading/title baca dashboard, bukan hardcode Himatif
3. Phase B (auth)              → sesi main tidak nulis ke tenant
4. Phase C (resolver/slugs)    → name + reserved toko
5. Phase D + E                 → schema defaults + docs + bump
```

Do **not** mix this with deploy/history work. Do **not** force-push.

---

## QA checklist (after implement)

- [ ] `/` still 100% Himatif (title, about, visi, SEO)
- [ ] `/ontakiuinmalang` title + about H1 + visi empty-state + no Himatif logo fallback
- [ ] `/uinux-malang` same
- [ ] `/ontakiuinmalang/profil` and `/kelembagaan` use ONTAKI name
- [ ] `/api/berita` ≠ `/api/c/ontakiuinmalang/berita`
- [ ] Invalid `/api/c/nope/settings` → 404
- [ ] `/auroradev26` → not found (inactive)
- [ ] Logged-in main admin on `/ontakiuinmalang/dashboard` cannot write tenant data
- [ ] Tenant owner login only sees tenant dashboard
- [ ] `/toko` 401 never redirects to `/toko/login`
- [ ] View-source `/ontakiuinmalang` has ONTAKI `<title>` / canonical / logo
- [ ] Tenant berita live URL is `/{slug}/berita/{article}` — never canonical `/berita/{article}`
- [ ] Open `/berita/{tenant-article-slug}` on main → 404 Himatif, not the tenant article
- [ ] Dashboard tenant “buka kelembagaan” opens `/{slug}/kelembagaan`
- [ ] Navbar tenant shows `logoUrl` when set (ONTAKI already has one)
- [ ] `/sitemap.xml` 200 and includes `/{slug}` + tenant berita URLs

---

## Out of scope (this plan)

- New community settings / branding color UI (already ❌ in master-todo)
- Member directory, analytics, cross-community sharing
- Filling ONTAKI/UINUX content (visi, berita, hero photos) — owners do that after empty-states exist
- Rewriting git history
