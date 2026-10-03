/**
 * Today — the front page.
 *
 * One hero, then rows, in the server's editorial order. The app never re-ranks
 * this list locally: if a reader sees something first, that is the desk's decision,
 * and the line under the masthead says so.
 */
import { useCallback, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen, FeedList, LiveOrCached, ResourceGate } from "../../src/components/Feed";
import { Masthead, IconAction } from "../../src/components/ScreenHeader";
import { T } from "../../src/components/Typography";
import { getToday } from "../../src/api/endpoints";
import { FEED_MAX_AGE_MS } from "../../src/api/cache";
import { useResource } from "../../src/hooks/useResource";
import { greeting } from "../../src/model/claim";
import { spacing } from "../../src/theme";
import type { StoryCard, TodayPayload } from "../../src/api/types";

const PAGE = 20;

function mastheadDate(now = new Date()): string {
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function TodayScreen() {
  const resource = useResource(
    () => getToday({ limit: PAGE }),
    {
      cacheKey: "today.v1",
      maxAgeMs: FEED_MAX_AGE_MS,
      isEmpty: (payload) => !payload.hero && payload.stories.length === 0,
    }
  );

  const [extra, setExtra] = useState<StoryCard[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const payload: TodayPayload | null = resource.data;
  const edition = payload?.generatedAt;

  // A fresh edition invalidates pages fetched from the old one. Derived during
  // render (with a guard) rather than synchronised in an effect.
  const [lastEdition, setLastEdition] = useState<string | undefined>(undefined);
  if (edition !== lastEdition) {
    setLastEdition(edition);
    if (extra.length > 0) setExtra([]);
    if (nextOffset !== null) setNextOffset(null);
  }

  const effectiveNextOffset = nextOffset ?? payload?.nextOffset ?? null;

  const loadMore = useCallback(async () => {
    if (effectiveNextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getToday({ offset: effectiveNextOffset, limit: PAGE });
      setExtra((current) => [...current, ...page.stories]);
      setNextOffset(page.nextOffset);
    } catch {
      // Silence: the reader keeps what is on screen and can pull to refresh.
    } finally {
      setLoadingMore(false);
    }
  }, [effectiveNextOffset, loadingMore]);

  const items = [
    ...(payload?.hero ? [payload.hero] : []),
    ...(payload?.stories ?? []),
    ...extra,
  ];

  const gate = ResourceGate({
    resource,
    emptyTitle: "Nothing is published yet",
    emptyBody:
      "ETHOS only shows stories a desk has finished curating. When one is ready it appears here.",
    actionLabel: "Try again",
    onAction: resource.reload,
  });

  return (
    <Screen
      header={
        <>
          <Masthead
            date={mastheadDate()}
            right={
              <IconAction
                icon="settings-outline"
                label="Settings, about and privacy"
                onPress={() => router.push("/settings")}
              />
            }
          />
          <LiveOrCached resource={resource} />
        </>
      }
    >
      {gate ?? (
        <FeedList
          items={items}
          heroIndex={items.length > 0 ? 0 : -1}
          refreshing={resource.refreshing}
          onRefresh={resource.reload}
          onEndReached={loadMore}
          header={
            <View style={{ paddingBottom: spacing.md }}>
              <T variant="body" serif>
                {greeting()}
              </T>
              <T variant="bodySmall" tone="secondary" style={{ marginTop: spacing.xs }}>
                {payload
                  ? `${payload.totalStories} ${
                      payload.totalStories === 1 ? "story" : "stories"
                    } on the desk. Ordered by editors, not by an engagement model.`
                  : ""}
              </T>
            </View>
          }
          footer={
            <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xl }}>
              {effectiveNextOffset != null || loadingMore
                ? "More stories loading…"
                : `Outlet counts are not independence. Where ETHOS can group reprints of one dispatch, it says so.`}
            </T>
          }
        />
      )}
    </Screen>
  );
}