# OpenAPI Endpoint Coverage — Auth & Access

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the Auth & Access category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## auth

Authentication, sessions, OTP, account security, and profile credentials.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `POST` | `/api/auth/change-email/confirm` | - | `otpCode`, `newEmail` |
| `POST` | `/api/auth/change-email/request-otp` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/auth/change-password` | x-forwarded-for | `newPassword` |
| `POST` | `/api/auth/change-password/confirm` | - | `otpCode`, `currentPassword`, `newPassword` |
| `POST` | `/api/auth/change-password/request-otp` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/auth/forgot-password/confirm` | - | `resetToken`, `newPassword` |
| `POST` | `/api/auth/forgot-password/request-otp` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/auth/forgot-password/verify-otp` | - | `otpCode` |
| `POST` | `/api/auth/login` | - | `password`, `loginTarget` |
| `GET` | `/api/auth/login-targets` | - | - |
| `POST` | `/api/auth/logout` | - | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/auth/me` | - | - |
| `GET` | `/api/auth/permissions` | - | - |
| `PUT` | `/api/auth/profile` | - | `name`, `divisionLabel` |
| `POST` | `/api/auth/refresh-permissions` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/auth/revoke-all-sessions` | - | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/auth/sessions` | - | - |
| `POST` | `/api/auth/sessions/revoke` | - | `#/components/schemas/GenericRequestBody` |

---

## divisions

Organization division and available position management used by access control.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/divisions` | period | - |
| `POST` | `/api/divisions` | - | `displayName`, `description`, `positions`, `color`, `logo`, `period` |
| `DELETE` | `/api/divisions/{id}` | id* | - |
| `PUT` | `/api/divisions/{id}` | id* | `displayName`, `description`, `positions`, `color`, `logo` |
| `GET` | `/api/divisions/available-positions` | period | - |
| `POST` | `/api/divisions/copy` | - | `targetPeriod` |
| `PUT` | `/api/divisions/order` | - | `period`, `orders` |

---

## permissions

Permission listing/creation and owner recomputation.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/permissions` | - | - |
| `POST` | `/api/permissions` | - | `displayName`, `description`, `category` |

---

## roles

Role CRUD and permission assignment.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/roles` | - | - |
| `POST` | `/api/roles` | - | `displayName`, `description`, `level`, `permissions` |
| `DELETE` | `/api/roles/{id}` | id* | - |
| `PUT` | `/api/roles/{id}` | id* | `displayName`, `description`, `permissions`, `level` |
| `GET` | `/api/roles/assignable` | - | - |
| `POST` | `/api/roles/create-with-shift` | - | `displayName`, `description`, `level`, `permissions` |
| `GET` | `/api/roles/levels` | - | - |

---

## users

User management, role assignment, password/email admin changes, and permission overrides.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/users` | - | - |
| `POST` | `/api/users` | - | `password`, `name`, `email`, `role`, `division`, `divisionLabel` |
| `DELETE` | `/api/users/{id}` | id* | - |
| `PUT` | `/api/users/{id}` | id* | `name`, `email`, `role`, `division`, `divisionLabel`, `password` |
| `POST` | `/api/users/{id}/email` | id* | `newEmail` |
| `POST` | `/api/users/{id}/password` | id* | `newPassword` |
| `GET` | `/api/users/{id}/permission-overrides` | id* | - |
| `PUT` | `/api/users/{id}/permission-overrides` | id* | `allow`, `deny` |
| `PUT` | `/api/users/{id}/role` | id* | `role` |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
