# HSK Pilot

**Local development prototype · SIMULATION · not a live trading service.**

A bounded WHSK/USDT rebalancing assistant being developed for HSK Chain Horizon Hackathon, India Track 1. Product goal: **approve the boundaries once; inspect every decision and every fill.** This goal is not a claim that the production autonomous loop is complete.

## What runs today

- React/Vite interface and Fastify server: read-only synthetic judge view, isolated synthetic sessions, narrow English/Chinese policy proposals and explicit confirmation, server-side scheduled simulation, HOLD/rebalance, pause, reduce-only, synthetic withdrawal, evidence export.
- Solidity `TradingSessionGuard`: fixed route/assets, strategy **and** risk roles, policy-version and nonce binding, gross-buy limits, inventory/exit bounds, owner recovery. Local tests are not a mainnet integration certificate.
- TypeScript candidate/risk, accounting, indexer and recovery modules; structured-model adapter exists but no real product model has been configured or exercised.
- PostgreSQL durable job-store substrate has real local database concurrency and restart evidence. **The web demo does not use it:** demo sessions and tokens live in process memory and disappear on restart. No live broadcaster or wallet route exists.

Actual core desktop browser clicks are now verified, with exact remaining scope in [the browser report](evidence/browser-cua/REPORT.md). No public hosted demo, mainnet deployment/trade, finished video or competition submission is claimed. No investment-performance/alpha evidence exists. Independent code review found and fixed six logic issues; this is **not a certified security audit**; see the completed external review and independent adjudication in review/ARGON_VERIFICATION_2026-10-26.md.

## Run locally

Use Node **24.22.1** and pnpm **11.25.0** (declared in `package.json`), with the committed lockfile. Installation may require network access and package-manager authorization in your environment.

```sh
pnpm install --frozen-lockfile
pnpm doctor
pnpm typecheck
pnpm test
pnpm build
pnpm start
# Open http://localhost:3100 — synthetic data only
```

`pnpm dev` starts the TypeScript server; it still serves the built web files, so run `pnpm build` first. `PORT` defaults to 3100 and `HOST` to 127.0.0.1. Set `APP_BASE_URL` to the exact browser origin if changed. `BUILD_SHA` optionally labels the serving build; set it only to the actual checkout SHA. No credential is required for the local demo. `.env.example` documents prospective settings; the app does not automatically load it or enable a real model/live execution when it is copied.

```sh
pnpm build:contracts
pnpm test:contracts
# HTTP smoke: starts/stops its own server; port 3100 must be free.
node scripts/http-smoke.mjs
```

The Foundry wrapper uses installed native tools and local-only build/test operations. Solidity config: 0.8.30, Cancun, optimizer 200, viaIR, metadata bytecode hash disabled; see `contracts/foundry.toml`. A fixed-block HSKSwap fork run is tracked in `contracts/evidence/fork-test.log`; only its completed assertions establish compatibility, not compiler configuration alone. Fork execution is local, not an external broadcast or jurisdiction clearance.

PostgreSQL integration tests are **skipped** by default when no isolated test URL exists; skipping is not passing. For a disposable authorized local PostgreSQL database whose role can create/drop schemas:

```sh
HSK_TEST_DATABASE_URL='postgresql://LOCAL_TEST_ROLE@127.0.0.1:LOCAL_PORT/LOCAL_TEST_DB'   pnpm exec vitest run tests/server/job-store.test.ts
```

Replace the illustrative connection parameters; do not point tests at shared/production data. Tests create and drop a random schema. Database process restart is a separate check, recorded in the evidence below. Additional implemented entrypoints are `pnpm test:local-chain` (local Anvil/mock chain), `pnpm test:e2e` (requires an available browser) and `pnpm smoke:http`. An entrypoint is not a passing result; inspect its evidence. There is no implemented `lint` or `test:contracts-integration` package script; older specification command contracts are not execution results.

## Evidence and limits

| Evidence | What it establishes |
|---|---|
| [Integrated TypeScript tests](evidence/final/tests.log) | 112 tests across twelve files pass, zero skips, including actual PostgreSQL18.4 integration; no model/live/browser claims |
| [Typecheck](evidence/final/typecheck.log), [doctor](evidence/final/doctor.log), [native contracts](evidence/final/contracts.log) | Final local commands pass; doctor confirms no application model or owner/signing keys loaded |
| [HTTP smoke](evidence/G3/http-smoke.json), [build log](evidence/final/build.log) | Built app and HTTP synthetic flow, not browser acceptance |
| [PostgreSQL results](evidence/G3/pg/RESULTS.md) | Seven real local-DB tests and process restart; substrate, not wired live autopilot |
| [Independent review](evidence/review/independent-safety-review.md) | Six corrected logic flaws, twenty-seven current independent regressions and corrected 25-test local contract suite; exact scopes and limitations recorded |
| [Local Anvil integration](contracts/evidence/local-integration.json) | PASS with 19 local receipts on chain31337: strategy/risk, dual signatures and full simulation, policy tightening, reduce-only, pause/withdrawal; not HSK mainnet |
| [Corrected native contract suite](evidence/review/contract-suite-corrected-harness.log) | 25 passing tests, two 256-run fuzz cases and 64×32 invariant calls; earlier daily-budget ghost-ledger harness error retained separately |
| [Fixed-block HSKSwap fork](contracts/evidence/fork-test.log) | One passing real-router sell/buy/minOut/reduce/withdrawal test against public read-only state at block29,326,419; local FORK, no external broadcast or jurisdiction clearance |
| [Read-only preflight](evidence/preflight/2026-10-26T07-33-14-667Z.json) | Timestamped HSK network reads/quotes, not fills or authorization |
| [Official-source recheck](evidence/G0/official-recheck.md) | Event facts, deadline conflict, unverified form fields and access restriction |
| [Web acceptance boundary](apps/web/IMPLEMENTATION.md) | Implemented UI checks; current actual core-browser results are in evidence/browser-cua/REPORT.md |

