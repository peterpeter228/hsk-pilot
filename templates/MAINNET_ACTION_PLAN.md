# Mainnet action plan — UNSIGNED / paused deployment only

**HO-hsk-mainnet-1 · WP4 WAITING_GAS / NOT_BROADCAST.** Preparation only. No private key is read; no transaction is signed or broadcast. Repository is already PUBLIC under consumed `AUTH-20261027-HSK-PUBLIC`; no visibility change. Current steering authorizes TEST as deployer under `AUTH-20261027-HSK-DEPLOYER-TEST`, superseding the older TEST ban. PAYOUT `0x54145b97d5CeCf72b9900C702a02774171574171` remains banned as deployer.

This unsigned document is not a signing approval. The reviewed implementation explicitly forbids broadcast now, gas sourcing/top-up, Guard/session funding, allowances, `startSession`, live trades, worker activation, ownership transfer, recovery transfers, Submit Build, remote draft save, X, organizer contact and new paid resources. No automatic deployment when balance changes.

## Proposed packet — null approvals mean NOT READY

```json
{
  "status": "UNSIGNED_OWNER_HANDOFF_ONLY",
  "handoffId": "HO-hsk-mainnet-1",
  "wp4Status": "WAITING_GAS",
  "broadcastStatus": "NOT_BROADCAST",
  "chainId": 177,
  "mode": "BOUNDED_EXECUTION",
  "liveFundsEnabled": false,
  "oracleGuardedStatus": "BLOCKED_INDEPENDENT_FRESH_FEEDS_NOT_VALIDATED",
  "repository": "https://github.com/peterpeter228/hsk-pilot",
  "repoVisibilityObserved": "PUBLIC",
  "sourceSha": "1f1a48d56df96fc6f838d0696f1b5e3500bcf004",
  "artifactPath": "contracts/out/TradingSessionGuard.sol/TradingSessionGuard.json",
  "artifactSha256": "cd9590bebecf062fab977d17eb8ffd83112638a8208c122d2a0bf68f182733d2",
  "creationBytecodeKeccak256": "0x7a404100df84af7b350b2e44f0f8e9fa68ca59cfb28387b2842e0fb714b48f8d",
  "runtimeTemplateKeccak256": "0x167d10fef56d015de524cabf06ced001d6458fdc42c6904c6ff4ed8e58136622",
  "compiler": "0.8.30+commit.73712a01",
  "evmVersion": "cancun",
  "optimizerRuns": 200,
  "viaIR": true,
  "metadataBytecodeHash": "none",
  "constructorArguments": {
    "initialOwner": "0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E",
    "risk": "0xB210D2120d57b758EE163cFfb43e73728c471Cf1",
    "quote": "0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029",
    "fixedRouter": "0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3",
    "fixedFactory": "0x972cA9D1662F5e029cD18327D29026532E84c742",
    "fixedPool": "0x4ff515761864e7838b0adb8b5b2b8b7a068905dc",
    "fee_": 3000
  },
  "constructorOwnerStatus": "PROPOSED_TEST_OWNER_AUTHORIZATION_NOT_ESTABLISHED",
  "ownerAddress": null,
  "proposedOwnerAddress": "0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E",
  "deployerAddress": "0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E",
  "deployerKeyEnv": "DREAMSHIELD_G1_PRIVATE_KEY",
  "deployerAuth": "AUTH-20261027-HSK-DEPLOYER-TEST",
  "deploymentAuth": "AUTH-20261027-HSK-MAINNET",
  "deployerBalanceWeiObserved": "0",
  "balanceObservation": "REUSED_USER_AND_HISTORICAL_DUAL_RPC_ZERO_BALANCE; exact historical sample timestamp unknown",
  "balanceObservationBlock": "29372060",
  "balanceObservationSource": "evidence/HO-hsk-mainnet-1/preflight-177-20261027.md; distinct from preflight block 29372120",
  "dependencyObservationBlock": "29372120",
  "dependencyObservationBlockHash": "0x6a111c40dbe323e24bd193cf32411f6ea648e0356d6cffca0b7dad56295c3e73",
  "dependencyObservationAt": "2026-10-27T08:56:22.032Z",
  "verifiedRouterAddress": "0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3",
  "verifiedFactoryAddress": "0x972cA9D1662F5e029cD18327D29026532E84c742",
  "verifiedPoolAddress": "0x4ff515761864e7838b0adb8b5b2b8b7a068905dc",
  "verifiedWhskAddress": "0xB210D2120d57b758EE163cFfb43e73728c471Cf1",
  "verifiedUsdtAddress": "0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029",
  "whskDecimals": 18,
  "usdtDecimals": 6,
  "proxyImplementationAdminStatus": "UNKNOWN_NOT_VERIFIED",
  "strategySignerAddress": null,
  "riskSignerAddress": null,
  "relayerAddress": null,
  "recoveryRecipientAddress": null,
  "sessionPolicy": null,
  "exitPolicy": null,
  "nonDeploymentFieldsReason": "NOT_APPLICABLE_TO_PAUSED_DEPLOYMENT",
  "maxFundedUsdtRaw": "0",
  "maxFundedWhskRaw": "0",
  "maxTradeCount": 0,
  "maxGasHskRaw": null,
  "authorizationExpiresAt": null,
  "hostingMaximumCost": null,
  "modelMaximumCost": null,
  "resourceCostsReason": "NOT_INCURRED_OR_AUTHORIZED_BY_THIS_TASK",
  "guardAddress": null,
  "deploymentTransactionHash": null,
  "deploymentReceipt": null,
  "sourceVerificationStatus": "NOT_RUN_NO_DEPLOYMENT",
  "transactionPreview": {
    "chainId": 177,
    "from": "0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E",
    "to": null,
    "value": "0",
    "initcodePath": "evidence/HO-hsk-mainnet-1/initcode.hex",
    "initcodeBytes": 15238,
    "initcodeKeccak256": "0x11604e40d163c47036755dc1c96ed54b456808698072555981e17b4f4f21bd3d",
    "constructorEncodingPath": "evidence/HO-hsk-mainnet-1/deploy-preview-unsigned-20261027.json",
    "nonceObservedLatest": "0",
    "nonceObservedPending": "0",
    "nonceObservationStartedAt": "2026-10-27T09:21:05.526Z",
    "nonceObservationFinishedAt": "2026-10-27T09:21:10.449Z",
    "nonceObservationScope": "LATEST_AND_PENDING_NOT_FIXED_BLOCK; see creation-readonly.json",
    "predictedCreateAddress": "0xe2172A17223BDa552e0CC101591C8893c4B65c81",
    "predictedAddressStatus": "PREDICTED_NOT_DEPLOYED; latest code 0x on both providers",
    "gasEstimateHistorical": "2836095",
    "gasPriceWeiHistorical": "500001000000",
    "gasOnlyCostWeiHistorical": "1418050336095000000",
    "gasEstimateObservationAt": null,
    "gasEstimateObservationReason": "REUSED_PREVIEW_WITHOUT_EXACT_SAMPLE_TIMESTAMP; not retimestamped",
    "gasPriceWeiSupplemental": "500001000000",
    "reviewedGasLimit": null,
    "reviewedFeeEnvelope": null,
    "totalMaximumCostHskRaw": null,
    "feeCompleteness": "UNKNOWN_CHAIN_SPECIFIC_EXTRA_COMPONENTS",
    "readyToSign": false
  },
  "ownerApprovalRecord": "AUTH-20261027-HSK-MAINNET + AUTH-20261027-HSK-DEPLOYER-TEST; conditional paused creation only, not final owner/spend/expiry approval"
}
```

