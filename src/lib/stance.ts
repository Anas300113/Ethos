import type { SourceStance } from "@/types/story";

/**
 * Single source of truth for stance labels.
 *
 * Both the read path (story dossier UI) and the write path (Prisma seed)
 * MUST resolve stances through `resolveStance`. Deriving them separately in
 * each place is what previously let the JSON path render "Disputes" while
 * the database stored a blanket "Confirms" for the very same story.
 *
 * Precedence:
 *   1. an explicit `stance` on the point (author override) — always wins
 *   2. otherwise derive from the reporting text via `inferStance`
 */
export function inferStance(reporting: string): SourceStance {
  const text = reporting.toLowerCase();
  if (
    text.includes("warn") ||
    text.includes("caution") ||
    text.includes("unlikely") ||
    text.includes("dispute") ||
    text.includes("friction") ||
    text.includes("shortfall") ||
    text.includes("only adhere") ||
    text.includes("sidelines")
  ) {
    return "DISPUTES";
  }
  if (
    text.includes("focus") ||
    text.includes("emphasi") ||
    text.includes("highlight") ||
    text.includes("emotional") ||
    text.includes("mechanic")
  ) {
    return "ADDS_CONTEXT";
  }
  return "CONFIRMS";
}

export interface StancePoint {
  reporting: string;
  stance?: SourceStance;
}

export function resolveStance(point: StancePoint): SourceStance {
  return point.stance ?? inferStance(point.reporting);
}