Each evidence record describes its own tested source/time. Earlier records may correctly predate repository creation and use source hashes. They must not be relabeled as tests of a later commit without rerunning. Final delivery identity belongs in [release manifest](submission/release-manifest.json); `null` means not established.

### Protection and access

B0 `BOUNDED_EXECUTION` limits authority, not market loss. DEX quotes/minOut are **not independent fair prices**; USDT is not guaranteed USD. B1 `ORACLE_GUARDED` stays disabled. The linked 2026-10-26 07:33 UTC preflight at block 29,326,419 found the HSK/USD feed 74,504 seconds old against a 3,600-second threshold; a 30-minute same-pool observation now succeeds, unlike the historical research snapshot, but does not provide independent fair-price protection.

The HSKSwap website returned a jurisdictional HTTP403 to the research service. Scope/applicability remains unresolved: do not bypass restrictions or assume protocol access is an authorized substitute. Any actual wallet action, funding or trade is an owner hand-off step, not an agent operation authorized by this README.

## Delivery and event status

Private repository: https://github.com/peterpeter228/hsk-pilot . Access is not automatically granted to judges. No open-source license has been selected; private delivery, licensing and public publication are separate decisions. Dependency notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The official body deadline is **November 1, 2026, 16:00 UTC / November 2, 00:00 Beijing**; a later header-widget deadline conflicts. Plan against the earlier time. Mainnet contract deployment is required for demo selection, so this local prototype has **not** met that eligibility gate. See [owner hand-off](docs/OWNER_HANDOFF.md), [English draft](submission/SUBMISSION_DRAFT_EN.md), [three-minute storyboard](submission/VIDEO_STORYBOARD.md), and [unsigned action plan](templates/MAINNET_ACTION_PLAN.md). Nothing in this repository constitutes submission, registration or a claim of selection.

## External review checkpoint
One user-approved Argon request reviewed source commit `8f064dab87d0275d1ff0768c2c57f3fd981217ef`. See [original final answer](review/ARGON_ORIGINAL_2026-10-26.md), [receipt](review/ARGON_RECEIPT_2026-10-26.json), and [independent verification](review/ARGON_VERIFICATION_2026-10-26.md). Its alleged integer overflow was not reproduced, but adversarial follow-up exposed unsafe runtime Number acceptance in bigint-declared fields; explicit type validation now rejects it. The post-review root run passed 112 TypeScript tests across twelve files, no skips, plus25contract tests. The browser gate is partially verified; live gates remain blocked.

## Composed local execution checkpoint
The separate [durable local runner](contracts/script/durable-local-integration.mjs) now connects LocalCoordinator, actual PostgreSQL and an owned Anvil chain31337. It verifies write-ahead SIGNING, both actual EIP-712 signature recoveries, full signed-call simulation, one actual local buy, sender/EOA nonce persistence, canonical receipt confirmation and restart without another signer/send call. [Machine evidence](contracts/evidence/durable-local/verification.json). Source-chain metadata177 is not the execution chain.

`HSK_TEST_DATABASE_URL=<dedicated loopback PostgreSQL URL> pnpm run test:durable-local-chain` runs that isolated test and removes its random schema. Never use a shared or production database. Apply migrations001 and002 in order for the durable store;002 conservatively quarantines legacy PREPARED intents.

[Signing integration](evidence/G3/pg/SIGNING_RESULTS.md) includes19actual PostgreSQL tests and process-crash/restart probes. The final root suite passes112tests/twelve files, including27independent audit tests, plus25native contract tests. Cost limits now HOLD on unknown/stale/over-cap estimates; the local stop keeper persists confirmed REDUCE_ONLY before attempting an exit. Synthetic zero cost estimates are assumptions, not measured free trades. The actual local gas fee is recorded separately.

This does not change the UI's process-memory sandbox into a deployed production trading service. The full responsive/recovery/video matrix, product LLM, lawful service access, owner-operated mainnet work and publication/submission remain incomplete. New local-composition/cost/keeper work received independent tests and review, not an additional Argon call.
