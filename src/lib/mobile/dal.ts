/**
 * Mobile reads: the same published corpus as the web reader, projected narrowly.
 *
 * The web DAL deliberately returns whole dossiers, which is right for an article
 * page and wasteful for a list of ten — a card needs a headline, an image, and a
 * sourcing summary, not every evidence quote on the story. These queries select
 * exactly that, so the Today feed stays one round trip as the corpus grows.
 *
 * Two invariants inherited from the web DAL: only READER_VISIBLE_STATUSES are
 * ever returned (a CANDIDATE never reaches a phone), and sourcing groups are
 * carried through untouched so the client can never guess at independence.
 */
import { prisma } from "@/lib/prisma";
import { READER_VISIBLE_STATUSES } from "@/lib/curation/types";
import type { Claim, StoryTopic } from "@/types/story";
import type { StoryCardData } from "./dto";

const visible = { status: { in: READER_VISIBLE_STATUSES } } as const;

/** Lead claim first: the card badge must describe the claim the reader sees. */
const cardSelect = {
  slug: true,
  headline: true,
  oneSentenceSummary: true,
  topic: true,
  readingTimeMinutes: true,
  lastUpdated: true,
  version: true,
  isDeveloping: true,
  heroImageUrl: true,
  heroImageCaption: true,
  claims: {
    select: { status: true },
    orderBy: { createdAt: "asc" as const },
  },
  sources: {
    select: {
      id: true,
      url: true,
      title: true,
      author: true,
      publishedAt: true,
      retrievedAt: true,
      snippet: true,
      sourcingGroup: true,
      sharedSourceLabel: true,
      publisher: {
        select: { id: true, name: true, domain: true, tier: true, country: true },
      },
    },
    orderBy: { publishedAt: "asc" as const },
  },
  // Only corrections are counted for a card; ordinary updates are dossier-only.
  updates: { where: { kind: "CORRECTION" as const }, select: { id: true } },
} as const;

type CardRow = Awaited<
  ReturnType<typeof prisma.story.findFirstOrThrow<{ select: typeof cardSelect }>>
>;

function toCard(row: CardRow): StoryCardData {
  return {
    slug: row.slug,
    headline: row.headline,
    oneSentenceSummary: row.oneSentenceSummary,
    topic: row.topic,
    readingTimeMinutes: row.readingTimeMinutes,
    lastUpdated: row.lastUpdated.toISOString(),
    version: row.version,
    isDeveloping: row.isDeveloping,
    heroImageUrl: row.heroImageUrl ?? undefined,
    heroImageCaption: row.heroImageCaption ?? undefined,
    sources: row.sources.map((source) => ({
      id: source.id,
      url: source.url,
      title: source.title,
      author: source.author ?? undefined,
      publishedAt: source.publishedAt.toISOString(),
      retrievedAt: source.retrievedAt.toISOString(),
      snippet: source.snippet ?? undefined,
      sourcingGroup: source.sourcingGroup ?? undefined,
      sharedSourceLabel: source.sharedSourceLabel ?? undefined,
      publisher: {
        id: source.publisher.id,
        name: source.publisher.name,
        domain: source.publisher.domain,
        tier: source.publisher.tier,
        country: source.publisher.country ?? undefined,
      },
    })),
    claimStatuses: row.claims.map((claim: Pick<Claim, "status">) => claim.status),
    correctionCount: row.updates.length,
  };
}


export interface CardQuery {
  topic?: StoryTopic;
  limit?: number;
  offset?: number;
  excludeSlug?: string;
}

function cardWhere(query: CardQuery) {
  return {
    ...visible,
    ...(query.topic ? { topic: query.topic } : {}),
    ...(query.excludeSlug ? { slug: { not: query.excludeSlug } } : {}),
  };
}

/** Newest first, developing stories weighted up — the same order as the web feed. */
export async function getStoryCards(
  query: CardQuery = {}
): Promise<StoryCardData[]> {
  const rows = await prisma.story.findMany({
    where: cardWhere(query),
    select: cardSelect,
    orderBy: [{ isDeveloping: "desc" }, { lastUpdated: "desc" }],
    take: query.limit ?? 10,
    skip: query.offset ?? 0,
  });
  return rows.map(toCard);
}

export async function countStoryCards(
  query: Pick<CardQuery, "topic"> = {}
): Promise<number> {
  return prisma.story.count({ where: cardWhere(query) });
}

/** One card by slug — what a deep link resolves to before the dossier loads. */
export async function getStoryCardBySlug(
  slug: string
): Promise<StoryCardData | null> {
  const row = await prisma.story.findFirst({
    where: { slug, ...visible },
    select: cardSelect,
  });
  return row ? toCard(row) : null;
}

/**
 * Cards for explicit slugs, in the ORDER given. Bookmarks are newest-saved-first
 * and the Saved screen must not reshuffle them; an unpublished slug drops out
 * rather than erroring, mirroring the web `/saved` behaviour.
 */
export async function getStoryCardsBySlugs(
  slugs: string[]
): Promise<StoryCardData[]> {
  if (slugs.length === 0) return [];
  const rows = await prisma.story.findMany({
    where: { slug: { in: slugs }, ...visible },
    select: cardSelect,
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((row): row is CardRow => row !== undefined)
    .map(toCard);
}

/** Topic siblings for a story's "related" strip. */
export async function getRelatedCards(
  topic: StoryTopic,
  limit = 4,
  excludeSlug?: string
): Promise<StoryCardData[]> {
  return getStoryCards({ topic, limit, excludeSlug });
}

/**
 * Search published stories only. Claims and publisher names are matched so a
 * reader can find a story by what was actually said, not only by the headline —
 * but an ingested candidate is never an answer, because it is not a story yet.
 */
export async function searchStoryCards(
  term: string,
  query: CardQuery = {}
): Promise<StoryCardData[]> {
  const trimmed = term.trim();
  if (!trimmed) return getStoryCards(query);
  const rows = await prisma.story.findMany({
    where: {
      ...cardWhere(query),
      OR: [
        { headline: { contains: trimmed, mode: "insensitive" } },
        { oneSentenceSummary: { contains: trimmed, mode: "insensitive" } },
        { whatHappened: { contains: trimmed, mode: "insensitive" } },
        { whyItMatters: { contains: trimmed, mode: "insensitive" } },
        {
          claims: {
            some: { statement: { contains: trimmed, mode: "insensitive" } },
          },
        },
        {
          sources: {
            some: {
              publisher: { name: { contains: trimmed, mode: "insensitive" } },
            },
          },
        },
        {
          sources: {
            some: { title: { contains: trimmed, mode: "insensitive" } },
          },
        },
      ],
    },
    select: cardSelect,
    orderBy: [{ isDeveloping: "desc" }, { lastUpdated: "desc" }],
    take: query.limit ?? 20,
    skip: query.offset ?? 0,
  });
  return rows.map(toCard);
}

/** Per-topic publishable counts, for the topic picker and For You suggestions. */
export async function getTopicCounts(): Promise<
  { topic: StoryTopic; storyCount: number }[]
> {
  const rows = await prisma.story.groupBy({
    by: ["topic"],
    where: visible,
    _count: { _all: true },
    orderBy: { topic: "asc" },
  });
  return rows.map((row) => ({
    topic: row.topic as StoryTopic,
    storyCount: row._count._all,
  }));
}
