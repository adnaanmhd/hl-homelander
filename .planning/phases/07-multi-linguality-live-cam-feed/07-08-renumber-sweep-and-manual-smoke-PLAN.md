---
phase: 07-multi-linguality-live-cam-feed
plan: 08
type: execute
wave: 4
depends_on: [04, 05, 06, 07]
files_modified:
  - .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
autonomous: false
requirements: [I18N-11, I18N-20, I18N-21, REC-LIVE-05, REC-LIVE-07]
tags: [smoke, sign-off, drift-AB, renumber-sweep, mobile]
must_haves:
  truths:
    - '`07-MANUAL-SMOKE.md` exists with 11 numbered sections covering every Phase 7 acceptance criterion'
    - 'The §9 A/B drift smoke walk has a documented pass/fail procedure: same-device same-day, baseline=preview-OFF, treatment=preview-ON, gate `(p99_on − p99_off) / p99_off < 0.50`'
    - "The renumber-sweep grep gate (§11) returns ONLY explicitly-annotated lines (no orphan 'Phase 7 = observability' references)"
    - 'The Android-only grep gate confirms zero diffs under `apps/mobile/ios/`'
    - "ROADMAP / STATE updated to reflect phase completion when the operator's smoke walk signs YES"
  artifacts:
    - path: .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md
      provides: 'Operator runbook with 11 §-numbered walks + sign-off block'
      contains: 'A/B drift'
    - path: .planning/ROADMAP.md
      provides: 'Phase 7 marked complete with date + sign-off note'
      contains: 'Phase 7: Multi-linguality'
    - path: .planning/STATE.md
      provides: 'Project state advanced past Phase 7'
      contains: 'phase 7'
  key_links:
    - from: .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md §9
      to: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
      via: drift A/B walk reads metadata.json from two recordings
      pattern: 'A/B drift smoke'
    - from: .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md §11
      to: .planning/ROADMAP.md / .planning/REQUIREMENTS.md / .planning/STATE.md / CLAUDE.md
      via: grep gate verifying all "Phase 7 observability" references are explicitly annotated
      pattern: "grep -rE 'Phase 7.*(observ"
---

<objective>
Author the on-hardware operator runbook (`07-MANUAL-SMOKE.md`) that exhaustively validates the 21 Phase 7 requirements, then run two grep gates that verify the planning artifacts and the diff scope are clean.

Per the Wave 4 design from ROADMAP and 07-VALIDATION.md, this plan has three deliverables:

1. **`07-MANUAL-SMOKE.md`** — 11 §-numbered operator walks, sourced from `07-VALIDATION.md` §Manual-Only Verifications + 07-PATTERNS.md "07-MANUAL-SMOKE.md" section. Each walk maps to one or more acceptance-criteria checkboxes from `07-SPEC.md`. The §9 A/B drift walk is the BLOCKING gate — if it fails, the phase is NOT signed off and plan 07-07's Surface-source choice must be revisited.

2. **§11 Renumber-sweep grep gate (I18N-20)** — a shell command in the runbook that confirms every "Phase 7 = observability" reference in the live planning artifacts is explicitly annotated as "was Phase 7 pre-2026-05-24 renumber" (the 2026-05-24 swap already added these annotations; this gate just verifies they survived).

3. **Android-only grep gate (I18N-21)** — `git diff --stat main -- apps/mobile/ios/` must return empty. The runbook documents this; the executor runs it before sign-off.

Plus the post-walk ROADMAP / STATE updates that mark Phase 7 complete on operator's YES verdict (mirroring how Phase 6's plan 06-11 closed).

