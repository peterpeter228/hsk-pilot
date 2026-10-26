# Independent bounded safety review — 2026-10-26

Scope: current TradingSessionGuard.sol; strategy/shared; worker recovery, accounting, simulation, indexer; server controls and job store. No external Argon review, no credentials accessed, no mainnet writes, no browser claims. Source remained under concurrent development. This is a bounded code review and regression exercise, not a security audit certification or production-readiness declaration.

Identity: working tree had no Git repository when queried (`git rev-parse HEAD` failed). Exact reviewed key-file content hashes are in `reviewed-source-sha256.txt`; do not invent a commit SHA. Runtime test runner printed a different wall clock than conversation UTC; preserve raw logs rather than treating their printed local timestamps as UTC.

## Findings and disposition

1. **High for a future signer integration: caller-controlled reference could weaken risk-approved minOut.** `packages/strategy/src/index.ts:23-27` originally computed minimum only from candidate.referenceAmountOutRaw. A legal full-size amount with reference=2 would obtain minimum=1 even with a much larger fresh quote. This undermined B0's deterministic risk quote protection. Worker owner fixed by requiring reference equals freshly recomputed exact-size quote, otherwise returning REFERENCE_QUOTE_CHANGED_REBUILD_INTENT. Independent test passes. No live signer or live server route exists, so no current real-asset exploit is claimed.
2. **Medium: downsizing bypassed owner minimum trade size.** Same risk function verified only upper size bound by rebuilding the full candidate; a size of one quote-raw unit could pass even if minimumTradeQuoteRaw=100000. Fixed by checking minimum again on final exact input/output. Independent regression passes.
3. **Medium: expiry exit liveness mismatch.** `packages/strategy/src/index.ts:10`, `packages/shared/src/index.ts:5` originally admitted only REDUCE_ONLY exits and omitted EXPIRED. Guard derives EXPIRED after validUntil and permits approved exits. Fixed both timestamp-expired ACTIVE and explicit chain EXPIRED handling. Two independent regressions pass.
4. **Medium: same-block receipt arrival changed accounting order.** `apps/worker/src/indexer.ts:2,8` originally lacked transactionIndex and sorted only by block. Reverse arrival of same-block SELL then BUY could throw INSUFFICIENT_INVENTORY or alter WAC. Fixed canonical block/transaction/log ordering. Independent reverse-arrival regression passes.
5. **Medium: failed receipt terminal before confirmation threshold.** `apps/worker/src/recovery.ts:6` marked any unsuccessful receipt REJECTED immediately, unlike successful MINED receipts. This could release pending processing prematurely and omit failed-receipt reorg monitoring if the caller stops tracking terminal jobs. Reproduced FAIL: one-confirmation failure with threshold three returned REJECTED instead of MINED. Fixed to keep both outcomes MINED until threshold. Independent retest passes. The durable store separately already retained both receipt outcomes as MINED pending confirmation.

Findings 1–4 were source-confirmed and communicated to implementation owner; fixes landed before first test execution. There is **no recorded pre-fix failing run** for those four and none is claimed. Finding 5 has a retained failing run.

## Executed checks

- `node_modules/.bin/vitest run tests/audit/safety-invariants.test.ts`: final **6 passed / 0 failed**, exit 0. `safety-invariants-final.log`.
- Same command before recovery fix: **4 passed / 1 failed**, exit 1. `safety-invariants-second.log`.
- `contracts/script/forge-local.sh test`: **24 passed / 0 failed**, exit 0, including 2 fuzz tests at 256 runs each and invariant 64 runs / 2048 calls. `contract-suite-independent.log`. Existing implementation-owner tests independently rerun; not authored by reviewer.

## Contract observations and unresolved integration gates

No concrete unresolved contract exploit identified in this bounded review. Checked role-required signatures, EIP-712 field binding, immutable route, actual balance deltas, precise approval clearing, day budget persistence across sessions, gross budget monotonicity within session, policy invalidation, ownership transition close at both steps, oracle-independent owner recovery and persistent reduce-only. Existing suite supports these observations within mocks/local execution only.

Not demonstrated here: real fixed-block HSKSwap router/factory integration; deployment dependency identity/upgrade safety; canonical quote block verification at signing/broadcast; complete signed eth_call and resubmit/reorg orchestration; actual independent signing services; complete cost enforcement and valuation freshness; durable recovery wired into live runner. Server intentionally exposes only synthetic controls. These are concrete live-execution release gates, not evidence that local tests grant financial authority. Confirmed below-threshold receipt handling does not prove reorg finality. B0 still has no independent fair-price guarantee.

