#!/usr/bin/env bash
# Requires an explicit isolated test PostgreSQL URL; never falls back to a fake DB.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${HSK_TEST_DATABASE_URL:?Set a dedicated local PostgreSQL test database URL}"
export TZ=UTC
mkdir -p evidence/final
pnpm typecheck 2>&1 | tee evidence/final/typecheck.log
pnpm exec vitest run 2>&1 | tee evidence/final/tests.log
pnpm run build 2>&1 | tee evidence/final/build.log
pnpm run doctor 2>&1 | tee evidence/final/doctor.log
node scripts/http-smoke.mjs
bash contracts/script/forge-local.sh test 2>&1 | tee evidence/final/contracts.log
# Browser and fork require separate, explicit tooling and evidence; not inferred here.
