/**
 * Mobile transport shapes.
 *
 * One rule drives all of these: the server answers the independence question,
 * the client never does. A phone that only receives `sources.length` will
 * eventually render "4 outlets" for 4 reprint copies of one wire dispatch, so
 * every card and dossier carries the computed sourcing summary instead.
 */
import {
  sharedOriginNote,
  sourcingHeadline,
  summariseSourcing,
} from "@/lib/sourcing-summary";
import type { ArticleSource, ClaimStatus, Story, StoryTopic } from "@/types/story";

/** What a card needs. Nothing here requires the full dossier. */
export interface StoryCardData {
  slug: string;
  headline: string;
  oneSentenceSummary: string;
  topic: StoryTopic;
  readingTimeMinutes: number;
  lastUpdated: string;
  version: number;
  isDeveloping: boolean;
  heroImageUrl?: string;
  heroImageCaption?: string;
  sources: ArticleSource[];
  /** Claim statuses in publish order; the first is the lead claim. */
  claimStatuses: ClaimStatus[];
  correctionCount: number;
}

export interface MobileSourcing {
  outlets: number;
  origins: number;
  /** False when no grouping pass has run — independence is unknown, not 1:1. */
  grouped: boolean;
  headline: string;
  note: string | null;
  shared: { label: string; outlets: string[] }[];
}

export function sourcingFor(sources: ArticleSource[]): MobileSourcing {
  const summary = summariseSourcing(sources);
  return {
    outlets: summary.outlets,
    origins: summary.origins,
    grouped: summary.grouped,
    headline: sourcingHeadline(summary),
    note: sharedOriginNote(summary),
    shared: summary.shared.map((entry) => ({
      label: entry.label,
      outlets: entry.outlets,
    })),
  };
}

export interface MobileStoryCard extends StoryCardData {
  sourcing: MobileSourcing;
  /** Status of the lead claim — the badge a card may honestly show. */
  leadClaimStatus: ClaimStatus | null;
  statusSummary: { status: ClaimStatus; count: number }[];
}

/** Adapt a full dossier (web DAL shape) to the card shape. */
export function cardDataFromStory(story: Story): StoryCardData {
  return {
    slug: story.slug,
    headline: story.headline,
    oneSentenceSummary: story.oneSentenceSummary,
    topic: story.topic,
    readingTimeMinutes: story.readingTimeMinutes,
    lastUpdated: story.lastUpdated,
    version: story.version,
    isDeveloping: story.isDeveloping ?? false,
    heroImageUrl: story.heroImageUrl,
    heroImageCaption: story.heroImageCaption,
    sources: story.sources,
    claimStatuses: story.claims.map((claim) => claim.status),
    correctionCount: (story.updates ?? []).filter(
      (update) => update.kind === "CORRECTION"
    ).length,
  };
}

export function toMobileCard(data: StoryCardData): MobileStoryCard {
  const tally = new Map<ClaimStatus, number>();
  for (const status of data.claimStatuses) {
    tally.set(status, (tally.get(status) ?? 0) + 1);
  }
  return {
    ...data,
    sourcing: sourcingFor(data.sources),
    leadClaimStatus: data.claimStatuses[0] ?? null,
    statusSummary: [...tally.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** A bookmark: the card plus what the reader's copy said. */
export interface MobileSavedStory extends MobileStoryCard {
  savedVersion: number;
  savedAt: string;
  /** The curated story moved on after this copy was saved. */
  updatedSinceSaved: boolean;
}

/** Everything the story screen needs in one request. */
export interface MobileStoryDetail {
  story: Story;
  sourcing: MobileSourcing;
  corrections: Story["updates"];
  correctionCount: number;
  related: MobileStoryCard[];
  saved: boolean;
  savedVersion: number | null;
  updatedSinceSaved: boolean;
  /** Absolute web URL, so the app can share/open in a browser. */
  webUrl: string;
}

export interface MobileTopic {
  topic: StoryTopic;
  storyCount: number;
}

/**
 * The topic vocabulary, served rather than duplicated. The app renders its
 * picker from this list, so adding a topic to the schema cannot leave a phone
 * showing a stale set of buttons.
 */
export const ALL_TOPICS: StoryTopic[] = [
  "UK",
  "World",
  "Technology",
  "Science",
  "Business",
  "Climate",
  "Sport",
  "Culture",
  "Health",
  "Education",
];

export function isStoryTopic(value: unknown): value is StoryTopic {
  return typeof value === "string" && (ALL_TOPICS as string[]).includes(value);
}