Reviewer edits were restricted to tests/audit/** and evidence/review/**. Implementation fixes were made by the worker owner, not the reviewer.

## Confirmation-interface update (2026-10-26 ~07:38 UTC)

Indexer now requires actual confirmation counts. Reviewer fixture was updated to explicit confirmations=3, without casts or relaxing expected canonical ordering. Added a test that two-confirmation receipts contribute neither inventory nor gas to confirmed accounting, then update the same receipt to three confirmations and verify both appear exactly once. Independent audit suite now **7 passed / 0 failed**, exit 0 (`safety-invariants-confirmation-update.log`). Source hashes refreshed.

Contract-owner subsequently reported an error in the invariant test harness ghost-day-budget update. Earlier 24-test pass remains a historical executed result, not verification of the corrected harness. Corrected-harness rerun must supersede it before drawing invariant conclusions. Reviewer did not edit contracts and makes no production-safety claim.

## Local coordinator review (2026-10-26 ~07:39 UTC)

**Medium, local orchestration correctness / future signer gate:** `apps/worker/src/coordinator.ts` checked buildIntent's outer nonce/version/deadline but did not bind its `typedData` to the candidate and minOut approved by risk. Independent dependency-injected test returns valid outer fields and a payload whose candidate amount/reference/minOut are changed to 1; observed SUBMITTED with both signer adapters called, rather than rejection before signatures. Repro: `tests/audit/coordinator-binding.test.ts`; recorded FAIL `coordinator-binding-initial.log`. This does not assert an actual EIP-712 signature or real transaction was made: adapters are synthetic mocks, and coordinator is explicitly local/fork only. Fix requested from implementation owner.

Clone-per-signing-adapter, retaining SIGNED quarantine on post-sign abort, write-ahead UNKNOWN before network send, and no auto-retry of an ambiguous send are sound ordering choices under the documented trusted store/adapter contracts. Signature strings and signerId labels are not recovered cryptographically here; an injected production signer/typed-data adapter cannot inherit security assurance from these mock ordering tests.

## Final independent retests (~07:41 UTC)

Coordinator owner added strict EIP-712 schema/domain and complete risk-approved message-field binding before reservation/signing. Updated independent fixture now uses the required real typed-data shape, alters only amountInRaw, and verifies the exact TYPED_DATA_RISK_BINDING_MISMATCH rejection with zero signer/send calls. **All eight independent audit tests pass**, exit 0 (`coordinator-binding-final.log`). `tsc --noEmit` passes, exit 0 (`typecheck-coordinator-update.log`). Cryptographic signature verification remains the explicitly trusted adapter/contract responsibility.

Corrected contract invariant harness independently rerun using the now-native-binary `contracts/script/forge-local.sh test`: **25 passed / 0 failed / 0 skipped**, including `testGhostDailyExcludesSuccessfulSale` and 64-run/2048-call invariant. Exit 0; `contract-suite-corrected-harness.log`. This supersedes earlier 24-test invariant evidence. No contract implementation exploit was established by the ghost-ledger harness error. Final reviewed-source hashes include coordinator and corrected harness/helper.

## External-review claim adjudication (~07:55 UTC)

A narrow runtime type-boundary defect was independently confirmed in `packages/shared/src/trade-intent.ts` (`prepareTypedIntent`), **not** overflow of correctly typed bigint inputs. `parseRaw(String(value))` accepted a runtime JavaScript number in bigint-declared fields. JSON numeric 9007199254740993 had already rounded to 9007199254740992 and was accepted unchanged; direct local viem `hashTypedData` also produced a digest. Numeric amountInRaw=0 bypassed the `===0n` zero guard. The caller must violate TypeScript declarations to trigger this (e.g. JS/JSON/any boundary); no deployed signer call site or real transaction exploit is asserted.

Recorded pre-fix tests: **2 failed / 2 passed** (`typed-intent-runtime-initial.log`). Controls showed exact bigint beyond MAX_SAFE_INTEGER was retained and uint64 overflow rejected; fractional/NaN/Infinity/unsafe policyVersion already rejected by existing checks. Worker applied strict typeof bigint checks for bigint-declared fields, and typeof number + safe-integer checks for policyVersion/direction before width/enum validation. Post-fix boundary suite has five passing cases, including rejection before digest construction. `typed-intent-runtime-digest-initial.log` despite its filename is **post-fix**; no failing digest test run is claimed.

All reviewer regressions now **13/13 PASS**, exit 0 (`typed-intent-all-audit-final.log`). Source hashes refreshed including trade-intent.ts. No external API calls or retries were made by this reviewer.

Other allegations checked against source: B1 remains explicitly disabled via UnsupportedOracleMode; reorg quarantine is intentional fail-closed behavior requiring ledger reversal/reconciliation, not accidental permission restoration; clock_timestamp records operational times and is not used by the canonical receipt accounting order (blockNumber/transactionIndex/logIndex). `bigserial` audit IDs identify records but do not establish commit order. No evidence supports replacing clock_timestamp with statement_timestamp as a correctness fix.

Final adjudication typecheck: `tsc --noEmit` PASS, exit 0 (`typed-intent-typecheck-final.log`).
