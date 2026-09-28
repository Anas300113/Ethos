/**
 * Text + hashing helpers for normalisation.
 *
 * Dependency-free on purpose: the project carries no HTML/XML parser, and
 * ingestion only needs to turn feed snippets into clean, bounded text. Every
 * function here is pure, so the whole normalisation path is unit-testable
 * without a database or network.
 */
import { createHash } from "node:crypto";
import { MAX_FAIR_USE_CHARS } from "@/lib/verification";

const SCRIPT_STYLE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
/** Tags that imply a block break in feeds (RSS descriptions are HTML fragments). */
const BLOCK_TAGS =
  /<\/?(?:p|br|div|li|ul|ol|h[1-6]|blockquote|figure|figcaption|section|article|tr|td|th|dt|dd)\b[^>]*>/gi;
const ANY_TAG = /<[^>]*>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bull: "\u2022",
  middot: "\u00b7",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  deg: "\u00b0",
  euro: "\u20ac",
  pound: "\u00a3",
  times: "\u00d7",
  laquo: "\u00ab",
  raquo: "\u00bb",
};

/** Longest-first alternation so `&nbsp;` wins over `&nbsp`-style prefixes. */
const NAMED_PATTERN = Object.keys(NAMED_ENTITIES)
  .sort((a, b) => b.length - a.length)
  .join("|");

function decodeNumeric(reference: string): string {
  const isHex = /^&#x/i.test(reference);
  const body = reference.replace(/^&#x?/i, "").replace(/;$/, "");
  const code = isHex ? parseInt(body, 16) : parseInt(body, 10);
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function decodeEntities(input: string): string {
  return input
    .replace(new RegExp(`&(${NAMED_PATTERN});`, "gi"), (match, name: string) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)
        ? NAMED_ENTITIES[key]
        : match;
    })
    .replace(/&#x?[0-9a-f]+;?/gi, decodeNumeric);
}

/** Unwrap `<![CDATA[ ... ]]>` (feeds wrap titles/descriptions in it constantly). */
export function readCdata(input: string): string {
  const match = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(input);
  return match ? match[1] : input;
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * HTML fragment -> single-line plain text. Block tags become spaces rather
 * than newlines because stored excerpts are single-line editorial metadata.
 */
export function toPlainText(html: string): string {
  return collapseWhitespace(
    decodeEntities(
      readCdata(html)
        .replace(SCRIPT_STYLE, " ")
        .replace(BLOCK_TAGS, " ")
        .replace(ANY_TAG, " ")
    )
  );
}

/**
 * Truncate to the project's fair-use limit, on a word boundary. Reuses the
 * SAME constant the publish gate enforces, so a stored excerpt can never be
 * longer than what the gate would allow a curated story to cite.
 */
export function truncateFairUse(text: string, max: number = MAX_FAIR_USE_CHARS): string {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[,;:.\-–—"\u2018\u2019"\u201c\u201d]+$/, "")}\u2026`;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Leading N words — used as a conservative excerpt fallback. */
export function firstWords(text: string, words: number): string {
  return text.split(" ").slice(0, Math.max(1, words)).join(" ").trim();
}

/** Strip HTML + surrounding noise from an author field ("By Jane Doe (BBC)" -> "Jane Doe"). */
export function normalisePersonName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let name = collapseWhitespace(toPlainText(raw));
  if (!name) return undefined;
  name = name.replace(/^(by|written by|author:?|reporter:?)\s+/i, "");
  name = name.replace(/\s*[\[(][^)\]]*[)\]]\s*$/, "");
  name = name.replace(/[|].*$/, "");
  name = collapseWhitespace(name);
  if (!name || name.length > 120) return undefined;
  // Reject obvious junk (pure initials-by-line, emails, "Staff").
  if (/^[^@\s]+@[^@\s]+$/.test(name)) return undefined;
  return name;
}

export function truncateTitle(text: string, max = 300): string {
  const clean = collapseWhitespace(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "");
}
