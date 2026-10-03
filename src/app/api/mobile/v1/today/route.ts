/**
 * GET /api/mobile/v1/today — the Today feed.
 *
 * Paginated and card-shaped on purpose: launching the app must not pull every
 * dossier in the corpus. The hero is separated from the list because the design
 * treats it differently, and it is only returned on the first page.
 */
import {
  countStoryCards,
  getStoryCards,
} from "@/lib/mobile/dal";
import { isStoryTopic, toMobileCard } from "@/lib/mobile/dto";
import { intParam, json, preflight } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = intParam(params, "limit", 8, 25);
  const offset = intParam(params, "offset", 0, 500);
  const topicParam = params.get("topic");
  const topic = isStoryTopic(topicParam) ? topicParam : undefined;

  // One extra card on the first page: the hero is carved out of the same query
  // rather than fetched twice.
  const [rows, totalStories] = await Promise.all([
    getStoryCards({ limit: offset === 0 ? limit + 1 : limit, offset, topic }),
    countStoryCards({ topic }),
  ]);
  const cards = rows.map(toMobileCard);

  const hero = offset === 0 ? (cards[0] ?? null) : null;
  const stories = offset === 0 ? cards.slice(1) : cards;
  const consumed = offset + cards.length;

  return json(
    {
      generatedAt: new Date().toISOString(),
      totalStories,
      hero,
      stories,
      nextOffset: consumed < totalStories ? consumed : null,
    },
    // Feed freshness is a factual property: cached one minute at most, and the
    // app treats anything older than that as offline material.
    { cache: "public, max-age=60, stale-while-revalidate=120" }
  );
}
