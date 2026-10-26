#!/usr/bin/env bash
# Local-only test/build helper. Never loads secrets, RPC URLs or broadcast options.
set -euo pipefail
cd "$(dirname "$0")/.."
export HOME="${TMPDIR:-/tmp}/hsk-forge-home"
export XDG_CACHE_HOME="$HOME/cache" XDG_CONFIG_HOME="$HOME/config" XDG_DATA_HOME="$HOME/data"
export XDG_STATE_HOME="$HOME/state" XDG_RUNTIME_DIR="$HOME/run" SVM_HOME="$HOME/svm"
mkdir -p "$HOME" "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$XDG_STATE_HOME" "$XDG_RUNTIME_DIR" "$SVM_HOME"
case "${1:-test}" in test|build|fmt|inspect|coverage) ;; *) echo 'Only local build/test/inspection commands permitted' >&2; exit 2;; esac
native="$(node script/native-tool.mjs forge)"
# Solar 1.4.4 cannot resolve ../node_modules relative imports outside root;
# absolute canonical remapping fixes resolution without skipping any lints.
if [[ "${1:-test}" == fmt ]]; then exec "$native" "${@:-test}"; fi
openzeppelin="$(realpath ../node_modules/@openzeppelin/contracts)"
exec "$native" "${@:-test}" --remappings "@openzeppelin/contracts/=$openzeppelin/"
