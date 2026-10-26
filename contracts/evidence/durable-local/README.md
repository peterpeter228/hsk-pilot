# Durable local coordinator composition — SIMULATION only

`contracts/script/durable-local-integration.mjs` composes the actual strategy/risk code, `LocalCoordinator`, `PgLocalCoordinatorStore`, `PgJobStore`, a real isolated PostgreSQL schema, and an ephemeral local Anvil chain **31337** with the compiled Guard.

Prerequisite: an explicitly isolated local PostgreSQL database supplied through required `HSK_TEST_DATABASE_URL`. Only loopback hosts are accepted; URL query/fragment overrides are rejected before any child process or socket is opened. There is no default database username, password, or database name. No wallet/private-key or RPC environment inputs are accepted. The script creates and drops its own UUID schema, migrates it transactionally, starts/stops its own loopback Anvil, and never connects to a remote writer.

```sh
HSK_TEST_DATABASE_URL='postgresql://YOUR_TEST_ROLE@127.0.0.1:5432/YOUR_ISOLATED_TEST_DB' \
  node contracts/script/durable-local-integration.mjs
```

The run asserts durable `SIGNING` before either actual role key is used, cryptographic typed-data recovery against distinct expected signers, full signed `eth_call`, durable pre-send `UNKNOWN`, exactly one local buy and `SUBMITTED` with real EOA sender/transaction nonce. After constructing a new coordinator and PG connection pool, a duplicate attempt is blocked without more signatures or sends. Following real lease expiry, a new fence reconciles the actual canonical local RPC receipt to `CONFIRMED`. The database has one canonical transaction and Guard intent nonce is one.

`integration.json` contains actual local transaction hashes, receipt observation, consumed-intent signatures, audit transitions and actual local gas fee. These are not mainnet receipts. The model selection and quote/cost estimate are explicitly synthetic; the configured `sourceChainId:177` is project metadata, not a claim this fixture read mainnet market data. A synthetic zero cost estimate is **not** zero observed cost; raw local gas cost is retained and USDT conversion remains null. Local one-confirmation reconciliation is a test setting, not a production finality policy.

`harness-import-identity-failure.log` and `integration-failure.json` preserve the earlier harness failure: separate `tsx.tsImport` graphs duplicated the runtime `JobStoreError` class, so a correctly rejected pending account surfaced as `REJECTED/ACCOUNT_PENDING` rather than `BLOCKED`. A single `durable-local-modules.ts` import graph corrected identity; no production coordinator/store workaround was made.

This test does not establish hosted durability, real AI integration, independently operated signer trust domains, jurisdiction eligibility, or authority for real trading.
