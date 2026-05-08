# Backend Relation & Display Helpers

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: runtime infrastructure

---

## Deskripsi

Helper backend lintas fitur yang mengatur relasi attachment/event/library/banner dan display user. Modul ini mendukung fitur content, event, library, media, dan dashboard.

---

## Observed Sources

| Module | Source | Role |
|--------|--------|------|
| Banner render service | `server/banner-render-service.ts` | Runtime helper render banner |
| Event attachments | `server/event-attachments.ts` | Attachment relation helper untuk event/berita |
| Library relations | `server/library-relations.ts` | Helper relasi library/folder/file |
| User display | `server/user-display.ts` | Normalisasi display user yang aman |

---

## Business Rules

1. Helper relasi harus menjaga consistency antara parent-child resource.
2. Cleanup attachment harus sinkron dengan fitur media/upload.
3. User display tidak boleh expose password/session/secret fields.
4. Perubahan helper wajib dicek dampaknya ke berita, events, library, dan dashboard.
