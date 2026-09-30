/**
 * Source independence: counting outlets is not counting sources.
 *
 * BBC + a Reuters article quoting a government statement + a Guardian
 * article quoting Reuters is ONE sourcing chain (the government statement
 * via the wire), not three independent confirmations. True independent
 * reporting — two outlets each doing their own verification — is rarer and
 * worth more than repetition.
 *
 * This module groups a story's sources into sourcing groups:
 *   - "wire:<agency>" when the prose credits a wire ("Reuters", "PA Media",
 *     "AFP", "Associated Press", "(Reuters)", "via Reuters"…);
 *   - "syndicated:<fingerprint>" when two outlets run near-identical text
 *     (shared wire copy with the credit stripped);
 *   - "independent:<domain>" otherwise.
 *
 * Two sources in the same group are NOT two confirmations: independence
 * counting groups by sourcingGroup, and the UI must show the distinction
 * ("3 outlets, but 1 independent source") rather than a raw outlet count.
 *
 * It is heuristic and precision-biased: uncertain prose is its own group,
 * which can only UNDER-count independence (visible, honest) rather than
 * invent confirmations.
 */

export interface IndependenceInput {
  id: string;
  publisherName: string;
  publisherDomain: string;
  title: string;
  excerpt?: string | null;
}

export interface SourcedItem extends IndependenceInput {
  sourcingGroup: string;
  sharedSourceLabel: string;
}

/** Wire agencies, matched as prose credits: "(Reuters)", "via PA Media"… */
const WIRE_AGENCIES: { key: string; label: string; pattern: RegExp }[] = [
  { key: "reuters", label: "Reuters", pattern: /\breuters\b/i },
  { key: "pa-media", label: "PA Media", pattern: /\bpa media\b|\(pa\)|\bpress association\b/i },
  { key: "associated-press", label: "Associated Press", pattern: /\bassociated press\b|\(ap\)|\bap news\b/i },
  { key: "afp", label: "AFP", pattern: /\bafp\b|agence france/i },
  { key: "bloomberg", label: "Bloomberg", pattern: /\bbloomberg\b/i },
];

/** "X, Reuters reported" / "according to Reuters" / "(Reuters)" … */
const WIRE_CREDIT =
  /\((reuters|ap|afp|pa media|bloomberg)\)|\b(?:reporting|reports?|reported|writes?|says?|said)\s+by\s+(reuters|associated press|afp|pa media|bloomberg)\b|\bvia\s+(reuters|associated press|afp|pa media|bloomberg)\b|\baccording to\s+(reuters|associated press|afp|pa media|bloomberg)\b|\b(reuters|associated press|afp|bloomberg|pa media)\s+(reported|reports|reporting|writes)\b/i;

function detectWire(text: string): { key: string; label: string } | null {
  const credit = WIRE_CREDIT.exec(text);
  if (credit) {
    const named = (credit.slice(1).find((part) => part) ?? "").toLowerCase();
    for (const entry of WIRE_AGENCIES) {
      if (entry.pattern.test(named) || named.includes(entry.key.replace("-", " "))) {
        return { key: `wire:${entry.key}`, label: entry.label };
      }
    }
  }
  return null;
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9£%\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
}

/** Jaccard similarity over content tokens. */
export function textSimilarity(a: string, textB: string): number {
  const setA = tokens(a);
  const setB = tokens(textB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  return intersection / (setA.size + setB.size - intersection);
}

/** Two outlets running near-identical copy share a source, credit or not. */
const SYNDICATION_THRESHOLD = 0.55;

function fingerprint(text: string): string {
  let hash = 2166136261;
  for (const word of [...tokens(text)].sort()) {
    for (let i = 0; i < word.length; i += 1) {
      hash ^= word.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 0).toString(36);
}

/**
 * Group sources by shared origin. Wire-credited items share the agency's
 * group across the whole story; near-duplicate prose forms one syndicated
 * group; everything else is independent by domain.
 */
export function groupSources(items: IndependenceInput[]): SourcedItem[] {
  const out: SourcedItem[] = items.map((item) => {
    const prose = `${item.title}. ${item.excerpt ?? ""}`;
    const wire = detectWire(prose);
    if (wire) {
      return { ...item, sourcingGroup: wire.key, sharedSourceLabel: wire.label };
    }
    return {
      ...item,
      sourcingGroup: `independent:${item.publisherDomain.toLowerCase()}`,
      sharedSourceLabel: "independent",
    };
  });

  // Second pass: uncredited syndication. Compare every pair of currently
  // "independent" items; near-duplicates merge into one syndicated group.
  for (let i = 0; i < out.length; i += 1) {
    if (!out[i].sourcingGroup.startsWith("independent:")) continue;
    for (let j = i + 1; j < out.length; j += 1) {
      if (!out[j].sourcingGroup.startsWith("independent:")) continue;
      const textA = `${out[i].title}. ${out[i].excerpt ?? ""}`;
      const textB = `${out[j].title}. ${out[j].excerpt ?? ""}`;
      if (textSimilarity(textA, textB) >= SYNDICATION_THRESHOLD) {
        const group = `syndicated:${fingerprint(`${textA} ${textB}`)}`;
        out[i] = { ...out[i], sourcingGroup: group, sharedSourceLabel: "shared wire copy" };
        out[j] = { ...out[j], sourcingGroup: group, sharedSourceLabel: "shared wire copy" };
      }
    }
  }
  return out;
}

/** Distinct sourcing groups across the items — the independence count. */
export function independentGroupCount(items: { sourcingGroup: string }[]): number {
  return new Set(items.map((item) => item.sourcingGroup)).size;
}

/**
 * The reader-facing independence note. When every outlet shares one wire,
 * say so plainly instead of printing a reassuring outlet count.
 */
export function sourcingNote(items: SourcedItem[]): string | null {
  if (items.length === 0) return null;
  const groups = new Map<string, SourcedItem[]>();
  for (const item of items) {
    const list = groups.get(item.sourcingGroup) ?? [];
    list.push(item);
    groups.set(item.sourcingGroup, list);
  }
  if (groups.size >= items.length) return null;
  if (groups.size === 1) {
    const [only] = [...groups.values()][0];
    const origin =
      only.sharedSourceLabel === "independent" ? "a single source" : only.sharedSourceLabel;
    return `${items.length} outlets, but 1 independent source (${origin}) — repetition, not confirmation.`;
  }
  const shared = [...groups.entries()].filter(([, list]) => list.length > 1);
  if (shared.length === 0) return null;
  const detail = shared
    .map(([, list]) => `${list.length} via ${list[0].sharedSourceLabel}`)
    .join("; ");
  return `${items.length} outlets, ${groups.size} independent sources (${detail}).`;
}