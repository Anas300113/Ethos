"use server";

/**
 * Reader mutations: save/unsave a story, follow a topic, record a read.
 *
 * Every action mints the device profile cookie on first use, so a reader can
 * start saving without any signup. All writes are idempotent (upsert /
 * deleteMany) — a double-tapped Save button cannot create two bookmarks.
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { READER_COOKIE, readerCookieOptions } from "@/lib/reader";

async function ensureReaderId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(READER_COOKIE)?.value;
  if (existing) {
    const found = await prisma.readerProfile.findUnique({
      where: { id: existing },
      select: { id: true },
    });
    if (found) return found.id;
  }
  const created = await prisma.readerProfile.create({ data: {} });
  store.set(READER_COOKIE, created.id, readerCookieOptions);
  return created.id;
}

/** Save or unsave, whichever the current state is not. */
export async function toggleBookmarkAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;
  const readerId = await ensureReaderId();
  const story = await prisma.story.findUnique({
    where: { slug },
    select: { id: true, version: true },
  });
  if (!story) return;

  const existing = await prisma.storyBookmark.findUnique({
    where: { readerId_storyId: { readerId, storyId: story.id } },
    select: { readerId: true },
  });
  if (existing) {
    await prisma.storyBookmark.delete({
      where: { readerId_storyId: { readerId, storyId: story.id } },
    });
  } else {
    // savedVersion records WHAT was saved, so the UI can later say
    // "updated since you saved this" without rewriting history.
    await prisma.storyBookmark.create({
      data: { readerId, storyId: story.id, savedVersion: story.version },
    });
  }
  revalidatePath("/saved");
  revalidatePath(`/story/${slug}`);
}

/** Follow or unfollow a topic. Ranking input only — never hides evidence. */
export async function toggleTopicPreferenceAction(formData: FormData): Promise<void> {
  const topic = String(formData.get("topic") ?? "");
  if (!topic) return;
  const readerId = await ensureReaderId();
  const current = await prisma.readerPreference.findUnique({
    where: { readerId_topic: { readerId, topic: topic as never } },
    select: { followed: true },
  });
  await prisma.readerPreference.upsert({
    where: { readerId_topic: { readerId, topic: topic as never } },
    update: { followed: !(current?.followed ?? false) },
    create: { readerId, topic: topic as never, followed: true },
  });
  revalidatePath("/for-you");
}

/** Read receipt: powers "recently read" and staleness hints. */
export async function recordReadAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;
  const readerId = await ensureReaderId();
  const story = await prisma.story.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!story) return;
  const recent = await prisma.readingEvent.findFirst({
    where: { readerId, storyId: story.id },
    orderBy: { readAt: "desc" },
    select: { id: true, readAt: true },
  });
  // One event per story per hour: a reader refreshing must not spam history.
  if (recent && Date.now() - recent.readAt.getTime() < 60 * 60 * 1000) return;
  await prisma.readingEvent.create({ data: { readerId, storyId: story.id } });
}
