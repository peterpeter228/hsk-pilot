# HSK Pilot — English submission draft

**DRAFT / NOT SUBMITTED.** Prepared 2026-10-26. Field headings below are an editorial draft, not a verified event-specific form schema. No public demo, mainnet address, video or submission ID is available.

## Name and one-line description

**HSK Pilot** — a prototype for bounded WHSK/USDT rebalancing, with inspectable policies, decisions and execution evidence.

## Problem

Giving an AI a trading endpoint is easy; making its authority understandable and its outcomes independently checkable is harder. A user needs to distinguish a permitted action, a rejected proposal and an actual fill, including costs and uncertainty.

## Intended solution

The owner defines one session's boundaries. An AI chooses HOLD or a bounded rebalance from deterministic candidates; risk checks and a two-role on-chain Guard constrain execution. The design limits assets and route, gross USDT buying, native WHSK inventory, expiry, policy version, nonce and minimum received amount. Selling does not restore gross-buy budget. The owner retains pause and recovery controls.

## What is implemented and demonstrated

The current deliverable is a local **SIMULATION** prototype: React/Vite UI, Fastify API, isolated in-memory synthetic sessions, narrow English/Chinese policy commands with explicit confirmation, scheduled synthetic decisions and evidence export. Solidity Guard and TypeScript risk/accounting/recovery components have local tests. The corrected native contract suite passes 25 tests, including two 256-run fuzz tests and a 64×32-call invariant. Anvil integration passed with 19 local receipts on chain31337, exercising strategy/risk selection, dual signatures/full simulation, policy tightening, reduce-only and pause/withdrawal. These receipts are local, not HSK mainnet transactions. A separate fixed-block local FORK test passes against the real HSKSwap router state at block29,326,419 for sell/buy, minOut rejection, reduce-only and withdrawal (`contracts/evidence/fork-test.log`). Public RPC reads and local fork execution do not clear the HSKSwap jurisdictional-access gate or constitute an external financial broadcast. The final integrated TypeScript run passes 112 tests across twelve files with zero skips, including nineteen tests against actual PostgreSQL18.4. Those tests and actual process restarts verify durable coordination. A separate composed runner also connects the real PostgreSQL store, LocalCoordinator and Anvil31337 for actual local signature/simulation/buy/confirmation and restart without duplicate signing or sending. The web demo itself remains memory-only, and none of this is a production autopilot.

A bounded independent code review identified six logic defects, which were fixed with eight passing independent regression tests. It is not a professional audit certificate. One authorized Argon review completed; its unverified severity claims were adjudicated in review/ARGON_VERIFICATION_2026-10-26.md. A separate runtime numeric-type defect was reproduced and corrected with regression tests. A product-model adapter is implemented, but no real model credentials or real AI decision run are available. The demo's deterministic synthetic behavior is not represented as LLM output.

## Track 1 fit — goal versus present evidence

The target is AI-led monitoring, candidate selection, constrained autonomous HSKSwap execution, natural-language policy adjustment and cost-aware results. Current evidence covers local components and read-only HSK network queries, **not a complete real AI-to-mainnet loop**. There is no mainnet contract deployment or financial trade; therefore the official mainnet deployment gate for demo selection is unmet. No real-browser click acceptance or hosted public demo is claimed.

## Protection and limitations

B0 BOUNDED_EXECUTION constrains permissions but cannot guarantee fair prices, liquidity, stop-loss execution, capital preservation or profitability. USDT-denominated DEX valuation is not a guaranteed USD value. B1 ORACLE_GUARDED remains disabled because independent-feed validation has not passed; there is no silent downgrade. A recent same-pool 30-minute observation succeeds, but it is not an independent fair-price source. HSKSwap's research-service jurisdictional 403 remains an unresolved lawful-access gate and has not been bypassed.

No alpha, sustained profit, user adoption or revenue claim is made. No real trading-performance sample or AI-versus-rule baseline result exists. Future evaluations must show the observation window, same-start HOLD/fixed-rebalance comparisons, realized/unrealized results, losses, gas/model costs and valuation freshness.

## Architecture

Browser → synthetic Fastify session service → deterministic policy/risk/accounting modules. Separately implemented: Solidity Guard, read-only chain preflight and PostgreSQL durable job substrate. Intended future runner/model/signing/chain integration must be validated before it can be described as deployed. Two logical signing roles do not imply independent organizations or decentralized consensus.

## Originality, dependencies and AI assistance

The repository began from a supplied development specification/research hand-off. AI development agents assisted implementation, independent review, test authoring and documentation. Existing specifications and historical research are distinct from newly executed tests. Git history and source hashes should be used to identify event-period changes; no rewritten authorship or backdated history is claimed. Dependencies and exact installed versions/licenses are inventoried in THIRD_PARTY_NOTICES.md. Project-source publication/license is awaiting the owner's decision.

## Links and identity

- Private source: https://github.com/peterpeter228/hsk-pilot — judge access not yet established.
- Final submitted source SHA, demo URL, mainnet Guard/deployment transaction, video URL, entrant/contact and submission ID: **not yet established**, recorded as null in `release-manifest.json`.
- Local evidence: README evidence links and `evidence/review/independent-safety-review.md`.

## Before submitting

Confirm actual form fields; lawful access; real model and complete integration; browser and deployment evidence; judge code access; entrant details; video if required; owner-controlled wallet actions; then update claims only where evidence supports them. Official body cutoff: **November 1, 2026 at 16:00 UTC / November 2 at 00:00 Beijing**. The conflicting later header widget is not relied on. Online participation is contemplated but Mumbai in-person demonstration has selection priority; this draft does not claim selection or prize eligibility approval.
