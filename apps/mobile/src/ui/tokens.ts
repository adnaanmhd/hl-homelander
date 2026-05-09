// @doc Design tokens — verbatim from design-spec.md §0 and engineering-handoff.md §1.
//
// Single source of truth for every screen / component in apps/mobile. NO
// hex literal MAY appear inside src/ui/primitives/* — every primitive
// imports from this module. Adding a new color/typography variant means
// extending this file (and design-spec §0 first).
//
// Keep `as const` so consumers get string-literal types where they matter
// (variant names) and TypeScript flags typos at compile time.

// ---------------------------------------------------------------------------
// Colors — design-spec §0.1.
// ---------------------------------------------------------------------------
export const colors = {
  bg: '#FAF7F2',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  text2: '#6B6B6B',
  text3: '#9A9590',
  line: '#E8E5E0',
  accent: '#FF6A2D',
  accentSoft: '#FFE6D8',
  coral: '#E84A38',
  success: '#2EB872',
  amber: '#F2A53C',
  info: '#2D7CFF',
  infoSoft: '#E5EEFF',
  // Status chips
  chipSuccessBg: '#DEF7E5',
  chipSuccessText: '#1F7A3A',
  chipProgressBg: '#FFF4E5',
  chipProgressText: '#8C5A1A',
  chipFailedBg: '#FFE3DD',
  chipFailedText: '#B5331E',
  // Banners
  bannerWarnBg: '#FFF4E5',
  bannerWarnBorder: '#FFD9A8',
  bannerWarnText: '#8C5A1A',
  // Recording surface
  recBg: '#0A0A0A',
} as const;

// ---------------------------------------------------------------------------
// Typography — design-spec §0.2 + engineering-handoff §1.2-1.3.
// `fontFamily` keys map to the bundled RethinkSans family files (via
// react-native-asset, plan 02-02 Task 2). `mono` falls back to Menlo on iOS
// and Roboto Mono on Android (RN's default monospace).
// ---------------------------------------------------------------------------
export const typography = {
  fontFamily: {
    regular: 'RethinkSans-Regular',
    medium: 'RethinkSans-Medium',
    semibold: 'RethinkSans-SemiBold',
    bold: 'RethinkSans-Bold',
    extrabold: 'RethinkSans-ExtraBold',
    mono: 'Menlo',
  },
  displayHero: {
    fontSize: 46,
    lineHeight: 46,
    fontWeight: '700' as const,
    letterSpacing: -1.5,
  },
  lifetimeNumber: {
    fontSize: 44,
    lineHeight: 44,
    fontWeight: '700' as const,
    letterSpacing: -1,
  },
  tileNumber: {
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
  },
  title28: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  tutorialHeading: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  pitch: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  compatTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700' as const,
  },
  bodyLg: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  btnLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  tutBody: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  pillLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  formLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  comingSoonBadge: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500' as const,
  },
  monoTimer: {
    fontSize: 32,
    lineHeight: 32,
    fontWeight: '600' as const,
    letterSpacing: 1,
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing — design-spec §0.3. The naming is shorthand; the design-spec lists
// the canonical pixel values. Use `spacing.l` (16) as the default screen
// gutter.
// ---------------------------------------------------------------------------
export const spacing = {
  xs: 4,
  s: 6,
  m: 8,
  ms: 10,
  md: 12,
  mdl: 14,
  l: 16,
  ll: 18,
  xl: 20,
  xxl: 22,
  xxxl: 24,
  h: 28,
  hh: 32,
  xxxxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Radii — design-spec §0.3. `pill` and `chipPill` collapse to 999 (any large
// value clamps to half-height).
// ---------------------------------------------------------------------------
export const radii = {
  tile: 18,
  sheet: 24,
  modal: 20,
  button: 14,
  pill: 999,
  input: 12,
  chip: 6,
  chipPill: 999,
} as const;

// ---------------------------------------------------------------------------
// Motion — design-spec §0.4. `pressScale` is the universal Pressable scale
// transform (every primitive Pressable applies this on press).
// ---------------------------------------------------------------------------
export const motion = {
  curveStandard: 'cubic-bezier(.2,.8,.2,1)' as const,
  fadeInMs: 200,
  slideUpMs: 250,
  scalePopMs: 700,
  compatRingStrokeMs: 350,
  pressScale: 0.98,
} as const;

// ---------------------------------------------------------------------------
// Elevation — design-spec §0.5 card shadow. RN expects shadowColor + shadow*
// on iOS and `elevation` on Android in the same StyleSheet.create().
// ---------------------------------------------------------------------------
export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 4,
  },
} as const;

// ---------------------------------------------------------------------------
// Convenience type exports for variant unions used by primitives.
// ---------------------------------------------------------------------------
export type ColorToken = keyof typeof colors;
export type TypographyVariant = Exclude<keyof typeof typography, 'fontFamily'>;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
