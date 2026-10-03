/**
 * Sourcing language, and the one rule it must obey.
 *
 * The server sends a computed `headline` and `note`. This module decides what the
 * app may say when those are absent (older cache, partial payload) and refuses to
 * upgrade an outlet count into an independence claim: without a stored sourcing
 * group, four reprint copies of one dispatch are four outlets and ONE origin, and
 * nothing in the payload proves they are independent.
 */
import type { Sourcing } from "../api/types";

export interface SourcingBadge {
  /** The line under a story card: "5 outlets · 2 independent origins". */
  label: string;
  /** True only when the payload actually supports the word "independent". */
  independenceMeasured: boolean;
  /** Why an independence figure is missing, when it is. */
  caveat: string | null;
}

export function sourcingBadge(sourcing: Sourcing | undefined): SourcingBadge {
  if (!sourcing || sourcing.outlets === 0) {
    return {
      label: "sources not listed",
      independenceMeasured: false,
      caveat: "No sources are attached to this story.",
    };
  }
  if (!sourcing.grouped) {
    return {
      // Server copy wins when present; the fallback never says "independent".
      label:
        sourcing.headline ||
        `${sourcing.outlets} ${sourcing.outlets === 1 ? "outlet" : "outlets"}`,
      independenceMeasured: false,
      caveat:
        "These outlets have not been checked against each other for shared sourcing, so ETHOS does not claim they are independent.",
    };
  }
  return {
    label:
      sourcing.headline ||
      `${sourcing.outlets} outlets · ${sourcing.origins} independent ${
        sourcing.origins === 1 ? "origin" : "origins"
      }`,
    independenceMeasured: true,
    caveat: null,
  };
}

/** "2 outlets via Reuters" — shown beside the shared group, never invented. */
export function sharedOriginLine(shared: { label: string; outlets: string[] }): string {
  const count = shared.outlets.length;
  return `${count} ${count === 1 ? "outlet" : "outlets"} via ${shared.label}: ${shared.outlets.join(", ")}`;
}

/**
 * Is this source primary reporting, a reprint, or a second hand? Only the stored
 * group can answer, so an ungrouped source is reported as ungrouped.
 */
export function sourceRoleLabel(
  source: { sourcingGroup?: string; sharedSourceLabel?: string },
  outletsInGroup: number
): string {
  if (!source.sourcingGroup) return "Sourcing origin not recorded";
  if (source.sourcingGroup.startsWith("wire:")) {
    return outletsInGroup > 1
      ? `Reporting carried from ${source.sharedSourceLabel ?? "a wire service"}`
      : `Filed from ${source.sharedSourceLabel ?? "a wire service"}`;
  }
  if (source.sourcingGroup.startsWith("syndicated:")) {
    return `Syndicated copy — origin ${source.sharedSourceLabel ?? "shared"}`;
  }
  return "This outlet's own reporting";
}