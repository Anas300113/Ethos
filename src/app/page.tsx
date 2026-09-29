import React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { StoryCard } from "@/components/story/StoryCard";
import { ProviderBanner } from "@/components/system/ProviderBanner";
import { getPublishedStories, getTrendingStories } from "@/lib/stories/dal";
import type { StoryTopic } from "@/types/story";

// Reader pages read live database state: never prerender a news feed.
export const dynamic = "force-dynamic";

const TOPICS: StoryTopic[] = [
  "UK",
  "World",
  "Technology",
  "Science",
  "Business",
  "Climate",
  "Sport",
  "Culture",
  "Health",
  "Education",
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

export default async function Home() {
  const [stories, trending] = await Promise.all([
    getPublishedStories({ limit: 12 }),
    getTrendingStories(3),
  ]);
  const hero = trending[0] ?? stories[0];
  const rest = stories.filter((story) => story.id !== hero?.id).slice(0, 6);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
      <header className="space-y-4">
        <h1 className="font-editorial text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          {greeting()}
        </h1>
        <form action="/search" className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="search"
            name="q"
            placeholder="Search stories, claims and sources"
            aria-label="Search ETHOS"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
        </form>
        <ProviderBanner />
      </header>

      {!hero && (
        <section className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center space-y-2">
          <h2 className="font-editorial text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            No published stories yet
          </h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            ETHOS publishes a story once at least two outlets report the same
            event and every claim clears the verification gate. Run
            {" "}
            <code className="font-mono text-xs">pnpm ingest</code> then
            {" "}
            <code className="font-mono text-xs">pnpm curate</code>.
          </p>
        </section>
      )}

      {hero && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-zinc-200/80 dark:border-zinc-800 pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Today
            </h2>
            <span className="text-xs text-zinc-400">
              {hero.sources.length} sources
            </span>
          </div>
          <StoryCard story={hero} variant="hero" />
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/80 dark:border-zinc-800 pb-2">
            Top stories
          </h2>
          <div className="space-y-6">
            {rest.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

      <nav aria-label="Topics" className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Topics
        </h2>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <Link
              key={topic}
              href={`/search?topic=${topic}`}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {topic}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
