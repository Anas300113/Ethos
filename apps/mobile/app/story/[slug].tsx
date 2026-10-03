/**
 * The story dossier — the screen this whole product exists to serve.
 *
 * Order matters and is deliberate: corrections first (an errata you have to hunt for
 * is not an errata), then the narrative, then the claims with their verdicts one tap
 * away from the sentence they judge, then sourcing. The evidence sheet, not a badge,
 * carries the "why", so nothing here implies a number for truth.
 */
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Share, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, FeedSection, LiveOrCached, ResourceGate } from "../../src/components/Feed";
import { BackHeader, IconAction } from "../../src/components/ScreenHeader";
import { T } from "../../src/components/Typography";
import { HeroImage } from "../../src/components/StoryImage";
import { ClaimChip } from "../../src/components/ClaimChip";
import { EvidenceSheet } from "../../src/components/EvidenceSheet";
import { SourcesSection } from "../../src/components/SourcesSection";
import {
  ensureSession,
  getStory,
  markRead,
  toggleBookmark,
} from "../../src/api/endpoints";
import { rememberStory, STORY_MAX_AGE_MS, storyCacheKey } from "../../src/api/cache";
import { useResource } from "../../src/hooks/useResource";
import { sourcingBadge } from "../../src/model/sourcing";
import { updatedLabel } from "../../src/model/claim";
import { storyUrl } from "../../src/config";
import { spacing, usePalette } from "../../src/theme";
import type {
  Claim,
  SourceComparisonItem,
  StoryUpdate,
  TimelineEvent,
} from "../../src/api/types";

