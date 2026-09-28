/**
 * Persistence for the ingestion pipeline.
 *
 * This is the ONLY module under src/lib/ingest that touches the database, and
 * the only tables it writes are Publisher (idempotent upsert), IngestFeed and
 * IngestedItem. It never writes Story / Claim / PrimaryEvidence / ArticleSource
 * / SourceQuote: an ingested row is a CANDIDATE, and promoting one into a
 * dossier is a separate, deliberate act. ingest.test.ts fails the suite
 * if that boundary is ever crossed.
 *
 * Every write below serves ONE of two run modes, and only one:
 *   - live  => persist is true  => writes happen;
 *   - dry   => persist is false => nothing in this file may be reached.
 * The caller (pipeline.ts) enforces that split before dispatching here, and
 * the registry sync in scripts/ingest.ts is skipped outright on dry runs,
 * so "DRY RUN - nothing was written" is a structural property, not a hope.
 * ingest.test.ts pins the enforcement points rather than every query.
 *
 * There is deliberately no run-ledger table. Per-feed outcomes are returned to
 * the caller and printed, matching how gate-check.ts and the stance check
 * already report, and IngestFeed keeps the last outcome for a quick glance.
 */
import type { PrismaClient } from "@prisma/client";
import type { StoryTopic } from "@/types/story";
import { DEFAULT_FEEDS, DEFAULT_MAX_AGE_DAYS } from "./feeds.config";
import { sha256 } from "./text";
import type {
  FeedConfig,
  FeedRunOutcome,
  IngestedArticle,
  RejectedArticle,
} from "./types";

/**
 * A publisher seen for the first time has never been vetted by us, so it is
 * stored as SECONDARY_TIER2 â€” never PRIMARY, which would let one careless
 * feed addition launder an unvetted outlet past the gate's primary rule.
 */
const DISCOVERED_PUBLISHER_TIER = "SECONDARY_TIER2";

/** A hostile or broken feed must not bloat the table with refusal rows. */
export const MAX_REJECTIONS_PER_FEED = 25;

/** A feed row joined with its publisher, ready to drive fetch + normalise. */
export interface FeedRecord extends FeedConfig {
  id: string;
  etag: string | null;
  lastModified: string | null;
}

async function ensurePublisher(
  prisma: PrismaClient,
  feed: FeedConfig,
  cache: Map<string, string>
): Promise<string> {
  const cached = cache.get(feed.publisherDomain);
  if (cached) return cached;

  const existing = await prisma.publisher.findUnique({
    where: { domain: feed.publisherDomain },
  });
  // An existing publisher is curated data: its name, country and TIER stay
  // exactly as a human set them, whatever the feed config claims.
  const id = existing
    ? existing.id
    : (
        await prisma.publisher.create({
          data: {
            name: feed.publisherName,
            domain: feed.publisherDomain,
            tier: DISCOVERED_PUBLISHER_TIER,
          },
        })
      ).id;

  cache.set(feed.publisherDomain, id);
  return id;
}

/**
 * Register the code-declared feeds in the database. Idempotent, and `enabled`
 * is deliberately NOT written on update: disabling a noisy feed is an operator
 * decision that a redeploy must not silently undo.
 */
export async function syncFeedRegistry(
  prisma: PrismaClient,
  feeds: FeedConfig[] = DEFAULT_FEEDS
): Promise<void> {
  const cache = new Map<string, string>();
  for (const feed of feeds) {
    const publisherId = await ensurePublisher(prisma, feed, cache);
    await prisma.ingestFeed.upsert({
      where: { feedUrl: feed.feedUrl },
      create: { feedUrl: feed.feedUrl, publisherId, topic: feed.topic },
      update: { publisherId, topic: feed.topic },
    });
  }
}

/**
 * The run iterates the DATABASE registry, not the code list, so an operator can
 * add or disable a feed with SQL and no deploy.
 */
