/**
 * Ingestion data contracts.
 *
 * Pure types only — no DB, no network — so both the fetch/parse layer and the
 * storage layer (and the tests) share one vocabulary. The string unions mirror
 * the Prisma enums in prisma/schema.prisma; Prisma accepts these literals
 * directly for enum columns.
 */
import type { StoryTopic } from "@/types/story";

export type FeedFormat = "RSS_2_0" | "ATOM_1_0" | "RSS_1_0";
export type DateProvenance = "PUBLISHED" | "MODIFIED" | "FETCHED";

export type RejectionCode =
  | "BAD_URL"
  | "EMPTY_TITLE"
  | "OFF_DOMAIN"
  | "OFF_TOPIC"
  | "STALE"
  | "MISSING_DATE"
  | "DUPLICATE_IN_FEED";

/** A feed ETHOS polls, declared in code and synced into IngestFeed rows. */
export interface FeedConfig {
  label: string;
  feedUrl: string;
  publisherName: string;
  publisherDomain: string;
  topic: StoryTopic;
  /** Drop items older than this many days (0 = no limit). */
  maxAgeDays?: number;
}

/** One entry as the feed supplied it — still raw, may contain HTML/entities. */
export interface RawFeedItem {
  title: string;
  link: string;
  guid?: string;
  publishedRaw?: string;
  modifiedRaw?: string;
  descriptionRaw?: string;
  authorRaw?: string;
  language?: string;
}

export interface ParsedFeed {
  format: FeedFormat;
  channelTitle: string;
  channelLanguage?: string;
  items: RawFeedItem[];
}

/** An item that passed normalisation and is fit to store. */
export interface IngestedArticle {
  url: string;
  title: string;
  author?: string;
  /** Fair-use summary, already capped at MAX_FAIR_USE_CHARS. */
  excerpt?: string;
  guid?: string;
  publishedAt: Date;
  publishedSource: DateProvenance;
  publishedRaw?: string;
  language?: string;
  topic: StoryTopic;
  /** sha256 of "title | excerpt" — detects retitled/re-summarised items. */
  contentHash: string;
}

export interface RejectedArticle {
  url: string;
  title: string;
  code: RejectionCode;
  reason: string;
}

export type NormalisationOutcome =
  | { ok: true; article: IngestedArticle }
  | { ok: false; rejection: RejectedArticle };

export interface NormaliseOptions {
  /** Defaults to the clock, injectable so tests are deterministic. */
  now?: Date;
  maxAgeDays?: number;
}

export type FetchResult =
  | {
      kind: "ok";
      httpStatus: number;
      body: string;
      bytes: number;
      contentType: string;
      etag?: string;
      lastModified?: string;
    }
  | { kind: "not-modified"; httpStatus: number }
  | { kind: "rejected"; httpStatus: number; contentType: string; reason: string }
  | { kind: "error"; httpStatus?: number; reason: string };

export interface FetchFeedOptions {
  url: string;
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
}

export type FeedRunStatus = "OK" | "NOT_MODIFIED" | "REJECTED" | "FAILED";

export interface FeedRunOutcome {
  feedUrl: string;
  label: string;
  /** Per-feed outcome of the most recent run; also printed to the console. */
  status: FeedRunStatus;
  httpStatus?: number;
  error?: string;
  durationMs: number;
  /** The feed's editorial topic, so refused entries can be stored too. */
  topic: StoryTopic;
  /** Validators to persist for the next poll; meaningful on OK / NOT_MODIFIED. */
  etag?: string;
  lastModified?: string;
  discovered: number;
  stored: number;
  duplicates: number;
  updated: number;
  rejected: number;
  rejections: RejectedArticle[];
}

export interface IngestRunReport {
  startedAt: Date;
  finishedAt: Date;
  dryRun: boolean;
  feeds: FeedRunOutcome[];
  /**
   * Per-status feed counts. Kept separate because they mean different things
   * to an operator: OK = polled and parsed; NOT_MODIFIED = polled, unchanged;
   * REJECTED = responded, but the body was not a feed; FAILED = never got a
   * usable response. Counting REJECTED as "ok" hid broken feed URLs.
   */
  totals: {
    ok: number;
    notModified: number;
    rejected: number;
    failed: number;
    discovered: number;
    stored: number;
    duplicates: number;
    updated: number;
    /** Items refused by normalisation, across all feeds. */
    refused: number;
  };
}
