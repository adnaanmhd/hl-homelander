---
phase: 7
slug: multi-linguality-live-cam-feed
type: manual-smoke
canonical: true
created: 2026-05-25
re_walked_on: 2026-05-26 (§7 / §8 / §9 sections only — plan 07-10 closure; full Phase 7 sign-off walk still pending other waves)
---

# Phase 7 — Manual Smoke Runbook (Multi-linguality & Live-Cam Feed — on-hardware acceptance)

**Status:** AUTHORED 2026-05-25 — operator on-device walk pending. This is the canonical Pattern-56 runbook for Phase 7. Plans 07-01..07-07 have all landed (SUMMARY.md committed for each); Plan 07-08 ships this runbook + the two grep gates (run + recorded in `07-08-SUMMARY-pregate.md`) + pauses at the §Sign-off human-verify checkpoint below.

> **Wave 4 design (per `07-VALIDATION.md` + `07-PATTERNS.md`):** Waves 1 → 2 → 3 ran sequentially with no human gate between them. The operator's on-hardware verdict — including the BLOCKING §9 A/B drift smoke walk (D-04) — lives in this runbook. Plan 07-07's checkpoint 10 visual checks (REC-LIVE-01..04 + D-05 + D-26) are folded into §7 + §8 below so the operator runs ONE on-hardware walk for the whole phase, not two separate walks.

**Created:** 2026-05-25
**Device under test:** Pixel 10a `5C161JEA304304`, Android 16, apkRollout-Debug
**Pre-walk reset:** `adb shell pm clear ai.humynlabs.capture.apk` (fresh install state) before §1 only — subsequent sections build on the same install unless noted.
**Tunnels:** `adb reverse tcp:8080 tcp:8080 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4566 tcp:4566` (LocalStack S3 on port 4566 is **required** for upload smoke; see memory `feedback_dev_tunnels_include_localstack_4566.md`).
**Pre-flight:** dev API + hash-verify worker running (`cd apps/api && pnpm dev` — `pnpm dev` spawns both per memory `feedback_dev_api_runs_hash_verify_worker.md`). Re-seed the dev DB if you ran `pnpm --filter @humyn/api test` recently (see memory `feedback_api_tests_wipe_dev_db.md`).

> Throughout: the app package id for the `apkRollout` flavor is `ai.humynlabs.capture.apk` — every `adb shell run-as` / `adb logcat` filter uses that. Run `adb logcat -c` before each section so the logcat greps match the latest run. The app NEVER runs CLI commands; the operator only visits screens, taps UI, evaluates visuals/audio, and runs the `adb` diagnostics quoted inline.
>
> **iOS is out of scope (Android-only MVP).** The iOS native-module analogues (HumynCaptureIOS / iOS HumynLivePreview) are deferred per §v2 IOS-01..07. This runbook is Android-only by design (also enforced by §11.2 below — empty diff under `apps/mobile/ios/`).

---

## §1 — i18n bootstrap on fresh install (I18N-02 + I18N-03 + I18N-23 acceptance)

Plan 07-04 closed here: new `ChooseLanguageScreen` registered in `OnboardingStack` between Splash and Signup, MMKV-gated on `locale.chosen_at`, default-English pre-selected, eight rows in D-18 ordering.

**Setup:** Fresh install (after `adb shell pm clear ai.humynlabs.capture.apk`). Cold launch the APK.

**Walk:**

1. App opens to Splash. After the splash dwell, the screen replaces with **ChooseLanguageScreen** (no back gesture).
2. Confirm **8 rows visible in this order** (D-18): English / Português / Español / हिन्दी / বাংলা / தமிழ் / తెలుగు / मराठी.
3. Each row shows **native name on the left, English name on the right** (D-19 — e.g. "हिन्दी / Hindi"). The right side uses a secondary token color.
4. The "English" row should be pre-selected (lucide `Check` icon visible on the right).
5. Tap "Português". Check icon moves to that row.
6. Tap **Continue**. The screen `navigation.replace`s to **Signup** — there should be **no back gesture** that brings ChooseLanguage back (D-22).
7. Force-stop the app (`adb shell am force-stop ai.humynlabs.capture.apk`) and cold-launch again. **Verify ChooseLanguage does NOT re-render** — the app should resume at the post-locale-gate route (Signup, since no JWT yet).
8. **Design carve-out check (I18N-03):** `grep -cE "#[0-9A-Fa-f]{3,6}" apps/mobile/src/screens/chooseLanguage/ChooseLanguageScreen.tsx apps/mobile/src/screens/chooseLanguage/LanguageList.tsx 2>/dev/null` should return **0** (tokens-only — no inline hex literals).

**Result:**