`risk` in the constructor is the **WHSK token**, not the risk-signing EOA. Constructor order is `(initialOwner, risk, quote, fixedRouter, fixedFactory, fixedPool, uint24 fee_)`; creation is nonpayable. Constructor checks dependency code, router factory/WHSK, factory pool, pair/fee and decimals 18/6. Zero-initialized storage gives PAUSED (0), no active session, no allocations and unset signing roles. A paused constructor needs no strategy/risk signer or relayer.

`initialOwner=TEST` is retained only as the proposed preview mapping. Available deployer authorization does not independently establish the owner role. Changing owner changes constructor bytes/initcode hash and requires a new preview/review. `ownerAddress=null` deliberately means final mapping not approved. No later ownership transfer is implied.

## Evidence and version identity

Paths below are repository-relative; copies preserve historical content/timestamps, not new runs:

- [Historical preflight](../evidence/HO-hsk-mainnet-1/preflight-177-20261027.json): MAINNET_READONLY, `READS_VERIFIED_NOT_EXECUTION_APPROVAL`, errors empty at block 29372120. Four quote probes (BUY USDT raw `100000`/`1000000`; SELL WHSK raw `1000000000000000000`/`10000000000000000000`) are `eth_call`, not orders. B1 remains blocked; same-pool TWAP is not independent fair price.
- [Historical build manifest](../evidence/HO-hsk-mainnet-1/guard-artifact-hashes-20261027.json) and [unsigned preview](../evidence/HO-hsk-mainnet-1/deploy-preview-unsigned-20261027.json). Original preview's owner note, floating display approximation and `deployedBytecode` naming are historical, not approvals or final deployed-code identity.
- [Independent provenance reconstruction](../evidence/HO-hsk-mainnet-1/provenance.json): artifact SHA-256, all compiler-metadata source hashes, fixed tracked Guard/compiler/lock inputs, ABI decoding and full [initcode](../evidence/HO-hsk-mainnet-1/initcode.hex). Existing build reused; historical build exit log unknown. Runtime template has unpatched immutables; not final mainnet runtime.
- [Supplemental public creation reads](../evidence/HO-hsk-mainnet-1/creation-readonly.json): dual RPC chain 177, same fixed-block hash, EOA empty code, pool code fingerprint and successful actual-TEST constructor `eth_call`; separately latest/pending nonce 0/0 and fee sample. Returned runtime matches immutable-masked structure; this does not prove all immutable values or deployment readiness. No state override, signer or send method. Provider latest blocks may differ by elapsed time, not a claim of a shared latest snapshot.
- [Pristine paused fixed-block fork smoke](../evidence/HO-hsk-mainnet-1/paused-fork-smoke.json): exact initcode, proposed TEST owner, source block 29372120 on 177, ephemeral execution chain 31337. One local creation from a synthetic unlocked sender; PAUSED, empty policy/roles/session/accounting, zero Guard balances/allowances, dependency getters and local EIP-712 context checked; `execute` eth_call rejects with `InvalidState`. Not actual TEST account readiness, a mainnet receipt, funding or trading. Local node stopped after verification.
- [Verification](../evidence/HO-hsk-mainnet-1/verification.json) and [implementation receipt](../evidence/HO-hsk-mainnet-1/RECEIPT.json) record actual commands/checkpoint separately. Historical browser/video source remains `ccdbed53c4e57d8817e0d4e82fd22023c996b713` (SIMULATION), not this Guard build.

