/**
 * Client mirror of the server's mobile contract
 * (src/lib/mobile/dto.ts and src/lib/mobile/dal.ts in the Next app).
 *
 * Duplicated rather than shared through a workspace on purpose: a type-only
 * copy keeps the phone build independent of the Next toolchain, and the API
 * route tests assert the server still emits these fields.
 *
 * Everything optional is optional because an older cached payload may not have
 * it — the UI must degrade to "not recorded", never to a guess.
 */
import type { ClaimStatus } from "../model/claim";

export type SourceTier =
  | "PRIMARY"
  | "SECONDARY_TIER1"
  | "SECONDARY_TIER2"
  | "FACT_CHECKER";

export type StoryTopic =
  | "UK"
  | "World"
  | "Technology"
  | "Science"
  | "Business"
  | "Climate"
  | "Sport"
  | "Culture"
  | "Health"
  | "Education";

export interface Publisher {
  id: string;
  name: string;
  domain: string;
  tier: SourceTier;
  country?: string;
}

export interface ArticleSource {
  id: string;
  url: string;
  title: string;
  author?: string;
  publishedAt: string;
  retrievedAt: string;
  snippet?: string;
  /** Shared-origin key. Absent means the grouping pass has not run. */
  sourcingGroup?: string;
  sharedSourceLabel?: string;
  publisher: Publisher;
}

export interface PrimaryEvidence {
  id: string;
  title: string;
  url?: string;
  documentType: string;
  issuingBody: string;
  summary: string;
  date?: string;
  excerpt?: string;
  relationship?: string | null;
  relationshipReason?: string | null;
  supportingPassage?: string | null;
  assessmentMethod?: string | null;
  assessmentModel?: string | null;
}

export interface CorroboratingQuote {
  publisherName: string;
  url: string;
  quote: string;
}

export interface DisputingQuote extends CorroboratingQuote {
  disputeReason: string;
}

export interface Claim {
  id: string;
  statement: string;
  status: ClaimStatus;
  /** Present in the payload, deliberately never rendered as a headline number. */
  confidenceScore: number;
  explanation: string;
  claimType?: string;
  claimant?: string | null;
  extractionProvenance?: string;
  independentSourceCount?: number | null;
  sourcingNote?: string | null;
  primaryEvidence: PrimaryEvidence[];
  corroboratingSources: CorroboratingQuote[];
  disputingSources?: DisputingQuote[];
  lastVerified: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  displayTime: string;
  eventText: string;
  sourceUrl?: string;
  sourceName?: string;
}

export interface SourceComparisonItem {
  id: string;
  topic: string;
  points: { sourceName: string; reporting: string; stance?: string }[];
}

export interface StoryUpdate {
  id: string;
  timestamp: string;
  whatChanged: string;
  reason?: string;
  kind?: "PUBLISHED" | "CONTENT_UPDATE" | "CLAIM_REASSESSED" | "CORRECTION";
  claimStatement?: string | null;
  previousState?: string | null;
  newState?: string | null;
  sourceLabel?: string | null;
  evidenceUrl?: string | null;
}

/** The full dossier — the story screen's payload. */
export interface Story {
  id: string;
  slug: string;
  headline: string;
  oneSentenceSummary: string;
  heroImageUrl?: string;
  heroImageCaption?: string;
  topic: StoryTopic;
  readingTimeMinutes: number;
  lastUpdated: string;
  version: number;
  isDeveloping?: boolean;
  whatHappened: string;
  whyItMatters: string;
  whatWeKnow: string[];
  whatIsUnclear: string[];
  sourcesAgreeOn: string[];
  whereSourcesDiffer: SourceComparisonItem[];
  claims: Claim[];
  timeline: TimelineEvent[];
  primaryEvidence: PrimaryEvidence[];
  sources: ArticleSource[];
  updates?: StoryUpdate[];
  relatedStoryIds?: string[];
}

/** Computed by the server. The client never derives independence itself. */
export interface Sourcing {
  outlets: number;
  origins: number;
  grouped: boolean;
  headline: string;
  note: string | null;
  shared: { label: string; outlets: string[] }[];
}

export interface StoryCard {
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
  sourcing: Sourcing;
  leadClaimStatus: ClaimStatus | null;
  statusSummary: { status: ClaimStatus; count: number }[];
  correctionCount: number;
}

export interface SavedStory extends StoryCard {
  savedVersion: number;
  savedAt: string;
  updatedSinceSaved: boolean;
}

export interface StoryDetail {
  story: Story;
  sourcing: Sourcing;
  corrections: StoryUpdate[];
  correctionCount: number;
  related: StoryCard[];
  saved: boolean;
  savedVersion: number | null;
  updatedSinceSaved: boolean;
  webUrl: string;
  deepLink: string;
}

export interface TodayPayload {
  generatedAt: string;
  totalStories: number;
  hero: StoryCard | null;
  stories: StoryCard[];
  nextOffset: number | null;
}

export interface ForYouPayload {
  generatedAt: string;
  followedTopics: StoryTopic[];
  personalisation: string;
  followed: StoryCard[];
  alsoDeveloping: StoryCard[];
  hasPreferences: boolean;
}

export interface SearchPayload {
  query: string;
  results: (StoryCard & { matchedIn: string[] })[];
  topics: { topic: StoryTopic; storyCount: number }[];
  availableTopics: StoryTopic[];
}

export interface MetaPayload {
  apiVersion: string;
  app: { name: string; tagline: string };
  publicBaseUrl: string;
  stories: { published: number; lastUpdated: string | null };
  sourcing: { sources: number; grouped: number; independenceMeasured: boolean };
  corrections: { published: number };
}

export interface SessionPayload {
  readerId: string;
  token: string;
  expiresInSeconds: number;
  scopes: string[];
  personalData: boolean;
}

export interface ReaderProfilePayload {
  readerId: string;
  createdAt: string;
  stored: { bookmarks: number; followedTopics: number; readReceipts: number };
  notStored: Record<string, boolean>;
}