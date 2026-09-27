import React from "react";
import { getAllStories } from "@/data/mockStories";
import { StoryCard } from "@/components/story/StoryCard";
import { Bookmark, FolderOpen } from "lucide-react";

export default function SavedPage() {
  const stories = getAllStories();
  // Exemplar saved stories for demonstration
  const savedStories = [stories[0]];

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
      <div className="border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-editorial flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-zinc-900 dark:text-white" />
          <span>Saved Dossiers</span>
        </h1>
        <p className="text-xs text-zinc-500">
          Offline reading library and pinned primary evidence trackers.
        </p>
      </div>

      {savedStories.length > 0 ? (
        <div className="space-y-4">
          {savedStories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 space-y-2">
          <FolderOpen className="w-8 h-8 text-zinc-400 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No saved dossiers yet
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Bookmark stories and primary documents to access them quickly here.
          </p>
        </div>
      )}
    </div>
  );
}
