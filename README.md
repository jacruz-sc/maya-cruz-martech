# Maya Send Money API

Production-boundary backend implementation of the Martech send-money assessment. It provides internal PHP transfers, atomic balance updates, PHT daily/monthly spending limits, JWT authentication, transaction history, OpenAPI documentation, and Prometheus-compatible monitoring.

## Run immediately with Docker

Prerequisites: Docker Desktop with Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

The API is available at `http://localhost:3000`; Swagger UI is at `http://localhost:3000/docs`. Migrations and idempotent seed data run automatically. Health endpoints are `/health/live` and `/health/ready`; Prometheus metrics are exposed at `/metrics`.

Seed users all use password `MayaDemo123!`:

| Email               | Name         | Opening balance |
| ------------------- | ------------ | --------------: |
| alice@example.com   | Alice Santos |  PHP 100,000.00 |
| bob@example.com     | Bob Reyes    |   PHP 75,000.00 |
| charlie@example.com | Charlie Lim  |   PHP 50,000.00 |

## Example flow

```bash
# Login
curl -s http://localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"MayaDemo123!"}'

# Transfer (replace TOKEN and RECIPIENT_ID with values from your environment)
curl -s http://localhost:3000/v1/transfers -H "authorization: Bearer TOKEN" \
  -H 'content-type: application/json' -H 'idempotency-key: alice-bob-001' \
  -d '{"recipientId":"RECIPIENT_ID","amount":"1250.50"}'

# Inspect limits and history
curl -s http://localhost:3000/v1/limits/usage -H "authorization: Bearer TOKEN"
curl -s 'http://localhost:3000/v1/transfers?page=1&pageSize=20&sort=desc' -H "authorization: Bearer TOKEN"
```

Registration is also available at `POST /v1/auth/register` with `email`, `displayName`, and a password of 10–72 characters.

## Architecture

Each business module uses a small layered structure:

```text
src/modules/<module>/
  <module>.routes.ts       # Fastify paths and Swagger schemas
  <module>.handler.ts      # HTTP parsing, validation, and status codes
  <module>.service.ts      # Business rules and workflows
  <module>.repository.ts   # Knex queries; accepts optional trx
  <module>.transformer.ts  # Stable API response shapes
  <module>.service.test.ts # Service-focused unit tests
```

The modules are `auth`, `users`, `transactions`, `limits`, and `system`. `src/app.ts` is only the composition root: it configures Fastify, creates repositories/services, registers routes, and installs cross-cutting hooks.

- Fastify routes handle paths and OpenAPI metadata.
- Handlers validate request payloads, query strings, UUIDs, emails, passwords, and pagination with Zod, then delegate immediately.
- Services implement authentication, transfers, and limits; they own business decisions and transaction boundaries.
- Repositories isolate PostgreSQL access and accept `trx?: Knex.Transaction`. They use `trx ?? db` and never open or commit transactions themselves.
- Transformers keep successful and error response formats stable at the HTTP boundary.
- Money is stored as integer centavos (`BIGINT`) and formatted as PHP strings at the API boundary.
- A transfer service starts one database transaction, then passes its `trx` to user, limit, and transaction repositories. It locks sender and recipient rows in sorted UUID order, checks balance/idempotency/limits, updates both balances, and inserts the completed ledger row.
- The sender lock serializes concurrent outgoing transfers, so limit aggregation and balance checks cannot double-spend. Idempotency keys make client retries safe.
- Calendar windows are calculated in `Asia/Manila` and converted to UTC half-open ranges for PostgreSQL aggregation. Only completed transfers count toward usage.

## Local development

```bash
npm install
cp .env.example .env
# Start PostgreSQL separately, then:
npm run db:setup
npm run dev
```

Useful commands: `npm run build`, `npm test`, `npm run lint`, `npm run format:check`, `npm run db:migrate`, `npm run db:rollback`, and `npm run db:seed`.

## API rules and failure cases

- Internal transfers only; the recipient must already exist.
- Self-transfers, malformed amounts, invalid UUIDs, missing idempotency keys, and invalid pagination are rejected with a stable error envelope.
- Daily limit is PHP 50,000 and monthly limit is PHP 500,000. Limits are inclusive: spending exactly the remaining amount succeeds; exceeding it returns `DAILY_LIMIT_EXCEEDED` or `MONTHLY_LIMIT_EXCEEDED`.
- The daily period resets at midnight PHT; the monthly period resets at the first instant of the PHT calendar month.
- Insufficient balance returns `INSUFFICIENT_BALANCE`; no balance, limit usage, or successful history row changes.
- Authenticated users can only transfer from themselves, inspect their own limits, and view histories containing their own transactions.
- A reused idempotency key with the same payload returns the original transaction; changing recipient or amount returns `IDEMPOTENCY_CONFLICT`.

## Production considerations

Set a strong secret through the environment, terminate TLS at the edge, use a managed PostgreSQL instance with encrypted backups, and configure CORS and rate limits per deployment. `/metrics` provides request latency/status counters, process metrics, authentication outcomes, and transfer outcomes for Prometheus; `/health/ready` checks database connectivity. Logs include request IDs and redact credentials at the application boundary. Before launch, add distributed tracing, centralized log retention, alert thresholds, secret management, database read replicas where appropriate, and a durable audit/event stream for compliance workflows.

## Repository

The intended personal repository is `https://github.com/jacruz-sc/maya-cruz-martech`.
