# HSK Pilot WP6 mainnet execution: stopped on anomaly, trade not executed

**Result: `STOPPED_ON_ANOMALY`.** The anomaly turned out to be a false positive caused by a stale RPC read. The executor followed the STOP rule and returned the funds with `withdrawAll`. **The SELL trade (`execute`) was never sent.**
All times are 2026-11-01, Asia/Shanghai (UTC+8). Chain is HashKey Chain mainnet 177. Every tx was sent by TEST `0x04b0A7AF…F36E`. PAYOUT was not used anywhere.

## What happened
Preflight on both RPCs matched the PLAN: chainId 177, TEST nonce 1, 7.0427 HSK, Guard PAUSED, owner TEST, Guard empty, gas 500.001 gwei, quote 87,149. A local anvil-fork rehearsal of the same executor, using impersonation and no signed txs, completed all steps.

| # | Step | Tx | Block | gasUsed | Fee HSK | Status |
|---|---|---|---|---|---|---|
| 1 | WHSK.deposit 1 HSK | `0x0d5453e8717c17b08c662f177569bd51df4b27582b6db8e663b5d79cbb328759` | 29584245 | 51,856 | 0.025930 | success |
| 2 | WHSK.transfer(Guard, 1e18) | `0xeeb30123d3b67b80122460b1a12c6f1d6561086f3239eada73d3f20ccc0b459e` | 29584246 | 46,626 | 0.023315 | success |
| 3 | Guard.startSession (S/R, 1 WHSK) | `0x37fc6e0ef21b62cd627e71f3ad87352aed6c066a2d93a77527262665d0136e5b` | 29584248 | 370,255 | 0.185132 | success |
| — | post-startSession check | read returned status 0 / sessionId 0 / zero signers, so **ANOMALY** | — | — | — | — |
| 6 | Guard.withdrawAll (recovery) | `0xab6c4ccb0eded1992c6c8119d20ca843cc38783b83029a1e0530e86e6d1ed51f` | 29584249 | 74,168 | 0.037086 | success |

All four txs used an effective gas price of 500.001 gwei. Fees include the L1 data fee.
**Total gas fee: 0.271463942412427928 HSK** (cap 0.8). TEST outlay was 0.2715 HSK in gas. The 1 HSK of principal came back to TEST as 1 WHSK and was not unwrapped, because unwrapping is not part of the sequence.

## Root cause (diagnosis)
- The executor read Guard state immediately after the tx3 receipt with unpinned `eth_call` at `latest`. The load-balanced `mainnet.hsk.xyz` answered from a node that had not yet imported block 29584248, so the read showed the old state.
- Block-pinned reads at 29584248 on **both** RPCs show the intended state: `status=1 ACTIVE`, `sessionId=1`, `policyVersion=1`, signers = S/R. The `SessionStarted` event is present too. See `anomaly-diagnosis-reads.json`.
- The contract behaved correctly. The fault was in the executor's read path, and the fork rehearsal could not reproduce it because anvil is a single node.
- `secondaryRpcReceipt.match=false` on steps 2 and 6 was also transient. A later re-read shows identical canonical block hashes on both RPCs for all four txs (`receipts-dual-rpc.json`). There was no reorg.

## Final state (both RPCs agree, block ~29584273)
- TEST: 5.771237850809556056 HSK, **1 WHSK**, 0 USDT. Nonce 5.
- Guard: 0 HSK / 0 WHSK / 0 USDT. **PAUSED** (status 0), sessionId 1, policyVersion 2, allocations 0. Owner is TEST and pendingOwner is 0.
- Allowances (WHSK and USDT; Guard→router, TEST→router, TEST→Guard) are **all 0**.
- S `0x96c06E98CE98F342aF2E2c7a030cFf15cBC8eC69` and R `0x92501bA2F20422184b22D176F78f40B1AbB32FED` each hold 0 HSK with nonce 0. The signers did not produce any signature on mainnet.

## Notes
- Rio counted 6 txs. The PLAN has 5 required sends plus an optional pause, and verify is read-only. Only 4 were sent. `pause()` was not needed because `withdrawAll` closes the session (PAUSED, policyVersion++).
- minOut rule: the owner specified floor(quote×0.99), and the contract's check `mulDiv` floors as well. The PLAN text said ceil. The executor used floor, but it was never reached on mainnet.
- **Fix before any retry:** pin post-tx reads to `blockNumber = receipt.blockNumber`, or poll until `latest ≥ receipt block`. A retry needs a fresh owner decision, because the STOP rule was triggered. TEST already holds 1 WHSK, so a retry would not need step 1. Remaining gas headroom under the 0.8 cap is 0.5285 HSK, against about 0.25 HSK estimated for steps 2–4 and 6.
- No private keys appear in any file here. S/R keys are only on the operator box (chmod 600).
