# HSK Pilot — Submission Draft

**DRAFT ONLY — created 2026-10-26. Do not submit until every TODO is replaced with verified project evidence. No deployment, test result, user study, or profitability claim is established by this template.**

## One sentence

HSK Pilot (using its TradingSessionGuard contract) lets a user approve explicit trading limits once, then lets an AI agent monitor HSKSwap and execute within those limits, with traceable decisions, rejections, and results.

## Track

AI Agent Trading — HSK Chain Horizon Hackathon · India.

## Problem

An autonomous trading agent needs more than a transaction key. Its user needs to understand what it may do, change those limits, stop new exposure, and verify what happened after execution.

## What we built

**TODO: Replace this section with implemented and tested capabilities only.**

Our intended MVP uses one owner-controlled, non-upgradeable small-balance account and a verified WHSK/USDT route on HSKSwap. A market monitor creates bounded rebalancing candidates. At relevant events, an AI strategy agent selects HOLD or REBALANCE using fresh tool data. Independent deterministic controls and the on-chain policy enforce the approved limits.

The owner explicitly selects **B0 — BOUNDED_EXECUTION** and approves a small budget. This mode enforces a gross native-USDT buying budget, a native-WHSK inventory cap, minimum output, short quote validity, and two fixed signer roles. The RiskSigner independently queries the DEX Quoter. **B1 — ORACLE_GUARDED** is a separate optional mode and is currently blocked pending validated independent pricing; the system must not silently downgrade it to B0.

The user can inspect positions and **USDT-denominated, DEX-valued P&L** through natural language, preview policy changes, and approve a new policy version. Routine trades within the approved session do not require a separate manual confirmation. In B0, an off-chain keeper observes DEX-valued NAV and writes REDUCE_ONLY in a separate persistent transaction before attempting a sale. This state blocks increased WHSK exposure while preserving constrained risk reduction. The owner retains a withdrawal path that does not depend on an oracle price.

## Why AI is necessary here

**TODO: Show one real decision and the evidence of the AI's effect.**

The AI selects among limited, feasible actions and explains its choice. It cannot invent asset addresses, change authorization, or submit arbitrary calldata. Numeric calculations and final enforcement remain deterministic. We compare its choices with a fixed rebalancing baseline to test whether the model adds value.

## HSK Chain and HSKSwap integration

| Evidence | Verified value |
| --- | --- |
| Chain ID | 177 — TODO: attach deployment evidence |
| Live read-only demo | TODO |
| Repository and commit SHA | TODO |
| Mainnet contract address | TODO |
| Deployment transaction | TODO |
| Source verification URL | TODO |
| Verified router and pool | TODO |
| Protection mode and explicit owner approval | TODO — B0 or validated B1; no silent downgrade |
| Valuation source and as-of time | TODO — USDT / DEX reference for B0 |
| Real autonomous swap transaction | TODO |
| Optional opposite-direction execution | TODO — project evidence recommendation, not an official minimum |
| Evidence download and independent verification | TODO |

## Demonstration

**TODO: Add the final video URL and actual duration accepted by the submission form.**

1. Show the explicitly approved B0 protection mode, its native-asset limits, and its DEX valuation source.
2. Show a real autonomous rebalance caused by the initial allocation differing from the target.
3. Change the policy and demonstrate rejection of an outdated or excessive request.
4. Demonstrate the separate persistent REDUCE_ONLY transition, a constrained sale, and the owner's oracle-independent withdrawal path.
5. Show costs, P&L, and independently verifiable evidence.

Mainnet recordings, live reads, eth_call simulations, fixed-block fork replays, and synthetic examples are explicitly labeled. We do not present a simulated rejection as a broadcast mainnet revert.

## Validation and measured results

**TODO: Report only completed measurements. Include failed or blocked cases.**

| Measurement | Result | Scope / evidence |
| --- | --- | --- |
| End-to-end mainnet execution | TODO | TODO |
| Unauthorized actions in defined attack cases | TODO | TODO |
| Legitimate actions incorrectly rejected | TODO | TODO |
| Policy version and replay behavior | TODO | TODO |
| Reduce-only and withdrawal behavior | TODO | TODO |
| Browser interaction at 375 / 768 / 1440 px | TODO | TODO |
| AI latency and cost | TODO | TODO |
| Net observed P&L, including relevant costs | TODO | TODO |
| HOLD and fixed-rebalance comparison | TODO | TODO |

## Originality and AI-assisted development

**TODO: List work completed during the hackathon, pre-existing components, third-party dependencies and licenses, and how AI coding tools were used.**

Do not claim other participants' designs, code, address research, or test results as original work. The team reviewed the generated implementation and records the actual validation evidence.

## Limitations

Our current observation window is **TODO**. It is too short to establish sustained profitability unless stronger evidence is provided. Rebalancing can lose money, transaction costs can outweigh gains, and market or liquidity conditions can prevent timely execution. Risk controls constrain actions; they do not eliminate financial or software risk. B0 does not provide independent USD fair-value pricing, manipulation resistance, principal protection, or guaranteed stop-loss execution. RPC failure or insufficient liquidity can prevent a timely state transition or sale, and DEX valuation itself can be distorted.

The current model/provider is **TODO**. The current implementation's custody, key isolation, oracle dependencies, and failure behavior are **TODO**. An evidence hash proves consistency with committed bytes, not that a model's reasoning was correct.

## Next steps

**TODO: Choose the next work from observed weaknesses.**

Extend forward observation, compare against fixed strategies under identical costs, validate user understanding of session limits, and assess whether developers would reuse the policy and evidence interface.

## Team and demo attendance

Individual or team: TODO.

Contact details approved for submission: TODO.

Mumbai in-person or requested online demo: TODO. Do not claim an allocated demo slot before organizer confirmation.

## Final review before submission

All TODOs resolved or explicitly described as incomplete; actual platform fields checked; public links accessible; no secrets included; actual contract and transaction evidence recorded; policy and repository versions aligned; AI and third-party use disclosed; user authorization for submission recorded.
