# Frontend Constants & Formatting Utilities

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: runtime infrastructure

---

## Deskripsi

Utility frontend kecil yang dipakai banyak halaman untuk fallback image dan formatting rich content. Ini tidak memiliki API sendiri tetapi mempengaruhi rendering user-facing.

---

## Observed Sources

| Module | Source | Role |
|--------|--------|------|
| Default image | `client/src/constants/default-image.ts` | Fallback/default image constants |
| Content formatter | `client/src/utils/formatContent.ts` | Formatting/sanitizing display content |

---

## Business Rules

1. Fallback image harus aman dan tersedia untuk public route.
2. Formatter konten tidak boleh membuat XSS vector baru.
3. Perubahan formatting wajib dicek di berita, event, library, profil, dan prodi pages.
