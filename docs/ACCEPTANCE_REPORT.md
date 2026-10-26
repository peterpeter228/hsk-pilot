# HSK Pilot implementation acceptance — 2026-10-26

## Decision

**Verified local development candidate, not submission-ready and not authorized for real financial execution.** No mainnet deployment/trade, public hosted app or real product-model decision is claimed. Actual core desktop browser acceptance is now recorded; the full matrix is still in progress. One Argon review completed, with independent adjudication; it is not a certification.

## Executed evidence

- Restored 41 handoff files before implementation: 40 manifest-declared files matched byte counts/SHA256; the manifest itself was hashed separately. `evidence/restoration/verification.json`.
- Latest root integrated run at 08:17–08:18 UTC: **112 TypeScript tests, twelve files, zero skipped**, using actual isolated PostgreSQL18.4. Typecheck, frontend/server build, doctor and compiled-server HTTP smoke passed. See `evidence/final/` and `evidence/G3/http-smoke.json`.
- Native Solidity0.8.30/Cancun tests: **25 tests**, including two 256-run fuzz properties and a 64-run/2048-call stateful invariant. The Foundry npm wrapper's exit/signal propagation issue was avoided by the checked-in resolver for its official native binary. A real invariant harness counter defect was fixed with a targeted regression; the failed log was retained, not described as a production contract vulnerability.
- Local Anvil chain31337: actual local transactions, separate fixture roles, signed full-call simulation, balance deltas, policy tightening, reduce-only persistence, exit and withdrawal. `contracts/evidence/local-integration.json`. These local hashes are NOT mainnet receipts.
- Fixed-block HSKSwap FORK test at29326419: actual deployed router code on locally forked state, sell/buy/minOut/old signature/reduce-only/withdraw checks. `contracts/evidence/fork-test.log`. Public state reads and local synthetic funding do not constitute a real swap, mainnet deployment, or jurisdiction clearance.
- PostgreSQL: nineteen storage/local-adapter tests plus actual database stop/start and child-process interruption probes; durable signing/send quarantine, fencing, replacement linkage and reorg quarantine. `evidence/G3/pg/SIGNING_RESULTS.md` (initial seven-test checkpoint retained separately).
- Independent review reproduced and fixed six defects, with eight audit regressions. `evidence/review/independent-safety-review.md`. This is bounded engineering review, not a certified audit.

## Fresh read-only chain observations

`evidence/preflight/2026-10-26T07-33-14-667Z.json` records block29326419 and its hash, verified token decimals/code fingerprints, router/factory/pool reads and four bidirectional Quoter probes. The30-minute pool observation now succeeds, unlike the older handoff snapshot. HSK/USD was74,504seconds old against a3,600-second policy. **B1 remains blocked.** Pool-based observations are not an independent fair-price guarantee. Earlier failed getter probes remain preserved.

## Boundaries and incompleteness

1. The public judge example and private sandbox are synthetic, process-local sessions. The UI is not connected to the durable PostgreSQL coordinator or live chain execution. Restart may lose sandbox state.
2. The tested local coordinator is capability-restricted to SIMULATION/FORK. Cryptographic signers, durable store, canonical RPC verification and production accounting still need end-to-end deployment integration. No live broadcaster is enabled.
3. A bounded structured model adapter exists but has not made any real product-model call. Deterministic simulation is not represented as AI. AI-versus-rule-versus-hold performance has not been measured; no alpha/profitability claim is supported.
4. Actual core browser interactions and screenshots are now verified through the existing cloud desktop runtime, after the initial executor-loopback failures. The prepared standalone Playwright script has not run. Remaining frame-width, recovery and video scope is recorded in evidence/browser-cua/REPORT.md; no full-matrix pass is inferred.
5. The separately approved HSK Argon call completed once with HTTP200. Earlier RecallLedger approval was not reused; actual backend version and charged cost remain unknown.
6. HSKSwap web access returned a regulatory/jurisdiction403. Scope of that restriction and eligibility of any eventual user-operated activity remain unresolved. No bypass was attempted.
7. No dedicated product model, production infrastructure, owner/signer setup, publication/license decision or submission approval has been supplied. Actual financial transfers/trades and wallet actions are for the user to perform, not an automatic continuation of this task.
8. The English entry and video storyboard are drafts, not a submitted entry or recorded video. Legal/prize/KYC and exact submission fields remain partially unverified. Submission SHA and live URLs remain null until they exist.