export default function StoryScreen() {
  const palette = usePalette();
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = params.slug ?? "";

  const resource = useResource(() => getStory(slug), {
    cacheKey: slug ? storyCacheKey(slug) : undefined,
    maxAgeMs: STORY_MAX_AGE_MS,
    enabled: slug.length > 0,
  });

  const [openClaim, setOpenClaim] = useState<Claim | null>(null);
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const detail = resource.data;

  // Moving between stories must not carry the previous dossier's save UI.
  // Derived during render (guarded) rather than synchronised in an effect.
  const [lastSlug, setLastSlug] = useState(slug);
  if (slug !== lastSlug) {
    setLastSlug(slug);
    if (savedOverride !== null) setSavedOverride(null);
    if (saveMessage !== null) setSaveMessage(null);
  }

  useEffect(() => {
    if (!slug || !resource.data) return;
    void rememberStory(slug);
    void markRead(slug);
  }, [slug, resource.data]);

  const saved = savedOverride ?? detail?.saved ?? false;

  const toggleSave = async () => {
    setBusy(true);
    setSaveMessage(null);
    try {
      await ensureSession();
      const result = await toggleBookmark(slug);
      setSavedOverride(result.saved);
      setSaveMessage(
        result.saved
          ? "Saved against this device's anonymous profile. Erase it any time in Settings."
          : "Removed from your saved stories."
      );
    } catch {
      setSaveMessage(
        "ETHOS could not reach the server, so nothing was saved. What is on this screen is still readable."
      );
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = detail?.webUrl || storyUrl(slug);
    try {
      await Share.share({
        message: `${detail?.story.headline ?? "ETHOS"}\n\n${url}`,
        url,
      });
    } catch {
      // The reader dismissed the sheet; there is nothing to report.
    }
  };

  const gate = ResourceGate({
    resource,
    noun: "this story",
    emptyTitle: "This story is not published",
    emptyBody:
      "ETHOS only serves stories a desk has finished verifying. If this link came from an older copy of the app, the story may have been withdrawn.",
    actionLabel: "Back to today",
  });

  const badge = useMemo(
    () => (detail ? sourcingBadge(detail.sourcing) : null),
    [detail]
  );

  return (
    <Screen
      header={
        <>
          <BackHeader
            label={detail?.story.topic ?? "Story"}
            actions={
              <>
                <IconAction
                  icon={saved ? "bookmark" : "bookmark-outline"}
                  label={saved ? "Remove from saved stories" : "Save this story"}
                  onPress={() => void toggleSave()}
                  disabled={busy}
                />
                <IconAction
                  icon="share-outline"
                  label="Share this story"
                  onPress={() => void share()}
                />
              </>
            }
          />
          <LiveOrCached resource={resource} />
        </>
      }
    >
      {gate ?? (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {detail ? (
            <>
              <Corrections corrections={detail.corrections} />

              <View style={{ paddingHorizontal: spacing.screen }}>
                <T
                  variant="section"
                  tone="secondary"
                  style={{ marginTop: spacing.xl }}
                >
                  {detail.story.isDeveloping ? "DEVELOPING · " : ""}
                  {detail.story.topic.toUpperCase()}
                </T>
                <T variant="display" serif style={{ marginTop: spacing.sm }}>
                  {detail.story.headline}
                </T>
                <T
                  variant="body"
                  tone="secondary"
                  style={{ marginTop: spacing.md }}
                >
                  {detail.story.oneSentenceSummary}
                </T>
                <T variant="caption" tone="tertiary" style={{ marginTop: spacing.md }}>
                  {badge?.label ?? ""} · updated{" "}
                  {updatedLabel(detail.story.lastUpdated)} ·{" "}
                  {detail.story.readingTimeMinutes} min read · version{" "}
                  {detail.story.version}
                </T>
                {detail.updatedSinceSaved && detail.saved ? (
                  <T
                    variant="caption"
                    color={palette.updated}
                    style={{ marginTop: spacing.sm }}
                  >
                    This changed after you saved it. Corrections, if there were any,
                    are shown above.
                  </T>
                ) : null}
                {saveMessage ? (
                  <T variant="meta" tone="secondary" style={{ marginTop: spacing.sm }}>
                    {saveMessage}
                  </T>
                ) : null}
              </View>

              <View style={{ marginTop: spacing.xl }}>
                <HeroImage
                  uri={detail.story.heroImageUrl}
                  caption={detail.story.heroImageCaption}
                  topic={detail.story.topic}
                  reducedMotion={false}
                />
              </View>

              <View style={{ paddingHorizontal: spacing.screen }}>
                <Prose label="WHAT HAPPENED" text={detail.story.whatHappened} />
                <Prose label="WHY IT MATTERS" text={detail.story.whyItMatters} />
                <BulletList
                  label="WHAT ETHOS STANDS ON"
                  items={detail.story.whatWeKnow}
                />
                <BulletList
                  label="WHAT IS STILL UNCLEAR"
                  items={detail.story.whatIsUnclear}
                  caution
                />
                <ClaimsList claims={detail.story.claims} onOpen={setOpenClaim} />
                <Differences items={detail.story.whereSourcesDiffer} />
                <Timeline events={detail.story.timeline} />
                <Updates events={detail.story.updates ?? []} />
              </View>

              <View
                style={{
                  paddingHorizontal: spacing.screen,
                  marginTop: spacing.xxl,
                  borderTopWidth: 1,
                  borderColor: palette.rule,
                  paddingTop: spacing.xl,
                }}
              >
                <SourcesSection
                  sources={detail.story.sources}
                  sourcing={detail.sourcing}
                />
              </View>

              <View style={{ paddingHorizontal: spacing.screen }}>
                <FeedSection title="More to check" items={detail.related} />
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
      <EvidenceSheet claim={openClaim} onClose={() => setOpenClaim(null)} />
    </Screen>
  );
}

/** Every block on the dossier: tracked label, hairline above, generous air below. */
function Section({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  const palette = usePalette();
  return (
    <View
      accessibilityRole="summary"
      style={{
        marginTop: spacing.xxl,
        borderTopWidth: 1,
        borderColor: palette.rule,
        paddingTop: spacing.lg,
      }}
    >
      <T variant="section" tone="secondary">
        {label}
      </T>
      {note ? (
        <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
          {note}
        </T>
      ) : null}
      <View style={{ marginTop: spacing.md }}>{children}</View>
    </View>
  );
}

function Prose({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <View style={{ marginTop: spacing.xl }}>
      <T variant="section" tone="secondary">
        {label}
      </T>
      <T variant="body" style={{ marginTop: spacing.md }}>
        {text}
      </T>
    </View>
  );
}

/**
 * Known facts vs. open questions, rendered with the same weight. The cautious list is
 * tinted rather than smaller: what is unclear is as much of the story as what is clear.
 */
function BulletList({
  label,
  items,
  caution = false,
}: {
  label: string;
  items: string[];
  caution?: boolean;
}) {
  const palette = usePalette();
  if (items.length === 0) return null;
  return (
    <Section
      label={label}
      note={
        caution
          ? "These are the parts ETHOS has not been able to establish. They are not guesses to fill in — they are gaps."
          : undefined
      }
    >
      <View style={{ gap: spacing.md }}>
        {items.map((item, index) => (
          <View key={`${label}-${index}`} style={{ flexDirection: "row", gap: spacing.md }}>
            <View
              accessibilityElementsHidden
              style={{
                width: 3,
                height: 3,
                borderRadius: 2,
                marginTop: 11,
                backgroundColor: caution ? palette.updated : palette.inkSecondary,
              }}
            />
            <T
              variant="body"
              style={{ flex: 1 }}
              color={caution ? palette.updated : undefined}
            >
              {item}
            </T>
          </View>
        ))}
      </View>
    </Section>
  );
}

/**
 * Corrections come first, before the headline. A correction buried at the bottom of a
 * page a reader has already believed is not a correction.
 */
function Corrections({ corrections }: { corrections: StoryUpdate[] }) {
  const palette = usePalette();
  if (corrections.length === 0) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: palette.updatedBg,
        paddingHorizontal: spacing.screen,
        paddingVertical: spacing.lg,
      }}
    >
      <T variant="section" color={palette.updated}>
        CORRECTIONS TO THIS STORY
      </T>
      {corrections.map((correction) => (
        <View key={correction.id} style={{ marginTop: spacing.md }}>
          <T variant="bodySmall" color={palette.updated}>
            {correction.whatChanged}
          </T>
          {correction.reason ? (
            <T variant="caption" tone="secondary" style={{ marginTop: spacing.xxs }}>
              {correction.reason}
            </T>
          ) : null}
          <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xxs }}>
            {updatedLabel(correction.timestamp)}
            {correction.sourceLabel ? ` · ${correction.sourceLabel}` : ""}
          </T>
        </View>
      ))}
    </View>
  );
}

/**
 * The claim list. The verdict chip sits on the sentence it judges, and the row opens
 * the evidence sheet — the sheet is the explanation, the chip is only the signpost.
 */
function ClaimsList({
  claims,
  onOpen,
}: {
  claims: Claim[];
  onOpen: (claim: Claim) => void;
}) {
  const palette = usePalette();
  if (claims.length === 0) return null;
  return (
    <Section
      label="CLAIMS ETHOS HAS CHECKED"
      note="Open a claim to see the document, the passage, and who decided it relates. Statuses are verdicts about evidence, not scores."
    >
      {claims.map((claim, index) => (
        <Pressable
          key={claim.id}
          onPress={() => onOpen(claim)}
          accessibilityRole="button"
          accessibilityLabel={`Evidence for claim: ${claim.statement}`}
          style={{
            paddingTop: spacing.lg,
            paddingBottom: spacing.lg,
            borderTopWidth: index === 0 ? 0 : 1,
            borderColor: palette.rule,
          }}
        >
          <ClaimChip status={claim.status} compact />
          <T variant="body" serif style={{ marginTop: spacing.sm }}>
            {claim.statement}
          </T>
          <T variant="caption" tone="secondary" numberOfLines={2} style={{ marginTop: spacing.xs }}>
            {claim.explanation}
          </T>
          <T variant="meta" tone="tertiary" style={{ marginTop: spacing.sm }}>
            WHY DOES ETHOS SAY THIS?
          </T>
        </Pressable>
      ))}
    </Section>
  );
}

/** Reporting compared side by side — the disagreement is the information. */
function Differences({ items }: { items: SourceComparisonItem[] }) {
  const palette = usePalette();
  if (items.length === 0) return null;
  return (
    <Section
      label="WHERE SOURCES DIFFER"
      note="Same event, different accounts. ETHOS does not average them."
    >
      {items.map((item) => (
        <View key={item.id} style={{ marginBottom: spacing.lg }}>
          <T variant="meta" style={{ fontWeight: "600" }}>
            {item.topic}
          </T>
          {item.points.map((point, index) => (
            <View
              key={`${item.id}-${index}`}
              style={{
                marginTop: spacing.sm,
                paddingLeft: spacing.md,
                borderLeftWidth: 1,
                borderColor: palette.rule,
              }}
            >
              <T variant="caption" tone="tertiary">
                {point.sourceName.toUpperCase()}
                {point.stance ? ` · ${point.stance}` : ""}
              </T>
              <T variant="bodySmall" style={{ marginTop: spacing.xxs }}>
                {point.reporting}
              </T>
            </View>
          ))}
        </View>
      ))}
    </Section>
  );
}

/** When it happened, in the order it happened. */
function Timeline({ events }: { events: TimelineEvent[] }) {
  const palette = usePalette();
  if (events.length === 0) return null;
  return (
    <Section label="HOW IT DEVELOPED">
      {events.map((event, index) => (
        <View
          key={event.id}
          style={{
            flexDirection: "row",
            gap: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
            borderTopWidth: index === 0 ? 0 : 1,
            borderColor: palette.rule,
          }}
        >
          <View style={{ width: 84 }}>
            <T variant="caption" tone="tertiary">
              {event.displayTime || updatedLabel(event.timestamp)}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="bodySmall">{event.eventText}</T>
            {event.sourceName ? (
              <T variant="caption" tone="tertiary" style={{ marginTop: spacing.xxs }}>
                {event.sourceName}
              </T>
            ) : null}
          </View>
          {event.sourceUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(event.sourceUrl as string)}
              accessibilityRole="link"
              accessibilityLabel="Open the source for this event"
              hitSlop={8}
              style={{ justifyContent: "center" }}
            >
              <Ionicons
                name="open-outline"
                size={18}
                color={palette.inkSecondary}
                accessibilityVisibility="hidden"
              />
            </Pressable>
          ) : null}
        </View>
      ))}
    </Section>
  );
}

