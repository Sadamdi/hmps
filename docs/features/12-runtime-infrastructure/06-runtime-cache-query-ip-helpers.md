# Runtime Cache, Query Limit & Client IP Helpers

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: runtime infrastructure

---

## Deskripsi

Helper runtime kecil yang mempengaruhi keamanan request, performa JSON public, dan batas query Mongo. Ini bukan fitur UI/API tunggal, tetapi guardrail lintas endpoint.

---

## Observed Sources

| Module | Source | Role |
|--------|--------|------|
| Client IP helper | `server/lib/client-ip.ts` | Normalisasi IP client untuk rate-limit, audit, OTP, dan security logging |
| Mongo query limits | `server/lib/mongo-query-limits.ts` | Guardrail limit query Mongo agar list/search tidak terlalu besar |
| Public JSON cache | `server/lib/public-json-cache.ts` | Cache response JSON public |
| Short cache | `server/lib/short-cache.ts` | Cache TTL pendek untuk endpoint/runtime hot path |

---

## Business Rules

1. IP extraction harus aman terhadap spoofed proxy header.
2. Query limit harus mencegah payload/list besar tanpa merusak UX.
3. Cache public tidak boleh menyimpan data private, tenant-private, token, OTP, atau credential.
4. Perubahan TTL/cache harus dicek ke endpoint public, tenant, dan dashboard.

---

## Related Feature Docs

- `10-ops-security/01-security-middleware.md`
- `10-ops-security/02-runtime-middleware-settings.md`
- `12-runtime-infrastructure/01-security-middleware-modules.md`
