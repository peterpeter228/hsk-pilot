#!/usr/bin/env bash
# Explicit read-only public RPC -> local EVM fork only. No live RPC writer exists here.
# This fixed block is crosschecked by evidence/preflight/2026-10-26T07-33-14-667Z.json.
set -euo pipefail
cd "$(dirname "$0")/.."
export FOUNDRY_PROFILE=fork
exec ./script/forge-local.sh test --match-contract HSKFixedBlockTest \
  --fork-url https://mainnet.hsk.xyz --fork-block-number 29326419 --chain-id 31337 -vv
