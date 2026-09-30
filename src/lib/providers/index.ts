/**
 * Provider factory: one working provider per capability, chosen by env.
 *
 *   AI_PROVIDER=local (default)  -> LocalAIProvider, zero credentials.
 *   AI_PROVIDER=openai|custom + AI_API_KEY -> RemoteAIProvider.
 *   EVIDENCE_SEARCH_PROVIDER unset -> AllowlistEvidenceSearch (zero creds).
 *   EVIDENCE_SEARCH_PROVIDER=tavily|custom + EVIDENCE_SEARCH_API_KEY ->
 *     RemoteEvidenceSearch.
 *
 * constructProviders() never throws for missing credentials: it degrades to
 * local and says so in the report. The app renders the report's verdict
 * ("Development mode — local synthesis") instead of pretending.
 */
import { LocalAIProvider } from "./local-ai";
import { AllowlistEvidenceSearch, RemoteEvidenceSearch } from "./evidence";
import { GuardedDocumentFetcher } from "./documents";
import { RemoteAIProvider } from "./remote-ai";
import { RemoteEmbeddingsProvider } from "./embeddings";
import type {
  AIProvider,
  DocumentFetcher,
  EmbeddingProvider,
  EvidenceSearchProvider,
  ProviderReport,
} from "./types";

export interface ProviderBundle {
  ai: AIProvider;
  evidenceSearch: EvidenceSearchProvider;
  documentFetcher: DocumentFetcher;
  /** Absent unless an embedding provider is configured (semantic clustering). */
  embeddings?: EmbeddingProvider;
  report: ProviderReport;
  /** True when every capability is local — the honest "dev mode" flag. */
  isDevelopmentMode: boolean;
}

export function constructProviders(env: Record<string, string | undefined> = process.env): ProviderBundle {
  const aiName = (env.AI_PROVIDER ?? "local").toLowerCase();
  const ai =
    aiName !== "local" && env.AI_API_KEY
      ? new RemoteAIProvider({
        apiKey: env.AI_API_KEY,
        endpoint: env.AI_ENDPOINT,
        model: env.AI_MODEL,
        name: env.AI_PROVIDER,
      })
      : new LocalAIProvider();
  const aiKind = ai instanceof RemoteAIProvider ? "remote" : "local";

  const evidenceName = (env.EVIDENCE_SEARCH_PROVIDER ?? "").toLowerCase();
  const evidenceSearch =
    evidenceName && env.EVIDENCE_SEARCH_API_KEY
      ? new RemoteEvidenceSearch({
        apiKey: env.EVIDENCE_SEARCH_API_KEY,
        endpoint: env.EVIDENCE_SEARCH_ENDPOINT,
        name: env.EVIDENCE_SEARCH_PROVIDER,
      })
      : new AllowlistEvidenceSearch();
  const evidenceKind = evidenceSearch instanceof RemoteEvidenceSearch ? "remote" : "local";

  // Embeddings are optional: absent credentials simply means semantic
  // clustering is skipped and the deterministic lexical path is used.
  const embeddingsKey = env.EMBEDDINGS_API_KEY;
  const embeddings =
    embeddingsKey && embeddingsKey.length > 0
      ? new RemoteEmbeddingsProvider({
        apiKey: embeddingsKey,
        endpoint: env.EMBEDDINGS_ENDPOINT,
        model: env.EMBEDDINGS_MODEL,
        name: env.EMBEDDINGS_PROVIDER,
      })
      : undefined;

  return {
    ai,
    evidenceSearch,
    documentFetcher: new GuardedDocumentFetcher(),
    ...(embeddings ? { embeddings } : {}),
    report: {
      ai: { kind: aiKind, name: ai.name },
      evidenceSearch: { kind: evidenceKind, name: evidenceSearch.name },
      documentFetch: { kind: "local", name: "guarded-fetch" },
      embeddings: embeddings
        ? { kind: "remote" as const, name: embeddings.name }
        : { kind: "local" as const, name: "none" },
    },
    isDevelopmentMode: aiKind === "local" && evidenceKind === "local",
  };
}
