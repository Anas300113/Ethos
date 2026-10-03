/**
 * Build-time configuration the app is allowed to know.
 *
 * Only public values. There is no database URL, no AI key, no evidence-search key
 * anywhere in this bundle — the app talks to the ETHOS API and the API is the
 * only thing that holds credentials. That is a structural property, not a
 * convention: nothing in `src/` imports a server module.
 */
import { API_BASE } from "./api/client";

/** Where the web reader lives, for universal links and shared stories. */
function originOf(url: string): string {
  const match = /^(https?:\/\/[^/]+)/i.exec(url);
  return match ? (match[1] as string) : "";
}

export const WEB_ORIGIN: string =
  process.env.EXPO_PUBLIC_WEB_URL ?? originOf(API_BASE);

/** Custom scheme registered in app.json. */
export const SCHEME = "ethos";

/** The URL the app shares; the server echoes the same value in `webUrl`. */
export function storyUrl(slug: string, fromServer?: string): string {
  if (fromServer) return fromServer;
  return `${WEB_ORIGIN}/story/${encodeURIComponent(slug)}`;
}

export function storyDeepLink(slug: string): string {
  return `${SCHEME}://story/${encodeURIComponent(slug)}`;
}