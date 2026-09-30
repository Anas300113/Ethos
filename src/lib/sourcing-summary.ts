/**
 * Read-path sourcing summary.
 *
 * The write path groups sources by shared origin
 * (`src/lib/curation/independence.ts`) and stores `sourcingGroup` /
 * `sharedSourceLabel` on every source row. This module turns those stored keys
 * into the one distinction a reader cannot infer from an outlet list: how many
 * OUTLETS carry the story versus how many ORIGINS that reporting traces back
 * to. Four outlets printing one Reuters dispatch are one origin, and the UI has
 * to say so — that is the whole reason the column exists.
 *
 * Seed rows predate the column, so a missing group falls back to the
 * publisher's own domain, exactly the default the write path uses.
 */
import type { ArticleSource } from "@/types/story";

export interface SharedOrigin {
  group: string;
  label: string;
  outlets: string[];
}

export interface SourcingSummary {
  /** Distinct publishers carrying the story. */
  outlets: number;
  /** Distinct sourcing groups — what "independent" actually counts here. */
  origins: number;
  /** Groups carried by more than one outlet, in the order first seen. */
  shared: SharedOrigin[];
  /**
   * True only when at least one source carries a STORED group. Rows that
   * predate the column fall back to their own domain, which measures nothing:
   * without a grouping pass we cannot claim independence, only note outlets.
   */
  grouped: boolean;
}

const groupOf = (source: ArticleSource): string =>
  source.sourcingGroup ?? `independent:${source.publisher.domain.toLowerCase()}`;

const labelOf = (source: ArticleSource): string =>
  source.sharedSourceLabel ?? "independent";

export function summariseSourcing(sources: ArticleSource[]): SourcingSummary {
  const groups = new Map<string, SharedOrigin>();
  for (const source of sources) {
    const group = groupOf(source);
    const entry =
      groups.get(group) ?? { group, label: labelOf(source), outlets: [] };
    if (!entry.outlets.includes(source.publisher.name)) {
      entry.outlets.push(source.publisher.name);
    }
    groups.set(group, entry);
  }
  return {
    outlets: new Set(sources.map((source) => source.publisher.domain)).size,
    origins: groups.size,
    shared: [...groups.values()].filter((entry) => entry.outlets.length > 1),
    grouped: sources.some((source) => Boolean(source.sourcingGroup)),
  };
}

/**
 * The honest headline for a story's sourcing. Equal counts means every outlet
 * filed its own reporting; otherwise the wire count leads, because that is the
 * number that changes how much the story should be trusted. When nothing has
 * been grouped yet, the count is not ours to publish.
 */
export function sourcingHeadline(summary: SourcingSummary): string {
  if (summary.outlets === 0) return "no sources";
  if (!summary.grouped) {
    return `${summary.outlets} ${summary.outlets === 1 ? "outlet" : "outlets"}`;
  }
  if (summary.origins === summary.outlets) {
    return `${summary.outlets} ${summary.outlets === 1 ? "outlet" : "outlets"}, each independently reporting`;
  }
  return `${summary.outlets} outlets · ${summary.origins} independent ${summary.origins === 1 ? "origin" : "origins"}`;
}

/** Plain-English explanation shown next to a shared-origin group. */
export function sharedOriginNote(summary: SourcingSummary): string | null {
  if (summary.shared.length === 0) return null;
  const detail = summary.shared
    .map((entry) => `${entry.outlets.length} via ${entry.label}`)
    .join(", ");
  return `Reporting that shares an origin is counted once: ${detail}.`;
}
