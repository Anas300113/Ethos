/**
 * Grounding check: every factual sentence the generator writes must map to a
 * stored claim. This is the final barrier against an AI introducing new
 * factual content — the generator may improve prose, headline, ordering,
 * readability and context, but it may NOT add facts.
 *
 * Deterministic and honest about its limits: it traces figures exactly and
 * requires keyword overlap with a claim for everything else. Sentences that
 * assert nothing external (the app's own connective prose: "read the
 * claim-by-claim audit before acting…") are allowlisted by pattern — those
 * statements are about ETHOS's own state, not about the world.
 *
 * A failure REJECTS the generation; the caller falls back to deterministic
 * composition, so a hallucinated sentence never reaches the gate.
 */
import type { StoryGenerationOutput } from "../providers/types";

export interface GroundingIssue {
  /** Which field the untraceable sentence came from. */
  field: string;
  sentence: string;
  reason: "figure-not-in-claims" | "no-claim-overlap";
}

/** Numbers/percentages a sentence asserts. Normalised for comparison. */
export function figuresIn(text: string): string[] {
  return (text.match(/£?\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:bn|billion|m|million|k|thousand|per cent|percent|%))?/gi) ?? [])
    .map((raw) => raw.toLowerCase().replace(/[\s,]+/g, ""))
    .filter((raw) => raw.length > 0);
}

function contentKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9£%\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 24);
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"£])|(?<=\n)\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Connective prose that asserts nothing about the world — only about the
 * dossier itself. Anything an AI writes about EVENTS must still map to a
 * claim; these patterns are the local templates' own guard rails, widened
 * just enough to survive minor rephrasing.
 */
const CONNECTIVE_PATTERNS: RegExp[] = [
  /this story draws on reporting/i,
  /grounded in primary evidence or independent corroboration/i,
  /reported, not confirmed/i,
  /reported but not yet independently established/i,
  /not independently confirmed/i,
  /read the claim-by-claim audit/i,
  /read the claim-by-claim/i,
  /reporting on this story is still developing/i,
  /whether further reporting will confirm/i,
  /ethos has not yet established/i,
  /further reporting/i,
  /under review/i,
  /developing story/i,
];

function overlapsClaim(sentence: string, claimStatement: string): boolean {
  const keywords = contentKeywords(sentence);
  if (keywords.length === 0) return false;
  const claim = claimStatement.toLowerCase();
  const hits = keywords.filter((word) => claim.includes(word)).length;
  const figure = figuresIn(sentence);
  const figureHit =
    figure.length === 0
      ? false
      : figuresIn(claimStatement).some((owned) => figure.includes(owned) || owned.includes(figure[0]));
  if (figureHit) return true;
  return hits >= Math.max(2, Math.ceil(keywords.length * 0.4));
}

function sentenceIsGrounded(
  sentence: string,
  claims: { statement: string }[],
  claimFigures: string[]
): GroundingIssue | null {
  if (CONNECTIVE_PATTERNS.some((pattern) => pattern.test(sentence))) return null;
  const figures = figuresIn(sentence);
  // A sentence that asserts a figure nobody stored is the classic
  // hallucination: an invented number has no claim to trace back to.
  const unowned = figures.filter(
    (figure) => !claimFigures.some((owned) => owned.includes(figure) || figure.includes(owned))
  );
  if (unowned.length > 0) {
    return { field: "", sentence, reason: "figure-not-in-claims" };
  }
  if (claims.some((claim) => overlapsClaim(sentence, claim.statement))) return null;
  if (figures.length > 0) return null; // figure matched a stored claim above
  return { field: "", sentence, reason: "no-claim-overlap" };
}

/**
 * Check a generated story against the claims it was built from. Returns one
 * issue per untraceable sentence; an empty array means the prose is fully
 * grounded.
 */
export function groundingIssues(
  generated: StoryGenerationOutput,
  claims: { statement: string }[]
): GroundingIssue[] {
  const issues: GroundingIssue[] = [];
  const claimFigures = claims.flatMap((claim) => figuresIn(claim.statement));

  const push = (field: string, text: string): void => {
    if (!text) return;
    for (const sentence of sentences(text)) {
      if (sentence.length < 18) continue; // fragments carry no assertion
      const issue = sentenceIsGrounded(sentence, claims, claimFigures);
      if (issue) issues.push({ ...issue, field, sentence: sentence.slice(0, 300) });
    }
  };

  push("headline", generated.headline);
  push("oneSentenceSummary", generated.oneSentenceSummary);
  push("whatHappened", generated.whatHappened);
  push("whyItMatters", generated.whyItMatters);
  for (const [field, list] of [
    ["whatWeKnow", generated.whatWeKnow],
    ["whatIsUnclear", generated.whatIsUnclear],
    ["sourcesAgreeOn", generated.sourcesAgreeOn],
  ] as const) {
    for (const item of list) push(field, item);
  }
  return issues;
}