/**
 * Every change to the story that was not a correction, including claim re-assessments.
 * An edit history is the cheapest form of accountability there is.
 */
function Updates({ events }: { events: StoryUpdate[] }) {
  const visible = events.filter((event) => event.kind !== "CORRECTION").slice(0, 6);
  if (visible.length === 0) return null;
  const kinds: Record<string, string> = {
    PUBLISHED: "Published",
    CONTENT_UPDATE: "Text updated",
    CLAIM_REASSESSED: "Claim re-assessed",
  };
  return (
    <Section label="EDITS TO THIS STORY">
      {visible.map((event) => (
        <View
          key={event.id}
          style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}
        >
          <T variant="caption" tone="tertiary">
            {(kinds[event.kind ?? "CONTENT_UPDATE"] ?? "Updated").toUpperCase()} ·{" "}
            {updatedLabel(event.timestamp)}
          </T>
          <T variant="bodySmall" style={{ marginTop: spacing.xxs }}>
            {event.whatChanged}
          </T>
          {event.previousState && event.newState ? (
            <T variant="caption" tone="secondary" style={{ marginTop: spacing.xxs }}>
              {event.previousState} → {event.newState}
              {event.claimStatement ? ` (${event.claimStatement})` : ""}
            </T>
          ) : null}
        </View>
      ))}
    </Section>
  );
}