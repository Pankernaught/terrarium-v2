/**
 * The token system — the engine of "premium" (Premium Design §3).
 *
 * Defined once, applied relentlessly: spacing / type / shadow / color / motion.
 * Never use an off-token value. This is the foundation the whole component
 * library (and every screen) pulls from — locked in Phase 5 before any screen.
 *
 * Earth-modern palette designed in OKLCH, shipped as resolved hex (§3.5): RN's
 * StyleSheet does not parse `oklch()` at runtime. The one runtime OKLCH payoff —
 * interpolating the Eco-balance meter so it never goes muddy — lives in the pure,
 * tested `src/logic/eco.ts`, not here.
 */
import { Platform } from 'react-native';

/**
 * Two resolved palettes off one lightness ladder (§3.5): shift lightness, hold
 * the mood. `light` and `dark` MUST share keys so `ThemeColor` stays sound.
 *
 * Keys are the semantic *roles*. The trailing aliases (`backgroundElement`,
 * `backgroundSelected`, `textSecondary`) preserve the Phase-1 `themed-text` /
 * `themed-view` contract so those generic components keep working unchanged.
 */
export const Colors = {
  light: {
    background: '#F6F4EC', // warm off-white
    surface: '#FCFBF6', // card
    surfaceSunken: '#EFEDE2', // inset / selected surface
    primary: '#2E5D3A', // forest
    onPrimary: '#FCFBF6', // text/icon on a primary fill
    sage: '#5E7A52', // secondary
    accent: '#A55A3A', // terracotta — one per screen
    text: '#232826',
    textMuted: '#6B7268',
    border: 'rgba(46,93,58,0.12)', // hairline, forest-tinted (§3.4)
    // --- back-compat aliases (Phase-1 themed-* components) ---
    backgroundElement: '#FCFBF6',
    backgroundSelected: '#EFEDE2',
    textSecondary: '#6B7268',
  },
  dark: {
    background: '#14201A', // deep charcoal-green
    surface: '#1C2A22',
    surfaceSunken: '#243528',
    primary: '#5FAE74', // raised L so it doesn't go flat
    onPrimary: '#14201A',
    sage: '#8FB07F',
    accent: '#C8825F',
    text: '#ECEFE7',
    textMuted: '#9AA59A',
    border: 'rgba(143,176,127,0.16)',
    // --- back-compat aliases ---
    backgroundElement: '#1C2A22',
    backgroundSelected: '#243528',
    textSecondary: '#9AA59A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
/** Resolved palette — same keys in both schemes, values widened to `string`. */
export type Palette = { [K in keyof typeof Colors.light]: string };

/**
 * Spacing scale (§3.2): 4 · 8 · 16 · 24 · 32 · 48 — never an off-scale value.
 * Gaps within a group use xs–sm; between groups md–lg; section padding lg–xl;
 * screen-level breathing room xl–xxl.
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Corner radii — soft, consistent. `pill` is effectively fully-rounded. */
export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * Type scale (§3.3): base 16, ratio 1.2 (minor third). Bold the value, never the
 * label; `overline` is uppercase + letter-spaced + muted by convention.
 */
export const Typography = {
  display: { fontSize: 33, fontWeight: '700', lineHeight: 38, letterSpacing: -0.5 },
  headline: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  title: { fontSize: 23, fontWeight: '600', lineHeight: 28 },
  subhead: { fontSize: 19, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  overline: { fontSize: 11, fontWeight: '500', lineHeight: 14, letterSpacing: 0.8 },
} as const;

export type TypeVariant = keyof typeof Typography;

/**
 * Motion tokens (§3.1) — Reanimated spring configs, all on the UI thread. Under
 * reduce-motion, collapse every one of these to the 120ms opacity fade
 * (`microTiming`). The component library reads these; never hand-tune a spring.
 */
export const Motion = {
  snappy: { stiffness: 220, damping: 26, mass: 1 }, // buttons, toggles, tabs
  settle: { stiffness: 140, damping: 24, mass: 1 }, // sheets, modals, pages
  delight: { stiffness: 180, damping: 14, mass: 1 }, // Eco fill, save success (one sanctioned overshoot)
  dragReturn: { stiffness: 200, damping: 20, mass: 1 }, // spring-back to slot
  micro: { duration: 120 }, // opacity fades, chip select
} as const;

/** Reduce-motion replacement for every spring (§3.1). */
export const MICRO_FADE_MS = 120;

/**
 * Shadow + border scale (§3.4). One soft shadow + a hairline border is the
 * cross-platform premium floor; the hairline is what keeps Android cards from
 * looking flat where it can't stack shadows. Pass the resolved palette so the
 * border picks up the theme's forest-tinted hairline.
 */
export function elevation(level: 'e0' | 'e1' | 'e2', palette: Palette) {
  const hairline = { borderWidth: Platform.OS === 'android' ? 0.5 : undefined, borderColor: palette.border };
  if (level === 'e0') {
    return Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, borderWidth: 0.5, borderColor: palette.border },
      android: { elevation: 1, ...hairline },
      default: {},
    });
  }
  if (level === 'e1') {
    return Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, borderWidth: 0.5, borderColor: palette.border },
      android: { elevation: 6, ...hairline },
      default: {},
    });
  }
  return Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 32, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 12 },
    default: {},
  });
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** Dashboard grid breathing room (§4.2): cards centered, capped, never edge-to-edge. */
export const MaxContentWidth = 760;
