# Auth & Access

## Purpose

Auth & Access feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-login-logout.md](./01-login-logout.md) | 01-login-logout.md |
| [02-session-management.md](./02-session-management.md) | 02-session-management.md |
| [03-otp-password-email.md](./03-otp-password-email.md) | 03-otp-password-email.md |
| [04-user-management.md](./04-user-management.md) | 04-user-management.md |
| [05-roles-permissions-divisions.md](./05-roles-permissions-divisions.md) | 05-roles-permissions-divisions.md |
| [06-profile-management.md](./06-profile-management.md) | Profile Management |
| [07-auth-permission-refresh.md](./07-auth-permission-refresh.md) | Auth Permission Refresh |
| [08-email-otp-services.md](./08-email-otp-services.md) | Email & OTP Services |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — Auth & Access |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `auth` | 18 | Authentication, sessions, OTP, account security, and profile credentials. |
| `divisions` | 7 | Organization division and available position management used by access control. |
| `permissions` | 2 | Permission listing/creation and owner recomputation. |
| `roles` | 7 | Role CRUD and permission assignment. |
| `users` | 9 | User management, role assignment, password/email admin changes, and permission overrides. |

## Endpoint Family Coverage

### auth

| Method | Path |
|--------|------|
| `POST` | `/api/auth/change-email/confirm` |
| `POST` | `/api/auth/change-email/request-otp` |
| `POST` | `/api/auth/change-password` |
| `POST` | `/api/auth/change-password/confirm` |
| `POST` | `/api/auth/change-password/request-otp` |
| `POST` | `/api/auth/forgot-password/confirm` |
| `POST` | `/api/auth/forgot-password/request-otp` |
| `POST` | `/api/auth/forgot-password/verify-otp` |
| `POST` | `/api/auth/login` |
| `GET` | `/api/auth/login-targets` |
| `POST` | `/api/auth/logout` |
| `GET` | `/api/auth/me` |
| `GET` | `/api/auth/permissions` |
| `PUT` | `/api/auth/profile` |
| `POST` | `/api/auth/refresh-permissions` |
| `POST` | `/api/auth/revoke-all-sessions` |
| `GET` | `/api/auth/sessions` |
| `POST` | `/api/auth/sessions/revoke` |

### divisions

| Method | Path |
|--------|------|
| `GET` | `/api/divisions` |
| `POST` | `/api/divisions` |
| `DELETE` | `/api/divisions/{id}` |
| `PUT` | `/api/divisions/{id}` |
| `GET` | `/api/divisions/available-positions` |
| `POST` | `/api/divisions/copy` |
| `PUT` | `/api/divisions/order` |

### permissions

| Method | Path |
|--------|------|
| `GET` | `/api/permissions` |
| `POST` | `/api/permissions` |

### roles

| Method | Path |
|--------|------|
| `GET` | `/api/roles` |
| `POST` | `/api/roles` |
| `DELETE` | `/api/roles/{id}` |
| `PUT` | `/api/roles/{id}` |
| `GET` | `/api/roles/assignable` |
| `POST` | `/api/roles/create-with-shift` |
| `GET` | `/api/roles/levels` |

### users

| Method | Path |
|--------|------|
| `GET` | `/api/users` |
| `POST` | `/api/users` |
| `DELETE` | `/api/users/{id}` |
| `PUT` | `/api/users/{id}` |
| `POST` | `/api/users/{id}/email` |
| `POST` | `/api/users/{id}/password` |
| `GET` | `/api/users/{id}/permission-overrides` |
| `PUT` | `/api/users/{id}/permission-overrides` |
| `PUT` | `/api/users/{id}/role` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
