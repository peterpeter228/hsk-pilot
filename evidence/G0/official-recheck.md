# Independent official-source recheck — HSK Pilot

Retrieved 2026-10-26 07:19–07:21 UTC. Read-only research; no login, registration, outreach, terms acceptance, wallet, deployment, trade or credential use. This report independently rechecks public sources, not the truth of future implementation claims.

## Event findings

Primary source: https://dorahacks.io/hackathon/hskchainindia/detail (Firecrawl HTTP 200; cache timestamp 2026-10-26T05:13:44.297Z).

- Body repeats registration/submission cutoff: **2026-11-01 21:30 IST = 2026-11-02 00:00 Beijing = 2026-11-01 16:00 UTC**. Linked organizer Luma confirms. No late submissions.
- Header widget instead shows **2026-11-01 23:00, UTC-4**, equivalent to **2026-11-02 03:00 UTC**, 11 hours later. Unresolved official-page conflict, not a harmless timezone conversion. Plan to meet the earlier body cutoff; this does not resolve actual server behavior.
- Worldwide individuals and teams eligible. Original work built or rebuilt during event required. Online demo participants explicitly contemplated; they must attend their assigned slot. Mumbai in-person teams get demo-selection priority, not exclusive eligibility.
- **HSK Chain mainnet smart-contract deployment is explicitly required for demo selection**; mainnet project deployment also required to claim prizes. Local/fork/testnet-only work cannot claim this gate complete.
- Track 1: 5,000 USDT pool, first/second/third 2,500/1,500/1,000 USDT. Prize distribution stated within 14 working days of winners. No success probability inferable.
- Track 2 requires HSP; not stated for Track 1. Officially recommended products/frameworks earn extra points, but no numeric rubric.
- Pitch selection announced Nov 3; demo Nov 4; winners Nov 5. Completeness, technical maturity and innovation emphasized.

Organizer source: https://luma.com/hashkey-demo-day-mumbai (web read 07:20 UTC). Confirms body cutoff, prizes and dates. Describes 20 finalists, ATLAS SkillTech venue pending final confirmation, judging criteria still to be confirmed. Event attendance registration approval is separate from hackathon submission. Do not infer final remote schedule or guaranteed remote selection from this page.

## Track fit and submission uncertainties

https://dorahacks.io/hackathon/hskchainindia/tracks (Firecrawl HTTP 200, cached 2026-10-26T05:13:18.979Z) expects AI-led market monitoring, on-chain analysis, signal choice and autonomous execution on HSKSwap, with risk/stop-loss controls and natural-language positions/P&L/strategy interaction. A guard alone or manual-per-trade button is incomplete. The page's aspiration of sustained profitability is not evidence that a submitted system earns money; do not promise profit or label short-run performance as proof.

**Actual event-specific submission form fields remain UNVERIFIED.** Public details/tracks expose Submit Build but not a field-by-field form. No account or form submission attempted. Public pages inspected do not establish required repo visibility/license, mandatory video format/duration, pitch length, team-size/age cap, or prize KYC/payout chain. Missing text is not a waiver.

https://dorahacks.io/hackathon/hskchainindia/qa (HTTP200, cached 2026-10-26T05:13:19.105Z) includes payout/KYC question at https://dorahacks.io/discussion/1562189. Reply labeled **Organizer Assistant AIGC** says those details are unspecified and advises official confirmation. This is NOT a human organizer's no-KYC ruling. Chain KYC integration documentation is unrelated to competition payout requirements.

A public Dora dashboard demo settings page https://dashboard.dorahacks.io/hackathon/%24demo/settings/general shows repository/video requirements are organizer-configurable. Its `$demo` defaults cannot be imported as India-event rules. Prepare clean source/README, working demo, evidence, short video and architecture notes as useful materials, but label this preparation—not verified mandatory form schema. Avoid importing rules from the older Taiyi/Korea or Hong Kong events.

## Official developer references

https://hashfans.io/dev-onepager (HTTP200, cached 2026-10-26T05:13:21.041Z) is linked directly by the event and links https://docs.hskchain.net/. Legacy https://docs.hsk.xyz/ redirects to this documentation.

