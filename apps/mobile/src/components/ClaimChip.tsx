/**
 * The verification chip. Small, tinted, never shouting — and it always pairs a
 * status with its meaning when a reader asks (the sheet does that, not the chip).
 */
import { View } from "react-native";
import { T } from "./Typography";
import { claimLabel, claimTone } from "../model/claim";
import type { ClaimStatus } from "../model/claim";
import { toneBackground, toneColor, usePalette, spacing } from "../theme";

export function ClaimChip({
  status,
  compact = false,
}: {
  status: ClaimStatus | null | undefined;
  compact?: boolean;
}) {
  const palette = usePalette();
  const tone = claimTone(status);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Verification status: ${claimLabel(status)}`}
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: toneBackground(tone, palette),
        paddingVertical: compact ? 3 : 5,
        paddingHorizontal: compact ? spacing.sm : spacing.md,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: toneColor(tone, palette),
        }}
      />
      <T
        variant="caption"
        color={toneColor(tone, palette)}
        style={{ fontWeight: "600", letterSpacing: 0.4 }}
      >
        {claimLabel(status).toUpperCase()}
      </T>
    </View>
  );
}