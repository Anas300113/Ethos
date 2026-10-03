/**
 * Data-state furniture. Every screen is built from these, which is how "never
 * show a blank screen" is enforced structurally rather than by remembering.
 */
import { View, Pressable, type ViewStyle } from "react-native";
import { T } from "./Typography";
import { usePalette, spacing } from "../theme";
import { failureMessage, type ApiFailure } from "../api/client";

function Shell({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const palette = usePalette();
  return (
    <View
      style={{
        paddingVertical: spacing.xxxl,
        paddingHorizontal: spacing.lg,
        alignItems: "center",
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: palette.rule,
        backgroundColor: palette.bg,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/** Shimmer-free placeholder: three hairline bars, no animated grey blob. */
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  const palette = usePalette();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading story"
      style={{ gap: spacing.sm }}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <View
          key={index}
          style={{
            height: index === 0 ? 22 : 12,
            width: index === 0 ? "72%" : "100%",
            backgroundColor: palette.skeleton,
          }}
        />
      ))}
    </View>
  );
}

export function FeedSkeleton({ cards = 3 }: { cards?: number }) {
  const palette = usePalette();
  return (
    <View style={{ gap: spacing.xl }}>
      {Array.from({ length: cards }).map((_, index) => (
        <View key={index} style={{ gap: spacing.sm }}>
          <View
            style={{
              height: 168,
              backgroundColor: palette.skeleton,
            }}
          />
          <SkeletonLines lines={2} />
        </View>
      ))}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const palette = usePalette();
  return (
    <Shell>
      <View
        style={{
          width: 28,
          height: 1,
          backgroundColor: palette.inkTertiary,
          marginBottom: spacing.lg,
        }}
      />
      <T variant="h2" serif style={{ marginBottom: spacing.sm, textAlign: "center" }}>
        {title}
      </T>
      <T
        variant="bodySmall"
        tone="secondary"
        style={{ textAlign: "center", maxWidth: 320 }}
      >
        {body}
      </T>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          style={{
            marginTop: spacing.lg,
            minHeight: 44,
            paddingHorizontal: spacing.xl,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: palette.ink,
          }}
        >
          <T variant="meta" tone="primary">
            {actionLabel}
          </T>
        </Pressable>
      ) : null}
    </Shell>
  );
}

export function ErrorState({
  failure,
  onRetry,
  noun = "stories",
}: {
  failure: ApiFailure;
  onRetry: () => void;
  noun?: string;
}) {
  return (
    <Shell>
      <T variant="h2" serif style={{ marginBottom: spacing.sm }}>
        ETHOS could not load {noun}
      </T>
      <T
        variant="bodySmall"
        tone="secondary"
        style={{ textAlign: "center", maxWidth: 320 }}
      >
        {failureMessage(failure)}
      </T>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        hitSlop={8}
        style={{
          marginTop: spacing.lg,
          minHeight: 44,
          paddingHorizontal: spacing.xl,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
        }}
      >
        <T variant="meta">Try again</T>
      </Pressable>
    </Shell>
  );
}

/**
 * The offline marker. Copy states when the content was fetched, because a stale
 * front page presented as live is exactly the failure this product exists to
 * avoid.
 */
export function OfflineNotice({
  servedAt,
  tone = "offline",
}: {
  servedAt: number | null;
  tone?: "offline" | "cached";
}) {
  const palette = usePalette();
  const label = servedAt
    ? `Saved on this device · ${new Date(servedAt).toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Saved on this device";
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: palette.updatedBg,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.screen,
      }}
    >
      <T variant="caption" color={palette.updated}>
        {tone === "offline" ? "OFFLINE · " : "NOT LIVE · "}
        {label}
      </T>
    </View>
  );
}