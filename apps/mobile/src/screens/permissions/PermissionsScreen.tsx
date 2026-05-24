/**
 * @doc PermissionsScreen — Phase 2 plan 02-10 PERM-01/02 implementation.
 *
 * Walks the user through Camera + Microphone permission prompts in sequence
 * (the OS prompt is modal, so they must be requested one at a time) and on
 * full grant transitions to the Compat route. Denied / blocked outcomes flip
 * the screen into the §4.1.1 recovery state where the only path forward is
 * "Open Settings".
 *
 * Copy is verbatim from design-spec §3a (idle) and §4.1.1 (recovery). The
 * idle icon is Lucide `Camera`; recovery flips to `Ban` (the Lucide analogue
 * of design-spec's `block` Material icon).
 *
 * State machine:
 *   idle → (tap) requesting → granted → navigation.replace('Compat')
 *                          ↘ denied / partial → (tap) openSettings()
 *
 * Analytics:
 *   permission_camera_requested / _granted / _denied
 *   permission_mic_requested    / _granted / _denied
 *
 * PERM-03 (coarse Location) is intentionally NOT prompted here — deferred to
 * Phase 4 per CONTEXT.md.
 *
 * iOS analogue lives in Phase 7: PERMISSIONS.IOS.CAMERA / .MICROPHONE swap
 * in conditionally on Platform.OS.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  PERMISSIONS,
  RESULTS,
  request,
  check,
  openSettings,
  type Permission,
} from 'react-native-permissions';
import { Camera, Ban } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { colors, spacing, radii } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import { logEvent } from '../../util/analytics';

type ScreenState = 'idle' | 'requesting' | 'denied' | 'partial';

// Platform-conditional permission constants. Android is the MVP target;
// iOS analogues land in Phase 7 but the wiring is parity-friendly today.
const CAMERA_PERMISSION: Permission =
  Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
const MIC_PERMISSION: Permission =
  Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;

interface NavigationLike {
  replace(route: string): void;
}

export default function PermissionsScreen() {
  const navigation = useNavigation<NavigationLike>();
  const setPermsGranted = useAppStore((s) => s.setPermsGranted);
  const { t } = useTranslation();

  const [state, setState] = useState<ScreenState>('idle');
  const [missing, setMissing] = useState<{ camera: boolean; mic: boolean }>({
    camera: false,
    mic: false,
  });

  // quick-260510-007 — Settings round-trip re-check.
  //
  // Original bug: handlePress called `openSettings()` and returned. Once the
  // user came back from Android Settings (where they granted the permission
  // they had previously denied), the screen stayed locked in 'denied' /
  // 'partial' state with the "Open Settings" button — they could never
  // advance to Compat. The original comment claimed "re-checking happens at
  // compat-screen entry" but there is no automatic transition off this
  // screen, so the user was structurally stuck.
  //
  // Fix: subscribe to `AppState` 'change' events. On 'active' transitions
  // (which fire when the user comes back from Settings), re-check both
  // permissions via react-native-permissions' `check()`. If both granted,
  // mirror the happy-path: persist `setPermsGranted` to MMKV and
  // `navigation.replace('Compat')`. Otherwise update the recovery state to
  // reflect current truth (camera-only granted → 'partial' with Mic flag,
  // etc.) so the body copy stays accurate.
  //
  // The initial check on mount also covers Path B/C cold-start gates: if a
  // user lands here with perms already granted (e.g. after killing the app
  // mid-recovery), useEffect re-checks and auto-advances rather than
  // requiring another button tap.
  //
  // `stateRef` mirrors `state` so the AppState callback (which closes over
  // the first-render `state` value) reads the current value without
  // re-subscribing on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    const checkAndAdvance = async () => {
      const [camResult, micResult] = await Promise.all([
        check(CAMERA_PERMISSION),
        check(MIC_PERMISSION),
      ]);
      if (cancelled) return;
      const camGranted = camResult === RESULTS.GRANTED;
      const micGranted = micResult === RESULTS.GRANTED;
      if (camGranted && micGranted) {
        setPermsGranted({
          camera: true,
          mic: true,
          grantedAt: new Date().toISOString(),
        });
        navigation.replace('Compat');
        return;
      }
      // Only flip recovery-state UI if we're already in the recovery branch;
      // 'idle' stays 'idle' (the user hasn't tapped Allow yet, so flipping
      // to 'denied' would prematurely surface §4.1.1 copy).
      if (stateRef.current === 'denied' || stateRef.current === 'partial') {
        const newMissing = { camera: !camGranted, mic: !micGranted };
        setMissing(newMissing);
        setState(newMissing.camera && newMissing.mic ? 'denied' : 'partial');
      }
    };
    checkAndAdvance();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') checkAndAdvance();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [navigation, setPermsGranted]);

  const handlePress = useCallback(async () => {
    // Recovery state: the only action is to deep-link into Settings. Tests
    // assert openSettings is called; the user returns via the OS back stack
    // and the AppState foreground listener (see useEffect above —
    // quick-260510-007) re-checks both permissions and auto-advances to
    // Compat if both are now granted, or refreshes the recovery copy if
    // only one was granted.
    if (state === 'denied' || state === 'partial') {
      await openSettings();
      return;
    }

    setState('requesting');

    // ---- Camera ----
    logEvent('permission_camera_requested');
    const camResult = await request(CAMERA_PERMISSION);
    const camGranted = camResult === RESULTS.GRANTED;
    if (camGranted) {
      logEvent('permission_camera_granted');
    } else {
      logEvent('permission_camera_denied', { result: String(camResult) });
    }

    // ---- Microphone (sequential — modal OS prompt can't overlap) ----
    logEvent('permission_mic_requested');
    const micResult = await request(MIC_PERMISSION);
    const micGranted = micResult === RESULTS.GRANTED;
    if (micGranted) {
      logEvent('permission_mic_granted');
    } else {
      logEvent('permission_mic_denied', { result: String(micResult) });
    }

    if (camGranted && micGranted) {
      setPermsGranted({
        camera: true,
        mic: true,
        grantedAt: new Date().toISOString(),
      });
      // Onboarding stack route name is "Compat" (CompatRunningScreen) —
      // see apps/mobile/src/navigation/OnboardingStack.tsx.
      navigation.replace('Compat');
      return;
    }

    const newMissing = { camera: !camGranted, mic: !micGranted };
    setMissing(newMissing);
    setState(newMissing.camera && newMissing.mic ? 'denied' : 'partial');
  }, [navigation, setPermsGranted, state]);

  // ---------------------------------------------------------------------
  // Derived view-model — copy is verbatim from design-spec.
  // ---------------------------------------------------------------------
  const isRecovery = state === 'denied' || state === 'partial';

  const title = isRecovery ? t('permissions.titleRecovery') : t('permissions.titleIdle');

  // Body copy:
  //   - idle      : §3a verbatim
  //   - denied    : §4.1.1 generic "Camera & Mic are required" message
  //   - partial   : names the specific missing permission so the user knows
  //                 which Settings toggle to flip
  let body: string;
  if (state === 'partial') {
    const missingName = missing.camera
      ? t('permissions.cameraName')
      : t('permissions.microphoneName');
    body = t('permissions.bodyPartialPrefix', { name: missingName });
  } else if (state === 'denied') {
    body = t('permissions.bodyDenied');
  } else {
    // Plan 03-11 (A1) — body copy tightened to a one-line runtime tooltip
    // (no manifesto). The longer privacy clause was filler at runtime; the
    // canonical privacy text lives in the consent block on Sign-up.
    body = t('permissions.bodyIdle');
  }

  const buttonLabel = isRecovery ? t('permissions.buttonOpenSettings') : t('permissions.buttonAllow');
  const isRequesting = state === 'requesting';
  const IconComp = isRecovery ? Ban : Camera;

  return (
    <ScreenContainer accessibilityLabel="Permissions screen" style={styles.container}>
      <View style={styles.contentWell}>
        <View style={styles.iconWell}>
          <IconComp size={44} color={colors.accent} strokeWidth={1.75} />
        </View>
        <View style={{ height: spacing.l }} />
        <Text
          variant="title28"
          tone="primary"
          style={styles.title}
          accessibilityLabel="permissions title"
        >
          {title}
        </Text>
        <View style={{ height: spacing.m }} />
        <Text
          variant="body"
          tone="secondary"
          style={styles.body}
          accessibilityLabel="permissions body"
        >
          {body}
        </Text>
        <View style={{ height: spacing.xl }} />
        {/* Plan 03-02 — CTA stacks immediately under the centered content
            block; alignSelf:'center' makes the button content-driven
            width instead of full bleed (02-COSMETIC-GAPS.md
            "Permissions / Camera & Mic screen" CTA position + width). */}
        <View style={styles.ctaWrap}>
          <Button
            variant="primary"
            label={buttonLabel}
            accessibilityLabel={buttonLabel}
            onPress={handlePress}
            disabled={isRequesting}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Plan 03-02 — drop `justifyContent: 'space-between'`. The CTA now
  // sits immediately under the centered content block (icon + title +
  // body) instead of being pinned to the bottom by a flex spacer
  // (02-COSMETIC-GAPS.md "Permissions / Camera & Mic screen" CTA
  // position rule).
  container: {
    paddingTop: 48,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  contentWell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Plan 03-02 — CTA wrapper centers the button at content-driven width.
  ctaWrap: {
    alignSelf: 'center',
  },
  iconWell: {
    width: 96,
    height: 96,
    borderRadius: radii.tile + 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    maxWidth: 280,
  },
  body: {
    textAlign: 'center',
    paddingHorizontal: spacing.l,
  },
});
