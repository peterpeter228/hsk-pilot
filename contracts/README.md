# TradingSessionGuard — B0 implementation

**Not audited.** Single-owner, non-upgradeable WHSK(18)/USDT(6) bounded execution.
`ORACLE_GUARDED` is deliberately rejected with `UnsupportedOracleMode`, never downgraded.
A signed DEX quote is not an independent fair price, and exits are not guaranteed.

## Reproduce

From repository root after the pinned `pnpm install`:

```sh
contracts/script/forge-local.sh build
contracts/script/forge-local.sh test -vv
node contracts/script/typed-data-fixture.mjs --check
node contracts/script/local-integration.mjs
# Explicit network-read/local-fork test; no live chain writes:
contracts/script/fork-local.sh
```

Compiler: **Solidity 0.8.30**, EVM **Cancun**, optimizer **200**, **viaIR**, metadata bytecode hash **none**.
Cryptography, two-step ownership, reentrancy guard and token wrappers: official **OpenZeppelin Contracts 5.4.0** (MIT).
Foundry/Anvil: official npm **1.4.4** platform binaries (MIT/Apache-2.0).

The `forge-local.sh` helper resolves the native binary because the npm 1.4.4 JavaScript launcher does not propagate child exit codes/signals. It keeps writable tool caches under `/tmp`, and supplies an absolute canonical OpenZeppelin remapping because Solar's relative imports outside the project root fail. **No lints are disabled.** Source remains imported from the pinned package, not copied/vendored.

`local-integration.mjs` creates its own ephemeral Anvil on loopback/random port, verifies **31337**, uses local unlocked synthetic owner accounts and ephemeral distinct role keys, and stops its node. It never accepts RPC URLs/private keys from environment. It exercises the actual `buildCandidate` → synthetic validated selection → `assessRisk` → matching TS/Solidity typed digest → two signatures → `simulateContract` → local receipt/events/balance changes. This is **SIMULATION**, not real AI, market performance, production worker persistence, or independent signer trust domains.

`fork-local.sh` reads public HSK state at **29,326,419** and executes exclusively in a local EVM, with chain ID **31337**, injected synthetic native HSK and wrapped-token funding. It verifies the real fixed pool/router, sell/buy, actual balance deltas, zero allowances, old-policy rejection, persistent reduce-only after a reverted sell, legal exit and withdrawal. This is **FORK**, not a mainnet deployment, live transaction, trading permission or competition eligibility clearance. No owner wallet secret or real asset is used. If the public RPC refuses the fork, stop and report the refusal; do not switch to evasion/proxy routes.

## ABI and behavior

Public ABI: `abi/TradingSessionGuard.json`. Frozen typed-data order/domain: root `config/trade-intent-types.json`. Cross-language fixture: `test/fixtures/trade-intent-golden.json`.

- Direction: `0` buy WHSK with USDT; `1` sell WHSK for USDT.
- Status: `0 PAUSED`, `1 ACTIVE`, `2 REDUCE_ONLY`, `3 EXPIRED` (derived after normal deadline).
- Owner `startSession(policy, quoteAllocation, riskAllocation)` only while paused, no pending ownership transfer. Session ID and version increase.
- Owner `updatePolicy(policy)` preserves allocations, session/day gross spend, nonce and cooldowns; version increases and old signatures fail. Cannot change mode, reopen a paused/expired session or restore ACTIVE from REDUCE_ONLY. Tightening budgets below used spend blocks buys, not exits.
- `execute(intent,strategySig,riskSig)` requires both specific distinct roles, fixed asset direction, nonce/version/hash/domain/time constraints and signed reference quote slippage. Nonce/budgets change atomically only if the swap succeeds.
- Surplus donations are never added to allocated capital. Real token balances must cover allocation before and after trades.
- Router receives exact input allowance and no arbitrary calldata; output recipient is always Guard. Return values are ignored in favor of actual input/output deltas. Allowance must end at zero.
- Sell proceeds do not replenish gross-buy limits. UTC-day spend survives sessions/owner transfer. Normal and exit cooldowns/caps are separate.
- `enterReduceOnly` is an independent owner/risk operation with no swap. A later rejected sell cannot roll it back. Owner/risk cannot silently restore ACTIVE.
- `pause`, `withdrawAllocated`, `withdrawAll`, `recoverToken`, `withdrawNative` do not query Oracle/Quoter/EAS. Withdrawals go only to owner and close/invalidate the session first. Token recovery is per-token, so a broken unknown token cannot block recovery of others.
- Ownership transfer closes at initiation and acceptance; opening a session while pending and renouncing ownership are rejected.

Constructor identity checks are not a bytecode audit. The constructor verifies decimals, factory/pool membership, router factory/WHSK, fee and token pair, but cannot certify dependency upgrade safety or conventional ERC20 economics. Only the preflight-verified standard pair is supported. On-chain block-number checks do not themselves prove quote truth/canonicality; the off-chain risk process must verify the block hash and fresh state.

## Evidence and limits

- `evidence/forge-test.log`: unit, 256-run fuzz cases and 64×32-action stateful accounting invariant.
- `evidence/local-integration.json`: actual **LOCAL_TX** receipts, signatures of consumed intents, event hashes and real local balance deltas; loss in the synthetic round trip is retained.
- `evidence/fork-test.log`: real dependency path on local fixed-state fork.
- `evidence/invariant-harness-failure.log`: retained failed test-harness run. The ghost daily counter incorrectly counted sells; the production counter correctly remained zero. Fixed with an explicit buy-only block and a deterministic successful-sale regression. No unsupported attribution to formatter/compiler is made.

Passing these checks is not an audit, a live deployment, a functioning hosted worker/DB, a completed real-model flow, or permission to trade. No production deployment/broadcast script is provided.
