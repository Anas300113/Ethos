import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  articleSimilarity,
  clusterArticles,
  hasSameEventSignal,
  isPromotable,
  MERGE_THRESHOLD,
  type ClusterableArticle,
} from "./cluster";

const HOUR = 60 * 60 * 1000;

function article(overrides: Partial<ClusterableArticle> & { id: string }): ClusterableArticle {
  return {
    url: `https://example.com/${overrides.id}`,
    title: "Untitled",
    topic: "UK",
    publishedAt: new Date("2026-09-28T10:00:00Z"),
    publisherName: "Outlet",
    ...overrides,
  };
}

describe("clustering", () => {
  it("merges differently-worded reports of the same event", () => {
    const articles = [
      article({
        id: "a",
        title: "Government announces £4bn housing package",
        excerpt: "Ministers confirmed the funding for new homes across England.",
        publisherName: "BBC",
      }),
      article({
        id: "b",
        title: "Ministers unveil major housing investment",
        excerpt:
          "The government set out a £4bn programme to build new homes.",
        publisherName: "Guardian",
      }),
      article({
        id: "c",
        title: "UK government announces new housing measures",
        excerpt: "A £4bn package for housebuilding was confirmed by ministers.",
        publisherName: "Al Jazeera",
      }),
    ];
    const clusters = clusterArticles(articles);
    // Debug anchor: if this trips, print sims with
    //   npx tsx scripts/cluster-debug.ts
    // a~b share £4bn/government/housing; b~c and a~c share the chain through
    // the £4bn figure and housing vocabulary — the calibrated threshold holds
    // all three together, which is the spec example verbatim.
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].articleIds.length, 3);
    assert.equal(clusters[0].distinctPublishers, 3);
    assert.ok(isPromotable(clusters[0]));
  });

  it("does not merge unrelated stories that share an entity", () => {
    const articles = [
      article({
        id: "a",
        title: "Bank of England holds interest rates at 4%",
        publisherName: "BBC",
      }),
      article({
        id: "b",
        title: "Bank of England publishes climate stress-test results",
        publisherName: "Guardian",
      }),
    ];
    // Bank-rates vs climate-tests: one shared entity, different substance.
    // Bare headlines score ~0.44 here — above MERGE_THRESHOLD — which is
    // exactly why the threshold is not the guard: the HARD SIGNAL is
    // (one shared entity is a beat, not an event). See the next test.
    const similarity = articleSimilarity(articles[0], articles[1]);
    assert.ok(similarity < 0.5, `bare-headline entity pair scored ${similarity}`);
    assert.equal(clusterArticles(articles).length, 2);
  });

  it("does not merge across topics or across a week apart", () => {
    const base = article({ id: "a", title: "Ministers unveil £4bn housing plan" });
    const otherTopic = article({ id: "b", title: "Ministers unveil £4bn housing plan", topic: "World" });
    const stale = article({
      id: "c",
      title: "Ministers unveil £4bn housing plan",
      publishedAt: new Date(base.publishedAt.getTime() - 10 * 24 * HOUR),
    });
    assert.equal(clusterArticles([base, otherTopic]).length, 2);
    assert.equal(clusterArticles([base, stale]).length, 2);
  });

  it("is deterministic regardless of input order", () => {
    const articles = [
      article({ id: "a", title: "Council approves city centre housing scheme" }),
      article({ id: "b", title: "City centre housing scheme approved by council vote" }),
      article({ id: "c", title: "Rain delays test match at Headingley" }),
    ];
    const forward = clusterArticles(articles).map((c) => c.articleIds.join(","));
    const backward = clusterArticles([...articles].reverse()).map((c) =>
      c.articleIds.join(",")
    );
    assert.deepEqual([...forward].sort(), [...backward].sort());
  });

  it("requires a hard signal, not just similar wording", () => {
    // Both are "Bank of England" stories — same beat, different events. One
    // shared entity is a beat, not an event, so they must stay apart.
    const rates = article({
      id: "h1",
      title: "Bank of England holds interest rates at 4%",
      excerpt: "The Bank of England kept rates unchanged at 4% after its latest meeting.",
      publisherName: "BBC",
    });
    const climate = article({
      id: "h2",
      title: "Bank of England publishes climate stress-test results",
      excerpt: "The Bank of England published results of its climate stress test for lenders.",
      publisherName: "Guardian",
    });
    assert.ok(articleSimilarity(rates, climate) >= MERGE_THRESHOLD);
    assert.ok(!hasSameEventSignal(rates, climate));
    assert.equal(clusterArticles([rates, climate]).length, 2);

    // Shared figure = same event, even when the wording barely overlaps.
    const appleCourt = article({
      id: "h3",
      title: "Apple ordered to pay $5.7bn after losing vibration tech patent suit",
      excerpt: "A US court ordered Apple to pay $5.7bn after it lost a patent case.",
      publisherName: "BBC",
    });
    const applePatent = article({
      id: "h4",
      title: "Apple must pay $5.7bn in patent defeat",
      excerpt: "Apple has been ordered to pay $5.7bn following its patent court loss.",
      publisherName: "Guardian",
    });
    assert.ok(hasSameEventSignal(appleCourt, applePatent));
    assert.equal(clusterArticles([appleCourt, applePatent]).length, 1);
  });

  it("a single outlet alone is not promotable", () => {
    const clusters = clusterArticles([
      article({ id: "a", title: "Exclusive: minister resigns, says aide" }),
    ]);
    assert.equal(clusters.length, 1);
    assert.ok(!isPromotable(clusters[0]));
  });
});
