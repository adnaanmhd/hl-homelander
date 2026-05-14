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
  // Recording surface — dark theme (design-spec §7 / 04-UI-SPEC § Color §
  // "Dark recording surface"). The full/partial-opacity whites + the dark
  // overlay tones live here so no rgba/hex literal leaks into a screen or
  // component body (the D-UI-01 token-discipline gate).
  recBg: '#0A0A0A',
  recTextPrimary: '#FFFFFF', // task name, primary chrome text
  recTextSecondary: 'rgba(255,255,255,0.95)', // gate prompt (17/24)
  recTextCaption: 'rgba(255,255,255,0.85)', // overlay tip / loading caption
  recSkipLink: 'rgba(255,255,255,0.7)', // gate "Skip" link (14/600)
  recOverlayTip: 'rgba(0,0,0,0.6)', // 3s "Don't exit while recording." overlay bg
  recToastBg: 'rgba(26,26,26,0.94)', // bottom toast bg
  // Plan 04-10 — generic app-wide toast host bg (the Home crash-recovery toast,
  // D-LIFE-04). Same dark pill the recording surface uses (recToastBg); aliased
  // here so non-recording surfaces don't reach into the rec* namespace.
  toastBg: 'rgba(26,26,26,0.94)',
  recVoiceCueBg: 'rgba(255,255,255,0.96)', // voice-cue pill bg (dark text on it)
  recRingTrack: 'rgba(255,255,255,0.18)', // GateRing track circle
  // Phase 6 additions (06-UI-SPEC §Token Additions) — verbatim from
  // design-spec.md §10 (task cards), §11 (universal rules), §13 (history rows),
  // §14 (player), and §9 / §9b (dark hero + pending-uploads thumbnail fallback).
  // These keep the D-UI-01 no-hex-literals gate clean for all Wave 4/5 screens.
  heroGradStart: '#1A1A1A', // design-spec §9 dark hero stop 1
  heroGradEnd: '#2A2A2A', // design-spec §9 dark hero stop 2
  universalRulesBg: '#FFF7F0', // design-spec §11 Universal-rules well
  thumbFallbackStart: '#FFC09F', // design-spec §9b Pending-uploads thumbnail
  thumbFallbackEnd: '#FF6A2D', // design-spec §9b Pending-uploads thumbnail (= colors.accent)
  playerBg: '#000000', // design-spec §14 Player background
  playerScrubTrack: 'rgba(255,255,255,0.18)', // design-spec §14 unfilled scrub
  playerPlayOverlay: 'rgba(255,255,255,0.15)', // design-spec §14 64×64 play overlay
  playerDisabledOverlay: 'rgba(0,0,0,0.6)', // design-spec §14 derived (deep-archive + unavailable banners)
} as const;

// ---------------------------------------------------------------------------
// Confetti palette — design-spec §8 ("random hues from the accent palette")
// for the PracticeComplete confetti burst (the one sanctioned multi-hue /
// decorative-transient use per 04-UI-SPEC § Color). Warm tones around
// `--accent #FF6A2D`. Kept in this module so no hex literal leaks into a
// screen/component body (the D-UI-01 token-discipline gate).
// ---------------------------------------------------------------------------
export const confettiPalette = [
  '#FF6A2D',
  '#FF8A4D',
  '#FFB07A',
  '#FFD0A8',
  '#F2A53C',
  '#E84A38',
] as const;

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
  // Recording surface — dark-theme typography (04-UI-SPEC § Typography).
  recGatePrompt: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  recSkipLink: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  recAlertPill: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  // Phase 6 additions (06-UI-SPEC §Token Additions) — verbatim from
  // design-spec.md §10 (task cards), §11 (universal rules + bullets),
  // §13 (history row meta), and §14 (player time stamp).
  taskCardName: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600' as const,
  },
  taskCardDesc: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  ruleLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  taskBullet: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  rowMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  playerTime: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
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
