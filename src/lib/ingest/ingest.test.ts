import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runIngestion } from "./pipeline";
import type { FeedConfig } from "./types";

const INGEST_DIR = path.join(process.cwd(), "src", "lib", "ingest");
const CURATED_MODELS = ["Story", "Claim", "PrimaryEvidence"] as const;
// Only INGEST-run vocabulary may appear: the per-feed outcome report and its
// totals. What must NEVER reappear is a run TABLE (a Prisma model or a table
// name in a query) or a promotion BACK-POINTER (a column linking a candidate
// to a curated row). Checked literally, one term per element so no test name
// or comment can trip the matcher.
const LEDGER_TABLE_TERMS = [
  "model Ingest" + "Run",
  "prisma.ingest" + "Run",
  "ingest" + "Run" + "Feed",
  "Run" + "Ledger",
] as const;
const PROMOTION_POINTER_TERMS = [
  "promoted" + "StoryId",
  "last" + "RunId",
] as const;

// Regression risk it guards: an uncommitted diff against main that shows
// "adds the ingestion tables twice" is exactly how duplicates become
// migration conflicts or double-written rows. Fail loudly instead.
describe("ingest architecture", () => {
  const files = fs
    .readdirSync(INGEST_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(INGEST_DIR, name), "utf8"),
    }));

  it("defines each ingest model exactly once in the schema", () => {
    const schema = fs.readFileSync(
      path.join(process.cwd(), "prisma", "schema.prisma"),
      "utf8"
    );
    for (const model of ["IngestFeed", "IngestedItem"]) {
      const count = (
        schema.match(new RegExp(`^model\\s+${model}\\s*\\{`, "gm")) ?? []
      ).length;
      assert.equal(count, 1, `schema declares ${model} ${count} times`);
    }
  });

  it("ingest code never writes the curated Story/Claim graph", () => {
    for (const { name, source } of files) {
      for (const model of CURATED_MODELS) {
        const access = new RegExp(
          `prisma\\.${model[0].toLowerCase()}${model.slice(1)}\\s*\\.`
        );
        assert.ok(
          !access.test(source),
          `${name} must not write ${model} (staging layer is read-only there)`
        );
      }
    }
  });

  it("keeps the no-ledger design: no run tables, no promotion back-pointers", () => {
    const schema = fs.readFileSync(
      path.join(process.cwd(), "prisma", "schema.prisma"),
      "utf8"
    );
    // A run TABLE would be a Prisma model or a referenced table name...
    for (const term of LEDGER_TABLE_TERMS) {
      assert.ok(
        !schema.includes(term),
        `schema reintroduces a run table: ${term}`
      );
    }
    // ...and a promotion back-pointer would be a column on IngestedItem.
    for (const term of PROMOTION_POINTER_TERMS) {
      assert.ok(
        !schema.includes(term),
        `schema reintroduces a promotion back-pointer: ${term}`
      );
    }
    for (const { name, source } of files) {
      for (const term of [...LEDGER_TABLE_TERMS, ...PROMOTION_POINTER_TERMS]) {
        assert.ok(
          !source.includes(term),
          `${name} reintroduces the removed ledger concept: ${term}`
        );
      }
      assert.ok(
        !/prisma\.ingestRun[A-Z]/.test(source),
        `${name} queries a run table the schema no longer defines`
      );
      // The per-feed outcome REPORT is the sanctioned replacement vocabulary:
      // totals live there, not in a table. It must still exist exactly once.
      if (name === "types.ts") {
        const reports = (
          source.match(/export interface IngestRunReport/g) ?? []
        ).length;
        assert.equal(
          reports,
          1,
          "types.ts must export IngestRunReport exactly once"
        );
      }
    }
  });

  it("write-capable functions are only reachable through a persist gate", () => {
    // Every store.ts write sits downstream of `persist`, which is
    // `!dryRun && prisma !== null`. The enforcement POINTS are pipeline.ts
    // (chooses persist, skips saveFeedState when false) and scripts/ingest.ts
    // (skips the registry sync when dry). Pin those two decisions: if they
    // move, this test fails and forces a conscious re-review.
    const pipeline = fs.readFileSync(
      path.join(INGEST_DIR, "pipeline.ts"),
      "utf8"
    );
    assert.ok(
      pipeline.includes("const persist = !dryRun && prisma !== null"),
      "pipeline.ts must derive persist as a single dry-run gate"
    );
    // Article rows: persisted only under `persist`, otherwise answered by the
    // read-only previewer. Rejections use the same split one block below.
    assert.ok(
      pipeline.includes("if (persist && prisma && feedId)") &&
        pipeline.includes("await storeArticle(") &&
        pipeline.includes("await previewDisposition("),
      "pipeline.ts must route new/update/duplicate through persist or the " +
        "dry-run previewer — never a bare write"
    );
    // saveFeedState (lastStatus/lastError/validators) is bookkeeping and easy
    // to scatter; it must live behind the same gate.
    assert.ok(
      pipeline.includes("if (persist && prisma)") &&
        pipeline.includes("await saveFeedState("),
      "pipeline.ts must skip feed-state writes when persist is false"
    );
    const cli = fs.readFileSync(
      path.join(process.cwd(), "scripts", "ingest.ts"),
      "utf8"
    );
    assert.ok(
      cli.includes("if (prisma && !dryRun)") &&
        cli.includes("await syncFeedRegistry("),
      "scripts/ingest.ts must skip registry sync on dry runs"
    );
  });
});

