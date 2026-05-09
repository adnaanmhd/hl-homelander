/**
 * CompatRunningScreen — design-spec §4a/§4b.
 *
 * "Checking your phone" / "Takes around 30 secs" + 130×130 progress ring +
 * 7-row checklist with 22 px circular indicators.
 *
 * Lifecycle:
 *   1. On mount, kick off `runCompatCheck()` (compatService) and a cosmetic
 *      row-walk timer that advances the 7-row checklist incrementally so the
 *      user sees motion while the ~33 s probe sequence is in flight.
 *   2. On result resolve, freeze the cosmetic walk, mark each row according
 *      to the real CompatResult via `rowsFromResult`, push the result into
 *      Zustand via `setCompatResult`, and after a 400 ms hold for the ring
 *      transition, navigation.replace to CompatPass / CompatFail.
 *   3. On probe rejection, route to CompatFail (the error path is rare; the
 *      detailed user-facing copy lives in 02-21 manual smoke runbook).
 *
 * NO hex literals — all colors come from `colors.*` tokens (design-spec
 * §0.1 / §0.2).
 *
 * Phase 2 plan 02-15 Task 3.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../ui/primitives/Text';
import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
import { colors, spacing } from '../../ui/tokens';
import { runCompatCheck } from '../../services/compatService';
import { DISPLAY_ROWS, rowsFromResult, type DisplayRowKey } from './checks';
import { useAppStore } from '../../state/appStore';
import { CompatRing } from '../../components/CompatRing';

interface NavigationLike {
  replace(route: string): void;
}

type RowState = 'pending' | 'running' | 'pass' | 'fail';

function initialRowStates(): Record<DisplayRowKey, RowState> {
  const out = {} as Record<DisplayRowKey, RowState>;
  for (const r of DISPLAY_ROWS) {
    out[r.key] = 'pending';
  }
  return out;
}

function glyphFor(s: RowState): string {
  switch (s) {
    case 'pass':
      return '✓';
    case 'fail':
      return '✕';
    case 'running':
      return '⋯';
    default:
      return '○';
  }
}

function indicatorStyle(s: RowState) {
  switch (s) {
    case 'pass':
      return { backgroundColor: colors.success };
    case 'fail':
      return { backgroundColor: colors.coral };
    case 'running':
      return { backgroundColor: colors.amber };
    default:
      return { backgroundColor: colors.line };
  }
}

export default function CompatRunningScreen() {
  const navigation = useNavigation<NavigationLike>();
  const setCompatResult = useAppStore((s) => s.setCompatResult);

  const [percent, setPercent] = useState(0);
  const [rowStates, setRowStates] = useState<Record<DisplayRowKey, RowState>>(initialRowStates);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    // Cosmetic row-walk timer — gives the user motion while the real probes
    // are in flight. Each tick advances one row to "running"; previous rows
    // flip to "pass" speculatively, and they're overwritten with the real
    // result on resolution below.
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
        for (let i = 0; i < idx; i++) {
          next[DISPLAY_ROWS[i]!.key] = 'pass';
        }
        next[DISPLAY_ROWS[idx]!.key] = 'running';
        return next;
      });
    }, intervalMs);

    runCompatCheck()
      .then((result) => {
        if (cancelled.current) return;
        clearInterval(tick);
        setPercent(100);
        setCompatResult(result);
        // Mark rows from the real result.
        const display = rowsFromResult(result);
        const next = {} as Record<DisplayRowKey, RowState>;
        for (const r of display) {
          next[r.key] = r.pass ? 'pass' : 'fail';
        }
        setRowStates(next);
        // Brief 400 ms hold for the ring fill, then route.
        setTimeout(() => {
          if (cancelled.current) return;
          if (result.passed) {
            navigation.replace('CompatPass');
          } else {
            navigation.replace('CompatFail');
          }
        }, 400);
      })
      .catch(() => {
        if (cancelled.current) return;
        clearInterval(tick);
        // Defensive: route to Fail on probe error so the user sees the
        // recovery flow rather than a stalled screen.
        navigation.replace('CompatFail');
      });

    return () => {
      cancelled.current = true;
      clearInterval(tick);
    };
  }, [navigation, setCompatResult]);

  return (
    <ScreenContainer accessibilityLabel="CompatRunning screen" padding={spacing.h}>
      <View style={styles.ringWrap}>
        <CompatRing percent={percent} />
      </View>
      <Text variant="compatTitle" style={styles.title}>
        Checking your phone
      </Text>
      <Text variant="caption" tone="secondary" style={styles.sub}>
        Takes around 30 secs
      </Text>
      <View style={styles.checks}>
        {DISPLAY_ROWS.map((row) => (
          <View key={row.key} style={styles.row} accessibilityLabel={`compat-row-${row.key}`}>
            <View style={[styles.indicator, indicatorStyle(rowStates[row.key])]}>
              <Text variant="caption" style={styles.indicatorGlyph}>
                {glyphFor(rowStates[row.key])}
              </Text>
            </View>
            <Text variant="body" style={styles.label}>
              {row.label}
            </Text>
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  ringWrap: { alignItems: 'center', marginTop: spacing.hh },
  title: { marginTop: spacing.xxxl, alignSelf: 'center' },
  sub: { marginTop: spacing.s, alignSelf: 'center' },
  checks: { marginTop: spacing.xxxl, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.s },
  indicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  indicatorGlyph: { color: colors.surface },
  label: { color: colors.text },
});
