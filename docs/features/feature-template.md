#  Feature Document Template — HMPS New

> Template ini untuk feature docs HMPS. Jangan isi request/response dengan contoh generik. Semua contract harus berasal dari source code, OpenAPI, atau runtime verification.

---

##  Feature: [Nama Fitur]

**Author**: HMPS Project Team  
**Created**: [YYYY-MM-DD]  
**Status**: Active | 🔨 In Progress  | Active  | 🧩 Partial  
**Contract Confidence**: Verified from code | Partial from code | Needs runtime verification  
**Category**: [folder kategori]  
**Tenant-Aware**: Yes / No / Conditional  
**Permission Scope**: Public / Authenticated / Admin / Owner / Custom  
**Since version**: [X.Y.Z — first documented / introduced]  
**Last documented version**: [X.Y.Z — last docs sync; see `docs/version/`]  

---

## Deskripsi

Jelaskan fitur berdasarkan implementasi HMPS aktual. Sertakan sumber audit: route, page, service, model, atau OpenAPI.

---

## User Stories

1. Sebagai [role], saya ingin [aksi], agar [manfaat].
2. Sebagai maintainer, saya ingin kontrak fitur terdokumentasi dari code aktual.

---

## UI / User Flow

| Item | Value |
|------|-------|
| UI routes/surfaces | `[verified routes]` |
| Frontend source | `[client/src/...#Lx]` |
| Backend source | `[server/...#Lx]` |

1. ...

---

## Observed Endpoints From Code

| Method | Endpoint | Source | Observed Input | Observed Response |
|--------|----------|--------|----------------|-------------------|
| GET | `/api/...` | `server/routes.ts#Lx` | params/query/body from code | status/body from code |

---

## Observed Request Shape

Tuliskan hanya field yang diverifikasi dari handler, schema, client API call, atau OpenAPI.

```json
{
  "verifiedField": "verified meaning/type"
}
```

If unknown:

> [!WARNING]
> Full request body not verified from static code scan. Check `[source file]` before changing or publishing API docs.

---

## Observed Response Shape

Tuliskan hanya response yang diverifikasi dari handler atau runtime/API docs.

```json
{
  "verified": true
}
```

If mixed/unknown:

> [!WARNING]
> Existing endpoint uses mixed response style or service-derived object. Verify handler/service before depending on exact shape.

---

## Technical Design

### Frontend Surface

- Pages:
- Components:
- Hooks/API helper:
- State:

### Backend Surface

- Route:
- Middleware:
- Service:
- Storage/model:

---

##  Business Rules From Code

1. [verified rule]
2. [verified rule]

---

## Security & Tenant Notes

| Concern | Required Handling |
|---------|-------------------|
| Auth | verified behavior |
| Permission | verified permission or unknown |
| Tenant | main only / tenant-aware / global |
| Sensitive data | fields not returned/logged |

---

## Test Scenarios

| # | Scenario | Input/Action | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Happy path | verified valid request | verified success |
| 2 | Validation error | invalid/missing field | verified safe error |
| 3 | Auth/permission | missing or insufficient auth | 401/403 if applicable |
| 4 | Tenant boundary | wrong slug/context | no cross-tenant leak |

---

## Source References

- `file#Lx`

---

## Unknown / To Verify

- [ ] Exact service-derived response body.
- [ ] Runtime behavior requiring manual test.


