/** Prints exact similarity for the two reference pairs used in tests. */
import {
  articleSimilarity,
  clusterArticles,
  type ClusterableArticle,
} from "../src/lib/curation/cluster";

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

const a = article({ id: "a", title: "Government announces £4bn housing package", excerpt: "Ministers confirmed the funding for new homes across England.", publisherName: "BBC" });
const b = article({ id: "b", title: "Ministers unveil major housing investment", excerpt: "The government set out a £4bn programme to build new homes.", publisherName: "Guardian" });
const c = article({ id: "c", title: "UK government announces new housing measures", excerpt: "A £4bn package for housebuilding was confirmed by ministers.", publisherName: "Al Jazeera" });
const bank1 = article({ id: "r1", title: "Bank of England holds interest rates at 4%", publisherName: "BBC" });
const bank2 = article({ id: "r2", title: "Bank of England publishes climate stress-test results", publisherName: "Guardian" });
// Real-style same-event pair: figure + entity shared, different wording.
const real1 = article({ id: "p1", title: "Apple ordered to pay $5.7bn after losing vibration tech patent suit", excerpt: "A US court ordered Apple to pay $5.7bn after it lost a patent case to an audio firm." });
const real2 = article({ id: "p2", title: "Apple must pay $5.7bn in patent defeat", excerpt: "Apple has been ordered to pay $5.7bn following its patent court loss in the US." });

const housing = [a, b, c];
console.log("housing a-b:", articleSimilarity(a, b).toFixed(3));
console.log("housing a-c:", articleSimilarity(a, c).toFixed(3));
console.log("housing b-c:", articleSimilarity(b, c).toFixed(3));
console.log("bank unrelated (bare):", articleSimilarity(bank1, bank2).toFixed(3));
console.log("apple same-event:", articleSimilarity(real1, real2).toFixed(3));
const clusters = clusterArticles(housing);
console.log("housing clusters:", clusters.length, clusters.map((x) => x.articleIds.join("+")).join(" | "));
