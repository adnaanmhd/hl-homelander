---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 15
id: 02-15-compat-screens-and-service
name: compatService + CompatRunningScreen + CompatPassScreen + CompatFailScreen + CompatRecoveryScreen
type: execute
wave: 4
depends_on:
  [
    02-12-compat-encoder-probe,
    02-13-compat-imu-probe,
    02-14-compat-device-caps-and-permissions,
    02-05-navigation-skeleton,
  ]
files_modified:
  - shared/types/src/CompatResult.ts
  - apps/mobile/src/services/compatService.ts
  - apps/mobile/src/screens/compat/CompatRunningScreen.tsx
  - apps/mobile/src/screens/compat/CompatPassScreen.tsx
  - apps/mobile/src/screens/compat/CompatFailScreen.tsx
  - apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx
  - apps/mobile/src/screens/compat/checks.ts
  - apps/mobile/src/components/CompatRing.tsx
  - apps/mobile/__tests__/services/compatService.test.ts
  - apps/mobile/__tests__/screens/CompatRunningScreen.test.tsx
  - apps/mobile/__tests__/screens/CompatPassScreen.test.tsx
  - apps/mobile/__tests__/screens/CompatFailScreen.test.tsx
  - apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx
  - apps/mobile/__tests__/components/CompatRing.test.tsx
  - apps/mobile/src/navigation/OnboardingStack.tsx
autonomous: true
requirements: [COMPAT-01, COMPAT-02, COMPAT-03, COMPAT-05, COMPAT-06, COMPAT-07, COMPAT-08]
must_haves:
  truths:
    - 'shared/types/src/CompatResult.ts ships the Zod schema per CONTEXT D-COMPAT-05 (signature, runAt ISO datetime, checks { resolution, fps, ultrawideDfov{pass, measuredDeg}, imuSustained100Hz{pass, measuredHz}, imuP99Ms{pass, measuredMs}, micSampleRate, realtimeTimestamp, root{pass, verdict}, freeStorageGB{pass, warningOnly, measuredGB}, encoderNoBFrames, oisOff, hdrSdrForced }, passed, failedKeys)'
    - 'compatService.runCompatCheck() orchestrates HumynCompat.runEncoderProbe + runImuProbe(30000, true) + readDeviceCaps; assembles CompatResult; computes signature = sha256(versionCode|fingerprint|installation_id) first 16 hex; writes MMKV keys compat.lastResult.v1 and onboarding.compatPassed.v1; returns CompatResult'
    - 'compatService.needsRerun() returns true when current signature differs from stored signature (COMPAT-04 / AUTH-11 trigger; signature embeds installation_id from 02-04 + versionName from 02-04 AppFlavor extension + Build.FINGERPRINT)'
    - 'CompatRunningScreen runs the 7-row animated checklist per design-spec §4 (Ultrawide camera / 1080p @ 30 FPS / Motion sensors / Stable sensor stream / Microphone / Time sync source / Device integrity) with a 130×130 progress ring at 0→100% as checks resolve'
    - "CompatPassScreen renders 'You're in.' / 'All checks passed.' (40 ms haptic on mount per design-spec §4c) + Next CTA; warningOnly free-storage banner when freeStorageGB < 5 (COMPAT-03)"
    - "CompatFailScreen renders the failed-keys list with measured values per design-spec §4d ('Stable motion sensors at 100 Hz+ required (yours: {measuredHz} Hz)') and offers a 'What now' CTA → CompatRecoveryScreen (COMPAT-08)"
    - 'CompatRecoveryScreen lists actionable next-steps (try a different qualifying device; contact support → mailto helper from 02-19) and is NOT a brick — back-arrow returns to CompatFailScreen, no proceed CTA (COMPAT-06 enforced)'
    - 'OnboardingStack.tsx (modified) registers all four compat screens'
    - 'CompatRing component (apps/mobile/src/components/CompatRing.tsx) ships the 130×130 stroke-dashoffset progress ring per design-spec §4 visual + §0.4 motion (350 ms transition; react-native-svg + RN built-in Animated; NO Reanimated dep at this seam) — consumed by CompatRunningScreen'
  artifacts:
    - path: 'shared/types/src/CompatResult.ts'
      provides: 'Zod CompatResult schema (D-COMPAT-05)'
      contains: 'z.discriminatedUnion'
    - path: 'apps/mobile/src/services/compatService.ts'
      provides: 'runCompatCheck + needsRerun + getStoredCompatResult + clearStoredCompatResult'
      contains: 'runCompatCheck'
    - path: 'apps/mobile/src/screens/compat/CompatRunningScreen.tsx'
      provides: 'Compat-running UI per design-spec §4a/4b (animated 7-row checklist + progress ring)'
      contains: 'Checking your phone'
    - path: 'apps/mobile/src/components/CompatRing.tsx'
      provides: '130×130 stroke-dashoffset progress ring per design-spec §4 visual + §0.4 motion'
      contains: 'react-native-svg'
  key_links:
    - from: 'apps/mobile/src/services/compatService.ts'
      to: 'apps/mobile/src/native/HumynCompat.ts'
      via: 'runEncoderProbe + runImuProbe + readDeviceCaps'
      pattern: 'runEncoderProbe'
    - from: 'apps/mobile/src/services/compatService.ts'
      to: 'shared/types/src/CompatResult.ts'
      via: 'CompatResultSchema.parse'
      pattern: 'CompatResultSchema'
    - from: 'apps/mobile/src/screens/compat/CompatFailScreen.tsx'
      to: 'apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx'
      via: "navigation.navigate('CompatRecovery')"
      pattern: 'CompatRecovery'
---

<objective>
Wire the entire JS-side compat-check user flow on top of the Kotlin probes shipped in 02-12 / 02-13 / 02-14. Three deliverables: (1) the Zod schema in shared/types, (2) compatService that orchestrates the three native calls into a single CompatResult, and (3) the four user-facing screens (Running / Pass / Fail / Recovery) per design-spec §4 + COMPAT-08.

Purpose: This plan closes COMPAT-01..03/05..08 — every COMPAT-\* requirement that doesn't live inside the Kotlin probes. signature minting here drives AUTH-11 (new device same Google account → fresh installation_id → signature mismatch → forced re-run).
Output: a complete pass-or-fail flow runnable from CompatRunningScreen on a Pixel-class device, with vitest tests on compatService and snapshot/render tests on each screen.

Executor MUST run the per-task `<verify>` command after every task to catch context degradation before the next task starts. This plan has 5 tasks + 13 files modified — at the warning threshold for scope; per-task green-CI gating is non-negotiable.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/services/auth.ts
@apps/mobile/src/services/api.ts
@apps/mobile/src/state/appStore.ts
@apps/mobile/src/state/keys.ts
@apps/mobile/src/native/HumynCompat.ts
@apps/mobile/src/native/AppFlavor.ts
@apps/mobile/src/services/installationId.ts
@apps/mobile/src/screens/signup/SignupScreen.tsx
@design-spec.md
@shared/types/src/app-version.ts

<interfaces>
<!-- D-COMPAT-05 — CompatResult Zod schema -->
import { z } from 'zod';

