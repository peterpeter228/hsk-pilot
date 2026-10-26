# Actual browser runtime and current verification

The built-in dot cloud computer is separate from saved coding-environment configurations. An empty environment catalog did not prove absence of the built-in computer/browser. The earlier recommendation to create a saved cloud environment to fix browser access was not justified and is withdrawn. Current official saved cloud-environment documentation lists computer/browser-use limitations; this does not prove all headless tests are impossible.

## Verified working route
The existing cloud desktop provides Chromium and Xfce Terminal. The project workspace and installed Node binary are available there. Running the compiled synthetic-only server in that desktop's normal terminal, with a cleared environment and only localhost/configuration variables, lets the existing cloud browser open http://localhost:3100/. No new browser was launched, no sandbox or organization policy was disabled, no credentials were used and no public service was deployed. Initial executor-loopback failures remain historical evidence, not current capability statements.

Core desktop clicks passed on code4c4698d0e82aae225295d1db00d6625e99c7201d. See evidence/browser-cua/REPORT.md and real screenshots. A decorative missing-glyph issue was changed to inline SVG and built/tested; its browser recheck is pending.

## Exact remaining scope
DevTools was explicitly blocked by organization policy; no bypass attempted. Normal OS window resizing tested measured dimensions, but did not reach top-level375/1440. A test-only ordinary same-origin iframe harness is prepared in tests/e2e/viewport-harness.html to test actual frame CSS viewport widths without developer tools or device/network emulation. Its results must be labeled iframe scope and remain pending until real interactions/measurements. It is not a mobile hardware test.

Ordinary owned-server stop/restart recovery testing is in progress. This is not browser offline emulation or a network-security change. Browser recording remains a separate uncompleted deliverable.

Source: https://learn.chatgpt.com/docs/environments/cloud-environments , Current limitations, checked2026-10-26.
