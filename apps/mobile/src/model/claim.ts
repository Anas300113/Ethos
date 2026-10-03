/**
 * ETHOS claim language.
 *
 * Pure functions, no React Native import, so the honesty rules encoded here —
 * what each verification status is ALLOWED to be called and how it is explained
 * — are unit-tested in plain node and cannot drift from the UI.
 *
 * There is deliberately no percentage anywhere in this file. A number like "94%"
 * implies a calibrated model that does not exist here; a status is a verdict
 * about evidence, so it is stated as one, with its reason beside it.
 */

export type ClaimStatus =
  | "SUPPORTED"
  | "CORROBORATED"
  | "PARTIALLY_SUPPORTED"
  | "DISPUTED"
  | "UNVERIFIED"
  | "CONTRADICTED"
  | "OUTDATED";

export type ClaimTone =
  | "grounded"
  | "qualified"
  | "unknown"
  | "contested"
  | "stale";

const STATUS_COPY: Record<
  ClaimStatus,
  { label: string; tone: ClaimTone; meaning: string }
> = {
  SUPPORTED: {
    label: "Supported",
    tone: "grounded",
    meaning:
      "A primary source — a document, filing, or official record — says this directly.",
  },
  CORROBORATED: {
    label: "Corroborated",
    tone: "grounded",
    meaning:
      "Outlets that are not sharing the same dispatch report it, and their accounts do not conflict.",
  },
  PARTIALLY_SUPPORTED: {
    label: "Partially supported",
    tone: "qualified",
    meaning: "Part of this is evidenced; another part is still missing support.",
  },
  DISPUTED: {
    label: "Disputed",
    tone: "contested",
    meaning: "At least one source contradicts it. Both accounts are shown.",
  },
  UNVERIFIED: {
    label: "Unverified",
    tone: "unknown",
    meaning:
      "No source we can check establishes this yet. It is reported, not confirmed.",
  },
  CONTRADICTED: {
    label: "Contradicted",
    tone: "contested",
    meaning:
      "A better-evidenced source contradicts it. Treat the original claim as unreliable.",
  },
  OUTDATED: {
    label: "Outdated",
    tone: "stale",
    meaning: "This was true as reported and has since been superseded.",
  },
};

/** Unassessed is its own answer — never a silent default to "supported". */
export const NOT_ASSESSED = "Not assessed";

export function claimLabel(status: ClaimStatus | null | undefined): string {
  if (!status) return NOT_ASSESSED;
  return STATUS_COPY[status]?.label ?? NOT_ASSESSED;
}

export function claimTone(status: ClaimStatus | null | undefined): ClaimTone {
  if (!status) return "unknown";
  return STATUS_COPY[status]?.tone ?? "unknown";
}

/** Plain-English definition shown in the evidence sheet — never omitted. */
export function claimMeaning(status: ClaimStatus | null | undefined): string {
  if (!status) return "ETHOS has not assessed this against a source.";
  return (
    STATUS_COPY[status]?.meaning ?? "ETHOS has not assessed this against a source."
  );
}

/** Reader-facing wording for how a document relates to the claim it was fetched for. */
export function relationshipLabel(
  relationship: string | null | undefined
): string | null {
  switch (relationship) {
    case "SUPPORTS":
      return "Supports this claim";
    case "CONTRADICTS":
      return "Contradicts this claim";
    case "MENTIONS_ONLY":
      return "Mentions the topic, does not test the claim";
    case "IRRELEVANT":
      return "Not relevant to this claim";
    case "UNCLEAR":
      return "Relationship unclear";
    default:
      // No assessment stored: say so instead of implying neutrality.
      return null;
  }
}

/**
 * Who decided a relationship, in words a reader can weigh. A model never has the
 * final say alone, and the copy must not pretend otherwise.
 */
export function assessmentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "DETERMINISTIC":
      return "Checked by ETHOS rules (document match, date, issuer)";
    case "AI_HYBRID":
      return "Checked by ETHOS rules, with an AI reading of the passage";
    default:
      return "Assessment method not recorded";
  }
}

/** Where the claim sentence came from. "seed" is legacy data, and says so. */
export function extractionLabel(provenance: string | null | undefined): string {
  const value = provenance ?? "seed";
  if (value.startsWith("remote:")) {
    return `Claim extracted by ${value.slice(7)} — wording is model-assisted, evidence is not`;
  }
  if (value.startsWith("local-deterministic")) {
    return "Claim extracted by ETHOS rule-based parsing";
  }
  if (value === "seed") return "Editorially curated example";
  return `Claim extraction: ${value}`;
}

/**
 * Relative time, spelled the way an editor would write it. Anything older than
 * a week gets a date rather than fake precision like "37 days ago".
 */
export function updatedLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "no date";
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "no date";
  const minutes = Math.round((now - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Greeting for the Today masthead — the only place the app speaks in person. */
export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}