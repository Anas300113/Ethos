/**
 * Network layer: one conditional GET per feed, with a byte cap and a deadline.
 *
 * Nothing here throws — every failure mode comes back as a tagged FetchResult
 * so the orchestrator can keep going when a feed is down and record WHY in the
 * run log. The guards are practical, not theatrical: a timeout (a hung feed
 * would otherwise stall the whole run), a byte ceiling (feeds run to hundreds
 * of KB and a mistyped URL can point at a 2 GB download), and a content-type
 * sniff so an HTML error page served with status 200 never reaches the parser.
 */
import { looksLikeFeed } from "./feeds";
import type { FetchFeedOptions, FetchResult } from "./types";

export const DEFAULT_TIMEOUT_MS = 12_000;
export const DEFAULT_MAX_BYTES = 3_000_000;
/** Honest UA: feeds block generic agents, and pretending otherwise burns the host. */
export const DEFAULT_USER_AGENT =
  "ethos-newsbot/1.0 (research verification pipeline; +https://ethos.example.invalid/ingest)";

const FEED_CONTENT_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/xml",
  "application/rdf+xml",
  "text/xml",
  "text/plain",
  "",
]);

export function isFeedContentType(contentType: string): boolean {
  const type = contentType.split(";")[0].trim().toLowerCase();
  // text/html is deliberately absent: HTML under an RSS URL means the feed
  // moved, and parsing it would quietly store the wrong thing.
  return FEED_CONTENT_TYPES.has(type);
}

/** Validators are echoed back verbatim; oversized junk is dropped, not sent. */
function pickValidator(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > 190) return undefined;
  return trimmed;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function isRetryable(result: FetchResult): boolean {
  if (result.kind !== "error") return false;
  if (result.httpStatus === undefined) return true; // DNS / connection / timeout
  return result.httpStatus >= 500 || result.httpStatus === 429;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read a body without ever buffering more than `maxBytes`. Streaming matters:
 * `response.text()` allocates the entire resource before we learn its size.
 */
async function readCapped(
  response: Response,
  maxBytes: number
): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    return { text, bytes: text.length, truncated: text.length > maxBytes };
  }
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  let text = "";
  for (const chunk of chunks) text += decoder.decode(chunk, { stream: true });
  text += decoder.decode();
  return { text, bytes, truncated };
}

async function attemptFetch(options: FetchFeedOptions): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept:
      "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
    "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
    "Accept-Encoding": "gzip, deflate",
  };
  const etag = pickValidator(options.etag);
  const lastModified = pickValidator(options.lastModified);
  if (etag) headers["If-None-Match"] = etag;
  else if (lastModified) headers["If-Modified-Since"] = lastModified;

  try {
    const response = await fetch(options.url, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    if (response.status === 304) return { kind: "not-modified", httpStatus: 304 };
    if (!response.ok) {
      await response.body?.cancel?.().catch(() => undefined);
      return {
        kind: "error",
        httpStatus: response.status,
        reason: `HTTP ${response.status} ${response.statusText}`.trim(),
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!isFeedContentType(contentType)) {
      await response.body?.cancel?.().catch(() => undefined);
      return {
        kind: "rejected",
        httpStatus: response.status,
        contentType,
        reason: `content-type "${contentType || "unknown"}" is not a feed`,
      };
    }

    const { text, bytes, truncated } = await readCapped(response, maxBytes);
    if (truncated) {
      return {
        kind: "error",
        httpStatus: response.status,
        reason: `feed exceeded the ${maxBytes} byte limit and was discarded`,
      };
    }
    if (text.trim().length < 64 || !looksLikeFeed(text)) {
      return {
        kind: "rejected",
        httpStatus: response.status,
        contentType,
        reason: "payload is not an RSS/Atom document",
      };
    }

    return {
      kind: "ok",
      httpStatus: response.status,
      body: text,
      bytes,
      contentType,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
    };
  } catch (error) {
    const aborted = controller.signal.aborted;
    return {
      kind: "error",
      reason: aborted ? `timed out after ${timeoutMs}ms` : `request failed: ${errorMessage(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a feed, retrying transient failures (network, 5xx, 429) once. */
export async function fetchFeed(options: FetchFeedOptions): Promise<FetchResult> {
  const maxAttempts = 2;
  let last: FetchResult = { kind: "error", reason: "not attempted" };
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    last = await attemptFetch(options);
    if (last.kind !== "error" || !isRetryable(last) || attempt === maxAttempts - 1) return last;
    await sleep(400 * (attempt + 1));
  }
  return last;
}

