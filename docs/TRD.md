# Technical Requirements Document (TRD)

## Project

Time-Off Microservice using NestJS (JavaScript), Prisma, and SQLite.

## 1. Introduction

ReadyOn requires a reliable time-off service while HCM remains the external source of truth for leave balances.  
The microservice must provide low-latency request workflows (create/approve/reject/get balance) and remain correct during HCM latency/failure using retries and reconciliation.

## 2. Functional Requirements

- Create time-off request
- Approve request
- Reject request
- Fetch balance by employee/location
- Sync with HCM using both:
  - real-time verification/deduction for critical operations
  - batch overwrite/reconciliation

## 3. Non-Functional Requirements

- **Consistency:** enforce valid transitions and prevent negative balances.
- **Reliability:** bounded retries for transient HCM failures.
- **Fault tolerance:** graceful handling of HCM downtime and partial failures.
- **Scalability (basic):** modular service boundaries, indexed lookups, clean service layer.

## 4. Key Challenges

- HCM is authoritative but external.
- Concurrent requests can create race conditions.
- Batch sync can conflict with in-flight local operations.
- Partial failures may occur across HCM and DB boundaries.
- Data integrity and auditability must be preserved.

## 5. Proposed Solution

- Modular NestJS microservice:
  - `timeoff`
  - `balance`
  - `hcm`
  - `database`
- Local SQLite database for fast operational workflows.
- HCM verification for critical mutations.
- Batch reconciliation from HCM as eventual-consistency repair.
- Defensive validations + retry/backoff + structured logs.

## 6. API Design (REST)

- `POST /time-off`
  - `201`: created
  - `400`: invalid payload
  - `404`: local employee/balance not found
  - `409`: insufficient balance
  - `409`: idempotency conflict (or return original response when idempotency replay is enabled)
  - `503`: HCM unavailable after retries
- `POST /time-off/:id/approve`
  - `200`: approved
  - `400`: invalid transition
  - `404`: request not found
  - `503`: HCM unavailable after retries
- `POST /time-off/:id/reject`
  - `200`: rejected
  - `400`: invalid transition
  - `404`: request not found
- `GET /balance?employeeId=<id>&locationId=<id>`
  - `200`: success
  - `400`: missing query params
  - `404`: balance not found

Mock HCM endpoints:

- `GET /hcm/balance`
- `POST /hcm/deduct`
- `POST /hcm/batch`

## 7. Data Model

### `employees`

- `id` (PK)
- `externalId` (unique, optional)
- `name` (optional)
- timestamps

### `leave_balances`

- `id` (PK)
- `employeeId` (FK)
- `locationId`
- `balance`
- `lastSyncedAt`
- timestamps
- constraints:
  - unique (`employeeId`, `locationId`)
  - non-negative `balance`

### `time_off_requests`

- `id` (PK)
- `employeeId` (FK)
- `locationId`
- `amount`
- `status` (`PENDING`, `APPROVED`, `REJECTED`)
- `reason`
- `hcmReference`
- `idempotencyKey` (unique, optional)
- timestamps

## 8. Request Lifecycle State Machine

States:

- `PENDING`
- `APPROVED`
- `REJECTED`

Valid transitions:

- `PENDING -> APPROVED`
- `PENDING -> REJECTED`

Invalid transitions:

- `APPROVED -> REJECTED`
- `REJECTED -> APPROVED`

Transition checks are enforced at service layer.

## 9. Deduction Strategy

Selected option: **Deduct on request creation**.

Rationale:

- immediate user feedback
- early overbooking prevention
- fewer approval-time failures

Alternative (rejected): deduct on approval due to delayed validation and increased race risk.

## 10. Concurrency Control

- Use DB transactions for local mutations only.
- Perform HCM call before final local commit.
- Re-check local balance in transaction before writing.
- Final local write (balance decrement + request insert) occurs only after successful HCM response.

Goal: prevent concurrent requests from over-consuming balances.

### Transaction Strategy

- Keep external HCM call outside long-held DB locks where possible.
- Bound transaction scope to local consistency operations.
- If HCM succeeds but local commit fails, log inconsistency and reconcile via batch sync.

Rationale: avoid long-running transactions coupled to external network latency.

## 11. Consistency Strategy

- Optimistic local checks + authoritative HCM validation.
- Eventual consistency via HCM batch overwrite.
- Idempotency to avoid duplicate effects.
- Retry + exponential backoff for transient integration failures.

## 12. Failure Handling Matrix

1. HCM says insufficient balance  
   -> reject request immediately (`409`).

2. HCM unavailable (timeout/network/transient)  
   -> retry with exponential backoff; on exhaustion return `503`.

3. HCM success but DB write fails  
   -> log inconsistency and rely on batch sync reconciliation.

4. Duplicate client request  
   -> return original response for same idempotency key (preferred) and do not create/deduct again.

5. Batch sync conflict with local value  
   -> HCM value overwrites local balance (source-of-truth precedence).

## 13. Idempotency Design

- Client provides `idempotencyKey` on create request.
- Key is stored with request (unique index).
- Duplicate key is treated as a replay of the same operation.
- Service returns the original response for the same key instead of creating a new request.
- If payload mismatches for an existing key, service returns conflict.

Prevents:

- double deduction
- duplicate request creation due to retries/re-submits

## 14. Batch Sync Behavior

- Batch updates are processed as upserts on `leave_balances`.
- `lastSyncedAt` is updated per upserted record.
- Batch operations are idempotent for the same input set.
- During in-flight requests, HCM real-time validation remains the final guard against inconsistency.

## 15. Observability

- Structured logs for:
  - HCM calls
  - retry attempts
  - failures and mapping
  - batch sync actions
- Correlation-capable contextual fields (request/employee/location).
- Logging supports debugging and auditability.

## 16. Sequence Flow (Create Request)

1. Validate input.
2. Pre-check local balance.
3. Call HCM deduct (with retry/backoff).
4. Start DB transaction.
5. Re-check local balance in transaction.
6. On success:
   - decrement local balance
   - create `time_off_requests` record
7. Commit transaction.
8. Return response.

## 17. Alternatives Considered

- Fully HCM-driven runtime (rejected: high latency and tight availability coupling).
- No local DB (rejected: poor UX and weak workflow/audit reliability).
- Deduct-on-approval (rejected: delayed failure and higher race exposure).

## 18. Testing Strategy

- **Unit tests:** retry utility, transition logic, error mapping.
- **Integration tests:** real DB + service behavior.
- **E2E tests:** create success, insufficient balance, HCM failure/retry, batch overwrite, concurrent requests.
- **Mock HCM:** in-memory balances, insufficiency errors, random failure simulation, batch overwrite.

## 19. Security and Abuse Considerations

- Apply basic rate limiting on mutation endpoints (`POST /time-off`, approve, reject).
- Validate and sanitize all input fields.
- Bound retry behavior to avoid retry storms.
- Enforce idempotency on write APIs to reduce duplicate side effects.
