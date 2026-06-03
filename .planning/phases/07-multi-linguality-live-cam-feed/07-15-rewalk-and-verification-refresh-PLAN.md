---
phase: 07-multi-linguality-live-cam-feed
plan: 15
type: execute
wave: 3
depends_on: [10, 11, 12, 13, 14]
files_modified:
  - .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md
  - .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
  - .planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
autonomous: false
gap_closure: true
requirements:
  [
    I18N-01,
    I18N-02,
    I18N-03,
    I18N-04,
    I18N-05,
    I18N-06,
    I18N-07,
    I18N-08,
    I18N-09,
    I18N-10,
    I18N-11,
    I18N-12,
    I18N-20,
    I18N-21,
    REC-LIVE-01,
    REC-LIVE-02,
    REC-LIVE-03,
    REC-LIVE-04,
    REC-LIVE-05,
    REC-LIVE-06,
    REC-LIVE-07,
  ]
tags: [smoke, sign-off, verification, gap-closure, mobile, rewalk]
must_haves:
  truths:
    - "Pixel-10a operator re-walks every previously-FAIL'd, PARTIAL, BLOCKED, and PENDING section of 07-MANUAL-SMOKE.md (§2 full per-locale loop, §3 dual-render visual, §4 TTS voice-vs-text, §6 reverse-search with translated catalog, §7 + §8 visual rendering, §9 A/B drift confirmation, §10 cancel-gate cancel-with-preview-ON walk) and records PASS/FAIL row-by-row in 07-MANUAL-SMOKE.md."
    - '07-HUMAN-UAT.md is appended with a fresh `## Re-walk 2026-XX-XX` block that captures the re-walk verdicts; the original `## Gaps` block stays intact as historical evidence.'
    - '07-VERIFICATION.md is updated to reflect the new posture: gaps_closed lists G-02..G-12 + COSMETIC-01..03; gaps_remaining is empty (or explicitly lists any owner-deferred items with rationale); status flips to `verified` if all walks PASS, or back to `gaps_found` with new entries if any walk FAILs.'
    - "ROADMAP.md Phase 7 entry is marked COMPLETE with sign-off date and a brief summary line referencing this plan IF AND ONLY IF the operator's re-walk produces all-PASS verdicts AND the §9 A/B drift gate passes (D-04 — `delta < 0.50`)."
    - 'STATE.md is updated to advance the current-phase pointer past Phase 7 if and only if ROADMAP.md is marked COMPLETE; otherwise STATE.md captures the new gap inventory.'
    - 'All `pnpm -r --parallel test --filter "@humyn/mobile"` + `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest` runs exit 0 after the cluster lands (regression check across plans 07-10..07-14).'
    - 'All Phase-7 invariant gates green: iOS untouched (I18N-21), no DB migration (D-16), Phase-6 cosmetics untouched (I18N-11), ultrawide lens code untouched, HevcEncoder / FinalizeWorker / MetadataComposer untouched, the existing 07-01..07-09 plan SUMMARYs untouched.'
  artifacts:
    - path: .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md
      provides: 'Re-walked runbook with updated PASS/FAIL evidence per row + `re_walked_on: 2026-XX-XX` frontmatter field + a fresh sign-off block'
      contains: 're_walked_on'
    - path: .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
      provides: 'Re-walk verdict block appended; original gaps block intact; gaps_closed annotations per row'
      contains: 'Re-walk 2026'
    - path: .planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md
      provides: 'Fresh verification snapshot with status flipped (`verified` or `gaps_found`); gaps_closed list expanded; gaps_remaining current'
      contains: 'gaps_closed'
    - path: .planning/ROADMAP.md
      provides: 'Phase 7 marked COMPLETE (conditional on all-PASS)'
      contains: 'Phase 7'
    - path: .planning/STATE.md
      provides: 'Current-phase pointer advanced (conditional on all-PASS)'
      contains: 'Current'
  key_links:
    - from: .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md
      to: .planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md
      via: 'Operator-recorded PASS verdicts in §1..§11 → gaps_closed list in verification snapshot'
      pattern: 'PASS'
    - from: .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
      to: .planning/ROADMAP.md
      via: 'All gaps closed → ROADMAP Phase 7 COMPLETE'
      pattern: 'Phase 7'
---

