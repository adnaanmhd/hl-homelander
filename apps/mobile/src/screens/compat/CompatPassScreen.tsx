/**
 * CompatPassScreen — design-spec §4c (post Plan 03-03 auto-advance).
 *
 * Per 02-COSMETIC-GAPS.md § Compat-pass screen: the success state is now a
 * transient confirmation, not a gate. When all checks pass:
 *   1. Mount renders "You're in. All checks passed." + 40 ms haptic.
 *   2. After ~1.5 s the screen auto-routes to RigTutorial via
 *      `navigation.replace('RigTutorial')` — no manual tap needed.
 *   3. Hardware-back during the window unmounts the screen and
 *      `clearTimeout(t)` cancels the pending route call (T-3.2-05
 *      mitigation — same behavior as the pre-merge "didn't tap Continue"
 *      path).
 *
 * Storage warning banner (COMPAT-03) still renders inline when
 * freeStorageGB.warningOnly === true; it co-exists with the auto-advance
 * timer (the user sees the banner during the 1.5 s window before the
 * RigTutorial transition).
 *
 * Phase 2 plan 02-15 Task 4 lineage. NO hex literals — every color comes
 * from `colors.*` tokens (design-spec §0.1).
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import HapticFeedback from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';
import { Text } from '../../ui/primitives/Text';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing, radii } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import { decodeGoogleSubFromJwt } from '../../lib/jwtSub';
import { secureMmkv } from '../../state/mmkv';
import { practiceDoneKey } from '../../state/keys';
import { fetchMe } from '../../services/profileService';
import { HumynUpload } from '../../native/HumynUpload';

interface NavigationLike {
  replace(route: string): void;
  reset: (state: { index: number; routes: { name: string }[] }) => void;
  getParent: () => NavigationLike | null | undefined;
}

// Auto-advance window per 02-COSMETIC-GAPS.md § Compat-pass screen ("≤1.5 s
// with the existing 40 ms haptic"). Long enough for the user to register
// the success state; short enough that it doesn't feel like a gate.
const AUTO_ADVANCE_MS = 1500;

export default function CompatPassScreen() {
  const navigation = useNavigation<NavigationLike>();
  const compat = useAppStore((s) => s.compatLastResult);
  const { t } = useTranslation();

  useEffect(() => {
    // 40 ms haptic on mount per design-spec §4c. react-native-haptic-feedback
    // is the chosen library (planner discretion). Best-effort: silently
    // no-ops if the native module isn't registered (the import default is a
    // typed function reference; if missing, the trigger call no-ops).
    try {
      HapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch {
      /* haptic best-effort */
    }
    // Phase 3 item 3 (2026-06-10, Bug 2) — gate double-check, CompatPass leg.
    // fetchMe() seeds the local practiceDoneKey from the server's
    // practice_completed_at as a side effect; kicking it at mount gives the
    // server ~1.5 s (the AUTO_ADVANCE window) to overrule a stale local cache
    // before the timer below reads the flag. Offline/slow → flag unchanged →
    // the practice fall-through stays the safe default (and RigTutorial runs
    // its own double-check on mount).
    void fetchMe().catch(() => undefined);
    // BUG-5 (D-BATTERY) → Phase 5 (2026-06-10): the best-effort battery-
    // optimization exemption ask, RELOCATED here from PermissionsScreen.
    // This mount is the first onboarding point where the compat probes have
    // finished and no camera is open — asking from PermissionsScreen raced
    // the EncoderProbe/ImuProbe camera sessions on CompatRunningScreen (a
    // system dialog over a held camera = disconnect mid-probe). FIRE-AND-
    // FORGET (deliberately NOT awaited): the OEM-flaky native call never
    // delays the 1.5 s auto-advance, and the dialog opening over the next
    // screen is fine — accept/deny/dismiss all return to the app. Only opens
    // the AOSP dialog when not already exempt. The per-vendor OEM autostart
    // walkthrough lives in the Help Center. `*Safe` = no-op without the
    // native module (iOS / JSDOM) and never throws.
    void (async () => {
      if (!(await HumynUpload.isBatteryOptimizationExemptSafe())) {
        await HumynUpload.requestBatteryOptimizationExemptionSafe();
      }
    })();
  }, []);

  useEffect(() => {
    // Auto-advance after the success confirmation (Plan 03-03). Bug 5 / D7 — a
    // returning user whose account already completed practice (local ONB-08 flag
    // seeded at sign-in from the server's practice_completed_at, or set on this
    // device) skips the tutorial and resets straight into MainTabs; everyone
    // else continues to RigTutorial. Mirrors computeInitialRoute step 5 — this is
    // what makes Bug 5/D7 actually skip on a new device's FIRST launch. Cleanup
    // cancels the pending nav if the user hardware-backs out first (T-3.2-05).
    const timer = setTimeout(() => {
      const sub = decodeGoogleSubFromJwt(useAppStore.getState().jwt);
      const practiceDone = secureMmkv.getBoolean(practiceDoneKey(sub)) ?? false;
      if (practiceDone) {
        // MainTabs lives on the parent RootNativeStack — reset on the parent
        // when present (we're nested in OnboardingStack), same idiom as
        // PracticeCompleteScreen.
        const parent = navigation.getParent?.();
        const target = parent && typeof parent.reset === 'function' ? parent : navigation;
        target.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      } else {
        navigation.replace('RigTutorial');
      }
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  const showStorageWarning = compat?.checks.freeStorageGB.warningOnly === true;

  return (
    <ScreenContainer accessibilityLabel="CompatPass screen" padding={spacing.h}>
      <View style={styles.body}>
        <Text variant="title28" style={styles.title}>
          {t('compat.pass.title')}
        </Text>
        <Text variant="body" tone="secondary" style={styles.sub}>
          {t('compat.pass.subtitle')}
        </Text>
        {showStorageWarning ? (
          <View style={styles.warningBanner} accessibilityLabel="compat-storage-warning">
            <Text variant="caption" style={styles.warningText}>
              {t('compat.pass.storageWarningPrefix', {
                gb: compat!.checks.freeStorageGB.measuredGB.toFixed(1),
              })}
            </Text>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Center the success body vertically — auto-advance fires before any CTA
  // would render, so the screen is a transient confirmation, not a gate.
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { textAlign: 'center' },
  sub: { marginTop: spacing.m, textAlign: 'center' },
  warningBanner: {
    marginTop: spacing.xxxl,
    backgroundColor: colors.bannerWarnBg,
    padding: spacing.mdl,
    borderRadius: radii.input,
  },
  warningText: { color: colors.bannerWarnText },
});
