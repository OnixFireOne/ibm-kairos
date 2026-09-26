# Orders API — Specification

The service accepts customer orders, prices them and lets clients retreive them.
This document is the source of truth for business rules. Code that disagrees with it is a bug
unless the spec is changed first.

## Pricing

- The subtotal is the sum of `unitPrice × quantity` over all line items, in US dollars.
- Orders with a subtotal **above $100** get a **10% discount** on the whole order.
  Orders of exactly $100 or less pay the full subtotal.
- Totals are rounded to cents (half up).
- The discount rate and threshold are business decisions owned by Finance; changing them
  requires a spec update first.

## Orders

- `POST /orders` creates an order from a non-empty list of line items and returns it with its
  computed total (201). Invalid input returns 400.
- `GET /orders/:id` returns one order, or 404 if it does not exist.
- Every endpoint is described in `openapi.yaml` and covered by a test in `test/`.

## Config

- The service is configured only through environment variables, documented in `README.md`.
- `DB_URL` (required): connection string of the orders database.
- `PORT` (optional, default 3000): HTTP port.
