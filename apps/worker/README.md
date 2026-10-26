# Worker development boundary

This implementation does **not** load a wallet or signer, sign an intent, broadcast a transaction, or bypass the HSKSwap frontend's reported jurisdiction restriction.

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

At block **29326419**, HSK/USD age **74504 seconds** exceeded the configured **3600 seconds** limit. USDT/USD age **18326 seconds** was within **86400 seconds**. B1 remains disabled: a fresh independent HSK feed and contract-path access have not been validated. Pool 1800-second observations and all four bounded QuoterV2 read-only probes succeeded at this block. Earlier research snapshot limitations are not overwritten. Detailed source/values: `evidence/preflight/2026-10-26T07-33-14-666Z.json` and `quoter-abi-source.json`.

No live profit, mainnet autonomous loop, funded fork router test, proxy implementation attestation, independent trust domains, or production durability claim follows from these results.

## Injected local coordinator

`src/coordinator.ts` exports `LocalCoordinator` with explicit `CoordinatorDependencies`. Its execution capability only accepts `SIMULATION` or `FORK`; there is no production wallet adapter. The store must enforce atomic single-pending nonce reservation and persist UNKNOWN before any injected local send. Signing, simulation and send fakes in `tests/worker/coordinator.test.ts` establish ordering and fail-closed behavior, not real signatures, live receipt provenance, RPC connectivity or production database durability. Abort after any role-signature attempt stays SIGNED/quarantined until reconciliation or expiry; a local rejection does not revoke an issued signature. The coordinator checks canonical domain/schema and binds the full typed-data trade fields to the freshly risk-approved candidate before reservation/signing. Cryptographic signature recovery and commitment-content verification still belong to reviewed adapters/contracts, not model output.
