/**
 * Tolerant RSS 2.0 / Atom 1.0 / RSS 1.0 parser.
 *
 * Dependency-free by design (the project has no XML parser, and adding one for
 * three known feed dialects is not worth the supply chain). It matches on the
 * *local* tag name with any namespace prefix stripped, which is what lets one
 * code path cover `content:encoded`, `atom:link`, `dc:creator`, `media:*` and
 * the default-namespace `<content>` Guardian uses.
 *
 * Deliberately forgiving: feeds are dirty, and one unparsable entry must not
 * cost us the other 49. Nothing is invented — entries without a link are
 * dropped here and everything else is rejected (audited) by normalisation.
 */
import { collapseWhitespace, decodeEntities, readCdata, toPlainText } from "./text";
import type { FeedFormat, ParsedFeed, RawFeedItem } from "./types";

const ITEM_BLOCK = /<(item|entry)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
const TAG = /<([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>(?:([\s\S]*?)<\/\1\s*>)?/g;
const ATTR = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

interface XmlTag {
  name: string;
  attrs: Record<string, string>;
  content: string;
}

function stripPrefix(name: string): string {
  const idx = name.lastIndexOf(":");
  return (idx === -1 ? name : name.slice(idx + 1)).toLowerCase();
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR.exec(raw)) !== null) {
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    attrs[stripPrefix(match[1])] = collapseWhitespace(decodeEntities(value));
  }
  return attrs;
}

function collectTags(xml: string): XmlTag[] {
  const tags: XmlTag[] = [];
  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG.exec(xml)) !== null) {
    tags.push({
      name: stripPrefix(match[1]),
      attrs: parseAttributes(match[2] ?? ""),
      content: match[4] ?? "",
    });
  }
  return tags;
}

/** First tag whose local name is in `names`, preferring earlier names in the list. */
function firstTag(tags: XmlTag[], names: string[]): XmlTag | undefined {
  for (const name of names) {
    const found = tags.find((tag) => tag.name === name);
    if (found) return found;
  }
  return undefined;
}

function textField(tags: XmlTag[], names: string[]): string | undefined {
  const tag = firstTag(tags, names);
  if (!tag) return undefined;
  const text = collapseWhitespace(toPlainText(tag.content));
  return text.length > 0 ? text : undefined;
}

/**
 * Atom carries the URL in an attribute, not element text:
 *   <link rel="alternate" href="..."/>   (absent rel means alternate)
 * Prefer alternate, else the first href, so `rel="self"`-only feeds still
 * produce a URL the caller can reject on domain grounds rather than swallow.
 */
function atomLink(tags: XmlTag[]): string | undefined {
  const links = tags.filter((tag) => tag.name === "link" && Boolean(tag.attrs.href));
  if (links.length === 0) return undefined;
  const alternate = links.find(
    (link) => link.attrs.rel === undefined || link.attrs.rel === "alternate"
  );
  return (alternate ?? links[0]).attrs.href;
}

function itemAuthor(entry: string): string | undefined {
  const tags = collectTags(entry);
  const author = firstTag(tags, ["creator", "author"]);
  if (!author) return undefined;
  const nested = collectTags(author.content).find((tag) => tag.name === "name");
  const raw = nested ? nested.content : author.content;
  const text = collapseWhitespace(toPlainText(raw));
  return text.length > 0 ? text : undefined;
}

function detectFormat(xml: string): {
  format: FeedFormat;
  rootAttrs: Record<string, string>;
} {
  const head = xml.slice(0, 4000);
  const rdf = /<rdf:rdf\b/i.test(head);
  const rssRoot = /<rss\b/i.test(head);
  const feedRoot = /<feed\b/i.test(head);

  let rootMatch: RegExpExecArray | null = /<(rss|feed)\b([^>]*)>/i.exec(head);
  if (rdf) rootMatch = /<rdf:RDF\b([^>]*)>/i.exec(head) ?? rootMatch;

  if (feedRoot && !rssRoot) {
    return { format: "ATOM_1_0", rootAttrs: rootMatch ? parseAttributes(rootMatch[2] ?? "") : {} };
  }
  if (rdf && !rssRoot) {
    return { format: "RSS_1_0", rootAttrs: rootMatch ? parseAttributes(rootMatch[2] ?? "") : {} };
  }
  return { format: "RSS_2_0", rootAttrs: rootMatch ? parseAttributes(rootMatch[2] ?? "") : {} };
}

const PUBLISHED_NAMES = ["published", "pubdate", "issuedate", "originaldate", "date"];
const MODIFIED_NAMES = ["modified", "updated", "lastmoddate", "lastbuilddate"];
/** `content:encoded` first, then RSS description, then Atom summary/content. */
const DESCRIPTION_NAMES = ["encoded", "description", "summary", "content", "subtitle"];

function channelMeta(xml: string, rootAttrs: Record<string, string>) {
  const head = xml.slice(0, 6000);
  const channelBody = /<channel\b[^>]*>([\s\S]*?)<\/channel\s*>/i.exec(head);
  const tags = collectTags(channelBody ? channelBody[1] : head);
  return {
    title: textField(tags, ["title"]) ?? "",
    language: textField(tags, ["language"]) ?? rootAttrs.lang ?? rootAttrs["xml:lang"],
  };
}

export function parseFeed(xml: string, feedUrl: string, maxItems = 100): ParsedFeed {
  const { format, rootAttrs } = detectFormat(xml);
  const channel = channelMeta(xml, rootAttrs);
  const items: RawFeedItem[] = [];

  ITEM_BLOCK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ITEM_BLOCK.exec(xml)) !== null && items.length < maxItems) {
    const [, , , body] = match;
    const tags = collectTags(body);

    // Atom carries the URL in a `link href` attribute, RSS in element text.
    const link = collapseWhitespace(
      (format === "ATOM_1_0" ? atomLink(tags) : textField(tags, ["link"])) ?? ""
    );
    // No destination means nothing to cite — dropped, not rejected.
    if (!link) continue;

    const guidTag = firstTag(tags, ["id", "guid", "permalink"]);
    const descriptionTag = firstTag(tags, DESCRIPTION_NAMES);

    items.push({
      title: textField(tags, ["title"]) ?? "",
      link: resolveUrl(link, feedUrl),
      guid: guidTag ? collapseWhitespace(toPlainText(guidTag.content)) : undefined,
      publishedRaw: textField(tags, PUBLISHED_NAMES),
      modifiedRaw: textField(tags, MODIFIED_NAMES),
      descriptionRaw: descriptionTag
        ? collapseWhitespace(toPlainText(readCdata(descriptionTag.content)))
        : undefined,
      authorRaw: itemAuthor(body),
      language: textField(tags, ["language"]),
    });
  }

  return {
    format,
    channelTitle: channel.title,
    channelLanguage: channel.language,
    items,
  };
}

/** Resolve a possibly-relative feed URL against the feed's own address. */
export function resolveUrl(candidate: string, baseUrl: string): string {
  const trimmed = collapseWhitespace(decodeEntities(readCdata(candidate)));
  if (!trimmed) return "";
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    // Leave it for the validator to reject with an audited reason.
    return trimmed;
  }
}

export function looksLikeFeed(xml: string): boolean {
  const head = xml.slice(0, 2000).toLowerCase();
  return (
    head.includes("<?xml") ||
    head.includes("<rss") ||
    head.includes("<feed") ||
    head.includes("<rdf")
  );
}

