# Post-run fix: block-timestamp read

`exec-retry2.mjs` is the exact script that ran on mainnet on 2026-11-01. It is kept unchanged as evidence.

That run stopped after `execute` succeeded. The cause was a single, unretried `getBlock(29590799)` call on the load-balanced primary RPC, which returned "block could not be found".

`exec-retry2-blockread-fix.mjs` is the same script with that read made bounded:
- up to 10 attempts over 20 s on the primary RPC,
- then on the secondary RPC,
- and an anomaly only if neither RPC serves the block.

The fixed script passes a syntax check. It was not re-run on mainnet.
