/**
 * GET /api/mobile/v1/topics — the browsable topic vocabulary with counts.
 *
 * The app renders its follow-picker from this instead of hard-coding a list, so
 * the vocabulary stays a single server-side definition.
 */
import { getTopicCounts } from "@/lib/mobile/dal";
import { ALL_TOPICS } from "@/lib/mobile/dto";
import { json, preflight } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET() {
  const counts = await getTopicCounts();
  const byTopic = new Map(counts.map((row) => [row.topic, row.storyCount]));
  return json(
    {
      // Every topic is offered even at zero, so the picker never changes shape
      // when the corpus grows into a new desk.
      topics: ALL_TOPICS.map((topic) => ({
        topic,
        storyCount: byTopic.get(topic) ?? 0,
      })),
    },
    { cache: "public, max-age=300, stale-while-revalidate=600" }
  );
}
