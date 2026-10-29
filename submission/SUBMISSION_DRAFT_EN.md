# HSK Pilot — English submission draft

**DRAFT_NOT_SUBMITTED.** Reconciled 2026-10-27 for HO-hsk-mainnet-1; no remote draft save or formal submission was performed. Headings are expected editorial fields, not a verified event-specific form schema. The repository is PUBLIC. Historical local browser and video evidence exists; a hosted demo, mainnet Guard deployment and submission ID do not.

## Name and one-line description

**HSK Pilot** — a prototype for bounded WHSK/USDT rebalancing, with inspectable policies, decisions and execution evidence.

**Intended track:** Track 1 — AI Agent Trading; the final form's choices and required fields remain unverified.

## Problem

Giving an AI a trading endpoint is easy; making its authority understandable and its outcomes independently checkable is harder. A user needs to distinguish a permitted action, a rejected proposal and an actual fill, including costs and uncertainty.

## Intended solution

The owner defines one session's boundaries. An AI chooses HOLD or a bounded rebalance from deterministic candidates; risk checks and a two-role on-chain Guard constrain execution. The design limits assets and route, gross USDT buying, native WHSK inventory, expiry, policy version, nonce and minimum received amount. Selling does not restore gross-buy budget. The owner retains pause and recovery controls.

## What is implemented and demonstrated

The current UI deliverable is a local **SIMULATION** prototype: React/Vite UI, Fastify API, isolated in-memory synthetic sessions, narrow English/Chinese policy commands with explicit confirmation, scheduled synthetic decisions and evidence export. The [historical 2026-10-26 run summary](../evidence/final/run-summary.json) records 112 TypeScript tests, 25 contract tests, 19 Anvil receipts and fixed-block HSKSwap fork checks. These are attributed historical results, not checks newly run for this draft. Anvil and fork execution used chain 31337; the fork's HSK source chain was 177 at block 29326419. No local receipt is an HSK mainnet transaction. The [durable local composition](../contracts/evidence/durable-local/verification.json) separately records PostgreSQL coordination, actual local signatures/simulation and restart without duplicate sending. The web sandbox remains memory-only, not a production autopilot.

Actual [browser acceptance](../evidence/browser-cua/REPORT.md) covers core synthetic desktop flows, evidence-export integrity, representative ordinary iframe policy flows at widths 375/768/1440 and limited service-outage/recovery behavior. It does not establish the full live matrix, mobile hardware or live-wallet acceptance. The [120-second recorded UI clip](../evidence/video/HSK_Pilot_Local_UI_Demo_120s.mp4) and [video verification](../evidence/video/verification.json) identify rendered source **`ccdbed53c4e57d8817e0d4e82fd22023c996b713`**. All business data and fills in that footage are **SIMULATION / synthetic**: no real-model run, mainnet footage or real funds. Export/capabilities actions were not established in the recording; separate browser export evidence must not be described as filmed.

A bounded independent code review identified six logic defects, which were fixed with eight passing independent regression tests in the historical [review record](../evidence/review/independent-safety-review.md). It is not a professional audit certificate. One authorized Argon review completed; its unverified severity claims were adjudicated in [ARGON_VERIFICATION_2026-10-26.md](../review/ARGON_VERIFICATION_2026-10-26.md). A separate runtime numeric-type defect was reproduced and corrected with regression tests. A product-model adapter is implemented, but no real product-model decision run is demonstrated. The demo's deterministic synthetic behavior is not represented as LLM output.

## Track 1 fit — goal versus present evidence

