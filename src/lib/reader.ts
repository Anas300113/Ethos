/**
 * Reader data access: bookmarks, topic preferences, reading history.
 *
 * MVP identity is a device cookie holding a ReaderProfile id — no password,
 * no e-mail, nothing personally identifying. Reads live here; the mutations
 * that set the cookie live in src/app/actions.ts (a Server Component cannot
 * set a cookie, so the cookie is minted on the first save/follow action).
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { StoryTopic } from "@/types/story";

export const READER_COOKIE = "ethos_reader";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The reader's profile id, or null when this device has never saved anything. */
export async function getReaderId(): Promise<string | null> {
  const store = await cookies();
  return store.get(READER_COOKIE)?.value ?? null;
}

/** Cookie options used when minting a profile in a Server Action. */
export const readerCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: ONE_YEAR_SECONDS,
  secure: process.env.NODE_ENV === "production",
} as const;

export interface SavedStoryRef {
  storyId: string;
  slug: string;
  savedVersion: number;
  createdAt: Date;
  /** True when the curated story has moved on since it was saved. */
  updatedSinceSaved: boolean;
}

export async function getSavedStoryRefs(
  readerId: string
): Promise<SavedStoryRef[]> {
  const rows = await prisma.storyBookmark.findMany({
    where: { readerId },
    include: { story: { select: { slug: true, version: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    storyId: row.storyId,
    slug: row.story.slug,
    savedVersion: row.savedVersion,
    createdAt: row.createdAt,
    updatedSinceSaved: row.story.version > row.savedVersion,
  }));
}

export async function getSavedStoryIds(readerId: string | null): Promise<Set<string>> {
  if (!readerId) return new Set();
  const rows = await prisma.storyBookmark.findMany({
    where: { readerId },
    select: { storyId: true },
  });
  return new Set(rows.map((row) => row.storyId));
}

/** Followed topics. Empty means "no preference expressed yet". */
export async function getFollowedTopics(readerId: string | null): Promise<StoryTopic[]> {
  if (!readerId) return [];
  const rows = await prisma.readerPreference.findMany({
    where: { readerId, followed: true },
    select: { topic: true },
  });
  return rows.map((row) => row.topic);
}

export async function getRecentlyReadSlugs(
  readerId: string | null,
  limit = 5
): Promise<string[]> {
  if (!readerId) return [];
  const rows = await prisma.readingEvent.findMany({
    where: { readerId },
    include: { story: { select: { slug: true } } },
    orderBy: { readAt: "desc" },
    take: limit,
  });
  return [...new Set(rows.map((row) => row.story.slug))];
}
