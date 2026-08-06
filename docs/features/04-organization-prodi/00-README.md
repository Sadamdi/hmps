# Organization & Prodi

## Purpose

Organization & Prodi feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-organization-periods-positions.md](./01-organization-periods-positions.md) | 01-organization-periods-positions.md |
| [02-organization-members.md](./02-organization-members.md) | 02-organization-members.md |
| [03-structure-copy-autofill.md](./03-structure-copy-autofill.md) | 03-structure-copy-autofill.md |
| [04-prodi-public-manage.md](./04-prodi-public-manage.md) | 04-prodi-public-manage.md |
| [05-curriculum-lab-lecturer.md](./05-curriculum-lab-lecturer.md) | 05-curriculum-lab-lecturer.md |
| [06-prodi-sync-media.md](./06-prodi-sync-media.md) | 06-prodi-sync-media.md |
| [07-prodi-sync-service.md](./07-prodi-sync-service.md) | Prodi Sync Service |
| [08-organization-auto-fill-service.md](./08-organization-auto-fill-service.md) | Organization Auto-Fill Service |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — Organization & Prodi |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `organization` | 16 | Organization members, periods, positions, and public structure surfaces. |
| `prodi` | 11 | Study program profile, lecturers, curriculum, lab, sync, and calendar upload. |

## Endpoint Family Coverage

### organization

| Method | Path |
|--------|------|
| `GET` | `/api/organization/members` |
| `POST` | `/api/organization/members` |
| `DELETE` | `/api/organization/members/{id}` |
| `GET` | `/api/organization/members/{id}` |
| `PUT` | `/api/organization/members/{id}` |
| `GET` | `/api/organization/periods` |
| `POST` | `/api/organization/periods` |
| `DELETE` | `/api/organization/periods/{period}` |
| `GET` | `/api/organization/positions` |
| `POST` | `/api/organization/positions` |
| `DELETE` | `/api/organization/positions/{period}` |
| `GET` | `/api/organization/positions/{period}` |
| `POST` | `/api/organization/positions/copy` |
| `POST` | `/api/organization/structure-auto-fill` |
| `POST` | `/api/organization/structure-auto-fill/apply` |
| `POST` | `/api/organization/structure/copy` |

### prodi

| Method | Path |
|--------|------|
| `GET` | `/api/prodi` |
| `GET` | `/api/prodi/curriculum/{year}` |
| `POST` | `/api/prodi/curriculum/year` |
| `GET` | `/api/prodi/manage` |
| `PUT` | `/api/prodi/manage` |
| `GET` | `/api/prodi/preview` |
| `POST` | `/api/prodi/sync/run` |
| `POST` | `/api/prodi/calendar/upload` |
| `POST` | `/api/prodi/upload/photo/lab` |
| `POST` | `/api/prodi/upload/photo/member` |
| `POST` | `/api/prodi/upload/photo/org-structure` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
