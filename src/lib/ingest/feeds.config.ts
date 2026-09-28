/**
 * The feed registry.
 *
 * Declared in code (reviewable, versioned, no secrets) and synced into
 * IngestFeed rows at the start of every run, so the DB stays queryable and
 * operators can disable a noisy feed without a deploy (`enabled = false`).
 *
 * Every entry is a SECONDARY source by definition: a feed headline is
 * secondary reporting and can never satisfy the publish gate on its own.
 * Topic values mirror the StoryTopic enum in src/types/story.ts.
 */
import type { FeedConfig } from "./types";

/** Nothing older than this enters the candidate pool unless a feed overrides it. */
export const DEFAULT_MAX_AGE_DAYS = 21;

export const DEFAULT_FEEDS: FeedConfig[] = [
  {
    label: "BBC News — UK",
    feedUrl: "https://feeds.bbci.co.uk/news/uk/rss.xml",
    publisherName: "BBC News",
    publisherDomain: "bbc.co.uk",
    topic: "UK",
  },
  {
    label: "BBC News — World",
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
    publisherName: "BBC News",
    publisherDomain: "bbc.co.uk",
    topic: "World",
  },
  {
    label: "BBC News — Technology",
    feedUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    publisherName: "BBC News",
    publisherDomain: "bbc.co.uk",
    topic: "Technology",
  },
  {
    label: "The Guardian — World",
    feedUrl: "https://www.theguardian.com/world/rss",
    publisherName: "The Guardian",
    publisherDomain: "theguardian.com",
    topic: "World",
  },
  {
    label: "The Guardian — UK",
    feedUrl: "https://www.theguardian.com/uk/rss",
    publisherName: "The Guardian",
    publisherDomain: "theguardian.com",
    topic: "UK",
  },
  {
    label: "Al Jazeera — All",
    feedUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    publisherName: "Al Jazeera",
    publisherDomain: "aljazeera.com",
    topic: "World",
  },
  {
    label: "Deutsche Welle — Science",
    feedUrl: "https://rss.dw.com/rdf/science",
    publisherName: "Deutsche Welle",
    publisherDomain: "dw.com",
    topic: "Science",
  },
];

export function defaultMaxAgeDays(): number {
  return DEFAULT_MAX_AGE_DAYS;
}
