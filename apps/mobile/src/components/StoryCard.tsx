/**
 * Story cards. Two shapes only — a hero and a row — because a news app with four
 * card variants is a dashboard.
 *
 * The sourcing line is the server's computed summary, passed through
 * `sourcingBadge`, which refuses to turn an outlet count into an independence
 * claim when no grouping pass has run (see src/model/sourcing).
 */
import { memo } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { T } from "./Typography";
import { ClaimChip } from "./ClaimChip";
import { HeroImage, Thumb } from "./StoryImage";
import { sourcingBadge } from "../model/sourcing";
import { updatedLabel } from "../model/claim";
import { usePalette, useReducedMotion, spacing } from "../theme";
import type { StoryCard as StoryCardModel } from "../api/types";

export function openStory(slug: string) {
  router.push({ pathname: "/story/[slug]", params: { slug } });
}

function MetaLine({ card }: { card: StoryCardModel }) {
  const badge = sourcingBadge(card.sourcing);
  const parts = [
    badge.label,
    `updated ${updatedLabel(card.lastUpdated)}`,
    `${card.readingTimeMinutes} min read`,
  ];
  if (card.correctionCount > 0) {
    parts.push(
      `${card.correctionCount} correction${card.correctionCount > 1 ? "s" : ""}`
    );
  }
  return (
    <T variant="caption" tone="tertiary" numberOfLines={2}>
      {parts.join("  ·  ")}
    </T>
  );
}

export const StoryCard = memo(function StoryCard({
  card,
  variant = "row",
}: {
  card: StoryCardModel;
  variant?: "hero" | "row";
}) {
  const palette = usePalette();
  const reducedMotion = useReducedMotion();
  const accessibilityLabel = [
    card.headline,
    `${card.topic} story`,
    sourcingBadge(card.sourcing).label,
    `updated ${updatedLabel(card.lastUpdated)}`,
    `${card.readingTimeMinutes} minute read`,
  ].join(". ");

  const press = {
    onPress: () => openStory(card.slug),
    accessibilityRole: "link" as const,
    accessibilityLabel,
  };

  if (variant === "hero") {
    return (
      <Pressable {...press}>
        <HeroImage
          uri={card.heroImageUrl}
          caption={card.heroImageCaption}
          topic={card.topic}
          reducedMotion={reducedMotion}
        />
        <View style={{ marginTop: spacing.lg }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
          >
            <T variant="section" tone="secondary">
              {card.topic.toUpperCase()}
            </T>
            {card.isDeveloping ? (
              <>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: palette.updated,
                  }}
                />
                <T variant="caption" color={palette.updated}>
                  DEVELOPING
                </T>
              </>
            ) : null}
          </View>
          <T
            variant="display"
            serif
            style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
          >
            {card.headline}
          </T>
          <T
            variant="body"
            tone="secondary"
            style={{ marginBottom: spacing.md }}
          >
            {card.oneSentenceSummary}
          </T>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <MetaLine card={card} />
            </View>
            <ClaimChip status={card.leadClaimStatus} compact />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      {...press}
      style={{
        flexDirection: "row",
        gap: spacing.md,
        paddingVertical: spacing.lg,
        borderTopWidth: 1,
        borderColor: palette.rule,
      }}
    >
      <View style={{ flex: 1 }}>
        <T variant="section" tone="secondary">
          {card.topic.toUpperCase()}
        </T>
        <T
          variant="h2"
          serif
          numberOfLines={3}
          style={{ marginTop: spacing.xxs, marginBottom: spacing.xxs }}
        >
          {card.headline}
        </T>
        <T variant="bodySmall" tone="secondary" numberOfLines={2}>
          {card.oneSentenceSummary}
        </T>
        <View style={{ marginTop: spacing.sm }}>
          <MetaLine card={card} />
        </View>
      </View>
      <Thumb
        uri={card.heroImageUrl}
        outlets={card.sourcing.outlets}
        reducedMotion={reducedMotion}
      />
    </Pressable>
  );
});