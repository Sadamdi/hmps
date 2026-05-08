# Community Tenant

## Purpose

Community Tenant feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-community-listing-shell.md](./01-community-listing-shell.md) | 01-community-listing-shell.md |
| [02-registration-codes.md](./02-registration-codes.md) | 02-registration-codes.md |
| [03-registration-submit-flow.md](./03-registration-submit-flow.md) | 03-registration-submit-flow.md |
| [04-registration-community-admin.md](./04-registration-community-admin.md) | 04-registration-community-admin.md |
| [05-tenant-api-storage.md](./05-tenant-api-storage.md) | 05-tenant-api-storage.md |
| [06-delete-otp-repair.md](./06-delete-otp-repair.md) | 06-delete-otp-repair.md |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — Community Tenant |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `communities` | 1 | Public community listing. |
| `community` | 3 | Tenant-scoped community API surface. |
| `register` | 3 | Public community registration request flow. |
| `registration` | 12 | Community registration code and community lifecycle management. |

## Endpoint Family Coverage

### communities

| Method | Path |
|--------|------|
| `GET` | `/api/communities` |

### community

| Method | Path |
|--------|------|
| `DELETE` | `/api/community` |
| `POST` | `/api/community/request-delete-otp` |
| `POST` | `/api/community/verify-delete-otp` |

### register

| Method | Path |
|--------|------|
| `POST` | `/api/register/community` |
| `POST` | `/api/register/upload` |
| `POST` | `/api/register/validate-code` |

### registration

| Method | Path |
|--------|------|
| `GET` | `/api/registration/codes` |
| `POST` | `/api/registration/codes` |
| `DELETE` | `/api/registration/codes/{id}` |
| `PATCH` | `/api/registration/codes/{id}` |
| `DELETE` | `/api/registration/codes/{id}/permanent` |
| `GET` | `/api/registration/communities` |
| `DELETE` | `/api/registration/communities/{id}` |
| `PUT` | `/api/registration/communities/{id}` |
| `POST` | `/api/registration/communities/{id}/repair` |
| `POST` | `/api/registration/communities/{id}/request-delete-otp` |
| `POST` | `/api/registration/communities/{id}/verify-delete-otp` |
| `GET` | `/api/registration/communities/health` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
