/**
 * Evidence retrieval + corroboration/dispute discovery. Network I/O goes
 * through the provider interfaces (SSRF-guarded, bounded); everything else is
 * deterministic text overlap. NEVER invents evidence: without a configured
 * search provider or a fetched supporting document, claims simply stay
 * UNVERIFIED / PARTIALLY_SUPPORTED — "not enough evidence" is a success.
 */
import { documentSupportsClaim } from "./assess";
import type { EvidenceCandidate } from "../providers/types";
import type { DocumentFetcher, EvidenceSearchProvider } from "../providers/types";
import type { ClusterArticle } from "./assemble";

export interface RetrievedEvidence {
  /** Search hits — leads for editors, never persisted as "supporting" docs. */
  candidates: EvidenceCandidate[];
  /** The first fetched document that supports the SPECIFIC claim, if any. */
  supportingDocument: (EvidenceCandidate & { text: string }) | null;
}

/** Bounded: three candidates, sequential fetches, hard timeouts in the fetcher. */
export const MAX_EVIDENCE_CANDIDATES = 3;

export async function retrieveEvidence(
  statement: string,
  search: EvidenceSearchProvider,
  fetcher: DocumentFetcher,
  options?: { fetchDocuments?: boolean }
): Promise<RetrievedEvidence> {
  let candidates: EvidenceCandidate[] = [];
  try {
    candidates = await search.searchEvidence(statement, {
      maxResults: MAX_EVIDENCE_CANDIDATES,
    });
  } catch {
    // Search failure is ordinary: no candidates, claim stays unverified.
    candidates = [];
  }
  if (options?.fetchDocuments === false) {
    return { candidates, supportingDocument: null };
  }
  for (const candidate of candidates.slice(0, MAX_EVIDENCE_CANDIDATES)) {
    if (!candidate.url.startsWith("http")) continue;
    const doc = await fetcher.fetchDocument(candidate.url);
    if (!doc) continue;
    if (documentSupportsClaim(statement, doc.text)) {
      return { candidates, supportingDocument: { ...candidate, text: doc.text } };
    }
  }
  return { candidates, supportingDocument: null };
}

/** Dispute verbs an outlet uses to contradict a claim. */
const DISPUTE_VERBS =
  /\b(denies?|denied|dispute[sd]?|contradict\w*|rules? out|ruled out|false|misleading|inaccurate|no such (?:plan|deal|agreement)|did not|has not|never (?:been|said|happened)|walked back|corrected)\b/i;

function keywordOverlap(a: string, b: string): { ratio: number; hasFigure: boolean } {
  const wordsA = a.toLowerCase().replace(/[^a-z0-9£%\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);
  const lowerB = b.toLowerCase();
  if (wordsA.length === 0) return { ratio: 0, hasFigure: false };
  const hits = wordsA.filter((w) => lowerB.includes(w)).length;
  const figure = a.match(/£?\d[\d,]*(?:\.\d+)?(?:bn|m|k|%)?/);
  return {
    ratio: hits / wordsA.length,
    hasFigure: figure ? lowerB.includes(figure[0].toLowerCase()) : true,
  };
}

/**
 * Does another outlet's coverage corroborate (or dispute) this claim?
 * Looser than documentSupportsClaim — excerpts are short — but the figure,
 * when the claim has one, must still match exactly.
 */
export function articleCoversClaim(statement: string, article: ClusterArticle): boolean {
  const text = `${article.title}. ${article.excerpt ?? ""}`;
  const { ratio, hasFigure } = keywordOverlap(statement, text);
  return hasFigure && ratio >= 0.4;
}

/** Corroborating quotes: other outlets covering the same claim. */
export function buildCorroboration(
  source: ClusterArticle,
  claimStatement: string,
  cluster: ClusterArticle[]
): { publisherName: string; url: string; quote: string }[] {
  return cluster
    .filter((article) => article.id !== source.id && articleCoversClaim(claimStatement, article))
    .map((article) => ({
      publisherName: article.publisherName,
      url: article.url,
      quote: (article.excerpt ?? article.title).slice(0, 250),
    }));
}

/**
 * Disputing quotes: another outlet covers the claim's substance while
 * explicitly contradicting it. Requires BOTH overlap and a dispute verb —
 * sharing an entity is not disagreement.
 */
export function buildDispute(
  claimStatement: string,
  cluster: ClusterArticle[]
): { publisherName: string; url: string; quote: string; disputeReason: string }[] {
  return cluster
    .filter((article) => {
      const text = `${article.title}. ${article.excerpt ?? ""}`;
      return articleCoversClaim(claimStatement, article) && DISPUTE_VERBS.test(text);
    })
    .map((article) => ({
      publisherName: article.publisherName,
      url: article.url,
      quote: (article.excerpt ?? article.title).slice(0, 250),
      disputeReason: "This outlet's reporting explicitly contradicts or corrects the claim.",
    }));
}
