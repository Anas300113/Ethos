import React from "react";
import { getAllStories } from "@/data/mockStories";
import { StoryCard } from "@/components/story/StoryCard";
import { Sparkles, SlidersHorizontal } from "lucide-react";

export default function ForYouPage() {
  const stories = getAllStories();
  // Filter for high impact / tech & science interest
  const recommended = stories.slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-editorial flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>Curated For You</span>
          </h1>
          <p className="text-xs text-zinc-500">
            Tailored synthesis calibrated to your evidentiary interests.
          </p>
        </div>
        <button
          aria-label="Tune preferences"
          className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {recommended.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </div>
  );
}
