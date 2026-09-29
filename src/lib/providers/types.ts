/**
 * Provider abstractions: AI, evidence search, and document retrieval.
 *
 * One interface per external capability so vendors are swappable and tests
 * never touch the network. Every interface has two implementations:
 *   - a deterministic LOCAL/fixture one that works with zero credentials
 *     (clustering, regex claim extraction, allowlisted primary-source sweep);
 *   - a real one constructed only when its env vars are present.
 * constructProviders() chooses per capability and REPORTS what it chose, so
 * the app can label development mode honestly instead of pretending.
 *
 * UNTRUSTED DATA RULE: article text, fetched documents, search results and
 * model output are all untrusted. They flow INTO prompts as quoted data —
 * never as instructions — and every model response is schema-validated
 * before use. See providers/ai.ts for the injection-defence contract.
 */

export type ProviderKind = "local" | "fixture" | "remote";

/** Which concrete provider serves each capability in this process. */
export interface ProviderReport {
  ai: { kind: ProviderKind; name: string };
  evidenceSearch: { kind: ProviderKind; name: string };
  documentFetch: { kind: ProviderKind; name: string };
}

export interface ClaimInput {
  statement: string;
  claimType: string;
  claimant: string | null;
  sourceUrl: string;
  sourcePublisher: string;
}

export interface ExtractedClaimOutput extends ClaimInput {
  isAttributionOnly: boolean;
}

export interface AIProvider {
  readonly name: string;
  /** Split prose into atomic claims. Must return the deterministic shapes. */
  extractClaims(text: string): Promise<ExtractedClaimOutput[]>;
  /** Draft the narrative sections from STRUCTURED data, never raw browsing. */
  generateStory(input: StoryGenerationInput): Promise<StoryGenerationOutput>;
}

export interface StoryGenerationInput {
  headline: string;
  topic: string;
  claims: { statement: string; status: string; claimant: string | null }[];
  agreements: string[];
  disagreements: { topic: string; positions: string[] }[];
  timeline: { timestamp: string; text: string }[];
  sourceNames: string[];
}

export interface StoryGenerationOutput {
  headline: string;
  oneSentenceSummary: string;
  whatHappened: string;
  whyItMatters: string;
  whatWeKnow: string[];
  whatIsUnclear: string[];
  sourcesAgreeOn: string[];
}

export interface EvidenceCandidate {
  title: string;
  url: string;
  issuingBody: string;
  documentType:
    | "STATISTICAL_RELEASE"
    | "GOVERNMENT_DOCUMENT"
    | "COURT_FILING"
    | "OFFICIAL_STATEMENT"
    | "PARLIAMENTARY_RECORD"
    | "ACADEMIC_PAPER";
  summary: string;
  excerpt?: string;
  date?: string;
}

/** Search the web / primary-source domains for evidence about a claim. */
export interface EvidenceSearchProvider {
  readonly name: string;
  searchEvidence(query: string, options?: { maxResults?: number }): Promise<EvidenceCandidate[]>;
}

/** Fetch one document body for assessment. SSRF-guarded (see documents.ts). */
export interface DocumentFetcher {
  readonly name: string;
  fetchDocument(url: string): Promise<{ text: string; contentType: string } | null>;
}
