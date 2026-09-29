/**
 * Story data access. The ONLY place the reader UI talks to the database.
 *
 * Queries live here so pages stay thin, status filtering happens in one place
 * (READER_VISIBLE_STATUSES — a CANDIDATE or ARCHIVED row is never visible),
 * and Prisma rows are mapped to the shared `Story` shape exactly once. Stance
 * labels are resolved through resolveStance on this READ path too, mirroring
 * the seed write path (AGENTS.md).
 */
import { prisma } from "@/lib/prisma";
import { resolveStance } from "@/lib/stance";
import { READER_VISIBLE_STATUSES } from "@/lib/curation/types";
import type { Claim, Story, StoryTopic, TimelineEvent } from "@/types/story";
const visible = { status: { in: READER_VISIBLE_STATUSES } } as const;

const storyInclude = {
  claims: {
    include: { primaryEvidence: true, corroborating: true, disputing: true },
    orderBy: { createdAt: "asc" },
  },
  sources: { include: { publisher: true }, orderBy: { publishedAt: "asc" } },
  timeline: { orderBy: { timestamp: "asc" } },
  stanceItems: { include: { points: true }, orderBy: { createdAt: "asc" } },
  updates: { orderBy: { timestamp: "desc" } },
} as const;

type StoryRow = Awaited<
  ReturnType<typeof prisma.story.findFirstOrThrow<{ include: typeof storyInclude }>>
>;

function toClaim(row: StoryRow["claims"][number]): Claim {
  return {
    id: row.id,
    statement: row.statement,
    status: row.status,
    confidenceScore: row.confidenceScore,
    explanation: row.explanation,
    claimType: row.claimType,
    claimant: row.claimant,
    primaryEvidence: row.primaryEvidence.map((ev) => ({
      id: ev.id,
      title: ev.title,
      url: ev.url ?? undefined,
      documentType: ev.documentType,
      issuingBody: ev.issuingBody,
      summary: ev.summary,
      date: ev.date ?? undefined,
      excerpt: ev.excerpt ?? undefined,
    })),
    corroboratingSources: row.corroborating.map((q) => ({
      publisherName: q.publisherName,
      url: q.url,
      quote: q.quote,
    })),
    disputingSources:
      row.disputing.length > 0
        ? row.disputing.map((q) => ({
          publisherName: q.publisherName,
          url: q.url,
          quote: q.quote,
          disputeReason: q.disputeReason,
        }))
        : undefined,
    lastVerified: row.lastVerified.toISOString(),
  };
}

function toStory(row: StoryRow, relatedStoryIds: string[] = []): Story {
  const timeline: TimelineEvent[] = row.timeline.map((event) => ({
    id: event.id,
    timestamp: event.timestamp.toISOString(),
    displayTime: event.displayTime,
    eventText: event.eventText,
    sourceUrl: event.sourceUrl ?? undefined,
    sourceName: event.sourceName ?? undefined,
  }));

  return {
    id: row.id,
    slug: row.slug,
    headline: row.headline,
    oneSentenceSummary: row.oneSentenceSummary,
    heroImageUrl: row.heroImageUrl ?? undefined,
    heroImageCaption: row.heroImageCaption ?? undefined,
    topic: row.topic,
    readingTimeMinutes: row.readingTimeMinutes,
    lastUpdated: row.lastUpdated.toISOString(),
    version: row.version,
    isDeveloping: row.isDeveloping,
    whatHappened: row.whatHappened,
    whyItMatters: row.whyItMatters,
    whatWeKnow: row.whatWeKnow,
    whatIsUnclear: row.whatIsUnclear,
    sourcesAgreeOn: row.sourcesAgreeOn,
    whereSourcesDiffer: row.stanceItems.map((item) => ({
      id: item.id,
      topic: item.topic,
      points: item.points.map((point) => ({
        sourceName: point.sourceName,
        reporting: point.reporting,
        // Read path resolves stance, never defaults it (AGENTS.md).
        stance: resolveStance(point),
      })),
    })),
    claims: row.claims.map(toClaim),
    timeline,
    primaryEvidence: row.claims.flatMap((claim) =>
      toClaim(claim).primaryEvidence
    ),
    sources: row.sources.map((source) => ({
      id: source.id,
      url: source.url,
      title: source.title,
      author: source.author ?? undefined,
      publishedAt: source.publishedAt.toISOString(),
      retrievedAt: source.retrievedAt.toISOString(),
      snippet: source.snippet ?? undefined,
      publisher: {
        id: source.publisher.id,
        name: source.publisher.name,
        domain: source.publisher.domain,
        tier: source.publisher.tier,
        country: source.publisher.country ?? undefined,
      },
    })),
    updates: row.updates.map((update) => ({
      id: update.id,
      timestamp: update.timestamp.toISOString(),
      whatChanged: update.whatChanged,
      reason: update.reason ?? undefined,
    })),
    relatedStoryIds,
  };
}

