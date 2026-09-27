"use client";

import React, { useState } from "react";
import { getAllStories } from "@/data/mockStories";
import { StoryCard } from "@/components/story/StoryCard";
import { Search as SearchIcon, Filter, Layers } from "lucide-react";
import { StoryTopic } from "@/types/story";

const TOPICS: ("All" | StoryTopic)[] = [
  "All",
  "UK",
  "Technology",
  "Climate",
  "World",
  "Science",
  "Business",
];

export default function SearchPage() {
  const allStories = getAllStories();
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("All");

  const filtered = allStories.filter((story) => {
    const matchesTopic =
      selectedTopic === "All" ||
      story.topic.toLowerCase() === selectedTopic.toLowerCase();

    const matchesQuery =
      !query.trim() ||
      story.headline.toLowerCase().includes(query.toLowerCase()) ||
      story.oneSentenceSummary.toLowerCase().includes(query.toLowerCase()) ||
      story.whatHappened.toLowerCase().includes(query.toLowerCase()) ||
      story.claims.some((c) =>
        c.statement.toLowerCase().includes(query.toLowerCase())
      );

    return matchesTopic && matchesQuery;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-editorial">
          Search Intelligence
        </h1>
        <p className="text-xs text-zinc-500">
          Query indexed claims, primary documents, and corroborating reporting.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by topic, statutory body, or claim..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
      </div>

      {/* Topic Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1" />
        {TOPICS.map((topic) => {
          const isSelected = selectedTopic === topic;
          return (
            <button
              key={topic}
              onClick={() => setSelectedTopic(topic)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isSelected
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {topic}
            </button>
          );
        })}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-1">
        <span>{filtered.length} Dossiers Found</span>
        <span>Filter: {selectedTopic}</span>
      </div>

      {/* Stories List */}
      <div className="space-y-4">
        {filtered.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 space-y-2">
            <Layers className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              No matching intelligence dossiers
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Try adjusting your search query or reset the topic filter to
              discover more stories.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