<objective>
The terminal plan in the Phase-7 gap-closure cluster. With plans 07-10 (native live preview) + 07-11 (i18n sweep extension) + 07-12 (taskCatalog body) + 07-13 (Help Center body) + 07-14 (cosmetic cleanup) all landed at code level, this plan is the operator-walked **hardware re-walk** that converts code-level closure into runtime-confirmed closure. The terminal artifact is an updated `07-VERIFICATION.md` with status flipped (ideally to `verified`; possibly back to `gaps_found` with new entries if a walk surfaces fresh issues).

**Three tasks:**

1. **Pre-walk readiness check.** Confirm all 5 dependent plans (07-10..07-14) have shipped SUMMARYs, all JS + Kotlin tests are green, the APK build is fresh, and the invariant gates are all green from a single `git diff --stat` snapshot.
2. **Pixel-10a operator re-walk.** The operator re-walks the runbook sections that had FAIL / PARTIAL / BLOCKED / PENDING verdicts in `07-HUMAN-UAT.md`: §2 (full per-locale loop — all 7 non-en locales), §3 (dual-render visual on hardware), §4 (TTS voice-vs-text in hi-IN), §6 (reverse-search with translated catalog), §7 + §8 (live preview visual rendering, post-G-11 closure), §10 with-preview-ON (cancel-gate cancel-while-preview-engaged walk). §9 was the BLOCKING A/B drift gate; plan 07-10 Task 3 already walked it as part of its terminal acceptance — this plan **re-affirms** that verdict with a fresh `psql humyn_dev` extract (in case more recordings have been made since).
3. **Verification refresh + roadmap update.** Update `07-VERIFICATION.md` with the re-walk snapshot. If all PASS: advance ROADMAP.md + STATE.md to close Phase 7. If any FAIL: file the failure under a new `## Re-walk 2026-XX-XX` block in `07-HUMAN-UAT.md` ## Gaps and dispatch (a) a new plan IF the gap is novel, OR (b) re-route to an existing plan IF the gap is a regression.

**Non-negotiable invariants:**

- This plan modifies ONLY planning documents (`07-MANUAL-SMOKE.md`, `07-HUMAN-UAT.md`, `07-VERIFICATION.md`, `ROADMAP.md`, `STATE.md`). **No source-code modifications.**
- `git diff --stat apps/` MUST remain empty during this plan's execution.
- The existing 07-01..07-09 plan SUMMARYs MUST remain UNCHANGED.
- iOS untouched, no DB migration, Phase-6 cosmetics untouched.

Output: a Phase 7 that's either marked COMPLETE in ROADMAP.md (best case) or has a clean fresh gap list for the next planning pass (worst case). No middle-ground silence.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-SPEC.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-CONTEXT.md
@.planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md
@CLAUDE.md

<interfaces>
<!-- Shapes the executor must respect. -->

From .planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md (current frontmatter):

```yaml
status: human_needed
score: 5/5 must-haves code-verified (...)
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  previous_verification_commit: 37d8645
  gaps_closed:
    - 'WR-01 — ProfileScreen.tsx + DeleteAccountModal.tsx i18n sweep incomplete (closed by plan 07-09 + CR-01 inline follow-up fix in commit 81d4dfe)'
  gaps_remaining: []
  ...
```

After this plan (best case — all-PASS):

```yaml
status: verified
score: 5/5 must-haves verified on hardware
re_verification:
  previous_status: human_needed
  previous_score: 5/5 must-haves code-verified
  previous_verification_commit: {hash from plan-09 commit}
  gaps_closed:
    - 'G-02..G-10 — i18n sweep extension + taskCatalog body + Help Center body closed by plans 07-11/07-12/07-13'
    - 'G-11 + G-12 — live-preview Surface rendering closed by plan 07-10'
    - 'COSMETIC-01..03 — Signup centering + Live-preview label z-stack + Eye glyph contrast closed by plan 07-14'
  gaps_remaining: []
  ...
```

After this plan (worst case — new gaps surface):