- https://docs.hskchain.net/docs/Build-on-HashKey-Chain/network-info — mainnet chain ID **177**, RPC `https://mainnet.hsk.xyz`; testnet **133**, RPC `https://testnet.hsk.xyz`; gas HSK. Docs explorer `https://hashkey.blockscout.com`; onepager uses `https://hsk.blockscout.com` (alias equivalence not tested).
- https://docs.hskchain.net/docs/Developer-QuickStart — EVM compatible; native HSK required for network fees. Its testnet-first advice does not override event mainnet requirement.
- https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Token-Contracts — WHSK `0xB210D2120d57b758EE163cFfb43e73728c471Cf1`; USDT `0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029`. This read establishes published addresses, not decimals, balances, bytecode identity or trade safety.
- https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Tools/Oracle — publishes APRO mainnet HSK/USD `0x86CE42c1b714149Dc3A7b17169EF67b5F78A224b` (0.5%, 1h heartbeat), USDT/USD `0x823d7f90f7A3498DB6595886b6B5dC95E6B0B7f3` (0.1%, 24h). SUPRA pull/storage and Chainlink Streams verifier addresses also listed. These are directory claims, **not current feed freshness, interface correctness, pair availability, permission or economic reliability verification**. Chainlink Streams verifier example appears to assume AggregatorV3 calls; do not copy without provider ABI validation.
- https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Tools/KYC describes optional application integration with SBT identity levels/status, not event eligibility or payout policy.

## B0/B1 engineering implications (analysis, not organizer rules)

B0 BOUNDED_EXECUTION is a defensible implementation path if explicitly scoped: independent deterministic risk signer, per-trade/day/session USDT gross-buy limits, native WHSK inventory bound, minOut, short expiry, nonce, policyVersion, fixed assets/router/pool and two-role signatures. It does **not** confer independent fair-price protection: DEX quote manipulation, depeg, liquidity, slippage and keeper failures remain. A fresh DEX quote or minOut cannot be rebranded as an independent oracle or loss guarantee.

B1 ORACLE_GUARDED must remain blocked until actual supported pair/ABI, bytecode/address, freshness, decimals, permissions, deviation and failure behavior pass new read-only checks and tests. Published heartbeat is not observed freshness. The restored assessment's prior stale-feed/TWAP observations are historical evidence, not this worker's new live reads. No B1-to-B0 silent downgrade; owner must knowingly authorize a distinct mode/session. Emergency pause/withdrawal must not depend on valuation feed success.

P&L should distinguish realized/unrealized results, deposits/withdrawals, gas, model costs, reference pricing and simulated versus mined trades. Never equate evidence hashes with correctness or profitability. Do not expand mainnet authority because the competition requires it.

## Failed sources / exact blockers

1. web.open Dora detail: inaccessible/internal error; Firecrawl succeeded using timestamped cached content. Thus independent re-read is not a guaranteed origin-live response.
2. web.open HashFans onepager: inaccessible/internal error; Firecrawl succeeded from timestamped cache.
3. web.open HSKSwap failed; Firecrawl https://app.hskswap.com/?lng=en-US returned **HTTP403 Access Restricted**, explaining service unavailable in retrieval jurisdiction due to regulatory compliance (cache miss, America/New_York tool locale). **Do not bypass this restriction**. This does not establish the user's jurisdiction or entitlement, nor authorize trades through another route. Public docs remain readable; obtain lawful access clarification before product action against the restricted service.
4. Actual submission fields cannot be certified from anonymous public text. No account access/registration attempted within this task. Human organizer confirmation still needed for material KYC/payout and deadline discrepancies.
5. No new live RPC/contract validation done in this independent docs pass. Mainnet status and operational safety are not certified.

### Restriction scope follow-up (07:22 UTC)

Stopped HSKSwap interaction after the 403; no proxy/domain/endpoint workaround and no protocol action. Search-engine-only queries `site:hskswap.com terms jurisdiction restricted` and `site:hskswap.com privacy "service"` returned no results. Accordingly no official terms text was located to establish whether the restriction covers only UI access or wider services/protocol use. The narrow verified fact is the retrieval service's jurisdictional-access denial. Do not infer user nationality is prohibited or all protocol access is prohibited; equally do not assume a protocol route is an authorized substitute. This uncertainty is a separate authorization/access gate before HSKSwap-dependent external actions.
