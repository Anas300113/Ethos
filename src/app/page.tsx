import React from "react";
import { getAllStories } from "@/data/mockStories";
import { StoryCard } from "@/components/story/StoryCard";
import { Sparkles, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const stories = getAllStories();
  const leadStory = stories[0];
  const otherStories = stories.slice(1);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {/* Editorial Mission Callout */}
      <section className="bg-gradient-to-r from-zinc-900 to-zinc-800 text-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-medium uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              <span>Multi-Source Intelligence Dossier</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              News grounded in verified primary evidence.
            </h1>
            <p className="text-xs text-zinc-300 leading-relaxed max-w-lg">
              Every story cross-references secondary journalism against official
              treaties, parliamentary records, and statutory statistical releases.
            </p>
          </div>
        </div>
      </section>

      {/* Lead Story */}
      {leadStory && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Lead Story
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              Version {leadStory.version}.0
            </span>
          </div>
          <StoryCard story={leadStory} />
        </section>
      )}

      {/* Further Dispatches */}
      {otherStories.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-500" />
              <span>Developing Stories</span>
            </h2>
            <Link
              href="/search"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
            >
              <span>Explore All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {otherStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

