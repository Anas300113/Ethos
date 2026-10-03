/**
 * Theme access. Follows the system appearance — a news app that ignores the
 * device setting is a news app people turn their phone face-down over.
 */
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Platform, useColorScheme } from "react-native";
import { dark, displayFontAndroid, displayFontIOS, light, minTouchTarget, spacing, toneBackground, toneColor, type } from "./tokens";
import type { Palette } from "./tokens";

export { dark, light, minTouchTarget, spacing, toneBackground, toneColor, type };
export type { Palette };

export function usePalette(): Palette {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}

/** Editorial serif for headlines; body text stays on the system sans. */
export function useSerif(): string {
  return Platform.OS === "ios" ? displayFontIOS : displayFontAndroid;
}

/** Honour the OS "reduce motion" setting for the few transitions we have. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    const apply = (value: boolean) => {
      if (active) setReduced(value);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(apply, () => apply(false));
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      apply
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Everything a screen needs to look like ETHOS, in one call. */
export function useTheme() {
  const palette = usePalette();
  const serif = useSerif();
  return useMemo(
    () => ({ palette, serif, spacing, type }),
    [palette, serif]
  );
}