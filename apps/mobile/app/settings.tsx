/**
 * Settings, about and privacy — the screen the rest of the app points
 * at when it says "you can erase it any time".
 */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Screen } from "../src/components/Feed";
import { BackHeader } from "../src/components/ScreenHeader";
import { T } from "../src/components/Typography";
import { clearCache, FEED_MAX_AGE_MS } from "../src/api/cache";
import { forgetReader, getMeta, getReaderProfile } from "../src/api/endpoints";
import { readReaderToken } from "../src/api/session";
import { useResource } from "../src/hooks/useResource";
import { spacing, usePalette } from "../src/theme";

interface Privacy {
  signed: boolean;
  readerId: string | null;
  bookmarks: number;
  followedTopics: number;
  readReceipts: number;
  neverStored: string[];
}

async function loadPrivacy(): Promise<Privacy> {
  const token = await readReaderToken();
  if (!token) {
    return { signed: false, readerId: null, bookmarks: 0, followedTopics: 0, readReceipts: 0, neverStored: [] };
  }
  try {
    const profile = await getReaderProfile();
    return {
      signed: true,
      readerId: profile.readerId,
      bookmarks: profile.stored.bookmarks,
      followedTopics: profile.stored.followedTopics,
      readReceipts: profile.stored.readReceipts,
      neverStored: Object.entries(profile.notStored)
        .filter(([, stored]) => stored === false)
        .map(([key]) => key),
    };
  } catch {
    // A stale local token (rotated secret, erased profile) is not a screen
    // error state: show "nothing held" with an honest copy update below.
    return { signed: false, readerId: null, bookmarks: 0, followedTopics: 0, readReceipts: 0, neverStored: [] };
  }
}

export default function SettingsScreen() {
  const palette = usePalette();
  const meta = useResource(getMeta, { cacheKey: "meta.v1", maxAgeMs: FEED_MAX_AGE_MS });
  const privacy = useResource(loadPrivacy);
  const [erasing, setErasing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const detail = meta.data;
  const held = privacy.data;
  const forget = async () => {
    setErasing(true);
    setMessage(null);
    try {
      await forgetReader();
      await clearCache();
      privacy.reload();
      setMessage("Erased. Bookmarks, desks and read receipts for this device are gone.");
    } catch {
      setMessage("ETHOS could not reach the server, so nothing was erased.");
    } finally {
      setErasing(false);
    }
  };
  const clearOffline = async () => {
    setClearing(true);
    try {
      await clearCache();
      setMessage("Offline copies cleared. The next feed loads fresh.");
    } finally {
      setClearing(false);
    }
  };
  return (
    <Screen header={<BackHeader label="Settings, about and privacy" />}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl }}
      >
        <T variant="section" tone="secondary" style={{ marginTop: spacing.xl }}>
          ABOUT THIS BUILD
        </T>
        <T variant="bodySmall" tone="secondary" style={{ marginTop: spacing.sm }}>
          {detail
            ? `${detail.stories.published} published stories · ${detail.corrections.published} corrections · sourcing ${detail.sourcing.independenceMeasured ? "measured" : "not yet measured"} · ${detail.publicBaseUrl}`
            : meta.failure
              ? "ETHOS could not say what this build is connected to."
              : "Loading what this build is connected to…"}
        </T>
        <T variant="section" tone="secondary" style={{ marginTop: spacing.xl }}>
          WHAT THIS DEVICE HOLDS
        </T>
        <T variant="bodySmall" tone="secondary" style={{ marginTop: spacing.sm }}>
          {!held || !held.signed
            ? "Nothing yet. The first save or follow creates an anonymous profile — no name, no e-mail, no login."
            : `${held.bookmarks} bookmarks · ${held.followedTopics} desks followed · ${held.readReceipts} read receipts. Never stored: ${held.neverStored.join(", ") || "—"}.`}
        </T>
        {message ? (
          <T variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
            {message}
          </T>
        ) : null}
        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
          <Pressable
            onPress={() => void forget()}
            disabled={erasing}
            accessibilityRole="button"
            accessibilityLabel="Erase everything this device holds"
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: palette.ink,
              opacity: erasing ? 0.5 : 1,
            }}
          >
            <T variant="meta">{erasing ? "ERASING…" : "ERASE EVERYTHING"}</T>
          </Pressable>
          <Pressable
            onPress={() => void clearOffline()}
            disabled={clearing}
            accessibilityRole="button"
            accessibilityLabel="Clear offline copies"
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: palette.rule,
              opacity: clearing ? 0.5 : 1,
            }}
          >
            <T variant="meta" tone="secondary">
              {clearing ? "CLEARING…" : "CLEAR OFFLINE COPIES"}
            </T>
          </Pressable>
        </View>
        <T variant="caption" tone="tertiary" style={{ marginTop: spacing.sm }}>
          Erasing deletes the anonymous profile from the server and clears offline
          copies. There is no account to recover.
        </T>
      </ScrollView>
    </Screen>
  );
}