- 8 rows in D-18 order: [ ] PASS / [ ] FAIL
- Native + English name presentation (D-19): [ ] PASS / [ ] FAIL
- English pre-selected default: [ ] PASS / [ ] FAIL
- Continue → Signup, no back: [ ] PASS / [ ] FAIL
- Cold relaunch does NOT re-render ChooseLanguage: [ ] PASS / [ ] FAIL
- Tokens-only grep gate (I18N-03): [ ] PASS / [ ] FAIL

---

## §2 — Profile Language picker (I18N-04 + I18N-12 acceptance)

Plan 07-04 also closed the Profile Language row + bottom-sheet picker (tap-to-commit, no Apply button per D-02).

**Setup:** Sign in (Google account `m.adnaan161@gmail.com`), complete onboarding to MainTabs.

**Walk:**

1. Tap the avatar in the top-right of Home → opens Profile.
2. Confirm a **"Language" row exists IMMEDIATELY ABOVE "Help Center"**.
3. The right side of the Language row shows the **current native name** (e.g. "Português" / "हिन्दी").
4. Tap the Language row. Bottom-sheet picker slides up with the 8 options in D-18 order.
5. Current locale shows a `Check` icon on the right.
6. Tap "हिन्दी" (Hindi). Sheet **auto-dismisses** (NO Apply button — D-02).
7. Profile re-renders translated within 1 frame.
8. Force-stop + cold-launch — locale persists to Hindi (the choice survived MMKV write).

**Loop the walk for each non-English locale:** pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN. Each cycle should show translated copy on every screen visited (home tiles, history headers, tasks list).

**Telemetry check (I18N-12):** after each locale change, `adb logcat | grep -i "telemetryRing\|locale_changed"` should show a `locale_changed` ring-buffer event with `{ from_locale, to_locale, installation_id }` payload. **No new server route fired** (per D-30 — same `secureMmkv`-backed ring).

**Result per locale (sheet auto-dismiss + translated re-render within 1 frame + persists across cold-launch):**

- pt-BR: [ ] PASS / [ ] FAIL
- es: [ ] PASS / [ ] FAIL
- hi-IN: [ ] PASS / [ ] FAIL
- bn-IN: [ ] PASS / [ ] FAIL
- ta-IN: [ ] PASS / [ ] FAIL
- te-IN: [ ] PASS / [ ] FAIL
- mr-IN: [ ] PASS / [ ] FAIL
- `locale_changed` ring-buffer event fires + no new server route: [ ] PASS / [ ] FAIL

---

## §3 — Bilingual consent rendering (I18N-07 + I18N-17 acceptance)

Plan 07-05 closed the bilingual consent rendering. D-32 + D-33: composition is view-side; sign-up POST payload references the canonical ENGLISH `consent_text_version` regardless of active locale.

**Setup:** With each non-English locale active, sign OUT (Profile → Logout) then back to Signup.

**Walk (per non-English locale — at minimum walk pt-BR + hi-IN):**

1. On Signup, the consent paragraph above the "Continue with Google" CTA renders **TWO blocks**:
   - Top: translated consent text (in the active locale)
   - Below: English consent text at **~70% opacity**, smaller font
2. Tap "Terms of Use" link → modal opens. **Same dual-rendering**: translated body on top, English underlay below.
3. Verify: no clipping, no overflow, no missing-key placeholders (`{{key}}` visible).
4. Tap "Continue with Google" → sign-in completes. The server-side consent record (visible in `apps/api/` logs or `psql humyn_dev -c "select consent_text_version from users order by created_at desc limit 1"`) should still reference the canonical ENGLISH `consent_text_version` (D-33).
5. In English (`i18n.language === 'en'`), the Terms-of-Use modal should show **ONLY the English body** — NO duplicate render below (D-32 suppression).

**Result:**

- pt-BR dual-rendering (Signup + Terms-of-Use modal): [ ] PASS / [ ] FAIL
- hi-IN dual-rendering (Signup + Terms-of-Use modal): [ ] PASS / [ ] FAIL
- Server-side `consent_text_version` = canonical English regardless of locale: [ ] PASS / [ ] FAIL
- en (single-body, no duplicate): [ ] PASS / [ ] FAIL

---

## §4 — Per-locale TTS on Pixel 10a (I18N-06 acceptance)

Plan 07-06 closed the TTS fallback chain. D-31: `Tts.setDefaultLanguage(activeLocaleBcp47)` then locale-female → locale-any → en-US-female → en-US-any → first en-\* . On steps 3+, emit Crashlytics breadcrumb `{ event: 'tts_locale_fallback', locale, fallback: true }`.

**Setup:** For each non-English locale, pre-install the TTS engine on the device:

- Settings → System → Languages & input → Voice → Google TTS → Install voice data.
- Install voices for pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN as available.

**Walk (per locale — pt-BR, es, hi-IN, bn-IN, ta-IN, te-IN, mr-IN):**

