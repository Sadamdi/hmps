# Frontend Route & Page Inventory

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: auxiliary runtime

---

## Deskripsi

Inventory eksplisit seluruh page-level frontend HMPS agar coverage fitur tidak hanya tercatat secara konseptual di kategori backend/API.

---

## Observed Page Files

| # | Page File | Feature Area |
|---|-----------|--------------|
| 1 | `client/src/pages/artikel/detail.tsx` | auxiliary |
| 2 | `client/src/pages/berita/[id].tsx` | public/community/auth |
| 3 | `client/src/pages/berita/index.tsx` | public/community/auth |
| 4 | `client/src/pages/communities.tsx` | public/community/auth |
| 5 | `client/src/pages/community/index.tsx` | public/community/auth |
| 6 | `client/src/pages/dashboard/berita.tsx` | dashboard |
| 7 | `client/src/pages/dashboard/events.tsx` | dashboard |
| 8 | `client/src/pages/dashboard/feedback.tsx` | dashboard |
| 9 | `client/src/pages/dashboard/index.tsx` | dashboard |
| 10 | `client/src/pages/dashboard/kelembagaan.tsx` | dashboard |
| 11 | `client/src/pages/dashboard/library.tsx` | dashboard |
| 12 | `client/src/pages/dashboard/prodi.tsx` | dashboard |
| 13 | `client/src/pages/dashboard/profil.tsx` | dashboard |
| 14 | `client/src/pages/dashboard/registration.tsx` | dashboard |
| 15 | `client/src/pages/dashboard/roles.tsx` | dashboard |
| 16 | `client/src/pages/dashboard/settings.tsx` | dashboard |
| 17 | `client/src/pages/dashboard/toko.tsx` | dashboard |
| 18 | `client/src/pages/dashboard/users.tsx` | dashboard |
| 19 | `client/src/pages/error.tsx` | auxiliary |
| 20 | `client/src/pages/events/[year].tsx` | events library |
| 21 | `client/src/pages/events/[year]/[eventId].tsx` | events library |
| 22 | `client/src/pages/events/all.tsx` | events library |
| 23 | `client/src/pages/events/index.tsx` | events library |
| 24 | `client/src/pages/index.tsx` | public/community/auth |
| 25 | `client/src/pages/kelembagaan.tsx` | organization prodi |
| 26 | `client/src/pages/library/detail.tsx` | events library |
| 27 | `client/src/pages/library/index.tsx` | events library |
| 28 | `client/src/pages/not-found.tsx` | auxiliary |
| 29 | `client/src/pages/prodi.tsx` | organization prodi |
| 30 | `client/src/pages/prodi/curriculum/[slug].tsx` | organization prodi |
| 31 | `client/src/pages/prodi/dosen/[slug].tsx` | organization prodi |
| 32 | `client/src/pages/prodi/laboratorium/[type]/[index].tsx` | organization prodi |
| 33 | `client/src/pages/profil.tsx` | public/community/auth |
| 34 | `client/src/pages/register.tsx` | public/community/auth |
| 35 | `client/src/pages/toko/[slug].tsx` | store toko |
| 36 | `client/src/pages/toko/cart.tsx` | store toko |
| 37 | `client/src/pages/toko/index.tsx` | store toko |
| 38 | `client/src/pages/toko/order/[orderNo].tsx` | store toko |
| 39 | `client/src/pages/toko/orders/index.tsx` | store toko |

---

## Maintenance Rule

When a new page is added under `client/src/pages/**`, add or update a feature doc in the closest category and update this inventory.
