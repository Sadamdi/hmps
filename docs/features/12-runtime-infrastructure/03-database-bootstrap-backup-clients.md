# Database Bootstrap & Backup Clients

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: runtime infrastructure

---

## Deskripsi

Dokumentasi script dan client database yang mendukung bootstrap lokal, seed data, backup cluster, dan restore flow.

---

## Observed Sources

| Module | Source | Role |
|--------|--------|------|
| Mongo connection/schema | `db/mongodb.ts` | Koneksi Mongoose dan model utama |
| Seed script | `db/mongo-seed.ts` | Seed akun/data default lokal |
| Backup client | `db/mongodb-backup.ts` | Client backup/snapshot MongoDB |
| Backup service | `server/services/db-backup.ts` | Backup/restore orchestration |

---

## Commands

```powershell
npx tsx db/mongo-seed.ts
```

---

## Security Rules

1. Jangan commit URI database, backup URI, atau dump database.
2. Restore backup wajib OTP sesuai fitur Backup Restore.
3. Seed account hanya untuk bootstrap lokal dan harus diganti sebelum production.
