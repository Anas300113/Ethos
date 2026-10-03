/**
 * For you — ordering, not filtering.
 *
 * Followed desks are grouped to the top and everything still in motion is shown
 * underneath them. That is the whole mechanism, and the screen says so in the
 * server's own words (`personalisation`), because a "For you" page that quietly
 * hides what you do not follow is the page this product argues against.
 *
 * Not cached on the device: followed topics are personal data.
 */
import { ScrollView, View, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Screen, FeedSection, ResourceGate } from "../../src/components/Feed";
import { TabTitleHeader, IconAction } from "../../src/components/ScreenHeader";
import { T } from "../../src/components/Typography";
import { getForYou } from "../../src/api/endpoints";
import { useResource } from "../../src/hooks/useResource";
import { updatedLabel } from "../../src/model/claim";
import { spacing, usePalette } from "../../src/theme";

export default function ForYouScreen() {
  const palette = usePalette();
  const resource = useResource(() => getForYou(), {
    isEmpty: (payload) =>
      payload.followed.length === 0 && payload.alsoDeveloping.length === 0,
  });

  const gate = ResourceGate({
    resource,
    noun: "your page",
    emptyTitle: "Nothing published yet",
    emptyBody:
      "Once the desk publishes stories they appear here, grouped by the topics you follow.",
    actionLabel: "Try again",
    onAction: resource.reload,
  });

  const payload = resource.data;

  return (
    <Screen
      header={
        <TabTitleHeader
          title="For you"
          subtitle={
            payload
              ? `Updated ${updatedLabel(payload.generatedAt)}`
              : "Ordered by the topics you follow"
          }
          right={
            <IconAction
              icon="options-outline"
              label="Choose topics you follow"
              onPress={() => router.push("/topics")}
            />
          }
        />
      }
    >
      {gate ?? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.screen,
            paddingBottom: spacing.xxxl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={resource.refreshing}
              onRefresh={resource.reload}
              tintColor={palette.inkSecondary}
              colors={[palette.inkSecondary]}
            />
          }
        >
          <View style={{ paddingVertical: spacing.lg }}>
            <T variant="bodySmall" tone="secondary">
              {payload?.personalisation ??
                "Personalisation changes the order of stories, never their evidence."}
            </T>
            {payload && !payload.hasPreferences ? (
              <T
                variant="bodySmall"
                style={{ marginTop: spacing.sm, textDecorationLine: "underline" }}
                onPress={() => router.push("/topics")}
                role="button"
              >
                Choose topics you follow to bring them to the top.
              </T>
            ) : null}
          </View>

          <FeedSection
            title={
              payload && payload.followedTopics.length > 0
                ? `Your topics · ${payload.followedTopics.join(", ")}`
                : "Your topics"
            }
            note={
              payload && payload.followed.length === 0
                ? "Nothing new from the topics you follow."
                : undefined
            }
            items={payload?.followed ?? []}
            heroIndex={0}
          />

          <FeedSection
            title="Also developing"
            note="Everything else the desk is still working on — followed or not."
            items={payload?.alsoDeveloping ?? []}
          />
        </ScrollView>
      )}
    </Screen>
  );
}