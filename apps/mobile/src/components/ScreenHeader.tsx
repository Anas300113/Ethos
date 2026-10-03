/**
 * Headers. Drawn by the screens rather than the navigator so the masthead is
 * typographic (a serif wordmark over a hairline) instead of a coloured bar, and so
 * every action button is a real 44pt target with a spoken label.
 */
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { T } from "./Typography";
import { usePalette, spacing, minTouchTarget } from "../theme";

/** Icon button. The label is what screen readers get; the glyph is decoration. */
export function IconAction({
  icon,
  label,
  onPress,
  filled = false,
  disabled = false,
  size = 22,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  filled?: boolean;
  disabled?: boolean;
  size?: number;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: minTouchTarget,
        height: minTouchTarget,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.55 : 1,
      })}
    >
      <Ionicons
        name={icon}
        size={size}
        color={palette.ink}
        accessibilityVisibility="hidden"
      />
      {filled ? (
        <View
          accessibilityElementsHidden
          style={{
            position: "absolute",
            top: 8,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: palette.accent,
          }}
        />
      ) : null}
    </Pressable>
  );
}

/** Front page masthead: wordmark, today's date, and a slot for settings. */
export function Masthead({
  date,
  right,
}: {
  date: string;
  right?: ReactNode;
}) {
  const palette = usePalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        paddingHorizontal: spacing.screen,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderColor: palette.rule,
      }}
    >
      <View>
        <T variant="h1" serif style={{ letterSpacing: 3 }}>
          ETHOS
        </T>
        <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xxs }}>
          {date}
        </T>
      </View>
      {right ?? null}
    </View>
  );
}

/** Detail/topic/settings header: back, section label, actions. */
export function BackHeader({
  label,
  actions,
}: {
  label: string;
  actions?: ReactNode;
}) {
  const palette = usePalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.screen - spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderColor: palette.rule,
      }}
    >
      <IconAction
        icon="chevron-back"
        label="Back"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/today");
        }}
      />
      <T variant="section" tone="secondary" style={{ flex: 1 }}>
        {label.toUpperCase()}
      </T>
      {actions ?? null}
    </View>
  );
}

/** Tab screens that are not the front page still need a titled edge to the content. */
export function TabTitleHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const palette = usePalette();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        paddingHorizontal: spacing.screen,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderColor: palette.rule,
      }}
    >
      <View style={{ flex: 1 }}>
        <T variant="h2" serif>
          {title}
        </T>
        {subtitle ? (
          <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xxs }}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}