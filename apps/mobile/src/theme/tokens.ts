/**
 * ETHOS design tokens.
 *
 * Pure data, no React Native import, so the palette can be asserted in tests and
 * reused by tooling.
 *
 * The palette is deliberately restrained: paper, ink, one hairline rule, and
 * colour reserved for the one thing that carries meaning — the verification
 * status of a claim. Everything else stays uncoloured, because colour that means
 * everything means nothing.
 */
import { type ClaimTone } from "../model/claim";

export interface Palette {
  /** Screen background: warm paper, not clinical white. */
  name: "light" | "dark";
  bg: string;
  /** Elevated surface: cards, sheets. */
  surface: string;
  /** Sunk surface: chips, wells. */
  sunken: string;
  ink: string;
  inkSecondary: string;
  inkTertiary: string;
  rule: string;
  /** Only for interactive emphasis: focus ring, active tab marker. */
  accent: string;
  onAccent: string;
  /** Tint for "this moved since you saw it" — never for celebration. */
  updated: string;
  updatedBg: string;
  skeleton: string;
  imageFallback: string;
}

export const light: Palette = {
  name: "light",
  bg: "#FBFAF8",
  surface: "#FFFFFF",
  sunken: "#F2F0EB",
  ink: "#0B0B0C",
  inkSecondary: "#57575B",
  inkTertiary: "#85858A",
  rule: "#E4E1DB",
  accent: "#0B0B0C",
  onAccent: "#FBFAF8",
  updated: "#7A4F00",
  updatedBg: "#F7EBD5",
  skeleton: "#EDEBE6",
  imageFallback: "#E8E5DF",
};

export const dark: Palette = {
  name: "dark",
  bg: "#0B0B0C",
  surface: "#151517",
  sunken: "#1C1C1F",
  ink: "#F4F3F0",
  inkSecondary: "#ADADB2",
  inkTertiary: "#85858B",
  rule: "#2A2A2E",
  accent: "#F4F3F0",
  onAccent: "#0B0B0C",
  updated: "#E7C07A",
  updatedBg: "#2A2213",
  skeleton: "#1A1A1D",
  imageFallback: "#1A1A1D",
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  /** Screen gutter — generous whitespace is the design. */
  screen: 20,
} as const;

/**
 * Editorial type. Georgia on iOS, the platform serif on Android: a real serif
 * without shipping a font binary, so a story reads like print on both.
 */
export const displayFontIOS = "Georgia";
export const displayFontAndroid = "serif";

export const type = {
  /** Hero headline. */
  display: { size: 30, lineHeight: 36 },
  h1: { size: 26, lineHeight: 32 },
  h2: { size: 20, lineHeight: 26 },
  /** Small-caps section label — the app's structural signpost. */
  section: { size: 12, lineHeight: 16, tracking: 1.2 },
  body: { size: 17, lineHeight: 26 },
  bodySmall: { size: 15, lineHeight: 22 },
  meta: { size: 13, lineHeight: 18 },
  caption: { size: 12, lineHeight: 16 },
} as const;

/** Smallest tap target we ship. Accessibility, not preference. */
export const minTouchTarget = 44;

export function toneColor(tone: ClaimTone, palette: Palette): string {
  const deep = palette.name === "dark";
  switch (tone) {
    case "grounded":
      return deep ? "#7BD3A6" : "#1F6F4A";
    case "qualified":
      return deep ? "#E7C07A" : "#7A4F00";
    case "contested":
      return deep ? "#F09A9A" : "#A32020";
    case "stale":
      return palette.inkTertiary;
    case "unknown":
      return palette.inkSecondary;
  }
}

/**
 * Status chips are tinted, never solid: a loud green badge next to a headline is
 * exactly the "AI control panel" look this product is not.
 */
export function toneBackground(tone: ClaimTone, palette: Palette): string {
  const deep = palette.name === "dark";
  switch (tone) {
    case "grounded":
      return deep ? "#14261D" : "#E7F1EA";
    case "qualified":
      return deep ? "#2A2213" : "#F7EBD5";
    case "contested":
      return deep ? "#2B1616" : "#F6E5E5";
    case "stale":
    case "unknown":
      return palette.sunken;
  }
}