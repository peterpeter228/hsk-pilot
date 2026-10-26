## Current browser status — 2026-10-26 09:05 UTC
Actual core desktop UI now passes through the built-in cloud desktop runtime; see ../../evidence/browser-cua/REPORT.md and ../../docs/BROWSER_RUNTIME.md. Earlier environment-blocked descriptions below are historical build-stage notes, not current absence of browser capability. Glyph fix is built and regression-tested; post-fix visual check, frame-width/restart checks and video remain in progress.

# Web implementation and acceptance boundary

React + Vite, primary language English, narrow deterministic English/Chinese policy commands. No image-generated concept or browser visual-fidelity claim. Core delivery was not blocked on concept art. Design is code-native neutral surfaces, navy text, one lime accent, legible table-oriented facts, semantic headings and dialog focus trap. Fonts are system-local; no asset or font network calls.

## API contract

- GET `/api/demo`: immutable read-only synthetic State.
- POST `/api/simulations`: `{id,token,state}`; scoped token stays in component memory (no localStorage).
- GET `/api/simulations/:id`: State. Polling only reads server state and stops applying stale in-flight results during mutations.
- POST `.../proposals`: `{message,expectedVersion}` → `{id,...PolicyProposal}`.
- POST `.../proposals/:id/confirm`: `{expectedVersion}` → State.
- POST `.../control`: `{action: RUN|PAUSE|REDUCE_ONLY|WITHDRAW}` → State.
- GET `/api/demo/evidence` or `/api/simulations/:id/evidence`: download complete server envelope unchanged.
- Private routes use Bearer token. Mutation origin is enforced by server. Client never signs or broadcasts.

DTO imports are **type-only** from worker/shared. No worker logic or secrets are bundled. Values are authoritative server values; UI only computes the explicitly disclosed fixed synthetic valuation/weight. No real market estimate.

Vite dev proxy uses 127.0.0.1:3100. Set server APP_BASE_URL to the exact browser origin for Vite dev. Production build output is dist/web and is served by root server. This avoids separate-port origin configuration in production.

## Executed checks

`npx tsc --noEmit`: PASS.
`npx vitest run tests/web/client.test.ts`: 7 PASS.
`npx vite build`: PASS.

Tests cover exact large raw amounts, null vs zero, negative P&L, invalid decimal inputs; read-only SSR rendering; server synthetic decision rendering; scoped request + policy version; network interruption has no automatic retry/local success; stale version remains rejected.

## Browser acceptance: BLOCKED, not PASS

Inherited environment blockers: CUA cannot access localhost, Chromium startup socket EPERM, escalation wrapper error. No denied launch was retried and no bypass or new environment modification was attempted. No screenshots were fabricated. Browser identity, blank-page/overlay, console health, actual click proof, download interaction and native 375/768/1440 screenshots remain unverified.

CSS defines 520/800/1050px breakpoints, wrapped control rows, locally scrollable tables, fluid drawer and reduced motion. These are implementation facts, not observed responsive acceptance. User-wallet, rejected signatures, pending receipts and reorg flows are not implemented and are explicitly outside the synthetic build; no fake wallet state is offered.

Required real-browser flow when available: default read-only → open sandbox → draft target 20%, buy limit 1 USDT, cooldown 300 seconds → inspect current/proposed units → decline then regenerate/explicitly confirm B0 → start server scheduler → inspect REBALANCE and subsequent HOLD → stop new exposure → inspect state before exit → pause → export envelope. Also inspect unknown API result recovery and invalid/ambiguous Chinese command. Repeat at 375, 768, 1440 CSS px.

## Deferred real-browser acceptance runner

`tests/e2e/browser-acceptance.mjs` is prepared; **not executed here**. The only local validation of this file was `node --check tests/e2e/browser-acceptance.mjs` (PASS, syntax only).

In an authorized environment with a usable Chromium installation:

```sh
pnpm build
node tests/e2e/browser-acceptance.mjs
# Optional: E2E_OUTPUT_DIR=/chosen/qa/path node tests/e2e/browser-acceptance.mjs
```

Root installs `@playwright/test` and may expose the second command as `pnpm test:e2e`. The runner starts the built server itself on exactly `http://localhost:3100`, refuses to attach to an already-running process, launches Chromium once with `chromiumSandbox: true`, and stops the server in `finally`. It never installs a browser, disables its sandbox, changes permissions, retries a failed browser launch, or substitutes fake API success. A missing build, occupied port, missing browser, or denied launch produces `BLOCKED`; all unexecuted cases remain `BLOCKED`.

Each fresh browser context runs at 375, 768 and 1440 CSS px: read-only judge and anonymous write denial; evidence dialog focus/Tab/Escape; sandbox creation; real network-offline error and refresh; unsupported Chinese clause rejection; valid Chinese diff discard then confirmation and actual version readback; start real server scheduler and await both rebalance and HOLD; persist reduce-only then observe an independently scheduled exit; pause; close/withdraw capital accounting; actual JSON download; horizontal-overflow, overlay and console checks. Network faults use the browser context's offline mode, not mocked successful responses. The scheduled-HOLD and exit checks wait for actual server events.

An acceptance manifest is initialized as BLOCKED in a unique `/tmp/hsk-browser-acceptance-*` directory (or the chosen output directory). Only genuinely completed assertions become PASS. Screenshots, logs and downloaded synthetic evidence are generated only after a real browser launch; no screenshots or logs are pre-created as acceptance evidence. Scoped session tokens remain memory-only and are not included in reports. A script being present and syntax-valid is **not** browser acceptance.