The target is AI-led monitoring, candidate selection, constrained autonomous HSKSwap execution, natural-language policy adjustment and cost-aware results. Present evidence covers local components/browser behavior and read-only HSK queries, **not a complete real AI-to-mainnet loop**. A paused TradingSessionGuard is deployed on HashKey Chain mainnet (177) at [`0xe2172A17223BDa552e0CC101591C8893c4B65c81`](https://hsk.blockscout.com/address/0xe2172A17223BDa552e0CC101591C8893c4B65c81) (tx [`0xa462e5d7465ba224af8271af26be027eab49a8d5447c99d61fb19342e812efad`](https://hsk.blockscout.com/tx/0xa462e5d7465ba224af8271af26be027eab49a8d5447c99d61fb19342e812efad), source verified on Blockscout); there is no session funding or real financial trade. Local browser evidence is real but synthetic; no hosted public demo or completed Track 1 acceptance is claimed.

## Mainnet preparation — not deployment

HO-hsk-mainnet-1 pins contract source to [`1f1a48d56df96fc6f838d0696f1b5e3500bcf004`](https://github.com/peterpeter228/hsk-pilot/tree/1f1a48d56df96fc6f838d0696f1b5e3500bcf004). The [unsigned action plan](../templates/MAINNET_ACTION_PLAN.md) prepares only a zero-value paused Guard creation on chain 177. **WP4 DEPLOYED_PAUSED (2026-10-29 12:56 UTC+8)**: Guard `0xe2172A17223BDa552e0CC101591C8893c4B65c81` ([explorer](https://hsk.blockscout.com/address/0xe2172A17223BDa552e0CC101591C8893c4B65c81)), tx `0xa462e5d7465ba224af8271af26be027eab49a8d5447c99d61fb19342e812efad` ([explorer](https://hsk.blockscout.com/tx/0xa462e5d7465ba224af8271af26be027eab49a8d5447c99d61fb19342e812efad)), block 29451318, status 1, `status()`=PAUSED(0), `owner()`=TEST `0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E`, fee 1.409298206778016016 HSK, Blockscout source verified (partial match, bytecodeHash=none). Evidence: evidence/HO-hsk-mainnet-1/wp4-deploy-20261029/. No session, funding, unpause or trade. Historical (superseded) note: WP4 was WAITING_GAS / NOT_BROADCAST, using the recorded zero balance of designated TEST deployer `0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E`; this wording reconciliation did not re-query that balance. Proposed `initialOwner=TEST` is not final owner-role authorization. Exact native-HSK spend ceiling, authorization expiry, complete fee bound and remaining release-gate evidence are unresolved. A positive balance alone would not authorize broadcast, and the external funding recommendation is neither approval nor a sufficient fee bound. No gas sourcing, Guard/session funding, token approvals, session activation or live trades belong to this preparation.

The historical [MAINNET_READONLY preflight copy](../evidence/HO-hsk-mainnet-1/preflight-177-20261027.json) was observed at `2026-10-27T08:56:22.032Z`, block `29372120`, hash `0x6a111c40dbe323e24bd193cf32411f6ea648e0356d6cffca0b7dad56295c3e73`. Its `READS_VERIFIED_NOT_EXECUTION_APPROVAL` result is read-check success, not deployment approval. [Evidence index](../templates/EVIDENCE_INDEX.md) separates this report, the unsigned packet, historical browser/video identity and the implementation receipt; later documentation/evidence checkpoints are not substituted for contract-source or video-source identities. Original user evidence is preserved separately without being swept into this change.

## Protection and limitations

B0 BOUNDED_EXECUTION constrains permissions but cannot guarantee fair prices, liquidity, stop-loss execution, capital preservation or profitability. USDT-denominated DEX valuation is not a guaranteed USD value. B1 ORACLE_GUARDED remains disabled because independent-feed validation has not passed; there is no silent downgrade. A recent same-pool 30-minute observation succeeds, but it is not an independent fair-price source. HSKSwap's research-service jurisdictional 403 remains an unresolved lawful-access gate and has not been bypassed.

No alpha, sustained profit, user adoption or revenue claim is made. No real trading-performance sample or AI-versus-rule baseline result exists. Future evaluations must show the observation window, same-start HOLD/fixed-rebalance comparisons, realized/unrealized results, losses, gas/model costs and valuation freshness.

## Architecture

Browser → synthetic Fastify session service → deterministic policy/risk/accounting modules. Separately implemented: Solidity Guard, read-only chain preflight and PostgreSQL durable job substrate. Intended future runner/model/signing/chain integration must be validated before it can be described as deployed. Two logical signing roles do not imply independent organizations or decentralized consensus.

## Originality, dependencies and AI assistance

The repository began from a supplied development specification/research hand-off. AI development agents assisted implementation, independent review, test authoring and documentation. Existing specifications and historical research are distinct from newly executed tests. Git history and source hashes should identify event-period changes; no rewritten authorship or backdated history is claimed. Dependencies and exact installed versions/licenses are inventoried in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md); the inventory is not legal clearance. The repository is already PUBLIC, but project-source licensing remains undecided (`projectLicense: null`). Public visibility does not establish licensing approval, originality acceptance or permission to disclose private contact/draft material.

## Links and identity

- PUBLIC repository: https://github.com/peterpeter228/hsk-pilot . Fixed contract/source candidate: [`1f1a48d56df96fc6f838d0696f1b5e3500bcf004`](https://github.com/peterpeter228/hsk-pilot/tree/1f1a48d56df96fc6f838d0696f1b5e3500bcf004); not a submitted or deployed revision.
- [Release manifest](release-manifest.json): `status=DRAFT_NOT_SUBMITTED`; Guard address `0xe2172A17223BDa552e0CC101591C8893c4B65c81` and deployment hash `0xa462e5d7465ba224af8271af26be027eab49a8d5447c99d61fb19342e812efad` are recorded; `submissionSha`, `submissionId` and hosted demo/video URLs remain null; `realTradeTransactionHashes=[]`. The actual local video artifact is linked above even though `videoUrl` is null.
- Entrant/contact fields remain null in this public packet to preserve their existing external-only disclosure scope, not to imply that no contact evidence exists. No private field-draft text or personal contact is copied into the repository.
- [Evidence index](../templates/EVIDENCE_INDEX.md) and [implementation receipt](../evidence/HO-hsk-mainnet-1/RECEIPT.json) distinguish historical results from the root's integration checks. Only the actual root-owned receipt contents establish new results, checkpoint identity and delivery outcomes; no receipt-containing commit is given a fabricated self-referential SHA.

## Before submitting

Confirm the actual logged-in form fields, legal/terms and consent requirements, lawful service access, real-model/production integration, required live deployment evidence, judge demo/video access, authorized entrant/contact disclosure and unresolved project licensing/KYC/tax/payout conditions before any separately authorized submission. No form interaction, terms acceptance, account registration, remote draft save, Submit Build, X publication or organizer contact is performed by this draft preparation. The conservative cutoff from the [recorded official-rule review](../docs/01_VERIFIED_RULES_AND_DECISIONS.md) is **November 1, 2026 at 16:00 UTC / November 2 at 00:00 Asia/Shanghai**; the conflicting later header widget is not relied on, and no new official-rule check is claimed here. Online participation is contemplated but Mumbai in-person demonstration has selection priority; this draft does not claim selection, legal clearance or prize eligibility approval.
