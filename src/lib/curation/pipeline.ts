/**
 * Curation pipeline: IngestedItem candidates -> gate-approved Story rows.
 *
 * One pass = cluster -> extract claims -> retrieve evidence -> assess ->
 * generate narrative -> validate (deterministic gate) -> persist. Structured
 * per-cluster so a failure on one cluster never blocks the rest, and
 * idempotent: an unchanged cluster is skipped without a version bump.
 *
 * Lifecycle written here: (no row) -> CANDIDATE/CLUSTERED -> PUBLISHED, and
 * PUBLISHED -> UPDATED (+ StoryUpdate entry) when new reporting arrives.
 * A cluster that fails the gate is logged and NOT persisted — nothing
 * half-built ever reaches the curated graph.
 */
import type { PrismaClient } from "@prisma/client";
import type { StoryTopic } from "@/types/story";
import { constructProviders, type ProviderBundle } from "../providers";
import type { StoryGenerationInput } from "../providers/types";
import {
  clusterArticles,
  isPromotable,
  significantTokens,
  type ArticleCluster,
  type ClusterableArticle,
} from "./cluster";
import { assessClaim, type Assessment } from "./assess";
import {
  buildCorroboration,
  buildDispute,
  retrieveEvidence,
} from "./evidence";
import {
  assembleStory,
  type ClaimPlan,
  type ClusterArticle,
} from "./assemble";
import { persistStory, type PersistResult } from "./persist";
import { validateStory } from "@/lib/verification";

