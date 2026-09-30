/**
 * Evidence relationship: what does this document actually DO to the claim?
 *
 * Keyword/figure overlap used to be the only semantic test in the system — a
 * figure plus half the content keywords appearing anywhere in a document. That
 * is a useful safety floor, but it cannot tell these apart:
 *
 *   CLAIM  "The government will build 100,000 homes."
 *   DOC A  "The government will build 100,000 homes by 2029."            SUPPORTS
 *   DOC B  "The opposition claims the government will build 100,000
 *           homes. The government has rejected the figure."              CONTRADICTS
 *   DOC C  "The opposition claims the government will build 100,000
 *           homes."                                                      MENTIONS_ONLY
 *   DOC D  "Housing starts fell again in March, the ONS said."           IRRELEVANT
 *
 * All four share the figure and most of the keywords. What differs is the
 * SPEECH ACT around the figure: asserted, denied, attributed to someone else,
 * or absent. So this classifier reads a window of the document and asks who is
 * asserting what, not merely which words occur.
 *
 * Deterministic, no network, deliberately precision-biased: when in doubt it
 * returns MENTIONS_ONLY / UNCLEAR, which leaves a claim unverified.
 * Under-claiming support is a visible, honest failure. Over-claiming it is the
 * failure mode that destroys a news product.
 */

export type EvidenceRelationship =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "MENTIONS_ONLY"
  | "IRRELEVANT"
  | "UNCLEAR";

/** Why a document stops short of establishing a bare factual assertion. */
export type HedgeKind =
  | "none"
  | "estimate"
  | "possibility"
  | "conditional"
  | "prediction";

export interface RelationshipInput {
  statement: string;
  claimType?: string;
  /** True for opinion/prediction claims: the claim is itself attributed. */
  isAttributionOnly?: boolean;
  /** Hedge modality already detected in the claim text, if any. */
  claimHedge?: HedgeKind | "none";
  documentText: string;
}

export interface RelationshipVerdict {
  relationship: EvidenceRelationship;
  reason: string;
  /** The passage the verdict rests on, quoted from the document itself. */
  passage: string | null;
  figureMatched: boolean;
  keywordRatio: number;
  hedge: HedgeKind;
  denial: boolean;
  /** The claim's figure, when it has one — kept for the audit trail. */
  figure: string | null;
}

const FIGURE_PATTERN =
  /£\s?\d[\d,]*(?:\.\d+)?(?:bn|billion|m|million|k|thousand|%)?|\d[\d,]*(?:\.\d+)?(?:bn|billion|m|million|k|thousand|%)?/i;

/** Words that carry meaning; short filler is dropped by length. */
export function claimKeywords(statement: string): string[] {
  return statement
    .toLowerCase()
    .replace(/[^a-z0-9£%\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 12);
}

/**
 * Conservative synonym families: same speech act, different verb. "Confirmed
 * a £4bn programme" states what "announced a £4bn programme" claims; "fell"
 * is deliberately NOT a synonym of "homes", and "strategy" is not a synonym
 * of "programme" — those distinctions are the product.
 */
const KEYWORD_SYNONYMS: string[][] = [
  ["said", "says", "stated", "told", "announced", "confirmed", "unveiled", "launched", "declared"],
  ["set", "set out"],
  ["cost", "costs", "costing", "priced", "worth"],
  ["build", "builds", "built", "building", "construct"],
  ["created", "creates", "creating"],
  ["programme", "program", "package", "scheme"],
  ["policy", "policies"],
];

/** Keyword hits with synonym credit; every hit is still a literal substring. */
export function countKeywordHits(keywords: string[], lowerText: string): number {
  return keywords.filter((word) => {
    if (lowerText.includes(word)) return true;
    const family = KEYWORD_SYNONYMS.find((group) => group.includes(word));
    return family !== undefined && family.some((synonym) => lowerText.includes(synonym));
  }).length;
}

export function claimFigure(statement: string): string | null {
  const match = statement.match(FIGURE_PATTERN);
  return match ? match[0].replace(/\s+/g, "").toLowerCase() : null;
}

/** Sentences, then two-sentence windows: a denial often sits in the sentence
 * AFTER the one carrying the figure ("…rejected the figure"). */
export function sentenceWindows(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"£])|(?<=\n)\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.map((sentence, index) =>
    index + 1 < sentences.length ? `${sentence} ${sentences[index + 1]}` : sentence
  );
}

/** A denial rejects the claim's content; it is not a difference of tone. */
const DENIAL_PATTERN =
  /\b(deni\w*|dispute[sd]?|contradic\w*|contra\w*dict\w*|reject\w*|debunk\w*|retract\w*|corrected|walked back|no such (?:plan|deal|scheme|agreement|figure)|never (?:said|been|had|happened)|did not|does not|didn.t|doesn.t|has not|haven.t|is not true|not the case|misleading|inaccurate|incorrect|false|baseless|scrap\w*|abandon\w*|dropped)\b/i;

/** Somebody else is doing the asserting; the document is only the messenger. */
const ASSERTED_BY_OTHER_PATTERN =
  /\b(claims?(?: that| the| to)?|claiming that|alleged\w*|accuses?|according to (?:the )?(?:opposition|critics|rival|campaigners|mps?|unions?|sources|a report|reports?)|says? (?:the )?(?:government|ministers?|they) (?:will|plans?|intends?)|leaked (?:document|memo) (?:claims?|says?))\b/i;

