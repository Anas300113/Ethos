/**
 * Evidence assessment: claim + retrieved material -> ClaimStatus.
 *
 * Pure function, no network. The rules are deliberately boring and honest:
 *   - a fetched document whose assessed RELATIONSHIP to the claim is SUPPORTS
 *     -> SUPPORTED (single outlet) or CORROBORATED (2+ outlets);
 *   - fetched documents that only mention the claim or contradict it never
 *     ground it (CONTRADICTS feeds a DISPUTE, never a SUPPORT);
 *   - no document, but >=2 outlets report it -> PARTIALLY_SUPPORTED
 *     (corroborating quotes exist; primary evidence does not). Multi-outlet
 *     repetition is still secondary reporting, so CORROBORATED is never
 *     granted without a fetched document;
 *   - single outlet, no document -> UNVERIFIED;
 *   - outlets actively conflict -> DISPUTED;
 *   - opinion/prediction quoted with attribution -> UNVERIFIED (status is
 *     the disclosure; the attribution is preserved, never laundered).
 *
 * "Whether the document actually supports the specific claim" is answered by
 * classifyRelationship, not keyword counting: who asserts what, whether the
 * passage hedges the figure (estimate/possibility/conditional), and whether
 * the passage reports the claim only to deny it.
 */
import type { ClaimStatus } from "@/types/story";
import {
  classifyRelationship,
  type EvidenceRelationship,
  type RelationshipVerdict,
} from "./relationship";

export interface AssessmentInput {
  statement: string;
  claimType: string;
  claimant: string | null;
  isAttributionOnly: boolean;
  /** Distinct outlets reporting this claim (publisher names). */
  reportingOutlets: string[];
  /** Distinct SOURCING GROUPS behind the reporting outlets (see independence). */
  sourcingGroups?: string[];
  /** Reader-facing independence note, when outlets repeat a shared source. */
  sourcingNote?: string | null;
  /** A corroborating quote per outlet, already fair-use capped. */
  corroboratingQuotes: { publisherName: string; url: string; quote: string }[];
  /** Disputing voices, when outlets conflict. */
  disputingQuotes: { publisherName: string; url: string; quote: string; disputeReason: string }[];
  /** Fetched primary-document text, when retrieval succeeded. */
  primaryDocumentText?: string | null;
  primaryDocumentTitle?: string;
  primaryDocumentUrl?: string;
  primaryDocumentBody?: string;
  /**
   * Semantic assessment from a configured AI provider, if any. ADVISORY only:
   * it may CONFIRM or DOWNGRADE the deterministic relationship, never
   * upgrade it. See reconcileAiRelationship.
   */
  aiRelationship?: AiRelationshipAssessment | null;
  aiModel?: string | null;
}

/**
 * Structured semantic verdict from a real AI provider over CLAIM + DOCUMENT
 * TITLE + DOCUMENT TEXT + SOURCE + CONTEXT. Schema-validated at the provider
 * boundary (sanitiseRelationship); never trusted raw.
 */
export interface AiRelationshipAssessment {
  relationship: EvidenceRelationship;
  reason: string;
  supportingPassage: string | null;
  confidence: number;
}

export interface Assessment {
  status: ClaimStatus;
  confidenceScore: number;
  explanation: string;
  /** True when a fetched document grounded this assessment. */
  documentGrounded: boolean;
  /** Full deterministic verdict for the audit trail (persisted to the DB). */
  verdict: RelationshipVerdict;
  /** Who assessed the relationship: deterministic rules, or AI-refined. */
  assessmentMethod: "DETERMINISTIC" | "AI_HYBRID";
  /** Which model contributed, when one did — never a bare "AI" label. */
  assessmentModel: string | null;
}

/**
 * The deterministic verdict a syntactic-only legacy caller would get. One
 * place, so assessClaim, retrieveEvidence and the tests share the same
 * definition of "supports".
 */
export function deterministicVerdict(
  statement: string,
  claimType: string,
  isAttributionOnly: boolean,
  documentText: string | null | undefined
): RelationshipVerdict {
  return classifyRelationship({
    statement,
    claimType,
    isAttributionOnly,
    documentText: documentText ?? "",
  });
}

