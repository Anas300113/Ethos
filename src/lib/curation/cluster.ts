/**
 * Deterministic story clustering: which ingested candidates describe the SAME
 * real-world event. Pure functions over title/excerpt metadata — no network,
 * no model, no database.
 *
 * Two signals, both deliberately conservative ("not enough evidence" merges
 * nothing). Embeddings/pgvector stay the documented upgrade path for when
 * full article bodies are available; on RSS titles + excerpts lexical signals
 * are honest about their limits and fully reproducible.
 */
import { collapseWhitespace } from "../ingest/text";

export interface ClusterableArticle {
  id: string;
  url: string;
  title: string;
  excerpt?: string | null;
  topic: string;
  publishedAt: Date;
  publisherName: string;
}

/** Anything with text to fingerprint — tokens only need a title and excerpt. */
export interface ArticleText {
  title: string;
  excerpt?: string | null;
}

export interface ArticleCluster {
  key: string;
  topic: string;
  articleIds: string[];
  distinctPublishers: number;
  earliest: Date;
  latest: Date;
}

/** Words that carry no event signal. Kept small and generic on purpose. */
const STOPWORDS = new Set(
  "a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,be,been,being,has,have,had,do,does,did,will,would,can,could,should,may,might,must,shall,this,that,these,those,it,its,their,they,them,we,our,you,your,he,she,his,her,they,them,not,no,yes,all,any,each,more,most,other,some,such,only,own,same,so,than,too,very,just,about,into,over,after,before,between,during,under,again,once,here,there,when,where,why,how,what,which,who,whom,says,said,say,announces,announce,announced,unveil,unveils,unveiled,reveals,report,reports,amid,live,latest,breaking,today,yesterday".split(
    ","
  )
);

/**
 * Generic reporting verbs that appear in half of all headlines. Matched as
 * whole words and stripped before entity extraction, so "Government
 * announces" and "Ministers unveil" do not mint different entities.
 */
const GENERIC_VERBS = new Set(
  "announce,announces,announced,unveil,unveils,unveiled,reveal,reveals,revealed,say,says,said,report,warn,warns,warned,confirm,confirms,confirmed,launch,launches,launched,rule,rules,ruled,back,backs,backed,urge,urges,urged,plan,plans,planned,set,sets,new,major".split(
    ","
  )
);

/** £4bn, 100,000, 3.5% — numbers are the strongest same-event signal. */
const NUMBER_TOKEN = /£?\d[\d,]*(?:\.\d+)?(?:bn|m|k|%|thousand|million|billion)?/gi;
/** Capitalised runs: people, organisations, places ("Bank of England").
 *  Separators are spaces/tabs ONLY — a period ends a sentence, and without
 *  this "…Hurricane Polo. Hurricane Nolo…" matches as one entity. */
const ENTITY_TOKEN = /\b[A-Z][a-z]+(?:[ \t]+(?:of[ \t]+)?[A-Z][a-z]+){0,2}\b/g;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9£%\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !GENERIC_VERBS.has(w));
}

/**
 * Capitalised words that are NOT entities: weekdays, months, seasons. They
 * pass the "Capitalised" test constantly ("persists on Sunday") and would
 * otherwise supply the two-entity signal that merges unrelated weather
 * stories into one cluster.
 */
const NOISE_ENTITIES = new Set(
  "monday,tuesday,wednesday,thursday,friday,saturday,sunday,january,february,march,april,may,june,july,august,september,october,november,december,spring,summer,autumn,winter,today,tomorrow,yesterday,amid,meanwhile,however,still,inside,first,last,next,new".split(
    ","
  )
);

/** Trim leading/trailing noise words: "Hurricane Polo the" -> "Hurricane Polo". */
function cleanEntity(entity: string): string | null {
  const parts = entity.split(/\s+/);
  while (parts.length > 0 && (STOPWORDS.has(parts[0].toLowerCase()) || GENERIC_VERBS.has(parts[0].toLowerCase()) || parts[0].toLowerCase() === "of")) {
    parts.shift();
  }
  while (
    parts.length > 0 &&
    (STOPWORDS.has(parts[parts.length - 1].toLowerCase()) ||
      GENERIC_VERBS.has(parts[parts.length - 1].toLowerCase()) ||
      parts[parts.length - 1].toLowerCase() === "of")
  ) {
    parts.pop();
  }
  if (parts.length === 0) return null;
  const joined = parts.join(" ");
  if (GENERIC_VERBS.has(joined.toLowerCase())) return null;
  // A lone day/month/season name is not an entity.
  if (parts.length === 1 && NOISE_ENTITIES.has(joined.toLowerCase())) return null;
  if (parts.every((part) => NOISE_ENTITIES.has(part.toLowerCase()))) return null;
  return joined;
}

