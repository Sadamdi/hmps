# Login Logout

**Status**: Active | **Contract Confidence**: Verified from route scan  | **Category**: auth access

---

## Deskripsi

Fitur **Login Logout** terdokumentasi ulang dari audit code HMPS New, bukan dari payload template. Endpoint, parameter, body field, dan status response di bawah berasal dari static scan terhadap route handler di `server/routes.ts` dan `server/routes/*.ts` dan hanya membaca file HMPS New.

---

## User Stories

1. Sebagai user/admin HMPS, saya ingin memakai fitur **Login Logout** melalui UI terkait agar kebutuhan operasional atau informasi terpenuhi.
2. Sebagai maintainer, saya ingin mengetahui endpoint dan source file aktual agar perubahan tidak salah kontrak.
3. Sebagai reviewer, saya ingin melihat field request/response yang terdeteksi dari code agar tidak mengandalkan contoh generik.

---

## UI / User Flow

| Item | Value |
|------|-------|
| UI routes/surfaces | `/login` |
| Frontend source | `client/src/App.tsx`, `client/src/pages/**`, targeted components/hooks |
| Backend source | Route table below |

Flow umum:

1. UI membuka route/surface di atas.
2. UI mengirim request ke endpoint yang relevan.
3. Backend melakukan validasi, auth/permission, dan tenant resolver bila endpoint tenant-aware.
4. Handler memanggil storage/service/model terkait.
5. Response dikembalikan sesuai handler aktual.

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| POST | `/api/auth/login` | `server/routes.ts#L1144` | body: username, password, loginTarget | 409, 500 |
| GET | `/api/auth/login-targets` | `server/routes.ts#L1338` | none observed in handler window | 200/json |
| POST | `/api/auth/logout` | `server/routes.ts#L1362` | none observed in handler window | 200/json |
| GET | `/api/auth/me` | `server/routes.ts#L1441` | none observed in handler window | 200/json |

---

## Observed Request Shape

- `POST /api/auth/login` body fields observed: `username`

> [!IMPORTANT]
> Field di atas adalah hasil static scan sekitar route handler. Untuk perubahan implementasi, buka source file dan line yang tercantum untuk memastikan validasi lengkap, default value, dan transformasi data.

---

## Observed Response Shape

Static scan menemukan pola response berikut:

- Status JSON yang terdeteksi: `200/json, 409, 500`
- Banyak endpoint existing HMPS masih memakai campuran `{ message }`, array langsung, object langsung, atau `{ success, data }` tergantung handler.
- Jangan menulis contoh response final kecuali sudah dicek pada handler spesifik.

Recommended response untuk endpoint baru tetap mengikuti SOP API:

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

---

## Technical Design

### Frontend Surface

| Concern | Actual Pattern |
|---------|----------------|
| Routing | Wouter route composition in `client/src/App.tsx` |
| Server State | TanStack React Query / API helper where implemented |
| UI States | Loading, empty, error, success state expected for async surfaces |
| Permission UX | UI guard is convenience only; backend remains source of truth |

### Backend Surface

| Concern | Actual Pattern |
|---------|----------------|
| Route orchestration | `server/routes.ts` for core modules; `server/routes/*.ts` for modular features |
| Business logic | `server/services/**`, storage helpers, or route-local orchestration |
| Data access | `server/mongo-storage.ts`, `server/tenant-storage.ts`, `db/mongodb.ts`, `server/models/**` |
| Contracts | Mixed existing response style; new work should follow `docs/SOP/06-api-design.md` |

---

## Business Rules From Project Standards

1. Validate params/query/body before database or external service calls.
2. Enforce auth and permission on protected/dashboard/admin routes server-side.
3. For tenant-aware behavior, trust tenant context only from server resolver.
4. Never expose password hashes, OTP, JWT/session token, Gemini key, Google credential, SMTP password, backup URI, or raw stack trace.
5. Update `docs/api/endpoints.md`, OpenAPI docs, and this feature doc when endpoint behavior changes.

---

## Security & Tenant Notes

| Concern | Required Handling |
|---------|-------------------|
| Auth | Verify handler/middleware in source lines listed above |
| Permission | Verify permission key/check in handler before changing behavior |
| Tenant | Use `/api/c/:slug/*` resolver/storage when feature is tenant-aware |
| Upload | Validate MIME/size/path and cleanup temporary files |
| Logging | Log user/resource/tenant/action without secrets |

