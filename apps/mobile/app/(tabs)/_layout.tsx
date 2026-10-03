/**
 * Bottom navigation. Four destinations, all reachable with a thumb, none of them a
 * "More" drawer — a news app whose second section is hidden is a news app with one
 * section.
 */
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePalette, spacing } from "../../src/theme";

export default function TabsLayout() {
  const palette = usePalette();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.ink,
        tabBarInactiveTintColor: palette.inkTertiary,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.rule,
          borderTopWidth: 1,
          height: undefined,
          paddingTop: spacing.xs,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          letterSpacing: 0.6,
          fontWeight: "500",
        },
        tabBarIcon: ({ focused, color, size }) => {
          const glyphs: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            today: ["newspaper-outline", "newspaper"],
            "for-you": ["compass-outline", "compass"],
            search: ["search-outline", "search"],
            saved: ["bookmark-outline", "bookmark"],
          };
          const pair = glyphs[route.name] ?? ["help-outline", "help"];
          return (
            <Ionicons
              name={focused ? (pair[1] as keyof typeof Ionicons.glyphMap) : (pair[0] as keyof typeof Ionicons.glyphMap)}
              size={size ?? 24}
              color={color}
            />
          );
        },
      })}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="for-you" options={{ title: "For you" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="saved" options={{ title: "Saved" }} />
    </Tabs>
  );
}