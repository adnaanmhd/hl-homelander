/**
 * @doc BatteryOptimizationScreen — Plan 05-07 (UP-09), the first-upload
 * battery-optimization walkthrough.
 *
 * Surfaced ONCE at the user's first upload (Plan 05-08 wires the call site via
 * {@link shouldShowBatteryOptimizationPrompt}). The upload pipeline already
 * survives backgrounding via the FGS + the UIDT JobService, but aggressive OEM
 * "battery savers" (MIUI/HyperOS, ColorOS, FunTouch, OneUI, …) still kill
 * non-whitelisted background apps. This screen:
 *  1. offers the STABLE AOSP "allow unrestricted battery" prompt
 *     (`HumynUpload.requestBatteryOptimizationExemption`) and reflects the
 *     post-prompt state (`isBatteryOptimizationExempt`);
 *  2. shows per-vendor walkthrough steps (Xiaomi MIUI, Oppo ColorOS, Vivo
 *     FunTouch, Samsung OneUI, stock Android) with copy matching
 *     `help-center-content.md`'s OEM line;
 *  3. renders a "Open Autostart settings" deep-link button ONLY when
 *     `HumynUpload.oemAutostartAvailable()` resolves true → `openOemAutostart()`
 *     — the standalone fallback line ("Settings → Apps → Homelander → Battery →
 *     Unrestricted, and turn on Autostart if your phone has it") is ALWAYS
 *     shown so a missing/dead deep-link never strands the user (Pitfall 1);
 *  4. on dismiss ("Done" / "Skip for now") records `UPLOAD_FIRST_PROMPT_SHOWN`
 *     + `UPLOAD_FIRST_PROMPT_VERSION` (the current app version) in the SHARED
 *     MMKV instance (D-STATE-01 — no second instance) and calls `onDone()`.
 *
 * `shouldShowBatteryOptimizationPrompt()` returns true if it's never been shown
 * OR was last shown for an OLDER app version (re-show after a force-upgrade —
 * MIUI may revert the exemption on update, idea-brief.md §7.4).
 *
 * Every native-module call is try/caught (the `*Safe` HumynUpload variants) so a
 * build without the module / a JSDOM test doesn't crash (mirrors HumynBattery.ts).
 * No new design tokens/curves — reuses ScreenContainer / Text / Button / spacing.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import ScreenContainer from '../../ui/primitives/ScreenContainer';
import Text from '../../ui/primitives/Text';
import Button from '../../ui/primitives/Button';
import { Pressable } from '../../ui/primitives/Pressable';
import { spacing } from '../../ui/tokens';
import { HumynUpload } from '../../native/HumynUpload';
import { secureMmkv } from '../../state/mmkv';
import { KEYS } from '../../state/keys';
import { compareSemver } from '../../util/semver';
import { getFlavorContext } from '../../native/AppFlavor';

/** The current app version (`versionName`), or `'0.0.0'` when the flavor module is absent. */
function currentAppVersion(): string {
  try {
    return getFlavorContext().versionName || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Whether the first-upload battery-optimization walkthrough should be shown:
 * true if `UPLOAD_FIRST_PROMPT_SHOWN` is unset, OR `UPLOAD_FIRST_PROMPT_VERSION`
 * is older than the current app version (re-show after a force-upgrade). Never
 * throws — a bad/missing MMKV value reads as "not shown" → show it.
 */
export function shouldShowBatteryOptimizationPrompt(): boolean {
  try {
    const shown = secureMmkv.getBoolean(KEYS.UPLOAD_FIRST_PROMPT_SHOWN);
    if (!shown) return true;
    const shownVersion = secureMmkv.getString(KEYS.UPLOAD_FIRST_PROMPT_VERSION) ?? '0.0.0';
    return compareSemver(shownVersion, currentAppVersion()) < 0;
  } catch {
    return true;
  }
}

/** Mark the walkthrough as shown for the current app version. */
function markShown(): void {
  try {
    secureMmkv.set(KEYS.UPLOAD_FIRST_PROMPT_SHOWN, true);
    secureMmkv.set(KEYS.UPLOAD_FIRST_PROMPT_VERSION, currentAppVersion());
  } catch {
    /* MMKV unavailable (JSDOM / no native module) — nothing to persist */
  }
}

interface VendorStep {
  vendor: string;
  steps: string;
}

const VENDOR_KEYS = ['xiaomi', 'oppo', 'vivo', 'samsung', 'stock'] as const;

export interface BatteryOptimizationScreenProps {
  /** Called when the user taps "Done" / "Skip for now" (Plan 05-08 navigates away). */
  onDone?: () => void;
}

export default function BatteryOptimizationScreen({
  onDone,
}: BatteryOptimizationScreenProps): React.JSX.Element {
  const [exempt, setExempt] = useState<boolean | null>(null);
  const [oemAvailable, setOemAvailable] = useState(false);
  const { t } = useTranslation();

  const vendorSteps: VendorStep[] = useMemo(
    () =>
      VENDOR_KEYS.map((k) => ({
        vendor: t(`batteryOpt.vendors.${k}.label`),
        steps: t(`batteryOpt.vendors.${k}.steps`),
      })),
    [t],
  );

  // Boot-time-ish probes — try/caught via the *Safe HumynUpload variants.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [isExempt, hasOem] = await Promise.all([
        HumynUpload.isBatteryOptimizationExemptSafe(),
        HumynUpload.oemAutostartAvailableSafe(),
      ]);
      if (cancelled) return;
      setExempt(isExempt);
      setOemAvailable(hasOem);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onAllowUnrestricted = useCallback(async () => {
    await HumynUpload.requestBatteryOptimizationExemptionSafe();
    // Re-check after the user returns from the system prompt.
    const isExempt = await HumynUpload.isBatteryOptimizationExemptSafe();
    setExempt(isExempt);
  }, []);

  const onOpenOemAutostart = useCallback(async () => {
    await HumynUpload.openOemAutostartSafe();
  }, []);

  const onDismiss = useCallback(() => {
    markShown();
    onDone?.();
  }, [onDone]);

  const statusLine =
    exempt == null
      ? null
      : exempt
        ? t('batteryOpt.statusAllowed')
        : t('batteryOpt.statusStillRestricted');

  return (
    <ScreenContainer accessibilityLabel="battery-optimization-screen" padding={spacing.h}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="sheetTitle" style={styles.title}>
          {t('batteryOpt.title')}
        </Text>
        <Text variant="body" tone="secondary" style={styles.body}>
          {t('batteryOpt.body')}
        </Text>

        <Button
          variant="primary"
          accessibilityLabel="battery-opt-allow-unrestricted"
          label={t('batteryOpt.buttonAllow')}
          onPress={onAllowUnrestricted}
          style={styles.cta}
        />
        {statusLine != null && (
          <Text variant="caption" tone="secondary" style={styles.status}>
            {statusLine}
          </Text>
        )}

        <Text variant="body" style={styles.sectionHeading}>
          {t('batteryOpt.sectionHow')}
        </Text>
        {vendorSteps.map((v) => (
          <View key={v.vendor} style={styles.vendorBlock}>
            <Text variant="body" style={styles.vendorName}>
              {v.vendor}
            </Text>
            <Text variant="caption" tone="secondary">
              {v.steps}
            </Text>
          </View>
        ))}

        {oemAvailable && (
          <Button
            variant="outline"
            accessibilityLabel="battery-opt-open-oem-autostart"
            label={t('batteryOpt.buttonOpenAutostart')}
            onPress={onOpenOemAutostart}
            style={styles.cta}
          />
        )}
        <Text variant="caption" tone="secondary" style={styles.fallback}>
          {t('batteryOpt.fallbackCopy')}
        </Text>

        <Button
          variant="primary"
          accessibilityLabel="battery-opt-done"
          label={t('batteryOpt.buttonDone')}
          onPress={onDismiss}
          style={styles.cta}
        />
        <Pressable accessibilityLabel="battery-opt-skip" onPress={onDismiss} style={styles.skip}>
          <Text variant="caption" tone="secondary">
            {t('batteryOpt.buttonSkip')}
          </Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.xxxl, paddingBottom: spacing.xxxxl },
  title: { marginBottom: spacing.md },
  body: { marginBottom: spacing.xxxl },
  cta: { marginTop: spacing.l },
  status: { marginTop: spacing.s },
  sectionHeading: { marginTop: spacing.xxxl, marginBottom: spacing.md },
  vendorBlock: { marginBottom: spacing.l },
  vendorName: { marginBottom: spacing.xs },
  fallback: { marginTop: spacing.md },
  skip: { marginTop: spacing.l, alignItems: 'center', paddingVertical: spacing.s },
});