const HEDGE_PATTERNS: [HedgeKind, RegExp][] = [
  [
    "estimate",
    /\b(estimated?|estimates? of|estimated at|around|about|roughly|approximately|up to|as many as|as much as|in the region of|more than|fewer than|nearly)\b/i,
  ],
  ["conditional", /\b(if\b|unless|subject to|conditional|contingent|provided that|only if|would\b)/i],
  [
    "possibility",
    /\b(could|might|may|possible|potentially|in talks|considering|weighing|contemplat\w*|exploring)\b/i,
  ],
  [
    "prediction",
    /\b(will|expects?|expected|forecasts?|predicted|projects?|aims? to|plans? to|hopes? to|set to|target of)\b/i,
  ],
];

export function detectHedge(passage: string): HedgeKind {
  for (const [kind, pattern] of HEDGE_PATTERNS) {
    if (pattern.test(passage)) return kind;
  }
  return "none";
}

/**
 * Classify one document against one claim. `assertsFact` is the claim's own
 * modality: a hedged passage supports a hedged claim, but a hedged passage
 * does NOT support the same figure stated as a bare fact. Preserving the
 * actual / estimate / prediction / attribution distinction is the point.
 */
export function classifyRelationship(input: RelationshipInput): RelationshipVerdict {
  const keywords = claimKeywords(input.statement);
  const figure = claimFigure(input.statement);

  const thin: RelationshipVerdict = {
    relationship: "UNCLEAR",
    reason: "Document is too thin to judge against the claim.",
    passage: null,
    figureMatched: figure === null,
    keywordRatio: 0,
    hedge: "none",
    denial: false,
    figure,
  };

  const text = input.documentText ?? "";
  if (keywords.length === 0 || text.trim().length < 40) return thin;

  const assertsFact =
    input.isAttributionOnly !== true && input.claimType !== "PREDICTION";

  let head = "";
  let lower = "";
  let ratio = 0;
  let figureHit = false;

  for (const window of sentenceWindows(text)) {
    const candidate = window.toLowerCase();
    const candidateRatio = countKeywordHits(keywords, candidate) / keywords.length;
    const candidateFigureHit =
      figure === null ? true : candidate.includes(figure);
    const score = candidateRatio + (candidateFigureHit ? 0.25 : 0);
    const best = ratio + (figureHit ? 0.25 : 0);
    if (!head || score > best) {
      head = window;
      lower = candidate;
      ratio = candidateRatio;
      figureHit = candidateFigureHit;
    }
  }

  if (!head) {
    return {
      ...thin,
      relationship: "IRRELEVANT",
      reason: "Document contains no text to assess.",
    };
  }

  const denial = DENIAL_PATTERN.test(lower);
  const hedge = detectHedge(lower);
  const base: RelationshipVerdict = {
    relationship: "UNCLEAR",
    reason: "Overlap with the claim is too partial to judge either way.",
    passage: head.slice(0, 250),
    figureMatched: figureHit,
    keywordRatio: Number(ratio.toFixed(2)),
    hedge,
    denial,
    figure,
  };

  // 1. Nothing this document says is about the claim's substance.
  if (!figureHit && ratio < 0.25) {
    return {
      ...base,
      relationship: "IRRELEVANT",
      reason: "No passage in this document addresses the claim's subject.",
    };
  }

  // 2. A denial outranks a keyword match: a document that reports the figure
  //    in order to reject it CONTRADICTS the claim, it never supports it.
  if (denial && (figureHit || ratio >= 0.4)) {
    return {
      ...base,
      relationship: "CONTRADICTS",
      reason:
        "The passage reports the claim's content only to deny or reject it, so it cannot establish the claim.",
    };
  }

  // 3. Somebody else is asserting it. Reporting an accusation is not evidence.
  if (ASSERTED_BY_OTHER_PATTERN.test(lower) && (figureHit || ratio >= 0.4)) {
    return {
      ...base,
      relationship: "MENTIONS_ONLY",
      reason:
        "The document quotes a third party asserting this; it does not itself establish it.",
    };
  }

  // 4. Modality mismatch: an estimate/possibility/conditional is not a fact.
  //    But only when the claim itself is stated bare: a hedged passage
  //    matches a hedged claim ("will build" supports "will build"). Without
  //    this exemption every future-tense commitment could never be supported.
  //    The caller may pass claimHedge precomputed; otherwise detect it here.
  const claimHedge = input.claimHedge ?? detectHedge(input.statement.toLowerCase());
  if (
    assertsFact &&
    claimHedge === "none" &&
    hedge !== "none" &&
    (figureHit || ratio >= 0.4)
  ) {
    const kind =
      hedge === "estimate"
        ? "a rough estimate"
        : hedge === "conditional"
          ? "a conditional outcome"
          : hedge === "possibility"
            ? "a possibility"
            : "a prediction";
    return {
      ...base,
      relationship: "MENTIONS_ONLY",
      reason: `The document presents this as ${kind}, not an established fact.`,
    };
  }

  // 5. Support: figure present (when the claim has one), most keywords
  //    present, and the passage asserts rather than reports-that.
  if (figureHit && ratio >= 0.6) {
    return {
      ...base,
      relationship: "SUPPORTS",
      reason:
        "The document itself states the claim's figure and substance, without hedging or denial.",
    };
  }

  // 6. Topically about it, but not entailing it.
  if (ratio >= 0.25) {
    return {
      ...base,
      relationship: "MENTIONS_ONLY",
      reason: "The document is about the same subject but does not state what the claim asserts.",
    };
  }

  return base;
}

/**
 * Legacy boolean test, kept as the compatibility surface for callers that
 * only need "can this document ground this claim?". New code prefers
 * classifyRelationship for the full audit trail.
 */
export function documentSupportsClaimLegacy(
  statement: string,
  documentText: string
): boolean {
  return (
    classifyRelationship({ statement, documentText }).relationship === "SUPPORTS"
  );
}