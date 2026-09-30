/**
 * Orchestration: fetch -> parse -> normalise -> store, one feed at a time.
 *
 * One feed failing must never abort the run: every problem is captured on that
 * feed's outcome (status + reason + counts), printed as the run progresses, and
 * reflected in IngestFeed's last-status columns, while the remaining feeds are
 * still fetched. So runIngestion resolves except for a storage-layer fault,
 * which is rethrown AFTER the feed's state is saved — the evidence trail
 * outranks a clean stack trace.
 */
import type { PrismaClient } from "@prisma/client";
import { fetchFeed } from "./fetch";
import { looksLikeFeed, parseFeed } from "./feeds";
import { DEFAULT_FEEDS, DEFAULT_MAX_AGE_DAYS } from "./feeds.config";
import { dedupeWithinFeed, normaliseArticle } from "./normalise";
import {
  MAX_REJECTIONS_PER_FEED,
  loadEnabledFeeds,
  previewDisposition,
  resolveFeedIds,
  saveFeedState,
  storeArticle,
  storeRejection,
  type FeedRecord,
} from "./store";
import type {
  FeedConfig,
  FeedRunOutcome,
  FetchFeedOptions,
  FetchResult,
  IngestRunReport,
  IngestedArticle,
  ParsedFeed,
  RejectedArticle,
} from "./types";

/** Feeds can carry 150 entries; a first sweep does not need them all. */
export const DEFAULT_MAX_ITEMS_PER_FEED = 50;

export interface IngestOptions {
  /** Omitted or null => fetch + normalise only, nothing written (dry run). */
  prisma?: PrismaClient | null;
  /** Explicit feeds to poll. Defaults to the enabled rows in the registry. */
  feeds?: FeedConfig[];
  dryRun?: boolean;
  maxItemsPerFeed?: number;
  maxAgeDays?: number;
  timeoutMs?: number;
  /** Inject the clock so tests are deterministic. */
  now?: () => Date;
  log?: (message: string) => void;
  /** Injectable for tests: swap the network without a mock HTTP server. */
  fetcher?: (options: FetchFeedOptions) => Promise<FetchResult>;
}

const NOOP = (): undefined => undefined;

/**
 * Which feeds to poll. Without a database there is nothing to register, so a
 * dry run falls back to the code-declared list — which is what makes
 * `pnpm ingest:dry` runnable offline.
 */
async function resolveFeeds(
  prisma: PrismaClient | null,
  options: IngestOptions
): Promise<FeedConfig[]> {
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  if (options.feeds) {
    return options.feeds.map((feed) => ({ ...feed, maxAgeDays: feed.maxAgeDays ?? maxAgeDays }));
  }
  if (prisma) return loadEnabledFeeds(prisma, maxAgeDays);
  return DEFAULT_FEEDS.map((feed) => ({ ...feed, maxAgeDays }));
}

export async function runIngestion(options: IngestOptions = {}): Promise<IngestRunReport> {
  const prisma = options.prisma ?? null;
  const dryRun = options.dryRun ?? prisma === null;
  const persist = !dryRun && prisma !== null;
  const now = options.now ?? (() => new Date());
  const log = options.log ?? NOOP;
  const fetcher = options.fetcher ?? fetchFeed;
  const startedAt = now();

  const feeds = await resolveFeeds(prisma, options);
  const feedIds =
    persist && prisma ? await resolveFeedIds(prisma, feeds.map((feed) => feed.feedUrl)) : null;

  const outcomes: FeedRunOutcome[] = [];
  for (const feed of feeds) {
    const feedId = feedIds ? feedIds.get(feed.feedUrl) ?? null : null;
    log(`${feed.label} — ${feed.feedUrl}`);
    const outcome = await processFeed({
      feed,
      feedId,
      prisma,
      persist,
      fetcher,
      maxItems: options.maxItemsPerFeed ?? DEFAULT_MAX_ITEMS_PER_FEED,
      maxAgeDays: options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS,
      timeoutMs: options.timeoutMs,
      now,
      log,
    });
    outcomes.push(outcome);

    if (outcome.status === "FAILED" || outcome.status === "REJECTED") {
      log(`   ${outcome.status.toLowerCase()}: ${outcome.error ?? "no reason recorded"}`);
    }

    if (persist && prisma) {
      // Written even for a failed feed: lastStatus + lastError is how a broken
      // feed becomes visible between runs instead of silently going quiet.
      await saveFeedState(prisma, {
        feedId,
        outcome,
        ranAt: now(),
        // Validators are saved only on a 200; a 304 must keep what we have.
        saveValidators: outcome.status === "OK",
      });
    }
  }

  const totals = outcomes.reduce(
    (accumulator, outcome) => ({
      // Status counts stay distinct (see IngestRunReport.totals): a feed that
      // returned a non-feed body is REJECTED, never "ok".
      ok: accumulator.ok + (outcome.status === "OK" ? 1 : 0),
      notModified: accumulator.notModified + (outcome.status === "NOT_MODIFIED" ? 1 : 0),
      rejected: accumulator.rejected + (outcome.status === "REJECTED" ? 1 : 0),
      failed: accumulator.failed + (outcome.status === "FAILED" ? 1 : 0),
      discovered: accumulator.discovered + outcome.discovered,
      stored: accumulator.stored + outcome.stored,
      duplicates: accumulator.duplicates + outcome.duplicates,
      updated: accumulator.updated + outcome.updated,
      // Item-level refusals (stale, off-topic, duplicate-in-feed…), which is a
      // different number from feeds REJECTED for not being feeds.
      refused: accumulator.refused + outcome.rejected,
    }),
    {
      ok: 0,
      notModified: 0,
      rejected: 0,
      failed: 0,
      discovered: 0,
      stored: 0,
      duplicates: 0,
      updated: 0,
      refused: 0,
    }
  );

  return {
    startedAt,
    finishedAt: now(),
    dryRun,
    feeds: outcomes,
    totals,
  };
}

