import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  articleTextForEmbedding,
  buildSemanticScorer,
  cosineSimilarity,
} from "./semantic";
import type { ClusterableArticle, ClusterOptions } from "./cluster";
import type { EmbeddingProvider } from "../providers/types";

function article(id: string, title: string): ClusterableArticle {
  return {
    id,
    url: `https://example.com/${id}`,
    title,
    excerpt: null,
    topic: "UK",
    publishedAt: new Date("2026-09-28T10:00:00Z"),
    publisherName: "Outlet",
  };
}

describe("semantic clustering helper", () => {
  it("computes cosine similarity and handles degenerate vectors", () => {
    assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
    assert.equal(cosineSimilarity([], [1]), 0);
    assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);
    assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
  });

  it("builds a scorer that reports null for articles without vectors", async () => {
    const provider: EmbeddingProvider = {
      name: "fake",
      async embed(texts) {
        // Two vectors for three texts: the third article has no vector.
        assert.equal(texts.length, 3);
        return [
          [1, 0],
          [0.9, 0.1],
        ];
      },
    };
    const articles = [article("a", "One"), article("b", "Two"), article("c", "Three")];
    const options = await buildSemanticScorer(provider, articles);
    // Vector count must match article count, or the scorer is refused.
    assert.equal(options, undefined);
  });

  it("builds a working scorer from aligned vectors", async () => {
    const provider: EmbeddingProvider = {
      name: "fake",
      async embed(texts) {
        return texts.map((_, index) => (index === 0 ? [1, 0] : [1, 0.001]));
      },
    };
    const articles = [article("a", "One"), article("b", "Two")];
    const options = (await buildSemanticScorer(provider, articles)) as ClusterOptions;
    assert.ok(options?.semanticSimilarity);
    const score = options.semanticSimilarity!(articles[0], articles[1]);
    assert.ok(score !== null && score > 0.99);
  });

  it("returns undefined when unconfigured, failing, or empty", async () => {
    const articles = [article("a", "One")];
    assert.equal(await buildSemanticScorer(undefined, articles), undefined);
    assert.equal(await buildSemanticScorer({ name: "f", embed: async () => null }, articles), undefined);
    const failing: EmbeddingProvider = {
      name: "boom",
      async embed() {
        throw new Error("provider exploded");
      },
    };
    assert.equal(await buildSemanticScorer(failing, articles), undefined);
    assert.equal(await buildSemanticScorer(failing, []), undefined);
  });

  it("trims article text sent for embedding", () => {
    const long = "word ".repeat(1000);
    assert.ok(articleTextForEmbedding({ title: long, excerpt: long }).length <= 2000);
  });
});