---

## Test Scenarios

| # | Scenario | Input/Action | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Happy path | valid UI/API request | handler returns success response shown by source |
| 2 | Validation error | missing/invalid observed fields | safe 400/validation-style error if handler validates |
| 3 | Unauthorized | no/invalid session on protected route | 401 or 403 based on handler/middleware |
| 4 | Not found | invalid id/slug | 404 or safe message based on handler |
| 5 | Tenant boundary | wrong community slug/context | no cross-tenant data access |
| 6 | Regression | `npm run check` | TypeScript passes |

---

## Source References

- Feature doc: `01-auth-access/01-login-logout.md`
- UI: `/login`
- Endpoint sources: `server/routes.ts`
- Endpoint inventory: `docs/api/endpoints.md`
- Feature summary: `docs/features/feature-summary.md`

---

## Unknown / To Verify

- Exact full response body per endpoint should be confirmed in the listed handler before publishing external API docs.
- Some handlers build response objects through storage/service return values; inspect service/model before changing contracts.
- Client-side payload may include transformed fields not visible from backend static scan.

---

## Masuk dengan Google (4.29.0)

| Item | Value |
|------|-------|
| UI | Tombol **Masuk dengan Google** di `/login` dan `/:slug/login` (di atas form, pemisah "atau"), gaya standar Google (logo G 4 warna, terang putih/border `#747775`, gelap `#131314`/border `#8E918F`) |
| Client | `client/src/components/auth/google-sign-in-button.tsx`, `client/src/lib/google-signin.ts` (Firebase SDK di-lazy-load saat klik, popup `select_account`, persistence in-memory, langsung `signOut` Firebase setelah token didapat), `useAuth().loginWithGoogle` (`lib/auth.tsx`, `lib/tenant-auth.tsx`) |
| Server | `POST /api/auth/login/google` (`server/routes.ts`), verifikasi `server/services/google-login.ts` (jose + JWKS securetoken Google) |
| Config | `GET /api/auth/firebase-config` → `{ enabled, config: { apiKey, authDomain, projectId, appId } }` dari env server `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` (config publik Web SDK, bukan secret; ganti env cukup restart tanpa build). Tombol tersembunyi bila belum dikonfigurasi. |

Keamanan:

- ID token diverifikasi server: tanda tangan RS256 (JWKS Google), `iss=https://securetoken.google.com/<project>`, `aud=<project>`, `exp`/`iat`, `auth_time` ≤ 10 menit, `firebase.sign_in_provider=google.com`, `email_verified=true`.
- Pencocokan **hanya email persis** (lowercase) ke user yang sudah ada — **tidak pernah membuat akun baru**. Email tidak terdaftar → 403 `GOOGLE_EMAIL_NOT_REGISTERED` (tercatat di login attempts sebagai `not_found`).
- Konteks sama dengan login password: halaman komunitas → hanya user komunitas itu; `loginTarget` → konteks itu; auto-detect utama + komunitas aktif → 409 `ambiguous` bila lebih dari satu (UI menyimpan token sementara untuk memilih tujuan).
- Sesi tetap dari `finalizeLogin` (cookie `authToken` + `sid`, log sukses, retensi sesi) dan rate limit `loginLimiter`/proteksi `/api/auth/login*`.
- Helmet: COOP `same-origin-allow-popups` (popup Google), CSP `script-src https://apis.google.com`, `frame-src https://*.firebaseapp.com https://accounts.google.com`.
- Firebase Analytics sengaja tidak dipasang (tidak ada consent banner).

Setup Firebase Console (sekali): Authentication → Sign-in method → Google **Enabled**; Authentication → Settings → **Authorized domains**: `himatif-encoder.com` (+ `localhost` untuk dev).

| Status | Code |
|--------|------|
| 200 | user tanpa password + `authScope`, `tenantSlug` |
| 400 | `VALIDATION_ERROR` |
| 401 | `GOOGLE_TOKEN_INVALID`, `GOOGLE_TOKEN_STALE`, `GOOGLE_EMAIL_UNVERIFIED`, `GOOGLE_PROVIDER_INVALID` |
| 403 | `GOOGLE_EMAIL_NOT_REGISTERED` |
| 409 | `{ ambiguous: true, targets[] }` |
| 429 | rate limit login |
| 503 | `GOOGLE_LOGIN_DISABLED` |
