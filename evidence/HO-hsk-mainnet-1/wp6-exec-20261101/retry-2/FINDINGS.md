# HSK WP6 retry-2: FINDINGS (mainnet, chainId 177)

**Outcome: the full WP6 sequence completed on chain.** The 1 WHSK → USDT SELL executed through the Guard. After that, withdrawAll returned everything to TEST. The end state is Guard PAUSED and empty, with all allowances 0, confirmed on both RPCs.

The executor recorded `STOPPED_ON_ANOMALY` immediately after execute, but that was a fault in the script, not on chain (see "Anomaly" below). The recovery withdrawAll is the same transaction as planned step 6, so there was no extra transaction.

Times are UTC+8. Run on 2026-11-01, 18:25.

## Script fix applied (exec-retry2.mjs)
- Removed the check that compared the receipt blockHash with the canonical block hash.
- Post-state is now read pinned by `receipt.blockNumber`, with up to 10 re-reads over 20 s on the same RPC, then cross-checked on the other RPC by block number.
- Added a read-only `eth_call` simulation at a pinned block before each send.
- Retry gas cap: 0.4671 HSK. Expected starting nonce: 7.

## Preflight on both RPCs (29590745 / 29590749)
- TEST: nonce 7, 5.709836255989926515 HSK, 1 WHSK.
- Guard: PAUSED, empty, owner TEST, sid 1, pv 3, code hash unchanged.
- All 6 allowances 0. Quote 87152.

## Fork rehearsal (local anvil fork, NOT mainnet)
SUCCESS end to end, including every pinned post-state check and the eth_call simulations. Out 87152 = quote; minOut 86280.

## Mainnet transactions
| # | Step | Tx | Block | gasUsed | Fee HSK |
|---|---|---|---|---|---|
| 1 | WHSK.transfer(Guard, 1e18) | 0xa1eb1e04de5f6de5c499790d9a8fbdcf33359b8d742ff91f4f8b9e8f64aa9d70 | 29590784 | 46626 | 0.023315350701951177 |
| 2 | Guard.startSession (sid 2, pv 4) | 0x66cb96b60500ae3f0562de566cd81f651b94ad2425e71cbdb3b4e7b6058fed49 | 29590791 | 119955 | 0.059982365172357753 |
| 3 | Guard.execute SELL 1 WHSK | 0xf2b703477d4bdfa543156246176f2cf0bd0a6e99858d57f719cefe83741fd1b1 | 29590799 | 253105 | 0.126561044098794935 |
| 4 | Guard.withdrawAll | 0x66068151d1df06a3f96243c024a01fb1fcb14bba9f6ed2caf9cb75e50bc0935a | 29590801 | 74250 | 0.037127462048113530 |

- Retry gas: **0.246986222021217395 HSK**, against a cap of 0.4671.
- Cumulative WP6 gas: 0.332865537232057469 + 0.246986222021217395 = **0.579851759253274864 HSK**, against a cap of 0.8.

## Trade
- Quote: 87152 raw USDT (0.087152), at block 29590796. The secondary RPC returned the same quote at the same block.
- minOut = floor(87152 × 0.99) = 86280.
- **Received: 87152**, equal to the quote and above minOut. That is 0 slippage.
- The quote was 6 s old at inclusion, inside the 120 s window.
- TradeExecuted shows the strategy and risk signers as 0x96c0…eC69 and 0x9250…2FED.

## Anomaly (executor-side, not on chain)
- After the execute receipt, an unretried `getBlock(29590799)` (used only to read the timestamp) failed with "block could not be found" on the load-balanced primary.
- The catch-all handler treated this as the stop rule and sent withdrawAll, which is the planned step 6.
- The step-5 read-only verify therefore ran after the fact, pinned by block number on both RPCs (pinned-verify-reads.json). At block 29590799, both RPCs show:
  - Guard ACTIVE, sid 2, pv 4, intentNonce 1.
  - Guard holds 0 WHSK and 87152 USDT; allocQ 87152, allocR 0.
  - All allowances 0.
- No self-retry.

## Final state (both RPCs: pinned at 29590801, and at 29590826 / 29590830)
- TEST: 5.462850033968709120 HSK, 0 WHSK, 87152 raw USDT (0.087152), nonce 11.
- Guard: PAUSED, sid 2, pv 5, balances 0/0/0, allocations 0/0, owner TEST, no pendingOwner.
- All 6 allowances 0. S and R have 0 HSK and nonce 0. PAYOUT was not used.

Secrets were not printed, logged or committed.
