/**
 * GET /api/mobile/v1/search?q= — published stories only.
 *
 * Results are stories, never raw ingested articles: an unverified candidate is
 * not an answer to a reader's question. `matchedIn` says why a result matched so
 * the list can be honest ("matched in a claim") instead of looking magic.
 */
import { getTopicCounts, searchStoryCards } from "@/lib/mobile/dal";
import { ALL_TOPICS, isStoryTopic, toMobileCard } from "@/lib/mobile/dto";
import { badRequest, intParam, json, preflight } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  if (query.length > 200) return badRequest("Search terms are limited to 200 characters.");
  const topicParam = params.get("topic");
  const topic = isStoryTopic(topicParam) ? topicParam : undefined;
  const limit = intParam(params, "limit", 20, 50);
  const offset = intParam(params, "offset", 0, 200);

  const [rows, topicCounts] = await Promise.all([
    searchStoryCards(query, { topic, limit, offset }),
    query ? Promise.resolve([]) : getTopicCounts(),
  ]);

  const term = query.toLowerCase();
  return json(
    {
      query,
      results: rows.map((row) => {
        // `matchedIn` explains the hit from fields the card actually carries.
        // A story can also match on narrative or claim text that is not on the
        // card; then the tag says so generically rather than guessing a field.
        const named = term
          ? [
              row.headline.toLowerCase().includes(term) ? "headline" : null,
              row.oneSentenceSummary.toLowerCase().includes(term)
                ? "summary"
                : null,
              row.sources.some(
                (source) =>
                  source.publisher.name.toLowerCase().includes(term) ||
                  source.title.toLowerCase().includes(term)
              )
                ? "source"
                : null,
            ].filter((value): value is string => value !== null)
          : [];
        return {
          ...toMobileCard(row),
          matchedIn: term ? (named.length > 0 ? named : ["story text"]) : [],
        };
      }),
      // Empty-query state: what the reader can browse right now.
      topics: query ? [] : topicCounts,
      availableTopics: ALL_TOPICS,
    },
    { cache: "public, max-age=60, stale-while-revalidate=300" }
  );
}
