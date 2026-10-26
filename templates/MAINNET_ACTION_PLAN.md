# Mainnet action plan — UNSIGNED / OWNER HAND-OFF ONLY

Status: BLOCKED; no wallet action, transaction, funding, allowance or trade is authorized by this document. The assistant prepares and checks information; **the owner personally controls financial execution and wallet signing**. A future budget or broad session approval does not authorize the assistant to execute financial transactions. No private keys belong here.

## Release gates

- [ ] Lawful HSKSwap access clarified; research-service jurisdictional 403 not bypassed.
- [ ] Final build/source identity recorded and reviewed; real target-chain fixed-block fork path passes.
- [ ] Fresh read-only chain/pool/token/router/code/ABI/quote checks and dependency upgrade risks reviewed.
- [ ] Durable runner/signers/recovery/accounting integrated and tested; product-model schema/failure/cost tests pass.
- [ ] Real browser policy/permission/error flows accepted; no anonymous live controls.
- [ ] Independent review has no unresolved release-blocking findings; review is not an audit certificate.
- [ ] Owner acknowledges B0 has no independent fair-price guarantee, may lose funds, and cannot guarantee stop-loss fills; B1 stays disabled.

## Exact proposed inputs — null means NOT READY

```json
{
  "status": "UNSIGNED_OWNER_HANDOFF_ONLY",
  "chainId": 177,
  "mode": "BOUNDED_EXECUTION",
  "repository": "https://github.com/peterpeter228/hsk-pilot",
  "sourceSha": null,
  "artifactHash": null,
  "constructorArguments": null,
  "deployerAddress": null,
  "ownerAddress": null,
  "strategySignerAddress": null,
  "riskSignerAddress": null,
  "relayerAddress": null,
  "guardAddress": null,
  "verifiedRouterAddress": null,
  "verifiedFactoryAddress": null,
  "verifiedPoolAddress": null,
  "verifiedWhskAddress": null,
  "verifiedUsdtAddress": null,
  "recoveryRecipientAddress": null,
  "maxFundedUsdtRaw": null,
  "maxFundedWhskRaw": null,
  "maxGasHskRaw": null,
  "maxBuyPerTradeUsdtRaw": null,
  "maxBuyPerUtcDayUsdtRaw": null,
  "maxBuyPerSessionUsdtRaw": null,
  "maxInventoryWhskRaw": null,
  "maxExitWhskRaw": null,
  "minimumTradeQuoteRaw": null,
  "maxSlippageBps": null,
  "cooldownSeconds": null,
  "maxTradeCount": null,
  "sessionValidUntil": null,
  "exitValidUntil": null,
  "authorizationExpiresAt": null,
  "hostingMaximumCost": null,
  "modelMaximumCost": null,
  "ownerApprovalRecord": null
}
```

Record token decimals, raw and human-readable amounts together. Published candidate addresses in config are not approved action destinations. Solidity settings currently 0.8.30/Cancun/optimizer200/viaIR/no bytecode metadata hash; pin actual artifact and compatible fork evidence before filling identity fields. No auto-renewal, budget expansion, new asset/route or unrestricted approval.

## Owner-executed sequence (not executed)

1. Review unsigned deployment constructor/bytecode, initial paused state and full fee estimate. Owner signs/broadcasts deployment through their wallet only when ready.
2. Verify chain177 receipt/code and source matching. Do not fund an unverified address.
3. Review exact funding/allowance amounts and recipients. Owner performs finite funding and verifies actual versus allocated balances.
4. Review session policy and expiry, two signing roles, gas reserve and worst-case funded loss; owner decides/signs session activation. Do not hand an assistant a live financial execution mandate.
5. Only after all gates, owner controls any actual trading operation. Record signed intent binding, exact simulation, policy version, tx/nonce, receipt, amount deltas, cost and failures. This checklist does not assert a production autonomous loop exists.
6. Owner tightens policy/pauses/closes and recovers to verified destination as needed; confirm remaining balances and allowances. Negative tests default to local/fork/eth_call, not paid failure transactions.

For each step prepare unsigned calldata, from/to/value, chain, nonce estimate, gas/cost bound, exact worst-case exposure, expected event and stop condition. If status is uncertain, query existing transaction/nonce/receipt; do not blindly repeat or replace it. Fill receipts/hashes only from verified execution. No current transaction hashes or deployment addresses exist.
