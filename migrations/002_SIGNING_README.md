# Durable signing integration upgrade

**Supersedes the 001-only signing workflow described in README.md.** Preserve migration 001. With coordinators stopped, apply 001 (new database only), then 002 in a transaction under a dedicated schema and migration role. Existing 001 PREPARED rows become SIGNING with `MIGRATION_SIGNING_QUARANTINE` audit and invalidated leases: the old runtime cannot prove that an external signature was never issued. This conservative upgrade is tested against real PostgreSQL.

New jobs follow `PREPARED → SIGNING → SIGNED → UNKNOWN → SUBMITTED → MINED → CONFIRMED/FAILED`.

- `claimPrepared` is the only execution reservation path. Reconciliation claims cannot turn SIGNING/SIGNED/UNKNOWN into PREPARED.
- `beginSigning` commits before the first external role-sign call. `assertLease` verifies the fence, DB-time lease and account quarantine before each role call and before local send.
- `markSigned` is called only after the coordinator verifies both returned role signatures. A partial/ambiguous signature or crash leaves SIGNING; simulated-call failure leaves SIGNED. Neither state is released automatically.
- `beginSubmission` now requires SIGNED, not PREPARED. Its durable UNKNOWN barrier precedes the injected send; missing response/hash never permits resend.
- `rejectPrepared` cannot reject/release SIGNING or later states. Expired signatures and policy updates do not currently implement a release workflow.

`PgLocalCoordinatorStore` adapts the worker interface to PostgreSQL. It accepts only execution chain 31337; chain 177 is source metadata, not the local execution chain. It hashes actual typed data, binds domain/account/session/nonce/version/deadline and stores unsigned payload only. Reservation tokens carry job ID, worker and monotonic fence, and are checked against the durable row. These tokens are server-internal, not authentication credentials for an exposed API.

Local send metadata must include actual sender and EOA transaction nonce; intent nonce is not a substitute. Receipt metadata is checked against the recorded sender/EOA nonce/hash. Chain receipt authenticity/canonical ancestry still belongs to the trusted execution/indexer adapter, not this database module. Unsupported expiry/cancellation transitions fail closed. Reorg reversal still only flags accounting reversal and quarantines; it does not itself change monetary ledger entries.

Actual real-PostgreSQL tests: `HSK_TEST_DATABASE_URL=<isolated-local-db> pnpm exec vitest run tests/server/job-store.test.ts tests/server/local-job-adapter.test.ts`. Tests create/drop randomized schemas. Four spawned processes exit at signing/send boundaries without cleanup; independent connections verify persisted quarantine after lease expiry and no repeated signer/send calls. Execution adapters in that suite are explicitly fake (SIMULATION), not financial clients.

This integration closes the PostgreSQL/local-coordinator storage gap. It does not turn the UI into a production trading interface, create a hosted worker, authorize live transactions, or establish a live signer trust boundary.

Terminal CONFIRMED/FAILED jobs can be claimed only through the explicit reconciliation path for later reorg observation. The adapter reorg transition validates that recovery fence; the execution claim remains PREPARED-only. Account quarantine stops even a newer already-reserved/leased job at assertFence/beginSigning/beginSubmission. No automatic quarantine clearance is provided.