```yaml
status: gaps_found
score: 5/5 must-haves code-verified; X must-haves blocked on operator re-walk failures
re_verification:
  previous_status: human_needed
  previous_score: 5/5 must-haves code-verified
  previous_verification_commit: {hash}
  gaps_closed: [...]
  gaps_remaining:
    - 'G-XX — {description from re-walk}'
  ...
```

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pre-walk readiness — confirm dependent plans landed cleanly, run full regression test, validate invariants</name>
  <files>.planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-10-SUMMARY.md (live-preview surgical fix verdict + §9 A/B drift outcome)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-11-SUMMARY.md (i18n sweep extension result)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-12-SUMMARY.md (taskCatalog body translation result)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-13-SUMMARY.md (Help Center body translation result)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-14-SUMMARY.md (cosmetic cleanup result)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-COSMETIC-GAPS.md (confirm status: closed)
  </read_first>
  <behavior>
    - Verify all 5 SUMMARYs exist + contain the expected closure annotations.
    - Run the full JS + Kotlin regression test suite to catch any cross-plan integration issues.
    - Build a fresh APK and pin its commit hash for the operator's re-walk.
    - Run all four invariant grep gates one more time.
    - Update `07-MANUAL-SMOKE.md` frontmatter `re_walked_on: 2026-XX-XX` + write a new pre-walk readiness block at the top that captures the APK commit hash + the test verdict + the cluster's plan inventory.
    - Do NOT modify any source code in this task. The output is purely a fresh APK + a pre-walk readiness annotation in the smoke runbook.
  </behavior>
  <action>
1. **Confirm 5 SUMMARYs exist:**

```bash
for n in 10 11 12 13 14; do
  test -f ".planning/phases/07-multi-linguality-live-cam-feed/07-${n}-SUMMARY.md" || echo "MISSING 07-${n}-SUMMARY.md"
done
```

Expected: no MISSING lines. If any plan's SUMMARY is missing, BLOCK — the prerequisite plan didn't complete cleanly; re-route to that plan's execute pass.

2. **Run the full JS test suite** (per memory `feedback_post_merge_test_env.md`):

   ```bash
   set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test 2>&1 | tail -40
   ```

   Exit 0. If FAIL, identify the failing test and either fix in a new plan OR back out the offending change. Likely sources: a cross-plan regression where 07-14's cosmetic JSX change broke a snapshot test from 07-07, or where 07-11's RecordingScreen edit collided with 07-14's RecordingScreen edit.

3. **Run the Kotlin unit test suite:**

   ```bash
   cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:testApkRolloutDebugUnitTest 2>&1 | tail -20
   ```

   Exit 0.

4. **Run the tools/ test suite:**

   ```bash
   cd tools && pnpm test 2>&1 | tail -15
   ```

   Exit 0.

5. **Run `pnpm i18n:validate`** to confirm the screen-string catalogs are still shape-parity:

   ```bash
   cd "$(git rev-parse --show-toplevel)" && pnpm i18n:validate 2>&1 | tail -10
   ```

   Exit 0.

6. **Build a fresh APK + capture the commit hash:**

   ```bash
   cd apps/mobile/android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleApkRolloutDebug 2>&1 | tail -10
   APK_COMMIT=$(git -C "$(git rev-parse --show-toplevel)" rev-parse HEAD)
   echo "Fresh APK commit: $APK_COMMIT"
   ```

   Expected: BUILD SUCCESSFUL.

7. **Run all 4 invariant grep gates:**

   ```bash
   # §11.2 — Android-only
   git diff --stat main -- apps/mobile/ios/
   # §11.3 — No DB migration
   git diff --stat main -- apps/api/drizzle/migrations/
   # §11.4 — Phase-6 cosmetic-gaps untouched
   git diff --stat main -- .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
   # CLAUDE.md banners — drift + cancel
   git diff --stat main -- apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
   ```

   All 4 should return empty.

