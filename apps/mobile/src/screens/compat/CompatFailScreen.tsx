/**
 * CompatFailScreen — design-spec §4d + COMPAT-08 (post Plan 03-03 merge).
 *
 * Single screen. Failure list + 1-line recovery body + Contact Support
 * CTA all inline; the standalone CompatRecoveryScreen and its
 * CompatRecovery route are deleted (02-COSMETIC-GAPS.md § Compat-fail
 * screen).
 *
 * Plan 03-11 (A5) — "What Now" recovery bullets dropped per Pixel 10a
 * re-walk amendment. Screen now renders: failure list + 1-sentence
 * contextual line + Contact Support CTA. The 3 recovery bullets felt
 * like filler between the failure reason and the action; the failure
 * list itself already itemizes WHAT failed.
 *
 * Layout (per 02-COSMETIC-GAPS.md): center-aligned both horizontally and
 * vertically; no flex spacer pushing the CTA to the bottom; the entire
 * scrollable body sits as one vertically-centered group. Contact Support
 * stacks immediately under the recovery block with content-driven width
 * (alignSelf: 'center') — same rule as Plan 03-02 Sign-up + Permissions.
 *
 * NO proceed CTA — COMPAT-06 enforced (the user cannot continue past
 * compat-fail; they must use a different qualifying device or contact
 * support).
 *
 * Plan 03-03 — OQ-1 5th and final placeholder occurrence: SUPPORT_EMAIL is
 * now `support@humynlabs.ai` (Plan 03-02 resolved 4 of 5 occurrences and
 * explicitly deferred this one to the Compat-fail merge).
 *
 * NO hex literals — all colors from `colors.*` tokens (design-spec §0.1).
 */
import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Text } from '../../ui/primitives/Text';
import { Button } from '../../ui/primitives/Button';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing } from '../../ui/tokens';
import { useAppStore } from '../../state/appStore';
import type { CompatResult } from '@humyn/shared-types';

const SUPPORT_EMAIL = 'support@humynlabs.ai';

export default function CompatFailScreen() {
  const compat = useAppStore((s) => s.compatLastResult);
  const { t } = useTranslation();

  const lines = compat ? failureLines(compat, t) : [];

  return (
    <ScreenContainer accessibilityLabel="CompatFail screen" padding={0}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="sheetTitle" style={styles.title}>
          {t('compat.fail.title')}
        </Text>

        <View style={styles.list}>
          {lines.map(({ key, line }) => (
            <View key={key} style={styles.row} accessibilityLabel={`compat-fail-row-${key}`}>
              <Text variant="body" style={styles.cross}>
                ✕
              </Text>
              <Text variant="body" style={styles.lineText}>
                {line}
              </Text>
            </View>
          ))}
        </View>

        {/* Plan 03-11 (A5) — recoveryBody tightened to 1 sentence; the
            failure list above already itemizes WHAT failed, so the bullets
            were filler between the failure reason and the action. */}
        <Text variant="body" tone="secondary" style={styles.recoveryBody}>
          {t('compat.fail.body')}
        </Text>

        <View style={styles.ctaWrap}>
          <Button
            variant="primary"
            accessibilityLabel="compat-fail-contact-support"
            label={t('compat.fail.contactSupport')}
            onPress={() => {
              const subject = encodeURIComponent('Compatibility check — need help');
              const body = encodeURIComponent(
                'Phone model:\nWhat I was trying to do:\nWhen it happened:\n',
              );
              void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
            }}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

/**
 * Map failed-check keys into the verbatim design-spec §4d copy with measured
 * values substituted. Order matches the design-spec's diagnostic list.
 * Translated per I18N-07 — the line strings come from `compat.fail.lines.*`.
 */
function failureLines(r: CompatResult, t: TFunction): { key: string; line: string }[] {
  const out: { key: string; line: string }[] = [];
  const c = r.checks;
  if (!c.ultrawideDfov.pass) {
    out.push({
      key: 'ultrawideDfov',
      line: t('compat.fail.lines.ultrawideDfov', {
        deg: c.ultrawideDfov.measuredDeg.toFixed(0),
      }),
    });
  }
  if (!c.resolution || !c.fps) {
    out.push({ key: 'resolutionFps', line: t('compat.fail.lines.resolutionFps') });
  }
  if (!c.imuSustained100Hz.pass) {
    out.push({
      key: 'imuSustained100Hz',
      line: t('compat.fail.lines.imuSustained100Hz', {
        hz: c.imuSustained100Hz.measuredHz.toFixed(0),
      }),
    });
  }
  if (!c.imuP99Ms.pass) {
    out.push({
      key: 'imuP99Ms',
      line: t('compat.fail.lines.imuP99Ms', { ms: c.imuP99Ms.measuredMs.toFixed(1) }),
    });
  }
  if (!c.micSampleRate) {
    out.push({ key: 'micSampleRate', line: t('compat.fail.lines.micSampleRate') });
  }
  if (!c.realtimeTimestamp) {
    out.push({ key: 'realtimeTimestamp', line: t('compat.fail.lines.realtimeTimestamp') });
  }
  if (!c.root.pass) {
    out.push({ key: 'root', line: t('compat.fail.lines.root') });
  }
  if (!c.encoderNoBFrames) {
    out.push({ key: 'encoderNoBFrames', line: t('compat.fail.lines.encoderNoBFrames') });
  }
  if (!c.oisOff) {
    out.push({ key: 'oisOff', line: t('compat.fail.lines.oisOff') });
  }
  if (!c.hdrSdrForced) {
    out.push({ key: 'hdrSdrForced', line: t('compat.fail.lines.hdrSdrForced') });
  }
  return out;
}

const styles = StyleSheet.create({
  // Per 02-COSMETIC-GAPS.md: center body horizontally + vertically, no flex
  // spacer pushing the CTA to the bottom. Generous horizontal padding so the
  // title + lines don't touch the screen edges.
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.h,
    paddingVertical: spacing.xl,
  },
  title: { marginBottom: spacing.md, textAlign: 'center' },
  list: { width: '100%', marginBottom: spacing.ll },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.m },
  cross: { color: colors.coral, marginRight: spacing.ms },
  lineText: { flex: 1 },
  // Plan 03-11 (A5) — recoveryBody now sits directly above the CTA; bumped
  // marginBottom from `ll` to `xxxl` so the 1-sentence body has the breathing
  // room the bullets used to provide before the Contact Support button.
  recoveryBody: { marginBottom: spacing.xxxl, textAlign: 'center' },
  // Contact Support CTA — content-driven width (alignSelf: 'center'), same
  // rule as Plan 03-02 Sign-up + Permissions ctaWrap.
  ctaWrap: { alignSelf: 'center' },
});
