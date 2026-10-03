/**
 * Saved stories.
 *
 * Deliberately NOT cached on the device: a saved list is personal data, and a shared
 * phone should not show someone else's reading history when they open the app. The
 * list lives on the server against an anonymous reader id, and Settings can erase it.
 */
import { router } from "expo-router";
import { View } from "react-native";
import { Screen, FeedList, ResourceGate } from "../../src/components/Feed";
import { TabTitleHeader, IconAction } from "../../src/components/ScreenHeader";
import { T } from "../../src/components/Typography";
import { getSaved } from "../../src/api/endpoints";
import { ApiError } from "../../src/api/client";
import { clearReaderToken, readReaderToken } from "../../src/api/session";
import { useResource } from "../../src/hooks/useResource";
import { updatedLabel } from "../../src/model/claim";
import { spacing, usePalette } from "../../src/theme";
import type { SavedStory } from "../../src/api/types";

/**
 * A fresh install has no token yet, and merely opening this tab must not mint
 * an identifier — so it shows the fetched empty state instead of a 401 error.
 * A token the server no longer recognises (profile erased, secret rotated) is
 * dropped locally rather than retried forever.
 */
async function loadSaved(): Promise<{ saved: SavedStory[]; count: number }> {
  if (!(await readReaderToken())) return { saved: [], count: 0 };
  try {
    return await getSaved();
  } catch (error) {
    if (error instanceof ApiError && error.failure === "unauthorized") {
      await clearReaderToken();
      return { saved: [], count: 0 };
    }
    throw error;
  }
}

export default function SavedScreen() {
  const palette = usePalette();
  const resource = useResource(loadSaved, {
    isEmpty: (payload) => payload.saved.length === 0,
  });

  const gate = ResourceGate({
    resource,
    noun: "your saved stories",
    emptyTitle: "Nothing saved yet",
    emptyBody:
      "Save a story from its header and it waits here. The list belongs to an anonymous device profile, not to you, and you can erase it from Settings at any time.",
    actionLabel: "Browse today's stories",
    onAction: () => router.replace("/(tabs)/today"),
  });

  return (
    <Screen
      header={
        <TabTitleHeader
          title="Saved"
          subtitle={
            resource.data
              ? `${resource.data.count} ${resource.data.count === 1 ? "story" : "stories"} · on this account only`
              : "Stories you keep"
          }
          right={
            <IconAction
              icon="settings-outline"
              label="Settings, about and privacy"
              onPress={() => router.push("/settings")}
            />
          }
        />
      }
    >
      {gate ?? (
        <FeedList
          items={resource.data?.saved ?? []}
          refreshing={resource.refreshing}
          onRefresh={resource.reload}
          renderMeta={(item) => {
            const saved = item as SavedStory;
            return (
              <View style={{ marginTop: -spacing.md, paddingBottom: spacing.md }}>
                <T variant="caption" tone="tertiary">
                  {"Saved " + updatedLabel(saved.savedAt)}
                  {saved.updatedSinceSaved ? " · " : ""}
                </T>
                {saved.updatedSinceSaved ? (
                  <T
                    variant="caption"
                    color={palette.updated}
                    style={{ marginTop: spacing.xxs }}
                  >
                    ETHOS has changed this story since you saved it. Open it to see what
                    moved, including any correction.
                  </T>
                ) : null}
              </View>
            );
          }}
          footer={
            <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xl }}>
              Saved stories keep the version you saved as a reference point, so a later
              correction can be shown against what you originally read.
            </T>
          }
        />
      )}
    </Screen>
  );
}