// HomeHero — Phase 6 Wave 4 (Plan 06-08).
//
// Empty + returning hero variants used by HomeScreen (replaces
// HomeSkeletonScreen). Copy + sizing verbatim from `06-UI-SPEC.md`
// §"Home — empty hero (§9a)" and §"Home — returning hero (§9b)" + the
// design-spec §9 dark hero card spec.
//
// Gradient implementation choice (planner — D-08 §Discretion lock):
//   The §9 dark hero is specced as `linear-gradient(180deg, #1A1A1A 0%,
//   #2A2A2A 100%)`. `react-native-linear-gradient` is NOT in the dep list;
//   `react-native-svg` IS (svg ≥15.15.4), so the SVG Defs+LinearGradient
//   path is viable. This plan picks **solid `colors.heroGradStart`** for
//   the v1 ship to keep the component free of an svg dependency in its
//   internals — the SVG path is deferred to a Phase 7 polish item.
//   Note documented in `06-08-SUMMARY.md` per <output>.
//
// Animation choice (UI-SPEC §Motion 8 — "Counter-ease animation"):
//   On `variant='returning'` mount, the lifetime numeric counts up from
//   0 → `lifetimeMs` over 1200ms (UI-SPEC §Motion `Contribution counter
//   ease`). Implemented with `useEffect` + `setInterval` (60 FPS-ish, no
//   Reanimated worklet dependency). Skip-when-already-mounted ensures the
//   animation only fires on cold mount (a re-render with the same value
//   does NOT re-trigger).

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Text from '../ui/primitives/Text';
import { Pressable } from '../ui/primitives/Pressable';
import { colors, spacing, radii, typography } from '../ui/tokens';
import { formatDuration } from '../services/durationFormatter';

const COUNTER_EASE_MS = 1200;
/** Animation frame cadence; 60fps gives a smooth counter ease in JSDOM and on-device. */
const COUNTER_TICK_MS = 16;

export interface HomeHeroProps {
  /** 'empty' = first-time user (no recordings yet); 'returning' = has recordings. */
  variant: 'empty' | 'returning';
  /** Lifetime duration in MILLISECONDS (per ContributionsLifetimeSchema). Ignored in 'empty'. */
  lifetimeMs?: number;
  /** Distinct task count for the "Across {N} tasks" sub. Ignored in 'empty'. */
  taskCount?: number;
  /** Called when the Start Recording CTA is tapped. */
  onStartRecording: () => void;
}

/**
 * `useCounterEase` — animate `target` from 0 → target over `durationMs`.
 * Only fires once on mount (the `[]` deps); a later `target` prop change
 * snaps to the new value (acceptable for HOME-06 — the cold-boot tile
 * animation rule applies to the FIRST mount only per UI-SPEC §Motion).
 */
function useCounterEase(target: number, durationMs: number): number {
  const [value, setValue] = useState<number>(0);
  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) {
      setValue(target);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= durationMs) {
        clearInterval(id);
        setValue(target);
        return;
      }
      // Ease-out cubic for a smooth count-up (the §Motion curve is
      // `cubic-bezier(.2,.8,.2,1)`; ease-out cubic ≈ same family).
      const t = elapsed / durationMs;
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.floor(target * eased));
    }, COUNTER_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return value;
}

export function HomeHero({
  variant,
  lifetimeMs,
  taskCount,
  onStartRecording,
}: HomeHeroProps): React.JSX.Element {
  // durationFormat takes SECONDS (services/durationFormatter.ts); ContributionsLifetimeSchema.durationMs
  // is milliseconds, so divide by 1000 before formatting.
  const lifetimeMsSafe = Number.isFinite(lifetimeMs) && lifetimeMs != null ? lifetimeMs : 0;
  const animatedMs = useCounterEase(lifetimeMsSafe, COUNTER_EASE_MS);
  const lifetimeLabel = formatDuration(Math.floor(animatedMs / 1000));

  if (variant === 'empty') {
    return (
      <View accessibilityLabel="home-hero-empty" style={styles.card}>
        <Text variant="caption" style={styles.eyebrow}>
          Get started
        </Text>
        <Text variant="sheetTitle" style={styles.titleEmpty}>
          Record your first task
        </Text>
        <Text variant="caption" style={styles.sub}>
          Pick a task and start recording
        </Text>
        <Pressable
          accessibilityLabel="home-hero-start-recording"
          onPress={onStartRecording}
          style={styles.cta}
        >
          <Text variant="btnLabel" style={styles.ctaLabel}>
            Start Recording
          </Text>
        </Pressable>
      </View>
    );
  }

  // variant === 'returning'
  const safeTaskCount = Number.isFinite(taskCount) && taskCount != null ? taskCount : 0;
  return (
    <View accessibilityLabel="home-hero-returning" style={styles.card}>
      <Text variant="caption" style={styles.eyebrow}>
        Continue contributing
      </Text>
      <Text
        variant="displayHero"
        accessibilityLabel="home-hero-lifetime-numeric"
        style={styles.lifetimeNumber}
      >
        {lifetimeLabel}
      </Text>
      <Text variant="caption" style={styles.sub}>
        {`Across ${safeTaskCount} tasks`}
      </Text>
      <Pressable
        accessibilityLabel="home-hero-start-recording"
        onPress={onStartRecording}
        style={styles.cta}
      >
        <Text variant="btnLabel" style={styles.ctaLabel}>
          Start Recording
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Solid dark fill (planner pick — see header note; svg gradient deferred to Phase 7).
  // `heroGradStart` is the stop-1 color from design-spec §9; the solid fill matches the
  // 0% gradient stop visually on dark surfaces.
  card: {
    backgroundColor: colors.heroGradStart,
    padding: spacing.xxl, // 22 px internal padding per UI-SPEC §Home §9a/§9b
    borderRadius: radii.sheet, // 24 px outer radius per UI-SPEC
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.recTextSecondary, // 13 / 65 % white (uses rec* token; closest to "65%" surface alpha)
  },
  titleEmpty: {
    color: colors.recTextPrimary, // white
  },
  sub: {
    color: colors.recTextSecondary, // 13 / 65 % white
  },
  lifetimeNumber: {
    color: colors.recTextPrimary, // white
    fontFamily: typography.fontFamily.mono, // mono per UI-SPEC §Typography displayHero
  },
  cta: {
    backgroundColor: colors.accent, // btn-accent (accent fill)
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.button,
    alignItems: 'center',
    marginTop: spacing.m,
  },
  ctaLabel: {
    color: colors.surface, // white label on accent
  },
});

export default HomeHero;