export async function loadEnabledFeeds(
  prisma: PrismaClient,
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS
): Promise<FeedRecord[]> {
  const rows = await prisma.ingestFeed.findMany({
    where: { enabled: true },
    include: { publisher: { select: { name: true, domain: true } } },
    orderBy: { feedUrl: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    feedUrl: row.feedUrl,
    publisherName: row.publisher.name,
    publisherDomain: row.publisher.domain,
    label: `${row.publisher.name} â€” ${row.topic}`,
    topic: row.topic as StoryTopic,
    maxAgeDays,
    etag: row.etag,
    lastModified: row.lastModified,
  }));
}

/** feedUrl -> IngestFeed.id, so a caller-supplied feed list can be persisted. */
export async function resolveFeedIds(
  prisma: PrismaClient,
  urls: string[]
): Promise<Map<string, string>> {
  if (urls.length === 0) return new Map();
  const rows = await prisma.ingestFeed.findMany({
    where: { feedUrl: { in: urls } },
    select: { id: true, feedUrl: true },
  });
  return new Map(rows.map((row) => [row.feedUrl, row.id]));
}

/** What the database says should happen to a candidate. */
export type ItemDisposition = "new" | "duplicate" | "updated" | "reinstated";

/**
 * The decision, split from writing it so a dry run can report exactly what a
 * real run would do without touching a row.
 *
 * `reinstated` exists because a retracted row that becomes valid again must not
 * stay hidden: it would otherwise look like the item vanished.
 */
export function classifyDisposition(
  existing: {
    status: string;
    contentHash: string;
  } | null,
  candidate: { contentHash: string }
): ItemDisposition {
  if (!existing) return "new";
  if (existing.contentHash !== candidate.contentHash) return "updated";
  if (existing.status !== "STORED") return "reinstated";
  return "duplicate";
}

/**
 * Insert one candidate, or touch the existing row. Returns the disposition so
 * the run can report "4 new, 2 dupes, 1 updated" instead of a bare count.
 *
 * Two writers can race the same URL (a manual run and a scheduled one). The
 * unique index is the arbiter: on P2002 we re-read and apply the same rules, so
 * a collision degrades into a duplicate rather than a crash.
 */
export async function storeArticle(
  prisma: PrismaClient,
  params: {
    feedId: string;
    topic: StoryTopic;
    article: IngestedArticle;
    fetchedAt: Date;
  }
): Promise<ItemDisposition> {
  const { article, feedId, topic, fetchedAt } = params;
  const existing = await prisma.ingestedItem.findUnique({
    where: { url: article.url },
    select: { id: true, status: true, contentHash: true },
  });

  let disposition = classifyDisposition(existing, article);

  if (existing && disposition === "duplicate") {
    await prisma.ingestedItem.update({
      where: { id: existing.id },
      data: { lastSeenAt: fetchedAt, seenCount: { increment: 1 } },
    });
    return "duplicate";
  }

  if (existing) {
    // An item that was refused but now validates must be reinstated, not
    // duplicated: the URL is the same fact, and two rows for it would be a lie.
    if (disposition === "updated" && existing.status !== "STORED")
      disposition = "reinstated";
    await prisma.ingestedItem.update({
      where: { id: existing.id },
      data: {
        title: article.title,
        author: article.author,
        excerpt: article.excerpt,
        guid: article.guid,
        topic,
        status: "STORED",
        rejectionCode: null,
        rejectionReason: null,
        publishedAt: article.publishedAt,
        publishedSource: article.publishedSource,
        publishedRaw: article.publishedRaw,
        fetchedAt,
        contentHash: article.contentHash,
        lastSeenAt: fetchedAt,
        seenCount: { increment: 1 },
      },
    });
    return disposition;
  }

  try {
    await prisma.ingestedItem.create({
      data: {
        url: article.url,
        title: article.title,
        author: article.author,
        excerpt: article.excerpt,
        guid: article.guid,
        feedId,
        topic,
        status: "STORED",
        publishedAt: article.publishedAt,
        publishedSource: article.publishedSource,
        publishedRaw: article.publishedRaw,
        fetchedAt,
        contentHash: article.contentHash,
        lastSeenAt: fetchedAt,
      },
    });
    return "new";
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const raced = await prisma.ingestedItem.findUnique({
      where: { url: article.url },
      select: { id: true, status: true, contentHash: true },
    });
    const raceDisposition = classifyDisposition(raced, article);
    if (raced) {
      await prisma.ingestedItem.update({
        where: { id: raced.id },
        data: { lastSeenAt: fetchedAt, seenCount: { increment: 1 } },
      });
    }
    return raceDisposition === "new" ? "duplicate" : raceDisposition;
  }
}

