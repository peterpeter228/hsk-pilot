# HSK WP6 retry-1: FINDINGS (mainnet, chainId 177)

**Result: STOPPED_ON_ANOMALY. This is a false positive caused by the executor. The trade was NOT executed, and all funds are back with TEST.**

Times are UTC+8. Run on 2026-11-01, 15:10–15:12.

## Preflight on both RPCs (block 29584913/29584917, before any broadcast)
- TEST: nonce 5, 5.771237850809556056 HSK, 1 WHSK, 0 USDT.
- Guard: PAUSED, empty, owner TEST, sid 1, pv 2, code hash unchanged.
- All 6 allowances were 0. Quote was 87149.
- The executor's own pinned preStart check passed on both RPCs at block 29584936.

The fork rehearsal of the new script on a local anvil fork (not mainnet) succeeded: out 87149 = quote, minOut 86277.

## Transactions
| # | Step | Tx | Block | gasUsed | Fee HSK |
|---|---|---|---|---|---|
| 1 | WHSK.transfer(Guard, 1e18) | 0x9137e48068f4733776f2c6642c600b50dbeb7dec4673972b87776d3bbd62992f | 29584942 | 46626 | 0.023315353538993790 |
| 2 | Guard.withdrawAll() (stop-rule recovery) | 0xcc869f0bfa13b1294c4f47e835577fa0215e99ac1e4a70a638cc8b989598ef8d | 29584966 | 76168 | 0.038086241280635751 |

- Retry gas: 0.061401594819629541 HSK, against a cap of 0.5285.
- Cumulative WP6 gas: 0.271463942412427928 + 0.061401594819629541 = **0.332865537232057469 HSK**, against a cap of 0.8.
- startSession and execute were NOT sent. No USDT was received.

## Anomaly and root cause
The new post-tx check verified that the canonical block hash at the receipt height equals `receipt.blockHash` before it read state.
- mainnet.hsk.xyz returned the step-2 receipt with blockHash 0x4b338c3a…6b08.
- Both RPCs report canonical block 29584942 as 0xb2cee0ec…ce43. That block contains the tx, and the receipt re-read later shows the canonical hash.
- The same thing happened on the withdrawAll receipt (0x79871561… vs canonical 0x6072de16…).
- Conclusion: the primary RPC serves a provisional (pre-seal) block hash in fresh receipts. This also explains the transient `match:false` in the first run.
- Because the hash gate failed 10/10 on both RPCs, the "wrong on both RPCs" rule fired without any state being read. Per the owner's rule, withdrawAll was sent immediately, and execution stopped with no further self-retry.

Pinned reads (pinned-state-reads.json) show the chain did what was intended:
- At block 29584942, both RPCs show Guard WHSK 1e18 and TEST WHSK 0. The transfer was correct.
- At block 29584966, both RPCs show Guard 0/0, status PAUSED, pv 3, and TEST WHSK 1e18.

## Final state (post-state.json; both RPCs pinned at 29585002 / 29585006)
- TEST: 5.709836255989926515 HSK, 1 WHSK, 0 USDT, nonce 7.
- Guard: PAUSED, sid 1, pv 3, balances 0/0/0, allocations 0/0, owner TEST, no pendingOwner.
- All 6 allowances are 0 on both RPCs. S and R have 0 HSK and nonce 0. PAYOUT was not used.

## Fix for any future attempt (not applied; no self-retry)
- Do not gate on `receipt.blockHash`. Instead, pin by `receipt.blockNumber`.
- Alternatively, re-fetch the receipt until its blockHash equals the canonical `getBlock(number).hash`, then read state.

Secrets were not printed, logged or committed.
