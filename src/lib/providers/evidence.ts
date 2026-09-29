/**
 * Evidence providers.
 *
 * Two search implementations, chosen by constructProviders():
 *   - AllowlistEvidenceSearch: zero-credential. Matches claim text against a
 *     curated map of authoritative domains (gov.uk, parliament.uk, ons, UN).
 *     It does NOT fabricate documents: a candidate records that the claim
 *     falls under an authority's remit with a search URL an editor can open —
 *     status stays UNVERIFIED until a fetched document actually supports it.
 *   - RemoteEvidenceSearch: used when EVIDENCE_SEARCH_PROVIDER + key are set.
 *     Failures degrade to "no candidates", never to invented evidence.
 */
import type { EvidenceCandidate, EvidenceSearchProvider } from "./types";

/** Authoritative domains, mapped from the claim subjects they can ground. */
const AUTHORITY_DOMAINS: { match: RegExp; body: string; searchBase: string }[] = [
  { match: /\b(housing|homes?|planning|rent|mortgage|council tax)\b/i, body: "Ministry of Housing, Communities and Local Government", searchBase: "https://www.gov.uk/search/all?keywords=" },
  { match: /\b(treasury|budget|fiscal|tax|spending|deficit|debt)\b/i, body: "HM Treasury", searchBase: "https://www.gov.uk/search/all?keywords=" },
  { match: /\b(nhs|health|hospital|gp|waiting lists?)\b/i, body: "Department of Health and Social Care", searchBase: "https://www.gov.uk/search/all?keywords=" },
  { match: /\b(school|university|education|ofsted|curriculum)\b/i, body: "Department for Education", searchBase: "https://www.gov.uk/search/all?keywords=" },
  { match: /\b(climate|emissions?|net zero|cop\d*|environment)\b/i, body: "Department for Energy Security and Net Zero", searchBase: "https://www.gov.uk/search/all?keywords=" },
  { match: /\b(inflation|interest rates?|bank of england|gdp|unemployment|ons|statistics)\b/i, body: "Office for National Statistics", searchBase: "https://www.ons.gov.uk/search?q=" },
  { match: /\b(parliament|mp|lords?|commons|bill|legislation|hansard)\b/i, body: "UK Parliament", searchBase: "https://www.parliament.uk/search/results?searchTerm=" },
  { match: /\b(un|treaty|geneva|security council|who|nato|eu\b|european)\b/i, body: "United Nations", searchBase: "https://www.un.org/search?query=" },
];

function keywordsFor(statement: string): string {
  const words = statement
    .toLowerCase()
    .replace(/[^a-z0-9£%\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);
  return words.join(" ");
}

export function authoritySearchBases(): string[] {
  return AUTHORITY_DOMAINS.map((a) => {
    try {
      return new URL(a.searchBase).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }).filter(Boolean);
}

export class AllowlistEvidenceSearch implements EvidenceSearchProvider {
  readonly name = "allowlist-local";

  async searchEvidence(query: string): Promise<EvidenceCandidate[]> {
    const out: EvidenceCandidate[] = [];
    for (const authority of AUTHORITY_DOMAINS) {
      if (!authority.match.test(query)) continue;
      const keywords = keywordsFor(query);
      out.push({
        title: `${authority.body} — official publications matching "${keywords}"`,
        url: `${authority.searchBase}${encodeURIComponent(keywords)}`,
        issuingBody: authority.body,
        documentType: "GOVERNMENT_DOCUMENT",
        summary:
          `The claim falls under ${authority.body}'s remit. Open the search to ` +
          "locate the primary document; until a document is fetched and assessed, " +
          "the claim stays UNVERIFIED.",
      });
      if (out.length >= 3) break;
    }
    return out;
  }
}

export class RemoteEvidenceSearch implements EvidenceSearchProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(options?: { apiKey?: string; endpoint?: string; name?: string }) {
    this.apiKey = options?.apiKey ?? process.env.EVIDENCE_SEARCH_API_KEY ?? "";
    this.endpoint =
      options?.endpoint ??
      process.env.EVIDENCE_SEARCH_ENDPOINT ??
      "https://api.tavily.com/search";
    this.name = options?.name ?? process.env.EVIDENCE_SEARCH_PROVIDER ?? "remote";
  }

  async searchEvidence(
    query: string,
    options?: { maxResults?: number }
  ): Promise<EvidenceCandidate[]> {
    if (!this.apiKey) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: Math.min(Math.max(options?.maxResults ?? 5, 1), 10),
          include_domains: authoritySearchBases(),
        }),
        signal: controller.signal,
      });
      if (!response.ok) return [];
      const data = (await response.json()) as {
        results?: { title?: string; url?: string; content?: string }[];
      };
      return (data.results ?? [])
        .slice(0, 5)
        .map((result) => ({
          title: (result.title ?? "Untitled result").slice(0, 200),
          url: result.url ?? "",
          issuingBody: hostOf(result.url ?? ""),
          documentType: "OFFICIAL_STATEMENT" as const,
          summary: (result.content ?? "").slice(0, 500),
        }))
        .filter((candidate) => candidate.url.startsWith("http"));
    } catch {
      // Evidence search failing is ordinary: the claim stays UNVERIFIED.
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
