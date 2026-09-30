export type SourceTier =
  | "PRIMARY"
  | "SECONDARY_TIER1"
  | "SECONDARY_TIER2"
  | "FACT_CHECKER";

export type ClaimStatus =
  | "SUPPORTED"
  | "CORROBORATED"
  | "PARTIALLY_SUPPORTED"
  | "DISPUTED"
  | "UNVERIFIED"
  | "CONTRADICTED"
  | "OUTDATED";

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
  publisher: Publisher;
  url: string;
  title: string;
  author?: string;
  publishedAt: string;
  retrievedAt: string;
  snippet?: string;
  /** Shared-sourcing key (wire:<agency> / syndicated:<fp> / independent:<domain>). */
  sourcingGroup?: string;
  /** Reader-facing label for the shared origin ("Reuters", "independent"). */
  sharedSourceLabel?: string;
}

/** How a fetched document relates to the claim it was assessed against. */
export type EvidenceRelationship =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "MENTIONS_ONLY"
  | "IRRELEVANT"
  | "UNCLEAR";

export interface PrimaryEvidence {
  id: string;
  title: string;
  url?: string;
  documentType:
    | "STATISTICAL_RELEASE"
    | "GOVERNMENT_DOCUMENT"
    | "COURT_FILING"
    | "OFFICIAL_STATEMENT"
    | "PARLIAMENTARY_RECORD"
    | "ACADEMIC_PAPER";
  issuingBody: string;
  summary: string;
  date?: string;
  excerpt?: string;
  /** Assessed relationship to the linked claim(s); null on pre-assessment rows. */
  relationship?: EvidenceRelationship | null;
  relationshipReason?: string | null;
  supportingPassage?: string | null;
  assessmentMethod?: "DETERMINISTIC" | "AI_HYBRID" | null;
  assessmentModel?: string | null;
}

export interface Claim {
  id: string;
  statement: string;
  status: ClaimStatus;
  confidenceScore: number;
  explanation: string;
  /** What KIND of assertion this is (EVENT, NUMBER, PREDICTION, ...). */
  claimType?: string;
  /** Who asserted it when the reporting names one ("the minister said X"). */
  claimant?: string | null;
  /**
   * Honest label for WHERE this claim sentence came from: "remote:<model>",
   * "local-deterministic", or "local-deterministic:fallback" when a
   * configured model failed and the deterministic extractor took over.
   */
  extractionProvenance?: string;
  /** Independent sourcing groups behind this claim, not the raw outlet count. */
  independentSourceCount?: number | null;
  /** Reader-facing note when outlets repeat a shared source. */
  sourcingNote?: string | null;
  primaryEvidence: PrimaryEvidence[];
  corroboratingSources: {
    publisherName: string;
    url: string;
    quote: string;
  }[];
  disputingSources?: {
    publisherName: string;
    url: string;
    quote: string;
    disputeReason: string;
  }[];
  lastVerified: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  displayTime: string; // e.g. "10:15 GMT"
  eventText: string;
  sourceUrl?: string;
  sourceName?: string;
}

export type SourceStance = "CONFIRMS" | "ADDS_CONTEXT" | "DISPUTES" | "OMITS";

export interface SourceComparisonItem {
  id: string;
  topic: string;
  points: {
    sourceName: string;
    reporting: string;
    stance?: SourceStance;
  }[];
}

export interface StoryUpdate {
  id: string;
  timestamp: string;
  whatChanged: string;
  reason?: string;
  /** Why the story moved: content, correction, or ETHOS re-assessment. */
  kind?: "PUBLISHED" | "CONTENT_UPDATE" | "CLAIM_REASSESSED" | "CORRECTION";
  /** Soft reference to the claim concerned (provenance text, never a FK). */
  claimStatement?: string | null;
  previousState?: string | null;
  newState?: string | null;
  sourceLabel?: string | null;
  evidenceUrl?: string | null;
}

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

  // Editorial Narrative Sections
  whatHappened: string;
  whyItMatters: string;
  whatWeKnow: string[];
  whatIsUnclear: string[];
  sourcesAgreeOn: string[];
  whereSourcesDiffer: SourceComparisonItem[];

  // Data & Grounding
  claims: Claim[];
  timeline: TimelineEvent[];
  primaryEvidence: PrimaryEvidence[];
  sources: ArticleSource[];
  updates?: StoryUpdate[];
  relatedStoryIds?: string[];
}
