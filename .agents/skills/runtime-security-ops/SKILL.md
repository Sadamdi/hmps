---
name: runtime-security-ops
description: Use when changing HMPS middleware, runtime config, scheduler, cache, backup/restore, web push, Swagger, or operational helpers.
---

# runtime-security-ops

## When to Use

Use for changes in `server/middleware/**`, `server/config/**`, `server/lib/**`, scheduler/backup/restore, `public/sw-push.js`, `server/swagger.ts`, `server/vite.ts`, `ops/deploy-server.sh`, `ops/auto-push-media.sh`, and runtime infrastructure docs.

Production deploy: `ops/deploy-server.sh` — docs-only sync keeps the site up; runtime/lockfile changes stop apps → `npm install --include=dev` → build → healthcheck `:5000`. Never run production `npm install` without `--include=dev` (vite is a devDependency but `dist/index.js` imports it). Auto watcher `/root/auto-deploy.js` lives outside the app repo — do not commit secrets. See `docs/SOP/07-deployment.md`.

## Required References

- `docs/SOP/12-runtime-security-operations.md`
- `docs/SOP/07-deployment.md`
- `docs/SOP/08-error-handling.md`
- `docs/features/10-ops-security/00-README.md`
- `docs/features/12-runtime-infrastructure/00-README.md`

## Workflow

1. Identify runtime surface and blast radius.
2. Fail closed for security/tenant/upload/auth issues.
3. Keep public cache and service worker free of secrets/private data.
4. Respect trusted network/client IP rules.
5. Keep backup/restore OTP-gated.
6. Update runtime infrastructure docs and feature summary.
7. Run `npm run check` and smoke test affected runtime path.

## Safety Checklist

- [ ] No secrets or credential file contents exposed.
- [ ] Logs are safe.
- [ ] Cache is scoped/public-safe.
- [ ] Tenant/main data cannot mix.
- [ ] Middleware errors are safe and actionable.

