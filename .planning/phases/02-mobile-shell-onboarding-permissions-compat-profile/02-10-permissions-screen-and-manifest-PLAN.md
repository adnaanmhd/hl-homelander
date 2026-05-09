---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 10
id: 02-10-permissions-screen-and-manifest
name: PermissionsScreen (Camera + Mic) + AndroidManifest declarations + verify-merged-manifests CI extension
type: execute
wave: 2
depends_on: [02-05-navigation-skeleton]
files_modified:
  - apps/mobile/android/app/src/main/AndroidManifest.xml
  - apps/mobile/scripts/verify-merged-manifests.sh
  - apps/mobile/src/screens/permissions/PermissionsScreen.tsx
  - apps/mobile/__tests__/screens/PermissionsScreen.test.tsx
autonomous: true
requirements: [PERM-01, PERM-02, PERM-04]
must_haves:
  truths:
    - 'Base AndroidManifest declares CAMERA, RECORD_AUDIO, WAKE_LOCK, FOREGROUND_SERVICE, FOREGROUND_SERVICE_CAMERA, FOREGROUND_SERVICE_MICROPHONE, FOREGROUND_SERVICE_DATA_SYNC'
    - 'Base manifest does NOT declare REQUEST_INSTALL_PACKAGES (apkRollout-only), POST_NOTIFICATIONS (no MVP notif channel), ACCESS_FINE_LOCATION (coarse-only deferred to Phase 4)'
    - 'PermissionsScreen requests Camera + Mic via react-native-permissions in sequence; on full grant → setPermsGranted + navigate to Compat'
    - "Denied/blocked state copy variant shows 'Open Settings' button that calls openSettings()"
    - 'verify-merged-manifests.sh CI script asserts all required permissions present + forbidden ones absent'
    - 'PERM-03 (coarse Location) is intentionally NOT prompted in Phase 2 — deferred to Phase 4'
  artifacts:
    - path: 'apps/mobile/android/app/src/main/AndroidManifest.xml'
      provides: 'Phase 2 base permissions declared'
      contains: 'android.permission.CAMERA'
    - path: 'apps/mobile/scripts/verify-merged-manifests.sh'
      provides: 'Extended CI gate for required + forbidden Phase 2 permissions'
      contains: 'CAMERA'
    - path: 'apps/mobile/src/screens/permissions/PermissionsScreen.tsx'
      provides: 'Camera+Mic request screen with denied recovery'
      contains: 'react-native-permissions'
  key_links:
    - from: 'apps/mobile/src/screens/permissions/PermissionsScreen.tsx'
      to: 'react-native-permissions'
      via: 'request(PERMISSIONS.ANDROID.CAMERA), request(RECORD_AUDIO)'
      pattern: 'PERMISSIONS.ANDROID.CAMERA'
---

<objective>
Land the manifest-only permission declarations (PERM-04), the runtime Camera + Mic prompt screen (PERM-01/02 per design-spec §3a), and extend the existing CI manifest-verification script to enforce the Phase 2 permission shape.

Purpose: PERM-03 (coarse Location) is deferred to Phase 4 per CONTEXT.md decision. PERM-04 manifest entries enable Phase 3 capture (foreground service types) and Phase 4 lifecycle (wake lock).
Output: a screen that walks through Camera + Mic prompts then routes to Compat.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/android/app/src/main/AndroidManifest.xml
@apps/mobile/android/app/src/apkRollout/AndroidManifest.xml
@apps/mobile/scripts/verify-merged-manifests.sh
@design-spec.md
@apps/mobile/src/state/appStore.ts

<interfaces>
<!-- design-spec.md §3a Camera & Mic state copy -->
- Icon: `photo_camera`
- Title: "Camera & Mic\nPermissions"
- Body: "Used only while you hit record. Nothing leaves your phone until you stop and we encrypt-upload."
- Button: "Allow access"

<!-- 4.1.1 Denied / partial state -->

- Replace icon to `block`
- Body: "Camera & Mic are required. Open Settings to enable."
- Primary CTA: "Open Settings" → openAppSettings()

<!-- react-native-permissions API -->