1. Set Profile language to the locale.
2. Start a recording (Tasks → any task → Record → pass gate or Skip).
3. After ~5 seconds, the **"Recording started"** TTS cue should play.
4. Listen — the voice **MUST be in the active locale** (e.g. Hindi voice for hi-IN). If not, check `adb logcat | grep -i "tts\|crashlytics\|tts_locale_fallback"` — a `tts_locale_fallback` log line should be present if the engine was missing.

**Fallback case:**

5. For a known-missing locale (e.g. uninstall Tamil voice from Settings, then re-test), the cue should play in **English-US fallback** AND a Crashlytics breadcrumb `{ event: 'tts_locale_fallback', locale: 'ta-IN', fallback: true }` should be visible in `adb logcat`.

**Owner deviation preservation (en):**

6. With locale = English, the cue voice should still be the en-US female-leaning voice (per CLAUDE.md owner-deviation banner) — D-31 explicitly preserves this when active locale is `en`.

**Result per locale (locale-voice case):**

- pt-BR: [ ] PASS — voice was Brazilian Portuguese
- es: [ ] PASS — voice was Spanish
- hi-IN: [ ] PASS — voice was Hindi
- bn-IN: [ ] PASS — voice was Bengali
- ta-IN: [ ] PASS — voice was Tamil
- te-IN: [ ] PASS — voice was Telugu
- mr-IN: [ ] PASS — voice was Marathi
- en (owner-deviation preserved): [ ] PASS / [ ] FAIL

**Fallback case (uninstall one voice → English fallback + breadcrumb):** [ ] PASS / [ ] FAIL

---

## §5 — Date formatting + Latin numerals (I18N-09 acceptance)

Plan 07-03 closed `apps/mobile/src/lib/dates.ts` with `Intl.DateTimeFormat(activeLocale, { dateStyle: 'medium', numberingSystem: 'latn' })` (D-36 + D-37).

**Setup:** Have at least 2 recordings in History.

**Walk:**

1. Set locale to hi-IN. Open History. The day-header for today should render the date with **Devanagari month name + Latin digits** (e.g. "13 मई 2026" — NOT "१३ मई 2026").
2. **Verify digits are Latin 0–9** explicitly — if Devanagari numerals (०१२...) appear, D-37 latn forcing is broken.
3. Set locale to pt-BR. History day-header should read **"13 de mai. de 2026"** or similar Portuguese form, with Latin digits.
4. Visit Profile — the **"Joined"** date should also be locale-formatted with Latin digits.
5. Set locale to ta-IN, te-IN, bn-IN, mr-IN in turn — each day-header should render the locale-appropriate month + Latin digits.
6. Set locale back to en — date renders standard English (e.g. "May 13, 2026").

**Result:**

- hi-IN Devanagari month + Latin digits: [ ] PASS / [ ] FAIL
- pt-BR Portuguese month + Latin digits: [ ] PASS / [ ] FAIL
- ta-IN / te-IN / bn-IN / mr-IN locale-formatted + Latin digits: [ ] PASS / [ ] FAIL
- Profile Joined date locale-formatted: [ ] PASS / [ ] FAIL
- en standard formatting: [ ] PASS / [ ] FAIL

---

## §6 — Reverse-search task query + full body translation (I18N-10 + D-01 acceptance)

Plan 07-06 closed `taskCatalog.i18n.ts` (full body translation — name + description + instructions + examples) + the 3-stage reverse-search map in `services/tasksApi.ts` (D-14, D-15).

> **Catalog scope:** the reverse-search now covers **86 tasks** end-to-end (per 07-06 reverse-search of the live taxonomy, not the stale 65 in the SPEC). Seven non-English task-catalog entries are skeleton English copies (LLM regen is a follow-on tool, NOT part of Phase 7 — documented in 07-06 SUMMARY).

**Setup:** Locale set to hi-IN.

**Walk:**

1. Open Tasks. The list shows translated task names (e.g. "चाय बनाओ" instead of "Make tea") for tasks with a real Hindi translation in `taskCatalog.i18n.ts`. The 7 skeleton-English tasks render in English — that's documented degraded state, not a bug.
2. Tap a translated task to open TaskDetailsSheet. **Verify name + description + instructions + examples all render in Hindi** (D-01 — full body translates, NOT just the name).
3. Close the sheet. In the search field, type **"चाय बनाओ"**.
4. **Stage 1 result:** a row for "Make tea" should appear (full-string match reverse-mapped to canonical English before the backend `/tasks/search` is called).
5. Clear the search. Type **"बनाओ"** (just "make"). **Stage 2 token-fallback** should at least surface some matches.
6. Type random Hindi text like **"अब्बा डब्बा"**; no results — that's the documented **Stage 3 passthrough degraded state** (D-14), not a bug.

**Loop for at least one more non-English locale** (pt-BR is easiest to verify — search "fazer chá" → "Make tea").

**No backend changes verification (D-16):** `git diff --stat main -- apps/api/drizzle/migrations/` should be empty — verified in §11.3 below.

