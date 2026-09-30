/**
 * Remote embeddings provider (OpenAI-compatible /v1/embeddings).
 *
 * Constructed ONLY when EMBEDDINGS_API_KEY is set. Failure is ordinary:
 * `embed()` returns null and the curation pipeline simply clusters lexically,
 * exactly as it does with zero credentials. Semantic similarity is a recall
 * upgrade for the deterministic clusterer, never a dependency.
 *
 * Batching is deliberate: candidates are sent in fixed-size chunks so one
 * curation run makes a bounded number of requests regardless of corpus size.
 */
import type { EmbeddingProvider } from "./types";

export class RemoteEmbeddingsProvider implements EmbeddingProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly batchSize = 64;
  private readonly timeoutMs = 30_000;

  constructor(options?: { apiKey?: string; endpoint?: string; model?: string; name?: string }) {
    this.apiKey = options?.apiKey ?? process.env.EMBEDDINGS_API_KEY ?? "";
    this.endpoint =
      options?.endpoint ?? process.env.EMBEDDINGS_ENDPOINT ?? "https://api.openai.com/v1/embeddings";
    this.model = options?.model ?? process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";
    this.name = options?.name ?? process.env.EMBEDDINGS_PROVIDER ?? "remote-embeddings";
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  async embed(texts: string[]): Promise<number[][] | null> {
    if (!this.configured || texts.length === 0) return null;
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += this.batchSize) {
      const batch = texts.slice(start, start + this.batchSize);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ model: this.model, input: batch }),
          signal: controller.signal,
        });
        if (!response.ok) return null;
        const data = (await response.json()) as {
          data?: { index?: number; embedding?: number[] }[];
        };
        const rows = data.data ?? [];
        if (rows.length !== batch.length) return null;
        // Order by the provider's own index: never assume response order.
        const ordered = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        for (const row of ordered) {
          if (!Array.isArray(row.embedding) || row.embedding.length === 0) return null;
          vectors.push(row.embedding);
        }
      } catch {
        // No embeddings this run: the clusterer stays deterministic.
        return null;
      } finally {
        clearTimeout(timer);
      }
    }
    return vectors;
  }
}