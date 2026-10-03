/**
 * Search — published stories, and nothing else.
 *
 * Two honesty rules live here: results are curated stories (an ingested-but-unverified
 * article is not an answer), and every result says *where* it matched, so a hit is
 * explained rather than magical. With no term typed, the screen offers the desks that
 * actually have stories, with their counts.
 */
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Screen, FeedList, LiveOrCached, ResourceGate } from "../../src/components/Feed";
import { TabTitleHeader } from "../../src/components/ScreenHeader";
import { T } from "../../src/components/Typography";
import { getSearch, getTopics } from "../../src/api/endpoints";
import { FEED_MAX_AGE_MS } from "../../src/api/cache";
import { useResource } from "../../src/hooks/useResource";
import { spacing, usePalette, minTouchTarget } from "../../src/theme";
import type { StoryTopic } from "../../src/api/types";

const DEBOUNCE_MS = 350;

export default function SearchScreen() {
  const palette = usePalette();
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [topic, setTopic] = useState<StoryTopic | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSubmitted(term.trim().slice(0, 200)), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const browsing = submitted.length === 0 && topic === null;
  const enabled = !browsing;

  const topicsResource = useResource(getTopics, {
    cacheKey: "topics.v1",
    maxAgeMs: FEED_MAX_AGE_MS,
  });

  const resultsResource = useResource(
    () => getSearch({ q: submitted, topic: topic ?? undefined }),
    {
      enabled,
      cacheKey: enabled ? `search.${topic ?? "all"}.${submitted}` : undefined,
      maxAgeMs: FEED_MAX_AGE_MS,
      isEmpty: (payload) => payload.results.length === 0,
    }
  );

  const chips = useMemo(
    () => (topicsResource.data?.topics ?? []).filter((entry) => entry.storyCount > 0),
    [topicsResource.data]
  );

  const clearAll = () => {
    setTerm("");
    setSubmitted("");
    setTopic(null);
  };

  const gate = ResourceGate({
    resource: resultsResource,
    noun: "results",
    emptyTitle: submitted ? `No story matches “${submitted}”` : "That desk is empty",
    emptyBody:
      "ETHOS searches curated stories — headline, summary, claim text and the outlets that reported them. It does not search the whole internet, and it will not show an article the desk has not verified.",
    actionLabel: "Clear and browse",
    onAction: clearAll,
  });

  return (
    <Screen
      header={
        <>
          <TabTitleHeader title="Search" subtitle="Published stories only" />
          <View
            style={{
              paddingHorizontal: spacing.screen,
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
              borderBottomWidth: 1,
              borderColor: palette.rule,
            }}
          >
            <TextInput
              value={term}
              onChangeText={setTerm}
              placeholder="Search stories, claims, outlets"
              placeholderTextColor={palette.inkTertiary}
              accessibilityLabel="Search published stories"
              autoCorrect={false}
              returnKeyType="search"
              maxLength={200}
              onSubmitEditing={() => setSubmitted(term.trim().slice(0, 200))}
              style={{
                minHeight: minTouchTarget,
                borderWidth: 1,
                borderColor: palette.rule,
                backgroundColor: palette.surface,
                paddingHorizontal: spacing.md,
                fontSize: 16,
                color: palette.ink,
              }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginTop: spacing.md }}
              accessibilityLabel="Filter by topic"
            >
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TopicChip
                  label="All"
                  selected={topic === null}
                  onPress={() => setTopic(null)}
                />
                {chips.map((entry) => (
                  <TopicChip
                    key={entry.topic}
                    label={`${entry.topic} ${entry.storyCount}`}
                    selected={topic === entry.topic}
                    onPress={() =>
                      setTopic((current) => (current === entry.topic ? null : entry.topic))
                    }
                  />
                ))}
              </View>
            </ScrollView>
          </View>
          <LiveOrCached resource={resultsResource} />
        </>
      }
    >
      {browsing ? <BrowseDesk chips={chips} cached={topicsResource.status === "cached"} onPick={(picked) => { setTopic(picked); setTerm(""); setSubmitted(""); }} /> : gate ?? (
        <FeedList
          items={resultsResource.data?.results ?? []}
          refreshing={resultsResource.refreshing}
          onRefresh={resultsResource.reload}
          renderMeta={(item) => {
            const matched = (item as { matchedIn?: string[] }).matchedIn ?? [];
            if (matched.length === 0) return null;
            return (
              <T
                variant="caption"
                tone="tertiary"
                style={{ marginTop: -spacing.md, paddingBottom: spacing.md }}
              >
                {`Matched in ${matched.join(", ")}`}
              </T>
            );
          }}
        />
      )}
    </Screen>
  );
}

/** Empty-query state: the desks that have stories, counted from the server. */
function BrowseDesk({
  chips,
  cached,
  onPick,
}: {
  chips: { topic: StoryTopic; storyCount: number }[];
  cached: boolean;
  onPick: (topic: StoryTopic) => void;
}) {
  const palette = usePalette();
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: spacing.screen,
        paddingVertical: spacing.xl,
      }}
    >
      <T variant="body" serif style={{ marginBottom: spacing.md }}>
        Type a name, a place, or a phrase.
      </T>
      <T variant="bodySmall" tone="secondary">
        Or start from a desk. These counts are what is published right now
        {cached ? " (as of the copy saved on this device)" : ""}:
      </T>
      <View style={{ marginTop: spacing.lg }}>
        {chips.map((entry, index) => (
          <Pressable
            key={entry.topic}
            onPress={() => onPick(entry.topic)}
            accessibilityRole="button"
            accessibilityLabel={`${entry.topic}, ${entry.storyCount} published stories`}
            style={{
              minHeight: minTouchTarget,
              justifyContent: "center",
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
              borderTopWidth: index === 0 ? 0 : 1,
              borderColor: palette.rule,
            }}
          >
            <T variant="body">{entry.topic}</T>
            <T variant="caption" tone="tertiary">
              {entry.storyCount} {entry.storyCount === 1 ? "story" : "stories"}
            </T>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

/** Small-caps desk filter. Selected state is colour *and* weight, never colour alone. */
function TopicChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: minTouchTarget - 8,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderWidth: 1,
        borderColor: selected ? palette.ink : palette.rule,
        backgroundColor: selected ? palette.ink : palette.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <T
        variant="caption"
        color={selected ? palette.onAccent : palette.inkSecondary}
        style={{ fontWeight: selected ? "700" : "500" }}
      >
        {label.toUpperCase()}
      </T>
    </Pressable>
  );
}