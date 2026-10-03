/**
 * POST /api/mobile/v1/topics/[topic]/follow — follow or unfollow (token required).
 *
 * Order only. A followed topic changes which stories appear first; it can never
 * remove a story, a source, or a dispute from anyone's feed, and this endpoint
 * holds no other power.
 */
import { toggleTopicPreference } from "@/lib/reader-mutations";
import { isStoryTopic } from "@/lib/mobile/dto";
import {
  badRequest,
  json,
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
  context: { params: Promise<{ topic: string }> }
) {
  const readerId = readerIdFromRequest(request);
  if (!readerId) return unauthorized();

  const { topic } = await context.params;
  if (!isStoryTopic(topic)) {
    return badRequest("That is not one of the ETHOS desks.");
  }

  const followed = await toggleTopicPreference(readerId, topic);
  return json({
    topic,
    followed,
    effect: "ordering",
    filtersEvidence: false,
  });
}
