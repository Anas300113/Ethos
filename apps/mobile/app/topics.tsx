import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Screen, ResourceGate } from "../src/components/Feed";
import { BackHeader } from "../src/components/ScreenHeader";
import { T } from "../src/components/Typography";
import { ensureSession, getForYou, getTopics, toggleTopic } from "../src/api/endpoints";
import { ApiError } from "../src/api/client";
import { useResource } from "../src/hooks/useResource";
import { spacing, usePalette } from "../src/theme";
import type { StoryTopic } from "../src/api/types";

interface DeskEntry {
  topic: StoryTopic;
  storyCount: number;
}

async function loadDesks(): Promise<{ counts: DeskEntry[]; followed: StoryTopic[] }> {
  const topics = await getTopics();
  const forYou = await getForYou();
  return { counts: topics.topics, followed: forYou.followedTopics };
}

export default function TopicsScreen() {
  const resource = useResource(loadDesks, {
    isEmpty: (desks) => desks.counts.length === 0,
  });
  const gate = ResourceGate({
    resource,
    noun: "topics",
    emptyTitle: "No desks yet",
    emptyBody: "Once the desk publishes stories the desks appear here.",
    actionLabel: "Try again",
    onAction: resource.reload,
  });
  const [busy, setBusy] = useState<StoryTopic | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<StoryTopic, boolean>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const active = (topic: StoryTopic): boolean =>
    overrides[topic] ?? resource.data?.followed.includes(topic) ?? false;
  const flip = async (topic: StoryTopic) => {
    setBusy(topic);
    setMessage(null);
    try {
      await ensureSession();
      const result = await toggleTopic(topic);
      setOverrides((current) => ({ ...current, [topic]: result.followed }));
      if (result.followed) {
        setMessage(topic + " moves to the top of For you. Nothing is hidden.");
      } else {
        setMessage(topic + " no longer moves to the top. Nothing was hidden.");
      }
    } catch (error) {
      // A 401 here means there is no usable profile yet; ensureSession minted
      // one below us, so a single retry is the honest recovery.
      if (error instanceof ApiError && error.failure === "unauthorized") {
        try {
          await ensureSession();
          const result = await toggleTopic(topic);
          setOverrides((current) => ({ ...current, [topic]: result.followed }));
          setMessage(
            result.followed
              ? topic + " moves to the top of For you. Nothing is hidden."
              : topic + " no longer moves to the top. Nothing was hidden."
          );
          return;
        } catch {
          // Falls through to the generic offline copy below.
        }
      }
      setMessage("ETHOS could not reach the server.");
    } finally {
      setBusy(null);
    }
  };
  const counts = resource.data?.counts ?? [];
  const palette = usePalette();
  return (
    <Screen header={<BackHeader label="Desks you follow" />}>
      {gate ?? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl }}
        >
          <T variant="bodySmall" tone="secondary" style={{ paddingVertical: spacing.lg }}>
            Following a desk changes the order of For you, never its evidence.
          </T>
          {message ? <T variant="caption" tone="secondary">{message}</T> : null}
          {counts.map((entry, index) => (
            <View
              key={entry.topic}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderTopWidth: index === 0 ? 0 : 1,
                borderColor: palette.rule,
              }}
            >
              <View style={{ flex: 1 }}>
                <T variant="body">{entry.topic}</T>
                <T variant="caption" tone="tertiary">
                  {entry.storyCount} stories published
                </T>
              </View>
              <Pressable
                onPress={() => void flip(entry.topic)}
                disabled={busy === entry.topic}
                accessibilityRole="switch"
                accessibilityState={{ checked: active(entry.topic) }}
                accessibilityLabel={"Follow " + entry.topic}
                style={{
                  minHeight: 44,
                  minWidth: 120,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active(entry.topic) ? palette.ink : palette.rule,
                  backgroundColor: active(entry.topic) ? palette.ink : palette.surface,
                }}
              >
                <T variant="meta" color={active(entry.topic) ? palette.onAccent : palette.ink}>
                  {active(entry.topic) ? "FOLLOWING" : "FOLLOW"}
                </T>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