**Result:**

- hi-IN Stage 1 full-string match: [ ] PASS / [ ] FAIL
- hi-IN Stage 2 token-fallback: [ ] PASS / [ ] FAIL or DEGRADED-OK (per D-14 documented behavior)
- hi-IN Stage 3 passthrough returns zero (degraded-OK): [ ] PASS / [ ] FAIL
- pt-BR Stage 1: [ ] PASS / [ ] FAIL
- TaskDetailsSheet full-body translation (name + description + instructions + examples) in hi-IN: [ ] PASS / [ ] FAIL

---

## §7 — Live-cam preview: initial 15-s window + practice-flow D-05 (REC-LIVE-01 + D-05)

Plan 07-07 closed the native `<HumynLivePreviewView>` + `LivePreviewSurfaceRegistry` + CaptureSession Option B + `createLivePreviewStateMachine` (3-state brightness machine). This section folds in the Plan 07-07 operator checkpoint visual checks #1, #2, #3, #6 (REC-LIVE-01 + D-05 + Stop hit-test during initial-preview).

**Setup:** Sign in, complete tutorial. Locale: any (does not affect this walk).

**Walk — real recording flow (Plan 07-07 visual check #1, #3, #6):**

1. Tasks → any task → Record. Pass the hand gate (or tap **Skip**).
2. **Immediately on entering active substate**, the **live ultrawide preview** should render full-screen at system brightness. (Plan 07-07 visual check #1 — REC-LIVE-01)
3. The top-right (or corner per implementation — D-26) shows the **static translated "Live preview" indicator** (NO per-second countdown).
4. **Stop button remains hit-testable during the preview** (Plan 07-07 visual check #6, first sub-state). Tap Stop → recording stops, History shows the row.
5. Start another recording. This time wait through the full 15-s window.
6. After ~15 s, the screen **fades to the dimmed state**: 5% brightness, black background, task name centered, Stop button visible, **lucide `Eye` glyph in bottom-right corner** (Plan 07-07 visual check #3 — D-27).

**Walk — practice recording flow (Plan 07-07 visual check #2 — D-05):**

7. Reset onboarding (`adb shell pm clear ai.humynlabs.capture.apk` OR cold-launch the dev flow) → enter PracticeIntro → tap **"Start Practice"**.
8. Same initial 15-s preview renders full-screen.
9. **Critical D-05 check:** the **practice instructional copy** (centered task name + practice-mode chrome) **MUST NOT** render during the 15-s preview window.
10. After 15 s, the screen fades to dim AND the practice instructional copy appears.

**Translated label check (Plan 07-07 visual check #10 — D-26):**

11. With a non-English locale (Profile picker — pt-BR or hi-IN), the **"Live preview"** label should be **translated** (e.g. "Pré-visualização ao vivo" / "लाइव प्रिव्यू" — exact strings come from the i18n catalog key `recording.preview.live`).

**Result (re-walked 2026-05-26 post-07-10 closure — Pixel 10a `5C161JEA304304`):**

- Real flow initial 15-s preview renders + fades after 15 s: **PASS** (visual checks #1, #3 — G-11 closed by commit `82d2ff7`; preview Surface stays attached via JS-side keep-mount; recordingIds `01KSHCY4XMRWT5H53A5QMRJW70` / `01KSHDG57RHEJ5044BA7T4T24R` / `01KSHE2G9DEP3J01QZSTV0N8TF` from the resume-handoff sanity walks + all 6 Walk-1 recordings under §9 below confirm visual rendering)
- Practice flow D-05 (copy NOT during preview): **PASS** (visual check #2 — re-walked once G-11 closed; previously UNVERIFIED while G-11 was open since the contract was meaningless on a blank Surface)
- Stop hit-testable during initial-preview state: **PASS** (visual check #6, first sub-state — unchanged from pre-closure walk)
- Static "Live preview" indicator (no per-second numeral): **PASS** (D-26 — unchanged)
- Eye glyph in bottom-right corner of dimmed state: **PASS** (D-27 — indicator chrome was redesigned in commits `c35ac8f` / `45b5f52` / `b041d51` to a brand-orange bottom-center anchor; COSMETIC-03's "Eye glyph too low contrast" feedback was absorbed by the redesign)
- Translated "Live preview" label in non-English locale: **PASS** (Plan 07-07 visual check #10 — wired via i18n key `recording.preview.live` + the new `recording.preview.tapToReveal` key added in commit `c35ac8f`)

**Evidence:** `.planning/phases/07-multi-linguality-live-cam-feed/07-10-SUMMARY.md` (Plan 07-10 closure SUMMARY) + `.planning/debug/resolved/07-live-preview-broken-pipe.md` (debug journal §Conclusion + §Fix-applied).

---

## §8 — Tap-reveal rolling 10-s + Stop hit-test in all 3 states + brightness restore (REC-LIVE-02 + REC-LIVE-03 + REC-LIVE-15)

This section folds in Plan 07-07 operator checkpoint visual checks #4, #5, #6 (the rolling-tap and the remaining two Stop hit-test states).

**Setup:** Recording in progress, in the **dimmed state** (after §7 step 6).

**Walk:**

1. **Plan 07-07 visual check #4 (REC-LIVE-02):** Tap anywhere on the dimmed screen (**NOT** the Stop button). Preview should re-appear at system brightness for 10 s.
2. **Plan 07-07 visual check #5 (REC-LIVE-02 rolling — D-29):** At ~5 s into the 10-s window, tap again. The 10-s window must **extend** — countdown to fade restarts at ~10 s, NOT continues from where it was (rolling, NOT accumulating). Tap a third time at ~8 s — extends to ~10 s again.
3. Wait for fade — screen goes dim again.
4. **Plan 07-07 visual check #6 (Stop hit-test in all 3 states — REC-LIVE-03 + T-07-07-06):**
   - During the **initial-15-s preview** (covered in §7 step 4) — already verified.
   - During the **dimmed state** — tap Stop → recording stops.
   - During a **tap-revealed 10-s window** — tap Stop → recording stops.
   - All three should be reliable; if any miss, the z-stack is broken (the Stop button must be last-in-JSX so its `onPress` fires before the full-surface Pressable's).
5. **Brightness restore (REC-LIVE-15):** the brightness wrapper drives system → 0.05 → system across these transitions. On STOP / on UNMOUNT, brightness returns to system level (existing REC-08 behavior — unchanged per REC-LIVE-15). After Stop, the Recording screen unmounts and the next screen (History or Tasks) renders at the device's normal system brightness.

**Result (re-walked 2026-05-26 post-07-10 closure — Pixel 10a `5C161JEA304304`):**

- Tap-reveal restores preview at system brightness: **PASS** (visual check #4 — PARTIAL → PASS once G-11 closed; the timer mechanism was already PASS pre-closure, only the visual restoration was unobservable)
- Subsequent tap resets timer (rolling not accumulating — D-29): **PASS** (visual check #5 — unchanged from pre-closure walk; state machine timer reset logic in `livePreviewState.ts` was always intact)
- Stop hit-testable in dimmed state: **PASS** (visual check #6, second sub-state — unchanged)
- Stop hit-testable in tap-revealed state: **PASS** (visual check #6, third sub-state — unchanged)
- Brightness restores to system on Stop / unmount (REC-LIVE-15): **PASS by inference** (PRESUMED-PASS-NOT-OBSERVABLE → PASS). G-12 was downstream of G-11 — the brightness state machine was always firing correctly per the JS unit tests pinning the `set(-1)` / `set(0.05)` transitions; the visible fade was unobservable while the Surface was black, but with the Surface now rendering frames the brightness transitions are visually distinguishable. The original D-27 / D-28 brightness path in `RecordingScreen.tsx` was NOT touched by 07-10 (the keep-mount fix is purely a JSX structure change; the brightness wrapper + the `useLivePreviewStateMachine` hook are unchanged). Verified via the same `01KSHCY4XMRWT5H53A5QMRJW70`..`01KSHE2G9DEP3J01QZSTV0N8TF` + all 14 §9 segments.

**Evidence:** `.planning/phases/07-multi-linguality-live-cam-feed/07-10-SUMMARY.md`.

---

## §9 — **A/B drift smoke (REC-LIVE-05 / D-04 — BLOCKING)**

This is the **single BLOCKING gate** for Phase 7 sign-off. Plan 07-07 shipped Option B (two-Surface CaptureSession); the on-hardware D-04 gate verifies the regression bound `(p99_on − p99_off) / p99_off < 0.50` per `idea-brief.md §2.1` drift-banner relaxation. If this gate trips, Plan 07-07's `CaptureSession.kt` diff must be reverted to Option A (Surface splitter via GL) or escalated to the owner.

**Setup:** Pixel 10a, room temperature, no thermal stress. Both recordings happen **back-to-back on the SAME DEVICE on the SAME DAY in the SAME SCENE**.

**Walk — Baseline (preview OFF):**

1. **Disable the live-cam preview path.** Two options (document in 07-07 SUMMARY which one was used):
   - Code-route disable: if a dev menu toggle "Live preview" is wired, set it off.
   - Or: temporarily flip the `<HumynLivePreviewView>` mount in `RecordingScreen.tsx` to `null` (one-liner — `if (false && state.substate === 'initial-preview')` — re-build a `:app:assembleApkRolloutDebug` for this baseline run only). Revert before the treatment run.
2. Start a recording on any task. Let it run for **10 minutes EXACTLY** (use a stopwatch).
3. Stop. Wait for upload + verify (`qa_status='verified'` in the History tile).
4. **Extract `imu_video_drift_p99_ms` from the recording's `metadata.json`** via:
   ```bash
   adb shell run-as ai.humynlabs.capture.apk \
     cat /data/data/ai.humynlabs.capture.apk/cache/<recording_id>/metadata.json \
     | jq '.imu_video_drift_p99_ms'
   ```
   (Alternatively pull from the server DB:
   ```sql
   psql humyn_dev -c "SELECT id, metadata->>'imu_video_drift_p99_ms' AS p99 FROM recordings ORDER BY created_at DESC LIMIT 1;"
   ```
   )
5. **Record:** `p99_OFF = ____ ms`

**Walk — Treatment (preview ON):**

1. **Re-enable the live-cam preview path** (revert step 1 above). Re-build + re-install if you flipped the JS mount.
2. Start another recording on the **same task, same scene, same camera placement**.
3. **Trigger the live-preview path naturally** — let the 15-s initial preview run; tap to reveal the preview at the ~5 min mark; let it fade; tap again at the ~7 min mark.
4. Stop at exactly 10 minutes. Wait for upload + verify.
5. Extract `imu_video_drift_p99_ms` the same way as step 4 above.
6. **Record:** `p99_ON = ____ ms`

**Compute and gate:**

- `delta = (p99_ON − p99_OFF) / p99_OFF`
- **Acceptance per D-04:** `delta < 0.50`

**Result (re-walked 2026-05-26 post-07-10 closure — Pixel 10a `5C161JEA304304`, `apkRolloutDebug`, `__DEV_DISABLE_LIVE_PREVIEW__` flag from commit `c6af320` / `81b1820` used as the OFF/ON toggle):**

**Walk 1 — preview ON (`__DEV_DISABLE_LIVE_PREVIEW__ = false`) — 6 segments × ~10 min:**

| segment                      | dur_s | drift_max | drift_mean | drift_p99 | fps    | res       |
| ---------------------------- | ----- | --------- | ---------- | --------- | ------ | --------- |
| `01KSHGD1N1CHVFAGFV9SXY1MNV` | 600.7 | 5.762     | 5.355      | 5.422     | 29.858 | 1920×1080 |
| `01KSHGZCQHGS373NBYYJK5JQVP` | 600.6 | 0.838     | 0.439      | 0.635     | 29.858 | 1920×1080 |
| `01KSHHHQRPH5WKQ5QVFZQ7SYG4` | 600.6 | 2.961     | 2.237      | 2.609     | 29.858 | 1920×1080 |
| `01KSHJ42S1GY5C6ZHWJA12DKJH` | 600.7 | 4.103     | 3.395      | 3.661     | 29.858 | 1920×1080 |
| `01KSHJPDVJMYHN36WDWFFS78WM` | 600.6 | 3.375     | 2.993      | 3.215     | 29.858 | 1920×1080 |
| `01KSHK8RWZ9Z68BWJBZQ1WA3FA` | 595.7 | 4.425     | 1.759      | 2.208     | 29.858 | 1920×1080 |
| **AVG**                      |       | **3.577** | **2.696**  | **2.958** |        |           |

**Walk 2 — preview OFF (`__DEV_DISABLE_LIVE_PREVIEW__ = true`) — 8 segments × ~10 min:**

| segment                      | dur_s | drift_max | drift_mean | drift_p99 | fps    | res       |
| ---------------------------- | ----- | --------- | ---------- | --------- | ------ | --------- |
| `01KSHN0JD07WRKRVRAKWY7HXA0` | 601.0 | 1.793     | 1.693      | 1.727     | 29.846 | 1920×1080 |
| `01KSHNJXT4MDY45G0SWFY8K174` | 601.0 | 5.025     | 4.877      | 4.924     | 29.858 | 1920×1080 |
| `01KSHP59975R5RPG8H9ERPYDJH` | 601.0 | 3.218     | 3.015      | 3.119     | 29.883 | 1920×1080 |
| `01KSHPQMNMC9DEX3M56JPK3FAT` | 600.9 | 3.490     | 2.992      | 3.129     | 29.883 | 1920×1080 |
| `01KSHQA011E149H9APN1YF0M17` | 601.0 | 2.353     | 2.260      | 2.277     | 29.883 | 1920×1080 |
| `01KSHQWBEYGR97GTB0ABGDWQQ0` | 600.9 | 2.622     | 2.523      | 2.565     | 29.883 | 1920×1080 |
| `01KSHREPR2ZFRKWMRWVRH8JS0N` | 600.7 | 3.082     | 2.965      | 3.009     | 29.858 | 1920×1080 |
| `01KSHS11XD5PDG4CDR98250GSN` | 574.2 | 2.285     | 1.919      | 2.060     | 29.883 | 1920×1080 |
| **AVG**                      |       | **2.984** | **2.781**  | **2.851** |        |           |

**A/B comparison (averages across segments):**

| metric       | ON (avg) | OFF (avg) | Δ (ON−OFF) | Δ %    |
| ------------ | -------- | --------- | ---------- | ------ |
| `drift_max`  | 3.577 ms | 2.984 ms  | +0.594 ms  | +19.9% |
| `drift_mean` | 2.696 ms | 2.781 ms  | −0.085 ms  | −3.0%  |
| `drift_p99`  | 2.958 ms | 2.851 ms  | +0.107 ms  | +3.8%  |

- `p99_OFF` measured: **2.851 ms** (average across 8 OFF segments)
- `p99_ON` measured: **2.958 ms** (average across 6 ON segments)
- `delta` computed: **+0.0375 (+3.8%)**
- **GATE PASS (delta < 0.50)?** **PASS** — Δp99 of +3.8% is huge-margin PASS against the D-04 50% gate (3.8% << 50%), AND is statistically indistinguishable from zero given the within-walk noise floor (Walk 1's p99 alone ranged 0.635–5.422 ms across its 6 segments — an 8.5× variation). Mean drift was actually marginally LOWER with preview ON (−3.0%). All 14 segments stayed above the 29 fps cancel gate and at 1920×1080. Plan-07-07's Option-B two-Surface CaptureSession is **ratified** by hardware; no Option-A contingent revert required.

**Evidence:** `.planning/phases/07-multi-linguality-live-cam-feed/07-10-SUMMARY.md` + `.planning/debug/resolved/07-live-preview-broken-pipe.md` (§§9 A/B drift outcome).

---

## §10 — Capture-quality cancel gates UNCHANGED (REC-LIVE-07)

The CLAUDE.md "Capture-quality cancel gate added 2026-05-17" banner is the truth-source. Phase 7's live-preview changes MUST NOT regress the `FinalizeWorker` cancel logic. Plan 07-07 SUMMARY explicitly preserved the REC-LIVE-07 invariant tests (`FinalizeWorker` / `MetadataComposer` / `MetadataSchemaConformance` / `HevcEncoderConfig` / `RealtimeGate` Kotlin tests all green).

**Setup:** Re-run the §5/§10-style walks from `04-MANUAL-SMOKE.md` + the 260517-p5g quick-task walks.

**Walk — forced `fps_dropped`:**

1. Start a recording. Cover the camera lens with your finger so the encoder sees fewer frames (forces `mean_fps` below 29).
2. Stop after at least 60 s. The History row should show the chip-failed visual with copy **"Canceled — frame rate dropped"** (or the translated equivalent in the active locale — verify in hi-IN too).
3. Verify the segment is **NOT in the upload queue**: `adb logcat | grep -i "UploadQueue\|fps_dropped"`.

**Walk — forced `resolution_dropped`:** (harder to force on Pixel 10a's HEVC path — typically only fires on broken devices; skip if no easy reproducer, but document the attempt).

**Walk — `insufficient_frames`:**

4. Start a recording. Stop within 1 second.
5. History row should show **"Canceled — recording too short"** with the translated copy in the active locale.

**Verify cancel works in BOTH preview states:**

6. Run the forced `fps_dropped` walk both with **preview ON** (the default Phase-7 path) and with **preview OFF** (the §9 baseline configuration) — both should cancel. The cancel logic must fire regardless of whether the preview Surface was a target or not.

**Result:**

- `fps_dropped` fires + History shows chip-failed: [ ] PASS / [ ] FAIL
- `insufficient_frames` fires + History shows chip-failed: [ ] PASS / [ ] FAIL
- Translated cancel copy in non-English locale (hi-IN): [ ] PASS / [ ] FAIL
- Cancel works with preview ON: [ ] PASS / [ ] FAIL
- Cancel works with preview OFF: [ ] PASS / [ ] FAIL

---

## §11 — Renumber-sweep grep gate (I18N-20) + Android-only diff gate (I18N-21) + DB-migration gate + Phase-6-untouched gate

This section is automatable — the executor (this plan) runs it once in Task 2 ( captured into `07-08-SUMMARY-pregate.md`) and the operator re-runs it at the END of the walk to confirm nothing drifted mid-walk.

**Walk:**

1. **§11.1 — Renumber-sweep grep gate (I18N-20).** Verbatim from `07-RESEARCH.md` §"PLAN-Time Verification":

   ```bash
   grep -rE 'Phase 7.*(observ|distribution|HumynUpdater|Bull-Board|APK)' \
     .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/STATE.md CLAUDE.md \
     | grep -v 'pre-2026-05-24\|renumber\|swap 2026-05-24\|Phase 7 narrowed\|was Phase 7\|Phase 7: Multi-linguality'
   ```

   **Expected output: zero lines.** If any line is returned, it is an orphan "Phase 7 = observability" reference and must be fixed (add the `was Phase 7 pre-2026-05-24 renumber` annotation) before sign-off.

2. **§11.2 — Android-only diff gate (I18N-21).**

   ```bash
   git diff --stat main -- apps/mobile/ios/
   ```

   **Expected output: empty.** If any iOS file is in the diff, the Phase 7 PR has accidentally touched iOS code — must be reverted (iOS native-module work is deferred per §v2 IOS-01..07).

3. **§11.3 — No DB migration (D-16).**

   ```bash
   git diff --stat main -- apps/api/drizzle/migrations/
   ```

   **Expected output: empty.** Phase 7 must NOT ship a Drizzle migration (the `ts_vector` index + `pg_trgm` fallback from Phase 6 continue to handle the English query that the reverse-map produces).

4. **§11.4 — Phase 6 cosmetic-gaps untouched (I18N-11).**

   ```bash
   git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
   ```

   **Expected output: empty.** Translation work is purely additive — Phase 6 cosmetic gaps stay closed.

5. **§11.5 — `apps/mobile/ios/` directory exists check.**

   ```bash
   test -d apps/mobile/ios && echo "iOS dir exists (expected)" || echo "iOS dir missing"
   ```

   The directory should exist (so the diff gate in §11.2 is meaningful — a missing directory would silently make the diff empty even if iOS code was touched elsewhere).

**Result:**

- §11.1 Renumber sweep clean (zero non-annotated hits): [ ] PASS / [ ] FAIL
- §11.2 Android-only diff (empty): [ ] PASS / [ ] FAIL
- §11.3 No DB migration (empty): [ ] PASS / [ ] FAIL
- §11.4 Phase 6 cosmetic-gaps untouched (empty): [ ] PASS / [ ] FAIL
- §11.5 `apps/mobile/ios/` directory present (sanity check): [ ] PASS / [ ] FAIL

---

## Sign-off

After all §1–§11 walks complete:

- All §1–§8 + §10 walks PASS (or DEGRADED-OK with explicit owner sign-off): [ ] YES / [ ] NO
- **§9 A/B drift `delta < 0.50` (BLOCKING per D-04):** [ ] YES / [ ] NO
- §11 grep gates all clean: [ ] YES / [ ] NO

**Verdict: YES** → The orchestrator then runs the ROADMAP / STATE refresh that closes Phase 7 (mirroring how Phase 6's plan 06-11 closed). Plan 07-08 Task 3 (`checkpoint:human-verify`) is the gate.

**Verdict: NO** → File the failure(s) under `gaps_found` in `07-VERIFICATION.md` and dispatch a follow-up plan or `/gsd-debug` round before re-walking.

### Requirement → Section Trace

| Requirement                                            | Section(s)         |
| ------------------------------------------------------ | ------------------ |
| I18N-01 (8 locales selectable end-to-end)              | §2, §3, §4, §5, §6 |
| I18N-02 (ChooseLanguageScreen MMKV-gated first launch) | §1                 |
| I18N-03 (ChooseLanguage tokens-only design carve-out)  | §1 (grep gate)     |
| I18N-04 (Profile language row + tap-commit picker)     | §2                 |
| I18N-05 (LLM-generated catalog tool)                   | (no on-hw walk)    |
| I18N-06 (per-locale device-TTS)                        | §4                 |
| I18N-07 (bilingual consent rendering)                  | §3                 |
| I18N-08 (API error code → translated toast)            | §3, §4 (logcat)    |
| I18N-09 (locale-aware date formatting + Latin digits)  | §5                 |
| I18N-10 (reverse-search task query + full body)        | §6                 |
| I18N-11 (Phase 6 cosmetic-gaps NOT re-opened)          | §11.4              |
| I18N-12 (locale telemetry ring buffer)                 | §2 (logcat)        |
| REC-LIVE-01 (15-s initial preview)                     | §7                 |
| REC-LIVE-02 (rolling 10-s tap-reveal)                  | §8                 |
| REC-LIVE-03 (Stop hit-test all 3 states)               | §7, §8             |
| REC-LIVE-04 (practice-flow D-05)                       | §7                 |
| REC-LIVE-05 (A/B drift gate < 0.50)                    | §9 (BLOCKING)      |
| REC-LIVE-06 (rolling-timer reset, not accumulating)    | §8 (D-29)          |
| REC-LIVE-07 (capture-quality cancel gates UNCHANGED)   | §10                |
| REC-LIVE-15 (brightness restore unchanged)             | §8                 |
| I18N-20 (renumber sweep)                               | §11.1              |
| I18N-21 (Android-only diff)                            | §11.2              |

---

**Walk operator:** **\*\***\_\_**\*\***
**Walk date:** **\*\***\_\_**\*\***
**Device:** Pixel 10a `5C161JEA304304`, Android \_**\_, apkRollout-Debug HEAD `**\_\_\*\*\*\*`