/** Dry-run answer: what would happen to this candidate? Read-only. */
export async function previewDisposition(
  prisma: PrismaClient,
  candidate: { url: string; contentHash: string }
): Promise<ItemDisposition> {
  const existing = await prisma.ingestedItem.findUnique({
    where: { url: candidate.url },
    select: { status: true, contentHash: true },
  });
  if (!existing) return "new";
  const disposition = classifyDisposition(existing, candidate);
  // A stored row whose feed refused it this time is a rejection, not an update.
  return disposition === "updated" && existing.status === "STORED"
    ? "updated"
    : disposition === "updated"
      ? "reinstated"
      : disposition;
}

/**
 * Record WHY an entry never became a candidate, so a run of "42 discovered,
 * 6 stored" is explainable afterwards instead of looking like data loss.
 *
 * A row already STORED is never downgraded: a feed that momentarily drops a
 * title must not destroy metadata we already validated.
 */
export async function storeRejection(
  prisma: PrismaClient,
  params: {
    feedId: string;
    topic: StoryTopic;
    rejection: RejectedArticle;
    fetchedAt: Date;
  }
): Promise<void> {
  const { rejection, feedId, topic, fetchedAt } = params;
  const existing = await prisma.ingestedItem.findUnique({
    where: { url: rejection.url },
    select: { id: true, status: true },
  });
  if (existing?.status === "STORED") return;

  if (existing) {
    await prisma.ingestedItem.update({
      where: { id: existing.id },
      data: {
        status: "REJECTED",
        rejectionCode: rejection.code,
        rejectionReason: rejection.reason.slice(0, 500),
        lastSeenAt: fetchedAt,
        seenCount: { increment: 1 },
      },
    });
    return;
  }

  await prisma.ingestedItem.create({
    data: {
      url: rejection.url,
      title: (rejection.title || "(untitled feed entry)").slice(0, 300),
      feedId,
      topic,
      status: "REJECTED",
      rejectionCode: rejection.code,
      rejectionReason: rejection.reason.slice(0, 500),
      // A refused entry has no verified publication date; the honest value is
      // "when we saw it", and publishedSource says so.
      publishedAt: fetchedAt,
      publishedSource: "FETCHED",
      fetchedAt,
      // Nothing to hash, so the hash records the refusal itself.
      contentHash: sha256(`${rejection.url}\u0000${rejection.code}`),
      lastSeenAt: fetchedAt,
    },
  });
}

/**
 * Persist what one feed taught us: its last outcome and, on a live success, its
 * revalidation tokens.
 *
 * Validators are replaced wholesale — a stale If-None-Match kept forever would
 * make a feed that HAS changed look permanently "not modified". They are written
 * only on a real run, because a dry run that stored ETags would make the next
 * real run skip the feed and store nothing.
 */
export async function saveFeedState(
  prisma: PrismaClient,
  params: {
    feedId: string | null;
    outcome: FeedRunOutcome;
    ranAt: Date;
    saveValidators: boolean;
  }
): Promise<void> {
  const { feedId, outcome, ranAt, saveValidators } = params;
  if (!feedId) return;

  await prisma.ingestFeed
    .update({
      where: { id: feedId },
      data: {
        lastRunAt: ranAt,
        lastStatus: outcome.status,
        lastError: outcome.error?.slice(0, 2000) ?? null,
        ...(saveValidators
          ? {
              etag: outcome.etag ?? null,
              lastModified: outcome.lastModified ?? null,
            }
          : {}),
      },
    })
    // A bookkeeping failure must never mask the real outcome of the run.
    .catch(() => undefined);
}




