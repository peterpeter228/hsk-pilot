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

## Follow-up: restarted build ccdbed53c4e57d8817e0d4e82fd22023c996b713
At09:13 old tab9 correctly reported “Synthetic session not found” after server restart lost in-memory session. Explicit Refresh retained that truthful error, no fabricated restoration (DOM14). Fresh-sandbox was clicked, but immediate AX unchanged and tester reloaded before establishing that request's completion; artifact15-recovered-dom.txt is intermediate and NOT proof of recovery. Reload displayed new-build judge view. Explicit Open synthetic sandbox plus visible-state wait then verified PRIVATE SANDBOX/v1/20USDT and editable controls at09:13:30 (15-recovered-after-reload-dom.txt). Thus fresh session recovery after reload passed; direct old-page recovery is not separately asserted.

### Ordinary iframe responsive acceptance (NOT mobile-device emulation)
Visited root-provided http://localhost:3100/assets/qa-viewports.html in own tab11. Fixture uses same-origin unchanged app in ordinary CSS-sized iframe. No DevTools, CDP emulation, zoom, policy settings or network emulation used. Visible width controls and Measure rendered frame showed:

| Actual iframe innerWidth | Client/scroll width | Height | Whole-app horizontal overflow |
|---:|---:|---:|---|
|375|360/360|900|false|
|768|753/753|900|false|
|1440|1425/1425|900|false|

At each actual width: fresh synthetic sandbox v1 → guided Preview → visible versioned diff → acknowledgment checkbox → Confirm → dialog closes and v2 displayed. Screenshots16/17/18 and DOM snapshots record evidence. 375 table wraps but remains readable and confirmation reachable. 1440 iframe is wider than physical browser viewport: screenshot18 is explicitly a PARTIAL view with ordinary outer horizontal scroll, not full1440 capture. One wide-frame locator click did not activate an off-screen fresh-sandbox button; inspected unchanged state, normally scrolled it visibly into view and then clicked successfully. Similarly offscreen Close in evidence modal did not close until documented keyboard Escape. These are recorded harness/CUA visibility constraints, not app success claims for no-op clicks.

New inline SVG brand arrow visibly renders rather than missing glyph. At768 actual frame, Start→REBALANCE, Inspect decision modal, Escape focus return, real scheduled HOLD, and Pause were exercised again. Arrow decision icon visible behind evidence modal in19; HOLD two-stroke icon clearly visible in20, no missing-font square. Final session PAUSED and Start disabled; no simulation left running. Saved final DOM21 and new-build console21. No relevant app-origin error found in exercised new-build frame (extension metadata noise remains).

Scope: these follow-ups establish actual CSS iframe responsiveness/forms/dialog/confirm at three widths, NOT full39-case matrix, mobile hardware, top-level375/768/1440, real money, mainnet or AI acceptance. Server remained under root ownership throughout.

## Continuous recording interaction milestones (root owns recording validation)
Direct app tab12, buildccdb; prepared foreground judge view before GO. Root reported capture09:28:58–09:31:58. GO message received09:30:21, so actual action window was under97seconds, not the earlier estimated140seconds. The following observed server-event UTC times came from actual UI actions:
-09:30:31.811 sandbox created;09:30:32.091 versioned draft.
-09:30:43.038 explicit acknowledgment/confirm appliedv2.
-09:30:43.317 Start produced synthetic buy REBALANCE (1WHSK/19USDT).
-09:30:45.310 and09:30:55.310 scheduled HOLD.
-09:30:55.819 reduce-only persisted.
-09:31:05.311 scheduled sell, balances0WHSK/20USDT.
-09:31:11.981 PAUSED, Start disabled.
-Final combined withdrawal/export/limitations tool call timed out and CUA kernel reset around09:32:01. No blind action retry was made. Reacquired existing tab12 and inspected state at09:32:25: CLOSED with withdrawal event09:31:27.378 and zero balances. Thus withdrawal acceptance did occur; whether it is visibly framed in recording requires root's decoded-frame review. Cancellation was deliberately not repeated in this short recording.
-Export/limitations completion was not established. Do not claim those actions appear in video. DOM22 preserves recovered closed state. Prior desktop evidence-download integrity acceptance remains valid, but is separate from this recording attempt.

No generated frames, fake UI mutations, backend requests or terminal interaction by this browser agent. Root handles actual recording duration/decode/content validation and any truthful trimming, retaining original.
