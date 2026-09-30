/**
 * Story update history: the append-only record of how a published story
 * moved — new reporting (CONTENT_UPDATE), ETHOS re-assessing its own claim
 * verdicts (CLAIM_REASSESSED), and corrections (CORRECTION) when an
 * established claim weakens or disappears.
 *
 * Pure: takes the previous DB state + the rows this pass would write and
 * returns the StoryUpdate drafts. persist.ts only does the writing, so the
 * diff rules are unit-testable without a database. Nothing here ever
 * rewrites or deletes a prior history row — that is the whole point.
 */
import type { Story } from "@/types/story";

export type UpdateKind = "PUBLISHED" | "CONTENT_UPDATE" | "CLAIM_REASSESSED" | "CORRECTION";

export interface PreviousClaim {
  statement: string;
  status: string;
}

export interface PreviousSource {
  url: string;
  publisher: { name: string };
}

export interface WrittenClaim {
  id: string;
  statement: string;
  status: string;
}

export interface StoryUpdateDraft {
  timestamp: Date;
  kind: UpdateKind;
  whatChanged: string;
  reason: string | null;
  claimStatement: string | null;
  claimId: string | null;
  previousState: string | null;
  newState: string | null;
  sourceLabel: string | null;
  evidenceUrl: string | null;
}

export interface UpdateHistoryInput {
  created: boolean;
  now: Date;
  updateSummary?: string;
  story: Story;
  previousClaims: PreviousClaim[];
  previousSources: PreviousSource[];
  writtenClaims: WrittenClaim[];
}

/** Statuses whose change or disappearance readers must be told about. */
const ESTABLISHED_STATUSES = new Set([
  "SUPPORTED",
  "CORROBORATED",
  "PARTIALLY_SUPPORTED",
  "DISPUTED",
  "CONTRADICTED",
]);

function claimKey(statement: string): string {
  return statement.toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildUpdateHistory(input: UpdateHistoryInput): StoryUpdateDraft[] {
  const drafts: StoryUpdateDraft[] = [];
  const base = {
    timestamp: input.now,
    claimStatement: null,
    claimId: null,
    previousState: null,
    newState: null,
    sourceLabel: null,
    evidenceUrl: null,
  };

  if (input.created) {
    drafts.push({
      ...base,
      kind: "PUBLISHED",
      whatChanged: "Story published by the curation pipeline.",
      reason: "first publication",
      sourceLabel: input.story.sources[0]?.publisher.name ?? null,
      evidenceUrl: input.story.sources[0]?.url ?? null,
    });
  } else if (input.updateSummary) {
    // Name the reporting that triggered the update (source + timestamp).
    const known = new Set(input.previousSources.map((s) => s.url));
    const added = input.story.sources.find((s) => !known.has(s.url));
    drafts.push({
      ...base,
      kind: "CONTENT_UPDATE",
      whatChanged: input.updateSummary.slice(0, 2000),
      reason: "pipeline",
      sourceLabel: added?.publisher.name ?? input.story.sources[0]?.publisher.name ?? null,
      evidenceUrl: added?.url ?? null,
    });
  }

  // Claim status diffs. A previously established claim that weakens is a
  // CORRECTION — the dossier once told readers one thing and now says
  // another — while any other status change is a re-assessment. Both keep
  // old state, new state, reason and the evidence behind the change.
  const previousStatus = new Map(
    input.previousClaims.map((claim) => [
      claimKey(claim.statement),
      { status: claim.status, statement: claim.statement },
    ])
  );
  const seenStatements = new Set<string>();
  for (const written of input.writtenClaims) {
    const key = claimKey(written.statement);
    seenStatements.add(key);
    const previous = previousStatus.get(key);
    if (!previous || previous.status === written.status) continue;
    const before = previous.status;
    const inMemory = input.story.claims.find((claim) => claimKey(claim.statement) === key);
    const firstDispute = inMemory?.disputingSources?.[0];
    const firstQuote = inMemory?.corroboratingSources[0];
    const firstDoc = inMemory?.primaryEvidence[0];
    const wasEstablished = ESTABLISHED_STATUSES.has(before);
    const stillEstablished = written.status === "SUPPORTED" || written.status === "CORROBORATED";
    drafts.push({
      ...base,
      kind: wasEstablished && !stillEstablished ? "CORRECTION" : "CLAIM_REASSESSED",
      whatChanged: `Claim status changed from ${before} to ${written.status}.`,
      reason: (inMemory?.explanation ?? "Re-assessed against new reporting.").slice(0, 1000),
      claimStatement: written.statement.slice(0, 500),
      claimId: written.id,
      previousState: before,
      newState: written.status,
      sourceLabel:
        firstDispute?.publisherName ?? firstQuote?.publisherName ?? firstDoc?.issuingBody ?? null,
      evidenceUrl: firstDispute?.url ?? firstQuote?.url ?? firstDoc?.url ?? null,
    });
  }

  // A previously established claim that vanishes entirely: explicit
  // correction, so the dossier never silently forgets what it once told
  // readers. Claims that were merely UNVERIFIED are dropped without noise.
  for (const previous of previousStatus.values()) {
    if (seenStatements.has(claimKey(previous.statement))) continue;
    if (!ESTABLISHED_STATUSES.has(previous.status)) continue;
    drafts.push({
      ...base,
      kind: "CORRECTION",
      whatChanged: "Claim no longer published after re-assessment.",
      reason: "Dropped during re-assessment against new reporting.",
      claimStatement: previous.statement.slice(0, 500),
      previousState: previous.status,
      newState: null,
    });
  }

  return drafts;
}