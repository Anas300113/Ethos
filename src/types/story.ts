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
}

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
}

export interface Claim {
  id: string;
  statement: string;
  status: ClaimStatus;
  confidenceScore: number;
  explanation: string;
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

export interface SourceComparisonItem {
  id: string;
  topic: string;
  points: {
    sourceName: string;
    reporting: string;
  }[];
}

export interface StoryUpdate {
  id: string;
  timestamp: string;
  whatChanged: string;
  reason?: string;
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
