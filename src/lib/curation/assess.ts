/**
 * Evidence assessment: claim + retrieved material -> ClaimStatus.
 *
 * Pure function, no network. The rules are deliberately boring and honest:
 *   - fetched document actually supports the specific claim -> SUPPORTED
 *     (assessment records the document + matched passage);
 *   - no document, but >=2 independent outlets report it -> PARTIALLY_SUPPORTED
 *     (corroborating quotes exist; primary evidence does not). Multi-outlet
 *     repetition is still secondary reporting, so CORROBORATED is never
 *     granted without a fetched document.
 *   - single outlet, no document -> UNVERIFIED;
 *   - outlets actively conflict -> DISPUTED;
 *   - opinion/prediction quoted with attribution -> UNVERIFIED (status is
 *     the disclosure; the attribution is preserved, never laundered).
 * With a fetched primary document whose text entails the claim -> SUPPORTED;
 * document + multi-outlet agreement -> CORROBORATED.
 *
 * "Whether the document actually supports the specific claim" is answered by
 * passage overlap: the document must contain the claim's figure/entity
 * tokens. A press release existing is not support; the numbers matching is.
 */
import type { ClaimStatus } from "@/types/story";

export interface AssessmentInput {
  statement: string;
  claimType: string;
  claimant: string | null;
  isAttributionOnly: boolean;
  /** Distinct outlets reporting this claim (publisher names). */
  reportingOutlets: string[];
  /** A corroborating quote per outlet, already fair-use capped. */
  corroboratingQuotes: { publisherName: string; url: string; quote: string }[];
  /** Disputing voices, when outlets conflict. */
  disputingQuotes: { publisherName: string; url: string; quote: string; disputeReason: string }[];
  /** Fetched primary-document text, when retrieval succeeded. */
  primaryDocumentText?: string | null;
  primaryDocumentTitle?: string;
  primaryDocumentUrl?: string;
  primaryDocumentBody?: string;
}

export interface Assessment {
  status: ClaimStatus;
  confidenceScore: number;
  explanation: string;
  /** True when a fetched document grounded this assessment. */
  documentGrounded: boolean;
}

/** Content words of the claim (figures, entities, nouns) for overlap. */
function claimKeywords(statement: string): string[] {
  return statement
    .toLowerCase()
    .replace(/[^a-z0-9£%\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 12);
}

/**
 * Does the document text actually support the SPECIFIC claim? Requires the
 * claim's figure (if it has one) plus at least half its content keywords to
 * appear in the document. A document existing on the topic is not support.
 */
export function documentSupportsClaim(statement: string, documentText: string): boolean {
  const keywords = claimKeywords(statement);
  if (keywords.length === 0) return false;
  const lower = documentText.toLowerCase();
  const figure = statement.match(/£?\d[\d,]*(?:\.\d+)?(?:bn|m|k|%)?/);
  if (figure && !lower.includes(figure[0].toLowerCase())) return false;
  const hits = keywords.filter((word) => lower.includes(word)).length;
  return hits >= Math.ceil(keywords.length / 2);
}

export function assessClaim(input: AssessmentInput): Assessment {
  const outlets = [...new Set(input.reportingOutlets)];
  const quotes = input.corroboratingQuotes.slice(0, 250);

  // Conflict outranks support: if credible reporting disagrees, say DISPUTED
  // and let the UI show both the dispute and any primary document found.
  if (input.disputingQuotes.length > 0 && quotes.length > 0) {
    return {
      status: "DISPUTED",
      confidenceScore: 0.55,
      explanation: `Credible reporting conflicts: ${outlets.join(", ")} report the claim while ${input.disputingQuotes.map((d) => d.publisherName).join(", ")} dispute it. Both sides are quoted below.`,
      documentGrounded: false,
    };
  }

  // A document that quotes a forecast or opinion does not make it true:
  // attribution-only claims are exempt from document grounding entirely.
  if (
    !input.isAttributionOnly &&
    input.primaryDocumentText &&
    input.primaryDocumentText.length > 80 &&
    documentSupportsClaim(input.statement, input.primaryDocumentText)
  ) {
    const multi = outlets.length >= 2 && quotes.length > 0;
    return {
      status: multi ? "CORROBORATED" : "SUPPORTED",
      confidenceScore: multi ? 0.92 : 0.88,
      explanation: multi
        ? `Primary document "${input.primaryDocumentTitle ?? "official source"}" (${input.primaryDocumentBody ?? "issuing body"}) supports the claim, and ${outlets.length} independent outlets report it.`
        : `Primary document "${input.primaryDocumentTitle ?? "official source"}" (${input.primaryDocumentBody ?? "issuing body"}) directly supports the claim.`,
      documentGrounded: true,
    };
  }

  // Opinions and predictions are never established, however widely quoted.
  if (input.isAttributionOnly) {
    return {
      status: "UNVERIFIED",
      confidenceScore: 0.4,
      explanation:
        input.claimType === "PREDICTION"
          ? "A forecast about the future cannot be established until it happens; the claimant is named and the wording stays theirs."
          : "An attributed opinion or characterisation, not an establishable fact; kept quoted with its claimant, never stated bare.",
      documentGrounded: false,
    };
  }

  if (outlets.length >= 2 && quotes.length > 0) {
    return {
      status: "PARTIALLY_SUPPORTED",
      confidenceScore: 0.65,
      explanation: `Reported independently by ${outlets.join(", ")}, but ETHOS has not located primary evidence to establish it. Treated as reported, not confirmed.`,
      documentGrounded: false,
    };
  }

  return {
    status: "UNVERIFIED",
    confidenceScore: 0.35,
    explanation:
      outlets.length <= 1
        ? "Reported by a single outlet with no primary evidence located; insufficient to establish."
        : "Insufficient evidence to establish the claim.",
    documentGrounded: false,
  };
}