/**
 * Legacy boolean surface for existing callers that only need "can this
 * document ground this claim?". New code prefers classifyRelationship.
 */
export function documentSupportsClaim(statement: string, documentText: string): boolean {
  return (
    classifyRelationship({ statement, documentText }).relationship === "SUPPORTS"
  );
}

/**
 * Reconcile an AI semantic assessment with the deterministic verdict.
 *
 * The rule is absolute: the AI result must NEVER bypass deterministic
 * validation. If the model says SUPPORTS but the deterministic checks find a
 * missing figure, hedging, attribution-to-a-third-party, or denial, the
 * model's verdict is rejected and the deterministic one stands.
 *
 * What the model IS allowed to do: agree with SUPPORTS (which records the
 * co-signature and model for the audit trail), or DOWNGRADE a deterministic
 * SUPPORTS to something weaker when its reading of the passage finds nuance
 * the regexes missed. A downgrade can only make the published claim more
 * cautious, never bolder.
 */
export function reconcileAiRelationship(
  deterministic: RelationshipVerdict,
  ai: AiRelationshipAssessment | null | undefined,
  aiModel: string | null | undefined
): { verdict: RelationshipVerdict; method: "DETERMINISTIC" | "AI_HYBRID"; model: string | null } {
  if (!ai) {
    return { verdict: deterministic, method: "DETERMINISTIC", model: null };
  }
  const model = (aiModel ?? "").trim() || null;
  if (deterministic.relationship === "SUPPORTS" && ai.relationship === "SUPPORTS") {
    // Confirmed by two independent readers (rules + model): keep the
    // deterministic passage, record the model's co-signature and reason.
    return {
      verdict: {
        ...deterministic,
        reason: `${deterministic.reason} A second semantic read (${model ?? "configured model"}) agrees: ${ai.reason.slice(0, 200)}`,
      },
      method: model ? "AI_HYBRID" : "DETERMINISTIC",
      model,
    };
  }
  if (deterministic.relationship === "SUPPORTS") {
    // Model downgrades a rule-based SUPPORTS: allowed — it only makes the
    // claim more cautious. Treat the document as mentioned, not grounding.
    const downgraded: RelationshipVerdict = {
      ...deterministic,
      relationship: ai.relationship === "CONTRADICTS" ? "CONTRADICTS" : "MENTIONS_ONLY",
      reason:
        `Deterministic checks passed, but a semantic review reads the passage differently: ` +
        `${ai.reason.slice(0, 250)} The document is therefore not used to ground the claim.`,
    };
    return { verdict: downgraded, method: model ? "AI_HYBRID" : "DETERMINISTIC", model };
  }
  // Deterministic says anything but SUPPORTS: the model cannot upgrade it.
  // The claim stays ungrounded either way; keep the deterministic verdict so
  // the audit trail stays reproducible.
  return { verdict: deterministic, method: "DETERMINISTIC", model: null };
}