const FEEDS: FeedConfig[] = [
  {
    label: "Broken feed",
    feedUrl: "https://broken.example/rss",
    publisherName: "Broken",
    publisherDomain: "broken.example",
    topic: "World",
  },
  {
    label: "Working feed",
    feedUrl: "https://works.example/rss",
    publisherName: "Works",
    publisherDomain: "works.example",
    topic: "UK",
  },
];

const RSS_BODY = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Works</title>
  <item>
    <title>Ministers unveil £2bn flood defence programme</title>
    <link>https://works.example/flood-defences</link>
    <description>The Treasury confirmed £2bn for river barriers across Yorkshire.</description>
    <pubDate>Tue, 29 Sep 2026 09:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

describe("ingest run isolation", () => {
  it("one broken feed never blocks the rest of the run", async () => {
    const report = await runIngestion({
      feeds: FEEDS,
      dryRun: true,
      now: () => new Date("2026-09-30T12:00:00Z"),
      fetcher: async ({ url }) =>
        url.includes("broken")
          ? { kind: "error", httpStatus: 500, reason: "ECONNRESET: connection reset" }
          : {
            kind: "ok",
            httpStatus: 200,
            body: RSS_BODY,
            bytes: RSS_BODY.length,
            contentType: "application/rss+xml",
          },
    });

    assert.equal(report.feeds.length, 2);
    const [broken, working] = report.feeds;
    assert.equal(broken.status, "FAILED");
    assert.ok(broken.error, "a failed feed must carry a reason for the operator");
    // The healthy feed still ran, and its items were still discovered.
    assert.notEqual(working.status, "FAILED");
    assert.ok(working.discovered >= 1, `working feed discovered ${working.discovered}`);
    assert.equal(report.totals.failed, 1);
    assert.equal(report.totals.ok, 1);
    assert.ok(report.totals.discovered >= 1);
  });

  it("a feed that fails mid-parse is contained to its own outcome", async () => {
    const report = await runIngestion({
      feeds: FEEDS,
      dryRun: true,
      now: () => new Date("2026-09-30T12:00:00Z"),
      fetcher: async ({ url }) =>
        url.includes("broken")
          ? {
            kind: "ok",
            httpStatus: 200,
            body: "<html><body>not a feed at all</body></html>",
            bytes: 38,
            contentType: "application/rss+xml",
          }
          : {
            kind: "ok",
            httpStatus: 200,
            body: RSS_BODY,
            bytes: RSS_BODY.length,
            contentType: "application/rss+xml",
          },
    });
    assert.equal(report.feeds.length, 2);
    assert.equal(report.totals.ok, 1);
    // A non-feed body is REJECTED, not "ok" — the summary must not hide it.
    assert.equal(report.totals.rejected, 1);
    assert.equal(report.totals.failed, 0);
    assert.ok(report.totals.discovered >= 1);
  });
});
