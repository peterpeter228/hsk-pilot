# Three-minute storyboard — NOT a recorded video

Suggested editorial duration only; official event-specific video requirements are unverified. This is a truthful **current local-prototype** cut, not a script pretending that future mainnet work has happened. Record only after actual browser acceptance becomes available. Keep a persistent `SIMULATION • SYNTHETIC DATA • NO REAL FUNDS` label on all app footage. Never show keys, API tokens or personal account details.

| Time | Capture to make | Suggested English narration |
|---|---|---|
| 0:00–0:20 | Title and local read-only view; no wallet prompt | “HSK Pilot explores a simple idea: approve trading boundaries once, then inspect every decision. This is our local synthetic prototype, not a live trading service.” |
| 0:20–0:50 | Open synthetic sandbox; type supported target/limit/cooldown command; inspect policy diff; decline then confirm | “The interface turns a narrow supported command into an explicit policy change. Nothing here is a wallet signature, and no real model is connected yet.” |
| 0:50–1:20 | Start synthetic scheduler; display the actual returned decision and subsequent HOLD, if produced; show timestamps | “The server advances this synthetic session without a click for each simulated action. These are synthetic fills, not HSKSwap transactions. Missing or failed results remain visible rather than becoming success animations.” |
| 1:20–1:50 | Show local test output for two-role authorization, gross-buy budget and stale policy rejection; readable test environment label | “Local contract and risk tests exercise authorization boundaries. Selling must not replenish buying budget, and stale policy versions must fail. A separate local fixed-block fork tests the real HSKSwap router, but neither result is a live deployment or proof of the complete production loop.” |
| 1:50–2:15 | Synthetic reduce-only, pause and withdrawal controls; actual state returned by server | “Reduce-only stops new exposure in this simulation. Owner recovery is a design priority, but no stop-loss execution price or capital safety is guaranteed.” |
| 2:15–2:40 | Export actual synthetic envelope; show `realTransactionHashes: []`; briefly show real local PG evidence separately | “This export identifies synthetic data and contains no real transaction hashes. The durable database substrate passed local concurrency and restart tests, but is not yet wired into this in-memory demo.” |
| 2:40–3:00 | Limitations card and README | “B0 is bounded authority, not independent fair-price protection. B1 stays off. Live AI, lawful HSKSwap access, full integration, mainnet deployment and real browser acceptance remain open. We do not claim profitability or completed competition submission.” |

## Capture prerequisites and acceptance

Use an actually functioning browser at a legible viewport; check every action and downloaded file. If a step does not work, fix it or show the limitation—never splice a false success. Show terminal test command and environment, not unlabeled log counts. Storyboard text is not proof that actions were captured. No screenshots, audio or video file is delivered by this document.

If mainnet evidence becomes available later through owner-controlled execution, prepare a **new** version: label recorded mainnet segments with date, chain 177, exact transaction hash and build SHA; preserve live-vs-recorded distinction and verify receipts/balances. Never relabel local Anvil/mock transactions as HSK mainnet. Update submission claims and manifest only after verifying that evidence.
