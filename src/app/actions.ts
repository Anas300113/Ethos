"use server";

/**
 * Reader mutations: save/unsave a story, follow a topic, record a read.
 *
 * Every action mints the device profile cookie on first use, so a reader can
 * start saving without any signup. The writes themselves live in
 * src/lib/reader-mutations.ts, shared with the mobile API: the phone and the
 * browser must apply identical save-state semantics, and a double-tapped Save
 * button must never create two bookmarks.
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { READER_COOKIE, readerCookieOptions } from "@/lib/reader";
import {
  recordRead,
  toggleBookmark,
  toggleTopicPreference,
} from "@/lib/reader-mutations";
import type { StoryTopic } from "@/types/story";

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
  await toggleBookmark(readerId, slug);
  revalidatePath("/saved");
  revalidatePath(`/story/${slug}`);
}

/** Follow or unfollow a topic. Ranking input only — never hides evidence. */
export async function toggleTopicPreferenceAction(formData: FormData): Promise<void> {
  const topic = String(formData.get("topic") ?? "");
  if (!topic) return;
  const readerId = await ensureReaderId();
  await toggleTopicPreference(readerId, topic as StoryTopic);
  revalidatePath("/for-you");
}

/** Read receipt: powers "recently read" and staleness hints. */
export async function recordReadAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;
  const readerId = await ensureReaderId();
  await recordRead(readerId, slug);
}
