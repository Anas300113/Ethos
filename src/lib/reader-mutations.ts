/**
 * Reader mutations shared by the web Server Actions and the mobile API.
 *
 * Save-state semantics are the interesting part: a bookmark records the story
 * VERSION that was saved, so "updated since you saved this" is a comparison
 * against real history rather than a guess. Both clients must use this one
 * implementation, or the phone and the browser would disagree about what a
 * bookmark means. Everything here is idempotent — a double-tapped button cannot
 * create two bookmarks or a second copy of a preference.
 */
import { prisma } from "@/lib/prisma";
import type { StoryTopic } from "@/types/story";

export interface BookmarkState {
  saved: boolean;
  savedVersion: number | null;
  updatedSinceSaved: boolean;
}

/** Save or unsave, whichever the current state is not. Null: no such story. */
export async function toggleBookmark(
  readerId: string,
  slug: string
): Promise<BookmarkState | null> {
  const story = await prisma.story.findUnique({
    where: { slug },
    select: { id: true, version: true },
  });
  if (!story) return null;

  const key = { readerId_storyId: { readerId, storyId: story.id } };
  const existing = await prisma.storyBookmark.findUnique({
    where: key,
    select: { savedVersion: true },
  });
  if (existing) {
    await prisma.storyBookmark.delete({ where: key });
    return { saved: false, savedVersion: null, updatedSinceSaved: false };
  }
  await prisma.storyBookmark.create({
    data: { readerId, storyId: story.id, savedVersion: story.version },
  });
  return {
    saved: true,
    savedVersion: story.version,
    updatedSinceSaved: false,
  };
}

/** Follow or unfollow a topic. Ranking input only — never hides evidence. */
export async function toggleTopicPreference(
  readerId: string,
  topic: StoryTopic
): Promise<boolean> {
  const current = await prisma.readerPreference.findUnique({
    where: { readerId_topic: { readerId, topic } },
    select: { followed: true },
  });
  const followed = !(current?.followed ?? false);
  await prisma.readerPreference.upsert({
    where: { readerId_topic: { readerId, topic } },
    update: { followed },
    create: { readerId, topic, followed },
  });
  return followed;
}

/** Read receipt: powers "recently read" and staleness hints. */
export async function recordRead(
  readerId: string,
  slug: string
): Promise<"recorded" | "duplicate" | "unknown_story"> {
  const story = await prisma.story.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!story) return "unknown_story";

  const recent = await prisma.readingEvent.findFirst({
    where: { readerId, storyId: story.id },
    orderBy: { readAt: "desc" },
    select: { readAt: true },
  });
  // One event per story per hour: refreshing must not spam history.
  if (recent && Date.now() - recent.readAt.getTime() < 60 * 60 * 1000) {
    return "duplicate";
  }
  await prisma.readingEvent.create({ data: { readerId, storyId: story.id } });
  return "recorded";
}