export interface CurateOptions {
  prisma: PrismaClient;
  providers?: ProviderBundle;
  /** Max STORED candidates considered per run (bounded work). */
  maxItems?: number;
  /** Look-back window for candidates (days). */
  windowDays?: number;
  /** Assemble + gate + report, but write nothing (including no StoryUpdates). */
  dryRun?: boolean;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface CurateReport {
  dryRun: boolean;
  candidatesConsidered: number;
  clustersFound: number;
  promotable: number;
  published: PersistResult[];
  updated: PersistResult[];
  unchanged: number;
  gateBlocked: { slug: string; issues: string[] }[];
  failed: { cluster: string; error: string }[];
}

/** STORED candidates + publisher metadata, newest first, bounded. */
async function loadCandidates(
  prisma: PrismaClient,
  options: CurateOptions
): Promise<(ClusterArticle & { topic: StoryTopic })[]> {
  const windowDays = options.windowDays ?? 21;
  const since = new Date(
    (options.now?.() ?? new Date()).getTime() - windowDays * 24 * 60 * 60 * 1000
  );
  const rows = await prisma.ingestedItem.findMany({
    where: { status: "STORED", publishedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
    take: options.maxItems ?? 250,
    include: { feed: { include: { publisher: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.publishedAt,
    author: row.author,
    publisherName: row.feed.publisher.name,
    publisherDomain: row.feed.publisher.domain,
    publisherTier: row.feed.publisher.tier,
    topic: row.topic,
  }));
}

function slugifyTopic(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const MAX_CLAIMS_PER_STORY = 10;
/** Articles whose prose is mined for claims (bounded work per run). */
const MAX_ARTICLES_PER_CLAIM_SOURCE = 5;

const CLAIM_PRIORITY: Record<string, number> = {
  NUMBER: 0,
  STATISTIC: 0,
  POLICY: 1,
  EVENT: 1,
  DATE: 2,
  QUOTE: 3,
  CAUSE: 4,
  EFFECT: 4,
  STATEMENT: 5,
  PREDICTION: 6,
  OTHER: 7,
};

function normaliseForDedupe(statement: string): string {
  return statement.toLowerCase().replace(/[^a-z0-9£%\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Signals shared by at least two DISTINCT articles: the cluster's core
 * fingerprint. A claim must touch this core to be part of the story —
 * otherwise an article that merely mentions the event in passing (a weather
 * roundup, a live blog) would inject its unrelated claims into the dossier.
 */
function coreSignals(articles: ClusterArticle[]): Set<string> {
  const counts = new Map<string, Set<string>>();
  for (const article of articles) {
    for (const token of new Set(significantTokens(article))) {
      const holders = counts.get(token) ?? new Set<string>();
      holders.add(article.id);
      counts.set(token, holders);
    }
  }
  const core = new Set<string>();
  for (const [token, holders] of counts) {
    if (holders.size >= 2) core.add(token);
  }
  return core;
}

/** Is this claim about the cluster's event, or incidental to one article? */
export function isOnStory(statement: string, core: Set<string>): boolean {
  const tokens = significantTokens({ title: statement });
  const shared = tokens.filter((token) => core.has(token));
  const figures = shared.filter((token) => token.startsWith("#")).length;
  const entities = shared.filter((token) => token.startsWith("@")).length;
  const plain = shared.length - figures - entities;
  return figures >= 1 || entities >= 2 || plain >= 3;
}

/**
 * Extract atomic claims from the cluster's articles, dedupe across outlets,
 * prioritise factual types, and cap the claim budget. The source article is
 * whichever outlet's text the statement first appeared in — its URL becomes
 * the citation.
 */
async function planClaims(
  slug: string,
  articles: ClusterArticle[],
  providers: ProviderBundle,
  log: (m: string) => void
): Promise<ClaimPlan[]> {
  const sources = [...articles]
    .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
    .slice(0, MAX_ARTICLES_PER_CLAIM_SOURCE);
  const core = coreSignals(articles);

  const seen = new Map<string, ClaimPlan>();
  let offStory = 0;
  for (const article of sources) {
    const text = `${article.title}. ${article.excerpt ?? ""}`;
    const extracted = await providers.ai.extractClaims(text);
    for (const claim of extracted) {
      const key = normaliseForDedupe(claim.statement);
      if (!key || seen.has(key)) continue;
      // Every claim must touch the cluster's core signals. No exception for
      // headlines: a member's headline shares a figure or two entities with
      // the cluster by construction (that is how it merged), while a
      // passing-mention article's headline shares none.
      if (!isOnStory(claim.statement, core)) {
        offStory += 1;
        continue;
      }
      seen.set(key, {
        statement: claim.statement,
        claimType: claim.claimType,
        claimant: claim.claimant,
        isAttributionOnly: claim.isAttributionOnly,
        status: "UNVERIFIED",
        confidenceScore: 0.35,
        explanation: "Pending assessment.",
        sourceArticleId: article.id,
        evidence: [],
        corroborating: [],
        disputing: [],
      });
    }
  }

  const prioritised = [...seen.values()]
    .sort(
      (a, b) =>
        (CLAIM_PRIORITY[a.claimType] ?? 9) - (CLAIM_PRIORITY[b.claimType] ?? 9) ||
        a.statement.localeCompare(b.statement)
    )
    .slice(0, MAX_CLAIMS_PER_STORY);

  const plans: ClaimPlan[] = [];
  let evidenceIndex = 0;
  for (const plan of prioritised) {
    const source = articles.find((article) => article.id === plan.sourceArticleId);
    if (!source) continue;
    plan.corroborating = buildCorroboration(source, plan.statement, articles);
    plan.disputing = buildDispute(plan.statement, articles);

    const retrieval = await retrieveEvidence(plan.statement, providers.evidenceSearch, providers.documentFetcher, {
      // The allowlist provider returns SEARCH URLs, not documents: fetching
      // them would waste a request on a results page and never support a
      // claim. Fetching happens for real document URLs (remote provider).
      fetchDocuments: providers.evidenceSearch.name !== "allowlist-local",
    });

    const assessment: Assessment = assessClaim({
      statement: plan.statement,
      claimType: plan.claimType,
      claimant: plan.claimant,
      isAttributionOnly: plan.isAttributionOnly,
      reportingOutlets: [
        source.publisherName,
        ...plan.corroborating.map((q) => q.publisherName),
      ],
      corroboratingQuotes: plan.corroborating,
      disputingQuotes: plan.disputing,
      primaryDocumentText: retrieval.supportingDocument?.text ?? null,
      primaryDocumentTitle: retrieval.supportingDocument?.title,
      primaryDocumentBody: retrieval.supportingDocument?.issuingBody,
    });

    plan.status = assessment.status;
    plan.confidenceScore = assessment.confidenceScore;
    plan.explanation = assessment.explanation;
    if (retrieval.supportingDocument) {
      evidenceIndex += 1;
      plan.evidence = [
        {
          id: `${slug}-e${evidenceIndex}`,
          title: retrieval.supportingDocument.title.slice(0, 300),
          url: retrieval.supportingDocument.url,
          documentType: retrieval.supportingDocument.documentType,
          issuingBody: retrieval.supportingDocument.issuingBody.slice(0, 200),
          summary: retrieval.supportingDocument.summary.slice(0, 1000),
          date: retrieval.supportingDocument.date,
          excerpt: retrieval.supportingDocument.text.slice(0, 250),
        },
      ];
    }
    plans.push(plan);
  }
  log(
    `   claims: ${plans.length} planned ` +
      `(${plans.filter((p) => p.evidence.length > 0).length} document-grounded` +
      `${offStory > 0 ? `, ${offStory} off-story refused` : ""})`
  );
  return plans;
}

type ClusterOutcome =
  | { kind: "published"; result: PersistResult }
  | { kind: "updated"; result: PersistResult }
  | { kind: "unchanged"; slug: string }
  | { kind: "gateBlocked"; slug: string; issues: string[] }
  | { kind: "failed"; slug: string; error: string };

/** Structured input for the narrative generator: sources + claims + timeline. */
function buildGenerationInput(
  headline: string,
  topic: string,
  claims: ClaimPlan[],
  articles: ClusterArticle[]
): StoryGenerationInput {
  const agreed = claims
    .filter((c) => c.corroborating.length >= 1)
    .slice(0, 6)
    .map((c) => c.statement);
  const disputed = claims
    .filter((c) => c.disputing.length > 0)
    .slice(0, 4)
    .map((c) => ({
      topic: c.statement,
      positions: [
        ...c.corroborating.map((q) => `${q.publisherName}: ${q.quote}`),
        ...c.disputing.map((q) => `${q.publisherName}: ${q.quote}`),
      ],
    }));
  return {
    headline,
    topic,
    claims: claims.map((c) => ({
      statement: c.statement,
      status: c.status,
      claimant: c.claimant,
    })),
    agreements: agreed,
    disagreements: disputed,
    timeline: [...articles]
      .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
      .map((a) => ({ timestamp: a.publishedAt.toISOString(), text: a.title })),
    sourceNames: [...new Set(articles.map((a) => a.publisherName))],
  };
}

/** Merge an existing story's stored sources with the current cluster. */
function mergeWithExisting(
  existing: {
    sources: {
      id: string;
      url: string;
      title: string;
      author: string | null;
      snippet: string | null;
      publishedAt: Date;
      publisher: { name: string; domain: string; tier: ClusterArticle["publisherTier"] };
    }[];
  },
  members: ClusterArticle[]
): ClusterArticle[] {
  const byUrl = new Map<string, ClusterArticle>();
  for (const source of existing.sources) {
    byUrl.set(source.url, {
      id: source.id,
      url: source.url,
      title: source.title,
      excerpt: source.snippet,
      publishedAt: source.publishedAt,
      author: source.author,
      publisherName: source.publisher.name,
      publisherDomain: source.publisher.domain,
      publisherTier: source.publisher.tier,
    });
  }
  for (const member of members) {
    if (!byUrl.has(member.url)) byUrl.set(member.url, member);
  }
  return [...byUrl.values()];
}

async function curateCluster(
  prisma: PrismaClient,
  cluster: ArticleCluster,
  members: ClusterArticle[],
  options: CurateOptions,
  providers: ProviderBundle,
  log: (m: string) => void
): Promise<ClusterOutcome> {
  const ordered = [...members].sort(
    (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime()
  );
  const seed = ordered[0];
  const slug = slugFor(cluster.topic, seed.url, cluster.earliest);

  const existing = await prisma.story.findUnique({
    where: { slug },
    include: { sources: { include: { publisher: true } } },
  });

  // Idempotency: same set of source URLs and an existing story -> nothing to
  // do. This is what makes `pnpm curate` safe to run on a schedule.
  if (existing) {
    const existingUrls = new Set(existing.sources.map((s) => s.url));
    const clusterUrls = new Set(members.map((m) => m.url));
    const same =
      existingUrls.size === clusterUrls.size &&
      [...clusterUrls].every((url) => existingUrls.has(url));
    if (same) return { kind: "unchanged", slug };
  }

  const articles = existing ? mergeWithExisting(existing, members) : members;
  const topic = cluster.topic as StoryTopic;
  const headline = articles[0]?.title ?? slug;
  const claims = await planClaims(slug, articles, providers, log);

  const generated = await providers.ai.generateStory(
    buildGenerationInput(headline, topic, claims, articles)
  );
  const now = options.now?.() ?? new Date();
  const story = assembleStory({
    slug,
    topic,
    articles,
    claims,
    generated,
    now,
  });

  const gate = validateStory(story);
  if (!gate.publishable) {
    return {
      kind: "gateBlocked",
      slug,
      issues: gate.issues.map((i) => `${i.code}: ${i.message}`),
    };
  }

  if (options.dryRun) {
    const version = (existing?.version ?? 0) + 1;
    log(
      `   DRY: would ${existing ? "update" : "publish"} ${slug} v${version} ` +
        `(${articles.length} sources, ${claims.length} claims, gate clean)`
    );
    return {
      kind: existing ? "updated" : "published",
      result: { storyId: "", slug, created: !existing, version },
    };
  }

  const addedUrls = articles
    .map((a) => a.url)
    .filter((url) => !existing?.sources.some((s) => s.url === url));
  const updateSummary =
    existing && addedUrls.length > 0
      ? `Added ${addedUrls.length} new source(s) (${addedUrls
        .map((url) => articles.find((a) => a.url === url)?.publisherName ?? "")
        .filter(Boolean)
        .join(", ")}); claims reassessed against the new reporting.`
      : undefined;

  const result = await persistStory(prisma, story, {
    extractionProvenance: `${providers.ai.name}@mvp-1`,
    aiProvider: providers.report.ai.name,
    aiModel: providers.report.ai.kind === "local" ? null : (process.env.AI_MODEL ?? "configured-model"),
    generatedAt: now,
    updateSummary,
  });
  log(
    `   ${existing ? "UPDATED" : "PUBLISHED"} ${slug} v${result.version} ` +
      `(${articles.length} sources, ${claims.length} claims, gate clean)`
  );
  return existing
    ? { kind: "updated", result }
    : { kind: "published", result };
}

/**
 * One full curation pass over recent STORED candidates. Cluster failures are
 * captured per cluster — one bad cluster never aborts the run.
 */
export async function runCuration(options: CurateOptions): Promise<CurateReport> {
  const log = options.log ?? ((): void => undefined);
  const prisma = options.prisma;
  const providers = options.providers ?? constructProviders();

  log(
    `providers: ai=${providers.report.ai.name} (${providers.report.ai.kind}), ` +
      `evidence=${providers.report.evidenceSearch.name} (${providers.report.evidenceSearch.kind})` +
      (providers.isDevelopmentMode ? " — DEVELOPMENT MODE" : "")
  );

  const candidates = await loadCandidates(prisma, options);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const clusterable: ClusterableArticle[] = candidates.map(
    ({ id, url, title, excerpt, publishedAt, publisherName, topic }) => ({
      id,
      url,
      title,
      excerpt,
      publishedAt,
      publisherName,
      topic,
    })
  );
  const clusters = clusterArticles(clusterable);

  const report: CurateReport = {
    dryRun: options.dryRun ?? false,
    candidatesConsidered: candidates.length,
    clustersFound: clusters.length,
    promotable: 0,
    published: [],
    updated: [],
    unchanged: 0,
    gateBlocked: [],
    failed: [],
  };

  for (const cluster of clusters) {
    if (!isPromotable(cluster)) continue;
    report.promotable += 1;
    const members = cluster.articleIds
      .map((id) => byId.get(id))
      .filter((m): m is ClusterArticle & { topic: StoryTopic } => m !== undefined);
    if (members.length < 2) continue;

    log(`${cluster.key} — ${members.length} articles, ${cluster.distinctPublishers} publishers`);
    try {
      const outcome = await curateCluster(prisma, cluster, members, options, providers, log);
      if (outcome.kind === "published") report.published.push(outcome.result);
      else if (outcome.kind === "updated") report.updated.push(outcome.result);
      else if (outcome.kind === "unchanged") {
        report.unchanged += 1;
        log(`   unchanged ${outcome.slug}`);
      } else if (outcome.kind === "gateBlocked") {
        report.gateBlocked.push({ slug: outcome.slug, issues: outcome.issues });
        log(`   GATE BLOCKED ${outcome.slug}: ${outcome.issues[0] ?? ""}`);
      } else {
        report.failed.push({ cluster: cluster.key, error: outcome.error });
        log(`   FAILED ${outcome.slug}: ${outcome.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.failed.push({ cluster: cluster.key, error: message });
      log(`   FAILED ${cluster.key}: ${message}`);
    }
  }

  log(
    `curate: ${report.candidatesConsidered} candidates -> ${report.clustersFound} clusters, ` +
      `${report.promotable} promotable | ${report.published.length} published, ` +
      `${report.updated.length} updated, ${report.unchanged} unchanged, ` +
      `${report.gateBlocked.length} gate-blocked, ${report.failed.length} failed`
  );
  return report;
}





/**
 * Deterministic slug: keyed on the cluster's EARLIEST article URL, which is
 * stable as a cluster grows (new reporting is always newer). Hashing the
 * whole URL set instead would mint a NEW story every time one article joins
 * — the exact duplication the update path exists to prevent.
 */
export function slugFor(topic: string, seedUrl: string, earliest: Date): string {
  let hash = 2166136261;
  for (let i = 0; i < seedUrl.length; i += 1) {
    hash ^= seedUrl.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(36).slice(0, 6);
  const date = earliest.toISOString().slice(0, 10).replace(/-/g, "");
  return `${slugifyTopic(topic)}-${date}-${hex}`;
}

