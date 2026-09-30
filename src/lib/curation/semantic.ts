/**
 * Semantic similarity helper: turns a configured embedding provider into the
 * `semanticSimilarity` scorer the clusterer accepts.
 *
 * Bounded work: every article is embedded ONCE per run (the provider batches
 * the request), and pairwise comparison is then pure arithmetic — no per-pair
 * network calls, no unbounded concurrency.
 *
 * Graceful degradation: a provider that fails, times out, or returns the
 * wrong shape yields `null`, the scorer is not built at all, and clustering
 * falls back to the deterministic lexical path. Semantic similarity is a
 * recall upgrade, never a dependency.
 */
import type { EmbeddingProvider } from "../providers/types";
import type { ClusterableArticle, ClusterOptions } from "./cluster";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function articleTextForEmbedding(article: {
  title: string;
  excerpt?: string | null;
}): string {
  return `${article.title}. ${article.excerpt ?? ""}`.trim().slice(0, 2000);
}

/**
 * Embed every article once and return the clusterer's scorer. Returns
 * undefined when no provider is configured or the call fails, so callers can
 * pass the result straight into clusterArticles as ClusterOptions.
 */
export async function buildSemanticScorer(
  provider: EmbeddingProvider | undefined,
  articles: ClusterableArticle[]
): Promise<ClusterOptions | undefined> {
  if (!provider || articles.length === 0) return undefined;
  let vectors: number[][] | null;
  try {
    vectors = await provider.embed(articles.map(articleTextForEmbedding));
  } catch {
    return undefined;
  }
  if (!vectors || vectors.length !== articles.length) return undefined;
  const byId = new Map<string, number[]>();
  articles.forEach((article, index) => {
    const vector = vectors?.[index];
    if (vector && vector.length > 0) byId.set(article.id, vector);
  });
  if (byId.size === 0) return undefined;
  return {
    semanticSimilarity: (a, b) => {
      const vectorA = byId.get(a.id);
      const vectorB = byId.get(b.id);
      if (!vectorA || !vectorB) return null;
      return cosineSimilarity(vectorA, vectorB);
    },
  };
}