## Interpretation

Test counts are not a claim that every C/F/W/P/UI specification row has passed. Local and fork coverage does not replace mainnet eligibility evidence. Unknown costs/net results remain null; HSK/USDT/USD units are not interchangeable. Evidence hashes establish content integrity, not factual truth or correctness of reasoning.

Next: finish actual UI acceptance through the now-working built-in cloud desktop, retain the completed external review and subsequent independent regression evidence, then resolve access/credentials and production integration before preparing any owner-operated financial step. Do not lower gates to meet the deadline.

## Post-Argon follow-up
The provider supplied no proof for its broad bigint-overflow allegation. Independent runtime-boundary tests found a narrower concrete defect: already-rounded JavaScript Number input and numeric zero could pass a helper whose API declares bigint fields. Explicit runtime types now reject both, preserving uint width bounds. Five added regression tests pass; the independent audit suite is now13tests. Root reran all112TS/25contract checks and builds/HTTP with realPG successfully. Original failed reproduction logs are retained. This correction has not been sent back for an additional Argon call.

## Durable local composition (08:18 UTC)
The previously separated local coordinator and PostgreSQL store are now composed with an actual ephemeral Anvil node. The local runner persists SIGNING before invoking real fixture keys, recovers both signatures, simulates the exact signed call, writes UNKNOWN before a local send, stores the actual sender/EOA nonce, and confirms a canonical RPC receipt. A new pool/coordinator cannot duplicate signing or submission. Execution chain31337 is enforced; source177 is metadata only. No real asset or remote transaction was used.

Migration002 adds SIGNING/SIGNED barriers and conservatively quarantines old PREPARED rows; execution claims cannot reclaim them. Terminal reconciliation can quarantine on a later reorg without silently reopening execution. Nineteen real PG tests include four spawned-process crash boundaries, latest fence/account-quarantine checks and actual DB shutdown/startup. No automatic quarantine release or production accounting reversal is claimed.

Mandatory cost checks and local drawdown keeper are now implemented. Unknown/stale/future/over-cap execution cost yields HOLD before signatures. Only fresh session-allocated whole-position USDT valuations update observed high water; the keeper requires confirmed, durably recorded REDUCE_ONLY and a final owner-state check before local exit. These are local deterministic checks, not a continuous live stop-loss guarantee.

Root final verification:112TypeScript tests/12files/no skips with actualPG,25native contract tests, typecheck/build/doctor/HTTP passed; servers stopped. UI sessions remain memory-only, the complete responsive/recovery/video matrix and model/live production gates remain incomplete. The external review concerned8f064dab87d0275d1ff0768c2c57f3fd981217ef, not these later changes.

## Browser update (09:00 UTC)
The earlier browser environment blocker was resolved by using the existing built-in cloud desktop's normal terminal and Chromium together; it did not require a new saved coding environment. Actual core desktop interactions and evidence-download integrity passed on source4c4698d. See docs/BROWSER_RUNTIME.md and evidence/browser-cua/REPORT.md. Responsive-frame/restart recovery and video are still in progress, not inferred passes. InlineSVG fixes a visible missing decorative glyph; its post-build visual check is pending. Historical test counts and earlier blocked observations remain dated snapshots.

## Actual browser and video checkpoint (09:44 UTC)
On rendered codeccdbed53, core desktop flows pass, including error handling on normal owned-server shutdown, truthful old-session-not-found after restart and explicit fresh-sandbox recovery after reload. Direct old-page fresh-button recovery was not conclusively observed before reload and remains unasserted. SVG decorative icons are visually fixed.

Ordinary same-origin iframe viewports measured actual innerWidth375/768/1440, height900, corresponding client/scroll widths360/753/1425: no app horizontal overflow. Each width exercised policy preview, explicit acknowledgment and confirmation;768 also repeated rebalance/HOLD/pause. This is real rendered frame responsiveness, not mobile hardware/device emulation and not the entire39-case proposed matrix. DevTools organization policy was respected. The1440 screenshot is a partial wide frame, not a fabricated full-width capture.

A genuine120second continuous local UI video is now available in evidence/video/HSK_Pilot_Local_UI_Demo_120s.mp4, with original180second recording, edit disclosure, hashes, full decode check and inspected frames. It is synthetic local evidence, not a mainnet/real-model/submitted competition video. See evidence/video/verification.json. No new Argon call or financial action occurred.