8. **Update `07-MANUAL-SMOKE.md`** with a pre-walk readiness block. Add to the top (after the existing frontmatter):

   - In the frontmatter: change `re_walked_on: pending` to `re_walked_on: 2026-XX-XX` (the operator fills the actual date when they walk; Claude writes the placeholder + the commit-hash annotation).

   - Add a new `## Re-walk Pre-flight (2026-XX-XX)` section near the top with the cluster's plan inventory + the fresh APK commit hash + the regression test verdict:

   ```markdown
   ## Re-walk Pre-flight (2026-XX-XX)

   **Cluster:** plans 07-10..07-14 landed; SUMMARYs committed.
   **Fresh APK commit:** `{APK_COMMIT}`
   **Regression tests:** JS + Kotlin + tools/ all green.
   **Invariants:** iOS untouched / no DB migration / Phase-6 cosmetics untouched / HevcEncoder + FinalizeWorker + MetadataComposer untouched.
   **Catalog:** 8 screen-string locales shape-parity; 77×7 taskCatalog body translated; 7 Help Center sibling files committed.
   **Live preview:** plan 07-10 root cause = {H1|H2|H3|refinement}; §9 A/B drift verdict = {PASS delta=X.XX | FAIL → reverted Option A delta=X.XX}.

   ### Sections to re-walk

   - §2 — full per-locale loop (7 non-en locales) covering chrome + body translations
   - §3 — bilingual dual-render on hardware (pt-BR + hi-IN)
   - §4 — TTS voice-vs-text disambiguation in hi-IN
   - §6 — reverse-search with translated taskCatalog (Stage 1 + Stage 2)
   - §7 — live-preview visual rendering (initial 15 s + practice-flow D-05)
   - §8 — tap-reveal rolling + Stop hit-test across 3 states
   - §10 with-preview-ON — cancel-gate fires correctly when preview is engaged

   ### Sections NOT re-walked

   - §1 (already PASS) — no relevant changes since.
   - §5 (already PASS — Devanagari + Latin digits) — dates.ts unchanged.
   - §9 (re-walked as plan-07-10 Task 3 terminal acceptance) — verdict above.
   - §11 grep gates — re-run as part of Task 3 below (verification refresh).
   ```

     </action>
     <verify>
       <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test 2>&1 | tail -15</automated>
     </verify>
     <acceptance_criteria>
       - All 5 SUMMARYs (07-10..07-14) exist.
       - JS test suite exits 0.
       - Kotlin test suite exits 0.
       - tools/ test suite exits 0.
       - `pnpm i18n:validate` exits 0.
       - APK build BUILD SUCCESSFUL.
       - All 4 invariant grep gates return empty.
       - `07-MANUAL-SMOKE.md` frontmatter `re_walked_on` updated; pre-walk readiness block added.
       - `grep -c 'Re-walk Pre-flight' .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md` returns at least 1.
       - `git diff --stat apps/` empty in this task (no source-code changes).
     </acceptance_criteria>
     <done>Pre-walk readiness confirmed. Operator can proceed to Task 2 (the hardware re-walk).</done>
   </task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Pixel-10a operator re-walks §2 + §3 + §4 + §6 + §7 + §8 + §10 + §11 and records PASS/FAIL per row in 07-MANUAL-SMOKE.md</name>
  <what-built>
    Task 1 shipped a fresh `apkRolloutDebug` APK + a pre-walk readiness annotation in the smoke runbook. This task is the operator's actual hardware re-walk. The operator installs the APK on Pixel 10a, walks each of the previously-FAIL'd / PARTIAL / BLOCKED / PENDING sections, and updates the runbook in place with PASS/FAIL markings per row.

    **§2 — Full per-locale loop** (7 non-English locales × 3 sub-criteria each + telemetry check):
    - For each of pt-BR / es / hi-IN / bn-IN / ta-IN / te-IN / mr-IN: open Profile → tap Language row → tap the locale row → sheet auto-dismisses; Profile re-renders translated within 1 frame; force-stop + cold-launch preserves the locale.
    - **For each locale**, navigate Home → Tasks → History → Profile and confirm EVERY screen renders translated chrome (the operator only flags screens that visually fail — chrome translation is the closure target of plan 07-11).
    - **Open Tasks**: confirm task names render translated (plan 07-12 closure) and Task-Details-Sheet renders full body translation when opened.
    - **Open Help Center**: confirm article bodies render translated (plan 07-13 closure).
    - `adb logcat | grep -i "telemetryRing\|locale_changed"` shows a locale_changed event per locale change.

    **§3 — Bilingual dual-render visual on hardware** (pt-BR + hi-IN):
    - Sign out → re-route to Signup with locale=pt-BR. Confirm dual-render (translated top + English ~70% opacity below); tap Terms-of-Use → modal renders dual.
    - Repeat with locale=hi-IN.
    - With locale=en, confirm the underlay is SUPPRESSED (single-body render).
    - **COSMETIC-01 verification**: the consent paragraph is center-aligned in en (Plan 07-14 Task 1 — re-confirm).

    **§4 — TTS voice-vs-text in hi-IN**:
    - With hi-IN engine installed (Settings → System → Languages & Input → Voice → install Hindi voice if missing), start a recording. Listen at the "Recording started" cue.
    - **Disambiguation check**: was the audio Hindi text in a Hindi voice (PASS) OR Hindi text in an English voice (engine fallback — should also see a Crashlytics `tts_locale_fallback` breadcrumb in logcat) OR English text in an English voice (FAIL — plan 07-11 didn't wire the t() call correctly)?
    - Plan 07-11 wires `speakCue(t('recording.cue.started'))` at lines 414/425/657 — the TEXT is now translated; the VOICE is owned by ttsVoice.ts (plan 07-06's D-31 fallback chain). Both halves should be working post-cluster.

    **§6 — Reverse-search with translated taskCatalog**:
    - With locale=hi-IN, open Tasks. The task list now shows TRANSLATED task names (plan 07-12 closure).
    - Open TaskDetailsSheet on a translated task — verify name + description + instructions + examples all in Hindi.
    - In the search field, type `'चाय बनाओ'` (or any translated task name from the catalog). **Stage 1** should return the matching task ("Make tea").
    - Type just `'बनाओ'` (token-only) — **Stage 2** should at least surface partial matches.
    - Type random Hindi `'अब्बा डब्बा'` — **Stage 3** passthrough returns zero (acceptable degraded state).
    - Loop with pt-BR using `'fazer chá'` → `'Make tea'`.

    **§7 — Live-preview visual rendering**:
    - This was re-walked in plan 07-10 Task 2 (the surgical-fix re-walk). Re-confirm here as part of the systematic acceptance:
      - Real flow: 15-s preview renders + fades.
      - Practice flow: D-05 — practice instructional copy does NOT render during the 15-s window.
      - Stop hit-testable during initial-preview state.
      - Static "Live preview" label, no per-second numeral.
      - Eye glyph in dimmed state visible + ORANGE (COSMETIC-03 closure; plan 07-14).
      - "Live preview" label in top-LEFT corner, NOT overlapping Stop (COSMETIC-02 closure; plan 07-14).
      - Translated "Live preview" label in non-English locale (plan 07-11 closure).

    **§8 — Tap-reveal rolling + Stop hit-test**:
    - Re-confirm visual checks now that G-11 / G-12 are closed.

    **§10 with-preview-ON — Cancel gate with preview engaged**:
    - The original §10 walk (07-HUMAN-UAT.md) was passed as "presumed intact, no on-hardware cancel fired". Now with G-11 closed, run the forced `fps_dropped` walk WITH the preview ON. Cover the lens for 60+ s, stop. History row should show "Canceled — frame rate dropped" chip-failed and the segment should NOT enter the upload queue. Confirms REC-LIVE-07 — capture-quality cancel gates UNCHANGED — under the post-07-10 wiring.

    **§11 — Grep gates** (re-run at end of walk):
    - §11.1 Renumber-sweep: 0 non-annotated hits.
    - §11.2 Android-only diff: empty under apps/mobile/ios/.
    - §11.3 No DB migration: empty under apps/api/drizzle/migrations/.
    - §11.4 Phase-6 cosmetic-gaps untouched.
    - §11.5 `apps/mobile/ios/` directory present.

    The operator marks each row PASS / FAIL / DEGRADED-OK in `07-MANUAL-SMOKE.md` and tells Claude the verdict.

  </what-built>
  <how-to-verify>
    **Pre-walk:**
    1. `JAVA_HOME=$(/usr/libexec/java_home -v 17) cd apps/mobile/android && ./gradlew :app:installApkRolloutDebug` installs the fresh build (commit hash from Task 1's readiness block).
    2. `adb shell pm clear ai.humynlabs.capture.apk` for a fresh-install §2 walk (locale persistence depends on MMKV — clear it to ensure ChooseLanguageScreen re-fires for one initial test, OR retain state if you want to test the persistence half — operator chooses).
    3. `adb reverse tcp:8080 tcp:8080 && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4566 tcp:4566` (tunnels per memory).
    4. `cd apps/api && pnpm dev` (dev API + worker per memory).

    **Walk:**
    5. Open `07-MANUAL-SMOKE.md` in the editor. For each of §2..§8 + §10..§11 sections, walk the steps and mark each `[ ] PASS / [ ] FAIL` checkbox. Use the existing checkbox format in the runbook — don't restructure.
    6. For §9, COPY the verdict from plan 07-10 Task 3's SUMMARY (do not re-walk § 9 unless plan 07-10 Task 3 itself failed).

    **Report back to Claude:**
    7. Tell Claude the row-by-row PASS/FAIL count, OR copy-paste the updated runbook back into chat.

    **Outcome:**
    - **All-PASS** → Task 3 advances ROADMAP.md + STATE.md and flips 07-VERIFICATION.md to `status: verified`.
    - **Any FAIL** → Task 3 captures the new gap in 07-HUMAN-UAT.md ## Re-walk 2026-XX-XX block and flips 07-VERIFICATION.md to `status: gaps_found`. The orchestrator decides whether to plan-phase a fresh closure pass.

  </how-to-verify>
  <acceptance_criteria>
    - `07-MANUAL-SMOKE.md` contains updated checkbox PASS/FAIL markings for every row in §2, §3, §4, §6, §7, §8, §10, §11 (every `[ ] PASS / [ ] FAIL` row in those sections has exactly one box checked).
    - The runbook's `re_walked_on:` frontmatter field is set to the actual walk date (operator-filled).
    - Operator types "approved — re-walk complete" or "re-walk done — FAILs flagged: {list}".
  </acceptance_criteria>
  <resume-signal>Type "approved — re-walk complete; all PASS" to advance to Task 3 (verification refresh + ROADMAP). Type "re-walk done — FAILs: {row references}" if any walk failed; Claude will file the gaps and route to plan creation OR re-attempt.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Refresh 07-VERIFICATION.md + append 07-HUMAN-UAT.md re-walk block + (conditional) advance ROADMAP.md + STATE.md</name>
  <files>.planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md, .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md, .planning/ROADMAP.md, .planning/STATE.md</files>
  <read_first>
    - .planning/phases/07-multi-linguality-live-cam-feed/07-MANUAL-SMOKE.md (the updated runbook from Task 2)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md (the current snapshot — preserve the historical re_verification block)
    - .planning/phases/07-multi-linguality-live-cam-feed/07-HUMAN-UAT.md (the original gap inventory + the §11 grep gate annotations)
    - .planning/ROADMAP.md (the Phase 7 entry + the "Phase swap 2026-05-24" banner)
    - .planning/STATE.md (the current-phase pointer + the gap-closure cluster annotation)
  </read_first>
  <behavior>
    - **07-VERIFICATION.md update:** preserve the existing `re_verification` block as historical; append a new top-level snapshot at the top of the file (or replace the in-place fields, depending on the existing convention). New `status:` is `verified` (if Task 2 was all-PASS) or `gaps_found` (if any FAIL). `gaps_closed` expands to list G-02..G-12 + COSMETIC-01..03 per the cluster closures. `gaps_remaining` lists any new findings from Task 2 OR `[]`.
    - **07-HUMAN-UAT.md update:** append a `## Re-walk 2026-XX-XX` block AFTER the existing `## Gaps` block. The new block captures the row-by-row PASS/FAIL verdicts from Task 2 + the cluster plan list (07-10..07-14) + the §9 A/B drift outcome. The existing `## Gaps` block stays as historical evidence (do NOT delete or edit it).
    - **(conditional) ROADMAP.md update:** if all-PASS, mark Phase 7 COMPLETE with the sign-off date and a brief one-line summary that references this plan. The "Phase swap 2026-05-24" banner stays intact (it's historical and still correct).
    - **(conditional) STATE.md update:** if all-PASS, advance the current-phase pointer past Phase 7 to Phase 8. Update the "Roadmap Evolution" or "Decisions" section to add an entry for the Phase-7 close + the gap-closure cluster.
    - **If NOT all-PASS:** ROADMAP.md + STATE.md are NOT advanced. Instead, both files gain an annotation noting "Phase 7 gap-closure attempt 1 — {N} new gaps surfaced; awaiting next closure pass".
  </behavior>
  <action>
1. **Read the updated `07-MANUAL-SMOKE.md`** (post-Task-2). Tally the per-row PASS / FAIL count and identify any FAIL rows.

2.  **Construct the re-walk verdict block** for `07-HUMAN-UAT.md`. Template:

    ```markdown
    ## Re-walk 2026-XX-XX (post gap-closure cluster — plans 07-10..07-14)

    **Operator:** {name}
    **Date:** 2026-XX-XX
    **Device:** Pixel 10a `5C161JEA304304`, Android 16, apkRolloutDebug
    **APK commit:** `{hash from Task 1 readiness block}`

    ### Cluster plan inventory

    - Plan 07-10 — native live-preview surface debug + fix (G-11 + G-12) — verdict: {SUMMARY ref}
    - Plan 07-11 — i18n sweep extension (G-02 / G-03 / G-04 / G-05 / G-06 / G-07 / G-09) — verdict: {SUMMARY ref}
    - Plan 07-12 — taskCatalog body translation (G-08) — verdict: {SUMMARY ref}
    - Plan 07-13 — Help Center body translation (G-10) — verdict: {SUMMARY ref}
    - Plan 07-14 — cosmetic cleanup (COSMETIC-01..03) — verdict: {SUMMARY ref}

    ### Re-walk per section

    - §2 per-locale loop: {PASS | FAIL — {row refs}}
    - §3 bilingual dual-render: {PASS | FAIL}
    - §4 TTS voice-vs-text: {PASS | FAIL}
    - §6 reverse-search with translated catalog: {PASS | FAIL}
    - §7 live-preview visual: {PASS | FAIL}
    - §8 tap-reveal rolling + Stop hit-test: {PASS | FAIL}
    - §9 A/B drift (BLOCKING D-04): {PASS delta=X.XX | FAIL → Option A revert | OWNER-DEFERRED MARGINAL} (carried from plan 07-10 Task 3 — DO NOT re-walk here)
    - §10 with-preview-ON cancel gate: {PASS | FAIL}
    - §11 grep gates: {PASS | FAIL}

    ### Gaps closed by this re-walk

    - G-02..G-12 + COSMETIC-01..03 — {ALL closed | partial — {list}}

    ### New gaps surfaced (if any)

    {empty if all-PASS; otherwise per-gap entry mirroring the original ## Gaps block format}

    ### Sign-off

    {Phase 7 marked COMPLETE in ROADMAP.md as of 2026-XX-XX, sign-off by {operator}.}
    {OR}
    {Phase 7 NOT marked COMPLETE; gap-closure pass 2 dispatched per orchestrator decision.}
    ```

3.  **Append the block to `07-HUMAN-UAT.md`** AFTER the existing `## Gaps` section. Do NOT modify the existing block.

4.  **Update `07-VERIFICATION.md`** by replacing the in-place fields (or appending a new snapshot at the top, matching the existing convention):

    - `status:` → `verified` (all-PASS) | `gaps_found` (any FAIL).
    - `score:` → `5/5 must-haves verified on hardware` (all-PASS) | `5/5 must-haves code-verified; X must-haves blocked on operator re-walk failures` (any FAIL).
    - `re_verification.previous_status:` → `human_needed`.
    - `re_verification.previous_score:` → the score from the existing snapshot.
    - `re_verification.previous_verification_commit:` → the commit hash of the previous 07-09 verification commit.
    - `re_verification.gaps_closed:` → extend the list with G-02..G-12 + COSMETIC-01..03 + any G-XX from the previous re-walk that was carried over.
    - `re_verification.gaps_remaining:` → `[]` (all-PASS) | per-gap entries (any FAIL).
    - `human_verification:` → update each row's `result:` to the new verdict.

5.  **(Conditional) Update `.planning/ROADMAP.md`** if all-PASS:

    - Find the Phase 7 entry.
    - Mark it COMPLETE with the sign-off date.
    - Add a one-line summary: "Closed 2026-XX-XX after gap-closure cluster (plans 07-10..07-14) — see `.planning/phases/07-multi-linguality-live-cam-feed/07-15-SUMMARY.md`".
    - Do NOT touch the "Phase swap 2026-05-24" banner.

6.  **(Conditional) Update `.planning/STATE.md`** if all-PASS:

    - Advance the current-phase pointer past Phase 7 to Phase 8.
    - Add a "Roadmap Evolution" or "Decisions" entry: "2026-XX-XX — Phase 7 (Multi-linguality + Live-Cam Feed) closed via gap-closure cluster 07-10..07-14".

7.  **(Not-all-PASS branch)** — if any FAIL, do NOT advance ROADMAP / STATE. Add an annotation in both files noting "Phase 7 gap-closure attempt 1 incomplete — see `07-HUMAN-UAT.md` Re-walk 2026-XX-XX block for the new gaps". The orchestrator (or operator) decides whether to plan-phase a follow-on.

8.  **Run all 4 invariant gates one final time** to confirm nothing was inadvertently touched:

    ```bash
    git diff --stat apps/mobile/ios/
    git diff --stat apps/api/drizzle/migrations/
    git diff --stat .planning/phases/06-tasks-history-home-tiles-lexical-search/06-COSMETIC-GAPS.md
    git diff --stat apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HevcEncoder.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
    ```

    All four empty.

9.  **Source-code-untouched check** (this plan modifies only planning docs):

    ```bash
    git diff --stat apps/
    ```

    Expected: empty.

10. **Existing-plan-SUMMARY-untouched check:**

        ```bash
        for n in 01 02 03 04 05 06 07 08 09 10 11 12 13 14; do
          git diff --stat ".planning/phases/07-multi-linguality-live-cam-feed/07-${n}-SUMMARY.md"
        done
        ```

        Expected: empty for ALL of them (this plan does not modify any prior plan's SUMMARY).

      </action>
      <verify>
        <automated>test -f .planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md && grep -cE 'status: (verified|gaps_found)' .planning/phases/07-multi-linguality-live-cam-feed/07-VERIFICATION.md</automated>
      </verify>
      <acceptance_criteria>
        - `07-VERIFICATION.md` status is either `verified` or `gaps_found` (NOT `human_needed`); the previous snapshot's data is preserved in the `re_verification` block.
        - `07-HUMAN-UAT.md` has a new `## Re-walk 2026-XX-XX` block AFTER the existing `## Gaps` block; the existing block is unchanged.
        - **If all-PASS:** ROADMAP.md Phase 7 entry marked COMPLETE with sign-off date; STATE.md current-phase pointer advanced past Phase 7.
        - **If any-FAIL:** ROADMAP.md + STATE.md NOT advanced; both files have an annotation noting the incomplete gap-closure attempt.
        - All 4 invariant gates green: iOS / migrations / Phase-6 cosmetics / HevcEncoder + FinalizeWorker + MetadataComposer all empty.
        - `git diff --stat apps/` empty (this plan does NOT modify source code).
        - No prior plan SUMMARYs (07-01..07-14) modified.
      </acceptance_criteria>
      <done>07-VERIFICATION.md reflects the new posture; 07-HUMAN-UAT.md has the re-walk block; ROADMAP.md + STATE.md advanced (best case) or annotated (worst case). The gap-closure cluster is closed at the planning-doc level.</done>
    </task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                         | Description                                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Operator hardware verdict → planning doc updates | The operator's PASS/FAIL signal is the canonical authority for verification status; no automated check can substitute. |

## STRIDE Threat Register

| Threat ID  | Category               | Component                                  | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------- | ------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-07-15-01 | Repudiation            | Operator verdict captured in planning docs | mitigate    | The operator marks PASS/FAIL in 07-MANUAL-SMOKE.md (checkbox format); the Task 3 capture writes the operator name + date + APK commit hash so the verdict is auditable.                                                                                                           |
| T-07-15-02 | Tampering              | ROADMAP / STATE advance without all-PASS   | mitigate    | Task 3 explicitly conditions ROADMAP / STATE updates on the all-PASS verdict from Task 2. If any FAIL exists, the conditional branch DOES NOT advance the roadmap; both files instead gain an annotation noting the incomplete pass. The acceptance-criteria block enforces this. |
| T-07-15-03 | Information Disclosure | Operator-supplied PASS/FAIL row data       | accept      | The runbook captures hardware verdicts only — no PII, no secrets, no logs. Already public-by-design.                                                                                                                                                                              |

</threat_model>

<verification>
1. `07-VERIFICATION.md` status is `verified` or `gaps_found`.
2. `07-HUMAN-UAT.md` has the re-walk block appended.
3. (Conditional) ROADMAP.md + STATE.md advanced.
4. All 4 invariant gates green.
5. `git diff --stat apps/` empty.
6. No prior plan SUMMARY modified.
</verification>

<success_criteria>

- All previously-FAIL/PARTIAL/BLOCKED/PENDING sections of 07-MANUAL-SMOKE.md re-walked.
- 07-HUMAN-UAT.md has a fresh re-walk block.
- 07-VERIFICATION.md status advanced.
- ROADMAP.md + STATE.md reflect the final Phase-7 posture (COMPLETE or incomplete-with-next-steps).
- All invariants green.
  </success_criteria>

<output>
After completion, create `.planning/phases/07-multi-linguality-live-cam-feed/07-15-SUMMARY.md` documenting:
- The cluster plan inventory (07-10..07-14).
- The §9 A/B drift verdict (carried from plan 07-10).
- The row-by-row §2..§11 re-walk verdicts.
- The final Phase 7 status (COMPLETE / incomplete-with-next-steps).
- Whether ROADMAP.md + STATE.md were advanced.
- Any new gaps that surfaced and the orchestrator's next-step decision.
</output>
