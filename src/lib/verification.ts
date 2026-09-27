/**
 * ETHOS deterministic verification gate.
 *
 * Pure functions — no DB, no network, no LLM. A story may only be
 * published when `validateStory` returns zero issues. The UI gate card
 * and (optionally) the seed script both consume this module so the
 * rule set lives in exactly one place.
 *
 * Rules:
 * - SUPPORTED / CORROBORATED require >=1 primary evidence doc AND
 *   >=1 corroborating source quote.
 * - PARTIALLY_SUPPORTED requires >=1 of either.
 * - DISPUTED / CONTRADICTED require >=1 disputing source with a
 *   non-empty dispute reason.
 * - UNVERIFIED / OUTDATED carry no grounding requirement (the status
 *   itself is the disclosure), but field hygiene still applies.
 * - Fair use: quotes, snippets and excerpts are capped at 250 chars.
 * - All URLs must be valid http(s) URLs.
 * - Story timeline must be in non-decreasing timestamp order.
 */
import type { Claim, Story } from "@/types/story";

export const MAX_FAIR_USE_CHARS = 250;

export type IssueCode =
  | "CLAIM_EMPTY_STATEMENT"
  | "CLAIM_EMPTY_EXPLANATION"
  | "CLAIM_BAD_CONFIDENCE"
  | "CLAIM_BAD_DATE"
  | "SUPPORTED_MISSING_EVIDENCE"
  | "SUPPORTED_MISSING_CORROBORATION"
  | "PARTIAL_MISSING_GROUNDING"
  | "DISPUTED_MISSING_DISPUTE"
  | "DISPUTE_EMPTY_REASON"
  | "QUOTE_TOO_LONG"
  | "SNIPPET_TOO_LONG"
  | "EXCERPT_TOO_LONG"
  | "BAD_URL"
  | "STORY_NO_CLAIMS"
  | "STORY_NO_SOURCES"
  | "TIMELINE_OUT_OF_ORDER"
  | "STANCE_EMPTY_REPORTING";

export interface ValidationIssue {
  code: IssueCode;
  message: string;
  claimId?: string;
}

