/**
 * Typed calls to the ETHOS API. One place, so a route change is a one-line edit
 * and every screen gets the same offline semantics from `useResource`.
 */
import { apiRequest } from "./client";
import { saveReaderToken, readReaderToken, clearReaderToken } from "./session";
import type {
  ForYouPayload,
  MetaPayload,
  ReaderProfilePayload,
  SavedStory,
  SearchPayload,
  SessionPayload,
  StoryCard,
  StoryDetail,
  StoryTopic,
  TodayPayload,
} from "./types";

export interface BookmarkResult {
  slug: string;
  saved: boolean;
  savedVersion: number | null;
  updatedSinceSaved: boolean;
  currentVersion: number;
}

export async function getToday(params?: {
  offset?: number;
  limit?: number;
  topic?: StoryTopic;
}): Promise<TodayPayload> {
  const query = new URLSearchParams();
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.topic) query.set("topic", params.topic);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<TodayPayload>(`/today${suffix}`);
}

export async function getForYou(): Promise<ForYouPayload> {
  // The token is what makes this "for you"; cache: no-store so a shared device
  // cannot show the previous reader's followed topics.
  return apiRequest<ForYouPayload>("/for-you", {
    auth: true,
    cache: "no-store",
  });
}

export async function getSearch(params: {
  q: string;
  topic?: StoryTopic;
}): Promise<SearchPayload> {
  const query = new URLSearchParams({ q: params.q });
  if (params.topic) query.set("topic", params.topic);
  return apiRequest<SearchPayload>(`/search?${query.toString()}`);
}

export async function getStory(slug: string): Promise<StoryDetail> {
  return apiRequest<StoryDetail>(`/stories/${encodeURIComponent(slug)}`, {
    auth: true,
    cache: "no-store",
  });
}

export async function getSaved(): Promise<{ saved: SavedStory[]; count: number }> {
  return apiRequest<{ saved: SavedStory[]; count: number }>("/saved", {
    auth: true,
    cache: "no-store",
  });
}

export async function getTopics(): Promise<{
  topics: { topic: StoryTopic; storyCount: number }[];
}> {
  return apiRequest<{ topics: { topic: StoryTopic; storyCount: number }[] }>(
    "/topics"
  );
}

export async function getMeta(): Promise<MetaPayload> {
  return apiRequest<MetaPayload>("/meta");
}

export async function toggleBookmark(slug: string): Promise<BookmarkResult> {
  return apiRequest<BookmarkResult>(
    `/stories/${encodeURIComponent(slug)}/bookmark`,
    { method: "POST", auth: true, cache: "no-store" }
  );
}

/** Fire-and-forget read receipt; failures are irrelevant to the reader. */
export async function markRead(slug: string): Promise<void> {
  try {
    await apiRequest<{ recorded: boolean; reason: string }>(
      `/stories/${encodeURIComponent(slug)}/read`,
      { method: "POST", auth: true, cache: "no-store" }
    );
  } catch {
    // A read receipt is the least important thing in the app.
  }
}

export async function toggleTopic(topic: StoryTopic): Promise<{
  topic: StoryTopic;
  followed: boolean;
}> {
  return apiRequest<{ topic: StoryTopic; followed: boolean }>(
    `/topics/${encodeURIComponent(topic)}/follow`,
    { method: "POST", auth: true, cache: "no-store" }
  );
}

/**
 * Create or reuse the anonymous device profile. Called on first save/follow, not
 * on launch — an app that mints a profile before the reader does anything is
 * collecting an identifier nobody asked for.
 */
export async function ensureSession(): Promise<string> {
  const existing = await readReaderToken();
  if (existing) {
    try {
      await apiRequest<ReaderProfilePayload>("/reader/session", {
        auth: true,
        cache: "no-store",
      });
      return existing;
    } catch {
      // Expired or no longer valid: mint a fresh one below.
      await clearReaderToken();
    }
  }
  const session = await apiRequest<SessionPayload>("/reader/session", {
    method: "POST",
    cache: "no-store",
  });
  await saveReaderToken(session.token);
  return session.token;
}

export async function getReaderProfile(): Promise<ReaderProfilePayload> {
  return apiRequest<ReaderProfilePayload>("/reader/session", {
    auth: true,
    cache: "no-store",
  });
}

/** Delete the profile server-side (bookmarks, topics, read receipts cascade). */
export async function forgetReader(): Promise<void> {
  try {
    await apiRequest<{ forgotten: boolean }>("/reader/session", {
      method: "DELETE",
      auth: true,
      cache: "no-store",
    });
  } finally {
    await clearReaderToken();
  }
}

/** Card payload for a deep link before the dossier arrives. */
export function storyPath(slug: string): string {
  return `/story/${encodeURIComponent(slug)}`;
}

export type { StoryCard };