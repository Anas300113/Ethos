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

/**
 * Extraction result: the claims themselves PLUS an honest provenance label.
 * The label travels to the Claim row so a reader (or an auditor) can see
 * whether a model or the deterministic extractor produced a given sentence —
 * a remote call that fails must never be recorded as AI output.
 */
export interface ClaimExtraction {
  claims: ExtractedClaimOutput[];
  /** "remote:<name>", "local-deterministic", or "local-deterministic:fallback". */
  provenance: string;
}

export interface AIProvider {
  readonly name: string;
  /** Split prose into atomic claims. Must return the deterministic shapes. */
  extractClaims(text: string): Promise<ClaimExtraction>;
  /** Draft the narrative sections from STRUCTURED data, never raw browsing. */
  generateStory(input: StoryGenerationInput): Promise<StoryGenerationOutput>;
  /**
   * Semantic read of one CLAIM against one fetched DOCUMENT. OPTIONAL: only
   * remote providers implement it; the local provider returns null and the
   * deterministic verdict stands alone. The result is ADVISORY — the caller
   * reconciles it through reconcileAiRelationship, which lets the model
   * confirm or downgrade, never upgrade past the deterministic veto.
   * Returns null when no model is configured or the call fails.
   */
  assessEvidence?(input: EvidenceAssessmentInput): Promise<EvidenceAssessmentOutput | null>;
}

/**
 * What the model receives: the claim, the document's title + text + source,
 * and the surrounding context — exactly the structured JSON the brief
 * requires, never raw browsing, never instructions from the document.
 */
export interface EvidenceAssessmentInput {
  claim: {
    statement: string;
    claimType: string;
    claimant: string | null;
    isAttributionOnly: boolean;
  };
  document: {
    title: string;
    text: string;
    url: string;
    source: string;
    documentType: string;
  };
  context: {
    topic: string;
    publisherCount: number;
  };
}

/**
 * What the model must return: structured JSON, schema-validated by
 * sanitiseRelationship before anything reads it.
 */
export interface EvidenceAssessmentOutput {
  relationship: "SUPPORTS" | "CONTRADICTS" | "MENTIONS_ONLY" | "IRRELEVANT" | "UNCLEAR";
  reason: string;
  supportingPassage: string | null;
  confidence: number;
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
