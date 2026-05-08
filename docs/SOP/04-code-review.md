# SOP 04 — Code Review HMPS

## Review Order

1. Gunakan `code-review-graph` MCP jika tersedia.
2. Review changed files dan impact radius.
3. Fokus pada correctness, security, tenant, media cleanup, dan docs.
4. Jalankan verifikasi relevan.

## Checklist Umum

- [ ] Requirement terpenuhi.
- [ ] Tidak ada secret/API key/credential.
- [ ] `npm run check` lolos.
- [ ] Docs update jika endpoint/fitur berubah.

## Backend Checklist

- [ ] Endpoint protected memakai auth/permission.
- [ ] Input body/query/params divalidasi.
- [ ] Tenant context tidak dipercaya dari client.
- [ ] Query tenant-aware scoped benar.
- [ ] Error response aman.
- [ ] Operasi sensitif punya log/activity bila relevan.

## Frontend Checklist

- [ ] Loading/error/empty/success state ada.
- [ ] Permission UX sinkron dengan backend behavior.
- [ ] API helper/hook tidak duplikasi logic besar.
- [ ] Route baru masuk App dengan urutan aman terhadap `/:slug/*` community catch-all.

## Module-Specific Checklist

- Store: harga, diskon, stok, checkout, order state.
- Media: mimetype, size, cleanup, public URL.
- Chat: permission tools dan secret server-side.
- Notification: tidak leak tenant/private event.
- Backup: OTP dan tenant restore target benar.
