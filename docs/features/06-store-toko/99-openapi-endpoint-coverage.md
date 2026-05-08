# OpenAPI Endpoint Coverage — Store / Toko

**Status**: Active | **Source**: `docs/openapi.json` | **Generated From**: OpenAPI operation inventory

---

## Purpose

This document provides explicit endpoint-level coverage for the Store / Toko category. It complements the human-written feature docs by listing every OpenAPI operation mapped to this category.

> [!IMPORTANT]
> Request body fields below are generated from OpenAPI schemas. When OpenAPI uses `GenericRequestBody`, treat the request contract as broad/placeholder and verify against route code before changing clients.

---

## store

Store public/catalog/cart/checkout/admin/regional/shipping/share operations.

| Method | Path | Params / Headers | Request Body Fields |
|--------|------|------------------|---------------------|
| `GET` | `/api/store/admin/access-summary` | - | - |
| `GET` | `/api/store/admin/bundles` | - | - |
| `POST` | `/api/store/admin/bundles` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/store/admin/bundles/{id}` | id* | - |
| `GET` | `/api/store/admin/bundles/{id}` | id* | - |
| `PATCH` | `/api/store/admin/bundles/{id}` | id* | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/store/admin/campaigns` | - | - |
| `POST` | `/api/store/admin/campaigns` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/store/admin/campaigns/{id}` | id* | - |
| `PATCH` | `/api/store/admin/campaigns/{id}` | id* | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/store/admin/categories` | - | - |
| `POST` | `/api/store/admin/categories` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/store/admin/categories/{id}` | id* | - |
| `PATCH` | `/api/store/admin/categories/{id}` | id* | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/store/admin/orders` | confirm | - |
| `GET` | `/api/store/admin/orders` | - | - |
| `DELETE` | `/api/store/admin/orders/{orderNo}` | orderNo* | - |
| `PATCH` | `/api/store/admin/orders/{orderNo}` | orderNo* | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/store/admin/products` | forReorder, page, limit | - |
| `POST` | `/api/store/admin/products` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/store/admin/products/{id}` | id* | - |
| `GET` | `/api/store/admin/products/{id}` | id* | - |
| `PATCH` | `/api/store/admin/products/{id}` | id* | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/store/admin/products/{id}/shares` | id* | - |
| `POST` | `/api/store/admin/products/{id}/shares` | id* | `#/components/schemas/GenericRequestBody` |
| `PATCH` | `/api/store/admin/products/reorder` | - | `orderedIds` |
| `GET` | `/api/store/admin/settings` | - | - |
| `PUT` | `/api/store/admin/settings` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/store/admin/shares/{shareId}` | shareId* | - |
| `POST` | `/api/store/admin/upload-product-image` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/store/admin/uploads/cleanup` | - | `urls` |
| `POST` | `/api/store/buy-link` | - | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/store/cart` | - | - |
| `POST` | `/api/store/cart/bundles` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/store/cart/bundles/{bundleId}` | bundleId* | - |
| `PATCH` | `/api/store/cart/bundles/{bundleId}` | bundleId* | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/store/cart/draft` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/store/cart/items` | - | `#/components/schemas/GenericRequestBody` |
| `DELETE` | `/api/store/cart/items/{productId}` | productId* | - |
| `PATCH` | `/api/store/cart/items/{productId}` | productId* | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/store/checkout` | - | `#/components/schemas/GenericRequestBody` |
| `POST` | `/api/store/direct-checkout` | - | `#/components/schemas/GenericRequestBody` |
| `GET` | `/api/store/my-orders` | - | - |
| `GET` | `/api/store/orders/{orderNo}` | orderNo*, inv | - |
| `GET` | `/api/store/public/bundles` | - | - |
| `GET` | `/api/store/public/bundles/{slug}` | slug* | - |
| `GET` | `/api/store/public/campaigns` | - | - |
| `GET` | `/api/store/public/categories` | - | - |
| `GET` | `/api/store/public/gdrive-image/{fileId}` | fileId* | - |
| `GET` | `/api/store/public/products` | q, category, page, limit, sort | - |
| `GET` | `/api/store/public/products/{slug}` | slug* | - |
| `GET` | `/api/store/public/regional/districts/{code}/villages` | code* | - |
| `GET` | `/api/store/public/regional/provinces` | - | - |
| `GET` | `/api/store/public/regional/provinces/{code}/regencies` | code* | - |
| `GET` | `/api/store/public/regional/regencies/{code}/districts` | code* | - |
| `GET` | `/api/store/public/settings` | - | - |
| `POST` | `/api/store/shipping/quote` | - | `#/components/schemas/GenericRequestBody` |

---

## Maintenance

- Update this file when `docs/openapi.json` changes.
- Keep related human feature docs in this category synchronized.
- Do not document secret values, tokens, OTP values, API keys, or service-account contents.
