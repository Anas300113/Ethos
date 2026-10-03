/**
 * Root layout: appearance, deep links, and a hard refusal to run a production
 * build that is pointed at a development API.
 *
 * Headers are drawn by the screens, not by the navigator, so the masthead can be
 * typographic instead of a coloured bar.
 */
import { useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { T } from "../src/components/Typography";
import { apiConfigProblem } from "../src/api/client";
import { SCHEME, WEB_ORIGIN } from "../src/config";
import { usePalette, spacing } from "../src/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * `ethos://story/<slug>` and `https://<web origin>/story/<slug>` both resolve to
 * the same screen, so a link shared from either form lands on the same story.
 */
export const linking = {
  prefixes: [`${SCHEME}://`, WEB_ORIGIN].filter(Boolean),
  config: {
    screens: {
      "story/[slug]": "story/:slug",
      topics: "topics",
      settings: "settings",
      "(tabs)": {
        screens: {
          today: "",
          "for-you": "for-you",
          search: "search",
          saved: "saved",
        },
      },
    },
  },
};

/**
 * A release build talking to a laptop is not a broken feed, it is a broken
 * release. Say so instead of showing a reviewer an empty app.
 */
function UnsafeBuild() {
  const palette = usePalette();
  const problem = apiConfigProblem();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        justifyContent: "center",
        padding: spacing.xxxl,
      }}
    >
      <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <T variant="section" tone="secondary">
          ETHOS
        </T>
        <T variant="h1" serif style={{ marginVertical: spacing.md }}>
          This build cannot reach ETHOS
        </T>
        <T variant="body" tone="secondary">
          {problem ??
            "The server address compiled into this build is not a secure ETHOS address."}
        </T>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const palette = usePalette();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (!__DEV__ && apiConfigProblem()) return <UnsafeBuild />;

  return (
    <>
      <StatusBar style={palette.name === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="story/[slug]" />
        <Stack.Screen name="topics" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}