/** Significant tokens: numbers first, then entities, then content words. */
export function significantTokens(article: ArticleText): string[] {
  // Title and excerpt are joined with a period, never a bare space: "...Polo"
  // + "Hurricane Nolo..." must not match as one entity. (Claims and evidence
  // code composes text the same way.)
  const text = collapseWhitespace(`${article.title}. ${article.excerpt ?? ""}`);
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (token: string): void => {
    const key = token.toLowerCase().replace(/\s+/g, " ").trim();
    if (key.length > 1 && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  };
  for (const match of text.matchAll(NUMBER_TOKEN)) push(`#${match[0]}`);
  for (const match of text.matchAll(ENTITY_TOKEN)) {
    const entity = cleanEntity(match[0]);
    // Noise-word-only matches contribute nothing as entities; the plain-word
    // pass below still picks up their content words.
    if (entity && !STOPWORDS.has(entity.toLowerCase())) push(`@${entity}`);
  }
  for (const word of words(text)) push(word);
  return out;
}

/**
 * Pairwise similarity in [0, 1] — DIRECTIONAL by design: the numerator walks
 * `a`'s tokens (the candidate joining), the denominator bounds it by both
 * sides' weighted sizes, so the score reads "how much of a's substance does
 * b cover?". clusterArticles always passes (newArticle, clusterMember): what
 * matters when attaching is whether the cluster COVERS the newcomer.
 * Numbers and entities count double; topics must match (checked by caller).
 */
export function articleSimilarity(
  a: ClusterableArticle,
  b: ClusterableArticle
): number {
  if (a.topic !== b.topic) return 0;
  const tokensA = significantTokens(a);
  const tokensB = new Set(significantTokens(b));
  if (tokensA.length === 0) return 0;
  let shared = 0;
  let weighted = 0;
  for (const token of tokensA) {
    const weight = token.startsWith("#") || token.startsWith("@") ? 2 : 1;
    weighted += weight;
    if (tokensB.has(token)) shared += weight;
  }
  return weighted === 0 ? 0 : shared / Math.max(weighted, tokensB.size);
}

/**
 * Does this pair belong to the same event?
 *
 * The hard signal (shared figure, or >=2 shared entities) is mandatory in
 * both paths — that is what stops "two stories about the same person
 * organisation" from merging. Within that gate, the deterministic lexical
 * score is the safety floor, and configured embeddings may additionally
 * rescue a genuine rewrite the lexical score cannot see.
 */
function pairMerges(
  candidate: ClusterableArticle,
  member: ClusterableArticle,
  options?: ClusterOptions
): boolean {
  if (!hasSameEventSignal(candidate, member)) return false;
  if (articleSimilarity(candidate, member) >= MERGE_THRESHOLD) return true;
  const semantic = options?.semanticSimilarity?.(candidate, member) ?? null;
  return semantic !== null && semantic >= SEMANTIC_MERGE_THRESHOLD;
}

function clusterKey(members: ClusterableArticle[]): string {
  const counts = new Map<string, number>();
  for (const article of members) {
    for (const token of new Set(significantTokens(article))) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  const shared = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, 4)
    .map(([token]) => token.replace(/^[@#]/, "").replace(/\s+/g, "-"));
  const fingerprint = shared.length > 0 ? shared.join("+") : "single";
  return `${members[0].topic}:${fingerprint}`;
}

/**
 * Minimum similarity for a candidate to attach to a cluster; the hard-signal
 * requirement below does the real precision work. Calibrated on the live
 * corpus (88 articles): unrelated pairs peak ~0.13-0.18, genuine same-event
 * cross-outlet coverage sits at 0.22-0.32 (BBC + Guardian hurricane coverage
 * = 0.226), and the adversarial bare-headline "Bank of England" pair scores
 * 0.44 — it is excluded by the hard signal, not by this number.
 */
export const MERGE_THRESHOLD = 0.2;

/**
 * Optional semantic (embedding) merge threshold. Embeddings are an ADDITIONAL
 * recall path for rewrites the lexical score cannot see ("chip shortage hits
 * car plants" vs "semiconductor supply crunch halts production"), never a
 * replacement for the deterministic rules: a pair still has to carry a hard
 * signal (shared figure, or >=2 shared entities) to merge, so two articles
 * about the same organisation or person never merge on resemblance alone.
 */
export const SEMANTIC_MERGE_THRESHOLD = 0.82;

export interface ClusterOptions {
  /**
   * Cosine similarity from sentence embeddings, when a provider is
   * configured. Returns null when either article has no vector.
   */
  semanticSimilarity?: (a: ClusterableArticle, b: ClusterableArticle) => number | null;
}

/**
 * Hard signals: a shared FIGURE (numbers are event-specific) or at least two
 * shared named entities. Two articles sharing only generic vocabulary — or a
 * single country/organisation name, which is a beat, not an event — do not
 * merge, however similar the wording.
 */
export function hardSignalOverlap(
  a: ArticleText,
  b: ArticleText
): { figures: number; entities: number } {
  const setB = new Set(significantTokens(b));
  const shared = significantTokens(a).filter((token) => setB.has(token));
  return {
    figures: shared.filter((token) => token.startsWith("#")).length,
    entities: shared.filter((token) => token.startsWith("@")).length,
  };
}

/** Does the pair carry enough hard signal to be treated as the same event? */
export function hasSameEventSignal(a: ArticleText, b: ArticleText): boolean {
  const { figures, entities } = hardSignalOverlap(a, b);
  return figures >= 1 || entities >= 2;
}
/** Articles further apart than this never merge, however similar the words. */
export const MAX_CLUSTER_SPAN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Greedy single-link clustering, deterministic: articles sorted by
 * (publishedAt, id); each joins the first cluster with any in-window member
 * that is BOTH similar enough (MERGE_THRESHOLD) and carries a hard signal
 * (shared figure, or >=2 shared entities), else starts its own. Single-article
 * clusters are returned too — promotion decides what becomes a story.
 *
 * Single-link chains (a~b, b~c merge even when a/c share little) are
 * ACCEPTED: real coverage arrives as rewrite chains (wire -> morning edition
 * -> evening analysis), and splitting the chain duplicates stories. The
 * guards are the topic gate, the 7-day window, and two-publisher promotion.
 */
export function clusterArticles(
  articles: ClusterableArticle[],
  options?: ClusterOptions
): ArticleCluster[] {
  const ordered = [...articles].sort(
    (x, y) =>
      x.publishedAt.getTime() - y.publishedAt.getTime() ||
      x.id.localeCompare(y.id)
  );
  const clusters: { members: ClusterableArticle[] }[] = [];
  for (const article of ordered) {
    // Greedy single-link: join the first cluster with any in-window member
    // above threshold. Best-match reordering was tried and rejected — it made
    // membership depend on processing order in the opposite direction and
    // fixed nothing. Chaining (a~b, b~c with a/c weak) is ACCEPTED, not a bug:
    // real coverage arrives as rewrite chains, and the topic gate, the 7-day
    // window, and two-publisher promotion are the guards against false merges.
    let placed = false;
    for (const cluster of clusters) {
      if (cluster.members[0].topic !== article.topic) continue;
      const spanOk = cluster.members.some(
        (member) =>
          Math.abs(member.publishedAt.getTime() - article.publishedAt.getTime()) <=
          MAX_CLUSTER_SPAN_DAYS * DAY_MS
      );
      if (!spanOk) continue;
      if (
        cluster.members.some((member) => pairMerges(article, member, options))
      ) {
        cluster.members.push(article);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ members: [article] });
  }
  return clusters.map(({ members }) => {
    const times = members.map((m) => m.publishedAt.getTime());
    return {
      key: clusterKey(members),
      topic: members[0].topic,
      articleIds: members.map((m) => m.id),
      distinctPublishers: new Set(members.map((m) => m.publisherName)).size,
      earliest: new Date(Math.min(...times)),
      latest: new Date(Math.max(...times)),
    };
  });
}

/**
 * Promotion rule: a cluster becomes a story candidate when at least two
 * DISTINCT publishers report it. One outlet alone is coverage, not a story.
 */
export function isPromotable(cluster: ArticleCluster): boolean {
  return cluster.distinctPublishers >= 2;
}