External canonical evidence directory: `/workspace/web3-bounty/v3-reconcile/evidence/hsk-mainnet-20261027/`. Reviewed plan copied as `omp-plan-merged-reviewed.md` (SHA-256 `994af0790f4b31950f530f4737f6264a89f7b7ad6afaf085263d82b8d1e91b88`); pre-existing different `omp-plan-merged.md` preserved. Local external paths are not judge-accessible public links.

## WP4 hold and later release gates

**WAITING_GAS**: reviewed/user and historical dual-RPC observations report TEST balance `0` HSK on chain 177. Exact original balance-sample timestamp is absent; no fresh timestamp is invented and zero balance was not re-read merely to confirm it. Receipt/hash/address remain null. This implementation does not broadcast even if gas subsequently arrives.

Reviewer prerequisite wording: **fund ≥~2.5 HSK to deployer on 177**. This is an external funding recommendation only, not an authorized transfer, approved spend ceiling, full fee bound or sufficient release condition. Historical gas-only multiplication is `1418050336095000000` wei HSK (display approximately 1.418050336095 HSK). No USDT/WHSK funding is permitted. Unknown chain-specific L1/operator/other material fees remain unknown; no assumed fee-oracle predeploy or multiplier establishes readiness.

Before any separate later release, all must pass:

1. Fresh official primary/dRPC chain177 balance is positive **and sufficient for a reviewed maximum complete cost**; reconcile disagreement. Ordinary EOA/current nonce and any prior transaction must be rechecked; no automatic balance watcher or retry.
2. Verify owner mapping, exact native-HSK maximum and authorization expiry from applicable records. Null ceiling/expiry are blockers, not defaults. Use only the approved signing boundary/key-env name; preparation never accesses that secret. No contradictory new keystore requirement.
3. Reuse unchanged fixed-source artifact, refresh current read-only preflight, establish lawful access/dependency risk as applicable, pristine local/fixed-block fork proof and independent exact-packet review. General code review is not packet approval or a professional audit.
4. Preserve BOUNDED_EXECUTION and B1 disabled. Product-model/hosted UI/live browser gaps are separate product gates, not claims this deployment preparation resolves.

## Conditional later sequence — not executed

**review → one conditional zero-value CREATE → receipt/code/paused-state reads → authorized Blockscout source verification → stop**.

Persist sender/nonce/hash immediately if a later authorized creation is sent. Unknown status means reconcile the same identity/address/receipt; never blind-redeploy, increment nonce or automatically replace. Verify canonical success on chain177, actual contract address, fees and confirmation limits. Read owner/pendingOwner, PAUSED, fresh session/version/nonce/counters, unset signers, dependencies/decimals, allowances and actual balances. Compare patched runtime with immutable structure **and separately verify immutable values**, including chain/address-bound EIP-712 domain. Source verification targets `https://hashkey.blockscout.com`; report full/partial/failure truthfully and never redeploy because its service fails. New credentials, payment or unapproved disclosure remain blockers.

Stop paused with `liveFundsEnabled=false`. No funding, allowance, session, trade or withdrawal sequence exists in this HO. An unsigned packet or paused creation does not complete G3/G4/G5/G6, autonomous AI trading or Track 1 acceptance.