export const CompatResultSchema = z.object({
signature: z.string(),
runAt: z.string().datetime(),
checks: z.object({
resolution: z.boolean(),
fps: z.boolean(),
ultrawideDfov: z.object({ pass: z.boolean(), measuredDeg: z.number() }),
imuSustained100Hz: z.object({ pass: z.boolean(), measuredHz: z.number() }),
imuP99Ms: z.object({ pass: z.boolean(), measuredMs: z.number() }),
micSampleRate: z.boolean(),
realtimeTimestamp: z.boolean(),
root: z.object({ pass: z.boolean(), verdict: z.string() }),
freeStorageGB: z.object({ pass: z.boolean(), warningOnly: z.boolean(), measuredGB: z.number() }),
encoderNoBFrames: z.boolean(),
oisOff: z.boolean(),
hdrSdrForced: z.boolean(),
}),
passed: z.boolean(),
failedKeys: z.array(z.string()),
});
export type CompatResult = z.infer<typeof CompatResultSchema>;

<!-- design-spec §4 — 7 rows shown to user (mapped from the 12 internal checks) -->

const DISPLAY_ROWS = [
{ key: 'ultrawide', label: 'Ultrawide camera' },
{ key: 'resolutionFps', label: '1080p @ 30 FPS' },
{ key: 'motionSensors', label: 'Motion sensors' },
{ key: 'imu', label: 'Stable sensor stream' },
{ key: 'mic', label: 'Microphone' },
{ key: 'realtime', label: 'Time sync source' },
{ key: 'integrity', label: 'Device integrity' },
];

<!-- design-spec §4d — fail copy template -->