import { PERMISSIONS, RESULTS, request, openSettings } from 'react-native-permissions';
const result = await request(PERMISSIONS.ANDROID.CAMERA);
// RESULTS.GRANTED | DENIED | BLOCKED | UNAVAILABLE
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                           | Description                                        |
| -------------------------------------------------- | -------------------------------------------------- |
| Android OS permission system → app                 | OS-mediated; app cannot grant itself permissions   |
| Manifest entries → Play Store / install-time grant | static declarations; cannot be modified at runtime |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                                                    | Disposition | Mitigation Plan                                                                                                                                     |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.10-01 | Elevation of Privilege | A future plan accidentally adds REQUEST_INSTALL_PACKAGES to the base manifest (Play Store would auto-reject) | mitigate    | verify-merged-manifests.sh CI gate explicitly asserts the absence of this permission in the base manifest output. Plan-checker re-runs on every PR. |
| T-2.10-02 | Elevation of Privilege | POST_NOTIFICATIONS sneaks into base manifest (PROJECT.md hard rule violation)                                | mitigate    | CI gate asserts `! grep POST_NOTIFICATIONS android/app/build/intermediates/merged_manifest/.../AndroidManifest.xml` after merge.                    |
| T-2.10-03 | Information Disclosure | ACCESS_FINE_LOCATION smuggled in (PROJECT.md coarse-only rule)                                               | mitigate    | CI gate asserts absence; Phase 4 plan owners must explicitly decide before any location permission lands.                                           |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Declare Phase 2 permissions in base AndroidManifest + extend CI verify script</name>
  <files>apps/mobile/android/app/src/main/AndroidManifest.xml, apps/mobile/scripts/verify-merged-manifests.sh</files>
  <read_first>
    - apps/mobile/android/app/src/main/AndroidManifest.xml (current Phase 1 base manifest — INTERNET + ACCESS_NETWORK_STATE only per 02-PATTERNS.md lines 729-742)
    - apps/mobile/android/app/src/apkRollout/AndroidManifest.xml (Phase 1 flavor scoping for REQUEST_INSTALL_PACKAGES — DO NOT touch)
    - apps/mobile/scripts/verify-merged-manifests.sh (Phase 1 plan 01-09 pattern — confirm existing assertions for REQUEST_INSTALL_PACKAGES flavor scoping)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "AndroidManifest.xml (modify — add Phase 2 permissions)" lines 724-763
  </read_first>
  <action>
    1. Edit `apps/mobile/android/app/src/main/AndroidManifest.xml`:
       After the existing `<uses-permission android:name="android.permission.INTERNET" />` and `ACCESS_NETWORK_STATE` lines, add:
       ```xml
       <uses-permission android:name="android.permission.CAMERA" />
       <uses-permission android:name="android.permission.RECORD_AUDIO" />
       <uses-permission android:name="android.permission.WAKE_LOCK" />
       <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
       <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
       <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
       <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
       ```
       Also add `<uses-feature android:name="android.hardware.camera.any" android:required="true" />` and `<uses-feature android:name="android.hardware.sensor.gyroscope" android:required="true" />` and `<uses-feature android:name="android.hardware.sensor.accelerometer" android:required="true" />` so Play Store filters incompatible devices.

    2. Extend `apps/mobile/scripts/verify-merged-manifests.sh` to add Phase 2 assertions. Append (after the existing REQUEST_INSTALL_PACKAGES checks):
       ```bash
       # Phase 2 — required base permissions (PERM-04)
       REQUIRED_BASE_PERMS=(
         "android.permission.CAMERA"
         "android.permission.RECORD_AUDIO"
         "android.permission.WAKE_LOCK"
         "android.permission.FOREGROUND_SERVICE"
         "android.permission.FOREGROUND_SERVICE_CAMERA"
         "android.permission.FOREGROUND_SERVICE_MICROPHONE"
         "android.permission.FOREGROUND_SERVICE_DATA_SYNC"
         "android.permission.INTERNET"
         "android.permission.ACCESS_NETWORK_STATE"
       )
       for perm in "${REQUIRED_BASE_PERMS[@]}"; do
         if ! grep -q "$perm" "$BASE_MANIFEST_OUT"; then
           echo "FAIL: missing $perm in base manifest" >&2
           exit 1
         fi
       done

       # Phase 2 — FORBIDDEN in base manifest (must be flavor-scoped or absent)
       FORBIDDEN_BASE_PERMS=(
         "android.permission.REQUEST_INSTALL_PACKAGES"
         "android.permission.POST_NOTIFICATIONS"
         "android.permission.ACCESS_FINE_LOCATION"
         "android.permission.ACCESS_COARSE_LOCATION"
       )
       for perm in "${FORBIDDEN_BASE_PERMS[@]}"; do
         if grep -q "$perm" "$BASE_MANIFEST_OUT"; then
           echo "FAIL: forbidden $perm declared in base manifest (must be flavor-scoped or deferred)" >&2
           exit 1
         fi
       done
       ```
       (`$BASE_MANIFEST_OUT` is the path to the assembled apk's merged manifest used by the existing script — adapt the variable name to whatever Phase 1's script uses.)

    3. Run `cd apps/mobile && bash scripts/verify-merged-manifests.sh` after a fresh `./gradlew assembleApkRolloutDebug` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -c "android.permission.CAMERA" apps/mobile/android/app/src/main/AndroidManifest.xml` returns 1.
    - `grep -c "android.permission.RECORD_AUDIO" apps/mobile/android/app/src/main/AndroidManifest.xml` returns 1.
    - `grep -c "FOREGROUND_SERVICE_CAMERA" apps/mobile/android/app/src/main/AndroidManifest.xml` returns 1.
    - `! grep -q "REQUEST_INSTALL_PACKAGES" apps/mobile/android/app/src/main/AndroidManifest.xml` succeeds.
    - `! grep -q "POST_NOTIFICATIONS" apps/mobile/android/app/src/main/AndroidManifest.xml` succeeds.
    - `! grep -q "ACCESS_FINE_LOCATION" apps/mobile/android/app/src/main/AndroidManifest.xml` succeeds.
    - `grep -q "REQUIRED_BASE_PERMS" apps/mobile/scripts/verify-merged-manifests.sh` succeeds.
    - `grep -q "FORBIDDEN_BASE_PERMS" apps/mobile/scripts/verify-merged-manifests.sh` succeeds.
    - `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` exits 0.
    - `cd apps/mobile && bash scripts/verify-merged-manifests.sh` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && grep -q "android.permission.CAMERA" android/app/src/main/AndroidManifest.xml && ! grep -q "POST_NOTIFICATIONS" android/app/src/main/AndroidManifest.xml && ! grep -q "ACCESS_FINE_LOCATION" android/app/src/main/AndroidManifest.xml && cd android && ./gradlew :app:assembleApkRolloutDebug -q && cd .. && bash scripts/verify-merged-manifests.sh</automated>
  </verify>
  <done>Base manifest has CAMERA + MIC + foreground-service permissions; CI gate enforces required + forbidden lists; merged manifest verification passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: PermissionsScreen with Camera+Mic sequence + denied recovery</name>
  <files>apps/mobile/src/screens/permissions/PermissionsScreen.tsx, apps/mobile/__tests__/screens/PermissionsScreen.test.tsx (NEW)</files>
  <read_first>
    - design-spec.md §3 lines 172-202 (Permissions layout + 3a state copy + 4.1.1 denied recovery)
    - apps/mobile/src/screens/permissions/PermissionsScreen.tsx (current 02-05 stub)
    - apps/mobile/src/state/appStore.ts (setPermsGranted action)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "PermissionsScreen.tsx" (analog to SignIn.tsx — same pattern)
    - engineering-handoff.md §4.1 (Permissions state machine)
  </read_first>
  <behavior>
    Test 1: Initial mount → renders title "Camera & Mic\nPermissions", body "Used only while you hit record...", button "Allow access".
    Test 2: Tap "Allow access" → calls request(CAMERA), then request(RECORD_AUDIO) (sequential, since the OS prompt is modal). Both granted → setPermsGranted({camera: true, mic: true, grantedAt: <ISO>}) + navigation.replace('Compat').
    Test 3: Camera denied → state transitions to 'denied'; copy changes to "Camera & Mic are required. Open Settings to enable."; primary button label changes to "Open Settings"; tap → openSettings called.
    Test 4: Mic denied (camera granted) → 'partial' state; copy specifies the missing permission; CTA "Open Settings".
    Test 5: BLOCKED result is treated as denied (Open Settings is the only recovery).
    Test 6: Successful grant fires `permission_camera_granted` + `permission_mic_granted` analytics events; denial fires `permission_camera_denied` / `permission_mic_denied`.
  </behavior>
  <action>
    Replace `apps/mobile/src/screens/permissions/PermissionsScreen.tsx`:
    ```tsx
    import React, { useState, useCallback } from 'react';
    import { View, StyleSheet } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { PERMISSIONS, RESULTS, request, openSettings } from 'react-native-permissions';
    import { Camera, Mic, Ban, Shield } from 'lucide-react-native';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { Text } from '../../ui/primitives/Text';
    import { Button } from '../../ui/primitives/Button';
    import { colors, spacing, radii } from '../../ui/tokens';
    import { useAppStore } from '../../state/appStore';
    import { logEvent } from '../../util/analytics';

    type State = 'idle' | 'granted' | 'denied' | 'partial';

    export default function PermissionsScreen() {
      const navigation = useNavigation<any>();
      const setPermsGranted = useAppStore((s) => s.setPermsGranted);
      const [state, setState] = useState<State>('idle');
      const [missing, setMissing] = useState<{ camera: boolean; mic: boolean }>({ camera: false, mic: false });
      const [loading, setLoading] = useState(false);

      const handleAllow = useCallback(async () => {
        if (state === 'denied' || state === 'partial') {
          await openSettings();
          return;
        }
        setLoading(true);
        logEvent('permission_camera_requested');
        const camResult = await request(PERMISSIONS.ANDROID.CAMERA);
        const camGranted = camResult === RESULTS.GRANTED;
        if (camGranted) logEvent('permission_camera_granted');
        else logEvent('permission_camera_denied', { result: String(camResult) });

        logEvent('permission_mic_requested');
        const micResult = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
        const micGranted = micResult === RESULTS.GRANTED;
        if (micGranted) logEvent('permission_mic_granted');
        else logEvent('permission_mic_denied', { result: String(micResult) });

        setLoading(false);
        if (camGranted && micGranted) {
          setPermsGranted({ camera: true, mic: true, grantedAt: new Date().toISOString() });
          setState('granted');
          navigation.replace('Compat');
          return;
        }
        const newMissing = { camera: !camGranted, mic: !micGranted };
        setMissing(newMissing);
        setState(newMissing.camera && newMissing.mic ? 'denied' : 'partial');
      }, [navigation, setPermsGranted, state]);

      const isRecovery = state === 'denied' || state === 'partial';
      const titleLines = isRecovery ? 'Camera & Mic\nare required' : 'Camera & Mic\nPermissions';
      const body = isRecovery
        ? `Open Settings to enable ${
            state === 'partial' ? (missing.camera ? 'Camera' : 'Microphone') : 'Camera & Mic'
          }.`
        : 'Used only while you hit record. Nothing leaves your phone until you stop and we encrypt-upload.';
      const buttonLabel = isRecovery ? 'Open Settings' : 'Allow access';
      const IconComp = isRecovery ? Ban : Camera;

      return (
        <ScreenContainer style={{ paddingTop: 48, paddingHorizontal: 28, justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <View style={styles.iconWell}>
              <IconComp size={44} color={colors.accent} strokeWidth={1.75} />
            </View>
            <View style={{ height: spacing.l }} />
            <Text variant="title28" tone="primary" style={{ textAlign: 'center', maxWidth: 280 }} accessibilityLabel="permissions title">
              {titleLines}
            </Text>
            <View style={{ height: spacing.m }} />
            <Text variant="body" tone="secondary" style={{ textAlign: 'center', paddingHorizontal: spacing.l }} accessibilityLabel="permissions body">
              {body}
            </Text>
          </View>
          <Button variant="primary" onPress={handleAllow} disabled={loading} accessibilityLabel={buttonLabel}>
            {loading ? 'Requesting…' : buttonLabel}
          </Button>
        </ScreenContainer>
      );
    }

    const styles = StyleSheet.create({
      iconWell: {
        width: 96,
        height: 96,
        borderRadius: radii.tile + 10,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      },
    });
    ```

    Author `__tests__/screens/PermissionsScreen.test.tsx` covering the 6 behaviors. Mock `react-native-permissions` per test (the global mock in vitest.setup.ts can be overridden per test); mock the navigation hook + appStore hooks + analytics.

  </action>
  <acceptance_criteria>
    - `grep -q "Camera & Mic" apps/mobile/src/screens/permissions/PermissionsScreen.tsx` succeeds.
    - `grep -q "Used only while you hit record" apps/mobile/src/screens/permissions/PermissionsScreen.tsx` succeeds.
    - `grep -q "Allow access" apps/mobile/src/screens/permissions/PermissionsScreen.tsx` succeeds.
    - `grep -q "Open Settings" apps/mobile/src/screens/permissions/PermissionsScreen.tsx` succeeds.
    - `grep -q "PERMISSIONS.ANDROID.CAMERA" apps/mobile/src/screens/permissions/PermissionsScreen.tsx` succeeds.
    - `grep -q "PERMISSIONS.ANDROID.RECORD_AUDIO" apps/mobile/src/screens/permissions/PermissionsScreen.tsx` succeeds.
    - `grep -q "navigation.replace('Compat')" apps/mobile/src/screens/permissions/PermissionsScreen.tsx` succeeds.
    - `cd apps/mobile && npm run test -- __tests__/screens/PermissionsScreen.test.tsx` passes (6 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/screens/PermissionsScreen.test.tsx</automated>
  </verify>
  <done>PermissionsScreen requests Camera + Mic in sequence; denied recovery copy + openSettings link; 6 unit tests pass.</done>
</task>

</tasks>

<verification>
- Base manifest declares Phase 2 permissions; forbidden ones absent.
- CI gate enforces required + forbidden lists.
- PermissionsScreen ships verbatim §3a copy + 4.1.1 recovery state.
- 6 unit tests cover happy path + denied + partial + open-settings.
</verification>

<success_criteria>

- PERM-01, PERM-02, PERM-04 implemented.
- PERM-03 (coarse Location) intentionally NOT implemented — Phase 4 territory; T-2.10-03 mitigation enforces.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-10-SUMMARY.md` documenting the manifest delta, the FORBIDDEN_BASE_PERMS list, and the rationale for deferring PERM-03.
</output>
