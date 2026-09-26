# Orders API spec

Service for creating and listing orders.

## Pricing

Orders above $100 (DISCOUNT_THRESHOLD) get a 10% discount.
The discount is applied by `applyDiscount`.

### Rounding

Totals are rounded to 2 decimals.

## Orders

- `GET /orders` lists orders.
- `POST /orders` creates an order.
- Orders are never deleted.

## Config

See the README for environment variables.

```md
# not a heading (inside a code fence)
```
