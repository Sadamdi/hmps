# Store / Toko

## Purpose

Store / Toko feature category for HMPS. This README is the local index for feature docs, OpenAPI endpoint families, source references, and maintenance rules.

## Feature Documents

| File | Scope |
|------|-------|
| [01-public-storefront-settings.md](./01-public-storefront-settings.md) | 01-public-storefront-settings.md |
| [02-products-categories.md](./02-products-categories.md) | 02-products-categories.md |
| [03-bundles-campaigns.md](./03-bundles-campaigns.md) | 03-bundles-campaigns.md |
| [04-cart-bundle-cart.md](./04-cart-bundle-cart.md) | 04-cart-bundle-cart.md |
| [05-checkout-buy-link.md](./05-checkout-buy-link.md) | 05-checkout-buy-link.md |
| [06-orders-invoices.md](./06-orders-invoices.md) | 06-orders-invoices.md |
| [07-shipping-regional.md](./07-shipping-regional.md) | 07-shipping-regional.md |
| [08-admin-store-operations.md](./08-admin-store-operations.md) | 08-admin-store-operations.md |
| [09-store-media-shares.md](./09-store-media-shares.md) | 09-store-media-shares.md |
| [10-regional-shipping-services.md](./10-regional-shipping-services.md) | Regional & Shipping Services |
| [99-openapi-endpoint-coverage.md](./99-openapi-endpoint-coverage.md) | OpenAPI Endpoint Coverage — Store / Toko |

## OpenAPI Tag Mapping

| Tag | Operations | Endpoint Family |
|-----|------------|-----------------|
| `store` | 57 | Store public/catalog/cart/checkout/admin/regional/shipping/share operations. |

## Endpoint Family Coverage

### store

| Method | Path |
|--------|------|
| `GET` | `/api/store/admin/access-summary` |
| `GET` | `/api/store/admin/bundles` |
| `POST` | `/api/store/admin/bundles` |
| `DELETE` | `/api/store/admin/bundles/{id}` |
| `GET` | `/api/store/admin/bundles/{id}` |
| `PATCH` | `/api/store/admin/bundles/{id}` |
| `GET` | `/api/store/admin/campaigns` |
| `POST` | `/api/store/admin/campaigns` |
| `DELETE` | `/api/store/admin/campaigns/{id}` |
| `PATCH` | `/api/store/admin/campaigns/{id}` |
| `GET` | `/api/store/admin/categories` |
| `POST` | `/api/store/admin/categories` |
| `DELETE` | `/api/store/admin/categories/{id}` |
| `PATCH` | `/api/store/admin/categories/{id}` |
| `DELETE` | `/api/store/admin/orders` |
| `GET` | `/api/store/admin/orders` |
| `DELETE` | `/api/store/admin/orders/{orderNo}` |
| `PATCH` | `/api/store/admin/orders/{orderNo}` |
| `GET` | `/api/store/admin/products` |
| `POST` | `/api/store/admin/products` |
| `DELETE` | `/api/store/admin/products/{id}` |
| `GET` | `/api/store/admin/products/{id}` |
| `PATCH` | `/api/store/admin/products/{id}` |
| `GET` | `/api/store/admin/products/{id}/shares` |
| `POST` | `/api/store/admin/products/{id}/shares` |
| `PATCH` | `/api/store/admin/products/reorder` |
| `GET` | `/api/store/admin/settings` |
| `PUT` | `/api/store/admin/settings` |
| `DELETE` | `/api/store/admin/shares/{shareId}` |
| `POST` | `/api/store/admin/upload-product-image` |
| `POST` | `/api/store/admin/uploads/cleanup` |
| `POST` | `/api/store/buy-link` |
| `GET` | `/api/store/cart` |
| `POST` | `/api/store/cart/bundles` |
| `DELETE` | `/api/store/cart/bundles/{bundleId}` |
| `PATCH` | `/api/store/cart/bundles/{bundleId}` |
| `POST` | `/api/store/cart/draft` |
| `POST` | `/api/store/cart/items` |
| `DELETE` | `/api/store/cart/items/{productId}` |
| `PATCH` | `/api/store/cart/items/{productId}` |
| `POST` | `/api/store/checkout` |
| `POST` | `/api/store/direct-checkout` |
| `GET` | `/api/store/my-orders` |
| `GET` | `/api/store/orders/{orderNo}` |
| `GET` | `/api/store/public/bundles` |
| `GET` | `/api/store/public/bundles/{slug}` |
| `GET` | `/api/store/public/campaigns` |
| `GET` | `/api/store/public/categories` |
| `GET` | `/api/store/public/gdrive-image/{fileId}` |
| `GET` | `/api/store/public/products` |
| `GET` | `/api/store/public/products/{slug}` |
| `GET` | `/api/store/public/regional/districts/{code}/villages` |
| `GET` | `/api/store/public/regional/provinces` |
| `GET` | `/api/store/public/regional/provinces/{code}/regencies` |
| `GET` | `/api/store/public/regional/regencies/{code}/districts` |
| `GET` | `/api/store/public/settings` |
| `POST` | `/api/store/shipping/quote` |

## Source References

See the feature documents and [OpenAPI Endpoint Coverage](./99-openapi-endpoint-coverage.md) for file-level references and route contracts.

## Maintenance Checklist

- [ ] Add/update feature doc when endpoint/page/service behavior changes.
- [ ] Keep this README endpoint family table aligned with `docs/openapi.json`.
- [ ] Update `../feature-summary.md` when feature count or category scope changes.
- [ ] Do not include secrets, OTP values, tokens, or credential contents.
