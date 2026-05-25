---
status: partial
phase: 07-multi-linguality-live-cam-feed
source: [07-VERIFICATION.md]
started: 2026-05-25T05:15:00Z
updated: 2026-05-25T05:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. §1 i18n bootstrap on fresh install

expected: All six §1 PASS rows checked — Pixel 10a fresh APK install: 8 rows in D-18 order, native+English name presentation (D-19), English pre-selected, Continue→Signup (no back), cold relaunch does NOT re-render ChooseLanguage, tokens-only grep gate (I18N-03)
result: [pending]

### 2. §2 Profile language picker per-locale walk (post-07-09 add-on)

expected: All 7 non-English locales PASS plus `locale_changed` ring-buffer event firing AND Profile + Delete-Account fully translated. For each of pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN: sheet auto-dismiss + translated re-render within 1 frame + persists across cold-launch + locale_changed telemetry ring entry in logcat. **AFTER 07-09 CLOSURE:** also verify ProfileScreen labels (Name/Age/Gender/Joined/Help Center/Logout/Delete account/tap to edit/payments/lifetime captions) AND the Delete Account modal (both steps + DELETE-input flow) render fully in the selected locale.
result: [pending]

### 3. §3 Bilingual consent rendering

expected: All four §3 PASS rows checked — pt-BR + hi-IN active locale: Signup consent paragraph + Terms-of-Use modal show translated text on top + English at ~70% opacity below; server-side `consent_text_version` stays canonical English; English locale shows single-body (no duplicate)
result: [pending]

### 4. §4 Per-locale TTS on Pixel 10a

expected: All 8 locale-voice rows PASS plus fallback case. For each of pt-BR / es / hi-IN / bn-IN / ta-IN / te-IN / mr-IN with the engine installed: "Recording started" cue plays in the active locale; uninstalled locale falls back to en-US AND emits Crashlytics `tts_locale_fallback` breadcrumb; English locale preserves owner-deviation voice
result: [pending]

### 5. §5 Date formatting + Latin numerals

expected: All five §5 PASS rows checked — hi-IN: Devanagari month name + Latin 0-9 digits in History day-header (NOT Devanagari numerals); pt-BR Portuguese month form; all 4 Indic locales render locale-appropriate month + Latin digits; Profile Joined date locale-formatted
result: [pending]

### 6. §6 Reverse-search task query + full body translation

expected: All §6 PASS rows checked — hi-IN active: TasksScreen shows translated task names where present; search "चाय बनाओ" surfaces Make tea (Stage 1); "बनाओ" surfaces token-fallback matches (Stage 2); random Hindi returns zero (Stage 3 degraded-OK); TaskDetailsSheet shows full Hindi body (name + description + instructions + examples); pt-BR Stage 1 "fazer chá" → Make tea
result: [pending]

### 7. §7 Live-cam preview — initial 15-s window + practice-flow D-05

expected: All six §7 PASS rows checked — real flow: 15-s full-screen ultrawide preview at system brightness with static translated "Live preview" indicator; fades to dimmed state with Eye glyph bottom-right; Stop hit-testable during preview; practice flow: practice instructional copy MUST NOT render during the 15-s preview window; translated label in non-English locale
result: [pending]

### 8. §8 Tap-reveal rolling 10-s + Stop hit-test all 3 states + brightness restore

expected: All five §8 PASS rows checked — from dimmed: tap restores preview at system brightness for 10 s; subsequent tap at ~5 s extends to ~10 s (rolling, NOT accumulating); Stop hit-testable in dimmed AND tap-revealed states; brightness restores to system on Stop/unmount
result: [pending]

### 9. §9 BLOCKING A/B drift smoke (REC-LIVE-05 / D-04)

expected: delta < 0.50 → phase sign-off unblocked; delta >= 0.50 → BLOCKER, plan 07-07 CaptureSession.kt must be reverted to Option A (Surface splitter via GL). Pixel 10a, room temperature, same-device + same-day + same-scene: 10-min recording with preview OFF + 10-min recording with preview ON; extract `imu_video_drift_p99_ms` from metadata.json; compute delta = (p99_ON − p99_OFF) / p99_OFF.
result: [pending]

### 10. §10 Capture-quality cancel gates UNCHANGED

expected: All five §10 PASS rows checked — forced `fps_dropped` (cover lens for 60s+) shows "Canceled — frame rate dropped" chip + segment NOT in upload queue + translated copy in hi-IN; `insufficient_frames` (stop within 1s) shows "Canceled — recording too short"; cancel works with preview ON and preview OFF
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
