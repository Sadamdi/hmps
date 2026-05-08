# Security Middleware Modules

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: runtime infrastructure

---

## Deskripsi

Dokumentasi modul middleware keamanan runtime HMPS yang melindungi API, upload, public routes, dan traffic langsung ke backend. Ini bukan fitur UI tunggal, tetapi cross-cutting protection layer untuk seluruh aplikasi.

---

## Observed Sources

| Module | Source | Role |
|--------|--------|------|
| Anti-spoofing | `server/middleware/anti-spoofing-protection.ts` | Validasi header/origin/ip policy agar request palsu tidak mudah bypass |
| API protection | `server/middleware/api-protection.ts` | Proteksi akses API runtime |
| DDoS protection | `server/middleware/ddos-protection.ts` | Rate/traffic protection untuk request abnormal |
| DNS layer protection | `server/middleware/dns-layer-protection.ts` | Proteksi berbasis DNS/network policy |
| Load shedding | `server/middleware/load-shedding.ts` | Menolak/menahan request saat pressure tinggi |
| Public rate limit | `server/middleware/public-rate-limit.ts` | Rate limit endpoint public |
| Registration attempts | `server/middleware/registration-code-attempts.ts` | Proteksi brute-force kode registrasi |
| SQL injection protection | `server/middleware/sql-injection-protection.ts` | Proteksi pattern injection pada request |

---

## Observed Endpoint Contract

Tidak ada endpoint langsung. Middleware ini dipasang di server/route layer dan mempengaruhi response error seperti `403`, `429`, atau safe rejection tergantung modul.

---

## Business Rules

1. Middleware security harus fail-closed untuk traffic mencurigakan.
2. Jangan expose detail rule internal ke client.
3. Runtime toggle harus tetap aman dan terdokumentasi di fitur Runtime Middleware Settings.
4. Tenant route tetap wajib melalui tenant resolver meskipun middleware global aktif.

---

## Source References

- `server/security.ts`
- `server/middleware/anti-spoofing-protection.ts`
- `server/middleware/api-protection.ts`
- `server/middleware/ddos-protection.ts`
- `server/middleware/dns-layer-protection.ts`
- `server/middleware/load-shedding.ts`
- `server/middleware/public-rate-limit.ts`
- `server/middleware/registration-code-attempts.ts`
- `server/middleware/sql-injection-protection.ts`
