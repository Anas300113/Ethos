/**
 * The single network door.
 *
 * Nothing else in the app calls fetch. That matters for three promises:
 *  - every response is classified (offline / timeout / 404 / unauthorised /
 *    server) so no screen has to invent its own error handling;
 *  - no credential other than the reader's own bearer token is ever sent, and
 *    no server secret is ever present in the bundle;
 *  - a release build that is pointed at a non-HTTPS or localhost API fails loudly
 *    at launch instead of quietly shipping a dev endpoint to the App Store.
 */
import { readReaderToken } from "./session";

/**
 * Build-time configuration only. EXPO_PUBLIC_* values are inlined into the
 * bundle, so this URL is the ONLY thing the app knows about the backend — the
 * database URL, AI keys and evidence keys stay server-side by construction.
 */
const RAW_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/mobile/v1";

export const API_BASE = RAW_BASE.replace(/\/+$/, "");

export type ApiFailure =
  | "offline"
  | "timeout"
  | "not_found"
  | "unauthorized"
  | "server"
  | "parse"
  | "insecure_config";

export class ApiError extends Error {
  readonly failure: ApiFailure;
  readonly status?: number;

  constructor(failure: ApiFailure, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.failure = failure;
    this.status = status;
  }
}

/** Copy a failure into something a reader can act on, without jargon. */
export function failureMessage(failure: ApiFailure): string {
  switch (failure) {
    case "offline":
      return "You appear to be offline. Check your connection and try again.";
    case "timeout":
      return "ETHOS took too long to answer. Try again.";
    case "not_found":
      return "This story is no longer published.";
    case "unauthorized":
      return "Your saved list needs to be set up again on this device.";
    case "parse":
      return "ETHOS sent something this version of the app could not read.";
    case "insecure_config":
      return "This build is not pointed at a secure ETHOS server.";
    case "server":
      return "ETHOS could not complete the request.";
  }
}

/**
 * Is this build safe to ship? A release bundle must talk to a real deployment
 * over HTTPS; anything else means the store build would show a reader an empty
 * feed from a laptop on someone's desk.
 */
export function apiConfigProblem(): string | null {
  if (typeof __DEV__ === "boolean" && __DEV__) return null;
  if (!RAW_BASE.startsWith("https://")) {
    return "EXPO_PUBLIC_API_URL must be an https:// URL in a production build.";
  }
  if (/localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|\b10\.\d+\./.test(RAW_BASE)) {
    return "EXPO_PUBLIC_API_URL still points at a development machine.";
  }
  return null;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  /** Send the reader's bearer token. Only needed for personal data. */
  auth?: boolean;
  body?: unknown;
  timeoutMs?: number;
  /** Authenticated reads vary per reader; they must never be reused across one. */
  cache?: "default" | "no-store";
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 12000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { accept: "application/json" };

  if (options.auth) {
    const token = await readReaderToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      cache: options.cache ?? "default",
    });
  } catch (error) {
    const aborted =
      error instanceof Object && "name" in error && error.name === "AbortError";
    throw new ApiError(
      aborted ? "timeout" : "offline",
      aborted ? "Request timed out" : "Network request failed"
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiError(
      response.status === 404
        ? "not_found"
        : response.status === 401
          ? "unauthorized"
          : "server",
      `Request failed with ${response.status}`,
      response.status
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("parse", "Response body was not JSON", response.status);
  }
}