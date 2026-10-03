/**
 * GET /api/mobile/v1/for-you — followed topics first, everything else second.
 *
 * Personalisation is an ordering input and nothing else (mirrors the web
 * `/for-you`): the same stories, the same evidence, the same disputes are
 * returned whether or not a reader follows a topic. Followed desks are grouped
 * to the top; the rest is shown as "Also developing", never hidden.
 */
import {
  getFollowedTopics,
} from "@/lib/reader";
import { getStoryCards } from "@/lib/mobile/dal";
import { isStoryTopic, toMobileCard } from "@/lib/mobile/dto";
import { intParam, json, preflight, readerIdFromRequest } from "@/lib/mobile/http";
import type { MobileStoryCard } from "@/lib/mobile/dto";
import type { StoryTopic } from "@/types/story";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = intParam(params, "limit", 12, 40);
  const readerId = readerIdFromRequest(request);
  const followed = readerId ? await getFollowedTopics(readerId) : [];
  const followedSet = new Set<StoryTopic>(followed);

  // One query, then a stable two-band order. Fetching followed and unfollowed
  // separately would need two offsets to stay pageable and could show the same
  // story twice across pages.
  const rows = await getStoryCards({ limit: limit * 2 });
  const cards = rows.map(toMobileCard);
  const mine: MobileStoryCard[] = [];
  const also: MobileStoryCard[] = [];
  for (const card of cards) {
    (followedSet.has(card.topic) ? mine : also).push(card);
  }

  return json(
    {
      generatedAt: new Date().toISOString(),
      followedTopics: followed.filter(isStoryTopic),
      // Stated in the payload so no screen can accidentally imply that
      // following a topic filters what counts as evidence.
      personalisation: "order only — no story, source or dispute is filtered",
      followed: mine.slice(0, limit),
      alsoDeveloping: also.slice(0, Math.max(0, limit - Math.min(mine.length, limit))),
      hasPreferences: followed.length > 0,
    },
    { cache: "private, no-store" }
  );
}
