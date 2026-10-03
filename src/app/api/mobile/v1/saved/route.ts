/**
 * GET /api/mobile/v1/saved — the reader's bookmarks (token required).
 *
 * Bookmarks record the story version at save time, so the app can say "updated
 * since you saved this" instead of quietly showing a changed story as if it were
 * the one that was saved. Save order is preserved.
 */
import { getSavedStoryRefs } from "@/lib/reader";
import { getStoryCardsBySlugs } from "@/lib/mobile/dal";
import { toMobileCard, type MobileSavedStory } from "@/lib/mobile/dto";
import { json, preflight, readerIdFromRequest, unauthorized } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const readerId = readerIdFromRequest(request);
  if (!readerId) return unauthorized();

  const refs = await getSavedStoryRefs(readerId);
  const cards = await getStoryCardsBySlugs(refs.map((ref) => ref.slug));
  const refBySlug = new Map(refs.map((ref) => [ref.slug, ref]));

  const saved: MobileSavedStory[] = cards.map((card) => {
    const ref = refBySlug.get(card.slug);
    return {
      ...toMobileCard(card),
      savedVersion: ref?.savedVersion ?? card.version,
      savedAt: (ref?.createdAt ?? new Date()).toISOString(),
      updatedSinceSaved: ref?.updatedSinceSaved ?? false,
    };
  });

  return json(
    { saved, count: saved.length },
    // The list is per-reader and mutable; caching it would show a stale library.
    { cache: "private, no-store" }
  );
}
