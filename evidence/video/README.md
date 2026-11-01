# Actual UI recording, not a mainnet submission video

Final deliverable: HSK_Pilot_Local_UI_Demo_120s.mp4 (120seconds,H2641278×848,15fps,silent,optionalEnglishcaptions). Original continuous180second recording retained in hsk-pilot-local-ui-demo.mp4. The final version only removes the first60seconds of idle introduction and adds optional subtitles; it does not synthesize browser frames, speed up actions or splice in fake outcomes.

Rendered source commit: ccdbed53c4e57d8817e0d4e82fd22023c996b713. All business data is synthetic and the UI explicitly says no real funds/wallet/AI/mainnet trades. This is a technical local UI checkpoint, not the final contest demonstration of a deployed autonomous trading product.

Actual captured sequence: sandbox, versioned policy preview and explicit confirmation, rule-based rebalance, scheduled HOLD, reduce-only then exit, pause, synthetic capital withdrawal and CLOSED. Final export/capabilities action was not established after a CUA timeout; later DOM/frame review verified closure without retrying the mutation. Evidence export itself was separately verified in browser-cua/REPORT.md, not claimed filmed.

verification.json records exact hashes, duration and scope. ffprobe metadata and complete decode check are retained; root visually inspected final frames38,60,95. An initial X11 image warning was recorded, followed by normal frame capture; complete decoded output had no reported errors. No audio or microphone was recorded.

The2second capture-probe files are diagnostics, not the deliverable.

## Narrated demo video (2026-11-01)

[`HSK_Pilot_Narrated_Demo.mp4`](HSK_Pilot_Narrated_Demo.mp4): 161 s, 1280×720, H.264 + AAC, English TTS narration with burned-in captions ([SRT](HSK_Pilot_Narrated_Demo.srt), [narration script](HSK_Pilot_Narrated_Demo.narration.json)).

Recorded 2026-11-01 ~18:50 UTC+8 with headless Chrome (Playwright) screenshots, assembled with ffmpeg; narration is synthetic (edge-tts voice en-US-AndrewNeural). Content:

1. Live public demo http://43.172.183.51:3901/ (SIMULATION banner) and `/api/health` (SIMULATION, liveFundsEnabled false, model CONFIGURED: sub2api / gpt-6-luna).
2. One real AI decision from the UI panel (`AI · gpt-6-luna`, action HOLD, latency ~3.9 s), advisory only.
3. Guard risk controls: Guard-bounded size clamp, dual strategy/risk EIP-712 signatures, owner pause / withdrawAll.
4. `TradingSessionGuard` on Blockscout (source verified, partial match), the mainnet `execute` tx 0xf2b70347…fd1b1 (1 WHSK → 0.087152 USDT), and the Guard's transaction and token-transfer lists.
5. The GitHub repository README.

No keys or secrets appear on screen; only public addresses and transaction hashes.
