/**
 * POST /api/mobile/v1/stories/[slug]/bookmark — save or unsave (token required).
 *
 * A single toggle endpoint rather than separate create/delete: the reader's
 * button says "saved" or "not saved", and a lost response must not leave the
 * phone and the server disagreeing. The reply is the authoritative state, so the
 * app re-renders from the answer rather than from an optimistic guess.
 */
import { getStoryCardBySlug } from "@/lib/mobile/dal";
import { toggleBookmark } from "@/lib/reader-mutations";
import {
  badRequest,
  json,
  notFound,
  preflight,
  readerIdFromRequest,
  unauthorized,
} from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const readerId = readerIdFromRequest(request);
  if (!readerId) return unauthorized();

  const { slug } = await context.params;
  // Only the reader's own bookmarks are ever written, and only for a story that
  // is actually published — a withdrawn slug must not accumulate saves.
  const card = await getStoryCardBySlug(slug);
  if (!card) return notFound();

  const state = await toggleBookmark(readerId, slug);
  if (!state) return badRequest("That story is no longer available.");

  return json({
    slug,
    ...state,
    // The version the reader now holds, so the app can detect drift later.
    currentVersion: card.version,
  });
}
