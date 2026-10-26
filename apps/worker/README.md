# Worker development boundary

The worker libraries do **not** discover/load wallet secrets or enable live transactions. Explicit local test adapters may sign and send to their own Anvil instance; they do not bypass the HSKSwap frontend's reported jurisdiction restriction.

- `src/simulation.ts`: authoritative in-process synthetic session and scheduler. All outputs SIMULATION; fixed synthetic conversion, rule-driven actions, external AI unavailable. Not a production durable trading worker. Server persistence/job locking is a separate root-owned module.
- `src/accounting.ts`: WAC actual-fill accounting, final-sale dust release, duplicate fill identity, unknown fee/quote handling. Capital adjustment is separate from trading fills. Session closing valuation is frozen before withdrawal.
- `src/indexer.ts`: canonical receipt replay ordered by block/transaction/log, confirmation threshold, rollback to common ancestor, successful and failed receipt fees. Confirmation count is **not** a claim of L1 finality.
- `src/recovery.ts`: unknown/submitted reconciliation, replacement identity, mined-vs-confirmed receipt handling and reorg withdrawal of confirmation. It returns no broadcast action.
- `packages/strategy`: integer directional budgets, full-size quote bisection, bounded model selection, exact fresh quote risk recheck. The HTTP model adapter requires explicit HTTPS configuration and credentials; no implicit environment/key discovery. It has not been called against an external provider during these tests.
- `packages/shared`: decimal integer parsing, exact limited policy grammar, immutable-source EIP-712 schema. Policy drafts never authorize execution.
- `packages/chain`: public read-only fixed-block preflight, runtime code observations, registry/decimals/pool/router checks, QuoterV2 probes, oracle freshness and two secondary RPC block-hash checks. No allowance, approval, transfer, or swap transaction is submitted.

## Commands

`node --import tsx scripts/chain-preflight.ts` (writes a new timestamped report, preserves failed earlier reports). `tsx` CLI hit sandbox IPC EPERM; Node import loader avoids requiring that CLI IPC listener.

`npx vitest run tests/worker/core.test.ts tests/audit`

`npx tsc --noEmit`

## Live-read observations (not execution approval)

At block **29326419**, HSK/USD age **74504 seconds** exceeded the configured **3600 seconds** limit. USDT/USD age **18326 seconds** was within **86400 seconds**. B1 remains disabled: a fresh independent HSK feed and contract-path access have not been validated. Pool 1800-second observations and all four bounded QuoterV2 read-only probes succeeded at this block. Earlier research snapshot limitations are not overwritten. Detailed source/values: `evidence/preflight/2026-10-26T07-33-14-667Z.json` and `quoter-abi-source.json`.

No live profit, mainnet autonomous loop, proxy implementation attestation, independent trust domains, or production availability claim follows from these read-only observations. Separately executed fixed-block fork and composed local durability evidence is linked below.

## Injected local coordinator

`src/coordinator.ts` exports `LocalCoordinator` with explicit `CoordinatorDependencies`. Its execution capability only accepts `SIMULATION` or `FORK`; there is no production wallet adapter. The store must enforce atomic single-pending nonce reservation and persist UNKNOWN before any injected local send. Signing, simulation and send fakes in `tests/worker/coordinator.test.ts` establish ordering and fail-closed behavior, not real signatures, live receipt provenance, RPC connectivity or production database durability. A durable SIGNING barrier precedes the first role; fence checks precede each role and local send. Partial or ambiguous role signing remains SIGNING/quarantined; only both verified signatures permit SIGNED. Catch paths never relabel partially issued signatures as completed or revoked; a local rejection does not revoke an issued signature. The coordinator checks canonical domain/schema and binds the full typed-data trade fields to the freshly risk-approved candidate before reservation/signing. Cryptographic signature recovery and commitment-content verification still belong to reviewed adapters/contracts, not model output.


## Composed local durability versus public demo

The separate `contracts/script/durable-local-integration.mjs` composes LocalCoordinator, PgLocalCoordinatorStore and real local Anvil execution: execution chain **31337**, source-chain metadata **177**, real local role signatures and receipts, and durable PostgreSQL transitions. Evidence is recorded in `contracts/evidence/durable-local/integration.json` and `run.log` (local lease restart, one canonical transaction, consumed Guard nonce). This demonstrates the exercised local integration path, not a mainnet deployment or production availability guarantee. The UI's synthetic sessions are still memory-only; they are not silently wired to the durable local transaction executor. No external LLM invocation or live-mainnet execution is established by these local tests.

NORMAL_REBALANCE now requires an explicit fresh execution-cost estimate in **USDT raw** at or below `maxExecutionCostQuoteRaw`. Missing, stale, future or over-cap estimates HOLD before reservation/signing. Synthetic fixtures explicitly assume zero execution cost for risk-screen testing; accounting still reports unknown real cost conversion and `estimatedNetPnl=null` where appropriate.

`src/stop-keeper.ts` observes session-scoped allocated whole-position executable quote valuations, not spot probes or USD fair value. Invalid/stale/future observations do not update its observed high-water mark. The local-only keeper requests REDUCE_ONLY, verifies confirmation, durably persists that confirmation, and rechecks owner state before invoking the deterministic exit. Confirmation/storage failure prevents exit; exit failure does not clear REDUCE_ONLY. Model availability is not a dependency. This module has deterministic local tests; it is not a production always-on keeper or a loss guarantee.

New durable composition, cost gating and keeper changes were not reviewed by the earlier external-model review; do not imply otherwise.
