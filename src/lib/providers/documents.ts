/**
 * SSRF-guarded document fetcher: one document body for evidence assessment.
 * Only http(s), no credentials in URL, no private/loopback/link-local or
 * metadata hosts, bounded size and time. Non-text bodies are refused.
 * A fetch failure is ordinary — the caller marks the claim accordingly.
 */
import type { DocumentFetcher } from "./types";

/** Private, loopback, link-local and metadata hosts — never fetched. */
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^169\.254\./,
  /^metadata\.google/i,
  /\.internal$/i,
];

export function isFetchableUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname;
  if (BLOCKED_HOSTS.some((pattern) => pattern.test(host))) return false;
  return true;
}

export class GuardedDocumentFetcher implements DocumentFetcher {
  readonly name = "guarded-fetch";
  private readonly maxBytes = 1_000_000;
  private readonly timeoutMs = 12_000;

  async fetchDocument(
    url: string
  ): Promise<{ text: string; contentType: string } | null> {
    if (!isFetchableUrl(url)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "ethos-newsbot/1.0 (evidence verification)" },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") ?? "";
      if (!/text|html|xml|json/i.test(contentType)) return null;
      const reader = response.body?.getReader?.();
      if (!reader) {
        const text = await response.text();
        return text.length > this.maxBytes ? null : { text, contentType };
      }
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        bytes += value.byteLength;
        if (bytes > this.maxBytes) {
          await reader.cancel().catch(() => undefined);
          return null;
        }
        chunks.push(value);
      }
      const decoder = new TextDecoder("utf-8", { fatal: false });
      let text = "";
      for (const chunk of chunks) text += decoder.decode(chunk, { stream: true });
      text += decoder.decode();
      return { text, contentType };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