/** Newest published stories, optionally filtered to one topic. */
export async function getPublishedStories(options?: {
  topic?: StoryTopic;
  limit?: number;
  offset?: number;
}): Promise<Story[]> {
  const rows = await prisma.story.findMany({
    where: { ...visible, ...(options?.topic ? { topic: options.topic } : {}) },
    include: storyInclude,
    orderBy: [{ isDeveloping: "desc" }, { lastUpdated: "desc" }],
    take: options?.limit ?? 30,
    skip: options?.offset ?? 0,
  });
  return rows.map((row) => toStory(row));
}

export async function countPublishedStories(): Promise<number> {
  return prisma.story.count({ where: visible });
}

export async function getStoriesByTopic(
  topic: StoryTopic,
  limit = 20
): Promise<Story[]> {
  return getPublishedStories({ topic, limit });
}

/** One story with the full dossier: claims, evidence, timeline, sources. */
export async function getStoryBySlug(slug: string): Promise<Story | null> {
  const row = await prisma.story.findFirst({
    where: { slug, ...visible },
    include: storyInclude,
  });
  if (!row) return null;
  // Related stories are fetched separately (getRelatedStories) so the dossier
  // query stays one round trip; the ids are filled by the caller.
  return toStory(row);
}

/** Topic siblings for the "related stories" strip (same topic, newest first). */
export async function getRelatedStories(
  story: Story,
  limit = 3
): Promise<Story[]> {
  const rows = await prisma.story.findMany({
    where: { ...visible, topic: story.topic, slug: { not: story.slug } },
    include: storyInclude,
    orderBy: { lastUpdated: "desc" },
    take: limit,
  });
  return rows.map((row) => toStory(row));
}

/**
 * Real database search: headline, summary, narrative, claim statements,
 * publisher names and topic. Returns STORIES (never raw articles) — an
 * ingested candidate is not an answer to a reader's question.
 */
export async function searchStories(
  query: string,
  options?: { topic?: StoryTopic; limit?: number }
): Promise<Story[]> {
  const term = query.trim();
  if (!term) return getPublishedStories({ topic: options?.topic, limit: options?.limit });
  const rows = await prisma.story.findMany({
    where: {
      ...visible,
      ...(options?.topic ? { topic: options.topic } : {}),
      OR: [
        { headline: { contains: term, mode: "insensitive" } },
        { oneSentenceSummary: { contains: term, mode: "insensitive" } },
        { whatHappened: { contains: term, mode: "insensitive" } },
        { whyItMatters: { contains: term, mode: "insensitive" } },
        { claims: { some: { statement: { contains: term, mode: "insensitive" } } } },
        { sources: { some: { publisher: { name: { contains: term, mode: "insensitive" } } } } },
        { sources: { some: { title: { contains: term, mode: "insensitive" } } } },
      ],
    },
    include: storyInclude,
    orderBy: { lastUpdated: "desc" },
    take: options?.limit ?? 20,
  });
  return rows.map((row) => toStory(row));
}

/** Most recently updated, weighted a little by how many outlets chased it. */
export async function getTrendingStories(limit = 5): Promise<Story[]> {
  const rows = await prisma.story.findMany({
    where: visible,
    include: { ...storyInclude, _count: { select: { sources: true } } },
    orderBy: [{ isDeveloping: "desc" }, { lastUpdated: "desc" }],
    take: 30,
  });
  const ranked = rows
    .map((row) => toStory(row))
    .sort((a, b) => {
      const sources = b.sources.length - a.sources.length;
      if (sources !== 0) return sources;
      return Date.parse(b.lastUpdated) - Date.parse(a.lastUpdated);
    });
  return ranked.slice(0, limit);
}

