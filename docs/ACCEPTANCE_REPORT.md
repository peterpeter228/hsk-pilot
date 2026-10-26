# HSK Pilot implementation acceptance — 2026-10-26

## Decision

**Verified local development candidate, not submission-ready and not authorized for real financial execution.** No mainnet deployment/trade, public hosted app, real product-model decision, actual browser acceptance is claimed. One Argon review completed, with independent adjudication; it is not a certification.

## Executed evidence

- Restored 41 handoff files before implementation: 40 manifest-declared files matched byte counts/SHA256; the manifest itself was hashed separately. `evidence/restoration/verification.json`.
- Post-review root integrated run at 07:55–07:56 UTC: **68 TypeScript tests, nine files, zero skipped**, using actual isolated PostgreSQL18.4. Typecheck, frontend/server build, doctor and compiled-server HTTP smoke passed. See `evidence/final/` and `evidence/G3/http-smoke.json`.
- Native Solidity0.8.30/Cancun tests: **25 tests**, including two 256-run fuzz properties and a 64-run/2048-call stateful invariant. The Foundry npm wrapper's exit/signal propagation issue was avoided by the checked-in resolver for its official native binary. A real invariant harness counter defect was fixed with a targeted regression; the failed log was retained, not described as a production contract vulnerability.
- Local Anvil chain31337: actual local transactions, separate fixture roles, signed full-call simulation, balance deltas, policy tightening, reduce-only persistence, exit and withdrawal. `contracts/evidence/local-integration.json`. These local hashes are NOT mainnet receipts.
- Fixed-block HSKSwap FORK test at29326419: actual deployed router code on locally forked state, sell/buy/minOut/old signature/reduce-only/withdraw checks. `contracts/evidence/fork-test.log`. Public state reads and local synthetic funding do not constitute a real swap, mainnet deployment, or jurisdiction clearance.
- PostgreSQL substrate: seven tests plus actual database stop/start preservation of hashless UNKNOWN; concurrent reservation, fencing, replacement linkage and reorg quarantine. `evidence/G3/pg/RESULTS.md`.
- Independent review reproduced and fixed six defects, with eight audit regressions. `evidence/review/independent-safety-review.md`. This is bounded engineering review, not a certified audit.

## Fresh read-only chain observations

`evidence/preflight/2026-10-26T07-33-14-667Z.json` records block29326419 and its hash, verified token decimals/code fingerprints, router/factory/pool reads and four bidirectional Quoter probes. The30-minute pool observation now succeeds, unlike the older handoff snapshot. HSK/USD was74,504seconds old against a3,600-second policy. **B1 remains blocked.** Pool-based observations are not an independent fair-price guarantee. Earlier failed getter probes remain preserved.

## Boundaries and incompleteness

1. The public judge example and private sandbox are synthetic, process-local sessions. The UI is not connected to the durable PostgreSQL coordinator or live chain execution. Restart may lose sandbox state.
2. The tested local coordinator is capability-restricted to SIMULATION/FORK. Cryptographic signers, durable store, canonical RPC verification and production accounting still need end-to-end deployment integration. No live broadcaster is enabled.
3. A bounded structured model adapter exists but has not made any real product-model call. Deterministic simulation is not represented as AI. AI-versus-rule-versus-hold performance has not been measured; no alpha/profitability claim is supported.
4. Browser tests are prepared and syntax-checked, not executed for this project. The existing environment has independently demonstrated cloud-loopback isolation and local Chromium launch failures. No screenshots/video or responsive-click pass is claimed.
5. The separately approved HSK Argon call completed once with HTTP200. Earlier RecallLedger approval was not reused; actual backend version and charged cost remain unknown.
6. HSKSwap web access returned a regulatory/jurisdiction403. Scope of that restriction and eligibility of any eventual user-operated activity remain unresolved. No bypass was attempted.
7. No dedicated product model, production infrastructure, owner/signer setup, publication/license decision or submission approval has been supplied. Actual financial transfers/trades and wallet actions are for the user to perform, not an automatic continuation of this task.
8. The English entry and video storyboard are drafts, not a submitted entry or recorded video. Legal/prize/KYC and exact submission fields remain partially unverified. Submission SHA and live URLs remain null until they exist.

## Interpretation

Test counts are not a claim that every C/F/W/P/UI specification row has passed. Local and fork coverage does not replace mainnet eligibility evidence. Unknown costs/net results remain null; HSK/USDT/USD units are not interchangeable. Evidence hashes establish content integrity, not factual truth or correctness of reasoning.

Next: obtain a functioning browser execution environment and finish actual UI acceptance, perform the separately approved external review if granted, then resolve access/credentials and production integration before preparing any owner-operated financial step. Do not lower gates to meet the deadline.

## Post-Argon follow-up
The provider supplied no proof for its broad bigint-overflow allegation. Independent runtime-boundary tests found a narrower concrete defect: already-rounded JavaScript Number input and numeric zero could pass a helper whose API declares bigint fields. Explicit runtime types now reject both, preserving uint width bounds. Five added regression tests pass; the independent audit suite is now13tests. Root reran all68TS/25contract checks and builds/HTTP with realPG successfully. Original failed reproduction logs are retained. This correction has not been sent back for an additional Argon call.