export function isValidHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateClaim(claim: Claim): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const at = (code: IssueCode, message: string): void => {
    issues.push({ code, message, claimId: claim.id });
  };

  if (!claim.statement || claim.statement.trim().length === 0) {
    at("CLAIM_EMPTY_STATEMENT", `Claim ${claim.id} has an empty statement.`);
  }
  if (!claim.explanation || claim.explanation.trim().length === 0) {
    at("CLAIM_EMPTY_EXPLANATION", `Claim ${claim.id} has an empty audit explanation.`);
  }
  if (
    typeof claim.confidenceScore !== "number" ||
    Number.isNaN(claim.confidenceScore) ||
    claim.confidenceScore < 0 ||
    claim.confidenceScore > 1
  ) {
    at(
      "CLAIM_BAD_CONFIDENCE",
      `Claim ${claim.id} confidence ${String(claim.confidenceScore)} is outside [0, 1].`
    );
  }
  if (Number.isNaN(new Date(claim.lastVerified).getTime())) {
    at("CLAIM_BAD_DATE", `Claim ${claim.id} has an invalid lastVerified date.`);
  }

  for (const ev of claim.primaryEvidence ?? []) {
    if (ev.url && !isValidHttpUrl(ev.url)) {
      at("BAD_URL", `Claim ${claim.id} evidence "${ev.title}" has an invalid URL.`);
    }
    if (ev.excerpt && ev.excerpt.length > MAX_FAIR_USE_CHARS) {
      at(
        "EXCERPT_TOO_LONG",
        `Claim ${claim.id} evidence excerpt exceeds ${MAX_FAIR_USE_CHARS} chars (fair use).`
      );
    }
  }

  for (const q of claim.corroboratingSources ?? []) {
    if (q.quote.length > MAX_FAIR_USE_CHARS) {
      at(
        "QUOTE_TOO_LONG",
        `Claim ${claim.id} corroborating quote from ${q.publisherName} exceeds ${MAX_FAIR_USE_CHARS} chars (fair use).`
      );
    }
    if (!isValidHttpUrl(q.url)) {
      at("BAD_URL", `Claim ${claim.id} corroborating source ${q.publisherName} has an invalid URL.`);
    }
  }

  for (const q of claim.disputingSources ?? []) {
    if (q.quote.length > MAX_FAIR_USE_CHARS) {
      at(
        "QUOTE_TOO_LONG",
        `Claim ${claim.id} disputing quote from ${q.publisherName} exceeds ${MAX_FAIR_USE_CHARS} chars (fair use).`
      );
    }
    if (!q.disputeReason || q.disputeReason.trim().length === 0) {
      at("DISPUTE_EMPTY_REASON", `Claim ${claim.id} disputing source ${q.publisherName} has an empty dispute reason.`);
    }
    if (!isValidHttpUrl(q.url)) {
      at("BAD_URL", `Claim ${claim.id} disputing source ${q.publisherName} has an invalid URL.`);
    }
  }

  switch (claim.status) {
    case "SUPPORTED":
    case "CORROBORATED":
      if ((claim.primaryEvidence ?? []).length === 0) {
        at("SUPPORTED_MISSING_EVIDENCE", `Claim ${claim.id} is ${claim.status} but cites no primary evidence.`);
      }
      if ((claim.corroboratingSources ?? []).length === 0) {
        at("SUPPORTED_MISSING_CORROBORATION", `Claim ${claim.id} is ${claim.status} but has no corroborating source.`);
      }
      break;
    case "PARTIALLY_SUPPORTED":
      if (
        (claim.primaryEvidence ?? []).length === 0 &&
        (claim.corroboratingSources ?? []).length === 0
      ) {
        at("PARTIAL_MISSING_GROUNDING", `Claim ${claim.id} is PARTIALLY_SUPPORTED but has neither primary evidence nor corroboration.`);
      }
      break;
    case "DISPUTED":
    case "CONTRADICTED":
      if ((claim.disputingSources ?? []).length === 0) {
        at("DISPUTED_MISSING_DISPUTE", `Claim ${claim.id} is ${claim.status} but cites no disputing source.`);
      }
      break;
    default:
      break;
  }

  return issues;
}
export interface StoryValidationResult {
  storyId: string;
  slug: string;
  publishable: boolean;
  issues: ValidationIssue[];
}

export function validateStory(story: Story): StoryValidationResult {
  const issues: ValidationIssue[] = [];
  const push = (code: IssueCode, message: string): void => {
    issues.push({ code, message });
  };

  if (!story.claims || story.claims.length === 0) {
    push("STORY_NO_CLAIMS", `Story ${story.slug} tracks no claims.`);
  }
  if (!story.sources || story.sources.length === 0) {
    push("STORY_NO_SOURCES", `Story ${story.slug} cites no sources.`);
  }

  for (const claim of story.claims ?? []) {
    issues.push(...validateClaim(claim));
  }

  for (const src of story.sources ?? []) {
    if (!isValidHttpUrl(src.url)) {
      push("BAD_URL", `Source "${src.title}" has an invalid URL.`);
    }
    if (src.snippet && src.snippet.length > MAX_FAIR_USE_CHARS) {
      push(
        "SNIPPET_TOO_LONG",
        `Source "${src.publisher.name}" snippet exceeds ${MAX_FAIR_USE_CHARS} chars (fair use).`
      );
    }
  }

  const times = (story.timeline ?? []).map((e) => new Date(e.timestamp).getTime());
  for (let i = 1; i < times.length; i += 1) {
    if (Number.isNaN(times[i]) || Number.isNaN(times[i - 1]) || times[i] < times[i - 1]) {
      push("TIMELINE_OUT_OF_ORDER", `Story ${story.slug} timeline is out of chronological order.`);
      break;
    }
  }

  for (const item of story.whereSourcesDiffer ?? []) {
    for (const pt of item.points) {
      if (!pt.reporting || pt.reporting.trim().length === 0) {
        push("STANCE_EMPTY_REPORTING", `Stance topic "${item.topic}" has empty reporting for ${pt.sourceName}.`);
      }
    }
  }

  return {
    storyId: story.id,
    slug: story.slug,
    publishable: issues.length === 0,
    issues,
  };
}

export function validateStories(stories: Story[]): StoryValidationResult[] {
  return stories.map(validateStory);
}

