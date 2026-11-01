# HSK Pilot

**Approve the trading limits once, then check every decision and every fill.** HSK Pilot is a bounded WHSK/USDT rebalancing assistant for HashKey Chain, built for the HSK Chain Horizon Hackathon (India Track 1). A user sets a session's limits once. An on-chain Guard contract then enforces every trade inside those limits, and each decision and fill leaves evidence you can inspect.

- **Contract:** `TradingSessionGuard` at [`0xe2172A17223BDa552e0CC101591C8893c4B65c81`](https://hsk.blockscout.com/address/0xe2172A17223BDa552e0CC101591C8893c4B65c81) on HashKey Chain mainnet (chainId 177). The source is verified on HashKey Blockscout as a partial match (see [Contract verification](#contract-verification)).
- **Live demo:** http://43.172.183.51:3901/. It runs in **SIMULATION** mode with synthetic data and `liveFundsEnabled: false`. The **AI decision engine is live** there: model `gpt-6-luna` via Sub2API, advisory only. See `/api/health` and `/api/demo/decision`.
- **Demo video:** [evidence/video/HSK_Pilot_Narrated_Demo.mp4](evidence/video/HSK_Pilot_Narrated_Demo.mp4) (161 s, narrated: live demo, AI decision, Guard controls, mainnet txs).
- **License:** [MIT](LICENSE).
- **Mainnet proof:** a real 1 WHSK → USDT SELL ran through the Guard on 2026-11-01. See [Mainnet transactions](#mainnet-transactions).

> The contract has not had a professional security audit. An independent code review found six logic issues, all of which were fixed. B0 `BOUNDED_EXECUTION` limits what the agent is allowed to do. It does not protect against market loss.

## Architecture

```
 Browser UI (React/Vite)
        │  HTTP
 Fastify API server (apps/server) ── session/policy proposals, simulation worker, evidence export
        │                               │
        │                     AI decision engine (LIVE, advisory): server-side Sub2API,
        │                     gpt-6-luna → rule fallback → size clamped to Guard-legal limit
        ▼
 TradingSessionGuard (contracts/, chain 177)
   owner-only startSession / pause / withdrawAll
   execute() needs EIP-712 signatures from BOTH a strategy signer and a risk signer,
   bound to sessionId, policyVersion, intent nonce, quote age, TTL and minOut
        │  exact-input single swap, allowance reset to 0 afterwards
        ▼
 HSKSwap (Uniswap-V3-style) router + QuoterV2, WHSK/USDT 0.3% pool
```

- **UI** (`apps/web`): a judge view, isolated synthetic sessions, English and Chinese policy proposals with explicit confirmation, pause / reduce-only / withdraw, and evidence export.
- **API** (`apps/server`): Fastify. Serves the built UI and `/api/*`, and runs scheduled synthetic simulation. The demo keeps state in process memory.
- **Guard** (`contracts/`): Solidity 0.8.30, Cancun, optimizer 200, viaIR. Enforces a fixed route and fixed assets, dual strategy/risk roles, buy and sell budgets, inventory and exit bounds, and owner recovery.
- **HSKSwap:** the router and QuoterV2 are called directly. The HSKSwap website returned HTTP 403 (jurisdiction) to our research service, and we did not try to get around that.
- **AI decision engine** (`apps/server/ai-decision.ts`): **live** on the public demo. See [AI decision engine](#ai-decision-engine).
- **Support modules** (`packages/`): TypeScript candidate/risk, accounting, indexer and recovery logic. There is also a PostgreSQL durable job store; the demo does not use it.

## AI decision engine

The engine is live on the public demo (`/api/health` → `model.status: CONFIGURED`, provider `sub2api`, name `gpt-6-luna`, role `ADVISORY_DECISION_ENGINE`).

- **Server-side only.** The browser never talks to the model. The Sub2API key is read from the server environment once at startup and then deleted from `process.env`. It is never sent to the client, logged or committed.
- **Endpoints:** `GET /api/demo/decision` and `POST /api/simulations/:id/decision` (the second records an `AI_DECISION` event in that simulation's evidence). The UI shows the result in the **AI decision engine** panel: action, size, explanation and `source`.
- **What the model decides:** the server first builds the deterministic, Guard-legal candidate trade (or none). The model only picks `HOLD` or `REBALANCE` and a size fraction (0–100%) of that candidate, with a reason code and a short explanation, as structured output that is schema-checked.
- **Safety clamp:** the suggested size is `candidate.amountInRaw × sizeFractionBps / 10000`, so it can never exceed `guardMaxAmountInRaw`, the amount the Guard's session limits allow. The model cannot pick assets, route, minOut or recipient.
- **Rule fallback:** if the model is not configured, rate-limited, times out or returns invalid output, the deterministic rule decision is used and the response says `source: "fallback"` with `fallbackReason` (`MODEL_NOT_CONFIGURED`, `RATE_LIMITED` or `MODEL_INVALID_OR_UNAVAILABLE`). AI answers say `source: "ai"`.
- **Limits:** 6 model calls per minute per IP and 30 per minute globally; per-call timeout `HSK_AI_TIMEOUT_MS` (code default 15000 ms; the public demo runs with 10000 ms); identical decisions are cached for 30 s.
- **Advisory only:** responses carry `dataMode: SIMULATION`, `advisoryOnly: true`, `liveFundsEnabled: false`. There is no signer or transaction path from the engine.

Environment variables (names only; never commit values):

| Variable | Purpose |
|---|---|
| `S2A_BASE_URL` | Sub2API base URL (OpenAI-compatible `/v1/chat/completions`) |
| `S2A_API_KEY` | Sub2API key (server env only) |
| `HSK_AI_MODEL` | Model name, default `gpt-6-luna` |
| `HSK_AI_TIMEOUT_MS` | Per-call timeout in ms, default 15000 |

Without `S2A_BASE_URL` and `S2A_API_KEY` the app still runs and every decision is a labelled rule fallback.

## Run locally

Requirements: Node **24.22.1** and pnpm **11.25.0**. Corepack provides pnpm via `packageManager`. Use the committed lockfile.

```sh
pnpm install --frozen-lockfile
pnpm doctor        # environment checks; confirms no model/owner/signing keys are loaded
pnpm typecheck
pnpm test          # vitest; PostgreSQL suites are skipped unless HSK_TEST_DATABASE_URL is set
pnpm build
pnpm start         # http://127.0.0.1:3100  (PORT / HOST override), SIMULATION only
curl http://127.0.0.1:3100/api/health
```

These commands were checked on 2026-11-01 against main after the ai-engine merge:
- `doctor` passed, with 2 warnings.
- `typecheck` passed.
- `test` gave 108 passed and 19 skipped (including the AI decision engine tests). The skipped tests are the PostgreSQL ones, which need a database.
- `build` passed.
- `start` served `/api/health` with `dataMode: SIMULATION`, and `/api/demo/decision` returned a labelled rule fallback (`MODEL_NOT_CONFIGURED`) without Sub2API variables.

No credentials are needed; without the Sub2API variables the AI panel shows rule fallback. `.env.example` lists settings for later work, and the app does not load it automatically.

Optional commands:
- `pnpm build:contracts && pnpm test:contracts`: native Foundry tools.
- `pnpm test:local-chain`: local Anvil.
- `pnpm smoke:http`: the HTTP smoke test. Port 3100 must be free.
- `HSK_TEST_DATABASE_URL=<disposable local PostgreSQL URL> pnpm exec vitest run`: runs the database suites. Never point it at shared data.

## Contract verification

HashKey Blockscout API (`https://hsk.blockscout.com/api/v2/smart-contracts/0xe2172A17223BDa552e0CC101591C8893c4B65c81`), checked 2026-11-01:
- name `TradingSessionGuard`
- `is_verified: true`, `is_partially_verified: true`, `is_fully_verified: false`
- compiler `v0.8.30+commit.73712a01`, optimizer on
- verified 2026-10-29 12:57 UTC+8

The match is partial because the build uses `bytecodeHash=none`, so there is no metadata hash to compare. The runtime code keccak is `0x008d819eb3323bfa315c8f768d4c6d80997ebe56703a6bfd69baa87a2f9aa2da`. The source is pinned at commit `1f1a48d56df96fc6f838d0696f1b5e3500bcf004`.

## Mainnet transactions

All transactions are on HashKey Chain 177. The sender is the owner/TEST account `0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E`. Fees are in HSK and include the L1 fee.

| When (UTC+8) | Run | Step | Tx | Block | Fee |
|---|---|---|---|---|---|
| 2026-10-29 12:56 | WP4 | Guard deploy (paused) | [0xa462e5d7…12efad](https://hsk.blockscout.com/tx/0xa462e5d7465ba224af8271af26be027eab49a8d5447c99d61fb19342e812efad) | 29451318 | 1.409298 |
| 2026-11-01 14:47 | WP6 run 1 | wrap 1 HSK → WHSK | [0x0d5453e8…328759](https://hsk.blockscout.com/tx/0x0d5453e8717c17b08c662f177569bd51df4b27582b6db8e663b5d79cbb328759) | 29584245 | 0.025930 |
| | WP6 run 1 | transfer 1 WHSK → Guard | [0xeeb30123…0b459e](https://hsk.blockscout.com/tx/0xeeb30123d3b67b80122460b1a12c6f1d6561086f3239eada73d3f20ccc0b459e) | 29584246 | 0.023315 |
| | WP6 run 1 | startSession | [0x37fc6e0e…136e5b](https://hsk.blockscout.com/tx/0x37fc6e0ef21b62cd627e71f3ad87352aed6c066a2d93a77527262665d0136e5b) | 29584248 | 0.185132 |
| | WP6 run 1 | withdrawAll (script stopped) | [0xab6c4ccb…1ed51f](https://hsk.blockscout.com/tx/0xab6c4ccb0eded1992c6c8119d20ca843cc38783b83029a1e0530e86e6d1ed51f) | 29584249 | 0.037086 |
| 2026-11-01 15:10 | WP6 retry-1 | transfer 1 WHSK → Guard | [0x9137e480…62992f](https://hsk.blockscout.com/tx/0x9137e48068f4733776f2c6642c600b50dbeb7dec4673972b87776d3bbd62992f) | 29584942 | 0.023315 |
| | WP6 retry-1 | withdrawAll (script stopped) | [0xcc869f0b…98ef8d](https://hsk.blockscout.com/tx/0xcc869f0bfa13b1294c4f47e835577fa0215e99ac1e4a70a638cc8b989598ef8d) | 29584966 | 0.038086 |
| 2026-11-01 18:25 | WP6 retry-2 | transfer 1 WHSK → Guard | [0xa1eb1e04…aa9d70](https://hsk.blockscout.com/tx/0xa1eb1e04de5f6de5c499790d9a8fbdcf33359b8d742ff91f4f8b9e8f64aa9d70) | 29590784 | 0.023315 |
| | WP6 retry-2 | startSession (session 2) | [0x66cb96b6…8fed49](https://hsk.blockscout.com/tx/0x66cb96b60500ae3f0562de566cd81f651b94ad2425e71cbdb3b4e7b6058fed49) | 29590791 | 0.059982 |
| | WP6 retry-2 | **execute SELL 1 WHSK → 87152 USDT raw** | [**0xf2b70347…fd1b1**](https://hsk.blockscout.com/tx/0xf2b703477d4bdfa543156246176f2cf0bd0a6e99858d57f719cefe83741fd1b1) | 29590799 | 0.126561 |
| | WP6 retry-2 | withdrawAll | [0x66068151…c0935a](https://hsk.blockscout.com/tx/0x66068151d1df06a3f96243c024a01fb1fcb14bba9f6ed2caf9cb75e50bc0935a) | 29590801 | 0.037127 |

**Successful trade (retry-2):**
- Quote: 87152 raw USDT (0.087152 USDT) for 1 WHSK, at block 29590796. Both RPCs returned the same quote.
- minOut = floor(quote × 0.99) = 86280.
- Received **87152**, equal to the quote. The quote was 6 s old when the trade landed.
- Both the strategy signer and the risk signer signed the intent. The `TradeExecuted` event records both.
- WP6 gas in total: 0.579852 HSK, under the 0.8 HSK cap.

**Earlier runs stopped on false alarms, and funds were returned each time.** Run 1 and retry-1 stopped after their own post-transaction checks raised false alarms:
- **Run 1:** a read at `latest` on the load-balanced RPC returned stale state.
- **Retry-1:** the check compared the receipt's provisional `blockHash` against the final one.

Both times the script followed the stop rule: it sent `withdrawAll` and returned every token to the owner. Pinned reads afterwards showed that the chain state had been correct all along.

Retry-2 completed the whole sequence. After the trade, the script raised one more false alarm (an unretried block-timestamp read), and its rollback was the planned `withdrawAll`. A fixed version of the script is in the retry-2 `tools/` folder.

**End state:** Guard PAUSED, session 2, policy version 5, no balance and nothing allocated. All six router/Guard allowances are 0. Both RPCs confirmed this at a pinned block.

## Evidence map

| Path | Contents |
|---|---|
| `evidence/HO-hsk-mainnet-1/` | Mainnet hand-off packet: preflight, provenance, unsigned deploy preview, paused-fork smoke tests |
| `evidence/HO-hsk-mainnet-1/wp4-deploy-20261029/` | Guard deployment: PRECHECK, BROADCAST, RECEIPT, POSTCHECK, VERIFY, Blockscout `standard-input.json` |
| `evidence/HO-hsk-mainnet-1/wp6-exec-20261101/` | WP6 run 1: EXEC.json, FINDINGS.md, before/after state on both RPCs, receipts, anomaly diagnosis, local fork rehearsal, tools |
| `evidence/HO-hsk-mainnet-1/wp6-exec-20261101/retry-1/` | Retry-1 (stopped on the blockHash false alarm, funds returned) |
| `evidence/HO-hsk-mainnet-1/wp6-exec-20261101/retry-2/` | Retry-2, the successful execute: EXEC.json, FINDINGS.md, pinned-verify-reads.json, before/after state, fork rehearsal, tools (including the block-read fix) |
| `contracts/evidence/` | Local Anvil integration, fixed-block HSKSwap fork test, durable local runner |
| `evidence/final/`, `evidence/G3/` | Logs from tests, typecheck, doctor, contracts and build; HTTP smoke; PostgreSQL results |
| `evidence/review/`, `review/` | Independent safety review, corrected contract suite, external Argon review and its adjudication |
| `evidence/browser-cua/`, `evidence/video/` | Real browser walkthrough with screenshots; two-minute synthetic UI recording; narrated demo video (live demo, AI decision, Guard, mainnet txs) |
| `evidence/preflight/`, `evidence/G0/` | Read-only network preflights; official-source checks |

## Limits and honesty notes

- The public demo runs **simulation only**. It holds no live funds and runs no live broadcaster. The AI engine is advisory and only produces simulated decisions. The only real-money activity is the mainnet runs listed above. The owner approved and sent each one separately, and none are automated.
- DEX quotes and minOut are **not independent fair prices**, and USDT is not guaranteed to equal USD. B1 `ORACLE_GUARDED` mode is disabled. The HSK/USD feed was stale when we checked it.
- There is no evidence of investment performance or alpha.
- Third-party dependency notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE) © 2026 peterpeter228
