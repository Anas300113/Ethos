import React from "react";
import Link from "next/link";
import { Search as SearchIcon, Inbox } from "lucide-react";
import { StoryCard } from "@/components/story/StoryCard";
import { searchStories } from "@/lib/stories/dal";
import type { StoryTopic } from "@/types/story";

// Search answers from live published state.
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

interface SearchPageProps {
  searchParams: Promise<{ q?: string; topic?: string }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = first(params.q) ?? "";
  const rawTopic = first(params.topic);
  const topic = TOPICS.find(
    (candidate) => candidate.toLowerCase() === (rawTopic ?? "").toLowerCase()
  );

  const results = await searchStories(query, { topic, limit: 30 });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-3">
        <h1 className="font-editorial text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
          Search
        </h1>
        <form action="/search" method="get" className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search stories, claims and sources"
            aria-label="Search stories"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
          {topic && <input type="hidden" name="topic" value={topic} />}
        </form>

        <nav aria-label="Topics" className="flex flex-wrap gap-2">
          <Link
            href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !topic
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            All
          </Link>
          {TOPICS.map((item) => {
            const active = item === topic;
            const href = `/search?${query ? `q=${encodeURIComponent(query)}&` : ""}topic=${item}`;
            return (
              <Link
                key={item}
                href={href}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {item}
              </Link>
            );
          })}
        </nav>
      </header>

      <p className="text-xs text-zinc-500">
        {results.length} {results.length === 1 ? "story" : "stories"}
        {topic ? ` in ${topic}` : ""}
        {query ? ` matching “${query}”` : ""}
      </p>

      {results.length > 0 ? (
        <div className="space-y-6">
          {results.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <div className="text-center py-14 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 space-y-2">
          <Inbox className="w-7 h-7 text-zinc-400 mx-auto" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Nothing published yet
          </h2>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            ETHOS only returns stories that cleared the evidence gate. Try a
            different topic, or run the curation pipeline to publish more.
          </p>
        </div>
      )}
    </div>
  );
}
