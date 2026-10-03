/**
 * GET /api/mobile/v1/stories/[slug] — one story, whole dossier.
 *
 * The story screen is the product, so it gets everything at once: narrative,
 * claims with their evidence and provenance, source comparison, timeline,
 * corrections, related stories, and the reader's own save state. The dossier
 * comes from the same DAL the web reader uses — one mapping, no second
 * implementation of "what ETHOS knows".
 */
import { getRelatedStories, getStoryBySlug } from "@/lib/stories/dal";
import { getSavedStoryRefs } from "@/lib/reader";
import {
  cardDataFromStory,
  sourcingFor,
  toMobileCard,
} from "@/lib/mobile/dto";
import {
  json,
  notFound,
  preflight,
  readerIdFromRequest,
  storyWebUrl,
} from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const story = await getStoryBySlug(slug);
  // An unpublished or unknown slug is a 404, never an empty story: the app must
  // be able to tell "withdrawn" from "still loading".
  if (!story) return notFound();

  const readerId = readerIdFromRequest(request);
  const [related, refs] = await Promise.all([
    getRelatedStories(story, 4),
    readerId ? getSavedStoryRefs(readerId) : Promise.resolve([]),
  ]);
  const bookmark = refs.find((ref) => ref.slug === story.slug);
  const updates = story.updates ?? [];

  return json(
    {
      story,
      sourcing: sourcingFor(story.sources),
      corrections: updates.filter((update) => update.kind === "CORRECTION"),
      correctionCount: updates.filter((update) => update.kind === "CORRECTION")
        .length,
      related: related.map((sibling) => toMobileCard(cardDataFromStory(sibling))),
      saved: Boolean(bookmark),
      savedVersion: bookmark?.savedVersion ?? null,
      updatedSinceSaved: bookmark?.updatedSinceSaved ?? false,
      webUrl: storyWebUrl(request, story.slug),
      // Deep-link form the app registers, so share and open-in-app agree.
      deepLink: `ethos://story/${story.slug}`,
    },
    { cache: "private, no-store" }
  );
}