export function assessClaim(input: AssessmentInput): Assessment {
  const outlets = [...new Set(input.reportingOutlets)];
  // Independence, not outlet arithmetic: three outlets on one wire are one
  // sourcing group. Callers that do not group yet fall back to outlets.
  const groups = [...new Set(input.sourcingGroups ?? outlets)];
  const independent = groups.length;
  const quotes = input.corroboratingQuotes.slice(0, 250);
  const verdict = deterministicVerdict(
    input.statement,
    input.claimType,
    input.isAttributionOnly,
    input.primaryDocumentText
  );
  const reconciled = reconcileAiRelationship(
    verdict,
    input.aiRelationship ?? null,
    input.aiModel ?? null
  );
  const relationship = reconciled.verdict.relationship;

  const grounded = (
    status: ClaimStatus,
    confidenceScore: number,
    explanation: string
  ): Assessment => ({
    status,
    confidenceScore,
    explanation,
    documentGrounded: true,
    verdict: reconciled.verdict,
    assessmentMethod: reconciled.method,
    assessmentModel: reconciled.model,
  });
  const ungrounded = (
    status: ClaimStatus,
    confidenceScore: number,
    explanation: string
  ): Assessment => ({
    status,
    confidenceScore,
    explanation,
    documentGrounded: false,
    verdict: reconciled.verdict,
    assessmentMethod: reconciled.method,
    assessmentModel: reconciled.model,
  });

  // Conflict outranks support: if credible reporting disagrees, say DISPUTED
  // and let the UI show both the dispute and any primary document found.
  if (input.disputingQuotes.length > 0 && quotes.length > 0) {
    return ungrounded(
      "DISPUTED",
      0.55,
      `Credible reporting conflicts: ${outlets.join(", ")} report the claim while ${input.disputingQuotes.map((d) => d.publisherName).join(", ")} dispute it. Both sides are quoted below.`
    );
  }

  // A fetched document that reports the claim only to deny it is a dispute
  // source too: hold the claim DISPUTED with the passage quoted, never
  // let it ground.
  if (relationship === "CONTRADICTS" && reconciled.verdict.passage) {
    return ungrounded(
      "DISPUTED",
      0.5,
      `A fetched document (${input.primaryDocumentTitle ?? "official source"}) contests this claim: "${reconciled.verdict.passage.slice(0, 180)}". The claim is held as disputed, not established.`
    );
  }

  // A document that quotes a forecast or opinion does not make it true:
  // attribution-only claims are exempt from document grounding entirely,
  // even when the document carries the same wording (that SUPPORTS the
  // ATTRIBUTION, which is exactly what UNVERIFIED-with-claimant discloses).
  //
  // CORROBORATED additionally requires TWO independent sourcing groups: a
  // document plus three outlets all repeating one wire is SUPPORTED ground
  // plus repetition, not independent confirmation.
  if (
    !input.isAttributionOnly &&
    input.primaryDocumentText &&
    input.primaryDocumentText.length > 80 &&
    relationship === "SUPPORTS"
  ) {
    const multi = independent >= 2 && quotes.length > 0;
    const shared = input.sourcingNote ? ` ${input.sourcingNote}` : "";
    return grounded(
      multi ? "CORROBORATED" : "SUPPORTED",
      multi ? 0.92 : 0.88,
      multi
        ? `Primary document "${input.primaryDocumentTitle ?? "official source"}" (${input.primaryDocumentBody ?? "issuing body"}) supports the claim, and ${independent} independent sources report it.${shared}`
        : `Primary document "${input.primaryDocumentTitle ?? "official source"}" (${input.primaryDocumentBody ?? "issuing body"}) directly supports the claim.${independent === 1 && outlets.length > 1 ? ` ${outlets.length} outlets repeat a single source, so this stays SUPPORTED rather than CORROBORATED.${shared}` : ""}`
    );
  }

  // Opinions and predictions are never established, however widely quoted.
  if (input.isAttributionOnly) {
    return ungrounded(
      "UNVERIFIED",
      0.4,
      input.claimType === "PREDICTION"
        ? "A forecast about the future cannot be established until it happens; the claimant is named and the wording stays theirs."
        : "An attributed opinion or characterisation, not an establishable fact; kept quoted with its claimant, never stated bare."
    );
  }

  // PARTIALLY_SUPPORTED likewise needs two INDEPENDENT groups: repetition
  // of one wire by many outlets is still one report, and stays UNVERIFIED
  // until something independent exists.
  if (independent >= 2 && quotes.length > 0) {
    return ungrounded(
      "PARTIALLY_SUPPORTED",
      0.65,
      `Reported by ${independent} independent sources (${outlets.join(", ")}), but ETHOS has not located primary evidence to establish it. Treated as reported, not confirmed.`
    );
  }

  return ungrounded(
    "UNVERIFIED",
    0.35,
    outlets.length <= 1
      ? "Reported by a single outlet with no primary evidence located; insufficient to establish."
      : "Insufficient evidence to establish the claim."
  );
}

export {
  claimFigure,
  classifyRelationship,
  detectHedge,
} from "./relationship";
export type { EvidenceRelationship, HedgeKind } from "./relationship";
