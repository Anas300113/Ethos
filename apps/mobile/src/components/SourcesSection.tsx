/**
 * Sources, grouped the way the curation pipeline grouped them (Phase 6).
 *
 * The distinction a reader cannot infer from an outlet list: three headlines from
 * four outlets is ONE story told by three origins, not four. Only a stored
 * sourcing group can say that, so:
 *   - grouped origins are labelled with their shared label ("via Reuters");
 *   - ungrouped sources are labelled "Sourcing origin not recorded" and the
 *     section says independence was not measured. It never infers it.
 */
import { Linking, Pressable, View } from "react-native";
import { T } from "./Typography";
import { sharedOriginLine, sourceRoleLabel, sourcingBadge } from "../model/sourcing";
import { updatedLabel } from "../model/claim";
import { usePalette, spacing, minTouchTarget } from "../theme";
import type { ArticleSource, Sourcing } from "../api/types";

interface Grouped {
  key: string;
  label: string;
  sources: ArticleSource[];
}

const TIER_LABELS: Record<string, string> = {
  PRIMARY: "Primary reporting",
  SECONDARY_TIER1: "National reporting",
  SECONDARY_TIER2: "Other reporting",
  FACT_CHECKER: "Fact check",
};

function group(sources: ArticleSource[]): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const source of sources) {
    // An ungrouped source gets its OWN key: without a stored group we may not
    // merge two outlets into one origin, however plausible that looks.
    const key =
      source.sourcingGroup ?? `unrecorded:${source.publisher.domain}`;
    const entry =
      map.get(key) ??
      {
        key,
        label: source.sharedSourceLabel ?? source.publisher.name,
        sources: [],
      };
    entry.sources.push(source);
    map.set(key, entry);
  }
  // Groups with more outlets first: that is where a shared wire story shows up.
  return [...map.values()].sort((a, b) => b.sources.length - a.sources.length);
}

function SourceRow({
  source,
  outletsInGroup,
}: {
  source: ArticleSource;
  outletsInGroup: number;
}) {
  const palette = usePalette();
  return (
    <View style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderColor: palette.rule }}>
      <T variant="caption" tone="tertiary">
        {(TIER_LABELS[source.publisher.tier] ?? "Reporting").toUpperCase()}
      </T>
      <T variant="body" serif style={{ marginTop: spacing.xxs }}>
        {source.title}
      </T>
      <T variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
        {source.publisher.name} ·{" "}
        {sourceRoleLabel(source, outletsInGroup)} ·{" "}
        {updatedLabel(source.publishedAt)}
      </T>
      <Pressable
        onPress={() => void Linking.openURL(source.url)}
        accessibilityRole="link"
        accessibilityLabel={`Open original article: ${source.title} from ${source.publisher.name}`}
        style={{ minHeight: minTouchTarget, justifyContent: "center" }}
      >
        <T variant="meta" style={{ textDecorationLine: "underline" }}>
          OPEN SOURCE
        </T>
      </Pressable>
    </View>
  );
}

export function SourcesSection({
  sources,
  sourcing,
}: {
  sources: ArticleSource[];
  sourcing: Sourcing;
}) {
  const palette = usePalette();
  const badge = sourcingBadge(sourcing);
  const groups = group(sources);

  return (
    <View>
      <T variant="section" tone="secondary">
        SOURCES
      </T>
      <T variant="bodySmall" tone="secondary" style={{ marginTop: spacing.sm }}>
        {badge.label}.
      </T>
      {badge.caveat ? (
        <T variant="caption" color={palette.updated} style={{ marginTop: spacing.xs }}>
          {badge.caveat}
        </T>
      ) : null}
      {sourcing.note ? (
        <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
          {sourcing.note}
        </T>
      ) : null}

      {groups.map((entry) => (
        <View key={entry.key} style={{ marginTop: spacing.lg }}>
          <T variant="meta" style={{ fontWeight: "600" }}>
            {entry.label}
          </T>
          {entry.sources.length > 1 ? (
            <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xxs }}>
              {sharedOriginLine({
                label: entry.label,
                outlets: [...new Set(entry.sources.map((s) => s.publisher.name))],
              })}
            </T>
          ) : null}
          {entry.sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              outletsInGroup={entry.sources.length}
            />
          ))}
        </View>
      ))}
    </View>
  );
}