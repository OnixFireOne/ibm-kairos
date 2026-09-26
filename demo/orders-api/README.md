# orders-api

A small order service: create orders, price them, read them back.
Business rules live in [docs/SPEC.md](docs/SPEC.md), the HTTP contract in [openapi.yaml](openapi.yaml).

## Run

```bash
pnpm install
DB_URL=postgres://localhost:5432/orders pnpm start
pnpm test
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_URL` | yes | — | Connection string of the orders database |
| `PORT` | no | `3000` | HTTP port |
