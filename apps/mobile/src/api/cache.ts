/**
 * Local cache for offline reading.
 *
 * Two stores, because they age differently: feed snapshots (minutes — a stale
 * front page is misinformation) and opened stories (days — an article you are
 * reading on a plane is still the article, and the app says when it was saved).
 *
 * The cache is never presented as live. Every read returns a timestamp, and every
 * screen that serves from it must show the offline/cached marker.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "ethos.cache.";
const RECENT_KEY = "ethos.recent.slugs";
/** Feeds go stale fast: a front page older than this is clearly archived. */
export const FEED_MAX_AGE_MS = 10 * 60 * 1000;
/** An opened story stays readable for a week, clearly marked as cached. */
export const STORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 20;

export interface Cached<T> {
  value: T;
  storedAt: number;
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${PREFIX}${key}`,
      JSON.stringify({ value, storedAt: Date.now() })
    );
  } catch {
    // A failed cache write must never break a successful network read.
  }
}

export async function readCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached<T>;
    if (typeof parsed?.storedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => key.startsWith(PREFIX));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    // Nothing to do: the cache is a performance feature, not a source of truth.
  }
}

/** Most recently opened slugs, newest first — powers offline Story deep links. */
export async function rememberStory(slug: string): Promise<void> {
  try {
    const slugs = await getRecentSlugs();
    const next = [slug, ...slugs.filter((entry) => entry !== slug)].slice(
      0,
      RECENT_LIMIT
    );
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function getRecentSlugs(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

export function storyCacheKey(slug: string): string {
  return `story.${slug}`;
}