/**
 * Deterministic claim extraction: split reporting prose into atomic factual
 * claims WITHOUT a model, so the pipeline works with zero credentials and
 * every output is reproducible. Splits on sentence boundaries, then classifies
 * each sentence:
 *
 *   - QUOTE:       attributed speech ("X said ...") — claimant recorded.
 *   - NUMBER/STATISTIC/DATE: carries a figure or calendar date.
 *   - PREDICTION:  future-tense / expects / will create — never established.
 *   - POLICY:      announced programmes, packages, measures, legislation.
 *   - EVENT:       something happened (past-tense action).
 *   - STATEMENT:   anything else factual-sounding.
 *   - OTHER:       opinions and non-factual filler — flagged, never published
 *                  as fact. (Opinions stay quotable with attribution; the
 *                  pipeline marks them so synthesis cannot state them bare.)
 *
 * The model-backed extractor (AIProvider.extractClaims) upgrades wording and
 * recall when configured; it must return these same shapes, and the publish
 * gate treats both identically.
 */
import { collapseWhitespace } from "../ingest/text";
import type { ClaimType } from "./types";

export interface ExtractedClaim {
  statement: string;
  claimType: ClaimType;
  /** Named claimant when the sentence attributes one; otherwise null. */
  claimant: string | null;
  /** True when the sentence is opinion/prediction — quotable, not statable. */
  isAttributionOnly: boolean;
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"“£])|(?<=,)\s+(?=saying\s|adding\s+that|warning\s+that|claiming\s+that)/g;

const CLAIMANT_PATTERNS = [
  /\b(the\s+(?:government|minister|ministry|prime\s+minister|chancellor|secretary|department|committee|bank|council|treasury))\b/i,
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:said|says|told|announced|confirmed|warned|claimed|added|stated)\b/,
];

const QUOTE_VERBS = /\b(said|says|say|told|tell|announced|announce|confirmed|confirm|warned|warn|claimed|claim|added|add|stated|state|according to)\b/i;
const PREDICTION_MARKERS =
  /\b(will|would|expects?|expected|forecast|predicted|prediction|plans?\s+to|set\s+to|about\s+to|likely|unlikely|by\s+203\d|by\s+20[3-9]\d)\b/i;
const OPINION_MARKERS =
  /\b(should|must|ought|believe[sd]?|thinks?|thought|feels?|felt|opinion|shameful|disgraceful|excellent|terrible|welcome[sd]?|criticis|condemn|praise[sd]?|back[sed]?\s+(?:the|this|these))\b/i;
const NUMBER_MARKERS =
  /£?\d[\d,]*(?:\.\d+)?(?:bn|m|k|%|thousand|million|billion|homes|jobs|tonnes)?/i;
const DATE_MARKERS =
  /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\b20\d\d\b|today|yesterday|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|spring|summer|autumn|winter)\b/i;
const POLICY_MARKERS =
  /\b(programme|program|package|measures?|legislation|bill|scheme|initiative|fund|target|policy|announced|unveiled|launched)\b/i;
const STATISTIC_MARKERS =
  /\b(percent|percentage|rate|rose|fell|increased|decreased|growth|inflation|unemployment|poll|survey|study|research|figures?|data|statistics)\b/i;

function findClaimant(sentence: string): string | null {
  for (const pattern of CLAIMANT_PATTERNS) {
    const match = pattern.exec(sentence);
    if (match) return collapseWhitespace(match[1]);
  }
  return null;
}

function classify(sentence: string): {
  claimType: ClaimType;
  isAttributionOnly: boolean;
} {
  // Opinion is checked BEFORE quote verbs: "Critics said it was disgraceful"
  // is an opinion carrying a quote verb, and must stay attribution-only. A
  // bare attributed fact ("The minister said the fund opens in spring") has
  // no opinion marker and still lands on QUOTE below.
  if (OPINION_MARKERS.test(sentence)) {
    return { claimType: "OTHER", isAttributionOnly: true };
  }
  if (QUOTE_VERBS.test(sentence)) {
    return { claimType: "QUOTE", isAttributionOnly: false };
  }
  if (PREDICTION_MARKERS.test(sentence)) {
    return { claimType: "PREDICTION", isAttributionOnly: true };
  }
  if (STATISTIC_MARKERS.test(sentence) && NUMBER_MARKERS.test(sentence)) {
    return { claimType: "STATISTIC", isAttributionOnly: false };
  }
  if (NUMBER_MARKERS.test(sentence)) {
    return { claimType: "NUMBER", isAttributionOnly: false };
  }
  if (DATE_MARKERS.test(sentence)) {
    return { claimType: "DATE", isAttributionOnly: false };
  }
  if (POLICY_MARKERS.test(sentence)) {
    return { claimType: "POLICY", isAttributionOnly: false };
  }
  return { claimType: "STATEMENT", isAttributionOnly: false };
}

/**
 * Split title + excerpt prose into atomic claims. One sentence = one claim;
 * fragments under 4 words are dropped (headlines fragments, not facts).
 * Deterministic: same input, same claims, every run.
 */
export function extractClaims(text: string): ExtractedClaim[] {
  const cleaned = collapseWhitespace(text);
  if (!cleaned) return [];
  return cleaned
    .split(SENTENCE_SPLIT)
    .map((raw) => collapseWhitespace(raw).replace(/^["“]+|["”.,;]+$/g, ""))
    .filter((sentence) => sentence.split(/\s+/).length >= 4)
    .map((statement) => {
      const { claimType, isAttributionOnly } = classify(statement);
      return {
        statement,
        claimType,
        claimant: findClaimant(statement),
        isAttributionOnly,
      };
    });
}
