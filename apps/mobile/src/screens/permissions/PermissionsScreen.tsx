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
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  PERMISSIONS,
  RESULTS,
  request,
  openSettings,
  type Permission,
} from 'react-native-permissions';
import { Camera, Ban } from 'lucide-react-native';

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

  const [state, setState] = useState<ScreenState>('idle');
  const [missing, setMissing] = useState<{ camera: boolean; mic: boolean }>({
    camera: false,
    mic: false,
  });

  const handlePress = useCallback(async () => {
    // Recovery state: the only action is to deep-link into Settings. Tests
    // assert openSettings is called; the user returns via the OS back stack
    // and re-checking happens at compat-screen entry (plan 02-11).
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

  const title = isRecovery ? 'Camera & Mic\nare required' : 'Camera & Mic\nPermissions';

  // Body copy:
  //   - idle      : §3a verbatim
  //   - denied    : §4.1.1 generic "Camera & Mic are required" message
  //   - partial   : names the specific missing permission so the user knows
  //                 which Settings toggle to flip
  let body: string;
  if (state === 'partial') {
    const missingName = missing.camera ? 'Camera' : 'Microphone';
    body = `${missingName} access is required. Open Settings to enable.`;
  } else if (state === 'denied') {
    body = 'Camera & Mic are required. Open Settings to enable.';
  } else {
    body =
      'Used only while you hit record. Nothing leaves your phone until you stop and we encrypt-upload.';
  }

  const buttonLabel = isRecovery ? 'Open Settings' : 'Allow access';
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
      </View>
      <Button
        variant="primary"
        label={buttonLabel}
        accessibilityLabel={buttonLabel}
        onPress={handlePress}
        disabled={isRequesting}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 48,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  contentWell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
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
