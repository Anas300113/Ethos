/**
 * GET /api/mobile/v1/meta — what this build is connected to.
 *
 * The About screen must be able to say truthfully how many stories are
 * published and when the corpus last moved, instead of shipping a hard-coded
 * sentence that goes stale the first week. `sourcing.grouped` also tells the app
 * whether independence figures exist yet, so it never renders "independent
 * origins" as a label before the grouping pass has produced any.
 */
import { prisma } from "@/lib/prisma";
import { READER_VISIBLE_STATUSES } from "@/lib/curation/types";
import { json, preflight, publicBaseUrl } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const [storyCount, latest, sources, groupedSources, corrections] =
    await Promise.all([
      prisma.story.count({ where: { status: { in: READER_VISIBLE_STATUSES } } }),
      prisma.story.findFirst({
        where: { status: { in: READER_VISIBLE_STATUSES } },
        orderBy: { lastUpdated: "desc" },
        select: { lastUpdated: true },
      }),
      prisma.articleSource.count(),
      prisma.articleSource.count({ where: { sourcingGroup: { not: null } } }),
      prisma.storyUpdate.count({ where: { kind: "CORRECTION" } }),
    ]);

  return json(
    {
      apiVersion: "v1",
      app: { name: "ETHOS", tagline: "Evidence-first news" },
      publicBaseUrl: publicBaseUrl(request),
      stories: {
        published: storyCount,
        lastUpdated: latest?.lastUpdated.toISOString() ?? null,
      },
      sourcing: {
        sources: sources,
        grouped: groupedSources,
        // False means the independence count is not yet ours to publish.
        independenceMeasured: sources > 0 && groupedSources > 0,
      },
      corrections: { published: corrections },
    },
    { cache: "public, max-age=300, stale-while-revalidate=600" }
  );
}
