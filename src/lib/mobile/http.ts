/**
 * HTTP plumbing shared by every /api/mobile/v1 route.
 *
 * Responses are `no-store` by default: a news feed cached by an intermediary is
 * how yesterday's story gets read as today's. CORS is open for the read-only
 * endpoints because the data is already public on the web reader; the mutations
 * need a bearer token, which a cross-site page cannot forge.
 */
import { verifyReaderToken } from "./auth";

export const API_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-max-age": "600",
} as const;

/** Never let a client cache a feed: freshness is a factual property here. */
export const NO_STORE = "private, no-store, max-age=0, must-revalidate";

export function json(body: unknown, init?: { status?: number; cache?: string }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": init?.cache ?? NO_STORE,
      ...API_CORS_HEADERS,
    },
  });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: API_CORS_HEADERS });
}

/**
 * Stable machine-readable error codes. The app maps each one to copy a reader
 * can act on, so no screen ever has to show a raw exception.
 */
export function apiError(code: string, message: string, status: number): Response {
  return json({ error: code, message }, { status });
}

export const badRequest = (message = "invalid request") =>
  apiError("bad_request", message, 400);
export const unauthorized = () =>
  apiError("reader_token_invalid", "A valid reader token is required.", 401);
export const notFound = () =>
  apiError("not_found", "Nothing published matches that.", 404);

/** The anonymous reader behind `Authorization: Bearer <token>`, if any. */
export function readerIdFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return verifyReaderToken(header.slice(7).trim());
}

/** Read a small JSON body without trusting its shape. */
export async function readJsonBody(
  request: Request
): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Positive bounded integer from a query string, or the default. */
export function intParam(
  params: URLSearchParams,
  name: string,
  fallback: number,
  max: number
): number {
  const raw = params.get(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value, max);
}

/**
 * Canonical web URL for a story. A shared story must open in a browser at the
 * same address the app deep-links to, so this is the one place that decides
 * where ETHOS lives publicly. Falls back to the request origin so a preview
 * deployment shares links to itself; set PUBLIC_APP_URL for production.
 */
export function publicBaseUrl(request: Request): string {
  const configured = process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

export function storyWebUrl(request: Request, slug: string): string {
  return `${publicBaseUrl(request)}/story/${slug}`;
}
