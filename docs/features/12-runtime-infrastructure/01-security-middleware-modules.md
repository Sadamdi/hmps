# Security Middleware Modules

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: runtime infrastructure

---

## Deskripsi

Dokumentasi modul middleware keamanan runtime HMPS yang melindungi API, upload, public routes, dan traffic langsung ke backend. Ini bukan fitur UI tunggal, tetapi cross-cutting protection layer untuk seluruh aplikasi.

---

## Observed Sources

| Module | Source | Role |
|--------|--------|------|
| Anti-spoofing | `server/middleware/anti-spoofing-protection.ts` | Validasi header/origin/ip policy; toggle `antiSpoofingProtectionEnabled` (+ `allEnabled`) |
| API protection | `server/middleware/api-protection.ts` | Proteksi akses API runtime; toggle `apiProtectionEnabled` |
| API rate limit | `server/middleware/api-protection.ts` | Global API rate limit; toggle `apiRateLimitEnabled` |
| DDoS protection | `server/middleware/ddos-protection.ts` | Rate/traffic protection; toggle `ddosProtectionEnabled` |
| DNS layer protection | `server/middleware/dns-layer-protection.ts` | Proteksi berbasis DNS/network policy; toggle `dnsLayerProtectionEnabled` |
| Load shedding | `server/middleware/load-shedding.ts` | Menolak/menahan request saat pressure tinggi |
| Public rate limit | `server/middleware/public-rate-limit.ts` | Per-endpoint public RL (feedback/comment/chat/store/gdrive); IP + device (tanpa IP) + optional guestKey |
| Post-body sanitize | `server/middleware/post-body-sanitize.ts` | Sanitize nested strings **after** body parsers; reject XSS probes on public writes |
| Input sanitize helpers | `server/utils/input-sanitize.ts` | `sanitizePlainText`, `sanitizeRichHtml`, `stripUnsafeHtml`, `hashIp` |
| Registration attempts | `server/middleware/registration-code-attempts.ts` | Proteksi brute-force kode registrasi |
| SQL/XSS injection protection | `server/middleware/sql-injection-protection.ts` | Pattern checks for non-API routes (API JSON body handled post-parse) |

---

## Mount Order (critical)

1. Load shedding / Helmet / HPP / DDoS / API protection / SQL MW / anti-spoof / DNS
2. Tenant resolver
3. Security logger
4. `express.json` + `urlencoded`
5. `sanitizeInput` + **`postBodySanitizeMiddleware`** (must be after parsers)
6. Routes (multer may fill multipart later — route handlers still sanitize)

> Previously `sanitizeInput` ran **before** body parsers, so JSON API bodies were not scrubbed.

---

## Public Rate Limit Notes

| Limiter | Typical caps (balanced) |
|---------|-------------------------|
| Feedback | ~20/IP/hour, ~15/device/hour, ~10/guestKey/hour |
| Comment | 100/IP/min, 10/device/min (+ daily caps) |
| Chat upload/message | soft per-minute + daily |
| Chat session create/delete | soft per-minute |
| Store checkout / buy-link | ~30/IP/hour |
| GDrive proxy POSTs | ~60/IP/min |

Device fingerprint intentionally **excludes IP** so proxy rotation cannot reset the device bucket. Feedback also keys on `x-guest-key`.

---

## Observed Endpoint Contract

Tidak ada endpoint langsung. Middleware ini dipasang di server/route layer dan mempengaruhi response error seperti `400` (XSS reject), `403`, `429`, atau safe rejection tergantung modul.

Toggle runtime: lihat `10-ops-security/02-runtime-middleware-settings.md` (owner-only).

---

## Business Rules

1. Middleware security harus fail-closed untuk traffic mencurigakan tanpa membuat user normal cepat kena 429.
2. Jangan expose detail rule internal ke client.
3. Runtime toggle harus tetap aman; `allEnabled` master switch dihormati modul yang membaca settings.
4. Tenant route tetap wajib melalui tenant resolver meskipun middleware global aktif.
5. Rich HTML CMS (berita/events/store) memakai allowlist sanitize di write path; public text fields reject XSS probes.

---

## Source References

- `server/index.ts`
- `server/security.ts`
- `server/middleware/anti-spoofing-protection.ts`
- `server/middleware/api-protection.ts`
- `server/middleware/ddos-protection.ts`
- `server/middleware/dns-layer-protection.ts`
- `server/middleware/load-shedding.ts`
- `server/middleware/public-rate-limit.ts`
- `server/middleware/post-body-sanitize.ts`
- `server/middleware/registration-code-attempts.ts`
- `server/middleware/sql-injection-protection.ts`
- `server/utils/input-sanitize.ts`
