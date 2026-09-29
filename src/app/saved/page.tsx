import React from "react";
import Link from "next/link";
import { Bookmark, FolderOpen } from "lucide-react";
import { StoryCard } from "@/components/story/StoryCard";
import { getStoryBySlug } from "@/lib/stories/dal";
import { getReaderId, getSavedStoryRefs } from "@/lib/reader";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const readerId = await getReaderId();
  const refs = readerId ? await getSavedStoryRefs(readerId) : [];
  // Unpublishing a story makes its bookmark unreadable, not an error.
  const stories = (await Promise.all(refs.map((ref) => getStoryBySlug(ref.slug)))).filter(
    (story): story is NonNullable<typeof story> => story !== null
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header className="border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
        <h1 className="font-editorial text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
          <Bookmark className="w-5 h-5" />
          <span>Saved</span>
        </h1>
        <p className="text-xs text-zinc-500">
          Stories you saved, and whether they moved on since.
        </p>
      </header>

      {stories.length > 0 ? (
        <div className="space-y-6">
          {stories.map((story) => {
            const ref = refs.find((candidate) => candidate.slug === story.slug);
            return (
              <div key={story.id} className="space-y-1.5">
                {ref?.updatedSinceSaved && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Updated since you saved this —{" "}
                    <Link href={`/story/${story.slug}`} className="underline">
                      see what changed
                    </Link>
                  </p>
                )}
                <StoryCard story={story} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 space-y-2">
          <FolderOpen className="w-8 h-8 text-zinc-400 mx-auto" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Nothing saved yet
          </h2>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Save a story from its page and it will appear here. Saving happens
            on this device only — no account needed.
          </p>
        </div>
      )}
    </div>
  );
}
