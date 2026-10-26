# Argon review: claim-by-claim verification

## Provenance

One explicitly authorized request to api.xiaoyiapi.xyz, requested alias gemini-4-argon-high, HTTP200,22.056seconds. The service did not return a backend model version; its identity is not independently proven. Input was bound to code commit8f064dab87d0275d1ff0768c2c57f3fd981217ef, with per-file hashes. Usage100001 input/1285 final-output/1815 reasoning tokens; price and charged cost unknown. No retry, actual credentials, request authorization header or private reasoning content is included in this repository.

The retained original is the provider's **final answer**, not a test result or certification. Its GO/NO-GO wording does not replace project gates.

## Adjudication

| Provider claim | Verification | Decision |
|---|---|---|
| B1 blocking is a new P0; disable B1 | Guard already rejects ORACLE_GUARDED; UI/model disclose it as BLOCKED; tests exercise rejection | Existing limitation, not a newly discovered exploit. Keep disabled; do not relax freshness |
| markReorg leaves ledger damaged because manual recovery is needed | Durable store deliberately quarantines the account and marks reversal_required, with no automatic clearance; separate CanonicalLedger supports rollback/rebuild from supplied canonical receipts | Production integration gap remains. No proof of corrupted canonical accounting; never auto-clear quarantine just to demonstrate progress |
| Replace clock_timestamp with statement_timestamp for strict audit order | Schema already has bigserial identity; neither timestamp function guarantees total order/commit order. clock_timestamp is also deliberately used for real-time lease expiry | Reject blanket replacement. IDs identify audit events, not proof of cross-account causal/commit order. Canonical fills use block/transaction/log positions |
| prepareTypedIntent bigint overflow/serialization P1 | Exact max values hash correctly; max+1 rejected. Function is in shared/trade-intent.ts, not coordinator. Provider supplied no reproducer | Alleged bigint overflow unsubstantiated. Independent follow-up found a **different narrow runtime type defect**, described below and tested |
| req.body as any | Runtime body/origin/token/field checks exist; typed DTOs would improve maintenance | Hardening suggestion, not established bypass |
| No production AI/live signer/broadcaster | Correct: demo is synthetic, coordinator only SIMULATION/FORK, external product-model call not run | Keep release blocked. Secure production key management needs design/review; HSM/TEE is not itself a verified hackathon requirement |
| Constrained candidate selection is not general autonomous AI | Competition relevance cannot be inferred from a demand for generality; bounded AI selection can still influence autonomous behavior | Current autonomous AI claim remains unproven for the concrete reason that no real product-model/deployed flow was exercised, not because a model must be unconstrained |

## Independent runtime boundary finding

Following the broad serialization concern, an independent adversarial test passed a JSON-parsed unsafe JavaScript number into a bigint-declared amount field. The number had already rounded before validation, yet String(value) allowed it. A numeric zero also bypassed a strict `=== 0n` positive-amount check. This is not demonstrated uint overflow and not a live exploit in the current isolated demo.

The regression evidence is `evidence/review/typed-intent-runtime-initial.log`; tests are `tests/audit/typed-intent-runtime.test.ts`. The required correction is explicit bigint runtime types for bigint-declared unsigned fields and safe integer number types for the small numeric fields, retaining existing width/amount checks. Final validation status is recorded in the accompanying post-review test logs and acceptance report, not inferred from this requested correction.

## Primary technical references checked

- PostgreSQL current datetime semantics: https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT . Statement timestamp is fixed at command receipt; clock timestamp reflects actual call time. Neither is a total-order mechanism.
- PostgreSQL sequences: https://www.postgresql.org/docs/current/functions-sequence.html . Sequence allocation is concurrent-safe but can have gaps; do not describe an audit ID as transaction commit order.

Source/lease/receipt tests, not model prose, decide the implemented behavior. No new financial action, model retry, paid service, deployment or publication followed this review.

## Correction outcome
Implemented explicit runtime field types. `typed-intent-runtime.test.ts`:5/5PASS, independent audit suite13/13PASS, final integrated TypeScript68/68PASS across9files with actualPG, and25/25nativecontract checks. Final logs under evidence/final/. No second provider call was made.
