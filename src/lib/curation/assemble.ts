/**
 * Assembly: cluster + assessed claims + generated prose -> the Story object
 * the publish gate validates and the UI renders. Pure — no DB, no network.
 *
 * Everything here is DETERMINISTIC given its inputs: headlines come from the
 * reporting itself (earliest article title, fair-use length), timelines from
 * publication order, source comparisons from each outlet's own excerpt.
 * The AI (local template or remote model) only supplies narrative prose via
 * `generated`, and whatever it says is later re-checked by validateStory().
 */
import type { ArticleSource, Claim, Story, StoryTopic, TimelineEvent } from "@/types/story";
import { resolveStance } from "@/lib/stance";
import { groupSources, type SourcedItem } from "./independence";
import type { StoryGenerationOutput } from "../providers/types";

export interface ClusterArticle {
  id: string;
  url: string;
  title: string;
  excerpt?: string | null;
  publishedAt: Date;
  author?: string | null;
  publisherName: string;
  publisherDomain: string;
  publisherTier: "PRIMARY" | "SECONDARY_TIER1" | "SECONDARY_TIER2" | "FACT_CHECKER";
}

export interface ClaimPlan {
  statement: string;
  claimType: string;
  claimant: string | null;
  isAttributionOnly: boolean;
  status: Claim["status"];
  confidenceScore: number;
  explanation: string;
  /** Article the claim text was extracted from — its URL is the citation. */
  sourceArticleId: string;
  /** Independent sourcing groups behind this claim (see independence). */
  independentSourceCount: number;
  /** Reader-facing note when outlets repeat a shared source. */
  sourcingNote: string | null;
  evidence: Claim["primaryEvidence"];
  corroborating: Claim["corroboratingSources"];
  disputing: NonNullable<Claim["disputingSources"]>;
}

export interface AssembleInput {
  /** Stable slug derived from cluster key + date; re-runs find the same story. */
  slug: string;
  topic: StoryTopic;
  articles: ClusterArticle[];
  claims: ClaimPlan[];
  generated: StoryGenerationOutput;
  now: Date;
  readingTimeMinutes?: number;
}

const MAX_HEADLINE_CHARS = 110;
const MAX_SNIPPET_CHARS = 250;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

/** Reading time: ~200 wpm over headline + sections + claim statements. */
export function estimateReadingMinutes(input: AssembleInput): number {
  const words = [
    input.generated.headline,
    input.generated.whatHappened,
    input.generated.whyItMatters,
    ...input.generated.whatWeKnow,
    ...input.generated.whatIsUnclear,
    ...input.claims.map((c) => c.statement),
  ].join(" ").split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Source-comparison items: for every claim with >=2 reporting outlets, one
 * item whose points are each outlet's own excerpt. Stance is resolved through
 * resolveStance — never defaulted locally (AGENTS.md).
 */
export function buildComparisonItems(input: AssembleInput) {
  const items: Story["whereSourcesDiffer"] = [];
  let index = 0;
  const seen = new Set<string>();
  for (const claim of input.claims) {
    if (seen.has(claim.statement)) continue;
    const outlets = input.articles.filter((article) =>
      claim.corroborating.some((q) => q.url === article.url)
    );
    if (outlets.length < 2) continue;
    seen.add(claim.statement);
    index += 1;
    items.push({
      id: `${input.slug}-cmp-${index}`,
      topic: truncate(claim.statement, MAX_SNIPPET_CHARS),
      points: outlets.map((article) => ({
        sourceName: article.publisherName,
        reporting: truncate(article.excerpt ?? article.title, MAX_SNIPPET_CHARS),
        stance: resolveStance({ reporting: article.excerpt ?? article.title }),
      })),
    });
  }
  return items;
}

export function assembleStory(input: AssembleInput): Story {
  const articles = [...input.articles].sort(
    (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime()
  );
  // Sourcing groups travel with articles into the dossier: the reader sees
  // which outlets share a wire, not just a raw outlet count (AGENTS.md).
  const sourcedById = new Map<string, SourcedItem>(
    groupSources(
      articles.map((article) => ({
        id: article.id,
        publisherName: article.publisherName,
        publisherDomain: article.publisherDomain,
        title: article.title,
        excerpt: article.excerpt,
      }))
    ).map((item) => [item.id, item])
  );
  const sources: ArticleSource[] = articles.map((article) => {
    const sourced = sourcedById.get(article.id);
    return {
      id: article.id,
      url: article.url,
      title: truncate(article.title, MAX_SNIPPET_CHARS + 100),
      author: article.author ?? undefined,
      publishedAt: article.publishedAt.toISOString(),
      retrievedAt: article.publishedAt.toISOString(),
      snippet: article.excerpt ? truncate(article.excerpt, MAX_SNIPPET_CHARS) : undefined,
      sourcingGroup: sourced?.sourcingGroup,
      sharedSourceLabel: sourced?.sharedSourceLabel,
      publisher: {
        // Domain doubles as a stable stand-in id for UI keys; the DB write
        // path resolves the real Publisher row by domain.
        id: article.publisherDomain,
        name: article.publisherName,
        domain: article.publisherDomain,
        tier: article.publisherTier,
      },
    };
  });

  const claims: Claim[] = input.claims.map((plan, index) => ({
    id: `${input.slug}-c${index + 1}`,
    statement: plan.statement,
    status: plan.status,
    confidenceScore: plan.confidenceScore,
    explanation: plan.explanation,
    claimType: plan.claimType,
    claimant: plan.claimant ?? undefined,
    independentSourceCount: plan.independentSourceCount,
    sourcingNote: plan.sourcingNote ?? undefined,
    primaryEvidence: plan.evidence,
    corroboratingSources: plan.corroborating,
    disputingSources: plan.disputing.length > 0 ? plan.disputing : undefined,
    lastVerified: input.now.toISOString(),
  }));

  const timeline: TimelineEvent[] = articles.map((article, index) => ({
    id: `${input.slug}-t${index + 1}`,
    timestamp: article.publishedAt.toISOString(),
    displayTime: article.publishedAt.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }),
    eventText: truncate(article.title, MAX_SNIPPET_CHARS),
    sourceUrl: article.url,
    sourceName: article.publisherName,
  }));

  return {
    id: input.slug,
    slug: input.slug,
    headline: truncate(
      input.generated.headline || articles[0]?.title || input.slug,
      MAX_HEADLINE_CHARS
    ),
    oneSentenceSummary: input.generated.oneSentenceSummary,
    topic: input.topic,
    readingTimeMinutes: input.readingTimeMinutes ?? estimateReadingMinutes(input),
    lastUpdated: input.now.toISOString(),
    version: 1,
    whatHappened: input.generated.whatHappened,
    whyItMatters: input.generated.whyItMatters,
    whatWeKnow: input.generated.whatWeKnow,
    whatIsUnclear: input.generated.whatIsUnclear,
    sourcesAgreeOn: input.generated.sourcesAgreeOn,
    whereSourcesDiffer: buildComparisonItems(input),
    claims,
    timeline,
    primaryEvidence: claims.flatMap((c) => c.primaryEvidence),
    sources,
    updates: [],
  };
}
