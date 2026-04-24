# Time-Off Microservice (NestJS + JavaScript + SQLite)

## Repository
https://github.com/Sajad-ahmed-soomro/HCM

---

Production-oriented time-off microservice built with NestJS (JavaScript), Prisma, and SQLite.
Production-oriented time-off microservice built with NestJS (JavaScript), Prisma, and SQLite.

It manages time-off requests while synchronizing with a mock HCM service where balances are treated as the authoritative source during reconciliation.

## Features

- Create time-off requests with local + HCM balance validation
- Approve and reject requests with request state transition enforcement
- Fetch leave balances by `employeeId` and `locationId`
- Mock HCM endpoints for balance, deduct, and batch overwrite
- Retry with exponential backoff for transient HCM failures
- DB-level integrity constraints (unique composite balance key + non-negative balance)
- Test suite covering unit, integration, and e2e scenarios

## Tech Stack

- Node.js
- NestJS (JavaScript/CommonJS)
- Prisma ORM
- SQLite
- Jest + Supertest

## Project Structure

```text
src/
  app.module.js
  main.js
  common/
    retry.util.js
  database/
    database.module.js
    prisma.service.js
  timeoff/
    timeoff.module.js
    timeoff.controller.js
    timeoff.service.js
  balance/
    balance.module.js
    balance.controller.js
    balance.service.js
  hcm/
    hcm.module.js
    hcm.controller.js
    hcm.service.js
    hcm.errors.js
prisma/
  schema.prisma
  migrations/
test/
  unit/
  integration/
  e2e/
```

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

`.env` should contain:

```env
DATABASE_URL="file:./dev.db"
```

### 3) Apply migrations

```bash
npm run prisma:migrate
```

### 4) Generate Prisma client

```bash
npm run prisma:generate
```

## Run the Service

### Start

```bash
npm run start
```

### Dev mode (watch)

```bash
npm run dev
```

Service base URL:

`http://localhost:3000/api`

Health endpoint:

`GET /api/health`

## Run Tests

```bash
npm test
```

### Run tests with coverage

```bash
npx jest --runInBand --coverage
```

Coverage output:

- Terminal summary after test run
- HTML report at `coverage/lcov-report/index.html`

Current test coverage scope:

- Unit tests: retry utility and service-level error/state logic
- Integration tests: DB + service interaction for balances
- E2E tests: API flows including success, insufficient balance, HCM retry failure, batch overwrite, and concurrent requests

## Idempotency

The `POST /time-off` endpoint supports an optional `idempotencyKey` field to prevent duplicate request creation during client retries.

How it works:

- The first successful request with a unique `idempotencyKey` is stored.
- Re-sending the same key is treated as a duplicate operation.
- The service rejects duplicates with a conflict response instead of creating a second request.

Why this matters:

- Prevents accidental double-deductions
- Protects against duplicate submissions from network retries or button double-clicks

## API Endpoints

All endpoints are prefixed with `/api`.

### Time-Off

- `POST /time-off`
- `POST /time-off/:id/approve`
- `POST /time-off/:id/reject`

Create request example:

```json
{
  "employeeId": "emp-123",
  "locationId": "loc-1",
  "amount": 2,
  "reason": "Vacation",
  "idempotencyKey": "req-001"
}
```

### Balance

- `GET /balance?employeeId=<id>&locationId=<id>`

### Mock HCM

- `GET /hcm/balance?employeeId=<id>&locationId=<id>`
- `POST /hcm/deduct`
- `POST /hcm/batch`

HCM batch example:

```json
{
  "failureRate": 0,
  "entries": [
    {
      "employeeId": "emp-123",
      "locationId": "loc-1",
      "balance": 12
    }
  ]
}
```

## Quick API Testing Guide

Use Postman or curl to validate the happy path quickly.

### 1) Health check

`GET /api/health`

### 2) Seed mock HCM balance

`POST /api/hcm/batch`

```json
{
  "failureRate": 0,
  "entries": [
    {
      "employeeId": "emp-1",
      "locationId": "loc-1",
      "balance": 10
    }
  ]
}
```

### 3) Create local data (one-time for test user)

Create `Employee` + `LeaveBalance` in Prisma Studio:

```bash
npx prisma studio
```

### 4) Create a time-off request

`POST /api/time-off`

```json
{
  "employeeId": "emp-1",
  "locationId": "loc-1",
  "amount": 2,
  "reason": "Vacation",
  "idempotencyKey": "req-001"
}
```

### 5) Approve using request id

Use the returned `id` from create response:

`POST /api/time-off/:id/approve`

### 6) Verify local balance

`GET /api/balance?employeeId=emp-1&locationId=loc-1`

## Request Lifecycle

States:

- `PENDING`
- `APPROVED`
- `REJECTED`

Valid transitions:

- `PENDING -> APPROVED`
- `PENDING -> REJECTED`

Invalid transitions are rejected at the service layer.

## Design Decisions Summary

- **Deduction strategy:** deduct on request creation to reduce overbooking risk and provide immediate feedback.
- **Consistency model:** local operational DB + authoritative HCM reconciliation through batch sync.
- **Concurrency safety:** transactional request creation with in-transaction balance re-check.
- **Resilience:** transient HCM failures retried with exponential backoff.
- **Data integrity:** DB-level constraints enforce unique `(employeeId, locationId)` and non-negative balances.
- **Testability:** modular design and explicit JS dependency injection for predictable testing.

