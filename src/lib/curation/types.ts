/**
 * Shared curation vocabulary: lifecycle, claim typing, provider verdicts.
 * Prisma enums in schema.prisma mirror these; READER_VISIBLE_STATUSES is the
 * single list the read layer filters on, so "published" always means the
 * same thing in every query.
 */
export type StoryStatus =
  | "CANDIDATE"
  | "CLUSTERED"
  | "ANALYSING"
  | "EVIDENCE_REVIEW"
  | "DRAFT"
  | "VALIDATING"
  | "PUBLISHED"
  | "UPDATED"
  | "REVALIDATED"
  | "REJECTED"
  | "ARCHIVED";

export type ClaimType =
  | "EVENT"
  | "NUMBER"
  | "DATE"
  | "QUOTE"
  | "POLICY"
  | "CAUSE"
  | "EFFECT"
  | "PREDICTION"
  | "STATEMENT"
  | "STATISTIC"
  | "OTHER";

/** Statuses the UI may show to a reader. Everything readers see is "published". */
export const READER_VISIBLE_STATUSES: StoryStatus[] = [
  "PUBLISHED",
  "UPDATED",
  "REVALIDATED",
];