/**
 * Images, with a plan for when they are missing.
 *
 * Roughly one story in four has no hero image, and remote images die on plane
 * flights. Both cases render a typographic panel instead of a broken frame, so a
 * screen never shows a grey hole where the journalism should be.
 */
import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { T } from "./Typography";
import { usePalette, spacing } from "../theme";

export function HeroImage({
  uri,
  caption,
  topic,
  reducedMotion,
}: {
  uri?: string;
  caption?: string;
  topic: string;
  reducedMotion: boolean;
}) {
  const palette = usePalette();
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View
        style={{
          aspectRatio: 16 / 9,
          backgroundColor: palette.imageFallback,
          padding: spacing.lg,
          justifyContent: "flex-end",
        }}
      >
        <T variant="section" tone="tertiary">
          {topic.toUpperCase()}
        </T>
      </View>
    );
  }

  return (
    <View>
      <Image
        source={{ uri }}
        style={{ width: "100%", aspectRatio: 16 / 9 }}
        contentFit="cover"
        transition={reducedMotion ? undefined : 180}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
        alt=""
      />
      {caption ? (
        <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
          {caption}
        </T>
      ) : null}
    </View>
  );
}

/** Square thumb for list rows. Falls back to the outlet count, not a glyph. */
export function Thumb({
  uri,
  outlets,
  reducedMotion,
  size = 92,
}: {
  uri?: string;
  outlets: number;
  reducedMotion: boolean;
  size?: number;
}) {
  const palette = usePalette();
  if (!uri) {
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: palette.imageFallback,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.xs,
        }}
      >
        <T variant="caption" tone="tertiary" style={{ textAlign: "center" }}>
          {outlets} {outlets === 1 ? "outlet" : "outlets"}
        </T>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={uri}
      transition={reducedMotion ? undefined : 180}
      accessibilityIgnoresInvertColors
      alt=""
    />
  );
}