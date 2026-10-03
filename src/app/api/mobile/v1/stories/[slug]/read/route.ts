/**
 * POST /api/mobile/v1/stories/[slug]/read — a read receipt (token required).
 *
 * Deliberately the thinnest write in the API: it records that a story was
 * opened, at most once an hour, and nothing else. No dwell time, no scroll
 * depth, no attention model. A reader can delete the profile and every event
 * goes with it.
 */
import { recordRead } from "@/lib/reader-mutations";
import { json, preflight, readerIdFromRequest, unauthorized } from "@/lib/mobile/http";

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
  const outcome = await recordRead(readerId, slug);
  // Always 200: a duplicate receipt is not a client error, and the app must not
  // retry-loop on a rate limit it cannot see. The reason is returned verbatim
  // instead of being invented from a query parameter.
  return json({ recorded: outcome === "recorded", reason: outcome });
}
