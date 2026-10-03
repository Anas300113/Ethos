/**
 * Feed scaffolding: one padded screen, one list with all five data states, and one
 * section renderer for short, curated groupings. Screens compose these so that no
 * screen can forget an empty state or serve cache without saying so.
 */
import type { ReactElement, ReactNode } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  View,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "./Typography";
import { StoryCard } from "./StoryCard";
import {
  EmptyState,
  ErrorState,
  FeedSkeleton,
  OfflineNotice,
} from "./ScreenState";
import { usePalette, spacing } from "../theme";
import type { Resource } from "../hooks/useResource";
import type { StoryCard as StoryCardModel } from "../api/types";

/** Full-bleed screen with the status bar respected and the palette applied. */
export function Screen({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactElement | null;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        paddingTop: insets.top,
      }}
    >
      {header ?? null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/**
 * The node a screen must render INSTEAD of its content, or null when there is
 * content to show. Returning it from one call is how every screen ends up with the
 * same five states.
 */
export function ResourceGate<T>({
  resource,
  noun = "stories",
  emptyTitle,
  emptyBody,
  actionLabel,
  onAction,
}: {
  resource: Resource<T>;
  noun?: string;
  emptyTitle: string;
  emptyBody: string;
  actionLabel?: string;
  onAction?: () => void;
}): ReactNode | null {
  if (resource.status === "loading") {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.screen }}
        scrollEnabled={false}
      >
        <FeedSkeleton />
      </ScrollView>
    );
  }
  if (resource.status === "error" && resource.failure) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <ErrorState
          failure={resource.failure}
          onRetry={resource.reload}
          noun={noun}
        />
      </ScrollView>
    );
  }
  if (resource.status === "empty") {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <EmptyState
          title={emptyTitle}
          body={emptyBody}
          actionLabel={actionLabel}
          onAction={onAction}
        />
      </ScrollView>
    );
  }
  return null;
}

interface FeedListProps {
  items: StoryCardModel[];
  /** Index within `items` to render as the hero; -1 for none. */
  heroIndex?: number;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached?: () => void;
  header?: ReactElement | null;
  footer?: ReactElement | null;
  contentPadding?: number;
  /** Per-row extra line — "updated since you saved it" on the Saved screen. */
  renderMeta?: (item: StoryCardModel) => ReactNode;
}

export function FeedList({
  items,
  heroIndex = -1,
  refreshing,
  onRefresh,
  onEndReached,
  header,
  footer,
  contentPadding = spacing.screen,
  renderMeta,
}: FeedListProps) {
  const palette = usePalette();
  const renderItem: ListRenderItem<StoryCardModel> = ({ item, index }) => (
    <View style={{ paddingTop: index === 0 ? spacing.lg : 0 }}>
      <StoryCard card={item} variant={index === heroIndex ? "hero" : "row"} />
      {renderMeta?.(item)}
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.slug}
      renderItem={renderItem}
      ListHeaderComponent={header ?? null}
      ListFooterComponent={
        footer ? <View style={{ paddingBottom: spacing.xxl }}>{footer}</View> : null
      }
      contentContainerStyle={{
        paddingHorizontal: contentPadding,
        paddingBottom: spacing.xxxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.inkSecondary}
          colors={[palette.inkSecondary]}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      initialNumToRender={8}
      windowSize={7}
      accessibilityRole="list"
    />
  );
}

/** A titled group of cards inside a scrolling screen (For you, Related). */
export function FeedSection({
  title,
  note,
  items,
  heroIndex = -1,
}: {
  title: string;
  note?: string;
  items: StoryCardModel[];
  heroIndex?: number;
}) {
  const palette = usePalette();
  if (items.length === 0) return null;
  return (
    <View
      accessibilityRole="summary"
      style={{ borderTopWidth: 1, borderColor: palette.rule, paddingTop: spacing.lg }}
    >
      <T variant="section" tone="secondary">
        {title.toUpperCase()}
      </T>
      {note ? (
        <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
          {note}
        </T>
      ) : null}
      <View style={{ marginTop: spacing.sm }}>
        {items.map((card, index) => (
          <StoryCard
            key={card.slug}
            card={card}
            variant={index === heroIndex ? "hero" : "row"}
          />
        ))}
      </View>
    </View>
  );
}

/** The strip above a feed that is not live, so cache never reads as breaking news. */
export function LiveOrCached({ resource }: { resource: Resource<unknown> }) {
  if (resource.status !== "cached") return null;
  return (
    <OfflineNotice
      servedAt={resource.servedAt}
      tone={resource.failure === "offline" ? "offline" : "cached"}
    />
  );
}