/**
 * Poll, parse, normalise and store ONE feed.
 *
 * Every failure mode resolves with an outcome instead of throwing: a publisher
 * that returns HTML, or whose DNS is dead, costs this run its own articles,
 * not the other feeds'.
 */
async function processFeed(params: {
  feed: FeedConfig;
  feedId: string | null;
  prisma: PrismaClient | null;
  persist: boolean;
  fetcher: (options: FetchFeedOptions) => Promise<FetchResult>;
  maxItems: number;
  maxAgeDays: number;
  timeoutMs?: number;
  now: () => Date;
  log: (message: string) => void;
}): Promise<FeedRunOutcome> {
  const {
    feed,
    feedId,
    prisma,
    persist,
    fetcher,
    maxItems,
    maxAgeDays,
    timeoutMs,
    now,
    log,
  } = params;
  const startedAt = now().getTime();
  // One clock reading per feed: every row it produces shares the same fetchedAt.
  const fetchedAt = now();

  const finish = (patch: Partial<FeedRunOutcome>): FeedRunOutcome => ({
    feedUrl: feed.feedUrl,
    label: feed.label,
    topic: feed.topic,
    status: "OK",
    durationMs: now().getTime() - startedAt,
    discovered: 0,
    stored: 0,
    duplicates: 0,
    updated: 0,
    rejected: 0,
    rejections: [],
    ...patch,
  });

  // Revalidation tokens live on the registry row, so only DB-loaded feeds can
  // send If-None-Match; an ad-hoc feed always does a full fetch.
  const cached = feedId && "etag" in feed ? (feed as FeedRecord) : null;

  let result: FetchResult;
  try {
    result = await fetcher({
      url: feed.feedUrl,
      etag: cached?.etag ?? null,
      lastModified: cached?.lastModified ?? null,
      timeoutMs,
    });
  } catch (error) {
    return finish({
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (result.kind === "not-modified") {
    log("   304 not modified");
    return finish({ status: "NOT_MODIFIED", httpStatus: result.httpStatus });
  }
  if (result.kind === "rejected") {
    return finish({
      status: "REJECTED",
      httpStatus: result.httpStatus,
      error: `${result.httpStatus} ${result.contentType}: ${result.reason}`,
    });
  }
  if (result.kind === "error") {
    return finish({
      status: "FAILED",
      httpStatus: result.httpStatus,
      error: result.reason,
    });
  }
  // A captive-portal or error page served as 200 text/html still is not a feed.
  if (!looksLikeFeed(result.body)) {
    return finish({
      status: "REJECTED",
      httpStatus: result.httpStatus,
      error: "response body is not RSS / Atom / RDF",
    });
  }

  let parsed: ParsedFeed;
  try {
    parsed = parseFeed(result.body, feed.feedUrl, maxItems);
  } catch (error) {
    return finish({
      status: "FAILED",
      httpStatus: result.httpStatus,
      error: `parse: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const rejections: RejectedArticle[] = [];
  const candidates: IngestedArticle[] = [];
  for (const item of parsed.items) {
    const outcome = normaliseArticle(item, feed, { now: fetchedAt, maxAgeDays });
    if (outcome.ok) candidates.push(outcome.article);
    else rejections.push(outcome.rejection);
  }

  // The same URL twice inside one feed: keep the first, record the rest.
  const deduped = dedupeWithinFeed(candidates);
  rejections.push(...deduped.duplicates);

  let stored = 0;
  let unchanged = 0;
  let updated = 0;
  for (const article of deduped.kept) {
    if (persist && prisma && feedId) {
      const disposition = await storeArticle(prisma, {
        feedId,
        topic: feed.topic,
        article,
        fetchedAt,
      });
      if (disposition === "new") stored += 1;
      else if (disposition === "duplicate") unchanged += 1;
      // "updated" and "reinstated" both rewrite a row, so both count as updated.
      else updated += 1;
    } else if (prisma) {
      // No registry row (or a dry run): report what WOULD happen, write nothing.
      const disposition = await previewDisposition(prisma, article);
      if (disposition === "new") stored += 1;
      else if (disposition === "duplicate") unchanged += 1;
      else updated += 1;
    } else {
      // Offline dry run: nothing to compare against, so everything is new.
      stored += 1;
    }
  }

  if (persist && prisma && feedId) {
    // Capped: a feed that returns 150 junk entries must not write 150 rows.
    for (const rejection of rejections.slice(0, MAX_REJECTIONS_PER_FEED)) {
      await storeRejection(prisma, {
        feedId,
        topic: feed.topic,
        rejection,
        fetchedAt,
      });
    }
  }

  log(
    `   ${parsed.items.length} entries -> ${stored} new, ${unchanged} seen, ` +
      `${updated} updated, ${rejections.length} refused`
  );

  return finish({
    status: "OK",
    httpStatus: result.httpStatus,
    etag: result.etag,
    lastModified: result.lastModified,
    discovered: parsed.items.length,
    stored,
    duplicates: unchanged,
    updated,
    rejected: rejections.length,
    rejections,
  });
}

