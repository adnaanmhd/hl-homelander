/**
 * BatteryOptimizationGuide — the AOSP battery-exemption ask + per-vendor OEM
 * autostart walkthrough (Xiaomi/MIUI, Oppo/ColorOS, Vivo, Samsung, stock).
 *
 * BUG-5 (2026-06-09 — D-BATTERY): relocated from the standalone first-upload
 * onboarding modal (`onboarding/BatteryOptimizationScreen`, now deleted) into the
 * Help Center, rendered inside a collapsed AccordionItem by HelpCenterScreen. The
 * best-effort AOSP exemption ASK also fires once during onboarding now
 * (PermissionsScreen) — this surface is the durable reference + the OEM autostart
 * deep-link the onboarding ask can't cover.
 *
 * Reuses the existing `batteryOpt.*` i18n + the HumynUpload `*Safe` bridges
 * (try/caught — renders without the native module / in JSDOM). No new design
 * tokens/curves, no new copy. A plain View (NOT a ScrollView) — HelpCenterScreen
 * already owns the scroll container.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { spacing } from '../../ui/tokens';
import { HumynUpload } from '../../native/HumynUpload';

const VENDOR_KEYS = ['xiaomi', 'oppo', 'vivo', 'samsung', 'stock'] as const;

interface VendorStep {
  vendor: string;
  steps: string;
}

export function BatteryOptimizationGuide(): React.JSX.Element {
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

  // Probe current exemption + OEM-autostart availability — try/caught via the
  // *Safe HumynUpload variants (no native module / JSDOM → safe defaults).
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

  const statusLine =
    exempt == null
      ? null
      : exempt
        ? t('batteryOpt.statusAllowed')
        : t('batteryOpt.statusStillRestricted');

  return (
    <View accessibilityLabel="battery-optimization-guide">
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
    </View>
  );
}

const styles = StyleSheet.create({
  body: { marginBottom: spacing.l },
  cta: { marginTop: spacing.l },
  status: { marginTop: spacing.s },
  sectionHeading: { marginTop: spacing.xxxl, marginBottom: spacing.md },
  vendorBlock: { marginBottom: spacing.l },
  vendorName: { marginBottom: spacing.xs },
  fallback: { marginTop: spacing.md },
});

export default BatteryOptimizationGuide;
