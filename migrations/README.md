# Durable job storage (coordinator substrate)

With coordinators stopped, apply `001_durable_jobs.sql` then `002_signing_barrier.sql` once in order, in a transaction using a dedicated PostgreSQL schema and a migration role. On an existing 001 database, apply only 002. See `002_SIGNING_README.md` for upgrade quarantine semantics. Configure the server-only `pg.Pool` search_path to that same schema. Runtime callers must not have DDL privileges; never expose this store or connection to anonymous browser clients. This migration does not create hosted resources or a public API.

`PgJobStore.reserve` atomically serializes account reservations and immutable account/session/intent-nonce identities. `claim` uses DB time and monotonically increasing decimal-string fencing tokens. Workers must commit `beginSigning` before the first role signer call, verify both signatures, then call `markSigned`. They must call `beginSubmission` from SIGNED **before** any external submission; that writes `UNKNOWN`. The store has no operation that turns UNKNOWN back into PREPARED. An ambiguous/crashed submission is reconciled, never blindly resent. A known hash can be attached with `recordSubmission`; discovering an alternative hash requires explicit `recordReplacement` with matching sender and EOA nonce. No function here broadcasts.

The chain adapter is responsible for checking chain ID, policy/intent nonce, transaction identity, receipt authenticity, confirmation depth and canonical ancestry. Store receipt methods do not perform RPC verification. Database fencing cannot cancel an already-in-flight external network call, so an eventual broadcaster must additionally honor the durable uncertainty barrier and serialize external effects.

`markReorg` atomically marks receipts noncanonical, flags `reversal_required`, increments the fence, appends an audit event and quarantines the account, including a newer already-reserved job. It does **not** reverse monetary ledger entries. Quarantine deliberately has no clear method until a separate verified ledger-reversal/reconciliation workflow is implemented. UNKNOWN without a discoverable hash also remains pending indefinitely rather than risk a duplicate.

Unit-test command (explicit integration prerequisite):

```
HSK_TEST_DATABASE_URL=<dedicated-local-postgres-url> pnpm exec vitest run tests/server/job-store.test.ts tests/server/local-job-adapter.test.ts
```

Each test run creates and drops a randomized isolated schema. Without the environment variable these integration tests are reported **skipped**, not passed. Evidence/G3/pg includes a real PostgreSQL process restart test. No live funds, chain broadcast, mainnet operation, hosted worker or production completeness is demonstrated by these tests.
