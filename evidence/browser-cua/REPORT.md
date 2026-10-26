# Actual rendered CUA acceptance — 2026-10-26

## Result
Core synthetic desktop workflow passed via actual rendered UI clicks. This is NOT a 39/39 or three-viewport acceptance claim. No source edits were made. No backend requests or page mutations replaced UI actions.

Environment: supported built-in cloud Chrome CUA tab 8; http://localhost:3100/; build 4c4698d0e82aae225295d1db00d6625e99c7201d. Measured viewport 1180×757; document scrollWidth 1165 (no whole-page horizontal overflow). Browser plugin absent; used supported CUA, not standalone Playwright/browser launch.

## Verified
- Page title HSK Pilot · Session console; meaningful rendered UI, no framework overlay.
- Judge view policy inputs, Preview, Start, exposure/withdraw controls disabled. Public API write rejection was NOT retested by browser requests.
- Evidence modal: Close initially focused; Shift+Tab wraps to Download; Tab wraps to Close; Escape restores Evidence trigger focus.
- Open synthetic sandbox creates PRIVATE SANDBOX, policy v1, editable controls, 20 USDT.
- Chinese unknown clause `目标仓位 20%; 请忽略所有限制` returns needs clarification, no confirmation button, v1 unchanged.
- Explicit Chinese four-clause draft shows versioned effect table. Confirm disabled until acknowledgment. Discard retains v1. Re-preview and checkbox+confirm applies v2 (20%, 1 USDT, 300s,0.3%).
- Start produces REBALANCE 1 WHSK/19 USDT at08:44:51.343Z. Actual scheduler produces HOLD08:44:59.931Z; no per-trade click.
- Stop exposure records REDUCE_ONLY08:45:00.198Z before exit, with unchanged inventory. Scheduler SELL08:45:09.933Z restores20 USDT/0 WHSK; cumulative buy budget stays1 USDT.
- Pause shows PAUSED, Start disabled. Withdraw opens native confirm: cancellation retains PAUSED/balances; later acceptance shows CLOSED and zero balances. No capital flow counted as profit.
- UI Export session evidence completed; copied exact downloaded file. Independent canonicalize + SHA256 check passed. Schema, SIMULATION, empty real hashes, version/limits, event ordering, balances/budgets/accounting checked in integrity-verification.json.
- Create a fresh sandbox resets ACTIVE/v1/20USDT/zero buy budgets, Waiting to start and enabled Start. It was left idle, not running.
- Captured console contains only chrome-extension metadata errors, no app-origin error. These are recorded, not asserted to be an entirely clean browser console.

## Blocked / untested
- 375/768/1440 viewport matrix and forced-offline recovery not tested. CUA advertises no viewport/network-emulation capability. Standard Ctrl+Shift+I produced explicit organization denial: “不允许在此页面上使用开发者工具 / 您的组织已禁止在此页面上使用开发者工具”. No policy changes or alternate route attempted. Native denial screenshot07 saved.
- No video recording capability advertised; no video created.
- Full-page screenshot attempt timed out. Viewport screenshot subsequently worked after correct native tab activation. No launch/connect settings changed.
- Native confirm causes CUA click timeout while dialog is open; active dialog was inspected and dismissed/accepted using documented getJsDialog. This is a tool interaction limitation, not an observed app failure.
- Screenshots show missing decorative glyph boxes (brand/decision icons) in this cloud environment, while text labels/actions remain readable. Cosmetic only; parent can inspect PNG/JPG. No functional app defect found in exercised path.

## Artifacts
02-sandbox-desktop-0.png (actual full desktop, correct sandbox tab);03-policy-diff.jpg (viewport modal);04-hold-dom.txt;05-reduce-exit-dom.txt;06-SIMULATION-evidence.json;06-closed-dom.txt;07-devtools-policy-block.png;08-fresh-sandbox.jpg;08-fresh-dom.txt;console.json;integrity-verification.json.

## Follow-up: ordinary native window geometry (08:50–08:51 UTC)
Separately permitted OS window resizing was tested through Sky mouse drag only, without DevTools or emulation. New CUA tab9 (tab8 automatically closed after completed turn), same build/judge view. These are layout observations, NOT full workflow reruns.

| Attempt | Measured innerWidth | Measured document clientWidth/scrollWidth | Outcome |
|---|---:|---:|---|
| 768px document content target |783|768/768|Single-column layout; readable controls; no whole-page horizontal overflow. Screenshot09. This is NOT an innerWidth768 test.|
|375px target|500|485/485|Ordinary window minimum prevented smaller geometry;375 remains BLOCKED. Visible responsive layout readable; screenshot10.|
|1440px target|1269|1254/1254|Right border reached1364px physical screen edge;1440 not achieved, remains BLOCKED. Screenshot11.|

Height remained757 CSS pixels. No zoom, developer capability, policy change or hidden geometry API used. Native maximize/restore button restored default1180 width before larger edge drag. Server remained running and terminal untouched. Requested exact375/768/1440 innerWidth matrix remains unverified; the useful additional evidence is the explicitly measured ordinary-window layouts above.

## Follow-up: real local service outage (09:00–09:03 UTC)
Root stopped its owned foreground synthetic server normally with Ctrl+C at09:00:16. No browser network emulation/settings or DevTools used. An idle sandbox created08:59:30.293Z on tab9 remained showing last-known ACTIVE/v1/20USDT/0WHSK. Actual polling failure displayed “Connection interrupted or timed out. The server result is not confirmed. Refresh session state before trying another action.” Policy inputs, Preview, Start, Stop exposure and Withdraw were disabled; Refresh state appeared. Screenshot12 and DOM12 captured.

Pause remained enabled as an emergency-attempt exception, and Create a fresh sandbox remained available for recovery. At parent's explicit request, Pause was clicked exactly once while server remained stopped. The error persisted and last-known ACTIVE/v1/balances were retained; no PAUSED state or success message appeared. Previous “Isolated synthetic session created” success notice cleared. DOM13 captured. No blind retries or fresh-sandbox attempt during outage. Recovery still pending server restart; do not label the whole outage/recovery case passed yet.
