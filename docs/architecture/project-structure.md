# Project Structure — HMPS New

## Root Map

```text
hmps_new/
├── AGENTS.md
├── client/
├── server/
├── shared/
├── db/
├── docs/          ← SOP, features, API, version/release notes
├── ops/           ← production deploy: `deploy-server.sh`, `auto-push-media.sh`
├── public/
├── attached_assets/
├── uploads/
├── scripts/
└── nginx-himatif-encoder.conf
```

## Frontend: `client/src`

| Path | Responsibility |
|------|----------------|
| `App.tsx` | Wouter route composition, protected routes, public notification stream |
| `pages/` | Public pages, dashboard pages, community shell, toko pages |
| `components/` | Reusable UI, dashboard widgets, public sections, auth components |
| `hooks/` | Reusable React hooks and query flows |
| `lib/` | Auth provider, query client, API/client utilities |
| `utils/` | Formatting/helpers |
| `constants/` | Static data/config |
| `index.css` | Tailwind/custom CSS tokens |

## Backend: `server/`

| Path | Responsibility |
|------|----------------|
| `index.ts` | Express bootstrap, sitemap, SSR/static routing, scheduler startup |
| `routes.ts` | Main API registration and orchestration |
| `routes/` | Modular routers: store, store-logic, chat, comments, feedback, notifications, sharing, social-feed, ai-enhance, system-errors |
| `auth.ts` | JWT cookie, session, auth helpers |
| `security.ts` | Helmet/HPP/security middleware wiring |
| `middleware/` | Anti-spoofing, API protection, DDoS, tenant resolver, rate limits |
| `services/` | Business/external: chat, OTP, email, shipping, notification, social-feed, prodi-sync, error-monitor, backup, file-scanner, dll. |
| `mongo-storage.ts` | Main app storage/data access abstraction |
| `tenant-storage.ts` | Tenant-aware storage/data access |
| `models/` | Extra Mongoose models (primary schemas mostly in `db/mongodb.ts`) |
| `upload.ts` | Multer/upload handlers |
| `googleDrive.ts` | Google Drive integration |
| `image-processor.ts` | Image processing helpers |
| `swagger.ts` | OpenAPI/static docs integration |
| `banner-render-service.ts` | Sidecar process for banner template render |

## Shared: `shared/`

- `schema.ts`: shared contracts/types.
- `mediaUtils.ts`: media helper utilities.
- `store-currency.ts`, `store-discounts.ts`, `store-pricing.ts`: store pricing/currency logic.
- `dashboard-spyro-context.ts`: dashboard context constants.

Do not put secrets or server-only dependencies here.

## DB: `db/`

- `mongodb.ts`: **primary** MongoDB/Mongoose schemas and connection.
- `tenant.ts`: tenant database/model support.
- `mongo-seed.ts`: local seed script.
- `mongodb-backup.ts`: backup client/utility.

## Runtime Assets

- `public/`: public static assets.
- `attached_assets/`: source/content assets used by app.
- `uploads/`: runtime upload output. Do not commit sensitive/generated upload files.

## Docs

`docs/` is source of truth for SOP, architecture, feature inventory, API endpoint inventory, todo, and **SemVer release notes** under `docs/version/` (bump setelah setiap unit kerja selesai — SOP 11).

Terakhir diperbarui: 2026-08-12
