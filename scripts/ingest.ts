/**
 * Ingestion CLI: poll news feeds and store article CANDIDATES.
 *
 * Nothing published or curated happens here. Rows land in IngestedItem as
 * candidates; promoting one into a dossier is a separate, deliberate act, and
 * the publish gate never reads these tables.
 *
 *   pnpm ingest          live run over the database registry (writes rows)
 *   pnpm ingest:dry      fetch + normalise, report, write nothing
 *
 * Flags:
 *   --limit N        entries read per feed (default 50)
 *   --age-days N     drop entries older than N days (default 21)
 *   --timeout MS     network budget per feed (default 15000)
 *   --feed URL       poll only these feeds (repeatable)
 *   --add-feed URL   trial one new publisher for this run; needs
 *                    --publisher NAME --domain DOMAIN --topic TOPIC
 *
 * `ingest:dry` needs no database: without a reachable Postgres it still fetches
 * and parses, and simply reports every entry as new.
 */
import { existsSync } from "node:fs";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { runIngestion } from "../src/lib/ingest/pipeline";
import { loadEnabledFeeds, syncFeedRegistry } from "../src/lib/ingest/store";
import { DEFAULT_FEEDS } from "../src/lib/ingest/feeds.config";
import type { FeedConfig, IngestRunReport } from "../src/lib/ingest/types";
import type { StoryTopic } from "../src/types/story";

// tsx scripts must load .env themselves; only the Prisma CLI does it
// automatically, via prisma.config.ts.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const TOPICS: StoryTopic[] = [
  "UK",
  "World",
  "Technology",
  "Science",
  "Business",
  "Climate",
  "Sport",
  "Culture",
  "Health",
  "Education",
];

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");

function valueAfter(flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** Repeatable flag: `--feed a --feed b` -> ["a", "b"]. */
function valuesAfter(flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) values.push(argv[i + 1]);
  }
  return values;
}

function numberAfter(flag: string): number | undefined {
  const raw = valueAfter(flag);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`${flag} expects a non-negative number, got "${raw}"`);
    process.exit(2);
  }
  return parsed;
}

const only = valuesAfter("--feed");

// One-off publisher trial, so evaluating a feed is a command rather than a
// code change. It is registered like any other feed, then reviewed in the log.
const addUrl = valueAfter("--add-feed");
let extraFeed: FeedConfig | undefined;
if (addUrl) {
  const publisherName = valueAfter("--publisher");
  const publisherDomain = valueAfter("--domain");
  const topic = valueAfter("--topic") as StoryTopic | undefined;
  if (!publisherName || !publisherDomain || !topic || !TOPICS.includes(topic)) {
    console.error(
      `--add-feed needs --publisher, --domain and --topic (one of: ${TOPICS.join(", ")})`
    );
    process.exit(2);
  }
  extraFeed = {
    label: `${publisherName} — ${topic}`,
    feedUrl: addUrl,
    publisherName,
    publisherDomain,
    topic,
  };
}

/** undefined means "whatever the registry has enabled". */
async function selectFeeds(
  prisma: PrismaClient | null
): Promise<FeedConfig[] | undefined> {
  // An explicitly trialled feed runs alone, whether or not there is a database.
  if (extraFeed && only.length === 0) return [extraFeed];

  const registry = prisma ? await loadEnabledFeeds(prisma) : [];
  // A dry run registers nothing, so before the first live run the registry is
  // empty: fall back to the code list rather than reporting "0 feeds". A LIVE
  // run must not — an empty registry there means the operator disabled every
  // feed, and re-enabling them from code would override a deliberate decision.
  const pool = registry.length > 0 ? registry : dryRun ? DEFAULT_FEEDS : registry;
  return only.length > 0
    ? pool.filter((feed) => only.includes(feed.feedUrl))
    : pool;
}

/**
 * A dry run PREFERS a real database, because dedupe against existing rows is the
 * most useful thing it can report. But a missing database is not an error there,
 * which is what makes `ingest:dry` usable offline and in CI.
 */
async function connect(): Promise<PrismaClient | null> {
  if (!process.env.DATABASE_URL) {
    if (!dryRun) {
      console.error(
        "DATABASE_URL is not set. A live run needs a database; use `pnpm ingest:dry` for a read-only pass."
      );
      process.exit(2);
    }
    return null;
  }

  const client = new PrismaClient();
  if (!dryRun) {
    await client.$connect();
    return client;
  }
  try {
    await client.$connect();
    return client;
  } catch {
    await client.$disconnect();
    console.log("note: database unreachable — dry run reports every entry as new");
    return null;
  }
}

function printSummary(report: IngestRunReport): void {
  const codes = new Map<string, number>();
  for (const feed of report.feeds) {
    for (const rejection of feed.rejections) {
      codes.set(rejection.code, (codes.get(rejection.code) ?? 0) + 1);
    }
  }

  const totals = report.totals;
  console.log(
    `\n${report.feeds.length} feeds (${totals.ok} ok, ${totals.failed} failed) — ` +
      `${totals.discovered} entries: ${totals.stored} new, ${totals.duplicates} known, ` +
      `${totals.updated} updated, ${totals.rejected} refused`
  );
  if (codes.size > 0) {
    const breakdown = [...codes.entries()]
      .map(([code, count]) => `${code} ${count}`)
      .join(", ");
    console.log(`refusals: ${breakdown}`);
  }
  if (report.dryRun) console.log("\nDRY RUN — nothing was written.");
}

async function main(): Promise<number> {
  const prisma = await connect();
  try {
    if (prisma && !dryRun) {
      // Idempotent, and it never overwrites curated publisher data, so syncing
      // on every live run keeps the registry equal to the code list. A dry run
      // skips it entirely: registering feeds is a write, and dry means no write.
      await syncFeedRegistry(prisma);
      if (extraFeed) await syncFeedRegistry(prisma, [extraFeed]);
    }

    const feeds = await selectFeeds(prisma);
    if (feeds && feeds.length === 0) {
      console.error(
        "nothing to poll: no feed matched --feed, or every registered feed is disabled"
      );
      return 2;
    }

    const report = await runIngestion({
      prisma,
      feeds,
      dryRun,
      maxItemsPerFeed: numberAfter("--limit"),
      maxAgeDays: numberAfter("--age-days"),
      timeoutMs: numberAfter("--timeout"),
      log: (message) => console.log(message),
    });

    printSummary(report);
    // Non-zero only when the run achieved NOTHING: one dead feed must not fail a
    // scheduled job that stored 40 articles from the other feeds.
    return report.feeds.length > 0 && report.totals.ok === 0 ? 1 : 0;
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

main().then(
  (code) => {
    // Never force-exit while handles are open: on Windows that trips a libuv
    // assertion (src/win/async.c) and prints a crash after a successful run.
    // Success just lets the loop drain; failures defer one tick so Prisma's
    // teardown can finish before the process is killed.
    if (code === 0) return;
    setTimeout(() => process.exit(code), 0);
  },
  (error) => {
    console.error(
      `\ningest failed: ${error instanceof Error ? error.message : String(error)}`
    );
    setTimeout(() => process.exit(1), 0);
  }
);