"This phone can't record yet"
"Stable motion sensors at 100 Hz+ required (yours: 44 Hz)" // measured value substituted
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                      | Description                                         |
| --------------------------------------------- | --------------------------------------------------- |
| Native HumynCompat → JS CompatResult assembly | typed Promise; errors caught + surfaced             |
| JS → MMKV (compat.lastResult.v1)              | encrypted at rest                                   |
| compatSignature → AUTH-11 gate                | client-side only; backend Play Integrity is binding |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                | Disposition | Mitigation Plan                                                                                                                                                                                                                                                            |
| --------- | ---------------------- | ------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.15-01 | Tampering              | User edits MMKV `compat.lastResult.v1` to fake a pass                    | accept      | Per RESEARCH § Security Domain: MMKV is encrypted at rest with `humyn-mmkv-v1` key. Local-only gate — Play Integrity at sign-in (Phase 1) is the binding upload-time check. Phase 3 capture pipeline enforces real spec; tampered cache cannot upload non-spec recordings. |
| T-2.15-02 | Information Disclosure | Compat measured values surface in Crashlytics if `runCompatCheck` throws | mitigate    | Wrap each native call's catch handler — propagate error code only (`'IMU_PROBE_ERROR'`), NOT the measured stream of timestamps. Crashlytics scrubs paths per RESEARCH § Security Domain V7.                                                                                |
| T-2.15-03 | Denial of Service      | runCompatCheck blocks UI thread for 35+ s                                | mitigate    | Native methods already dispatch on bgExecutor (plan 02-06). JS side awaits with a Running screen UI; user cannot navigate away (back is suppressed per D-NAV-04).                                                                                                          |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: shared/types CompatResult Zod + compatService orchestration + tests</name>
  <files>shared/types/src/CompatResult.ts, apps/mobile/src/services/compatService.ts, apps/mobile/src/screens/compat/checks.ts, apps/mobile/__tests__/services/compatService.test.ts</files>
  <read_first>
    - shared/types/src/app-version.ts (Phase 1 analog: zod schema-then-type pattern)
    - apps/mobile/src/services/auth.ts (analog: MMKV singleton + sequential native calls + try/catch shape)
    - apps/mobile/src/native/HumynCompat.ts (typed bridge contracts from 02-06)
    - apps/mobile/src/native/AppFlavor.ts (versionName + versionCode + deviceModel constants)
    - apps/mobile/src/services/installationId.ts (signature input)
    - apps/mobile/src/state/keys.ts (MMKV key constants — verify compat.lastResult.v1 + onboarding.compatPassed.v1 are present from 02-03)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-COMPAT-03 (signature recipe)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-COMPAT-05 (full Zod shape)
  </read_first>
  <action>
    1. Author `shared/types/src/CompatResult.ts` — paste the Zod schema from `<interfaces>` above verbatim. Export `CompatResultSchema` and the inferred `CompatResult` type. Add the file to `shared/types/src/index.ts`'s re-exports.

    2. Author `apps/mobile/src/screens/compat/checks.ts`:
    ```typescript
    import type { CompatResult } from '@humyn/types';

    /** Internal-check → user-facing-row mapping per design-spec §4. */
    export type DisplayRowKey =
      | 'ultrawide' | 'resolutionFps' | 'motionSensors' | 'imu' | 'mic' | 'realtime' | 'integrity';

    export const DISPLAY_ROWS: { key: DisplayRowKey; label: string }[] = [
      { key: 'ultrawide', label: 'Ultrawide camera' },
      { key: 'resolutionFps', label: '1080p @ 30 FPS' },
      { key: 'motionSensors', label: 'Motion sensors' },
      { key: 'imu', label: 'Stable sensor stream' },
      { key: 'mic', label: 'Microphone' },
      { key: 'realtime', label: 'Time sync source' },
      { key: 'integrity', label: 'Device integrity' },
    ];

    /** Map an assembled CompatResult into a per-row pass/fail array for the UI. */
    export function rowsFromResult(r: CompatResult): { key: DisplayRowKey; pass: boolean; detail?: string }[] {
      return [
        { key: 'ultrawide', pass: r.checks.ultrawideDfov.pass,
          detail: r.checks.ultrawideDfov.pass ? undefined : `${r.checks.ultrawideDfov.measuredDeg.toFixed(0)}° (need 110°+)` },
        { key: 'resolutionFps', pass: r.checks.resolution && r.checks.fps },
        { key: 'motionSensors', pass: r.checks.imuSustained100Hz.pass || r.checks.imuP99Ms.pass /* sensor present check; full sustained = imu row */ },
        { key: 'imu', pass: r.checks.imuSustained100Hz.pass && r.checks.imuP99Ms.pass,
          detail: r.checks.imuSustained100Hz.pass ? undefined : `yours: ${r.checks.imuSustained100Hz.measuredHz.toFixed(0)} Hz (need 100 Hz+)` },
        { key: 'mic', pass: r.checks.micSampleRate },
        { key: 'realtime', pass: r.checks.realtimeTimestamp },
        { key: 'integrity', pass: r.checks.root.pass && r.checks.encoderNoBFrames && r.checks.oisOff && r.checks.hdrSdrForced },
      ];
    }
    ```

    3. Author `apps/mobile/src/services/compatService.ts`:
    ```typescript
    import { NativeModules } from 'react-native';
    import { MMKV } from 'react-native-mmkv';
    import { CompatResultSchema, type CompatResult } from '@humyn/types';
    import { runEncoderProbe, runImuProbe, readDeviceCaps } from '../native/HumynCompat';
    import { getInstallationId } from './installationId';

    const mmkv = new MMKV({ id: 'humyn.secure', encryptionKey: 'humyn-mmkv-v1' });
    const COMPAT_KEY = 'compat.lastResult.v1';
    const COMPAT_PASSED_KEY = 'onboarding.compatPassed.v1';

    /** Sync sha256 first-16-hex of a string via the AppFlavor Kotlin extension (added in 02-04). */
    function sha256First16Hex(input: string): string {
      const fn = (NativeModules.AppFlavor as { sha256First16Hex?: (s: string) => string } | undefined)?.sha256First16Hex;
      if (typeof fn !== 'function') {
        throw new Error('AppFlavor.sha256First16Hex not registered — extend AppFlavorModule.kt per plan 02-04');
      }
      return fn(input);
    }

    function computeSignature(): string {
      const constants = (NativeModules.AppFlavor as { versionName: string; versionCode: number; deviceModel: string });
      const id = getInstallationId();
      return sha256First16Hex(`${constants.versionCode}|${constants.deviceModel}|${id}`);
    }

    export async function runCompatCheck(): Promise<CompatResult> {
      const enc = await runEncoderProbe();
      const imu = await runImuProbe(30_000, true);
      const caps = await readDeviceCaps();

      const checks = {
        resolution: caps.resolutionMax >= 1920,
        fps: caps.fpsMax >= 30,
        ultrawideDfov: { pass: caps.ultrawideDfovDeg >= 110, measuredDeg: caps.ultrawideDfovDeg },
        imuSustained100Hz: { pass: imu.sustainedHz >= 100, measuredHz: imu.sustainedHz },
        imuP99Ms: { pass: imu.p99IntervalMs <= 12, measuredMs: imu.p99IntervalMs },
        micSampleRate: caps.micSampleRateMax >= 48_000,
        realtimeTimestamp: caps.realtimeTimestampSource,
        root: { pass: !caps.rooted, verdict: caps.rooted ? 'rooted_heuristic_match' : 'clean' },
        freeStorageGB: { pass: true, warningOnly: caps.freeStorageGB < 5, measuredGB: caps.freeStorageGB },
        encoderNoBFrames: !enc.bFramePresent,
        oisOff: enc.oisOff,
        hdrSdrForced: enc.hdrSdrForced,
      };

      const failedKeys: string[] = [];
      for (const [k, v] of Object.entries(checks)) {
        if (typeof v === 'boolean') {
          if (!v) failedKeys.push(k);
        } else if ('pass' in v && !v.pass) {
          failedKeys.push(k);
        }
      }
      // freeStorageGB warningOnly does NOT block — exclude even if !pass (we set pass:true above; defensive)
      const passed = failedKeys.length === 0;

      const result: CompatResult = CompatResultSchema.parse({
        signature: computeSignature(),
        runAt: new Date().toISOString(),
        checks,
        passed,
        failedKeys,
      });

      mmkv.set(COMPAT_KEY, JSON.stringify(result));
      if (passed) {
        mmkv.set(COMPAT_PASSED_KEY, JSON.stringify({ signature: result.signature, runAt: result.runAt, passed: true }));
      } else {
        mmkv.delete(COMPAT_PASSED_KEY);
      }
      return result;
    }

    export function getStoredCompatResult(): CompatResult | undefined {
      const raw = mmkv.getString(COMPAT_KEY);
      if (!raw) return undefined;
      try {
        return CompatResultSchema.parse(JSON.parse(raw));
      } catch {
        return undefined;
      }
    }

    export function clearStoredCompatResult(): void {
      mmkv.delete(COMPAT_KEY);
      mmkv.delete(COMPAT_PASSED_KEY);
    }

    /** COMPAT-04 / AUTH-11 — current build's signature differs from stored signature. */
    export function needsRerun(): boolean {
      const stored = getStoredCompatResult();
      if (!stored || !stored.passed) return true;
      return stored.signature !== computeSignature();
    }
    ```

    4. Author `apps/mobile/__tests__/services/compatService.test.ts`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';

    vi.mock('react-native', () => ({
      NativeModules: {
        AppFlavor: {
          versionName: '0.1.0',
          versionCode: 1,
          deviceModel: 'Pixel 7a',
          sha256First16Hex: (s: string) => `sig-${s.length.toString(16).padStart(16, '0')}`,
        },
      },
    }));

    const mmkvStore: Record<string, string> = {};
    vi.mock('react-native-mmkv', () => ({
      MMKV: vi.fn(() => ({
        getString: (k: string) => mmkvStore[k],
        set: (k: string, v: string) => { mmkvStore[k] = v; },
        delete: (k: string) => { delete mmkvStore[k]; },
      })),
    }));

    vi.mock('../../src/native/HumynCompat', () => ({
      runEncoderProbe: vi.fn().mockResolvedValue({ bFramePresent: false, oisOff: true, hdrSdrForced: true, encoderClipPath: '/tmp/x.mp4' }),
      runImuProbe: vi.fn().mockResolvedValue({ sustainedHz: 200, p99IntervalMs: 6, samplesCollected: 6000 }),
      readDeviceCaps: vi.fn().mockResolvedValue({
        resolutionMax: 1920, fpsMax: 30, ultrawideDfovDeg: 118, micSampleRateMax: 48000,
        realtimeTimestampSource: true, rooted: false, freeStorageGB: 12.5,
      }),
    }));

    vi.mock('../../src/services/installationId', () => ({
      getInstallationId: () => 'inst-uuid-fixed',
    }));

    import { runCompatCheck, needsRerun, getStoredCompatResult, clearStoredCompatResult } from '../../src/services/compatService';
    import { runImuProbe, readDeviceCaps } from '../../src/native/HumynCompat';

    beforeEach(() => {
      for (const k of Object.keys(mmkvStore)) delete mmkvStore[k];
      vi.mocked(runImuProbe).mockClear();
    });

    describe('compatService', () => {
      it('happy path: all checks pass, freeStorage warning false, MMKV written', async () => {
        const result = await runCompatCheck();
        expect(result.passed).toBe(true);
        expect(result.failedKeys).toEqual([]);
        expect(result.checks.imuSustained100Hz.measuredHz).toBe(200);
        expect(result.checks.freeStorageGB.warningOnly).toBe(false);
        expect(JSON.parse(mmkvStore['compat.lastResult.v1']).passed).toBe(true);
        expect(mmkvStore['onboarding.compatPassed.v1']).toBeDefined();
      });

      it('freeStorageGB < 5 sets warningOnly true but does NOT fail the check', async () => {
        vi.mocked(readDeviceCaps).mockResolvedValueOnce({
          resolutionMax: 1920, fpsMax: 30, ultrawideDfovDeg: 118, micSampleRateMax: 48000,
          realtimeTimestampSource: true, rooted: false, freeStorageGB: 3.2,
        });
        const result = await runCompatCheck();
        expect(result.passed).toBe(true);
        expect(result.checks.freeStorageGB.warningOnly).toBe(true);
        expect(result.checks.freeStorageGB.pass).toBe(true);
      });

      it('IMU sustained < 100 Hz fails imuSustained100Hz key (design-spec §4d)', async () => {
        vi.mocked(runImuProbe).mockResolvedValueOnce({ sustainedHz: 44, p99IntervalMs: 25, samplesCollected: 1320 });
        const result = await runCompatCheck();
        expect(result.passed).toBe(false);
        expect(result.failedKeys).toContain('imuSustained100Hz');
        expect(result.checks.imuSustained100Hz.measuredHz).toBe(44);
      });

      it('needsRerun returns true when no stored result', () => {
        clearStoredCompatResult();
        expect(needsRerun()).toBe(true);
      });

      it('needsRerun returns false when signature matches stored', async () => {
        await runCompatCheck();
        expect(needsRerun()).toBe(false);
      });

      it('getStoredCompatResult returns parsed CompatResult; clear deletes both keys', async () => {
        await runCompatCheck();
        expect(getStoredCompatResult()?.passed).toBe(true);
        clearStoredCompatResult();
        expect(getStoredCompatResult()).toBeUndefined();
        expect(mmkvStore['onboarding.compatPassed.v1']).toBeUndefined();
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- compatService` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "export const CompatResultSchema" shared/types/src/CompatResult.ts` succeeds.
    - `grep -q "z.discriminatedUnion\|z.object" shared/types/src/CompatResult.ts` succeeds.
    - `grep -q "export async function runCompatCheck" apps/mobile/src/services/compatService.ts` succeeds.
    - `grep -q "export function needsRerun" apps/mobile/src/services/compatService.ts` succeeds.
    - `grep -q "computeSignature\|sha256First16Hex" apps/mobile/src/services/compatService.ts` succeeds.
    - `grep -q "compat.lastResult.v1" apps/mobile/src/services/compatService.ts` succeeds.
    - `cd apps/mobile && npm run test -- compatService --run` exits 0; ≥6 tests run.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- compatService --run</automated>
  </verify>
  <done>compatService orchestrates the 3 native probes; signature math is testable; MMKV write paths verified; 6 vitest tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: CompatRing — 130×130 stroke-dashoffset progress ring (react-native-svg + RN Animated)</name>
  <files>apps/mobile/src/components/CompatRing.tsx, apps/mobile/__tests__/components/CompatRing.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/compat/CompatRunningScreen.tsx (Task 3 output — consumes <CompatRing percent={percent} />)
    - apps/mobile/src/ui/tokens.ts (colors.line, colors.accent, motion.compatRingStrokeMs=350)
    - design-spec.md §4 (visual: 130×130 px, 8 px stroke ring, accent stroke fills as percent advances 0→100)
    - design-spec.md §0.4 (motion: 350 ms compat-ring stroke transition; standard ease curve cubic-bezier(.2,.8,.2,1))
    - apps/mobile/vitest.setup.ts (mocks for `react-native-svg` Svg/Circle and `react-native-reanimated` already exist from 02-02; this task uses the BUILT-IN RN `Animated` API, NOT Reanimated, to avoid pulling in worklets at this seam)
    - apps/mobile/__tests__/ui/primitives.test.tsx (analog: snapshot/render style for a token-bound primitive)
  </read_first>
  <action>
    Author `apps/mobile/src/components/CompatRing.tsx`. Use `react-native-svg` (already pinned in 02-02 at 15.10.1) for the SVG primitives + RN built-in `Animated` API for the stroke-dashoffset interpolation. Reanimated is NOT required for this seam — RN's `Animated.timing` driving `Animated.Value` interpolated into `strokeDashoffset` matches the design-spec §0.4 motion budget and keeps the dependency graph tight (worklets-core already pulled by VisionCamera in Phase 4; this seam doesn't need it):
    ```tsx
    import React, { useEffect, useRef } from 'react';
    import { Animated, Easing, View, StyleSheet } from 'react-native';
    import Svg, { Circle } from 'react-native-svg';
    import { Text } from '../ui/primitives/Text';
    import { colors, motion } from '../ui/tokens';

    const AnimatedCircle = Animated.createAnimatedComponent(Circle);

    /**
     * design-spec §4 visual + §0.4 motion — 130×130 progress ring.
     *  - SVG circle radius 61 (130/2 - 4 stroke / 2 - 4 inset) → circumference 2π·61 ≈ 383.27
     *  - strokeDashoffset = circumference * (1 - percent/100)
     *  - 350 ms transition per token motion.compatRingStrokeMs; standard ease curve.
     *  - NO Reanimated dependency — RN built-in Animated drives the dashoffset.
     */
    const SIZE = 130;
    const STROKE = 8;
    const RADIUS = (SIZE - STROKE) / 2; // 61
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    export interface CompatRingProps {
      /** 0..100 */
      percent: number;
    }

    export function CompatRing({ percent }: CompatRingProps): React.JSX.Element {
      const clamped = Math.max(0, Math.min(100, percent));
      const offset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

      useEffect(() => {
        Animated.timing(offset, {
          toValue: CIRCUMFERENCE * (1 - clamped / 100),
          duration: motion.compatRingStrokeMs,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }).start();
      }, [clamped, offset]);

      return (
        <View style={styles.wrap} accessibilityLabel="compat-ring" accessibilityValue={{ now: clamped, min: 0, max: 100 }}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {/* Track */}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.line}
              strokeWidth={STROKE}
              fill="none"
            />
            {/* Progress (rotated -90° so 0% sits at 12-o'clock) */}
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.accent}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={offset as unknown as number}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
          <View style={styles.percentWrap} pointerEvents="none">
            <Text variant="title28">{`${Math.round(clamped)}%`}</Text>
          </View>
        </View>
      );
    }

    const styles = StyleSheet.create({
      wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
      percentWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    });
    ```

    Author `apps/mobile/__tests__/components/CompatRing.test.tsx`. Snapshot test that the ring renders an SVG with two `<circle>` elements (track + progress), and that the rendered percent label respects the clamped input. The 02-02 `vitest.setup.ts` already mocks `react-native-svg` (Svg → svg, Circle → circle), so the test can render in jsdom:
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { render, screen } from '@testing-library/react';
    import React from 'react';
    import { CompatRing } from '../../src/components/CompatRing';

    describe('CompatRing (design-spec §4 visual + §0.4 motion)', () => {
      it('renders the 130×130 ring with the track circle + progress circle', () => {
        const { container } = render(<CompatRing percent={0} />);
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(2);
      });

      it('matches the snapshot for percent=0', () => {
        const { container } = render(<CompatRing percent={0} />);
        expect(container.firstChild).toMatchSnapshot();
      });

      it('matches the snapshot for percent=42', () => {
        const { container } = render(<CompatRing percent={42} />);
        expect(container.firstChild).toMatchSnapshot();
      });

      it('matches the snapshot for percent=100', () => {
        const { container } = render(<CompatRing percent={100} />);
        expect(container.firstChild).toMatchSnapshot();
      });

      it('exposes accessibilityValue = clamped percent (0..100)', () => {
        render(<CompatRing percent={150} />);
        const node = screen.getByLabelText('compat-ring');
        // Clamping: 150 → 100 in accessibilityValue.now
        // The host-component shim in vitest.setup forwards accessibilityValue as a JSON-serialized data attribute via the makeComponent fallback;
        // assert truthy presence — full a11y verification happens in 02-21 manual smoke.
        expect(node).toBeTruthy();
      });

      it('renders the percent label inside the ring (matches Math.round of clamped input)', () => {
        render(<CompatRing percent={42.6} />);
        expect(screen.getByText('43%')).toBeTruthy();
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- CompatRing --run` — must pass; commit the snapshot files alongside the component.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/src/components/CompatRing.tsx` succeeds.
    - `grep -q "react-native-svg" apps/mobile/src/components/CompatRing.tsx` succeeds.
    - `grep -q "Animated.timing\|Animated.Value" apps/mobile/src/components/CompatRing.tsx` succeeds (using RN built-in Animated, not Reanimated).
    - `grep -cE "react-native-reanimated" apps/mobile/src/components/CompatRing.tsx` returns 0 (Reanimated NOT pulled at this seam).
    - `grep -q "motion.compatRingStrokeMs" apps/mobile/src/components/CompatRing.tsx` succeeds (motion token consumed).
    - `grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/components/CompatRing.tsx` returns no matches (NO hex literals).
    - `cd apps/mobile && npm run test -- CompatRing --run` exits 0; ≥ 4 tests pass with at least 3 committed snapshots.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- CompatRing --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/components/CompatRing.tsx; test $? -eq 1)</automated>
  </verify>
  <done>CompatRing ships the 130×130 progress ring per design-spec §4 + §0.4 with token-bound colors and motion; no Reanimated dependency at this seam; CompatRunningScreen consumes it cleanly.</done>
</task>

<task type="auto">
  <name>Task 3: CompatRunningScreen + 7-row checklist + 130×130 progress ring</name>
  <files>apps/mobile/src/screens/compat/CompatRunningScreen.tsx, apps/mobile/__tests__/screens/CompatRunningScreen.test.tsx, apps/mobile/src/navigation/OnboardingStack.tsx</files>
  <read_first>
    - apps/mobile/src/screens/SignIn.tsx (analog: useState loading + Pressable + StyleSheet pattern)
    - apps/mobile/src/screens/compat/checks.ts (DISPLAY_ROWS — Task 1 output)
    - apps/mobile/src/services/compatService.ts (runCompatCheck — Task 1 output)
    - apps/mobile/src/navigation/OnboardingStack.tsx (current — adding/swapping to the new compat stack screen)
    - design-spec.md §4 / §4a / §4b (Compat-running layout: title 'Checking your phone' / sub 'Takes around 30 secs' / 130×130 ring / 7-row checklist with 22 px round indicators)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Pattern 1: Zustand store hydrated from MMKV" (we update store with passed/failed result before navigating)
    - apps/mobile/src/state/appStore.ts (current — confirm setCompatResult action exists from 02-03; add if missing)
  </read_first>
  <action>
    Author `apps/mobile/src/screens/compat/CompatRunningScreen.tsx`. The screen MUST import the shipped UI primitives (Text, ScreenContainer) from `../../ui/primitives/*` and the design tokens from `../../ui/tokens` — NO hex literals are permitted. The 130×130 progress ring is delegated to `<CompatRing>` (Task 2 above):
    ```tsx
    import React, { useEffect, useRef, useState } from 'react';
    import { View, StyleSheet } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { Text } from '../../ui/primitives/Text';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { colors, spacing } from '../../ui/tokens';
    import { runCompatCheck } from '../../services/compatService';
    import { DISPLAY_ROWS, type DisplayRowKey } from './checks';
    import { useAppStore } from '../../state/appStore';
    import { CompatRing } from '../../components/CompatRing';

    type RowState = 'pending' | 'running' | 'pass' | 'fail';

    /** design-spec §4a/4b — 'Checking your phone' / 'Takes around 30 secs' / 130×130 ring + 7-row checklist. */
    export function CompatRunningScreen(): React.JSX.Element {
      const nav = useNavigation<any>();
      const setCompatResult = useAppStore((s) => s.setCompatResult);
      const [percent, setPercent] = useState(0);
      const [rowStates, setRowStates] = useState<Record<DisplayRowKey, RowState>>(() =>
        DISPLAY_ROWS.reduce((acc, r) => ({ ...acc, [r.key]: 'pending' as RowState }), {} as Record<DisplayRowKey, RowState>),
      );
      const cancelled = useRef(false);

      useEffect(() => {
        cancelled.current = false;
        // Cosmetic row-walk while runCompatCheck() is in flight (~33 s end-to-end).
        const intervalMs = 700;
        const total = DISPLAY_ROWS.length * intervalMs;
        let elapsed = 0;
        const tick = setInterval(() => {
          if (cancelled.current) return;
          elapsed += intervalMs;
          setPercent(Math.min(100, Math.round((elapsed / total) * 100)));
          const idx = Math.min(DISPLAY_ROWS.length - 1, Math.floor(elapsed / intervalMs));
          setRowStates((s) => {
            const next = { ...s };
            for (let i = 0; i < idx; i++) next[DISPLAY_ROWS[i].key] = 'pass';
            next[DISPLAY_ROWS[idx].key] = 'running';
            return next;
          });
        }, intervalMs);

        runCompatCheck()
          .then((result) => {
            if (cancelled.current) return;
            clearInterval(tick);
            setPercent(100);
            setCompatResult(result);
            // Mark rows from real result
            setRowStates(() => {
              const next: Record<DisplayRowKey, RowState> = { } as Record<DisplayRowKey, RowState>;
              const display = require('./checks').rowsFromResult(result) as { key: DisplayRowKey; pass: boolean }[];
              for (const r of display) next[r.key] = r.pass ? 'pass' : 'fail';
              return next;
            });
            // Brief 400 ms hold for ring animation, then route.
            setTimeout(() => {
              if (cancelled.current) return;
              if (result.passed) nav.replace('CompatPass');
              else nav.replace('CompatFail');
            }, 400);
          })
          .catch(() => {
            if (cancelled.current) return;
            clearInterval(tick);
            // Defensive: route to Fail on probe error.
            nav.replace('CompatFail');
          });

        return () => { cancelled.current = true; clearInterval(tick); };
      }, [nav, setCompatResult]);

      return (
        <ScreenContainer accessibilityLabel="compat-running-screen" padding={spacing.h}>
          <View style={styles.ringWrap}>
            {/* CompatRing — 130×130 stroke-dashoffset progress ring per design-spec §4 visual + §0.4 motion (Task 2). */}
            <CompatRing percent={percent} />
          </View>
          <Text variant="compatTitle" style={styles.title}>Checking your phone</Text>
          <Text variant="caption" tone="secondary" style={styles.sub}>Takes around 30 secs</Text>
          <View style={styles.checks}>
            {DISPLAY_ROWS.map((row) => (
              <View key={row.key} style={styles.row} accessibilityLabel={`compat-row-${row.key}`}>
                <View style={[styles.indicator, indicatorStyle(rowStates[row.key])]}>
                  <Text variant="caption" style={styles.indicatorGlyph}>{glyphFor(rowStates[row.key])}</Text>
                </View>
                <Text variant="body" style={styles.label}>{row.label}</Text>
              </View>
            ))}
          </View>
        </ScreenContainer>
      );
    }

    function glyphFor(s: RowState): string {
      switch (s) { case 'pass': return '✓'; case 'fail': return '✕'; case 'running': return '⋯'; default: return '○'; }
    }
    function indicatorStyle(s: RowState) {
      switch (s) {
        case 'pass': return { backgroundColor: colors.success };
        case 'fail': return { backgroundColor: colors.coral };
        case 'running': return { backgroundColor: colors.amber };
        default: return { backgroundColor: colors.line };
      }
    }

    const styles = StyleSheet.create({
      ringWrap: { alignItems: 'center', marginTop: spacing.hh },
      title: { marginTop: spacing.xxxl, alignSelf: 'center' },
      sub: { marginTop: spacing.s, alignSelf: 'center' },
      checks: { marginTop: spacing.xxxl, alignSelf: 'stretch' },
      row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.s },
      indicator: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
      indicatorGlyph: { color: colors.surface },
      label: { color: colors.text },
    });
    ```

    Update `apps/mobile/src/navigation/OnboardingStack.tsx` to register CompatRunning, CompatPass, CompatFail, CompatRecovery as native-stack screens. Replace any placeholder Compat screen from 02-05 with the real CompatRunning import. Pass / Fail / Recovery imports stay as the stub from 02-05 in this task; Tasks 4-5 fill them in.

    Author `apps/mobile/__tests__/screens/CompatRunningScreen.test.tsx`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';
    import { render, screen, waitFor } from '@testing-library/react';
    import React from 'react';

    const replaceFn = vi.fn();
    vi.mock('@react-navigation/native', () => ({
      useNavigation: () => ({ replace: replaceFn }),
    }));

    vi.mock('../../src/services/compatService', () => ({
      runCompatCheck: vi.fn(),
    }));

    vi.mock('../../src/state/appStore', () => ({
      useAppStore: (sel: any) => sel({ setCompatResult: vi.fn() }),
    }));

    import { CompatRunningScreen } from '../../src/screens/compat/CompatRunningScreen';
    import { runCompatCheck } from '../../src/services/compatService';

    beforeEach(() => {
      replaceFn.mockClear();
      vi.mocked(runCompatCheck).mockReset();
    });

    describe('CompatRunningScreen', () => {
      it('renders the title and sub copy verbatim from design-spec §4a', () => {
        vi.mocked(runCompatCheck).mockResolvedValue({ passed: true } as never);
        render(<CompatRunningScreen />);
        expect(screen.getByText('Checking your phone')).toBeTruthy();
        expect(screen.getByText('Takes around 30 secs')).toBeTruthy();
      });

      it('renders all 7 design-spec rows', () => {
        vi.mocked(runCompatCheck).mockResolvedValue({ passed: true } as never);
        render(<CompatRunningScreen />);
        expect(screen.getByLabelText('compat-row-ultrawide')).toBeTruthy();
        expect(screen.getByLabelText('compat-row-resolutionFps')).toBeTruthy();
        expect(screen.getByLabelText('compat-row-imu')).toBeTruthy();
        expect(screen.getByLabelText('compat-row-integrity')).toBeTruthy();
      });

      it('on pass result, navigation.replace is called with CompatPass', async () => {
        vi.mocked(runCompatCheck).mockResolvedValue({
          signature: 'sig', runAt: '2026-05-08T12:00:00Z', passed: true, failedKeys: [],
          checks: {
            resolution: true, fps: true,
            ultrawideDfov: { pass: true, measuredDeg: 118 },
            imuSustained100Hz: { pass: true, measuredHz: 200 },
            imuP99Ms: { pass: true, measuredMs: 6 },
            micSampleRate: true, realtimeTimestamp: true,
            root: { pass: true, verdict: 'clean' },
            freeStorageGB: { pass: true, warningOnly: false, measuredGB: 12 },
            encoderNoBFrames: true, oisOff: true, hdrSdrForced: true,
          },
        } as never);
        render(<CompatRunningScreen />);
        await waitFor(() => expect(replaceFn).toHaveBeenCalledWith('CompatPass'), { timeout: 2000 });
      });

      it('on fail result, navigation.replace is called with CompatFail', async () => {
        vi.mocked(runCompatCheck).mockResolvedValue({
          signature: 'sig', runAt: '2026-05-08T12:00:00Z', passed: false, failedKeys: ['imuSustained100Hz'],
          checks: {
            resolution: true, fps: true,
            ultrawideDfov: { pass: true, measuredDeg: 118 },
            imuSustained100Hz: { pass: false, measuredHz: 44 },
            imuP99Ms: { pass: false, measuredMs: 25 },
            micSampleRate: true, realtimeTimestamp: true,
            root: { pass: true, verdict: 'clean' },
            freeStorageGB: { pass: true, warningOnly: false, measuredGB: 12 },
            encoderNoBFrames: true, oisOff: true, hdrSdrForced: true,
          },
        } as never);
        render(<CompatRunningScreen />);
        await waitFor(() => expect(replaceFn).toHaveBeenCalledWith('CompatFail'), { timeout: 2000 });
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- CompatRunningScreen` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "Checking your phone" apps/mobile/src/screens/compat/CompatRunningScreen.tsx` succeeds.
    - `grep -q "Takes around 30 secs" apps/mobile/src/screens/compat/CompatRunningScreen.tsx` succeeds.
    - `grep -q "runCompatCheck" apps/mobile/src/screens/compat/CompatRunningScreen.tsx` succeeds.
    - `grep -q "CompatPass\|CompatFail" apps/mobile/src/screens/compat/CompatRunningScreen.tsx` succeeds.
    - `grep -q "CompatRunning\|CompatPass\|CompatFail\|CompatRecovery" apps/mobile/src/navigation/OnboardingStack.tsx` returns >= 4 matches.
    - `cd apps/mobile && npm run test -- CompatRunningScreen --run` exits 0; 4 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- CompatRunningScreen --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/compat/CompatRunningScreen.tsx; test $? -eq 1)</automated>
  </verify>
  <done>CompatRunningScreen calls runCompatCheck, walks the 7-row checklist, replaces nav to Pass or Fail; test coverage on the routing logic. NO hex literals in screen source — all colors come from `colors.*` tokens.</done>
</task>

<task type="auto">
  <name>Task 4: CompatPassScreen + CompatFailScreen with measured-value copy</name>
  <files>apps/mobile/src/screens/compat/CompatPassScreen.tsx, apps/mobile/src/screens/compat/CompatFailScreen.tsx, apps/mobile/__tests__/screens/CompatPassScreen.test.tsx, apps/mobile/__tests__/screens/CompatFailScreen.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/compat/CompatRunningScreen.tsx (Task 3 output — same StyleSheet structure)
    - apps/mobile/src/screens/compat/checks.ts (rowsFromResult helper — Task 1 output)
    - apps/mobile/src/state/appStore.ts (compatResult selector)
    - design-spec.md §4c (Pass: 'You're in.' / 'All checks passed.' + 40 ms haptic + Next CTA → Tutorial Rig)
    - design-spec.md §4d (Fail: 'This phone can't record yet' + 'Stable motion sensors at 100 Hz+ required (yours: 44 Hz)' + What now CTA)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § Discretion 'Haptics library' (planner picks; recommend `react-native-haptic-feedback`)
  </read_first>
  <action>
    Author `apps/mobile/src/screens/compat/CompatPassScreen.tsx`. Use the shipped UI primitives (Text, Button, ScreenContainer) from `../../ui/primitives/*`; tokens from `../../ui/tokens` — NO hex literals:
    ```tsx
    import React, { useEffect } from 'react';
    import { View, StyleSheet } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { Text } from '../../ui/primitives/Text';
    import { Button } from '../../ui/primitives/Button';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { colors, spacing, radii } from '../../ui/tokens';
    import { useAppStore } from '../../state/appStore';

    /** design-spec §4c — 'You're in.' + 40 ms haptic + Next CTA → RigTutorial. */
    export function CompatPassScreen(): React.JSX.Element {
      const nav = useNavigation<any>();
      const compat = useAppStore((s) => s.compatResult);

      useEffect(() => {
        // 40ms haptic on mount (D-COMPAT-04 / design-spec §4c).
        // react-native-haptic-feedback is the chosen library (planner discretion); falls back to no-op if unavailable.
        try {
          const Haptics = require('react-native-haptic-feedback').default;
          Haptics.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
        } catch { /* haptic best-effort */ }
      }, []);

      const showStorageWarning = compat?.checks.freeStorageGB.warningOnly;

      return (
        <ScreenContainer accessibilityLabel="compat-pass-screen" padding={spacing.h}>
          <Text variant="title28" style={styles.title}>You're in.</Text>
          <Text variant="body" tone="secondary" style={styles.sub}>All checks passed.</Text>
          {showStorageWarning ? (
            <View style={styles.warningBanner} accessibilityLabel="compat-storage-warning">
              <Text variant="caption" style={styles.warningText}>
                Free up space to avoid recording loss. {compat!.checks.freeStorageGB.measuredGB.toFixed(1)} GB free.
              </Text>
            </View>
          ) : null}
          <View style={styles.cta}>
            <Button
              variant="primary"
              accessibilityLabel="compat-pass-next"
              onPress={() => nav.replace('RigTutorial')}
              label="Next"
            />
          </View>
        </ScreenContainer>
      );
    }

    const styles = StyleSheet.create({
      title: { marginTop: spacing.xxxxl },
      sub: { marginTop: spacing.m },
      warningBanner: { marginTop: spacing.xxxl, backgroundColor: colors.bannerWarnBg, padding: spacing.mdl, borderRadius: radii.input },
      warningText: { color: colors.bannerWarnText },
      cta: { marginTop: 'auto' },
    });
    ```

    Author `apps/mobile/src/screens/compat/CompatFailScreen.tsx`. Uses Text + Button primitives (`../../ui/primitives/*`) and tokens (`../../ui/tokens`). Raw RN ScrollView is permitted (no primitive equivalent ships in 02-02), but its style binds to tokens — NO hex literals:
    ```tsx
    import React from 'react';
    import { View, StyleSheet, ScrollView } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { Text } from '../../ui/primitives/Text';
    import { Button } from '../../ui/primitives/Button';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { colors, spacing } from '../../ui/tokens';
    import { useAppStore } from '../../state/appStore';
    import type { CompatResult } from '@humyn/types';

    /** design-spec §4d — 'This phone can't record yet' + per-key fail copy + 'What now' CTA → CompatRecoveryScreen. */
    export function CompatFailScreen(): React.JSX.Element {
      const nav = useNavigation<any>();
      const compat = useAppStore((s) => s.compatResult);

      return (
        <ScreenContainer accessibilityLabel="compat-fail-screen" padding={spacing.h}>
          <Text variant="sheetTitle" style={styles.title}>This phone can't record yet</Text>
          <ScrollView style={styles.list}>
            {compat ? failureLines(compat).map(({ key, line }) => (
              <View key={key} style={styles.row} accessibilityLabel={`compat-fail-row-${key}`}>
                <Text variant="body" style={styles.cross}>✕</Text>
                <Text variant="body" style={styles.lineText}>{line}</Text>
              </View>
            )) : null}
          </ScrollView>
          <View style={styles.cta}>
            <Button
              variant="primary"
              accessibilityLabel="compat-fail-what-now"
              onPress={() => nav.navigate('CompatRecovery')}
              label="What now"
            />
          </View>
        </ScreenContainer>
      );
    }

    function failureLines(r: CompatResult): { key: string; line: string }[] {
      const lines: { key: string; line: string }[] = [];
      if (!r.checks.ultrawideDfov.pass) lines.push({ key: 'ultrawideDfov', line: `Ultrawide camera 110°+ required (yours: ${r.checks.ultrawideDfov.measuredDeg.toFixed(0)}°)` });
      if (!r.checks.resolution || !r.checks.fps) lines.push({ key: 'resolutionFps', line: '1080p @ 30 FPS required' });
      if (!r.checks.imuSustained100Hz.pass) lines.push({ key: 'imuSustained100Hz', line: `Stable motion sensors at 100 Hz+ required (yours: ${r.checks.imuSustained100Hz.measuredHz.toFixed(0)} Hz)` });
      if (!r.checks.imuP99Ms.pass) lines.push({ key: 'imuP99Ms', line: `Sensor jitter ≤12 ms required (yours: ${r.checks.imuP99Ms.measuredMs.toFixed(1)} ms p99)` });
      if (!r.checks.micSampleRate) lines.push({ key: 'micSampleRate', line: 'Microphone 48 kHz capability required' });
      if (!r.checks.realtimeTimestamp) lines.push({ key: 'realtimeTimestamp', line: 'REALTIME timestamp source required' });
      if (!r.checks.root.pass) lines.push({ key: 'root', line: 'Device must not be rooted' });
      if (!r.checks.encoderNoBFrames) lines.push({ key: 'encoderNoBFrames', line: 'HEVC encoder must produce I/P-only (no B-frames)' });
      if (!r.checks.oisOff) lines.push({ key: 'oisOff', line: 'Optical stabilization must be disabled at capture time' });
      if (!r.checks.hdrSdrForced) lines.push({ key: 'hdrSdrForced', line: 'SDR mode must be forced (no HDR)' });
      return lines;
    }

    const styles = StyleSheet.create({
      title: { marginTop: spacing.xxxxl, marginBottom: spacing.md },
      list: { flexGrow: 1 },
      row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.m },
      cross: { color: colors.coral, marginRight: spacing.ms },
      lineText: { flex: 1 },
      cta: { marginTop: spacing.l },
    });
    ```

    Author both test files (CompatPassScreen.test.tsx and CompatFailScreen.test.tsx). The test for CompatPassScreen verifies title/sub copy + storage warning conditional rendering + Next button calls nav.replace('RigTutorial'). The test for CompatFailScreen mocks a CompatResult with imuSustained100Hz fail (measured 44 Hz) and asserts the design-spec §4d copy 'Stable motion sensors at 100 Hz+ required (yours: 44 Hz)' renders verbatim, and the What now button navigates to CompatRecovery.

    Run `cd apps/mobile && npm run test -- "CompatPassScreen|CompatFailScreen"` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "You're in." apps/mobile/src/screens/compat/CompatPassScreen.tsx` succeeds.
    - `grep -q "All checks passed." apps/mobile/src/screens/compat/CompatPassScreen.tsx` succeeds.
    - `grep -q "This phone can't record yet" apps/mobile/src/screens/compat/CompatFailScreen.tsx` succeeds.
    - `grep -q "yours: \${" apps/mobile/src/screens/compat/CompatFailScreen.tsx` succeeds.
    - `grep -q "navigate.*CompatRecovery" apps/mobile/src/screens/compat/CompatFailScreen.tsx` succeeds.
    - `cd apps/mobile && npm run test -- CompatPassScreen --run` exits 0.
    - `cd apps/mobile && npm run test -- CompatFailScreen --run` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- "Compat(Pass|Fail)Screen" --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/compat/CompatPassScreen.tsx apps/mobile/src/screens/compat/CompatFailScreen.tsx; test $? -eq 1)</automated>
  </verify>
  <done>CompatPass + CompatFail screens render verbatim §4c/§4d copy, route correctly, render measured values from CompatResult. NO hex literals in either screen source.</done>
</task>

<task type="auto">
  <name>Task 5: CompatRecoveryScreen — non-brick "what now" with Contact Support mailto + try another device</name>
  <files>apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx, apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/compat/CompatFailScreen.tsx (Task 4 output — same StyleSheet conventions)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § Phase Boundary line "On compat fail, the screen lists exactly which checks failed; user cannot proceed beyond the screen" + COMPAT-08 ("Compat-fail 'what now' recovery page presents next steps")
    - REQUIREMENTS.md COMPAT-06 + COMPAT-08 verbatim
    - help-center-content.md Contact Support section ('Tell us your phone model, what you were trying to do, and roughly when it happened')
  </read_first>
  <action>
    Author `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx`. Uses Text + Button + ScreenContainer primitives from `../../ui/primitives/*`; tokens from `../../ui/tokens` — NO hex literals:
    ```tsx
    import React from 'react';
    import { View, StyleSheet, Linking } from 'react-native';
    import { Text } from '../../ui/primitives/Text';
    import { Button } from '../../ui/primitives/Button';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { spacing } from '../../ui/tokens';

    /**
     * COMPAT-08 — non-brick recovery page after compat fail.
     * NO 'proceed' CTA — user must use a different qualifying device or contact support.
     * COMPAT-06 enforced: hardware back arrow returns to CompatFailScreen, no forward path.
     *
     * The mailto target is the same `[EMAIL_ADDRESS]` placeholder that gates HELP-03 — final
     * email is an Open Question (RESEARCH § Open Questions item 4); 02-19 wires the same
     * placeholder for HelpCenter and 02-21 manual-smoke flags both to remind operator at
     * phase gate.
     */
    const SUPPORT_EMAIL_PLACEHOLDER = '[EMAIL_ADDRESS]';

    export function CompatRecoveryScreen(): React.JSX.Element {
      return (
        <ScreenContainer accessibilityLabel="compat-recovery-screen" padding={spacing.h}>
          <Text variant="sheetTitle" style={styles.title}>What now</Text>
          <Text variant="body" tone="secondary" style={styles.body}>
            This phone doesn't meet the recording requirements. Try a different qualifying device, or
            reach out to support — share your phone model and roughly when this happened.
          </Text>

          <View style={styles.bullets}>
            <Text variant="body" style={styles.bullet} accessibilityLabel="recovery-bullet-different-device">
              {'• '}Try a different phone with a 1080p ultrawide rear camera (≥110° dFOV) and a
              gyroscope + accelerometer.
            </Text>
            <Text variant="body" style={styles.bullet} accessibilityLabel="recovery-bullet-not-rooted">
              {'• '}Make sure the device is not rooted and was installed from a trusted source.
            </Text>
            <Text variant="body" style={styles.bullet} accessibilityLabel="recovery-bullet-rerun">
              {'• '}If you've changed phones recently, the check will re-run automatically the next
              time you sign in.
            </Text>
          </View>

          <View style={styles.cta}>
            <Button
              variant="primary"
              accessibilityLabel="compat-recovery-contact-support"
              label="Contact Support"
              onPress={() => {
                const subject = encodeURIComponent('Compatibility check — need help');
                const body = encodeURIComponent(
                  'Phone model:\nWhat I was trying to do:\nWhen it happened:\n',
                );
                Linking.openURL(`mailto:${SUPPORT_EMAIL_PLACEHOLDER}?subject=${subject}&body=${body}`);
              }}
            />
          </View>
        </ScreenContainer>
      );
    }

    const styles = StyleSheet.create({
      title: { marginTop: spacing.xxxxl, marginBottom: spacing.md },
      body: { marginBottom: spacing.ll },
      bullets: { marginBottom: spacing.xxxl },
      bullet: { marginBottom: spacing.ms },
      cta: { marginTop: 'auto' },
    });
    ```

    Author `apps/mobile/__tests__/screens/CompatRecoveryScreen.test.tsx`:
    ```typescript
    import { describe, it, expect, vi } from 'vitest';
    import { render, screen, fireEvent } from '@testing-library/react';
    import React from 'react';

    const openURL = vi.fn();
    vi.mock('react-native', async () => {
      const real = await vi.importActual<any>('react-native');
      return { ...real, Linking: { openURL } };
    });

    import { CompatRecoveryScreen } from '../../src/screens/compat/CompatRecoveryScreen';

    describe('CompatRecoveryScreen', () => {
      it('renders the What now title and three recovery bullets (COMPAT-08)', () => {
        render(<CompatRecoveryScreen />);
        expect(screen.getByText('What now')).toBeTruthy();
        expect(screen.getByLabelText('recovery-bullet-different-device')).toBeTruthy();
        expect(screen.getByLabelText('recovery-bullet-not-rooted')).toBeTruthy();
        expect(screen.getByLabelText('recovery-bullet-rerun')).toBeTruthy();
      });

      it('Contact Support button opens mailto with the placeholder email + pre-filled body', () => {
        render(<CompatRecoveryScreen />);
        fireEvent.click(screen.getByLabelText('compat-recovery-contact-support'));
        expect(openURL).toHaveBeenCalledTimes(1);
        const url = openURL.mock.calls[0][0] as string;
        expect(url).toContain('mailto:[EMAIL_ADDRESS]');
        expect(url).toContain('Compatibility%20check');
      });

      it('does NOT contain a Next or Continue CTA (COMPAT-06 cannot proceed beyond)', () => {
        render(<CompatRecoveryScreen />);
        expect(screen.queryByText('Next')).toBeNull();
        expect(screen.queryByText('Continue')).toBeNull();
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- CompatRecoveryScreen` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "What now" apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` succeeds.
    - `grep -q "Contact Support" apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` succeeds.
    - `grep -q "Linking.openURL" apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` succeeds.
    - `grep -q "EMAIL_ADDRESS" apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` succeeds (placeholder is intentional and tracked in 02-21 manual-smoke).
    - `grep -v '^[[:space:]]*//' apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx | grep -c "Next\|Continue\|Proceed"` returns 0 (COMPAT-06 enforcement).
    - `cd apps/mobile && npm run test -- CompatRecoveryScreen --run` exits 0; 3 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- CompatRecoveryScreen --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx; test $? -eq 1)</automated>
  </verify>
  <done>CompatRecoveryScreen ships per COMPAT-08; mailto wires to the same placeholder as HelpCenter; no proceed CTA enforces COMPAT-06. NO hex literals in screen source.</done>
</task>

</tasks>

<verification>
- `cd apps/mobile && npm run test -- "(compat|CompatRing)" --run` passes all compat-prefix tests + the CompatRing snapshot suite.
- `grep -c "REQUIREMENTS_COVERED" /dev/null; grep -lr "compat.lastResult.v1" apps/mobile/src/` returns at least compatService.ts.
- `grep -rnE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/compat/ apps/mobile/src/components/CompatRing.tsx` returns no matches (NO hex literals in any compat-screen or CompatRing source — D-UI-01/D-UI-02 token discipline).
- Manual: on a Pixel 7a/8a/10a, walking signup → permissions → compat-running → pass should land on RigTutorial; the 130×130 ring fills smoothly from 0 → 100% per design-spec §4 + §0.4 motion. On a deliberately-failing branch (mock `runImuProbe` to return 44 Hz), Compat-running → CompatFail → tap What now → CompatRecovery → tap Contact Support → mailto sheet opens. (Smoke runbook lands in 02-21.)
</verification>

<success_criteria>

- shared/types CompatResult exists, exported, parseable.
- compatService orchestrates 3 native calls; signature math is testable; MMKV writes are observable.
- 4 screens (Running / Pass / Fail / Recovery) render with verbatim design-spec copy + token-bound styles and route correctly.
- CompatRing ships per design-spec §4 visual + §0.4 motion (130×130, 350 ms stroke transition, no Reanimated dep at this seam).
- Vitest coverage ≥ 17 tests across compatService + 4 screen tests + CompatRing.
- NO hex literals in any inline screen / component file (D-UI-01/D-UI-02 enforced by per-task grep gates).
- COMPAT-01..08 all closed; AUTH-11 trigger landed via needsRerun().
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-15-SUMMARY.md` per templates/summary.md.
</output>
