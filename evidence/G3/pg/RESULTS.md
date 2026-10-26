# G3 durable PostgreSQL coordinator evidence

- UTC: 2026-10-26 07:31:05–07:31:08.
- Environment: actual local PostgreSQL 18.4, Node/TypeScript pg 8.23.1, Vitest 5.0.5. DataMode SIMULATION (synthetic job data, no chain transactions).
- Gate scope: storage/coordinator substrate only; full G3 NOT asserted.
- SHA: unavailable: project is not yet a Git repository. Source SHA256 below pins tested files.
- Command: `HSK_TEST_DATABASE_URL=postgresql://agent@127.0.0.1:55439/postgres TZ=UTC node_modules/.bin/vitest run tests/server/job-store.test.ts`.
- Result: exit 0, 7 tests passed against real DB. Random isolated schema created/dropped. PostgreSQL stopped afterward (`pg_ctl status`: no server running).
- Restart: `node --import tsx evidence/G3/pg/restart-probe.ts prepare`; actual `pg_ctl stop` / `pg_ctl start`; same script `verify`; PASS, exit 0. Test-only fixed schema dropped after verify.
- Full final run: `restart-and-integration.log` (includes process restart and test assertions).
- First failures retained: default Unix socket creation prohibited (`initial-unix-socket-startup-failure.log`); nonexistent default postgres role (`initial-role-failure.log`). Final run uses standard TCP-only configuration and existing local agent role; no OS permissions changed.
- SQL safety assertions: concurrent reserve (16 callers) yields one ID; second nonce remains blocked; immutable intent mismatch rejected; independent pool readback preserves >2^53 decimal; 12 concurrent lease claims yield one owner; expired token rejected after fence increment; hashless UNKNOWN blocks rebroadcast/new jobs; duplicate tx hash rejected across jobs; replacement same sender/EOA nonce; only one canonical receipt; reorg revokes canonical receipt and flags ledger reversal/quarantines account with append-only audit; failed receipt becomes FAILED, not a fill.
- `tsc --noEmit` also completed without diagnostics at 07:31:49 UTC.
- Limitations: no RPC receipt verification or financial broadcast; no hosted process; no actual P&L reversal; quarantine clear/recovery deliberately not implemented. Store accepts trusted service data, not unauthenticated public API input. Database storage passing is not evidence of production trading completion.

Source SHA256:
```
3089dc859759a8ddfc4c1287ae6ceca542db125fe4f03ab6a5d0338b56445796  apps/server/job-store.ts
b1f1f1e077853ec1dc6e0bd18847a37cdbbc58946fa85ec6189b83e1466abd9a  migrations/001_durable_jobs.sql
7b6fd8806db6c762e10a1f3f8d67ae45da98b245dad25c7885bfaa57290e9cdf  tests/server/job-store.test.ts
```
