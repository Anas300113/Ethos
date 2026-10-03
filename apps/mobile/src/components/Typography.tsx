/**
 * Typographic primitives. Every screen composes text through these so the
 * rhythm (serif headlines, sans body, tracked small-caps labels) stays editorial
 * instead of drifting into default-app look.
 */
import { Text, StyleSheet } from "react-native";
import { type TextStyle, type TextProps } from "react-native";
import { useSerif, usePalette, type, spacing } from "../theme";

type Variant =
  | "display"
  | "h1"
  | "h2"
  | "section"
  | "body"
  | "bodySmall"
  | "meta"
  | "caption";

const SIZES: Record<Variant, TextStyle> = {
  display: { fontSize: type.display.size, lineHeight: type.display.lineHeight },
  h1: { fontSize: type.h1.size, lineHeight: type.h1.lineHeight },
  h2: { fontSize: type.h2.size, lineHeight: type.h2.lineHeight },
  section: {
    fontSize: type.section.size,
    lineHeight: type.section.lineHeight,
    letterSpacing: type.section.tracking,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  body: { fontSize: type.body.size, lineHeight: type.body.lineHeight },
  bodySmall: { fontSize: type.bodySmall.size, lineHeight: type.bodySmall.lineHeight },
  meta: { fontSize: type.meta.size, lineHeight: type.meta.lineHeight },
  caption: { fontSize: type.caption.size, lineHeight: type.caption.lineHeight },
};

type Tone = "primary" | "secondary" | "tertiary" | "accent" | "updated";

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  serif?: boolean;
  italic?: boolean;
  color?: string;
}

export function T({
  variant = "body",
  tone = "primary",
  serif = false,
  italic = false,
  color,
  style,
  ...rest
}: Props) {
  const palette = usePalette();
  const serifFont = useSerif();
  const tones: Record<Tone, string> = {
    primary: palette.ink,
    secondary: palette.inkSecondary,
    tertiary: palette.inkTertiary,
    accent: palette.accent,
    updated: palette.updated,
  };

  const composed: TextStyle = {
    ...SIZES[variant],
    color: color ?? tones[tone],
    ...(serif ? { fontFamily: serifFont } : null),
    ...(italic ? { fontStyle: "italic" } : null),
  };

  return (
    <Text
      // Dynamic type is welcome: the scale is a starting point, not a cage.
      style={[composed, style]}
      {...rest}
    />
  );
}

/** "TOP STORIES" — the app's structural signpost. */
export function SectionLabel({
  children,
  right,
}: {
  children: string;
  right?: string;
}) {
  const palette = usePalette();
  return (
    <>
      <Text
        accessibilityRole="header"
        style={[
          SIZES.section,
          { color: palette.inkSecondary, marginBottom: spacing.md },
        ]}
      >
        {children.toUpperCase()}
      </Text>
      {right ? (
        <T variant="caption" tone="tertiary" style={{ marginTop: -spacing.md, marginBottom: spacing.md }}>
          {right}
        </T>
      ) : null}
    </>
  );
}

/** Hairline separator. Nothing in ETHOS is a rounded grey box. */
export function Rule({ inset = 0 }: { inset?: number }) {
  const palette = usePalette();
  return (
    <Text
      accessibilityElementsHidden
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: palette.rule,
        marginLeft: inset,
        marginRight: inset,
      }}
    />
  );
}
