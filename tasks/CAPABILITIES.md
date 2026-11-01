# Actual capabilities — 2026-10-26

> **Status update 2026-11-01 (supersedes older status lines below):** the repository is **public** under the **MIT** license. `TradingSessionGuard` is **deployed on HashKey Chain mainnet (177)** at [`0xe2172A17223BDa552e0CC101591C8893c4B65c81`](https://hsk.blockscout.com/address/0xe2172A17223BDa552e0CC101591C8893c4B65c81) (Blockscout: verified, partial match), and a real 1 WHSK → USDT SELL executed through it on 2026-11-01 ([tx](https://hsk.blockscout.com/tx/0xf2b703477d4bdfa543156246176f2cf0bd0a6e99858d57f719cefe83741fd1b1)); funds were withdrawn and the Guard is paused. The public SIMULATION demo (http://43.172.183.51:3901/, liveFunds disabled) runs the live server-side Sub2API AI decision engine (advisory only). See the [README](../README.md) for the current state; the text below is kept as dated history.

- Workspace: dot cloud coding environment; no connected user computer or saved coding environment returned by discovery.
- Node24.22.1/pnpm11.25.0; locked TS/React/Vite/Fastify/Viem dependencies.
- Official npm Foundry1.4.4 native tools and Solidity0.8.30 used for actual tests. No wallet loaded for mainnet; local fixture keys only.
- Real local PostgreSQL18.4 available via dedicated temporary test runtime, TCP-only; startup/stop/restart tested. No shared project database accessed.
- GitHub repository (initially private, now public under MIT) created and read-verified: peterpeter228/hsk-pilot. Initial README commit43753387eb278e97943b5f40f9af694d0abf54d8. Final source persistence must be separately verified.
- Official/public read-only web and chain queries available. HSKSwap site403 restriction is retained, not bypassed.
- Existing cloud Chromium works when the owned localhost server is started in the built-in desktop terminal. Actual core clicks/screenshots verified. DevTools organization restriction is respected; standalone Playwright remains unrun. No new saved coding environment is required for this route.
- Product model credentials absent. One separately approved HSK Argon call completedHTTP200; alias gemini-4-argon-high, backend model identity unreported.
- No live transaction capability enabled in the local app/coordinator. Real financial actions are owner handoff; no private-key request.
- No public deployment, publication, registration, new paid service or submission performed.