Output: a single `07-MANUAL-SMOKE.md` runbook, a verified renumber sweep, a verified Android-only artifact set, and (after operator's on-hardware walk) the ROADMAP / STATE refresh that closes Phase 7.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-VALIDATION.md
@CLAUDE.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md
@.planning/phases/06-tasks-history-home-tiles-lexical-search/06-MANUAL-SMOKE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author 07-MANUAL-SMOKE.md with 11 §-numbered walks</name>
  <files>.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md</files>
  <read_first>
    - .planning/phases/04-handdetector-recording-ux-practice-tutorial/04-MANUAL-SMOKE.md (Phase 4 analog — §-numbered structure + sign-off block at end)
    - .planning/phases/06-tasks-history-home-tiles-lexical-search/06-MANUAL-SMOKE.md (Phase 6 analog — closer in shape to what we want; ends in a YES/NO sign-off)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md "Acceptance Criteria" (24 checkboxes — every checkbox must map to a §)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-VALIDATION.md "Manual-Only Verifications" table
    - .planning/phases/07-multi-linguality-live-cam-feed/07-PATTERNS.md "07-MANUAL-SMOKE.md" section (§-list)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Renumber Sweep" + "PLAN-Time Verification" (the grep gate command verbatim)
    - CLAUDE.md "±1 ms drift gate relaxed" banner (drift gate context for §9)
    - CLAUDE.md "Capture-quality cancel gate added 2026-05-17" (REC-LIVE-07 context for §10)
  </read_first>
  <action>
Create `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` with the structure below. The §-numbering matches the 07-PATTERNS.md "07-MANUAL-SMOKE.md" specification verbatim.

````markdown
# Phase 7 — Manual Smoke Runbook

**Created:** 2026-05-24
**Device under test:** Pixel 10a `5C161JEA304304`, Android 16, apkRollout-Debug
**Pre-walk reset:** `adb shell pm clear ai.humynlabs.capture.apk` (fresh install state).
**Tunnels:** `adb reverse tcp:8080 tcp:8080 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4566 tcp:4566` (LocalStack S3 required for upload smoke; see `feedback_dev_tunnels_include_localstack_4566.md`).
**Pre-flight:** dev API + hash-verify worker running (`pnpm dev` inside `apps/api/` — `feedback_dev_api_runs_hash_verify_worker.md`).

---

## §1 — i18n bootstrap on fresh install (I18N-02 acceptance)

**Setup:** Fresh install (after `adb shell pm clear ...`). Cold launch the APK.

**Walk:**

1. App opens to Splash. After splash dwell, screen replaces with **ChooseLanguageScreen**.
2. Confirm 8 rows visible: English / Português / Español / हिन्दी / বাংলা / தமிழ் / తెలుగు / मराठी (D-18 ordering).
3. The "English" row should be pre-selected (Check icon visible on the right).
4. Tap "Português". Check icon moves to that row.
5. Tap Continue. The screen replaces with **Signup** (NOT navigate — no back gesture).
6. Force-stop the app (`adb shell am force-stop ai.humynlabs.capture.apk`) and cold-launch again. **Verify ChooseLanguage does NOT re-render** — the app should resume at the post-locale-gate route (Signup, since no JWT yet).

**Result:** [ ] PASS / [ ] FAIL — note any deviation.

---

## §2 — Profile Language picker (I18N-04 acceptance)

**Setup:** Sign in (Google account `m.adnaan161@gmail.com`), complete onboarding to MainTabs.

**Walk:**

1. Tap the avatar in the top-right of Home → opens Profile.
2. Confirm a "Language" row exists IMMEDIATELY ABOVE "Help Center".
3. The right side of the Language row shows the current native name (e.g. "Português" / "हिन्दी").
4. Tap the Language row. Bottom-sheet picker slides up with the 8 options.
5. Current locale shows a Check icon on the right.
6. Tap "हिन्दी" (Hindi). Sheet auto-dismisses (NO Apply button — D-02).
7. Profile re-renders translated within 1 frame.
8. Force-stop + cold-launch — locale persists to Hindi (the choice survived MMKV write).

**Loop the walk for each non-English locale:** pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN. Each cycle should show translated copy on every screen visited.

**Result per locale:**

- pt-BR: [ ] PASS / [ ] FAIL
- es: [ ] PASS / [ ] FAIL
- hi-IN: [ ] PASS / [ ] FAIL
- bn-IN: [ ] PASS / [ ] FAIL
- ta-IN: [ ] PASS / [ ] FAIL
- te-IN: [ ] PASS / [ ] FAIL
- mr-IN: [ ] PASS / [ ] FAIL

---

## §3 — Bilingual consent rendering (I18N-07 acceptance)

**Setup:** With each non-English locale active, sign OUT (Profile → Logout) then back to Signup.

**Walk (per non-English locale — at minimum walk pt-BR + hi-IN):**

1. On Signup, the consent paragraph above the "Continue with Google" CTA renders TWO blocks:
   - Top: translated consent text (in the active locale)
   - Below: English consent text at ~70% opacity, smaller font
2. Tap "Terms of Use" link → modal opens. Same dual-rendering: translated body on top, English underlay below.
3. Verify: no clipping, no overflow, no missing-key placeholders (`{{key}}` visible).
4. Tap "Continue with Google" → sign-in completes. The server-side consent record (visible in `apps/api/` logs or a dev sanity query) should still reference the canonical ENGLISH `consent_text_version` (D-33).
5. In English (i18n.language === 'en'), the Terms-of-Use modal should show ONLY the English body — NO duplicate render below.

**Result:**

- pt-BR: [ ] PASS / [ ] FAIL
- hi-IN: [ ] PASS / [ ] FAIL
- en (single-body check): [ ] PASS / [ ] FAIL

---

## §4 — Per-locale TTS on Pixel 10a (I18N-06 acceptance)

**Setup:** For each non-English locale, pre-install the TTS engine on the device:

- Settings → System → Languages & input → Voice → Google TTS → Install voice data.
- Install voices for pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN as available.

**Walk (per locale — pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN):**

1. Set Profile language to the locale.
2. Start a recording (Tasks → any task → Record → pass gate or Skip).
3. After ~5 seconds, the "Recording started" TTS cue should play.
4. Listen — the voice MUST be in the active locale (e.g. Hindi voice for hi-IN). If not, check `adb logcat | grep -i "tts\|crashlytics"` — a `tts_locale_fallback` log line should be present if the engine was missing.
5. For a known-missing locale (e.g. uninstall Tamil voice from Settings, then re-test), the cue should play in English-US fallback AND a Crashlytics breadcrumb `{ event: 'tts_locale_fallback', locale: 'ta-IN', fallback: true }` should be visible in `adb logcat`.

**Result per locale (locale-voice case):**

- pt-BR: [ ] PASS — voice was Brazilian Portuguese
- es: [ ] PASS — voice was Spanish
- hi-IN: [ ] PASS — voice was Hindi
- bn-IN: [ ] PASS — voice was Bengali
- ta-IN: [ ] PASS — voice was Tamil
- te-IN: [ ] PASS — voice was Telugu
- mr-IN: [ ] PASS — voice was Marathi

**Fallback case (uninstall one voice → English fallback + breadcrumb):** [ ] PASS / [ ] FAIL

---

## §5 — Date formatting + Latin numerals (I18N-09 acceptance)

**Setup:** Have at least 2 recordings in History.

**Walk:**

1. Set locale to hi-IN. Open History. The day-header for today should render the date in Hindi (e.g. "१३ मई 2026"? — actually NO, see next step).
2. **Verify digits are Latin 0–9**: the day-header should read "13 मई 2026" (Devanagari month name, Latin digits). If Devanagari numerals (०१२...) appear, D-37 latn forcing is broken.
3. Set locale to pt-BR. History day-header should read "13 de mai. de 2026" or similar Portuguese form, with Latin digits.
4. Visit Profile — the "Joined" date should also be locale-formatted with Latin digits.

**Result:**

- hi-IN Devanagari month + Latin digits: [ ] PASS / [ ] FAIL
- pt-BR Portuguese month + Latin digits: [ ] PASS / [ ] FAIL
- Profile Joined date locale-formatted: [ ] PASS / [ ] FAIL

---

## §6 — Reverse-search task query (I18N-10 acceptance)

**Setup:** Locale set to hi-IN.

**Walk:**

1. Open Tasks. The list shows translated task names (e.g. "चाय बनाओ" instead of "Make tea").
2. Tap a task to open TaskDetailsSheet. Verify name + description + instructions + examples all render in Hindi (D-01 — full body translates).
3. Close the sheet. In the search field, type "चाय बनाओ".
4. Result: a row for "Make tea" should appear (Stage 1 full-string match reverse-mapped to canonical English before the backend search).
5. Clear the search. Type "बनाओ" (just "make"). Stage 2 token-fallback should at least surface some matches.
6. Type random Hindi text like "अब्बा डब्बा"; no results — that's the documented Stage 3 passthrough degraded state, not a bug.

**Loop for at least one more non-English locale** (pt-BR is easiest to verify).

**Result:**

- hi-IN Stage 1 full-string match: [ ] PASS / [ ] FAIL
- hi-IN Stage 2 token-fallback: [ ] PASS / [ ] FAIL or DEGRADED-OK (per D-14 documented behavior)
- pt-BR Stage 1: [ ] PASS / [ ] FAIL

---

## §7 — Live-cam preview 15-s initial (REC-LIVE-01 + D-05)

**Setup:** Sign in, complete tutorial. Locale: any (does not affect this walk).

**Walk — real recording flow:**

1. Tasks → any task → Record. Pass the hand gate (or tap Skip).
2. **Immediately on entering active substate**, the live ultrawide preview should render full-screen at system brightness.
3. The top-right (or corner per implementation) shows the static translated "Live preview" indicator (D-26 — NO per-second countdown).
4. Stop button remains hit-testable during the preview (visual check #6 from plan 07-07 checkpoint).
5. After ~15 s, the screen fades to the dimmed state: 5% brightness, black background, task name centered, Stop button visible, eye-icon glyph in bottom-right corner.

**Walk — practice recording flow (D-05):**

1. Reset onboarding (`adb shell am start -e gsd_reset_practice 1 ...` OR fresh install) → enter PracticeIntro → tap "Start Practice".
2. Same initial 15-s preview renders full-screen.
3. **Critical D-05 check:** the practice instructional copy (centered task name + practice-mode chrome) MUST NOT render during the 15-s preview window.
4. After 15 s, the screen fades to dim AND the practice instructional copy appears.

**Result:**

- Real flow initial 15-s preview: [ ] PASS / [ ] FAIL
- Practice flow D-05 (copy NOT during preview): [ ] PASS / [ ] FAIL
- Stop hit-testable during preview: [ ] PASS / [ ] FAIL

---

## §8 — Tap-reveal rolling 10-s + Stop hit-test in all 3 states (REC-LIVE-02, REC-LIVE-03, REC-LIVE-15)

**Setup:** Recording in progress, in the dimmed state (after §7).

**Walk:**

1. Tap anywhere on the dimmed screen (NOT the Stop button). Preview should re-appear at system brightness for 10 s.
2. At ~5 s into the 10-s window, tap again. The 10-s window must extend — countdown to fade restarts at ~10 s, NOT continues from where it was (rolling per D-29).
3. Wait for fade — screen goes dim again.
4. **Stop hit-test in all 3 states:**
   - During the initial-15-s preview (re-start a recording if needed) — tap Stop → recording stops, History shows the row.
   - During the dimmed state — tap Stop → recording stops.
   - During a tap-revealed 10-s window — tap Stop → recording stops.
   - All three should be reliable; if any miss, the z-stack is broken.
5. The brightness wrapper drives system → 0.05 → system across these transitions. On STOP / on UNMOUNT, brightness returns to system level (existing REC-08 behavior — unchanged per REC-LIVE-15).

**Result:**

- Tap-reveal restores preview at system brightness: [ ] PASS / [ ] FAIL
- Subsequent tap resets timer (rolling not accumulating): [ ] PASS / [ ] FAIL
- Stop hit-testable in initial-preview state: [ ] PASS / [ ] FAIL
- Stop hit-testable in dimmed state: [ ] PASS / [ ] FAIL
- Stop hit-testable in tap-revealed state: [ ] PASS / [ ] FAIL

---

## §9 — **A/B drift smoke (REC-LIVE-05 / D-04 — BLOCKING)**

**Setup:** Pixel 10a, room temperature, no thermal stress. Both recordings happen back-to-back on the SAME DEVICE on the SAME DAY in the SAME SCENE.

**Walk — Baseline (preview OFF):**

1. Disable the live-cam preview path. Two options:
   - Code-route disable: in dev menu (if implemented), toggle "Live preview" off.
   - Or: rebuild with a feature-flag override `LIVE_PREVIEW_ENABLED=false` (planner's call — document in 07-07 SUMMARY if needed).
2. Start a recording on any task. Let it run for **10 minutes EXACTLY** (use a stopwatch).
3. Stop. Wait for upload + verify (qa_status='verified' in the History tile).
4. Extract `imu_video_drift_p99_ms` from the recording's `metadata.json` via:
   ```bash
   adb shell run-as ai.humynlabs.capture.apk \
     cat /data/data/ai.humynlabs.capture.apk/cache/<recording_id>/metadata.json \
     | jq '.imu_video_drift_p99_ms'
   ```
````

(Alternatively pull from the server DB: `SELECT calibration->>'recording_id', metadata->>'imu_video_drift_p99_ms' FROM recordings WHERE id = ...`) 5. **Record:** `p99_OFF = ____ ms`

**Walk — Treatment (preview ON):**

1. Re-enable the live-cam preview path.
2. Start another recording on the same task, same scene, same camera placement.
3. Trigger the live-preview path naturally — let the 15-s initial preview run; tap to reveal the preview at 5-min mark; let it fade; tap again at 7-min mark.
4. Stop at exactly 10 minutes. Wait for upload + verify.
5. Extract `imu_video_drift_p99_ms` same way.
6. **Record:** `p99_ON = ____ ms`

**Compute and gate:**

- `delta = (p99_ON − p99_OFF) / p99_OFF`
- **Acceptance per D-04:** `delta < 0.50`

**Result:**

- `p99_OFF` measured: \_\_\_\_ ms
- `p99_ON` measured: \_\_\_\_ ms
- `delta` computed: \_\_\_\_
- **GATE PASS (delta < 0.50)?** [ ] PASS / [ ] FAIL — if FAIL, the phase is BLOCKED until plan 07-07's CaptureSession.kt diff is revised (fall back to Option A's SurfaceTexture splitter; re-walk).

---

## §10 — Capture-quality cancel gates UNCHANGED (REC-LIVE-07)

**Setup:** Re-run the §10 walks from `04-MANUAL-SMOKE.md` + the 260517-p5g quick-task walks (capture-quality cancel gate added 2026-05-17 — CLAUDE.md banner).

**Walk — forced fps_dropped:**

1. Start a recording. Cover the camera lens with your finger so the encoder sees fewer frames (forces `mean_fps` below 29).
2. Stop after at least 60 s. The History row should show the chip-failed visual with copy "Canceled — frame rate dropped" (or the translated equivalent in the active locale).
3. Verify the segment is NOT in the upload queue: `adb logcat | grep -i "UploadQueue\|fps_dropped"`.

**Walk — forced resolution_dropped:** (harder to force on Pixel 10a's HEVC path — typically only fires on broken devices; skip if no easy reproducer, but document attempt)

**Walk — insufficient_frames:**

1. Start a recording. Stop within 1 second.
2. History row should show "Canceled — recording too short" with the translated copy.

**Verify:** the cancel logic fired REGARDLESS of whether the preview was visible or not (run the forced fps_dropped both with preview ON and preview OFF — both should cancel).

**Result:**

- fps_dropped fires + History shows chip-failed: [ ] PASS / [ ] FAIL
- insufficient_frames fires + History shows chip-failed: [ ] PASS / [ ] FAIL
- Cancel works with preview ON: [ ] PASS / [ ] FAIL
- Cancel works with preview OFF: [ ] PASS / [ ] FAIL

---

## §11 — Renumber-sweep grep gate (I18N-20) + Android-only diff gate (I18N-21)

**Walk:**

1. From the repo root, run the renumber-sweep grep gate verbatim from 07-RESEARCH.md "PLAN-Time Verification":

   ```bash
   grep -rE 'Phase 7.*(observ|distribution|HumynUpdater|Bull-Board|APK)' \
     .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/STATE.md CLAUDE.md \
     | grep -v 'pre-2026-05-24\|renumber\|swap 2026-05-24\|Phase 7 narrowed\|was Phase 7\|Phase 7: Multi-linguality'
   ```

   Expected output: **zero lines**. If any line is returned, it is an orphan reference and must be fixed before sign-off.

2. Run the Android-only diff gate:

   ```bash
   git diff --stat main -- apps/mobile/ios/
   ```

   Expected output: **empty**. If any iOS file is in the diff, the Phase 7 PR has accidentally touched iOS code — must be reverted.

3. Also verify NO new server migration shipped (D-16):

   ```bash
   git diff --stat main -- apps/api/drizzle/migrations/
   ```

   Expected output: **empty**.

4. Confirm Phase 6 cosmetic-gaps doc was NOT edited (I18N-11):
   ```bash
   git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
   ```
   Expected output: **empty**.

**Result:**

- Renumber sweep clean: [ ] PASS / [ ] FAIL
- Android-only diff: [ ] PASS / [ ] FAIL
- No DB migration: [ ] PASS / [ ] FAIL
- Phase 6 cosmetic-gaps untouched: [ ] PASS / [ ] FAIL

---

## Sign-off

After all §1–§11 walks complete:

- All §1–§10 walks PASS (or DEGRADED-OK with explicit owner sign-off): [ ] YES / [ ] NO
- §9 A/B drift `delta < 0.50` (BLOCKING per D-04): [ ] YES / [ ] NO
- §11 grep gates all clean: [ ] YES / [ ] NO

**Verdict: YES** → Plan 07-08 Task 2 runs (ROADMAP / STATE refresh).
**Verdict: NO** → File the failure(s) under `gaps_found` in `07-VERIFICATION.md` and dispatch a follow-up plan or `/gsd-debug` round before re-walking.

---

**Walk operator:** ******\_\_\_******
**Walk date:** ******\_\_\_******
**Device:** Pixel 10a `5C161JEA304304`, Android **, apkRollout-Debug HEAD `\_\_**`

````

That's the runbook. Save it to `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md`.
  </action>
  <verify>
    <automated>test -f .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md && wc -l .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md | awk '{ if ($1 < 100) { print "FAIL: runbook too short, "$1" lines"; exit 1 } else { print "OK: "$1" lines" } }'</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` exists.
    - `wc -l .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` returns at least 150 lines (runbook is substantial).
    - `grep -c "^## §" .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` returns at least 11 (all 11 sections present).
    - `grep -c "A/B drift" .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` returns at least 1 (§9 is documented).
    - `grep -c "BLOCKING" .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` returns at least 1 (§9 is flagged blocking).
    - `grep -c "0.50" .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` returns at least 1 (D-04 gate threshold documented).
  </acceptance_criteria>
  <done>11-section runbook authored covering every Phase 7 acceptance criterion with concrete steps, expected outputs, and grep gates. Operator walk is now self-contained.</done>
</task>

<task type="auto">
  <name>Task 2: Run automated grep gates + record results in SUMMARY (pre-operator-walk validation)</name>
  <files>.planning/phases/07-multi-linguality-live-cam-feed/07-08-SUMMARY-pregate.md</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md (Task 1's runbook — §11 grep gates)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-RESEARCH.md "Renumber Sweep" — verbatim grep expected
  </read_first>
  <action>
Run the §11 grep gates from the runbook (renumber sweep + Android-only diff + no DB migration + Phase 6 cosmetic-gaps untouched) and record the exact output in `.planning/phases/07-multi-linguality-live-cam-feed/07-08-SUMMARY-pregate.md`. This is the PRE-walk validation that the diff scope is clean — separate from the operator's on-hardware walks.

```bash
# §11.1 — renumber sweep
RENUMBER_HITS=$(grep -rE 'Phase 7.*(observ|distribution|HumynUpdater|Bull-Board|APK)' \
  .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/STATE.md CLAUDE.md 2>/dev/null \
  | grep -v 'pre-2026-05-24\|renumber\|swap 2026-05-24\|Phase 7 narrowed\|was Phase 7\|Phase 7: Multi-linguality')
echo "RENUMBER_SWEEP_HITS_BEGIN"
echo "${RENUMBER_HITS:-<empty>}"
echo "RENUMBER_SWEEP_HITS_END"

# §11.2 — Android-only diff (against main)
IOS_DIFF=$(git diff --stat main -- apps/mobile/ios/ 2>/dev/null)
echo "IOS_DIFF_BEGIN"
echo "${IOS_DIFF:-<empty>}"
echo "IOS_DIFF_END"

# §11.3 — no DB migration
MIGR_DIFF=$(git diff --stat main -- apps/api/drizzle/migrations/ 2>/dev/null)
echo "MIGRATION_DIFF_BEGIN"
echo "${MIGR_DIFF:-<empty>}"
echo "MIGRATION_DIFF_END"

# §11.4 — Phase 6 cosmetic-gaps untouched
P6_GAPS_DIFF=$(git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md 2>/dev/null)
echo "PHASE6_COSMETIC_GAPS_DIFF_BEGIN"
echo "${P6_GAPS_DIFF:-<empty>}"
echo "PHASE6_COSMETIC_GAPS_DIFF_END"
````

Write the captured outputs into `07-08-SUMMARY-pregate.md` along with a PASS/FAIL verdict per gate:

```markdown
# Phase 7 — Pre-walk grep gates (Plan 07-08 Task 2)

**Run date:** {today}

## §11.1 Renumber sweep

- Expected: empty
- Output: {paste}
- Verdict: PASS / FAIL

## §11.2 Android-only diff

- Expected: empty
- Output: {paste}
- Verdict: PASS / FAIL

## §11.3 No DB migration

- Expected: empty
- Output: {paste}
- Verdict: PASS / FAIL

## §11.4 Phase 6 cosmetic-gaps untouched

- Expected: empty
- Output: {paste}
- Verdict: PASS / FAIL
```

**If any gate fails**: STOP and surface the failure for the operator. Do NOT proceed to Task 3 (ROADMAP/STATE refresh) until the failing gate is remediated.

**If all four gates pass**: proceed to Task 3 (pending operator's on-hardware walk).
</action>
<verify>
<automated>test -f .planning/phases/07-multi-linguality-live-cam-feed/07-08-SUMMARY-pregate.md && grep -c "Verdict: PASS" .planning/phases/07-multi-linguality-live-cam-feed/07-08-SUMMARY-pregate.md</automated>
</verify>
<acceptance_criteria> - File `.planning/phases/07-multi-linguality-live-cam-feed/07-08-SUMMARY-pregate.md` exists. - All 4 grep gates have their literal captured output written into the file. - All 4 sections have a "Verdict: PASS" line (`grep -c "Verdict: PASS" ...` returns 4) OR the failing gate is documented for remediation.
</acceptance_criteria>
<done>Pre-walk grep gates run; outputs captured in pregate SUMMARY; all 4 PASS or failures explicitly flagged for remediation before operator walk.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Checkpoint: Phase 7's on-hardware acceptance runbook + the pre-walk grep gates that prove th...</name>
  <files>n/a — operator-only verification</files>
  <action>Run the operator verification described in &lt;how-to-verify&gt; below. Pause execution and wait for the resume-signal.</action>
  <verify>
    <automated>echo "Operator checkpoint — verification is manual; resume on operator approval."</automated>
  </verify>
  <done>Operator types the resume-signal indicating PASS or FAIL of the visual checks.</done>
  <what-built>
    Phase 7's on-hardware acceptance runbook + the pre-walk grep gates that prove the diff scope is clean. The actual walks (§1–§11) require the Pixel 10a in-hand, including the BLOCKING §9 A/B drift smoke.
  </what-built>
  <how-to-verify>
    **Operator on-hardware walk against `.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md`:**

    1. Build + install the apkRollout-Debug APK on the Pixel 10a:
       ```bash
       cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug
       adb install -r apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk
       ```

    2. Set up the dev tunnels and dev API per the runbook's pre-flight (port 8080 + 8081 + 4566 for LocalStack; `pnpm dev` for the API + hash-verify worker).

    3. Walk §1 through §11 in order, filling in each result. Allow ~90 minutes for the full walk + the §9 drift A/B (which alone is ~25 minutes of recording).

    4. After §11 grep gates verify clean (the pre-walk in Task 2 already did this — re-verify after operator's walk to catch any mid-walk edits), record the final verdict at the bottom of the runbook.

    **The §9 drift A/B is the BLOCKING gate:** if `delta >= 0.50`, the operator MUST report this back so plan 07-07's CaptureSession.kt diff can be reverted to Option A and a re-walk scheduled.

  </how-to-verify>
  <resume-signal>Type "approved YES" if all §1–§11 walks pass and §9 delta < 0.50; or "approved NO §X" naming the failing section(s).</resume-signal>
</task>

<task type="auto">
  <name>Task 3: ROADMAP + STATE refresh on operator YES verdict</name>
  <files>.planning/ROADMAP.md, .planning/STATE.md</files>
  <read_first>
    - .planning/ROADMAP.md (lines 24 — "Phase 7: Multi-linguality & Live-Cam Feed" entry; lines 305 — Plans: TBD)
    - .planning/STATE.md (top frontmatter + Current Position + Performance Metrics)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md (operator's filled-in walk for verdict)
    - .planning/phases/06-tasks-history-home-tiles-lexical-search/06-MANUAL-SMOKE.md §7 sign-off (analog: how Phase 6 closed)
  </read_first>
  <action>
**Only run this task if the operator's checkpoint (Task 3 above) returned "approved YES".**

1. Update `.planning/ROADMAP.md`:

   - Find the Phase 7 entry (line 24 area). Change `- [ ] **Phase 7: Multi-linguality & Live-Cam Feed**` to `- [x] **Phase 7: Multi-linguality & Live-Cam Feed**` and append `(completed {today})` to the description.
   - Update the Phase 7 detail section (~line 292-307) — replace `**Plans:** TBD` with `**Plans:** 8 plans complete (07-01 .. 07-08)` and update the Plans block to list each of the 8 plans with `- [x]` checkboxes pointing at the actual filenames.
   - Update the progress table at the bottom (~line 327-337): change the "7. Multi-linguality & Live-Cam Feed" row to "8/8 / Complete / {today}".

2. Update `.planning/STATE.md`:

   - `status:` line — set to `"Phase 7 closed {today}; awaiting Phase 8 spec/discuss/plan"`.
   - `progress.completed_phases` — bump from 5 to 6 (or whatever the current count is — Phase 6 was already complete; Phase 7 brings it to 7).
   - `progress.total_plans` — add 8.
   - `progress.completed_plans` — add 8.
   - `## Current Position` block — update to reflect Phase 7 closed, Phase 8 pending.
   - `## Accumulated Context → Roadmap Evolution` — add a `2026-MM-DD` entry summarizing: "Phase 7 closed — 8 plans landed (i18n runtime + LLM catalog tool + helpers + Choose Language picker + Profile picker + screen sweep + TTS fallback + reverse-search + live-cam preview Option B). A/B drift smoke walked on Pixel 10a; delta = {recorded_value}; D-04 gate PASS. All 21 SPEC requirements satisfied + 2 process requirements (I18N-20 renumber sweep, I18N-21 Android-only). 19 phase requirements + 2 SPEC process requirements traced through plans."
   - `## Accumulated Context → Decisions` — append a bullet noting Phase 7's locked decisions (37 D-decisions D-01..D-37 from 07-CONTEXT.md) are now history.

3. Commit message convention:

   ```
   docs(phase-7): close Phase 7 — Multi-linguality & Live-Cam Feed

   All 8 plans (07-01..07-08) landed. Operator's `07-MANUAL-SMOKE.md` walk on
   Pixel 10a verdict: YES. §9 A/B drift `delta = {value}`, gate PASS (< 0.50).

   - 8 locales end-to-end across UI + TTS + Intl.DateTimeFormat
   - ChooseLanguageScreen (design carve-out #2) between Splash and Signup
   - Profile Language row tap-to-commit picker
   - Live ultrawide camera preview during recording (15-s initial + rolling 10-s tap-reveal)
   - Option B (two-Surface CaptureSession) — no FinalizeWorker / HevcEncoder / metadata schema changes
   - Android only (iOS deferred per §v2 IOS-01..07)

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```

   Git author identity: `Adnaan Mohammed <m.adnaan161@gmail.com>` (per memory `feedback_git_commit_email.md`).
   </action>
   <verify>
   <automated>grep -c "\[x\] \*\*Phase 7: Multi-linguality" .planning/ROADMAP.md</automated>
   </verify>
   <acceptance_criteria> - ROADMAP Phase 7 checkbox marked `[x]`. - ROADMAP Phase 7 detail section lists all 8 plans with `[x]` checkboxes. - ROADMAP progress table shows Phase 7 as Complete with today's date. - STATE.md `status:` reflects "Phase 7 closed". - STATE.md `progress.completed_phases` incremented; `completed_plans` += 8. - STATE.md Roadmap Evolution gains a Phase-7 close entry.
   </acceptance_criteria>
   <done>ROADMAP + STATE updated to reflect Phase 7 closure. The next `/gsd-spec-phase 8` invocation starts cleanly from this baseline.</done>
   </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                       | Description                                          |
| ---------------------------------------------- | ---------------------------------------------------- |
| Operator's on-hardware walk → drift A/B values | Manual recording of `p99_OFF` and `p99_ON`           |
| Grep gate output → repository diff             | Verifies the PR scope did not regress Phase 6 or iOS |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                           | Disposition | Mitigation Plan                                                                                                                                                                                                            |
| ---------- | ---------------------- | --------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-08-01 | Repudiation            | Operator walks without recording the drift values   | mitigate    | Runbook §9 has explicit `p99_OFF: ___` and `p99_ON: ___` blanks; the operator MUST fill them before the sign-off block.                                                                                                    |
| T-07-08-02 | Tampering              | Operator forgets to disable preview for baseline    | mitigate    | §9 step explicitly instructs the disable-then-enable order; the runbook flags it as BLOCKING. Code-side feature-flag override is documented (plan 07-07 SUMMARY).                                                          |
| T-07-08-03 | Information Disclosure | metadata.json read via `adb shell run-as` leaks PII | accept      | The cacheDir contents are the user's own recordings; no PII beyond the recording itself. `run-as` requires apkRollout-Debug (debuggable) build — never works on a release build.                                           |
| T-07-08-04 | DoS                    | Renumber sweep flags benign annotations as orphans  | mitigate    | The grep gate's negative filter (`grep -v 'pre-2026-05-24...'`) is the exact list of grandfathered annotations from 07-RESEARCH §"Currently-Annotated References". Updating the filter is part of this plan's maintenance. |

</threat_model>

<verification>
- `07-MANUAL-SMOKE.md` ships with 11 §-numbered sections + sign-off block
- Pre-walk grep gates exit 0 with all 4 PASS verdicts (Task 2)
- Operator's on-hardware walk fills in the YES/NO verdict
- On YES verdict: ROADMAP + STATE updated; commit message follows convention; phase closes
- On NO verdict: failures filed under `07-VERIFICATION.md` `gaps_found`; follow-up plan or `/gsd-debug` round scheduled
</verification>

<success_criteria>

- `07-MANUAL-SMOKE.md` exists with all 11 walks documented
- §9 A/B drift gate procedure is unambiguous + sourced from D-04
- All 4 pre-walk grep gates PASS (renumber sweep, Android-only, no DB migration, Phase 6 cosmetic-gaps untouched)
- Operator's on-hardware walk signs YES (or failures are tracked for follow-up)
- On YES: ROADMAP/STATE reflect Phase 7 closure
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-08-SUMMARY.md`. Include:
- The exact drift values from §9 (`p99_OFF`, `p99_ON`, `delta`)
- The final operator verdict
- Any deferred-to-§v2 items surfaced during the walk (per CLAUDE.md "Functionality first during smoke walks" — cosmetic gaps get a `07-COSMETIC-GAPS.md` doc rather than blocking the close)
</output>
